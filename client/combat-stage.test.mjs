import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";
import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";

async function renderGrowth(left, right, support, sourceUrl) {
  const originalWindow = globalThis.window, originalImage = globalThis.Image, originalAssets = globalThis.SpawnerAssets, originalDocument = globalThis.document;
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 4096; this.naturalHeight = 4096; } async decode() {} };
  globalThis.document = { createElement() {
    const surface = { width: 0, height: 0 };
    surface.getContext = () => ({ drawImage(image) { surface.image = image; }, save() {}, restore() {}, translate() {}, scale() {},
      getImageData: () => ({ data: new Uint8ClampedArray(surface.width * surface.height * 4).fill(255) }) });
    return surface;
  } };
  if (sourceUrl) globalThis.SpawnerAssets = { source: sourceUrl, image: () => new globalThis.Image() };
  const draws = [];
  const context = new Proxy({ drawImage(image, ...args) {
    let source = image;
    while (source.image) source = source.image;
    if (args.length === 8 || image.image) draws.push({ image: source.src, width: args.at(-2), height: args.at(-1) });
  } }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const canvas = { clientWidth: 1200, clientHeight: 560, width: 1200, height: 560, getContext: () => context };
  const agents = [left, right].map((entry, side) => ({ id: side ? "right" : "left", tribe: "bean", health: 100, mode: "idle", bornAt: 0, animationStartedAt: 0, attributes: {}, combat: { id: "simulation", side, stunnedUntil: 0 }, stats: { health: 100 }, ...entry }));
  if (support) agents.push(...agents.map(agent => ({ ...agent, id: agent.id + "-support" })));
  try {
    const trial = { agents, history: [], time: 0, result: () => null }, stage = createCombatStage(canvas);
    await stage.prepare(trial);
    stage.render(trial, 0, false);
    return draws;
  } finally {
    globalThis.window = originalWindow;
    globalThis.Image = originalImage;
    globalThis.SpawnerAssets = originalAssets;
    globalThis.document = originalDocument;
  }
}

test("published combat bodies resolve their registered CDN URLs", async () => {
  const draws = await renderGrowth({}, {}, true, path => "https://assets.example/" + encodeURIComponent(path));
  assert.equal(draws.length, 4);
  assert.ok(draws.every(draw => draw.image.startsWith("https://assets.example/DesignAssets%2F")));
});

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, actual + " != " + expected); }

test("Lab 등가 조각 수를 본체와 같은 편성의 추가 유닛에 한 번 적용한다", async () => {
  for (const count of [0, 5, 20, 25, 100]) {
    const draws = await renderGrowth({ stats: { health: 100, pieceCount: count } }, {}, true);
    assert.equal(draws.length, 4);
    near(draws[0].width / draws[1].width, 1 + .005 * count);
    near(draws[0].width, draws[2].width);
    near(draws[1].width, draws[3].width);
  }
});

test("실제 DNA 조각 수가 Lab 등가 수보다 우선하며 카메라 계약도 같다", async () => {
  const pieces = Array.from({ length: 5 }, () => ({ gene: "health" }));
  const actual = await renderGrowth({ dna: { pieces }, stats: { pieceCount: 100 } }, {}, false);
  const equivalent = await renderGrowth({ stats: { pieceCount: 5 } }, {}, false);
  near(actual[0].width / actual[1].width, 1.025);
  near(actual[0].width, equivalent[0].width);
  near(actual[1].width, equivalent[1].width);
});

test("중립종의 Lab 등가 조각 수도 공유 체급 계약을 따른다", async () => {
  const draws = await renderGrowth({ tribe: undefined, species: "white-paw", stats: { pieceCount: 100 } }, { tribe: undefined, species: "white-paw" }, false);
  near(draws[0].width / draws[1].width, 1.64 / .92);
});

test("분비기관 몸체에도 공유 성장 배율을 중복 없이 적용한다", async () => {
  const draws = await renderGrowth({ stats: { health: 100, pieceCount: 25, ranged: true, melee: false } }, { stats: { health: 100, pieceCount: 0, ranged: true, melee: false } }, true);
  assert.equal(draws.length, 4);
  assert.ok(draws.every(draw => /UnitRangedV1|SecretionIdle/.test(draw.image)));
  near(draws[0].width / draws[1].width, 1.125);
  near(draws[0].width, draws[2].width);
});

test("23종 key-only 입력은 명시 종족·종 입력과 같은 크기와 외형을 사용한다", async () => {
  const { COMBAT_LAB_UNITS } = await import("./combat-lab.mjs");
  for (const unit of COMBAT_LAB_UNITS) {
    const player = ["bean", "spore", "pebble", "spring"].includes(unit.key);
    const draws = await renderGrowth({ tribe: undefined, key: unit.key, stats: { pieceCount: 25 } }, { tribe: player ? unit.key : undefined, species: player ? undefined : unit.key, stats: { pieceCount: 25 } }, false);
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
  near(unitRangedDisplaySize(dna) / unitRangedDisplaySize(base), 1.025);
  near(unitRangedProjectile(dna).sourceScale / unitRangedProjectile(base).sourceScale, 1.025);
});

test("실제 엔진이 교전 상태를 해제한 생존자와 사망자를 계속 그린다", async () => {
  assert.ok((await renderGrowth({combat:null,side:0,health:0},{combat:null,side:1})).length>0);
});

for (const species of ["flower-tail-bird", "dew-rabbit", "soil-mole", "rolling-acorn"]) test("대형 편성에 맞춰 " + species + " 본체도 공통 배율로 축소한다", async () => {
  const subject = { tribe: undefined, species, stats: { health: 100, pieceCount: 14 } };
  const small = { tribe: undefined, species: "flower-tail-bird" };
  const baseline = (await renderGrowth(subject, small, false))[0].width;
  const cell = opponent => combatViewLayout(1200, 560, [subject, opponent].map((agent, side) => ({ ...agent, id: String(side), combat: { side } }))).cell;
  for (const opponent of [
    { tribe: undefined, species: "white-paw" },
    { tribe: undefined, species: "spiny-back-leader" },
    { tribe: undefined, species: "white-paw", stats: { health: 100, pieceCount: 100 } },
    { tribe: undefined, species: "white-paw", health: 0 }
  ]) near((await renderGrowth(subject, opponent, false))[0].width / baseline, cell(opponent) / cell(small));
  near((await renderGrowth(subject, small, false))[0].width, baseline);
});

test("신규 중립종 사망 경계가 누락돼도 전투 렌더를 계속한다", async () => {
  const draws = await renderGrowth({ tribe: undefined, species: "bubble-toad", health: 0 }, {}, false);
  assert.ok(draws.length > 0);
  assert.ok(draws.every(draw => Number.isFinite(draw.width) && Number.isFinite(draw.height)));
});
