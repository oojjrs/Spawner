from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2
import json

ROOT = Path(__file__).resolve().parent
KEYS = ROOT / 'KeyPoses'
TIMES = [0.5, 0.95, 1.4, 2.1, 2.45, 3.0, 3.6, 3.85, 4.1]


def write(path, value):
    path.write_bytes((json.dumps(value).replace('\n', '\r\n') + '\r\n').encode('utf-8'))


def clean(image):
    pixels = np.array(image.convert('RGBA')).copy()
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(pixels[:, :, 3] > 100), 8)
    primary = 1 + int(np.argmax(stats[1:, 4]))
    mask = cv2.dilate(np.uint8(labels == primary), np.ones((3, 3), np.uint8))
    pixels[:, :, 3] *= mask
    pixels[:, :, 3][pixels[:, :, 3] < 16] = 0
    pixels[:, :, :3][pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)


def anchor(image):
    yy, xx = np.where(np.array(image.getchannel('A')) > 140)
    bottom = yy.max()
    foot = xx[yy > bottom - 5]
    return ((float(foot.min()) + float(foot.max())) / 2, int(bottom) + 1)


def prepare():
    KEYS.mkdir(511, True, True)
    source = Image.open(ROOT / 'Sources/keyposes-generated.png').convert('RGBA')
    scale = 1.09
    registration = []
    for index in range(9):
        col, row = index % 3, index // 3
        box = (round(col * source.width / 3), round(row * source.height / 3), round((col + 1) * source.width / 3), round((row + 1) * source.height / 3))
        cel = clean(source.crop(box))
        foot = anchor(cel)
        size = (round(cel.width * scale), round(cel.height * scale))
        offset = (round(256 - foot[0] * scale), round(448 - foot[1] * scale))
        scaled = cel.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')
        frame = Image.new('RGBA', (512, 512))
        frame.alpha_composite(scaled, offset)
        if index == 0:
            frame = Image.open(ROOT / 'Sources/level-02.png').convert('RGBA')
        elif index == 5:
            repair = clean(Image.open(ROOT / 'Sources/K5-repaired.png'))
            factor = 512 / repair.width
            reduced = repair.convert('RGBa').resize((512, round(repair.height * factor)), Image.Resampling.LANCZOS).convert('RGBA')
            repair_foot = anchor(reduced)
            frame = Image.new('RGBA', (512, 512))
            frame.alpha_composite(reduced, (round(256 - repair_foot[0]), round(448 - repair_foot[1])))
        elif index >= 6:
            original = Image.open(ROOT / 'Sources/level-03-idle-sheet.webp').convert('RGBA')
            number = {6: 36, 7: 12, 8: 0}[index]
            frame = original.crop((number % 8 * 512, number // 8 * 512, number % 8 * 512 + 512, number // 8 * 512 + 512))
            if index == 8:
                frame = Image.open(ROOT / 'Sources/level-03.png').convert('RGBA')
        frame.save(KEYS / ('K' + str(index) + '.png'))
        registration.append({'key': index, 'sourceCell': index, 'scale': scale if index in [1, 2, 3, 4] else None, 'offset': list(offset) if index in [1, 2, 3, 4] else None, 'groundY': 448, 'timeSeconds': 0 if index == 0 else TIMES[index], 'authority': 'exact-level-02' if index == 0 else 'generated-drawing' if index < 6 else 'existing-level-03-rig-output' if index < 8 else 'exact-level-03'})
    write(ROOT / 'registration.json', registration)
    contact = Image.new('RGB', (1536, 1614), '#25332e')
    draw = ImageDraw.Draw(contact)
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 20)
    for index in range(9):
        image = Image.open(KEYS / ('K' + str(index) + '.png')).convert('RGBA')
        pos = (index % 3 * 512, index // 3 * 538 + 26)
        contact.paste(image, pos, image)
        draw.text((pos[0] + 12, pos[1] - 25), 'K' + str(index) + ' / ' + str(0.0 if index == 0 else TIMES[index]) + 's', '#ffffff', font)
    contact.save(ROOT / 'keyposes.png')
    print('prepared nine registered key poses', flush=True)


if __name__ == '__main__':
    prepare()
