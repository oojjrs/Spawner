# 새싹콩 화면 기준 방향 검수 반영

## 반영 범위

사용자가 비교표의 단순 반전 쪽을 선택한 새싹콩 `blade-carapace`, `blade-secretion-carapace-antenna` 두 형태만 이번 원본 반전에 포함한다. 화면을 보는 사람 기준으로 판단하며, 무기 타격 벡터만으로 보는 방향을 정하지 않는다.

- 원본/소스 별칭 53개: 셀별 RGBA 반전, 투명도·격자·프레임 순서 유지.
- 애니메이션 미리보기 28개: 보이는 RGBA·투명도·프레임 수·시간·반복 보존.
- 선택 두 형태의 pivot, 탄생 layer destination, 공유 layer 참조, source hash 및 실제 기획서 표시 동기화.
- 공유 탄생 layer 원본은 보존하고 내용 주소 경로로 선택 형태만 참조.
- 원본 좌향 등록 및 기존 인게임 목표 방향 전환 로직은 유지.
- 나머지 42개 복합 형태의 등록값은 이번 반전 직전과 동일하다. 이것은 모든 원본이 시각적으로 정상이라는 판정은 아니다.

## 검증

- `node client/build.mjs --preserve-design` 및 `node client/build-combat.mjs` 완료.
- 생성 번들은 네 art module만 기존 워킹트리와 HEAD에 각각 병합하여 사용자 미완성 변경을 보존했다.
- 관련 8개 테스트 파일 70/70 통과, skip 0: screen-left review, confirmed-combo, unit-preview, unit-facing, combat-stage, combat-corpse, dominant-corpse, antenna-combo-integration.
- native metadata/752 draw/264 held draw 등 별도 fast 5개 통과.
- source/preview 최종 SHA와 보호된 shared source SHA 확인.
- 이번 픽셀 변환 자체는 모든 원본·preview에 대해 전후 셀별 검증했다. 별도 과거 전체 native heavy pixel 테스트는 SIGKILL로 끝나 완료하지 못했으며 전체 프로젝트 테스트 통과를 의미하지 않는다.
- 실제 Chromium 화면 검증은 실행 환경의 process_singleton socket 제한으로 시작되지 않았다. 기획서 DOM/등록/실제 이미지 및 컴파일 렌더 경로를 검사했다.

## 후속 전수검수

나머지 복합의 정면/혼합 단서는 임의로 반전하지 않는다. 몽돌 `blade-antenna`의 대기/걷기는 화면 오른쪽으로 얼굴이 열리는 추가 명확 후보로 확인했으며 별도 다음 수정 대상으로 진행한다.
