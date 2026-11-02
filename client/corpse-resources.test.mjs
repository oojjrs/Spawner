import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("시체는 양분 없이 렌더하며 사망 3초에 선택·목록·아바타 참조를 제거한다", () => {
  const corpse = { id: "corpse:a", kind: "corpse", diedAt: 10, decaysAt: 13, x: 4, y: 5 };
  const state = { corpses: [corpse], selection: { kind: "corpse", target: corpse }, hover: { kind: "corpse", target: corpse } };
  let time = 12.999, removed = 0, cleared = 0, updates = 0;
  const scope = createContext({ state, corpsePlaybackTime: () => time,
    agentListButtons: new Map([[corpse.id, { button: { remove() { removed++; } } }]]),
    agentAvatars: new Map([[corpse.id, {}]]), helpTooltipTarget: null,
    combatAttributeArt: { clearDeaths() { cleared++; } }, unitAnimationSheets: new Map(),
    renderedAgentListSignature: corpse.id, updateAgentList() { updates++; },
    selectObject() { state.selection = null; } });
  runInContext(source.match(/^    function expireClientCorpses\([^]*?^    }/m)[0], scope);
  scope.expireClientCorpses();
  assert.equal(state.corpses.length, 1);
  time = 13;
  scope.expireClientCorpses();
  assert.equal(state.corpses.length, 0);
  assert.equal(state.selection, null);
  assert.equal(state.hover, null);
  assert.equal(scope.agentListButtons.size, 0);
  assert.equal(scope.agentAvatars.size, 0);
  assert.equal(removed, 1);
  assert.equal(cleared, 1);
  assert.equal(updates, 1);
  const draw = source.match(/^    function drawCorpses\([^]*?^    }/m)[0];
  assert.match(draw, /for \(const corpse of state.corpses\)/);
  assert.doesNotMatch(draw, /corpse\.amount|drawCorpseResources/);
});

test("사망 그림이 없는 시체는 자원 렌더러로 넘기지 않고 사라진 스냅샷 선택을 해제한다", () => {
  const corpse = { id: "corpse:unknown", kind: "corpse", species: "unknown", x: 1, y: 2, diedAt: 10, decaysAt: 13 };
  const state = { corpses: [corpse], agents: [], rivals: [], camera: { zoom: 64 } };
  let resourceDraws = 0;
  const scope = createContext({ state, Spawner: { CREATURE_DEATH_ANIMATIONS: {} }, AGENT_HEIGHT: .7,
    corpsePlaybackTime: () => 10, encounterSprites: new Map(),
    ctx: { save() {}, restore() {}, translate() {}, scale() {} },
    displayedAgent: agent => agent, worldToScreen: (x, y) => ({ x, y }),
    unitDisplayScale: () => 1, drawCorpseGroundShadow() {}, objectOutlineColor: () => null,
    drawResourceNode() { resourceDraws++; } });
  runInContext(source.match(/^    function drawCreatureCorpse\([^]*?^    }/m)[0], scope);
  scope.drawAgentCorpse = (context, target, x, y, cell, outline, opacity) => scope.drawCreatureCorpse(context, target, x, y, cell, outline, opacity);
  runInContext(source.match(/^    function drawCorpses\([^]*?^    }/m)[0], scope);
  assert.doesNotThrow(() => scope.drawCorpses());
  assert.equal(resourceDraws, 0);
  state.corpses = [];
  scope.selection = { kind: "corpse", target: corpse };
  state.selection = scope.selection;
  const block = source.slice(source.indexOf("      if (selection) {", source.indexOf("Object.assign(snapshotCollections")), source.indexOf("      if (colonyMenuEntry)", source.indexOf("Object.assign(snapshotCollections")));
  runInContext(block, scope);
  assert.equal(state.selection, null);
});
