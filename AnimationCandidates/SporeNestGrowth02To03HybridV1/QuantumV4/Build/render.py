from pathlib import Path
import sys
import json
import shutil
import importlib.util
import subprocess

PROJECT = Path('H:/Spawner')
sys.path.insert(0, str(PROJECT / '$Trash/creature-emergence-20261030/python'))
sys.path.insert(0, str(PROJECT / '$Trash/SproutNestQuantumV1/dependencies'))
import numpy as np
from PIL import Image, GifImagePlugin

BASE = PROJECT / 'AnimationCandidates/SporeNestGrowth02To03HybridV1'
PREVIOUS = BASE / 'AnimationV3'
ROOT = BASE / 'QuantumV4'
WORK = PROJECT / '$Trash/SporeNestGrowth02To03QuantumV4'
MARKERS = {'coverStart': 0, 'covered': 800, 'growth1': 1400, 'growth2': 2100, 'liftStart': 2800, 'liftEnd': 4200, 'completed': 5000}


def save_json(path, data):
    path.write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))


def load_core():
    spec = importlib.util.spec_from_file_location('spore_pose_core', ROOT / 'Build/pose_renderer.py')
    core = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(core)
    core.ROOT = ROOT
    core.SRC = ROOT / 'Sources'
    core.PARTS = ROOT / 'Parts'
    core.BUILD = ROOT / 'Build'
    core.FRAMES = ROOT / 'Frames'
    core.WORK = WORK
    return core


def prepare():
    if ROOT.exists():
        raise RuntimeError('QuantumV4 already exists; preserve the existing candidate')
    for folder in [ROOT, ROOT / 'Build', ROOT / 'Frames', ROOT / 'RuntimeFrames', WORK]:
        folder.mkdir(511, True, True)
    for name in ['Sources', 'Parts']:
        for path in (PREVIOUS / name).rglob('*'):
            if path.is_file():
                target = ROOT / name / path.relative_to(PREVIOUS / name)
                target.parent.mkdir(511, True, True)
                shutil.copy2(path, target)
    for name in ['rig.json', 'adult-skeleton-source.json']:
        shutil.copy2(PREVIOUS / 'Build' / name, ROOT / 'Build' / name)
    shutil.copy2(PREVIOUS / 'Build/render.py', ROOT / 'Build/pose_renderer.py')
    shutil.copy2(Path(__file__), ROOT / 'Build/render.py')
    rig = json.loads((ROOT / 'Build/rig.json').read_text('utf-8'))
    rig['retiming'] = {'source': 'render.py', 'growthMode': 'two instantaneous stage changes', 'markersMs': MARKERS, 'staticHolds': True, 'extraPumpAfterLift': False}
    save_json(ROOT / 'Build/rig.json', rig)
    print('quantum candidate prepared')


def phase(t):
    if t < .8:
        return 'cover'
    if t < 1.4:
        return 'hold-small'
    if abs(t - 1.4) < 1e-8:
        return 'growth-1'
    if t < 2.1:
        return 'hold-medium'
    if abs(t - 2.1) < 1e-8:
        return 'growth-2'
    if t < 2.8:
        return 'hold-adult'
    if t < 4.2:
        return 'lift'
    return 'rest'


class QuantumRenderer:
    def __init__(self):
        self.core = load_core()
        self.pose = self.core.Renderer()
        self.small = self.pose.frame(1.4)
        self.medium = self.pose.frame(1.75)
        self.adult = self.pose.frame(2.1)
        self.cache = {}

    def frame(self, t):
        if t < .8:
            key = round(.5 + .9 * t / .8, 8)
            if key not in self.cache:
                self.cache[key] = self.pose.frame(key)
            return self.cache[key].copy()
        if t < 1.4:
            return self.small.copy()
        if t < 2.1:
            return self.medium.copy()
        if t < 2.8:
            return self.adult.copy()
        if t < 4.2:
            key = round(2.1 + 1.5 * (t - 2.8) / 1.4, 8)
            if key not in self.cache:
                self.cache[key] = self.pose.frame(key)
            return self.cache[key].copy()
        return self.pose.end.copy()


def backgrounds(frames):
    result = []
    for im in frames:
        bg = Image.new('RGBA', (512, 512), '#15241f')
        bg.alpha_composite(im)
        result.append(bg.convert('RGB'))
    return result


