import { combatProfile, unitCombatStats } from "./combat-stats.mjs";

// First-raid calibration uses modest, non-optimized level-two DNA defenders.
// These are initial balance targets, not a claim of full-game balance validation.
export const RAID_COMBAT_STAGES = Object.freeze([
  Object.freeze({ at:300, health:.2, damage:.1 }),
  Object.freeze({ at:480, health:.3, damage:.15 }),
  Object.freeze({ at:720, health:.5, damage:.3 }),
  Object.freeze({ at:1080, health:.75, damage:.6 }),
  Object.freeze({ at:1500, health:1, damage:1 })
]);

export function raidCombatStage(seconds) {
  return Math.max(0, RAID_COMBAT_STAGES.findLastIndex(stage => seconds >= stage.at));
}

export function applyRaidCombatScale(agent, departedAt) {
  if (agent.species !== "spiny-back-beetle") return false;
  let marker = agent.raidCombatScale;
  if (departedAt !== undefined) {
    if (!Number.isFinite(departedAt) || departedAt < 0) throw new Error("습격 전투 단계 시간이 올바르지 않습니다.");
    marker = { version:1, stage:raidCombatStage(departedAt) };
  }
  if (!marker) return false;
  if (marker.version !== 1 || !Number.isInteger(marker.stage) || !RAID_COMBAT_STAGES[marker.stage])
    throw new Error("습격 전투 단계 저장 형식이 올바르지 않습니다.");
  const stage = RAID_COMBAT_STAGES[marker.stage], base = unitCombatStats(agent.species);
  const previousMaximum = Number.isFinite(agent.stats?.health) && agent.stats.health > 0 ? agent.stats.health : base.health;
  const fraction = Math.max(0, Math.min(1, agent.health / previousMaximum));
  // Never derive from the already-scaled saved attackPower: restore is idempotent.
  const profile = combatProfile({ species:agent.species, attributes:agent.attributes, stats:base });
  agent.stats = { ...agent.stats, health:base.health * stage.health, combatStrength:base.combatStrength,
    attackPower:profile.attackPower * stage.damage, attack:3 * stage.damage };
  agent.health = agent.stats.health * fraction;
  agent.raidCombatScale = { ...marker };
  return true;
}
