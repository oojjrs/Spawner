import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell } from "./combat-detail-vfx.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
function extract(start, end) {
  const from = source.indexOf("    function " + start + "("), to = source.indexOf("    function " + end + "(", from);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
}

function modal({ unavailable = [], rejectDraw = false, version = 1 } = {}) {
  const calls = [], stack = [];
  const context = new Proxy({ globalAlpha: 1, lineWidth: 1,
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    restore() { Object.assign(this, stack.pop()); },
    beginPath() { this.path = []; },
    moveTo(...args) { this.path.push(["moveTo", ...args]); },
    lineTo(...args) { this.path.push(["lineTo", ...args]); },
    stroke() { calls.push({ kind: "stroke", color: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha, path: this.path }); },
    drawImage(image, ...args) { calls.push({ kind: "image", image: image.path, args }); },
    arc(...args) { this.path.push(["arc", ...args]); calls.push({ kind: "arc", color: this.fillStyle, args }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const agents = [0, 1].map(side => ({ id: side ? "target" : "source", tribe: "bean", health: 10,
    stats: { health: 10, ranged: !side, melee: !!side }, combat: { id: "fight", side, stunnedUntil: 0 }, attributes: {} }));
  const canvas = { clientWidth: 1040, clientHeight: 480, dataset: {}, style: {}, getContext: () => context };
  const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  const sandbox = { state: { agents, rivals: [], simSeconds: 0, combatVfx: { version } },
    Spawner: { DETAIL_COMBAT_VFX_ASSETS, combatProfile: () => ({ attackInterval: 1 }), combatPrimary: () => "blade",
      CREATURE_ATTACK_ANIMATIONS: {}, drawDetailVfxCell: (...args) => !rejectDraw && drawDetailVfxCell(...args) },
    detailCombatVfx: detail, detailVfxImages: new Map(DETAIL_COMBAT_VFX_ASSETS.map(path => [path,
      { path, complete: !unavailable.includes(path), naturalWidth: 1776 }])),
    selectedCombatUnits: () => agents, combatOpen: {}, evolutionPanel: { hidden: true }, welcome: { hidden: true },
    combatPanel: { open: true }, combatWatch: { id: "fight" }, combatSelected: "source", combatSummary: {},
    combatRoster: { dataset: { key: "source,target" }, children: [] }, combatHeading: {}, combatDetail: {}, combatGauge: {},
    combatCanvas: canvas, combatArenaUnits: units => units, combatStatsText: () => "", combatBackgroundAt: () => "grassland",
    combatBackgrounds: { grassland: "ground.png" }, combatUnitScale: () => 1,
    unitDisplayBounds: new Map([["bean", { width: .5, height: .8 }]]), unitDisplayScales: new Map([["bean", 1]]),
    appearanceWorld: { prepare: () => new Map(), draw: () => false }, drawAgentAppearanceLayer() {},
    window: { devicePixelRatio: 2 }, AGENT_HEIGHT: .8, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    combatVfxFrame: { active: [], projectiles: [] }
  };
  createContext(sandbox);
  runInContext(extract("combatVisualEvent", "combatBackgroundAt") + extract("drawCombatPanel", "templateDescription"), sandbox);
  function draw(time, events = []) {
    calls.length = 0;
    sandbox.state.simSeconds = time;
    sandbox.combatVfxFrame = cursor.consume({ streamId: "fight", events }, time);
    detail.consume(sandbox.combatVfxFrame, time);
    sandbox.drawCombatPanel(time * 1000);
    return { art: calls.filter(call => call.kind === "image"),
      hits: calls.filter(call => call.kind === "stroke" && call.color === "#ffe1a0"),
      defense: calls.filter(call => call.kind === "stroke" && call.color === "#a6e4fa"),
      flights: calls.filter(call => call.kind === "arc" && call.color === "#b6ed84"),
      trails: calls.filter(call => call.kind === "stroke" && call.color === "#e0ffb7") };
  }
  draw(0);
  return { draw, detail, agents, sandbox, canvas };
}

const hit = (extra = {}) => ({ id: "hit", kind: "hit", sourceId: "source", targetId: "target", at: 1, amount: 3, ...extra });

test("a missing unrelated V4 sheet does not duplicate a loaded modal impact", () => {
  for (const mode of ["melee", "ranged"]) for (const critical of [false, true]) {
    const { draw, canvas } = modal({ unavailable: [DETAIL_COMBAT_VFX.spring.image] });
    const result = draw(1.05, [hit({ mode, critical })]);
    assert.equal(result.art.length, 1);
    assert.equal(result.art[0].image, DETAIL_COMBAT_VFX[mode === "ranged" ? "bean" : "hit"].image);
    assert.equal(result.hits.length, 0, "only the successfully drawn replacement suppresses its fallback");
    assert.equal(canvas.width, 2080); assert.equal(canvas.height, 960);
  }
});

test("a missing matching sheet or unsuccessful draw keeps the original impact", () => {
  for (const options of [{ unavailable: [DETAIL_COMBAT_VFX.hit.image] }, { rejectDraw: true }]) {
    const { draw } = modal(options), result = draw(1.05, [hit()]);
    assert.equal(result.art.length, 0);
    assert.equal(result.hits.length, 1);
    assert.ok(Math.abs(result.hits[0].alpha - .8) < 1e-9);
  }
});

test("a drawn burst cannot suppress another event or a block/parry defense cue", () => {
  const { draw, detail } = modal();
  const commands = detail.commands;
  detail.commands = (...args) => commands(...args).map(command => ({ ...command, eventId: "other-event" }));
  assert.equal(draw(1.05, [hit()]).hits.length, 1);
  for (const [kind, amount, art] of [["block", 2, 1], ["block", 0, 0], ["parry", 0, 0]]) {
    const view = modal({ unavailable: [DETAIL_COMBAT_VFX.spring.image] });
    const result = view.draw(1.05, [hit({ kind, amount })]);
    assert.equal(result.art.length, art);
    assert.equal(result.hits.length, 0);
    assert.equal(result.defense.length, 1);
  }
});

test("legacy impacts and the remaining canonical semantic cues preserve fallback", () => {
  const legacy = modal({ version: undefined });
  legacy.sandbox.state.combatVfx = undefined;
  legacy.agents[1].combat.lastReaction = hit({ at: 1, damage: 3 });
  assert.equal(legacy.draw(1.05).hits.length, 1);
  const canonical = modal();
  assert.equal(canonical.draw(1.05, [hit({ kind: "stun", amount: 0 })]).hits.length, 1,
    "having all art loaded does not suppress a cue without replacement artwork");
});

test("image recovery replaces fallback without restarting or extending repeated impacts", () => {
  const { draw, sandbox } = modal({ unavailable: [DETAIL_COMBAT_VFX.hit.image, DETAIL_COMBAT_VFX.spring.image] });
  const event = hit();
  assert.equal(draw(1.05, [event]).hits.length, 1);
  sandbox.detailVfxImages.get(DETAIL_COMBAT_VFX.hit.image).complete = true;
  const recovered = draw(1.1, [event]);
  assert.equal(recovered.hits.length, 0);
  assert.equal(recovered.art.length, 1);
  assert.ok(recovered.art[0].args[0] > 0, "loaded art resumes at its real event age");
  assert.equal(draw(1.42, [event]).art.length, 1, "authored impact tail remains visible");
  assert.equal(draw(1.5, [event]).art.length, 0);
  assert.equal(draw(1.6, [event]).art.length, 0, "repeated snapshots do not restart completed art");
  for (const kind of ["hit", "block", "dodge", "parry", "projectile-cancel"])
    assert.equal(draw(2.05, [hit({ id: "zero-" + kind, at: 2, kind, amount: 0 })]).art.length, 0,
      "a non-damaging outcome does not invent an impact");
});


test("reciprocal hits each keep their incoming fallback regardless of journal order", () => {
  for (const mode of ["melee", "ranged"]) for (const reverse of [false, true]) {
    const { draw, sandbox } = modal({ unavailable: [DETAIL_COMBAT_VFX.hit.image, DETAIL_COMBAT_VFX.bean.image] });
    const events = [hit({ id: "incoming", mode, sourceId: "target", targetId: "source", sequence: reverse ? 2 : 1 }),
      hit({ id: "outgoing", mode, sequence: reverse ? 1 : 2 })];
    const result = draw(1.05, events);
    assert.equal(result.art.length, 0);
    assert.equal(result.hits.length, 2, "one incoming fallback per fighter, even when both attack");
    for (const agent of sandbox.state.agents) {
      const reaction = sandbox.combatVisualEvent(agent);
      assert.equal(reaction.targetId, agent.id, "incoming hit wins over this fighter's outgoing hit");
    }
  }
});

test("loaded reciprocal hits preserve incoming recoil and suppress only their own fallback", () => {
  const { draw, detail, sandbox, agents, canvas } = modal();
  let drawnPositions;
  const commands = detail.commands;
  detail.commands = (...args) => { drawnPositions = args[1]; return commands(...args); };
  const events = [hit({ id: "incoming", sourceId: "target", targetId: "source", sequence: 1 }),
    hit({ id: "outgoing", sequence: 2 })];
  const result = draw(1.05, events);
  assert.equal(result.art.length, 2);
  assert.equal(result.hits.length, 0);
  assert.ok(drawnPositions.get("source").x < canvas.clientWidth * .39, "left fighter recoils from its incoming hit");
  assert.ok(drawnPositions.get("target").x > canvas.clientWidth * .61, "right fighter recoils from its incoming hit");
  const newer = hit({ id: "newer-incoming", at: 1.1, sourceId: "target", targetId: "source", critical: true });
  draw(1.11, [...events, newer]);
  assert.equal(sandbox.combatVisualEvent(agents[0]).eventId, newer.id, "newest incoming reaction wins");
});

test("outgoing hits remain visible without an incoming reaction and defense keeps priority", () => {
  const { draw, sandbox, agents } = modal();
  draw(1.05, [hit()]);
  assert.equal(sandbox.combatVisualEvent(agents[0]).eventId, "hit", "attack status is preserved");
  for (const kind of ["block", "parry", "stun"]) {
    const view = modal({ unavailable: [DETAIL_COMBAT_VFX.hit.image] });
    const defense = hit({ id: "defense", kind, amount: 0, sourceId: "target", targetId: "source", sequence: 1 });
    view.draw(1.05, [defense, hit({ id: "outgoing", sequence: 2 }),
      hit({ id: "incoming", sourceId: "target", targetId: "source", sequence: 3 })]);
    assert.equal(view.sandbox.combatVisualEvent(view.agents[0]).kind, kind, "existing defensive priority remains intact");
  }
});

const shoot = (extra = {}) => ({ id: "launch", kind: "shoot", sourceId: "source", targetId: "target",
  at: 1, amount: 0, mode: "ranged", projectileId: "shot", arrivesAt: 2, ...extra });

test("missing detail projectile art retains a fallback at the authoritative flight head", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true]) {
    const { draw, agents, detail } = modal({ unavailable: [DETAIL_COMBAT_VFX[tribe].image] });
    agents[0].tribe = tribe;
    if (reverse) for (const agent of agents) agent.combat.side = 1 - agent.combat.side;
    let flight;
    const commands = detail.commands;
    detail.commands = (...args) => { const result = commands(...args); flight = result.find(command => command.kind === "flight"); return result; };
    const launch = shoot();
    assert.equal(draw(.9, [launch]).flights.length, 0, "no projectile before the actual launch");
    const result = draw(1.25, [launch]);
    assert.equal(result.art.length, 0);
    assert.equal(result.flights.length, 1, tribe + " has one visible fallback");
    assert.equal(result.trails.length, 1);
    assert.equal(result.hits.length, 0, "flight never invents an impact");
    const [x, y, radius] = result.flights[0].args;
    assert.ok(Math.abs(x - flight.x - Math.cos(flight.angle) * flight.size * .25) < 1e-8);
    assert.ok(Math.abs(y - flight.y - Math.sin(flight.angle) * flight.size * .25) < 1e-8);
    assert.ok(radius >= 2 && radius <= 6, "fallback stays readable without becoming a large burst");
    assert.equal(draw(1.25, [launch, launch]).flights.length, 1, "replayed launch does not duplicate flight");
    assert.equal(draw(2, [launch]).flights.length, 1, "fallback remains visible while the outcome is pending");
    const closed = draw(2.1, [launch, { ...launch, id: "cancel", kind: "projectile-cancel", at: 2.1 }]);
    assert.equal(closed.flights.length, 0); assert.equal(closed.hits.length, 0);
  }
});

test("detail flight recovery replaces only its own fallback at the current flight age", () => {
  const { draw, sandbox } = modal({ unavailable: [DETAIL_COMBAT_VFX.bean.image] });
  const launch = shoot();
  assert.equal(draw(1.2, [launch]).flights.length, 1);
  sandbox.detailVfxImages.get(DETAIL_COMBAT_VFX.bean.image).complete = true;
  const recovered = draw(1.4, [launch]);
  assert.equal(recovered.art.length, 1);
  assert.equal(recovered.flights.length, 0);
  assert.equal(recovered.trails.length, 0);
  sandbox.detailVfxImages.get(DETAIL_COMBAT_VFX.bean.image).complete = false;
  assert.equal(draw(1.4, [launch]).flights.length, 1, "draw failure restores fallback without restarting the launch");
  const rejected = modal({ rejectDraw: true });
  assert.equal(rejected.draw(1.2, [launch]).flights.length, 1, "failed draw result also keeps flight visible");
  const unrelated = modal({ unavailable: [DETAIL_COMBAT_VFX.spring.image] });
  const loaded = unrelated.draw(1.2, [launch]);
  assert.equal(loaded.art.length, 1); assert.equal(loaded.flights.length, 0);
});

test("each missing flight keeps its own fallback and authoritative outcomes close it", () => {
  for (const kind of ["hit", "critical", "block", "dodge", "parry", "projectile-cancel"]) {
    const { draw } = modal({ unavailable: [DETAIL_COMBAT_VFX.bean.image] });
    const launch = shoot(), second = shoot({ id: "launch-2", projectileId: "shot-2", at: 1.1, arrivesAt: 2.1 });
    assert.equal(draw(1.2, [launch, second]).flights.length, 2);
    const outcome = { ...launch, id: "outcome", at: 1.3, kind, amount: 0 };
    const result = draw(1.3, [launch, second, outcome]);
    assert.equal(result.flights.length, 1, kind + " closes only the matching flight");
    assert.equal(result.art.length, 0);
    assert.equal(result.hits.length, 0, "zero-damage resolution adds no impact fallback");
    assert.equal(draw(2.2, [launch, second, outcome]).flights.length, 1,
      "the second shot's ETA is not a terminal result");
    assert.equal(draw(2.2, [launch, second, outcome, { ...second, id: "second-cancel", at: 2.2,
      kind: "projectile-cancel", amount: 0 }]).flights.length, 0);
  }
});

test("crossfire preserves loaded art and only falls back for the missing species", () => {
  const { draw, agents, sandbox } = modal({ unavailable: [DETAIL_COMBAT_VFX.bean.image] });
  agents[1].tribe = "spring";
  const launches = [shoot(), shoot({ id: "return", projectileId: "return-shot", sourceId: "target", targetId: "source" })];
  const result = draw(1.2, launches);
  assert.equal(result.art.length, 1); assert.equal(result.art[0].image, DETAIL_COMBAT_VFX.spring.image);
  assert.equal(result.flights.length, 1); assert.equal(result.trails.length, 1);
  sandbox.combatArenaUnits = () => [agents[1]];
  const hidden = draw(1.3, launches);
  assert.equal(hidden.art.length, 0); assert.equal(hidden.flights.length, 0,
    "a fallback cannot invent the absent shooter's origin or target's position");
});

test("area and reflected damage preserve incoming recoil and missing-art fallback in the actual modal", () => {
  for (const kind of ["area", "reflect"]) for (const mode of ["melee", "ranged"]) {
    const { draw, sandbox, agents } = modal({ unavailable: [DETAIL_COMBAT_VFX.hit.image] });
    const incoming = hit({ id: "secondary", kind, mode, sourceId: "target", targetId: "source" });
    const outgoing = hit({ id: "outgoing", mode, at: 1.01 });
    const result = draw(1.05, [incoming, outgoing]);
    assert.equal(result.hits.length, mode === "melee" ? 2 : 1, kind + ":" + mode);
    assert.equal(sandbox.combatVisualEvent(agents[0]).eventId, "secondary",
      "the source's outgoing direct hit cannot hide incoming secondary damage");
    assert.equal(sandbox.combatVisualEvent(agents[0]).kind, "hit", "existing recoil handles actual secondary damage");
    assert.equal(result.flights.length, 0, "ranged splash is not a new projectile");
    sandbox.detailVfxImages.get(DETAIL_COMBAT_VFX.hit.image).complete = true;
    const recovered = draw(1.1, [outgoing, incoming]);
    assert.equal(recovered.art.length, 2);
    assert.equal(recovered.hits.length, 0, "each successful impact replaces its own fallback");
    assert.equal(recovered.flights.length, 0);
  }
});

test("secondary damage does not override defense priority or turn zero damage into a modal hit", () => {
  for (const kind of ["area", "reflect"]) {
    const { draw, sandbox, agents } = modal();
    assert.equal(draw(1.05, [hit({ kind, amount: 0 })]).art.length, 0);
    const defense = hit({ id: "guard", kind: "parry", amount: 0, at: 1.1 });
    const result = draw(1.15, [hit({ id: "secondary", kind, at: 1.1 }), defense]);
    assert.equal(result.art.length, 1);
    assert.equal(result.defense.length, 1);
    assert.equal(result.hits.length, 0);
    assert.equal(sandbox.combatVisualEvent(agents[1]).kind, "parry");
  }
});


test("lethal impacts retain missing-art feedback at the victim's last observed position", () => {
  for (const kind of ["hit", "critical", "block", "area", "reflect"]) for (const mode of ["melee", "ranged"]) {
    const { draw, agents, sandbox, detail } = modal({ unavailable: DETAIL_COMBAT_VFX_ASSETS });
    draw(.9);
    agents[1].health = 0; sandbox.combatRoster.dataset.key = "source";
    const events = [hit({ kind, mode }), hit({ id: "death", kind: "death", amount: 0 })];
    let impact;
    const commands = detail.commands;
    detail.commands = (...args) => { const result = commands(...args); impact = result[0]; return result; };
    const missing = draw(1.05, events);
    assert.equal(missing.art.length, 0);
    assert.equal(missing.hits.length, 1, kind + ":" + mode + " keeps its killing-hit fallback");
    assert.equal(missing.hits[0].path[0][1], impact.x);
    assert.equal(missing.hits[0].path[0][2], impact.y);
    assert.equal(missing.flights.length, 0);
    assert.equal(draw(1.05, [...events, ...events]).hits.length, 1, "repeated snapshots never duplicate the killing hit");
    sandbox.detailVfxImages.get(impact.image).complete = true;
    const recovered = draw(1.1, events);
    assert.equal(recovered.art.length, 1); assert.equal(recovered.hits.length, 0);
    assert.ok(recovered.art[0].args[0] > 0, "recovery uses current effect age");
    sandbox.detailVfxImages.get(impact.image).complete = false;
    assert.equal(draw(1.2, events).hits.length, 1, "a failed draw restores the existing effect without restarting it");
    assert.equal(draw(1.26, events).hits.length, 0, "the existing quarter-second fallback lifetime is preserved");
    assert.equal(draw(1.6, events).hits.length, 0);
  }
});

test("each simultaneous actual hit has its own missing-art feedback without duplicating covered hits or defense", () => {
  for (const kind of ["hit", "area", "reflect"]) {
    const { draw, sandbox } = modal({ unavailable: [DETAIL_COMBAT_VFX.hit.image, DETAIL_COMBAT_VFX.bean.image] });
    const events = [hit({ id: "first", mode: "ranged" }), hit({ id: "second", kind, mode: "melee", at: 1.01 })];
    assert.equal(draw(1.05, events).hits.length, 2, kind + " does not collapse into the latest reaction");
    assert.equal(draw(1.05, [...events].reverse()).hits.length, 2);
    sandbox.detailVfxImages.get(DETAIL_COMBAT_VFX.bean.image).complete = true;
    const partial = draw(1.1, events);
    assert.equal(partial.art.length, 1); assert.equal(partial.hits.length, 1, "loaded first hit replaces only itself");
    sandbox.detailVfxImages.get(DETAIL_COMBAT_VFX.hit.image).complete = true;
    const full = draw(1.15, events);
    assert.equal(full.art.length, 2); assert.equal(full.hits.length, 0);
  }
  for (const kind of ["block", "parry"]) {
    const { draw } = modal({ unavailable: DETAIL_COMBAT_VFX_ASSETS });
    const events = [hit(), hit({ id: "defense", kind, amount: kind === "block" ? 1 : 0, at: 1.01 })];
    const result = draw(1.05, events);
    assert.equal(result.defense.length, 1, "the existing defense cue remains");
    assert.equal(result.hits.length, 1, "the separate actual hit remains alongside defense");
  }
});

test("retained lethal fallbacks rescale with the view and never invent absent living or unseen victims", () => {
  const events = [hit(), hit({ id: "death", kind: "death", amount: 0 })];
  const { draw, agents, sandbox, canvas } = modal({ unavailable: DETAIL_COMBAT_VFX_ASSETS });
  draw(.9); agents[1].health = 0; sandbox.combatRoster.dataset.key = "source";
  const full = draw(1.05, events).hits[0];
  assert.ok(full, "known lethal victim retains a fallback");
  canvas.clientWidth /= 2; canvas.clientHeight /= 2;
  const small = draw(1.05, events).hits[0];
  assert.equal(small.path[0][1], full.path[0][1] / 2); assert.equal(small.path[0][2], full.path[0][2] / 2);
  sandbox.combatWatch.id = "other-fight"; sandbox.combatRoster.dataset.key = "";
  assert.equal(draw(1.1, events).hits.length, 0, "switching views cannot reuse a corpse position");
  for (const lethal of [false, true]) {
    const other = modal({ unavailable: DETAIL_COMBAT_VFX_ASSETS });
    other.detail.clearView();
    other.sandbox.combatArenaUnits = units => units.filter(agent => agent.id !== "target");
    assert.equal(other.draw(1.05, lethal ? events : [hit()]).hits.length, 0,
      "an unseen target has no fabricated fallback position");
  }
  const omitted = modal({ unavailable: DETAIL_COMBAT_VFX_ASSETS });
  omitted.draw(.9); omitted.sandbox.combatArenaUnits = units => units.filter(agent => agent.id !== "target");
  assert.equal(omitted.draw(1.05, [hit()]).hits.length, 0, "an omitted living unit is not a corpse anchor");
});
