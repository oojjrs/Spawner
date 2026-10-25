import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { attributeCounts } from "../server/attributes.mjs";
import { agentGrowth, AGENT_GROWTH_THRESHOLDS } from "../server/growth.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name + " declaration exists");
  return match[0];
}

function rendering() {
  const counts = { sprites: 0, contours: 0, turns: 0 };
  const strokes = [];
  const contourTurns = [];
  const canvas = () => ({ width: 512, height: 512, getContext: () => ({ clearRect() {}, drawImage() {} }) });
  const context = createContext({
    attributeCounts,
    agentSprites: new Map(), encounterSprites: new Map(), agentSpriteSet: new WeakSet(), selectionOutlines: new WeakMap(),
    agentRenderingTasks: new Map(), agentRenderingQueue: Promise.resolve(),
    foodSelectionShape: {}, selectionOutlineWidth: 1.2,
    document: { createElement: canvas },
    setTimeout: callback => setTimeout(() => { counts.turns++; callback(); }, 0),
    composeAgentSprite: () => { counts.sprites++; return canvas(); },
    createSelectionContour: () => {
      counts.contours++;
      contourTurns.push(counts.turns);
      return {};
    },
    ctx: { save() {}, restore() {}, translate() {}, scale() {},
      stroke(contour) { strokes.push({ contour, color: this.strokeStyle }); } }
  });
  for (const name of ["agentAppearanceKey", "agentSpriteLayers", "prepareAgentTemplate", "agentSprite", "selectionContour", "drawSelectionOutline"])
    runInContext(declaration(name), context);
  return { context, counts, strokes, contourTurns };
}

test("첫 탄생과 성장 단계의 첫 표시에서는 이미지 합성과 윤곽 계산을 반복하지 않는다", async () => {
  const render = rendering();
  const template = { slots: ["lifespan", "feet", "antenna", "strength", "lifespan"] };
  await render.context.prepareAgentTemplate(template);
  const prepared = { ...render.counts };
  for (const time of AGENT_GROWTH_THRESHOLDS) {
    const growth = agentGrowth({ slots: template.slots, bornAt: 0, growthActivity: 0 }, time);
    const attributes = attributeCounts(growth.activeSlots);
    const layers = ["body", ...(attributes.feet ? ["feet-left", "feet-right"] : []),
      ...(attributes.antenna ? ["antenna"] : ["sprout-left", "sprout-right", "sprout-stem"])];
    for (const layer of layers) {
      const sprite = render.context.agentSprite({ attributes }, layer);
      for (const color of ["#f4f7fa", "#99e6cf"])
        render.context.drawSelectionOutline(sprite, 0, 0, 100, 100, null, color);
    }
  }
  assert.deepEqual(render.counts, prepared);
  assert.ok(prepared.turns > 1);
  assert.equal(new Set(render.contourTurns).size, prepared.contours);
});

test("빈 속성 설계와 중복 준비 요청도 같은 이미지와 윤곽을 공유한다", async () => {
  const render = rendering();
  const template = { slots: [] };
  await Promise.all([render.context.prepareAgentTemplate(template), render.context.prepareAgentTemplate(template)]);
  const prepared = { ...render.counts };
  assert.equal(prepared.sprites, 4);
  assert.equal(prepared.contours, 4);
  await render.context.prepareAgentTemplate(template);
  const sprite = render.context.agentSprite({ attributes: attributeCounts([]) }, "body");
  render.context.drawSelectionOutline(sprite, 0, 0, 100, 100, null, "white");
  render.context.drawSelectionOutline(sprite, 0, 0, 100, 100, null, "green");
  assert.deepEqual(render.counts, prepared);
  assert.equal(render.strokes[0].contour, render.strokes[1].contour);
  assert.deepEqual(render.strokes.map(stroke => stroke.color), ["white", "green"]);
});

test("애니메이션 프레임과 이미지 크기가 바뀌면 윤곽을 갱신한다", () => {
  const render = rendering();
  const sprite = { width: 2048, height: 2048 };
  const owner = {};
  render.context.drawSelectionOutline(sprite, 0, 0, 100, 100, { owner, size: 512, index: 0, x: 0, y: 0 }, "white");
  render.context.drawSelectionOutline(sprite, 0, 0, 100, 100, { owner, size: 512, index: 0, x: 0, y: 0 }, "green");
  assert.equal(render.counts.contours, 1);
  render.context.drawSelectionOutline(sprite, 0, 0, 100, 100, { owner, size: 512, index: 1, x: 512, y: 0 }, "green");
  assert.equal(render.counts.contours, 2);
  render.context.drawSelectionOutline(sprite, 0, 0, 100, 100, { owner, size: 256, index: 1, x: 256, y: 0 }, "green");
  assert.equal(render.counts.contours, 3);
});

function commands() {
  let finishPreparation;
  const prepared = new Promise(resolve => { finishPreparation = resolve; });
  const calls = [];
  const templates = [{ id: 1, slots: ["feet"] }];
  const context = createContext({
    connection: { busy: false, active: true, online: true, roomId: "room" },
    state: { templates },
    updateColonyPanel() {},
    prepareAgentTemplate: template => { calls.push({ template }); return prepared; },
    client: { async call(type, data) { calls.push({ type, data }); return { agentId: "unit" }; } }
  });
  runInContext(declaration("sendCommand"), context);
  return { context, calls, finishPreparation };
}

test("저장 설계의 탄생과 새 설계의 즉시 탄생 모두 이미지 준비 후에 생성 명령을 보낸다", async () => {
  for (const action of [{ type: "birth", templateId: 1 }, { type: "design", slots: ["shell"], birth: true }]) {
    const command = commands();
    const result = command.context.sendCommand(action);
    assert.equal(command.context.connection.busy, true);
    assert.equal(command.calls.length, 1);
    command.finishPreparation();
    assert.equal((await result).agentId, "unit");
    assert.equal(command.calls[1].type, "command");
    assert.equal(command.calls[1].data.action, action);
    assert.equal(command.context.connection.busy, false);
  }
});

test("이미지 준비 중 다른 방으로 이동하면 이전 방의 탄생 명령을 보내지 않는다", async () => {
  const command = commands();
  const result = command.context.sendCommand({ type: "birth", templateId: 1 });
  command.context.connection.roomId = "other-room";
  command.finishPreparation();
  assert.equal(await result, null);
  assert.equal(command.calls.length, 1);
  assert.equal(command.context.connection.busy, false);
});
