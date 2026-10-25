import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


folder = Path(__file__).resolve().parent
root = next(p for p in folder.parents if (p / "Design.html").exists())
source_path = root / "DesignAssets/Tribes/spring/Nests/nest-stage-01.png"
preview_path = root / "DesignAssets/Previews/Nests/spring-stage-01-idle-v5.webp"
scratch = root / "$Trash/spring-nest-idle-v5"
parts = folder / "parts"
if not parts.exists():
    parts.mkdir()
size = 512
count = 60
yy, xx = np.mgrid[:size, :size].astype(np.float32)


def write_json(path, data):
    text = json.dumps(data) + "\n"
    path.write_bytes(text.replace("\n", "\r\n").encode("utf-8"))


def component(array):
    total, labels, stats, centers = cv2.connectedComponentsWithStats((array[:, :, 3] > 32).astype(np.uint8), 8)
    label = 1 + np.argmax(stats[1:, 4])
    return stats[label, :4], labels == label


def matte(points, feather):
    mask = np.zeros((size, size), np.uint8)
    cv2.fillPoly(mask, [np.array(points, np.int32)], 255)
    return np.minimum(1, cv2.distanceTransform(mask, cv2.DIST_L2, 5) / feather)


def sample(array, dx, dy):
    return cv2.remap(array, (xx + dx).astype(np.float32), (yy + dy).astype(np.float32), cv2.INTER_CUBIC, None, cv2.BORDER_CONSTANT)


original = np.array(Image.open(source_path).convert("RGBA"))
source_box, source_component = component(original)
sx, sy, sw, sh = [int(v) for v in source_box]
scale = 420 / sw
transform = np.array([[scale, 0, 46 - sx * scale], [0, scale, 466 - (sy + sh) * scale]], np.float32)
source_alpha = cv2.dilate(source_component.astype(np.uint8), np.ones((3, 3), np.uint8))
clean = original.copy()
clean[:, :, 3] *= source_alpha
base = cv2.warpAffine(clean, transform, (size, size), None, cv2.INTER_LANCZOS4)
Image.fromarray(base).save(parts / "neutral.png")

surface = matte([(126, 376), (162, 367), (229, 363), (305, 366), (374, 373), (413, 384),
                 (420, 393), (401, 400), (357, 405), (303, 413), (240, 416), (184, 410),
                 (146, 399), (126, 389)], 7)
spill = matte([(365, 418), (386, 411), (410, 409), (430, 416), (438, 428), (451, 436),
               (448, 442), (430, 446), (409, 447), (392, 440), (380, 427)], 5)
curl_radius = ((xx - 187) / 37) ** 2 + ((yy - 317) / 24) ** 2
curl_weight = np.maximum(0, 1 - curl_radius) ** 3
moving = np.maximum(np.maximum(surface, spill), curl_weight)
for name, mask in [("surface-mask", surface), ("spill-mask", spill), ("curl-weights", curl_weight)]:
    Image.fromarray(np.uint8(mask * 255)).save(parts / (name + ".png"))
fixed = base.copy()
fixed[:, :, 3] = np.uint8(fixed[:, :, 3] * (1 - moving))
Image.fromarray(fixed).save(parts / "fixed-shell.png")

sheet = np.array(Image.open(folder / "source-drawings/water-phases.png").convert("RGBA"))
cells = []
boxes = []
for index in range(16):
    x0, x1 = round(index % 4 * sheet.shape[1] / 4), round((index % 4 + 1) * sheet.shape[1] / 4)
    y0, y1 = round(index // 4 * sheet.shape[0] / 4), round((index // 4 + 1) * sheet.shape[0] / 4)
    cell = sheet[y0:y1, x0:x1].copy()
    box, keep = component(cell)
    cell[:, :, 3] *= cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8))
    cells.append(cell)
    boxes.append(box)
