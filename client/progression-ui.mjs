import { attributeCounts, attributeUpgradeCost, attributeUpgradeIssue, birthCost } from "../server/attributes.mjs";
import { buildingDefinition, buildingImage } from "../server/buildings.mjs";
import { resourceDefinition } from "../server/resources.mjs";

export function attributeEffect(attribute, level) {
  if (attribute.kind === "construction") return "건물 변태 " + Math.max(10, 15 * (1 - (level - 1) * .15)) + "초 · 이동 −" + [0, 20, 15, 10, 5][level] + "%";
  const effect = level > 1 && attribute.kind !== "harvest" ?
    attribute.stat + " +" + Number((attribute.bonuses?.[level] ?? attribute.bonus * level).toFixed(2)) + attribute.unit : attribute.effect;
  return attribute.harvests?.length ? [effect, "채집 시간 −" + [0, 25, 35, 45, 55][level] + "%", "대응 자원 운반량 +" + level + "개"].filter(Boolean).join(" · ") : effect;
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
  let colonySignature = "";
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
  const colony = document.createElement("details");
  colony.className = "colony-buildings";
  const summary = document.createElement("summary");
  const list = document.createElement("div");
  list.className = "colony-building-list";
  colony.append(summary, list);
  document.querySelector(".resource-storage").after(colony);

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

  function upgradeControl(draft, attributeKey) {
    const view = document.createElement("div");
    view.className = "attribute-upgrade";
    const level = attributeCounts(draft.slots, draft.attributeLevels)[attributeKey];
    const cost = attributeUpgradeCost(attributeKey, level + 1);
    const template = state.templates.find(entry => entry.id === draft.id);
    const lab = state.buildings?.some(building => building.key === "evolution-lab" && building.health > 0);
    const issue = !template?.slots.includes(attributeKey) ? "설계를 저장한 뒤 강화할 수 있습니다." : !lab ? "진화실이 필요합니다." :
      attributeUpgradeIssue(template, attributeKey, state.nestLevel, state.evolutionPoints, state.resourceInventory);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-action attribute-upgrade-button";
    button.dataset.upgradeAttribute = attributeKey;
    button.textContent = cost ? "강화 → Lv." + (level + 1) : "최대 Lv.4";
    button.disabled = draft.readOnly || !!state.ending || api.busy() || !api.online() || !!issue;
    button.dataset.help = issue || "재료를 사용해 강화합니다. 이후 태어나는 개체에 적용됩니다.";
    button.addEventListener("click", () => api.upgrade(draft, attributeKey));
    view.append(button);
    if (cost && !draft.readOnly) view.append(costView(cost));
    const hint = document.createElement("small");
    hint.textContent = level >= state.nestLevel ? "둥지 Lv." + state.nestLevel + " 한도" : !template ? "설계 저장 후 강화" : !lab ? "진화실 필요" : "";
    if (hint.textContent) view.append(hint);
    return view;
  }

  function updateAgent(agent) {
    const capable = agent?.health > 0 && agent.attributes?.construction > 0;
    construction.hidden = !capable;
    if (!capable) return;
    const signature = JSON.stringify([agent.id, state.tribe, agent.construction, agent.constructionError, state.nestLevel,
      state.resourceInventory, state.ending, api.busy(), api.online()]);
    if (agentSignature === signature) return;
    agentSignature = signature;
    construction.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "건물 변태";
    construction.append(heading);
    if (agent.construction) {
      const text = document.createElement("p");
      text.textContent = buildingDefinition(agent.construction.buildingKey).name + " · " +
        (agent.construction.state === "transforming" ? "변태 중" : "이동 중");
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "secondary-action";
      cancel.textContent = "취소";
      cancel.disabled = api.busy();
      cancel.addEventListener("click", async () => {
        await api.send({ type: "cancel-build", agentId: agent.id });
      });
      construction.append(text, cancel);
      return;
    }
    const status = document.createElement("p");
    status.textContent = "종족이 군락 상황에 맞춰 변태할 건물과 장소를 판단합니다.";
    construction.append(status);
    if (agent.constructionError) {
      const error = document.createElement("p");
      error.textContent = agent.constructionError;
      error.setAttribute("role", "status");
      construction.append(error);
    }
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
      picture.append(document.createElement("img"));
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
    const picture = overview.querySelector(".building-picture"), image = picture.querySelector("img");
    image.src = api.source(buildingImage(building.key, building.tribe || state.tribe));
    image.alt = definition.name;
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
        birth.disabled = !template || !!state.ending || api.busy() || !api.online() || state.evolutionPoints < birthCost(template, state.tribe);
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
    const buildings = (state.buildings || []).filter(building => building.health > 0);
    summary.textContent = "건물 · " + buildings.length;
    const signature = JSON.stringify([state.tribe, buildings]);
    if (signature === colonySignature) return;
    colonySignature = signature;
    list.replaceChildren();
    for (const building of buildings) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-action";
      const image = document.createElement("img");
      image.src = api.source(buildingImage(building.key, building.tribe || state.tribe));
      image.alt = "";
      const name = document.createElement("span");
      name.textContent = building.name + " · " + Math.ceil(building.health);
      button.append(image, name);
      button.addEventListener("click", () => api.selectBuilding(building));
      list.append(button);
    }
  }

  return { costView, upgradeControl, refresh, updateBuilding };
}
