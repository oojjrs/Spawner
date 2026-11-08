import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";
import { createUnitActionArt, unitActionArtDefinition, unitActionArtPose } from "./unit-action-art.mjs";
import { createCombatEvolutionArt } from "./combat-evolution.mjs";
import { createCombatAttributeArt } from "./combat-attributes.mjs";
import { createUnitPresentation } from "./unit-presentation.mjs";
import { startingWorkerDna } from "../server/tribe-start.mjs";

function surface(width, height) {
  const calls = [], context = { calls, save() {}, restore() {}, translate() {}, scale(x, y) {
    assert.equal(Math.abs(x), Math.abs(y));
  }, drawImage(...args) { calls.push(args); }, getImageData() {
    const data = new Uint8ClampedArray(width * height * 4); data.fill(255); return { data };
  } };
  return { width, height, getContext: () => context };
}

test("채집형과 안테나는 승인된 자기 몸체의 전투 클립을 사용한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const agent = { tribe, dna: startingWorkerDna(tribe), health: 10, mode: "fight", attack: { startedAt: 100 } };
    const definition = unitActionArtDefinition(agent);
    assert.equal(definition, UNIT_ACTION_ART[tribe + "/gather"]);
    for (const time of [100.02, 100.3, 100.7]) {
      const pose = unitActionArtPose(agent, time);
      assert.equal(pose.animation, definition.actions.attack);
      assert.equal(pose.missing, false);
      assert.match(pose.animation.image, new RegExp("ApprovedActionsV1/" + tribe + "/gather/attack"));
    }
    const hurt = unitActionArtPose({ ...agent, attack: null, hurtStartedAt: 100 }, 100.04);
    assert.equal(hurt.animation, definition.actions.hurt);
    assert.equal(hurt.missing, false);
    assert.match(hurt.animation.image, new RegExp("ApprovedActionsV1/" + tribe + "/gather/hurt"));
  }
  const agent = { tribe: "bean", attributes: { antenna: 1 }, health: 10, mode: "fight", attack: { startedAt: 100 } };
  const pose = unitActionArtPose(agent, 100.3);
  assert.equal(pose.animation, UNIT_ACTION_ART["bean/antenna"].actions.attack);
  assert.equal(pose.missing, false);
  assert.equal(pose.animation.defensiveRetaliation, true);
  assert.equal(pose.animation.durationsMs.slice(0, pose.frame).reduce((sum, value) => sum + value, 0), pose.animation.hitTimeMs);
});

test("안테나의 기준 원화는 해당 외형의 마스크를 사용한다", () => {
  assert.match(UNIT_ACTION_ART["bean/antenna"].reference.image, /ApprovedActionsV1\/bean\/antenna\/idle/);
  for (const tribe of ["spore", "pebble", "spring"]) for (const form of ["antenna"]) {
    assert.match(UNIT_ACTION_ART[tribe + "/" + form].reference.image, new RegExp("/" + tribe + "/" + form + "/"));
  }
});

test("모든 전용 클립은 존재하는 단일 시트와 유효한 프레임을 가리킨다", () => {
  for (const [key, definition] of Object.entries(UNIT_ACTION_ART)) for (const animation of [definition.reference, ...Object.values(definition.actions)]) {
    assert.ok(existsSync(animation.image), key + ":" + animation.image);
    assert.ok(animation.frameSize > 0 && animation.columns > 0);
    assert.ok(animation.durationsMs.every(value => value > 0));
    if (animation.frames) {
      assert.equal(animation.frames.length, animation.durationsMs.length);
      assert.ok(animation.frames.every(value => value >= 0 && value < animation.frameCount));
    } else assert.equal(animation.frameCount, animation.durationsMs.length);
  }
});

test("완성 프레임 하나만 그리며 다른 몸체나 기관을 합성하지 않는다", async () => {
  const art = createUnitActionArt(value => value, surface, async image => ({ image }));
  const agent = { tribe: "bean", attributes: { blade: 1, antenna: 1 }, health: 10, mode: "fight", attack: { startedAt: 0 } };
  await art.prepare(agent);
  const canvas = surface(512, 512), context = canvas.getContext("2d");
  assert.equal(art.draw(context, agent, .3, 256, 448, 100, false, null), true);
  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0][0].image, "DesignAssets/Animations/AntennaCombosV1/bean/blade-antenna/attack.png");
});

