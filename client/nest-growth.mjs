export const NEST_GROWTH_ANIMATIONS = Object.freeze(Object.fromEntries(
  [["bean", "sprout", "NestGrowthV3"], ["spore", "spore", "NestGrowthV3"],
    ["pebble", "pebble", "NestGrowthV3"], ["spring", "spring", "NestGrowthV3"]].map(([tribe, art, audio]) =>
    [tribe, Object.freeze({
      image: tribe === "spore" ? "DesignAssets/Animations/Nests/Growth01To02-QuantumV1/spore/growth.png" : "DesignAssets/Animations/Nests/Growth01To02-v3/" + art + "/growth.png",
      resting: tribe === "spore" ? "DesignAssets/Animations/Nests/SporeLevel02-v4/References/level-02.png" : "DesignAssets/Animations/Nests/Growth01To02-v3/" + art + "/level-02.png",
      levels: Object.freeze({ ...(tribe === "bean" ? { 3: "DesignAssets/Animations/Nests/Idle03-v1/sprout/keypose.png" } : {}), ...(tribe === "spring" ? { 3: "DesignAssets/Animations/Nests/Idle03-v2/spring/keypose.png" } : {}),
        ...(tribe === "spore" ? { 3: "DesignAssets/Animations/Nests/Idle03-v1/spore/poster.png" } : {}),
        ...(tribe === "pebble" ? { 3: "DesignAssets/Animations/Nests/Growth02To03-v4/pebble/level-03.png" } : {}),
        4: tribe === "bean" ? "DesignAssets/Animations/Nests/Idle04-v2/sprout/keypose.png" : tribe === "spring" ? "DesignAssets/Animations/Nests/Idle04-v2/spring/keypose.png" : tribe === "spore" ? "DesignAssets/Animations/Nests/Idle04-v1/spore/poster.png" : "DesignAssets/Nests/Level04-Civilization-v1/Runtime/" + art + ".png" }),
      idle: Object.freeze({ image: tribe === "spore" ? "DesignAssets/Animations/Nests/SporeLevel02-v4/Idle/idle.webp" : "DesignAssets/Animations/Nests/" + (tribe === "bean" ? "Idle02-v1/" : "Idle02-v2/") + art + "/idle.webp",
        frameSize: 512, columns: tribe === "bean" ? 8 : 10, frameCount: tribe === "bean" ? 64 : 80,
        frameMs: tribe === "bean" ? 62.5 : 50, restMs: tribe === "pebble" ? 2000 : 0 }),
      levelIdles: Object.freeze(tribe === "bean" ? {
        3: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle03-v1/sprout/idle-sheet.webp",
          frameSize: 512, columns: 8, frameCount: 120, frameMs: 1000 / 30, restMs: 0 }),
        4: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle04-v2/sprout/idle-sheet.webp",
          frameSize: 512, columns: 8, frameCount: 120, frameMs: 1000 / 30, restMs: 0 })
      } : tribe === "spring" ? {
        3: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle03-v2/spring/idle-sheet.webp",
          frameSize: 512, columns: 12, frameCount: 120, frameMs: 1000 / 30, restMs: 0 }),
        4: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle04-v2/spring/idle-sheet.webp",
          frameSize: 512, columns: 12, frameCount: 120, frameMs: 1000 / 30, restMs: 0 })
      } : tribe === "spore" ? {
        3: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle03-v1/spore/idle-sheet.webp", frameSize: 512, columns: 10,
          frameCount: 80, frameMs: 50, restMs: 0 }),
        4: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle04-v1/spore/idle-sheet.webp", frameSize: 512, columns: 10,
          frameCount: 80, frameMs: 50, restMs: 0 })
      } : tribe === "pebble" ? {
        3: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle03-v1/pebble/idle-sheet.webp",
          frameSize: 512, columns: 8, frameCount: 69, frameMs: 50, restMs: 0, periodMs: 6000,
          durationsMs: Object.freeze([2050,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,250,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,400]) }),
        4: Object.freeze({ image: "DesignAssets/Animations/Nests/Idle04-v1/pebble/idle-sheet.webp",
          frameSize: 512, columns: 10, frameCount: 80, frameMs: 50, restMs: 0 })
      } : {}),
      upgrades: Object.freeze(tribe === "bean" ? {
        3: Object.freeze({ fromLevel: 2, image: "DesignAssets/Animations/Nests/Growth02To03-v5/sprout/growth.png",
          duration: 5.45, frameMs: 50, firstFrameMs: 50, frameSize: 512, columns: 8, frameCount: 109,
          sound: null, soundAt: 0 })
      } : tribe === "pebble" ? {
        3: Object.freeze({ fromLevel: 2, image: "DesignAssets/Animations/Nests/Growth02To03-v4/pebble/growth.png",
          duration: 6.32, frameMs: 40, firstFrameMs: 600, frameSize: 512, columns: 8, frameCount: 120,
          sound: null, soundAt: 0 }),
        4: Object.freeze({ fromLevel: 3, image: "DesignAssets/Animations/Nests/Growth03To04-v5/pebble/Runtime/growth.png",
          duration: 6.32, frameMs: 40, firstFrameMs: 40, frameSize: 512, columns: 8, frameCount: 142,
          sound: null, soundAt: 0 })
      } : tribe === "spring" ? {
        3: Object.freeze({ fromLevel: 2, image: "DesignAssets/Animations/Nests/Growth02To03-v4/spring/growth.png",
          duration: 5, frameMs: 50, firstFrameMs: 500, frameSize: 512, columns: 8, frameCount: 64,
          sound: null, soundAt: 0 }),
        4: Object.freeze({ fromLevel: 3, image: "DesignAssets/Animations/Nests/Growth03To04-TierStackV1/spring/growth.png",
          duration: 4, frameMs: 40, firstFrameMs: 400, frameSize: 512, columns: 8, frameCount: 64,
          sound: null, soundAt: 0 })
      } : tribe === "spore" ? {
        4: Object.freeze({ fromLevel: 3, image: "DesignAssets/Animations/Nests/Growth03To04-v5/spore/growth.png",
          duration: 1.78, frameMs: 20, firstFrameMs: 200, frameSize: 512, columns: 8, frameCount: 41,
          sound: null, soundAt: 0 }),
        3: Object.freeze({ fromLevel: 2, image: "DesignAssets/Animations/Nests/Growth02To03-PopV1/spore/growth.png",
          duration: 3.25, frameMs: 1000 / 24, firstFrameMs: 1000 / 24, frameSize: 512, columns: 10, frameCount: 78,
          sound: null, soundAt: 0 })
      } : {}),
      sound: "nest-growth-" + tribe,
      audio: "DesignAssets/Audio/" + audio + "/" + art + ".mp3",
      duration: 6.32, soundAt: .6, frameMs: 80, frameSize: 512, columns: 8, frameCount: 61,
      ...(tribe === "spore" ? { duration: 6.2, firstFrameMs: 50, frameMs: 50, columns: 12, frameCount: 124 } : {})
    })])));

