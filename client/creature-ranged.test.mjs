import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createContext, runInContext } from "node:vm";
import { CREATURE_RANGED_ANIMATIONS, creatureRangedPose, creatureRangedOutlet } from "./creature-ranged.mjs";
import { CREATURE_ATTACK_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, UNIT_ANIMATION_ASSETS, creatureAttackPose } from "./unit-animation.mjs";
import { imageFrameGeometry } from "./image-geometry.mjs";
import { UNIT_IMAGE_BOUNDS } from "./unit-image-bounds.mjs";
import { unitDisplaySize } from "./unit-size.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX } from "./combat-detail-vfx.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createCombatStage } from "./combat-stage.mjs";

const species = ["flower-tail-bird", "soil-mole", "lantern-keeper", "bubble-toad", "vine-turtle"];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const unit = (key, launches = [10.3], end = launches.at(-1) + .4, directionX = -1) => ({
  id: "source", species: key, health: 10, facing: directionX,
  attack: { dnaRanged: true, startedAt: 10, launchedAt: launches[0], hitAt: launches[0] + .2,
    shotLaunches: launches, endsAt: end, directionX }
});

test("only the approved native ranged sheets are registered, without new projectile artwork", () => {
  assert.deepEqual(Object.keys(CREATURE_RANGED_ANIMATIONS), species);
  const sizes = JSON.parse(readFileSync(new URL("../DesignAssets/image-sizes.json", import.meta.url))).images;
  for (const key of species) {
    const animation = CREATURE_RANGED_ANIMATIONS[key];
    assert.ok(UNIT_ANIMATION_ASSETS.includes(animation.image));
    assert.equal(animation.frameCount, 8);
    assert.equal(animation.durationsMs.reduce((a, b) => a + b, 0), animation.durationMs);
    assert.equal(animation.durationsMs.slice(0, animation.launchFrame).reduce((a, b) => a + b, 0), animation.launchAtMs);
    const bytes = readFileSync(new URL("../" + animation.image, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sizes[animation.image].nativeSource.sha256);
  }
});

test("each authoritative launch selects the release cel in both directions at every combo cadence", () => {
  for (const key of species) for (const direction of [-1, 1]) for (const count of [1, 2, 4, 13]) for (const gap of [.03, .12, .6]) {
    const launches = Array.from({ length: count }, (_, i) => 10.3 + i * gap);
    for (const tail of [0, .4]) {
      const agent = unit(key, launches, launches.at(-1) + tail, direction), before = structuredClone(agent);
      for (const [index, at] of launches.entries()) {
        const pose = creatureAttackPose(agent, at);
        assert.equal(pose.action, "ranged");
        assert.equal(pose.frame, 4);
        assert.equal(pose.shotIndex, index);
        assert.equal(pose.mirrorX, direction > 0);
        assert.deepEqual(creatureRangedPose(JSON.parse(JSON.stringify(agent)), at), pose);
      }
      assert.equal(creatureRangedPose(agent, agent.attack.endsAt + 1e-6), null);
      assert.deepEqual(agent, before);
    }
  }
});

test("terminal releases tolerate arithmetic roundoff but do not persist beyond the attack", () => {
  for (const key of species) for (const start of [.1, 1, 10.01, 100.07, 3600.04]) {
    const launches = Array.from({ length: 4 }, (_, i) => start + .3 + i * .12);
    const agent = unit(key, launches, start + (.3 + 3 * .12));
    agent.attack.startedAt = start;
    for (const at of [...launches, agent.attack.endsAt]) assert.equal(creatureRangedPose(agent, at)?.frame, 4);
    for (const delta of [1e-9, .001, .15]) assert.equal(creatureRangedPose(agent, launches.at(-1) + delta), null);
  }
});

test("finished, canceled, dead, newborn and malformed attacks never invent a release", () => {
  for (const key of species) {
    const agent = unit(key, [10.3, 10.42, 10.54, 10.66], 10.66);
    for (const at of [9.9, NaN, 10.7]) assert.equal(creatureRangedPose(agent, at), null);
    for (const changes of [{ attack: null }, { health: 0 }, { birth: {} }])
      assert.equal(creatureRangedPose({ ...agent, ...changes }, 10.3), null);
    for (const changes of [{ launchedAt: NaN }, { launchedAt: 9 }, { endsAt: 10.2 }, { startedAt: 10.66 }])
      assert.equal(creatureRangedPose({ ...agent, attack: { ...agent.attack, ...changes } }, 10.3), null);
    for (const shotLaunches of [[10.3, NaN], [10.3, 10.66, 10.66], [10.42, 10.66], [10.3, 11]]) {
      const malformed = { ...agent, attack: { ...agent.attack, shotLaunches } };
      assert.equal(creatureRangedPose(malformed, 10.3).frame, 4);
      assert.equal(creatureRangedPose(malformed, 10.66), null);
    }
    const melee = { ...agent, attack: { startedAt: 10, directionX: -1 } };
    assert.equal(creatureAttackPose(melee, 10.1).animation, CREATURE_ATTACK_ANIMATIONS[key]);
    for (const flag of ["mode", "attackMode"]) {
      const ranged = { ...agent, attack: { ...agent.attack, dnaRanged: false, [flag]: "ranged" } };
      assert.equal(creatureAttackPose(ranged, 10.3).action, "ranged");
    }
  }
});

test("measured outlets match the displayed body scale and mirror around the ground pivot", () => {
  for (const key of species) for (const pieceCount of [0, 12]) {
    const agent = { ...unit(key), stats: { pieceCount } }, animation = CREATURE_RANGED_ANIMATIONS[key];
    const idle = CREATURE_IDLE_ANIMATIONS[key], bounds = UNIT_IMAGE_BOUNDS[idle.image];
    const length = Math.max(bounds.width, bounds.height) * idle.frameSize / bounds.frameSize;
    const scale = unitDisplaySize(agent) * idle.viewSize / ((idle.registrationScale || 1) * length * animation.viewSize);
    const left = creatureRangedOutlet(agent, -1), right = creatureRangedOutlet(agent, 1);
    near(left.x, (animation.outletX - animation.pivotX) * scale);
    near(left.y, (animation.outletY - animation.pivotY) * scale);
    near(left.x, -right.x); near(left.y, right.y);
    assert.ok(left.x < 0 && left.y < 0);
  }
  assert.equal(creatureRangedOutlet({ species: "shadow-weasel" }), null);
});

test("world drawing selects native ranged frames and preserves missing-image fallback", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  for (const key of species) {
    const animation = CREATURE_RANGED_ANIMATIONS[key], calls = [];
    const sprite = { complete: true, naturalWidth: 2048 };
    const renderer = createContext({ Spawner: { imageFrameGeometry, creatureAttackPose },
      state: { simSeconds: 10.3, camera: { zoom: 64 } },
      creatureAttackSheets: new Map(), creatureRangedSheets: new Map([[key, { animation, sprite, scale: 1 }]]),
      worldToScreen: () => ({ x: 0, y: 0 }), objectOutlineColor: () => null,
      ctx: { save() {}, restore() {}, translate() {}, scale(x) { calls.push(x); }, drawImage(...args) { calls.push(args); } } });
    runInContext(source.match(/^    function drawCreatureAttack\([^]*?^    }/m)[0], renderer);
    for (const direction of [-1, 1]) {
      assert.equal(renderer.drawCreatureAttack(unit(key, [10.3], 10.7, direction), { x: 0, y: 0 }), true);
      assert.equal(calls.at(-2), direction < 0 ? 1 : -1);
      assert.deepEqual(calls.at(-1).slice(1, 5), [0, 512, 512, 512]);
    }
    sprite.complete = false;
    assert.equal(renderer.drawCreatureAttack(unit(key), { x: 0, y: 0 }), false);
  }
});

