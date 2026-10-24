import test from "node:test";
import assert from "node:assert/strict";
import { createHarvestPlayback, syncHarvestPlayback, harvestPlaybackPose } from "./harvest.mjs";

const definition = { key: "twigs", contactFrame: 8, settleFrame: 20, postSeconds: 0.6, harvestSeconds: 1.5 };
const cell = { x: 10, y: 20, resourceType: "twigs", kind: "resource", amount: 3, initialAmount: 3 };

function harvester() {
  return { id: "worker:1", x: 10, y: 20, mode: "harvest", carryingType: "twigs", harvestPrepared: true, harvestReady: 4 };
}

function result(sequence, completedAt, remaining) {
  return { sequence, resourceType: "twigs", x: 10, y: 20, amount: 1, remaining, initialAmount: 3,
    kind: "resource", terrain: "forest", completedAt };
}

test("준비는 정지하며 정상 수확 시각까지 pre만 진행하고 성공 전에는 접촉을 넘지 않는다", () => {
  const playback = createHarvestPlayback();
  const agent = { ...harvester(), carryingType: null, harvestPrepared: false, harvestReady: 2 };
  assert.equal(harvestPlaybackPose(playback, cell, [agent], 1.9, definition).phase, "prepare");
  assert.equal(harvestPlaybackPose(playback, cell, [agent], 1.9, definition).frame, 0);
  const pre = harvestPlaybackPose(playback, cell, [agent], 2.75, definition);
  assert.equal(pre.phase, "harvest");
  assert.equal(pre.progress, 0.5);
  assert.ok(pre.frame < definition.contactFrame);
  const delayed = harvestPlaybackPose(playback, cell, [agent], 3.8, definition);
  assert.equal(delayed.phase, "harvest");
  assert.equal(delayed.frame, definition.contactFrame - 1);
});

test("실제 성공 사건의 시각부터만 접촉과 후처리를 재생한다", () => {
  const playback = createHarvestPlayback();
  const agent = harvester();
  assert.equal(harvestPlaybackPose(playback, cell, [agent], 4.3, definition).frame, 7);
  agent.harvestResult = result(1, 4, 2);
  syncHarvestPlayback(playback, [agent], 4, false);
  const pose = harvestPlaybackPose(playback, { ...cell, amount: 2 }, [agent], 4, definition);
  assert.equal(pose.phase, "collected");
  assert.equal(pose.frame, definition.contactFrame);
  assert.equal(pose.remaining, 2);
  assert.equal(harvestPlaybackPose(playback, { ...cell, amount: 2 }, [], 4.3, definition).frame, 14);
});

test("채집 취소는 pre를 중단하고 잔량을 유지하며 완료 후에는 정착 프레임만 기억한다", () => {
  const playback = createHarvestPlayback();
  const agent = harvester();
  assert.equal(harvestPlaybackPose(playback, cell, [agent], 3.5, definition).phase, "harvest");
  agent.mode = "return";
  const cancelled = harvestPlaybackPose(playback, cell, [agent], 3.6, definition);
  assert.equal(cancelled.phase, "idle");
  assert.equal(cancelled.frame, 0);
  assert.equal(cancelled.remaining, 3);
  assert.equal(cancelled.visible, true);
  agent.harvestResult = result(1, 4, 2);
  syncHarvestPlayback(playback, [agent], 4, false);
  const resting = harvestPlaybackPose(playback, { ...cell, amount: 2 }, [], 100, definition);
  assert.equal(resting.frame, 20);
  assert.equal(resting.phase, "idle");
  assert.equal(playback.effects.size, 1);
});

test("마지막 한 개는 사건 이후 한 번만 보이고 후처리가 끝나면 노드 전체를 숨긴다", () => {
  const playback = createHarvestPlayback();
  const agent = { ...harvester(), harvestResult: result(1, 4, 0) };
  syncHarvestPlayback(playback, [agent], 4, false);
  const depleted = { ...cell, amount: 0 };
  const final = harvestPlaybackPose(playback, depleted, [], 4.5, definition);
  assert.equal(final.phase, "collected");
  assert.equal(final.visible, true);
  assert.ok(final.opacity > 0 && final.opacity < 1);
  const ended = harvestPlaybackPose(playback, depleted, [], 4.6, definition);
  assert.equal(ended.visible, false);
  assert.equal(ended.opacity, 0);
  assert.equal(ended.remaining, 0);
  assert.ok(ended.frame <= 20);
});

