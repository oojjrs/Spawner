from pathlib import Path
from PIL import Image, ImageDraw, WebPImagePlugin
import json
import sys
import numpy as np

BASE = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
SOURCE = BASE / 'Sources/QuantumV9/spring'
PARTS = SOURCE / 'Parts'
IMPACT_SOURCE = BASE / 'Sources/PlopV10/spring'
IMPACT_PARTS = IMPACT_SOURCE / 'Parts'
OUT = Path(sys.argv[1])
OUT.mkdir(511, True, True)
DURATIONS = [600] + [80] * 59 + [1000]
CONTACTS = [14, 31, 48]
GROWTH_FRAMES = [contact + 2 for contact in CONTACTS]
ORIGIN = [256, 388]
Y, X = np.mgrid[0:512, 0:512]
DROP_MASK = np.float32(Y < ORIGIN[1])
water_mask = Image.new('L', (2048, 2048))
ImageDraw.Draw(water_mask).ellipse((162 * 4, 372 * 4, 368 * 4, 402 * 4), 255)
WATER_MASK = np.array(water_mask.resize((512, 512), Image.Resampling.LANCZOS)).astype(np.float32) / 255


def read(path):
    return Image.open(path).convert('RGBA')


def json_write(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def place(image, pivot, position, scale):
    transform = (1 / scale[0], 0, pivot[0] - position[0] / scale[0],
                 0, 1 / scale[1], pivot[1] - position[1] / scale[1])
    return image.convert('RGBa').transform((512, 512), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC).convert('RGBA')


def occlude(image, mask):
    pixels = np.array(image)
    pixels[:, :, 3] = np.uint8(pixels[:, :, 3].astype(np.float32) * mask)
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)


def animated(frames, path):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': DURATIONS, 'loop': 0, 'lossless': True, 'method': 4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(frames[0], stream, str(path))


def droplet_pose(frame):
    for hop, begin in enumerate([2, 19, 36], 1):
        age = frame - begin
        if not 0 <= age <= 14:
            continue
        if age in [0, 1]:
            return [256, 464 if age == 0 else 420], [.9, 1 / .9], 'emerge', hop
        if age in [13, 14]:
            return [256, 512 if age == 13 else 530], [.9, 1 / .9], 'submerge', hop
        progress = (age - 2) / 10
        height = 90 * 4 * progress * (1 - progress)
        stretch = 1 + .12 * abs(1 - 2 * progress)
        phase = 'contact' if age == 12 else 'rise' if progress < .5 else 'fall'
        return [256, 370 - height + 74 * progress], [1 / stretch, stretch], phase, hop
    return None


