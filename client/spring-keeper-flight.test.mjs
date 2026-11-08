import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import * as animations from "./unit-animation.mjs";
import { createEncounters } from "../server/encounters.mjs";

function bird() {
  return { id: "spring-keeper:1", species: "spring-keeper", health: 10, mode: "walk",
    moveStartedAt: 5, moveDuration: 2, flightStartedAt: 5, flightStoppedAt: null, stepCount: 1 };
}

test("봄지기는 한 번 이륙한 뒤 연속 이동 중에는 날갯짓만 반복한다", () => {
  const agent = bird();
  assert.equal(animations.springKeeperFlightPose(agent, 4.9), null);
  assert.equal(animations.springKeeperFlightPose(agent, 5).stage, "takeoff");
  assert.equal(animations.springKeeperFlightPose(agent, 5.32).stage, "flight");
  for (const time of [5.4, 5.9, 6.4, 6.99]) {
    const pose = animations.springKeeperFlightPose(agent, time);
    assert.equal(pose.stage, "flight");
    assert.ok(pose.frame >= 4 && pose.frame < 12);
  }
  agent.moveStartedAt = 7;
  agent.stepCount++;
  assert.equal(animations.springKeeperFlightPose(agent, 7).stage, "flight");
  assert.ok(animations.springKeeperFlightPose(agent, 7).phase > 2);
});

test("봄지기는 정지 후 발을 내딛고 날개를 접으며 착지한 뒤 대기로 돌아간다", () => {
  const agent = { ...bird(), mode: "idle", flightStoppedAt: 7 };
  for (const time of [7, 7.08, 7.16, 7.24]) {
    const pose = animations.springKeeperFlightPose(agent, time);
    assert.equal(pose.stage, "landing");
    assert.ok(pose.frame >= 12 && pose.frame < 16);
  }
  assert.equal(animations.springKeeperFlightPose(agent, 7.32), null);
  agent.mode = "walk";
  agent.moveStartedAt = agent.flightStartedAt = 9;
  agent.flightStoppedAt = null;
  assert.equal(animations.springKeeperFlightPose(agent, 9).frame, 0);
  agent.health = 0;
  assert.equal(animations.springKeeperFlightPose(agent, 9.1), null);
});

test("봄지기 날갯짓 소리의 강세는 이륙과 비행 하강 스트로크에 맞고 정지 후 반복되지 않는다", () => {
  const context = createContext({});
  runInContext(readFileSync(new URL("./movement-audio.js", import.meta.url), "utf8"), context);
  const audio = context.SpawnerMovementAudio, playback = audio.create(), agent = bird();
  assert.equal(audio.definitions["spring-keeper"].source, "DesignAssets/Audio/MovementV2/spring-keeper-wing.mp3");
  const times = [];
  audio.update(playback, [], 4.99, animations);
  for (const event of audio.update(playback, [agent], 5, animations)) times.push(0);
  for (let frame = 1; frame < 120; frame++) {
    const time = 5 + frame / 120;
    for (const event of audio.update(playback, [agent], time, animations)) {
      assert.equal(event.name, "move-spring-keeper");
      times.push(time - 5);
    }
  }
  assert.equal(times.length, 2);
  assert.ok(Math.abs(times[0] + 0.125 - .12) < .01);
  assert.ok(Math.abs(times[1] + 0.125 - .56) < .01);
  agent.mode = "idle";
  agent.flightStoppedAt = 6;
  assert.equal(audio.update(playback, [agent], 6.1, animations).length, 0);
});

test("서버는 봄지기의 배회 후 휴식을 유지하고 다시 움직일 때 새 이륙을 알린다", () => {
  const cells = [];
  for (let y = 90; y <= 110; y++) for (let x = 90; x <= 110; x++) cells.push(y * 320 + x);
  const residents = [];
  const room = { simSeconds: 720, colonies: [], games: new Map(), food: new Map(), world: {
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), encounters: [
      { key: "spring-keeper", x: 100, y: 100, radius: 10, safeRadius: 0, terrains: [4], nearWater: false,
        cells, route: [], spawnPoints: [32100], populationLimit: 1, homeId: null }
    ] } };
  const system = createEncounters(room, null, residents), agent = system.agents[0];
  assert.ok(agent);
  system.tick();
  const started = agent.flightStartedAt;
  assert.equal(started, room.simSeconds);
  room.simSeconds = agent.moveStartedAt + agent.moveDuration;
  system.tick();
  assert.equal(agent.flightStartedAt, started);
  assert.equal(agent.mode, "idle");
  assert.equal(agent.flightStoppedAt, room.simSeconds);
  assert.equal(agent.nextActionAt - room.simSeconds, 30);
  room.simSeconds = agent.nextActionAt;
  system.tick();
  assert.equal(agent.mode, "walk");
  assert.equal(agent.flightStartedAt, room.simSeconds);
  assert.ok(agent.flightStartedAt > started);
});
