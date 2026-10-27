import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import GifImagePlugin, Image, ImageDraw, _webp


HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[3]
TEMP = PROJECT / "$Trash" / "rolling-acorn-idle"
SOURCE = HERE / "Source"
SCALE = 512 / 1560
SIZE = 512


def write_json(path, value):
    encoder = json.JSONEncoder()
    encoder.ensure_ascii = False
    encoder.indent = 2
    content = encoder.encode(value) + "\n"
    path.write_bytes(content.replace("\n", "\r\n").encode("utf-8"))


def webp(path, picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(), True, 100.0, 100.0, "", 6, 1, b"", ""))


def animated_webp(path, pictures, durations):
    encoder = _webp.WebPAnimEncoder(pictures[0].size, 0, 0, False, 9, 17, False, False)
    timestamp = 0
    for picture, duration in zip(pictures, durations):
        encoder.add(picture.getim(), timestamp, True, 100.0, 100.0, 3)
        timestamp += duration
    encoder.add(None, timestamp, True, 100.0, 100.0, 0)
    path.write_bytes(encoder.assemble("", "", ""))


def animated_gif(path, pictures, durations):
    frames = []
    for picture in pictures:
        frame = Image.new("RGB", (256, 256), (32, 40, 36))
        thumbnail = picture.resize((256, 256), Image.Resampling.LANCZOS)
        frame.paste(thumbnail, (0, 0), thumbnail)
        frames.append(frame)
    overview = Image.new("RGB", (256 * 4, 256 * 4))
    for index in range(16):
        overview.paste(frames[index * (len(frames) - 1) // 15], (index % 4 * 256, index // 4 * 256))
    palette = overview.quantize(256)
    frames = [frame.quantize(256, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE) for frame in frames]
    frames[0].encoderinfo = {"duration": durations, "loop": 0, "append_images": frames[1:],
                             "disposal": 2, "optimize": False}
    with path.open("wb") as handle:
        GifImagePlugin._save_all(frames[0], handle, str(path))


def ease(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def interpolate(keys, time):
    for left, right in zip(keys, keys[1:]):
        if time <= right[0]:
            fraction = ease((time - left[0]) / (right[0] - left[0]))
            return left[1] + (right[1] - left[1]) * fraction
    return keys[-1][1]


def rotation(pivot, degrees):
    angle = math.radians(degrees)
    cosine, sine = math.cos(angle), math.sin(angle)
    x, y = pivot
    return np.array([[cosine, -sine, x - cosine * x + sine * y],
                     [sine, cosine, y - sine * x - cosine * y],
                     [0, 0, 1]])


def premultiply(picture):
    pixels = np.asarray(picture).astype(float) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels


def unpremultiply(pixels):
    alpha = pixels[:, :, 3:4]
    rgb = pixels[:, :, :3] / np.maximum(alpha, 1 / 255)
    result = np.concatenate((rgb, alpha), 2)
    return Image.fromarray(np.uint8(np.clip(result * 255 + 0.5, 0, 255)))


def sample(pixels, x, y):
    height, width = pixels.shape[:2]
    x = np.clip(x, 0, width - 1.001)
    y = np.clip(y, 0, height - 1.001)
    ix, iy = x.astype(int), y.astype(int)
    dx, dy = (x - ix)[..., None], (y - iy)[..., None]
    return ((pixels[iy, ix] * (1 - dx) + pixels[iy, ix + 1] * dx) * (1 - dy)
            + (pixels[iy + 1, ix] * (1 - dx) + pixels[iy + 1, ix + 1] * dx) * dy)


def warp_mesh(pixels, mesh, matrices):
    vertices = np.array(mesh["vertices"])
    homogeneous = np.column_stack((vertices, np.ones(len(vertices))))
    positions = np.zeros((len(vertices), 2))
    for index, weights in enumerate(mesh["weights"]):
        for bone, weight in weights.items():
            positions[index] += (matrices[bone] @ homogeneous[index])[:2] * weight
    output = np.zeros((SIZE, SIZE, 4))
    for triangle in mesh["triangles"]:
        destination = positions[triangle]
        source = vertices[triangle]
        minimum = np.maximum(np.floor(destination.min(0)).astype(int), 0)
        maximum = np.minimum(np.ceil(destination.max(0)).astype(int), SIZE - 1)
        if np.any(maximum < minimum):
            continue
        x, y = np.meshgrid(np.arange(minimum[0], maximum[0] + 1), np.arange(minimum[1], maximum[1] + 1))
        system = np.vstack((destination.T, np.ones(3)))
        if abs(np.linalg.det(system)) < 0.001:
            continue
        barycentric = np.linalg.inv(system) @ np.array([x.ravel(), y.ravel(), np.ones(x.size)])
        inside = np.all(barycentric >= -0.00001, 0)
        if not np.any(inside):
            continue
        coordinates = source.T @ barycentric[:, inside]
        output[y.ravel()[inside], x.ravel()[inside]] = sample(pixels, coordinates[0], coordinates[1])
    return unpremultiply(output)


def skin_patch(original, tile):
    original_crop = np.asarray(original.crop((340, 780, 910, 1140))).astype(float)
    patch = np.asarray(tile).astype(float)
    yy, xx = np.mgrid[:360, :570]
    distances = []
    for x, y, rx, ry in [(111, 134, 63, 72), (424, 244, 74, 78)]:
        distances.append(np.sqrt(((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2))
    distance = np.minimum(distances[0], distances[1])
    ring = (distance > 0.91) & (distance < 1.06)
    correction = np.median(original_crop[ring, :3] - patch[ring, :3], 0)
    patch[:, :, :3] = np.clip(patch[:, :, :3] + correction, 0, 255)
    mask = np.clip((1.03 - distance) / 0.13, 0, 1)
    result = original.copy()
    patch[:, :, 3] = mask * 255
    result.alpha_composite(Image.fromarray(np.uint8(patch)), (340, 780))
    return result


def weights_at(x, y):
    x, y = x / SCALE, y / SCALE
    if x < 1015:
        lower = ease((515 - y) / 85)
        upper = ease((465 - y) / 110)
        return {"body": 1 - lower, "stem-low": lower * (1 - upper), "stem-high": lower * upper}
    middle = ease((x - 1090) / 170)
    tip = ease((x - 1230) / 115) * ease((y - 455) / 130)
    return {"leaf-base": 1 - middle, "leaf-middle": middle * (1 - tip), "leaf-tip": middle * tip}


def prepare():
    original = Image.open(PROJECT / "DesignAssets/CreatureConcepts/v3/rolling-acorn.png").convert("RGBA")
    pixels = np.array(original)
    pixels[pixels[:, :, 3] < 16] = 0
    original = Image.fromarray(pixels)
    mask = Image.new("L", original.size)
    ImageDraw.Draw(mask).polygon([(850, 230), (1450, 230), (1450, 730), (1400, 730),
                                 (1000, 565), (960, 560), (880, 510), (850, 480)], 255)
    moving = np.array(mask) > 0
    body_pixels = np.array(original)
    body_pixels[moving] = 0
    leaf_pixels = np.array(original)
    leaf_pixels[~moving] = 0
    body = Image.fromarray(body_pixels)
    leaf = Image.fromarray(leaf_pixels)
    body.save(SOURCE / "body.png")
    leaf.save(SOURCE / "stem-leaf.png")
    worksheet = Image.open(SOURCE / "blink-drawings.png").convert("RGBA")
    width, height = worksheet.size
    boxes = [(0, 0, width // 2, height // 2),
             (0, height // 2, width // 2, height),
             (width // 2, 0, width, height // 2)]
    for name, box in zip(["half", "narrow", "closed"], boxes):
        tile = worksheet.crop(box).resize((570, 360), Image.Resampling.LANCZOS)
        attachment = skin_patch(original, tile)
        attachment_pixels = np.array(attachment)
        attachment_pixels[moving] = 0
        Image.fromarray(attachment_pixels).save(SOURCE / ("body-" + name + ".png"))
    leaf_small = leaf.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    alpha = np.asarray(leaf_small)[:, :, 3]
    xs, ys = list(range(272, 481, 8)), list(range(64, 249, 8))
    vertices = [[x, y] for y in ys for x in xs]
    triangles = []
    for row in range(len(ys) - 1):
        for column in range(len(xs) - 1):
            if not np.any(alpha[ys[row]:ys[row + 1] + 1, xs[column]:xs[column + 1] + 1]):
                continue
            index = row * len(xs) + column
            triangles.extend([[index, index + 1, index + len(xs)],
                              [index + 1, index + len(xs) + 1, index + len(xs)]])
    mesh = {"texture": "Source/stem-leaf.png", "canvas": [512, 512],
            "vertices": vertices, "triangles": triangles,
            "weights": [weights_at(x, y) for x, y in vertices]}
    write_json(HERE / "mesh.json", mesh)
    rig = {"name": "rolling-acorn-idle", "reference": "../../../CreatureConcepts/v3/rolling-acorn.png",
           "method": "Rigid shell rotation with a separately weighted continuous stem-and-leaf mesh and drawn blink attachments",
           "sourceCanvas": [1560, 1560], "renderCanvas": [512, 512],
           "contact": [780 * SCALE, 1297 * SCALE], "drawOrder": ["body", "stem-leaf"],
           "mesh": "mesh.json", "alphaCleanupBelow": 16,
           "attachments": {"open": "Source/body.png", "half": "Source/body-half.png",
                           "narrow": "Source/body-narrow.png", "closed": "Source/body-closed.png"},
           "bones": [{"name": "body", "parent": None, "pivot": [780, 1297]},
                     {"name": "stem-low", "parent": "body", "pivot": [949, 515]},
                     {"name": "stem-high", "parent": "stem-low", "pivot": [952, 450]},
                     {"name": "leaf-base", "parent": "stem-low", "pivot": [1000, 442]},
                     {"name": "leaf-middle", "parent": "leaf-base", "pivot": [1170, 465]},
                     {"name": "leaf-tip", "parent": "leaf-middle", "pivot": [1290, 540]}],
           "timeline": {
               "body": [[0, 0], [1, 0], [1.55, 4.5], [1.7, 4.5], [2.25, -1.2], [2.7, 0], [4.5, 0]],
               "stem-low": [[0, 0], [0.5, 0.25], [1, 0], [1.2, 0], [1.75, -1.4], [1.95, -1.9], [2.5, 1.2], [2.9, -0.35], [3.3, 0], [4.5, 0]],
               "stem-high": [[0, 0], [1.3, 0], [1.85, -0.9], [2.15, -1.2], [2.65, 0.8], [3, -0.3], [3.4, 0], [4.5, 0]],
               "leaf-base": [[0, 0], [0.6, 0.6], [1.2, 0], [1.4, 0], [1.95, -4.2], [2.2, -3.5], [2.65, 3.2], [3, -1.1], [3.4, 0.3], [3.8, 0], [4.5, 0]],
               "leaf-middle": [[0, 0], [1.5, 0], [2.1, -2.7], [2.35, -1.5], [2.8, 2], [3.15, -0.8], [3.55, 0], [4.5, 0]],
               "leaf-tip": [[0, 0], [1.65, 0], [2.25, -2.3], [2.55, 0], [2.95, 1.4], [3.3, -0.5], [3.65, 0], [4.5, 0]]},
           "blink": [[0, "open"], [3.05, "half"], [3.1, "narrow"], [3.14, "closed"],
                     [3.22, "narrow"], [3.26, "half"], [3.31, "open"], [4.5, "open"]]}
    write_json(HERE / "rig.json", rig)
    reconstructed = Image.alpha_composite(body, leaf)
    difference = np.abs(np.array(reconstructed).astype(int) - np.array(original).astype(int))
    print("Neutral reconstruction maximum channel difference:", int(difference.max()))


def load_rig():
    rig = json.loads((HERE / "rig.json").read_bytes())
    mesh = json.loads((HERE / rig["mesh"]).read_bytes())
    attachments = {name: Image.open(HERE / path).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
                   for name, path in rig["attachments"].items()}
    limb = Image.open(HERE / "Source/stem-leaf.png").convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    return rig, mesh, attachments, limb


def render(time, rig, mesh, attachments, limb):
    angles = {bone: interpolate(keys, time) for bone, keys in rig["timeline"].items()}
    matrices = {}
    for bone in rig["bones"]:
        pivot = [coordinate * SCALE for coordinate in bone["pivot"]]
        parent = matrices[bone["parent"]] if bone["parent"] else np.eye(3)
        matrices[bone["name"]] = parent @ rotation(pivot, angles[bone["name"]])
    attachment = "open"
    for at, name in rig["blink"]:
        if time >= at:
            attachment = name
    body = attachments[attachment]
    matrix = matrices["body"]
    inverse = np.linalg.inv(matrix)
    body = body.transform((SIZE, SIZE), Image.Transform.AFFINE, tuple(inverse[:2].ravel()), Image.Resampling.BICUBIC)
    leaf = warp_mesh(premultiply(limb), mesh, matrices)
    picture = Image.alpha_composite(body, leaf)
    pixels = np.asarray(picture)
    rows = np.where(np.any(pixels[:, :, 3] > 200, 1))[0]
    shift = round(rig["contact"][1]) - int(rows[-1])
    grounded = Image.new("RGBA", (SIZE, SIZE))
    grounded.alpha_composite(picture, (0, shift))
    return grounded


def contact_sheet(pictures, labels, path):
    columns, size = 4, 256
    sheet = Image.new("RGB", (columns * size, math.ceil(len(pictures) / columns) * (size + 26)), (32, 40, 36))
    draw = ImageDraw.Draw(sheet)
    for index, picture in enumerate(pictures):
        x, y = index % columns * size, index // columns * (size + 26)
        thumbnail = picture.resize((size, size), Image.Resampling.LANCZOS)
        sheet.paste(thumbnail, (x, y), thumbnail)
        draw.text((x + 8, y + size + 4), labels[index], (230, 235, 216))
    sheet.save(path)


def main():
    TEMP.mkdir(0o777, True, True)
    if sys.argv[1] == "prepare":
        prepare()
    rig, mesh, attachments, limb = load_rig()
    if sys.argv[1] == "prepare":
        times = [0, 1.55, 2.25, 3.16]
        pictures = [render(time, rig, mesh, attachments, limb) for time in times]
        contact_sheet(pictures, [str(time) + "s" for time in times], TEMP / "key-poses.png")
        return
    times = [0, 500, 1000] + list(range(1050, 3050, 50)) + [3050, 3100, 3140, 3220, 3260, 3310, 3400, 3500, 3650, 3800, 4000]
    durations = [right - left for left, right in zip(times, times[1:] + [4500])]
    if sys.argv[1] == "encode":
        previous = Image.open(HERE / "idle.png").convert("RGBA")
        pictures = [previous.crop((index % 4 * SIZE, index // 4 * SIZE,
                                   (index % 4 + 1) * SIZE, (index // 4 + 1) * SIZE)) for index in range(len(times))]
    else:
        pictures = [render(time / 1000, rig, mesh, attachments, limb) for time in times]
    rows = math.ceil(len(pictures) / 4)
    atlas = Image.new("RGBA", (SIZE * 4, SIZE * rows))
    for index, picture in enumerate(pictures):
        atlas.alpha_composite(picture, (index % 4 * SIZE, index // 4 * SIZE))
    atlas.save(HERE / "idle.png")
    webp(HERE / "idle.webp", atlas)
    animated_webp(HERE / "idle-preview.webp", pictures, durations)
    animated_gif(HERE / "idle-preview.gif", pictures, durations)
    small = [picture.resize((64, 64), Image.Resampling.LANCZOS) for picture in pictures]
    animated_webp(HERE / "idle-thumbnail.webp", small, durations)
    indices = [0, 2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 43, 44, 45, 46]
    contact_sheet([pictures[index] for index in indices], [str(times[index]) + "ms" for index in indices], HERE / "idle-contact.png")
    metadata = {"name": "rolling-acorn", "action": "idle", "revision": 1,
                "method": rig["method"], "reference": rig["reference"], "rig": "rig.json",
                "frameSize": [512, 512], "columns": 4, "frameCount": len(pictures),
                "frameTimesMs": times, "durationsMs": durations, "durationMs": sum(durations),
                "loop": True, "rootMotion": False, "pivotX": 256, "pivotY": 426,
                "atlas": "idle.png", "runtimeAtlas": "idle.webp", "preview": "idle-preview.webp",
                "thumbnail": "idle-thumbnail.webp", "contact": "idle-contact.png",
                "bodyRotationDegrees": [-1.2, 4.5], "blinkDrawingProvider": "built-in image_gen",
                "blinkDrawings": "Source/blink-drawings.png"}
    write_json(HERE / "idle.json", metadata)
    print("Exported", len(pictures), "frames;", sum(durations), "ms; atlas", atlas.size)


main()
