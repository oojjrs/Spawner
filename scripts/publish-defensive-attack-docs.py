#!/usr/bin/env python3
"""Fill the twelve existing defensive attack cells without replacing other art."""
from pathlib import Path
import argparse
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'AnimationCandidates/defensive-attacks-v1-20261107/publications.json'
DOC = ROOT / 'DesignAssets/sections/unit-appearance.js'
TRIBES = {'bean': '새싹콩', 'spore': '포자버섯', 'pebble': '몽돌', 'spring': '샘방울'}
FORMS = {'carapace': '갑각', 'antenna': '안테나', 'carapace-antenna': '갑각+안테나'}


def path_for(path, value):
    result = ROOT / value if value.startswith(('AnimationCandidates/', 'DesignAssets/')) else path.parent / value
    assert result.is_file(), result
    return result.relative_to(ROOT).as_posix()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime-complete', action='store_true')
    args = parser.parse_args()
    records = {}
    for relative in json.loads(INDEX.read_text()):
        path = ROOT / relative
        manifest = json.loads(path.read_text())
        key = manifest['tribe'], manifest['form']
        assert key[0] in TRIBES and key[1] in FORMS and key not in records
        assert set(manifest['actions']) == {'attack'}
        records[key] = path, manifest['actions']['attack']
    if args.runtime_complete:
        assert len(records) == 12
    source = ''.join(json.loads(line.strip().removesuffix('+').strip()) for line in DOC.read_text().splitlines() if line.lstrip().startswith('"'))
    for form, label in FORMS.items():
        pattern = r'(<tbody[^>]*data-appearance-gene="' + form + r'"[^>]*>)([\s\S]*?)(</tbody>)'
        match = re.search(pattern, source)
        assert match, form
        rows = re.findall(r'<tr\b[^>]*>[\s\S]*?</tr>', match[2])
        assert len(rows) == 4, form
        updated = match[2]
        for (tribe, name), row in zip(TRIBES.items(), rows):
            assert re.search(r'<th\b[^>]*scope="row"[^>]*>' + name + r'</th>', row), (tribe, form)
            if (tribe, form) not in records:
                continue
            path, clip = records[tribe, form]
            original, preview = path_for(path, clip['sheet']), path_for(path, clip['preview'])
            durations = ','.join(str(ms) for ms in clip.get('previewDurationsMs', clip['durationsMs']))
            replacement = row
            for action in (['attack', 'harvest', 'throw'] if form == 'carapace-antenna' else ['attack']):
                action_label = {'attack': '공격', 'harvest': '채집', 'throw': '투척'}[action]
                title = f'{name} {label} · {action_label}'
                work = f' data-work-action="{action}" data-work-source="attack" data-work-tribe="{tribe}"' if action != 'attack' else ''
                e = lambda value: html.escape(value, quote=True)
                cell = f'<td data-action="{action}"><figure{work} class="attribute-unit"><div class="attribute-unit-images"><a class="attribute-unit-full" data-durations="{durations}" data-loop="true" data-action="attack" title="{e(title)}" data-preview="{e(preview)}" href="{e(original)}"><img alt="{e(title)}" width="144" height="144" loading="lazy" data-original-src="{e(preview)}" data-src="{e(preview)}" decoding="async"></a></div></figure></td>'
                replacement, count = re.subn(r'<td\b[^>]*data-action="' + action + r'"[^>]*>[\s\S]*?</td>', lambda _: cell, replacement)
                assert count == 1, (tribe, form, action, count)
            updated = updated.replace(row, replacement)
        source = source[:match.start()] + match[1] + updated + match[3] + source[match.end():]
    source = re.sub(r'<p class="defensive-attack-publication-note">[\s\S]*?</p>\n?', '', source)
    if args.runtime_complete:
        note = '칼날·분비·갑각의 기존 네 조합과 안테나를 더한 일곱 조합을 네 종족에 적용한다. 총 44개 복합 외형·280개 기본 동작을 게임·전투 실험실·웰컴 헤더와 공유한다. 채집형 조합은 제외하며 기존 안테나 단독 동작을 유지한다. 갑각 단독·안테나 단독·갑각+안테나의 12개 공격 애니는 기존 공격 칸을 사용하며 피격 후 방어전에 재생한다. 플레이어블 기본 공격력은 1이며, 공격기관 없는 유닛은 선제공격하지 않는다. 군사기관 공격 수치는 그대로 유지하고 원거리는 분비가 있을 때만 사용한다. 복합 외형의 채집·투척은 근접 공격 본체, 원거리 공격 본체, 이동 순으로 재사용하며 운반은 이동을 사용한다. 작업 동작은 전투 피해나 탄환을 만들지 않는다.'
        source = re.sub(r'<p class="appearance-runtime-note">[\s\S]*?</p>', lambda _: f'<p class="appearance-runtime-note">{note}</p>', source)
    elif records:
        note = f'갑각·안테나 외형 공격 애니 {len(records)}/12개 제작 완료. 아래 표는 완성된 원본 미리보기이며 실제 방어전 규칙과 게임 통합은 별도 검증 후 반영한다.'
        source = source.replace('<div class="table-wrap"><table class="appearance-table">', f'<p class="defensive-attack-publication-note">{note}</p>\n<div class="table-wrap"><table class="appearance-table">', 1)
    DOC.write_text('document.write(\n' + ' +\n'.join(json.dumps(line, ensure_ascii=False) for line in source.splitlines(keepends=True)) + '\n);\n')
    print(f'Published {len(records)}/12 defensive attack cells')


if __name__ == '__main__':
    main()
