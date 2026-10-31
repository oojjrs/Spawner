import { COMBAT_LAB_UNITS, createCombatTrial } from "./combat-lab.mjs";
import { combatDamage, combatStrength, combatInjuryPenalty } from "../server/combat-stats.mjs";
import { UNIT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, unitAnimationPose, unitAnimationFrame, creatureHurtPose, creatureAttackPose } from "./unit-animation.mjs";
import { TALON_OWL_IDLE, talonOwlIdleFrame } from "./talon-owl-idle.mjs";
import { BEETLE_SPRITE, BEETLE_ATTACK_SPRITE, BEETLE_ANIMATIONS, BEETLE_NEUTRAL_ASSET } from "../server/beetle-animation.mjs";

const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(element => [element.id, element]));
const sides = ["left", "right"], images = new Map();
let trial, playing = false, lastFrame = 0, renderedRows = -1;

for (const side of sides) {
  const select = elements[side + "Unit"];
  for (const group of ["4종족", "일반 생물", "유니크"]) {
    const options = document.createElement("optgroup");
    options.label = group;
    for (const unit of COMBAT_LAB_UNITS.filter(unit => unit.group === group)) options.append(new Option(unit.name + " · " + unit.combatStrength, unit.key));
    select.append(options);
  }
  select.addEventListener("change", () => { setProfile(side); reset(); });
  for (const stat of ["Strength", "Health"]) elements[side + stat].addEventListener("change", reset);
}

function profile(side) { return COMBAT_LAB_UNITS.find(unit => unit.key === elements[side + "Unit"].value); }
function setProfile(side) {
  elements[side + "Strength"].value = profile(side).combatStrength;
  elements[side + "Health"].value = profile(side).health;
}
function settings(seed) {
  const selection = side => ({ key: profile(side).key, combatStrength: Number(elements[side + "Strength"].value), health: Number(elements[side + "Health"].value) });
  return { left: selection("left"), right: selection("right"), first: elements.first.value,
    random: elements.damage.value === "random", seed };
}
function reset() {
  playing = false;
  renderedRows = -1;
  elements.batch.textContent = "";
  try {
    trial = createCombatTrial(settings(Number(elements.seed.value)));
    elements.status.textContent = "대결 준비";
    elements.status.dataset.state = "ready";
    elements.run.disabled = elements.step.disabled = elements.finish.disabled = elements.repeat.disabled = false;
  } catch (error) {
    trial = null;
    elements.status.textContent = error.message;
    elements.run.disabled = elements.step.disabled = elements.finish.disabled = elements.repeat.disabled = true;
  }
  render();
}
function render() {
  elements.run.textContent = playing ? "일시정지" : "자동 전투";
  if (!trial) return;
  const active = trial.agents.find(agent => agent.attack)?.attack;
  const retaliation = trial.agents.find(agent => agent.combat?.pendingCounter)?.combat.pendingCounter;
  const exchange = active?.exchange || retaliation?.exchange;
  const fixed = exchange && (!exchange.attackApplied || !exchange.counterApplied);
  for (let index = 0; index < sides.length; index++) {
    const side = sides[index], agent = trial.agents[index], opponent = trial.agents[1 - index];
    elements[side + "Hp"].textContent = agent.health + " / " + agent.stats.health;
    elements[side + "Bar"].style.width = agent.health + "%";
    elements[side + "Effective"].textContent = agent.health > 0 ? combatStrength(agent) : "—";
    elements[side + "Penalty"].textContent = combatInjuryPenalty(agent);
    elements[side + "DamageLabel"].textContent = fixed ? "이번 교전 확정 피해" : "현재 체력 기준 피해";
    elements[side + "Damage"].textContent = fixed ?
      exchange[exchange.attackerId === agent.id ? "attackDamage" : "counterDamage"] : agent.health > 0 && opponent.health > 0 ?
      combatDamage(agent, opponent, 0) + "–" + combatDamage(agent, opponent, 1) : "—";
    elements[side + "Expected"].parentElement.style.display = fixed ? "none" : "";
    elements[side + "Expected"].textContent = agent.health > 0 && opponent.health > 0 ? combatDamage(agent, opponent) : "—";
    elements[side + "Card"].classList.toggle("fallen", agent.health <= 0);
  }
  elements.hits.textContent = trial.history.length;
  elements.clock.textContent = trial.time.toFixed(2) + "초";
  const result = trial.result();
  if (result) {
    playing = false;
    elements.run.textContent = "자동 전투";
    elements.status.textContent = result === "draw" ? "양쪽 사망" : trial.agents.find(agent => agent.id === result).name + " 승리";
    elements.status.dataset.state = result;
  } else {
    elements.status.textContent = playing ? "전투 중" : trial.history.length ? "일시정지" : "대결 준비";
    elements.status.dataset.state = "ready";
    const attackerId = retaliation ? retaliation.exchange.targetId : active ? active.counter ? active.exchange.targetId : active.exchange.attackerId : null;
    elements.phase.textContent = attackerId ? trial.agents.find(agent => agent.id === attackerId).name +
      (retaliation || active.counter ? " · 반격" : " · 공격") : "교전 대기";
  }
  if (result) elements.phase.textContent = "전투 종료";
  elements.run.disabled = elements.step.disabled = elements.finish.disabled = !!result;
  if (renderedRows !== trial.history.length) {
    renderedRows = trial.history.length;
    elements.history.replaceChildren();
    if (!trial.history.length) {
      const row = elements.history.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 7; cell.className = "empty"; cell.textContent = "1회 타격으로 명중 시점의 피해 확인";
    }
    for (const hit of trial.history) {
      const row = elements.history.insertRow();
      const attacker = trial.agents.find(agent => agent.id === hit.attackerId);
      for (const value of [hit.index, hit.counter ? "반격" : "공격", attacker.name, hit.leftStrength + " : " + hit.rightStrength,
        hit.leftDamage ? "−" + hit.leftDamage + " → " + hit.leftHealth : "— · " + hit.leftHealth,
        hit.rightDamage ? "−" + hit.rightDamage + " → " + hit.rightHealth : "— · " + hit.rightHealth,
        hit.time.toFixed(2) + "초"]) row.insertCell().textContent = value;
    }
    elements.history.lastElementChild?.scrollIntoView({ block: "nearest" });
  }
}
function image(source) {
  if (!images.has(source)) {
    const asset = new Image();
    asset.src = source;
    images.set(source, asset);
  }
  return images.get(source);
}
for (const animation of Object.values(CREATURE_ATTACK_ANIMATIONS)) image(animation.image);

