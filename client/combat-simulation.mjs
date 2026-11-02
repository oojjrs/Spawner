export const SIMULATION_STATS = Object.freeze([
  ["power", "공격력", "공격"], ["vitality", "생명력", "생존"], ["armor", "방어력", "방어"],
  ["flatPen", "고정 관통", "공격"], ["percentPen", "비율 관통", "공격"], ["haste", "공격 빈도", "타이밍"],
  ["focus", "첫타 준비", "타이밍"], ["multiHit", "연타 수", "연타"], ["hitSpeed", "타격 간격", "연타"],
  ["combo", "후속타 위력", "연타"], ["crit", "치명 확률", "공격"], ["critPower", "치명 배율", "공격"],
  ["accuracy", "정밀", "공격"], ["evasion", "회피", "방어"], ["parry", "패링", "방어"],
  ["block", "블록", "방어"], ["blockPower", "블록 경감", "방어"], ["counter", "반격 확률", "반격"],
  ["counterPower", "반격 위력", "반격"], ["tenacity", "강인함", "생존"], ["stun", "기절 확률", "제어"],
  ["stunDuration", "기절 시간", "제어"], ["drain", "흡혈", "생존"]
].map(([key, label, group]) => Object.freeze({ key, label, group })));

export const DEFAULT_SIMULATION_RULES = Object.freeze({
  powerCurve: "log", powerBase: 2, powerGain: 2, powerKnee: 2,
  healthBase: 10, healthPerPoint: 10, armorPerPoint: 12, armorCap: .7, armorKnee: 60,
  flatPenPerPoint: 4, percentPenCap: .8, percentPenKnee: 4,
  attackRateBase: .5, hasteCap: 1.5, hasteKnee: 4, maxActionRate: 4,
  windupBase: .3, focusPerPoint: .02, windupMinimum: .08,
  hitGapBase: .12, hitSpeedPerPoint: .005, hitGapMinimum: .06, recovery: .3,
  followupBase: .5, comboPerPoint: .05, followupCap: 1,
  critCap: .75, critKnee: 4, critMultiplierBase: 1.5, critMultiplierCap: 3, critPowerKnee: 4,
  accuracyCap: .75, accuracyKnee: 4, dodgeCap: .35, dodgeKnee: 4,
  parryCap: .3, parryKnee: 4, blockCap: .65, blockKnee: 4,
  blockReductionBase: .35, blockReductionCap: .8, blockPowerKnee: 4,
  defensePreparation: .12, reactionCooldown: .6,
  counterCap: .75, counterKnee: 4, counterMultiplierBase: .75, counterMultiplierCap: 1.75,
  counterPowerKnee: 4, counterWindup: .08, counterCooldown: 1.2,
  tenacityCap: .8, tenacityKnee: 4, stunCap: .5, stunKnee: 4,
  stunDurationBase: .25, stunDurationPerPoint: .08, stunDurationCap: 1.5, stunImmunity: 2,
  drainCap: .4, drainKnee: 4, jitter: .05, initiativeDelay: .15,
  maxSeconds: 120, maxEvents: 20000
});

const statKeys = new Set(SIMULATION_STATS.map(stat => stat.key));
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
      if ((["powerKnee", "armorKnee", "healthBase", "maxActionRate", "windupMinimum", "hitGapMinimum", "maxSeconds"].includes(key)) && value <= 0)
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
  if (input.counts !== undefined) plainObject(input.counts, "counts");
  const counts = Object.fromEntries(SIMULATION_STATS.map(stat => [stat.key, 0]));
  for (const [key, value] of Object.entries(input.counts || {})) {
    if (!statKeys.has(key)) throw new RangeError("Unknown count: " + key);
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(key + " count must be a nonnegative safe integer");
    counts[key] = value;
  }
  if (input.organs !== undefined) plainObject(input.organs, "organs");
  const organs = { attack: true, armor: true, legs: true };
  for (const [key, value] of Object.entries(input.organs || {})) {
    if (!Object.hasOwn(organs, key) || typeof value !== "boolean") throw new TypeError("organs must contain only boolean attack, armor, legs");
    organs[key] = value;
  }
  const pieceCount = Object.values(counts).reduce((sum, value) => sum + value, 0) + Object.values(organs).filter(Boolean).length;
  if (!Number.isSafeInteger(pieceCount)) throw new RangeError("Total piece count must be a safe integer including organs");
  return { key: input.key, name: input.name || input.key, organs, counts, pieceCount };
}

