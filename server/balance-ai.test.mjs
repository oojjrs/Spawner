import test from "node:test";
import assert from "node:assert/strict";
import { nestUpgradeCost } from "./nests.mjs";
import { tribeDesign } from "./tribe-designs.mjs";
import { birthCost } from "./attributes.mjs";
import { tribeWorkerTarget } from "./tribe-strategy.mjs";
import { seededRandom, simulateAiBalance, simulateAiBalanceAsync, parseBalanceAiArguments, summarizeTickPerformance, runBalancePlayerPolicy, createBalanceContactTracker, observeBalanceExpedition, closeBalanceExpedition, serializableBalanceSave, restoreSerializableBalanceSave } from "./balance-ai.mjs";

function fixture() {
  const room = { hostId: "player", simSeconds: 0, world: { generationVersion: 99 },
    colonies: [{ tribe: "bean", ownerId: "player" }, { tribe: "spring", ownerId: "ai" }],
    creatureSystem: { agents: [{ id: "creature" }] }, games: new Map() };
  for (const colony of room.colonies) {
    const state = { evolutionPoints: 0 };
    room.games.set(colony.ownerId, { agents: [{ id: colony.tribe + ":1", health: 10, cost: 26, slots: [],
      dna: { pieces: [{ gene: "gather" }] } }], nestLevel: 1, colonyFood: 0, nest: { health: 100 }, ending: null,
      decisionSnapshot: () => ({ state }) });
  }
  return room;
}

test("AI balance random source is deterministic and restored on success and failure", () => {
  const a = seededRandom(123), b = seededRandom(123);
  assert.deepEqual(Array.from({ length: 10 }, a), Array.from({ length: 10 }, b));
  const random = Math.random;
  assert.throws(() => simulateAiBalance({}, { createRoom() { throw new Error("fixture error"); } }), /fixture error/);
  assert.equal(Math.random, random);
  simulateAiBalance({ seconds: .25 }, { createRoom: fixture, tickRoom: room => { room.simSeconds += .25; } });
  assert.equal(Math.random, random);
});

test("AI balance measures real observed births, deaths, milestones, resources and DNA without player commands", () => {
  const result = simulateAiBalance({ seconds: 1, checkpointSeconds: .5 }, { createRoom: fixture, tickRoom(room, elapsed) {
    room.simSeconds += elapsed;
    const ai = room.games.get("ai");
    if (room.simSeconds === .25) {
      ai.agents.push({ id: "spring:2", health: 10, cost: 11, slots: [], dna: { level: 2, pieces: [{ gene: "blade" }] }, productionRole: "military" });
      ai.colonyFood = 12;
    }
    if (room.simSeconds === .5) { ai.agents.shift(); ai.nestLevel = 2; }
    if (room.simSeconds === .75) ai.agents.length = 0;
  } });
  const ai = result.tribes.find(tribe => tribe.ai);
  assert.equal(ai.produced, 1); assert.equal(ai.dnaProduced, 1); assert.equal(ai.legacyProduced, 0);
  assert.equal(ai.militaryProduced, 1); assert.equal(ai.guardProduced, 1);
  assert.equal(ai.firstMilitaryAt, .25); assert.equal(ai.firstGuardAt, .25);
  assert.equal(ai.productionSpent, 11); assert.equal(ai.collected, 12); assert.equal(ai.deaths, 2);
  assert.deepEqual(ai.emptyPopulationAt, [.75]);
  assert.deepEqual(ai.milestones, [{ level: 1, seconds: 0 }, { level: 2, seconds: .5 }]);
  assert.equal(result.checkpoints[0].tribes[1].military, 1);
  assert.equal(result.checkpoints[0].tribes[1].alive, 1);
  assert.equal(result.playerCommands, 0); assert.equal(result.ticks, 4); assert.equal(result.stopReason, "duration-reached");
});

