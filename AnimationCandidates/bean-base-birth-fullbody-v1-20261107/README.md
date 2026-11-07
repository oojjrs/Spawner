# 새싹콩 기본 탄생 전신 v1

실제 현재 기본 대기 frame0를 기준으로 새 전신16포즈를 제작했습니다. 전체 씨앗→껍질→전신 등장 흐름은 기존3.85초를 유지합니다.

- 전체 장면116프레임,3850ms. 몸체는2590ms부터 등장하고3610ms부터 실제idle0로 정착합니다.
- body-only631px시트16포즈와512px전체장면 시트·미리보기를 제공합니다.
- sceneLayers는 기존 공통 환경 atlas를 그대로 재사용하고 새 전신 한 장만 그립니다. removed 파츠 합성은 복구하지 않습니다.
- runtime pivot430/446, referenceLength32. 고해상도 전신의 최종 표시 크기와 원점은 현재idle와 수학적으로 동일합니다.
- 마지막전신 RGBA·환경원본SHA·샘플범위·3850ms 시계 검증 정보는 publication-manifest.json과validation.json에 있습니다.
- 공유등록/기획서/게임코드/git은 변경하지 않았습니다.