function saturation(count, cap, knee) {
  return count === 0 ? 0 : cap * count / (knee + count);
}

function derive(build, rules) {
  const c = build.counts, organs = build.organs;
  const power = rules.powerCurve === "linear" ? rules.powerGain * c.power :
    rules.powerGain * Math.log1p(c.power / rules.powerKnee) / Math.log1p(1 / rules.powerKnee);
  const attackPower = organs.attack ? rules.powerBase + power : 0;
  const health = rules.healthBase + rules.healthPerPoint * c.vitality;
  const hitCount = 1 + c.multiHit;
  const windup = Math.max(rules.windupMinimum, rules.windupBase - c.focus * rules.focusPerPoint);
  const hitGap = Math.max(rules.hitGapMinimum, rules.hitGapBase - c.hitSpeed * rules.hitSpeedPerPoint);
  const targetAttackSpeed = Math.min(rules.maxActionRate, rules.attackRateBase * (1 + saturation(c.haste, rules.hasteCap, rules.hasteKnee)));
  const attackInterval = Math.max(targetAttackSpeed > 0 ? 1 / targetAttackSpeed : Infinity, windup + (hitCount - 1) * hitGap + rules.recovery);
  const stunChance = saturation(c.stun, rules.stunCap, rules.stunKnee);
  const stats = { HP: health, health, attackPower, defense: organs.armor ? c.armor * rules.armorPerPoint : 0,
    attackSpeed: 1 / attackInterval, attackInterval, targetAttackSpeed, windup, hitGap, hitCount, recovery: rules.recovery,
    followupMultiplier: Math.min(rules.followupCap, rules.followupBase + c.combo * rules.comboPerPoint),
    critChance: saturation(c.crit, rules.critCap, rules.critKnee),
    critMultiplier: rules.critMultiplierBase + saturation(c.critPower, rules.critMultiplierCap - rules.critMultiplierBase, rules.critPowerKnee),
    armorPenetration: saturation(c.percentPen, rules.percentPenCap, rules.percentPenKnee), flatPenetration: c.flatPen * rules.flatPenPerPoint,
    accuracy: saturation(c.accuracy, rules.accuracyCap, rules.accuracyKnee),
    evasion: organs.legs ? saturation(c.evasion, rules.dodgeCap, rules.dodgeKnee) : 0,
    parry: organs.armor ? saturation(c.parry, rules.parryCap, rules.parryKnee) : 0,
    block: organs.armor ? saturation(c.block, rules.blockCap, rules.blockKnee) : 0,
    blockReduction: organs.armor ? rules.blockReductionBase + saturation(c.blockPower, rules.blockReductionCap - rules.blockReductionBase, rules.blockPowerKnee) : 0,
    counter: organs.armor ? saturation(c.counter, rules.counterCap, rules.counterKnee) : 0,
    counterMultiplier: rules.counterMultiplierBase + saturation(c.counterPower, rules.counterMultiplierCap - rules.counterMultiplierBase, rules.counterPowerKnee),
    tenacity: saturation(c.tenacity, rules.tenacityCap, rules.tenacityKnee), stunChance,
    stunChancePerHit: -Math.expm1(Math.log1p(-stunChance) / hitCount),
    stunDuration: Math.min(rules.stunDurationCap, rules.stunDurationBase + c.stunDuration * rules.stunDurationPerPoint),
    drain: saturation(c.drain, rules.drainCap, rules.drainKnee),
    pieceCount: build.pieceCount, canAttack: organs.attack && attackPower > 0 && targetAttackSpeed > 0 };
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value === "number" && !Number.isFinite(value) &&
        !(key === "attackInterval" && value === Infinity && targetAttackSpeed === 0))
      throw new RangeError("Derived " + key + " must be finite; adjust counts or rules");
  }
  return stats;
}