test("AI balance explicitly stops at the selected player's actual ending", () => {
  const result = simulateAiBalance({ seconds: 1200 }, { createRoom: fixture, tickRoom(room, elapsed) {
    room.simSeconds += elapsed;
    room.games.get("player").ending = { reason: "nest-destroyed", endedAt: room.simSeconds };
  } });
  assert.equal(result.completedSeconds, .25); assert.equal(result.ticks, 1);
  assert.equal(result.stopReason, "player-ending"); assert.equal(result.playerEnding.reason, "nest-destroyed");
});

test("diagnostic mode removes only creatures and does not claim to disable colony combat", () => {
  const result = simulateAiBalance({ seconds: .25, creatures: false }, { createRoom: fixture, tickRoom(room, elapsed) {
    assert.equal(room.creatureSystem.agents.length, 0); room.simSeconds += elapsed;
  } });
  assert.deepEqual(result.combat, { colonies: true, neutralCreatures: false });
});

test("AI balance rejects invalid inputs and a nonadvancing room", () => {
  for (const options of [{ seconds: NaN }, { seed: -1 }, { selectedTribe: "missing" }, { stepSeconds: 0 }, { randomSeed: 1.5 }])
    assert.throws(() => simulateAiBalance(options, { createRoom: fixture }));
  assert.throws(() => simulateAiBalance({}, { createRoom: fixture, tickRoom() {} }), /stopped advancing/);
  const args = parseBalanceAiArguments(["--seeds", "0,13,413", "--tribes", "bean,spring", "--seconds", "1800", "--no-creatures"]);
  assert.deepEqual(args.seeds, [0, 13, 413]); assert.deepEqual(args.tribes, ["bean", "spring"]);
  assert.equal(args.seconds, 1800); assert.equal(args.creatures, false);
  for (const args of [["--unknown"], ["--seeds", "abc"], ["--tribes", "missing"], ["--output"]]) assert.throws(() => parseBalanceAiArguments(args));
});


test("CPU tick timing reports nearest-rank percentiles and strict frame-budget exceedance counts", () => {
  assert.deepEqual(summarizeTickPerformance([1, 16.7, 20, 33.3, 40]), {
    samples: 5, totalMs: 111, meanMs: 22.2, p50Ms: 20, p95Ms: 40, p99Ms: 40, maxMs: 40,
    over16_7Ms: 3, over33_3Ms: 1
  });
  assert.equal(summarizeTickPerformance([]).meanMs, 0);
  assert.equal(summarizeTickPerformance([]).maxMs, 0);
});

test("tick timing excludes metrics and checkpoints, includes the full scheduler call, and records environment", () => {
  let clock = 0;
  const result = simulateAiBalance({ seconds: .5, checkpointSeconds: .25 }, {
    now: () => clock,
    createRoom() { clock += 100; return fixture(); },
    tickRoom(room, elapsed) { clock += 20; room.simSeconds += elapsed; },
    onCheckpoint() { clock += 1000; }
  });
  assert.equal(result.timing.tick.samples, 2);
  assert.equal(result.timing.tick.meanMs, 20);
  assert.equal(result.timing.tick.totalMs, 40);
  assert.equal(result.timing.tick.over16_7Ms, 2);
  assert.equal(result.timing.tick.over33_3Ms, 0);
  assert.equal(result.timing.wallTimeMs, 2140);
  assert.equal(result.timing.environment.node, process.version);
  assert.equal(result.timing.environment.platform, process.platform);
  assert.match(result.timing.scope, /excludes rendering/);
});