test("명시적 준비는 기준 또는 동작 이미지 실패를 보고하고 재시도 후에만 완료된다", async t => {
  const agent = { tribe: "bean", attributes: { blade: 1 }, health: 10, mode: "fight", attack: { startedAt: 0 } };
  const pose = unitActionArtPose(agent, .1);
  assert.notEqual(pose.reference.image, pose.animation.image);
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  for (const retry of [false, true]) for (const failed of [pose.reference.image, pose.animation.image]) {
    const requests = [];
    let failing = true;
    const art = createUnitActionArt(value => value, surface, async image => {
      requests.push(image);
      if (image === failed && failing) throw new Error("offline");
      return { image };
    });
    await assert.rejects(art.prepare(agent, .1), /Unit action assets are not ready: bean\/attack/);
    assert.equal(art.readyFrame(agent, .1), false);
    const context = surface(512, 512).getContext("2d");
    Object.assign(context, { beginPath() {}, arc() {}, stroke() {} });
    assert.equal(art.draw(context, agent, .1, 256, 448, 100, false, null), true);
    assert.deepEqual(context.calls.map(call => call[0].image), failed === pose.animation.image ? [pose.reference.image] : []);
    failing = false;
    await assert.rejects(art.prepare(agent, .1), /Unit action assets are not ready/);
    assert.equal(requests.length, 2);
    if (!retry) now += 1001;
    await Promise.all([art.prepare(agent, .1, retry), art.prepare(agent, .1, retry)]);
    assert.equal(art.readyFrame(agent, .1), true);
    assert.equal(art.readyAction(agent, .1), true);
    assert.equal(requests.filter(image => image === failed).length, 2);
    assert.equal(requests.length, 3);
  }
});

test("전투 외형은 기존 파츠 콜백을 호출하지 않고 전용 시트를 재생한다", async () => {
  const art = createCombatEvolutionArt(value => value, surface, async image => ({ image }));
  await art.prepare("bean");
  const rejectParts = () => { throw new Error("폐기한 파츠 합성 호출"); };
  const agent = { tribe: "bean", attributes: { blade: 1 }, health: 10, attack: { startedAt: 0 } };
  art.frame(agent, .3, rejectParts, rejectParts);
  await new Promise(resolve => setImmediate(resolve));
  const frame = art.frame(agent, .3, rejectParts, rejectParts);
  assert.equal(frame.getContext("2d").calls.length, 1);
  assert.match(frame.getContext("2d").calls[0][0].image, /sprout\/Sheets\/blade\/attack/);
});

test("몸체와 잎 및 부속지의 런타임 합성 API는 동작하지 않는다", () => {
  const presentation = createUnitPresentation({ model: {}, createSurface: surface });
  assert.equal(presentation.sproutCombatFrame(), null);
  const rejectTransforms = new Proxy({}, { get() { throw new Error("파츠 변형 호출"); } });
  let drawn = 0;
  presentation.drawRootMotion(rejectTransforms, 0, { tribe: "bean" }, 100, {}, {}, null, () => drawn++);
  presentation.drawAgentFeet(rejectTransforms); presentation.drawAgentHead(rejectTransforms);
  assert.equal(drawn, 1);
});

test("동일한 완성 프레임은 다른 개체에서도 같은 표면을 재사용한다", async () => {
  const art = createUnitActionArt(value => value, surface, async image => ({ image }));
  const agent = { tribe: "bean", attributes: { blade: 1 }, health: 10, mode: "idle" };
  await art.prepare(agent, 0);
  const first = art.frame(agent, 0);
  assert.ok(first);
  assert.equal(art.frame({ ...agent, id: "other" }, 0), first);
  assert.equal(first.getContext("2d").calls.length, 1);
  await art.prepare({ ...agent, tribe: "spore" }, 0);
  assert.equal(art.frame(agent, 0), first);
  const later = art.frame(agent, .2);
  assert.notEqual(later, first);
  assert.equal(later.getContext("2d").calls[0][0], first.getContext("2d").calls[0][0]);
});

