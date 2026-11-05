import { createCombat } from "../server/combat.mjs";
import { UNIT_COMBAT_STATS } from "../server/combat-stats.mjs";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";

export const COMBAT_LAB_UNITS = Object.freeze(Object.entries(UNIT_COMBAT_STATS).map(([key, stats]) => {
  const tribe = PLAYER_TRIBES.find(entry => entry.key === key);
  const creature = ENCOUNTER_TYPES.find(entry => entry.key === key);
  return Object.freeze({ key, ...stats, name: tribe?.name || creature?.name || "가시등 딱정벌레",
    group: tribe ? "4종족" : creature?.unique ? "유니크" : "일반 생물", image: creature?.image });
}));

export function createCombatTrial(settings) {
  let seed = Number(settings.seed) >>> 0;
  function random() {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
  const agents = [settings.left, settings.right].map((selection, side) => {
    const profile = COMBAT_LAB_UNITS.find(entry => entry.key === selection.key);
    if (!profile) throw new Error("유닛을 선택해 주세요.");
    const strength = Number(selection.combatStrength), health = Number(selection.health);
    if (!Number.isFinite(strength) || strength < 0 || strength > 100 ||
        !Number.isFinite(health) || health < 1 || health > profile.health) throw new Error("수치를 확인해 주세요.");
    return { id: side === 0 ? "left" : "right", ownerId: side === 0 ? "left" : "right",
      tribe: PLAYER_TRIBES.some(entry => entry.key === profile.key) ? profile.key : undefined,
      species: PLAYER_TRIBES.some(entry => entry.key === profile.key) ? undefined : profile.key,
      name: profile.name, key: profile.key, x: 100, y: 100, renderFromX: 100, renderFromY: 100,
      moveStartedAt: 0, moveDuration: 0, health, attributes: {}, stats: { health: profile.health, combatStrength: strength, attackPower: 12 + strength * .35, defense: 8 + strength * .4, speed: 1 },
      combatDisposition: "aggressive", mode: "fight", animationStartedAt: 0 };
  });
  const history = [];
  const terrain = new Uint8Array(320 * 320);
  terrain[100 * 320 + 100] = 4;
  const environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain },
    damageRandom: settings.random ? random : () => .5 };
  for (const agent of agents) environment.games.set(agent.ownerId, {
    agents: [agent], receiveDamage(target, damage) {
      target.health = Math.max(0, target.health - damage);
      target.hurtStartedAt = environment.simSeconds;
      target.hurtCount = (target.hurtCount || 0) + 1;
      const attacker = agents.find(agent => agent.id !== target.id);
      history.push({ index: history.length + 1, time: attacker.attack.hitAt,
        leftStrength: agents[0].stats.combatStrength, rightStrength: agents[1].stats.combatStrength,
        attackerId: attacker.id, counter: attacker.attack.counter,
        leftDamage: target.id === "left" ? damage : 0, rightDamage: target.id === "right" ? damage : 0,
        leftHealth: agents[0].health, rightHealth: agents[1].health });
    }
  });
  const combat = createCombat(environment);
  const first = settings.first === "right" ? 1 : 0;
  // The lab deliberately allows matchups that wild creatures cannot start in the world.
  // Hide only the initiator's species during enrollment, then restore it before any
  // attack so creature stats and animation timing still use the real species.
  const initiator = agents[first], species = initiator.species;
  try {
    initiator.species = undefined;
    if (!combat.engage(initiator, agents[1 - first], 0)) throw new Error("대결을 시작할 수 없습니다.");
  } finally {
    initiator.species = species;
  }
  agents[1 - first].combat.nextAttackAt = .05;
  function result() {
    if (agents.every(agent => agent.health > 0)) return null;
    if (agents.every(agent => agent.health <= 0)) return "draw";
    return agents.find(agent => agent.health > 0).id;
  }
  function tick(time) {
    if (result()) return;
    environment.simSeconds = time;
    for (const agent of agents) if (agent.health > 0) combat.update(agent, time);
  }

  function advance(seconds) {
    const end = environment.simSeconds + seconds;
    while (!result() && environment.simSeconds < end) tick(Math.min(end, environment.simSeconds + 1 / 60));
  }
  function step() {
    const count = history.length;
    for (let attempt = 0; attempt < 20 && !result() && history.length === count; attempt++) {
      const events = agents.filter(agent => agent.health > 0 && agent.combat).map(agent => agent.attack ?
        agent.attack.resolved ? agent.attack.endsAt : agent.attack.hitAt :
        Math.max(agent.combat.nextAttackAt, agent.combat.stunnedUntil));
      const next = Math.min(...events.filter(Number.isFinite));
      if (!Number.isFinite(next)) break;
      tick(Math.max(environment.simSeconds + .000001, next));
    }
    return history.at(-1);
  }
  function finish() {
    for (let attempt = 0; attempt < 200 && !result(); attempt++) step();
    return result();
  }
  tick(0);
  return { agents, history, advance, step, finish, result, get time() { return environment.simSeconds; } };
}
