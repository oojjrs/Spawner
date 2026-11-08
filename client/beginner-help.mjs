import { NEST_LEVELS, nestUpgradeCost } from "../server/nests.mjs";
import { birthCost } from "../server/attributes.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { RESOURCE_ECONOMY } from "../server/economy.mjs";
import { resourceDefinition } from "../server/resources.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { DNA_STARTER_DESIGNS } from "./dna-starter-designs.mjs";

const combatGenes = new Set(["blade", "secretion", "carapace"]);
const hasGene = (unit, genes) => unit.dna?.pieces.some(piece => genes.has(piece.gene));
const gatherGenes = new Set(["gather"]);

function productionOffer(state, military) {
  const genes = military ? combatGenes : gatherGenes;
  const templates = state.templates.filter(template => hasGene(template, genes) && ATTRIBUTE_DNA.trace(template.dna.pieces, state.nestLevel).valid);
  templates.sort((a, b) => birthCost(a, state.tribe) - birthCost(b, state.tribe));
  let template = templates[0];
  if (!template) {
    const starter = DNA_STARTER_DESIGNS.find(entry => entry.id === (military ? "melee" : "gatherer"));
    let name = starter.name, suffix = 2;
    while (state.templates.some(entry => entry.name === name)) name = starter.name + " " + suffix++;
    template = { name, dna: { ...starter.design, level: state.nestLevel }, slots: [] };
  }
  const cost = birthCost(template, state.tribe);
  const issue = state.agents.filter(agent => agent.health > 0).length >= NEST_LEVELS[state.nestLevel - 1].unitCapacity ?
    "생산 가능한 개체 수를 모두 채웠어요." : state.evolutionPoints < cost ?
      "진화 포인트가 " + Math.ceil(cost - state.evolutionPoints) + "P 부족합니다." : "";
  return { label: template.name + " 생산 · " + cost + "P", disabled: !!issue || !template.id && state.templates.length >= 100,
    issue, command: template.id ? { type: "birth", templateId: template.id, combatPrimary: template.combatPrimary } :
      { type: "design", templateId: null, name: template.name, dna: template.dna, birth: true } };
}

export function beginnerHelpOffer(state, progress, signals) {
  if (!progress.enabled || state.ending || state.nestHealth <= 0 || !state.tribe) return null;
  const seen = new Set([...progress.completed, ...progress.dismissed]);
  const offers = [];
  const living = state.agents.filter(agent => agent.health > 0);
  const fighters = living.filter(agent => hasGene(agent, combatGenes) || !agent.dna && agent.slots?.some(key => combatGenes.has(key)));
  if (signals.nestAttacked) offers.push({ key: "nest-defense", message: "둥지가 공격받고 있어요. 전투 개체를 보충해보세요.",
    action: state.nestLevel >= 2 ? productionOffer(state, true) : null, guide: "nest:colony" });
  const combat = living.find(agent => agent.combat);
  if (combat) offers.push({ key: "combat", message: "전투가 시작됐어요. 위치를 확인해보세요.", position: combat, guide: "nest:colony" });
  if (living.filter(agent => hasGene(agent, gatherGenes) || !agent.dna && agent.stats?.capacity > 0).length < 2)
    offers.push({ key: "gatherer", message: "채집을 맡을 개체를 준비해볼까요?", action: productionOffer(state, false), guide: "attribute:gather" });
  if (state.nestLevel === 1 && state.evolutionPoints > 80) offers.push({ key: "upgrade", message: "둥지를 성장시킬 수 있습니다.",
    action: { label: "성장 · " + nestUpgradeCost(1, state.tribe) + "P", command: { type: "upgrade" } }, guide: "nest:colony" });
  if (state.nestLevel >= 2 && !fighters.length) offers.push({ key: "military", message: "둥지를 지킬 전사를 준비해볼까요?",
    action: productionOffer(state, true), guide: "nest:colony" });
  if (state.nestLevel >= 3) offers.push({ key: "board-" + state.nestLevel, message: "DNA 보드가 넓어졌어요. 새 조각으로 설계를 다듬어보세요.", guide: "nest:colony" });
  if (state.simSeconds < 60 || signals.replay) {
    const resource = resourceDefinition(RESOURCE_ECONOMY.find(entry => entry.tribe === state.tribe)?.key);
    const tribe = PLAYER_TRIBES.find(entry => entry.key === state.tribe);
    offers.push({ key: "intro", message: "채집꾼이 자원을 모아 둥지로 돌아옵니다.",
      detail: tribe.name + " · " + resource.name + "\n자기 종족의 전용 자원만 채집할 수 있습니다.", guide: "resource:" + resource.key });
  }
  return offers.find(offer => !seen.has(offer.key)) || (signals.replay ? offers.at(-1) : null);
}

