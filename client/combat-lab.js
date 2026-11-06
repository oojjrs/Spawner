import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { SIMULATION_STATS, DEFAULT_SIMULATION_RULES, deriveSimulationStats, createSimulationTrial } from "./combat-simulation.mjs";
import { runSimulationBatch, compareSimulationSwap } from "./combat-analysis.mjs";
import { createCombatStage } from "./combat-stage.mjs";

const sides = ["left", "right"], elements = {}, inputs = {};
const builds = Object.fromEntries(sides.map((side, index) => [side, { key: index ? "spore" : "bean", name: index ? "오른쪽" : "왼쪽",
  organs: { attack: 1, ranged: 0, heal: 0 }, counts: Object.fromEntries(SIMULATION_STATS.map(stat => [stat.key, ({power:4,vitality:5,armor:2,haste:2})[stat.key] || 0])) }]));
const rosters = Object.fromEntries(sides.map(side => [side, [builds[side]]]));
const selected = { left: 0, right: 0 };
let rules = { ...DEFAULT_SIMULATION_RULES }, trial, playing = false, lastFrame = 0, renderedRows = -1, generation = 0, batchBusy = false, controlId = 0;
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
function number(value, min, max, step) {
  const element = document.createElement("input");
  element.type = "number"; element.value = value; element.min = min; if (max != null) element.max = max; element.step = step; return element;
}
function select(options, value) {
  const element = document.createElement("select");
  for (const [key, label] of options) element.append(new Option(label, key));
  element.value = value; return element;
}
function button(parent, label, action) {
  const element = node("button", label); element.type = "button"; element.addEventListener("click", action); parent.append(element); return element;
}
const header = node("header");
const title = node("div"); title.append(node("div", "SPAWNER / COMBAT LAB", "eyebrow"), node("h1", "전투 실험실"), node("p", "초깃값은 실험용입니다. 비교 조각 수는 공정한 실험 조건이며, 외형은 수치에 영향을 주지 않습니다."));
elements.status = node("output", "대결 준비", "status"); elements.status.setAttribute("aria-live", "polite"); header.append(title, elements.status); main.append(header);
const top = node("section", null, "controls");
elements.pieceLimit = control(top, "비교 조각 수", number(20, 0, null, 1));
elements.first = control(top, "시작", select([["simultaneous","동시 시작"],["left","왼쪽 먼저"],["right","오른쪽 먼저"]], "simultaneous"));
elements.seed = control(top, "난수 시드", number(1, 0, 4294967295, 1));
elements.random = control(top, "피해 변동", select([["true","변동 적용"],["false","평균 피해"]], "true"));
elements.distance = control(top, "시작 거리", number(1, 0, 20, .5));
elements.support = document.createElement("input"); elements.support.type = "checkbox"; control(top, "아군 추가", elements.support); elements.support.closest(".field").classList.add("support-field");
elements.playback = control(top, "재생 배속", select([[".5","0.5배"],["1","1배"],["4","4배"]], "1"));
const stage = node("section", null, "stage"); main.append(stage);
const stageHud = node("div", null, "stage-hud"); stage.append(stageHud);
const stageCenter = node("div", null, "stage-center"); stageCenter.append(elements.status); stageHud.append(stageCenter);
elements.dice = button(stageCenter, "🎲", () => {
  if (batchBusy) return;
  for (const side of sides) {
    const unit = COMBAT_LAB_UNITS[Math.floor(Math.random() * COMBAT_LAB_UNITS.length)];
    builds[side].key = unit.key;
    inputs[side].appearance.value = unit.key;
  }
  changed();
});
elements.dice.className = "stage-dice"; elements.dice.setAttribute("aria-label", "주사위");
const stageView = node("div", null, "stage-view");
elements.stage = node("canvas"); elements.stage.width = 1100; elements.stage.height = 400;
elements.stage.setAttribute("aria-hidden", "true"); stageView.append(elements.stage); stage.append(stageView);
const combatStage = createCombatStage(elements.stage);
const arena = node("section", null, "arena"); main.append(arena);
for (const side of sides) {
  const card = node("section", null, "fighter " + side); elements[side + "Card"] = card; inputs[side] = {};
  const hud = node("div", null, "stage-side " + side); stageHud.append(hud);
  hud.append(node("h2", builds[side].name));
  const roster = control(hud, "편성", select([["0", builds[side].name + " 1"]], "0"));
  elements[side + "Roster"] = roster;
  roster.addEventListener("change", () => { selected[side] = Number(roster.value); selectBuild(side); render(); drawCurve(); });
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
  appearance.addEventListener("change", () => { builds[side].key = appearance.value; changed(); }); inputs[side].appearance = appearance;
  const hp = node("div", null, "hp"); elements[side + "Hp"] = node("strong"); hp.append(node("span", "HP"), elements[side + "Hp"]); hud.append(hp);
  const bar = node("div", null, "bar"); elements[side + "Bar"] = node("i"); bar.append(elements[side + "Bar"]); hud.append(bar);
  const gauge = node("div", null, "action-bar"); elements[side + "Gauge"] = node("i"); gauge.append(elements[side + "Gauge"]); hud.append(gauge);
  elements[side + "Reaction"] = node("output", null, "reaction"); hud.append(elements[side + "Reaction"]);
  card.append(node("h2", builds[side].name));
  const organs = node("div", null, "organs");
  for (const [key,label] of [["attack","칼날"],["heal","치유기관"],["ranged","분비기관"]]) {
    const input = number(builds[side].organs[key], 0, 1, 1);
    control(organs, label, input); input.addEventListener("change", () => { builds[side].organs[key] = Number(input.value); changed(); }); inputs[side][key] = input;
  }
  card.append(organs); elements[side + "Pieces"] = node("output", null, "pieces"); card.append(elements[side + "Pieces"]);
  const derived = node("dl", null, "derived"); elements[side + "Derived"] = derived; card.append(derived);
  for (const group of [...new Set(SIMULATION_STATS.map(stat => stat.group))]) {
    const details = node("details", null, "stat-group"); details.open = ["공격","생존"].includes(group); details.append(node("summary", group));
    const grid = node("div", null, "stat-grid");
    for (const stat of SIMULATION_STATS.filter(stat => stat.group === group)) {
      const input = control(grid, stat.label, number(builds[side].counts[stat.key], 0, null, 1)); inputs[side][stat.key] = input;
      input.addEventListener("change", () => { builds[side].counts[stat.key] = Number(input.value); changed(); });
    }
    details.append(grid); card.append(details);
  }
  arena.append(card);
}
const actions = node("div", null, "actions");
elements.step = button(actions, "다음 사건", () => { playing = false; trial?.step(); render(); });
elements.run = button(actions, "자동 전투", () => { playing = !playing; render(); });
elements.finish = button(actions, "끝까지", () => { playing = false; trial?.finish(); render(); });
button(actions, "초기화", reset);
const stageFooter = node("div", null, "stage-footer");
elements.phase = node("output", null, "phase"); stageFooter.append(actions, elements.phase); stage.append(stageFooter); main.insertBefore(top, arena);
const ruleLabels = {
 powerCurve:"공격 증가 곡선",powerBase:"근접 기초 공격",powerGain:"근접 첫 공격 투자 증가량",powerKnee:"근접 공격 점감 무릎",healthBase:"기초 HP",healthPerPoint:"생명력당 HP",armorPerPoint:"방어력당 방어",armorCap:"방어 경감 상한",armorKnee:"방어 점감 무릎",
 flatPenPerPoint:"고정 관통 증가량",percentPenCap:"비율 관통 상한",percentPenKnee:"관통 점감 무릎",attackRateBase:"근접 기초 공속(회/초)",hasteCap:"근접 공속 증가 상한",hasteKnee:"근접 공속 무릎",maxActionRate:"최대 공속(회/초)",windupBase:"기초 준비(초)",focusPerPoint:"준비 단축(초)",windupMinimum:"최소 준비(초)",hitGapBase:"기초 연타 간격(초)",hitSpeedPerPoint:"연타 간격 단축(초)",hitGapMinimum:"최소 연타 간격(초)",recovery:"후딜(초)",followupBase:"후속타 기초 배율",comboPerPoint:"후속타 증가량",followupCap:"후속타 배율 상한",
 critCap:"치명 확률 상한",critKnee:"치명 확률 무릎",critMultiplierBase:"기초 치명 배율",critMultiplierCap:"치명 배율 상한",critPowerKnee:"치명 위력 무릎",accuracyCap:"정밀 상한",accuracyKnee:"정밀 무릎",dodgeCap:"회피 상한",dodgeKnee:"회피 무릎",parryCap:"패링 상한",parryKnee:"패링 무릎",blockCap:"블록 상한",blockKnee:"블록 무릎",blockReductionBase:"기초 블록 경감",blockReductionCap:"블록 경감 상한",blockPowerKnee:"블록 위력 무릎",defensePreparation:"방어 준비(초)",reactionCooldown:"방어 재준비(초)",counterCap:"반격 확률 상한",counterKnee:"반격 확률 무릎",counterMultiplierBase:"기초 반격 배율",counterMultiplierCap:"반격 배율 상한",counterPowerKnee:"반격 위력 무릎",counterWindup:"반격 준비(초)",counterCooldown:"반격 재준비(초)",tenacityCap:"강인함 상한",tenacityKnee:"강인함 무릎",stunCap:"기절 확률 상한",stunKnee:"기절 확률 무릎",stunDurationBase:"기초 기절(초)",stunDurationPerPoint:"기절 시간 증가(초)",stunDurationCap:"기절 시간 상한(초)",stunImmunity:"기절 면역(초)",drainCap:"흡혈 상한",drainKnee:"흡혈 무릎",jitter:"피해 변동 폭(비율)",initiativeDelay:"선공 차이(초)",maxSeconds:"최대 전투 시간(초)",maxEvents:"최대 사건 수"
};
const rulesPanel = node("details", null, "panel"); rulesPanel.append(node("summary", "실험 규칙 · 비율 0–1, 시간 초"));
const rulesGrid = node("div", null, "rule-grid");
for (const [key,value] of Object.entries(DEFAULT_SIMULATION_RULES)) {
  if (["rangedPowerBase","rangedPowerGain","rangedPowerKnee","rangedAttackRateBase","rangedHasteCap","rangedHasteKnee"].includes(key)) continue;
  const input = key === "powerCurve" ? select([["log","로그 점감"],["linear","선형"]], value) : number(value, ["powerKnee","armorKnee"].includes(key) || ["healthBase","maxActionRate","windupMinimum","hitGapMinimum","maxSeconds"].includes(key) ? .001 : 0, key === "maxSeconds" ? 600 : key === "maxEvents" ? 50000 : key === "jitter" ? .2 : 1000000, key === "maxEvents" ? 1 : .01);
  control(rulesGrid, ruleLabels[key], input); input.addEventListener("change", () => { rules[key] = key === "powerCurve" ? input.value : Number(input.value); changed(); }); inputs[key] = input;
}
rulesPanel.append(rulesGrid); main.append(rulesPanel);
const curvePanel = node("section", null, "panel"); curvePanel.append(node("h2", "투자 곡선"));
const curveControls = node("div", null, "controls");
elements.curveSide = control(curveControls, "설계", select([["left","왼쪽"],["right","오른쪽"]], "left"));
elements.curveStat = control(curveControls, "투자 속성", select(SIMULATION_STATS.map(stat => [stat.key,stat.label]), "power"));
const curveMetrics = [["attackPower","근접 공격력"],["rangedPower","원거리 공격력"],["health","HP"],["defense","방어력"],["attackSpeed","근접 공속(회/초)"],["rangedSpeed","원거리 공속(회/초)"],["windup","준비(초)"],["hitCount","타수"],["hitGap","간격(초)"],["followupMultiplier","후속타 배율"],["flatPenetration","고정 관통"],["armorPenetration","비율 관통"],["critChance","치명 확률"],["critMultiplier","치명 배율"],["accuracy","정밀"],["evasion","회피 확률"],["parry","패링 확률"],["block","블록 확률"],["blockReduction","블록 경감"],["counter","반격 확률"],["counterMultiplier","반격 배율"],["tenacity","강인함"],["stunChance","기절 확률"],["stunDuration","기절 시간(초)"],["drain","흡혈 비율"],["healPower","치유량"]];
elements.curveMetric = control(curveControls, "실효 수치", select(curveMetrics,"attackPower")); curvePanel.append(curveControls);
elements.curve = node("canvas"); elements.curve.width = 800; elements.curve.height = 250; elements.curve.setAttribute("aria-label","투자 0부터 80조각까지 실제 파생 수치 곡선"); curvePanel.append(elements.curve); elements.curveCaption = node("output"); curvePanel.append(elements.curveCaption); main.append(curvePanel);
const curveDefaults = {power:"attackPower",rangedPower:"rangedPower",rangedHaste:"rangedSpeed",vitality:"health",armor:"defense",flatPen:"flatPenetration",percentPen:"armorPenetration",haste:"attackSpeed",focus:"windup",multiHit:"hitCount",hitSpeed:"hitGap",combo:"followupMultiplier",crit:"critChance",critPower:"critMultiplier",accuracy:"accuracy",evasion:"evasion",parry:"parry",block:"block",blockPower:"blockReduction",counter:"counter",counterPower:"counterMultiplier",tenacity:"tenacity",stun:"stunChance",stunDuration:"stunDuration",drain:"drain",healPower:"healPower"};
elements.curveStat.addEventListener("change", () => { elements.curveMetric.value=curveDefaults[elements.curveStat.value];drawCurve(); });
for (const key of ["curveSide","curveMetric"]) elements[key].addEventListener("change", drawCurve);
const curveObserver = new ResizeObserver(drawCurve); curveObserver.observe(elements.curve);
const batchPanel = node("section", null, "panel"); batchPanel.append(node("h2", "반복 실험 · 한 조각 교체"));
const batchControls = node("div", null, "controls");
elements.repeatCount = control(batchControls, "반복 횟수", select([["20","20판"],["100","100판"],["500","500판"]],"100"));
elements.swapSide = control(batchControls, "교체 설계", select([["left","왼쪽"],["right","오른쪽"]],"left"));
elements.removeKey = control(batchControls, "한 조각 빼기", select(SIMULATION_STATS.map(stat=>[stat.key,stat.label]),"power"));
elements.addKey = control(batchControls, "한 조각 넣기", select(SIMULATION_STATS.map(stat=>[stat.key,stat.label]),"vitality")); batchPanel.append(batchControls);
const batchActions = node("div", null, "actions"); elements.repeat = button(batchActions,"반복 실행",()=>runBatch(false)); elements.swap = button(batchActions,"동일 시드로 교체 비교",()=>runBatch(true)); elements.cancel = button(batchActions,"중단",()=>{generation++;}); elements.cancel.hidden = true; batchPanel.append(batchActions);
elements.batch = node("output", null, "batch-result"); elements.batch.setAttribute("aria-live","polite"); batchPanel.append(elements.batch); main.append(batchPanel);
const ledger = node("section", null, "panel"); ledger.append(node("h2","사건 기록"));
const scroll = node("div", null, "scroll"); const table = node("table"); const thead = node("thead"), headrow=node("tr");
for (const label of ["시각","사건","공격자","대상","피해","연타","왼쪽 HP","오른쪽 HP"]) headrow.append(node("th",label)); thead.append(headrow); elements.history=node("tbody"); table.append(thead,elements.history); scroll.append(table); ledger.append(scroll); main.append(ledger);
for (const key of ["pieceLimit","first","seed","random","distance","support"]) elements[key].addEventListener("change", changed);
function selectBuild(side) {
  builds[side] = rosters[side][selected[side]];
  for (const stat of SIMULATION_STATS) inputs[side][stat.key].value = builds[side].counts[stat.key];
  for (const key of ["attack", "heal", "ranged"]) inputs[side][key].value = builds[side].organs[key];
  inputs[side].appearance.value = builds[side].key;
}
function rosterSettings(side) {
  return rosters[side].map((build, index) => ({ ...structuredClone(build), name: (side === "left" ? "왼쪽 " : "오른쪽 ") + (index + 1) }));
}
function settings(seed) { return {left:rosterSettings("left"),right:rosterSettings("right"),selected:{...selected},rules:{...rules},seed,random:elements.random.value==="true",first:elements.first.value,distance:Number(elements.distance.value),support:elements.support.checked}; }
function changed() { generation++; elements.batch.textContent=""; reset(); }
function settingError(error) { return /[가-힣]/.test(error.message) ? error.message : "입력 수치와 규칙의 상한·최소값을 확인해 주세요."; }
function reset() {
  playing=false; renderedRows=-1;
  try {
    const seed=Number(elements.seed.value);
    if(!elements.seed.value.trim()||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error("난수 시드는 0–4294967295 정수로 입력해 주세요.");
    const pieceLimit=Number(elements.pieceLimit.value);
    if(!elements.pieceLimit.value.trim()||!Number.isSafeInteger(pieceLimit)||pieceLimit<0)throw Error("비교 조각 수는 0 이상의 안전한 정수로 입력해 주세요.");
    for(const side of sides)for(const stat of SIMULATION_STATS)if(!inputs[side][stat.key].value.trim()||!Number.isSafeInteger(builds[side].counts[stat.key])||builds[side].counts[stat.key]<0)throw Error("조각 수는 0 이상의 안전한 정수로 입력해 주세요.");
    for(const side of sides)for(const key of ["attack","heal","ranged"])if(!inputs[side][key].value.trim()||!Number.isSafeInteger(builds[side].organs[key])||builds[side].organs[key]<0)throw Error("조각 수는 0 이상의 안전한 정수로 입력해 주세요.");
    for(const side of sides)for(const build of rosters[side])if(deriveSimulationStats(build,rules).pieceCount>pieceLimit)throw Error(builds[side].name+"의 비교 조각 수를 초과했습니다.");
    trial=createSimulationTrial(settings(Number(elements.seed.value)));
    elements.status.textContent="대결 준비";
  } catch(error) { trial=null;elements.status.textContent=settingError(error); }
  render();drawCurve();
}
function percent(value) { return (100*value).toFixed(1)+"%"; }
function render() {
  elements.run.textContent=playing?"일시정지":"자동 전투";
  stage.dataset.state = !trial ? "invalid" : trial.result()?.reason ? "ended" : playing ? "playing" : "paused";
  for(const side of sides) {
    try {
      const stats=deriveSimulationStats(builds[side],rules),agent=trial?.agents.find(agent => agent.ownerId === side && agent.slot === selected[side]);
      const options = rosters[side].map((build, index) => [String(index), (side === "left" ? "왼쪽 " : "오른쪽 ") + (index + 1)]);
      const roster = elements[side + "Roster"];
      if (roster.options.length !== options.length) roster.replaceChildren(...options.map(([value, label]) => { const option = node("option", label); option.value = value; return option; }));
      roster.value = String(selected[side]); elements[side + "Remove"].disabled = rosters[side].length <= 1 || batchBusy;
      elements[side+"Pieces"].textContent="조각 수 "+stats.pieceCount+" / "+elements.pieceLimit.value;
      elements[side+"Pieces"].dataset.over=String(stats.pieceCount>Number(elements.pieceLimit.value));
      elements[side+"Hp"].textContent=(agent?agent.health:stats.health).toFixed(1)+" / "+stats.health.toFixed(1);
      elements[side+"Bar"].style.width=(100*(agent?agent.health:stats.health)/stats.health)+"%";
      const start = agent?.combat?.cycleStartedAt || 0, end = agent?.combat?.nextAttackAt || 0;
      const progress = agent?.health > 0 && agent.stats.canAttack && end > start ? Math.max(0, Math.min(1, (trial.time - start) / (end - start))) : 0;
      elements[side+"Gauge"].style.width=(100*progress)+"%";
      const reaction = agent?.combat?.lastReaction, event = agent?.combat?.lastEvent;
      const labels = {dodge:"회피",parry:"패링",block:"블록",stun:"기절"};
      elements[side+"Reaction"].textContent = !agent ? "" : agent.health <= 0 ? "사망" : (agent.combat?.stunnedUntil || agent.dnaStunnedUntil || 0) > trial.time ? "기절" : reaction && trial.time - reaction.at < .65 ? labels[reaction.kind] || "" : event?.kind === "counter" && trial.time - event.at < .45 ? "반격" : agent.attack && trial.time < agent.attack.hitAt ? "공격 준비" : "";
      const values=[["근접 공격력",stats.attackPower.toFixed(2)],["원거리 공격력",stats.rangedPower.toFixed(2)],["방어",stats.defense.toFixed(2)],["근접 공속",stats.attackSpeed.toFixed(2)+"/초"],["원거리 공속",stats.rangedSpeed.toFixed(2)+"/초"],["준비 / 후딜",stats.windup.toFixed(2)+" / "+stats.recovery.toFixed(2)+"초"],["연타 / 간격",stats.hitCount+"타 / "+stats.hitGap.toFixed(2)+"초"],["후속타",percent(stats.followupMultiplier)],["관통",stats.flatPenetration.toFixed(1)+" + "+percent(stats.armorPenetration)],["치명",percent(stats.critChance)+" ×"+stats.critMultiplier.toFixed(2)],["정밀 / 회피",percent(stats.accuracy)+" / "+percent(stats.evasion)],["패링 / 블록",percent(stats.parry)+" / "+percent(stats.block)],["블록 경감",percent(stats.blockReduction)],["반격",percent(stats.counter)+" ×"+stats.counterMultiplier.toFixed(2)],["강인함",percent(stats.tenacity)],["기절 / 타격당",percent(stats.stunChance)+" / "+percent(stats.stunChancePerHit)],["기절 시간",stats.stunDuration.toFixed(2)+"초"],["흡혈",percent(stats.drain)],["치유량",stats.healPower.toFixed(2)]];
      elements[side+"Derived"].replaceChildren(...values.flatMap(([label,value])=>[node("dt",label),node("dd",value)]));
    } catch(error) { elements.status.textContent=settingError(error); }
  }
  const result=trial?.result(),ended=!!result?.reason;
  for(const key of ["step","run","finish"])elements[key].disabled=!trial||ended||batchBusy;
  elements.repeat.disabled=elements.swap.disabled=!trial||batchBusy;
  if(!trial){elements.phase.textContent="";return;}
  if(ended) {playing=false;elements.run.textContent="자동 전투";elements.status.textContent=(result.winner==="draw"?"무승부":result.winner==="left"?"왼쪽 승리":"오른쪽 승리")+" · "+({death:"사망",'time-limit':"시간 제한",'no-offense':"공격 불가",'event-limit':"사건 제한"}[result.reason]||result.reason);}
  else elements.status.textContent=playing?"전투 중":trial.time?"일시정지":"대결 준비";
  elements.phase.textContent=trial.time.toFixed(2)+"초 · "+trial.history.length+"개 사건";
  if(renderedRows!==trial.history.length) {
    renderedRows=trial.history.length;
    const labels={hit:"타격",critical:"치명",miss:"빗나감",evasion:"회피",dodge:"회피",parry:"패링",block:"블록",stun:"기절",counter:"반격",attack:"공격 준비",death:"사망",drain:"흡혈",heal:"치유",shoot:"사격"};
    elements.history.replaceChildren(...trial.history.slice(-120).map(event=>{const row=node("tr");for(const value of [event.time.toFixed(2),event.counter?"반격 "+(labels[event.kind]||event.kind):(labels[event.kind]||event.kind),trial.agents.find(agent=>agent.id===event.attackerId)?.name||"—",trial.agents.find(agent=>agent.id===event.targetId)?.name||"—",(event.critical?"치명 ":"")+(Number(event.damage)||0).toFixed(2),event.hitIndex==null?"—":(event.hitIndex+1)+"/"+event.hitCount,Number(event.leftHealth).toFixed(1),Number(event.rightHealth).toFixed(1)])row.append(node("td",String(value)));return row;}));
  }
}
function drawCurve() {
  const canvas=elements.curve,context=canvas.getContext("2d"),width=Math.max(220,Math.floor(canvas.getBoundingClientRect().width)),height=250,ratio=window.devicePixelRatio||1;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
  try {
    const build=structuredClone(builds[elements.curveSide.value]),key=elements.curveStat.value,metric=elements.curveMetric.value;
    const points=Array.from({length:81},(_,index)=>{build.counts[key]=index;return deriveSimulationStats(build,rules)[metric];});
    const maximum=Math.max(.001,...points)*1.08,minimum=Math.min(0,...points),current=builds[elements.curveSide.value].counts[key],left=64,right=width-18;
    const x=n=>left+n/80*(right-left),y=n=>210-(n-minimum)/(maximum-minimum)*170;
    context.strokeStyle="#dbe3d3";context.lineWidth=1;context.beginPath();context.moveTo(left,30);context.lineTo(left,210);context.lineTo(right,210);context.stroke();
    context.fillStyle="#687962";context.font="13px sans-serif";context.textAlign="right";context.fillText(maximum.toFixed(2),left-8,35);context.fillText("0",left-8,215);
    context.textAlign="center";context.fillText("0",x(0),232);context.fillText("40",x(40),232);context.textAlign="right";context.fillText("80조각",right,232);context.textAlign="left";context.fillText(curveMetrics.find(entry=>entry[0]===metric)[1],left,20);
    context.strokeStyle="#527a3b";context.lineWidth=3;context.beginPath();points.forEach((value,index)=>index?context.lineTo(x(index),y(value)):context.moveTo(x(index),y(value)));context.stroke();
    const currentValue=deriveSimulationStats(builds[elements.curveSide.value],rules)[metric];
    if(current>=0&&current<=80){context.fillStyle="#b67b3c";context.beginPath();context.arc(x(current),y(currentValue),5,0,Math.PI*2);context.fill();}
    elements.curveCaption.textContent=SIMULATION_STATS.find(stat=>stat.key===key).label+" "+current+"조각 → "+curveMetrics.find(entry=>entry[0]===metric)[1]+" "+currentValue.toFixed(3);
  }catch(error){elements.curveCaption.textContent=settingError(error);}
}
function summary(samples) {
  const count=samples.length,leftWins=samples.filter(sample=>sample.winner==="left").length,rightWins=samples.filter(sample=>sample.winner==="right").length;
  const mean=key=>samples.reduce((sum,sample)=>sum+sample[key],0)/count;
  return count+"판 · 왼쪽 "+percent(leftWins/count)+" / 오른쪽 "+percent(rightWins/count)+" / 무승부 "+(count-leftWins-rightWins)+" · 평균 "+mean("time").toFixed(2)+"초 · 잔여 HP "+mean("leftHealth").toFixed(1)+" / "+mean("rightHealth").toFixed(1)+" · 시간 제한 "+samples.filter(sample=>sample.reason==="time-limit").length;
}
async function runBatch(swap) {
  if(batchBusy||!trial)return;
  const inputSeed=Number(elements.seed.value);
  if(!elements.seed.value.trim()||!Number.isInteger(inputSeed)||inputSeed<0||inputSeed>4294967295){elements.status.textContent="난수 시드는 0–4294967295 정수로 입력해 주세요.";return;}
  playing=false;const token=++generation,total=Number(elements.repeatCount.value),seed=inputSeed,config=settings(seed),samples=[],variants=[];
  const swapSide=elements.swapSide.value,removeKey=elements.removeKey.value,addKey=elements.addKey.value;
  const locked=[...main.querySelectorAll("input,select,button")].filter(element=>element!==elements.cancel).map(element=>({element,disabled:element.disabled}));
  for(const entry of locked)entry.element.disabled=true;
  let improved=0,worsened=0,unchanged=0;batchBusy=true;elements.cancel.hidden=false;render();
  try {
    for(let index=0;index<total;index+=2) {
      if(token!==generation)break;
      const count=Math.min(2,total-index);
      if(swap){const result=compareSimulationSwap(config,swapSide,removeKey,addKey,count,(seed+index)>>>0);samples.push(...result.baseline.samples);variants.push(...result.variant.samples);improved+=result.pairedImproved;worsened+=result.pairedWorsened;unchanged+=result.pairedUnchanged;}
      else samples.push(...runSimulationBatch(config,count,(seed+index)>>>0).samples);
      elements.batch.textContent=samples.length+" / "+total+"판 진행 중";
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const delta=swap&&samples.length?(variants.filter(sample=>sample.winner===swapSide).length-samples.filter(sample=>sample.winner===swapSide).length)/samples.length*100:0;
    if(samples.length)elements.batch.textContent=(swap?"기존: ":"")+summary(samples)+(swap?"\n교체: "+summary(variants)+"\n교체 설계 승률 변화 "+(delta>=0?"+":"")+delta.toFixed(1)+"%p · 동일 시드 개선 "+improved+" / 악화 "+worsened+" / 동일 "+unchanged:"")+(token!==generation?"\n중단됨":"");
  }catch(error){elements.batch.textContent=error.message.includes("event limit") ? "계산 한도에 도달했습니다. 최대 시간이나 연타 수를 줄여 주세요." : "교체할 속성이 한 조각 이상 장착되어 있는지, 수치가 허용 범위인지 확인해 주세요.";}
  finally{batchBusy=false;elements.cancel.hidden=true;for(const entry of locked)entry.element.disabled=entry.disabled;render();}
}
reset();
function frame(now) {
  const elapsed=lastFrame?Math.min(.1,(now-lastFrame)/1000):0;lastFrame=now;
  if(playing&&trial){trial.advance(elapsed*Number(elements.playback.value));render();}
  combatStage.render(trial, now, playing);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
