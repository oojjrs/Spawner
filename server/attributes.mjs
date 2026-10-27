import { AGENT_LIFESPAN } from "./lifespan.mjs";
import { unitCombatStats } from "./combat-stats.mjs";

export const ATTRIBUTES = [
  { key: "antenna", name: "감지", color: "#b2bffa", effect: "시야 반경 +2칸", description: "군락과 공유하는 실제 시야를 넓힙니다.", bonus: 2, stat: "시야 반경", unit: "칸" },
  { key: "strength", name: "채집량 증가", color: "#e6a79c", effect: "채집량 +1개", description: "한 번에 채집해 운반하는 자원의 양이 기본 1개에서 2개로 늘어납니다.", bonus: 1, stat: "채집량", unit: "개" },
  { key: "butchery", name: "분해", color: "#c98d9d", effect: "고기 채집 허용", description: "사체를 분해해 고기를 채집할 수 있습니다.", stacking: false },
  { key: "lifespan", name: "수명", color: "#d8cd88", effect: "수명 +2분", description: "기본 수명 3분에 2분을 더해 5분 동안 살아갑니다.", bonus: 2, stat: "수명", unit: "분" },
  { key: "feet", name: "이속 증가", color: "#8cd2bb", effect: "이동 속도 +0.3칸/초", description: "탐색과 왕복 이동을 빠르게 합니다.", bonus: 0.3, stat: "이동 속도", unit: "칸/초" }
];

export const ATTRIBUTE_COMBINATIONS = [
  { keys: ["strength", "strength"], name: "과적", description: "기본 운반량을 넘겨 먹이 4개를 추가로 적재합니다. 초과 적재 중 이동 속도는 20% 감소합니다." },
  { keys: ["strength", "feet"], name: "적재 가속", description: "적재율에 비례해 이동 속도가 최대 50% 증가합니다." },
  { keys: ["strength", "antenna"], name: "맥 짚기", description: "현장 준비 후 먹이 2개를 즉시 담습니다. 같은 먹이 더미에 개체별 30초 간격으로 발동합니다." },
  { keys: ["feet", "feet"], name: "질주", description: "직선으로 4칸 이동하면 이동 속도가 75% 증가합니다. 정지하거나 방향을 바꾸면 해제됩니다." },
  { keys: ["feet", "antenna"], name: "탐색 파동", description: "8칸 이동할 때마다 1초간 시야 반경이 4칸 넓어집니다." },
  { keys: ["antenna", "antenna"], name: "미지 감지", description: "반경 18칸 안개 속 미확인 대상에 느낌표를 표시합니다. 정체와 수량은 실제 시야로 확인합니다." }
];

export function migrateAttributeSlots(slots) {
  return slots.map(key => key === "arms" ? "strength" : key)
    .filter(key => ATTRIBUTES.some(attribute => attribute.key === key));
}

export function attributeCounts(slots) {
  const counts = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key, 0]));
  for (const slot of slots) {
    const key = slot === "arms" ? "strength" : slot;
    if (Object.hasOwn(counts, key)) counts[key] += 1;
  }
  return counts;
}

export function hasSynergy(counts, keys) {
  if (keys.some(key => !ATTRIBUTES.some(attribute => attribute.key === key))) return false;
  const required = attributeCounts(keys);
  return ATTRIBUTES.every(attribute => (counts[attribute.key] || 0) >= required[attribute.key]);
}

export function unitStats(attributes, tribe) {
  const combat = unitCombatStats(tribe);
  return {
    speed: 1 + (attributes.feet || 0) * 0.5,
    capacity: 1 + (attributes.strength || 0),
    vision: 3 + (attributes.antenna || 0) * 2,
    attack: 1,
    health: combat.health,
    combatStrength: combat.combatStrength,
    lifespan: AGENT_LIFESPAN + (attributes.lifespan || 0) * 2 * 60,
    resistance: 1
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
