import { CONQUEST_PACING } from "./conquest-pacing.mjs";
import { TRIBE_UNIT_STATS, ATTRIBUTE_STAT_VALUES } from "./unit-stats.mjs";
import { tribeTerrainSpeedMultiplier } from "./tribe-environment.mjs";
import { unitCombatStats } from "./combat-stats.mjs";

export const ATTRIBUTES = [
  { key: "antenna", minNestLevel: 1, name: "감지", color: "#b2bffa", effect: "시야 반경 +3칸", description: "유닛의 시야 반경이 늘어납니다.", bonus: 3, bonuses: [0, 3, 4, 6, 8], stat: "시야 반경", unit: "칸" },
  { key: "strength", minNestLevel: 1, name: "채집량 증가", color: "#e6a79c", effect: "채집량 +1개", description: "한 번에 채집해 운반하는 자원의 양이 1개 늘어납니다.", bonus: 1, stat: "채집량", unit: "개" },
  { key: "butchery", minNestLevel: 2, nativeTribe: "spring", name: "흡수", color: "#b2dce6", effect: "", description: "", kind: "harvest", harvests: ["dew", "nutrients"] },
  { key: "lifespan", minNestLevel: 2, name: "수명", color: "#d8cd88", effect: "수명 +2분 · 몽돌 +3분", description: "유닛의 수명이 늘어납니다.", bonus: 2, stat: "수명", unit: "분" },
  { key: "feet", minNestLevel: 1, name: "이속 증가", color: "#8cd2bb", effect: "이동 속도 +0.3칸/초", description: "탐색과 왕복 이동을 빠르게 합니다.", bonus: 0.3, stat: "이동 속도", unit: "칸/초" },
  { key: "excavation", minNestLevel: 2, nativeTribe: "bean", name: "굴착", color: "#d4b48a", effect: "", description: "", kind: "harvest", harvests: ["clay", "sand"] },
  { key: "construction", minNestLevel: 1, name: "변태", color: "#d7bd80", effect: "건물 변태 허용 · 이동 속도 −20%", description: "종족이 정한 장소에서 몸을 눌러 펼치고 건물로 성장합니다. 이 속성이 있는 개체만 변태할 수 있으며, 강화할수록 변태 시간과 이동 감속이 줄어듭니다.", kind: "construction" },
  { key: "blade", minNestLevel: 2, nativeTribe: "spore", name: "칼날", color: "#d5d88e", effect: "공격 전투력 +12", description: "공격할 때의 전투력이 단계별로 12·15·18·20 증가합니다.", kind: "combat", bonus: 12, bonuses: [0, 12, 15, 18, 20], stat: "공격 전투력", unit: "", harvests: ["tree", "grass-fiber"] },
  { key: "piercing", minNestLevel: 2, nativeTribe: "pebble", name: "관통", color: "#b9dca1", effect: "갑피 관통 +50%", description: "상대 갑피의 피해 감소를 단계별로 50·65·80·100% 무시합니다. 엄호 효과는 관통하지 않습니다.", kind: "combat", bonus: 50, bonuses: [0, 50, 65, 80, 100], stat: "갑피 관통", unit: "%", harvests: ["pebbles", "iron-ore", "copper-ore", "quartz"] },
  { key: "carapace", minNestLevel: 3, name: "갑피", color: "#c8bd8c", effect: "받는 피해 −45%", description: "받는 전투 피해가 단계별로 45·50·55·60% 감소합니다.", kind: "combat", bonus: 45, bonuses: [0, 45, 50, 55, 60], stat: "피해 감소", unit: "%" },
  { key: "guard", minNestLevel: 4, name: "엄호", color: "#a5cba4", effect: "아군 받는 피해 −35%", description: "같은 전투 칸의 자신과 아군이 받는 피해를 단계별로 35·38·42·45% 줄입니다. 여러 엄호 중 가장 높은 효과만 적용합니다.", kind: "combat", bonus: 35, bonuses: [0, 35, 38, 42, 45], stat: "아군 피해 감소", unit: "%" },
  { key: "regeneration", minNestLevel: 3, name: "재생", color: "#b8dca4", effect: "전투 밖 아군 체력 +20 · 자기 회복 +2/초", description: "전투 밖에서 같은 칸의 가장 다친 아군을 자동으로 치유하며, 자신의 체력도 회복합니다.", kind: "combat", bonus: 20, bonuses: [0, 20, 24, 28, 32], stat: "아군 치유량", unit: "" }
];

