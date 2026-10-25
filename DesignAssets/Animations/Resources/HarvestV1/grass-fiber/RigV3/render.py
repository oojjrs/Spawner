from pathlib import Path
import base64
import io
import json
import math
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image


def sample(values, x, y):
    x = np.clip(x, 0, values.shape[1] - 1)
    y = np.clip(y, 0, values.shape[0] - 1)
    left = np.floor(x).astype(int)
    top = np.floor(y).astype(int)
    right = np.minimum(left + 1, values.shape[1] - 1)
    bottom = np.minimum(top + 1, values.shape[0] - 1)
    fx = (x - left)[..., None]
    fy = (y - top)[..., None]
    return (values[top, left] * (1 - fx) + values[top, right] * fx) * (1 - fy) + (
        values[bottom, left] * (1 - fx) + values[bottom, right] * fx
    ) * fy


def render(texture, rig, strengths):
    if not any(strengths):
        return texture.copy()
    width, height = rig["canvas"]
    grid_width, grid_height = rig["gridSize"]
    vertices = np.array(rig["vertices"])
    rest = vertices[:, :2]
    offsets = np.zeros_like(rest)
    for index, bone in enumerate(rig["bones"]):
        angle = math.radians(bone["peakAngleDegrees"] * strengths[index])
        rotation = np.array([[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]])
        local = rest - bone["pivot"]
        offsets += (local @ rotation.T - local) * vertices[:, index + 2:index + 3]
    offsets = offsets.reshape(grid_height, grid_width, 2)
    y, x = np.indices((height, width))
    sx, sy = x.astype(float), y.astype(float)
    for iteration in range(6):
        delta = sample(offsets, sx / rig["gridStep"], sy / rig["gridStep"])
        sx, sy = x - delta[:, :, 0], y - delta[:, :, 1]
    pixels = np.asarray(texture).astype(float)
    premultiplied = pixels.copy()
    premultiplied[:, :, :3] *= pixels[:, :, 3:4] / 255
    warped = sample(premultiplied, sx, sy)
    alpha = warped[:, :, 3:4]
    warped[:, :, :3] = warped[:, :, :3] * 255 / np.maximum(alpha, 1e-9)
    warped = np.clip(np.rint(warped), 0, 255).astype(np.uint8)
    stationary = (sx == x) & (sy == y)
    warped[stationary] = np.asarray(texture)[stationary]
    return Image.fromarray(warped)


def encode(command):
    result = subprocess.run(command)
    if result.returncode:
        raise RuntimeError("Animation encoding failed")


rig_path = Path(sys.argv[1]).resolve()
directory = rig_path.parent
root = directory.parents[5]
work = root / "$Trash" / "grass-fiber-size-fix-20261025"
work.mkdir(0o777, True, True)
rig = json.loads(rig_path.read_bytes())
texture = Image.open(directory / rig["texture"]).convert("RGBA")
frames_dir = directory / "frames"
frames_dir.mkdir(0o777, True, True)
background_dir = work / "background-frames"
background_dir.mkdir(0o777, True, True)
frames = [render(texture, rig, strengths) for strengths in rig["timeline"]]
sheet = Image.new("RGBA", (rig["columns"] * 256, math.ceil(len(frames) / rig["columns"]) * 256))
for index, frame in enumerate(frames):
    frame.save(frames_dir / ("frame-%02d.png" % index))
    sheet.paste(frame, (index % rig["columns"] * 256, index // rig["columns"] * 256))
    background = Image.new("RGBA", frame.size, "#173a34")
    background.alpha_composite(frame)
    background.convert("RGB").save(background_dir / ("frame-%02d.png" % index))
sheet_bytes = io.BytesIO()
sheet.save(sheet_bytes, "PNG")
(directory.parent / "sheet.png").write_bytes(sheet_bytes.getvalue())
fps = str(1000 / rig["frameMs"])
ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    raise RuntimeError("ffmpeg is required")
common = [ffmpeg, "-v", "error", "-y", "-framerate", fps]
for width, height, output in [(256, 256, directory.parent / "preview.gif"), (200, 198, directory.parent / "runtime.gif"), (96, 96, directory / "small-preview.gif")]:
    filters = "[0:v]scale=%d:%d:force_original_aspect_ratio=decrease:flags=lanczos,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=0x173a34,split[a][b];[a]palettegen=max_colors=192:reserve_transparent=0[p];[b][p]paletteuse=dither=none" % (width, height, width, height)
    encode(common + ["-i", str(background_dir / "frame-%02d.png"), "-filter_complex", filters, "-loop", "0", str(output)])
webp = root / "DesignAssets/Animations/Resources/HarvestCurrentV1/grass-fiber/grass-fiber-harvest.webp"
encode(common + ["-i", str(frames_dir / "frame-%02d.png"), "-c:v", "libwebp_anim", "-lossless", "1", "-compression_level", "6", "-loop", "0", str(webp)])
preview = Image.open(webp)
durations = []
for index in range(preview.n_frames):
    preview.seek(index)
    preview.load()
    durations.append(preview.info["duration"])
metadata_path = webp.parent / "animation.json"
metadata = json.loads(metadata_path.read_bytes())
metadata["frameCount"] = preview.n_frames
metadata["sourceFrameCount"] = len(frames)
metadata["durationsMs"] = durations
metadata["cycleMs"] = sum(durations)
encoder = json.JSONEncoder()
encoder.ensure_ascii = False
encoder.indent = 2
encoder.item_separator = ","
metadata_path.write_bytes((encoder.encode(metadata) + "\n").replace("\n", "\r\n").encode("utf-8"))
asset = "DesignAssets/Animations/Resources/HarvestV1/grass-fiber/sheet.png"
local_asset = root / "client/local-assets/Animations/Resources/HarvestV1/grass-fiber/sheet.png.js"
source = "data:image/png;base64," + base64.b64encode((root / asset).read_bytes()).decode("ascii")
local_asset.write_bytes(("globalThis.SpawnerLocalAssetSources[" + json.dumps(asset) + "] = " + json.dumps(source) + ";\r\n").encode("utf-8"))
print("Rendered %d frames from the locked neutral texture" % len(frames))
