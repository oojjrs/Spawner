import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { combatProfile } from "../server/combat-stats.mjs";
import { withStage } from "./test-support/combat-stage-support.mjs";
import { BEAN_HELD_HURT_SOURCES } from "./bean-held-hurt-assets.mjs";
import { CREATURE_IDLE_ANIMATIONS } from "./unit-animation.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const functions = ["combatArenaUnits", "drawCombatPanel"].map(name =>
  source.match(new RegExp("    function " + name + "\\([^]*?^    }", "m"))[0]).join("\n");

function fixture(side) {
  const element = () => ({ dataset: {}, children: [], textContent: "", hidden: false,
    replaceChildren(...children) { this.children = children; }, setAttribute() {}, addEventListener() {} });
  const player = { id: "worker", ownerId: "player", health: 10, x: 4, y: 4, stats: { health: 10, attack: 1, speed: 1 },
    combat: { id: "battle", side, nextAttackAt: 1, position: { x: -1, y: 0 } } };
  const enemy = { ...player, id: "beetle", ownerId: null, species: "spiny-back-beetle",
    combat: { ...player.combat, side: 1 - side, position: { x: 1, y: 0 } } };
  const context = createContext({ state: { agents: [player], rivals: [enemy], corpses: [], simSeconds: 1, combatVfx: {} },
    connection: { active: true, roomId: "room", simSeconds: 1 },
    combatWatch: { id: "battle", roomId: "room", side, members: new Map(), survivors: new Map(), scene: {} },
    combatPanel: { open: true, close() { this.open = false; } }, combatSelected: "worker",
    combatRoster: element(), combatSummary: element(), combatHeading: element(), combatDetail: element(),
    combatResult: element(), combatGauge: element(), combatStage: { render() {}, prepare: async () => {} },
    document: { createElement: element }, Spawner: { combatProfile }, combatStatsText: () => "",
    combatVisualEvent: () => null, combatBackgroundAt: () => "grassland", scheduleRender() {},
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)) });
  runInContext(functions, context);
  context.drawCombatPanel(1000);
  return { context, player, enemy };
}

for (const side of [0, 1]) for (const victory of [true, false]) test("side " + side + " " + (victory ? "victory" : "defeat") + " stays visible for three real seconds", () => {
  const { context, player, enemy } = fixture(side);
  const survivor = victory ? player : enemy;
  survivor.combat = null;
  context.state.agents = victory ? [survivor] : [];
  context.state.rivals = victory ? [] : [survivor];
  context.state.simSeconds = context.connection.simSeconds = 2;
  context.drawCombatPanel(1040);
  assert.equal(context.combatResult.textContent, victory ? "승리" : "패배");
  assert.equal(context.combatResult.hidden, false);
  assert.equal(context.combatWatch.scene.result().reason, victory ? "victory" : "defeat");
  assert.equal(context.combatWatch.scene.agents.length, 1);
  const health = context.combatWatch.scene.agents[0].health;
  survivor.health = 1;
  survivor.combat = { id: "next-battle", side: 1 - side };
  context.state.simSeconds = context.connection.simSeconds = 200;
  context.drawCombatPanel(4039);
  assert.equal(context.combatPanel.open, true);
  assert.equal(context.combatWatch.scene.agents[0].health, health);
  assert.equal(context.combatWatch.scene.agents[0].combat.id, "battle");
  assert.ok(Math.abs(context.combatWatch.scene.time - 4.999) < 1e-8);
  context.drawCombatPanel(4040);
  assert.equal(context.combatPanel.open, false);
});

