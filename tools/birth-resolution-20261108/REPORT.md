# 네 종족 탄생 해상도 복구

2026-11-08, 단일 `Spawner/main` 작업 폴더. 새 체크아웃·브랜치 없이 기존 변경을 보존했다. 이 보고서는 탄생 해상도 작업의 검증 시점이며, 후속 좌향 원본 정규화 뒤에는 해당 기대값과 결과를 다시 검증해야 한다.

## 원인과 수정

큰 장면 캔버스 안에서 몸이 먼저 약 31~115픽셀로 작아진 뒤 게임의 확대 배율과 DPR에 따라 재확대되었다. PNG의 전체 크기가 커도 실제 몸의 해상도는 낮았다. 몽돌 전용 경로는 작은 packed 장면에서 다시 scratch 표면을 만드는 단계도 있었다.

승인된 동일 전신 원본을 찾은 24형태는 몸을 장면에 미리 축소하지 않고 원본 전신 셀에서 최종 표시 크기로 직접 그리도록 바꿨다. 몸의 기관을 분리·재조합하지 않는다. 씨앗/둥지/연결 줄기는 기존 독립 장면 요소로 유지한다. 버섯 칼날·갑각은 기존 v9 전신에 기존 장면의 회전·착지 변환만 원본 밀도로 구웠다.

- 새싹콩 9: 채집, 칼날, 분비물, 갑각, 안테나 및 안테나 없는 복합 4형태.
- 버섯 8: 채집, 칼날, 분비물, 갑각 및 안테나 없는 복합 4형태.
- 몽돌 4: 채집, 칼날, 분비물, 갑각.
- 스프링 3: 칼날, 갑각, 분비물.

전체 68형태 분류는 `all-forms-audit.json`에 있다. 24개를 복구했고 19개는 이미 전신 원본 레이어였다. 나머지 25개는 동일 동작의 더 큰 승인 원본을 확정하지 못해 유지했다. 특히 기본 버섯·몽돌·스프링 등은 작은 원본 자체의 한계가 남는다. 단순 확대 이미지를 새 디테일로 주장하거나 다른 외형을 대체하지 않았다. 따라서 모든 탄생 원화가 새로 고해상도로 제작되었다는 의미는 아니다.

최종 전신의 실제 불투명 영역 예시:
- 새싹콩 채집: 기존 기준길이 31 → 원본 214×236.
- 버섯 채집: 45 → 426×314.
- 버섯 칼날: 62 → 367×227.
- 몽돌 채집: 64 → 243×162.
- 스프링 칼날: 115 → 327×302.
- 스프링 분비물: 65 → 298×363.

## 보존 범위와 메모리

기존 fallback 이미지, 표시 기준길이, pivot, 장면 좌표, sourceFacing, 프레임 수 및 모든 duration은 복구 직전과 같다. `registered-clips.json`이 검증 시점의 정확한 복구 등록이다. 방향 담당자의 후속 실제 원본 반전은 이와 별도 변경이다.

신규 29PNG는 공통 투명 여백만 자르고 완전히 같은 RGBA 셀을 중복 제거했다. 앞선 26PNG의 decoded 추정은 875.72→384.35MiB로 줄었다. 추가 버섯 3PNG 포함 최종 합계는 446.35MiB이며 모든 신규 텍스처의 최대 변은 3816이다. 원본 저해상도 장면은 실패 시에만 로드하므로 정상 레이어 로드에서 동시에 다운로드하지 않는다.

공통 crop과 중복 제거는 visible RGBA 813셀 및 1772샘플의 장면 배치를 보존했다. 추가 버섯 전신의 기존 회전 변환은 재샘플링을 포함하므로 source RGBA와 최종 화면의 완전한 바이트 동일을 주장하지 않는다. 기존 작은 래스터와 비교한 버섯 칼날/갑각의 alpha128 평균 IoU는 95.3/95.6%, 최소 86.9/86.5%, 최종은 97.2/99.2%였다. 작은 초기 포즈의 샘플링 경계가 주된 차이이며 실제 비교 이미지를 확인했다. 버섯 채집/분비물 최종 실루엣은 100%, 최소 96.7/95.7%였다.

## 검증

- 집중 테스트 45/45 통과: 새 자산 SHA·규격·등록, 모든 프레임·양 방향의 원본 crop/목적 좌표, 시계, 실패 fallback·재시도.
- 새싹콩 11복합의 3850ms 시계와 저해상도 실패 대체 경로 2/2 통과.
- 실제 `@napi-rs/canvas`에서 복구 24형태의 2100프레임 × 양 방향 = 4200회 렌더 통과. 확대 cell=288, DPR=2. 레이어 준비 완료, 기존 낮은 해상도 fallback 이미지 요청 0.
- 몽돌 실제 원본 4개에 대한 544회 전용 렌더 통과. scratch allocation/copy 0.
- 이미지 정책 감사 1494개 통과. 방향 담당 요청분의 보존 SHA도 함께 동기화했다.
- `git diff --check` 대상 파일 통과.
- 최초 넓은 탄생 회귀 기록: 129개 중 121통과, 8실패. 실패는 변경하지 않은 `bean-secretion-birth.test.mjs`, `combat-birth.test.mjs`, `spring-dominant-birth.test.mjs`의 이전 legacy 선택 기대값과 `unitFacing`/`drawAgentAppearanceBody` mock 누락 등이다. 관련 테스트와 구현 파일은 현재 HEAD와 동일함을 확인했다. 이는 수리 전 결과이며, 아래 후속 테스트 수리 후 관련 회귀는 모두 통과했다.

