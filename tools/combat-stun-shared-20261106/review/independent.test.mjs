import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { combatStunPose, drawCombatStun } from '../../../client/combat-stun-vfx.mjs';
import { combatDodgePose } from '../../../client/combat-dodge-vfx.mjs';
import { createCombatVfxCursor } from '../../../client/combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from '../../../client/combat-detail-vfx.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(resolve(root, 'client/game.js'), 'utf8');
const helper = readFileSync(resolve(root, 'client/combat-detail-dodge.test.mjs'), 'utf8').split('const event = ')[0];
const box = { assert, source, createContext, runInContext, createCombatVfxCursor, createDetailCombatVfx,
  DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
createContext(box); runInContext(helper.slice(helper.indexOf('function extract(')), box);
const unit = Object.freeze({ id: 'a', health: 10, combat: Object.freeze({ stunnedUntil: 30 }) });

test('independent modal proof: halo receives the exact final body anchor during simultaneous attack, hit recoil and dodge', () => {
  for (const width of [320, 1040, 1600]) for (const reducedMotion of [false, true]) {
    const view = box.modal({ width });
    const ctx = view.canvas.getContext('2d');
    const bodyTranslations = [], calls = [];
    ctx.translate = (x, y) => bodyTranslations.push([x, y]);
    view.sandbox.idleMotion.matches = reducedMotion;
    view.sandbox.Spawner.combatDodgePose = combatDodgePose;
    view.sandbox.Spawner.drawCombatStun = (context, agent, point, time, options) => {
      assert.deepEqual([point.x, point.y], bodyTranslations.at(-1), 'stun anchor must equal the body translation, not the stationary slot');
      calls.push({ id: agent.id, point: structuredClone(point), pose: combatStunPose(agent, point, time, options) });
      return drawCombatStun(context, agent, point, time, options);
    };
    const target = view.agents[1];
    target.combat.stunnedUntil = 2;
    target.attack = { targetId: 'source', startedAt: .9, hitAt: 1.1, endsAt: 1.5 };
    const before = structuredClone(view.agents);
    view.draw(1.05, [
      { id: 'evade', kind: 'miss', sourceId: 'source', targetId: 'target', at: 1, amount: 0 },
      { id: 'hit', kind: 'hit', sourceId: 'source', targetId: 'target', at: 1, amount: 2 }
    ]);
    const observed = calls.find(call => call.id === 'target');
    assert.ok(observed.pose);
    assert.notEqual(observed.point.x, width * .61, 'fixture exercises a displaced actor');
    if (!reducedMotion) assert.ok(observed.point.y < 480 * .76, 'dodge lift must reach the status anchor');
    assert.deepEqual(structuredClone(view.agents), before, 'draw must not mutate authoritative units');
    assert.equal(calls.filter(call => call.pose).length, 1);
  }
});

test('independent bounded geometry sweep includes stroke extents as well as all three squares', () => {
  let seed = 287123;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 15000; i++) {
    const width = 32 + rand() * 1900, height = 32 + rand() * 1000;
    const point = Object.freeze({ x: (rand() * 1.5 - .25) * width, y: (rand() * 1.5 - .25) * height,
      width: 1 + rand() * 500, height: 1 + rand() * 650 });
    const pose = combatStunPose(unit, point, rand() * 29, { width, height });
    for (const [low, high, limit] of [
      [pose.x - pose.radiusX - pose.lineWidth / 2, pose.x + pose.radiusX + pose.lineWidth / 2, width],
      [pose.y - pose.radiusY - pose.lineWidth / 2, pose.y + pose.radiusY + pose.lineWidth / 2, height],
      ...pose.dots.flatMap(dot => [[dot.x - pose.dotSize / 2, dot.x + pose.dotSize / 2, width],
        [dot.y - pose.dotSize / 2, dot.y + pose.dotSize / 2, height]])
    ]) assert.ok(low >= 0 && high <= limit, `offscreen extent ${low},${high}/${limit}`);
  }
});

test('draw restores canvas state even when drawing fails, and never needs mutable unit data', () => {
  let depth = 0;
  const ctx = { save() { depth++; }, restore() { depth--; }, beginPath() {}, ellipse() { throw new Error('test failure'); } };
  const point = Object.freeze({ x: 80, y: 140, width: 50, height: 80 });
  assert.throws(() => drawCombatStun(ctx, unit, point, 1, { width: 320, height: 240 }), /test failure/);
  assert.equal(depth, 0);
  assert.equal(combatStunPose(unit, point, 30, { width: 320, height: 240 }), null);
});

test('the actual runtime bundler can emit and execute both public stun exports without filesystem output', () => {
  const build = readFileSync(resolve(root, 'client/build.mjs'), 'utf8');
  const start = build.indexOf('const imports = '), end = build.indexOf('function writeDesignResources()');
  const sandbox = { root, readFileSync, resolve, dirname, relative };
  createContext(sandbox);
  runInContext(build.slice(start, end) + '\nglobalThis.output = bundle(["client/combat-stun-vfx.mjs"]);', sandbox);
  const runtime = {};
  createContext(runtime);
  runInContext(sandbox.output + '\nglobalThis.Spawner = Object.freeze({ ...modules["client/combat-stun-vfx.mjs"] });', runtime);
  assert.equal(typeof runtime.Spawner.combatStunPose, 'function');
  assert.equal(typeof runtime.Spawner.drawCombatStun, 'function');
  assert.ok(runtime.Spawner.combatStunPose(unit, { x: 80, y: 140, width: 50, height: 80 }, 1, { width: 320, height: 240 }));
  assert.match(build, /let browser = bundle\(\[[^\n]*"client\/combat-stun-vfx\.mjs"/);
  assert.match(build, /globalThis\.Spawner = Object\.freeze\(\{ \.\.\.modules\["client\/combat-stun-vfx\.mjs"\]/);
});
