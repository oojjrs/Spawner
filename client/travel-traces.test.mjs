import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const tribes = ["bean", "pebble", "spore", "spring"];

function renderer(tribe, visits, marks, zoom) {
  const paints = [];
  const clips = [];
  let currentPath = [];
  const stack = [];
  const ctx = {
    globalAlpha: 1, globalCompositeOperation: "source-over",
    save() { stack.push({ globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); },
    restore() { Object.assign(this, stack.pop()); },
    beginPath() { currentPath = []; }, moveTo(x, y) { currentPath.push([x, y]); }, lineTo(x, y) { currentPath.push([x, y]); },
    quadraticCurveTo() {}, closePath() {}, clip() { clips.push([...currentPath]); },
    translate() {}, rotate() {}, ellipse() {},
    createRadialGradient() { return { addColorStop() {} }; },
    stroke() { paints.push({ kind: "stroke", alpha: this.globalAlpha, color: this.strokeStyle, width: this.lineWidth }); },
    fill() { paints.push({ kind: "fill", alpha: this.globalAlpha, color: typeof this.fillStyle === "string" ? this.fillStyle : "gradient" }); }
  };
  const context = createContext({ ctx,
    state: { tribe, camera: { zoom }, simSeconds: 20, footprintLifetime: 180,
      footprints: new Map([["1,1", { x: 1, y: 1, visits, marks }]]) },
    viewport: { width: 640, height: 480 }, idleMotion: { matches: false },
    AGENT_JUMP_PREPARATION: Number(source.match(/const AGENT_JUMP_PREPARATION = ([\d.]+)/)[1]),
    screenToWorld: (x, y) => ({ x: x / zoom, y: y / zoom }),
    worldToScreen: (x, y) => ({ x: x * zoom, y: y * zoom }),
    clamp: (value, low, high) => Math.max(low, Math.min(high, value))
  });
  const styles = source.slice(source.indexOf("    const travelTraceStyles = {"), source.indexOf("    function drawTravelFurrow("));
  runInContext(styles, context);
  for (const name of ["hashNoise", "drawTravelFurrow", "drawTravelSpores", "drawTravelTraces"]) {
    const declaration = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
    assert.ok(declaration, name);
    runInContext(declaration[0], context);
  }
  return { context, paints, ctx, clips };
}

function marks(tribe, at) {
  return Array.from({ length: 6 }, (value, index) => ({ tribe, at, seed: index * 137 + 42, dx: 1, dy: 0 }));
}

test("최근 흔적이 6개로 같아도 반복 통행할수록 모든 종족의 길 농도가 증가한다", () => {
  for (const tribe of tribes) {
    let previous = 0;
    for (const visits of [6, 12, 24, 32]) {
      const render = renderer(tribe, visits, marks(tribe, 19), 36);
      render.context.drawTravelTraces();
      const opacity = render.paints.reduce((sum, paint) => sum + paint.alpha, 0);
      assert.ok(opacity > previous, tribe + ": " + visits);
      assert.ok(render.paints.every(paint => paint.alpha >= 0 && paint.alpha <= 1));
      previous = opacity;
    }
  }
});

test("축소 화면에서도 모든 종족의 길은 밝고 어두운 두 색으로 연결된다", () => {
  for (const tribe of tribes) {
    const render = renderer(tribe, 24, marks(tribe, 19), 4);
    render.context.drawTravelTraces();
    const strokes = render.paints.filter(paint => paint.kind === "stroke");
    assert.ok(strokes.length >= 2, tribe);
    assert.notEqual(strokes[0].color, strokes[1].color);
    assert.ok(strokes[0].width > strokes[1].width);
    assert.ok(strokes[1].alpha > 0);
  }
});

test("옛 흔적의 노출 시점과 수명을 유지하고 통행이 많았던 길도 시간이 지나면 옅어진다", () => {
  for (const tribe of tribes) {
    const render = renderer(tribe, 32, marks(tribe, 19), 36);
    render.context.drawTravelTraces();
    const fresh = render.paints.reduce((sum, paint) => sum + paint.alpha, 0);
    render.paints.length = 0;
    render.context.state.simSeconds = 160;
    render.context.drawTravelTraces();
    assert.ok(render.paints.reduce((sum, paint) => sum + paint.alpha, 0) < fresh);
    for (const time of [18, 19, 199, 200]) {
      render.paints.length = 0;
      render.context.state.simSeconds = time;
      render.context.drawTravelTraces();
      assert.ok(render.paints.every(paint => paint.alpha === 0), tribe + ": " + time);
    }
  }
});

test("종족 정보가 없는 옛 흔적도 현재 군락의 효과로 표시한다", () => {
  for (const tribe of tribes) {
    const current = renderer(tribe, 12, marks(tribe, 19), 36);
    const legacy = renderer(tribe, 12, marks(undefined, 19), 36);
    current.context.drawTravelTraces();
    legacy.context.drawTravelTraces();
    assert.deepEqual(legacy.paints, current.paints, tribe);
  }
});

test("새 흔적은 도착 전부터 지나간 구간까지만 점진적으로 드러난다", () => {
  for (const tribe of tribes) {
    const render = renderer(tribe, 1, [{ tribe, seed: 42, dx: 1, dy: 0, startedAt: 19, at: 21, grounded: true }], 36);
    render.context.state.simSeconds = 19;
    render.context.drawTravelTraces();
    assert.equal(render.paints.length, 0);
    render.context.state.simSeconds = 19.5;
    render.context.drawTravelTraces();
    assert.ok(render.paints.length > 0, tribe);
    assert.equal(render.clips.length, 1);
    const first = (render.clips[0][0][0] + render.clips[0][1][0]) / 2;
    assert.ok(first > 23 && first < 31, tribe);
    render.clips.length = 0;render.paints.length = 0;
    render.context.state.simSeconds = 20.5;
    render.context.drawTravelTraces();
    const later = (render.clips[0][0][0] + render.clips[0][1][0]) / 2;
    assert.ok(later > first && later > 41 && later < 49, tribe);
    render.clips.length = 0;
    render.context.state.simSeconds = 21;
    render.context.drawTravelTraces();
    assert.equal(render.clips.length, 0);
  }
});

test("새싹콩의 흔적도 도약 준비 중에는 생기지 않고 실제 전진을 따라간다", () => {
  const render = renderer("bean", 1, [{ tribe: "bean", seed: 42, dx: 1, dy: 0, startedAt: 19, at: 21, grounded: false }], 36);
  render.context.state.simSeconds = 19.1;
  render.context.drawTravelTraces();
  assert.equal(render.paints.length, 0);
  render.context.state.simSeconds = 20;
  render.context.drawTravelTraces();
  assert.ok(render.paints.length > 0);
  const edge = (render.clips[0][0][0] + render.clips[0][1][0]) / 2;
  assert.ok(edge < 34);
});
