import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./combat-lab.js", import.meta.url), "utf8");
const resetSource = source.slice(source.indexOf("function reset()"), source.indexOf("function render()"));
function fixture() {
  const preparations = [], paints = [];
  const scope = { playing: true, trial: null, stageReady: true, stageError: null, stagePreparation: null,
    audio: { stop() {} }, SpawnerCombatAudio: { reset() {} }, audioPlayback: {},
    elements: { status: {} }, settings: () => ({}), createSimulationTrial: () => ({ agents: [] }),
    combatStage: { prepare(trial) { const pending = Promise.withResolvers(); preparations.push({ trial, ...pending }); return pending.promise; } },
    settingError: error => error.message,
    render() { paints.push({ ready: scope.stageReady, error: scope.stageError }); } };
  createContext(scope);
  runInContext(resetSource, scope);
  return { scope, preparations, paints };
}

for (const rejectOld of [false, true]) test("a replaced trial cannot finish the current loading gate after " + (rejectOld ? "failure" : "success"), async () => {
  const { scope, preparations, paints } = fixture();
  scope.reset();
  assert.equal(scope.stageReady, false);
  scope.reset();
  const current = scope.stagePreparation;
  assert.notEqual(preparations[0].trial, preparations[1].trial);
  if (rejectOld) preparations[0].reject(new Error("old failure")); else preparations[0].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(scope.stageReady, false);
  assert.equal(scope.stageError, null);
  assert.equal(scope.stagePreparation, current);
  assert.equal(paints.length, 2);
  preparations[1].resolve();
  await current;
  assert.equal(scope.stageReady, true);
  assert.equal(scope.stagePreparation, null);
});

test("the current loading failure keeps play disabled and reset retries the new trial", async () => {
  const { scope, preparations } = fixture();
  scope.reset();
  const error = new Error("missing body"), first = scope.stagePreparation;
  preparations[0].reject(error);
  await first;
  assert.equal(scope.stageReady, false);
  assert.equal(scope.stageError, error);
  scope.reset();
  assert.equal(scope.stageError, null);
  preparations[1].resolve();
  await scope.stagePreparation;
  assert.equal(scope.stageReady, true);
});