test("explicit production player policy uses paid public commands and records cost without changing control or unit vitals", () => {
  const room = fixture(), game = room.games.get("player"), original = game.agents[0];
  Object.assign(original, { bornAt: 0, lifespan: 300 });
  Object.freeze(original);
  const state = { simSeconds: 0, agents: game.agents, templates: [], nextTemplateId: 1, nestLevel: 1, evolutionPoints: 30 };
  game.decisionSnapshot = () => ({ state });
  const commands = [];
  game.command = action => {
    commands.push(action.type);
    if (action.type === "design") {
      state.templates.push({ id: 1, dna: action.dna });
      return { templateId: 1 };
    }
    assert.equal(action.type, "birth");
    state.evolutionPoints -= 11;
    return { agentId: "paid-birth", templateId: 1 };
  };
  const ledger = { mode: "production", attempted: 0, succeeded: 0, spent: 0, commands: [], errors: {} };
  runBalancePlayerPolicy(room, ledger, () => ({ dna: { pieces: [{ gene: "gather" }] } }));
  assert.deepEqual(commands, ["design", "birth"]);
  assert.equal(state.evolutionPoints, 19); assert.equal(ledger.spent, 11);
  assert.equal(ledger.succeeded, 2); assert.equal(original.health, 10); assert.equal(original.lifespan, 300);
  assert.equal(room.hostId, "player"); assert.equal(original.aiControlled, undefined);
  runBalancePlayerPolicy(room, ledger, () => { throw new Error("must wait for policy cadence"); });
  assert.equal(ledger.succeeded, 2);
  assert.equal(parseBalanceAiArguments(["--player-policy", "production"]).playerPolicy, "production");
  assert.throws(() => parseBalanceAiArguments(["--player-policy", "cheat"]), /Unknown player policy/);
});

test("public command rejection is counted, never bypassed by changing player funds", () => {
  const room = fixture(), game = room.games.get("player");
  const state = { simSeconds: 0, agents: [], templates: [], nextTemplateId: 1, nestLevel: 1, evolutionPoints: 0 };
  game.decisionSnapshot = () => ({ state });
  game.command = () => { throw new Error("진화 포인트가 부족합니다."); };
  const ledger = { mode: "production", attempted: 0, succeeded: 0, spent: 0, commands: [], errors: {} };
  runBalancePlayerPolicy(room, ledger, () => ({ dna: { pieces: [{ gene: "gather" }] } }));
  assert.equal(ledger.succeeded, 0); assert.equal(state.evolutionPoints, 0);
  assert.ok(ledger.errors["design: 진화 포인트가 부족합니다."] > 0);
});


test("a destroyed colony is reported defeated even while its units remain alive", () => {
  const result = simulateAiBalance({ seconds: .25 }, { createRoom: fixture, tickRoom(room, elapsed) {
    room.simSeconds += elapsed;
    const game = room.games.get("ai"); game.nest.health = 0;
    game.ending = { reason: "nest-destroyed", endedAt: room.simSeconds };
  } });
  const ai = result.tribes.find(tribe => tribe.ai);
  assert.equal(ai.alive, 1); assert.equal(ai.defeated, true); assert.equal(ai.ending.reason, "nest-destroyed");
});

test("production player policy requires the current workforce and upgrade reserve", () => {
  const room = fixture(), game = room.games.get("player");
  const state = { simSeconds: 0, agents: game.agents, templates: [], nestLevel: 1, evolutionPoints: 0 };
  game.decisionSnapshot = () => ({ state });
  const cost = nestUpgradeCost(1, "bean"), reserve = birthCost({ dna: tribeDesign("bean", 1, -1) }, "bean");
  state.agents = Array.from({ length: tribeWorkerTarget(state) }, (_, index) => ({ ...game.agents[0], id: "worker:" + index }));
  state.evolutionPoints = cost + reserve - 1;
  const actions = [];
  game.command = action => { actions.push(action.type); state.evolutionPoints -= cost; return {}; };
  const ledger = { mode: "production", attempted: 0, succeeded: 0, spent: 0, commands: [], errors: {} };
  runBalancePlayerPolicy(room, ledger, () => null);
  assert.deepEqual(actions, []);
  room.simSeconds = 3; state.simSeconds = 3; state.evolutionPoints = cost + reserve;
  const worker = state.agents.pop();
  runBalancePlayerPolicy(room, ledger, () => null);
  assert.deepEqual(actions, []);
  state.agents.push(worker); room.simSeconds = 6; state.simSeconds = 6;
  runBalancePlayerPolicy(room, ledger, () => null);
  assert.deepEqual(actions, ["upgrade"]); assert.equal(state.evolutionPoints, reserve);
});