common_scale = 420 / float(np.median([box[2] for box in boxes]))
drawings = []
registrations = []
neutral_gray = cv2.cvtColor(base, cv2.COLOR_RGBA2GRAY)
registration_mask = np.uint8((base[:, :, 3] > 250) & (moving < .001)) * 255
registration_mask[:340] = 0
palette_mask = (base[:, :, 3] > 250) & (moving < .001) & (yy > 350)
for index, (cell, box) in enumerate(zip(cells, boxes)):
    cx, cy, cw, ch = [float(v) for v in box]
    matrix = np.array([[common_scale, 0, 256 - (cx + cw / 2) * common_scale],
                       [0, common_scale, 466 - (cy + ch) * common_scale]], np.float32)
    aligned = cv2.warpAffine(cell, matrix, (size, size), None, cv2.INTER_CUBIC)
    correction = np.eye(2, 3, 0, np.float32)
    try:
        score, correction = cv2.findTransformECC(neutral_gray, cv2.cvtColor(aligned, cv2.COLOR_RGBA2GRAY),
            correction, cv2.MOTION_TRANSLATION, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, .0001),
            registration_mask, 5)
    except cv2.error:
        correction = np.eye(2, 3, 0, np.float32)
    correction[:, 2] = np.clip(correction[:, 2], -5, 5)
    aligned = cv2.warpAffine(aligned, correction, (size, size), None, cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    palette_offset = np.median(base[palette_mask, :3].astype(float) - aligned[palette_mask, :3], 0)
    aligned[:, :, :3] = np.uint8(np.clip(aligned[:, :, :3] + palette_offset, 0, 255))
    drawings.append(aligned)
    registrations.append({"phase": index, "translation": correction[:, 2].tolist(), "paletteOffset": palette_offset.tolist()})

flows = []
for index in range(16):
    a = cv2.cvtColor(drawings[index], cv2.COLOR_RGBA2GRAY)
    b = cv2.cvtColor(drawings[(index + 1) % 16], cv2.COLOR_RGBA2GRAY)
    forward = cv2.calcOpticalFlowFarneback(a, b, None, .5, 3, 29, 5, 7, 1.5, 0)
    backward = cv2.calcOpticalFlowFarneback(b, a, None, .5, 3, 29, 5, 7, 1.5, 0)
    flows.append((forward, backward))

frames = []
fixed_pixels = moving == 0
fixed_changes = 0
for frame_index in range(count):
    seconds = frame_index * 4 / count
    position = frame_index * 16 / count
    phase = int(position) % 16
    fraction = position - int(position)
    forward, backward = flows[phase]
    a = sample(drawings[phase], -forward[:, :, 0] * fraction, -forward[:, :, 1] * fraction)
    b = sample(drawings[(phase + 1) % 16], -backward[:, :, 0] * (1 - fraction), -backward[:, :, 1] * (1 - fraction))
    water = a.astype(np.float32) * (1 - fraction) + b.astype(np.float32) * fraction
    radial_x, radial_y = (xx - 267) / 145, (yy - 389) / 26
    radial = np.sqrt(radial_x ** 2 + radial_y ** 2)
    progress = np.clip((seconds - .25) / 2, 0, 1)
    traveling = np.exp(-((radial - progress) / .22) ** 2) * math.sin(math.pi * progress)
    water = sample(water, -radial_x * traveling * 2.2 * surface,
                   radial_y * traveling * .7 * surface)
    delay = np.clip((seconds - .7) / 2.6, 0, 1)
    curl_pose = math.sin(math.pi * delay) ** 2
    curled = sample(base, -curl_weight * curl_pose * 1.8, curl_weight * curl_pose * .8)
    result = base.astype(np.float32)
    curl_mask = (curl_weight > 0)[:, :, None]
    result = np.where(curl_mask, curled, result)
    water_mask = np.maximum(surface, spill)[:, :, None]
    valid = np.minimum(1, water[:, :, 3:4] / 240)
    water_mask *= valid
    result[:, :, :3] = result[:, :, :3] * (1 - water_mask) + water[:, :, :3] * water_mask
    result[:, :, 3] = np.where(curl_weight > 0, curled[:, :, 3], base[:, :, 3])
    result = np.uint8(np.clip(result, 0, 255))
    fixed_changes += int(np.any(result[fixed_pixels] != base[fixed_pixels], 1).sum())
    frames.append(Image.fromarray(result))

atlas = Image.new("RGBA", (size * 10, size * 6))
for index, frame in enumerate(frames):
    atlas.paste(frame, (index % 10 * size, index // 10 * size))
atlas.save(folder / "nest-stage-01-idle-sheet.png")
durations = [round((i + 1) * 4000 / count) - round(i * 4000 / count) for i in range(count)]
webp_options = {"save_all": True, "append_images": frames[1:], "duration": durations, "loop": 0, "lossless": True, "method": 4, "minimize_size": True}
frames[0].save(preview_path, "WEBP", **webp_options)
review_frames = [frame.crop((24, 278, 488, 488)).resize((696, 315), Image.Resampling.LANCZOS) for frame in frames]
background = Image.new("RGB", review_frames[0].size, (24, 39, 44))
palette_sheet = Image.new("RGB", (review_frames[0].width * 4, review_frames[0].height * 4))
for index in range(16):
    visible = background.copy()
    visible.paste(review_frames[round(index * count / 16)], (0, 0), review_frames[round(index * count / 16)])
    palette_sheet.paste(visible, (index % 4 * visible.width, index // 4 * visible.height))
palette = palette_sheet.quantize(255)
gif_frames = []
for frame in review_frames:
    visible = background.copy()
    visible.paste(frame, (0, 0), frame)
    gif_frames.append(visible.quantize(255, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE))
gif_durations = [round((i + 1) * 400 / count) * 10 - round(i * 400 / count) * 10 for i in range(count)]
gif_options = {"save_all": True, "append_images": gif_frames[1:], "duration": gif_durations, "loop": 0, "optimize": False, "disposal": 2}
gif_frames[0].save(folder / "preview.gif", "GIF", **gif_options)
contact = Image.new("RGB", (4 * 512, 2 * 240), (24, 39, 44))
for i in range(8):
    frame = frames[round(i * count / 8)].crop((0, 280, 512, 512))
    contact.paste(frame, (i % 4 * 512, i // 4 * 240), frame)
contact.save(scratch / "phase-contact.png")
frame_arrays = [np.array(frame) for frame in frames]
motion_values = [float(np.abs(frame_arrays[i].astype(float) - frame_arrays[(i + 1) % count]).mean()) for i in range(count)]
write_json(folder / "rig.json", {
    "frameSize": [512, 512], "sourceBounds": source_box.tolist(), "sourceTransform": transform.tolist(),
    "drawOrder": ["neutral", "surface", "spill", "curl"],
    "surface": {"mask": "parts/surface-mask.png", "drawing": "source-drawings/water-phases.png", "phaseCount": 16,
                "inbetweens": "bidirectional dense optical flow between adjacent drawn phases; cyclic last-to-first", "rippleCenter": [267, 389]},
    "curl": {"parent": "root", "pivot": [170, 340], "weightTexture": "parts/curl-weights.png", "tipTravel": [1.8, -.8], "startSeconds": .7, "durationSeconds": 2.6},
    "spill": {"mask": "parts/spill-mask.png", "drawing": "source-drawings/water-phases.png"},
    "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
    "registration": {"commonScale": common_scale, "phases": registrations}
})
metadata = {
    "name": "nest-stage-01-idle", "source": source_path.relative_to(root).as_posix(),
    "animation": (folder / "nest-stage-01-idle-sheet.png").relative_to(root).as_posix(),
    "preview": preview_path.relative_to(root).as_posix(), "frameSize": [512, 512], "frameCount": count,
    "columns": 10, "periodMs": 4000, "durationsMs": durations, "loop": True,
    "method": "16 locally drawn water phases, motion-compensated inbetweens, locally weighted curl mesh",
    "fixedPixelChanges": fixed_changes, "pivot": [256, 466]
}
write_json(folder / "animation.json", metadata)
write_json(scratch / "render-report.json", {"fixedPixelChanges": fixed_changes, "adjacentMean": motion_values,
    "loopBoundaryMean": motion_values[-1], "alphaBounds": [frame.getbbox() for frame in frames]})
print(json.dumps({"frames": count, "periodMs": sum(durations), "fixedPixelChanges": fixed_changes,
                  "loopBoundaryMean": motion_values[-1], "largestAdjacentMean": max(motion_values)}))
