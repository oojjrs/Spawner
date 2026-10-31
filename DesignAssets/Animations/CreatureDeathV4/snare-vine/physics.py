import math
import numpy as np
from engine import ease, rot, matrix

def wrapped(value):
    return (value + math.pi) % (2 * math.pi) - math.pi

def pressure(time, interval):
    return 1 - ease((time - interval[0]) / (interval[1] - interval[0]))

def boundary(image):
    alpha = np.array(image)[:, :, 3]
    points = []
    for x in range(0, 512, 2):
        y = np.flatnonzero(alpha[:, x] > 128)
        if len(y):
            points.extend([[x, y[0]], [x, y[-1]]])
    return np.array(points, float)

def make_rod(spec):
    points = np.array(spec['points'], float)
    delta = np.diff(points, 1, 0)
    lengths = np.linalg.norm(delta, 2, 1)
    angles = np.arctan2(delta[:, 1], delta[:, 0])
    rest = np.arctan2(np.sin(np.diff(angles)), np.cos(np.diff(angles)))
    count = len(points)
    a, b = np.triu_indices(count, 4)
    return {'positions': points.copy(), 'previous': points.copy(), 'rest': points.copy(), 'lengths': lengths, 'angles': rest, 'radii': np.array(spec['radii']), 'weights': np.full(count, count / spec['mass']), 'pairs': [a, b], 'spec': spec}

def bend(rod, stiffness, dt):
    points, weights = rod['positions'], rod['weights']
    u, v = points[1:-1] - points[:-2], points[2:] - points[1:-1]
    first = np.maximum(np.sum(u * u, 1), .01)
    second = np.maximum(np.sum(v * v, 1), .01)
    a = np.column_stack([-u[:, 1], u[:, 0]]) / first[:, None]
    c = np.column_stack([-v[:, 1], v[:, 0]]) / second[:, None]
    b = -a - c
    angle = np.arctan2(u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0], np.sum(u * v, 1))
    error = np.arctan2(np.sin(angle - rod['angles']), np.cos(angle - rod['angles']))
    denominator = weights[:-2] * np.sum(a * a, 1) + weights[1:-1] * np.sum(b * b, 1) + weights[2:] * np.sum(c * c, 1)
    multiplier = -.45 * error / (denominator + 1 / (stiffness * dt * dt))
    limit = np.maximum(np.abs(rod['angles']) + .15, rod['spec']['maximumCurvature'])
    violation = angle - np.clip(angle, -limit, limit)
    multiplier -= .45 * violation / np.maximum(denominator, .001)
    points[:-2] += weights[:-2, None] * a * multiplier[:, None]
    points[1:-1] += weights[1:-1, None] * b * multiplier[:, None]
    points[2:] += weights[2:, None] * c * multiplier[:, None]

def project_lengths(rod):
    points, lengths, weights = rod['positions'], rod['lengths'], rod['weights']
    for i, length in enumerate(lengths):
        delta = points[i + 1] - points[i]
        distance = max(.001, np.linalg.norm(delta))
        correction = delta * (distance - length) / distance / (weights[i] + weights[i + 1])
        points[i] += weights[i] * correction
        points[i + 1] -= weights[i + 1] * correction

def self_collision(rod):
    a, b = rod['pairs']
    points, radii, weights = rod['positions'], rod['radii'], rod['weights']
    delta = points[b] - points[a]
    distance = np.linalg.norm(delta, 2, 1)
    minimum = (radii[a] + radii[b]) * .92
    active = (distance < minimum) & (distance > .001)
    a, b, delta, distance, minimum = a[active], b[active], delta[active], distance[active], minimum[active]
    correction = delta * ((minimum - distance) / distance / (weights[a] + weights[b]))[:, None] * .55
    np.add.at(points, a, -weights[a, None] * correction)
    np.add.at(points, b, weights[b, None] * correction)

