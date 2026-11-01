import { RESOURCE_TYPES, RESOURCE_HABITATS } from "../server/resources.mjs";
import { RESOURCE_ECONOMY, isEconomyHabitat } from "../server/economy.mjs";
import { unitTerrainSpeedMultiplier } from "../server/attributes.mjs";
import { tribeTerrainWalkable } from "../server/tribe-environment.mjs";

export const TERRAIN_CODEX = [
  ["deep", "깊은 물", "deep-water", "지상 유닛은 통행할 수 없습니다."],
  ["shallow", "얕은 물", "shallow-water", "지상 유닛은 통행할 수 없습니다."],
  ["coast", "해안", "coast", "물과 육지가 만나는 가장자리입니다."],
  ["land", "평지", "land", "기본적인 육상 지형입니다."],
  ["grassland", "초원", "grassland", "풀로 덮인 지형입니다. 이슬방울과 풀섬유를 발견할 수 있습니다."],
  ["forest", "숲", "forest", "나무가 자라는 지형입니다."],
  ["lowMountain", "낮은 산", "low-mountain", "지상 유닛의 이동 속도가 줄어듭니다. 자갈과 광물을 발견할 수 있습니다."],
  ["highMountain", "높은 산", "high-mountain", "지상·비행 유닛의 이동 속도가 줄어듭니다."],
  ["ridge", "능선", "ridge", "몽돌을 제외한 지상 유닛의 이동 속도가 줄어듭니다."],
  ["swamp", "늪", "swamp", "지상 유닛의 이동 속도가 줄어듭니다. 몽돌은 통행할 수 없습니다."],
  ["ford", "여울", "ford", "물을 건널 수 있는 길입니다. 샘방울을 제외한 지상 유닛의 이동 속도가 줄어듭니다."]
].map(([key, name, image, description], type) => {
  const groundSpeed = Math.round(unitTerrainSpeedMultiplier({}, type) * 100);
  const flyingSpeed = Math.round(unitTerrainSpeedMultiplier({ movementType: "flying" }, type) * 100);
  return Object.freeze({
    key, name, type, description, image: "DesignAssets/Terrain/" + image + "-ground.png",
    effect: !tribeTerrainWalkable("bean", type) ? "지상 유닛 통행 불가" : "기본 이동 속도 " + groundSpeed + "%" +
      (groundSpeed !== flyingSpeed ? " · 비행 유닛 " + flyingSpeed + "%" : "")
  });
});

export const HAZARD_CODEX = [];

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
    speed: !tribeTerrainWalkable("bean", type) ? 0 : unitTerrainSpeedMultiplier({}, type) * (hazard ? 0.5 : 1) };
}