Chromium 실행은 앞서 sandbox socket 오류 뒤 승인 검토 상태 변경 오류로 실행되지 않았다. 로컬 실제 게임 브라우저·배포 후 확인은 아직 하지 않았다. Node Canvas 확인을 브라우저/라이브 게임 검증으로 부르지 않는다. 공용 runtime/wrapper 재빌드 및 게시도 통합 담당자가 처리해야 한다.

## 근거

- `before-bean-gather.png`, `after-bean-gather.png`: 동일 포즈·확대에서 저해상도 및 원본 직접 렌더 비교.
- `before-spore-gather.png`, `after-spore-gather.png`, `after-spore-blade.png`.
- `after-pebble-gather.png`, `after-spring-blade.png`.
- `native-timeline-final.txt`, `runtime-summary.json`: 4200회 실제 Canvas 결과.
- `focused-final.txt`, `bean-combo-final.txt`, `birth-regression-final.txt`, `image-audit-final.txt`.
- `bean-sources.json`, `spore-single-sources.json`, `spore-combo-sources.json`, `spore-combat-sources.json`, `native-pebble-spring.json`: 원본 경로·SHA·좌표 출처.
- `compact-proof-summary.json`: 무손실 crop/중복 제거 증거 요약과 상세 검증 기록의 SHA. 셀별 대량 검증 원본은 작업 컴퓨터에 보존하고 게시 목록에서는 제외했다.

수정 제품 파일: `unit-action-art.mjs`, `unit-birth-art-assets.mjs`, `pebble-packed-birth.mjs`, `image-sizes.json`, `BirthResolutionV1/` 29PNG. 테스트는 `birth-resolution.test.mjs`, `pebble-birth-resolution.test.mjs`를 추가하고 `unit-action-art-selection.test.mjs`, `bean-combo-birth-timing.test.mjs`의 실제 복구 클립 선택 기대값을 갱신했다. Git add/commit/push는 수행하지 않았다.

## 후속: 실패 테스트 수리

사용자의 실패 테스트 수정 요청에 따라 테스트를 삭제하거나 건너뛰지 않고 4개 테스트 파일만 고쳤다. 제품 구현은 변경하지 않았다.

- `client/bean-secretion-birth.test.mjs`: 단일 분비물과 별도 복합 외형을 구분하는 현재 선택 기준을 반영했다. 실제 `unitFacing` 의존성을 연결했다. 폐기된 파츠 콜백 횟수 대신 실제 `createUnitPresentation`의 장면 레이어·실패 대체·전신 1회 표시와 공통 앵커를 검증한다. 남아 있는 레거시 helper는 자신의 idle 등록과의 정합성을 계속 검사한다.
- `client/combat-birth.test.mjs`: 이미 구워진 탄생 동작에 예전 회전·높이를 다시 적용하도록 요구하던 기대값을 수정했다. 실제 표시 경로를 호출해 전신 1개, 양 방향, 원본 crop·목적 사각형, 공통 앵커, 중복 회전 없음, 원본 agent 불변을 검증한다.
- `client/spring-dominant-birth.test.mjs`: 실제 `unitFacing` 의존성을 연결하고 단일기관 helper가 등록된 복합 외형을 가로채지 않는 현재 계약을 검사한다. 원본 샘플러·실패 대체·물 효과·reduced motion·idle handoff 검사는 유지한다.
- `server/birth.test.mjs`: 서버까지 확장했을 때 드러난 오래된 fixture 2개도 수정했다. 포인트·공간 부족의 원자성은 유효한 DNA 없는 설계로 해당 guard에 직접 도달하도록 만들었고, 동일 설계 재사용 fixture에는 현재 비교 대상인 DNA·전투 주속성도 포함했다. 한도 거부와 실패 후 상태 불변 검사는 그대로 유지한다.

수리 후 클라이언트 탄생·표시 129/129, 클라이언트·서버 탄생 관련 전체 147/147 통과. 실패했던 3개 클라이언트 파일의 16/16 검사도 통과했다. 삭제·skip·todo 없음. `git diff --check` 통과. 최종 실행 기록은 `birth-regression-repaired.txt`, `legacy-tests-after.txt`에 있다.
