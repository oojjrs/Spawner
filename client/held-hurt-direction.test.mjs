import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { heldHurtProjectileSide, beanHeldHurtSource, drawBeanHeldHurt, BEAN_HELD_HURT_ASSETS } from "./bean-held-hurt.mjs";
import { speciesHeldHurtSource, drawSpeciesHeldHurt, SPECIES_HELD_HURT_ASSETS } from "./species-held-hurt.mjs";
import { unitDisplaySize, unitFacing } from "./unit-size.mjs";
import { imageDimensions } from "./image-audit.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const unit = extra => ({ id: "target", tribe: "bean", health: 10, facing: 1, attributes: {}, hurtStartedAt: 1, ...extra });
const shot = extra => ({ id: "shot", kind: "shoot", sourceId: "source", targetId: "target", mode: "ranged", projectileId: "p",
  at: .5, arrivesAt: 1, amount: 0, from: { x: 100, y: 100 }, to: { x: 102, y: 100 }, ...extra });
const hit = extra => ({ id: "hit", kind: "hit", sourceId: "source", targetId: "target", mode: "ranged", projectileId: "p",
  at: 1, amount: 1.25, from: { x: 100, y: 100 }, to: { x: 102, y: 100 }, ...extra });
const frame = (...events) => ({ retainedEvents: events });

test("known frozen flight direction selects the incoming side throughout the existing visual hurt", () => {
  for (const side of [-1, 1]) for (const facing of [-1, 1]) {
    const agent = unit({ facing }), events = frame(shot({ from: { x: 102 + side * 2, y: 100 } }), hit());
    for (const time of [1, 1.3, 1.5, 1.7, 1.879]) assert.equal(heldHurtProjectileSide(agent, events, time), side);
    assert.equal(heldHurtProjectileSide(agent, events, .999), null); assert.equal(heldHurtProjectileSide(agent, events, 1.881), null);
    agent.x = 200; agent.y = 200;
    assert.equal(heldHurtProjectileSide(agent, events, 1.3), side, "later recipient motion cannot change the recorded impact side");
  }
  assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit({ from: { x: 105, y: 100 } })), 1.2), -1,
    "source location at impact is not the frozen projectile origin");
});

test("uncertain, hidden, moved-destination, canceled or non-projectile evidence preserves the existing fallback", () => {
  for (const events of [[], [hit()], [shot()], [shot({ from: null }), hit()], [shot(), hit({ sourceId: null })],
    [shot({ sourceId: null }), hit()], [shot(), hit({ targetId: null })], [shot(), hit({ to: null })],
    [shot({ from: { x: 102, y: 99 } }), hit()], [shot(), hit({ to: { x: 103, y: 100 } })],
    [shot({ arrivesAt: 1.2 }), hit()], [shot({ at: 1.1 }), hit()], [shot(), hit({ at: .9 })],
    [shot(), hit({ projectileId: "other" })], [shot(), hit({ sourceId: "other" })],
    [shot(), hit(), { id: "cancel", kind: "projectile-cancel", projectileId: "p", at: .8 }]])
    assert.equal(heldHurtProjectileSide(unit(), frame(...events), 1.2), null);
  for (const kind of ["bleed", "area", "reflect", "regeneration", "stun", "dodge", "parry", "attack", "counter", "projectile-cancel"])
    assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit({ kind })), 1.2), null, kind);
  for (const amount of [0, -1, NaN, Infinity]) assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit({ amount })), 1.2), null);
  assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit({ mode: "melee" })), 1.2), null);
  for (const change of [{ combat: {} }, { birth: {} }, { kind: "corpse" }, { health: 0 }, { hurtStartedAt: NaN }])
    assert.equal(heldHurtProjectileSide(unit(change), frame(shot(), hit()), 1.2), null);
});

