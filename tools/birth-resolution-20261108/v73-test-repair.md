# v73 탄생 회귀 수리

## 결과

`node --test --test-concurrency=1 client/base-birth-registration.test.mjs client/bean-base-birth.test.mjs client/birth-scene-layers.test.mjs`

33/33 통과. 최초 순차 실행에서는 31개 중 7개 assertion이 실패했으며, 이전 병렬 실행의 SIGKILL은 재현되지 않았다. 테스트 삭제·skip 없이 독립 검증 2개를 추가했다. `git diff --check` 통과.

## 기대값의 근거

- 기본 버섯은 원본 192셀을 반전했으므로 pivotX가 134.5에서 192−134.5=57.5로 바뀐다. 나머지 크기·시간·격자·위치는 정규화 전 metadata와 비교한다. 원본 SHA가 고정된 Git `958b999dc5109cb4827f2013916840c22c7adf07`의 WebP를 독립 디코딩하고 실제 파일의 24셀 모두가 정확한 수평 반전인지 검사한다. 완전 투명 픽셀의 보이지 않는 RGB만 비교에서 정규화한다.
- 기본 새싹콩은 전체 장면 폭 512와 이전 pivotX 430으로부터 새 pivotX 82를 검증한다. 모든 전신/환경 sample에 `newX=512−oldX−width`를 적용한 결과와 현재 전체 등록을 비교한다. 이미지 SHA·타이밍·격자·나머지 좌표는 그대로 검사한다. 최종 몸체와 현재 idle의 실제 RGBA 동일성 검사는 유지했다.
- 14개 콩/버섯 레이어의 1358 경계·2716 양방향 draw는 현재 호출을 검증된 미러 변환의 역변환으로 되돌린 뒤 **기존** `f95f4901fea1fa4f1763340bdfb98d4c9d368d49465434e2e1452449fc26a79b` 해시와 비교한다. 새 snapshot 값을 대입하지 않았다. 각 클립의 전체 metadata가 이전 등록의 정확한 미러 변환인지 별도로 확인하므로 무관한 변경을 숨기지 않는다. 요청 중복·idle decode 방지·hot-path Promise 0 검사도 유지했다.
- Pillow 검증은 전체 아틀라스를 RGBA로 추가 복사하기 전에 필요한 셀만 crop하도록 조정했다. 순차 실행에서 메모리 종료 없이 통과했지만 병렬 메모리 한계 자체가 해결되었다고 주장하지 않는다.

## 발견한 실제 제품 누락

기본 새싹콩의 live publication manifest 및 기획서 birth payload가 우향 이전 값으로 남아 있었다. 테스트를 완화하지 않고 게시 담당자와 방향 담당자에게 보고했다.

승인된 분담에 따라 여기서는 `DesignAssets/sections/unit-appearance.js`의 기본 새싹콩 birth `data-birth-scene`만 최신 `UNIT_BIRTH_ART`와 동기화했다. 해당 payload 외의 전체 렌더 HTML 바이트가 동일함을 검사했으므로 두 중립 walk td와 사용자 편집은 보존되었다. 정확한 전후 SHA와 환경 경로/좌표는 `v73-bean-base-planning-sync.json`에 있다. runtime 코드 변경은 없다. publication 및 원본 alias 수정은 방향 담당자가 별도로 처리했다.

## 변경 및 전달

- 테스트: `client/base-birth-registration.test.mjs`, `client/bean-base-birth.test.mjs`, `client/birth-scene-layers.test.mjs`.
- 승인된 기획서 동기화: `DesignAssets/sections/unit-appearance.js`.
- 실행 근거: `v73-three-after.txt`.
- 원본 metadata/변경 근거는 이미 방향 작업에 포함된 `tools/spring-native-facing-20261108/bean-spore-plan-registry.json`과 `bean-spore-image-changes.json`을 사용한다.

새 폴더·브랜치·체크아웃을 만들지 않았다. 직접 커밋/푸시/빌드/배포는 하지 않았다. 기획서가 바뀌었으므로 최종 정적 게시 묶음은 다시 준비해야 한다.
