#!/usr/bin/env python3
"""Validate and register finalized whole-body defensive attacks only."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'AnimationCandidates/defensive-attacks-v1-20261107/publications.json'
FORMS = {'carapace': 2, 'antenna': 4, 'carapace-antenna': 6}
TRIBES = ('bean', 'spore', 'pebble', 'spring')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source(path, value):
    target = ROOT / value if value.startswith(('AnimationCandidates/', 'DesignAssets/')) else path.parent / value
    assert target.resolve().is_relative_to(ROOT), target
    assert target.is_file(), target
    return target


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--complete', action='store_true')
    args = parser.parse_args()
    definitions = {}
    policy_path = ROOT / 'DesignAssets/image-sizes.json'
    policy = json.loads(policy_path.read_text())
    for relative in json.loads(INDEX.read_text()):
        path = ROOT / relative
        manifest = json.loads(path.read_text())
        tribe, form = manifest['tribe'], manifest['form']
        key = f'{tribe}/{form}'
        assert tribe in TRIBES and form in FORMS and key not in definitions, key
        assert set(manifest['actions']) == {'attack'}, (key, 'attack only')
        assert sha(source(path, manifest['sourceAppearance'])) == manifest['sourceAppearanceSHA256'], (key, 'neutral source')
        if manifest.get('sourceBaseAttackSHA256'):
            assert sha(source(path, manifest['sourceBaseAttack'])) == manifest['sourceBaseAttackSHA256'], (key, 'base reference')
        record = manifest['actions']['attack']
        sheet = source(path, record['sheet'])
        assert sheet.suffix == '.png' and sha(sheet) == record['sheetSHA256'], (key, 'native PNG')
        assert not record.get('rangedBody') and not manifest.get('projectileBakedIntoBodySheet'), key
        size = record.get('frameSize', manifest.get('frameSize'))
        width, height = (size, size) if isinstance(size, int) else size
        height = record.get('frameHeight', height)
        columns, count = record['columns'], record['frameCount']
        durations = record['durationsMs']
        assert count > 1 and len(durations) == count and all(isinstance(ms, (int, float)) and ms > 0 for ms in durations), key
        assert sum(durations) == record['durationMs'], (key, 'clock')
        hit = record['hitTimeMs']
        starts = [sum(durations[:index]) for index in range(count)]
        assert hit in starts and 0 < hit < sum(durations), (key, 'hit clock')
        if 'hitFrameIndex' in record:
            assert starts[record['hitFrameIndex']] == hit, (key, 'hit frame')
        px, py, length = (record[name] for name in ('pivotX', 'pivotY', 'referenceLength'))
        assert all(math.isfinite(value) for value in (px, py, length)) and 0 <= px <= width and 0 <= py <= height and length > 0, key
        facing = {-1: 'left', 1: 'right'}.get(record.get('sourceFacing'), record.get('sourceFacing'))
        assert facing in ('left', 'right'), key
        rows = math.ceil(count / columns)
        with Image.open(sheet) as image:
            assert image.mode == 'RGBA' and image.size == (width * columns, height * rows), (key, 'geometry')
            alpha = image.getchannel('A')
            for index in range(count):
                x, y = index % columns * width, index // columns * height
                cell = alpha.crop((x, y, x + width, y + height))
                assert cell.getbbox(), (key, index, 'empty frame')
                edges = [(0, 0, width, 1), (0, height - 1, width, height), (0, 0, 1, height), (width - 1, 0, width, height)]
                assert max(cell.crop(edge).getextrema()[1] for edge in edges) < 16, (key, index, 'clipping')
        preview = source(path, record['preview'])
        assert sha(preview) == record['previewSHA256'], (key, 'preview hash')
        with Image.open(preview) as image:
            assert image.n_frames > 1 and image.info.get('loop') == 0, (key, 'looping preview')
            elapsed = 0
            for frame in range(image.n_frames):
                image.seek(frame); image.load(); elapsed += image.info.get('duration', 0)
            assert elapsed == record.get('previewDurationMs', sum(record.get('previewDurationsMs', durations))), (key, 'preview clock')
        dest = ROOT / 'DesignAssets/Animations/DefensiveAttackV1' / tribe / form / 'attack.png'
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(sheet, dest)
        image_path = dest.relative_to(ROOT).as_posix()
        policy['images'][image_path] = {'display': [256, round(256 * height / width, 6)], 'grid': [columns, rows],
            'nativeSource': {'sha256': sha(dest), 'dimensions': [width * columns, height * rows], 'frame': [width, height]}}
        definitions[key] = {'image': image_path, 'sourceManifest': relative, 'sourceFacing': facing,
            'frameSize': width, 'frameHeight': height, 'columns': columns, 'frameCount': count,
            'durationsMs': durations, 'durationMs': sum(durations), 'pivotX': px, 'pivotY': py,
            'referenceLength': length, 'viewSize': length, 'registrationScale': 1, 'loop': False,
            'hitTimeMs': hit, 'defensiveRetaliation': True}
    if args.complete:
        assert len(definitions) == 12, (len(definitions), 'all four tribes and three forms required')
    text = '// Generated by scripts/register-defensive-attacks.py. Whole-body attacks only.\n'
    text += 'export const DEFENSIVE_ATTACK_ART = Object.freeze(' + json.dumps(dict(sorted(definitions.items())), indent=2) + ');\n'
    text += '\nexport const DEFENSIVE_ATTACK_IMAGE_ASSETS = Object.freeze([...new Set(Object.values(DEFENSIVE_ATTACK_ART).map(clip => clip.image))]);\n'
    (ROOT / 'client/defensive-attack-assets.mjs').write_text(text)
    policy_path.write_text(json.dumps(policy, indent=2) + '\n')
    print(f'Validated and registered {len(definitions)}/12 defensive whole-body attacks')


if __name__ == '__main__':
    main()
