import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = game.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function control(textContent = "") {
  return { textContent, value: "", disabled: false, attributes: {}, listeners: {},
    style: { setProperty() {} },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    fire(type, event = {}) { this.listeners[type]?.(event); }
  };
}

function zoomFixture() {
  const slider = control(), plus = control(), minus = control();
  const buttons = ["상세", "유닛", "둥지", "영역", "대륙"].map(control);
  const state = { camera: { layer: 1, zoom: 144, x: 0, y: 0 } };
  const source = ["syncPortraitZoomControls", "bindPortraitZoomControls", "updateZoomLayerButtons", "selectZoomLayer"].map(declaration).join("\n");
  const api = new Function("state", "portraitZoomSlider", "portraitZoomIn", "portraitZoomOut", "zoomLayerButtons", "document", "performance",
    `const ZOOM_LAYERS = [288,144,36,8,1], ZOOM_STEPS_PER_LAYER = 4;
     const viewport = { width: 390, height: 560 }, WORLD_SIZE = 1024;
     let zoomTransition = null;
     const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
     const stopCameraTransition = () => {};
     const zoomForLayer = layer => layer;
     ${source}
     bindPortraitZoomControls(); updateZoomLayerButtons();
     return { selectZoomLayer };`
  )(state, slider, plus, minus, buttons, { getElementById: () => control() }, { now: () => 0 });
  return { ...api, state, slider, plus, minus };
}

test("portrait zoom buttons, slider, and existing layer selection stay synchronized", () => {
  const f = zoomFixture();
  assert.equal(f.slider.value, "3");
  assert.equal(f.slider.step, "0.25");
  f.minus.fire("click");
  assert.equal(f.state.camera.layer, 1.25);
  assert.equal(f.slider.value, "2.75");
  f.plus.fire("click");
  assert.equal(f.state.camera.layer, 1);
  f.slider.value = "4"; f.slider.fire("input");
  assert.equal(f.state.camera.layer, 0);
  assert.equal(f.plus.disabled, true);
  assert.equal(f.minus.disabled, false);
  assert.equal(f.slider.attributes["aria-valuetext"], "상세 배율");
  f.slider.value = "0"; f.slider.fire("input");
  assert.equal(f.state.camera.layer, 4);
  assert.equal(f.minus.disabled, true);
  assert.equal(f.plus.disabled, false);
  f.selectZoomLayer(2, 195, 280);
  assert.equal(f.slider.value, "2");
  assert.equal(f.slider.attributes["aria-valuetext"], "둥지 배율");
});

test("portrait zoom clamps endpoints and keeps native slider keys out of map shortcuts", () => {
  const f = zoomFixture();
  f.slider.value = "99"; f.slider.fire("input");
  assert.equal(f.state.camera.layer, 0);
  f.plus.fire("click");
  assert.equal(f.state.camera.layer, 0);
  f.slider.value = "-99"; f.slider.fire("input");
  assert.equal(f.state.camera.layer, 4);
  f.minus.fire("click");
  assert.equal(f.state.camera.layer, 4);
  let stopped = 0;
  f.slider.fire("keydown", { key: "ArrowUp", stopPropagation() { stopped++; } });
  f.slider.fire("keydown", { key: "Tab", stopPropagation() { stopped++; } });
  assert.equal(stopped, 1);
});

test("rotating the tribe screen moves the same enabled start button and retains focus", () => {
  const desktop = { appendChild(node) { node.parentElement = this; } };
  const mobile = { appendChild(node) { node.parentElement = this; } };
  const button = { disabled: false, textContent: "새싹콩 부족으로 시작", parentElement: desktop,
    focus(options) { this.focusOptions = options; } };
  const layout = { matches: true };
  const document = { activeElement: button, getElementById: id => id === "tribe-start-mobile" ? mobile : desktop };
  const position = new Function("portraitLayout", "tribeStart", "document", declaration("positionTribeStart") + "; return positionTribeStart;")(layout, button, document);
  position();
  assert.equal(button.parentElement, mobile);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "새싹콩 부족으로 시작");
  assert.equal(button.focusOptions.preventScroll, true);
  layout.matches = false; position();
  assert.equal(button.parentElement, desktop);
  assert.equal(button.disabled, false);
});
