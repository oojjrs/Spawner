export const BEETLE_ANIMATION_ASSET = "DesignAssets/Animations/Beetle/atlas.webp";
export const BEETLE_NEUTRAL_ASSET = "DesignAssets/Animations/Beetle/neutral.webp";
export const BEETLE_SPRITE = Object.freeze({ frameSize: 512, columns: 5, pivotX: 265, pivotY: 450, scale: 1.6 });
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
      10,
      11,
      12,
      13,
      14,
      10
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
      470,
      80,
      80
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
  if (agent.health <= 0 || agent.mode === "death") {
    startedAt = agent.deathStartedAt ?? startedAt;
    action = (time - startedAt) * 1000 + 1e-6 < BEETLE_ANIMATIONS.death.durationMs ? "death" : "dead";
  } else if (Number.isFinite(agent.hurtStartedAt) && time >= agent.hurtStartedAt &&
      (time - agent.hurtStartedAt) * 1000 + 1e-6 < BEETLE_ANIMATIONS.hurt.durationMs) {
    action = "hurt";
    startedAt = agent.hurtStartedAt;
  } else if (agent.mode === "attack" && (time - agent.attackStartedAt) * 1000 + 1e-6 < BEETLE_ANIMATIONS.attack.durationMs) {
    action = "attack";
    startedAt = agent.attackStartedAt;
  } else if (agent.mode === "walk" && time < agent.moveStartedAt + agent.moveDuration) {
    action = "walk";
    startedAt = agent.moveStartedAt;
  } else if (agent.mode === "walk") startedAt = agent.moveStartedAt + agent.moveDuration;
  return { action, frame: beetleAnimationFrame(action, (time - startedAt) * 1000) };
}
