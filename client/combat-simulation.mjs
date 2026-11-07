import { UNIT_COMBAT_STATS, unitCombatStats, combatProfile, combatAbilityStats } from "../server/combat-stats.mjs";
import { CREATURE_MOVEMENT } from "../server/creature-movement.mjs";
import { creatureAttackRole } from "../server/creature-attack-role.mjs";
import { startingWorkerDna } from "../server/tribe-start.mjs";
import { dnaUnitStats, dnaAppearance, validateDna } from "../server/dna-unit.mjs";
import { createCombat } from "../server/combat.mjs";
import { DNA_COMBAT_RULES, dnaCombatStats } from "../server/dna-combat-stats.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";


export const SIMULATION_STATS = Object.freeze([
  ["power", "근접 공격력", "공격"], ["rangedPower", "원거리 공격력", "공격"], ["vitality", "생명력", "생존"], ["armor", "방어력", "방어"],
  ["flatPen", "고정 관통", "공격"], ["percentPen", "비율 관통", "공격"], ["haste", "근접 공속", "타이밍"], ["rangedHaste", "원거리 공속", "타이밍"],
  ["focus", "첫타 준비", "타이밍"], ["multiHit", "연타 수", "연타"], ["hitSpeed", "타격 간격", "연타"],
  ["combo", "후속타 위력", "연타"], ["crit", "치명 확률", "공격"], ["critPower", "치명 배율", "공격"],
  ["accuracy", "정밀", "공격"], ["evasion", "회피", "방어"], ["parry", "패링", "방어"],
  ["block", "블록", "방어"], ["blockPower", "블록 경감", "방어"], ["counter", "반격 확률", "반격"],
  ["counterPower", "반격 위력", "반격"], ["tenacity", "강인함", "생존"], ["stun", "기절 확률", "제어"],
  ["stunDuration", "기절 시간", "제어"], ["drain", "흡혈", "생존"]
].map(([key, label, group]) => Object.freeze({ key, label, group })));

export const DEFAULT_SIMULATION_RULES = Object.freeze({ ...DNA_COMBAT_RULES,
  initiativeDelay: .15, maxSeconds: 120, maxEvents: 20000
});

const statKeys = new Set([...SIMULATION_STATS.map(stat => stat.key), "rangedPower", "rangedHaste"]);
const probabilityRules = new Set(["armorCap", "percentPenCap", "critCap", "accuracyCap", "dodgeCap", "parryCap", "blockCap",
  "blockReductionBase", "blockReductionCap", "counterCap", "tenacityCap", "stunCap", "drainCap"]);

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new TypeError(label + " must be a plain object");
}

function normalizeRules(input) {
  if (input !== undefined) plainObject(input, "rules");
  const rules = { ...DEFAULT_SIMULATION_RULES, ...input };
  for (const key of Object.keys(rules)) {
    if (!Object.hasOwn(DEFAULT_SIMULATION_RULES, key)) throw new RangeError("Unknown rule: " + key);
    const value = rules[key];
    if (key === "powerCurve") {
      if (!["log", "linear"].includes(value)) throw new RangeError("powerCurve must be log or linear");
    } else {
      if (!Number.isFinite(value) || value < 0 || value > 1000000) throw new RangeError(key + " must be a finite nonnegative number");
      if ((["powerKnee", "rangedPowerKnee", "armorKnee", "healthBase", "maxActionRate", "windupMinimum", "hitGapMinimum", "maxSeconds"].includes(key)) && value <= 0)
        throw new RangeError(key + " must be positive");
      if (probabilityRules.has(key) && value > 1) throw new RangeError(key + " must be between 0 and 1");
    }
  }
  if (rules.jitter > .2) throw new RangeError("jitter must be between 0 and .2");
  if (rules.maxSeconds > 600) throw new RangeError("maxSeconds must not exceed 600");
  if (!Number.isInteger(rules.maxEvents) || rules.maxEvents < 1 || rules.maxEvents > 50000) throw new RangeError("maxEvents must be an integer between 1 and 50000");
  if (rules.maxActionRate > 20) throw new RangeError("maxActionRate must not exceed 20");
  for (const [low, high] of [["windupMinimum", "windupBase"], ["hitGapMinimum", "hitGapBase"], ["followupBase", "followupCap"],
    ["critMultiplierBase", "critMultiplierCap"], ["blockReductionBase", "blockReductionCap"],
    ["counterMultiplierBase", "counterMultiplierCap"], ["stunDurationBase", "stunDurationCap"]])
    if (rules[low] > rules[high]) throw new RangeError(low + " must not exceed " + high);
  return rules;
}

