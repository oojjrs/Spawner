import { migrateCombatStats } from "./combat-stats.mjs";

export const RAID_CREATURE_STAGES = Object.freeze([
  { at:300, species:"soil-mole", name:"흙두더지" },
  { at:480, species:"spiny-back-beetle", name:"가시등벌레" },
  { at:720, species:"soil-boar", name:"흙멧돼지" }
].map(stage => Object.freeze(stage)));

export function prepareRaidCreature(agent, departedAt, maximumStage) {
  if (!Number.isFinite(departedAt) || departedAt < 0) throw new Error("습격 전투 단계 시간이 올바르지 않습니다.");
  const scheduled = Math.max(0, RAID_CREATURE_STAGES.findLastIndex(entry => departedAt >= entry.at));
  const stage = Number.isInteger(maximumStage) ? Math.min(scheduled, Math.max(0, maximumStage)) : scheduled;
  agent.species = RAID_CREATURE_STAGES[stage].species;
  migrateCombatStats(agent);
  delete agent.raidCombatScale;
  agent.name = RAID_CREATURE_STAGES[stage].name;
  agent.faction = "hostile";
  agent.combatDisposition = "aggressive";
  return stage;
}