test("world benchmark yields between ticks so queued road jobs run before the next tick", async () => {
 let jobs=0,ticks=0;const random=Math.random;
 const result=await simulateAiBalanceAsync({seconds:1},{createRoom:fixture,tickRoom(room,elapsed){
  assert.equal(jobs,ticks);room.simSeconds+=elapsed;ticks++;setTimeout(()=>jobs++,0);
 }});
 assert.equal(jobs,4);assert.equal(result.ticks,4);assert.match(result.timing.scheduler,/road jobs enabled/);
 assert.equal(Math.random,random);
});


function contactFixture() {
  const room = fixture();
  for (const [index, colony] of room.colonies.entries()) {
    Object.assign(colony, { id: index + 1, x: index * 20, y: 0 });
    const game = room.games.get(colony.ownerId);
    Object.assign(game.agents[0], { x: index * 20 + 5, y: 5 });
    game.visible = new Set(); game.known = new Set();
    game.isVisible = (x, y) => game.visible.has(x + "," + y);
    game.colonyKnown = other => game.known.has(other.id);
  }
  return room;
}

test("contacts keep directional unit sight separate from later mutual and player awareness", () => {
  const room = contactFixture(), tracker = createBalanceContactTracker(room);
  const player = room.games.get("player"), ai = room.games.get("ai");
  tracker.capture(); assert.equal(tracker.forTribe("spring").firstOtherAwarenessAt, null);
  room.simSeconds = 1; player.visible.add("25,5"); tracker.capture();
  let summary = tracker.forTribe("spring");
  assert.equal(summary.playerSawTribeAt, 1); assert.equal(summary.tribeSawPlayerAt, null);
  assert.equal(summary.firstMutualAwarenessAt, null);
  player.visible.clear(); room.simSeconds = 2; ai.visible.add("5,5"); tracker.capture();
  summary = tracker.forTribe("spring");
  assert.equal(summary.firstOtherAwarenessAt, 2); assert.equal(summary.firstSeenByOtherAt, 1);
  assert.equal(summary.firstMutualAwarenessAt, 2); assert.equal(summary.firstPlayerMutualAwarenessAt, 2);
  assert.equal(tracker.snapshot().directional[0].firstUnitSightAt, 1);
  assert.equal(tracker.snapshot().directional[0].firstNestKnownAt, null);
});

test("nest knowledge records awareness without inventing unit sight", () => {
  const room = contactFixture(), tracker = createBalanceContactTracker(room);
  room.simSeconds = 3; room.games.get("player").known.add(2); tracker.capture();
  const direction = tracker.snapshot().directional.find(entry => entry.observer === "bean");
  assert.equal(direction.firstNestKnownAt, 3); assert.equal(direction.firstAwarenessAt, 3);
  assert.equal(direction.firstUnitSightAt, null);
  room.games.get("ai").known.add(1); room.simSeconds = 4; tracker.capture();
  assert.equal(tracker.forTribe("spring").firstPlayerMutualAwarenessAt, 4);
});

test("fog is not contact and an unseen defeated colony is classified before all contact criteria", () => {
  const room = contactFixture(), tracker = createBalanceContactTracker(room);
  room.simSeconds = 5; tracker.capture();
  const ai = room.games.get("ai"); ai.ending = { reason: "nest-destroyed", endedAt: 6 };
  ai.nest.health = 0; room.simSeconds = 6; tracker.capture();
  assert.deepEqual(tracker.forTribe("spring").defeatedBeforeContact, { any: true, mutual: true, playerMutual: true });
  // Permanent nest visibility after defeat must not retroactively count.
  ai.visible.add("5,5"); ai.known.add(1); room.games.get("player").visible.add("25,5");
  room.games.get("player").known.add(2); room.simSeconds = 7; tracker.capture();
  assert.ok(tracker.snapshot().directional.every(entry => entry.firstAwarenessAt === null));
});