export function createBeginnerHelp(document, onAction, onGuide, onProgress) {
  const panel = document.createElement("aside");
  panel.id = "beginner-help";
  panel.className = "beginner-help";
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.hidden = true;
  const message = document.createElement("p"), detail = document.createElement("p");
  message.className = detail.className = "beginner-help-message";
  detail.style.whiteSpace = "pre-line";
  const action = document.createElement("button"), guide = document.createElement("button"), close = document.createElement("button");
  for (const button of [action, guide, close]) button.type = "button";
  action.id = "beginner-help-action";
  guide.textContent = "방법 안내";
  close.textContent = "닫기";
  panel.append(message, detail, action, guide, close);
  document.querySelector(".app").append(panel);
  const enabled = document.getElementById("beginner-help-enabled"), replay = document.getElementById("beginner-help-replay");
  let roomId = null, progress = null, pending = 0, current = null, shownAt = 0, nextAt = 0, previousHealth = null, damagedAt = -Infinity;
  let replayRequested = false, acting = false;
  function save(patch) {
    const id = roomId;
    pending++;
    return Promise.resolve(onProgress(id, patch)).finally(() => { if (roomId === id) pending--; });
  }
  function hide() { panel.hidden = true; current = null; }
  function finish(completed, key) {
    key ||= current?.key;
    if (!key) return;
    const field = completed ? "completed" : "dismissed";
    if (!progress[field].includes(key)) progress[field].push(key);
    save({ [field]: [key] }).catch(() => {});
    hide();
    replayRequested = false;
    nextAt = performance.now() + 30000;
  }
  close.addEventListener("click", () => finish(false));
  action.addEventListener("click", async () => {
    if (!current?.action || action.disabled || acting) return;
    const id = roomId, offer = current;
    acting = true;
    action.disabled = true;
    try {
      if (await onAction(offer.action.command)) {
        if (roomId === id) finish(true, offer.key);
      }
    } finally { acting = false; }
  });
  guide.addEventListener("click", () => {
    if (!current) return;
    const offer = current;
    finish(true);
    onGuide(offer);
  });
  enabled.addEventListener("change", () => {
    if (!progress) return;
    progress.enabled = enabled.checked;
    hide();
    nextAt = performance.now() + 1500;
    save({ enabled: enabled.checked }).catch(() => {});
  });
  replay.addEventListener("click", () => {
    if (!progress) return;
    progress.enabled = true;
    progress.dismissed = [];
    enabled.checked = true;
    replayRequested = true;
    hide();
    nextAt = 0;
    save({ enabled: true, resetDismissed: true }).catch(() => {});
  });
  return {
    update(id, state, suppressed, busy) {
      const now = performance.now();
      if (id !== roomId) {
        roomId = id; progress = null; pending = 0; previousHealth = null; damagedAt = -Infinity;
        replayRequested = false; acting = false; hide(); nextAt = now + 3500;
      }
      if (!id || !state.beginnerHelp) { hide(); return; }
      if (!pending) progress = { enabled: state.beginnerHelp.enabled, completed: [...state.beginnerHelp.completed], dismissed: [...state.beginnerHelp.dismissed] };
      const completed = [];
      if (state.nestLevel > 1 && !progress.completed.includes("upgrade")) completed.push("upgrade");
      if (state.agents.some(agent => agent.health > 0 && hasGene(agent, combatGenes)) && !progress.completed.includes("military")) completed.push("military");
      if (completed.length) {
        progress.completed.push(...completed);
        save({ completed }).catch(() => {});
      }
      enabled.checked = progress.enabled;
      if (previousHealth !== null && state.nestHealth < previousHealth) damagedAt = now;
      previousHealth = state.nestHealth;
      const offer = beginnerHelpOffer(state, progress, { nestAttacked: now - damagedAt < 15000, replay: replayRequested });
      if (suppressed || !offer) { panel.hidden = true; if (!offer) current = null; return; }
      if (current && current.key !== offer.key) { hide(); nextAt = Math.max(nextAt, now + 1500); }
      if (now < nextAt) return;
      if (!current) { current = offer; shownAt = now; }
      else current = offer;
      if (panel.hidden) shownAt = now;
      if (now - shownAt > 16000 && !panel.matches(":hover") && !panel.contains(document.activeElement) && !acting) { finish(false); return; }
      if (message.textContent !== offer.message) message.textContent = offer.message;
      if (detail.textContent !== (offer.detail || "")) detail.textContent = offer.detail || "";
      detail.hidden = !offer.detail;
      action.hidden = !offer.action;
      if (offer.action) {
        action.textContent = offer.action.label;
        action.disabled = busy || acting || offer.action.disabled === true;
        action.title = offer.action.issue || "";
      }
      panel.dataset.offer = offer.key;
      panel.hidden = false;
    }
  };
}
