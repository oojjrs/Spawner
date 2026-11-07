#!/usr/bin/env python3
"""Publish the reviewed intact-body base birth without reviving removed part rigs."""
from pathlib import Path
import hashlib, html, json, math, re, shutil
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'AnimationCandidates/bean-base-birth-fullbody-v1-20261107/publication-manifest.json'

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    publication = json.loads(SOURCE.read_text())
    assert (publication['tribe'], publication['form']) == ('bean', 'base')
    record = publication['actions']['birth']
    assert record['frameCount'] == len(record['durationsMs']) == 116
    assert sum(record['durationsMs']) == record['durationMs'] == 3850
    assert record['fullScene'] and record['worldTravelIncludedInPixels']
    assert record['sourceFacing'] == 'right'
    policy_path = ROOT / 'DesignAssets/image-sizes.json'
    policy = json.loads(policy_path.read_text())
    def publish(source, sha, width, height, columns, count):
        assert source.is_file() and digest(source) == sha, source
        rows = math.ceil(count / columns)
        with Image.open(source) as image:
            assert image.mode == 'RGBA' and image.size == (width * columns, height * rows), source
        dest = ROOT / 'DesignAssets/Animations/BirthSceneLayersV1' / (sha + '.png')
        if not dest.exists(): shutil.copyfile(source, dest)
        assert digest(dest) == sha
        policy['images'][dest.relative_to(ROOT).as_posix()] = {
            'display': [256, round(256 * height / width, 6)], 'grid': [columns, rows],
            'nativeSource': {'sha256': sha, 'dimensions': [width * columns, height * rows], 'frame': [width, height]}}
        return dest.relative_to(ROOT).as_posix()
    keys = ('frameSize','frameHeight','columns','frameCount','durationsMs','durationMs','loop',
            'pivotX','pivotY','referenceLength','viewSize','registrationScale','sourceFacing',
            'fullScene','worldTravelIncludedInPixels','sceneIncludesNest','sceneAnchor')
    clip = {key: record[key] for key in keys}
    clip['image'] = publish(ROOT / record['sheet'], record['sheetSHA256'], 512, 512, 8, 116)
    layers = []
    assert [layer['role'] for layer in record['sceneLayers']['layers']] == ['environment', 'body']
    for original in record['sceneLayers']['layers']:
        layer = {key: value for key, value in original.items() if key != 'sha256'}
        assert (layer.get('wholeBody') is True) == (layer['role'] == 'body')
        assert len(layer['samples']) == 116
        for sample in layer['samples']:
            if sample is None: continue
            assert 0 <= sample['frame'] < layer['frameCount']
            assert len(sample['destination']) == 4 and all(math.isfinite(v) for v in sample['destination'])
            assert sample['destination'][2] > 0 and sample['destination'][3] > 0
        layer['image'] = publish(ROOT / original['image'], original['sha256'], layer['frameSize'],
                                 layer['frameHeight'], layer['columns'], layer['frameCount'])
        layers.append(layer)
    clip['sceneLayers'] = {'version': 1, 'layers': layers}
    registry = ROOT / 'client/unit-birth-art-assets.mjs'
    source = registry.read_text()
    catalog = json.loads(source[source.index('{'):source.rindex('});') + 1])
    catalog['bean/base'] = clip
    registry.write_text('export const UNIT_BIRTH_ART = Object.freeze(' + json.dumps(catalog, indent=2, ensure_ascii=False) + ');\n\n' +
        'export const UNIT_BIRTH_ART_ASSETS = Object.freeze([...new Set(Object.values(UNIT_BIRTH_ART).flatMap(clip =>\n' +
        '  [clip.image, ...(clip.sceneLayers?.layers || []).map(layer => layer.image)]))]);\n')
    policy_path.write_text(json.dumps(policy, indent=2, ensure_ascii=False) + '\n')
    doc = ROOT / 'DesignAssets/sections/unit-appearance.js'
    text = doc.read_text()
    source = ''.join(json.loads(line.rstrip(' +')) for line in text.splitlines() if line.startswith('"'))
    row = re.search(r'<tr id="unit-sprout-bean">[\s\S]*?</tr>', source)
    assert row
    payload = {key: clip[key] for key in ('frameSize','frameHeight','durationsMs','sourceFacing','sceneLayers')}
    payload['loop'] = True
    attrs = html.escape(json.dumps(payload, separators=(',', ':')), quote=True)
    preview, sheet = record['preview'], record['sheet']
    title = '새싹콩 기본형 · 씨앗부터 착지까지 전신 탄생'
    cell = f'<td data-action="birth"><figure class="attribute-unit"><div class="attribute-unit-images"><a class="attribute-unit-full" data-action="birth" title="{title}" data-birth-scene="{attrs}" data-preview="{preview}" href="{sheet}"><img alt="{title}" width="144" height="144" loading="lazy" data-original-src="{preview}" data-src="{preview}" decoding="async"></a></div></figure></td>'
    updated, count = re.subn(r'<td data-action="birth">[\s\S]*?</td>', lambda _: cell, row.group())
    assert count == 1
    source = source[:row.start()] + updated + source[row.end():]
    doc.write_text('document.write(\n' + ' +\n'.join(json.dumps(line, ensure_ascii=False) for line in source.splitlines(keepends=True)) + '\n);\n')
    print('Registered bean/base birth: 116 samples, 3850 ms, one complete body and shared environment.')
if __name__ == '__main__': main()
