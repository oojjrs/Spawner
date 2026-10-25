import { RESOURCE_TYPES, RESOURCE_HABITATS } from "../server/resources.mjs";
import { RESOURCE_ECONOMY, isEconomyHabitat } from "../server/economy.mjs";
import { unitTerrainSpeedMultiplier } from "../server/attributes.mjs";

export const TERRAIN_CODEX = [
  ["deep", "깊은 물", "deep-water", "깊은 수역입니다. 일반 유닛은 통행할 수 없습니다."],
  ["shallow", "얕은 물", "shallow-water", "육지와 맞닿은 얕은 수역입니다. 일반 유닛은 통행할 수 없습니다."],
  ["coast", "해안", "coast", "물과 육지가 만나는 가장자리입니다."],
  ["land", "평지", "land", "기본적인 육상 지형입니다."],
  ["grassland", "초원", "grassland", "풀로 덮인 지형입니다. 이슬방울과 풀섬유를 발견할 수 있습니다."],
  ["forest", "숲", "forest", "나무가 자라는 지형입니다. 목재를 채집할 수 있으며 가시 뿌리를 주의해야 합니다."],
  ["lowMountain", "낮은 산", "low-mountain", "일반 개체의 이동이 느려지는 산지입니다. 자갈과 광물을 발견할 수 있습니다."],
  ["highMountain", "높은 산", "high-mountain", "높은 산지입니다. 일반 개체의 이동이 느려지며 비행 개체는 영향을 받지 않습니다."],
  ["ridge", "능선", "ridge", "산의 높은 줄기입니다. 일반 개체의 이동이 느려지며 비행 개체는 영향을 받지 않습니다."],
  ["swamp", "늪", "swamp", "물기를 머금은 습한 땅입니다. 안쪽에서는 독 포자를 주의해야 합니다."]
].map(([key, name, image, description], type) => Object.freeze({
  key, name, type, description, image: "DesignAssets/Terrain/" + image + "-ground.png",
  effect: type < 2 ? "일반 유닛 통행 불가" : "일반 이동 속도 " + Math.round(unitTerrainSpeedMultiplier({}, type) * 100) + "%" +
    (type >= 6 && type <= 8 ? " · 비행 개체 100%" : "")
}));

export const HAZARD_CODEX = [
  { key: "poison-spore", name: "독 포자", hazard: 1, terrain: "swamp", image: "DesignAssets/Terrain/poison-spore-ground.png",
    effect: "이동 속도 50% · 지속 피해", description: "가만히 머물러도 초당 체력 0.3의 피해를 받습니다. 이동 속도가 절반으로 줄어듭니다." },
  { key: "thorn-root", name: "가시 뿌리", hazard: 2, terrain: "forest", image: "DesignAssets/Terrain/thorn-root-ground.png",
    effect: "이동 속도 50% · 이동·채집 중 피해", description: "이동 중 초당 체력 0.3, 채집 중 초당 체력 4의 피해를 받습니다. 이동 속도가 절반으로 줄어듭니다." }
].map(value => Object.freeze(value));

export function terrainCodexResources(type, version) {
  const terrain = TERRAIN_CODEX[type];
  if (!terrain) return [];
  return RESOURCE_TYPES.filter(resource => {
    if (resource.harvestLocked) return false;
    if (version >= 11 && RESOURCE_ECONOMY.some(policy => policy.key === resource.key)) return isEconomyHabitat(resource.key, type);
    return RESOURCE_HABITATS.some(habitat => habitat.key === resource.key && habitat.terrains.includes(terrain.key));
  });
}

export function terrainCodexCell(world, explored, x, y) {
  const size = world.size;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return null;
  const index = y * size + x, type = world.terrain[index];
  if (!explored.has(index) || !TERRAIN_CODEX[type]) return null;
  const hazard = HAZARD_CODEX.find(value => value.hazard === world.hazards?.[index]) || null;
  return { x, y, type, terrain: TERRAIN_CODEX[type], hazard,
    speed: type < 2 ? 0 : unitTerrainSpeedMultiplier({}, type) * (hazard ? 0.5 : 1) };
}