test("dead observers and dead target units cannot create contacts despite stale visibility", () => {
  for (const side of ["observer", "target"]) {
    const room = contactFixture(), tracker = createBalanceContactTracker(room);
    room.games.get("player").visible.add("25,5");
    room.games.get(side === "observer" ? "player" : "ai").agents[0].health = 0;
    tracker.capture();
    assert.equal(tracker.snapshot().directional.find(entry => entry.observer === "bean").firstUnitSightAt, null);
  }
  const room = contactFixture(), tracker = createBalanceContactTracker(room), ai = room.games.get("ai");
  ai.agents[0].health = 0; ai.agents.push({ id: "hidden-live", health: 10, x: 99, y: 99 });
  room.games.get("player").visible.add("25,5"); tracker.capture();
  assert.equal(tracker.snapshot().directional.find(entry => entry.observer === "bean").firstUnitSightAt, null);
});

test("one-way awareness before defeat is not mutual contact after the other colony dies", () => {
  const room = contactFixture(), tracker = createBalanceContactTracker(room);
  room.simSeconds = 1; room.games.get("ai").visible.add("5,5"); tracker.capture();
  room.simSeconds = 2; room.games.get("ai").ending = { reason: "extinction", endedAt: 2 };
  room.games.get("player").visible.add("25,5"); tracker.capture();
  const summary = tracker.forTribe("spring");
  assert.deepEqual(summary.defeatedBeforeContact, { any: false, mutual: true, playerMutual: true });
  assert.equal(summary.firstMutualAwarenessAt, null);
});

test("AI mutual awareness of another AI is distinct from mutual awareness of the player", () => {
  const room = contactFixture();
  const other = { tribe: "spore", ownerId: "third", id: 3, x: 40, y: 0 };
  room.colonies.push(other);
  room.games.set("third", { agents: [{ id: "third:1", health: 10, x: 45, y: 5 }], nest: { health: 100 }, ending: null,
    isVisible: (x, y) => x === 25 && y === 5, colonyKnown: () => false });
  room.games.get("ai").visible.add("45,5"); room.simSeconds = 8;
  const tracker = createBalanceContactTracker(room); tracker.capture();
  const summary = tracker.forTribe("spring");
  assert.equal(summary.firstOtherAwarenessAt, 8); assert.equal(summary.firstMutualAwarenessAt, 8);
  assert.equal(summary.firstPlayerMutualAwarenessAt, null); assert.equal(summary.playerSawTribeAt, null);
});

test("fixtures without visibility APIs default to null rather than inventing contact or a before-contact verdict", () => {
  const room = fixture(), tracker = createBalanceContactTracker(room);
  room.games.get("ai").ending = { reason: "extinction", endedAt: 0 }; tracker.capture();
  assert.equal(tracker.snapshot().completeVisibilityApis, false);
  assert.equal(tracker.forTribe("spring").firstOtherAwarenessAt, null);
  assert.deepEqual(tracker.forTribe("spring").defeatedBeforeContact, { any: null, mutual: null, playerMutual: null });
});

test("simulation output and checkpoints carry observed contacts and distinct defeat comparisons", () => {
  const result = simulateAiBalance({ seconds: .5, checkpointSeconds: .25 }, { createRoom: contactFixture,
    tickRoom(room, elapsed) {
      room.simSeconds += elapsed;
      const ai = room.games.get("ai");
      if (room.simSeconds === .25) ai.visible.add("5,5");
      else ai.ending = { reason: "extinction", endedAt: room.simSeconds };
    } });
  assert.equal(result.contacts.version, 1); assert.equal(result.contacts.sampledStepSeconds, .25);
  assert.equal(result.checkpoints[0].tribes[1].contacts.tribeSawPlayerAt, .25);
  assert.deepEqual(result.tribes[1].defeatedBeforeContact, { any: false, mutual: true, playerMutual: true });
  assert.deepEqual(result.contacts.tribes.spring, result.tribes[1].contacts);
});


