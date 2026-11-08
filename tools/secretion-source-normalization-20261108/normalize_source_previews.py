#!/usr/bin/env python3
"""Mirror linked priority previews with lossless, verified frame semantics.
GIF transformation retains palette indices/tables, control/extensions, and timing;
only raster LZW payloads and horizontal frame rectangle positions change.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import tempfile
from PIL import Image
import numpy as np

ROOT = Path(__file__).absolute().parents[2]
REPORT = Path(__file__).absolute().parent / 'preview-changes.json'
MANIFESTS = [f'AnimationCandidates/pebble-{form}-fullbody-v1-20261107/publication-manifest.json' for form in ('secretion-carapace', 'secretion-carapace-antenna')]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def blocks_end(data, start):
    while data[start]:
        start += data[start] + 1
    return start + 1


def gif_parts(data):
    end = 13 + (3 * 2 ** ((data[10] & 7) + 1) if data[10] & 128 else 0)
    yield ('header', data[:end])
    pos = end
    while pos < len(data):
        start = pos
        if data[pos] == 0x3b:
            yield ('trailer', data[pos:]); return
        if data[pos] == 0x21:
            pos = blocks_end(data, pos + 2)
            yield ('extension', data[start:pos])
        elif data[pos] == 0x2c:
            pos += 10
            if data[start + 9] & 128:
                pos += 3 * 2 ** ((data[start + 9] & 7) + 1)
            pos = blocks_end(data, pos + 1)
            yield ('image', data[start:pos])
        else:
            raise ValueError('Invalid GIF block')


def mirror_gif(data):
    parts = list(gif_parts(data)); header = parts[0][1]
    width = struct.unpack_from('<H', header, 6)[0]
    result = bytearray(header)
    for kind, block in parts[1:]:
        if kind != 'image':
            result.extend(block); continue
        left, top, w, h = struct.unpack_from('<HHHH', block, 1)
        solo_header = bytearray(header); struct.pack_into('<HH', solo_header, 6, w, h)
        solo_block = bytearray(block); struct.pack_into('<HH', solo_block, 1, 0, 0)
        with Image.open(io.BytesIO(bytes(solo_header) + bytes(solo_block) + b';')) as im:
            assert im.mode == 'P'
            mirrored = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            encoded = io.BytesIO()
            mirrored.save(encoded, format='GIF', optimize=False, interlace=False)
        new_block = next(b for k, b in gif_parts(encoded.getvalue()) if k == 'image')
        payload_start = 10 + (3 * 2 ** ((new_block[9] & 7) + 1) if new_block[9] & 128 else 0)
        original_payload_start = 10 + (3 * 2 ** ((block[9] & 7) + 1) if block[9] & 128 else 0)
        prefix = bytearray(block[:original_payload_start])
        struct.pack_into('<H', prefix, 1, width - left - w)
        prefix[9] &= ~64  # Newly encoded raster is not interlaced.
        result.extend(prefix); result.extend(new_block[payload_start:])
    return bytes(result)


def read_frames(p):
    with Image.open(p) as im:
        fmt = im.format; info = dict(im.info); frames = []; durations = []
        for i in range(im.n_frames):
            im.seek(i)
            frames.append(im.convert('RGBA').copy())
            durations.append(im.info.get('duration'))
        return fmt, info, frames, durations


def verify(expected, path, durations, info):
    _, actual_info, actual, actual_durations = read_frames(path)
    assert len(expected) == len(actual), 'Frame count changed'
    assert durations == actual_durations, (durations, actual_durations)
    assert info.get('loop') == actual_info.get('loop'), 'Loop changed'
    for i, (wanted, got) in enumerate(zip(expected, actual)):
        assert wanted.size == got.size, 'Dimensions changed'
        a, b = np.asarray(wanted), np.asarray(got)
        assert np.array_equal(a[:,:,3], b[:,:,3]), f'Frame {i} alpha changed'
        mask = a[:,:,3] != 0
        assert np.array_equal(a[mask], b[mask]), f'Frame {i} visible RGBA changed'


def journal(data):
    fd, temp = tempfile.mkstemp(dir=REPORT.parent, prefix='.preview-changes-')
    with os.fdopen(fd, 'w') as f:
        json.dump(data, f, indent=2); f.write('\n')
    os.replace(temp, REPORT)


def main():
    selected = {}
    missing = []
    for manifest in MANIFESTS:
        path = ROOT / manifest
        if not path.exists():
            path = Path("/workspace/scratch/cdf786db13f9/attack-publish-merge") / manifest
        for action, row in json.loads(path.read_text())['actions'].items():
            if 'secretion-carapace-antenna-' in manifest and action == 'birth':
                continue  # Packed birth deferred: raw source hash not found.
            for field in ('preview', 'gif', 'cover'):
                if not row.get(field): continue
                rel = row[field]
                p = ROOT / rel if rel.startswith(('AnimationCandidates/', 'DesignAssets/')) else path.parent / rel
                if not p.is_file():
                    missing.append(dict(image=p.relative_to(ROOT).as_posix(), manifest=manifest, action=action, field=field))
                    continue
                selected.setdefault(p.relative_to(ROOT).as_posix(), []).append(dict(manifest=manifest, action=action, field=field))
    report = json.loads(REPORT.read_text()) if REPORT.exists() else {'status':'in_progress', 'changes':{}, 'failures':{}}
    report['missingExistingReferences'] = missing
    print(json.dumps({'selected':len(selected)}), flush=True)
    for name, refs in selected.items():
        p = ROOT / name
        if name in report['changes']:
            assert sha(p) == report['changes'][name]['afterSha256']; continue
        for parent in p.parents:
            if parent == ROOT: break
            assert not parent.is_symlink(), f'Symlink directory {parent}'
        before = sha(p); original_target = p.resolve() if p.is_symlink() else None
        fmt, info, frames, durations = read_frames(p)
        expected = [f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames]
        fd, temp = tempfile.mkstemp(dir=p.parent, prefix='.mirror-preview-', suffix=p.suffix); os.close(fd)
        try:
            if fmt == 'GIF':
                Path(temp).write_bytes(mirror_gif(p.read_bytes()))
            else:
                opts = {'compress_level':9} if fmt == 'PNG' else {'lossless':True,'exact':True,'method':6}
                if len(frames) > 1:
                    opts.update(save_all=True, append_images=expected[1:], duration=durations)
                    if 'loop' in info: opts['loop'] = info['loop']
                    if 'background' in info: opts['background'] = info['background']
                expected[0].save(temp, format=fmt, **opts)
            verify(expected, temp, durations, info)
            after = sha(Path(temp)); os.replace(temp, p)
            if original_target: assert sha(original_target) == before
            report['changes'][name] = dict(oldImage=name,newImage=name,beforeSha256=before,afterSha256=after,
                format=fmt,frameCount=len(frames),width=frames[0].width,height=frames[0].height,
                durationsMs=durations,loop=info.get('loop'),references=refs,
                verification=dict(exactVisibleRgbaMirror=True,alphaExact=True,durationsUnchanged=True,
                    loopUnchanged=True,dimensionsUnchanged=True,originalSymlinkTargetUnchanged=original_target is not None))
            report['failures'].pop(name,None)
            print(json.dumps({'completed':len(report['changes']),'total':len(selected),'image':name}),flush=True)
        except Exception as exc:
            report['failures'][name] = str(exc)
            print(json.dumps({'failed':name,'reason':str(exc)}),flush=True)
        finally:
            if os.path.exists(temp): os.unlink(temp)
            journal(report)
    report['status'] = 'completed' if not report['failures'] else 'blocked'
    journal(report)
    if report['failures']: raise SystemExit(1)

if __name__ == '__main__': main()
