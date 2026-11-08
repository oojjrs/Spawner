import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { agentRemainingLifespan } from "../server/lifespan.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const declaration = name => source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0];

function scene(time = 0) {
  const refreshed = [];
  const scope = createContext({
    state: { simSeconds: time },
    Spawner: { agentRemainingLifespan },
    corpsePlaybackTime: () => scope.state.simSeconds,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    helpTooltipTarget: null,
    showHelpTooltip: life => refreshed.push(life.dataset.help)
  });
  runInContext(declaration("formatLifetime") + declaration("updateAgentLife"), scope);
  const alive = { style: {} };
  const life = {
    dataset: {}, attributes: {}, hidden: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector(selector) { assert.equal(selector, ".agent-life-alive"); return alive; }
  };
  const agent = {
    name: "새싹콩 7", lifespan: 300, lifespanStartedAt: 0,
    personalityLabels: { boldness: "높음", aggression: "낮음", curiosity: "보통" }
  };
  return { scope, life, alive, agent, refreshed };
}

test("살아 있는 개체의 수명 나뭇잎은 이름이나 성격 없이 남은 초만 표시한다", () => {
  const { scope, life, agent } = scene(176.25);
  assert.equal(scope.updateAgentLife(life, agent), 123.75);
  assert.equal(life.dataset.help, "124초");
  assert.equal(life.attributes["aria-label"], "124초");
  assert.equal(life.hidden, false);
});

test("수명은 분으로 변환하지 않고 총 초로 표시하며 만료 시 0초를 표시한다", () => {
  const { scope, life, agent } = scene();
  for (const [time, expected] of [[0, "300초"], [239.1, "61초"], [299.9, "1초"], [300, "0초"], [301, "0초"]]) {
    scope.state.simSeconds = time;
    scope.updateAgentLife(life, agent);
    assert.equal(life.dataset.help, expected);
  }
});

test("열린 수명 툴팁은 표시할 초가 바뀔 때 갱신하고 같은 초에는 다시 열지 않는다", () => {
  const { scope, life, agent, refreshed } = scene(176.25);
  scope.updateAgentLife(life, agent);
  scope.helpTooltipTarget = life;
  scope.state.simSeconds = 176.75;
  scope.updateAgentLife(life, agent);
  assert.deepEqual(refreshed, []);
  scope.state.simSeconds = 177.25;
  scope.updateAgentLife(life, agent);
  assert.deepEqual(refreshed, ["123초"]);
  assert.equal(life.attributes["aria-label"], "123초");
});

test("수명 비율에 따른 나뭇잎 그림은 그대로 유지한다", () => {
  const { scope, life, alive, agent } = scene(150);
  scope.updateAgentLife(life, agent);
  assert.equal(alive.style.clipPath, "inset(50% 0 0)");
  scope.state.simSeconds = 400;
  scope.updateAgentLife(life, agent);
  assert.equal(alive.style.clipPath, "inset(100% 0 0)");
});

test("유한한 수명이 없는 개체는 나뭇잎을 숨긴다", () => {
  const { scope, life, agent } = scene();
  agent.lifespan = Infinity;
  assert.equal(scope.updateAgentLife(life, agent), Infinity);
  assert.equal(life.hidden, true);
});

test("사체의 소멸 안내와 죽은 나뭇잎 표시는 유지한다", () => {
  const { scope, life, alive, agent } = scene(20);
  Object.assign(agent, { kind: "corpse", decaysAt: 81.5 });
  assert.equal(scope.updateAgentLife(life, agent), 61.5);
  assert.equal(life.dataset.help, "새싹콩 7의 사체 · 사라짐까지 1분 2초");
  assert.equal(life.attributes["aria-label"], life.dataset.help);
  assert.equal(alive.style.clipPath, "inset(100% 0 0)");
});