test("antenna military observations use exclusive state times, changed targets only, and retained death distance", () => {
  const entry = { role: "military", genes: ["antenna", "blade"] }, colony = { x: 0, y: 0 };
  const agent = { x: 12, y: 2, birth: { readyAt: 1 }, utility: null };
  let explored = new Set([55]), reads = 0;
  const observe = seconds => observeBalanceExpedition(entry, agent, colony, seconds, () => { reads++; return explored; }, 10);
  observe(0);
  agent.retreat = {}; agent.combat = {}; observe(1);
  agent.retreat = null; observe(2);
  agent.combat = null; agent.utility = { action: "explore", target: { key: "a", x: 5, y: 5 } }; observe(3);
  explored = new Set([55, 54, 56, 45, 65]); observe(4);
  assert.equal(reads, 1); // unchanged target is never reclassified after fog changes
  agent.utility = null; observe(5);
  agent.utility = { action: "explore", target: { key: "a", x: 5, y: 5 } }; observe(6);
  agent.x = 16; closeBalanceExpedition(entry, colony, 7);
  assert.deepEqual(entry.expedition.stateSeconds, { birth: 1, retreat: 1, combat: 1, explore: 3, other: 1 });
  assert.deepEqual(entry.expedition.targetChanges, { frontier: 1, patrol: 1, unexploredTarget: 0, unavailable: 0 });
  assert.equal(entry.expedition.maxDistance, 14); assert.equal(entry.expedition.deathDistance, 14);
  closeBalanceExpedition(entry, colony, 8); assert.equal(entry.expedition.stateSeconds.explore, 3);
});

test("expedition observation excludes guards and workers and tolerates missing visibility or positions", () => {
  for (const entry of [{ role: "worker", genes: ["antenna"] }, { role: "military", genes: ["blade"] }]) {
    observeBalanceExpedition(entry, {}, {}, 0, undefined, undefined); assert.equal(entry.expedition, undefined);
  }
  const entry = { role: "military", genes: ["antenna"] }, colony = { x: 0, y: 0 };
  const agent = { utility: { action: "explore", target: { key: "missing" } } };
  observeBalanceExpedition(entry, agent, colony, 0, undefined, 10);
  assert.equal(entry.expedition.maxDistance, null); assert.equal(entry.expedition.targetChanges.unavailable, 1);
  agent.utility.target = { key: "fog", x: 4, y: 4 };
  observeBalanceExpedition(entry, agent, colony, 1, () => new Set(), 10);
  assert.equal(entry.expedition.targetChanges.unexploredTarget, 1);
  closeBalanceExpedition(entry, colony, 2, false); assert.equal(entry.expedition.deathDistance, null);
});

test("portable room-save JSON preserves typed collections and game keys without changing original values", () => {
  const saved = { world: { terrain: new Uint8Array([1, 2, 255]), flow: new Float32Array([.5, 1.25]),
    visited: new Set([1, 9]), routes: new Map([[3, new Int16Array([-2, 7])]]) },
    tagLikeUserData: { kind: "Map", values: [1, 2] }, big: new BigInt64Array([2n, -4n]),
    optional: undefined, negativeZero: -0, nan: NaN, buffer: new Uint8Array([4, 5]).buffer };
  const before = structuredClone(saved);
  const restored = restoreSerializableBalanceSave(JSON.parse(JSON.stringify(serializableBalanceSave(saved))));
  assert.deepEqual(restored, before); assert.deepEqual(saved, before);
  assert.ok(restored.world.terrain instanceof Uint8Array); assert.ok(restored.world.routes instanceof Map);
  assert.throws(() => restoreSerializableBalanceSave({ format: "other", version: 1 }), /Unsupported/);
});

