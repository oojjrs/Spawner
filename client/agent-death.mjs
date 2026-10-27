import { imageAnimation } from "./image-geometry.mjs";
import { UNIT_ANIMATIONS, unitAnimationFrame } from "./unit-animation.mjs";

export const AGENT_DEATH_ANIMATION = Object.freeze(imageAnimation({
  image: "DesignAssets/Tribes/sprout/AnimationStudies/death-v1/death-runtime.webp",
  frameSize: 256, columns: 4, frameCount: 16, pivotX: 128, pivotY: 210,
  durationsMs: Object.freeze([160, 80, 80, 70, 70, 60, 60, 60, 60, 60, 80, 90, 100, 110, 120, 1000])
}));

export const AGENT_DEATH_ANIMATIONS = Object.freeze({
  bean: AGENT_DEATH_ANIMATION,
  ...Object.fromEntries(["spore", "pebble", "spring"].map(tribe => [tribe, UNIT_ANIMATIONS[tribe].death]))
});

export function agentDeathAnimation(corpse) {
  return corpse.kind === "corpse" && !corpse.species ? AGENT_DEATH_ANIMATIONS[corpse.tribe || "bean"] || null : null;
}

export function agentDeathFrame(corpse, time) {
  const animation = agentDeathAnimation(corpse);
  if (!animation) return -1;
  if (animation !== AGENT_DEATH_ANIMATION) return unitAnimationFrame(animation, (time - corpse.diedAt) * 1000);
  const elapsed = Math.max(0, (time - corpse.diedAt) * 1000);
  let end = 0;
  for (let index = 0; index < AGENT_DEATH_ANIMATION.durationsMs.length; index++) {
    end += AGENT_DEATH_ANIMATION.durationsMs[index];
    if (elapsed + 1e-6 < end) return index;
  }
  return AGENT_DEATH_ANIMATION.frameCount - 1;
}