test("새싹콩 준비는 크기에 필요한 idle 몸체 경계만 읽고 미사용 프레임을 만들지 않는다", () => {
  const idle = { animation: { frameSize: 4, columns: 1 }, sprite: {} };
  const attack = { animation: { frameSize: 4, columns: 1 }, sprite: {} };
  let allocations = 0, reads = 0;
  const data = new Uint8ClampedArray(64);
  for (const pixel of [5, 6, 9, 10]) data.set([200, 200, 200, 255], pixel * 4);
  const presentation = createUnitPresentation({ model: {}, sheets: new Map([["bean", new Map([["idle", idle], ["attack", attack]])]]),
    createSurface: () => {
      allocations++;
      return { getContext: () => ({ clearRect() {}, drawImage() {}, getImageData() { reads++; return { data }; } }) };
    } });
  presentation.prepareSproutCombatFrames(attack, 64);
  assert.equal(allocations, 0);
  presentation.prepareSproutCombatFrames(idle, 1);
  assert.deepEqual(idle.bodyBounds, [{ x: 1, y: 1, width: 2, height: 2 }]);
  assert.equal(idle.bodyFrames, undefined);
  assert.equal(idle.floors, undefined);
  presentation.prepareSproutCombatFrames(idle, 1);
  assert.equal(allocations, 1);
  assert.equal(reads, 1);
});

test("몸체 경계 픽셀 읽기가 실패하면 빈 결과를 캐시하지 않고 다시 준비한다", () => {
  const idle = { animation: { frameSize: 4, columns: 1 }, sprite: {} };
  let reads = 0;
  const data = new Uint8ClampedArray(64);
  for (const pixel of [5, 6, 9, 10]) data.set([200, 200, 200, 255], pixel * 4);
  const presentation = createUnitPresentation({ model: {}, sheets: new Map([["bean", new Map([["idle", idle]])]]),
    createSurface: () => ({ getContext: () => ({ clearRect() {}, drawImage() {}, getImageData() {
      if (++reads === 1) throw new Error("pixels unavailable");
      return { data };
    } }) }) });
  assert.throws(() => presentation.prepareSproutCombatFrames(idle, 1), /pixels unavailable/);
  assert.equal(idle.bodyBounds, undefined);
  presentation.prepareSproutCombatFrames(idle, 1);
  assert.deepEqual(idle.bodyBounds, [{ x: 1, y: 1, width: 2, height: 2 }]);
  assert.equal(reads, 2);
});

test("명시적인 사체 재생 시각은 정지한 시뮬레이션과 독립적으로 사망 프레임을 진행한다", async t => {
  const previousAssets = globalThis.SpawnerAssets;
  globalThis.SpawnerAssets = { source: path => path, image: () => ({ async decode() {} }) };
  t.after(() => {
    if (previousAssets === undefined) delete globalThis.SpawnerAssets;
    else globalThis.SpawnerAssets = previousAssets;
  });
  const agent = { tribe: "bean", attributes: { blade: 1 }, health: 0, deathStartedAt: 0 };
  const presentation = createUnitPresentation({ model: {}, height: .7, time: () => .1, displayScale: () => 1, createSurface: surface });
  const expected = unitActionArtPose(agent, 1);
  assert.notEqual(expected.frame, unitActionArtPose(agent, .1).frame);
  await presentation.prepareAnimation(agent, 1);
  const context = surface(512, 512).getContext("2d");
  assert.equal(presentation.drawAgentAnimation(context, agent, 256, 448, .7, null, 1).frame, expected.frame);
  assert.deepEqual(context.calls[0].slice(1, 5), [expected.frame % expected.animation.columns * expected.animation.frameSize,
    Math.floor(expected.frame / expected.animation.columns) * expected.animation.frameSize,
    expected.animation.frameSize, expected.animation.frameHeight || expected.animation.frameSize]);
  assert.equal(presentation.drawAgentAnimation(context, agent, 256, 448, .7, null).frame, unitActionArtPose(agent, .1).frame);
});