export function deriveSimulationStats(build, rules) {
  return derive(normalizeBuild(build), normalizeRules(rules));
}

function keyedRandom(seed, actor, action, hit, channel) {
  const text = JSON.stringify([seed, actor, action, hit, channel]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d); hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b); hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

export function createSimulationTrial(settings) {
  plainObject(settings, "settings");
  const rules = normalizeRules(settings.rules), left = normalizeBuild(settings.left), right = normalizeBuild(settings.right);
  const seed = settings.seed === undefined ? 1 : settings.seed;
  if (!(typeof seed === "string" && seed.length <= 200 || typeof seed === "number" && Number.isFinite(seed))) throw new TypeError("seed must be a finite number or string up to 200 characters");
  if (settings.random !== undefined && typeof settings.random !== "boolean") throw new TypeError("random must be boolean");
  const first = settings.first === undefined ? "simultaneous" : settings.first;
  if (!["simultaneous", "left", "right"].includes(first)) throw new RangeError("first must be simultaneous, left, or right");
  let time = 0, winner = null, reason = null, eventCount = 0;
  const history = [], states = new Map();
  const agents = [left, right].map((build, index) => {
    const id = index === 0 ? "left" : "right", stats = derive(build, rules);
    const delay = first !== "simultaneous" && first !== id ? rules.initiativeDelay : 0;
    const agent = { id, key: build.key, name: build.name, health: stats.health, stats, attributes: {},
      tribe: ["bean", "spore", "pebble", "spring"].includes(build.key) ? build.key : undefined,
      species: ["bean", "spore", "pebble", "spring"].includes(build.key) ? undefined : build.key,
      mode: "fight", facing: index === 0 ? 1 : -1, animationStartedAt: 0, hurtStartedAt: -Infinity,
      combat: { version: 2, id: "simulation", side: index, cycleStartedAt: delay, nextAttackAt: delay,
        targetId: index === 0 ? "right" : "left", stunnedUntil: 0, stunImmuneUntil: 0, parryReadyAt: delay + rules.defensePreparation,
        blockReadyAt: delay + rules.defensePreparation, reactionReadyAt: delay + rules.defensePreparation, counterReadyAt: delay }, attack: null };
    states.set(id, { action: null, ordinal: 0, build });
    return agent;
  });

  function record(kind, source, target, damage, action, critical, duration) {
    const row = { index: history.length, time, kind, attackerId: source.id, targetId: target.id, damage,
      critical, counter: !!action?.counter, hitIndex: action?.index || 0, hitCount: action?.count || 1,
      leftHealth: agents[0].health, rightHealth: agents[1].health };
    if (duration !== undefined) row.stunDuration = duration;
    history.push(row);
    const event = { id: "simulation:" + row.index, kind, at: time, sourceId: source.id, targetId: target.id, damage };
    source.combat.lastEvent = event; target.combat.lastEvent = event;
    if (["dodge", "parry", "block", "stun"].includes(kind)) target.combat.lastReaction = event;
  }

  function end(who, why) {
    winner = who; reason = why;
    for (const agent of agents) { states.get(agent.id).action = null; agent.attack = null; }
  }

  function start(agent, at, counter) {
    const state = states.get(agent.id), stats = agent.stats;
    const count = counter ? 1 : stats.hitCount, windup = counter ? rules.counterWindup : stats.windup;
    const action = { ordinal: ++state.ordinal, startedAt: at, firstHitAt: at + windup, count, index: 0,
      counter, counterTriggered: false, stunApplied: false, endsAt: at + windup + (count - 1) * stats.hitGap + stats.recovery };
    state.action = action;
    agent.combat.cycleStartedAt = at;
    agent.combat.nextAttackAt = at + Math.max(stats.attackInterval, action.endsAt - at);
    agent.attack = { combatId: "simulation", startedAt: at, actionStartedAt: at, hitAt: action.firstHitAt, endsAt: action.endsAt,
      speed: 1, directionX: agent.facing, targetId: agent.combat.targetId, targetKind: "agent", counter,
      hitIndex: 0, hitCount: count, resolved: false, hit: false, heavy: false };
    agent.attackStartedAt = at; agent.animationStartedAt = at;
    agent.mode = agent.species === "spiny-back-beetle" ? "attack" : "fight";
    if (counter) record("counter", agent, agents.find(other => other !== agent), 0, action, false, undefined);
  }

  function roll(agent, action, channel) {
    return keyedRandom(seed, agent.id, action.ordinal, action.index, channel);
  }

  function evaluate(source, target, action) {
    const offense = source.stats, defense = target.stats, combat = target.combat;
    const ready = time >= combat.reactionReadyAt && time >= combat.stunnedUntil;
    let kind = "hit", multiplier = 1;
    if (ready && roll(source, action, "dodge") < defense.evasion * (1 - offense.accuracy)) { kind = "dodge"; multiplier = 0; }
    else if (ready && time >= combat.parryReadyAt && roll(source, action, "parry") < defense.parry) { kind = "parry"; multiplier = 0; }
    else if (ready && time >= combat.blockReadyAt && roll(source, action, "block") < defense.block) { kind = "block"; multiplier = 1 - defense.blockReduction; }
    const critical = multiplier > 0 && roll(source, action, "critical") < offense.critChance;
    const effectiveArmor = Math.max(0, defense.defense - offense.flatPenetration) * (1 - offense.armorPenetration);
    const reduction = rules.armorCap * effectiveArmor / (effectiveArmor + rules.armorKnee);
    const jitter = settings.random === false ? 1 : 1 + (roll(source, action, "damage") * 2 - 1) * rules.jitter;
    const power = offense.attackPower * (action.counter ? offense.counterMultiplier : action.index > 0 ? offense.followupMultiplier : 1);
    const damage = Math.min(target.health, power * (1 - reduction) * multiplier * (critical ? offense.critMultiplier : 1) * jitter);
    const canStun = damage > 0 && !action.stunApplied && time >= combat.stunImmuneUntil &&
      roll(source, action, "stun") < (action.counter ? offense.stunChance : offense.stunChancePerHit);
    const stunDuration = canStun ? offense.stunDuration * (1 - defense.tenacity) : 0;
    const counter = !action.counter && !action.counterTriggered && ["parry", "block"].includes(kind) &&
      time >= combat.counterReadyAt && defense.canAttack && roll(source, action, "counter") < defense.counter;
    return { source, target, action, kind, critical, damage, stunDuration, counter };
  }

  function nextEvent() {
    return Math.min(...agents.filter(agent => agent.health > 0).map(agent => {
      const state = states.get(agent.id), action = state.action;
      if (action) return action.index < action.count ? action.firstHitAt + action.index * agent.stats.hitGap : action.endsAt;
      return agent.stats.canAttack ? Math.max(agent.combat.nextAttackAt, agent.combat.stunnedUntil) : Infinity;
    }));
  }

  function process(at) {
    time = at;
    for (const agent of agents) {
      const state = states.get(agent.id), action = state.action;
      if (action && action.index >= action.count && action.endsAt <= time + 1e-9) {
        state.action = null; agent.attack = null;
        agent.mode = agent.species === "spiny-back-beetle" ? "idle" : "fight";
      }
    }
    for (const agent of agents) {
      const state = states.get(agent.id);
      if (agent.health > 0 && !state.action && agent.stats.canAttack && Math.max(agent.combat.nextAttackAt, agent.combat.stunnedUntil) <= time + 1e-9) start(agent, time, false);
    }
    const outcomes = agents.flatMap(source => {
      const action = states.get(source.id).action, target = agents.find(agent => agent !== source);
      return source.health > 0 && target.health > 0 && action && action.index < action.count &&
        action.firstHitAt + action.index * source.stats.hitGap <= time + 1e-9 ? [evaluate(source, target, action)] : [];
    });
    const oldHealth = agents.map(agent => agent.health);
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const incoming = outcomes.filter(hit => hit.target === agent).reduce((sum, hit) => sum + hit.damage, 0);
      const healing = outcomes.filter(hit => hit.source === agent).reduce((sum, hit) => sum + hit.damage * agent.stats.drain, 0);
      agent.health = Math.max(0, Math.min(agent.stats.health, oldHealth[i] - incoming + healing));
    }
    for (const hit of outcomes) {
      const { source, target, action } = hit;
      record(hit.kind, source, target, hit.damage, action, hit.critical, undefined);
      if (hit.damage > 0) { target.hurtStartedAt = time; target.hurtCount = (target.hurtCount || 0) + 1; }
      if (hit.kind !== "hit") {
        target.combat.reactionReadyAt = time + rules.reactionCooldown;
        target.combat.parryReadyAt = target.combat.reactionReadyAt;
        target.combat.blockReadyAt = target.combat.reactionReadyAt;
      }
      action.index++;
      if (source.attack && states.get(source.id).action === action) {
        source.attack.hit = true; source.attack.hitIndex = action.index - 1;
        source.attack.resolved = action.index >= action.count;
        if (!source.attack.resolved) {
          source.attack.startedAt = time;
          source.attack.hitAt = action.firstHitAt + action.index * source.stats.hitGap;
          source.attack.hitIndex = action.index;
        }
      }
    }
    for (const hit of outcomes) {
      const { source, target, action } = hit;
      if (target.health > 0 && hit.stunDuration > 0) {
        action.stunApplied = true;
        target.combat.stunnedUntil = time + hit.stunDuration;
        target.combat.stunImmuneUntil = target.combat.stunnedUntil + rules.stunImmunity;
        target.combat.nextAttackAt = Math.max(target.combat.nextAttackAt, target.combat.stunnedUntil);
        states.get(target.id).action = null; target.attack = null;
        record("stun", source, target, 0, { ...action, index: action.index - 1 }, false, hit.stunDuration);
      }
    }
    for (const hit of outcomes) {
      if (hit.counter && hit.target.health > 0 && hit.source.health > 0 && time >= hit.target.combat.stunnedUntil) {
        hit.action.counterTriggered = true;
        hit.target.combat.counterReadyAt = time + rules.counterCooldown;
        start(hit.target, time, true);
      }
    }
    for (const agent of agents) if (agent.health <= 0 && oldHealth[agents.indexOf(agent)] > 0) {
      states.get(agent.id).action = null; agent.attack = null;
      agent.deathStartedAt = time; agent.diedAt = time; agent.mode = "death";
      record("death", agents.find(other => other !== agent), agent, 0, null, false, undefined);
    }
    if (agents.some(agent => agent.health <= 0)) end(agents.every(agent => agent.health <= 0) ? "draw" : agents[0].health > 0 ? "left" : "right", "death");
    eventCount++;
    if (!reason && eventCount >= rules.maxEvents) end("draw", "event-limit");
  }

  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("advance seconds must be finite and nonnegative");
    if (reason) return result();
    const until = Math.min(rules.maxSeconds, time + seconds);
    while (!reason) {
      const at = nextEvent();
      if (!Number.isFinite(at)) { end("draw", "no-offense"); break; }
      if (at > until) break;
      process(at);
    }
    if (!reason) {
      time = until;
      if (time >= rules.maxSeconds) end("draw", "time-limit");
    }
    return result();
  }

  function step() {
    if (reason) return result();
    const startIndex = history.length;
    while (!reason && history.length === startIndex) {
      const at = nextEvent();
      if (!Number.isFinite(at)) { end("draw", "no-offense"); break; }
      if (at > rules.maxSeconds) { time = rules.maxSeconds; end("draw", "time-limit"); break; }
      process(at);
    }
    return result();
  }

  function finish() {
    return advance(rules.maxSeconds - time);
  }

  function result() {
    return { winner, reason, time, leftHealth: agents[0].health, rightHealth: agents[1].health };
  }

  return { agents, history, advance, step, finish, result, get time() { return time; }, get reason() { return reason; } };
}
