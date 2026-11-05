import test from "node:test";
import assert from "node:assert/strict";
import { createBeanCombatArt, BEAN_COMBAT_ART_ASSETS } from "./combat-stage-bean-art.mjs";

function fixture({ missing, malformed = false, blank = false, throwing = false } = {}) {
  const images = new Map(BEAN_COMBAT_ART_ASSETS.map(path => [path, { path, width: 512, height: 512 }]));
  const surfaces = [];
  const createSurface = (width, height) => {
    const calls = [], canvas = { width, height, calls };
    const context = Object.fromEntries(["drawImage", "translate", "save", "restore", "beginPath", "rect", "clip", "putImageData", "scale", "rotate", "transform", "moveTo", "lineTo", "closePath", "stroke"]
      .map(name => [name, (...args) => calls.push([name, ...args])]));
    context.getImageData = () => {
      if (throwing) throw new Error("unreadable pixels");
      if (malformed) return { data: new Uint8ClampedArray(0) };
      const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      if (!blank) for (let y = Math.floor(canvas.height * .4); y < canvas.height * .8; y++)
        for (let x = Math.floor(canvas.width * .25); x < canvas.width * .75; x++)
          data.set([200, 190, 200, 255], (y * canvas.width + x) * 4);
      return { data };
    };
    canvas.getContext = () => context;
    surfaces.push(canvas);
    return canvas;
  };
  return { images, surfaces, art: createBeanCombatArt({ createSurface, imageFor: path => path === missing ? null : images.get(path) }) };
}
const sprite = { width: 128, height: 64 };
const animation = { frameSize: 64, columns: 2, frameCount: 2, pivotX: 32, pivotY: 56 };

test("bean single attributes retain canonical padding, source frame and appearance separation", () => {
  const { art } = fixture();
  for (const attribute of ["antenna", "feet"]) for (let level = 1; level <= 4; level++) {
    const projected = { [attribute]: level }, before = JSON.stringify(projected);
    const result = art.frame(sprite, animation, 1, projected);
    assert.ok(result);
    assert.equal(result.width, attribute === "feet" ? 96 : 64);
    assert.equal(result.height, result.width);
    assert.equal(art.frame(sprite, animation, 1, projected), result, "successful frame is cached");
    assert.equal(JSON.stringify(projected), before);
    const part = result.calls.find(call => call[0] === "drawImage" && call[1]?.path);
    assert.ok(part[1].path.includes(attribute === "feet" ? "feet-1" : `antenna-${level === 1 ? 1 : 2}`));
    if (attribute === "feet") {
      const source = result.calls.find(call => call[0] === "drawImage" && call[1] === sprite);
      assert.deepEqual(source.slice(2, 6), [64, 0, 64, 64]);
      assert.equal(result.calls.find(call => call[0] === "translate")[1], 16);
    }
  }
});

test("missing, unreadable, blank and malformed pixels preserve source fallback", () => {
  for (const options of [{ missing: BEAN_COMBAT_ART_ASSETS[0] }, { missing: BEAN_COMBAT_ART_ASSETS[3] },
    { malformed: true }, { blank: true }, { throwing: true }]) {
    assert.equal(fixture(options).art.frame(sprite, animation, 0, { antenna: 1 }), null);
  }
  const { art, images } = fixture();
  const path = BEAN_COMBAT_ART_ASSETS[3], part = images.get(path);
  images.delete(path);
  assert.equal(art.frame(sprite, animation, 0, { antenna: 1 }), null);
  images.set(path, part);
  assert.ok(art.frame(sprite, animation, 0, { antenna: 1 }), "missing assets do not poison the cache");
  for (const attrs of [{}, { antenna: 1, feet: 1 }, { blade: 1 }, { antenna: 5 }])
    assert.equal(art.frame(sprite, animation, 0, attrs), null);
  assert.equal(art.frame(sprite, animation, 2, { feet: 1 }), null);
});


test("bean source frame cache evicts old poses and recomputes them", () => {
  const { art } = fixture();
  const sheet = { width: 64 * 14, height: 64 };
  const longAnimation = { ...animation, columns: 14, frameCount: 14 };
  const attrs = { antenna: 1 };
  const first = art.frame(sheet, longAnimation, 0, attrs);
  const second = art.frame(sheet, longAnimation, 1, attrs);
  for (let index = 2; index < 12; index++) assert.ok(art.frame(sheet, longAnimation, index, attrs));
  assert.equal(art.frame(sheet, longAnimation, 0, attrs), first, "recent access keeps a pose cached");
  assert.ok(art.frame(sheet, longAnimation, 12, attrs));
  assert.equal(art.frame(sheet, longAnimation, 0, attrs), first);
  const recomputed = art.frame(sheet, longAnimation, 1, attrs);
  assert.ok(recomputed);
  assert.notEqual(recomputed, second, "least recently used pose was evicted");
  assert.equal(recomputed.width, second.width);
});


test("idle uses intact canonical body and neutral root rig, not the combat cut", () => {
  const originalPath = globalThis.Path2D;
  globalThis.Path2D = class { moveTo() {} lineTo() {} closePath() {} };
  try {
    const { art, surfaces } = fixture();
    for (const attrs of [{ feet: 1 }, { antenna: 1 }]) {
      const idle = art.frame(sprite, animation, 0, attrs, "idle");
      assert.ok(idle);
      const combat = art.frame(sprite, animation, 0, attrs, "attack");
      assert.ok(combat);
      assert.notEqual(idle, combat, "idle and combat caches are distinct");
      assert.equal(idle.width, combat.width);
      assert.ok(idle.calls.some(call => call[0] === "drawImage" && call[1]?.path?.endsWith("BaseParts/body.png")));
      assert.ok(!idle.calls.some(call => call[0] === "clip" || call[0] === "rect"), "intact idle body is not cut");
      assert.ok(!idle.calls.some(call => call[0] === "drawImage" && call[1] === sprite), "combat body pixels are not used for idle");
      if (attrs.feet) {
        assert.equal(idle.calls.filter(call => call[0] === "drawImage" && call[1]?.path?.includes("BaseParts/sprout-")).length, 3);
        assert.ok(surfaces.some(surface => surface.calls.some(call => call[0] === "drawImage" && call[1]?.path?.endsWith("bean-root-rig.png"))));
      }
    }
  } finally {
    if (originalPath === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = originalPath;
  }
});
