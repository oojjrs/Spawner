#!/usr/bin/env python3
"""Read-only validation of the antenna publications selected for integration."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('registration', ROOT / 'scripts/register-antenna-combos.py')
registration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registration)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--complete', action='store_true')
    parser.add_argument('--layers-only', action='store_true', help='Validate opt-in scene layer sources without re-decoding unchanged legacy atlases')
    args = parser.parse_args()
    paths = json.loads(registration.INDEX.read_text())
    seen = set()
    count = 0
    layered = 0
    for relative in paths:
        path = ROOT / relative
        manifest = json.loads(path.read_text())
        key = manifest['tribe'] + '/' + manifest['form']
        assert manifest['tribe'] in registration.TRIBES and manifest['form'] in registration.FORMS and key not in seen, key
        seen.add(key)
        original = manifest['sourceAppearance']
        appearance = ROOT / original if original.startswith(('AnimationCandidates/', 'DesignAssets/')) else path.parent / original
        assert appearance.resolve().is_relative_to(ROOT), appearance
        assert registration.sha(appearance) == manifest['sourceAppearanceSHA256'], (key, 'appearance hash')
        mask = registration.FORMS[manifest['form']]
        expected = {'idle', 'walk', 'hurt', 'birth', 'death'} | ({'attack'} if mask & 1 else set()) | ({'ranged'} if mask & 16 else set())
        actions = {('ranged' if name == 'ranged-attack' else name): record for name, record in manifest['actions'].items()}
        assert set(actions) == expected, key
        for action, record in actions.items():
            if record.get('sceneLayers') is not None:
                layered += 1
            if args.layers_only:
                if record.get('sceneLayers') is not None:
                    registration.scene_layers(path, record)
                count += 1
                continue
            sheet = registration.source_path(path, record['sheet'])
            assert registration.sha(sheet) == record['sheetSHA256'], (key, action, 'sheet hash')
            assert isinstance(record.get('loop'), bool), (key, action, 'source loop metadata')
            assert record.get('projectileIncluded') is not True and manifest.get('projectileBakedIntoBodySheet') is not True, (key, action, 'body-only sheet')
            size = record.get('frameSize', manifest.get('frameSize'))
            width, height = (size, size) if isinstance(size, int) else size
            height = record.get('frameHeight', height)
            columns = record.get('columns', manifest.get('columns'))
            frames = record.get('frameCount', record.get('frames'))
            assert len(record['durationsMs']) == frames and sum(record['durationsMs']) == record['durationMs'], (key, action, 'clock')
            with Image.open(sheet) as image:
                assert image.mode == 'RGBA', (key, action, 'transparent RGBA source required')
                assert image.size == (columns * width, ((frames + columns - 1) // columns) * height), (key, action, 'sheet shape')
                sheet_alpha = image.getchannel('A')
                for index in range(frames):
                    x, y = index % columns * width, index // columns * height
                    alpha = sheet_alpha.crop((x, y, x + width, y + height))
                    assert alpha.getbbox(), (key, action, index, 'empty authored frame')
                    edges = [(0, 0, width, 1), (0, height - 1, width, height), (0, 0, 1, height), (width - 1, 0, width, height)]
                    assert max(alpha.crop(edge).getextrema()[1] for edge in edges) < 16, (key, action, index, 'opaque clipping at cell edge')
            preview = registration.source_path(path, record['preview'])
            assert registration.sha(preview) == record['previewSHA256'], (key, action, 'preview hash')
            with Image.open(preview) as image:
                assert getattr(image, 'n_frames', 1) > 1, (key, action, 'static preview')
                assert image.info.get('loop') == 0, (key, action, 'preview must replay')
                actual_duration = 0
                for frame in range(image.n_frames):
                    image.seek(frame); image.load()
                    actual_duration += image.info.get('duration', 0)
                expected_duration = record.get('previewDurationMs', sum(record.get('previewDurationsMs', record['durationsMs'])))
                assert actual_duration == expected_duration, (key, action, 'preview clock', actual_duration, expected_duration)
            count += 1
            if record.get('sceneLayers') is not None:
                registration.scene_layers(path, record)
    if args.complete:
        assert len(seen) == 28 and count == 172, (len(seen), count)
    if args.layers_only:
        print(f'Validated {len(seen)}/28 publication identities and {layered} layered source records; unchanged clip pixels/previews not re-decoded')
    else:
        print(f'Validated {len(seen)}/28 forms, {count}/172 transparent clips and looping previews; {layered} layered sources')


if __name__ == '__main__':
    main()
