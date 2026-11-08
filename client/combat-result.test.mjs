import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { combatProfile } from "../server/combat-stats.mjs";

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
