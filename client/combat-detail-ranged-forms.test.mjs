import test from "node:test";
import assert from "node:assert/strict";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX } from "./combat-detail-vfx.mjs";
import { unitRangedAppearance, unitRangedProjectile } from "./unit-ranged.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function head(command) {
  return { x: command.x + Math.cos(command.angle) * command.size * .25,
    y: command.y + Math.sin(command.angle) * command.size * .25 };
}
function scene(source, reverse = false) {
  const agents = [{ id: "source", tribe: "bean", health: 10, stats: { ranged: true, melee: false }, ...source },
    { id: "target", tribe: "bean", health: 10 }];
  const positions = new Map([["source", { x: reverse ? 820 : 180, y: 350, width: 100, height: 140 }],
    ["target", { x: reverse ? 180 : 820, y: 310, width: 100, height: 140 }]]);
  const view = { scope: "battle", width: 1000, height: 500 };
  const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  const launch = { id: "launch", kind: "shoot", sourceId: "source", targetId: "target",
    mode: "ranged", projectileId: "shot", at: 1, arrivesAt: 2 };
  const draw = (time, events = [launch], visible = agents, cell = 250) => {
    detail.consume(cursor.consume({ streamId: "stream", events }, time), time);
    return detail.commands(visible, positions, time, cell, view);
  };
  draw(0, []);
  return { agents, positions, view, launch, draw };
}

const forms = [
  { stats: { ranged: true, melee: true } },
  ...["blade", "carapace", "antenna", "feet", "strength", "arms"].map(key => ({ attributes: { [key]: 1 } })),
  { appearanceAttributes: { antenna: 1 } },
  ...["blade", "carapace", "antenna", "legs"].map(gene => ({ dna: { pieces: [{ gene }] } }))
];

test("mixed and appendage forms use their own approved species effects without enabling ranged-body art", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true]) for (const form of forms) {
    const { agents, positions, launch, draw } = scene({ tribe, ...form }, reverse);
    assert.equal(unitRangedAppearance(agents[0]), null, "unapproved body animation stays gated");
    assert.equal(unitRangedProjectile(agents[0]), null, "no measured outlet is claimed for this form");
    assert.equal(draw(.99).length, 0, "stats alone cannot invent a launch");
    const command = draw(1)[0], origin = head(command), source = positions.get("source");
    assert.equal(command.image, DETAIL_COMBAT_VFX[tribe].image);
    close(origin.x, source.x); close(origin.y, source.y - source.height * .5);
    source.x += 75; source.y += 60;
    const moved = head(draw(1.5)[0]), target = positions.get("target");
    close(moved.x, (origin.x + target.x) / 2);
    close(moved.y, (origin.y + target.y - target.height * .5) / 2);
    const impact = draw(2, [launch, { ...launch, id: "hit", kind: "hit", at: 2, amount: 3 }]);
    assert.equal(impact.length, 1); assert.equal(impact[0].kind, "impact");
    assert.equal(impact[0].image, DETAIL_COMBAT_VFX[tribe].image);
  }
});

test("body-centred flight anchors survive resizing and authoritative non-damaging outcomes do not burst", () => {
  for (const kind of ["dodge", "parry", "block", "projectile-cancel"]) {
    const { positions, view, launch, draw } = scene({ tribe: "spring", attributes: { feet: 1 } });
    draw(1);
    const before = draw(1.4)[0];
    view.width /= 2; view.height /= 2;
    for (const point of positions.values()) for (const key of ["x", "y", "width", "height"]) point[key] /= 2;
    const after = draw(1.4, undefined, undefined, 125)[0];
    for (const key of ["x", "y", "size"]) close(after[key], before[key] / 2);
    assert.equal(draw(1.5, [launch, { ...launch, id: "result", kind, at: 1.5, amount: 0 }]).length, 0);
  }
});

test("unsupported species and missing actors do not acquire an invented projectile identity or position", () => {
  for (const source of [{ tribe: "unknown" }, { tribe: undefined }, { tribe: "bean", species: "toad" }]) {
    const { draw } = scene(source);
    assert.equal(draw(1).length, 0);
  }
  const { agents, positions, draw } = scene({ tribe: "spore", attributes: { carapace: 1 } });
  assert.equal(draw(1, undefined, agents.slice(1)).length, 0);
  positions.delete("target");
  assert.equal(draw(1).length, 0);
});

test("an actual mixed-build simulation launch renders without changing combat history or state", () => {
  const settings = { left: { key: "pebble", organs: { attack: 1, ranged: 1 }, counts: {} },
    right: { key: "bean", organs: { attack: 1 }, counts: {} }, distance: 2, random: false,
    rules: { maxSeconds: .7 } };
  const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
  const cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
  detail.consume(cursor.consume(trial.vfx, 0), 0);
  trial.advance(.31); control.advance(.31);
  const shot = trial.vfx.events.find(event => event.kind === "shoot");
  assert.ok(shot); assert.equal(trial.agents[0].stats.melee, true); assert.equal(trial.agents[0].stats.ranged, true);
  assert.equal(unitRangedAppearance(trial.agents[0]), null);
  detail.consume(cursor.consume(trial.vfx, trial.time), trial.time);
  const positions = new Map(trial.agents.map((agent, index) => [agent.id,
    { x: index ? 820 : 180, y: 350, width: 100, height: 140 }]));
  const commands = detail.commands(trial.agents, positions, trial.time, 250);
  assert.equal(commands.length, 1); assert.equal(commands[0].image, DETAIL_COMBAT_VFX.pebble.image);
  assert.equal(commands[0].sourceId, shot.sourceId); assert.equal(commands[0].targetId, shot.targetId);
  assert.deepEqual(trial.agents, control.agents); assert.deepEqual(trial.history, control.history);
  assert.deepEqual(trial.result(), control.result());
});
