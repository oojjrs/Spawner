export const AGENT_ATTACK_FRAME_DURATIONS = Object.freeze([
  .06, .07, .06, .08, .03, .05, .05, .05, .05, .05, .05, .07, .08, .09, .10, .06
]);

export const AGENT_ATTACK_HIT_FRAME = 5;
export const AGENT_ATTACK_HIT_TIME = AGENT_ATTACK_FRAME_DURATIONS.slice(0, AGENT_ATTACK_HIT_FRAME).reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;
export const AGENT_ATTACK_DURATION = AGENT_ATTACK_FRAME_DURATIONS.reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;
export const AGENT_ATTACK_ASSET = "DesignAssets/Animations/UnitAttack/attack.png";

export function agentAttackFrame(attack, time) {
  if (!attack) return -1;
  const elapsed = (time - attack.startedAt) * attack.speed;
  if (elapsed < 0 || elapsed + 1e-8 >= AGENT_ATTACK_DURATION) return -1;
  let end = 0;
  for (let index = 0; index < AGENT_ATTACK_FRAME_DURATIONS.length; index++) {
    end += AGENT_ATTACK_FRAME_DURATIONS[index];
    if (elapsed + 1e-8 < end) return index;
  }
  return -1;
}
