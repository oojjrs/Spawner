import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { reflectionReturnCommand, reflectionReturnPath, drawReflectionReturn } from "./combat-reflection-vfx.mjs";
import { createDetailCombatVfx, drawDetailVfxCell, drawDetailVitalEffect } from "./combat-detail-vfx.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

const event = { id: "return", eventId: "return", kind: "reflect", at: 1, amount: 2.4,
  sourceId: "beetle", fromId: "beetle", targetId: "attacker", toId: "attacker" };
const target = { x: 140, y: 270, width: 70, height: 100 }, source = { ...target, x: 420 };
function context() {
  const calls = [], result = new Proxy({ calls }, { get: (object, key) => object[key] ??
    ((...args) => calls.push({ name: key, args })) });
  return result;
}

test("반사는 좌우·원근·크기에 관계없이 반사자에서 원래 공격자로 돌아간다", () => {
  for (const reverse of [false, true]) for (const scale of [.2, 1, 2]) {
    const point = value => Object.fromEntries(Object.entries(value).map(([key, value]) => [key, value * scale]));
    const from = point(reverse ? target : source), to = point(reverse ? source : target);
    const first = reflectionReturnCommand(event, to, 1, from), middle = reflectionReturnCommand(event, to, 1.09, from), last = reflectionReturnCommand(event, to, 1.2, from);
    const a = reflectionReturnPath(first), b = reflectionReturnPath(middle), c = reflectionReturnPath(last);
    assert.equal(first.x, to.x); assert.equal(first.y, to.y - to.height * .5);
    assert.equal(first.origin.x, from.x); assert.equal(first.targetId, "attacker");
    assert.deepEqual(a.head, a.start); assert.deepEqual(c.head, c.end);
    assert.ok(Math.abs(b.head.x - a.start.x) < Math.abs(c.head.x - a.start.x));
    assert.equal(Math.sign(Math.cos(b.angle)), Math.sign(to.x - from.x));
    assert.equal(first.image, null, "the damaged attacker never receives block artwork");
  }
});

test("반사 피해와 경로는 이미지가 없어도 보이고 동작 줄이기에서는 고정 화살표를 쓴다", () => {
  const command = reflectionReturnCommand(event, target, 1.05, source), canvas = context();
  assert.equal(drawDetailVfxCell(canvas, null, command), true);
  assert.ok(canvas.calls.some(call => call.name === "quadraticCurveTo"));
  assert.equal(canvas.calls.some(call => call.name === "drawImage"), false);
  const reduced = reflectionReturnCommand(event, target, 1.05, source, { reducedMotion: true });
  const later = reflectionReturnCommand(event, target, 1.3, source, { reducedMotion: true });
  assert.deepEqual(reflectionReturnPath(reduced).head, reflectionReturnPath(later).head);
  assert.equal(reflectionReturnPath(reduced).progress, 1);
  drawDetailVitalEffect(canvas, { ...command, kind: "reflect", channel: "impact", directDamage: true,
    age: .05, bodyHeight: 100, lane: 0 }, { width: 600, height: 350, reducedMotion: true });
  assert.ok(canvas.calls.some(call => call.name === "fillText" && call.args[0] === "반사 피해 −2.4"));
});

test("가려진 반사자 위치는 추정하지 않고 확인된 피해 대상만 표시한다", () => {
  const cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
  const agents = [{ id: "attacker" }, { id: "beetle", species: "spiny-back-beetle" }];
  const positions = new Map([["attacker", target], ["beetle", source]]), view = { scope: "reflection", width: 600, height: 350 };
  const draw = (time, record, points = positions) => {
    detail.consume(cursor.consume({ streamId: "reflection", events: record ? [record] : [] }, time), time);
    return detail.commands(agents, points, time, 100, view);
  };
  draw(0);
  assert.equal(draw(1.02, event)[0].origin.x, source.x);
  const hidden = { ...event, sourceId: null, fromId: null };
  assert.equal(draw(1.05, hidden)[0].origin, null, "even stale visible positions cannot unredact the reflector");
  assert.equal(draw(1.1, event)[0].origin, null, "revealing the source does not restart its already-consumed effect");
  assert.equal(draw(1.15, { ...event, targetId: null, toId: null }).length, 0);
  assert.equal(draw(1.2, event).length, 0);
  assert.equal(draw(1.5, event).length, 0);
  assert.equal(reflectionReturnCommand(hidden, target, 1.05, source).origin, null);
  const missing = reflectionReturnCommand(event, target, 1.05, null), canvas = context();
  assert.equal(drawReflectionReturn(canvas, missing), true);
  assert.equal(canvas.calls.some(call => call.name === "quadraticCurveTo"), false);
});