def gif(frames, path, durations):
    montage = Image.new('RGB', (1024, 640), '#15241f')
    stride = max(1, len(frames) // 32)
    for i, im in enumerate(frames[::stride][:40]):
        montage.paste(im.resize((128, 128), Image.Resampling.LANCZOS), (i % 8 * 128, i // 8 * 128))
    palette = montage.quantize(192, Image.Quantize.MEDIANCUT, 0, None, Image.Dither.NONE)
    quantized = [im.quantize(192, None, 0, palette, Image.Dither.NONE) for im in frames]
    quantized[0].encoderinfo = {'append_images': quantized[1:], 'duration': durations, 'loop': 0, 'disposal': 2, 'optimize': False}
    with path.open('wb') as f:
        GifImagePlugin._save_all(quantized[0], f, str(path))


def sample():
    renderer = QuantumRenderer()
    stages = [renderer.small, renderer.medium, renderer.adult]
    renderer.core.animated(stages, WORK / 'cadence.webp', [600, 700, 700], 0)
    gif(backgrounds(stages), WORK / 'cadence.gif', [600, 700, 700])
    renderer.core.contact(stages, ['covered - hold 600ms', 'jump 1 - hold 700ms', 'jump 2 - hold 700ms'], WORK / 'cadence-contact.png', 3)
    print('three-state cadence rendered')


def render():
    renderer = QuantumRenderer()
    frames = []
    for i in range(100):
        im = renderer.frame(i / 20)
        im.save(ROOT / 'Frames' / (str(i).zfill(4) + '.png'))
        frames.append(im)
    indices = list(range(28)) + [28, 42] + list(range(56, 84)) + [84, 87, 90, 93, 96, 99]
    runtime_times = [i * 50 for i in indices]
    durations = np.diff(runtime_times + [5000]).tolist()
    runtime = [frames[i] for i in indices]
    sheet = Image.new('RGBA', (4096, 4096))
    for i, im in enumerate(runtime):
        sheet.paste(im, (i % 8 * 512, i // 8 * 512))
        im.save(ROOT / 'RuntimeFrames' / (str(i).zfill(4) + '.png'))
    sheet.save(ROOT / 'growth-sheet.png')
    renderer.core.animated(runtime, ROOT / 'growth.webp', durations, 1)
    bg = backgrounds(frames)
    renderer.core.animated(bg, ROOT / 'preview.webp', [50] * len(frames), 0)
    gif(bg, ROOT / 'preview.gif', [50] * len(frames))
    video_frames = WORK / 'VideoFrames'
    video_frames.mkdir(511, True, True)
    for i, im in enumerate(bg):
        im.save(video_frames / (str(i).zfill(4) + '.png'))
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '20', '-i', str(video_frames / '%04d.png'), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(ROOT / 'preview.mp4')]
    result = subprocess.run(command)
    if result.returncode != 0:
        raise RuntimeError('MP4 export failed')
    contact_indices = [0, 15, 16, 27, 28, 41, 42, 55, 56, 70, 84, 99]
    renderer.core.contact([frames[i] for i in contact_indices], [str(i / 20) + 's ' + phase(i / 20) for i in contact_indices], ROOT / 'contact.png', 4)
    metadata = {'frameSize': [512, 512], 'frameCount': 64, 'columns': 8, 'rows': 8, 'root': [256, 448], 'durationMs': 5000, 'durationsMs': durations, 'loop': False, 'sheet': 'growth-sheet.png', 'animation': 'growth.webp', 'previewRepeats': True, 'growthEventsMs': [1400, 2100], 'markersMs': MARKERS, 'holdIntervalsMs': [[800, 1400], [1400, 2100], [2100, 2800]], 'poseOpacityBlend': False, 'growthInterpolation': False, 'rig': 'Build/rig.json', 'retiming': 'Build/render.py', 'approvedAppearance': 'KeyframesV3 deep-cover shapes and AnimationV3 pose rig', 'method': 'drawn poses and part rigs; discrete growth stages with exact still holds', 'extraPumpAfterLift': False, 'states': [{'frame': i, 'timeMs': t, 'phase': phase(t / 1000), 'authoringFrame': indices[i]} for i, t in enumerate(runtime_times)], 'authoringPreview': {'frameCount': 100, 'fps': 20, 'durationMs': 5000, 'frames': 'Frames'}, 'request': '덮고, 쉬고, 커지고, 쉬고, 커지고, 쉬고, 올리고'}
    save_json(ROOT / 'animation.json', metadata)
    if Path(__file__).resolve() != (ROOT / 'Build/render.py').resolve():
        shutil.copy2(Path(__file__), ROOT / 'Build/render.py')
    print('quantum animation rendered', len(frames), len(runtime))


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'prepare':
        prepare()
    elif mode == 'sample':
        sample()
    elif mode == 'render':
        render()
