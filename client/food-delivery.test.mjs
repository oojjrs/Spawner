import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const functions = ["syncFoodDeliveries", "drawFoodDeliveries"].map(name =>
  source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0]).join("\n");

function fixture(tribe, resourceType) {
  const delivery = { colonyId: 1, x: 1.5, y: 1.5, startedAt: 10, arrivesAt: 11,
    receivedAt: null, amount: 2, resourceType };
  const agent = { id: "worker", tribe, attributes: { gather: 1 }, health: 10, mode: "unload", foodDelivery: delivery };
  const draws = [], points = [], translations = [];
  const sprite = { complete: true, naturalWidth: 64, resourceType };
  const state = { camera: { zoom: 100 }, simSeconds: 10, agents: [agent], rivals: [] };
  let now = 1000;
  const context = {
    state, performance: { now: () => now }, foodDeliveries: new Map(), AGENT_HEIGHT: .4,
    ctx: { save() {}, restore() {}, translate: (x, y) => translations.push({ x, y }), rotate() {},
      drawImage: (...args) => draws.push(args), fillRect() {} },
    unitPresentation: { hasEmbeddedCargo: unit => !!unitActionArtPose(unit, state.simSeconds)?.animation.embeddedCargo },
    deliveryNest: () => ({ id: 1, tribe }), foodDeliveryTarget: () => ({ x: 3, y: 1, top: 0 }),
    worldToScreen: (x, y) => ({ x: x * 100, y: y * 100 }),
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    Spawner: { unitDisplayAttributes, isColonyFood: () => true }, worldMap: {},
    resourceCarrySprites: new Map([[resourceType, sprite]]),
    foodCarryPlacement: () => ({ x: 0, y: -.1, width: .1, height: .1, pivotY: 1,
      crop: { x: 0, y: 0, width: 64, height: 64 } }),
    agentBodyPose: () => ({ pivot: .94, scaleX: 1, scaleY: 1 }), foodDeliveryPoseAt: () => ({}),
    agentDisplayOffset: () => ({ x: 0, y: 0 }), unitDisplayScale: () => 1,
    drawEvolutionPoints: amount => points.push(amount)
  };
  runInNewContext(functions + "\nglobalThis.sync = syncFoodDeliveries; globalThis.draw = drawFoodDeliveries;", context);
  const packet = () => ({ state });
  context.sync(packet(), false);
  return { agent, delivery, state, draws, points, translations, sprite,
    draw(time) { state.simSeconds = time; draws.length = 0; translations.length = 0; context.draw(now); },
    receive() { delivery.receivedAt = 11; state.simSeconds = 11; now += 1000; context.sync(packet(), false); },
    cancel() { agent.foodDelivery = null; agent.mode = "search"; context.sync(packet(), false); } };
}

for (const [tribe, resourceType] of [["bean", "clay"], ["spore", "tree"], ["pebble", "pebbles"], ["spring", "dew"]]) {
  test(`${tribe}: embedded hand cargo still flies to the nest after release`, () => {
    const f = fixture(tribe, resourceType);
    assert.equal(unitActionArtPose(f.agent, 10.5).animation.embeddedCargo, true);
    f.draw(10.23);
    assert.equal(f.draws.length, 0);
    f.draw(10.24);
    assert.equal(f.draws.length, 1);
    assert.equal(f.draws[0][0], f.sprite);
    const start = f.translations[0];
    f.draw(10.62);
    const middle = f.translations[0];
    assert.equal(f.draws.length, 1);
    f.draw(11);
    assert.ok(Math.abs(f.translations[0].x - 300) < 1e-9);
    assert.ok(Math.abs(f.translations[0].y - 100) < 1e-9);
    assert.ok(middle.x > start.x && middle.x < 300);
    assert.ok(middle.y < Math.min(start.y, 100));
    f.receive();
    f.draw(11);
    assert.equal(f.draws.length, 0);
    assert.deepEqual(f.points, [2]);
  });
}

test("cancelled deliveries do not leave a flying resource", () => {
  const f = fixture("bean", "clay");
  f.cancel();
  f.draw(10.5);
  assert.equal(f.draws.length, 0);
});
