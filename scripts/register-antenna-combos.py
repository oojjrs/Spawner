#!/usr/bin/env python3
"""Register reviewed antenna combinations without changing their source pixels.

Only manifests explicitly listed in publications.json are eligible. Missing or
incomplete publications fail closed; --complete requires all 28 forms/172 clips.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'AnimationCandidates/antenna-combinations-v1-20261107/publications.json'
FORMS = {'blade-antenna': 5, 'secretion-antenna': 20, 'carapace-antenna': 6,
         'blade-secretion-antenna': 21, 'blade-carapace-antenna': 7,
         'secretion-carapace-antenna': 22, 'blade-secretion-carapace-antenna': 23}
TRIBES = ('bean', 'spore', 'pebble', 'spring')
PREFIX = 'DesignAssets/Animations/AntennaCombosV1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_path(path, value):
    source = ROOT / value if value.startswith('AnimationCandidates/') else path.parent / value
    assert source.resolve().is_relative_to(ROOT / 'AnimationCandidates'), source
    return source


def register_image(policy, path, width, height, columns, rows):
    policy['images'][path.relative_to(ROOT).as_posix()] = {
        'display': [256, round(256 * height / width, 6)], 'grid': [columns, rows],
        'nativeSource': {'sha256': sha(path), 'dimensions': list(Image.open(path).size), 'frame': [width, height]}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--complete', action='store_true')
    args = parser.parse_args()
    policy_path = ROOT / 'DesignAssets/image-sizes.json'
    policy = json.loads(policy_path.read_text())
    publications = json.loads(INDEX.read_text())
    definitions = {}
    for relative in publications:
        path = ROOT / relative
        assert path.resolve().is_relative_to(ROOT / 'AnimationCandidates'), path
        manifest = json.loads(path.read_text())
        tribe, form = manifest['tribe'], manifest['form']
        assert tribe in TRIBES and form in FORMS, (path, tribe, form)
        key, mask = f'{tribe}/{form}', FORMS[form]
        assert key not in definitions, (key, 'duplicate publication')
        expected = ['idle', 'walk'] + (['attack'] if mask & 1 else []) + (['ranged'] if mask & 16 else []) + ['hurt', 'birth', 'death']
        records = {('ranged' if name == 'ranged-attack' else name): record for name, record in manifest['actions'].items()}
        assert set(records) == set(expected), (path, set(records), set(expected))
        output = ROOT / PREFIX / tribe / form
        output.mkdir(parents=True, exist_ok=True)
        actions = {}
        for action in expected:
            record = records[action]
            source = source_path(path, record['sheet'])
            assert sha(source) == record['sheetSHA256'], (source, 'source SHA mismatch')
            size = record.get('frameSize', manifest.get('frameSize'))
            width, height = (size, size) if isinstance(size, int) else size
            height = record.get('frameHeight', height)
            columns = record.get('columns', manifest.get('columns'))
            count = record.get('frameCount', record.get('frames'))
            durations = record['durationsMs']
            assert isinstance(count, int) and count > 1 and columns > 0, (path, action)
            rows = math.ceil(count / columns)
            assert Image.open(source).size == (width * columns, height * rows), (source, 'atlas geometry')
            assert len(durations) == count and all(isinstance(ms, (int, float)) and ms > 0 for ms in durations), (path, action, 'clock')
            duration = sum(durations)
            assert record['durationMs'] == duration, (path, action, 'duration')
            px, py, length = (record[name] for name in ('pivotX', 'pivotY', 'referenceLength'))
            assert all(math.isfinite(value) for value in (px, py, length)), (path, action, 'registration')
            assert 0 <= px <= width and 0 <= py <= height and length > 0, (path, action, px, py, length)
            dest = output / f'{action}.png'
            assert source.suffix.lower() == '.png', (source, 'use lossless PNG source atlas')
            shutil.copyfile(source, dest)
            clip = {'image': dest.relative_to(ROOT).as_posix(), 'sourceFacing': {-1: 'left', 1: 'right'}.get(record.get('sourceFacing'), record.get('sourceFacing', 'right')),
                    'frameSize': width, 'frameHeight': height, 'columns': columns, 'frameCount': count,
                    'durationsMs': durations, 'durationMs': duration, 'pivotX': px, 'pivotY': py,
                    'referenceLength': length, 'viewSize': length, 'registrationScale': 1, 'loop': action in ('idle', 'walk')}
            assert clip['sourceFacing'] in ('left', 'right'), (path, action, 'source facing')
            starts = [sum(durations[:index]) for index in range(count)]
            if action == 'attack':
                hit = record['hitTimeMs']
                assert hit in starts and 0 < hit < duration, (path, action, 'melee contact')
                clip['hitTimeMs'] = hit
            if action == 'ranged':
                launch = record['launchAtMs']
                assert launch in starts and 0 < launch < duration, (path, action, 'release cue')
                clip.update(rangedBody=True, launchAtMs=launch)
            if action == 'birth':
                assert record.get('fullScene') is True, (path, 'birth must be complete scene')
                clip.update(fullScene=True, worldTravelIncludedInPixels=True, sceneIncludesNest=True, sceneAnchor='final-body-floor')
            actions[action] = clip
            register_image(policy, dest, width, height, columns, rows)
            if action == 'idle':
                portrait = output / 'portrait.png'
                with Image.open(source) as image:
                    first = image.crop((0, 0, width, height))
                    first.save(portrait)
                    assert Image.open(portrait).tobytes() == first.tobytes()
                register_image(policy, portrait, width, height, 1, 1)
        definitions[key] = {'mask': mask, 'sourceManifest': relative, 'portrait': portrait.relative_to(ROOT).as_posix(),
                            'reference': actions['idle'], 'actions': actions}
    definitions = dict(sorted(definitions.items()))
    count = sum(len(definition['actions']) for definition in definitions.values())
    if args.complete:
        assert len(definitions) == 28 and count == 172, (len(definitions), count)
    header = '// Generated by scripts/register-antenna-combos.py. Source atlases are byte-exact.\n'
    text = header + 'export const ANTENNA_COMBO_ACTION_ART = Object.freeze(' + json.dumps(definitions, indent=2) + ');\n'
    text += '\nexport const ANTENNA_COMBO_IMAGE_ASSETS = Object.freeze([...new Set(Object.values(ANTENNA_COMBO_ACTION_ART).flatMap(definition => [definition.portrait, ...Object.values(definition.actions).map(action => action.image)]))]);\n'
    (ROOT / 'client/antenna-combo-assets.mjs').write_text(text)
    policy_path.write_text(json.dumps(policy, indent=2) + '\n')
    print(f'Registered {len(definitions)}/28 antenna forms, {count}/172 clips')


if __name__ == '__main__':
    main()
