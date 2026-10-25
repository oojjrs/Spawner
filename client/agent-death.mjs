export const AGENT_DEATH_ANIMATION = Object.freeze({
  image: "DesignAssets/Tribes/sprout/AnimationStudies/death-v1/death-runtime.webp",
  frameSize: 256, columns: 4, frameCount: 16, pivotX: 128, pivotY: 210, scale: 1.02,
  durationsMs: Object.freeze([160, 80, 80, 70, 70, 60, 60, 60, 60, 60, 80, 90, 100, 110, 120, 1000])
});

export function agentDeathFrame(corpse, time) {
  if (corpse.kind !== "corpse" || corpse.species || corpse.tribe && corpse.tribe !== "bean") return -1;
  const elapsed = Math.max(0, (time - corpse.diedAt) * 1000);
  let end = 0;
  for (let index = 0; index < AGENT_DEATH_ANIMATION.durationsMs.length; index++) {
    end += AGENT_DEATH_ANIMATION.durationsMs[index];
    if (elapsed + 1e-6 < end) return index;
  }
  return AGENT_DEATH_ANIMATION.frameCount - 1;
}
