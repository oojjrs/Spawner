import { AGENT_LIFESPAN } from "./lifespan.mjs";

export const ATTRIBUTES = [
  { key: "harvest", name: "채집", color: "#adc979", effect: "식물·재료 채집", description: "열매·섬유 등을 회수합니다.", bonus: 1, stat: "채집 숙련", unit: "단계" },
  { key: "digging", name: "굴착", color: "#cca478", effect: "구근·광물 채집 해금", description: "흙과 암반에서 자원을 꺼냅니다. 단단한 광물에는 힘 두 개가 함께 필요합니다. 중복 장착 추가 효과는 없습니다.", bonus: 1, stat: "굴착 능력", unit: "", stacking: false },
  { key: "absorption", name: "흡수", color: "#86cbd5", effect: "채집 대상 없음", description: "현재 채집 가능한 자원이 없습니다.", bonus: 1, stat: "흡수 능력", unit: "", stacking: false },
  { key: "climbing", name: "등반", color: "#c6b6e3", effect: "높은 나무 열매에 접근", description: "채집과 함께 장착하면 나무에 달린 열매를 땁니다. 중복 장착 추가 효과는 없습니다.", bonus: 1, stat: "등반 능력", unit: "", stacking: false },
  { key: "strength", name: "채집량 증가", color: "#e6a79c", effect: "채집량 +1개", description: "한 번에 채집해 운반하는 자원의 양이 기본 1개에서 2개로 늘어납니다.", bonus: 1, stat: "채집량", unit: "개" },
  { key: "feet", name: "이속 증가", color: "#8cd2bb", effect: "이동 속도 +0.3칸/초", description: "탐색과 왕복 이동을 빠르게 합니다.", bonus: 0.3, stat: "이동 속도", unit: "칸/초" },
  { key: "antenna", name: "감지", color: "#b2bffa", effect: "시야 반경 +2칸", description: "군락과 공유하는 실제 시야를 넓힙니다.", bonus: 2, stat: "시야 반경", unit: "칸" },
  { key: "lifespan", name: "수명", color: "#d8cd88", effect: "수명 +2분", description: "기본 수명 3분에 2분을 더해 5분 동안 살아갑니다.", bonus: 2, stat: "수명", unit: "분" },
  { key: "shell", name: "저항", color: "#a7cbd2", effect: "환경 피해 25% 감소", description: "환경 피해를 곱셈으로 줄입니다. 두 개 장착하면 43.75% 감소합니다.", bonus: 25, stat: "환경 피해 감소", unit: "%" }
];

export const ATTRIBUTE_COMBINATIONS = [
  { keys: ["strength", "strength"], name: "과적", description: "기본 운반량을 넘겨 먹이 4개를 추가로 적재합니다. 초과 적재 중 이동 속도는 20% 감소합니다." },
  { keys: ["strength", "feet"], name: "적재 가속", description: "적재율에 비례해 이동 속도가 최대 50% 증가합니다." },
  { keys: ["strength", "antenna"], name: "맥 짚기", description: "현장 준비 후 먹이 2개를 즉시 담습니다. 같은 먹이 더미에 개체별 30초 간격으로 발동합니다." },
  { keys: ["strength", "shell"], name: "충격 경화", description: "피격 직후 피해 4를 흡수하는 보호막이 4초간 생깁니다. 재사용 대기시간은 12초입니다." },
  { keys: ["feet", "feet"], name: "질주", description: "직선으로 4칸 이동하면 이동 속도가 75% 증가합니다. 정지하거나 방향을 바꾸면 해제됩니다." },
  { keys: ["feet", "antenna"], name: "탐색 파동", description: "8칸 이동할 때마다 1초간 시야 반경이 4칸 넓어집니다." },
  { keys: ["feet", "shell"], name: "위험 가속", description: "위험 지형 안에서 이동 속도가 3배가 됩니다. 위험 지형의 기본 감속은 함께 적용됩니다." },
  { keys: ["antenna", "antenna"], name: "미지 감지", description: "반경 18칸 안개 속 미확인 대상에 느낌표를 표시합니다. 정체와 수량은 실제 시야로 확인합니다." },
  { keys: ["antenna", "shell"], name: "위험 예감", description: "위험 지역 진입 시 1초간 환경 피해를 막습니다. 재사용 대기시간은 15초입니다." },
  { keys: ["shell", "shell"], name: "환경 적응", description: "같은 환경 위험에 1초 노출되면 해당 피해가 90% 추가 감소합니다. 위험을 벗어난 뒤 5초가 지나면 해제됩니다." }
];

export function attributeCounts(slots) {
  const counts = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key, 0]));
  for (const slot of slots) {
    const key = slot === "arms" ? "strength" : slot;
    if (Object.hasOwn(counts, key)) counts[key] += 1;
  }
  return counts;
}

export function hasSynergy(counts, keys) {
  const required = attributeCounts(keys);
  return ATTRIBUTES.every(attribute => (counts[attribute.key] || 0) >= required[attribute.key]);
}

export function unitStats(attributes) {
  return {
    speed: 1 + attributes.feet * 0.5,
    capacity: 1 + attributes.strength,
    vision: 3 + attributes.antenna * 2,
    attack: 1,
    health: 12,
    lifespan: AGENT_LIFESPAN + (attributes.lifespan || 0) * 2 * 60,
    resistance: 0.75 ** attributes.shell
  };
}

export function unitMovementSpeed(stats) {
  return 0.5 + (stats.speed - 1) * 0.6;
}

export function unitTerrainSpeedMultiplier(agent, terrain) {
  if (agent.movementType === "flying" || agent.species === "flower-tail-bird" || agent.species === "talon-owl") return 1;
  return terrain >= 6 && terrain <= 8 ? 0.6 : 1;
}

export function birthCost(template) {
  return [3, 5, 8, 12, 17, 23][template.slots.length] ?? Infinity;
}
