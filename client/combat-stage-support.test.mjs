import test from "node:test";
import assert from "node:assert/strict";
import { fixture, withStage, supportDraw, sheep } from "./test-support/combat-stage-support.mjs";

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} != ${expected}`);

test("the laboratory keeps the measured rear hoof planted throughout sheep rams", () => {
  for (const side of [0,1]) for (const keyOnly of [false,true]) for (const combo of [false,true])
    for (const group of [false,true]) for (const [width,height,dpr] of [[360,360,1],[1040,480,2],[1440,680,3]])
      withStage(({ draw }) => {
        const { trial, source } = fixture({ side, keyOnly, combo, group });
        let first; const frames = new Set();
        for (let time = 1; time < source.attack.endsAt - 1e-6; time += .005) {
          trial.time = time;
          const captured = supportDraw(draw(trial), source, time, dpr);
          frames.add(captured.frame);
          first ||= captured;
          captured.support.forEach((value, axis) => near(value, first.support[axis], `hoof axis ${axis}`));
          captured.root.forEach((value, axis) => near(value, first.root[axis], `root axis ${axis}`));
        }
        assert.deepEqual([...frames].sort(), [0,1,2,3,4,5,6,7], "all approved poses were tested");
      }, { width, height, dpr });
});

test("the planted ram still responds to incoming impact recoil and reduced motion", () => {
  for (const side of [0,1]) for (const reduced of [false,true]) withStage(({ draw }) => {
    const { trial, source } = fixture({ side });
    trial.time = 1.37;
    const base = supportDraw(draw(trial, 1000), source, trial.time);
    trial.history.push({ kind: "hit", targetId: source.id, attackerId: "target", damage: 3, time: trial.time });
    draw(trial, 1100);
    const recoil = supportDraw(draw(trial, 1200), source, trial.time);
    const direction = side ? -1 : 1;
    if (reduced) near(recoil.root[0], base.root[0], "no reduced-motion recoil");
    else assert.ok((base.root[0] - recoil.root[0]) * direction > 15, "incoming hit still pushes backward");
  }, { reduced });
});

test("non-support-locked neutral attacks retain their existing 45px contact lunge", () => {
  for (const species of ["soil-boar","vine-turtle","bubble-toad"]) for (const side of [0,1]) withStage(({ draw }) => {
    const { trial, source } = fixture({ side, species });
    trial.time = source.attack.hitAt;
    const body = draw(trial).find(entry => entry.image.includes(`/CreatureAttackV2/${species}/`));
    assert.ok(body);
    const baseline = 1040 * (side ? .6 : .4), direction = side ? -1 : 1;
    near(body.matrix[4], baseline + direction * 45, species);
  });
});

test("support locking leaves the approved asset and all authored frame durations intact", () => {
  assert.equal(sheep.image, "DesignAssets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp");
  assert.deepEqual(sheep.durationsMs, [100,110,120,40,240,90,140,190]);
  assert.equal(sheep.fixedSupport, true);
});
