import assert from "node:assert/strict";
import { createCombatStage } from "../combat-stage.mjs";
import { CREATURE_ATTACK_ANIMATIONS, creatureAttackPose } from "../unit-animation.mjs";

// Measured visible rear-sole landmarks from the approved eight attack cels.
const soles = [[199.5,239],[196,239],[198.5,241],[214,253],[239.5,245],[206.5,243],[198,240],[199.5,239]];
export const sheep = CREATURE_ATTACK_ANIMATIONS["cotton-sheep"];
const hit = sheep.durationsMs.slice(0, sheep.impactFrame).reduce((sum, value) => sum + value, 0) / 1000;

export function fixture({ side = 0, keyOnly = false, combo = false, species = "cotton-sheep", group = false } = {}) {
  const source = { id: "source", ...(keyOnly ? { key: species } : { species }), health: 100, mode: "fight", facing: side ? -1 : 1,
    stats: { health: 100 }, combat: { version: 2, side, stunnedUntil: 0 }, x: side,
    attack: { combatId: "simulation", startedAt: 1, hitAt: 1 + hit, endsAt: 1 + sheep.durationMs / 1000, directionX: side ? -1 : 1 } };
  if (combo) Object.assign(source.attack, { meleeContacts: [1 + hit, 1 + hit + .7, 1 + hit + 1.4],
    hitAt: 1 + hit + 1.4, endsAt: 1 + sheep.durationMs / 1000 + 1.4 });
  const target = { id: "target", tribe: "bean", health: 100, mode: "idle", facing: side ? 1 : -1, stats: { health: 100 },
    combat: { version: 2, side: 1 - side, stunnedUntil: 0 }, x: 1 - side };
  const agents = side ? [target, source] : [source, target];
  if (group) agents.push({ ...target, id: "ally", combat: { ...target.combat, side } }, { ...target, id: "opponent" });
  return { source, trial: { agents, history: [], projectiles: [], time: 1, result: () => null } };
}

function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}

export function withStage(run, { width = 1040, height = 480, dpr = 1, reduced = false } = {}) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: dpr };
  globalThis.Image = class { complete = true; naturalWidth = 4096; naturalHeight = 4096; };
  globalThis.SpawnerAssets = { source: path => path };
  let matrix = [1,0,0,1,0,0], stack = [], draws = [];
  const context = new Proxy({
    save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); },
    setTransform(...args) { matrix = args; },
    translate(x,y) { matrix = multiply(matrix,[1,0,0,1,x,y]); },
    scale(x,y) { matrix = multiply(matrix,[x,0,0,y,0,0]); },
    rotate(a) { matrix = multiply(matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]); },
    drawImage(asset, ...args) { draws.push({ image: asset.src, args, matrix: [...matrix] }); }
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const canvas = { clientWidth: width, clientHeight: height, getContext: () => context };
  const stage = createCombatStage(canvas);
  const draw = (trial, now = trial.time * 1000, playing = false) => {
    draws = [];
    const before = JSON.stringify(trial.agents);
    stage.render(trial, now, playing);
    assert.equal(JSON.stringify(trial.agents), before, "rendering must not mutate gameplay");
    return draws;
  };
  try { return run({ stage, draw, canvas }); }
  finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; }
}

export function supportDraw(draws, source, time, dpr = 1) {
  const pose = creatureAttackPose({ ...source, species: "cotton-sheep" }, time);
  const draw = draws.find(draw => draw.image === sheep.image);
  assert.ok(draw && pose, "the approved sheep attack cel is drawn");
  const [sx,sy,sw,sh,dx,dy,dw,dh] = draw.args, [a,b,c,d,e,f] = draw.matrix;
  assert.equal(sx, pose.frame % sheep.columns * sheep.frameSize);
  assert.equal(sy, Math.floor(pose.frame / sheep.columns) * sheep.frameSize);
  const [soleX,soleY] = soles[pose.frame], x = dx + soleX * dw / sw, y = dy + soleY * dh / sh;
  const ratio = Math.min(2, dpr);
  return { ...draw, frame: pose.frame, root: [e / ratio,f / ratio], support: [(a*x+c*y+e)/ratio,(b*x+d*y+f)/ratio] };
}