export const NEST_GROWTH_ASSETS = Object.freeze(Object.values(NEST_GROWTH_ANIMATIONS)
  .flatMap(animation => [animation.image, animation.resting, animation.idle.image, ...Object.values(animation.levels),
    ...Object.values(animation.levelIdles).map(idle => idle.image),
    ...Object.values(animation.upgrades).map(upgrade => upgrade.image)]));

export function nestGrowthAnimation(tribe, fromLevel, toLevel) {
  const definition = NEST_GROWTH_ANIMATIONS[tribe];
  if (fromLevel === 1 && toLevel === 2) return definition;
  const animation = definition?.upgrades?.[toLevel];
  return animation?.fromLevel === fromLevel ? animation : null;
}

export function createNestGrowthPlayback() {
  return { levels: new Map(), effects: new Map() };
}

export function syncNestGrowthPlayback(playback, colonies, time, firstSnapshot) {
  if (firstSnapshot) {
    playback.levels.clear();
    playback.effects.clear();
  }
  const present = new Set();
  for (const colony of colonies) {
    const tribe = colony.tribe || "bean", level = colony.nestLevel || 1;
    present.add(colony.id);
    const previous = playback.levels.get(colony.id);
    const growth = !firstSnapshot && previous?.tribe === tribe && colony.nestHealth !== 0 &&
      nestGrowthAnimation(tribe, previous.level, level);
    const idleStartedAt = previous?.tribe === tribe && previous.level === level && time >= previous.updatedAt ?
      previous.idleStartedAt : time + (growth ? growth.duration : 0);
    playback.levels.set(colony.id, { tribe, level, idleStartedAt, updatedAt: time });
    if (firstSnapshot || !previous || previous.tribe !== tribe || colony.nestHealth === 0) {
      playback.effects.delete(colony.id);
      continue;
    }
    if (growth) {
      playback.effects.set(colony.id, { colony, tribe, level, animation: growth, startedAt: time, soundPlayed: false });
    }
    const effect = playback.effects.get(colony.id);
    if (effect) {
      effect.colony = colony;
      if (level !== effect.level || time < effect.startedAt || time - effect.startedAt >= effect.animation.duration) {
        playback.effects.delete(colony.id);
      }
    }
  }
  for (const id of playback.levels.keys()) if (!present.has(id)) playback.levels.delete(id);
  for (const id of playback.effects.keys()) if (!present.has(id)) playback.effects.delete(id);
}

