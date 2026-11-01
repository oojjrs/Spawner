import { isAttributeUnlocked, birthCost } from "../server/attributes.mjs";
import { buildingDefinition, buildingImage, constructionSeconds } from "../server/buildings.mjs";
import { createBuildingPreview } from "./building-idle.mjs";
import { resourceDefinition, resourceHarvestMultiplier } from "../server/resources.mjs";

export function attributeEffect(attribute, level, tribe) {
  if (attribute.kind === "construction") return "건물 변태 " + constructionSeconds("storage", 1) + "초 · 이동 −20%";
  const effect = attribute.effect;
  if (!attribute.harvests?.length) return effect;
  const resource = resourceDefinition(attribute.harvests[0]);
  const multiplier = resourceHarvestMultiplier(resource.key, { [attribute.key]: level }, tribe);
  return [effect, multiplier < 1 ? resource.name + " 채집 시간 −" + Math.round((1 - multiplier) * 100) + "%" : ""].filter(Boolean).join(" · ") || "채집 가능";
}

export function createHealthIcon(source) {
  const image = document.createElement("img");
  image.src = source("DesignAssets/UI/hp-heart.png");
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}

export function createProgressionUi(document, state, api) {
  let agentSignature = "";
  const construction = document.createElement("section");
  construction.id = "agent-construction";
  construction.className = "construction-menu";
  construction.hidden = true;
  document.getElementById("agent-details").after(construction);
  const details = document.createElement("section");
  details.id = "building-details";
  details.className = "building-details";
  details.hidden = true;
  construction.after(details);

  function costView(cost) {
    const view = document.createElement("span");
    view.className = "material-cost";
    if (cost.evolutionPoints) {
      const point = document.createElement("span");
      point.textContent = "진화 " + cost.evolutionPoints;
      point.classList.toggle("is-insufficient", state.evolutionPoints < cost.evolutionPoints);
      view.append(point);
    }
    for (const [key, amount] of Object.entries(cost.materials)) {
      const definition = resourceDefinition(key);
      const item = document.createElement("span");
      const image = document.createElement("img");
      image.src = api.source(definition.carryImage);
      image.alt = definition.name;
      const count = document.createElement("strong");
      const owned = state.resourceInventory?.[key] || 0;
      count.textContent = owned + "/" + amount;
      item.dataset.help = definition.name + " · 보유 " + owned + " / 필요 " + amount;
      item.tabIndex = 0;
      item.classList.toggle("is-insufficient", owned < amount);
      item.append(image, count);
      view.append(item);
    }
    return view;
  }

  function updateAgent(agent) {
    construction.hidden = !agent?.construction;
    if (construction.hidden) return;
    const signature = JSON.stringify([agent.id, agent.construction, api.busy()]);
    if (agentSignature === signature) return;
    agentSignature = signature;
    construction.replaceChildren();
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-action";
    cancel.textContent = "취소";
    cancel.disabled = api.busy();
    api.setHelp(cancel, buildingDefinition(agent.construction.buildingKey).name + " · " +
      (agent.construction.state === "transforming" ? "변태 중" : "이동 중"));
    cancel.addEventListener("click", () => api.send({ type: "cancel-build", agentId: agent.id }));
    construction.append(cancel);
  }

  function updateBuilding(building) {
    details.hidden = !building;
    if (!building) return;
    const definition = buildingDefinition(building.key);
    const signature = JSON.stringify([building, state.tribe, state.templates, state.evolutionPoints, state.ending, api.busy(), api.online()]);
    if (details.dataset.signature === signature) return;
    details.dataset.signature = signature;
    let overview = details.querySelector(".building-overview");
    if (!overview) {
      overview = document.createElement("div");
      overview.className = "building-overview";
      const picture = document.createElement("span");
      picture.className = "building-picture";
      picture.tabIndex = 0;
      const health = document.createElement("span");
      health.className = "building-health";
      health.tabIndex = 0;
      health.append(createHealthIcon(api.source));
      const value = document.createElement("span");
      value.className = "building-health-value";
      value.append(document.createElement("strong"), document.createElement("span"));
      health.append(value);
      overview.append(picture, health);
      details.append(overview);
    }
    const picture = overview.querySelector(".building-picture"), tribe = building.tribe || state.tribe;
    const imageKey = tribe + ":" + building.key;
    if (picture.dataset.key !== imageKey) {
      picture.replaceChildren(createBuildingPreview({ ...building, tribe }, api.source(buildingImage(building.key, tribe))));
      picture.dataset.key = imageKey;
    }
    const health = overview.querySelector(".building-health");
    health.querySelector("strong").textContent = Math.ceil(building.health);
    health.querySelector(".building-health-value > span").textContent = "/" + building.maxHealth;
    api.setHelp(picture, definition.name + "\n" + definition.description);
    api.setHelp(health, "체력 " + Math.ceil(building.health) + "/" + building.maxHealth);
    details.querySelector("select")?.remove();
    details.querySelector("button")?.remove();
    if (building.key === "outpost") {
      const templates = document.createElement("select");
      templates.setAttribute("aria-label", "전초둥지에서 태어날 설계");
      for (const template of state.templates) {
        const option = document.createElement("option");
        option.value = template.id;
        option.textContent = template.name + " · 진화 " + birthCost(template, state.tribe);
        if (template.id === state.selectedTemplateId) option.selected = true;
        templates.append(option);
      }
      const birth = document.createElement("button");
      birth.type = "button";
      birth.className = "primary-action";
      birth.textContent = "여기서 탄생";
      function updateBirth() {
        const template = state.templates.find(entry => entry.id === Number(templates.value));
        birth.disabled = !template || !!state.ending || api.busy() || !api.online() || state.evolutionPoints < birthCost(template, state.tribe) || template.slots.some(key => !isAttributeUnlocked(key, state.nestLevel, state.tribe));
      }
      templates.addEventListener("change", updateBirth);
      birth.addEventListener("click", () => api.send({ type: "birth", templateId: Number(templates.value), buildingId: building.id }));
      updateBirth();
      details.append(templates, birth);
    }
  }

  function refresh() {
    updateAgent(state.selection?.kind === "agent" ? state.selection.target : null);
    updateBuilding(state.selection?.kind === "building" ? state.selection.target : null);
  }

  return { costView, refresh, updateBuilding };
}