test("반사 없음·시간 이탈·잘못된 좌표는 추가 효과를 만들지 않는다", () => {
  for (const amount of [0, -1, NaN, Infinity]) assert.equal(reflectionReturnCommand({ ...event, amount }, target, 1.1, source), null);
  for (const time of [.9, 1.45, NaN]) assert.equal(reflectionReturnCommand(event, target, time, source), null);
  assert.equal(reflectionReturnCommand(event, { ...target, x: NaN }, 1.1, source), null);
  assert.equal(reflectionReturnCommand({ ...event, kind: "block" }, target, 1.1, source), null);
  const before = structuredClone({ event, target, source });
  drawReflectionReturn(context(), reflectionReturnCommand(event, target, 1.1, source));
  assert.deepEqual({ event, target, source }, before);
});

test("실제 딱정벌레의 반사 저널은 원래 공격자의 HP 손실과 렌더링 수치를 일치시킨다", () => {
  const trial = createSimulationTrial({ left: { key: "bean", organs: { attack: 1 }, counts: { power: 20, vitality: 50 } }, right: { key: "spiny-back-beetle" }, random: false });
  let reflection;
  for (let tick = 0; tick < 1000 && !reflection; tick++) {
    trial.step(); reflection = trial.vfx.events.find(entry => entry.kind === "reflect" && entry.amount > 0);
  }
  assert.ok(reflection);
  const reflector = trial.agents.find(agent => agent.id === reflection.sourceId);
  const attacker = trial.agents.find(agent => agent.id === reflection.targetId);
  assert.equal(reflector.species, "spiny-back-beetle");
  assert.equal(reflection.fromId, reflector.id); assert.equal(reflection.toId, attacker.id);
  assert.ok(attacker.health < attacker.stats.health);
  const cause = trial.vfx.events.find(entry => entry.id === reflection.causeId);
  assert.equal(cause.sourceId, attacker.id); assert.equal(cause.targetId, reflector.id);
  assert.ok(Math.abs(reflection.amount - cause.amount * .08) < 1e-8, "native beetle retains its 8% return");
  const before = structuredClone(trial.agents), command = reflectionReturnCommand(reflection, target, reflection.at + .05, source);
  assert.equal(command.amount, reflection.amount);
  drawReflectionReturn(context(), command);
  assert.deepEqual(trial.agents, before);
});


test("월드 반사도 같은 되돌림 렌더러를 쓰며 현재 보이지 않는 출발점을 그리지 않는다", () => {
  const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const declaration = game.slice(game.indexOf("    function drawRecordedDnaEffects("), game.indexOf("    function drawAgent(now, agent)"));
  for (const known of [true, false]) for (const reduced of [true, false]) {
    const canvas = context(), commands = [];
    const cue = { ...event, channel: "impact", from: { x: 4, y: 2 }, to: { x: 1, y: 2 } };
    const scope = { ctx: canvas, state: { simSeconds: 1.06 }, idleMotion: { matches: reduced },
      visibleAgents: () => [{ id: "attacker", health: 10 }, ...(known ? [{ id: "beetle", health: 10 }] : [])],
      combatVfxFrame: { active: [cue], projectiles: [], retainedEvents: [], started: [] },
      worldRangedFlights: new Map(), worldRangedImpacts: new Map(), detailVfxRendering: null,
      worldToScreen: (x, y) => ({ x: x * 100, y: y * 100 }),
      Spawner: { unitDisplaySize: () => 1,
        combatReflectionCommand: (...args) => { const command = reflectionReturnCommand(...args); commands.push(command); return command; },
        drawDetailVfxCell } };
    runInNewContext(declaration + "\ndrawRecordedDnaEffects(100);", scope);
    assert.equal(commands.length, 1); assert.equal(commands[0].x, 150); assert.equal(commands[0].y, 250);
    assert.equal(commands[0].reducedMotion, reduced);
    assert.equal(commands[0].origin?.x ?? null, known ? 450 : null);
    assert.equal(canvas.calls.some(call => call.name === "quadraticCurveTo"), known);
  }
});