def simulate(rig, images, duration):
    dt = 1 / 120
    center = np.array(rig['bodyCenter'], float)
    state = np.r_[center, 0.]
    velocity = np.zeros(3)
    inverse = np.array([1 / 3, 1 / 3, 1 / 8508])
    outline = boundary(images['bulb']) - center
    rods = {name: make_rod(spec) for name, spec in rig['rods'].items()}
    records = []
    support_points = np.array([[195, 402], [255, 413], [301, 394]], float)
    for step in range(round(duration / 1000 * 120) + 1):
        time = step * dt * 1000
        old = state.copy()
        body = matrix(state[:2], center, state[2])
        if time > 60:
            force = np.array([0, 3 * 900, 0.], float)
            for point, weight, interval in zip(support_points, [.42, .34, .24], [[90, 230], [110, 270], [150, 300]]):
                arm = body[:2, :2] @ (point - center)
                now = state[:2] + arm
                speed = velocity[1] + velocity[2] * arm[0]
                upward = pressure(time, interval) * max(0, weight * 3.42 * 900 + 900 * (now[1] - point[1]) + 45 * speed)
                force[1] -= upward
                force[2] -= arm[0] * upward
            force[2] -= 8508 * pressure(time, [90, 280]) * (85 * state[2] + 12 * velocity[2])
            velocity += force * inverse * dt
            velocity *= math.exp(-2 * dt)
            state += velocity * dt
            for rod in rods.values():
                positions = rod['positions']
                current = positions.copy()
                positions += (positions - rod['previous']) * .98 + np.array([0, 900 * dt * dt])
                rod['previous'] = current
        contact = False
        for iteration in range(55):
            for rod in rods.values():
                active = pressure(time, rod['spec']['pressureInterval'])
                bend(rod, 3 + 1000 * active * active, dt)
                project_lengths(rod)
                if iteration % 4 == 0:
                    self_collision(rod)
                positions = rod['positions']
                for index in rod['spec']['anchors']:
                    arm = rot(state[2]) @ (rod['rest'][index] - center)
                    target = state[:2] + arm
                    for axis in range(2):
                        error = positions[index, axis] - target[axis]
                        angular = arm[1] if axis == 0 else -arm[0]
                        denominator = rod['weights'][index] + inverse[axis] + angular * angular * inverse[2]
                        multiplier = -error / denominator
                        positions[index, axis] += rod['weights'][index] * multiplier
                        state[axis] -= inverse[axis] * multiplier
                        state[2] += inverse[2] * angular * multiplier
                body = matrix(state[:2], center, state[2])
                relative = (positions - state[:2]) @ body[:2, :2]
                radius = np.array([88, 61], float) + rod['radii'][:, None] * .7
                normal = relative / radius
                size = np.linalg.norm(normal, 2, 1)
                inside = size < 1
                if np.any(inside):
                    correction = normal[inside] / np.maximum(size[inside, None], .001) * radius[inside] - relative[inside]
                    positions[inside] += correction @ body[:2, :2].T
                positions[:, 1] = np.minimum(positions[:, 1], 448 - rod['radii'])
            surface = outline @ rot(state[2]).T
            depth = surface[:, 1] + state[1] - 448
            point = int(np.argmax(depth))
            if depth[point] > 0:
                contact = True
                arm = surface[point, 0]
                multiplier = -depth[point] / (inverse[1] + arm * arm * inverse[2])
                state[1] += inverse[1] * multiplier
                state[2] += inverse[2] * arm * multiplier
        velocity = (state - old) / dt
        if contact:
            velocity[0] *= math.exp(-25 * dt)
            velocity[2] *= math.exp(-25 * dt)
        body = matrix(state[:2], center, state[2])
        saved = {}
        for name, rod in rods.items():
            floor = rod['positions'][:, 1] >= 447.9 - rod['radii']
            rod['previous'][floor] = rod['positions'][floor] - (rod['positions'][floor] - rod['previous'][floor]) * .65
            saved[name] = rod['positions'].copy()
        records.append({'timeMs': time, 'q': state.tolist(), 'velocity': velocity.tolist(), 'body': body.tolist(), 'contact': contact, 'rods': saved})
    return records