test("later upgrades require three current-level workers, not just sufficient cash", () => {
  const room = fixture(), game = room.games.get("player");
  const state = { simSeconds: 0, templates: [], nestLevel: 2, evolutionPoints: 1000,
    agents: Array.from({ length: 4 }, (_, index) => ({ ...game.agents[0], id: "worker:" + index,
      dna: tribeDesign("bean", index < 2 ? 2 : 1, -1) })) };
  game.decisionSnapshot = () => ({ state });
  const actions = [];
  game.command = action => { actions.push(action.type); return {}; };
  const ledger = { mode: "production", attempted: 0, succeeded: 0, spent: 0, commands: [], errors: {} };
  runBalancePlayerPolicy(room, ledger, () => null);
  assert.deepEqual(actions, []);
  state.agents[2].dna = tribeDesign("bean", 2, -1);
  room.simSeconds = 3; state.simSeconds = 3;
  runBalancePlayerPolicy(room, ledger, () => null);
  assert.deepEqual(actions, ["upgrade"]);
});

test("diagnostic designs preserve nest defense mode and do not reuse an ordinary matching design", () => {
  const room = fixture(), game = room.games.get("player"), dna = tribeDesign("bean", 1, -1);
  const state = { simSeconds: 0, agents: game.agents, templates: [{ id: 1, dna }], nestLevel: 1, evolutionPoints: 100 };
  game.decisionSnapshot = () => ({ state });
  const actions = [];
  game.command = action => { actions.push(action); return action.type === "design" ? { templateId: 2 } : { agentId: "new" }; };
  const ledger = { mode: "production", attempted: 0, succeeded: 0, spent: 0, commands: [], errors: {} };
  runBalancePlayerPolicy(room, ledger, () => ({ dna, defenseMode: "nest", productionRole: "military" }));
  assert.equal(actions[0].type, "design"); assert.equal(actions[0].defenseMode, "nest");
  assert.deepEqual(actions[1], { type: "birth", templateId: 2 });
});

test("benchmark fingerprints the current production strategy and design dependencies", () => {
  const result = simulateAiBalance({ seconds: .25 }, { createRoom: fixture, tickRoom(room, elapsed) { room.simSeconds += elapsed; } });
  for (const path of ["./tribe-strategy.mjs", "./tribe-designs.mjs", "./tribe-defense-designs.mjs", "./tribe-combat-templates.mjs", "./nest-defender.mjs"])
    assert.match(result.sourceDigests[path], /^[a-f0-9]{64}$/);
});

test("player victory ends the benchmark without recording defeat or a before-contact loss", () => {
  const result = simulateAiBalance({ seconds: 1 }, { createRoom: contactFixture, tickRoom(room, elapsed) {
    room.simSeconds += elapsed;
    room.games.get("player").ending = { reason: "victory", endedAt: room.simSeconds };
  } });
  const player = result.tribes.find(tribe => !tribe.ai);
  assert.equal(result.stopReason, "player-ending");
  assert.equal(player.ending.reason, "victory");
  assert.equal(player.defeated, false);
  assert.equal(player.contacts.defeatedAt, null);
  assert.deepEqual(player.defeatedBeforeContact, { any: null, mutual: null, playerMutual: null });
});

test("a destroyed nest remains a defeat even with an inconsistent victory ending", () => {
  const result = simulateAiBalance({ seconds: 1 }, { createRoom: contactFixture, tickRoom(room, elapsed) {
    room.simSeconds += elapsed;
    const player = room.games.get("player");
    player.ending = { reason: "victory", endedAt: room.simSeconds };
    player.nest.health = 0;
  } });
  const player = result.tribes.find(tribe => !tribe.ai);
  assert.equal(player.defeated, true);
  assert.equal(player.contacts.defeatedAt, .25);
  assert.deepEqual(player.defeatedBeforeContact, { any: true, mutual: true, playerMutual: true });
});