const attributeKeys = new Set(ATTRIBUTES.map(attribute => attribute.key));

export function attributeUnlockLevel(attributeKey, tribe) {
  const attribute = ATTRIBUTES.find(candidate => candidate.key === attributeKey);
  return attribute ? attribute.nativeTribe && attribute.nativeTribe === tribe ? 1 : attribute.minNestLevel : null;
}

export function isAttributeUnlocked(attributeKey, nestLevel, tribe) {
  const level = attributeUnlockLevel(attributeKey, tribe);
  return level !== null && Number.isInteger(nestLevel) && nestLevel >= level;
}

export const HARVEST_ATTRIBUTE_KEYS = Object.freeze(ATTRIBUTES.filter(attribute => attribute.harvests?.length).map(attribute => attribute.key));

export const COMBAT_ATTRIBUTE_KEYS = Object.freeze(ATTRIBUTES.filter(attribute => attribute.kind === "combat").map(attribute => attribute.key));

export const ATTRIBUTE_SYNERGIES_ENABLED = false;

export const ATTRIBUTE_COMBINATIONS = ATTRIBUTE_SYNERGIES_ENABLED ? [
  { keys: ["strength", "strength"], attributeLevels: { strength: 2 }, kind: "upgrade", requirement: "채집량 증가 Lv.2", name: "과적", description: "기본 운반량을 넘겨 자원 4개를 추가로 적재합니다. 초과 적재 중 이동 속도는 20% 감소합니다." },
  { keys: ["strength", "feet"], name: "적재 가속", description: "적재율에 비례해 이동 속도가 최대 50% 증가합니다." },
  { keys: ["strength", "antenna"], name: "맥 짚기", description: "현장 준비 후 자원 2개를 즉시 담습니다. 같은 자원 지점에 개체별 30초 간격으로 발동합니다." },
  { keys: ["feet", "feet"], attributeLevels: { feet: 2 }, kind: "upgrade", requirement: "이속 증가 Lv.2", name: "질주", description: "직선으로 4칸 이동하면 이동 속도가 75% 증가합니다. 정지하거나 방향을 바꾸면 해제됩니다." },
  { keys: ["feet", "antenna"], name: "탐색 파동", description: "8칸 이동할 때마다 1초간 시야 반경이 4칸 넓어집니다." },
  { keys: ["antenna", "antenna"], attributeLevels: { antenna: 2 }, kind: "upgrade", requirement: "감지 Lv.2", name: "미지 감지", description: "반경 18칸 안개 속 미확인 대상에 느낌표를 표시합니다. 정체와 수량은 실제 시야로 확인합니다." }
] : [];

const ATTRIBUTE_MIGRATIONS = Object.freeze({ arms: "strength", botany: "blade", mining: "piercing", condensation: "butchery" });

export function migrateAttributeSlots(slots) {
  return [...new Set((Array.isArray(slots) ? slots : []).map(key => Object.hasOwn(ATTRIBUTE_MIGRATIONS, key) ? ATTRIBUTE_MIGRATIONS[key] : key)
    .filter(key => ATTRIBUTES.some(attribute => attribute.key === key)))];
}

export function attributeLevelLimit(nestLevel) {
  return 1;
}

