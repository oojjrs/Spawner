import math
import numpy as np

def rot(angle):
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s], [s, c]])

def ease(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)

def matrix(center, bind, angle):
    result = np.eye(3)
    result[:2, :2] = rot(angle)
    result[:2, 2] = center - result[:2, :2] @ bind
    return result

def outline(image):
    alpha = np.asarray(image)[:, :, 3]
    result = []
    for x in range(0, 512, 3):
        y = np.flatnonzero(alpha[:, x] > 128)
        if len(y):
            result.extend([[x, float(y[0])], [x, float(y[-1])]])
    return np.asarray(result, float)

def wrap(value):
    return (value + math.pi) % (2 * math.pi) - math.pi

def skin_contacts(images, rig, centers, leg_indices, leg_grounds):
    result = []
    for name in rig['legs']:
        spec = rig['skinMeshes'][name]
        vertices = np.asarray(spec['vertices'], float)
        vertex_weights = np.asarray(spec['weights'], float)[:, 1]
        alpha = np.asarray(images[name + '-skin'])[:, :, 3] > 128
        padded = np.pad(alpha, 1)
        interior = np.ones_like(alpha)
        for dy in range(3):
            for dx in range(3):
                interior &= padded[dy:dy + 512, dx:dx + 512]
        y, x = np.where(alpha & ~interior)
        points = np.column_stack([x + .5, y + .5])
        nearest = np.clip(np.rint(vertices).astype(int), 0, 511)
        points = np.concatenate([points, vertices[alpha[nearest[:, 1], nearest[:, 0]]]])
        assigned = np.zeros(len(points), bool)
        barycentric = np.zeros((len(points), 3))
        offsets = np.zeros((len(points), 3, 2))
        influence = np.zeros((len(points), 3))
        knee = np.asarray(spec['knee'])
        for triangle in spec['triangles']:
            uv = vertices[triangle]
            basis = np.column_stack([uv[1] - uv[0], uv[2] - uv[0]])
            value = (points - uv[0]) @ np.linalg.inv(basis).T
            selected = (value[:, 0] >= -1e-6) & (value[:, 1] >= -1e-6) & (value.sum(1) <= 1 + 1e-6) & ~assigned
            if not selected.any():
                continue
            barycentric[selected] = np.column_stack([1 - value[selected].sum(1), value[selected]])
            offsets[selected] = uv - knee
            influence[selected] = vertex_weights[triangle]
            assigned[selected] = True
        upper, lower, hoof = leg_indices[name]
        result.append((upper, lower, knee - centers[upper], barycentric[assigned], offsets[assigned], influence[assigned], leg_grounds[name]))
    return result

def solve_skin_contact(state, inverse, spec):
    upper, lower, knee_local, barycentric, offsets, influence, ground = spec
    knee_arm = rot(state[upper, 2]) @ knee_local
    knee = state[upper, :2] + knee_arm
    angle = state[upper, 2] + wrap(state[lower, 2] - state[upper, 2]) * influence
    cosine, sine = np.cos(angle), np.sin(angle)
    x = offsets[:, :, 0] * cosine - offsets[:, :, 1] * sine
    y = offsets[:, :, 0] * sine + offsets[:, :, 1] * cosine
    depths = knee[1] + (barycentric * y).sum(1) - ground
    worst = int(np.argmax(depths))
    depth = depths[worst]
    if depth <= 0:
        return False
    upper_arm = knee_arm[0] + np.sum(barycentric[worst] * (1 - influence[worst]) * x[worst])
    lower_arm = np.sum(barycentric[worst] * influence[worst] * x[worst])
    effective = inverse[upper, 1] + upper_arm * upper_arm * inverse[upper, 2] + lower_arm * lower_arm * inverse[lower, 2]
    multiplier = -depth / effective
    state[upper, 1] += inverse[upper, 1] * multiplier
    state[upper, 2] += inverse[upper, 2] * upper_arm * multiplier
    state[lower, 2] += inverse[lower, 2] * lower_arm * multiplier
    return True

