import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpseRenderer } from "./corpse-test-fixture.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const forms = ["base", "blade", "secretion", "carapace", "antenna", "feet"];

test("24개 사체 외형은 최종 방향·사망 시트·불투명도와 등록 위치를 보존한다", async t => {
  const render = corpseRenderer(t);
  for (const tribe of tribes) for (const form of forms) {
    const samples = [];
    for (const facing of [-1, 1, undefined]) {
      const corpse = { tribe, kind: "corpse", health: 0, facing, attributes: form === "base" ? {} : { [form]: 1 },
        diedAt: 10, decaysAt: 13 }, before = structuredClone(corpse);
      const pose = unitActionArtPose(corpse, 10.13);
      await render.presentation.prepareAnimation(corpse, 10.13);
      assert.equal(render.draw(corpse, 10.13, .5).action, "death");
      assert.equal(render.draws.length, 1, tribe + "/" + form);
      assert.equal(render.draws[0][0].src, pose.animation.image);
      const target = facing < 0 ? "left" : "right";
      assert.deepEqual(render.scales, [[pose.animation.sourceFacing === target ? 1 : -1, 1]]);
      assert.deepEqual(render.translations, [[40, 80]]);
      assert.deepEqual(render.context.alphas, [.4]);
      assert.equal(render.context.globalAlpha, .8);
      assert.equal(render.outlines.length, 1);
      assert.deepEqual(corpse, before);
      samples.push(render.draws[0].slice(1));
    }
    assert.deepEqual(samples[1], samples[0]);
    assert.deepEqual(samples[2], samples[0]);
  }
});

test("사망 원본 로딩 실패는 대기 원본으로 표시하고 명시 재시도로 사망 프레임을 복구한다", async t => {
  const render = corpseRenderer(t);
  const corpse = { tribe: "bean", attributes: { blade: 1 }, health: 0, diedAt: 10 };
  const pose = unitActionArtPose(corpse, 10.13);
  render.unavailable.add(pose.animation.image);
  await assert.rejects(render.presentation.prepareAnimation(corpse, 10.13), /assets are not ready/);
  render.draw(corpse, 10.13, .5);
  assert.equal(render.draws.length, 1);
  assert.equal(render.draws[0][0].src, pose.reference.image);
  render.unavailable.clear();
  await render.presentation.prepareAnimation(corpse, 10.13, true);
  render.draw(corpse, 10.13, .5);
  assert.equal(render.draws[0][0].src, pose.animation.image);
});

test("세계 사체 호출부는 등록 좌표를 확대하되 방향을 다시 반전하지 않는다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const world = source.match(/^    function drawCorpses\([^]*?^    }/m)?.[0];
  assert.ok(world && world.includes("drawAgentCorpse(ctx, corpse"));
  assert.equal(world.includes("ctx.scale(scale, scale)"), true);
  assert.equal(/scale\([^\n]*(?:facing|side)/.test(world), false);
});
