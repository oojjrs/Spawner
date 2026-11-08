import { SPRING_SECRETION_ASSETS } from "./spring-secretion-assets.mjs";
export const UNIT_RANGED_ASSETS = Object.freeze({
  "spore": {
    "idle": {
  "image": "DesignAssets/Animations/UnitRangedV1/spore/Source/neutral.png",
  "frameSize": 512,
  "columns": 1,
  "pivotX": 256,
  "pivotY": 448,
  "viewSize": 512,
  "frameCount": 1,
  "durationMs": 600,
  "durationsMs": [
    600
  ],
  "loop": true,
  "rangedBody": true,
  "sourceFacing": "left"
},
    "animation": {
  "image": "DesignAssets/Animations/UnitRangedV1/spore/shoot.webp",
  "frameSize": 512,
  "columns": 6,
  "frameCount": 30,
  "durationsMs": [
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20,
    20
  ],
  "durationMs": 600,
  "launchAtMs": 200,
  "pivotX": 256,
  "pivotY": 448,
  "viewSize": 512,
  "loop": false,
  "rangedBody": true,
  "sourceFacing": "left"
},
    "reference": {
      "width": 195,
      "height": 138
    },
    "projectile": {
      "image": "DesignAssets/Animations/UnitRangedV1/spore/projectile.png",
      "width": 58.5,
      "height": 55.574999999999996,
      "outletX": 342.0079744816587,
      "outletY": 381.45295055821373
}
  },
  "pebble": {
    "idle": {
      "image": "DesignAssets/Animations/UnitRangedV1/pebble/Source/neutral.png",
      "sourceFacing": "left",
      "frameSize": 512,
      "columns": 1,
      "pivotX": 256,
      "pivotY": 448,
      "viewSize": 512,
      "frameCount": 1,
      "durationMs": 600,
      "durationsMs": [
        600
      ],
      "loop": true,
      "rangedBody": true
    },
    "animation": {
      "image": "DesignAssets/Animations/UnitRangedV1/pebble/shoot.webp",
      "sourceFacing": "left",
      "frameSize": 512,
      "columns": 6,
      "frameCount": 30,
      "durationsMs": [
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20
      ],
      "durationMs": 600,
      "launchAtMs": 200,
      "pivotX": 256,
      "pivotY": 448,
      "viewSize": 512,
      "loop": false,
      "rangedBody": true
    },
    "reference": {
      "width": 217,
      "height": 166
    },
    "projectile": {
      "image": "DesignAssets/Animations/UnitRangedV1/pebble/projectile.png",
      "width": 65.1,
      "height": 56.83333333333333,
      "outletX": 340.80383314543406,
      "outletY": 312.11724915445325
    }
  },
  "spring": {
    "idle": SPRING_SECRETION_ASSETS.idle,
    "animation": {
      "image": "DesignAssets/Animations/UnitRangedV1/spring/shoot.webp",
      "frameSize": 512,
      "columns": 6,
      "frameCount": 30,
      "durationsMs": [
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20
      ],
      "durationMs": 600,
      "launchAtMs": 200,
      "pivotX": 256,
      "pivotY": 448,
      "viewSize": 512,
      "loop": false,
      "rangedBody": true
    },
    "reference": {
      "width": 154,
      "height": 201
    },
    "projectile": {
      "image": "DesignAssets/Animations/UnitRangedV1/spring/projectile.png",
      "width": 60.3,
      "height": 41.746153846153845,
      "outletX": 329.8726042841037,
      "outletY": 376.91657271702366
    }
  }
});