def simulate(images, rig, duration):
    names = ['body', 'head-open']
    centers = [np.array(rig['coreCenters']['body'], float), np.array(rig['coreCenters']['head'], float)]
    masses = [6, 3]
    inertias = [26934, 10800]
    grounds = [448, 448]
    joints = [(0, 1, np.array(rig['neck'], float), 'neck')]
    limits = [(0, 1, -.8, .35, 0)]
    motors = [(0, 1, 'neck', 10000000)]
    leg_indices = {}
    leg_grounds = {}
    for name, points in rig['legs'].items():
        points = np.asarray(points, float)
        indices = []
        leg_grounds[name] = float(np.argwhere(np.asarray(images[name + '-hoof'])[:, :, 3] > 128)[:, 0].max())
        for section, mass in zip(['upper', 'lower', 'hoof'], [.42, .18, .15]):
            part = name + '-' + section
            pixels = np.argwhere(np.asarray(images[part])[:, :, 3] > 128)[:, ::-1]
            center = np.array(rig['massCenters'][part], float)
            inertia = mass * np.mean(np.sum((pixels - center) ** 2, 1))
            indices.append(len(names))
            names.append(part)
            centers.append(center)
            masses.append(mass)
            inertias.append(inertia)
            grounds.append(leg_grounds[name])
        upper, lower, hoof = indices
        leg_indices[name] = indices
        joints.extend([(0, upper, points[0], name), (upper, lower, points[1], name), (lower, hoof, points[2], name)])
        a, b = points[1] - points[0], points[2] - points[1]
        difference = wrap(math.atan2(b[1], b[0]) - math.atan2(a[1], a[0]))
        limits.append((upper, lower, .04 if 'fore' in name else -2.7, 2.7 if 'fore' in name else -.04, difference))
        limits.append((0, upper, -.8 if 'fore' in name else .1, 3.3 if 'fore' in name else 3.65, math.atan2(a[1], a[0])))
        limits.append((-1, hoof, -1.2, 1.2, 0))
        motors.extend([(0, upper, name, 2000000), (upper, lower, name, 800000), (-1, hoof, name, 400000)])
    centers = np.asarray(centers)
    inverse = np.column_stack([1 / np.asarray(masses), 1 / np.asarray(masses), 1 / np.asarray(inertias)])
    boundaries = [outline(images[name]) - center for name, center in zip(names, centers)]
    for name, indices in leg_indices.items():
        for index in indices[:2]:
            boundaries[index] = np.empty((0, 2))
    skin_surfaces = skin_contacts(images, rig, centers, leg_indices, leg_grounds)
    local_joints = [(a, b, point - centers[a], point - centers[b], group) for a, b, point, group in joints]
    state = np.column_stack([centers, np.zeros(len(names))])
    velocity = np.zeros_like(state)
    dt = 1 / 240
    records = []
    intervals = {'neck': [70, 260], 'fore-near': [80, 270], 'fore-far': [110, 290], 'hind-near': [170, 390], 'hind-far': [190, 420]}
    for step in range(round(duration * 240 / 1000) + 1):
        time = step * dt * 1000
        previous = state.copy()
        strength = {name: 1 - ease((time - interval[0]) / (interval[1] - interval[0])) for name, interval in intervals.items()}
        if time > 60:
            velocity[:, 1] += 900 * dt
            velocity *= math.exp(-.9 * dt)
            state += velocity * dt
        contacts = np.zeros(len(names), bool)
        for iteration in range(24):
            for first, second, a, b, group in local_joints:
                a = rot(state[first, 2]) @ a
                b = rot(state[second, 2]) @ b
                for axis in range(2):
                    error = state[first, axis] + a[axis] - state[second, axis] - b[axis]
                    ga = -a[1] if axis == 0 else a[0]
                    gb = b[1] if axis == 0 else -b[0]
                    multiplier = -error / (inverse[first, axis] + inverse[second, axis] + ga * ga * inverse[first, 2] + gb * gb * inverse[second, 2])
                    state[first, axis] += inverse[first, axis] * multiplier
                    state[second, axis] -= inverse[second, axis] * multiplier
                    state[first, 2] += inverse[first, 2] * ga * multiplier
                    state[second, 2] += inverse[second, 2] * gb * multiplier
            for first, second, low, high, bind in limits:
                middle = (low + high) / 2
                delta = middle + wrap(state[second, 2] - (state[first, 2] if first >= 0 else 0) + bind - middle)
                target = max(low, min(high, delta))
                if delta != target:
                    inv_a = inverse[first, 2] if first >= 0 else 0
                    multiplier = -(delta - target) / (inverse[second, 2] + inv_a)
                    state[second, 2] += inverse[second, 2] * multiplier
                    if first >= 0:
                        state[first, 2] -= inv_a * multiplier
            for first, second, group, stiffness in motors:
                active = strength[group]
                if active > 0:
                    inv_a = inverse[first, 2] if first >= 0 else 0
                    error = wrap(state[second, 2] - (state[first, 2] if first >= 0 else 0))
                    compliance = 1 / (stiffness * active * dt * dt)
                    multiplier = -error / (inverse[second, 2] + inv_a + compliance)
                    state[second, 2] += inverse[second, 2] * multiplier
                    if first >= 0:
                        state[first, 2] -= inv_a * multiplier
            for index, boundary in enumerate(boundaries):
                if not len(boundary):
                    continue
                points = boundary @ rot(state[index, 2]).T
                depths = points[:, 1] + state[index, 1] - grounds[index]
                worst = int(np.argmax(depths))
                depth = depths[worst]
                if depth > 0:
                    contacts[index] = True
                    arm = points[worst, 0]
                    multiplier = -depth / (inverse[index, 1] + arm * arm * inverse[index, 2])
                    state[index, 1] += inverse[index, 1] * multiplier
                    state[index, 2] += inverse[index, 2] * arm * multiplier
            for surface in skin_surfaces:
                if solve_skin_contact(state, inverse, surface):
                    contacts[surface[0]] = True
                    contacts[surface[1]] = True
        velocity = (state - previous) / dt
        for index, contact in enumerate(contacts):
            if contact:
                friction = 5 if names[index].endswith('-hoof') else 25
                angular_friction = 4 if names[index].endswith('-hoof') else 25
                velocity[index, 0] *= math.exp(-friction * dt)
                velocity[index, 2] *= math.exp(-angular_friction * dt)
        matrices = {name: matrix(value[:2], center, value[2]).tolist() for name, value, center in zip(names, state, centers)}
        errors = []
        for a, b, point, group in joints:
            pa = (np.asarray(matrices[names[a]]) @ np.r_[point, 1])[:2]
            pb = (np.asarray(matrices[names[b]]) @ np.r_[point, 1])[:2]
            errors.append(float(np.linalg.norm(pa - pb)))
        records.append({'timeMs': time, 'names': names, 'q': state.tolist(), 'velocity': velocity.tolist(), 'matrices': matrices, 'contacts': contacts.tolist(), 'strength': strength, 'jointErrorPx': max(errors)})
    return records

def at_time(time, records):
    index = max(0, min(len(records) - 2, int(time * 240 / 1000)))
    a, b = records[index:index + 2]
    blend = max(0, min(1, (time - a['timeMs']) / (b['timeMs'] - a['timeMs'])))
    state = np.asarray(a['q']) * (1 - blend) + np.asarray(b['q']) * blend
    result = {}
    for i, name in enumerate(a['names']):
        original = np.asarray(a['matrices'][name])
        center = original[:2, :2].T @ (np.asarray(a['q'][i][:2]) - original[:2, 2])
        result[name] = matrix(state[i, :2], center, state[i, 2])
    return result