export function migrateAttributeLevels(slots, levels, nestLevel) {
  const limit = attributeLevelLimit(nestLevel);
  const existing = levels && typeof levels === "object" && !Array.isArray(levels) ? levels : null;
  const legacy = Object.create(null);
  for (const slot of Array.isArray(slots) ? slots : []) {
    const key = slot === "arms" ? "strength" : slot;
    legacy[key] = (legacy[key] || 0) + 1;
  }
  return Object.fromEntries(migrateAttributeSlots(slots).map(key => {
    const sources = [key, ...Object.keys(ATTRIBUTE_MIGRATIONS).filter(source => ATTRIBUTE_MIGRATIONS[source] === key)];
    const explicit = sources.filter(source => existing && Object.hasOwn(existing, source));
    const values = explicit.length ? explicit.map(source => Number.isInteger(existing[source]) ? existing[source] : 1) :
      sources.map(source => legacy[source] || 1);
    return [key, Math.max(1, Math.min(limit, Math.max(...values)))];
  }));
}

export function attributeCounts(slots, levels) {
  const counts = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key, 0]));
  const migrated = migrateAttributeLevels(migrateAttributeSlots(slots), levels);
  for (const key of migrateAttributeSlots(slots)) {
    const value = migrated[key];
    counts[key] = Number.isInteger(value) ? Math.max(1, Math.min(4, value)) : 1;
  }
  return counts;
}

export function hasSynergy(counts, keys) {
  if (!ATTRIBUTE_SYNERGIES_ENABLED) return false;
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (!attributeKeys.has(key)) return false;
    let level = 1;
    for (let previous = 0; previous < index; previous++) if (keys[previous] === key) level++;
    if (!((counts[key] || 0) >= level)) return false;
  }
  return true;
}

const attributeUpgradeMaterials = {
  antenna: { dew: 6, "grass-fiber": 4 },
  strength: { tree: 6, pebbles: 4 },
  butchery: { clay: 6, dew: 4 },
  lifespan: { dew: 6, "grass-fiber": 4 },
  feet: { tree: 4, "grass-fiber": 6 },
  excavation: { tree: 4, pebbles: 6 },
  construction: { tree: 8, clay: 6 },
  blade: { tree: 6, "grass-fiber": 6 },
  piercing: { tree: 6, pebbles: 6 },
  carapace: { pebbles: 8, clay: 6 },
  guard: { tree: 6, clay: 6 },
  regeneration: { dew: 8, "grass-fiber": 6 }
};

export function attributeUpgradeCost(attributeKey, targetLevel) {
  const base = Object.hasOwn(attributeUpgradeMaterials, attributeKey) ? attributeUpgradeMaterials[attributeKey] : null;
  if (!base || !Number.isInteger(targetLevel) || targetLevel < 2 || targetLevel > attributeLevelLimit()) return null;
  const materials = Object.fromEntries(Object.entries(base).map(([key, amount]) => [key, targetLevel === 2 ? Math.ceil(amount / 2) : 1]));
  if (targetLevel >= 3) {
    materials["iron-ore"] = 1;
    materials["copper-ore"] = 1;
  }
  if (targetLevel === 4) {
    materials.quartz = 1;
  }
  return { evolutionPoints: CONQUEST_PACING.attributeCosts[targetLevel], materials };
}

export function attributeUpgradeIssue(template, attributeKey, nestLevel, evolutionPoints, inventory) {
  if (!template?.slots?.includes(attributeKey)) return "장착한 속성만 강화할 수 있습니다.";
  const targetLevel = attributeCounts(template.slots, template.attributeLevels)[attributeKey] + 1;
  const cost = attributeUpgradeCost(attributeKey, targetLevel);
  if (!cost) return "최대 단계에 도달한 속성입니다.";
  if (targetLevel > attributeLevelLimit(nestLevel)) return "둥지를 성장시킨 뒤 속성을 강화해 주세요.";
  if (!Number.isFinite(evolutionPoints) || evolutionPoints < cost.evolutionPoints) return "강화에 필요한 진화 포인트가 부족합니다.";
  if (Object.entries(cost.materials).some(([key, amount]) => !Number.isFinite(inventory?.[key]) || inventory[key] < amount)) {
    return "강화에 필요한 자원 재료가 부족합니다.";
  }
  return null;
}

