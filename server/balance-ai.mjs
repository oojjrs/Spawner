import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { cpus } from "node:os";
import { pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { createRoom, tickRoom } from "../client/room.mjs";
import { militaryAgent, CONQUEST_PACING } from "./conquest-pacing.mjs";
import { tribeProductionTemplate } from "./tribe-production.mjs";
import { tribeWorkers, tribeUpgradeReady, tribeInvasionReady } from "./tribe-strategy.mjs";
import { sameTribeDesign } from "./tribe-designs.mjs";
import { tribeDefenseAgent } from "./tribe-defense-designs.mjs";

const sourceDigests = Object.fromEntries(["./game.mjs", "./tribe-production.mjs", "./tribe-strategy.mjs", "./tribe-designs.mjs",
  "./tribe-defense-designs.mjs", "./tribe-combat-templates.mjs", "./nest-defender.mjs", "./colony-supply.mjs", "./dna.mjs",
  "./tribe-start.mjs", "./tribe-dna-stats.mjs", "./dna-unit.mjs", "./utility.mjs", "./combat.mjs", "./combat-position.mjs", "./raid-combat-scale.mjs", "./raids.mjs", "./raid-pressure.mjs", "./lifespan.mjs", "./resource-points.mjs", "./resources.mjs", "./unit-recovery.mjs", "./worker-route.mjs", "./conquest-pacing.mjs", "./nests.mjs", "../client/room.mjs"].map(path =>
  [path, createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex")]));

export const BALANCE_AI_TRIBES = Object.freeze(["bean", "spore", "pebble", "spring"]);

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function summarizeTickPerformance(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = fraction => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : 0;
  const totalMs = samples.reduce((sum, value) => sum + value, 0);
  return { samples: samples.length, totalMs, meanMs: samples.length ? totalMs / samples.length : 0,
    p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), maxMs: sorted.at(-1) || 0,
    over16_7Ms: samples.filter(value => value > 16.7).length, over33_3Ms: samples.filter(value => value > 33.3).length };
}

// Diagnostic player policy uses only public paid commands. It never writes unit
// health, lifespan, funds, owner identity or AI flags, and is not the idle baseline.
export function runBalancePlayerPolicy(room, ledger, chooseTemplate = tribeProductionTemplate) {
  if (ledger.mode !== "production" || room.simSeconds < (ledger.nextAt || 0)) return;
  ledger.nextAt = room.simSeconds + CONQUEST_PACING.productionInterval;
  const game = room.games.get(room.hostId), colony = room.colonies.find(entry => entry.ownerId === room.hostId);
  if (game.ending || game.nest.health <= 0) return;
  const state = { ...game.decisionSnapshot().state };
  const execute = action => {
    const before = game.decisionSnapshot().state.evolutionPoints;
    ledger.attempted++;
    try {
      const result = game.command(action);
      const spent = Math.max(0, before - game.decisionSnapshot().state.evolutionPoints);
      ledger.succeeded++; ledger.spent += spent;
      ledger.commands.push({ seconds: room.simSeconds, type: action.type, spent,
        templateId: result?.templateId ?? action.templateId ?? null, agentId: result?.agentId ?? null,
        genes: action.dna?.pieces.map(piece => piece.gene) });
      return result || {};
    } catch (error) {
      const key = action.type + ": " + error.message;
      ledger.errors[key] = (ledger.errors[key] || 0) + 1;
      return null;
    }
  };
  const template = chooseTemplate(state, colony.tribe);
  const workers = tribeWorkers(state, colony.tribe);
  const replacing = workers.length < 2;
  const birth = () => {
    if (!template?.dna) return false;
    const existing = state.templates.find(candidate => sameTribeDesign(candidate, template) &&
      (candidate.defenseMode || null) === (template.defenseMode || null));
    let templateId = existing?.id;
    if (!templateId) {
      const design = execute({ type: "design", templateId: null, name: "검증 설계 " + (state.nextTemplateId || state.templates.length + 1),
        dna: template.dna, defenseMode: template.defenseMode, birth: false });
      if (!design?.templateId) return false;
      templateId = design.templateId;
    }
    return !!execute({ type: "birth", templateId });
  };
  if (template && (replacing || template.productionRole === "military" && !tribeInvasionReady(state, colony.tribe)) && birth()) return;
  if (tribeUpgradeReady(state, colony.tribe)) {
    execute({ type: "upgrade" }); return;
  }
  if (template) birth();
}

function configuration(options) {
  const config = { seed: 13, selectedTribe: "bean", seconds: 1200, stepSeconds: .25,
    randomSeed: 12345, creatures: true, checkpointSeconds: 300, playerPolicy: "idle", ...options };
  for (const key of ["seed", "randomSeed"]) if (!Number.isInteger(config[key]) || config[key] < 0 || config[key] > 4294967295)
    throw new Error(`${key} must be an unsigned 32-bit integer`);
  if (!["idle", "production"].includes(config.playerPolicy)) throw new Error("Unknown player policy");
  if (!BALANCE_AI_TRIBES.includes(config.selectedTribe)) throw new Error("Unknown selected tribe");
  if (!Number.isFinite(config.seconds) || config.seconds <= 0 || !Number.isFinite(config.stepSeconds) || config.stepSeconds <= 0 ||
      config.stepSeconds > 1 || !Number.isFinite(config.checkpointSeconds) || config.checkpointSeconds <= 0 || typeof config.creatures !== "boolean")
    throw new Error("Invalid simulation duration, step, checkpoint or creature mode");
  return config;
}

// Contacts are observed after real ticks, never inferred from distance or fogged
// coordinates. Defeated colonies and dead units cannot create new contacts.
export function createBalanceContactTracker(room) {
  const observationStartedAt = room.simSeconds;
  const colonies = room.colonies, player = colonies.find(colony => colony.ownerId === room.hostId)?.tribe;
  const directions = new Map(), pairs = [], defeats = new Map();
  const gameFor = colony => room.games.get(colony.ownerId);
  const complete = colonies.every(colony => typeof gameFor(colony)?.isVisible === "function" && typeof gameFor(colony)?.colonyKnown === "function");
  const key = (first, second) => first + ":" + second;
  const active = game => !!game && !game.ending && game.nest?.health > 0 && game.agents.some(agent => agent.health > 0) &&
    !colonies.some(colony => gameFor(colony) === game && defeats.has(colony.tribe));
  const minimum = values => { const found = values.filter(value => value !== null); return found.length ? Math.min(...found) : null; };
  for (const observer of colonies) for (const target of colonies) if (observer !== target)
    directions.set(key(observer.tribe, target.tribe), { observer: observer.tribe, target: target.tribe,
      firstUnitSightAt: null, firstNestKnownAt: null, firstAwarenessAt: null });
  for (let i = 0; i < colonies.length; i++) for (let j = i + 1; j < colonies.length; j++)
    pairs.push({ first: colonies[i].tribe, second: colonies[j].tribe, firstMutualAwarenessAt: null });
  const capture = () => {
    for (const colony of colonies) {
      const game = gameFor(colony);
      if (!defeats.has(colony.tribe) && (game.ending && game.ending.reason !== "victory" || game.nest?.health <= 0))
        defeats.set(colony.tribe, Number.isFinite(game.ending?.endedAt) ? game.ending.endedAt : room.simSeconds);
    }
    for (const observer of colonies) {
      const observerGame = gameFor(observer);
      if (!active(observerGame)) continue;
      for (const target of colonies) {
        if (target === observer) continue;
        const targetGame = gameFor(target);
        if (!active(targetGame)) continue;
        const entry = directions.get(key(observer.tribe, target.tribe));
        if (entry.firstUnitSightAt === null && typeof observerGame.isVisible === "function" &&
            targetGame.agents.some(agent => agent.health > 0 && observerGame.isVisible(agent.x, agent.y)))
          entry.firstUnitSightAt = room.simSeconds;
        if (entry.firstNestKnownAt === null && typeof observerGame.colonyKnown === "function" && observerGame.colonyKnown(target))
          entry.firstNestKnownAt = room.simSeconds;
        entry.firstAwarenessAt = minimum([entry.firstUnitSightAt, entry.firstNestKnownAt]);
      }
    }
    for (const pair of pairs) {
      if (pair.firstMutualAwarenessAt !== null) continue;
      const first = colonies.find(colony => colony.tribe === pair.first), second = colonies.find(colony => colony.tribe === pair.second);
      if (!active(gameFor(first)) || !active(gameFor(second))) continue;
      const a = directions.get(key(pair.first, pair.second)).firstAwarenessAt;
      const b = directions.get(key(pair.second, pair.first)).firstAwarenessAt;
      if (a !== null && b !== null) pair.firstMutualAwarenessAt = Math.max(a, b);
    }
  };
  const forTribe = tribe => {
    const outgoing = [...directions.values()].filter(entry => entry.observer === tribe);
    const incoming = [...directions.values()].filter(entry => entry.target === tribe);
    const relevant = pairs.filter(pair => pair.first === tribe || pair.second === tribe);
    const any = minimum(outgoing.map(entry => entry.firstAwarenessAt));
    const mutual = minimum(relevant.map(pair => pair.firstMutualAwarenessAt));
    const playerMutual = minimum(relevant.filter(pair => pair.first === player || pair.second === player).map(pair => pair.firstMutualAwarenessAt));
    const defeatedAt = defeats.get(tribe) ?? null;
    const before = at => defeatedAt === null ? null : at !== null ? defeatedAt < at : complete ? true : null;
    return { firstOtherAwarenessAt: any, firstSeenByOtherAt: minimum(incoming.map(entry => entry.firstAwarenessAt)),
      firstMutualAwarenessAt: mutual, playerSawTribeAt: tribe === player ? null : directions.get(key(player, tribe))?.firstAwarenessAt ?? null,
      tribeSawPlayerAt: tribe === player ? null : directions.get(key(tribe, player))?.firstAwarenessAt ?? null,
      firstPlayerMutualAwarenessAt: playerMutual, defeatedAt,
      defeatedBeforeContact: { any: before(any), mutual: before(mutual), playerMutual: before(playerMutual) } };
  };
  return { capture, forTribe, snapshot: () => ({ version: 1, observationStartedAt, completeVisibilityApis: complete,
    sampledStepSeconds: null,
    definitions: { any: "Observer saw a living rival unit or knew its nest while both colonies were active",
      mutual: "Both directions of awareness recorded while both colonies were active; simultaneous sight is not required",
      playerMutual: "Mutual awareness specifically between this tribe and the selected player",
      missing: "Null means not observed; defeatedBeforeContact is null for undefeated colonies or missing visibility APIs",
      deathBoundary: "No new contacts on or after an observed colony defeat, or from dead units; no retrospective inference",
      resolution: "Tick-boundary observations; contact and defeat within one tick cannot be ordered and are conservatively not counted as prior contact" },
    directional: [...directions.values()].map(entry => ({ ...entry })), mutualPairs: pairs.map(pair => ({ ...pair })),
    tribes: Object.fromEntries(colonies.map(colony => [colony.tribe, forTribe(colony.tribe)])) }) };
}

const expeditionRefs = new WeakMap();
const expeditionCategories = ["birth", "retreat", "combat", "explore", "other"];
function expeditionCategory(agent, seconds) {
  return agent.birth?.readyAt > seconds ? "birth" : agent.retreat ? "retreat" : agent.combat ? "combat" :
    agent.utility?.action === "explore" ? "explore" : "other";
}
function colonyDistance(agent, colony) {
  return [agent?.x, agent?.y, colony.x, colony.y].every(Number.isFinite) ?
    Math.abs(agent.x - (colony.x + 2)) + Math.abs(agent.y - (colony.y + 2)) : null;
}

// Only existing antenna military units are observed. No orders or roles are added.
export function observeBalanceExpedition(entry, agent, colony, seconds, getExplored, size) {
  if (entry.role !== "military" || !entry.genes?.includes("antenna")) return;
  const distance = colonyDistance(agent, colony);
  if (!entry.expedition) entry.expedition = { maxDistance: distance, deathDistance: null,
    stateSeconds: Object.fromEntries(expeditionCategories.map(key => [key, 0])),
    targetChanges: { frontier: 0, patrol: 0, unexploredTarget: 0, unavailable: 0 } };
  const observation = entry.expedition;
  let previous = expeditionRefs.get(entry);
  if (previous) observation.stateSeconds[previous.category] += Math.max(0, seconds - previous.at);
  else previous = { targetKey: null };
  if (distance !== null) observation.maxDistance = Math.max(observation.maxDistance ?? 0, distance);
  const key = agent.utility?.action === "explore" ? agent.utility.target?.key ?? null : null;
  if (key !== null && key !== previous.targetKey) {
    const target = agent.utility.target, explored = getExplored?.();
    let kind = "unavailable";
    if (explored?.has && Number.isInteger(size) && [target?.x, target?.y].every(Number.isInteger) &&
        target.x >= 0 && target.y >= 0 && target.x < size && target.y < size) {
      const index = target.y * size + target.x;
      kind = !explored.has(index) ? "unexploredTarget" :
        [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
          const x = target.x + dx, y = target.y + dy;
          return x >= 0 && y >= 0 && x < size && y < size && !explored.has(y * size + x);
        }) ? "frontier" : "patrol";
    }
    observation.targetChanges[kind]++;
  }
  expeditionRefs.set(entry, { agent, at: seconds, category: expeditionCategory(agent, seconds), targetKey: key });
}

export function closeBalanceExpedition(entry, colony, seconds, died = true) {
  const previous = expeditionRefs.get(entry);
  if (!previous || !entry.expedition) return;
  entry.expedition.stateSeconds[previous.category] += Math.max(0, seconds - previous.at);
  if (died) {
    const distance = colonyDistance(previous.agent, colony);
    entry.expedition.deathDistance = distance;
    if (distance !== null) entry.expedition.maxDistance = Math.max(entry.expedition.maxDistance ?? 0, distance);
  }
  expeditionRefs.delete(entry);
}

function expeditionSummary(record) {
  const entries = [...record.seen.values()].filter(entry => entry.expedition);
  const distances = entries.map(entry => entry.expedition.maxDistance).filter(value => value !== null);
  return { units: entries.length, maxDistance: distances.length ? Math.max(...distances) : null,
    stateSeconds: Object.fromEntries(expeditionCategories.map(key => [key, entries.reduce((sum, entry) => sum + entry.expedition.stateSeconds[key], 0)])),
    targetChanges: Object.fromEntries(["frontier", "patrol", "unexploredTarget", "unavailable"].map(key =>
      [key, entries.reduce((sum, entry) => sum + entry.expedition.targetChanges[key], 0)])),
    unitsObserved: entries.map(entry => ({ bornObservedAt: entry.seconds, diedAt: entry.deathAt ?? null,
      ...entry.expedition, stateSeconds: { ...entry.expedition.stateSeconds }, targetChanges: { ...entry.expedition.targetChanges } })),
    definitions: { distance: "Manhattan cells from colony top-left + (2,2); death uses the retained agent reference at removal",
      time: "Previous observed category receives elapsed simulation time; exclusive priority birth > retreat > combat > utility.explore > other. Stops at observed death or colony defeat; no same-tick event ordering inferred",
      targets: "Count only transitions to a non-null explore target key, including re-entry after another action. Frontier means explored target with an in-bounds unexplored four-neighbor; patrol means explored target without such neighbor. These geometric labels do not prove strategic intent" } };
}

const typedSaveConstructors = new Map([Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array].map(type => [type.name, type]));

// Portable JSON companion to v8.serialize(saveRoom(room)). Tagged object entries
// avoid collisions with user/game keys and preserve typed collections in browsers.
export function serializableBalanceSave(saved) {
  const encode = value => {
    if (value === undefined) return { kind: "undefined" };
    if (typeof value === "bigint") return { kind: "bigint", value: String(value) };
    if (typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0))) return { kind: "number", value: Object.is(value, -0) ? "-0" : String(value) };
    if (value === null || typeof value !== "object") return value;
    if (ArrayBuffer.isView(value)) return { kind: value instanceof DataView ? "DataView" : value.constructor.name,
      values: value instanceof DataView ? [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)] : Array.from(value, encode) };
    if (value instanceof ArrayBuffer) return { kind: "ArrayBuffer", values: [...new Uint8Array(value)] };
    if (value instanceof Map) return { kind: "Map", entries: [...value].map(([key, item]) => [encode(key), encode(item)]) };
    if (value instanceof Set) return { kind: "Set", values: [...value].map(encode) };
    if (value instanceof Date) return { kind: "Date", value: value.toISOString() };
    if (Array.isArray(value)) return { kind: "Array", values: value.map(encode) };
    return { kind: "Object", entries: Object.entries(value).map(([key, item]) => [key, encode(item)]) };
  };
  return { format: "spawner-typed-room-save", version: 1, data: encode(saved),
    note: "Decode tagged collections before restoreRoom. Structural values and typed collections are preserved; use the v8 companion for exact object-identity graph preservation." };
}