function normalizeBuild(input) {
  plainObject(input, "build");
  if (typeof input.key !== "string" || !input.key.length || input.key.length > 100) throw new TypeError("build.key must be a nonempty string up to 100 characters");
  if (input.name !== undefined && (typeof input.name !== "string" || input.name.length > 100)) throw new TypeError("build.name must be a string up to 100 characters");
  const native = input.counts === undefined && input.organs === undefined;
  if (native && !Object.hasOwn(UNIT_COMBAT_STATS, input.key)) throw new RangeError("Unknown unit: " + input.key);
  const dna = input.dna === undefined ? undefined : validateDna(input.dna, input.dna?.level, input.dna?.budget);
  if (input.dna !== undefined && (!dna || !["bean", "spore", "pebble", "spring"].includes(input.key))) throw new RangeError("Invalid playable DNA");
  if (dna && !native) throw new RangeError("DNA and count overrides must be separate builds");
  if (input.counts !== undefined) plainObject(input.counts, "counts");
  const counts = Object.fromEntries([...statKeys].map(key => [key, 0]));
  for (const [key, value] of Object.entries(input.counts || {})) {
    if (!statKeys.has(key)) throw new RangeError("Unknown count: " + key);
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(key + " count must be a nonnegative safe integer");
    counts[key] = value;
  }
  if (input.organs !== undefined) plainObject(input.organs, "organs");
  const organs = { attack: 1, ranged: 0, armor: true, legs: true };
  for (const [key, value] of Object.entries(input.organs || {})) {
    if (!Object.hasOwn(organs, key)) throw new TypeError("Unknown organ: " + key);
    if (["attack", "ranged"].includes(key)) {
      const count = typeof value === "boolean" ? Number(value) : value;
      if (!Number.isSafeInteger(count) || count < 0 || count > 1) throw new RangeError("Organ count must be a nonnegative safe integer");
      organs[key] = count;
    } else {
      if (typeof value !== "boolean") throw new TypeError("Legacy armor and legs must be boolean");
      organs[key] = value;
    }
  }
  const pieceCount = Object.values(counts).reduce((sum, value) => sum + value, 0) + organs.attack + organs.ranged;
  if (!Number.isSafeInteger(pieceCount)) throw new RangeError("Total piece count must be a safe integer including organs");
  return { key: input.key, name: input.name || input.key, organs, counts, pieceCount, native, dna };
}

const geneKeys = Object.freeze({ vitality: "health", flatPen: "penetration", haste: "speed", rangedHaste: "rangedSpeed",
  multiHit: "combo", hitSpeed: "comboSpeed", combo: "comboPower", crit: "critical", critPower: "criticalPower",
  stunDuration: "stunTime", drain: "lifesteal" });

