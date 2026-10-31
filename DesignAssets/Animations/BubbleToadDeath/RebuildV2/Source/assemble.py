import json
import math
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

folder = Path(__file__).resolve().parent.parent
source = folder / 'Source'
output = folder / 'Frames'
output.mkdir(0o777, True, True)
plan = json.loads((source / 'frame-plan.json').read_text('utf-8'))
names = ['eyes-closed.png', 'collapse.png', 'settled-revision2.png']
keys = [Image.open(source / 'Keys' / name).convert('RGBA') for name in names]
reference = keys[0]
sift = cv2.SIFT_create()
regions = {'head': (125, 183, 295, 287)}
grids = {
    'head': [[145, 211], [163, 210], [178, 230], [198, 225], [217, 213], [238, 223], [254, 238], [269, 254], [281, 270], [288, 279], [239, 266], [208, 253], [168, 243], [136, 242]],
    'body': [[299, 256], [311, 264], [324, 277], [340, 291], [350, 307], [354, 323], [330, 328], [310, 307]],
    'feet': [[102, 421], [117, 425], [137, 423], [249, 432], [273, 442], [298, 436], [362, 427], [386, 431], [410, 424]]
}
head_polygon = np.array([[120,177],[296,177],[296,279],[286,287],[260,281],[233,271],[200,259],[164,251],[132,249],[116,253]],np.float32)
grids['head'] = [[x,y] for y in range(178,288,7) for x in range(118,297,7) if cv2.pointPolygonTest(head_polygon,(float(x),float(y)),False)>=0]


def features(image, region):
    pixels = np.array(image)
    mask = np.uint8(pixels[:, :, 3] > 128) * 255
    if region is not None:
        crop = np.zeros((512, 512), np.uint8)
        crop[region[1]:region[3], region[0]:region[2]] = 255
        mask = np.minimum(mask, crop)
    return sift.detectAndCompute(cv2.cvtColor(pixels[:, :, :3], cv2.COLOR_RGB2GRAY), mask)


reference_features = {name: features(reference, region) for name, region in regions.items()}


def fit(target_features, name):
    first, descriptors = reference_features[name]
    last, other = target_features
    pairs = cv2.BFMatcher().knnMatch(descriptors, other, 2)
    good = [pair[0] for pair in pairs if len(pair) == 2 and pair[0].distance < 0.72 * pair[1].distance]
    a = np.float32([first[m.queryIdx].pt for m in good])
    b = np.float32([last[m.trainIdx].pt for m in good])
    pose, inliers = cv2.estimateAffinePartial2D(a, b, None, cv2.RANSAC, 2.0, 2500, 0.995, 10)
    if pose is None or int(inliers.sum()) < 4:
        raise RuntimeError('Anatomical registration failed: ' + name + ' features=' + str(len(first)) + ' matches=' + str(len(good)) + ' inliers=' + str(0 if inliers is None else int(inliers.sum())))
    a, b = a[inliers.ravel() > 0], b[inliers.ravel() > 0]
    u, singular, vt = np.linalg.svd((a - a.mean(0)).T @ (b - b.mean(0)))
    rotation = vt.T @ u.T
    unit = np.column_stack([rotation, b.mean(0) - rotation @ a.mean(0)])
    return pose, unit, len(a)


canonical = []
for key in keys:
    target_features = features(key, None)
    canonical.append({name: fit(target_features, name)[0] for name in regions})
print('Approved key relative scales', [{name: float(np.hypot(fit(features(key, None), name)[0][0, 0], fit(features(key, None), name)[0][1, 0])) for name in regions} for key in keys])
spine_x = [300, 312, 324, 336, 348, 360, 370]


def spine(image):
    alpha = np.array(image)[:, :, 3]
    return np.array([float(np.where(alpha[:, x] > 128)[0].min()) for x in spine_x])


key_spines = [spine(key) for key in keys]


def ground_contact(image):
    alpha = np.array(image)[:, :, 3]
    gy, gx = np.where(alpha[437:455, 226:314] > 128)
    if len(gx) < 5:
        raise RuntimeError('Near hand ground contact not found')
    return np.array([float(np.median(gx) + 226), float(gy.max() + 437)])


key_contacts = [ground_contact(key) for key in keys]