export function restoreSerializableBalanceSave(envelope) {
  if (envelope?.format !== "spawner-typed-room-save" || envelope.version !== 1) throw new Error("Unsupported typed room save");
  const decode = value => {
    if (value === null || typeof value !== "object") return value;
    if (typedSaveConstructors.has(value.kind)) return typedSaveConstructors.get(value.kind).from(value.values.map(decode));
    switch (value.kind) {
      case "undefined": return undefined;
      case "bigint": return BigInt(value.value);
      case "number": return value.value === "-0" ? -0 : Number(value.value);
      case "ArrayBuffer": return Uint8Array.from(value.values).buffer;
      case "DataView": return new DataView(Uint8Array.from(value.values).buffer);
      case "Map": return new Map(value.entries.map(([key, item]) => [decode(key), decode(item)]));
      case "Set": return new Set(value.values.map(decode));
      case "Date": return new Date(value.value);
      case "Array": return value.values.map(decode);
      case "Object": return Object.fromEntries(value.entries.map(([key, item]) => [key, decode(item)]));
      default: throw new Error("Unknown typed room save tag");
    }
  };
  return decode(envelope.data);
}

// Runs the shipping room scheduler. The selected player receives no commands.
// No-creatures mode removes neutral creatures only; rival colony combat remains enabled.
function* runAiBalance(options = {}, dependencies = {}) {
  const config = configuration(options), previousRandom = Math.random;
  const now = dependencies.now || (() => performance.now()), wallStartedAt = now(), tickDurations = [], policyDurations = [];
  const playerPolicy = { mode: config.playerPolicy, description: config.playerPolicy === "idle" ? "No player commands" :
    "At the production cadence, use tribeProductionTemplate and current tribeWorkers, tribeInvasionReady and tribeUpgradeReady priorities with public paid design/birth/upgrade commands; no health, lifespan, funds or control changes",
    attempted: 0, succeeded: 0, spent: 0, commands: [], errors: {} };
  Math.random = seededRandom(config.randomSeed);
  try {
    const room = (dependencies.createRoom || createRoom)("AI 밸런스 검증", config.seed, config.selectedTribe, null, false, false);
    if (!config.creatures) room.creatureSystem = { agents: [], tick() {}, save() { return { version: 5, agents: [] }; } };
    const contacts = createBalanceContactTracker(room);
    const tracked = new Map(room.colonies.map(colony => {
      const game = room.games.get(colony.ownerId);
      return [colony.tribe, { initialIds: new Set(game.agents.map(agent => agent.id)), seen: new Map(),
        milestones: [{ level: game.nestLevel, seconds: 0 }], emptyPopulationAt: [], wasEmpty: false }];
    }));
    const capture = () => {
      contacts.capture();
      for (const colony of room.colonies) {
        const game = room.games.get(colony.ownerId), record = tracked.get(colony.tribe);
        for (const agent of game.agents) if (!record.seen.has(agent.id)) record.seen.set(agent.id,
          { dna: !!agent.dna, cost: agent.cost, role: militaryAgent(agent, colony.tribe) ? "military" : "worker",
            seconds: room.simSeconds, expiresAt: (agent.lifespanStartedAt ?? agent.bornAt ?? 0) + (agent.lifespan || 300), genes: agent.dna?.pieces.map(piece => piece.gene) || [], guard: militaryAgent(agent, colony.tribe) && tribeDefenseAgent(agent) });
        let explored;
        const getExplored = () => explored ??= game.decisionSnapshot?.().state?.explored;
        for (const agent of game.agents) {
          const entry = record.seen.get(agent.id);
          if (agent.health > 0 && !game.ending) observeBalanceExpedition(entry, agent, colony, room.simSeconds, getExplored, room.world.size || 320);
          else if (game.ending && agent.health > 0) closeBalanceExpedition(entry, colony, room.simSeconds, false);
        }
        const liveIds = new Set(game.agents.filter(agent => agent.health > 0).map(agent => agent.id));
        for (const [id, entry] of record.seen) if (entry.deathAt === undefined && !liveIds.has(id)) {
          closeBalanceExpedition(entry, colony, room.simSeconds);
          entry.deathAt = room.simSeconds;
          entry.deathReason = room.simSeconds + 1e-8 >= entry.expiresAt ? "lifespan" : "early-loss";
        }
        if (record.milestones.at(-1).level !== game.nestLevel) record.milestones.push({ level: game.nestLevel, seconds: room.simSeconds });
        const empty = !game.agents.some(agent => agent.health > 0);
        if (empty && !record.wasEmpty) record.emptyPopulationAt.push(room.simSeconds);
        record.wasEmpty = empty;
      }
    };
    const metrics = () => room.colonies.map(colony => {
      const game = room.games.get(colony.ownerId), state = game.decisionSnapshot().state, record = tracked.get(colony.tribe);
      const living = game.agents.filter(agent => agent.health > 0), produced = [...record.seen].filter(([id]) => !record.initialIds.has(id)).map(([, entry]) => entry);
      const designs = new Map();
      for (const agent of living) {
        const design = agent.dna ? "dna:" + agent.dna.pieces.map(piece => piece.gene).sort().join(",") : "legacy:" + [...agent.slots].sort().join(",");
        designs.set(design, (designs.get(design) || 0) + 1);
      }
      return { tribe: colony.tribe, ai: colony.ownerId !== room.hostId, collected: game.colonyFood,
        points: state.evolutionPoints, workerRouteDistance: state.workerRouteDistance ?? null,
        workerRouteSamples: (state.workerRouteSamples || []).slice(-8).map(({ at, distance }) => ({ at, distance })),
        latestWorkerRouteSample: state.workerRouteSamples?.length ? { ...state.workerRouteSamples.at(-1) } : null, level: game.nestLevel, nestHealth: game.nest.health,
        defeated: !!game.ending && game.ending.reason !== "victory" || game.nest.health <= 0,
        contacts: contacts.forTribe(colony.tribe), defeatedBeforeContact: contacts.forTribe(colony.tribe).defeatedBeforeContact,
        expedition: expeditionSummary(record),
        initial: record.initialIds.size, produced: produced.length, dnaProduced: produced.filter(entry => entry.dna).length,
        legacyProduced: produced.filter(entry => !entry.dna).length,
        militaryProduced: produced.filter(entry => entry.role === "military").length, guardProduced: produced.filter(entry => entry.guard).length,
        firstMilitaryAt: produced.find(entry => entry.role === "military")?.seconds ?? null,
        firstGuardAt: produced.find(entry => entry.guard)?.seconds ?? null, productionSpent: produced.reduce((sum, entry) => sum + entry.cost, 0),
        alive: living.length, hatched: living.filter(agent => !agent.birth || agent.birth.readyAt <= room.simSeconds).length,
        deaths: record.seen.size - living.length,
        lifespanDeaths: [...record.seen.values()].filter(entry => entry.deathReason === "lifespan").length,
        earlyLosses: [...record.seen.values()].filter(entry => entry.deathReason === "early-loss").length,
        productionHistory: produced.map(({seconds, cost, role, genes, deathAt, deathReason}) => ({seconds, cost, role, genes, deathAt, deathReason})),
        military: living.filter(agent => militaryAgent(agent, colony.tribe)).length,
        workers: living.filter(agent => !militaryAgent(agent, colony.tribe)).length,
        milestones: record.milestones.map(entry => ({ ...entry })), emptyPopulationAt: [...record.emptyPopulationAt],
        designs: Object.fromEntries(designs), ending: game.ending ? { ...game.ending } : null };
    });
    capture();
    const checkpoints = [];
    let nextCheckpoint = config.checkpointSeconds, ticks = 0;
    while (room.simSeconds + 1e-8 < config.seconds && !room.games.get(room.hostId).ending) {
      const before = room.simSeconds, tickStartedAt = now();
      (dependencies.tickRoom || tickRoom)(room, Math.min(config.stepSeconds, config.seconds - room.simSeconds));
      tickDurations.push(now() - tickStartedAt);
      if (room.simSeconds <= before) throw new Error("Room simulation stopped advancing without a player ending");
      ticks++;
      if (config.playerPolicy !== "idle") {
        const policyStartedAt = now();
        runBalancePlayerPolicy(room, playerPolicy, dependencies.playerTemplate || tribeProductionTemplate);
        policyDurations.push(now() - policyStartedAt);
      }
      capture();
      if (room.simSeconds + 1e-8 >= nextCheckpoint) {
        const checkpoint = { seconds: room.simSeconds, tribes: metrics() };
        checkpoints.push(checkpoint);
        dependencies.onCheckpoint?.(checkpoint);
        nextCheckpoint += config.checkpointSeconds;
      }
      yield;
    }
    const tribes = metrics();
    const cpu = cpus();
    const timing = { scope: "CPU wall-clock duration of tickRoom, including AI production; excludes rendering and metric capture",
      simulationStepSeconds: config.stepSeconds, tick: summarizeTickPerformance(tickDurations),
      playerPolicy: summarizeTickPerformance(policyDurations),
      wallTimeMs: now() - wallStartedAt,
      environment: { node: process.version, platform: process.platform, architecture: process.arch,
        cpuModel: cpu[0]?.model || null, logicalCpus: cpu.length } };
    return { config, sourceDigests, timing, contacts: { ...contacts.snapshot(), sampledStepSeconds: config.stepSeconds }, generationVersion: room.world.generationVersion, combat: { colonies: true, neutralCreatures: config.creatures },
      playerCommands: playerPolicy.succeeded, playerPolicy, completedSeconds: room.simSeconds, ticks,
      stopReason: room.games.get(room.hostId).ending ? "player-ending" : "duration-reached",
      playerEnding: room.games.get(room.hostId).ending, checkpoints, tribes };
  } finally {
    Math.random = previousRandom;
  }
}

