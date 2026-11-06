# 최신 시각 애셋 승인 기록

## 사용자 승인 — 2026-11-06 11:40:46 KST

사용자 원문: “좋다 다 승인” (Sentinel_4eff16ba1bf0819196a4d6cd198a1a74, 2026-11-06T02:40:46.875210Z).
직전에 제시한 최신 시각 시안의 승인이다. 게임 적용·배포 승인이 아니며 이번 기록 작업에서는 코드·적용·배포·사운드를 변경하지 않았다.

- **치유 V2**: `art-review/healing-vfx-v2-20261106`; 영상 `healing-v2-comparison.mp4`; libfile_2c3a77b8a84481919799cdb2834e3888.
  - 16개 원화 키포즈와 독립 상승 입자. 미세한 윤곽/알파 잡음과 마지막 입자의 제자리 소멸은 남으며 실제 유닛 가림·게임 타이밍은 미검수.
- **출혈·흡혈 V2**: `art-review/bleed-drain-v2-20261106`; 영상 `bleed-animated-v2.mp4 / drain-animated-v2.mp4`; 출혈 libfile_234a271f1a70819189dc81b1f1978c41; 흡혈 libfile_935e7fe719b48191baa2569676ee8d5c.
  - 각 16프레임, 12fps. 프레임 간 윤곽 변화·약간의 튐·저농도 가장자리 glow가 남으며 실제 유닛 가림·게임 타이밍은 미검수.
- **헤일로 기절 V3**: `art-review/stun-orbit-v3-halo-20261106`; 영상 `stun-orbit-review.mp4`; libfile_16b1151879ac8191b5e32394daa75973.
  - 72프레임·2.4초 루프, V2 별 공전 유지 및 원형 헤일로 복원. 실제 유닛 가림·게임 타이밍은 미검수.
- **겸용 칼날형 원거리 4종**: `art-review/blade-ranged-review`; 영상 `blade-ranged-four-normal.mp4`; libfile_4adab4e6327481919ea08546cb847337.
  - 새싹콩·포자버섯·몽돌·샘방울의 칼날 외형 + 숨은 분비 능력 겸용 원거리 동작. 승인 대기 원화 변형 기반이며 순수 분비형 바디 교체가 아니다. 기존 동작 재생 자료로 실제 게임 QA는 미검수. 원자료는 Spawner-retry/tools/blade-ranged-expression-20261105/.

이 승인은 다른 미검수 시안(예: 흙두더지·걸어가는 산)을 자동으로 승인 처리하지 않는다.
