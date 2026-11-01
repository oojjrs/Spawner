import { attributeUnlockLevel, unitStats, unitTravelSpeed, unitTerrainSpeedMultiplier } from "../server/attributes.mjs";
import { constructionSeconds } from "../server/buildings.mjs";
import { RESOURCE_TYPES, resourceHarvestMultiplier } from "../server/resources.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { tribeTerrainWalkable } from "../server/tribe-environment.mjs";

export const CODEX_ATTRIBUTE_DESCRIPTIONS = Object.freeze({
  antenna: "유닛의 시야 반경이 늘어납니다.",
  strength: "한 번에 채집해 운반하는 자원의 양을 늘립니다.",
  butchery: "양분과 이슬방울을 채집할 수 있습니다.",
  lifespan: "유닛의 수명이 늘어납니다.",
  feet: "이동 속도를 높입니다.",
  excavation: "모래와 비옥토를 채집할 수 있습니다.",
  construction: "필요에 따라 건물로 자동 변태합니다.",
  blade: "공격할 때의 전투력을 높입니다.\n풀섬유와 목재를 채집할 수 있습니다.",
  piercing: "상대 갑피의 피해 감소를 무시합니다. 엄호 효과는 관통하지 않습니다.\n철광석·구리광석·수정·자갈을 채집할 수 있습니다.",
  carapace: "받는 전투 피해를 줄입니다. 관통 공격에는 효과가 줄어듭니다.",
  guard: "같은 전투 칸의 자신과 아군이 받는 피해를 줄입니다. 여러 엄호 중 가장 높은 효과만 적용되며, 관통으로 무시되지 않습니다.",
  regeneration: "전투 밖에서 같은 칸의 가장 다친 아군을 자동으로 치유하며, 자신의 체력도 회복합니다."
});

const CODEX_NATIVE_ATTRIBUTE_DESCRIPTIONS = Object.freeze({
  butchery: "양분을 채집할 수 있습니다.\n이슬방울을 더 빠르게 채집할 수 있습니다.",
  excavation: "모래를 채집할 수 있습니다.\n비옥토를 더 빠르게 채집할 수 있습니다.",
  blade: "공격할 때의 전투력을 높입니다.\n풀섬유를 채집할 수 있습니다.\n목재를 더 빠르게 채집할 수 있습니다.",
  piercing: "상대 갑피의 피해 감소를 무시합니다. 엄호 효과는 관통하지 않습니다.\n철광석·구리광석·수정을 채집할 수 있습니다.\n자갈을 더 빠르게 채집할 수 있습니다."
});

export function codexAttributeDescription(attribute, tribe) {
  if (attribute.nativeTribe === tribe && CODEX_NATIVE_ATTRIBUTE_DESCRIPTIONS[attribute.key]) {
    return CODEX_NATIVE_ATTRIBUTE_DESCRIPTIONS[attribute.key];
  }
  return CODEX_ATTRIBUTE_DESCRIPTIONS[attribute.key] || attribute.description;
}

function codexNumber(value) {
  return Number(value.toFixed(2));
}

export function codexAttributeEffect(attribute, level, tribe) {
  const stats = unitStats({ [attribute.key]: level }, tribe);
  const base = unitStats({}, tribe);
  const effects = {
    antenna: "시야 반경 +" + (stats.vision - base.vision) + "칸",
    strength: "운반량 +" + (stats.capacity - base.capacity) + "개",
    lifespan: "총수명 " + codexNumber(stats.lifespan / 60) + "분 · +" + codexNumber((stats.lifespan - base.lifespan) / 60) + "분",
    feet: "이동 +" + codexNumber(unitTravelSpeed({ tribe, stats }, 0) - unitTravelSpeed({ tribe, stats: base }, 0)) + "칸/초",
    construction: "건물 변태 " + constructionSeconds("storage", level) + "초 · 이동 −" + Math.round((1 - stats.movementMultiplier) * 100) + "%",
    blade: "공격 전투력 +" + stats.attackBonus,
    piercing: "갑피 관통 " + Math.round(stats.armorPenetration * 100) + "%",
    carapace: "받는 피해 −" + Math.round(stats.damageReduction * 100) + "%",
    guard: "아군 받는 피해 −" + Math.round(stats.guardProtection * 100) + "%",
    regeneration: "전투 밖 아군 치유 " + stats.healing + " · 자기 회복 " + stats.regeneration + "/초"
  };
  const effect = effects[attribute.key] || "";
  if (!attribute.harvests?.length) return effect;
  const resource = RESOURCE_TYPES.find(resource => resource.key === attribute.harvests[0]);
  const multiplier = resourceHarvestMultiplier(resource.key, { [attribute.key]: level }, tribe);
  return [effect, multiplier < 1 ? resource.name + " 채집 시간 −" + Math.round((1 - multiplier) * 100) + "%" : ""].filter(Boolean).join(" · ") || "채집 가능";
}

export function codexAttributeDetails(attribute, tribe) {
  return {
    description: codexAttributeDescription(attribute, tribe),
    unlocks: PLAYER_TRIBES.map(value => [value.name, "둥지 Lv." + attributeUnlockLevel(attribute.key, value.key)]),
    resources: RESOURCE_TYPES.filter(resource => attribute.harvests?.includes(resource.key))
  };
}

export function codexTerrainDetails(type) {
  const rows = PLAYER_TRIBES.map(tribe => {
    const speed = tribeTerrainWalkable(tribe.key, type) ? unitTerrainSpeedMultiplier({ tribe: tribe.key }, type) : 0;
    return [tribe.name, speed ? "이동 속도 " + Math.round(speed * 100) + "%" : "통행 불가"];
  });
  rows.push(["비행 유닛", "이동 속도 " + Math.round(unitTerrainSpeedMultiplier({ movementType: "flying" }, type) * 100) + "%"]);
  return rows;
}

export function codexCostText(cost) {
  if (!cost) return "—";
  return [cost.evolutionPoints ? cost.evolutionPoints + "P" : "", ...Object.entries(cost.materials).map(([key, amount]) =>
    RESOURCE_TYPES.find(resource => resource.key === key).name + " ×" + amount)].filter(Boolean).join(" · ");
}