// The synchronous adapter is for isolated fixture tests and explicit diagnostics.
export function simulateAiBalance(options = {}, dependencies = {}) {
 const iterator = runAiBalance(options, dependencies);
 let step = iterator.next();
 while (!step.done) step = iterator.next();
 return step.value;
}

// Shipping workers yield between ticks, allowing their budgeted road optimization
// timers to run. The world benchmark must do the same rather than starve them.
export async function simulateAiBalanceAsync(options = {}, dependencies = {}) {
 const iterator = runAiBalance(options, dependencies);
 try {
  let step = iterator.next();
  while (!step.done) {
   await new Promise(resolve => setTimeout(resolve, 0));
   step = iterator.next();
  }
  step.value.timing.scheduler = "Event-loop yield between every room tick; budgeted road jobs enabled";
  return step.value;
 } finally { iterator.return(); }
}

export function parseBalanceAiArguments(args) {
  const config = { seeds: [0, 13, 413], tribes: [...BALANCE_AI_TRIBES], seconds: 1200, stepSeconds: .25,
    randomSeed: 12345, creatures: true, checkpointSeconds: 300, playerPolicy: "idle", output: null };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--no-creatures") config.creatures = false;
    else if (flag === "--seeds") config.seeds = args[++index]?.split(",").map(Number);
    else if (flag === "--tribes") config.tribes = args[++index]?.split(",");
    else if (flag === "--player-policy") config.playerPolicy = args[++index];
    else if (flag === "--step") config.stepSeconds = Number(args[++index]);
    else if (flag === "--seconds") config.seconds = Number(args[++index]);
    else if (flag === "--random-seed") config.randomSeed = Number(args[++index]);
    else if (flag === "--checkpoint") config.checkpointSeconds = Number(args[++index]);
    else if (flag === "--output") { config.output = args[++index]; if (!config.output) throw new Error("Missing output path"); }
    else throw new Error(`Unknown AI balance argument: ${flag}`);
  }
  if (!config.seeds?.length || !config.tribes?.length) throw new Error("At least one seed and selected tribe are required");
  for (const seed of config.seeds) for (const selectedTribe of config.tribes) configuration({ ...config, seed, selectedTribe });
  return config;
}

