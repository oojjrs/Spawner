#!/usr/bin/env python3
"""Publish only reviewed antenna forms into the existing design table."""
from pathlib import Path
import argparse
import html
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'AnimationCandidates/antenna-combinations-v1-20261107/publications.json'
DOC = ROOT / 'DesignAssets/sections/unit-appearance.js'
TRIBES = {'bean': '새싹콩', 'spore': '포자버섯', 'pebble': '몽돌', 'spring': '샘방울'}
FORMS = {'blade-antenna': '칼날+안테나', 'secretion-antenna': '분비+안테나', 'carapace-antenna': '갑각+안테나',
         'blade-secretion-antenna': '칼날+분비+안테나', 'blade-carapace-antenna': '칼날+갑각+안테나',
         'secretion-carapace-antenna': '분비+갑각+안테나', 'blade-secretion-carapace-antenna': '칼날+분비+갑각+안테나'}
LABELS = {'base': '원화', 'idle': '대기', 'walk': '이동', 'attack': '근접 공격', 'ranged-attack': '원거리 공격',
          'hurt': '피격', 'birth': '탄생 전체 장면', 'death': '사망', 'harvest': '채집', 'carry': '운반', 'throw': '투척'}


def path_for(manifest_path, value):
    path = ROOT / value if value.startswith(('AnimationCandidates/', 'DesignAssets/')) else manifest_path.parent / value
    assert path.is_file(), path
    return path.relative_to(ROOT).as_posix()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime-complete', action='store_true')
    args = parser.parse_args()
    records = {}
    for relative in json.loads(INDEX.read_text()):
        path = ROOT / relative
        manifest = json.loads(path.read_text())
        tribe, form = manifest['tribe'], manifest['form']
        assert tribe in TRIBES and form in FORMS and (tribe, form) not in records
        records[(tribe, form)] = (path, manifest)
    if args.runtime_complete:
        assert len(records) == 28
    source = ''.join(json.loads(line.strip().removesuffix('+').strip()) for line in DOC.read_text().splitlines() if line.lstrip().startswith('"'))
    for form in FORMS:
        source = re.sub(r'<tbody[^>]*data-appearance-gene="' + form + r'"[^>]*>[\s\S]*?</tbody>\n', '', source)
    source = re.sub(r'<p class="antenna-combo-publication-note">[\s\S]*?</p>\n?', '', source)
    blocks = []
    for form, label in FORMS.items():
        published = [tribe for tribe in TRIBES if (tribe, form) in records]
        if not published:
            continue
        rows = []
        for index, tribe in enumerate(published):
            path, manifest = records[(tribe, form)]
            actions = {('ranged-attack' if action == 'ranged' else action): record for action, record in manifest['actions'].items()}
            expected = {'idle', 'walk', 'hurt', 'birth', 'death'} | ({'attack'} if 'blade' in form else set()) | ({'ranged-attack'} if 'secretion' in form else set())
            assert set(actions) == expected, (path, set(actions), expected)
            heading = f'<th scope="rowgroup" rowspan="{len(published)}" class="appearance-dna">{label}</th>' if index == 0 else ''
            cells = []
            for action, action_label in LABELS.items():
                title = f'{TRIBES[tribe]} {label} · {action_label}'
                work = action in ('harvest', 'carry', 'throw')
                source_action = ('walk' if action == 'carry' else 'attack' if 'attack' in actions else 'ranged-attack' if 'ranged-attack' in actions else 'walk') if work else action
                if action == 'base':
                    original = path_for(path, manifest['sourceAppearance'])
                    preview = original
                    attributes = ''
                elif source_action in actions:
                    record = actions[source_action]
                    original, preview = path_for(path, record['sheet']), path_for(path, record['preview'])
                    attributes = ' data-durations="' + ','.join(str(ms) for ms in record.get('previewDurationsMs', record['durationsMs'])) + '" data-loop="true"'
                else:
                    cells.append(f'<td data-action="{action}" title="{label}은 {action_label}을 사용하지 않음"></td>')
                    continue
                figure = f' data-work-action="{action}" data-work-source="{source_action}" data-work-tribe="{tribe}"' if work else ''
                e = lambda value: html.escape(value, quote=True)
                cells.append(f'<td data-action="{action}"><figure{figure} class="attribute-unit"><div class="attribute-unit-images"><a class="attribute-unit-full"{attributes} data-action="{source_action}" title="{e(title)}" data-preview="{e(preview)}" href="{e(original)}"><img alt="{e(title)}" width="144" height="144" loading="lazy" data-original-src="{e(preview)}" data-src="{e(preview)}" decoding="async"></a></div></figure></td>')
            rows.append(f'<tr id="unit-{tribe}-{form}">{heading}<th scope="row">{TRIBES[tribe]}</th>{"".join(cells)}</tr>')
        blocks.append(f'<tbody id="attribute-{form}" data-appearance-gene="{form}">\n' + '\n'.join(rows) + '\n</tbody>\n')
    antenna = re.search(r'<tbody[^>]*data-appearance-gene="antenna"[^>]*>[\s\S]*?</tbody>\n', source)
    assert antenna, 'existing antenna section is required'
    source = source[:antenna.end()] + ''.join(blocks) + source[antenna.end():]
    if args.runtime_complete:
        note = '칼날·분비·갑각의 기존 네 조합과 안테나를 더한 일곱 조합을 네 종족에 적용한다. 총 44개 복합 외형·276개 기본 동작을 게임·전투 실험실·웰컴 헤더와 공유한다. 채집형 조합은 제외하며 기존 안테나 단독은 유지한다. 근접은 칼날, 원거리는 분비가 있는 조합만 사용한다. 채집·투척은 근접 공격 본체, 원거리 공격 본체, 이동 순으로 재사용하며 운반은 이동을 사용한다. 작업 동작은 전투 피해나 탄환을 만들지 않는다.'
        source = re.sub(r'<p class="appearance-runtime-note">[\s\S]*?</p>', f'<p class="appearance-runtime-note">{note}</p>', source)
    elif records:
        note = f'안테나 복합 외형 {len(records)}/28개 제작 완료. 아래 표는 완성된 원본 미리보기이며 게임·전투 실험실·웰컴 통합은 별도 검증 후 반영한다.'
        source = source.replace('<div class="table-wrap"><table class="appearance-table">', f'<p class="antenna-combo-publication-note">{note}</p>\n<div class="table-wrap"><table class="appearance-table">', 1)
    DOC.write_text('document.write(\n' + ' +\n'.join(json.dumps(line, ensure_ascii=False) for line in source.splitlines(keepends=True)) + '\n);\n')
    print(f'Published {len(records)}/28 antenna rows and {len(records)*3}/84 work cells')
    # Later attack-only publications must survive a rebuild of these rows.
    defensive_index = ROOT / 'AnimationCandidates/defensive-attacks-v1-20261107/publications.json'
    if defensive_index.is_file() and json.loads(defensive_index.read_text()):
        command = [sys.executable, str(ROOT / 'scripts/publish-defensive-attack-docs.py')]
        if args.runtime_complete and len(json.loads(defensive_index.read_text())) == 12:
            command.append('--runtime-complete')
        subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
