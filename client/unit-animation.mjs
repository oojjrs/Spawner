import { imageAnimation } from "./image-geometry.mjs";

export const UNIT_ANIMATIONS = Object.freeze({
  "bean": {
    "idle": {"image": "DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp", "frameSize": 512, "columns": 4, "loop": true, "pivotX": 256, "pivotY": 448, durationsMs: Array(64).fill(100) },
    "attack": {"image": "DesignAssets/Animations/UnitAttack/attack.png", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60] },
    "hurt": {"image": "DesignAssets/Animations/UnitHurt/V3/hurt.png", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20] },
  },
  "spore": {
    "idle": {"image": "DesignAssets/Tribes/spore/AnimationStudies/idle-v8/idle-v8.webp", "frameSize": 512, "columns": 4, "loop": true, "pivotX": 256, "pivotY": 448, durationsMs: Array(64).fill(100) },
    "walk": {"image": "DesignAssets/Tribes/spore/AnimationStudies/walk-v2/walk-v2.webp", "frameSize": 512, "columns": 4, "loop": true, "pivotX": 256, "pivotY": 448, durationsMs: Array(16).fill(70) },
    "jump": {"image": "DesignAssets/Tribes/spore/Animations/Units/jump/jump.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: Array(16).fill(70) },
    "attack": {"image": "DesignAssets/Tribes/spore/AnimationStudies/attack-directions-v3/right/attack.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60] },
    "hurt": {"image": "DesignAssets/Tribes/spore/AnimationStudies/hurt-v2/hurt-v2.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20] },
    "death": {"image": "DesignAssets/Tribes/spore/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [120,100,140,120,140,100,120,600] },
  },
  "pebble": {
    "idle": {"image": "DesignAssets/Tribes/pebble/AnimationStudies/idle-v3/idle-v3.webp", "frameSize": 512, "columns": 4, "loop": true, "pivotX": 256, "pivotY": 448, durationsMs: Array(64).fill(100) },
    "walk": {"image": "DesignAssets/Tribes/pebble/AnimationStudies/roll-v2/roll-v2.webp", "frameSize": 512, "columns": 4, "loop": true, "pivotX": 256, "pivotY": 448, durationsMs: Array(16).fill(80) },
    "jump": {"image": "DesignAssets/Tribes/pebble/Animations/Units/jump/jump.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: Array(16).fill(70) },
    "attack": {"image": "DesignAssets/Tribes/pebble/AnimationStudies/attack-directions-v3/right/attack.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60] },
    "hurt": {"image": "DesignAssets/Tribes/pebble/AnimationStudies/hurt-v2/hurt-v2.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20] },
    "death": {"image": "DesignAssets/Tribes/pebble/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [120,100,140,120,140,100,120,600] },
  },
  "spring": {
    "idle": {"image": "DesignAssets/Tribes/spring/AnimationStudies/idle-v4/idle-v4.webp", "frameSize": 512, "columns": 4, "loop": true, "pivotX": 256, "pivotY": 448, durationsMs: Array(64).fill(100) },
    "walk": {"image": "DesignAssets/Tribes/spring/AnimationStudies/flow-v4/flow-v4.webp", "frameSize": 512, "columns": 4, "loop": true, "pivotX": 256, "pivotY": 448, durationsMs: Array(16).fill(70) },
    "jump": {"image": "DesignAssets/Tribes/spring/Animations/Units/jump/jump.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: Array(16).fill(70) },
    "attack": {"image": "DesignAssets/Tribes/spring/AnimationStudies/attack-directions-v3/right/attack.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60] },
    "hurt": {"image": "DesignAssets/Tribes/spring/AnimationStudies/hurt-v2/hurt-v2.webp", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20] },
    "death": {"image": "DesignAssets/Tribes/spring/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png", "frameSize": 512, "columns": 4, "loop": false, "pivotX": 256, "pivotY": 448, durationsMs: [120,100,140,120,140,100,120,600] },
  },
});

export const SPROUT_DECOMPOSITION_PART = "DesignAssets/Tribes/sprout/AnimationStudies/idle-tail-v1/Parts/tail.png";

export const SPROUT_DECOMPOSITION_ANIMATIONS = Object.freeze(Object.fromEntries(["basic", "antenna", "tail"].map(name => [name, {
  image: "DesignAssets/Tribes/sprout/Animations/Attributes/decomposition-idle-v1/" + name + ".webp",
  frameSize: 256, columns: 8, loop: true, pivotX: 128, pivotY: 224, durationsMs: Array(128).fill(50)
}])));

export const CREATURE_IDLE_ANIMATIONS = Object.freeze({
  "spring-keeper": {"image":"DesignAssets/Animations/UniqueIdleV4/spring-keeper/idle.webp","frameSize":384,"columns":8,"durationsMs":[1450,50,50,50,50,50,50,50,50,50,50,50,100,200,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,1350,150,1700],"loop":true,"pivotX":157.5,"pivotY":307.5},
  "lantern-keeper": {"image":"DesignAssets/Animations/UniqueIdleV4/lantern-keeper/idle.webp","frameSize":384,"columns":8,"durationsMs":[1650,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,400,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,2700],"loop":true,"pivotX":203.25,"pivotY":324.75},
  "white-paw": {"image":"DesignAssets/Animations/MountainPawLeaderIdle/white-paw/idle-runtime.webp","frameSize":288,"columns":8,"durationsMs":[1400,150,100,150,100,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,300,150,150,150,150,2700],"loop":true,"pivotX":192.5,"pivotY":242},
  "old-garden-snail": {"image":"DesignAssets/Animations/UniqueIdleV3/old-garden-snail/idle.webp","frameSize":352,"columns":8,"durationsMs":[800,160,150,180,180,210,700,150,130,130,140,180,2600],"loop":true,"pivotX":180.8125,"pivotY":304.5625},
  "cotton-sheep": {"image":"DesignAssets/Animations/CottonSheepIdle/CalmV5/idle-runtime.webp","frameSize":256,"columns":8,"durationsMs":[50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,100],"loop":true,"pivotX":128,"pivotY":224},
  "walking-forest": {"image":"DesignAssets/Animations/MountainPawLeaderIdle/walking-forest/idle-runtime.webp","frameSize":256,"columns":8,"durationsMs":[1450,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,1600],"loop":true,"pivotX":128,"pivotY":224},
  "spiny-back-leader": {"image":"DesignAssets/Animations/MountainPawLeaderIdle/spiny-back-leader/idle-runtime.webp","frameSize":256,"columns":8,"durationsMs":[1250,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,600,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,2550],"loop":true,"pivotX":128,"pivotY":224},
  "vine-turtle": {"image":"DesignAssets/Animations/CreatureIdleStudies/V2/vine-turtle/idle.webp","frameSize":512,"columns":8,"durationsMs":[50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50],"loop":true,"pivotX":262.5,"pivotY":441.62},
  "shadow-weasel": {"image":"DesignAssets/Animations/CreatureIdleStudies/V2/shadow-weasel/idle.webp","frameSize":512,"columns":8,"durationsMs":[50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50],"loop":true,"pivotX":257.0,"pivotY":423.56},
  "snare-vine": {"image":"DesignAssets/Animations/CreatureIdleStudies/V1/snare-vine/idle.webp","frameSize":512,"columns":8,"durationsMs":[650,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,3350],"loop":true,"pivotX":255.5,"pivotY":470.15999999999997},
  "rolling-acorn": {"image":"DesignAssets/Animations/RollingAcornIdle/v1/idle.webp","frameSize":512,"columns":4,"durationsMs":[500,500,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,40,80,40,50,90,100,150,150,200,500],"loop":true,"pivotX":256,"pivotY":426},
  "bubble-toad": {"image":"DesignAssets/Animations/BubbleToadIdle/BreathV1/idle.webp","frameSize":512,"columns":4,"durationsMs":[50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,500],"loop":true,"pivotX":259,"pivotY":380.52},
  "soil-boar": {"image": "DesignAssets/Animations/SoilBoarIdle/V1/idle.webp", "frameSize": 512, "columns": 8, "loop": true, "pivotX": 256, "pivotY": 394, durationsMs: Array(80).fill(50) },
  "flower-tail-bird": {"image": "DesignAssets/Animations/CreatureIdleV3/flower-tail-bird/idle.webp", "frameSize": 512, "columns": 4, "durationsMs": [2000, 65, 50, 40, 40, 55, 40, 35, 40, 45, 50, 80, 55, 45, 40, 40, 55, 40, 35, 40, 50, 70, 3990], "loop": true, "pivotX": 256, "pivotY": 448},
  "dew-rabbit": {"image": "DesignAssets/Animations/CreatureIdleV3/dew-rabbit/idle.webp", "frameSize": 512, "columns": 4, "durationsMs": [2200, 65, 60, 50, 45, 40, 65, 50, 55, 60, 180, 35, 35, 35, 35, 40, 35, 35, 35, 35, 60, 3750], "loop": true, "pivotX": 256, "pivotY": 448},
  "soil-mole": {"image": "DesignAssets/Animations/CreatureIdleV3/soil-mole/idle.webp", "frameSize": 512, "columns": 4, "durationsMs": [1650, 180, 180, 240, 200, 200, 750, 25, 25, 30, 45, 25, 20, 25, 3405], "loop": true, "pivotX": 256, "pivotY": 448},
  "bundle-snail": {"image": "DesignAssets/Animations/CreatureIdleV4/bundle-snail/idle.webp", "frameSize": 512, "columns": 4, "durationsMs": [1500, 65, 60, 60, 65, 70, 70, 160, 100, 90, 90, 200, 100, 110, 110, 240, 90, 90, 90, 80, 80, 80, 90, 3310], "loop": true, "pivotX": 256, "pivotY": 448},
});

for (const animations of [...Object.values(UNIT_ANIMATIONS), SPROUT_DECOMPOSITION_ANIMATIONS]) for (const animation of Object.values(animations)) {
  Object.assign(animation, imageAnimation(animation));
  animation.frameCount = animation.durationsMs.length;
  animation.durationMs = animation.durationsMs.reduce((sum, duration) => sum + duration, 0);
  Object.freeze(animation.durationsMs);
  Object.freeze(animation);
}
for (const animation of Object.values(CREATURE_IDLE_ANIMATIONS)) {
  Object.assign(animation, imageAnimation(animation));
  animation.frameCount = animation.durationsMs.length;
  animation.durationMs = animation.durationsMs.reduce((sum, duration) => sum + duration, 0);
  Object.freeze(animation.durationsMs);
  Object.freeze(animation);
}

export const UNIT_ANIMATION_ASSETS = Object.freeze([...new Set([
  ...Object.values(UNIT_ANIMATIONS).flatMap(animations => Object.values(animations).map(animation => animation.image)),
  SPROUT_DECOMPOSITION_PART, ...Object.values(SPROUT_DECOMPOSITION_ANIMATIONS).map(animation => animation.image),
  ...Object.values(CREATURE_IDLE_ANIMATIONS).map(animation => animation.image)
])]);

export function unitAnimationFrame(animation, elapsedMs) {
  let elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : animation.durationMs;
  if (animation.loop) elapsed %= animation.durationMs;
  for (let frame = 0; frame < animation.frameCount; frame++) {
    if (elapsed + 1e-6 < animation.durationsMs[frame]) return frame;
    elapsed -= animation.durationsMs[frame];
  }
  return animation.frameCount - 1;
}

export function unitAnimationPose(agent, time) {
  if (agent.species || agent.birth || agent.health <= 0) return null;
  const animations = UNIT_ANIMATIONS[agent.tribe || "bean"];
  if (!animations) return null;
  let action = "idle", elapsed = (time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) * 1000;
  const hurt = (time - agent.hurtStartedAt) * 1000;
  const attack = agent.attack ? (time - agent.attack.startedAt) * (agent.attack.speed || 1) * 1000 : -1;
  const moving = agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration;
  if (hurt >= 0 && hurt < animations.hurt.durationMs) { action = "hurt"; elapsed = hurt; }
  else if (attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (agent.mode === "unload" && agent.foodDelivery) { action = "throw"; elapsed = (time - agent.foodDelivery.startedAt) * 1000; }
  else if (agent.mode === "harvest") { action = "harvest"; elapsed = (time - agent.harvestStarted) * 1000; }
  else if (agent.mode === "jump") { action = "jump"; elapsed = (time - (agent.jumpStartedAt ?? agent.moveStartedAt)) * 1000; }
  else if (moving) {
    action = "walk";
    elapsed = (Math.max(0, (agent.stepCount || 1) - 1) + (time - agent.moveStartedAt) / agent.moveDuration) * (animations[action]?.durationMs || 0);
  }
  const attributes = agent.appearanceAttributes || agent.attributes || {};
  const decomposition = action === "idle" && (agent.tribe || "bean") === "bean" && attributes.butchery > 0 &&
    !["strength", "arms", "feet", "lifespan"].some(key => attributes[key] > 0) && (attributes.antenna || 0) <= 1 ?
    attributes.antenna ? "antenna" : "basic" : null;
  const animation = decomposition ? SPROUT_DECOMPOSITION_ANIMATIONS[decomposition] : animations[action];
  return animation ? { action, animation, frame: unitAnimationFrame(animation, elapsed), ...(decomposition ? { decomposition } : {}) } : null;
}