if (!isMainThread && workerData?.aiBalance) parentPort.postMessage(await simulateAiBalanceAsync(workerData.config));
else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = parseBalanceAiArguments(process.argv.slice(2)), results = [];
  // One worker at a time bounds memory and releases world/navigation caches between runs.
  for (const seed of config.seeds) for (const selectedTribe of config.tribes) {
    const run = { seed, selectedTribe, seconds: config.seconds, stepSeconds: config.stepSeconds,
      randomSeed: config.randomSeed, creatures: config.creatures, checkpointSeconds: config.checkpointSeconds, playerPolicy: config.playerPolicy };
    const result = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: { aiBalance: true, config: run },
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 4 } });
      let received = false;
      worker.once("message", async value => {
        received = true;
        // Timers belonging to road optimizers may still retain a finished room.
        // Terminate this diagnostic isolate only after its complete result arrives.
        await worker.terminate();
        resolve(value);
      });
      worker.once("error", reject);
      worker.once("exit", code => {
        if (!received) reject(new Error(`AI balance worker exited ${code} before returning a result`));
      });
    });
    results.push(result);
    process.stdout.write(JSON.stringify({ seed, selectedTribe, seconds: result.completedSeconds, stopReason: result.stopReason, timing: result.timing.tick,
      tribes: result.tribes.map(({ tribe, ai, collected, produced, dnaProduced, alive, level, military, defeated, ending, defeatedBeforeContact }) =>
        ({ tribe, ai, collected, produced, dnaProduced, alive, level, military, defeated, ending: ending?.reason || null, defeatedBeforeContact })) }) + "\n");
    if (config.output) writeFileSync(config.output, JSON.stringify({ config, results }, null, 2) + "\n");
  }
}
