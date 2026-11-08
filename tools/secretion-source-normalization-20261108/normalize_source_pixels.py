#!/usr/bin/env python3
"""Deterministic, explicitly selected per-cell source normalization.

Dry run: python normalize_source_pixels.py --plan approved-plan.json
Apply:   python normalize_source_pixels.py --plan approved-plan.json --apply
Plan is a JSON list of image paths or objects with image, frameSize/frameWidth,
frameHeight, columns, frameCount, kind. Paths in catalog inherit geometry only;
sourceFacing is NEVER used to select an image. A portrait must explicitly supply
kind='portrait'. --include-scene-layers mirrors each selected source's layers.
--include-exact-aliases includes byte-identical PNG/WebP source sheets under
DesignAssets and AnimationCandidates. No previews or animated files are changed.

Atomic replacement replaces file symlinks, never their source targets. SHA-named
layer atlases receive a new SHA-named path; originals remain untouched. Re-running
--apply resumes from the per-image journal, not by mirroring outputs a second time.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from PIL import Image

HERE = Path(__file__).absolute().parent
ROOT = HERE.parent.parent
REPORT = HERE / 'pixel-changes.json'
CATALOG = HERE / 'catalog-before.json'


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def local(name):
    p = ROOT / name
    if Path(name).is_absolute() or '..' in Path(name).parts:
        raise ValueError(f'Nonlocal path: {name}')
    # A per-file symlink is safe to replace, but a symlinked parent is not.
    for parent in p.parents:
        if parent == ROOT:
            break
        if parent.is_symlink():
            raise ValueError(f'Symlinked directory: {parent}')
    return p


def atomic_json(data):
    fd, name = tempfile.mkstemp(prefix='.pixel-changes-', dir=HERE)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')
        os.replace(name, REPORT)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def geometry(item):
    return (int(item.get('frameWidth', item.get('frameSize', 0))),
            int(item.get('frameHeight', item.get('frameWidth', item.get('frameSize', 0)))),
            int(item.get('columns', 0)))


def collect(plan, include_layers, aliases):
    catalog = json.loads(CATALOG.read_text())
    by_image = {}
    for row in catalog:
        for item in [row] + row.get('sceneLayers', {}).get('layers', []):
            name = item['image']
            if name in by_image and geometry(by_image[name]) != geometry(item):
                raise ValueError(f'Conflicting catalog geometry: {name}')
            by_image[name] = item
    selected = {}

    def add(item, kind='atlas'):
        name = item['image']
        merged = dict(by_image.get(name, {}), **item)
        merged['kind'] = item.get('kind', kind)
        if name in selected and geometry(selected[name]) != geometry(merged):
            raise ValueError(f'Conflicting selection geometry: {name}')
        selected[name] = merged

    for entry in plan:
        item = {'image': entry} if isinstance(entry, str) else entry
        add(item)
        if include_layers:
            for layer in by_image.get(item['image'], {}).get('sceneLayers', {}).get('layers', []):
                add(layer, 'sceneLayer')
    # Validate every geometry before making any changes.
    for name, item in selected.items():
        p = local(name)
        with Image.open(p) as im:
            if getattr(im, 'n_frames', 1) != 1:
                raise ValueError(f'Animated source is excluded: {name}')
            if im.format not in ('PNG', 'WEBP'):
                raise ValueError(f'Unsupported source format: {name}')
            if item['kind'] == 'portrait':
                item.update(frameSize=im.width, frameHeight=im.height, columns=1, frameCount=1)
            fw, fh, cols = geometry(item)
            if min(fw, fh, cols) <= 0 or im.width != fw * cols or im.height % fh:
                raise ValueError(f'Invalid atlas geometry: {name}: {im.size}, {(fw, fh, cols)}')
            count = int(item.get('frameCount', cols * (im.height // fh)))
            if count <= 0 or count > cols * (im.height // fh):
                raise ValueError(f'Invalid frame count: {name}')
            item.update(frameCount=count, width=im.width, height=im.height)
        item['beforeSha256'] = sha(p)
    if aliases:
        lookup = {}
        sizes = set()
        for name, item in selected.items():
            lookup.setdefault(item['beforeSha256'], []).append(name)
            sizes.add(local(name).stat().st_size)
        additions = {}
        for folder in ('DesignAssets', 'AnimationCandidates'):
            for p in sorted((ROOT / folder).rglob('*')):
                name = p.relative_to(ROOT).as_posix()
                if name in selected or not p.is_file() or p.suffix.lower() not in ('.png', '.webp'):
                    continue
                if p.stat().st_size not in sizes:
                    continue
                matches = lookup.get(sha(p), [])
                if not matches:
                    continue
                canon = matches[0]
                if any(geometry(selected[n]) != geometry(selected[canon]) for n in matches):
                    raise ValueError(f'Conflicting duplicate geometry: {matches}')
                if name in by_image and geometry(by_image[name]) != geometry(selected[canon]):
                    raise ValueError(f'Conflicting alias geometry: {name}')
                additions[name] = dict(selected[canon], image=name, aliasOf=canon)
        selected.update(additions)
    return selected


def flip(item):
    old = item['image']
    source = local(old)
    before = sha(source)
    if before != item['beforeSha256']:
        raise ValueError(f'Input changed since preflight: {old}')
    fw, fh, columns = geometry(item)
    source_link = os.readlink(source) if source.is_symlink() else None
    with Image.open(source) as im:
        original = im.convert('RGBA')
        fmt = im.format
    output = Image.new('RGBA', original.size)
    for y in range(0, original.height, fh):
        for x in range(0, original.width, fw):
            output.paste(original.crop((x, y, x + fw, y + fh)).transpose(Image.Transpose.FLIP_LEFT_RIGHT), (x, y))
    fd, tmp = tempfile.mkstemp(prefix='.normalized-', suffix=source.suffix, dir=source.parent)
    os.close(fd)
    try:
        options = {'compress_level': 9} if fmt == 'PNG' else {'lossless': True, 'exact': True, 'method': 6}
        output.save(tmp, format=fmt, **options)
        with Image.open(tmp) as result:
            decoded = result.convert('RGBA')
            if decoded.size != original.size or decoded.tobytes() != output.tobytes():
                raise ValueError(f'Exact RGBA roundtrip failed: {old}')
        after = sha(tmp)
        addressed = bool(re.fullmatch(r'[0-9a-f]{64}', source.stem))
        target = source.with_name(after + source.suffix) if addressed else source
        if addressed and target.exists():
            if sha(target) != after:
                raise ValueError(f'Content-address collision: {target}')
            os.unlink(tmp)
        else:
            os.replace(tmp, target)
        if source_link is not None and sha(source.resolve() if addressed else source.parent / source_link) != before:
            raise ValueError(f'Original symlink target changed: {old}')
        return dict(oldImage=old, newImage=target.relative_to(ROOT).as_posix(),
                    beforeSha256=before, afterSha256=after, frameWidth=fw,
                    frameHeight=fh, columns=columns, frameCount=item['frameCount'],
                    width=original.width, height=original.height, kind=item['kind'],
                    aliasOf=item.get('aliasOf'), contentAddressed=addressed,
                    verification={'exactRgbaPerCellMirror': True, 'alphaExact': True,
                                  'dimensionsUnchanged': True, 'frameOrderUnchanged': True,
                                  'originalSymlinkTargetUnchanged': source_link is not None})
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--include-scene-layers', action='store_true')
    parser.add_argument('--include-exact-aliases', action='store_true')
    args = parser.parse_args()
    plan_bytes = args.plan.read_bytes()
    plan_sha = hashlib.sha256(plan_bytes).hexdigest()
    settings = dict(includeSceneLayers=args.include_scene_layers, includeExactAliases=args.include_exact_aliases)
    report = {'version': 1, 'planSha256': plan_sha, 'settings': settings,
              'status': 'in_progress', 'changes': {}}
    if REPORT.exists():
        report = json.loads(REPORT.read_text())
        if report['planSha256'] != plan_sha or report['settings'] != settings:
            raise ValueError('Existing journal belongs to another plan/settings; do not overwrite it')
    plan = json.loads(plan_bytes)
    done = report['changes']
    for old, entry in done.items():
        if sha(local(entry['newImage'])) != entry['afterSha256']:
            raise ValueError(f'Completed output changed: {old}')
    # Resume selects only remaining explicit inputs; alias discovery on resume
    # uses saved preflight selection, so completed inputs cannot redefine aliases.
    if 'selection' in report:
        selected = report['selection']
    else:
        selected = collect(plan, args.include_scene_layers, args.include_exact_aliases)
        report['selection'] = selected
    print(json.dumps({'selected': len(selected), 'completed': len(done), 'apply': args.apply}), flush=True)
    if not args.apply:
        return
    atomic_json(report)
    for name, item in selected.items():
        if name in done:
            continue
        done[name] = flip(item)
        atomic_json(report)
        print(json.dumps({'completed': len(done), 'total': len(selected), 'image': name}), flush=True)
    report['status'] = 'completed'
    atomic_json(report)


if __name__ == '__main__':
    main()