test("active combat stays open and a room change closes it immediately", () => {
  const { context } = fixture(0);
  context.drawCombatPanel(100000);
  assert.equal(context.combatPanel.open, true);
  assert.equal(context.combatWatch.endedAt, undefined);
  context.connection.roomId = "other";
  context.drawCombatPanel(100010);
  assert.equal(context.combatPanel.open, false);
});
for (const live of [false, true]) test((live ? "live" : "lab") + " survivors leave the final hurt pose without changing combat results", async () => {
  await withStage(async ({ draw }) => {
    const agent = { id: "winner", tribe: "bean", health: 8, stats: { health: 10 }, mode: "fight", facing: 1,
      appearanceAttributes: { antenna: 1 }, hurtStartedAt: 1, animationStartedAt: 0,
      combat: { id: "battle", version: 2, side: 0, position: { x: -1, y: 0, moving: true, moveStartedAt: 0 }, stunnedUntil: 2 },
      dnaStunnedUntil: 2 };
    let ended = false;
    const trial = { live, agents: [agent], history: [], projectiles: [], time: 1.1, result: () => ended ? { reason: "death", winner: "left" } : null };
    await draw(trial, 1000, false);
    await new Promise(resolve => setImmediate(resolve));
    const hurt = await draw(trial, 1000, false);
    assert.ok(hurt.some(call => call.image === BEAN_HELD_HURT_SOURCES.antenna.image));
    ended = true;
    const survivor = await draw(trial, 1100, false);
    assert.ok(survivor.length > 0);
    assert.ok(survivor.every(call => call.image !== BEAN_HELD_HURT_SOURCES.antenna.image));
    assert.equal(trial.time, 1.1);
    assert.equal(agent.hurtStartedAt, 1);
    assert.equal(agent.health, 8);
    assert.equal(agent.combat.position.moving, true);
  });
});

test("a finished laboratory keeps the survivor idle animation running on presentation time", async () => {
  await withStage(async ({ draw }) => {
    const agent = { id: "winner", species: "cotton-sheep", health: 8, stats: { health: 10 }, mode: "fight", facing: 1,
      animationStartedAt: 0, combat: { id: "battle", side: 0, position: { x: -1, y: 0, moving: true, moveStartedAt: 0 } } };
    const trial = { agents: [agent], history: [], projectiles: [], time: 1,
      result: () => ({ reason: "death", winner: "left" }) };
    const crops = new Set(), image = CREATURE_IDLE_ANIMATIONS[agent.species].image;
    for (let index = 0; index < 15; index++) {
      const draws = await draw(trial, 1000 + index * 100, false);
      const idle = draws.find(call => call.image === image);
      assert.ok(idle);
      crops.add(idle.args.slice(0, 2).join(","));
    }
    assert.ok(crops.size > 1);
    assert.equal(trial.time, 1);
    assert.equal(agent.combat.position.moving, true);
  });
});

for (const [resultText, headline] of [["왼쪽 승리 · 사망", "왼쪽 승리"], ["오른쪽 승리 · 사망", "오른쪽 승리"],
  ["무승부 · 시간 제한", "무승부"]]) test("the laboratory shows only " + headline + " in its three-second banner", () => {
  const code = readFileSync(new URL("./combat-lab.js", import.meta.url), "utf8");
  const frame = code.slice(code.indexOf("function frame(now)"), code.lastIndexOf("requestAnimationFrame(frame);"));
  let ended = true, parent;
  const status = { className: "status", textContent: resultText, dataset: {} };
  const scope = createContext({ trial: { agents: [], time: 5, result: () => ended ? { reason: "death" } : null },
    playing: false, lastFrame: 0, resultStartedAt: null, stageReady: true, elements: { status },
    SpawnerCombatAudio: { update: () => [] }, audioPlayback: {}, audio: {}, combatStage: { render() {} },
    stageView: { append(node) { assert.equal(node, status); parent = "stage"; } },
    stageCenter: { append(node) { assert.equal(node, status); parent = "header"; } }, requestAnimationFrame() {} });
  runInContext(frame, scope);
  scope.frame(1000);
  assert.equal(parent, "stage"); assert.equal(status.className, "status combat-result");
  assert.equal(status.textContent, headline);
  status.textContent = resultText;
  scope.frame(3999); assert.equal(parent, "stage"); assert.equal(status.textContent, headline);
  scope.frame(4000); assert.equal(parent, "header"); assert.equal(status.textContent, resultText);
  scope.resultStartedAt = null; scope.frame(4100); assert.equal(parent, "stage");
  ended = false; scope.resultStartedAt = null; status.textContent = "대결 준비"; scope.frame(4200);
  assert.equal(parent, "header"); assert.equal(status.className, "status"); assert.equal(status.textContent, "대결 준비");
});