test("neutral flights retain their first visible outlet and reuse existing generic flight and hit", () => {
  for (const key of species) for (const direction of [-1, 1]) {
    const source = unit(key), agents = [source, { id: "target", tribe: "bean" }];
    const positions = new Map([["source", { x: direction < 0 ? 800 : 200, y: 400, width: 40, height: 50 }],
      ["target", { x: direction < 0 ? 200 : 800, y: 400, width: 40, height: 50 }]]);
    const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
    const launch = { id: "launch", kind: "shoot", sourceId: "source", targetId: "target", projectileId: "shot", mode: "ranged", at: 1, arrivesAt: 2 };
    const draw = (time, events) => {
      detail.consume(cursor.consume({ streamId: "trial", events }, time), time);
      return detail.commands(agents, positions, time, 200, { width: 1000, height: 500 });
    };
    draw(0, []);
    const first = draw(1, [launch])[0], outlet = creatureRangedOutlet(source, direction);
    const head = command => ({ x: command.x + Math.cos(command.angle) * command.size * .25,
      y: command.y + Math.sin(command.angle) * command.size * .25 });
    const origin = head(first);
    assert.equal(first.image, null);
    near(origin.x, positions.get("source").x + outlet.x * 200);
    near(origin.y, positions.get("source").y + outlet.y * 200);
    positions.get("source").x += 100;
    const next = head(draw(1.5, [launch])[0]);
    near(next.x, (origin.x + positions.get("target").x) / 2);
    near(next.y, (origin.y + positions.get("target").y - 25) / 2);
    const hit = draw(2, [launch, { ...launch, id: "hit", kind: "hit", at: 2, amount: 3 }]);
    assert.equal(hit.at(-1).image, DETAIL_COMBAT_VFX.hit.image);
    detail.clearView();
    assert.equal(draw(2.1, [launch, { ...launch, id: "cancel", kind: "projectile-cancel", at: 2.1 }]).filter(c => c.kind === "flight").length, 0);
  }
});

