# 흰발·그늘족제비 웰컴 보행 수정

## 변경 내용

- 기존 승인된 몸·얼굴·꼬리·팔다리 그림을 보존한 채 편집 가능한 원본 리그의 발 이동 폭을 36→120px, 발 들림을 13→35px로 늘려 64프레임 시트를 다시 제작했다.
- 640px 원본 셀은 PNG로 보존했다. 게임용 시트는 기존 248px/229px 셀과 카메라를 유지해 디코딩 메모리가 늘지 않는다. 패킹된 픽셀은 lossless WebP로 저장했다.
- 웰컴의 이동 거리는 전투 셀 크기가 아니라 실제 표시 스케일과 접지 보폭으로 계산한다. 두 동작의 주기는 500ms이며 중앙 대기는 기존 수정값인 1500ms를 유지한다.
- 기획서의 두 걷기 미리보기·원본 링크·재생 시간도 동일한 새 동작을 가리킨다.

## 측정

| 항목 | 흰발 | 그늘족제비 |
|---|---:|---:|
| 수정 전 웰컴 한 주기 전진 | 139.37px | 154.44px |
| 수정 전 발이 지지하는 한 주기 전진 | 8.13px | 6.91px |
| 수정 후 한 주기 전진 | 27.06573px | 22.89293px |
| 수정 후 화면 속도 | 54.13146px/s | 45.78587px/s |
| 원본 발 들림의 화면 환산 | 5.05227px | 4.27335px |
| 입장 시간 | 5312.5ms | 6153.848ms |
| 실제 픽셀 접지 흔들림 관측 범위 | 최대 0.5px | 최대 1px |

접지 흔들림은 축소된 알파 경계의 반올림을 포함한 측정값이다. 모든 브라우저·서브픽셀 위치에 대한 상한으로 해석하지 않는다. 이전에는 같은 접지 구간에서 약 82px/92px의 미끄러짐이 있었으므로 문제의 규모가 달랐다.

## 검증

- 원본의 접지 구간을 독립 픽셀 측정한 결과 전진량은 187.38–187.66 원본px/주기로 설계값 187.5px와 일치했다.
- 얼굴·등 상단 픽셀과 전체 몸 경계가 모든 프레임에서 고정됐고 루프 연결, 잘림, 떨어진 발·중복 다리가 없었다.
- 실제 통합된 `client/runtime.js`와 `welcome-header.js`의 `drawUnit` 경로를 2048회 실행했다. 모든 표본이 walk이며 직접 렌더와 이중버퍼 결과가 같고 경고는 0이었다.
- 정규화된 화면 픽셀과 프레임 순서는 500ms마다 정확히 반복되며 실제 이동 루트는 연속적으로 진행된다.
- 동영상은 동일한 렌더 경로로 각 480×280 패널을 만든 30fps, 14.63초 미리보기다. 두 종 모두 중앙 idle 45프레임, 즉 1.5초이고 전체 프레임 디코딩을 확인했다.

## 범위와 제한

이 검증은 native Canvas 렌더링이며 실제 Chromium 녹화나 브라우저 로딩 검증이 아니다. 몸통·꼬리가 고정되고 최대 신전에서 다리가 곧게 펴지는 컷아웃 애니메이션 특성은 남는다.

게임용 이동속도와 기존 `cyclesPerCell`은 변경하지 않았다. 공용 원본의 보폭은 커졌지만 **인게임 이동속도와 보행 주기의 동기화 완료를 뜻하지 않는다**. 이번 화면 이동 보정은 웰컴에 적용된다. 관련 회귀 결과와 전체 프로젝트 검사는 구분한다.

## 재현 자료

- 원본/패킹/미리보기 경로와 SHA: `stride-assets-manifest.json`
- 원본 리그: `walk-stride-rig.mjs` (`node --expose-gc ... --render`)
- 게임용 패킹: `pack-stride-runtime.mjs`
- 원본 접지 측정: `stride-review-measure.mjs`, `stride-review-measure.json`
- 통합 렌더 검증: `stride-final-review-integrated-summary.json`, `stride-final-review-integrated-native.json`, `stride-final-review-integrated-subframe.json`
- 실제 크기와 확대 접지 비교: `stride-final-review-packed-contact.png`
- 미리보기: `stride-final-review-integrated-playback.mp4`, `stride-final-review-integrated-playback.json`

통합 런타임 검증은 `QA_USE_INTEGRATED_RUNTIME=1`을 설정하고 `stride-final-review-packed-native.cjs` 및 `stride-final-review-packed-subframe.cjs`를 실행한다. 이전 수치는 v72 상태에서 캡처한 `source-gait-measure.json`과 `native-gait-measure.json`에 보존했다.

최신 main의 DNA v6·공통 탄생 렌더 경로를 보존해 재배치한 뒤 관련 회귀 279개(273+6개 순차 묶음)(실패·skip 0)와 원본 이미지 1517개 검사를 통과했다. 전체 프로젝트 테스트 통과 주장과는 구분한다. 로그는 `stride-integration-tests.txt`, `stride-image-audit.txt`에 보존한다.
