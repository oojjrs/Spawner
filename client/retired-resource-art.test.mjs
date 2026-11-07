import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { IMAGE_SCALES } from "./image-scales.mjs";
import { RESOURCE_HARVEST_ANIMATIONS } from "./harvest-assets.mjs";

const root = new URL("../", import.meta.url);
const read = name => readFileSync(new URL(name, root), "utf8");
const retired = [
  "DesignAssets/Animations/Resources/HarvestV1/honey-mushrooms/sheet.png",
  "DesignAssets/Animations/food-mushroom-pile-harvest.png",
  "DesignAssets/Foods/food-mushroom-pile.png",
  "DesignAssets/Foods/food-mushroom-single.png",
  "DesignAssets/Foods/food-meat.png",
  "DesignAssets/ResourceConcepts/v1/resource-carapace.png"
];

test("image audit and display registries do not restore retired resource artwork", () => {
  const policy = JSON.parse(read("DesignAssets/image-sizes.json"));
  for (const path of retired) {
    assert.equal(policy.images[path], undefined, path);
    assert.equal(IMAGE_SCALES[path], undefined, path);
  }
  for (const path of Object.keys(policy.images)) {
    assert.ok(existsSync(new URL(path, root)), "registered source exists: " + path);
  }
  for (const path of Object.keys(IMAGE_SCALES)) {
    assert.ok(existsSync(new URL(path, root)), "scaled source exists: " + path);
  }
});

test("generated scale copies and thumbnail maps exclude retired resource paths", () => {
  for (const name of ["Combat.html", "DesignAssets/codex-food.html", "client/runtime.js",
    "client/unit-appearance-preview-runtime.js", "client/vfx-event-preview.js", "client/design-previews.js"]) {
    const source = read(name);
    for (const path of retired) assert.equal(source.includes(path), false, name + ": " + path);
  }
});

test("legacy resource catalogue is removed without changing active resource clips or saved-map compatibility", () => {
  for (const file of ["catalog.json", "rummage-prompts.json", "source-prompts.json"]) {
    assert.equal(existsSync(new URL("DesignAssets/Animations/Resources/HarvestV1/" + file, root)), false);
  }
  assert.deepEqual(RESOURCE_HARVEST_ANIMATIONS.map(clip => clip.resourceType), ["tree", "dew", "pebbles", "clay"]);
  for (const clip of RESOURCE_HARVEST_ANIMATIONS) assert.ok(existsSync(new URL(clip.image, root)), clip.image);
  for (const path of ["DesignAssets/Foods/food-berry-bush.png", "DesignAssets/Audio/clay-harvest-handful.mp3",
    "DesignAssets/Audio/mushroom-harvest-loop.mp3", "DesignAssets/Audio/mushroom-throw.mp3", "server/resource-legacy.mjs"]) {
    assert.ok(existsSync(new URL(path, root)), "still used or required for compatibility: " + path);
  }
  assert.ok(read("server/resources.mjs").includes("REMOVED_RESOURCE_TYPES"));
});