function derive(build, rules) {
  if (build.native) {
    if (["bean", "spore", "pebble", "spring"].includes(build.key)) {
      const stats = dnaUnitStats(build.dna || startingWorkerDna(build.key));
      return { ...stats, canAttack: stats.dna.power > 0 && stats.dna.speed > 0,
        canInitiate: stats.dna.melee || stats.dna.ranged };
    }
    const role = creatureAttackRole(build.key);
    const stats = { ...unitCombatStats(build.key), speed: CREATURE_MOVEMENT[build.key].speed, resistance: 1 };
    const profile = combatProfile({ species: build.key, stats, attributes: {} });
    const abilities = stats.combat;
    return { ...stats, ...profile, HP: stats.health, hitCount: abilities.hits, hitGap: abilities.comboSpeed,
      followupMultiplier: abilities.comboPower / 100, flatPenetration: abilities.penetration, accuracy: abilities.accuracy / 100,
      counter: abilities.counter / 100, counterMultiplier: abilities.counterPower / 100, tenacity: abilities.tenacity / 100,
      stunChance: abilities.stun / 100, stunChancePerHit: abilities.stun / 100, stunDuration: abilities.stunTime,
      drain: abilities.lifesteal / 100, critChance: profile.criticalChance, critMultiplier: profile.criticalMultiplier,
      melee: !!role?.melee, ranged: !!role?.ranged, canAttack: !!role, canInitiate: !!role };
  }
  const counts = Object.fromEntries(Object.entries(build.counts).map(([key, value]) => [geneKeys[key] || key, value]));
  Object.assign(counts, { blade: build.organs.attack, secretion: build.organs.ranged });
  const dna = { ...dnaCombatStats(counts, counts, rules), movement: .25, vision: 1, roaming: true };
  const interval = speed => speed > 0 ? 1 / speed : Infinity;
  const result = { dna, HP: dna.health, health: dna.health, speed: dna.movement, loadedSpeed: dna.movement * .75, vision: dna.vision,
    attackPower: dna.meleePower, defense: dna.armor, meleePower: dna.meleePower, rangedPower: dna.rangedPower,
    attackSpeed: dna.meleeSpeed, meleeSpeed: dna.meleeSpeed, rangedSpeed: dna.rangedSpeed,
    attackInterval: interval(dna.meleeSpeed), rangedAttackInterval: interval(dna.rangedSpeed),
    targetAttackSpeed: dna.meleeSpeed, targetRangedSpeed: dna.rangedSpeed, windup: dna.focus, hitGap: dna.comboSpeed,
    hitCount: dna.hits, recovery: dna.recovery || 0,
    followupMultiplier: dna.comboPower / 100, critChance: dna.critical / 100, critMultiplier: dna.criticalPower / 100,
    armorPenetration: dna.armorPenetration || 0, flatPenetration: dna.penetration, accuracy: dna.accuracy / 100,
    evasion: dna.evasion / 100, parry: dna.parry / 100, block: dna.block / 100, blockReduction: dna.blockPower / 100,
    counter: dna.counter / 100, counterMultiplier: dna.counterPower / 100, tenacity: dna.tenacity / 100,
    stunChance: dna.stun / 100, stunChancePerHit: dna.stun / 100, stunDuration: dna.stunTime, drain: dna.lifesteal / 100,
    pieceCount: build.pieceCount, melee: dna.melee, ranged: dna.ranged,
    canAttack: dna.meleePower > 0 && dna.meleeSpeed > 0 || dna.rangedPower > 0 && dna.rangedSpeed > 0,
    canInitiate: dna.melee || dna.ranged };
  for (const [key, value] of Object.entries(result)) if (typeof value === "number" && !Number.isFinite(value) &&
    !["attackInterval", "rangedAttackInterval", "recovery"].includes(key)) throw new RangeError("Derived " + key + " must be finite");
  return result;
}


export function deriveSimulationStats(build, rules) {
  return derive(normalizeBuild(build), normalizeRules(rules));
}

