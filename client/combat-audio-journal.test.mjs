import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { createCombat } from "../server/combat.mjs";
import { createGame } from "../server/game.mjs";
import { recordCombatVfx, snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const scope = createContext({});
runInContext(readFileSync(new URL("./combat-audio.js", import.meta.url), "utf8"), scope);
const audio = scope.SpawnerCombatAudio;
const stats = ids => ATTRIBUTE_DNA.stats(ids.map(id => {
  const gene = ATTRIBUTE_DNA.lookup.get(id);
  return { gene: id, grade: gene.grade, q: 0, r: 0, rotation: 0 };
}));
const names = events => Array.from(events, event => event.name);

function fixture() {
  const events = [], environment = { simSeconds: 0,
    world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), sites: [], burrows: [] },
    colonies: [], games: new Map(), food: new Map(), foodSpots: new Map(),
    combatRandom: () => .01, damageRandom: () => .5, onCombatEvent: event => events.push(event) };
  const makeGame = (id, tribe) => {
    const colony = { id: environment.colonies.length + 1, ownerId: id, tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    environment.colonies.push(colony);
    const game = createGame(environment, colony);
    environment.games.set(id, game);
    game.agents.splice(1);
    const agent = game.agents[0];
    Object.assign(agent, { x: 100, y: 100, health: 100, moveStartedAt: 0, moveDuration: 0,
      attributes: {}, combatDisposition: id === "a" ? "aggressive" : "passive",
      stats: { health: 100, speed: 1, vision: 4, dna: stats([]) } });
    return { game, agent };
  };
  const left = makeGame("a", "bean"), right = makeGame("b", "spore");
  const source = left.agent, target = right.agent;
  source.stats.dna = stats(["blade", "area", "bleed"]);
  Object.assign(source.stats.dna, { meleePower: 10, focus: .307, areaPower: 100, bleed: 100, bleedPower: 2 });
  target.stats.dna.reflection = 50;
  const collateral = { ...target, id: "collateral", health: 1, stats: { ...target.stats, dna: stats([]) } };
  right.game.agents.push(collateral);
  const combat = createCombat(environment);
  combat.engage(source, target, 0);
  source.combat.targetId = target.id;
  for (const unit of [source, target]) Object.assign(unit.combat.position,
    { x: unit.combat.side ? .4 : -.4, y: 0, fromX: unit.combat.side ? .4 : -.4, fromY: 0 });
  return { environment, events, combat, source, target, collateral };
}

test("공용 전투의 틱 사이 광역·반사·출혈과 사체 전환은 사건마다 한 번만 소리 난다", () => {
  const f = fixture(), playback = audio.create(), played = [];
  const view = time => {
    const agents = [...f.environment.games.values()].flatMap(game => game.agents);
    const corpses = [...f.environment.games.values()].flatMap(game => game.snapshot().corpses);
    return audio.update(playback, agents, corpses, time, snapshotCombatVfx(f.environment, time));
  };
  view(0);
  for (let tick = 0; tick <= 180; tick++) {
    const time = tick / 120;
    if (tick % 2 === 0) {
      f.environment.simSeconds = time;
      for (const game of f.environment.games.values()) game.prepare(time);
      f.combat.update(f.source, time);
      if (f.events.some(event => event.kind === "hit")) f.source.combat.nextAttackAt = Infinity;
      f.combat.update(f.target, time);
    }
    played.push(...view(time));
  }
  for (const kind of ["hit", "area", "reflect", "bleed", "death"])
    assert.ok(f.events.some(event => event.kind === kind), kind);
  const hit = f.events.find(event => event.kind === "hit");
  assert.equal(hit.at, .307);
  const damages = f.events.filter(event => event.amount > 0 && ["hit", "critical", "area", "reflect", "bleed"].includes(event.kind));
  for (const id of [f.source.id, f.target.id, f.collateral.id]) {
    const expected = damages.filter(event => event.targetId === id).length;
    const heard = played.filter(event => (event.unit.agentId ?? event.unit.id) === id && event.name.endsWith("-hurt"));
    assert.equal(heard.length, expected, id + " actual HP-loss events");
  }
  assert.equal(played.filter(event => event.name.endsWith("-death")).length, 1);
  const reflected = f.events.find(event => event.kind === "reflect");
  assert.notEqual(reflected.at, reflected.hurtStartedAt);
  assert.equal(reflected.hurtCount, 1);
  const death = f.events.find(event => event.kind === "death");
  assert.notEqual(death.at, death.diedAt);
  const snapshot = snapshotCombatVfx(f.environment, 1.5, { agentIds: new Set([f.source.id]), isVisible: () => false });
  const visible = snapshot.events.find(event => event.id === reflected.id);
  assert.equal(visible.hurtCount, reflected.hurtCount);
  assert.equal(visible.hurtStartedAt, reflected.hurtStartedAt);
});

test("피해 횟수 없는 중립의 틱 시각도 사건 시각과 별개로 중복을 막는다", () => {
  const unit = { id: "neutral", species: "white-paw", health: 10, hurtStartedAt: 1.3166666666666667 };
  const environment = {}, playback = audio.create();
  audio.update(playback, [unit], [], 1.2, snapshotCombatVfx(environment, 1.2));
  recordCombatVfx(environment, { kind: "bleed", at: 1.307, amount: 2, sourceId: "enemy", targetId: unit.id,
    hurtStartedAt: unit.hurtStartedAt });
  assert.deepEqual(names(audio.update(playback, [unit], [], 1.32, snapshotCombatVfx(environment, 1.32))), ["sprout-hurt"]);
  assert.equal(audio.update(playback, [unit], [], 1.34, snapshotCombatVfx(environment, 1.34)).length, 0);
});

test("같은 틱의 별도 비저널 피해는 앞선 피해 사건 때문에 누락되지 않는다", () => {
  const unit = { id: "unit", tribe: "spore", health: 10, hurtStartedAt: 1.32, hurtCount: 2 };
  const environment = {}, playback = audio.create();
  audio.update(playback, [unit], [], 1.2, snapshotCombatVfx(environment, 1.2));
  recordCombatVfx(environment, { kind: "reflect", at: 1.307, amount: 2, sourceId: "enemy", targetId: unit.id,
    hurtStartedAt: 1.32, hurtCount: 1 });
  assert.deepEqual(names(audio.update(playback, [unit], [], 1.32, snapshotCombatVfx(environment, 1.32))), ["spore-hurt"]);
  assert.deepEqual(names(audio.update(playback, [unit], [], 1.34, snapshotCombatVfx(environment, 1.34))), ["spore-hurt"]);
  assert.equal(audio.update(playback, [unit], [], 1.35, snapshotCombatVfx(environment, 1.35)).length, 0);
});
