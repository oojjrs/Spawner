import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter, ImageEnhance

work = Path(sys.argv[1])
source = work / 'source'
rig = json.loads((work / 'rig.json').read_text('utf-8'))
body = Image.open(source / 'body.png').convert('RGBA')
feet = [Image.open(source / 'foot-left.png').convert('RGBA'), Image.open(source / 'foot-right.png').convert('RGBA')]
neutral = Image.open(source / 'neutral.png').convert('RGBA')
den = Image.open(source / 'den.png').convert('RGBA')
foreground = Image.open(source / 'den-foreground.png').convert('RGBA')
body_box = body.getchannel('A').point(lambda value: 255 if value >= 128 else 0).getbbox()
center = rig['bones'][1]['pivot']
durations = rig['durationsMs']
times = []
elapsed = 0
for duration in durations:
    times.append(elapsed)
    elapsed += duration

def contour(image):
    alpha = image.getchannel('A').load()
    result = []
    for x in range(512):
        ys = [y for y in range(512) if alpha[x, y] >= 128]
        if ys:
            result.extend([(x, min(ys)), (x, max(ys))])
    return result

body_points = contour(body)
foot_points = [contour(part) for part in feet]
pitch = [Image.open(work / name).convert('RGBA') for name in rig['roll']['attachments']]
def smooth(value):
    t = max(0, min(1, value))
    return t * t * (3 - 2 * t)

def light_pose(frame, progress):
    brightness = .64 + .36 * min(1, progress / .3)
    alpha = frame.getchannel('A')
    frame = ImageEnhance.Brightness(frame.convert('RGB')).enhance(brightness).convert('RGBA')
    frame.putalpha(alpha)
    return frame

def unit_pose(time):
    if time >= rig['stand']['endMs']:
        return neutral.copy()
    progress = smooth((time - rig['roll']['startMs']) / (rig['roll']['endMs'] - rig['roll']['startMs']))
    angle = rig['roll']['degrees'] * progress
    if rig['roll']['axis'] == 'forward-pitch' and time <= rig['roll']['endMs']:
        index = int((angle % 360) / 360 * len(pitch) + .5) % len(pitch)
        return light_pose(pitch[index].copy(), progress)
    if time > rig['stand']['startMs']:
        t = (time - rig['stand']['startMs']) / (rig['stand']['endMs'] - rig['stand']['startMs'])
        angle = rig['roll']['degrees'] + rig['stand']['settleDegrees'] * math.sin(t * math.pi * 2) * (1 - t)
    reveal = smooth((time - rig['stand']['startMs']) / (rig['stand']['endMs'] - rig['stand']['startMs']))
    tuck = -rig['stand']['footTuckPx'] * (1 - reveal)
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    points = body_points + [(x, y + tuck) for part in foot_points for x, y in part]
    support = max((x - center[0]) * s + (y - center[1]) * c for x, y in points)
    target_y = rig['pivot'][1] - support
    inverse = (c, s, center[0] - c * center[0] - s * target_y, -s, c, center[1] + s * center[0] - c * target_y)
    frame = body.transform((512, 512), Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC)
    for part in feet:
        shifted = part.transform((512, 512), Image.Transform.AFFINE, (1, 0, 0, 0, 1, -tuck), Image.Resampling.BICUBIC)
        visibility = Image.new('L', (512, 512), 0)
        ImageDraw.Draw(visibility).rectangle((0, round(body_box[3] - rig['stand']['footMaskRisePx'] * reveal), 512, 512), 255)
        shifted.putalpha(ImageChops.multiply(shifted.getchannel('A'), visibility))
        frame = Image.alpha_composite(frame, shifted.transform((512, 512), Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC))
    return light_pose(frame, progress)

frames = work / 'frames'
units = work / 'unit-frames'
frames.mkdir(0o777, True, True)
units.mkdir(0o777, True, True)
sheet = Image.new('RGBA', (4096, 3072), (0, 0, 0, 0))
unit_sheet = Image.new('RGBA', (4096, 3072), (0, 0, 0, 0))
world_scale = 450 / (5 * 1126 / 2048)
unit_scale = .7 * world_scale / 512
outlet = [256 + 5 * (rig['rootPath']['outlet'][0] - .5) * world_scale, 448 + 5 * (rig['rootPath']['outlet'][1] - 465 / 512) * world_scale]
target = [outlet[0], outlet[1] + (4.77890625 - (2.5 - 5 * 384.5 / 512 + 5 * .82)) * world_scale]
shadow_mask = body.getchannel('A').resize((115, 20), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(2)).point(lambda value: round(value * .24))
shadow = Image.new('RGBA', shadow_mask.size, (4, 15, 11, 0))
shadow.putalpha(shadow_mask)
for index, time in enumerate(times):
    pose = unit_pose(time)
    pose.save(units / ('frame-' + str(index).zfill(2) + '.png'))
    unit_sheet.paste(pose, (index % 8 * 512, index // 8 * 512))
    progress = smooth((time - rig['roll']['startMs']) / (rig['roll']['endMs'] - rig['roll']['startMs']))
    foot_x = outlet[0] + (target[0] - outlet[0]) * progress + 64
    foot_y = outlet[1] + (target[1] - outlet[1]) * progress - 150
    scene = Image.new('RGBA', (640, 640), (0, 0, 0, 0))
    scene.alpha_composite(den, (64, -150))
    scene.alpha_composite(shadow, (round(foot_x - 57.5), round(foot_y - 18)))
    unit_transform = (1 / unit_scale, 0, 256 - foot_x / unit_scale, 0, 1 / unit_scale, 460 - foot_y / unit_scale)
    scene = Image.alpha_composite(scene, pose.transform((640, 640), Image.Transform.AFFINE, unit_transform, Image.Resampling.BICUBIC))
    scene.alpha_composite(foreground, (64, -150))
    scene = scene.resize((512, 512), Image.Resampling.LANCZOS)
    scene.save(frames / ('frame-' + str(index).zfill(2) + '.png'))
    sheet.paste(scene, (index % 8 * 512, index // 8 * 512))
sheet.save(work / 'birth.png')
unit_sheet.save(work / 'birth-unit.png')
runtime = rig['denRuntime']
overlay_scale = runtime['scale']
overlay_dx = runtime['pivot'][0] - 256 * overlay_scale
overlay_dy = runtime['pivot'][1] - 448 * overlay_scale
foreground.transform((512, 512), Image.Transform.AFFINE, (1 / overlay_scale, 0, -overlay_dx / overlay_scale, 0, 1 / overlay_scale, -overlay_dy / overlay_scale), Image.Resampling.BICUBIC).save(work / 'birth-foreground.png')
print(json.dumps({'frames': len(times), 'period': sum(durations), 'bodyBounds': body_box, 'feetBounds': [part.getbbox() for part in feet], 'outlet': outlet, 'target': target}))
