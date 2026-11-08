import { attributeUnlockLevel, unitStats, unitTravelSpeed, unitTerrainSpeedMultiplier } from "../server/attributes.mjs";
import { RESOURCE_TYPES, resourceHarvestMultiplier } from "../server/resources.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { tribeTerrainWalkable } from "../server/tribe-environment.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { DNA_COMBAT_RULES } from "../server/dna-combat-stats.mjs";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";
import { NEUTRAL_UNIT_STATS } from "../server/neutral-unit-stats.mjs";
import { creatureAttackRole } from "../server/creature-attack-role.mjs";
import { RESOURCE_ECONOMY, RESOURCE_NODE_AMOUNT } from "../server/economy.mjs";
import { dnaGeneNames } from "./dna-editor.mjs";
import { CODEX_NEUTRAL_DESIGNS } from "./codex-neutral-data.mjs";
import { TERRAIN_CODEX, terrainCodexResources } from "./terrain-codex.mjs";
import { BURROW_CODEX } from "./burrow-codex.mjs";

export const CODEX_ATTRIBUTE_DESCRIPTIONS = Object.freeze({
  antenna: "유닛의 시야 반경이 늘어납니다.",
  strength: "한 번에 채집해 운반하는 자원의 양을 늘립니다.",
  feet: "이동 속도를 높입니다.",
  blade: "공격할 때의 전투력을 높입니다.",
  piercing: "상대 갑피의 피해 감소를 무시합니다.",
  carapace: "받는 전투 피해를 줄입니다. 관통 공격에는 효과가 줄어듭니다.",
});

