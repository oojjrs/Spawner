import { unitTerrainSpeedMultiplier } from "../server/attributes.mjs";
import { RESOURCE_TYPES } from "../server/resources.mjs";
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

export function codexAttributeDescription(attribute, tribe) {
  const gene = codexResolveEntry("attribute:" + (attribute.key || attribute.id));
  return gene?.value.description || attribute.description || "";
}

export function codexAttributeEffect(attribute, level, tribe) {
  const gene = codexResolveEntry("attribute:" + (attribute.key || attribute.id));
  return gene ? codexGeneDetails(gene.value, tribe).effect : attribute.effect || "";
}

export function codexAttributeDetails(attribute, tribe) {
  const gene = codexResolveEntry("attribute:" + (attribute.key || attribute.id));
  return {
    description: codexAttributeDescription(attribute, tribe),
    unlocks: gene ? PLAYER_TRIBES.map(value => [value.name, "둥지 Lv." + gene.value.grade]) : [],
    resources: gene?.key === "gather" ? RESOURCE_TYPES : []
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
  return cost.evolutionPoints ? cost.evolutionPoints + "P" : "";
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
  ["lifespan", "수명", "분"], ["health", "체력", ""], ["meleePower", "근접 공격력", ""], ["rangedPower", "원거리 공격력", ""],
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

const codexGeneDescriptions = Object.freeze({
  gather: "자기 종족의 전용 자원을 회당 1개 채집합니다. 운반·채집속도로 효율을 높이며 안테나 없이도 자원을 찾아 이동합니다.",
  capacity: "채집기관이 있는 유닛의 운반 한도를 늘립니다. 한 번에 채집하는 양은 바뀌지 않습니다.",
  harvestSpeed: "채집기관의 채집 시간을 줄입니다. 여러 조각의 효과가 합산되며 채집량은 회당 1개입니다.",
  health: "최대 체력을 늘립니다.",
  movement: "이동 사이의 휴지 시간을 30% 줄여준다.",
  regeneration: "교전 상태가 아닐 때 체력을 서서히 회복합니다. 교전이 끝난 뒤에는 5초 후부터 회복합니다.",
  vision: "자기 시야의 반경을 넓힙니다. 전사는 안테나가 없어도 이 범위에서 적을 찾아 추격합니다.",
  blade: "근접 공격을 사용합니다. 시야 안의 적을 찾아 싸우며 안테나가 있으면 시야 밖까지 수색합니다. 전사는 도주하지 않습니다.",
  power: "칼날의 근접 공격력을 높입니다. 분비기관의 원거리 공격과 공격기관 없는 몸체의 기본 공격에는 적용되지 않습니다.",
  speed: "칼날의 공격 간격을 줄입니다. 공격 준비와 연타 간격은 집중·연타속도로 줄입니다.",
  secretion: "사거리 3칸의 원거리 공격을 사용합니다. 안테나가 없으면 자기 시야 안의 적만 겨냥하며 칼날과 함께 배치하면 근접·원거리 공격을 모두 사용합니다. 전사는 도주하지 않습니다.",
  rangedPower: "분비기관의 원거리 공격력을 높입니다. 칼날의 근접 공격에는 적용되지 않습니다.",
  rangedSpeed: "분비기관의 공격 간격을 줄입니다. 공격 준비와 연타 간격은 집중·연타속도로 줄입니다.",
  antenna: "전사가 자기 시야 밖까지 수색하고 아군의 공유 시야에 있는 적을 추격하게 합니다. 안테나가 없어도 자기 시야 안의 적을 찾아 싸웁니다. 시야 반경은 늘리지 않으며 일꾼에게는 효과가 없습니다.",
  carapace: "방어력을 높입니다. 칼날·분비기관 없이도 기본 공격력 1로 시야 안의 적을 찾아 싸우며 안테나가 있으면 시야 밖까지 수색합니다. 전사는 도주하지 않습니다.",
  combo: "한 번의 공격에 추가 타격을 더합니다. 추가 타격은 기본 위력의 50%이며 연격숙련으로 강화합니다.",
  critical: "공격이 치명타가 될 확률을 높입니다. 치명타는 기본 위력의 200%이며 치명위력으로 강화합니다.",
  counter: "근접 공격을 회피하지 않고 받아내면 확률적으로 반격합니다. 반격에는 다시 반격하지 않습니다.",
  stun: "공격으로 피해를 주면 확률적으로 적을 기절시킵니다. 기본 지속 시간은 0.35초이며 종료 후 2초 동안 기절에 면역입니다.",
  bleed: "공격으로 피해를 주면 확률적으로 3초간 출혈을 일으킵니다. 기본 피해는 초당 1이며 다시 적용하면 지속 시간을 갱신합니다.",
  area: "같은 전투 칸의 다른 적에게도 피해를 줍니다. 추가 대상 수를 늘리며 추가 피해는 기본 60%입니다. 공격 사거리는 늘어나지 않습니다.",
  accuracy: "상대의 회피 확률을 낮춥니다. 패링과 방어본능의 발동 확률은 낮추지 않습니다.",
  tenacity: "자신에게 적용되는 기절 시간을 줄입니다. 기절에 걸릴 확률은 바꾸지 않습니다.",
  block: "일반 근접 공격과 원거리 공격을 확률적으로 막아 피해를 줄입니다. 기본 피해 감소율은 50%이며 방어숙련으로 강화합니다.",
  evasion: "근접·원거리 공격을 회피할 확률을 높입니다. 상대의 정밀 수치만큼 회피 확률이 줄어듭니다.",
  lifespan: "기본 수명은 5분이며 조각 하나마다 2분 늘어납니다. 수명이 끝나면 자연사합니다.",
  parry: "근접 일반 공격을 확률적으로 막아 피해를 없앱니다. 원거리 공격과 반격에는 적용되지 않습니다.",
  criticalPower: "치명타의 피해 배율을 높입니다. 치명 확률은 바뀌지 않습니다.",
  penetration: "공격할 때 상대 방어력을 일정 수치만큼 무시합니다. 비율 관통이 아니며 상대 방어력은 0보다 낮아지지 않습니다.",
  comboPower: "연타의 두 번째 이후 타격 위력을 높입니다. 첫 타격과 타격 횟수는 바뀌지 않습니다.",
  blockPower: "기본 50%에서 최대 90%까지 높아집니다.",
  counterPower: "반격의 피해 배율을 높입니다. 반격 확률은 바뀌지 않습니다.",
  reduction: "방어력으로 줄인 피해를 추가로 감소시킵니다.",
  stunTime: "기절이 발동했을 때의 지속 시간을 늘립니다. 기절 확률은 바뀌지 않으며 상대의 강인함에 따라 지속 시간이 줄어듭니다.",
  bleedPower: "출혈의 초당 피해를 높입니다. 출혈 확률과 3초 지속 시간은 바뀌지 않습니다.",
  areaPower: "범위공격이 추가 대상에게 주는 피해 비율을 높입니다. 추가 대상 수와 공격 사거리는 바뀌지 않습니다.",
  lifesteal: "직접 타격으로 실제 준 피해의 일부만큼 체력을 회복합니다. 범위 추가 피해와 출혈 피해에는 적용되지 않습니다.",
  reflection: "공격으로 실제 피해를 입으면 방어본능 적용 전 피해의 일부를 공격자에게 돌려줍니다. 근접 반격 피해에는 발동하지 않습니다.",
  comboSpeed: "한 번의 공격에서 연타 사이의 간격을 줄입니다. 첫 타격의 준비 시간과 다음 공격까지의 간격은 바뀌지 않습니다.",
  focus: "첫 타격까지의 준비 시간을 줄입니다. 연타 간격과 다음 공격까지의 간격은 바뀌지 않습니다."
});

export const CODEX_GENES = Object.freeze(ATTRIBUTE_DNA.catalog.map(gene => Object.freeze({
  ...gene, key: gene.id, name: dnaGeneNames[gene.id], requirements: codexGeneRequirements[gene.id] || [],
  description: codexGeneDescriptions[gene.id]
})));

export const CODEX_UNITS = Object.freeze([
  ...PLAYER_TRIBES.map(tribe => ({ ...tribe, player: true,
    image: tribe.starter || "DesignAssets/Units/starter-sprout-bean.png",
    description: ({ bean: "기본 능력과 성장 효율이 균형 잡힌 종족입니다.", spore: "원거리 공격력·공격 속도 성장이 뛰어납니다.",
      pebble: "기본 방어력과 체력·방어 성장이 뛰어납니다. 둥지 성장 비용이 25% 적습니다.", spring: "근접 공격·회피 성장이 뛰어납니다." })[tribe.key] })),
  ...CODEX_NEUTRAL_DESIGNS.map(design => ({ ...ENCOUNTER_TYPES.find(unit => unit.key === design.key), ...design,
    hostile: design.key === "spiny-back-beetle" || !!ENCOUNTER_TYPES.find(unit => unit.key === design.key)?.hostile,
    image: ENCOUNTER_TYPES.find(unit => unit.key === design.key)?.image || "DesignAssets/Units/spiny-back-beetle.png",
    role: creatureAttackRole(design.key), stats: NEUTRAL_UNIT_STATS[design.key] }))
].map(value => Object.freeze(value)));

export const CODEX_NESTS = Object.freeze([{ key: "colony", name: "군락 둥지", effect: "군락의 본둥지",
  description: "성장하면 체력·유닛 한도·DNA 보드와 조각 레벨이 늘어납니다. 몽돌의 성장 비용은 25% 적습니다." }]);

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
    const required = codexGeneRequirements[key]?.[0];
    if (required) add(required);
  }
  if (gene.requirements.length) add(gene.requirements[0]);
  const pieces = [...dependencies].map(key => ({ gene: key, grade: ATTRIBUTE_DNA.lookup.get(key).grade }));
  const base = ATTRIBUTE_DNA.stats(pieces, tribe);
  const stats = ATTRIBUTE_DNA.stats([...pieces, { gene: gene.id, grade: gene.grade }], tribe);
  let effects = codexStatFields.flatMap(([key, name, unit]) => {
    const difference = Number(((stats[key] - base[key]) / (key === "lifespan" ? 60 : 1)).toFixed(3));
    if (!Number.isFinite(difference) || difference === 0) return [];
    return [[name, (difference > 0 ? "+" : "") + difference + (unit === "%" ? "%p" : unit)]];
  });
  if (gene.id === "carapace") effects = effects.filter(([name]) => name === "방어력");
  if (gene.id === "antenna") effects = [["적 탐색", "자기 시야 밖까지 수색 · 공유 시야의 적 추격"]];
  if (gene.id === "blade") effects = [["근접 공격력", Number(stats.meleePower.toFixed(3))], ["근접 공속", Number(stats.meleeSpeed.toFixed(3)) + "회/초"]];
  if (gene.id === "secretion") effects = [["원거리 공격력", Number(stats.rangedPower.toFixed(3))], ["원거리 공속", Number(stats.rangedSpeed.toFixed(3)) + "회/초"]];
  if (gene.id === "gather") effects = [["채집량", stats.harvest + "개"], ["운반량", stats.capacity + "개"], ["채집 시간", stats.harvestTime + "초"]];
  if (gene.id === "movement") effects = [];
  if (gene.id === "harvestSpeed") effects = [["채집 시간", "-" + (stats.harvestReduction - base.harvestReduction) + "%"]];
  const limits = {
    harvestSpeed: "100%", movement: "100%",
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

export function codexGeneTribeEffects(gene) {
  const effects = PLAYER_TRIBES.map(tribe => [tribe.name, codexGeneDetails(gene, tribe.key).effect]);
  return new Set(effects.map(([, effect]) => effect)).size > 1 ? effects : [];
}

export function codexStatRows(stats) {
  return codexStatFields.filter(([key]) => Number.isFinite(stats[key]) && (stats[key] !== 0 || key === "harvestTime" && stats.harvest > 0))
    .map(([key, name, unit]) => [name, Number((stats[key] / (key === "lifespan" ? 60 : 1)).toFixed(3)) + unit]);
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
