import { DNA_ACTION_RULES } from "./dna-actions.mjs";

const melee = { role: "melee", melee: true, ranged: false };
const hybrid = { role: "hybrid", melee: true, ranged: true };
export const CREATURE_ATTACK_ROLES = Object.freeze(Object.fromEntries([
  ["flower-tail-bird", { role: "ranged", melee: true, ranged: true }],
  ["dew-rabbit", melee], ["soil-mole", hybrid], ["bundle-snail", melee],
  ["cotton-sheep", melee], ["rolling-acorn", melee], ["bubble-toad", hybrid],
  ["snare-vine", melee], ["spiny-back-beetle", hybrid], ["soil-boar", melee],
  ["vine-turtle", hybrid], ["shadow-weasel", melee], ["talon-owl", melee],
  ["spring-keeper", melee], ["lantern-keeper", { role: "ranged", melee: false, ranged: true }],
  ["old-garden-snail", melee], ["walking-forest", melee], ["white-paw", melee],
  ["spiny-back-leader", hybrid]
].map(([key, value]) => [key, Object.freeze({ ...value,
  position: ["bundle-snail", "rolling-acorn", "spiny-back-beetle", "soil-boar", "vine-turtle", "old-garden-snail", "walking-forest", "spiny-back-leader"].includes(key) ? "front" :
    ["flower-tail-bird", "soil-mole", "bubble-toad", "lantern-keeper"].includes(key) ? "back" : "middle" })])));

export function creatureAttackRole(species) {
  return CREATURE_ATTACK_ROLES[species] || null;
}

export function creatureAttackMode(agent, separation) {
  const role = creatureAttackRole(agent.species);
  if (!role || !Number.isFinite(separation) || separation < 0) return null;
  if (role.melee && separation <= DNA_ACTION_RULES.meleeRange) return "melee";
  if (role.ranged && separation <= DNA_ACTION_RULES.rangedRange) return "ranged";
  return null;
}