test("new body registration exactly inverts the approved melee seed transform without replacing its pixels", () => {
  for (const key of ["lantern-keeper", "bubble-toad", "vine-turtle"]) {
    const folder = new URL(`../DesignAssets/Animations/CreatureRangedV1/${key}/`, import.meta.url);
    const map = JSON.parse(readFileSync(new URL("Source/runtime-registration.json", folder)));
    const metadata = JSON.parse(readFileSync(new URL("ranged.json", folder)));
    for (const [path, hash] of [[map.seed, map.seedSha256], [map.referenceImage, map.referenceSha256]])
      assert.equal(createHash("sha256").update(readFileSync(new URL("../" + path, import.meta.url))).digest("hex"), hash);
    assert.ok(map.alphaCentroidErrorPixels < .03);
    assert.ok(map.endpointAlphaAndOpaquePixelsMatchApprovedSeed);
    assert.ok(map.endpointMaximumVisibleColorError <= 1);
    const animation = CREATURE_RANGED_ANIMATIONS[key], old = CREATURE_ATTACK_ANIMATIONS[key];
    for (const [x, y] of [[0, 0], [animation.outletX, animation.outletY], [512, 512]]) {
      near((x - animation.pivotX) / animation.viewSize,
        (x * map.scale + map.offset[0] - old.pivotX) * (old.registrationScale || 1) / old.viewSize);
      near((y - animation.pivotY) / animation.viewSize,
        (y * map.scale + map.offset[1] - old.pivotY) * (old.registrationScale || 1) / old.viewSize);
    }
    assert.equal(metadata.status, "approved-body-integrated");
    assert.equal(metadata.effectsApproved, false);
    assert.equal(metadata.projectileAsset, null);
    assert.equal(metadata.audio, false);
  }
});

test("the actual combat stage selects every approved body release without changing simulation state", () => {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.Image = class {
    complete = true;
    naturalWidth = 2048;
    naturalHeight = 1024;
    set src(value) { this.source = value; }
    get src() { return this.source; }
  };
  globalThis.SpawnerAssets = { source: path => path };
  try {
    for (const key of species) for (const direction of [-1, 1]) {
      const calls = [], context = new Proxy({}, { get: (target, name) => target[name] || ((...args) => calls.push({ name, args })) });
      const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
      const source = { ...unit(key, [10.3], 10.7, direction), mode: "fight", attributes: {},
        combat: { side: direction > 0 ? 0 : 1 }, stats: { health: 10, ranged: true } };
      const target = { id: "target", tribe: "bean", health: 10, mode: "fight", attributes: {},
        combat: { side: direction > 0 ? 1 : 0 }, stats: { health: 10, melee: true } };
      const trial = { agents: [source, target], time: 10.3, history: [], projectiles: [], result: () => null,
        vfx: { version: 1, streamId: "trial", events: [] } };
      const before = JSON.stringify(trial);
      stage.render(trial, 100, false);
      const rendered = calls.filter(c => c.name === "drawImage" && c.args[0]?.src === CREATURE_RANGED_ANIMATIONS[key].image);
      assert.equal(rendered.length, 1, key);
      assert.deepEqual(rendered[0].args.slice(1, 5), [0, 512, 512, 512]);
      assert.equal(JSON.stringify(trial), before);
    }
  } finally {
    globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets;
  }
});