test("개별 전투 외형 준비는 현재 동작과 초상만 읽고 다른 조합을 선로딩하지 않는다", async () => {
  const requests = [];
  const art = createCombatAttributeArt(value => value, surface, async image => { requests.push(image); return { image }; });
  const agent = { tribe: "bean", attributes: { blade: 1 }, health: 10, mode: "fight", attack: { startedAt: 0 },
    combat: { version: 2, position: { moving: true, moveStartedAt: 0 } } };
  const other = { ...agent, attributes: { carapace: 1 } };
  const pose = unitActionArtPose(agent, .1), definition = unitActionArtDefinition(agent);
  assert.equal(art.readyAgent(agent), false);
  assert.equal(art.bodySize(agent, null), null);
  await Promise.all([art.prepareAgent(agent, .1), art.prepareAgent(agent, .1)]);
  const expected = new Set([pose.reference.image, pose.animation.image, definition.actions.idle.image]);
  assert.deepEqual(new Set(requests), expected);
  assert.equal(requests.length, expected.size);
  assert.equal(art.readyAgent(agent), true);
  assert.equal(art.readyAgent(other), false);
  assert.equal(art.ready("bean"), false);
  assert.equal(art.bodySize(other, null), null);
  assert.ok(art.bodySize(agent, null).width > 0);
  const portrait = art.portrait(agent);
  assert.ok(portrait);
  assert.equal(portrait.getContext("2d").calls[0][0].image, definition.actions.idle.image);
  assert.equal(requests.length, expected.size);
  assert.equal(agent.combat.position.moving, true);
  await art.prepare("bean");
  assert.equal(art.ready("bean"), true);
  assert.equal(art.readyAgent(other), true);
});

test("지정한 외형의 동작 목록은 작업 alias와 동시 요청을 공유하고 미래 탄생을 로딩하지 않는다", async () => {
  const requests = [];
  const art = createUnitActionArt(value => value, surface, async image => { requests.push(image); return { image }; });
  const agent = { tribe: "bean", attributes: { blade: 1, antenna: 1 }, health: 10, mode: "idle" };
  const definition = unitActionArtDefinition(agent);
  const actions = ["idle", "walk", "attack", "ranged", "hurt", "death", "harvest", "throw", "unsupported"];
  await Promise.all([art.prepareActions(agent, actions), art.prepareActions({ ...agent, id: "other" }, actions)]);
  const expected = new Set([definition.reference.image,
    ...["idle", "walk", "attack", "ranged", "hurt", "death"].map(action => definition.actions[action]?.image).filter(Boolean)]);
  assert.deepEqual(new Set(requests), expected);
  assert.equal(requests.length, expected.size);
  for (const unit of [
    { ...agent, mode: "fight", attack: { startedAt: 0 } },
    { ...agent, hurtStartedAt: 0 },
    { ...agent, mode: "harvest", harvestStarted: 0 },
    { ...agent, mode: "unload", foodDelivery: { startedAt: 0, arrivesAt: 1 } }
  ]) assert.ok(art.frame(unit, .1));
  assert.equal(requests.length, expected.size);
});

test("동작 목록 준비도 기준 또는 클립 실패를 전파하고 명시적 재시도만 즉시 허용한다", async t => {
  t.mock.method(Date, "now", () => 1000);
  const agent = { tribe: "bean", attributes: { blade: 1 }, health: 10, mode: "fight", attack: { startedAt: 0 } };
  const definition = unitActionArtDefinition(agent);
  for (const failed of [definition.reference.image, definition.actions.attack.image]) {
    const requests = [];
    let failing = true;
    const art = createUnitActionArt(value => value, surface, async image => {
      requests.push(image);
      if (image === failed && failing) throw new Error("offline");
      return { image };
    });
    await assert.rejects(art.prepareActions(agent, ["attack", "hurt"]), /Unit action assets are not ready/);
    const count = requests.length;
    failing = false;
    await assert.rejects(art.prepareActions(agent, ["attack", "hurt"]), /Unit action assets are not ready/);
    assert.equal(requests.length, count);
    await Promise.all([art.prepareActions(agent, ["attack", "hurt"], true), art.prepareActions(agent, ["attack", "hurt"], true)]);
    assert.equal(art.readyFrame(agent, .1), true);
    assert.equal(requests.filter(image => image === failed).length, 2);
    assert.equal(requests.length, count + 1);
  }
});
