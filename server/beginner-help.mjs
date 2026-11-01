import { ATTRIBUTES, isAttributeUnlocked, attributeCounts, birthCost } from "./attributes.mjs";
import { suggestTemplateName } from "./unit-template-names.mjs";
import { buildingDefinition } from "./buildings.mjs";
import { resourceDefinition, resourceHarvestRequirements } from "./resources.mjs";

export function constructionHelpTemplate(state, slots, kind) {
  if (!slots) slots = ["construction"];
  const construction = kind !== "military" && slots.includes("construction");
  const military = kind === "military";
  const requiredOnly = construction || military || kind === "harvest" || kind === "transport";
  slots = construction ? ["construction"] : military ? slots.filter(key => ATTRIBUTES.some(attribute => attribute.key === key && attribute.kind === "combat")) : [...slots];
  if (!requiredOnly && state.nestLevel >= 2 && slots.length < state.nestLevel) {
    const support = state.tribe === "pebble" ? "lifespan" : "feet";
    if (!slots.includes(support)) slots.push(support);
  }
  if (!requiredOnly && state.nestLevel >= 3 && slots.length < state.nestLevel) {
    const support = slots.includes("feet") ? "lifespan" : "feet";
    if (!slots.includes(support)) slots.push(support);
  }
  const previous = state.templates.filter(template => template.slots.every(key => isAttributeUnlocked(key, state.nestLevel, state.tribe)) && slots.every(key => template.slots.includes(key)) &&
    (requiredOnly ? template.slots.length === slots.length : !template.slots.includes("construction")))
    .sort((first, second) => birthCost(first, state.tribe) - birthCost(second, state.tribe) || first.slots.length - second.slots.length)[0];
  if (previous) return previous;
  const name = suggestTemplateName(slots, state.templates);
  return { id: state.nextTemplateId, name, productionRole:military ? "military" : "worker", slots: [...slots], attributeLevels: Object.fromEntries(slots.map(key => [key, 1])),
    unlockedAttributeLevels: Object.fromEntries(slots.map(key => [key, 1])), revision: 1 };
}

export function constructionHelp(state, tribe, enabled, goal, stock, world, support, foragers, harvestNeeds) {
  const building = buildingDefinition(goal?.buildingKey);
  if (!enabled || state.ending || !building) return null;
  const missing = Object.fromEntries(Object.entries(goal.cost.materials).map(([type, amount]) =>
    [type, Math.max(0, amount - (stock[type] || 0))]).filter(([, amount]) => amount > 1e-8));
  const ordinary = state.agents.filter(agent => agent.health > 0 && !agent.construction && !agent.slots.includes("construction"));
  const usable = ordinary.filter(agent => (!agent.stats || agent.health >= agent.stats.health * .6) &&
    (!Number.isFinite(agent.lifespan) || agent.bornAt + agent.lifespan - state.simSeconds > 30));
  const uncovered = Object.keys(missing).filter(type => {
    if (harvestNeeds?.includes(type)) return true;
    const required = resourceHarvestRequirements({ resourceType: type }, world, tribe);
    return required && !usable.some(agent => {
      const attributes = agent.attributes || attributeCounts(agent.slots, agent.attributeLevels);
      return (!Object.values(required).some(level => level > 0) || !foragers?.has(agent.id)) &&
        Object.entries(required).every(([key, level]) => level <= 0 || (attributes[key] || 0) >= level);
    });
  });
  let kind = "construction", resources = [], slots = ["construction"];
  if (support) { kind = "transport"; slots = ["strength"]; }
  else if (uncovered.length) {
    kind = "harvest"; resources = uncovered;
    slots = [...new Set(uncovered.flatMap(type => Object.entries(resourceHarvestRequirements({resourceType:type}, world, tribe)).filter(([,level]) => level > 0).map(([key]) => key)))];
    slots = slots.slice(0, state.nestLevel);
    resources = uncovered.filter(type => Object.entries(resourceHarvestRequirements({resourceType:type}, world, tribe)).filter(([,level]) => level > 0).every(([key]) => slots.includes(key)));
  } else if (Object.keys(missing).length || state.agents.some(agent => agent.health > 0 && agent.slots.includes("construction") &&
      (agent.construction || (!agent.stats || agent.health >= agent.stats.health * .6) &&
        (!Number.isFinite(agent.lifespan) || agent.bornAt + agent.lifespan - state.simSeconds > 60)))) return null;
  const template = constructionHelpTemplate({ ...state, tribe }, slots, kind);
  const cost = birthCost(template, tribe);
  const issue = state.evolutionPoints < cost ? "진화 포인트가 부족합니다." :
    !state.templates.includes(template) && state.templates.length >= 100 ? "설계는 최대 100개까지 저장할 수 있습니다." : null;
  const members = (kind === "construction" ? state.agents.filter(agent => agent.health > 0) : ordinary)
    .filter(agent => slots.every(key => agent.slots.includes(key))).map(agent => agent.id).sort().join(",");
  return { kind, step: building.key + ":" + kind + ":" + slots.join(",") + ":" + members,
    buildingKey: building.key, buildingName: building.name, name: template.name, slots: [...template.slots],
    attributeLevels: { ...template.attributeLevels }, resources, requirements: Object.entries(goal.cost.materials).map(([type, amount]) =>
      ({ type, name: resourceDefinition(type).name, amount, missing: missing[type] || 0 })),
    attributes: slots.map(key => ATTRIBUTES.find(attribute => attribute.key === key).name), cost,
    templateId: state.templates.includes(template) ? template.id : null, canProduce: !issue, issue };
}
