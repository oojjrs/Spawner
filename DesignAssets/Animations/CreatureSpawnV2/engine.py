import math
import numpy as np
from PIL import Image

def ease(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)

def rot(angle):
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s], [s, c]])

def matrix(center, bind, angle):
    result = np.eye(3)
    result[:2, :2] = rot(angle)
    result[:2, 2] = center - result[:2, :2] @ bind
    return result

def affine(image, transform):
    inverse = np.linalg.inv(transform)
    return image.transform((512, 512), Image.Transform.AFFINE, tuple(inverse[:2].ravel()), Image.Resampling.BICUBIC)

def sample(texture, coordinates):
    height, width = texture.shape[:2]
    x = np.clip(coordinates[0], 0, width - 1.0001)
    y = np.clip(coordinates[1], 0, height - 1.0001)
    ix, iy = x.astype(int), y.astype(int)
    u, v = (x - ix)[:, None], (y - iy)[:, None]
    return (texture[iy, ix] * (1 - u) + texture[iy, ix + 1] * u) * (1 - v) + (texture[iy + 1, ix] * (1 - u) + texture[iy + 1, ix + 1] * u) * v

def mesh(image, source, destination, triangles):
    texture = np.array(image).astype(float) / 255
    texture[:, :, :3] *= texture[:, :, 3:4]
    output = np.zeros((512, 512, 4), float)
    for ids in triangles:
        first, second = source[ids], destination[ids]
        low = np.maximum(np.floor(second.min(0)).astype(int), 0)
        high = np.minimum(np.ceil(second.max(0)).astype(int), 511)
        if np.any(high < low):
            continue
        system = np.vstack([second.T, np.ones(3)])
        if abs(np.linalg.det(system)) < .00001:
            continue
        x, y = np.meshgrid(np.arange(low[0], high[0] + 1), np.arange(low[1], high[1] + 1))
        barycentric = np.linalg.inv(system) @ np.array([x.ravel(), y.ravel(), np.ones(x.size)])
        inside = np.all(barycentric >= -.00001, 0)
        coordinates = first.T @ barycentric[:, inside]
        output[y.ravel()[inside], x.ravel()[inside]] = sample(texture, coordinates)
    alpha = output[:, :, 3:4]
    output[:, :, :3] /= np.maximum(alpha, 1 / 255)
    return Image.fromarray(np.uint8(np.clip(output * 255 + .5, 0, 255)))

def ribbon(points, radii):
    tangent = np.column_stack([np.gradient(points[:, 0]), np.gradient(points[:, 1])])
    normal = np.column_stack([-tangent[:, 1], tangent[:, 0]])
    normal /= np.maximum(np.linalg.norm(normal, 2, 1)[:, None], .00001)
    return np.stack([points + normal * radii[:, None], points - normal * radii[:, None]], 1).reshape(-1, 2)

def tube(image, points, radii):
    extended = np.vstack([points[0], points, points[-1]])
    dense, widths = [], []
    for i in range(len(points) - 1):
        a, b, c, d = extended[i:i + 4]
        for u in [0., .25, .5, .75]:
            dense.append(.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u))
            widths.append(radii[i] * (1 - u) + radii[i + 1] * u)
    points = np.vstack([dense, points[-1]])
    radii = np.r_[widths, radii[-1]]
    points[:, 1] = np.minimum(points[:, 1], 448 - radii)
    count = len(points)
    source = np.zeros((count, 2, 2))
    source[:, 1, 0] = image.width - 1
    source[:, :, 1] = np.linspace(0, image.height - 1, count)[:, None]
    triangles = []
    for i in range(count - 1):
        triangles.extend([[2 * i, 2 * i + 1, 2 * i + 2], [2 * i + 1, 2 * i + 3, 2 * i + 2]])
    return mesh(image, source.reshape(-1, 2), ribbon(points, radii), triangles)

def leaf_mesh(image, control):
    bounds = image.getchannel('A').getbbox()
    xs = np.linspace(max(0, bounds[0] - 2), min(511, bounds[2] + 2), 15)
    ys = np.linspace(max(0, bounds[1] - 2), min(511, bounds[3] + 2), 15)
    vertices = np.array([[x, y] for y in ys for x in xs])
    distance = np.linalg.norm(vertices - np.array(control['root']), 2, 1)
    weights = np.clip((distance - 7) / 18, 0, 1)
    weights = weights * weights * (3 - 2 * weights)
    triangles = []
    for y in range(14):
        for x in range(14):
            i = y * 15 + x
            triangles.extend([[i, i + 1, i + 15], [i + 1, i + 16, i + 15]])
    return vertices, weights, triangles

def leaf(image, data, control, angles, body):
    vertices, weights, triangles = data
    root, base = np.asarray(control['root'], float), np.asarray(control['base'], float)
    first = body @ matrix(root, root, angles[0])
    second = first @ matrix(base, base, angles[1])
    points = np.column_stack([vertices, np.ones(len(vertices))])
    destination = (first @ points.T).T[:, :2] * (1 - weights[:, None]) + (second @ points.T).T[:, :2] * weights[:, None]
    return mesh(image, vertices, destination, triangles)