export function nestGrowthFrame(playback, colony, time, reducedMotion) {
  const effect = playback.effects.get(colony.id);
  if (!effect || colony.nestHealth === 0) return null;
  const animation = effect.animation;
  const elapsed = time - effect.startedAt;
  if (elapsed < 0 || elapsed >= animation.duration) return null;
  if (reducedMotion) return elapsed < animation.duration / 2 ? 0 : animation.frameCount - 1;
  const firstFrameMs = animation.firstFrameMs ?? animation.soundAt * 1000;
  return elapsed * 1000 + 1e-7 < firstFrameMs ? 0 : Math.min(animation.frameCount - 1,
    1 + Math.floor((elapsed * 1000 - firstFrameMs) / animation.frameMs + 1e-7));
}

export function nestGrowthSounds(playback, time) {
  const events = [];
  for (const effect of playback.effects.values()) {
    const animation = effect.animation;
    const elapsed = time - effect.startedAt - animation.soundAt;
    if (!animation.sound || effect.soundPlayed || elapsed < -1e-7) continue;
    effect.soundPlayed = true;
    if (elapsed <= .35 && effect.colony.nestHealth !== 0) events.push({ name: animation.sound, colony: effect.colony });
  }
  return events;
}

export function nestIdleAnimation(tribe, level) {
  const definition = NEST_GROWTH_ANIMATIONS[tribe];
  return level === 2 ? definition?.idle : definition?.levelIdles?.[level];
}

export function nestIdleFrame(playback, colony, time, reducedMotion) {
  const animation = nestIdleAnimation(colony.tribe || "bean", colony.nestLevel);
  if (!animation) return null;
  if (reducedMotion || colony.nestHealth === 0) return 0;
  const startedAt = playback.levels.get(colony.id)?.idleStartedAt ?? time;
  const elapsed = Math.max(0, time - startedAt) * 1000;
  if (animation.durationsMs) {
    let position = (elapsed + 1e-7) % animation.periodMs;
    for (let frame = 0; frame < animation.frameCount; frame++) {
      if (position < animation.durationsMs[frame]) return frame;
      position -= animation.durationsMs[frame];
    }
    return animation.frameCount - 1;
  }
  const position = (elapsed + 1e-7) % (animation.restMs + animation.frameMs * animation.frameCount);
  if (position < animation.restMs) return 0;
  return Math.min(animation.frameCount - 1, Math.floor((position - animation.restMs) / animation.frameMs));
}
