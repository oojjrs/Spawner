from pathlib import Path
import json
import sys
from riglib import *
WORK = Path(__file__).resolve().parent
DURATIONS = [500] + [40] * 79 + [900]
def wheel(source, pivot, radii, progress, mask):
    angle = 2 * math.pi * smooth(progress)
    dx = (X - pivot[0]) / radii[0]
    dy = (Y - pivot[1]) / radii[1]
    xx = pivot[0] + (dx * math.cos(angle) + dy * math.sin(angle)) * radii[0]
    yy = pivot[1] + (-dx * math.sin(angle) + dy * math.cos(angle)) * radii[1]
    material = padded_material(source)
    turned = cv2.remap(material, xx.astype(np.float32), yy.astype(np.float32), cv2.INTER_LINEAR, cv2.BORDER_REPLICATE)
    return over(turned * mask[:, :, None], source * (~mask)[:, :, None])
def mechanism(tribe, source, index):
    if index in [68, 80]:
        return source.copy()
    progress = (index - 68) / 12
    if tribe == 'spore':
        mask = poly([(430, 350), (481, 359), (482, 396), (430, 387)]) & (source[:, :, 3] > .99)
        amount = math.sin(math.pi * progress) * .10
        material = padded_material(source)
        folded = affine(material, (450, 405), (1, 1 - amount), 0, (0, 0))
        return over(folded * mask[:, :, None], source * (~mask)[:, :, None])
    pivot, radii = {'sprout': [(64, 260), (18, 25)], 'pebble': [(335, 233), (25, 28)], 'spring': [(106, 297), (20, 32)]}[tribe]
    mask = ((X - pivot[0]) / radii[0]) ** 2 + ((Y - pivot[1]) / radii[1]) ** 2 <= 1
    mask &= source[:, :, 3] > .99
    if tribe == 'spring':
        pixels = np.uint8(np.array(rgba(source)))
        hsv = cv2.cvtColor(pixels[:, :, :3], cv2.COLOR_RGB2HSV)
        mask &= (hsv[:, :, 0] < 42) & (hsv[:, :, 1] > 75)
    return wheel(source, pivot, radii, progress, mask)
def cels(tribe, start, end):
    poses = [premul(Image.open(WORK / tribe / 'Poses' / (str(index).zfill(2) + '.png'))) for index in range(16)]
    frames = []
    indices = []
    for index in range(81):
        if index == 0:
            value, pose = start.copy(), None
        elif index <= 18:
            pose = min(3, 1 + (index - 1) // 6)
            value = poses[pose].copy()
        elif index <= 23:
            value, pose = poses[3].copy(), 3
        elif index <= 43:
            sequence = [4, 5, 6, 6] if tribe == 'pebble' else [4, 5, 6, 7]
            pose = sequence[min(3, (index - 24) // 5)]
            value = poses[pose].copy()
        elif index < 68:
            sequence = list(range(7, 16)) if tribe == 'pebble' else list(range(8, 16))
            pose = sequence[min(len(sequence) - 1, (index - 44) * len(sequence) // 24)]
            value = poses[pose].copy()
        else:
            value, pose = mechanism(tribe, end, index), None
        frames.append(rgba(value))
        indices.append(pose)
    return frames, {'method': 'registered-complete-drawn-cels-and-local-mechanisms', 'poseIndices': indices, 'registration': 'registration.json', 'source': '../Sources/' + tribe + '-cels.png'}
def render(tribe):
    folder = WORK / tribe
    start = premul(Image.open(folder / 'start.png'))
    end = premul(Image.open(folder / 'end.png'))
    frames, source = cels(tribe, start, end)
    pack(frames, folder / 'growth.png', 8)
    animated(frames, folder / 'growth.webp', DURATIONS)
    thumbnails = [preview(frame).resize((384, 384), Image.Resampling.LANCZOS) for frame in frames]
    animated(thumbnails, folder / 'preview.webp', DURATIONS)
    json_write(folder / 'animation.json', {'frameSize': [512, 512], 'frameCount': 81, 'columns': 8, 'rows': 11, 'durationsMs': DURATIONS, 'root': [256, 448], 'loop': False, 'previewRepeats': True, 'markersMs': {'closeStart': 500, 'closed': 1180, 'assemblyStart': 1420, 'assemblyEnd': 2180, 'openStart': 2220, 'openEnd': 3180, 'mechanismStart': 3180, 'mechanismEnd': 3660}, 'audio': {'src': 'DesignAssets/Audio/NestGrowth02To03-v1/' + tribe + '.mp3', 'startMs': 500, 'volume': 1, 'loop': False, 'sourceProcessing': 'none'}, 'construction': source})
    print(tribe + ' exported', flush=True)
if __name__ == '__main__':
    for tribe in sys.argv[1:] or ['sprout', 'spore', 'pebble', 'spring']:
        render(tribe)
