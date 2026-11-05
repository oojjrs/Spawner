import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";

function renderGrowth(left, right, support, sourceUrl) {
  const originalWindow = globalThis.window, originalImage = globalThis.Image, originalAssets = globalThis.SpawnerAssets;
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 4096; this.naturalHeight = 4096; } };
  if (sourceUrl) globalThis.SpawnerAssets = { source: sourceUrl, image: () => new globalThis.Image() };
  const draws = [];
  const context = new Proxy({ drawImage(...args) { if (args.length === 9) draws.push({ image: args[0].src, width: args[7], height: args[8] }); } }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const canvas = { clientWidth: 1200, clientHeight: 560, width: 1200, height: 560, getContext: () => context };
  const agents = [left, right].map((entry, side) => ({ id: side ? "right" : "left", tribe: "bean", health: 100, mode: "idle", bornAt: 0, animationStartedAt: 0, attributes: {}, combat: { side, stunnedUntil: 0 }, stats: { health: 100 }, ...entry }));
  try {
    createCombatStage(canvas).render({ agents, supportAgents: support ? agents.map(agent => ({ ...agent, id: agent.id + "-support" })) : [], history: [], time: 0, result: () => null }, 0, false);
    return draws;
  } finally {
    globalThis.window = originalWindow;
    globalThis.Image = originalImage;
    globalThis.SpawnerAssets = originalAssets;
  }
}

test("published combat bodies resolve their registered CDN URLs", () => {
  const draws = renderGrowth({}, {}, true, path => "https://assets.example/" + encodeURIComponent(path));
  assert.equal(draws.length, 4);
  assert.ok(draws.every(draw => draw.image.startsWith("https://assets.example/DesignAssets%2F")));
});

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, actual + " != " + expected); }

test("Lab 등가 조각 수를 본체와 지원군에 한 번 적용한다", () => {
  for (const count of [0, 5, 20, 25, 100]) {
    const draws = renderGrowth({ stats: { health: 100, pieceCount: count } }, {}, true);
    assert.equal(draws.length, 4);
    near(draws[0].width / draws[1].width, 1 + .01 * count);
    near(draws[0].width, draws[2].width);
    near(draws[1].width, draws[3].width);
  }
});

test("실제 DNA 조각 수가 Lab 등가 수보다 우선하며 카메라 계약도 같다", () => {
  const pieces = Array.from({ length: 5 }, () => ({ gene: "health" }));
  const actual = renderGrowth({ dna: { pieces }, stats: { pieceCount: 100 } }, {}, false);
  const equivalent = renderGrowth({ stats: { pieceCount: 5 } }, {}, false);
  near(actual[0].width / actual[1].width, 1.05);
  near(actual[0].width, equivalent[0].width);
  near(actual[1].width, equivalent[1].width);
});

test("중립종의 Lab 등가 조각 수도 공유 체급 계약을 따른다", () => {
  const draws = renderGrowth({ tribe: undefined, species: "white-paw", stats: { pieceCount: 100 } }, { tribe: undefined, species: "white-paw" }, false);
  near(draws[0].width / draws[1].width, 2);
});

test("분비기관 몸체에도 공유 성장 배율을 중복 없이 적용한다", () => {
  const draws = renderGrowth({ stats: { health: 100, pieceCount: 25, ranged: true, melee: false } }, { stats: { health: 100, pieceCount: 0, ranged: true, melee: false } }, true);
  assert.equal(draws.length, 4);
  assert.ok(draws.every(draw => draw.image.includes("UnitRangedV1")));
  near(draws[0].width / draws[1].width, 1.25);
  near(draws[0].width, draws[2].width);
});

test("23종 key-only 입력은 명시 종족·종 입력과 같은 크기와 외형을 사용한다", async () => {
  const { COMBAT_LAB_UNITS } = await import("./combat-lab.mjs");
  for (const unit of COMBAT_LAB_UNITS) {
    const player = ["bean", "spore", "pebble", "spring"].includes(unit.key);
    const draws = renderGrowth({ tribe: undefined, key: unit.key, stats: { pieceCount: 25 } }, { tribe: player ? unit.key : undefined, species: player ? undefined : unit.key, stats: { pieceCount: 25 } }, false);
    assert.equal(draws.length, 2, unit.key);
    near(draws[0].width, draws[1].width);
    assert.equal(draws[0].image, draws[1].image);
  }
});

test("원거리 key-only 몸체와 탄체도 동일한 DNA 우선순위를 따른다", async () => {
  const { unitRangedDisplaySize, unitRangedProjectile } = await import("./unit-ranged.mjs");
  const normal = { tribe: "bean", stats: { ranged: true, melee: false, pieceCount: 25 } };
  const keyOnly = { key: "bean", stats: normal.stats };
  near(unitRangedDisplaySize(keyOnly), unitRangedDisplaySize(normal));
  near(unitRangedProjectile(keyOnly).sourceScale, unitRangedProjectile(normal).sourceScale);
  const pieces = Array.from({ length: 5 }, () => ({ gene: "health" }));
  const base = { ...normal, stats: { ...normal.stats, pieceCount: 0 } };
  const dna = { ...normal, dna: { pieces } };
  near(unitRangedDisplaySize(dna) / unitRangedDisplaySize(base), 1.05);
  near(unitRangedProjectile(dna).sourceScale / unitRangedProjectile(base).sourceScale, 1.05);
});

test("실제 엔진이 교전 상태를 해제한 생존자와 사망자를 계속 그린다", () => {
  assert.ok(renderGrowth({combat:null,side:0,health:0},{combat:null,side:1}).length>0);
});
