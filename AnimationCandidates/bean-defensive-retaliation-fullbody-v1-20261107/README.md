# 새싹콩 방어형 반격 근접 애니메이션

대상은 갑각 단독(mask02), 안테나 단독(mask04), 갑각+안테나(mask06)다. 사용자가 기본 베이스 공격을 참고하여 방어형도 피격 후 반격할 수 있는 공격 동작을 요청했다. 이 패키지는 외형과 반격용 전신 동작만 제공하며, 선제공격 또는 전투 규칙을 수정하지 않는다. 새 이미지의 개별 승인을 받았다고 표시하지 않는다.

## 기존 자료 확인

- 현재 기획서 `DesignAssets/sections/unit-appearance.js`에서 갑각 단독의 근접 셀은 비어 있었다. 기존 안테나 단독 승인 패키지는 idle/walk/death와 별도 birth 및 held-hurt를 보유하며 근접 공격은 없었다.
- 직전 갑각+안테나 완성 패키지는 idle/walk/hurt/birth/death 5동작으로 공격이 없었다. 이 요청에 따라 반격용 근접 동작을 추가한다.
- 옛 `CombatAttributesV7/sprout/Sheets/carapace/attack.webp`는 별도의 파츠 기반 갑각 동작으로, 현재 요청한 기본형 몸통 박치기와 동작 방식이 다르다. 기존 파일은 보존하고 새 전신 자산을 제작했다.
- 외형은 `UnitAppearanceV1/bean/{02,04,06}/Source/neutral.png`의 현재 승인본을 사용했다. 기본형 동작은 `UnitAttack/attack.png`와 `attack.json`을 직접 확인했다.

## 연결

각 폼의 `publication-manifest.json`에 `actions.attack`만 제공한다. 기존 idle 등 다른 동작을 교체하지 않는다. 전체 경로는 최상위 `planning-entries.json`에 있다. 게임·실험실·헤더·기획서 연결과 git push/배포는 통합 담당이 수행한다.

- 각 512px 셀, 8열, 16시간샘플, 총1000ms.
- 몸 전체 준비 → 낮게 숙임 → 오른쪽으로 몸통/이마 충돌 → 복귀. 안테나는 감각기관으로 남고 무기로 변하지 않는다.
- 기본형 `attack.json`의 명시된 `hitAtMs:300`을 따른다. 새 타임라인의 실제 접촉은 0-based frame5/pose4에서 시작하며 앞5샘플 합계가300ms다.
- 원거리, 발사구, 칼날, 투사체, 외부 공격 효과를 추가하지 않았다.
- 모든 새 포즈는 하나의 전신 그림으로 생성했다. 코드는 완성 셀 자르기, 시트별 고정 균등 배율, 전신 이동, 시트 포장만 사용했다. 기존 신체 파츠 합성은 하지 않았다.

## 검증

`final-checks.json`과 `final-timeline-verification.json`을 참조한다. 3동작48시간샘플 모두 잘림0, 유효 연결체1개, 시작/끝 승인 neutral의 정확한 RGBA 일치, 시트와 각 포즈 픽셀 일치, 투명 WebP 전체 타임라인의 visible RGBA/시간/루프 일치, SHA256 일치를 확인했다. GIF 총시간도1000ms로 일치한다. alpha16 승인 neutral의 전체 외곽과 아래8행 지지점을 직접 측정하여 고정 referenceLength/pivot을 기록했다.

공유 런타임 코드를 수정하지 않았으며, 게임 전체 테스트는 이 자산 패키지 검증 범위에 포함하지 않는다.