def ease(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def target_pose(time, name):
    first, last, u = (0, 1, ease((time - 180) / 470)) if time <= 650 else (1, 2, ease((time - 650) / 420))
    a, b = canonical[first][name], canonical[last][name]
    angle = math.atan2(a[1, 0], a[0, 0]) * (1 - u) + math.atan2(b[1, 0], b[0, 0]) * u
    scale = np.hypot(a[0,0],a[1,0])*(1-u)+np.hypot(b[0,0],b[1,0])*u
    rotation = np.array([[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]])*scale
    return np.column_stack([rotation, a[:, 2] * (1 - u) + b[:, 2] * u])


def apply(points, pose):
    return np.array(points) @ pose[:, :2].T + pose[:, 2]


def kernel(first, last):
    delta = first[:, None, :] - last[None, :, :]
    radius = (delta * delta).sum(2)
    return radius * np.log(np.maximum(radius, 1e-12))


def register_image(image, time, actual_head):
    first, last, progress = (0, 1, ease((time - 180) / 470)) if time <= 650 else (1, 2, ease((time - 650) / 420))
    src, dst, fits = [], [], {}
    for name in regions:
        actual,count = actual_head
        points = np.array(grids[name], float)
        src.extend(apply(points, actual))
        dst.extend(apply(points, target_pose(time, name)))
        fits[name] = {'rawScale': float(np.hypot(actual[0, 0], actual[1, 0])), 'matches': count, 'sourcePose': actual.tolist(), 'targetPose': target_pose(time, name).tolist()}
    expected = key_spines[first] * (1 - progress) + key_spines[last] * progress
    actual_spine = spine(image)
    for x, actual_y, desired_y in zip(spine_x, actual_spine, expected):
        for depth in ([0, 16, 32] if x <= 332 else [0, 12]):
            src.append([x, actual_y + depth])
            dst.append([x, desired_y + depth])
    fits['spineSourceY'] = actual_spine.tolist()
    fits['spineTargetY'] = expected.tolist()
    src.extend(grids['feet'])
    dst.extend(grids['feet'])
    borders = [[0, 0], [256, 0], [511, 0], [511, 256], [511, 511], [256, 511], [0, 511], [0, 256]]
    src.extend(borders)
    dst.extend(borders)
    src, dst = np.array(src) / 512, np.array(dst) / 512
    polynomial = np.column_stack([np.ones(len(dst)), dst])
    system = np.block([[kernel(dst, dst) + np.eye(len(dst)) * 1e-8, polynomial], [polynomial.T, np.zeros((3, 3))]])
    coefficients = np.linalg.solve(system, np.vstack([src - dst, np.zeros((3, 2))]))
    mapping = np.empty((512, 512, 2), np.float32)
    for top in range(0, 512, 32):
        gy, gx = np.mgrid[top:top + 32, :512]
        points = np.column_stack([gx.ravel(), gy.ravel()]) / 512
        basis = np.column_stack([kernel(points, dst), np.ones(len(points)), points])
        mapping[top:top + 32] = ((points + basis @ coefficients) * 512).reshape(32, 512, 2)
    pixels = np.array(image).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    sampled = cv2.remap(pixels, mapping, None, cv2.INTER_LINEAR, None, cv2.BORDER_CONSTANT)
    alpha = np.clip(sampled[:, :, 3:4], 0, 1)
    rgb = np.clip(sampled[:, :, :3], 0, alpha) / np.maximum(alpha, 1 / 255)
    values = np.uint8(np.clip(np.concatenate([rgb, alpha], 2) * 255 + 0.5, 0, 255))
    values[values[:, :, 3] == 0, :3] = 0
    dyx, dxx = np.gradient(mapping[:, :, 0])
    dyy, dxy = np.gradient(mapping[:, :, 1])
    determinant = dxx * dyy - dyx * dxy
    fits['minJacobian'] = float(determinant[values[:, :, 3] > 128].min())
    fits['maxControlCorrectionPx'] = float(np.sqrt(((src - dst) ** 2).sum(1)).max() * 512)
    return Image.fromarray(values), fits


records = {}
times = [0, 36, 72, 108, 144, 180] + [j['t'] for j in plan if j['t'] < 650] + [650] + [j['t'] for j in plan if j['t'] > 650] + [1070]
times = sorted(times)
index_by_time = {time: i for i, time in enumerate(times)}
open_image = Image.open(source / 'Keys/start.png').convert('RGBA')
gy, gx = np.mgrid[:512, :512]
for time in times[:5]:
    mask = np.zeros((512, 512), float)
    for left, top, right, bottom in [(202, 196, 266, 258), (132, 183, 182, 232)]:
        cx, cy = (left + right) / 2, (top + bottom) / 2
        radius = ((gx - cx) / ((right - left) / 2)) ** 2 + ((gy - cy) / ((bottom - top) / 2)) ** 2
        ellipse = np.clip((1 - radius) * min(right - left, bottom - top) / 2, 0, 1)
        edge = top + (bottom - top) * ease(time / 180)
        mask = np.maximum(mask, ellipse * np.clip(gy - edge + 0.5, 0, 1))
    Image.composite(open_image, reference, Image.fromarray(np.uint8(mask * 255))).save(output / (str(index_by_time[time]).zfill(3) + '.png'))
for time, name in [(180, names[0]), (650, names[1]), (1070, names[2])]:
    shutil.copyfile(source / 'Keys' / name, output / (str(index_by_time[time]).zfill(3) + '.png'))
candidates=[]
for time,key,name in zip([180,650,1070],keys,names):
    pose,unit,count=fit(features(key,None),'head')
    candidates.append({'time':time,'image':key,'pose':pose,'matches':count,'spine':spine(key),'path':'Keys/'+name})
for job in plan:
    image=Image.open(source/job['image']).convert('RGBA').resize((512,512),Image.Resampling.LANCZOS)
    base=names.index(job['base'])
    delta=key_contacts[base]-ground_contact(image)
    image=image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,(1,0,-delta[0],0,1,-delta[1]),Image.Resampling.BICUBIC).convert('RGBA')
    try:
        pose,unit,count=fit(features(image,None),'head')
    except RuntimeError:
        continue
    candidates.append({'time':job['t'],'image':image,'pose':pose,'matches':count,'spine':spine(image),'path':job['image']})