test("같은 칸의 여러 일꾼은 최신 성공을 쓰고 실제 셀의 더 최신 잔량을 우선한다", () => {
  const playback = createHarvestPlayback();
  const first = { ...harvester(), harvestResult: result(3, 4, 2) };
  const second = { ...harvester(), id: "worker:2", harvestResult: result(1, 4.1, 1) };
  syncHarvestPlayback(playback, [second, first], 4.2, false);
  assert.deepEqual(playback.effects.get("10,20"), second.harvestResult);
  const pose = harvestPlaybackPose(playback, { ...cell, amount: 0 }, [], 4.3, definition);
  assert.equal(pose.remaining, 0);
  assert.equal(pose.phase, "collected");
});

test("중복·역순 사건과 늦게 발견한 오래된 일꾼의 성공은 다시 재생하지 않는다", () => {
  const playback = createHarvestPlayback();
  const agent = { ...harvester(), harvestResult: result(4, 4, 2) };
  syncHarvestPlayback(playback, [agent], 4, false);
  syncHarvestPlayback(playback, [agent], 4.2, false);
  agent.harvestResult = result(3, 4.2, 1);
  syncHarvestPlayback(playback, [agent], 4.2, false);
  assert.equal(playback.effects.get("10,20").completedAt, 4);
  const late = { ...harvester(), id: "late-worker", harvestResult: result(1, 2, 1) };
  syncHarvestPlayback(playback, [late], 4.3, false);
  assert.equal(playback.effects.get("10,20").completedAt, 4);
  assert.equal(playback.seen.get("late-worker"), 1);
});

test("첫 스냅샷과 방 재진입은 이전 성공을 지우고 이후 새 순번만 재생한다", () => {
  const playback = createHarvestPlayback();
  const agent = { ...harvester(), harvestResult: result(1, 4, 2) };
  syncHarvestPlayback(playback, [agent], 4, true);
  assert.equal(playback.effects.size, 0);
  syncHarvestPlayback(playback, [agent], 4.1, false);
  assert.equal(playback.effects.size, 0);
  agent.harvestResult = result(2, 4.2, 1);
  syncHarvestPlayback(playback, [agent], 4.2, false);
  assert.equal(playback.effects.size, 1);
  syncHarvestPlayback(playback, [agent], 4.3, true);
  assert.equal(playback.effects.size, 0);
});

test("새 수확은 pre부터 시작하며 미리보기 복구 프레임 21~23은 사용하지 않는다", () => {
  const playback = createHarvestPlayback();
  const agent = { ...harvester(), harvestResult: result(1, 4, 2), harvestReady: 5.5 };
  syncHarvestPlayback(playback, [agent], 4, false);
  const stock = { ...cell, amount: 2 };
  assert.equal(harvestPlaybackPose(playback, stock, [agent], 4.8, definition).phase, "harvest");
  for (let tick = 0; tick < 100; tick++) {
    const pose = harvestPlaybackPose(playback, stock, [agent], 4 + tick / 20, definition);
    assert.ok(pose.frame >= 0 && pose.frame <= 20);
  }
});

test("같은 칸의 새 자원이 늘어나면 지난 소진 사건으로 숨기거나 다시 소비하지 않는다", () => {
  const playback = createHarvestPlayback();
  const agent = { ...harvester(), harvestResult: result(1, 4, 0) };
  syncHarvestPlayback(playback, [agent], 4, false);
  const renewed = harvestPlaybackPose(playback, { ...cell, amount: 5 }, [], 4.2, definition);
  assert.equal(renewed.visible, true);
  assert.equal(renewed.opacity, 1);
  assert.equal(renewed.phase, "idle");
  assert.equal(renewed.frame, 0);
  assert.equal(renewed.remaining, 5);
});
