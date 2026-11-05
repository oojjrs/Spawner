import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { toadHopMotion } from "./toad-hop.mjs";
import { attackAnimationElapsed, AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";
import { CREATURE_ATTACK_TIMINGS } from "../server/creature-attack.mjs";
import { imageAnimation } from "./image-geometry.mjs";
import { CREATURE_MOVEMENT_PROFILES } from "../server/creature-movement-profiles.mjs";

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
    "walk": {"image": "DesignAssets/Tribes/pebble/AnimationStudies/walk-in-place-v1/walk.webp", "frameSize": 512, "columns": 5, "loop": true, cyclesPerCell: 2.5, "pivotX": 256, "pivotY": 448, durationsMs: Array(20).fill(40) },
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

export const CREATURE_WALK_ANIMATIONS = Object.freeze({
  "flower-tail-bird": {"image":"DesignAssets/Animations/CreatureWalkV2/flower-tail-bird/walk.webp","frameSize":388,"columns":4,"durationsMs":[80,80,80,90,90,80,80,87],"loop":true,"pivotX":194,"pivotY":357.0086206896552,"cyclesPerCell":3},
  "dew-rabbit": {"image":"DesignAssets/Animations/CreatureWalkV2/dew-rabbit/walk.webp","frameSize":433,"viewSize":417,"columns":4,"durationsMs":[100,80,100,180,100,100,150,190],"loop":true,"pivotX":216.5,"pivotY":442.9627192982456,"cyclesPerCell":2},
  "soil-mole": {"image":"DesignAssets/Animations/CreatureWalkV2/soil-mole/walk.webp","frameSize":355,"columns":4,"durationsMs":[80,80,90,80,80,90,80,87],"loop":true,"pivotX":177.5,"pivotY":310.625,"cyclesPerCell":3},
  "bundle-snail": {"image":"DesignAssets/Animations/CreatureWalkV2/bundle-snail/walk.webp","frameSize":398,"columns":4,"durationsMs":[200,250,250,250,300,250,250,250],"loop":true,"pivotX":199,"pivotY":348.25,"cyclesPerCell":1},
  "cotton-sheep": {"image":"DesignAssets/Animations/CreatureWalkV2/cotton-sheep/walk.webp","frameSize":256,"columns":4,"durationsMs":[125,125,125,125,125,125,125,125],"loop":true,"pivotX":128,"pivotY":224,"cyclesPerCell":2},
  "rolling-acorn": {"image":"DesignAssets/Animations/CreatureWalkV2/rolling-acorn/walk.webp","frameSize":420,"columns":8,"durationsMs":[78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78,78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78,78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78,78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78],"loop":true,"pivotX":210,"pivotY":349.453125,"cyclesPerCell":0.4},
  "soil-boar": {"image":"DesignAssets/Animations/CreatureWalkV2/soil-boar/walk.webp","frameSize":256,"columns":8,"durationsMs":[100,100,100,100,100,100,100,100],"loop":true,"pivotX":128,"pivotY":197,"cyclesPerCell":2},
  "bubble-toad": {"image":"DesignAssets/Animations/CreatureWalkV2/bubble-toad/walk.webp","frameSize":288,"viewSize":256,"columns":8,"durationsMs":[110,120,80,110,130,90,90,150],"loop":true,"pivotX":145.5,"pivotY":222.26,"cyclesPerCell":2},
  "vine-turtle": {"image":"DesignAssets/Animations/CreatureWalkV2/vine-turtle/walk.webp","frameSize":256,"viewSize":256,"columns":8,"durationsMs":[170,130,120,140,170,130,120,140],"loop":true,"pivotX":131.25,"pivotY":220.81,"cyclesPerCell":1.5},
  "shadow-weasel": {"image":"DesignAssets/Animations/CreatureWalkV2/shadow-weasel/walk.webp","frameSize":256,"viewSize":256,"columns":8,"durationsMs":[85,80,85,100,85,80,85,100],"loop":true,"pivotX":128.5,"pivotY":211.78,"cyclesPerCell":2.5},
  "snare-vine": {"image":"DesignAssets/Animations/CreatureWalkV2/snare-vine/walk.webp","frameSize":256,"viewSize":256,"columns":6,"durationsMs":[180,140,140,160,140,180],"loop":true,"pivotX":127.75,"pivotY":235.08,"cyclesPerCell":1.5},
  "talon-owl": {"image":"DesignAssets/Animations/CreatureWalkV2/talon-owl/walk.webp","frameSize":432,"viewSize":256,"columns":8,"durationsMs":[70,80,80,85,80,70,70,65],"loop":true,"pivotX":205,"pivotY":288,"cyclesPerCell":3},
  "spring-keeper": {"image":"DesignAssets/Animations/CreatureWalkV2/spring-keeper/walk.webp","frameSize":512,"viewSize":384,"columns":4,"durationsMs":[60,60,80,120,80,80,80,80,80,80,80,80,80,80,80,80],"loop":true,"pivotX":221.5,"pivotY":371.5,"cyclesPerCell":3,"takeoffDurationMs":320,"flightDurationMs":640,"landingDurationMs":320},
  "lantern-keeper": {"image":"DesignAssets/Animations/CreatureWalkV2/lantern-keeper/walk.webp","frameSize":384,"columns":6,"durationsMs":[140,100,140,100,120,140],"loop":true,"pivotX":203.25,"pivotY":324.75,"cyclesPerCell":2},
  "old-garden-snail": {"image":"DesignAssets/Animations/CreatureWalkV2/old-garden-snail/walk.webp","frameSize":352,"columns":6,"durationsMs":[220,220,260,220,220,260],"loop":true,"pivotX":180.8125,"pivotY":304.5625,"cyclesPerCell":1},
  "walking-forest": {"image":"DesignAssets/Animations/CreatureWalkV2/walking-forest/walk.webp","frameSize":256,"columns":6,"durationsMs":[200,180,180,200,180,180],"loop":true,"pivotX":128,"pivotY":224,"cyclesPerCell":1.4},
  "white-paw": {"image":"DesignAssets/Animations/CreatureWalkV2/white-paw/walk.webp","frameSize":288,"columns":6,"durationsMs":[110,85,125,110,85,125],"loop":true,"pivotX":192.5,"pivotY":242,"cyclesPerCell":2.5},
  "spiny-back-leader": {"image":"DesignAssets/Animations/CreatureWalkV2/spiny-back-leader/walk.webp","frameSize":256,"columns":6,"durationsMs":[110,100,100,110,100,100],"loop":true,"pivotX":128,"pivotY":224,"cyclesPerCell":2.5}
});

export const CREATURE_ATTACK_ANIMATIONS = Object.freeze({
  "spring-keeper": {"image":"DesignAssets/Animations/CreatureAttackV2/spring-keeper/runtime.webp","frameSize":269,"viewSize":274.07547169811323,"columns":4,"pivotX":101.66804245283019,"pivotY":235.25604363207546,"durationsMs":[70,90,100,35,240,100,140,130],"loop":false,"facing":"left","impactFrame":4},
  "lantern-keeper": {"image":"DesignAssets/Animations/CreatureAttackV2/lantern-keeper/runtime.webp","frameSize":270,"viewSize":259.43060498220643,"columns":4,"pivotX":141.5871052046263,"pivotY":235.53874277135233,"durationsMs":[70,100,120,40,260,110,160,140],"loop":false,"facing":"left","impactFrame":4},
  "white-paw": {"image":"DesignAssets/Animations/CreatureAttackV2/white-paw/runtime.webp","frameSize":269,"viewSize":247.60227272727272,"columns":4,"pivotX":183.07475142045453,"pivotY":223.09996448863635,"durationsMs":[70,100,90,40,260,110,130,120],"loop":false,"facing":"left","impactFrame":4},
  "old-garden-snail": {"image":"DesignAssets/Animations/CreatureAttackV2/old-garden-snail/runtime.webp","frameSize":264,"viewSize":239.34065934065933,"columns":4,"pivotX":133.57237293956044,"pivotY":230.11323832417582,"durationsMs":[110,180,220,80,300,220,260,200],"loop":false,"facing":"left","impactFrame":4},
  "cotton-sheep": {"image":"DesignAssets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp","frameSize":290,"viewSize":256.7708333333333,"columns":4,"pivotX":145.43660481770834,"pivotY":249.0771484375,"durationsMs":[100,110,120,40,240,90,140,190],"loop":false,"facing":"left","impactFrame":4},
  "walking-forest": {"image":"DesignAssets/Animations/CreatureAttackV2/walking-forest/runtime.webp","frameSize":512,"viewSize":418.9090909090909,"columns":4,"pivotX":255.99999999999997,"pivotY":447,"durationsMs":[100,180,220,60,320,180,220,180],"loop":false,"facing":"left","impactFrame":4},
  "spiny-back-leader": {"image":"DesignAssets/Animations/CreatureAttackV2/spiny-back-leader/runtime.webp","frameSize":512,"viewSize":418.9090909090909,"columns":4,"pivotX":255.99999999999997,"pivotY":449.5454545454545,"durationsMs":[90,170,220,50,340,180,220,170],"loop":false,"facing":"left","impactFrame":4},
  "vine-turtle": {"image":"DesignAssets/Animations/CreatureAttackV2/vine-turtle/runtime.webp","frameSize":231,"viewSize":231.67596068904592,"columns":6,"pivotX":118.58627518832472,"pivotY":199.84869689941402,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
  "shadow-weasel": {"image":"DesignAssets/Animations/CreatureAttackV2/shadow-weasel/runtime.webp","frameSize":229,"viewSize":228.608642578125,"columns":6,"pivotX":115.25907893614335,"pivotY":189.22680542512376,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
  "snare-vine": {"image":"DesignAssets/Animations/CreatureAttackV2/snare-vine/runtime.webp","frameSize":283,"viewSize":283.21875,"columns":6,"pivotX":141.23318481445312,"pivotY":259.8811083984375,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
  "rolling-acorn": {"image":"DesignAssets/Animations/CreatureAttackV2/rolling-acorn/runtime.webp","frameSize":312,"viewSize":281.2599381625442,"columns":4,"pivotX":157.38239840989397,"pivotY":270.69152788896866,"durationsMs":[100,110,130,40,220,90,140,190],"loop":false,"facing":"left","impactFrame":4},
  "bubble-toad": {"image":"DesignAssets/Animations/CreatureAttackV2/bubble-toad/runtime.webp","frameSize":258,"viewSize":258.10648584905664,"columns":6,"pivotX":130.59410861033314,"pivotY":191.8959035874853,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
  "soil-boar": {"image":"DesignAssets/Animations/CreatureAttackV2/soil-boar/runtime.webp","frameSize":264,"viewSize":263.4999410377358,"columns":6,"pivotX":132.09826061320754,"pivotY":202.63912768094045,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
  "flower-tail-bird": {"image":"DesignAssets/Animations/CreatureAttackV2/flower-tail-bird/runtime.webp","frameSize":283,"viewSize":276.77600235849053,"columns":4,"pivotX":138.03967423349056,"pivotY":259.49940300707544,"durationsMs":[100,110,110,40,220,80,130,180],"loop":false,"facing":"left","impactFrame":4},
  "dew-rabbit": {"image":"DesignAssets/Animations/CreatureAttackV2/dew-rabbit/runtime.webp","frameSize":278,"viewSize":279.2221593418728,"columns":4,"pivotX":146.09600679107774,"pivotY":248.90296661053443,"durationsMs":[100,110,110,40,200,90,130,190],"loop":false,"facing":"left","impactFrame":4},
  "soil-mole": {"image":"DesignAssets/Animations/CreatureAttackV2/soil-mole/runtime.webp","frameSize":273,"viewSize":237.44496052340986,"columns":4,"pivotX":136.9022574812279,"pivotY":246.37352221593417,"durationsMs":[100,110,120,40,220,90,130,190],"loop":false,"facing":"left","impactFrame":4},
  "bundle-snail": {"image":"DesignAssets/Animations/CreatureAttackV2/bundle-snail/runtime.webp","frameSize":293,"viewSize":266.3926816475265,"columns":4,"pivotX":146.9266715437279,"pivotY":270.04213884441253,"durationsMs":[100,130,120,45,220,100,140,210],"loop":false,"facing":"left","impactFrame":4},
  "talon-owl": {"image":"DesignAssets/Animations/CreatureAttackV2/talon-owl/runtime.webp","frameSize":288,"viewSize":288.1672862453532,"columns":6,"pivotX":131.6345405436803,"pivotY":225.24361059479554,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
});

export const CREATURE_HURT_ANIMATIONS = Object.freeze({
  "flower-tail-bird": {"image":"DesignAssets/Animations/CreatureHurtV6/flower-tail-bird/hurt.webp","frameSize":388,"columns":4,"pivotX":194,"pivotY":339.5,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "dew-rabbit": {"image":"DesignAssets/Animations/CreatureHurtV5/dew-rabbit/hurt.webp","frameSize":417,"columns":4,"pivotX":208.5,"pivotY":364.875,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "soil-mole": {"image":"DesignAssets/Animations/CreatureHurtV5/soil-mole/hurt.webp","frameSize":355,"columns":4,"pivotX":177.5,"pivotY":310.625,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "bundle-snail": {"image":"DesignAssets/Animations/CreatureHurtV7/bundle-snail/hurt.webp","frameSize":398,"columns":4,"pivotX":199,"pivotY":348.25,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "cotton-sheep": {"image":"DesignAssets/Animations/CreatureHurtV5/cotton-sheep/hurt.webp","frameSize":256,"columns":4,"pivotX":128,"pivotY":224,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "rolling-acorn": {"image":"DesignAssets/Animations/CreatureHurtV4/rolling-acorn/hurt.webp","frameSize":420,"columns":4,"pivotX":210,"pivotY":349.453125,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "soil-boar": {"image":"DesignAssets/Animations/CreatureHurtV7/soil-boar/hurt.webp","frameSize":369,"columns":4,"pivotX":184.5,"pivotY":283.957031,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "bubble-toad": {"image":"DesignAssets/Animations/CreatureHurtV7/bubble-toad/hurt.webp","frameSize":361,"columns":4,"pivotX":182.615234,"pivotY":268.296328,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "vine-turtle": {"image":"DesignAssets/Animations/CreatureHurtV7/vine-turtle/hurt.webp","frameSize":346,"columns":4,"pivotX":177.392578,"pivotY":298.438516,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "shadow-weasel": {"image":"DesignAssets/Animations/CreatureHurtV6/shadow-weasel/hurt.webp","frameSize":319,"columns":4,"pivotX":160.123047,"pivotY":263.897734,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "snare-vine": {"image":"DesignAssets/Animations/CreatureHurtV7/snare-vine/hurt.webp","frameSize":424,"columns":4,"pivotX":211.585938,"pivotY":389.35125,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "talon-owl": {"image":"DesignAssets/Animations/CreatureHurtV6/talon-owl/hurt.webp","frameSize":432,"columns":4,"pivotX":197.4375,"pivotY":337.5,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "spring-keeper": {"image":"DesignAssets/Animations/CreatureHurtV6/spring-keeper/hurt.webp","frameSize":384,"columns":4,"pivotX":157.5,"pivotY":307.5,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "lantern-keeper": {"image":"DesignAssets/Animations/CreatureHurtV5/lantern-keeper/hurt.webp","frameSize":384,"columns":4,"pivotX":203.25,"pivotY":324.75,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "old-garden-snail": {"image":"DesignAssets/Animations/CreatureHurtV7/old-garden-snail/hurt.webp","frameSize":352,"columns":4,"pivotX":180.8125,"pivotY":304.5625,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "walking-forest": {"image":"DesignAssets/Animations/CreatureHurtV8/walking-forest/hurt.webp","frameSize":256,"columns":4,"pivotX":128,"pivotY":224,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "white-paw": {"image":"DesignAssets/Animations/CreatureHurtV6/white-paw/hurt.webp","frameSize":288,"columns":4,"pivotX":192.5,"pivotY":242,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
  "spiny-back-leader": {"image":"DesignAssets/Animations/CreatureHurtV8/spiny-back-leader/hurt.webp","frameSize":256,"columns":4,"pivotX":128,"pivotY":224,"durationsMs":[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20],"loop":false},
});

export const CREATURE_DEATH_ANIMATIONS = Object.freeze({
  "flower-tail-bird": {"image":"DesignAssets/Animations/CreatureDeathV4/flower-tail-bird/runtime.webp","frameSize":256,"viewSize":256,"columns":4,"pivotX":128.0,"pivotY":224.0,"durationsMs":[40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,1000],"loop":false},
  "rolling-acorn": {"image":"DesignAssets/Animations/CreatureDeathV4/rolling-acorn/runtime.webp","frameSize":256,"viewSize":256,"columns":4,"pivotX":128.0,"pivotY":224.0,"durationsMs":[40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,1000],"loop":false},
  "snare-vine": {"image":"DesignAssets/Animations/CreatureDeathV4/snare-vine/runtime.webp","frameSize":256,"viewSize":256,"columns":8,"pivotX":128.0,"pivotY":224.0,"durationsMs":[33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,900],"loop":false},
  "dew-rabbit": {"image":"DesignAssets/Animations/CreatureDeathV6/dew-rabbit/runtime.webp","frameSize":256,"viewSize":256,"columns":4,"pivotX":128.0,"pivotY":224.0,"durationsMs":[33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,1000],"loop":false},
  "cotton-sheep": {"image":"DesignAssets/Animations/CreatureDeathV6/cotton-sheep/runtime.webp","frameSize":256,"viewSize":256,"columns":4,"pivotX":128.0,"pivotY":224.0,"durationsMs":[120,90,90,100,100,100,160,1000],"loop":false},
  "soil-boar": {"image":"DesignAssets/Animations/CreatureDeathV6/soil-boar/runtime.webp","frameSize":256,"viewSize":256,"columns":4,"pivotX":128.0,"pivotY":224.0,"durationsMs":[80,40,40,80,80,160,160,800],"loop":false},
  "talon-owl": {"image":"DesignAssets/Animations/CreatureDeathV6/talon-owl/runtime.webp","frameSize":256,"viewSize":256,"columns":4,"pivotX":128.0,"pivotY":224.0,"durationsMs":[40,40,40,40,40,40,40,40,40,40,160,240,900],"loop":false},
  "spring-keeper": {"image":"DesignAssets/Animations/CreatureDeathV11/spring-keeper/runtime.webp","frameSize":288,"viewSize":288,"columns":4,"pivotX":144.0,"pivotY":240.0,"durationsMs":[33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,25,25,25,25,25,25,34,35,34,35,34,34,35,34,33,34,33,33,34,33,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35],"loop":false},
  "white-paw": {"image":"DesignAssets/Animations/CreatureDeathV12/white-paw/runtime.webp","frameSize":256,"viewSize":256,"columns":4,"pivotX":128.0,"pivotY":224.0,"durationsMs":[200,16,17,16,16,17,16,16,17,16,16,17,16,16,17,16,17,16,16,17,16,16,17,16,16,17,16,16,17,16,16,17,16,16,17,16,16,17,16,17,16,16,17,16,16,17,16,16,17,16,16,17,16,920],"loop":false},
  "vine-turtle": {"image": "DesignAssets/Animations/CreatureDeathV12/vine-turtle/runtime.webp", "frameSize": 256, "viewSize": 256, "pivotX": 128.0, "pivotY": 224.0, "columns": 8, "durationsMs": [33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 900], "loop": false},
  "walking-forest": {"image": "DesignAssets/Animations/CreatureDeathV12/walking-forest/runtime.webp", "frameSize": 256, "viewSize": 256, "pivotX": 128.0, "pivotY": 224.0, "columns": 8, "durationsMs": [33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 34, 33, 33, 17, 1000], "loop": false},
  "bundle-snail": {"image":"DesignAssets/Animations/SnailDeathV1/bundle-snail/runtime.webp","frameSize":256,"viewSize":255.95759717314488,"pivotX":128.03533568904592,"pivotY":248.9558303886926,"columns":8,"durationsMs":[40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,1000],"loop":false},
  "old-garden-snail": {"image":"DesignAssets/Animations/SnailDeathV1/old-garden-snail/runtime.webp","frameSize":256,"viewSize":256.5860805860806,"pivotX":131.1856684981685,"pivotY":223.95215201465203,"columns":8,"durationsMs":[40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,1000],"loop":false},
  "bubble-toad": {"image": "DesignAssets/Animations/BubbleToadDeath/RebuildV3/runtime.webp", "frameSize": 256, "viewSize": 255.71842307666503, "pivotX": 129.06362738388998, "pivotY": 220.82812188553496, "columns": 4, "durationsMs": [60, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 70, 40, 40, 40, 40, 40, 40, 40, 40, 40, 60, 1000], "loop": false},
  "soil-mole": {"image": "DesignAssets/Animations/CreatureDeathV6/soil-mole/runtime.webp", "frameSize": 256, "viewSize": 256.0707637189895, "pivotX": 128.02064407200112, "pivotY": 231.56069494440834, "columns": 4, "durationsMs": [120, 90, 90, 90, 90, 90, 140, 1000], "loop": false},
  "shadow-weasel": {"image": "DesignAssets/Animations/CreatureDeathV6/shadow-weasel/runtime.webp", "frameSize": 256, "viewSize": 243.62312045574424, "pivotX": 128.35099274270337, "pivotY": 171.4882831172111, "columns": 4, "durationsMs": [120, 90, 90, 100, 100, 100, 160, 1000], "loop": false},
  "lantern-keeper": {"image":"DesignAssets/Animations/CreatureDeathV10/lantern-keeper/runtime.webp","frameSize":256,"viewSize":248.71174377224202,"pivotX":135.3149466192171,"pivotY":223.83807829181495,"columns":6,"durationsMs":[33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,34,33,33,17,17,33,33,34,33,33,34,33,33,34,33,770],"loop":false},
  "spiny-back-leader": {"image":"DesignAssets/Animations/CreatureDeathV10/spiny-back-leader/runtime.webp","frameSize":256,"viewSize":256,"pivotX":128,"pivotY":224,"columns":3,"durationsMs":[80,120,520],"loop":false}
});

for (const animations of Object.values(UNIT_ANIMATIONS)) for (const animation of Object.values(animations)) {
  Object.assign(animation, imageAnimation(animation));
  animation.frameCount = animation.durationsMs.length;
  animation.durationMs = animation.durationsMs.reduce((sum, duration) => sum + duration, 0);
  Object.freeze(animation.durationsMs);
  Object.freeze(animation);
}
for (const animation of [...Object.values(CREATURE_IDLE_ANIMATIONS), ...Object.values(CREATURE_WALK_ANIMATIONS), ...Object.values(CREATURE_ATTACK_ANIMATIONS), ...Object.values(CREATURE_HURT_ANIMATIONS), ...Object.values(CREATURE_DEATH_ANIMATIONS)]) {
  Object.assign(animation, imageAnimation(animation));
  animation.frameCount = animation.durationsMs.length;
  animation.durationMs = animation.durationsMs.reduce((sum, duration) => sum + duration, 0);
  Object.freeze(animation.durationsMs);
  Object.freeze(animation);
}

// Approved single-attack rhythm from spring-combat-rhythm-20261105. Keep
// attachment rigs on their existing timing; only the unadorned melee body uses it.
const SPRING_BASIC_ATTACK_ANIMATION = Object.freeze({ ...UNIT_ANIMATIONS.spring.attack,
  durationsMs: Object.freeze([60,70,60,80,30,60,16,16,16,16,32,40,52,76,100,276])
});

export const UNIT_ANIMATION_ASSETS = Object.freeze([...new Set([
  ...Object.values(UNIT_ANIMATIONS).flatMap(animations => Object.values(animations).map(animation => animation.image)),
  ...[...Object.values(CREATURE_IDLE_ANIMATIONS), ...Object.values(CREATURE_ATTACK_ANIMATIONS), ...Object.values(CREATURE_HURT_ANIMATIONS), ...Object.values(CREATURE_DEATH_ANIMATIONS)].map(animation => animation.image),
  ...Object.values(CREATURE_WALK_ANIMATIONS).map(animation => animation.image)
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

export function creatureAttackPose(agent, time) {
  const animation = CREATURE_ATTACK_ANIMATIONS[agent.species], attack = agent.attack;
  if (!animation || !attack || agent.health <= 0 || !Number.isFinite(attack.startedAt)) return null;
  const elapsed = attackAnimationElapsed(attack, time, CREATURE_ATTACK_TIMINGS[agent.species].hitTimeMs / 1000, animation.durationMs / 1000) * 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed + 1e-6 >= animation.durationMs) return null;
  const direction = attack.directionX || agent.facing || -1;
  return { action: "attack", animation, frame: unitAnimationFrame(animation, elapsed), mirrorX: direction > 0 };
}

export function creatureHurtPose(agent, time) {
  const animation = CREATURE_HURT_ANIMATIONS[agent.species];
  if (!animation || agent.health <= 0 || !Number.isFinite(agent.hurtStartedAt)) return null;
  if (agent.combat?.version === 2 && creatureAttackPose(agent, time)) return null;
  const elapsed = (time - agent.hurtStartedAt) * 1000 * (agent.combat?.version === 2 ? animation.durationMs / 120 : 1);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed + 1e-6 >= animation.durationMs) return null;
  return { action: "hurt", animation, frame: unitAnimationFrame(animation, elapsed) };
}

export function unitAnimationPose(agent, time) {
  if (agent.species || agent.birth || agent.health <= 0) return null;
  const animations = UNIT_ANIMATIONS[agent.tribe || "bean"];
  if (!animations) return null;
  let action = "idle", elapsed = (time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) * 1000;
  const rpg = agent.combat?.version === 2;
  const hurt = (time - agent.hurtStartedAt) * 1000 * (rpg ? animations.hurt.durationMs / 120 : 1);
  const attack = agent.attack ? attackAnimationElapsed(agent.attack, time, AGENT_ATTACK_HIT_TIME, animations.attack.durationMs / 1000) * 1000 : -1;
  const moving = agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration;
  if (rpg && attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (hurt >= 0 && hurt < animations.hurt.durationMs) { action = "hurt"; elapsed = hurt; }
  else if (attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (agent.mode === "unload" && agent.foodDelivery) { action = "throw"; elapsed = (time - agent.foodDelivery.startedAt) * 1000; }
  else if (agent.mode === "harvest") { action = "harvest"; elapsed = (time - agent.harvestStarted) * 1000; }
  else if (agent.mode === "jump") { action = "jump"; elapsed = (time - (agent.jumpStartedAt ?? agent.moveStartedAt)) * 1000; }
  else if (moving) {
    action = "walk";
    elapsed = (Math.max(0, (agent.stepCount || 1) - 1) + (time - agent.moveStartedAt) / agent.moveDuration) * (animations[action]?.cyclesPerCell || 1) * (animations[action]?.durationMs || 0);
  }
  const attributes = unitDisplayAttributes(agent);
  let animation = animations[action] || ((agent.tribe || "bean") !== "bean" && ["harvest", "throw"].includes(action) &&
      ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) ? animations.idle : null);
  if (action === "attack" && agent.tribe === "spring" && !Object.values(attributes).some(value => value > 0) &&
      !agent.attack?.dnaRanged && agent.attack?.mode !== "ranged" && agent.attack?.attackMode !== "ranged") animation = SPRING_BASIC_ATTACK_ANIMATION;
  return animation ? { action, animation, frame: unitAnimationFrame(animation, elapsed) } : null;
}

export function creatureWalkPose(agent, time) {
  const animation = CREATURE_WALK_ANIMATIONS[agent.species];
  const elapsed = time - agent.moveStartedAt;
  if (!animation || agent.health <= 0 || agent.mode !== "walk" ||
    !(agent.moveDuration > 0) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= agent.moveDuration) return null;
  if (agent.species === "spring-keeper") return springKeeperFlightPose(agent, time);
  if (agent.species === "bubble-toad") {
    const hop=toadHopMotion(elapsed / agent.moveDuration);
    return { animation, frame:hop.frame, hop };
  }
  const progress = Math.max(0, (agent.stepCount || 1) - 1) + elapsed / agent.moveDuration;
  return { animation, frame: unitAnimationFrame(animation, progress * (animation.cyclesPerCell || 1) * animation.durationMs) };
}

export function creatureAnimationSpeed(species) {
  return CREATURE_MOVEMENT_PROFILES[species]?.speed || 1;
}

export function unitMovementPosition(agent, time, reducedMotion = false) {
  const raw = agent.moveDuration > 0 ? Math.max(0, Math.min(1, (time - agent.moveStartedAt) / agent.moveDuration)) : 1;
  const attributes = unitDisplayAttributes(agent);
  const beanHop = !agent.species && (agent.tribe || "bean") === "bean" && !attributes.feet;
  let progress = raw, travel = raw;
  if (!reducedMotion && beanHop) {
    progress = Math.max(0, Math.min(1, (raw - .18) / .82));
    travel = progress * progress * (3 - 2 * progress);
  } else if (!reducedMotion && agent.species === "bubble-toad") {
    travel=toadHopMotion(raw).travel;
  } else if (!reducedMotion && agent.species) {
    const animation = CREATURE_WALK_ANIMATIONS[agent.species], window = animation?.travelWindow;
    if (window) {
      const cycles = animation.cyclesPerCell || 1;
      const phase = raw * cycles, complete = Math.floor(phase), local = phase - complete;
      const airborne = Math.max(0, Math.min(1, (local - window[0]) / (window[1] - window[0])));
      travel = (complete + airborne * airborne * (3 - 2 * airborne)) / cycles;
      if (raw === 1) travel = 1;
    }
  }
  return { x: agent.moveDuration ? agent.renderFromX + (agent.x - agent.renderFromX) * travel : agent.x,
    y: agent.moveDuration ? agent.renderFromY + (agent.y - agent.renderFromY) * travel : agent.y, progress };
}

export function springKeeperFlightPose(agent, time) {
  if (agent.species !== "spring-keeper" || !(agent.health > 0) || !(agent.moveDuration > 0)) return null;
  const animation = CREATURE_WALK_ANIMATIONS[agent.species];
  const elapsed = time - agent.moveStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  const startedAt = Number.isFinite(agent.flightStartedAt) ? agent.flightStartedAt : agent.moveStartedAt;
  if (agent.mode === "walk" && elapsed < agent.moveDuration) {
    const age = Math.max(0, (time - startedAt) * 1000);
    const takeoff = age < animation.takeoffDurationMs;
    const frameTime = takeoff ? age : animation.takeoffDurationMs +
      (age - animation.takeoffDurationMs) % animation.flightDurationMs;
    return { animation, frame: unitAnimationFrame(animation, frameTime), stage: takeoff ? "takeoff" : "flight",
      phase: takeoff ? age / animation.takeoffDurationMs - 1 : (age - animation.takeoffDurationMs) / animation.flightDurationMs,
      rate: 1000 / (takeoff ? animation.takeoffDurationMs : animation.flightDurationMs) };
  }
  const stoppedAt = Number.isFinite(agent.flightStoppedAt) ? agent.flightStoppedAt : agent.moveStartedAt + agent.moveDuration;
  const landing = (time - stoppedAt) * 1000;
  if (landing < 0 || landing >= animation.landingDurationMs) return null;
  return { animation, frame: unitAnimationFrame(animation, animation.takeoffDurationMs + animation.flightDurationMs + landing), stage: "landing" };
}
