import { attackAnimationElapsed } from "./attack.mjs";
import { imageAnimation } from "../client/image-geometry.mjs";

export const BEETLE_ANIMATION_ASSET = "DesignAssets/Animations/Beetle/atlas.webp";
export const BEETLE_ATTACK_ASSET = "DesignAssets/Animations/Beetle/attack-right.webp";
export const BEETLE_ATTACK_SPRITE = Object.freeze(imageAnimation({ image: BEETLE_ATTACK_ASSET, frameSize: 512, columns: 5, pivotX: 247, pivotY: 450, scale: 1.6, facing: "right" }));
export const BEETLE_NEUTRAL_ASSET = "DesignAssets/Animations/Beetle/neutral.webp";
export const BEETLE_SPRITE = Object.freeze(imageAnimation({ image: BEETLE_ANIMATION_ASSET, frameSize: 512, columns: 5, pivotX: 265, pivotY: 450, scale: 1.6 }));
export const BEETLE_ANIMATIONS = {
  "idle": {
    "frames": [
      0,
      1,
      2,
      3,
      0
    ],
    "durations": [
      600,
      320,
      400,
      320,
      360
    ],
    "durationMs": 2000,
    "loop": true
  },
  "walk": {
    "frames": [
      4,
      5,
      6,
      7,
      8,
      9,
      4,
      5,
      6,
      7,
      8,
      9
    ],
    "durations": [
      120,
      80,
      120,
      120,
      80,
      120,
      120,
      80,
      120,
      120,
      80,
      120
    ],
    "durationMs": 1280,
    "loop": true
  },
  "attack": {
    "frames": [
      0,
      1,
      2,
      3,
      4,
      0
    ],
    "durations": [
      80,
      160,
      280,
      440,
      160,
      160
    ],
    "durationMs": 1280,
    "loop": false,
    "hitTimeMs": 520
  },
  "hurt": {
    "frames": [
      10,
      15,
      16,
      10
    ],
    "durations": [
      40,
      480,
      80,
      70
    ],
    "durationMs": 670,
    "loop": false
  },
  "death": {
    "frames": [
      0,
      17,
      18
    ],
    "durations": [
      80,
      120,
      520
    ],
    "durationMs": 720,
    "loop": false
  },
  "dead": {
    "frames": [
      18
    ],
    "durations": [
      0
    ],
    "durationMs": 0,
    "loop": false
  }
};

export function beetleAnimationFrame(action, elapsedMs) {
  const animation = BEETLE_ANIMATIONS[action];
  if (animation.durationMs === 0) return animation.frames[0];
  let elapsed = Math.max(0, elapsedMs);
  if (animation.loop) elapsed %= animation.durationMs;
  else if (elapsed >= animation.durationMs) return animation.frames.at(-1);
  let end = 0;
  for (let index = 0; index < animation.frames.length; index++) {
    end += animation.durations[index];
    if (elapsed + 1e-6 < end) return animation.frames[index];
  }
  return animation.frames.at(-1);
}

export function beetleAnimationPose(agent, time) {
  let action = "idle", startedAt = agent.animationStartedAt || 0;
  const rpg = agent.combat?.version === 2;
  if (rpg && agent.health > 0 && agent.attack) {
    const attack = BEETLE_ANIMATIONS.attack;
    const elapsed = attackAnimationElapsed(agent.attack, time, attack.hitTimeMs / 1000, attack.durationMs / 1000) * 1000;
    if (elapsed >= 0 && elapsed + 1e-6 < attack.durationMs) return { action: "attack", frame: beetleAnimationFrame("attack", elapsed) };
  }
  if (agent.health <= 0 || agent.mode === "death") {
    startedAt = agent.deathStartedAt ?? startedAt;
    action = (time - startedAt) * 1000 + 1e-6 < BEETLE_ANIMATIONS.death.durationMs ? "death" : "dead";
  } else if (Number.isFinite(agent.hurtStartedAt) && time >= agent.hurtStartedAt &&
      (time - agent.hurtStartedAt) * 1000 + 1e-6 < (rpg ? 120 : BEETLE_ANIMATIONS.hurt.durationMs)) {
    action = "hurt";
    startedAt = agent.hurtStartedAt;
  } else if (!rpg && agent.mode === "attack" && (time - agent.attackStartedAt) * 1000 + 1e-6 < BEETLE_ANIMATIONS.attack.durationMs) {
    action = "attack";
    startedAt = agent.attackStartedAt;
  } else if (agent.mode === "walk" && agent.moveDuration > 0 &&
      time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration) {
    // The authored walk strip covers one cell (two gait cycles). Play the
    // whole strip over that cell, including when terrain changes its duration.
    const progress = (time - agent.moveStartedAt) / agent.moveDuration;
    return { action: "walk", frame: beetleAnimationFrame("walk", progress * BEETLE_ANIMATIONS.walk.durationMs) };
  } else if (agent.mode === "walk") startedAt = agent.moveStartedAt + agent.moveDuration;
  return { action, frame: beetleAnimationFrame(action, (time - startedAt) * 1000 *
    (rpg && action === "hurt" ? BEETLE_ANIMATIONS.hurt.durationMs / 120 : 1)) };
}
