import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTribeAttributeAnimation } from "./attribute-animation.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";
import { createCombatEvolutionArt } from "./combat-evolution.mjs";

function surface(width, height) {
  const calls = [], pixels = new Uint8ClampedArray(width * height * 4).fill(255), stack = [];
  let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const canvas = { width, height, calls };
  const ctx = { canvas, globalAlpha: 1, globalCompositeOperation: "source-over",
    save() { stack.push({ matrix: { ...matrix }, alpha: this.globalAlpha }); },
    restore() { const prior = stack.pop(); matrix = prior.matrix; this.globalAlpha = prior.alpha; },
    transform() {}, translate() {}, scale() {}, rotate() {},
    getTransform() { return matrix; }, setTransform() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, rect() {},
    drawImage(image, ...args) { calls.push({ image, args, alpha: this.globalAlpha }); },
    getImageData() { return { width, height, data: new Uint8ClampedArray(pixels) }; },
    putImageData(image) { canvas.pixels = image.data; }
  };
  canvas.getContext = () => ctx;
  return canvas;
}
const asset = path => "data:application/json;base64," + readFileSync(new URL("../" + path, import.meta.url)).toString("base64");
const image = async file => ({ file, width: 512, height: 512 });
function leaves(canvas, alpha = 1) {
  return canvas.calls.flatMap(call => call.image.calls ? leaves(call.image, alpha * call.alpha) :
    [{ image: call.image, alpha: alpha * call.alpha }]);
}
const feet = canvas => leaves(canvas).filter(call => /Attributes\/v2\/Parts\/feet-(left|right)\.png$/.test(call.image.file));

test("ordinary pebble attachments retract both feet only during the approved tucked attack cels", async () => {
  const art = createTribeAttributeAnimation(asset, surface, image);
  await art.prepare("pebble");
  const animation = UNIT_ANIMATIONS.pebble.attack;
  for (let mask = 1; mask < 8; mask++) {
    const attributes = Object.fromEntries(["antenna", "strength", "feet"].map((key, bit) => [key, mask >> bit & 1]));
    for (let frame = 0; frame < animation.frameCount; frame++) {
      const result = art.frame("pebble", attributes, { file: animation.image }, animation, frame, "attack", frame / 20);
      assert.equal(feet(result).length, frame >= 3 && frame <= 11 ? 0 : 2, `${mask} frame ${frame}`);
    }
  }
});

test("feet return after cancellation and other species and actions keep their support pixels", async () => {
  for (const tribe of ["pebble", "spore", "spring"]) {
    const art = createTribeAttributeAnimation(asset, surface, image);
    await art.prepare(tribe);
    const agent = { id: tribe, tribe, attributes: { antenna: 1, strength: 1, feet: 1 } };
    for (const action of ["attack", "idle", "walk", "hurt", "death", "attack"]) {
      const animation = UNIT_ANIMATIONS[tribe][action];
      const pose = art.pose(agent, { action, animation, frame: 5 }, 10);
      const sourceAnimation = pose.sourceAnimation || animation;
      const result = art.frame(tribe, agent.attributes, { file: sourceAnimation.image }, sourceAnimation,
        pose.sourceFrame, action, 10, pose);
      assert.equal(feet(result).length, tribe === "pebble" && pose.sourceAction === "attack" ? 0 : 2, `${tribe} ${action}`);
    }
  }
});

test("feet-only tucked pebble keeps the native body sole instead of cropping it off", async () => {
  const art = createTribeAttributeAnimation(asset, surface, image);
  await art.prepare("pebble");
  const animation = UNIT_ANIMATIONS.pebble.attack;
  const result = art.frame("pebble", { feet: 1 }, { file: animation.image }, animation, 5, "attack", .3);
  const core = result.calls[0].image, base = core.calls[0].image;
  const rig = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/pebble/Animations/Attributes/v1/rig.json", import.meta.url)));
  const row = Math.ceil(rig.animations.attack.tracks[5].cut * animation.frameSize / 144);
  assert.equal(base.pixels[(row * animation.frameSize + 256) * 4 + 3], 255, "native body contact is retained");
  assert.equal(result.calls[0].args[1], 0, "original body is not shifted upward for invisible feet");
});

test("carapace hop combinations follow the approved hidden and visible foot phases", async () => {
  const art = createCombatEvolutionArt(asset, surface, image);
  await art.prepare("pebble");
  const draw = (ctx, pose, layer) => ctx.drawImage(layer || "full");
  draw.splitFeet = true;
  const agent = { tribe: "pebble", health: 10, attributes: { carapace: 1, feet: 1, antenna: 1 },
    attack: { startedAt: 10, speed: 1 } };
  for (const [age, expected] of [[0, 1], [.16, 1], [.24, 0], [.3, 0], [.38, 1], [.52, 1]]) {
    const draws = leaves(art.frame(agent, 10 + age, null, draw));
    assert.equal(draws.some(call => call.image === "full"), false, "no baked feet remain in the body");
    const foot = draws.filter(call => call.image === "combat-feet");
    assert.equal(foot.length, 1);
    assert.equal(foot[0].alpha, expected, `hop ${age}s`);
    assert.ok(draws.some(call => call.image === "combat-body" && call.alpha === 1));
  }
});