export function createSimulationTrial(settings) {
  plainObject(settings, "settings");
  const rules = normalizeRules(settings.rules);
  const teams = [settings.left, settings.right].map(input => {
    const builds = Array.isArray(input) ? input : [input];
    if (!builds.length) throw new RangeError("Each team must contain a unit");
    return builds.map(normalizeBuild);
  });
  const seed = settings.seed === undefined ? 1 : settings.seed;
  if (!(typeof seed === "string" && seed.length <= 200 || typeof seed === "number" && Number.isFinite(seed))) throw new TypeError("seed must be finite or a short string");
  if (settings.random !== undefined && typeof settings.random !== "boolean") throw new TypeError("random must be boolean");
  const first = settings.first === undefined ? "simultaneous" : settings.first;
  if (!["simultaneous", "left", "right"].includes(first)) throw new RangeError("Invalid first side");
  const distance = settings.distance === undefined ? 1 : settings.distance;
  if (!Number.isFinite(distance) || distance < 0 || distance > 20) throw new RangeError("distance must be between 0 and 20");
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
  let time = 0, tickIndex = 0, winner = null, reason = null;
  const history = [];
  const entries = Array.from({ length: Math.max(...teams.map(team => team.length)) }, (_, slot) =>
    teams.flatMap((team, side) => team[slot] ? [{ build: team[slot], side, slot }] : [])).flat();
  const agents = entries.map(({ build, side, slot }) => {
    const ownerId = side === 0 ? "left" : "right", stats = derive(build, rules);
    const player = ["bean", "spore", "pebble", "spring"].includes(build.key);
    return { id: slot ? ownerId + "-" + (slot + 1) : ownerId, ownerId, side, slot,
      key: build.key, name: build.name, labAppearance: !build.native, tribe: player ? build.key : undefined,
      species: !player && build.native ? build.key : undefined,
      dna: player && build.native ? build.dna || startingWorkerDna(build.key) : undefined,
      x: 100, y: 100, renderFromX: 100, renderFromY: 100,
      moveStartedAt: 0, moveDuration: 0, health: stats.health, stats, attributes: {},
      appearanceAttributes: player && build.native ? dnaAppearance(build.dna || startingWorkerDna(build.key)) : player ? { ...(stats.melee ? { blade: 1 } : {}), ...(stats.ranged ? { secretion: 1 } : {}) } : undefined,
      combatDisposition: "aggressive", mode: "fight", facing: side === 0 ? 1 : -1, animationStartedAt: 0,
      hurtStartedAt: -Infinity, dnaReactionReadyAt: rules.defensePreparation,
      attackReady: first !== "simultaneous" && first !== ownerId ? rules.initiativeDelay : 0,
      combat: null, attack: null, carrying: 0 };
  });
  const participants = agents;
  const teamHealth = side => participants.filter(agent => agent.ownerId === side).reduce((sum, agent) => sum + agent.health, 0);
  const environment = { games: new Map(), colonies: [], simSeconds: 0, combatRules: rules, combatSimulation: true, combatInitialDistance: distance,
    world: { size: 320, terrain: new Uint8Array(320 * 320) },
    combatRandom: random, damageRandom: settings.random === false ? () => .5 : () => .5 + (random() - .5) * rules.jitter / .2,
    onCombatEvent(event) {
      const source = participants.find(agent => agent.id === event.sourceId);
      history.push({ index: history.length, time: event.at, kind: event.kind, attackerId: event.sourceId,
        targetId: event.targetId, damage: event.amount, critical: !!event.critical, counter: !!event.counter,
        hitIndex: event.hitIndex, hitCount: source?.attack?.hitCount || (source ? combatAbilityStats(source)?.hits : 0) || 1, stunDuration: event.duration,
        leftHealth: teamHealth("left"), rightHealth: teamHealth("right") });
    } };
  for (const side of ["left", "right"]) environment.games.set(side, {
    agents: participants.filter(agent => agent.ownerId === side),
    receiveDamage(target, amount) {
      const previous = target.health;
      target.health = Math.max(0, target.health - amount);
      if (target.health < previous) { target.hurtStartedAt = environment.simSeconds; target.hurtCount = (target.hurtCount || 0) + 1; }
    }
  });
  const combat = createCombat(environment);
  function enroll() {
    for (const agent of agents) {
      if (agent.health <= 0 || agent.combat) continue;
      const target = agents.find(other => other.ownerId !== agent.ownerId && other.health > 0 && other.x === agent.x && other.y === agent.y);
      if (!target) continue;
      combat.engage(agent, target, environment.simSeconds);
    }
  }
  function conclude() {
    const alive = ["left", "right"].map(side => participants.some(agent => agent.ownerId === side && agent.health > 0));
    if (!alive[0] || !alive[1]) { winner = alive[0] ? "left" : alive[1] ? "right" : "draw"; reason = "death"; }
    else if (!participants.some(agent => agent.health > 0 && agent.stats.canAttack && (agent.stats.canInitiate || agent.combat?.defending)) &&
      !participants.some(agent => agent.health > 0 && agent.dnaBleed || agent.dnaProjectiles?.length)) { winner = "draw"; reason = "no-offense"; }
    else if (history.length >= rules.maxEvents) { winner = "draw"; reason = "event-limit"; }
    else if (time >= rules.maxSeconds) { winner = "draw"; reason = "time-limit"; }
  }
  function tick(at) {
    environment.simSeconds = at; time = at;
    enroll();
    for (const agent of participants) combat.update(agent, at);
    conclude();
  }
  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("advance seconds must be finite and nonnegative");
    const until = Math.min(rules.maxSeconds, time + seconds);
    while (!reason && tickIndex / 60 <= until + 1e-9) tick(tickIndex++ / 60);
    if (!reason) { time = until; if (time >= rules.maxSeconds) conclude(); }
    return result();
  }
  function step() {
    const count = history.length;
    while (!reason && history.length === count) {
      const at = Math.min(rules.maxSeconds, tickIndex++ / 60);
      tick(at);
    }
    return result();
  }
  function finish() { return advance(rules.maxSeconds - time); }
  function result() { return { winner, reason, time, leftHealth: teamHealth("left"), rightHealth: teamHealth("right") }; }
  enroll(); conclude();
  return { agents, history, advance, step, finish, result,
    get projectiles() { return participants.flatMap(source => (source.dnaProjectiles || []).map(visual => ({ source,
      target: participants.find(agent => agent.id === (visual.targetId || source.attack?.targetId)), launchedAt: visual.launchedAt, at: visual.hitAt,
      fromX: visual.fromX, fromY: visual.fromY, targetX: visual.targetX, targetY: visual.targetY }))).filter(shot => shot.target); },
    get vfx() { return snapshotCombatVfx(environment, time); },
    get time() { return time; }, get reason() { return reason; } };
}
