import { COMBAT_LAB_APPEARANCES, combatLabPlayable, combatLabAppearance, combatLabWithAppearance } from "./combat-lab-appearances.mjs";
import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { SIMULATION_STATS, DEFAULT_SIMULATION_RULES, deriveSimulationStats, createSimulationTrial } from "./combat-simulation.mjs";
import { createCombatStage } from "./combat-stage.mjs";
import { TRIBE_COMBAT_ROLES, tribeCombatTemplate } from "../server/tribe-combat-templates.mjs";

const sides = ["left", "right"], elements = {}, inputs = {};
const builds = Object.fromEntries(sides.map((side, index) => [side, combatLabWithAppearance(
  { key: index ? "spore" : "bean", name: index ? "오른쪽" : "왼쪽" }, "blade-carapace")]));
const rosters = Object.fromEntries(sides.map(side => [side, [builds[side]]]));
const selected = { left: 0, right: 0 };
const rules = { ...DEFAULT_SIMULATION_RULES };
const audio = globalThis.SpawnerCombatAudio.createPlayer(), audioPlayback = globalThis.SpawnerCombatAudio.create();
let trial, playing = false, lastFrame = 0, controlId = 0;
let stageReady = false, stagePreparation = null, stageError = null;
const main = document.querySelector("main");
main.replaceChildren();
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function control(parent, label, element) {
  const wrapper = node("label", null, "field");
  const caption = node("span", label); caption.id = "combat-field-" + controlId++;
  element.setAttribute("aria-labelledby", caption.id);
  wrapper.append(caption, element); parent.append(wrapper); return element;
}
function select(options, value) {
  const element = document.createElement("select");
  for (const [key, label] of options) element.append(new Option(label, key));
  element.value = value; return element;
}
function button(parent, label, action) {
  const element = node("button", label); element.type = "button"; element.addEventListener("click", () => { audio.resume(); action(); }); parent.append(element); return element;
}
const header = node("header");
const title = node("div"); title.append(node("div", "SPAWNER / COMBAT LAB", "eyebrow"), node("h1", "전투 실험실"));
elements.status = node("output", "대결 준비", "status"); elements.status.setAttribute("aria-live", "polite"); header.append(title, elements.status); main.append(header);
const stage = node("section", null, "stage"); main.append(stage);
const stageHud = node("div", null, "stage-hud"); stage.append(stageHud);
const stageCenter = node("div", null, "stage-center"); stageCenter.append(elements.status); stageHud.append(stageCenter);
elements.dice = button(stageCenter, "🎲", () => {
  for (const side of sides) {
    const previous = rosters[side], used = new Set();
    rosters[side] = Array.from({ length: 5 }, (_, slot) => {
      const choices = COMBAT_LAB_UNITS.filter(unit => unit.key !== previous[slot]?.key && !used.has(unit.key));
      const key = choices[Math.floor(Math.random() * choices.length)].key;
      used.add(key);
      return combatLabWithAppearance({ key }, "blade-carapace");
    });
    selected[side] = 0;
    selectBuild(side);
  }
  changed();
});
elements.dice.className = "stage-dice"; elements.dice.setAttribute("aria-label", "주사위");
// Use actual simulation distance so dual-capability builds can be tested in
// both melee and ranged combat without changing their DNA or stats.
elements.distance = control(stageCenter, "시작 거리", select([["1", "근접"], ["2", "원거리"]], "1"));
elements.distance.addEventListener("change", changed);
const stageView = node("div", null, "stage-view");
elements.stage = node("canvas"); elements.stage.width = 1100; elements.stage.height = 400;
elements.stage.setAttribute("aria-hidden", "true"); stageView.append(elements.stage); stage.append(stageView);
const combatStage = createCombatStage(elements.stage);
for (const side of sides) {
  inputs[side] = {};
  const hud = node("div", null, "stage-side " + side); stageHud.append(hud);
  hud.append(node("h2", builds[side].name));
  const roster = control(hud, "편성", select([["0", builds[side].name + " 1"]], "0"));
  elements[side + "Roster"] = roster;
  roster.addEventListener("change", () => { selected[side] = Number(roster.value); selectBuild(side); render(); });
  const rosterActions = node("div", null, "roster-actions");
  button(rosterActions, "유닛 추가", () => {
    rosters[side].push(structuredClone(builds[side])); selected[side] = rosters[side].length - 1; selectBuild(side); changed();
  });
  elements[side + "Remove"] = button(rosterActions, "유닛 제거", () => {
    if (rosters[side].length <= 1) return;
    rosters[side].splice(selected[side], 1); selected[side] = Math.min(selected[side], rosters[side].length - 1); selectBuild(side); changed();
  });
  hud.append(rosterActions);
  const appearance = control(hud, "외형", select(COMBAT_LAB_UNITS.map(unit => [unit.key, unit.name]), builds[side].key));
  appearance.addEventListener("change", () => {
    rosters[side][selected[side]] = tribeCombatTemplate(appearance.value, builds[side].template) || combatLabWithAppearance({ key: appearance.value }, "blade-carapace");
    selectBuild(side); changed();
  }); inputs[side].appearance = appearance;
  const dnaAppearance = control(hud, "DNA 외형", select(combatLabPlayable(builds[side].key) ? COMBAT_LAB_APPEARANCES.filter(([key]) => key !== "native") : [["native", "기본"]], combatLabAppearance(builds[side])));
  inputs[side].dnaAppearance = dnaAppearance;
  dnaAppearance.disabled = !combatLabPlayable(builds[side].key);
  dnaAppearance.addEventListener("change", () => {
    if (!Array.from(dnaAppearance.options).some(option => option.value === dnaAppearance.value)) return;
    rosters[side][selected[side]] = combatLabWithAppearance(builds[side], dnaAppearance.value);
    selectBuild(side); changed();
  });
  const template = control(hud, "4레벨 템플릿", select([["", "기본"], ...TRIBE_COMBAT_ROLES.map(role => [role.key, role.name])], ""));
  inputs[side].template = template;
  template.disabled = !combatLabPlayable(builds[side].key);
  template.addEventListener("change", () => {
    if (!combatLabPlayable(builds[side].key)) return;
    const build = template.value ? tribeCombatTemplate(builds[side].key, template.value) : combatLabWithAppearance(builds[side], combatLabAppearance(builds[side]));
    if (!build) return;
    rosters[side][selected[side]] = build;
    selectBuild(side); changed();
  });
  const gauge = node("div", null, "action-bar"); elements[side + "Gauge"] = node("i"); gauge.append(elements[side + "Gauge"]); hud.append(gauge);
  elements[side + "Reaction"] = node("output", null, "reaction"); hud.append(elements[side + "Reaction"]);
}
const actions = node("div", null, "actions");
elements.step = button(actions, "다음 사건", () => { playing = false; trial?.step(); render(); });
elements.run = button(actions, "자동 전투", () => { playing = !playing; render(); });
elements.finish = button(actions, "끝까지", () => { playing = false; trial?.finish(); render(); });
button(actions, "초기화", reset);
const stageFooter = node("div", null, "stage-footer");
elements.phase = node("output", null, "phase"); stageFooter.append(actions, elements.phase); stage.append(stageFooter);
function selectBuild(side) {
  builds[side] = rosters[side][selected[side]];
  inputs[side].appearance.value = builds[side].key;
  const variants = combatLabPlayable(builds[side].key) ? COMBAT_LAB_APPEARANCES.filter(([key]) => key !== "native") : [["native", "기본"]];
  inputs[side].dnaAppearance.replaceChildren(...variants.map(([value, label]) => {
    const option = node("option", label); option.value = value; return option;
  }));
  inputs[side].dnaAppearance.value = combatLabAppearance(builds[side]);
  inputs[side].dnaAppearance.disabled = !combatLabPlayable(builds[side].key);
  inputs[side].template.value = builds[side].template || "";
  inputs[side].template.disabled = !combatLabPlayable(builds[side].key);
}
function rosterSettings(side) {
  return rosters[side].map((build, index) => ({ ...structuredClone(build), name: (side === "left" ? "왼쪽 " : "오른쪽 ") + (index + 1) }));
}
function settings(seed) { return {left:rosterSettings("left"),right:rosterSettings("right"),selected:{...selected},rules:{...rules},seed,random:true,first:"simultaneous",distance:Number(elements.distance.value),support:false}; }
function changed() { reset(); }
function settingError(error) { return /[가-힣]/.test(error.message) ? error.message : "입력 수치와 규칙의 상한·최소값을 확인해 주세요."; }
function reset() {
  playing=false; audio.stop(); globalThis.SpawnerCombatAudio.reset(audioPlayback);
  try {
    trial=createSimulationTrial(settings(1));
    elements.status.textContent="대결 준비";
  } catch(error) { trial=null;elements.status.textContent=settingError(error); }
  stageReady = false;
  stageError = null;
  const preparingTrial = trial;
  const preparation = combatStage.prepare(trial).then(() => {
    if (trial === preparingTrial) stageReady = !!trial;
  }, error => {
    if (trial === preparingTrial) stageError = error;
  }).finally(() => {
    if (stagePreparation === preparation) { stagePreparation = null; render(); }
  });
  stagePreparation = preparation;
  render();
}
function render() {
  elements.run.textContent=playing?"일시정지":"자동 전투";
  stage.dataset.state = !trial ? "invalid" : trial.result()?.reason ? "ended" : playing ? "playing" : "paused";
  for(const side of sides) {
    try {
      const stats=deriveSimulationStats(builds[side],rules),agent=trial?.agents.find(agent => agent.ownerId === side && agent.slot === selected[side]);
      const options = rosters[side].map((build, index) => [String(index), (side === "left" ? "왼쪽 " : "오른쪽 ") + (index + 1)]);
      const roster = elements[side + "Roster"];
      if (roster.options.length !== options.length) roster.replaceChildren(...options.map(([value, label]) => { const option = node("option", label); option.value = value; return option; }));
      roster.value = String(selected[side]); elements[side + "Remove"].disabled = rosters[side].length <= 1;
      const start = agent?.combat?.cycleStartedAt || 0, end = agent?.combat?.nextAttackAt || 0;
      const progress = agent?.health > 0 && agent.stats.canAttack && end > start ? Math.max(0, Math.min(1, (trial.time - start) / (end - start))) : 0;
      elements[side+"Gauge"].style.width=(100*progress)+"%";
      const reaction = agent?.combat?.lastReaction, event = agent?.combat?.lastEvent;
      const labels = {miss:"회피",dodge:"회피",parry:"패링",block:"블록",stun:"기절"};
      elements[side+"Reaction"].textContent = !agent ? "" : agent.health <= 0 ? "사망" : (agent.combat?.stunnedUntil || agent.dnaStunnedUntil || 0) > trial.time ? "기절" : reaction && trial.time - reaction.at < .65 ? labels[reaction.kind] || "" : event?.kind === "counter" && trial.time - event.at < .45 ? "반격" : agent.attack && trial.time < agent.attack.hitAt ? "공격 준비" : "";
    } catch(error) { elements.status.textContent=settingError(error); }
  }
  const result=trial?.result(),ended=!!result?.reason;
  for(const key of ["step","run","finish"])elements[key].disabled=!stageReady||!trial||ended;
  if(!trial){elements.phase.textContent="";return;}
  if(ended) {playing=false;elements.run.textContent="자동 전투";elements.status.textContent=(result.winner==="draw"?"무승부":result.winner==="left"?"왼쪽 승리":"오른쪽 승리")+" · "+({death:"사망",'time-limit':"시간 제한",'no-offense':"선공 유닛 없음",'event-limit':"사건 제한"}[result.reason]||result.reason);}
  else elements.status.textContent=playing?"전투 중":trial.time?"일시정지":"대결 준비";
  if (stageError) elements.status.textContent = settingError(stageError);
  elements.phase.textContent=trial.time.toFixed(2)+"초 · "+trial.history.length+"개 사건";
}
reset();
function frame(now) {
  const elapsed=lastFrame?Math.min(.1,(now-lastFrame)/1000):0;lastFrame=now;
  if(playing&&trial){trial.advance(elapsed);render();}
  if (trial) for (const event of globalThis.SpawnerCombatAudio.update(audioPlayback, trial.agents, [], trial.time, trial.vfx)) audio.play(event.name, 1);
  if (stageReady) combatStage.render(trial, now, playing);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
