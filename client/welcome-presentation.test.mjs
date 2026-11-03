import test from "node:test";
import assert from "node:assert/strict";
import { createWelcomeRoster, welcomeCreatureScale } from "./welcome-presentation.mjs";

test("four opening tribes are followed by complete shuffled rounds without A B A repeats", () => {
  let seed = 37;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const tribes = ["bean", "spore", "pebble", "spring"];
  const species = ["boar", "toad", "weasel", "white-paw"];
  const next = createWelcomeRoster(tribes, species, 4, random);
  const choices = Array.from({ length: 804 }, next);
  assert.deepEqual(choices.slice(0, 4), tribes.map(key => ({ key, variant: 0 })));
  for (let i = 4; i < choices.length; i += 8)
    assert.equal(new Set(choices.slice(i, i + 8).map(choice => choice.key)).size, 8);
  for (let i = 4; i < choices.length; i++) {
    assert.notEqual(choices[i].key, choices[i - 1].key);
    assert.notEqual(choices[i].key, choices[i - 2].key);
    assert.ok(choices[i].variant >= 0 && choices[i].variant < 4);
  }
});

test("creatures keep their relative sizes while tall poses fit the mobile header", () => {
  const idle = { frameSize: 300, pivotY: 270, registrationScale: 1.2 };
  const bounds = { width: 220, height: 100 };
  const small = welcomeCreatureScale(idle, bounds, 170, .52, 330, 204);
  const weasel = welcomeCreatureScale(idle, bounds, 170, .72, 330, 204);
  const leader = welcomeCreatureScale(idle, bounds, 100, 1.44, 330, 204);
  assert.ok(weasel > small);
  assert.ok(leader > weasel);
  assert.ok(leader * idle.registrationScale * (idle.pivotY - 100) / idle.frameSize <= 168 + 1e-6);
});