function draw(side, index) {
  const canvas = elements[side + "Art"], context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!trial) return;
  const agent = trial.agents[index];
  let pose = creatureHurtPose(agent, trial.time) || creatureAttackPose(agent, trial.time) || unitAnimationPose(agent, trial.time);
  if (!pose && agent.tribe) pose = { animation: UNIT_ANIMATIONS[agent.tribe].idle, frame: 0 };
  if (!pose && CREATURE_IDLE_ANIMATIONS[agent.species]) {
    const animation = CREATURE_IDLE_ANIMATIONS[agent.species];
    pose = { animation, frame: unitAnimationFrame(animation, trial.time * 1000) };
  }
  if (!pose && agent.species === "talon-owl") pose = { animation: TALON_OWL_IDLE, frame: talonOwlIdleFrame(trial.time * 1000) };
  if (!pose && agent.species === "spiny-back-beetle") {
    const animation = BEETLE_ANIMATIONS[agent.attack ? "attack" : "idle"];
    let elapsed = (trial.time - (agent.attack?.startedAt || 0)) * 1000;
    if (animation.loop) elapsed %= animation.durationMs;
    let frame = 0;
    while (frame < animation.durations.length - 1 && elapsed >= animation.durations[frame]) elapsed -= animation.durations[frame++];
    pose = { animation: agent.attack ? BEETLE_ATTACK_SPRITE : BEETLE_SPRITE, frame: animation.frames[frame] };
  }
  const source = pose?.animation.image || profile(side).image || BEETLE_NEUTRAL_ASSET;
  const asset = image(source);
  if (!asset.complete || !asset.naturalWidth) return;
  const attack = agent.attack, progress = attack ? Math.max(0, Math.min(1, (trial.time - attack.startedAt) / (attack.endsAt - attack.startedAt))) : 0;
  const offset = CREATURE_ATTACK_ANIMATIONS[agent.species] ? 0 : Math.sin(progress * Math.PI) * (index === 0 ? 18 : -18);
  context.save();
  context.globalAlpha = agent.health > 0 ? 1 : .28;
  context.translate(canvas.width / 2 + offset, canvas.height - 12);
  const mirror = agent.species === "spiny-back-beetle" ? agent.attack ? index === 1 : index === 0 :
    agent.species && CREATURE_ATTACK_ANIMATIONS[agent.species] ? index === 0 : index === 1;
  context.scale(mirror ? -1 : 1, 1);
  if (pose) {
    const { frameSize, columns, pivotX, pivotY } = pose.animation;
    const size = pose.action === "attack" && agent.species ? 196 * frameSize / pose.animation.viewSize : 196;
    const scale = size / frameSize;
    context.drawImage(asset, pose.frame % columns * frameSize, Math.floor(pose.frame / columns) * frameSize,
      frameSize, frameSize, -pivotX * scale, -pivotY * scale, size, size);
  } else {
    const scale = Math.min(212 / asset.naturalWidth, 182 / asset.naturalHeight);
    const width = asset.naturalWidth * scale, height = asset.naturalHeight * scale;
    context.drawImage(asset, -width / 2, -height, width, height);
  }
  context.restore();
}

elements.step.addEventListener("click", () => { playing = false; trial.step(); render(); });
elements.finish.addEventListener("click", () => { playing = false; trial.finish(); render(); });
elements.run.addEventListener("click", () => { playing = !playing; render(); });
elements.reset.addEventListener("click", reset);
for (const name of ["first", "damage", "seed"]) elements[name].addEventListener("change", reset);
elements.repeat.addEventListener("click", () => {
  playing = false;
  const wins = { left: 0, right: 0, draw: 0 }, seed = Number(elements.seed.value);
  for (let index = 0; index < 100; index++) {
    const battle = createCombatTrial(settings(seed + index));
    wins[battle.finish()]++;
  }
  elements.batch.textContent = "100판 · 왼쪽 " + wins.left + "승 / 오른쪽 " + wins.right + "승 / 양쪽 사망 " + wins.draw;
  render();
});
for (const button of document.querySelectorAll("[data-pair]")) button.addEventListener("click", () => {
  const pair = button.dataset.pair.split(",");
  sides.forEach((side, index) => { elements[side + "Unit"].value = pair[index]; setProfile(side); });
  reset();
});
elements.leftUnit.value = "bean";
elements.rightUnit.value = "talon-owl";
sides.forEach(setProfile);
reset();
function frame(now) {
  const elapsed = Math.min(.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (playing && trial) { trial.advance(elapsed * Number(elements.playback.value)); render(); }
  sides.forEach(draw);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
