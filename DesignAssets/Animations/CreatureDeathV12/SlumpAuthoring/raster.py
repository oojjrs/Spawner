import numpy as np


def premultiplied(image):
    a = np.array(image).astype(np.float32)
    a[:, :, :3] *= a[:, :, 3:4] / 255
    return a


def pixels_from_premultiplied(pixels):
    a = np.clip(pixels.copy(), 0, 255)
    alpha = np.maximum(a[:, :, 3:4], 0.001)
    a[:, :, :3] *= 255 / alpha
    a[a[:, :, 3] < 0.5] = 0
    return np.clip(a, 0, 255).astype(np.uint8)


def rasterize(texture, source, destination, triangles):
    output = np.zeros((512, 512, 4), np.float32)
    source_coordinates = np.zeros((512, 512, 2), np.float32)
    height, width = texture.shape[:2]
    for indices in triangles:
        s = source[indices]
        d = destination[indices]
        x0, y0 = np.maximum(np.floor(d.min(0)).astype(int), [0, 0])
        x1, y1 = np.minimum(np.ceil(d.max(0)).astype(int) + 1, [512, 512])
        if x1 <= x0 or y1 <= y0:
            continue
        axes = np.column_stack([d[1] - d[0], d[2] - d[0]])
        if abs(np.linalg.det(axes)) < 0.001:
            continue
        gy, gx = np.mgrid[y0:y1, x0:x1]
        q = np.stack([gx - d[0, 0], gy - d[0, 1]], -1)
        uv = q @ np.linalg.inv(axes).T
        inside = (uv[:, :, 0] >= -0.00001) & (uv[:, :, 1] >= -0.00001) & (uv.sum(2) <= 1.00001)
        coordinates = s[0] + uv[:, :, 0:1] * (s[1] - s[0]) + uv[:, :, 1:2] * (s[2] - s[0])
        sx, sy = coordinates[:, :, 0], coordinates[:, :, 1]
        ix = np.clip(np.floor(sx).astype(int), 0, width - 2)
        iy = np.clip(np.floor(sy).astype(int), 0, height - 2)
        fx, fy = np.clip(sx - ix, 0, 1)[:, :, None], np.clip(sy - iy, 0, 1)[:, :, None]
        sample = texture[iy, ix] * (1 - fx) * (1 - fy) + texture[iy, ix + 1] * fx * (1 - fy)
        sample += texture[iy + 1, ix] * (1 - fx) * fy + texture[iy + 1, ix + 1] * fx * fy
        region = output[y0:y1, x0:x1]
        region[inside] = sample[inside]
        coordinate_region = source_coordinates[y0:y1, x0:x1]
        coordinate_region[inside] = coordinates[inside]
    return pixels_from_premultiplied(output), source_coordinates
