import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TALON_OWL_IDLE, talonOwlIdleFrame } from "./talon-owl-idle.mjs";

test("갈퀴부엉이는 기존 idle 뒤 표정을 450ms 유지하고 기본 자세로 돌아온다", () => {
  for (const [elapsed, frame] of [[0, 0], [999, 0], [1000, 1], [2560, 7], [2800, 10],
    [3400, 11], [3460, 12], [3530, 13], [3979, 13], [3980, 14], [4070, 15], [4170, 16], [5369, 16], [5370, 0]]) {
    assert.equal(talonOwlIdleFrame(elapsed), frame, String(elapsed));
    assert.equal(talonOwlIdleFrame(elapsed + 5370), frame, "next loop " + elapsed);
  }
  assert.equal(talonOwlIdleFrame(-100), 0);
  assert.equal(talonOwlIdleFrame(NaN), 0);
});

test("게임의 프레임 크기와 재생 시간이 승인된 원화 시트와 일치한다", () => {
  const manifest = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/TalonOwlIdle/PerchedV4/idle.json", import.meta.url), "utf8"));
  assert.equal(TALON_OWL_IDLE.frameSize, manifest.frameSize[0]);
  assert.equal(TALON_OWL_IDLE.columns, manifest.columns);
  assert.equal(TALON_OWL_IDLE.frameCount, manifest.frameCount);
  assert.equal(TALON_OWL_IDLE.durationMs, manifest.durationMs);
  assert.deepEqual(TALON_OWL_IDLE.durationsMs, manifest.durationsMs);
  assert.equal(manifest.poseOrder[13], 8);
  assert.equal(manifest.poseOrder[16], 0);
});