const CODEX_NATIVE_ATTRIBUTE_DESCRIPTIONS = Object.freeze({
  blade: "공격할 때의 전투력을 높입니다.\n목재를 더 빠르게 채집할 수 있습니다.",
  piercing: "상대 갑피의 피해 감소를 무시합니다.\n자갈을 더 빠르게 채집할 수 있습니다."
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
    feet: "이동 +" + codexNumber(unitTravelSpeed({ tribe, stats }, 0) - unitTravelSpeed({ tribe, stats: base }, 0)) + "칸/초",
    blade: "공격 전투력 +" + stats.attackBonus,
    piercing: "갑피 관통 " + Math.round(stats.armorPenetration * 100) + "%",
    carapace: "받는 피해 −" + Math.round(stats.damageReduction * 100) + "%",
  };
  const effect = [stats.combatStrength > base.combatStrength ? "기본 전투력 +" + (stats.combatStrength - base.combatStrength) : "", effects[attribute.key] || ""].filter(Boolean).join(" · ");
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

const codexGeneRequirements = Object.freeze({
  capacity: ["gather"], harvestSpeed: ["gather"], antenna: ["blade", "secretion", "carapace"],
  power: ["blade"], speed: ["blade"], rangedPower: ["secretion"], rangedSpeed: ["secretion"],
  combo: ["blade", "secretion"], critical: ["blade", "secretion"], counter: ["blade", "secretion", "carapace"],
  stun: ["blade", "secretion"], bleed: ["blade", "secretion"], area: ["blade", "secretion"],
  accuracy: ["blade", "secretion"], criticalPower: ["critical"], penetration: ["blade", "secretion"],
  comboPower: ["combo"], counterPower: ["counter"], blockPower: ["block"], lifesteal: ["blade", "secretion"],
  comboSpeed: ["combo"], focus: ["blade", "secretion"],
  stunTime: ["stun"], bleedPower: ["bleed"], areaPower: ["area"]
});

const codexStatFields = [
  ["health", "체력", ""], ["meleePower", "근접 공격력", ""], ["rangedPower", "원거리 공격력", ""],
  ["meleeSpeed", "근접 공속", "회/초"], ["rangedSpeed", "원거리 공속", "회/초"], ["hits", "공격횟수", "회"],
  ["armor", "방어력", ""], ["capacity", "운반량", "개"], ["harvest", "채집량", "개"],
  ["harvestTime", "채집 시간", "초"], ["movement", "이동", "칸/초"], ["vision", "시야", "칸"],
  ["parry", "패링 확률", "%"], ["block", "방어 확률", "%"], ["evasion", "회피 확률", "%"],
  ["comboPower", "연격 위력", "%"], ["critical", "치명 확률", "%"], ["criticalPower", "치명 위력", "%"],
  ["accuracy", "정밀", "%"], ["penetration", "방어 관통", ""], ["blockPower", "방어 위력", "%"],
  ["counter", "반격 확률", "%"], ["counterPower", "반격 위력", "%"], ["tenacity", "강인함", "%"],
  ["reduction", "피해 감소", "%"], ["loadSpeed", "만재 이동 속도", "%"], ["stun", "기절 확률", "%"],
  ["stunTime", "기절 시간", "초"], ["bleed", "출혈 확률", "%"], ["bleedPower", "출혈 위력", ""],
  ["area", "추가 대상", ""], ["areaPower", "범위 위력", "%"], ["lifesteal", "흡혈", "%"],
  ["reflection", "반사", "%"], ["regeneration", "체력 재생", "/초"], ["comboSpeed", "연타 간격", "초"], ["focus", "공격 준비", "초"]
];

export const CODEX_GENES = Object.freeze(ATTRIBUTE_DNA.catalog.map(gene => Object.freeze({
  ...gene, key: gene.id, name: dnaGeneNames[gene.id], requirements: codexGeneRequirements[gene.id] || [],
  description: gene.id === "gather" ? "자기 종족의 전용 자원을 채집합니다. 채집량은 회당 1개이며 운반·채집속도 조각으로 효율을 높입니다." :
    gene.id === "blade" ? "근접 선제공격을 사용할 수 있습니다." :
    gene.id === "secretion" ? "원거리 선제공격을 사용할 수 있습니다. 칼날과 함께 배치하면 근접·원거리 공격을 모두 사용합니다." :
    "조각의 레벨·개수와 종족별 성장 효율을 적용합니다."
})));

export const CODEX_UNITS = Object.freeze([
  ...PLAYER_TRIBES.map(tribe => ({ ...tribe, player: true,
    image: tribe.starter || "DesignAssets/Units/starter-sprout-bean.png",
    description: ({ bean: "기본 능력과 성장 효율이 균형 잡힌 종족입니다.", spore: "원거리 공격력·공격 속도 성장이 뛰어납니다.",
      pebble: "기본 방어력과 체력·방어 성장이 뛰어납니다. 둥지 성장 비용이 25% 적습니다.", spring: "근접 공격·회피·이동 성장이 뛰어납니다." })[tribe.key] })),
  ...CODEX_NEUTRAL_DESIGNS.map(design => ({ ...ENCOUNTER_TYPES.find(unit => unit.key === design.key), ...design,
    hostile: design.key === "spiny-back-beetle" || !!ENCOUNTER_TYPES.find(unit => unit.key === design.key)?.hostile,
    image: ENCOUNTER_TYPES.find(unit => unit.key === design.key)?.image || "DesignAssets/Units/spiny-back-beetle.png",
    role: creatureAttackRole(design.key), stats: NEUTRAL_UNIT_STATS[design.key] }))
].map(value => Object.freeze(value)));

export const CODEX_NESTS = Object.freeze([{ key: "colony", name: "군락 둥지", effect: "군락의 본둥지",
  description: "성장하면 체력·유닛 한도·DNA 보드와 조각 레벨·보관량이 늘어납니다. 몽돌의 성장 비용은 25% 적습니다." }]);

export const CODEX_GROUPS = Object.freeze([
  ["unit", "유닛", CODEX_UNITS], ["attribute", "DNA", CODEX_GENES], ["resource", "자원", RESOURCE_TYPES],
  ["nest", "둥지", CODEX_NESTS], ["burrow", "굴", BURROW_CODEX], ["terrain", "지형", TERRAIN_CODEX]
]);

export function codexResolveEntry(entry) {
  if (typeof entry !== "string") return null;
  let [kind, key] = entry.split(":");
  if (kind === "attribute") key = ({ strength: "capacity", feet: "movement", piercing: "penetration" })[key] || key;
  const value = CODEX_GROUPS.find(group => group[0] === kind)?.[2].find(value => value.key === key);
  return value ? { kind, key, value } : null;
}

export function codexGeneDetails(gene, tribe) {
  const dependencies = new Set();
  function add(key) {
    if (dependencies.has(key)) return;
    dependencies.add(key);
    for (const required of codexGeneRequirements[key] || []) add(required);
  }
  for (const key of gene.requirements) add(key);
  const pieces = [...dependencies].map(key => ({ gene: key, grade: ATTRIBUTE_DNA.lookup.get(key).grade }));
  const base = ATTRIBUTE_DNA.stats(pieces, tribe);
  const stats = ATTRIBUTE_DNA.stats([...pieces, { gene: gene.id, grade: gene.grade }], tribe);
  let effects = codexStatFields.flatMap(([key, name, unit]) => {
    const difference = Number((stats[key] - base[key]).toFixed(3));
    if (!Number.isFinite(difference) || difference === 0) return [];
    return [[name, (difference > 0 ? "+" : "") + difference + (unit === "%" ? "%p" : unit)]];
  });
  if (gene.id === "blade") effects = [["근접 공격력", Number(stats.meleePower.toFixed(3))], ["근접 공속", Number(stats.meleeSpeed.toFixed(3)) + "회/초"]];
  if (gene.id === "secretion") effects = [["원거리 공격력", Number(stats.rangedPower.toFixed(3))], ["원거리 공속", Number(stats.rangedSpeed.toFixed(3)) + "회/초"]];
  if (gene.id === "gather") effects = [["채집량", stats.harvest + "개"], ["운반량", stats.capacity + "개"], ["채집 시간", stats.harvestTime + "초"]];
  const limits = {
    speed: DNA_COMBAT_RULES.maxActionRate + "회/초", rangedSpeed: DNA_COMBAT_RULES.maxActionRate + "회/초",
    vision: "12칸", critical: "90%", parry: "60%", block: "90%", blockPower: "90%", evasion: "60%",
    accuracy: "60%", tenacity: "75%", counter: "100%", reduction: "40%", stun: "60%", stunTime: "1.5초",
    bleed: "75%", area: "8", areaPower: "100%", lifesteal: "40%", reflection: "75%",
    comboSpeed: "최소 0.06초", focus: "최소 0.08초", criticalPower: "500%", counterPower: "300%", comboPower: "100%"
  };
  return { effects, rows: [["해금", "둥지 Lv." + gene.grade], ["조각 비용", gene.price + "P"],
    ["배치", gene.category === "organ" ? "기관별 최대 1개" : "보드 안에서 중첩 가능"],
    ...(gene.requirements.length ? [["필요 DNA", gene.requirements.map(key => dnaGeneNames[key]).join(gene.requirements.includes("blade") && gene.requirements.includes("secretion") ? " 또는 " : " · ")]] : []),
    ...(limits[gene.id] ? [["상한", limits[gene.id]]] : []), ...effects],
    effect: effects.map(([name, value]) => name + " " + value).join(" · ") || gene.description };
}

export function codexStatRows(stats) {
  return codexStatFields.filter(([key]) => Number.isFinite(stats[key]) && stats[key] !== 0)
    .map(([key, name, unit]) => [name, Number(stats[key].toFixed(3)) + unit]);
}

export function codexResourceDetails(resource) {
  const tribe = PLAYER_TRIBES.find(tribe => RESOURCE_ECONOMY.some(policy => policy.key === resource.key && policy.tribe === tribe.key));
  return { tribe, rows: [["전용 종족", tribe.name], ["필요 DNA", dnaGeneNames.gather],
    ["기본 채집", "1개 / " + ATTRIBUTE_DNA.stats([{ gene: "gather", grade: 1 }], tribe.key).harvestTime + "초"],
    ["매장량", RESOURCE_NODE_AMOUNT.toLocaleString("ko-KR") + "개"], ["재생", "없음"]],
    description: tribe.name + "만 채집할 수 있습니다. 다른 종족의 자원은 채집하지 않습니다." };
}

export function codexRelatedEntries(entry, version) {
  version = Math.max(11, version || 0);
  const { kind, key, value } = entry;
  const links = [];
  if (kind === "attribute") {
    links.push(...value.requirements.map(key => "attribute:" + key));
    links.push(...CODEX_GENES.filter(gene => gene.requirements.includes(key)).map(gene => "attribute:" + gene.key));
    if (["gather", "capacity", "harvestSpeed"].includes(key)) links.push(...RESOURCE_TYPES.map(resource => "resource:" + resource.key));
    links.push("nest:colony");
  }
  if (kind === "resource") {
    links.push("unit:" + codexResourceDetails(value).tribe.key, "attribute:gather", "attribute:capacity", "attribute:harvestSpeed");
    links.push(...TERRAIN_CODEX.filter(terrain => terrainCodexResources(terrain.type, version).some(resource => resource.key === key)).map(terrain => "terrain:" + terrain.key));
  }
  if (kind === "unit" && value.player) {
    links.push("resource:" + RESOURCE_ECONOMY.find(policy => policy.tribe === key).key, "nest:colony", "attribute:gather", "attribute:blade", "attribute:secretion", "attribute:carapace", "attribute:antenna");
  }
  if (kind === "unit" && key === "spiny-back-beetle") links.push(...BURROW_CODEX.map(burrow => "burrow:" + burrow.key));
  if (kind === "burrow") links.push("unit:spiny-back-beetle");
  if (kind === "nest") links.push(...PLAYER_TRIBES.map(tribe => "unit:" + tribe.key));
  if (kind === "terrain") {
    links.push(...terrainCodexResources(value.type, version).map(resource => "resource:" + resource.key));
    if (value.type >= 2) links.push("attribute:movement");
  }
  return [...new Set(links)];
}