export function unitStats(attributes, tribe) {
  const combat = unitCombatStats(tribe);
  const base = TRIBE_UNIT_STATS[tribe] || TRIBE_UNIT_STATS.bean;
  const equipped = key => attributes[key] > 0;
  return {
    speed: base.speed + (equipped("feet") ? ATTRIBUTE_STAT_VALUES.movementBonus : 0),
    movementMultiplier: equipped("construction") ? ATTRIBUTE_STAT_VALUES.movementMultiplier : 1,
    capacity: equipped("strength") ? ATTRIBUTE_STAT_VALUES.capacity : 1,
    vision: equipped("antenna") ? ATTRIBUTE_STAT_VALUES.vision : 3,
    attack: 1,
    attackBonus: equipped("blade") ? ATTRIBUTE_STAT_VALUES.attackBonus : 0,
    armorPenetration: equipped("piercing") ? ATTRIBUTE_STAT_VALUES.armorPenetration : 0,
    damageReduction: equipped("carapace") ? ATTRIBUTE_STAT_VALUES.damageReduction : 0,
    guardProtection: equipped("guard") ? ATTRIBUTE_STAT_VALUES.guardProtection : 0,
    regeneration: equipped("regeneration") ? ATTRIBUTE_STAT_VALUES.regeneration : 0,
    healing: equipped("regeneration") ? ATTRIBUTE_STAT_VALUES.healing : 0,
    health: combat.health,
    combatStrength: combat.combatStrength,
    lifespan: equipped("lifespan") ? base.lifespanWithAttribute : base.lifespan,
    resistance: 1
  };
}

export function unitMovementSpeed(stats) {
  return stats.speed * (stats.movementMultiplier ?? 1);
}

export function unitCarryCapacity(agent, resourceType) {
  return agent.stats.capacity;
}

export function unitTravelSpeed(agent, carrying, resourceType) {
  const base = TRIBE_UNIT_STATS[agent.tribe] || TRIBE_UNIT_STATS.bean;
  const load = Math.min(1, Math.max(0, carrying || 0) / Math.max(1, unitCarryCapacity(agent, resourceType) || 1));
  return (agent.stats.speed + (base.loadedSpeed - base.speed) * load) * (agent.stats.movementMultiplier ?? 1);
}

export function unitTerrainSpeedMultiplier(agent, terrain) {
  if (agent.movementType === "flying" || agent.species === "flower-tail-bird" || agent.species === "talon-owl") {
    return terrain === 5 || terrain === 7 ? 0.8 : 1;
  }
  return tribeTerrainSpeedMultiplier(agent.tribe, terrain);
}

const tribeBirthCosts = Object.freeze({
  bean: Object.freeze([3, 5, 8, 12, 17]),
  spring: Object.freeze([3, 5, 7, 10, 14]),
  pebble: Object.freeze([4, 7, 11, 16, 22]),
  spore: Object.freeze([2, 3, 5, 8, 12])
});

export function birthCost(template, tribe) {
  const costs = tribeBirthCosts[tribe || template.tribe] || tribeBirthCosts.bean;
  const ceiling = costs[template.slots.length];
  if (ceiling === undefined) return Infinity;
  const base = costs[0] * [1, 1.2, 1.5, 1.9, 2.4][template.slots.length];
  const attributes = attributeCounts(template.slots, template.attributeLevels);
  const enhancement = template.slots.length ? template.slots.reduce((sum, key) => sum + attributes[key] - 1, 0) / (3 * template.slots.length) : 0;
  return Math.round(base + (ceiling - base) * enhancement);
}
