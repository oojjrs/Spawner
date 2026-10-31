from pathlib import Path
from PIL import Image
import numpy as np
import cv2
import subprocess

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent if ROOT.parent.name == 'AnimationCandidates' else ROOT.parent
WORK = PROJECT / '$Trash/SproutGrowth23/Neural'
CLI = Path('H:/Spawner/$Trash/NestGrowth02To03-Rebuild20261030/Tools/rife-ncnn-vulkan-20221029-windows/rife-ncnn-vulkan.exe')
MODEL = CLI.parent / 'rife-v4.6'


def prepare():
    for folder in [WORK / 'RGB', WORK / 'Alpha', WORK / 'Output']:
        folder.mkdir(511, True, True)
    sources = [(i, ROOT / 'KeyPoses' / ('K' + str(i) + '.png')) for i in range(9)]
    sources.extend([(i, ROOT / 'Sources/GrowthSupport' / (str(i) + '.png')) for i in [20, 30, 21, 31]])
    for number, path in sources:
        image = Image.open(path).convert('RGBA')
        a = np.array(image).astype(float) / 255
        Image.fromarray(np.uint8(a[:, :, :3] * a[:, :, 3:4] * 255)).save(WORK / 'RGB' / (str(number) + '.png'))
        image.getchannel('A').convert('RGB').save(WORK / 'Alpha' / (str(number) + '.png'))


def execute(task):
    a, b, t, kind, name = task
    path = WORK / 'Output' / name
    if path.exists():
        return
    args = [str(CLI), '-0', str(WORK / kind / (str(a) + '.png')), '-1', str(WORK / kind / (str(b) + '.png')), '-o', str(path), '-s', str(t), '-m', str(MODEL), '-g', '0', '-j', '1:1:1']
    result = subprocess.run(args, None, None, None, subprocess.PIPE, subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', 'replace')[-2000:])


def reconstruct(a, b, t):
    prefix = str(a) + '-' + str(b) + '-' + str(t)
    rgb = np.array(Image.open(WORK / 'Output' / (prefix + '-RGB.png')).convert('RGB')).astype(np.float32) / 255
    matte = np.array(Image.open(WORK / 'Output' / (prefix + '-Alpha.png')).convert('L')).astype(np.float32) / 255
    colors = np.clip(rgb / np.maximum(matte[:, :, None], 0.03), 0, 1)
    mask = np.uint8(matte > 0.5)
    n, labels, stats, centers = cv2.connectedComponentsWithStats(mask, 8)
    keep = np.zeros_like(mask)
    for index in range(1, n):
        if stats[index, 4] > 12:
            keep[labels == index] = 1
    _, nearest = cv2.distanceTransformWithLabels(1 - keep, cv2.DIST_L2, 5, None, None, cv2.DIST_LABEL_PIXEL)
    table = np.vstack([np.zeros((1, 3), np.float32), colors[keep > 0]])
    colors[keep == 0] = table[nearest[keep == 0]]
    alpha = cv2.GaussianBlur(keep.astype(np.float32), (3, 3), 0.45)
    pixels = np.uint8(np.clip(np.dstack([colors, alpha]) * 255 + 0.5, 0, 255))
    pixels[pixels[:, :, 3] == 0, :3] = 0
    return Image.fromarray(pixels)