for job in plan:
    first,last,progress=(0,1,ease((job['t']-180)/470)) if job['t']<=650 else (1,2,ease((job['t']-650)/420))
    expected_spine=key_spines[first]*(1-progress)+key_spines[last]*progress
    expected_center=apply([[225,240]],target_pose(job['t'],'head'))[0]
    def score(candidate):
        center=apply([[225,240]],candidate['pose'])[0]
        return float(np.linalg.norm(center-expected_center))+0.4*float(np.abs(candidate['spine']-expected_spine).mean())+0.015*abs(candidate['time']-job['t'])
    candidate=candidates[0]
    best_score=score(candidate)
    for option in candidates[1:]:
        option_score=score(option)
        if option_score<best_score:
            candidate=option
            best_score=option_score
    result, data = register_image(candidate['image'], job['t'],(candidate['pose'],candidate['matches']))
    data['selectedSource']=candidate['path']
    data['selectedSourceTime']=candidate['time']
    result.save(output / (str(index_by_time[job['t']]).zfill(3) + '.png'))
    records[str(job['t'])] = data
    print(job['t'],'source',candidate['time'],'Jacobian',round(data['minJacobian'],3),'correction',round(data['maxControlCorrectionPx'],2))
retouch_file=source/'retouch-plan.json'
if retouch_file.exists():
    for correction in json.loads(retouch_file.read_text('utf-8')):
        shutil.copyfile(source/correction['image'],output/correction['frame'])
        records[str(correction['timeMs'])]={'selectedSource':correction['image'],'minJacobian':correction['minJacobian'],'retouched':True}
durations = [b - a for a, b in zip(times, times[1:])] + [1000]
meta = {'name': 'bubble-toad', 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/bubble-toad.png', 'image': 'DesignAssets/Animations/BubbleToadDeath/RebuildV2/death.webp', 'frameSize': 512, 'columns': 4, 'frameCount': len(times), 'durationsMs': durations, 'durationMs': 2070, 'pivotX': 256, 'pivotY': 448, 'loop': False, 'timesMs': times, 'sourceFrames': ['Frames/' + str(i).zfill(3) + '.png' for i in range(len(times))], 'approvedFinal': 'Source/Keys/settled-revision2.png'}
encoder = json.JSONEncoder()
encoder.indent = 2
encoder.item_separator = ','
for path, data in [(folder / 'death.json', meta), (source / 'registration.json', records)]:
    path.write_bytes((encoder.encode(data) + '\n').replace('\n', '\r\n').encode('utf-8'))
board = Image.new('RGB', (6 * 256, 5 * 192), '#263631')
for index, time in enumerate(times):
    image = Image.open(output / (str(index).zfill(3) + '.png')).convert('RGBA')
    crop = image.crop((32, 160, 480, 496)).resize((256, 192), Image.Resampling.LANCZOS)
    x, y = (index % 6) * 256, (index // 6) * 192
    board.paste(crop, (x, y), crop)
    ImageDraw.Draw(board).text((x + 4, y + 4), str(time), 'white')
board.save(folder / 'drawn-sequence-review.png')
print('Assembled', len(times), 'frames;', sum(durations), 'ms')