start = read(SOURCE / 'start.png')
finish = read(SOURCE / 'end.png')
medium = read(PARTS / 'medium-pool.png')
lower = Image.alpha_composite(read(PARTS / 'lower-pool.png'), read(PARTS / 'rear-seed.png'))
fronts = [read(PARTS / name) for name in ['first-front.png', 'medium-front.png', 'stage-front.png', 'lower-front.png']]
droplet = read(PARTS / 'water-airborne.png')
drop_bounds = droplet.getbbox()
drop_pivot = [(drop_bounds[0] + drop_bounds[2]) / 2, drop_bounds[3]]
atlas = read(IMPACT_SOURCE / 'entry-actions.png')
impact_names = ['dimple', 'crown', 'collar', 'ripple']
impact_rects = [(145, 540, 530, 690), (730, 480, 1125, 700), (90, 915, 610, 1110), (670, 935, 1190, 1100)]
impact_widths = [70, 100, 132, 180]
impact_anchors = [.5, .75, .6, .5]
impact_parts = {}
impact_attachments = {}
for i, name in enumerate(impact_names):
    piece = atlas.crop(impact_rects[i])
    pixels = np.array(piece)
    pixels[pixels[:, :, 3] < 24] = 0
    piece = Image.fromarray(pixels)
    bounds = piece.getbbox()
    piece = piece.crop(bounds)
    size = (impact_widths[i], round(piece.height * impact_widths[i] / piece.width))
    piece = piece.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (512, 512))
    canvas.alpha_composite(piece, (256 - size[0] // 2, 400 - round(size[1] * impact_anchors[i])))
    impact_parts[name] = canvas
    impact_attachments[name] = {'source': 'Parts/entry-' + name + '.png', 'sourceRoot': 'impactSourceRoot',
                                'parent': 'water-hop', 'pivot': [256, 400], 'atlasRect': list(impact_rects[i]),
                                'drawingBounds': list(bounds), 'registeredSize': list(size)}
ring = impact_parts['ripple']
ring_box = ring.getbbox()
ring_pivot = [(ring_box[0] + ring_box[2]) / 2, (ring_box[1] + ring_box[3]) / 2]
ring_width = ring_box[2] - ring_box[0]
ring_height = ring_box[3] - ring_box[1]
frames = []
keys = []
for frame in range(61):
    stage = sum(frame >= growth for growth in GROWTH_FRAMES)
    image = [start, medium, lower, finish][stage].copy()
    key = {'frame': frame, 'stage': stage, 'root': [256, 448], 'drawings': [], 'ripples': []}
    pose = droplet_pose(frame)
    if pose is not None:
        position, scale, phase, hop = pose
        layer = occlude(place(droplet, drop_pivot, position, scale), DROP_MASK)
        image = Image.alpha_composite(image, layer)
        key['drawings'].append({'id': 'drop-' + str(hop), 'attachment': 'droplet', 'position': position,
                                'scale': scale, 'opacity': 1, 'phase': phase, 'visible': layer.getbbox() is not None})
    for contact in CONTACTS:
        age = frame - contact
        wave_age = frame - (contact + 2)
        if 0 <= wave_age <= 7:
            width, height = 38 + 18 * wave_age, 6 + 2 * wave_age
            ripple = occlude(place(ring, ring_pivot, ORIGIN, [width / ring_width, height / ring_height]), WATER_MASK)
            highlight_strength = 1 if wave_age <= 2 else (7 - wave_age) / 5
            pixels = np.array(ripple)
            pixels[:, :, 3] = np.uint8(pixels[:, :, 3] * highlight_strength)
            ripple = Image.fromarray(pixels)
            image = Image.alpha_composite(image, ripple)
            key['ripples'].append({'position': ORIGIN, 'size': [width, height], 'opacity': highlight_strength,
                                   'kind': 'surface-wave-highlight', 'clip': 'inner-pool-surface'})
        if -1 <= age <= 3:
            name, sx, sy = [('dimple', .65, .65), ('crown', .95, .8), ('crown', 1.12, .65),
                            ('collar', 1.02, .78), ('collar', 1.15, .5)][age + 1]
            layer = place(impact_parts[name], [256, 400], ORIGIN, [sx, sy])
            if name in ['dimple', 'collar']:
                layer = occlude(layer, WATER_MASK)
            image = Image.alpha_composite(image, layer)
            key.setdefault('entryEffects', []).append({'attachment': name, 'position': ORIGIN,
                                                       'scale': [sx, sy], 'opacity': 1})
    pixels = np.array(image)
    front = np.array(fronts[stage])
    mask = front[:, :, 3] > 0
    pixels[mask] = front[mask]
    image = Image.fromarray(pixels)
    if frame == 0:
        image = start.copy()
    if frame >= 58:
        image = finish.copy()
    frames.append(image)
    keys.append(key)

sheet = Image.new('RGBA', (4096, 4096))
for i, image in enumerate(frames):
    sheet.paste(image, (i % 8 * 512, i // 8 * 512))
sheet.save(OUT / 'growth.png')
animated(frames, OUT / 'growth.webp')
previews = []
for image in frames:
    preview = Image.new('RGB', (512, 512), '#20282e')
    preview.paste(image, (0, 0), image)
    previews.append(preview.resize((384, 384), Image.Resampling.LANCZOS))
animated(previews, OUT / 'preview.webp')
indices = [2, 4, 9, 12, 13, 14, 15, 16, 17, 18, 20, 24, 29, 30, 31, 32, 33, 34, 35, 37, 42, 47, 48, 49, 50, 51, 52, 54, 57, 60]
contact_sheet = Image.new('RGB', (256 * 6, 256 * 5), '#20282e')
for i, frame in enumerate(indices):
    contact_sheet.paste(previews[frame].resize((256, 256), Image.Resampling.LANCZOS), (i % 6 * 256, i // 6 * 256))
contact_sheet.save(OUT / 'contact.png')
metadata = json.loads((BASE / 'spring/animation.json').read_text('utf-8'))
phases = {'firstEmerge': [2, 3], 'firstFlight': [4, 13], 'firstSubmerge': [14, 15], 'firstGrowthWave': [16, 23],
          'secondEmerge': [19, 20], 'secondFlight': [21, 30], 'secondSubmerge': [31, 32], 'secondGrowthWave': [33, 40],
          'thirdEmerge': [36, 37], 'thirdFlight': [38, 47], 'thirdSubmerge': [48, 49], 'finalGrowthWave': [50, 57],
          'rest': [58, 60]}
metadata.update({'method': 'low-hops-and-growth-after-submersion-with-contained-waves', 'source': 'Sources/QuantumV9/spring/Parts',
                 'additionalSources': ['Sources/QuantumV9/spring/water-actions.png', 'Sources/PlopV10/spring/entry-actions.png'], 'timeline': 'rig.json',
                 'durationsMs': DURATIONS, 'durationMs': sum(DURATIONS), 'phaseRanges': phases,
                 'markersMs': {'lowerLand': 1640, 'lowerGrowth': 1800, 'rearSeedLand': 3000, 'rearGrowth': 3160,
                               'upperLand': 4360, 'upperOpening': 4520, 'cascadeStart': 4520, 'completed': 4520, 'settled': 5160}})
rig = {'sourceRoot': 'Sources/QuantumV9/spring', 'impactSourceRoot': 'Sources/PlopV10/spring', 'canvas': [512, 512], 'root': [256, 448],
       'frameCount': 61, 'durationMs': sum(DURATIONS), 'phaseRanges': phases, 'rootMotion': False,
       'keySpace': 'canvas', 'construction': 'submerge-then-grow-with-contained-surface-waves',
       'bones': [{'id': 'root', 'parent': None, 'pivot': [256, 448]}, {'id': 'water-hop', 'parent': 'root', 'pivot': ORIGIN}],
       'attachments': {'droplet': {'source': 'Parts/water-airborne.png', 'parent': 'water-hop', 'pivot': drop_pivot}, **impact_attachments},
       'drawOrder': ['stage-pool', 'water-hop', 'ripples', 'entry-crown', 'stage-front'],
       'reference': {'start': 'Sources/QuantumV9/spring/start.png', 'end': 'Sources/QuantumV9/spring/end.png'},
       'stageChanges': GROWTH_FRAMES, 'contacts': CONTACTS, 'finalBodyFrame': 50, 'hopStarts': [2, 19, 36],
       'fullySubmergedFrames': [15, 32, 49], 'maxRippleSize': [164, 20],
       'clips': {'dropletWaterlineY': 388, 'rippleSurfaceEllipse': [162, 372, 368, 402]},
       'animatedPoseOpacity': False, 'effectIntensityAnimation': ['surface-wave-highlight'],
       'fixed': ['root', 'ground-contact', 'registered-stage-poses'], 'keys': keys,
       'stageSources': {'initial': 'start.png', 'medium': 'Parts/medium-pool.png', 'lower': 'Parts/lower-pool.png',
                        'rearSeed': 'Parts/rear-seed.png', 'final': 'end.png',
                        'fronts': ['Parts/first-front.png', 'Parts/medium-front.png', 'Parts/stage-front.png', 'Parts/lower-front.png'],
                        'ripple': '../../PlopV10/spring/Parts/entry-ripple.png'}}
json_write(OUT / 'animation.json', metadata)
json_write(OUT / 'rig.json', rig)
print('Rendered low hops; submerged at', [15, 32, 49], 'then growth and contained waves at', GROWTH_FRAMES)