test("simultaneous evidence must agree and repeated hits use only the current hurt epoch", () => {
  const otherShot = shot({ id: "s2", projectileId: "p2", sourceId: "other", from: { x: 104, y: 100 } });
  const otherHit = hit({ id: "h2", projectileId: "p2", sourceId: "other" });
  assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit(), otherShot, otherHit), 1.2), null);
  assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit(), { ...otherShot, from: { x: 99, y: 100 } }, otherHit), 1.2), -1);
  for (const change of [{ sourceId: null }, { projectileId: null }, { mode: "melee" }])
    assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit(), { ...otherHit, ...change }), 1.2), null,
      "unknown same-epoch direct damage must not be discarded before agreement");
  for (const kind of ["area", "reflect", "bleed"]) assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit(), hit({ id: kind, kind })), 1.2), null);
  const events = frame(shot(), hit(), { ...otherShot, arrivesAt: 1.2 }, { ...otherHit, at: 1.2 });
  assert.equal(heldHurtProjectileSide(unit({ hurtStartedAt: 1.2 }), events, 1.4), 1);
});

const images = new Map([...BEAN_HELD_HURT_ASSETS, ...SPECIES_HELD_HURT_ASSETS].map(path => {
  const [width, height] = imageDimensions(path); return [path, { path, width, height, complete: true }];
}));
function world(agent, events, time = 1.3, imageFor = path => images.get(path)) {
  const calls = [], ctx = { save() {}, restore() {}, translate() {}, scale(...args) { calls.push({ kind: "scale", args }); },
    drawImage(image, ...args) { calls.push({ kind: "draw", image: image.path, args }); } };
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const helper = source.match(/^    function drawAgentHeldHurt\([^]*?^    }/m)[0];
  const Spawner = { heldHurtProjectileSide, beanHeldHurtSource, speciesHeldHurtSource, drawBeanHeldHurt, drawSpeciesHeldHurt, unitDisplaySize, unitFacing };
  const scope = { Spawner, state: { simSeconds: time }, combatVfxFrame: events, AGENT_HEIGHT: .7, ctx,
    unitDisplayScale: () => 1.5, unitBodySize: () => ({ width: .4 }), agentRangedImage: imageFor,
    unitAnimationSheets: new Map(["bean", "spore", "pebble", "spring"].map(tribe => [tribe, new Map([["idle", { scale: 1.25 }]])])) };
  createContext(scope); runInContext(helper, scope);
  const drawn = scope.drawAgentHeldHurt(ctx, agent, 250, 0, 0, null);
  return { drawn, calls, scope };
}

test("actual world helper uses both approved banks across 24 forms, two facings and two strike sides", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const form of ["base", "blade", "carapace", "secretion", "antenna", "feet"])
    for (const facing of [-1, 1]) for (const side of [-1, 1]) {
      const agent = unit({ tribe, facing, attributes: form === "base" ? {} : { [form]: 1 } });
      const before = structuredClone(agent), events = frame(shot({ from: { x: 102 + side * 2, y: 100 } }), hit());
      const result = world(agent, events), source = beanHeldHurtSource(agent) || speciesHeldHurtSource(agent);
      assert.equal(result.drawn, true); const draw = result.calls.find(call => call.kind === "draw");
      // Species blade/carapace atlases are authored facing left; preserve that
      // source orientation when translating the world hit side to its bank.
      const mirror = (facing < 0) !== (source.sourceFacing === "left");
      const index = side * (mirror ? -1 : 1) > 0 ? source.times.length : 0;
      assert.equal(draw.image, source.image); assert.equal(draw.args[0], index % source.columns * source.frameWidth);
      assert.equal(draw.args[1], Math.floor(index / source.columns) * source.frameHeight);
      assert.deepEqual(result.calls.find(call => call.kind === "scale").args, [mirror ? -1 : 1, 1], "source orientation is composed with world facing");
      assert.deepEqual(agent, before);
    }
});

