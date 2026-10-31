import json
import struct
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent


def execute(arguments):
    status = subprocess.call(arguments)
    if status != 0:
        raise RuntimeError('Media export failed: ' + arguments[0])


def exact_timing(path):
    data = bytearray(path.read_bytes())
    cursor = 12
    index = 0
    while cursor + 8 <= len(data):
        kind = data[cursor:cursor + 4]
        size = struct.unpack_from('<I', data, cursor + 4)[0]
        if kind == b'ANMF':
            duration = [33, 33, 34][index % 3]
            data[cursor + 20:cursor + 23] = duration.to_bytes(3, 'little')
            index += 1
        cursor += 8 + size + (size & 1)
    if index != 120:
        raise RuntimeError('Expected 120 frames, received ' + str(index))
    path.write_bytes(data)


def run():
    sequence = str(ROOT / 'Frames/frame-%03d.png')
    sheet = Image.new('RGBA', (6144, 5120), (0, 0, 0, 0))
    for index in range(120):
        frame = Image.open(ROOT / ('Frames/frame-' + str(index).zfill(3) + '.png')).convert('RGBA')
        sheet.paste(frame, ((index % 12) * 512, (index // 12) * 512))
    sheet.save(ROOT / 'idle-sheet.png', 'PNG')
    execute(['magick', str(ROOT / 'idle-sheet.png'), '-define', 'webp:lossless=true', '-quality', '100', str(ROOT / 'idle-sheet.webp')])
    execute(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-start_number', '0', '-i', sequence, '-frames:v', '120', '-c:v', 'libwebp_anim', '-lossless', '1', '-compression_level', '4', '-quality', '100', '-loop', '0', str(ROOT / 'idle.webp')])
    exact_timing(ROOT / 'idle.webp')
    bg = 'color=c=0x142c32:s=480x350:r=30,format=rgba[b];[0:v]crop=480:350:16:106[s];[b][s]overlay=shortest=1:format=rgb'
    execute(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', sequence, '-frames:v', '120', '-filter_complex', bg + ',format=rgba', '-c:v', 'libwebp_anim', '-lossless', '1', '-compression_level', '4', '-quality', '100', '-loop', '0', str(ROOT / 'preview.webp')])
    exact_timing(ROOT / 'preview.webp')
    execute(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', sequence, '-frames:v', '120', '-filter_complex', bg + ',split[a][z];[a]palettegen=stats_mode=full:reserve_transparent=0[p];[z][p]paletteuse=dither=none', '-loop', '0', str(ROOT / 'preview.gif')])
    execute(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', sequence, '-frames:v', '120', '-filter_complex', bg + ',scale=960:700:flags=lanczos', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(ROOT / 'preview.mp4')])
    contact = Image.new('RGBA', (1536, 1024), (20, 44, 50, 255))
    for tile, index in enumerate([0, 7, 13, 24, 30, 60, 72, 90]):
        frame = Image.open(ROOT / ('Frames/frame-' + str(index).zfill(3) + '.png')).convert('RGBA').resize((384, 384), Image.Resampling.LANCZOS)
        contact.alpha_composite(frame, ((tile % 4) * 384, (tile // 4) * 512 + 64))
    contact.save(ROOT / 'keyframes.png', 'PNG')
    poster = Image.new('RGBA', (512, 512), (20, 44, 50, 255))
    poster.alpha_composite(Image.open(ROOT / 'Frames/frame-000.png').convert('RGBA'))
    poster.crop((16, 106, 496, 456)).save(ROOT / 'poster.png', 'PNG')
    print('Exported 120 frames, 4000 ms, 12 x 10 lossless sheet, animated WebP, GIF and MP4.', flush=True)


if __name__ == '__main__':
    run()
