import { AGENT_HURT_FRAME_DURATIONS } from "../server/attack.mjs";

export const PLAYER_COMBAT_ANIMATIONS = Object.freeze([
  { tribe: "bean", attack: "DesignAssets/Animations/UnitAttack/attack.png",
    hurt: "DesignAssets/Animations/UnitHurt/V3/hurt.png" },
  ...["spore", "pebble", "spring"].map(tribe => ({ tribe,
    attack: `DesignAssets/Tribes/${tribe}/AnimationStudies/attack-directions-v3/right/attack.webp`,
    hurt: `DesignAssets/Tribes/${tribe}/AnimationStudies/hurt-v2/hurt-v2.webp` }))
]);

export const PLAYER_COMBAT_ASSETS = Object.freeze(PLAYER_COMBAT_ANIMATIONS.flatMap(animation => [animation.attack, animation.hurt]));

export function combatHurtFrame(agent, time) {
  if (!Number.isFinite(agent.hurtStartedAt)) return -1;
  const elapsed = time - agent.hurtStartedAt;
  if (elapsed < 0) return -1;
  let end = 0;
  for (let frame = 0; frame < AGENT_HURT_FRAME_DURATIONS.length; frame++) {
    end += AGENT_HURT_FRAME_DURATIONS[frame];
    if (elapsed + 1e-8 < end) return frame;
  }
  return -1;
}

export function combatLayout(agents) {
  const combats = new Map(), placements = new Map();
  for (const agent of agents) {
    if (!agent.combat || agent.health <= 0) continue;
    if (!combats.has(agent.combat.id)) combats.set(agent.combat.id, [[], []]);
    combats.get(agent.combat.id)[agent.combat.side].push(agent);
  }
  for (const sides of combats.values()) for (let side = 0; side < 2; side++) {
    const units = sides[side].toSorted((a, b) => a.combat.joinedAt - b.combat.joinedAt || String(a.id).localeCompare(String(b.id)));
    for (let index = 0; index < units.length; index++) {
      const agent = units[index], size = agent.species === "spiny-back-beetle" ? 1.6 : agent.species ? 1.4 : .7;
      placements.set(String(agent.id), { x: side === 0 ? .25 : -.25, y: (index + .5) / units.length - .5,
        scale: Math.min(.44 / size, .86 / (units.length * size)), facing: side === 0 ? -1 : 1 });
    }
  }
  return placements;
}