test("arena/default fallback and missing images keep their original rendering contract", () => {
  for (const combat of [null, { id: "fight", side: 0 }, { id: "fight", side: 1 }]) {
    const agent = unit({ combat }), events = combat ? frame(shot(), hit()) : frame();
    const result = world(agent, events), source = beanHeldHurtSource(agent), draw = result.calls.find(call => call.kind === "draw");
    const index = source.times.length;
    assert.equal(draw.args[0], index % source.columns * source.frameWidth); assert.equal(draw.args[1], Math.floor(index / source.columns) * source.frameHeight);
  }
  assert.equal(world(unit(), frame(shot(), hit()), 1.3, () => null).drawn, false);
  assert.equal(world(unit(), frame(shot(), hit()), 1.881).drawn, false);
});

test("retained current visibility supports recovery after cue expiry without retaining hidden directions", () => {
  const cursor = createCombatVfxCursor(); cursor.consume({ streamId: "a", events: [] }, 0);
  const events = [shot(), hit()];
  const early = cursor.consume({ streamId: "a", events }, 1.1);
  assert.equal(heldHurtProjectileSide(unit(), early, 1.1), -1);
  const tail = cursor.consume({ streamId: "a", events }, 1.7);
  assert.equal(tail.active.length, 0); assert.equal(heldHurtProjectileSide(unit(), tail, 1.7), -1);
  const redacted = cursor.consume({ streamId: "a", events: [shot({ sourceId: null, from: undefined }), hit({ sourceId: null, from: undefined })] }, 1.75);
  assert.equal(heldHurtProjectileSide(unit(), redacted, 1.75), null);
  const restored = createCombatVfxCursor().consume({ streamId: "b", events }, 1.2);
  assert.equal(restored.started.length, 0); assert.equal(heldHurtProjectileSide(unit(), restored, 1.2), -1,
    "current hurt may select its known pose on reconnect without replaying or restarting a hit");
  assert.equal(heldHurtProjectileSide(unit(), cursor.consume({ streamId: "a", events }, .9), .9), null);
});

const dna = genes => ATTRIBUTE_DNA.stats(genes.map(id => { const gene = ATTRIBUTE_DNA.lookup.get(id); return { gene: id, grade: gene.grade, q: 0, r: 0, rotation: 0 }; }));
function realScene(tribe, side) {
  const make = (id, ownerId, genes, x) => ({ id, ownerId, tribe, x, y: 100, health: 100, facing: 1, attributes: {},
    combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: dna(genes) } });
  const source = make("source", "left", ["blade", "secretion"], 102 + side * 2), target = make("target", "right", [], 102), units = [source, target];
  let rolls = 0;
  const environment = { world: { terrain: new Uint8Array(320 * 320).fill(4) },
    games: new Map(["left", "right"].map(owner => [owner, { agents: units.filter(agent => agent.ownerId === owner),
      receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } }])),
    combatRandom: () => { rolls++; return .99; }, damageRandom: () => .5 };
  const combat = createCombat(environment); combat.update(source, 0); const attack = source.attack;
  return { source, target, units, at: attack.hitAt, environment, rolls: () => rolls,
    resolve() { combat.update(source, attack.launchedAt); combat.update(target, attack.hitAt); } };
}

test("real noncombat ranged hits select the correct bank without changing server health, events or RNG", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const side of [-1, 1]) {
    const live = realScene(tribe, side), control = realScene(tribe, side); live.resolve(); control.resolve();
    const snapshot = snapshotCombatVfx(live.environment, live.at), before = structuredClone(snapshot);
    const current = createCombatVfxCursor().consume(snapshot, live.at + .3);
    assert.equal(live.target.combat, undefined); assert.equal(live.target.hurtStartedAt, live.at);
    assert.ok(live.target.health < 100); assert.equal(heldHurtProjectileSide(live.target, current, live.at + .3), side);
    const view = world(live.target, current, live.at + .3); assert.equal(view.drawn, true);
    const source = beanHeldHurtSource(live.target) || speciesHeldHurtSource(live.target), draw = view.calls.find(call => call.kind === "draw");
    const index = side > 0 ? source.times.length : 0;
    assert.equal(draw.args[0], index % source.columns * source.frameWidth); assert.equal(draw.args[1], Math.floor(index / source.columns) * source.frameHeight);
    assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls()); assert.deepEqual(snapshot, before);
  }
});
