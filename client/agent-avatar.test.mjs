import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const declaration = source.match(/^    function drawAgentAvatars\([^]*?^    }/m)[0];
const invalidation = source.match(/^    function invalidateAgentAvatarLayout\([^]*?^    }/m)[0];
const observers = source.slice(source.indexOf('    objectPanel.addEventListener("scroll", invalidateAgentAvatarLayout'),
  source.indexOf("    function drawAgentAvatars(now)"));

function avatars() {
  const entries = [], draws = [], agentAvatars = new Map(), events = new Map(), resizes = [];
  const reads = { bounds: 0 };
  const scope = createContext({
    objectPanel: { hidden: false, children: [{}, {}], getBoundingClientRect: () => ({ top: 0, bottom: 600 }),
      addEventListener(type, callback) { events.set(type, callback); } },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; resizes.push(this); }
      observe(target) { this.targets.push(target); }
    },
    document: { hidden: false }, window: { devicePixelRatio: 2 },
    unitListEntries: () => entries, agentAvatars, AGENT_HEIGHT: .7,
    state: { simSeconds: 0 }, idleMotion: { matches: false },
    agentBirthPose: () => null, unitDisplayScale: () => 1, interpolatedAgentPosition: () => ({ x: 0, y: 0 }),
    drawAgentAppearance(context, now, agent) { draws.push({ id: agent.id, now }); }
  });
  runInContext(invalidation + observers + declaration, scope);
  function add(id, top) {
    const bounds = { width: 80, height: 80, top, bottom: top + 80 };
    const canvas = { width: 80, height: 80, getBoundingClientRect() { reads.bounds++; return { ...bounds }; } };
    const context = { setTransform() {}, clearRect() {} };
    entries.push({ id, tribe: "bean" });
    agentAvatars.set(id, { canvas, context });
    return bounds;
  }
  return { scope, entries, draws, add, events, resizes, reads };
}

test("보이는 아이콘 1개·6개·18개 모두 60Hz 렌더마다 함께 갱신된다", () => {
  for (const count of [1, 6, 18]) {
    const view = avatars();
    for (let index = 0; index < count; index++) view.add(String(index), Math.floor(index / 3) * 90);
    for (let frame = 0; frame < 60; frame++) view.scope.drawAgentAvatars(frame * 1000 / 60);
    for (const agent of view.entries) {
      const draws = view.draws.filter(draw => draw.id === agent.id);
      assert.equal(draws.length, 60);
      for (let frame = 0; frame < 60; frame++) assert.equal(draws[frame].now, frame * 1000 / 60);
      const canvas = view.scope.agentAvatars.get(agent.id).canvas;
      assert.equal(canvas.width, 160);
      assert.equal(canvas.height, 160);
    }
  }
});

test("120Hz 화면에서도 아이콘을 불필요하게 더 그리지 않는다", () => {
  const view = avatars();
  view.add("visible", 0);
  for (let frame = 0; frame < 120; frame++) view.scope.drawAgentAvatars(frame * 1000 / 120);
  assert.equal(view.draws.length, 60);
});

test("프레임이 지연되면 현재 시각을 그리며 누락 프레임을 뒤늦게 몰아 그리지 않는다", () => {
  const view = avatars();
  for (let index = 0; index < 18; index++) view.add(String(index), 0);
  for (const now of [0, 250, 1000, 1001]) view.scope.drawAgentAvatars(now);
  for (const agent of view.entries) {
    assert.deepEqual(view.draws.filter(draw => draw.id === agent.id).map(draw => draw.now), [0, 250, 1000]);
  }
});

test("화면 밖과 크기가 없는 아이콘은 생략하고 스크롤로 보이면 즉시 갱신한다", () => {
  const view = avatars();
  const above = view.add("above", -80);
  view.add("below", 600);
  view.add("visible", 100);
  view.add("partial", -40);
  view.add("zero", 200).width = 0;
  view.entries.push({ id: "removed" });
  view.scope.drawAgentAvatars(0);
  assert.deepEqual(view.draws.map(draw => draw.id), ["visible", "partial"]);
  above.top = 0;
  above.bottom = 80;
  view.events.get("scroll")();
  view.scope.drawAgentAvatars(1000 / 60);
  assert.deepEqual(view.draws.slice(2).map(draw => draw.id), ["above", "visible", "partial"]);
});

test("카드 위치는 매 프레임 읽지 않고 패널과 앞쪽 섹션 크기가 바뀔 때 다시 읽는다", () => {
  const view = avatars();
  view.add("visible", 0);
  for (let index = 0; index < 100; index++) view.add(String(index), 600 + index * 80);
  for (let frame = 0; frame < 60; frame++) view.scope.drawAgentAvatars(frame * 1000 / 60);
  assert.equal(view.reads.bounds, 101);
  assert.equal(view.resizes[0].targets.length, 3);
  assert.equal(view.resizes[0].targets[0], view.scope.objectPanel);
  assert.equal(view.resizes[0].targets[1], view.scope.objectPanel.children[0]);
  view.resizes[0].callback();
  view.scope.drawAgentAvatars(1000);
  assert.equal(view.reads.bounds, 202);
});

test("화면 배율이 바뀌면 같은 프레임에서도 캔버스 해상도를 즉시 맞춘다", () => {
  const view = avatars();
  view.add("visible", 0);
  view.scope.drawAgentAvatars(0);
  view.scope.window.devicePixelRatio = 3;
  view.scope.drawAgentAvatars(1);
  assert.equal(view.draws.length, 2);
  assert.equal(view.scope.agentAvatars.get("visible").canvas.width, 240);
});

test("패널이나 문서가 숨겨졌거나 목록이 비어 있으면 아이콘을 그리지 않는다", () => {
  const view = avatars();
  view.scope.drawAgentAvatars(0);
  view.add("visible", 0);
  view.scope.objectPanel.hidden = true;
  view.scope.drawAgentAvatars(1000 / 60);
  view.scope.objectPanel.hidden = false;
  view.scope.document.hidden = true;
  view.scope.drawAgentAvatars(2000 / 60);
  assert.deepEqual(view.draws, []);
});
