(() => {
const modules=Object.create(null);
modules["client/unit-size.mjs"]=globalThis.Spawner;
modules["server/dna.mjs"]=globalThis.Spawner;
modules["client/unit-animation.mjs"]=globalThis.Spawner;
modules["client/birth.mjs"]=globalThis.Spawner;
modules["server/unit-appearance.mjs"]=(()=>{
const UNIT_APPEARANCE_BITS = Object.freeze({ blade: 1, carapace: 2, antenna: 4, feet: 8, secretion: 16 });
const UNIT_APPEARANCE_LEGACY_VISUAL_KEYS = Object.freeze(["strength", "arms", "piercing", "guard"]);
const UNIT_APPEARANCE_TRIBES = Object.freeze(["bean", "spore", "pebble", "spring"]);

function unitAppearanceKey(tribe, mask) {
  return UNIT_APPEARANCE_TRIBES.includes(tribe) && Number.isInteger(mask) && mask >= 0 && mask < 32 ?
    tribe + "/" + mask.toString(16).padStart(2, "0") : null;
}

function unitAppearanceMaskFromAttributes(attributes) {
  if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes?.[key] > 0)) return null;
  let mask = 0;
  for (const [key, bit] of Object.entries(UNIT_APPEARANCE_BITS)) if (attributes?.[key] > 0) mask |= bit;
  return mask;
}

function unitAppearanceMaskFromDna(dna) {
  if (!Array.isArray(dna?.pieces)) return null;
  let mask = 0;
  for (const piece of dna.pieces) mask |= UNIT_APPEARANCE_BITS[piece.gene === "legs" ? "feet" : piece.gene] || 0;
  return mask;
}
return {UNIT_APPEARANCE_BITS,UNIT_APPEARANCE_LEGACY_VISUAL_KEYS,UNIT_APPEARANCE_TRIBES,unitAppearanceKey,unitAppearanceMaskFromAttributes,unitAppearanceMaskFromDna};
})();
modules["client/unit-display-appearance.mjs"]=(()=>{
const { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, unitAppearanceMaskFromDna }=modules["server/unit-appearance.mjs"];

// Rendering only. Never assign this projection to a simulation agent, DNA,
// snapshot, stats, or save. Lower-priority abilities remain fully effective.
const UNIT_DISPLAY_PRIORITY = Object.freeze(["blade", "secretion", "carapace", "antenna", "feet"]);
const UNIT_DISPLAY_MASKS = Object.freeze([0, ...UNIT_DISPLAY_PRIORITY.map(key => UNIT_APPEARANCE_BITS[key])]);
const UNIT_DISPLAY_FORM_COUNT = UNIT_APPEARANCE_TRIBES.length * UNIT_DISPLAY_MASKS.length;

function unitDominantAppearanceMask(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask >= 32) return null;
  return UNIT_DISPLAY_PRIORITY.map(key => UNIT_APPEARANCE_BITS[key]).find(bit => mask & bit) || 0;
}

function unitDisplayAttributesFrom(attributes = {}) {
  attributes ||= {};
  // Old saves using retired organs retain their authored compatibility rigs,
  // without applying the current priority policy. Current DNA cannot produce
  // these keys and always uses one of the six canonical silhouettes.
  if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes[key] > 0)) return attributes;
  const dominant = UNIT_DISPLAY_PRIORITY.find(key => attributes[key] > 0 || key === "feet" && attributes.legs > 0);
  const result = { ...attributes };
  for (const key of [...UNIT_DISPLAY_PRIORITY, "legs"]) delete result[key];
  if (dominant) result[dominant] = 1;
  return result;
}

function unitDisplayAttributes(agent) {
  const attributes = agent?.appearanceAttributes || agent?.attributes;
  if (agent?.species) return attributes || {};
  const mask = attributes ? null : unitAppearanceMaskFromDna(agent?.dna);
  const display = attributes ? unitDisplayAttributesFrom(attributes) : mask === null ? {} : unitDisplayAttributesFrom(Object.fromEntries(
    Object.entries(UNIT_APPEARANCE_BITS).filter(([, bit]) => mask & bit).map(([key]) => [key, 1])));
  return agent?.dna?.pieces?.some(piece => piece.gene === "gather") && !UNIT_DISPLAY_PRIORITY.some(key => display[key] > 0) ?
    { ...display, strength: display.strength || display.arms || 1 } : display;
}

// A shared blade silhouette can also shoot. Production readiness must include
// every action needed by builds that map to that silhouette, not just its name.
function unitDisplayAbilityMask(mask) {
  if (!UNIT_DISPLAY_MASKS.includes(mask)) return null;
  let abilities = 0;
  for (let actual = 0; actual < 32; actual++) if (unitDominantAppearanceMask(actual) === mask) abilities |= actual;
  return abilities;
}

return {UNIT_DISPLAY_PRIORITY,UNIT_DISPLAY_MASKS,UNIT_DISPLAY_FORM_COUNT,unitDominantAppearanceMask,unitDisplayAttributesFrom,unitDisplayAttributes,unitDisplayAbilityMask};
})();
modules["client/unit-appearance-assets.mjs"]=(()=>{
const UNIT_APPEARANCE_ASSETS = Object.freeze({
  "bean/00": {
    "source": {
      "tribe": "bean",
      "mask": 0,
      "sourceId": "unit-appearance-v1-bean-00-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "9c8893d8792c6d4e987ec0479463ebbd9085f89d38bb1c7db2580c3f4d230f73",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-00-neutral-v1",
        "verified": true,
        "coreBounds": [
          173,
          243,
          167,
          206
        ],
        "landmarks": {
          "leftEye": [
            216,
            375
          ],
          "rightEye": [
            296.5,
            375
          ],
          "supportPoint": [
            255.5,
            448.5
          ],
          "supportPixelBounds": [
            203,
            441,
            105,
            8
          ],
          "faceMidpoint": [
            256.25,
            375
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "existing-original",
        "sourceHash": "0bd1b394864222d33ef42583c15e059bcd0ed0fb4173d85f1f4226bf223f36a8",
        "transform": {
          "scale": 0.14883720930232558,
          "offsetX": 171,
          "offsetY": 205,
          "sourceFrameWidth": 1144,
          "sourceFrameHeight": 1668
        },
        "referenceVerified": true,
        "reuseAuthorized": true
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/00/Source/neutral.png"
    },
    "actions": {
      "idle": {
        "sourceId": "unit-appearance-v1-bean-00-neutral-v1",
        "image": "DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp",
        "imageHash": "46a613676ad252c703e4a4391e3482109f11990bd2dd877e879986ae87576cfb",
        "frameSize": 631,
        "columns": 4,
        "frameCount": 64,
        "durationsMs": [
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100
        ],
        "loop": true,
        "pivotX": 315.5,
        "pivotY": 553.268115942029,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "46a613676ad252c703e4a4391e3482109f11990bd2dd877e879986ae87576cfb",
          "pixelsPerWorld": 617.5,
          "scale": 0.8291497975708502,
          "offsetX": -5.596761133603252,
          "offsetY": -10.742146335738994
        },
        "events": []
      },
      "attack": {
        "sourceId": "unit-appearance-v1-bean-00-neutral-v1",
        "image": "DesignAssets/Animations/UnitAttack/attack.png",
        "imageHash": "5843746f0f742afe688d6623a031f79c27982beab599c7bff9c54f7a91ce1662",
        "frameSize": 632,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          60,
          70,
          60,
          80,
          30,
          50,
          50,
          50,
          50,
          50,
          50,
          70,
          80,
          90,
          100,
          60
        ],
        "loop": false,
        "pivotX": 316,
        "pivotY": 555.1351351351351,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "5843746f0f742afe688d6623a031f79c27982beab599c7bff9c54f7a91ce1662",
          "pixelsPerWorld": 901.4200879920468,
          "scale": 0.5679926671486795,
          "offsetX": 76.51431718101728,
          "offsetY": 132.68731396665203
        },
        "events": []
      },
      "hurt": {
        "sourceId": "unit-appearance-v1-bean-00-neutral-v1",
        "image": "DesignAssets/Animations/UnitHurt/V3/hurt.png",
        "imageHash": "1409bf1440a95467211f645c142acc0029852cc0cf32850eec19185c0b6b10c6",
        "frameSize": 632,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          20,
          30,
          30,
          30,
          400,
          30,
          30,
          30,
          20,
          20,
          20,
          20,
          20,
          20,
          20,
          20
        ],
        "loop": false,
        "pivotX": 316,
        "pivotY": 555.1351351351351,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "1409bf1440a95467211f645c142acc0029852cc0cf32850eec19185c0b6b10c6",
          "pixelsPerWorld": 899.9999999999998,
          "scale": 0.568888888888889,
          "offsetX": 76.23111111111109,
          "offsetY": 132.18978978978976
        },
        "events": []
      },
      "death": {
        "sourceId": "unit-appearance-v1-bean-00-neutral-v1",
        "image": "DesignAssets/Tribes/sprout/AnimationStudies/death-v1/death-runtime.webp",
        "imageHash": "2659f1cb0b65405ff1acf413883f0a5428eaf5f14ee8d3bbf7ec02f7ebc846ef",
        "frameSize": 316,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          160,
          80,
          80,
          70,
          70,
          60,
          60,
          60,
          60,
          60,
          80,
          90,
          100,
          110,
          120,
          1000
        ],
        "loop": false,
        "pivotX": 158,
        "pivotY": 276.5,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "2659f1cb0b65405ff1acf413883f0a5428eaf5f14ee8d3bbf7ec02f7ebc846ef",
          "pixelsPerWorld": 432.50000000000006,
          "scale": 1.183815028901734,
          "offsetX": 68.95722543352605,
          "offsetY": 120.67514450867054
        },
        "events": []
      }
    },
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/01": {
    "source": {
      "tribe": "bean",
      "mask": 1,
      "sourceId": "unit-appearance-v1-bean-01-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "b49b4121469244acd932f1c072f46f07a40d6b6a77e1e4f174c6fdd0c5cdb8e8",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-01-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            373.5
          ],
          "rightEye": [
            295.5,
            373.5
          ],
          "supportPoint": [
            258,
            447.5
          ],
          "supportPixelBounds": [
            207,
            440,
            102,
            8
          ],
          "faceMidpoint": [
            258,
            373.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/01/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/02": {
    "source": {
      "tribe": "bean",
      "mask": 2,
      "sourceId": "unit-appearance-v1-bean-02-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "42b4c127042dbc5fcd78e7fe33108c29dfe1440062375e85b9197fa4c4a3e99f",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-02-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            221,
            373.5
          ],
          "rightEye": [
            295.5,
            373.5
          ],
          "supportPoint": [
            259,
            447.5
          ],
          "supportPixelBounds": [
            206,
            440,
            106,
            8
          ],
          "faceMidpoint": [
            258.25,
            373.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/02/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/03": {
    "source": {
      "tribe": "bean",
      "mask": 3,
      "sourceId": "unit-appearance-v1-bean-03-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "bf4aeca1d1ebd509ef47b675bb81e70beb8317d445434b000e2f4e07c71c42cd",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-03-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            221,
            365.5
          ],
          "rightEye": [
            295.5,
            365.5
          ],
          "supportPoint": [
            258,
            448.5
          ],
          "supportPixelBounds": [
            203,
            441,
            110,
            8
          ],
          "faceMidpoint": [
            258.25,
            365.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/03/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/04": {
    "source": {
      "tribe": "bean",
      "mask": 4,
      "sourceId": "unit-appearance-v1-bean-04-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "a55aaae6f6a2da2d4ed39cce52be7169cf50c0b1087416eadbcb2d9f499a1eb3",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "antenna"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-04-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            369
          ],
          "rightEye": [
            295.5,
            369
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            205,
            440,
            105,
            8
          ],
          "faceMidpoint": [
            258,
            369
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/04/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/05": {
    "source": {
      "tribe": "bean",
      "mask": 5,
      "sourceId": "unit-appearance-v1-bean-05-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "783bed93d96a0eab8e30139e6fb296414359f8b1519177b813e3d6e0edc6536d",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "antenna"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-05-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            373.5
          ],
          "rightEye": [
            294.5,
            373.5
          ],
          "supportPoint": [
            258,
            447.5
          ],
          "supportPixelBounds": [
            207,
            440,
            102,
            8
          ],
          "faceMidpoint": [
            257.5,
            373.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/05/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/06": {
    "source": {
      "tribe": "bean",
      "mask": 6,
      "sourceId": "unit-appearance-v1-bean-06-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "f67773b4dc68c934587452d8368955ee8d4801251cc4e058d0b248ae9641a889",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace",
        "antenna"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-06-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            373.5
          ],
          "rightEye": [
            295.5,
            373.5
          ],
          "supportPoint": [
            259,
            447.5
          ],
          "supportPixelBounds": [
            206,
            440,
            106,
            8
          ],
          "faceMidpoint": [
            258,
            373.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/06/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/07": {
    "source": {
      "tribe": "bean",
      "mask": 7,
      "sourceId": "unit-appearance-v1-bean-07-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "1d472b1a15f25475131e2367e5eb589b4f9d910d66d8a93e59b62a3f32507beb",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace",
        "antenna"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-07-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            221,
            365.5
          ],
          "rightEye": [
            295,
            365.5
          ],
          "supportPoint": [
            257.5,
            448.5
          ],
          "supportPixelBounds": [
            203,
            441,
            109,
            8
          ],
          "faceMidpoint": [
            258,
            365.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/07/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/08": {
    "source": {
      "tribe": "bean",
      "mask": 8,
      "sourceId": "unit-appearance-v1-bean-08-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "17eec14cafbeb5024cf1e6f7036433c312c942b69024499c76956eb9f1bf610f",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-08-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            355
          ],
          "rightEye": [
            294.5,
            355
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            190,
            440,
            135,
            8
          ],
          "faceMidpoint": [
            257.5,
            355
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/08/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/09": {
    "source": {
      "tribe": "bean",
      "mask": 9,
      "sourceId": "unit-appearance-v1-bean-09-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "049246ae1e2bf95ff207a1ece60a843a8c930229298ed65aa74c662440c5ff91",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-09-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            356.5
          ],
          "rightEye": [
            295.5,
            356.5
          ],
          "supportPoint": [
            259.5,
            447.5
          ],
          "supportPixelBounds": [
            192,
            440,
            135,
            8
          ],
          "faceMidpoint": [
            258,
            356.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/09/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/0a": {
    "source": {
      "tribe": "bean",
      "mask": 10,
      "sourceId": "unit-appearance-v1-bean-0a-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "966bdc3d043ad8b14262c0c21d4c291c40439154fe4f163594d30b32e92d1dbd",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-0a-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            221,
            354.5
          ],
          "rightEye": [
            295.5,
            354.5
          ],
          "supportPoint": [
            266,
            448.5
          ],
          "supportPixelBounds": [
            202,
            441,
            128,
            8
          ],
          "faceMidpoint": [
            258.25,
            354.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/0a/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/0b": {
    "source": {
      "tribe": "bean",
      "mask": 11,
      "sourceId": "unit-appearance-v1-bean-0b-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "2a6a5df6d49ffa0a86b8166e52234d70127b2221e35afb6e430e1fac0e601f9b",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-0b-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220,
            350.5
          ],
          "rightEye": [
            294.5,
            350.5
          ],
          "supportPoint": [
            258,
            447.5
          ],
          "supportPixelBounds": [
            189,
            440,
            138,
            8
          ],
          "faceMidpoint": [
            257.25,
            350.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/0b/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/0c": {
    "source": {
      "tribe": "bean",
      "mask": 12,
      "sourceId": "unit-appearance-v1-bean-0c-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "e4ac7f96df732c17929e4b768ad23fa63d54576e3df58146d8c05d91711992a1",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "antenna",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-0c-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            355
          ],
          "rightEye": [
            295.5,
            355
          ],
          "supportPoint": [
            258,
            447.5
          ],
          "supportPixelBounds": [
            190,
            440,
            136,
            8
          ],
          "faceMidpoint": [
            258,
            355
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/0c/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/0d": {
    "source": {
      "tribe": "bean",
      "mask": 13,
      "sourceId": "unit-appearance-v1-bean-0d-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "5e7599a04009dee8c1d3391c889d1440f5e457677a2cf0af07be1af67b49ac47",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "antenna",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-0d-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            219.5,
            356.5
          ],
          "rightEye": [
            294.5,
            356.5
          ],
          "supportPoint": [
            258.5,
            447.5
          ],
          "supportPixelBounds": [
            190,
            440,
            137,
            8
          ],
          "faceMidpoint": [
            257,
            356.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/0d/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/0e": {
    "source": {
      "tribe": "bean",
      "mask": 14,
      "sourceId": "unit-appearance-v1-bean-0e-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "46a02be7fc90dc6b9dfe695c1358049e2925d94c8f1328944673510586b52082",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace",
        "antenna",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-0e-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220,
            354.5
          ],
          "rightEye": [
            295.5,
            354.5
          ],
          "supportPoint": [
            265.5,
            448.5
          ],
          "supportPixelBounds": [
            202,
            441,
            127,
            8
          ],
          "faceMidpoint": [
            257.75,
            354.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/0e/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/0f": {
    "source": {
      "tribe": "bean",
      "mask": 15,
      "sourceId": "unit-appearance-v1-bean-0f-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "2650fb9b0c9592994d2581011ba34a4290a967d4ade3968d7fde8264ee4f93b3",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace",
        "antenna",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-0f-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220,
            350.5
          ],
          "rightEye": [
            295,
            350.5
          ],
          "supportPoint": [
            257,
            447.5
          ],
          "supportPixelBounds": [
            187,
            440,
            140,
            8
          ],
          "faceMidpoint": [
            257.5,
            350.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/0f/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/10": {
    "source": {
      "tribe": "bean",
      "mask": 16,
      "sourceId": "unit-appearance-v1-bean-10-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "65a547fbe1664cfa3e0fb534e94eae029cb9cb18a66518df670daa8e70533811",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-10-neutral-v1",
        "verified": true,
        "coreBounds": [
          170,
          242,
          177,
          206
        ],
        "landmarks": {
          "leftEye": [
            220.5,
            377.5
          ],
          "rightEye": [
            295,
            378
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            208,
            440,
            99,
            8
          ],
          "faceMidpoint": [
            257.75,
            377.75
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "approved-art-reuse",
        "transform": {
          "scale": 1,
          "offsetX": 0,
          "offsetY": 0,
          "sourceFrameWidth": 512,
          "sourceFrameHeight": 512
        },
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/10/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/11": {
    "source": {
      "tribe": "bean",
      "mask": 17,
      "sourceId": "unit-appearance-v1-bean-11-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "a442e5bbefd2b3a3ca655d28fc3164a459ad978e322561f4fcb966f840e32324",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-11-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            377.5
          ],
          "rightEye": [
            295,
            378
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            208,
            440,
            99,
            8
          ],
          "faceMidpoint": [
            257.75,
            377.75
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "approved-art-reuse",
        "transform": {
          "scale": 1,
          "offsetX": 24,
          "offsetY": 0,
          "sourceFrameWidth": 512,
          "sourceFrameHeight": 512
        },
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/11/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/12": {
    "source": {
      "tribe": "bean",
      "mask": 18,
      "sourceId": "unit-appearance-v1-bean-12-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "cd27cc9c4a5c7e65a93cb91a89b4ee48489422f952e65be8a38e0d2ef3e659ee",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-12-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220,
            376
          ],
          "rightEye": [
            295.5,
            376.5
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            209,
            440,
            97,
            8
          ],
          "faceMidpoint": [
            257.75,
            376.25
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "approved-art-reuse",
        "transform": {
          "scale": 1,
          "offsetX": 0,
          "offsetY": 0,
          "sourceFrameWidth": 512,
          "sourceFrameHeight": 512
        },
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/12/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/13": {
    "source": {
      "tribe": "bean",
      "mask": 19,
      "sourceId": "unit-appearance-v1-bean-13-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "b65941c3847db84af77eac2b8e97dd75a9df5f50c1e37a80cddfd9fa8f589717",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-13-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            369.5
          ],
          "rightEye": [
            295,
            369.5
          ],
          "supportPoint": [
            257.5,
            448.5
          ],
          "supportPixelBounds": [
            206,
            441,
            103,
            8
          ],
          "faceMidpoint": [
            257.75,
            369.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/13/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/14": {
    "source": {
      "tribe": "bean",
      "mask": 20,
      "sourceId": "unit-appearance-v1-bean-14-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "6847ae2f9ea518ead664fda2e657abe246250032377149288e63174338231160",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "antenna",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-14-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            375.5
          ],
          "rightEye": [
            294.5,
            375.5
          ],
          "supportPoint": [
            258,
            447.5
          ],
          "supportPixelBounds": [
            208,
            440,
            100,
            8
          ],
          "faceMidpoint": [
            257.5,
            375.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/14/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/15": {
    "source": {
      "tribe": "bean",
      "mask": 21,
      "sourceId": "unit-appearance-v1-bean-15-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "6924db22c440c07ae12b6e19b364ec78c4f5b1c35634806f23d203e316716fc7",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "antenna",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-15-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            221,
            375.5
          ],
          "rightEye": [
            295.5,
            375.5
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            205,
            440,
            105,
            8
          ],
          "faceMidpoint": [
            258.25,
            375.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/15/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/16": {
    "source": {
      "tribe": "bean",
      "mask": 22,
      "sourceId": "unit-appearance-v1-bean-16-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "66aef70276d8eb28b0bc2794643a061866d5785435bb66dcfce07f6884e28d10",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace",
        "antenna",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-16-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220,
            374.5
          ],
          "rightEye": [
            295,
            374
          ],
          "supportPoint": [
            257,
            447.5
          ],
          "supportPixelBounds": [
            206,
            440,
            102,
            8
          ],
          "faceMidpoint": [
            257.5,
            374.25
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/16/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/17": {
    "source": {
      "tribe": "bean",
      "mask": 23,
      "sourceId": "unit-appearance-v1-bean-17-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "9a42c0245c6ac9c44ffa4dbdb67d09c16f49b605b5c80f3735302f53693a19d6",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace",
        "antenna",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-17-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            368.5
          ],
          "rightEye": [
            295.5,
            368.5
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            206,
            440,
            103,
            8
          ],
          "faceMidpoint": [
            258,
            368.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/17/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/18": {
    "source": {
      "tribe": "bean",
      "mask": 24,
      "sourceId": "unit-appearance-v1-bean-18-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "550a8368b578a5cff00e4cf14f87b7b1977d8e7733104508c8d4f3f7832d6887",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-18-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220,
            360.5
          ],
          "rightEye": [
            294.5,
            360.5
          ],
          "supportPoint": [
            257,
            447.5
          ],
          "supportPixelBounds": [
            201,
            440,
            112,
            8
          ],
          "faceMidpoint": [
            257.25,
            360.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/18/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/19": {
    "source": {
      "tribe": "bean",
      "mask": 25,
      "sourceId": "unit-appearance-v1-bean-19-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "68750b7176bd26c4e73c912db59b0f3ebb15b6e67b57eff70b4abc5631de4d5b",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-19-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            356.5
          ],
          "rightEye": [
            294.5,
            356.5
          ],
          "supportPoint": [
            257,
            448.5
          ],
          "supportPixelBounds": [
            189,
            441,
            136,
            8
          ],
          "faceMidpoint": [
            257.5,
            356.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/19/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/1a": {
    "source": {
      "tribe": "bean",
      "mask": 26,
      "sourceId": "unit-appearance-v1-bean-1a-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "ee9c08b9d5a590816ee1db3f50a18ed1cb0cd611bce2cfcfd15973ad61b490b1",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-1a-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            221,
            358.5
          ],
          "rightEye": [
            295,
            358.5
          ],
          "supportPoint": [
            265.5,
            447.5
          ],
          "supportPixelBounds": [
            208,
            440,
            115,
            8
          ],
          "faceMidpoint": [
            258,
            358.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1a/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/1b": {
    "source": {
      "tribe": "bean",
      "mask": 27,
      "sourceId": "unit-appearance-v1-bean-1b-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "5dc21f5c2a5fbd5f22b0056756d2d4e74328381394c12ec9b6aa9d9136787eb0",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-1b-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            352
          ],
          "rightEye": [
            294.5,
            352
          ],
          "supportPoint": [
            256.5,
            447.5
          ],
          "supportPixelBounds": [
            198,
            440,
            117,
            8
          ],
          "faceMidpoint": [
            257.5,
            352
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1b/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/1c": {
    "source": {
      "tribe": "bean",
      "mask": 28,
      "sourceId": "unit-appearance-v1-bean-1c-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "23fbe614fc9c2748591b5b6467fe35aeb80163decbbde1465114e456e239d36f",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "antenna",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-1c-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            360.5
          ],
          "rightEye": [
            294.5,
            360.5
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            201,
            440,
            113,
            8
          ],
          "faceMidpoint": [
            257.5,
            360.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1c/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/1d": {
    "source": {
      "tribe": "bean",
      "mask": 29,
      "sourceId": "unit-appearance-v1-bean-1d-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "dee3888feb50174b3f881b66bd12725adb2eaf64642c3152887f128161df516e",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "antenna",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-1d-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220,
            356.5
          ],
          "rightEye": [
            294.5,
            356.5
          ],
          "supportPoint": [
            258,
            448.5
          ],
          "supportPixelBounds": [
            187,
            441,
            142,
            8
          ],
          "faceMidpoint": [
            257.25,
            356.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1d/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/1e": {
    "source": {
      "tribe": "bean",
      "mask": 30,
      "sourceId": "unit-appearance-v1-bean-1e-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "e087b9cff989cc7bb9fc650f8776ed2bfdbcadd75603d6b1504e82293162892c",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "carapace",
        "antenna",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-1e-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            357.5
          ],
          "rightEye": [
            295,
            357.5
          ],
          "supportPoint": [
            257.5,
            447.5
          ],
          "supportPixelBounds": [
            205,
            440,
            105,
            8
          ],
          "faceMidpoint": [
            257.75,
            357.5
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "imagegen-integrated-neutral",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1e/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "bean/1f": {
    "source": {
      "tribe": "bean",
      "mask": 31,
      "sourceId": "unit-appearance-v1-bean-1f-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_ac2b35a0d4a84662b9df4975654e7ee9",
        "item": 0
      },
      "sourceHash": "030e75b71127be552ac3ab9bdf51c707884d5c234706b1803c10ba2abcb39dfb",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "blade",
        "carapace",
        "antenna",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-bean-1f-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            220.5,
            364
          ],
          "rightEye": [
            295,
            364.5
          ],
          "supportPoint": [
            258,
            447.5
          ],
          "supportPixelBounds": [
            195,
            440,
            126,
            8
          ],
          "faceMidpoint": [
            257.75,
            364.25
          ]
        },
        "canonicalSpeciesSize": 0.4,
        "canonicalCoreLongest": 204.8
      },
      "provenance": {
        "kind": "approved-art-reuse",
        "transform": {
          "scale": 1,
          "offsetX": 24,
          "offsetY": 0,
          "sourceFrameWidth": 512,
          "sourceFrameHeight": 512
        },
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1f/Source/neutral.png"
    },
    "actions": {
      "idle": {
        "sourceId": "unit-appearance-v1-bean-1f-neutral-v1",
        "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1f/Motions/idle.webp",
        "imageHash": "8bbc4cebef3ca0333e59c4f019f4a66f695e17abb027d8b9c12521b8f91e6ede",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 64,
        "durationsMs": [
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100
        ],
        "loop": true,
        "pivotX": 256,
        "pivotY": 448,
        "events": []
      },
      "walk": {
        "sourceId": "unit-appearance-v1-bean-1f-neutral-v1",
        "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1f/Motions/walk.webp",
        "imageHash": "71643363b1fdaf3235d323b5774fd1c2562a3fe52742efff94255e31dd3f3df3",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 28,
        "durationsMs": [
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40
        ],
        "loop": true,
        "pivotX": 256,
        "pivotY": 448,
        "events": [
          {
            "type": "contact",
            "atMs": 0,
            "attachment": "foot-left"
          },
          {
            "type": "contact",
            "atMs": 280,
            "attachment": "foot-right"
          },
          {
            "type": "contact",
            "atMs": 560,
            "attachment": "foot-left"
          },
          {
            "type": "contact",
            "atMs": 840,
            "attachment": "foot-right"
          }
        ]
      },
      "hurt": {
        "sourceId": "unit-appearance-v1-bean-1f-neutral-v1",
        "image": "DesignAssets/Animations/UnitAppearanceV1/bean/1f/Motions/hurt.webp",
        "imageHash": "990ae3e20f70165b06ec993c009deaa9c152bd5ba67690690ca3014ee4ee6db3",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          20,
          30,
          30,
          30,
          400,
          30,
          30,
          30,
          20,
          20,
          20,
          20,
          20,
          20,
          20,
          20
        ],
        "loop": false,
        "pivotX": 256,
        "pivotY": 448,
        "events": [
          {
            "type": "contact",
            "atMs": 0,
            "attachment": "foot-left"
          },
          {
            "type": "contact",
            "atMs": 0,
            "attachment": "foot-right"
          }
        ]
      }
    },
    "previewStatus": {
      "jump": "unsupported"
    },
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/00": {
    "source": {
      "tribe": "spore",
      "mask": 0,
      "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
      "approvalState": "existing-reference",
      "approvalRef": null,
      "sourceHash": "1c5046fa67f3d68626928381a168f30d2469bfe7c7a3cb49a6a2c961089e12b4",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "verified": true,
        "coreBounds": [
          158,
          310,
          196,
          139
        ],
        "landmarks": {
          "leftEye": [
            237,
            411.5
          ],
          "rightEye": [
            274.5,
            411.5
          ],
          "ground": [
            256,
            448
          ],
          "supportPoint": [
            255.5,
            448.5
          ],
          "supportPixelBounds": [
            220,
            441,
            71,
            8
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "existing-original",
        "sourceHash": "e2c2c84bdfa64116e1dbb163e1b4d32dd48c8dcec7ceff4bfc91021a9ba44e58",
        "transform": {
          "scale": 0.15934479934479934,
          "offsetX": 156,
          "offsetY": 273,
          "sourceFrameWidth": 1254,
          "sourceFrameHeight": 1254
        },
        "referenceVerified": true,
        "reuseAuthorized": true
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/spore/00/Source/neutral.png"
    },
    "actions": {
      "idle": {
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "image": "DesignAssets/Tribes/spore/AnimationStudies/idle-v8/idle-v8.webp",
        "imageHash": "fec5d88c1f0a6d1ddb69581948671da5477330b8a262cfb4219af25e62b9f8e7",
        "frameSize": 549,
        "columns": 4,
        "frameCount": 64,
        "durationsMs": [
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100
        ],
        "loop": true,
        "pivotX": 274.5,
        "pivotY": 480.375,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "fec5d88c1f0a6d1ddb69581948671da5477330b8a262cfb4219af25e62b9f8e7",
          "pixelsPerWorld": 1113.157894736842,
          "scale": 0.4599527186761229,
          "offsetX": 129.74297872340426,
          "offsetY": 227.05021276595744
        },
        "events": []
      },
      "walk": {
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "image": "DesignAssets/Tribes/spore/AnimationStudies/walk-v2/walk-v2.webp",
        "imageHash": "368c1bb19b3355d26bd0a156637ee75e3f6781a81df457b1a34a43611661da2d",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70
        ],
        "loop": true,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "368c1bb19b3355d26bd0a156637ee75e3f6781a81df457b1a34a43611661da2d",
          "pixelsPerWorld": 1112.2889190188587,
          "scale": 0.4603120567375886,
          "offsetX": 138.1601134751773,
          "offsetY": 241.78019858156028
        },
        "events": []
      },
      "jump": {
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "image": "DesignAssets/Tribes/spore/Animations/Units/jump/jump.webp",
        "imageHash": "088de97292a6c4cb18ac6e2e067ae53479e130fa679d17960d9f1e7241ebbfff",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70
        ],
        "loop": false,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "088de97292a6c4cb18ac6e2e067ae53479e130fa679d17960d9f1e7241ebbfff",
          "pixelsPerWorld": 1148.6796576215627,
          "scale": 0.44572914354567644,
          "offsetX": 141.89333925230682,
          "offsetY": 248.31334369153694
        },
        "events": []
      },
      "attack": {
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "image": "DesignAssets/Tribes/spore/AnimationStudies/attack-directions-v3/right/attack.webp",
        "imageHash": "65e91bdc3af93677e254b8ce24ccf8c98e22930d4179f8f614519554176de36f",
        "frameSize": 553,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          60,
          70,
          60,
          80,
          30,
          50,
          50,
          50,
          50,
          50,
          50,
          70,
          80,
          90,
          100,
          60
        ],
        "loop": false,
        "pivotX": 276.5,
        "pivotY": 482.6181818181818,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "65e91bdc3af93677e254b8ce24ccf8c98e22930d4179f8f614519554176de36f",
          "pixelsPerWorld": 1106.9094882535055,
          "scale": 0.46254911122664555,
          "offsetX": 128.1051707458325,
          "offsetY": 224.76538893818037
        },
        "events": []
      },
      "hurt": {
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "image": "DesignAssets/Tribes/spore/AnimationStudies/hurt-v2/hurt-v2.webp",
        "imageHash": "703eda5d5454549c6bcec7a4cfedec832dfcbf30c885a23e08818a944d86ada2",
        "frameSize": 553,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          20,
          30,
          30,
          30,
          400,
          30,
          30,
          30,
          20,
          20,
          20,
          20,
          20,
          20,
          20,
          20
        ],
        "loop": false,
        "pivotX": 276.5,
        "pivotY": 482.6181818181818,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "703eda5d5454549c6bcec7a4cfedec832dfcbf30c885a23e08818a944d86ada2",
          "pixelsPerWorld": 1106.9094882535055,
          "scale": 0.46254911122664555,
          "offsetX": 128.1051707458325,
          "offsetY": 224.76538893818037
        },
        "events": []
      },
      "death": {
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "image": "DesignAssets/Tribes/spore/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png",
        "imageHash": "8baf1b600e5868e4d1af9ddcc94692ebd3416a72b1b6c97db681eddaafb49c99",
        "frameSize": 553,
        "columns": 4,
        "frameCount": 8,
        "durationsMs": [
          120,
          100,
          140,
          120,
          140,
          100,
          120,
          600
        ],
        "loop": false,
        "pivotX": 276.5,
        "pivotY": 482.6181818181818,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "8baf1b600e5868e4d1af9ddcc94692ebd3416a72b1b6c97db681eddaafb49c99",
          "pixelsPerWorld": 1106.9094882535055,
          "scale": 0.46254911122664555,
          "offsetX": 128.1051707458325,
          "offsetY": 224.76538893818037
        },
        "events": []
      }
    },
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    },
    "sceneActions": {
      "birth": {
        "contractVersion": 1,
        "kind": "native-body-with-external-legacy-scene",
        "tribe": "spore",
        "mask": 0,
        "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
        "runtimeEnabled": true,
        "independentBodyAction": false,
        "integrationStatus": "legacy-scene-body-adapter",
        "body": {
          "sourceId": "unit-appearance-v1-spore-00-neutral-v1",
          "image": "DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/birth-unit.webp",
          "sourceHash": "93696aac1e9eb471a1aae0ba8932eec01e369d0d64d064218a01b4b1c2ce9761",
          "frameSize": 192,
          "columns": 4,
          "frameCount": 22,
          "durationsMs": [
            180,
            80,
            80,
            80,
            80,
            80,
            80,
            80,
            80,
            160,
            160,
            160,
            160,
            160,
            160,
            160,
            160,
            80,
            80,
            80,
            80,
            700
          ],
          "loop": false,
          "pivotX": 133.33333333333331,
          "pivotY": 162,
          "cameraMapping": {
            "verified": true,
            "sourceHash": "93696aac1e9eb471a1aae0ba8932eec01e369d0d64d064218a01b4b1c2ce9761",
            "pixelsPerWorld": 217.05366357069144,
            "scale": 2.3588636633781053,
            "offsetX": -58.51515511708067,
            "offsetY": 65.86408653274697,
            "method": "preserve-existing-game-fixed-native-birth-body-camera"
          }
        },
        "externalRoot": {
          "module": "client/birth.mjs",
          "export": "sporeBirthPlacement",
          "ownsWorldTravel": true,
          "targetFloorWorld": 0.808
        },
        "deformation": {
          "kind": "spore-affine-body-v1",
          "module": "client/birth.mjs",
          "moduleHash": "0e8009e12eaa98126aab60833a8c5cd397be78b51b974cd9bfd26571f15d5c36",
          "export": "sporeBirthMotion",
          "nativeHeight": 59.666666666666664,
          "nativeOutletX": 150,
          "nativeOutletY": 133.33333333333331,
          "nativeCenterX": 133.33333333333331,
          "nativePivotY": 162,
          "rowStep": null
        },
        "visibility": {
          "firstBodyFrame": 2,
          "lastFramePolicy": "handoff-to-registered-idle",
          "lastFrame": 21
        },
        "nativeFrameSampling": "fixed-native-frame-canvas-copy",
        "legacyPixelStage": {
          "displayScale": 0.9037825952078233,
          "nativeWorldPerPixelBeforeDisplay": 0.005097636994742031,
          "agentHeight": 0.7,
          "canonicalFrameSize": 512,
          "referenceHeight": null,
          "unitHeight": 179,
          "unitPivotY": null,
          "commonFloorOffsetFromHalfCell": 0.44
        },
        "floorOffsetWorld": 0,
        "separatedSceneAssets": [
          {
            "role": "nest",
            "image": "DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/nest-stationary.png",
            "sourceHash": "3e52fe5ba79971314cfe0d6937df6253c2cef1f65aaf7c1ba84001eda4dc9fe2"
          }
        ],
        "legacyReference": {
          "file": "client/game.js",
          "function": "drawSporeBirth",
          "sourceHash": "fcfa816a72c568cbeeaf74768ef58434a2c7db53a658798c089bbe5dc2104715",
          "capture": "tools/native-appearance-registration-20261104/legacy-body-reference.json"
        },
        "ownership": {
          "bodyOnly": true,
          "originalPixelsPreserved": true,
          "perFrameFit": false,
          "sceneRootInsideBodyClip": false,
          "nestsOrWaterInsideBodyClip": false,
          "dnaGrowthApplications": 1
        },
        "validation": {
          "cameraVerified": true,
          "runtimeRendererConnected": true,
          "report": "tools/native-appearance-registration-20261104/scene-render-report.json"
        }
      }
    }
  },
  "spore/01": {
    "source": {
      "tribe": "spore",
      "mask": 1,
      "sourceId": "unit-appearance-v1-spore-01-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-01-neutral-v1",
        "sourceHash": "ec422a18982b5fefa7b2f503632dda6bac9777a03cba48a01f7d5291d658977a"
      },
      "sourceHash": "ec422a18982b5fefa7b2f503632dda6bac9777a03cba48a01f7d5291d658977a",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "blade"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-01-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.15206837606837,
            405.3628034188034
          ],
          "rightEye": [
            276.06181196581196,
            405.3628034188034
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe4a90ea47be4edb748c5762e608cbbb1c420d0b61f13333c6ef535e834c1074",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/02": {
    "source": {
      "tribe": "spore",
      "mask": 2,
      "sourceId": "unit-appearance-v1-spore-02-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-02-neutral-v1",
        "sourceHash": "0514364bd2068a184f79b40e9bb5ed2162423c57cfd4e408571b0b91273aa45d"
      },
      "sourceHash": "0514364bd2068a184f79b40e9bb5ed2162423c57cfd4e408571b0b91273aa45d",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "carapace"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-02-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.8036923076923,
            408.52458119658115
          ],
          "rightEye": [
            276.0482735042735,
            408.52458119658115
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe326448660d4de7fd138873e45e94e1904be8e4db132b0f10e0ac7ceae677e7",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/04": {
    "source": {
      "tribe": "spore",
      "mask": 4,
      "sourceId": "unit-appearance-v1-spore-04-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-04-neutral-v1",
        "sourceHash": "006287ff322e20df3da2c51d80409833f6edd9753841ecadccb273895a68d426"
      },
      "sourceHash": "006287ff322e20df3da2c51d80409833f6edd9753841ecadccb273895a68d426",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "antenna"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-04-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            235.9880341880342,
            405.529094017094
          ],
          "rightEye": [
            276.8955213675214,
            405.529094017094
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "5d8ec10efbd6eda6c45f3060644fe5c88896e211c151c5979b28d4122f38d76b",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/05": {
    "source": {
      "tribe": "spore",
      "mask": 5,
      "sourceId": "unit-appearance-v1-spore-05-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-05-neutral-v1",
        "sourceHash": "22931373726fdcb5ce9e46a0e62c68578e1670dc4b1ea249db7941bed0b113ee"
      },
      "sourceHash": "22931373726fdcb5ce9e46a0e62c68578e1670dc4b1ea249db7941bed0b113ee",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "blade",
        "antenna"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-05-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.3431794871795,
            405.3628034188034
          ],
          "rightEye": [
            275.2551794871795,
            405.3628034188034
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe4a90ea47be4edb748c5762e608cbbb1c420d0b61f13333c6ef535e834c1074",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/06": {
    "source": {
      "tribe": "spore",
      "mask": 6,
      "sourceId": "unit-appearance-v1-spore-06-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-06-neutral-v1",
        "sourceHash": "9301191af9e4705a1d001f74ec3efeca461895ad1e02f83690a9eee203cef688"
      },
      "sourceHash": "9301191af9e4705a1d001f74ec3efeca461895ad1e02f83690a9eee203cef688",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "carapace",
        "antenna"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-06-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            235.6531965811966,
            408.52458119658115
          ],
          "rightEye": [
            275.39664957264955,
            408.52458119658115
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe326448660d4de7fd138873e45e94e1904be8e4db132b0f10e0ac7ceae677e7",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/08": {
    "source": {
      "tribe": "spore",
      "mask": 8,
      "sourceId": "unit-appearance-v1-spore-08-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-08-neutral-v1",
        "sourceHash": "c7c8af501f87b00a91128639f607628888856fdc1223962123fbbb8e3e840e85"
      },
      "sourceHash": "c7c8af501f87b00a91128639f607628888856fdc1223962123fbbb8e3e840e85",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-08-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            235.30482051282053,
            396.56745299145297
          ],
          "rightEye": [
            275.87972649572646,
            396.56745299145297
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "5d8ec10efbd6eda6c45f3060644fe5c88896e211c151c5979b28d4122f38d76b",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/09": {
    "source": {
      "tribe": "spore",
      "mask": 9,
      "sourceId": "unit-appearance-v1-spore-09-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-09-neutral-v1",
        "sourceHash": "ba06f051f894a18a43a0508988347b4ce66a7947f80b38e6befd38daaf8b517d"
      },
      "sourceHash": "ba06f051f894a18a43a0508988347b4ce66a7947f80b38e6befd38daaf8b517d",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "blade",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-09-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.31835897435897,
            392.90905982905986
          ],
          "rightEye": [
            275.8955213675214,
            392.90905982905986
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe4a90ea47be4edb748c5762e608cbbb1c420d0b61f13333c6ef535e834c1074",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/0a": {
    "source": {
      "tribe": "spore",
      "mask": 10,
      "sourceId": "unit-appearance-v1-spore-0a-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-0a-neutral-v1",
        "sourceHash": "adb0d16c936b265cc96fb4b528955b37b4d6b36b4b2a57ee84f185a351435689"
      },
      "sourceHash": "adb0d16c936b265cc96fb4b528955b37b4d6b36b4b2a57ee84f185a351435689",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "carapace",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-0a-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.8036923076923,
            399.89326495726493
          ],
          "rightEye": [
            276.0482735042735,
            399.89326495726493
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe326448660d4de7fd138873e45e94e1904be8e4db132b0f10e0ac7ceae677e7",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/0c": {
    "source": {
      "tribe": "spore",
      "mask": 12,
      "sourceId": "unit-appearance-v1-spore-0c-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-0c-neutral-v1",
        "sourceHash": "614c66394d371338cc612f8757148487f9733153a25e45154d6775a55f1da766"
      },
      "sourceHash": "614c66394d371338cc612f8757148487f9733153a25e45154d6775a55f1da766",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "antenna",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-0c-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            235.9880341880342,
            396.56745299145297
          ],
          "rightEye": [
            276.8955213675214,
            396.56745299145297
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "5d8ec10efbd6eda6c45f3060644fe5c88896e211c151c5979b28d4122f38d76b",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/0d": {
    "source": {
      "tribe": "spore",
      "mask": 13,
      "sourceId": "unit-appearance-v1-spore-0d-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-0d-neutral-v1",
        "sourceHash": "87b6b10edaf1f6877f3edf3bd0aff82560a866cd1e618ad141b4df9c91dc1612"
      },
      "sourceHash": "87b6b10edaf1f6877f3edf3bd0aff82560a866cd1e618ad141b4df9c91dc1612",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "blade",
        "antenna",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-0d-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.50947008547007,
            392.90905982905986
          ],
          "rightEye": [
            275.2551794871795,
            392.90905982905986
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe4a90ea47be4edb748c5762e608cbbb1c420d0b61f13333c6ef535e834c1074",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/0e": {
    "source": {
      "tribe": "spore",
      "mask": 14,
      "sourceId": "unit-appearance-v1-spore-0e-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-0e-neutral-v1",
        "sourceHash": "40027c8c48a436d8a6dc4016b3ce11fd0116c185fb1a42066fc7da0f27a671a3"
      },
      "sourceHash": "40027c8c48a436d8a6dc4016b3ce11fd0116c185fb1a42066fc7da0f27a671a3",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "carapace",
        "antenna",
        "feet"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-0e-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            235.6531965811966,
            399.89326495726493
          ],
          "rightEye": [
            275.39664957264955,
            399.89326495726493
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "fe326448660d4de7fd138873e45e94e1904be8e4db132b0f10e0ac7ceae677e7",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/10": {
    "source": {
      "tribe": "spore",
      "mask": 16,
      "sourceId": "unit-appearance-v1-spore-10-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_855ca484695d4a3eb76d94115969162d",
        "item": 0
      },
      "sourceHash": "9fd51c65eba741c15c8f1cbd6be3b1e47fa5591202655adfee5e4ba729f0641e",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-10-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            237.5,
            411.5
          ],
          "rightEye": [
            275.5,
            411.5
          ],
          "ground": [
            256,
            448
          ],
          "supportPoint": [
            257,
            447.5
          ],
          "supportPixelBounds": [
            221,
            440,
            72,
            8
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "approved-art-reuse",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/spore/10/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/14": {
    "source": {
      "tribe": "spore",
      "mask": 20,
      "sourceId": "unit-appearance-v1-spore-14-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-14-neutral-v1",
        "sourceHash": "170729416daba46a04e8c2fa6ef879dc2f34464b295f44e6fc606347f0c5bbce"
      },
      "sourceHash": "170729416daba46a04e8c2fa6ef879dc2f34464b295f44e6fc606347f0c5bbce",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "antenna",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-14-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.57768707482995,
            407.6625850340136
          ],
          "rightEye": [
            274.9602721088435,
            407.6625850340136
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "4d61107779095a8bd3efbc3302978a9a3644e03b03f0a48c0202032268d697df",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/18": {
    "source": {
      "tribe": "spore",
      "mask": 24,
      "sourceId": "unit-appearance-v1-spore-18-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-18-neutral-v1",
        "sourceHash": "80d75811e9bada9438468506b0cbc580992cfb73b389037ffbbac841caf45944"
      },
      "sourceHash": "80d75811e9bada9438468506b0cbc580992cfb73b389037ffbbac841caf45944",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-18-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.5482993197279,
            400.9161904761905
          ],
          "rightEye": [
            275.261768707483,
            401.0816326530612
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "4d61107779095a8bd3efbc3302978a9a3644e03b03f0a48c0202032268d697df",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spore/1c": {
    "source": {
      "tribe": "spore",
      "mask": 28,
      "sourceId": "unit-appearance-v1-spore-1c-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a198e4-4d8c-7250-9b57-bef4b30f603f",
        "messageId": "Sentinel_d9eacf0a67648191b894e7d6f333b47f",
        "speaker": "user",
        "text": "포자버섯 원화는 다 오케이",
        "scope": "reviewed-neutral-source-art-only",
        "sourceId": "unit-appearance-v1-spore-1c-neutral-v1",
        "sourceHash": "4150bbe1f3087684cd3a5efe26f65bc8071d74144a03436bd24cf540d1993ed0"
      },
      "sourceHash": "4150bbe1f3087684cd3a5efe26f65bc8071d74144a03436bd24cf540d1993ed0",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": false,
      "visualBits": [
        "antenna",
        "feet",
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spore-1c-neutral-v1",
        "verified": false,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            236.57768707482995,
            401.0816326530612
          ],
          "rightEye": [
            274.9602721088435,
            401.0816326530612
          ],
          "ground": [
            256,
            448
          ]
        },
        "canonicalSpeciesSize": 0.38,
        "canonicalCoreLongest": 194.56
      },
      "provenance": {
        "kind": "imagegen-integrated-whole-body",
        "sourceHash": "4d61107779095a8bd3efbc3302978a9a3644e03b03f0a48c0202032268d697df",
        "referenceVerified": false,
        "reuseAuthorized": false
      }
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": false,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "pebble/00": {
    "source": {
      "tribe": "pebble",
      "mask": 0,
      "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
      "approvalState": "existing-reference",
      "approvalRef": null,
      "sourceHash": "9ecf44815d59ac26108dcf3b06f63d0df7637958aba28a09bc61efef5c77adb6",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [],
      "coreReference": {
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "verified": true,
        "coreBounds": [
          148,
          289,
          216,
          159
        ],
        "landmarks": {
          "leftEye": [
            211,
            377
          ],
          "rightEye": [
            300,
            377
          ],
          "ground": [
            256,
            448
          ],
          "supportPoint": [
            256,
            447.5
          ],
          "supportPixelBounds": [
            186,
            440,
            140,
            8
          ]
        },
        "canonicalSpeciesSize": 0.42,
        "canonicalCoreLongest": 215.04
      },
      "provenance": {
        "kind": "existing-original",
        "sourceHash": "b6c4cbfa62de5db79205779c1a354e9f87d7b074dc60bfcaadd97f6af792f1fe",
        "transform": {
          "scale": 0.18946255506607929,
          "offsetX": 137,
          "offsetY": 243,
          "sourceFrameWidth": 1254,
          "sourceFrameHeight": 1254
        },
        "referenceVerified": true,
        "reuseAuthorized": true
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/pebble/00/Source/neutral.png"
    },
    "actions": {
      "idle": {
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "image": "DesignAssets/Tribes/pebble/AnimationStudies/idle-v3/idle-v3.webp",
        "imageHash": "f34012e1cd157be0489e47b0c29b3107e37c5d3525363e30df642a588a004a37",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 64,
        "durationsMs": [
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100
        ],
        "loop": true,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "f34012e1cd157be0489e47b0c29b3107e37c5d3525363e30df642a588a004a37",
          "pixelsPerWorld": 966.6666666666666,
          "scale": 0.5296551724137931,
          "offsetX": 120.40827586206896,
          "offsetY": 210.71448275862068
        },
        "events": []
      },
      "walk": {
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "image": "DesignAssets/Tribes/pebble/AnimationStudies/walk-in-place-v1/walk.webp",
        "imageHash": "ca40b3960462707a75183261a324b50a92e9b73735c0e5f9fa4b8e0c8ade4243",
        "frameSize": 512,
        "columns": 5,
        "frameCount": 20,
        "durationsMs": [
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40,
          40
        ],
        "loop": true,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "ca40b3960462707a75183261a324b50a92e9b73735c0e5f9fa4b8e0c8ade4243",
          "pixelsPerWorld": 966.6666666666666,
          "scale": 0.5296551724137931,
          "offsetX": 120.40827586206896,
          "offsetY": 210.71448275862068
        },
        "events": []
      },
      "jump": {
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "image": "DesignAssets/Tribes/pebble/Animations/Units/jump/jump.webp",
        "imageHash": "482ba8aad3ec26743c3a7258568b9489672597cea5bcc47c9a800a2ae6be870d",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70
        ],
        "loop": false,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "482ba8aad3ec26743c3a7258568b9489672597cea5bcc47c9a800a2ae6be870d",
          "pixelsPerWorld": 1002.3809523809524,
          "scale": 0.5107838479809976,
          "offsetX": 125.2393349168646,
          "offsetY": 219.16883610451305
        },
        "events": []
      },
      "attack": {
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "image": "DesignAssets/Tribes/pebble/AnimationStudies/attack-directions-v3/right/attack.webp",
        "imageHash": "385db115850e1a9a927ff0d44888bb54fb806b682bab67cb49c23f38daf91188",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          60,
          70,
          60,
          80,
          30,
          50,
          50,
          50,
          50,
          50,
          50,
          70,
          80,
          90,
          100,
          60
        ],
        "loop": false,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "385db115850e1a9a927ff0d44888bb54fb806b682bab67cb49c23f38daf91188",
          "pixelsPerWorld": 961.9047619047618,
          "scale": 0.5322772277227723,
          "offsetX": 119.73702970297029,
          "offsetY": 209.539801980198
        },
        "events": []
      },
      "hurt": {
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "image": "DesignAssets/Tribes/pebble/AnimationStudies/hurt-v2/hurt-v2.webp",
        "imageHash": "2f879a2f5386ff14ce5819759647479108657e2e9295b33c1a058440d182b3a0",
        "frameSize": 517,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          20,
          30,
          30,
          30,
          400,
          30,
          30,
          30,
          20,
          20,
          20,
          20,
          20,
          20,
          20,
          20
        ],
        "loop": false,
        "pivotX": 258.5,
        "pivotY": 453.5943396226415,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "2f879a2f5386ff14ce5819759647479108657e2e9295b33c1a058440d182b3a0",
          "pixelsPerWorld": 966.6666666666666,
          "scale": 0.5296551724137931,
          "offsetX": 119.08413793103449,
          "offsetY": 207.7514118412492
        },
        "events": []
      },
      "death": {
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "image": "DesignAssets/Tribes/pebble/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png",
        "imageHash": "ec1dffe7baec15492c0f2e188a930a84bd1eabfb2744079cbc87d14fcf01afb4",
        "frameSize": 517,
        "columns": 4,
        "frameCount": 8,
        "durationsMs": [
          120,
          100,
          140,
          120,
          140,
          100,
          120,
          600
        ],
        "loop": false,
        "pivotX": 258.5,
        "pivotY": 453.5943396226415,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "ec1dffe7baec15492c0f2e188a930a84bd1eabfb2744079cbc87d14fcf01afb4",
          "pixelsPerWorld": 966.6666666666666,
          "scale": 0.5296551724137931,
          "offsetX": 119.08413793103449,
          "offsetY": 207.7514118412492
        },
        "events": []
      }
    },
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    },
    "sceneActions": {
      "birth": {
        "contractVersion": 1,
        "kind": "native-body-with-external-legacy-scene",
        "tribe": "pebble",
        "mask": 0,
        "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
        "runtimeEnabled": true,
        "independentBodyAction": false,
        "integrationStatus": "legacy-scene-body-adapter",
        "body": {
          "sourceId": "unit-appearance-v1-pebble-00-neutral-v1",
          "image": "DesignAssets/Tribes/pebble/AnimationStudies/birth-den-v1/birth-unit.webp",
          "sourceHash": "d8b762b189ea9767c2026dbfb692750a21b761bdd2514a5626e77f156cb76129",
          "frameSize": 151,
          "columns": 8,
          "frameCount": 48,
          "durationsMs": [
            80,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            40,
            700
          ],
          "loop": false,
          "pivotX": 75.5,
          "pivotY": 135.6640625,
          "cameraMapping": {
            "verified": true,
            "sourceHash": "d8b762b189ea9767c2026dbfb692750a21b761bdd2514a5626e77f156cb76129",
            "pixelsPerWorld": 217.68043154761907,
            "scale": 2.3520717795342874,
            "offsetX": 78.41858064516131,
            "offsetY": 128.90838709677422,
            "method": "preserve-existing-game-fixed-native-birth-body-camera"
          }
        },
        "externalRoot": {
          "module": "client/birth.mjs",
          "export": "pebbleBirthPlacement",
          "ownsWorldTravel": true,
          "targetFloorWorld": 0.7789062499999999
        },
        "deformation": {
          "kind": "none",
          "module": "client/birth.mjs",
          "moduleHash": "0e8009e12eaa98126aab60833a8c5cd397be78b51b974cd9bfd26571f15d5c36",
          "export": null,
          "nativeHeight": 67.537109375,
          "nativeOutletX": 75.5,
          "nativeOutletY": 135.6640625,
          "nativeCenterX": 75.5,
          "nativePivotY": 135.6640625,
          "rowStep": null
        },
        "visibility": {
          "firstBodyFrame": 0,
          "lastFramePolicy": "handoff-to-registered-idle",
          "lastFrame": 47
        },
        "nativeFrameSampling": "original-sheet-source-rect",
        "legacyPixelStage": {
          "displayScale": 0.990967741935484,
          "nativeWorldPerPixelBeforeDisplay": 0.004635761589403973,
          "agentHeight": 0.7,
          "canonicalFrameSize": 512,
          "referenceHeight": null,
          "unitHeight": 229,
          "unitPivotY": 460,
          "commonFloorOffsetFromHalfCell": 0.44
        },
        "floorOffsetWorld": -0.028830967741935516,
        "separatedSceneAssets": [
          {
            "role": "foreground",
            "image": "DesignAssets/Tribes/pebble/AnimationStudies/birth-den-v1/birth-foreground.png",
            "sourceHash": "55679e22e1abfef2b6964aee486210cfc0a2fbd81a2f05957ce6e22f58847cd3"
          }
        ],
        "legacyReference": {
          "file": "client/game.js",
          "function": "drawPebbleBirth",
          "sourceHash": "2b29deeb623b253a2eddad337c356194c95df3877eaaedc15190b18e6ab4ec79",
          "capture": "tools/native-appearance-registration-20261104/legacy-body-reference.json"
        },
        "ownership": {
          "bodyOnly": true,
          "originalPixelsPreserved": true,
          "perFrameFit": false,
          "sceneRootInsideBodyClip": false,
          "nestsOrWaterInsideBodyClip": false,
          "dnaGrowthApplications": 1
        },
        "validation": {
          "cameraVerified": true,
          "runtimeRendererConnected": true,
          "report": "tools/native-appearance-registration-20261104/scene-render-report.json"
        }
      }
    }
  },
  "pebble/10": {
    "source": {
      "tribe": "pebble",
      "mask": 16,
      "sourceId": "unit-appearance-v1-pebble-10-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_855ca484695d4a3eb76d94115969162d",
        "item": 0
      },
      "sourceHash": "cb9a17630710b5b4675b04eb4fadf1d82abea51562abd17f7e74839538031bc8",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-pebble-10-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            210.5,
            376.5
          ],
          "rightEye": [
            298.5,
            376.5
          ],
          "ground": [
            256,
            448
          ],
          "supportPoint": [
            256,
            447.5
          ],
          "supportPixelBounds": [
            185,
            440,
            142,
            8
          ]
        },
        "canonicalSpeciesSize": 0.42,
        "canonicalCoreLongest": 215.04
      },
      "provenance": {
        "kind": "approved-art-reuse",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/pebble/10/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  },
  "spring/00": {
    "source": {
      "tribe": "spring",
      "mask": 0,
      "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
      "approvalState": "existing-reference",
      "approvalRef": null,
      "sourceHash": "ed7fe474673a1736c810b5e5df17007650d9afb7a3def24652ab472908284872",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "verified": true,
        "coreBounds": [
          179,
          248,
          154,
          200
        ],
        "landmarks": {
          "leftEye": [
            221,
            377
          ],
          "rightEye": [
            290,
            377
          ],
          "ground": [
            256,
            448
          ],
          "supportPoint": [
            255,
            447.5
          ],
          "supportPixelBounds": [
            205,
            440,
            100,
            8
          ]
        },
        "canonicalSpeciesSize": 0.39,
        "canonicalCoreLongest": 199.68
      },
      "provenance": {
        "kind": "existing-original",
        "sourceHash": "88775abc86381ad98fdd686848ea84855b2ee1be390d181f5990dea547186ee7",
        "transform": {
          "scale": 0.19163147792706334,
          "offsetX": 135,
          "offsetY": 223,
          "sourceFrameWidth": 1254,
          "sourceFrameHeight": 1254
        },
        "referenceVerified": true,
        "reuseAuthorized": true
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/spring/00/Source/neutral.png"
    },
    "actions": {
      "idle": {
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "image": "DesignAssets/Tribes/spring/AnimationStudies/idle-v4/idle-v4.webp",
        "imageHash": "42cc7532e8f6e7b6ab7c200eebe4f5513be370f20ca36b2bdcf2c53058291f86",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 64,
        "durationsMs": [
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100
        ],
        "loop": true,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "42cc7532e8f6e7b6ab7c200eebe4f5513be370f20ca36b2bdcf2c53058291f86",
          "pixelsPerWorld": 738.4615384615385,
          "scale": 0.6933333333333334,
          "offsetX": 78.50666666666666,
          "offsetY": 137.38666666666666
        },
        "events": []
      },
      "walk": {
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "image": "DesignAssets/Tribes/spring/AnimationStudies/flow-v4/flow-v4.webp",
        "imageHash": "0c165ddad0dfaf87f1928885270b6e207e5d997cd3d97dd062dc8ee6b7e92fac",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70
        ],
        "loop": true,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "0c165ddad0dfaf87f1928885270b6e207e5d997cd3d97dd062dc8ee6b7e92fac",
          "pixelsPerWorld": 738.4615384615385,
          "scale": 0.6933333333333334,
          "offsetX": 78.50666666666666,
          "offsetY": 137.38666666666666
        },
        "events": []
      },
      "jump": {
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "image": "DesignAssets/Tribes/spring/Animations/Units/jump/jump.webp",
        "imageHash": "5084d72a897b7cd7b25926c0cd048356ee7d90324ffe2addb1e70c3933bd2e1b",
        "frameSize": 512,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70,
          70
        ],
        "loop": false,
        "pivotX": 256,
        "pivotY": 448,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "5084d72a897b7cd7b25926c0cd048356ee7d90324ffe2addb1e70c3933bd2e1b",
          "pixelsPerWorld": 764.1471571906354,
          "scale": 0.6700280112044819,
          "offsetX": 84.47282913165265,
          "offsetY": 147.82745098039214
        },
        "events": []
      },
      "attack": {
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "image": "DesignAssets/Tribes/spring/AnimationStudies/attack-directions-v3/right/attack.webp",
        "imageHash": "f6bf977bbfd72490410192c6c70e6ec17accb294f3f69e5b0626936760547e58",
        "frameSize": 516,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          60,
          70,
          60,
          80,
          30,
          60,
          16,
          16,
          16,
          16,
          32,
          40,
          52,
          76,
          100,
          276
        ],
        "loop": false,
        "pivotX": 258,
        "pivotY": 453.07317073170736,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "f6bf977bbfd72490410192c6c70e6ec17accb294f3f69e5b0626936760547e58",
          "pixelsPerWorld": 738.4615384615385,
          "scale": 0.6933333333333334,
          "offsetX": 77.12,
          "offsetY": 133.86926829268288
        },
        "events": []
      },
      "hurt": {
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "image": "DesignAssets/Tribes/spring/AnimationStudies/hurt-v2/hurt-v2.webp",
        "imageHash": "761914e25e0f4def4dc01f4fcadc711db0058a0919a750407a5b35930e5d9ba6",
        "frameSize": 516,
        "columns": 4,
        "frameCount": 16,
        "durationsMs": [
          20,
          30,
          30,
          30,
          400,
          30,
          30,
          30,
          20,
          20,
          20,
          20,
          20,
          20,
          20,
          20
        ],
        "loop": false,
        "pivotX": 258,
        "pivotY": 453.07317073170736,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "761914e25e0f4def4dc01f4fcadc711db0058a0919a750407a5b35930e5d9ba6",
          "pixelsPerWorld": 738.4615384615385,
          "scale": 0.6933333333333334,
          "offsetX": 77.12,
          "offsetY": 133.86926829268288
        },
        "events": []
      },
      "death": {
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "image": "DesignAssets/Tribes/spring/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png",
        "imageHash": "85be0868a66a515983d14d2e10dfdd58f3978cc113e512e52e67bcaac07ca593",
        "frameSize": 516,
        "columns": 4,
        "frameCount": 8,
        "durationsMs": [
          120,
          100,
          140,
          120,
          140,
          100,
          120,
          600
        ],
        "loop": false,
        "pivotX": 258,
        "pivotY": 453.07317073170736,
        "cameraMapping": {
          "verified": true,
          "sourceHash": "85be0868a66a515983d14d2e10dfdd58f3978cc113e512e52e67bcaac07ca593",
          "pixelsPerWorld": 738.4615384615385,
          "scale": 0.6933333333333334,
          "offsetX": 77.12,
          "offsetY": 133.86926829268288
        },
        "events": []
      }
    },
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    },
    "sceneActions": {
      "birth": {
        "contractVersion": 1,
        "kind": "native-body-with-external-legacy-scene",
        "tribe": "spring",
        "mask": 0,
        "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
        "runtimeEnabled": true,
        "independentBodyAction": false,
        "integrationStatus": "legacy-scene-body-adapter",
        "body": {
          "sourceId": "unit-appearance-v1-spring-00-neutral-v1",
          "image": "DesignAssets/Tribes/spring/AnimationStudies/birth-detach-v1/birth-unit.webp",
          "sourceHash": "01d1eafb5d7d0886dceabbfd8b249d5aae06512e4e507e732ef51e637e3deb00",
          "frameSize": 236,
          "columns": 4,
          "frameCount": 13,
          "durationsMs": [
            130,
            120,
            100,
            100,
            80,
            260,
            80,
            90,
            90,
            100,
            100,
            130,
            410
          ],
          "loop": false,
          "pivotX": 147.5,
          "pivotY": 206.5,
          "cameraMapping": {
            "verified": true,
            "sourceHash": "01d1eafb5d7d0886dceabbfd8b249d5aae06512e4e507e732ef51e637e3deb00",
            "pixelsPerWorld": 252.90073440678546,
            "scale": 2.0245097397639773,
            "offsetX": -42.615186615186644,
            "offsetY": 29.938738738738664,
            "method": "preserve-existing-game-fixed-native-birth-body-camera"
          }
        },
        "externalRoot": {
          "module": "client/birth.mjs",
          "export": "springBirthPlacement",
          "ownsWorldTravel": true,
          "targetFloorWorld": 0.808
        },
        "deformation": {
          "kind": "spring-row-surface-v1",
          "module": "client/birth.mjs",
          "moduleHash": "0e8009e12eaa98126aab60833a8c5cd397be78b51b974cd9bfd26571f15d5c36",
          "export": "springBirthMotion",
          "nativeHeight": 103.25,
          "nativeOutletX": 39.640625,
          "nativeOutletY": 48.3984375,
          "nativeCenterX": 147.5,
          "nativePivotY": 206.5,
          "rowStep": 2
        },
        "visibility": {
          "firstBodyFrame": 0,
          "lastFramePolicy": "handoff-to-registered-idle",
          "lastFrame": 12
        },
        "nativeFrameSampling": "original-sheet-source-rect",
        "legacyPixelStage": {
          "displayScale": 0.8531862474719618,
          "nativeWorldPerPixelBeforeDisplay": 0.004634533898305085,
          "agentHeight": 0.7,
          "canonicalFrameSize": 512,
          "referenceHeight": 350,
          "unitHeight": null,
          "unitPivotY": null,
          "commonFloorOffsetFromHalfCell": 0.44
        },
        "floorOffsetWorld": 0,
        "separatedSceneAssets": [
          {
            "role": "water",
            "module": "client/birth.mjs",
            "export": "drawSpringBirthWater"
          }
        ],
        "legacyReference": {
          "file": "client/game.js",
          "function": "drawSpringBirth",
          "sourceHash": "0a60558a47b5d682affa97659ee6a3cab48921f58e7a3f5c1c7dd5f47d6d6f65",
          "capture": "tools/native-appearance-registration-20261104/legacy-body-reference.json"
        },
        "ownership": {
          "bodyOnly": true,
          "originalPixelsPreserved": true,
          "perFrameFit": false,
          "sceneRootInsideBodyClip": false,
          "nestsOrWaterInsideBodyClip": false,
          "dnaGrowthApplications": 1
        },
        "validation": {
          "cameraVerified": true,
          "runtimeRendererConnected": true,
          "report": "tools/native-appearance-registration-20261104/scene-render-report.json"
        }
      }
    }
  },
  "spring/10": {
    "source": {
      "tribe": "spring",
      "mask": 16,
      "sourceId": "unit-appearance-v1-spring-10-neutral-v1",
      "approvalState": "approved",
      "approvalRef": {
        "sourceThread": "01a1a155-d06b-7243-b396-e5c947a4714e",
        "callId": "call_855ca484695d4a3eb76d94115969162d",
        "item": 0
      },
      "sourceHash": "874aa82196597810813cf72f7506d96c5255c427d763fe06dddc271b0a72fbd2",
      "frameWidth": 512,
      "frameHeight": 512,
      "pivot": {
        "x": 256,
        "y": 448
      },
      "camera": {
        "pixelsPerWorld": 512
      },
      "cameraVerified": true,
      "visualBits": [
        "secretion"
      ],
      "coreReference": {
        "sourceId": "unit-appearance-v1-spring-10-neutral-v1",
        "verified": true,
        "coreBounds": null,
        "landmarks": {
          "leftEye": [
            217,
            375.5
          ],
          "rightEye": [
            269,
            375.5
          ],
          "ground": [
            256,
            448
          ],
          "supportPoint": [
            256,
            448.5
          ],
          "supportPixelBounds": [
            208,
            441,
            96,
            8
          ]
        },
        "canonicalSpeciesSize": 0.39,
        "canonicalCoreLongest": 199.68
      },
      "provenance": {
        "kind": "approved-art-reuse",
        "referenceVerified": false,
        "reuseAuthorized": false
      },
      "image": "DesignAssets/Animations/UnitAppearanceV1/spring/10/Source/neutral.png"
    },
    "actions": {},
    "previewStatus": {},
    "readiness": {
      "sourceApproved": true,
      "cameraVerified": true,
      "actionSetComplete": false,
      "worldReady": false,
      "ready": false
    }
  }
});

return {UNIT_APPEARANCE_ASSETS};
})();
modules["server/tribe-dna-stats.mjs"] = (() => {
const TRIBE_DNA_STATS = Object.freeze(Object.fromEntries(Object.entries({
  bean: {
    base: { health: 1, armor: 0, meleePower: 1, rangedPower: 1, meleeSpeed: 1, rangedSpeed: 1, movement: 1 },
    growth: {}
  },
  pebble: {
    base: { health: 1.2, armor: 6, meleePower: .85, rangedPower: .85, meleeSpeed: .9, rangedSpeed: .9, movement: .9 },
    growth: { health: 1.2, carapace: 1.6, armor: 1.6, power: .85, rangedPower: .85, speed: .9, rangedSpeed: .9,
      block: 1.2, tenacity: 1.2, reduction: 1.15, reflection: 1.2, regeneration: 1.2, evasion: .8, movement: .85 }
  },
  spore: {
    base: { health: .9, armor: 0, meleePower: .85, rangedPower: 1.15, meleeSpeed: .95, rangedSpeed: 1.05, movement: 1 },
    growth: { health: .85, carapace: .85, armor: .85, power: .8, rangedPower: 1.25, speed: .9, rangedSpeed: 1.15,
      accuracy: 1.2, penetration: 1.1, critical: 1.1, evasion: .9, block: .85, regeneration: .9, movement: .95 }
  },
  spring: {
    base: { health: .95, armor: 0, meleePower: 1.1, rangedPower: .85, meleeSpeed: 1.05, rangedSpeed: .95, movement: 1.1 },
    growth: { health: .95, carapace: .8, armor: .8, power: 1.2, rangedPower: .8, speed: 1.15, rangedSpeed: .9,
      evasion: 1.2, parry: 1.1, counter: 1.15, lifesteal: 1.15, regeneration: 1.05, focus: 1.1, movement: 1.15 }
  }
}).map(([tribe, profile]) => [tribe, Object.freeze({ base: Object.freeze(profile.base), growth: Object.freeze(profile.growth) })])));

function tribeDnaStats(tribe) {
  return Object.hasOwn(TRIBE_DNA_STATS, tribe) ? TRIBE_DNA_STATS[tribe] : TRIBE_DNA_STATS.bean;
}

return { TRIBE_DNA_STATS, tribeDnaStats };
})();
modules["server/dna-combat-stats.mjs"] = (() => {
const { tribeDnaStats } = modules["server/tribe-dna-stats.mjs"];

const DNA_COMBAT_RULES = Object.freeze({
  basicPower: 1,
  powerCurve: "linear", powerBase: 2, powerGain: 2, powerKnee: 2,
  rangedPowerBase: 1.4, rangedPowerGain: 1.4, rangedPowerKnee: 2,
  rangedAttackRateBase: .5, rangedHasteCap: 7, rangedHasteKnee: 70,
  healthBase: 10, healthPerPoint: 10, armorPerPoint: 1, armorCap: 1, armorKnee: 100,
  flatPenPerPoint: 1, percentPenCap: .8, percentPenKnee: 4,
  attackRateBase: .5, hasteCap: 7, hasteKnee: 70, maxActionRate: 4,
  windupBase: .3, focusPerPoint: .02, windupMinimum: .08,
  hitGapBase: .12, hitSpeedPerPoint: .005, hitGapMinimum: .06, recovery: 0,
  defensePreparation: 0, reactionCooldown: 0, counterCooldown: 0,
  followupBase: .5, comboPerPoint: .05, followupCap: 1,
  critCap: .75, critKnee: 18.75, critMultiplierBase: 1.5, critMultiplierCap: 4, critPowerKnee: 25,
  accuracyCap: .6, accuracyKnee: 20, dodgeCap: .6, dodgeKnee: 20,
  parryCap: .6, parryKnee: 15, blockCap: .75, blockKnee: 15,
  blockReductionBase: .5, blockReductionCap: .5, blockPowerKnee: 10,
  counterCap: 1, counterKnee: 10, counterMultiplierBase: 1, counterMultiplierCap: 2,
  counterPowerKnee: 10, counterWindup: .12,
  tenacityCap: .75, tenacityKnee: 15, stunCap: .3, stunKnee: 10,
  stunDurationBase: .25, stunDurationPerPoint: .05, stunDurationCap: 1, stunImmunity: 2,
  drainCap: .2, drainKnee: 20, jitter: .2
});

function dnaCombatStats(counts, weights, inputRules, tribe) {
  const rules = inputRules || DNA_COMBAT_RULES, profile = tribeDnaStats(tribe), base = profile.base, c = counts;
  const n = Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value * (profile.growth[key] ?? 1)]));
  const capped = (count, cap, knee) => count ? Math.min(cap, cap * count / (knee || 1)) : 0;
  const powerGain = (count, gain, knee) => rules.powerCurve === "log" ?
    gain * Math.log1p(count / knee) / Math.log1p(1 / knee) : gain * count;
  const melee = !!c.blade, ranged = !!c.secretion, attack = melee || ranged, defensiveMelee = !attack;
  // A basic body can defend itself without gaining an offensive organ or its upgrades.
  const meleePower = melee ? rules.powerBase * base.meleePower * c.blade + powerGain(n.power || 0, rules.powerGain, rules.powerKnee) : defensiveMelee ? rules.basicPower : 0;
  const rangedPower = ranged ? rules.rangedPowerBase * base.rangedPower * c.secretion + powerGain(n.rangedPower || 0, rules.rangedPowerGain, rules.rangedPowerKnee) : 0;
  const meleeSpeed = melee ? Math.min(rules.maxActionRate, rules.attackRateBase * base.meleeSpeed * (1 + capped(n.speed || 0, rules.hasteCap, rules.hasteKnee))) : defensiveMelee ? Math.min(rules.maxActionRate, rules.attackRateBase) : 0;
  const rangedSpeed = ranged ? Math.min(rules.maxActionRate, rules.rangedAttackRateBase * base.rangedSpeed * (1 + capped(n.rangedSpeed || 0, rules.rangedHasteCap, rules.rangedHasteKnee))) : 0;
  return { bladeCount: c.blade || 0, secretionCount: c.secretion || 0,
    melee, ranged, defensiveMelee, meleePower, meleeSpeed, rangedPower, rangedSpeed,
    ...(rules.recovery ? { recovery: rules.recovery } : {}),
    health: rules.healthBase * base.health + rules.healthPerPoint * (n.health || 0),
    power: melee || defensiveMelee ? meleePower : rangedPower, hits: attack ? 1 + (n.combo || 0) : 1, speed: melee || defensiveMelee ? meleeSpeed : rangedSpeed,
    armor: base.armor + rules.armorPerPoint * ((n.armor || 0) + (n.carapace || 0)),
    parry: 100 * capped(n.parry || 0, rules.parryCap, rules.parryKnee),
    block: 100 * capped(n.block || 0, rules.blockCap, rules.blockKnee),
    evasion: 100 * capped((n.evasion || 0) + (n.legs || 0), rules.dodgeCap, rules.dodgeKnee),
    comboPower: attack ? 100 * Math.min(rules.followupCap, rules.followupBase + rules.comboPerPoint * (n.comboPower || 0)) : 0,
    critical: attack ? 100 * capped(n.critical || 0, rules.critCap, rules.critKnee) : 0,
    criticalPower: attack ? 100 * (rules.critMultiplierBase + capped(n.criticalPower || 0, rules.critMultiplierCap - rules.critMultiplierBase, rules.critPowerKnee)) : 0,
    accuracy: attack ? 100 * capped(n.accuracy || 0, rules.accuracyCap, rules.accuracyKnee) : 0,
    penetration: attack ? rules.flatPenPerPoint * (n.penetration || 0) : 0,
    ...(n.percentPen ? { armorPenetration: capped(n.percentPen, rules.percentPenCap, rules.percentPenKnee) } : {}),
    blockPower: 100 * DNA_COMBAT_RULES.blockReductionBase,
    counter: attack ? 100 * capped(n.counter || 0, rules.counterCap, rules.counterKnee) : 0,
    counterPower: attack ? 100 * (rules.counterMultiplierBase + capped(n.counterPower || 0, rules.counterMultiplierCap - rules.counterMultiplierBase, rules.counterPowerKnee)) : 0,
    tenacity: 100 * capped(n.tenacity || 0, rules.tenacityCap, rules.tenacityKnee), reduction: Math.min(40, 2 * (n.reduction || 0)),
    stun: attack ? 100 * capped(n.stun || 0, rules.stunCap, rules.stunKnee) : 0,
    stunTime: attack && n.stun ? Math.min(rules.stunDurationCap, rules.stunDurationBase + rules.stunDurationPerPoint * (n.stunTime || 0)) : 0,
    bleed: attack ? Math.min(75, 5 * (n.bleed || 0)) : 0, bleedPower: attack && n.bleed ? 1 + (n.bleedPower || 0) : 0,
    area: attack ? Math.min(5, n.area || 0) : 0, areaPower: attack && n.area ? Math.min(75, 35 + 5 * (n.areaPower || 0)) : 0,
    lifesteal: attack ? 100 * capped(n.lifesteal || 0, rules.drainCap, rules.drainKnee) : 0,
    reflection: Math.min(30, 3 * (n.reflection || 0)), regeneration: .1 * (n.regeneration || 0),
    comboSpeed: attack ? Math.max(rules.hitGapMinimum, rules.hitGapBase - rules.hitSpeedPerPoint * (n.comboSpeed || 0)) : rules.hitGapBase,
    focus: attack ? Math.max(rules.windupMinimum, rules.windupBase - rules.focusPerPoint * (n.focus || 0)) : rules.windupBase };
}

return { DNA_COMBAT_RULES, dnaCombatStats };
})();
modules["client/unit-size.mjs"] = (() => {
const UNIT_DISPLAY_SIZES = Object.freeze({
  bean: .40, spore: .38, pebble: .42, spring: .39,
  "flower-tail-bird": .26, "dew-rabbit": .29, "cotton-sheep": .32,
  "soil-mole": .35, "bundle-snail": .38, "rolling-acorn": .38,
  "bubble-toad": .52, "vine-turtle": .52, "spiny-back-beetle": .58,
  "snare-vine": .62, "soil-boar": .66, "shadow-weasel": .72, "talon-owl": .78,
  "spring-keeper": .88, "lantern-keeper": .92, "old-garden-snail": 1.00, "walking-forest": 1.12,
  "spiny-back-leader": 1.24, "white-paw": 1.44
});

function unitDisplaySize(unit) {
  const count = Array.isArray(unit.dna?.pieces) ? unit.dna.pieces.length :
    Number.isFinite(unit.stats?.pieceCount) ? Math.max(0, unit.stats.pieceCount) : 0;
  const scale = 1 + .01 * count;
  const size = (UNIT_DISPLAY_SIZES[unit.species || unit.tribe || "bean"] || UNIT_DISPLAY_SIZES.bean) * scale;
  return UNIT_DISPLAY_SIZES.bean + (size - UNIT_DISPLAY_SIZES.bean) * .5;
}

function combatViewCell(width, height) {
  return Math.min(width * .18, height * .2) / UNIT_DISPLAY_SIZES.bean;
}

function combatViewAxis(spans) {
  const intervals = [];
  for (const span of spans.sort((a, b) => a[0] - b[0])) {
    const last = intervals.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else intervals.push([...span]);
  }
  const occupied = (from, to) => intervals.reduce((length, span) => length + Math.max(0, Math.min(to, span[1]) - Math.max(from, span[0])), 0);
  const project = (value, gap) => value * gap + (value >= 0 ? occupied(0, value) : -occupied(value, 0)) * (1 - gap);
  const unproject = (value, gap) => {
    for (const span of intervals) {
      const start = project(span[0], gap), end = start + span[1] - span[0];
      if (value < start) return gap ? span[0] + (value - start) / gap : span[0];
      if (value <= end) return span[0] + value - start;
    }
    const end = intervals.at(-1)[1];
    return end + (value - project(end, gap)) / (gap || 1);
  };
  return { low: intervals[0][0], high: intervals.at(-1)[1], occupied, project, unproject };
}

function combatViewLayout(width, height, units, camera) {
  if (!camera) return combatViewFormation(width, height, units);
  if (!camera.layout) {
    camera.layout = combatViewFormation(width, height, units);
    camera.width = width; camera.height = height;
  }
  const initial = camera.layout, ratio = Math.min(width / camera.width, height / camera.height);
  const offsetX = (width - camera.width * ratio) / 2, offsetY = (height - camera.height * ratio) / 2;
  const resize = point => ({ x: point.x * ratio + offsetX, y: point.y * ratio + offsetY });
  const project = initial.project && (point => resize(initial.project(point)));
  const unproject = initial.unproject && (point => initial.unproject({ x: (point.x - offsetX) / ratio, y: (point.y - offsetY) / ratio }));
  const cell = initial.cell * ratio;
  const positions = new Map(units.map(unit => {
    const point = unit.combat?.position || unit.combatPosition;
    const origin = initial.positions.get(String(unit.id)) || { x: camera.width * ((unit.combat?.side ?? unit.side) ? .75 : .25), y: camera.height * .68 };
    const { x, y } = project && Number.isFinite(point?.x) && Number.isFinite(point?.y) ? project(point) : resize(origin);
    const size = unitDisplaySize(unit);
    return [String(unit.id), { x, y, bounds: { left: x - size * cell * .65, right: x + size * cell * .65,
      top: y - size * cell * 1.2, bottom: y + size * cell * .18 } }];
  }));
  return { cell, positions, project, unproject };
}

function combatViewFormation(width, height, units) {
  const located = units.map(unit => ({ unit, point: unit.combat?.position || unit.combatPosition }))
    .filter(entry => Number.isFinite(entry.point?.x) && Number.isFinite(entry.point?.y));
  if (located.length) {
    const axes = home => {
      const bodies = located.map(({ unit, point }) => {
        const size = unitDisplaySize(unit);
        const x = home && Number.isFinite(point.homeX) ? point.homeX : point.x;
        const y = (home && Number.isFinite(point.homeY) ? point.homeY : point.y) * .5;
        return { left: x - size * .65, right: x + size * .65, top: y - size * 1.2, bottom: y + size * .18 };
      });
      return { x: combatViewAxis(bodies.map(body => [body.left, body.right])),
        y: combatViewAxis(bodies.map(body => [body.top, body.bottom])) };
    };
    const home = axes(true), current = axes(false);
    const leftBody = home.x.occupied(home.x.low, 0), rightBody = home.x.occupied(0, home.x.high);
    const verticalBody = home.y.occupied(home.y.low, home.y.high);
    let cell = Math.min(combatViewCell(width, height, located.map(entry => entry.unit)),
      width * .44 / leftBody, width * .44 / rightBody, height * .72 / verticalBody);
    const gap = (span, body, available) => span > body ? Math.max(0, Math.min(1, (available - body) / (span - body))) : 1;
    const gapX = Math.min(gap(Math.max(0, -home.x.low), leftBody, width * .44 / cell),
      gap(Math.max(0, home.x.high), rightBody, width * .44 / cell));
    const gapY = gap(home.y.high - home.y.low, verticalBody, height * .72 / cell);
    const extentX = Math.max(Math.abs(current.x.project(current.x.low, gapX)), Math.abs(current.x.project(current.x.high, gapX)));
    const lowY = current.y.project(current.y.low, gapY), highY = current.y.project(current.y.high, gapY);
    cell = Math.min(cell, width * .44 / extentX, height * .72 / (highY - lowY));
    const project = point => ({ x: width * .5 + current.x.project(point.x, gapX) * cell,
      y: height * .55 + (current.y.project(point.y * .5, gapY) - (lowY + highY) / 2) * cell });
    const unproject = point => ({ x: current.x.unproject((point.x - width * .5) / cell, gapX),
      y: current.y.unproject((point.y - height * .55) / cell + (lowY + highY) / 2, gapY) * 2 });
    const positions = new Map(located.map(({ unit, point }) => {
      const { x, y } = project(point), size = unitDisplaySize(unit);
      return [String(unit.id), { x, y, bounds: { left: x - size * cell * .65, right: x + size * cell * .65,
        top: y - size * cell * 1.2, bottom: y + size * cell * .18 } }];
    }));
    return { cell, positions, project, unproject };
  }
  const teams = [0, 1].map(side => units.filter(unit => (unit.combat?.side ?? unit.side) === side));
  const count = Math.max(...teams.map(team => team.length));
  const positions = new Map();
  if (!count) return { cell: combatViewCell(width, height, units), positions };
  const columnCount = Math.min(count, Math.ceil(Math.sqrt(count * 1.5))), rowCount = Math.ceil(count / columnCount);
  const columns = Array(columnCount).fill(0), rows = Array(rowCount).fill(0);
  teams.forEach(team => team.forEach((unit, index) => {
    const size = unitDisplaySize(unit);
    columns[index % columnCount] = Math.max(columns[index % columnCount], size * 1.3);
    rows[Math.floor(index / columnCount)] = Math.max(rows[Math.floor(index / columnCount)], size);
  }));
  const gapX = Math.min(width * .035, width * .42 / (columnCount * 4));
  const gapY = Math.min(height * .035, height * .36 / (rowCount * 4));
  const totalWidth = columns.reduce((sum, value) => sum + value, 0);
  const rowSpans = rows.slice(1).map((size, index) => rows[index] * .18 + size * 1.2);
  const groundSpan = rowSpans.reduce((sum, value) => sum + value, 0);
  const cell = Math.min(combatViewCell(width, height, units),
    (width * .42 - gapX * (columnCount - 1)) / totalWidth,
    height * .44 / (rows[0] * 1.2), height * .08 / (rows[rowCount - 1] * .18),
    rowCount > 1 ? (height * .36 - gapY * (rowCount - 1)) / groundSpan : Infinity);
  const gridWidth = totalWidth * cell + gapX * (columnCount - 1);
  const gridHeight = groundSpan * cell + gapY * (rowCount - 1);
  const firstFoot = height * .5 + (height * .36 - gridHeight) / 2;
  teams.forEach((team, side) => team.forEach((unit, index) => {
    const column = index % columnCount, row = Math.floor(index / columnCount), size = unitDisplaySize(unit);
    const offsetX = columns.slice(0, column).reduce((sum, value) => sum + value, 0) * cell + gapX * column;
    const offsetY = rowSpans.slice(0, row).reduce((sum, value) => sum + value, 0) * cell + gapY * row;
    const x = width * (side ? .75 : .25) + (side ? -1 : 1) * (gridWidth / 2 - offsetX - columns[column] * cell / 2);
    const y = firstFoot + offsetY;
    positions.set(String(unit.id), { x, y, bounds: { left: x - size * cell * .65, right: x + size * cell * .65,
      top: y - size * cell * 1.2, bottom: y + size * cell * .18 } });
  }));
  return { cell, positions };
}

function unitFacing(unit) {
  return (unit.attack?.directionX || unit.facing || 1) < 0 ? -1 : 1;
}

function unitFrameMirror(sourceFacing, facing) {
  return (facing < 0) !== (sourceFacing === "left");
}

return { UNIT_DISPLAY_SIZES, unitDisplaySize, combatViewCell, combatViewLayout, unitFacing, unitFrameMirror };
})();
modules["server/dna-board.mjs"] = (() => {
const DNA_BOARD_SHAPES = Object.freeze({"capacity":[[0,0],[1,0],[2,0],[3,0]],"gather":[[0,0],[1,0],[2,0],[2,1]],"harvestSpeed":[[0,0],[1,0],[1,1],[2,1]],"health":[[0,0],[1,0],[0,1],[1,1]],"movement":[[0,0],[1,0],[-1,1],[0,-1]],"blade":[[0,0],[0,1],[1,-1],[2,-3],[2,-2]],"carapace":[[0,0],[0,1],[0,2],[1,0],[1,1]],"antenna":[[0,0],[0,1],[1,-1],[1,1],[2,-1]],"power":[[0,0],[0,1],[0,2],[1,-1],[1,0]],"speed":[[0,0],[1,-3],[1,-2],[1,-1],[2,-1]],"harvest":[[0,0],[0,1],[0,2],[1,-1],[2,-1]],"loadSpeed":[[0,0],[0,1],[0,2],[0,3],[0,4]],"secretion":[[0,0],[0,1],[1,-1],[1,0],[2,0]],"rangedPower":[[0,0],[0,1],[0,2],[1,0],[2,0]],"rangedSpeed":[[0,0],[0,1],[0,2],[1,0],[2,-1]],"legs":[[0,0],[0,1],[1,-1],[2,-2],[3,-4],[3,-3]],"combo":[[0,0],[0,1],[1,-1],[1,0],[1,1],[2,-1]],"critical":[[0,0],[0,2],[1,0],[1,1],[2,-1],[2,1]],"accuracy":[[0,0],[0,1],[1,-1],[1,1],[2,-1],[2,0]],"armor":[[0,0],[1,-2],[1,-1],[1,0],[1,1],[2,-1]],"evasion":[[0,0],[0,1],[0,2],[0,3],[1,-1],[1,2]],"block":[[0,0],[0,1],[0,2],[1,-1],[2,-1],[3,-1]],"counter":[[0,0],[0,1],[1,-2],[1,-1],[2,-3],[2,-1]],"tenacity":[[0,0],[0,1],[1,-2],[1,-1],[1,0],[2,-2]],"vision":[[0,0],[0,1],[1,0],[2,-1],[3,-2],[3,-1]],"stun":[[0,0],[0,1],[0,2],[0,4],[1,2],[1,3]],"bleed":[[0,0],[0,1],[1,-2],[1,-1],[1,1],[2,-1]],"area":[[0,0],[1,-3],[1,-2],[1,-1],[2,-1],[3,-1]],"comboPower":[[0,0],[0,1],[1,-1],[2,-2],[3,-3],[4,-4],[5,-6],[5,-5]],"criticalPower":[[0,0],[0,1],[0,2],[1,-1],[1,0],[1,1],[2,-1],[2,0]],"penetration":[[0,0],[0,2],[1,0],[1,1],[2,-2],[2,-1],[2,1],[3,-1]],"parry":[[0,0],[0,1],[1,-2],[1,-1],[1,0],[2,-4],[2,-3],[3,-4]],"blockPower":[[0,0],[0,1],[0,2],[1,-1],[2,-1],[3,-1],[4,-2],[4,-1]],"counterPower":[[0,0],[1,-5],[1,-4],[1,-3],[1,-2],[1,-1],[2,-1],[3,-1]],"reduction":[[0,0],[1,-2],[1,-1],[1,0],[1,1],[2,-2],[2,-1],[3,-3]],"stunTime":[[0,0],[0,1],[1,-2],[1,-1],[1,1],[2,-4],[2,-3],[3,-3]],"bleedPower":[[0,0],[0,1],[1,-2],[1,-1],[2,-4],[2,-3],[3,-6],[3,-5]],"areaPower":[[0,0],[0,1],[1,-2],[1,-1],[1,1],[2,-1],[2,0],[3,-2]],"lifesteal":[[0,0],[0,1],[0,3],[1,0],[1,1],[1,2],[1,3],[2,1]],"reflection":[[0,0],[1,-4],[1,-3],[1,-2],[1,-1],[2,-3],[2,-2],[3,-2]],"regeneration":[[0,0],[0,1],[0,2],[1,-1],[1,2],[2,-1],[2,0],[2,1]],"comboSpeed":[[0,0],[0,1],[0,2],[1,0],[1,1],[2,-1],[3,-2],[4,-3]],"focus":[[0,0],[0,1],[1,-2],[1,-1],[1,1],[1,2],[2,-3],[2,2]]});

function dnaBoardCells(radius) {
  const cells = [];
  for (let r = -radius; r <= radius; r++) for (let q = -radius; q <= radius; q++) {
    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius) cells.push({ q, r });
  }
  return cells;
}

function dnaPieceCells(piece) {
  const shape = DNA_BOARD_SHAPES[piece.gene];
  if (!shape) return [];
  return shape.map(cell => {
    let [q, r] = cell;
    for (let turn = 0; turn < piece.rotation; turn++) [q, r] = [-r, q + r];
    return { q: q + piece.q, r: r + piece.r };
  });
}

function dnaBoardTrace(pieces, level, lookup, radius) {
  const paths = [], occupied = new Map(), outside = [], nodes = [];
  let reason = '', at = -1;
  const limit = radius(level), total = Number.isFinite(limit) ? 1 + 3 * limit * (limit + 1) : 0;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index], gene = lookup.get(piece?.gene);
    if (!gene || !Number.isInteger(piece.q) || !Number.isInteger(piece.r) || Math.abs(piece.q) > 1000 || Math.abs(piece.r) > 1000 ||
        !Number.isInteger(piece.rotation) || piece.rotation < 0 || piece.rotation > 5 || !Number.isInteger(piece.grade) || piece.grade < 1 || piece.grade > 4) {
      return { valid: false, reason: 'invalid', paths, nodes, occupied, outside, filled: occupied.size, total, complete: false, at: index };
    }
    if (Number.isInteger(level) && Math.max(piece.grade, gene.grade) > level && !reason) { reason = 'level'; at = index; }
    const points = dnaPieceCells(piece), start = { q: piece.q, r: piece.r };
    for (const point of points) {
      const key = point.q + ',' + point.r;
      if (occupied.has(key) && !reason) { reason = 'collision'; at = index; }
      if (Math.max(Math.abs(point.q), Math.abs(point.r), Math.abs(point.q + point.r)) > limit) {
        outside.push(point);
        if (!reason) { reason = 'boundary'; at = index; }
      }
      occupied.set(key, { kind: 'cell', index });
    }
    paths.push({ ...piece, start, points, end: points[points.length - 1] });
    nodes.push(start);
  }
  return { valid: !reason, reason, paths, nodes, occupied, outside, filled: occupied.size, total, complete: !reason && total > 0 && occupied.size === total, at };
}

function dnaBoardPack(pieces, level, radius) {
  const cells = dnaBoardCells(radius(level)), positions = cells.slice().sort((a, b) =>
    Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r), Math.abs(b.q + b.r)) || a.r - b.r || a.q - b.q);
  const keys = new Set(cells.map(cell => cell.q + ',' + cell.r));
  if (pieces.reduce((sum, piece) => sum + (DNA_BOARD_SHAPES[piece.gene]?.length || cells.length + 1), 0) > cells.length) return null;
  const ordered = pieces.map((piece, index) => ({ piece, index })).sort((a, b) => DNA_BOARD_SHAPES[b.piece.gene].length - DNA_BOARD_SHAPES[a.piece.gene].length);
  const occupied = new Set(), result = new Array(pieces.length);
  let remaining = 40000;
  function place(index) {
    if (index === ordered.length) return true;
    const { piece, index: original } = ordered[index];
    for (const point of positions) for (let turn = 0; turn < 6; turn++) {
      if (--remaining < 0) return false;
      const next = { gene: piece.gene, grade: piece.grade, rotation: (piece.rotation + turn) % 6, q: point.q, r: point.r };
      const footprint = dnaPieceCells(next).map(cell => cell.q + ',' + cell.r);
      if (footprint.some(key => !keys.has(key) || occupied.has(key))) continue;
      footprint.forEach(key => occupied.add(key));
      result[original] = next;
      if (place(index + 1)) return true;
      footprint.forEach(key => occupied.delete(key));
    }
    return false;
  }
  return place(0) ? result : null;
}
return { DNA_BOARD_SHAPES, dnaBoardCells, dnaPieceCells, dnaBoardTrace, dnaBoardPack };
})();
modules["server/dna.mjs"] = (() => {
const { DNA_BOARD_SHAPES, dnaBoardCells, dnaPieceCells, dnaBoardTrace, dnaBoardPack } = modules["server/dna-board.mjs"];
const { dnaCombatStats } = modules["server/dna-combat-stats.mjs"];
const { tribeDnaStats } = modules["server/tribe-dna-stats.mjs"];

const ATTRIBUTE_DNA = (() => {
  const colors = {organ:'#edba87',action:'#8fbbed',stat:'#87d7b8'};
  const definitions = [["blade","organ",20],["carapace","stat",10],["antenna","organ",20],["gather","organ",20],["legs","stat",20],["power","stat",10],["combo","action",14],["speed","stat",12],["comboPower","stat",12],["critical","stat",12],["criticalPower","stat",10],["accuracy","stat",10],["penetration","stat",12],["health","stat",10],["armor","stat",10],["evasion","stat",14],["parry","action",14],["block","action",12],["blockPower","stat",10],["counter","action",14],["counterPower","stat",10],["tenacity","stat",10],["reduction","stat",12],["movement","stat",10],["capacity","stat",10],["harvest","stat",10],["harvestSpeed","stat",10],["vision","stat",10],["loadSpeed","stat",10],null,["stun","action",16],["stunTime","stat",12],["bleed","action",16],["bleedPower","stat",12],["area","action",18],["areaPower","stat",12],["lifesteal","action",16],["reflection","action",16],["regeneration","action",14],["comboSpeed","stat",12],["focus","stat",12],null,["secretion","organ",20],["rangedPower","stat",12],["rangedSpeed","stat",12],null];
  const alphabet = 'ATGC';
  const genes = definitions.map((entry,index) => entry && ({id:entry[0],category:entry[1],price:entry[2]/2,code:alphabet[Math.floor(index/16)]+alphabet[Math.floor(index/4)%4]+alphabet[index%4],color:colors[entry[1]]})).filter(Boolean);
  const lookup = new Map(genes.map(gene=>[gene.id,gene]));
  const specification=[{"gene":"gather","grade":1,"order":1},{"gene":"health","grade":1,"order":3},{"gene":"blade","grade":2,"order":0},{"gene":"power","grade":2,"order":1},{"gene":"speed","grade":2,"order":2},{"gene":"capacity","grade":1,"order":0},{"gene":"movement","grade":1,"order":4},{"gene":"antenna","grade":2,"order":8},{"gene":"carapace","grade":2,"order":9},{"gene":"combo","grade":3,"order":0},{"gene":"legs","grade":3,"order":10,"retired":true},{"gene":"armor","grade":3,"order":11,"retired":true},{"gene":"vision","grade":3,"order":10},{"gene":"harvest","grade":2,"order":10,"retired":true},{"gene":"harvestSpeed","grade":1,"order":2},{"gene":"loadSpeed","grade":2,"order":11},{"gene":"accuracy","grade":3,"order":6},{"gene":"tenacity","grade":3,"order":7},{"gene":"block","grade":3,"order":8},{"gene":"evasion","grade":3,"order":9},{"gene":"parry","grade":4,"order":21},{"gene":"counter","grade":3,"order":2},{"gene":"critical","grade":3,"order":1},{"gene":"criticalPower","grade":4,"order":24},{"gene":"penetration","grade":4,"order":25},{"gene":"comboPower","grade":4,"order":26},{"gene":"blockPower","grade":4,"order":27},{"gene":"counterPower","grade":4,"order":28},{"gene":"reduction","grade":4,"order":29},{"gene":"stun","grade":3,"order":3},{"gene":"stunTime","grade":4,"order":31},{"gene":"bleed","grade":3,"order":4},{"gene":"bleedPower","grade":4,"order":33},{"gene":"area","grade":3,"order":5},{"gene":"areaPower","grade":4,"order":35},{"gene":"lifesteal","grade":4,"order":36},{"gene":"reflection","grade":4,"order":37},{"gene":"regeneration","grade":4,"order":38},{"gene":"comboSpeed","grade":4,"order":39},{"gene":"focus","grade":4,"order":40},{"gene":"secretion","grade":2,"order":3},{"gene":"rangedPower","grade":2,"order":4},{"gene":"rangedSpeed","grade":2,"order":5}];
  for(const entry of specification){const gene=lookup.get(entry.gene);gene.grade=entry.grade;gene.order=entry.order;if(entry.retired)gene.retired=true;gene.price=piecePrice({gene:gene.id,grade:gene.grade});}
  const catalog=genes.filter(gene=>!gene.retired).sort((a,b)=>a.grade-b.grade||a.order-b.order);

  for (const [index, gene] of genes.entries()) { gene.cells = DNA_BOARD_SHAPES[gene.id]; gene.fillColor = `hsl(${(index * 137.508 + 24) % 360} 48% 64%)`; }

  for(const [id,color] of Object.entries({capacity:'#71cdb9',gather:'#d8ba77',harvestSpeed:'#df8d96',health:'#db9d7e',movement:'#a6a1dd'}))lookup.get(id).fillColor=color;

  const boardRadii=[3,4,5,6];
  function boardRadius(level){return Number.isInteger(level)&&level>=1&&level<=4?boardRadii[level-1]:Infinity;}
  function inside(point,level){return Math.max(Math.abs(point.q),Math.abs(point.r),Math.abs(point.q+point.r))<=boardRadius(level);}
  function key(point){return point.q+','+point.r;}
  function trace(pieces,level){return dnaBoardTrace(pieces,level,lookup,boardRadius);}
  function boardCells(level){return dnaBoardCells(boardRadius(level));}
  function pack(pieces,level){return dnaBoardPack(pieces,level,boardRadius);}
  function piecePrice(piece){
    const gene=lookup.get(piece.gene),grade=piece.grade===undefined?1:piece.grade;
    if(!gene)return 0;
    return (gene.category==='organ'?[0,8,12,11,15]:[0,5,7,11,15])[grade]||0;
  }
  function price(pieces){return Math.ceil(pieces.reduce((sum,piece)=>sum+piecePrice(piece),0));}
  function cost(pieces){return 3+price(pieces);}
  function counts(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+1;return result;}
  function weights(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+(piece.grade===undefined?1:piece.grade);return result;}
  function stats(pieces,tribe){
    const n=weights(pieces),c=counts(pieces),gather=!!c.gather,profile=tribeDnaStats(tribe);
    return {...dnaCombatStats(c,n,undefined,tribe),gatherCount:c.gather||0,antennaCount:c.antenna||0,
      capacity:gather?c.gather+(n.capacity||0):0,harvest:gather?1:0,
      harvestTime:gather?4/(1+.1*(n.harvestSpeed||0)):0,movement:.25*profile.base.movement+.04*(n.movement||0)*(profile.growth.movement??1),
      vision:Math.min(12,1+(c.antenna||0)+.5*(n.vision||0)),scale:1+.01*pieces.length,roaming:!!n.antenna,
      loadSpeed:gather?Math.min(100,75+5*(n.loadSpeed||0)):0};
  }
  function clonePiece(piece){return {gene:piece.gene,rotation:piece.rotation,grade:piece.grade,q:piece.q,r:piece.r};}
  function validate(value){
    if(!value||![1,2,3,4,5].includes(value.version)||!Array.isArray(value.pieces)||value.pieces.length>2048||!Number.isFinite(value.budget)||value.budget<0||value.budget>999999999)return null;
    let level=value.level===undefined?1:value.level;
    if(!Number.isInteger(level)||level<1||level>4)return null;
    let pieces=[];
    for(const input of value.pieces){
      const gene=lookup.get(input?.gene),grade=input?.grade===undefined?(value.version>=3?gene?.grade:1):input.grade;
      if(!gene||!Number.isInteger(grade)||grade<1||grade>4||!Number.isInteger(input.rotation)||input.rotation<0||input.rotation>5)return null;
      if(value.version===5){
        if(input.shape!==undefined||input.cells!==undefined)return null;
        pieces.push({gene:gene.id,grade,rotation:input.rotation,q:input.q,r:input.r});
      }else pieces.push({gene:gene.id,grade,rotation:input.rotation});
    }
    if(value.version<5){
      const source=pieces;
      pieces=pack(source,level);
      while(!pieces&&level<4&&value.level===undefined)pieces=pack(source,++level);
      if(!pieces){
        const occupied=new Set(),positions=boardCells(level);let overflow=0;
        pieces=source.map(input=>{
          for(const position of positions)for(let rotation=0;rotation<6;rotation++){
            const piece={...input,rotation,q:position.q,r:position.r},cells=dnaPieceCells(piece);
            if(cells.some(cell=>!inside(cell,level)||occupied.has(key(cell))))continue;
            for(const cell of cells)occupied.add(key(cell));return piece;
          }
          const index=overflow++;return {...input,q:boardRadius(level)+4+(index%Math.ceil(Math.sqrt(source.length)))*6,r:-boardRadius(level)+Math.floor(index/Math.ceil(Math.sqrt(source.length)))*6};
        });
      }
    }
    if(!trace(pieces).valid)return null;
    return {version:5,pieces,budget:Math.floor(value.budget),level};
  }

  return {genes,catalog,lookup,trace,boardCells,pieceCells:dnaPieceCells,pack,piecePrice,price,cost,counts,weights,stats,validate,clonePiece,key,boardRadius,inside};
})();

return { ATTRIBUTE_DNA };
})();
modules["client/unit-appearance.mjs"] = (() => {
const { UNIT_DISPLAY_MASKS, unitDominantAppearanceMask, unitDisplayAbilityMask } = modules["client/unit-display-appearance.mjs"];
const { UNIT_DISPLAY_SIZES, unitDisplaySize } = modules["client/unit-size.mjs"];
const { ATTRIBUTE_DNA } = modules["server/dna.mjs"];
const { UNIT_APPEARANCE_ASSETS } = modules["client/unit-appearance-assets.mjs"];
const { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, unitAppearanceKey, unitAppearanceMaskFromDna } = modules["server/unit-appearance.mjs"];

function unitAppearanceRequiredWorldActions(mask) {
  const actions = ["idle", "walk", "hurt", "birth", "death", "harvest", "carry", "throw"];
  if (mask & UNIT_APPEARANCE_BITS.blade) actions.push("attack");
  if (mask & UNIT_APPEARANCE_BITS.secretion) actions.push("ranged");
  return actions;
}

function unitAppearanceRequiredActions(mask) { return unitAppearanceRequiredWorldActions(mask); }
const UNIT_APPEARANCE_OPTIONAL_PREVIEW_ACTIONS = Object.freeze(["jump"]);

function unitAppearanceDefinition(tribe, mask) {
  const key = unitAppearanceKey(tribe, mask);
  const definition = key ? UNIT_APPEARANCE_ASSETS[key] || null : null;
  return definition && definition.source?.tribe === tribe && definition.source.mask === mask ? definition : null;
}

function sourceApproved(source) {
  return source?.approvalState === "approved" && !!(source.approvalRef?.callId || source.approvalRef?.messageId) && !!source.approvalRef?.sourceThread ||
    source?.approvalState === "existing-reference" && source.mask === 0 && source.provenance?.kind === "existing-original" &&
    !!source.provenance.sourceHash && !!source.provenance.transform &&
    (!!source.provenance.sourceImage && !!source.provenance.reuseDirective || source.provenance.referenceVerified === true && source.provenance.reuseAuthorized === true);
}

function cameraVerified(source) {
  return !!source?.sourceId && !!source.sourceHash && !!source.image && source.frameWidth === 512 && source.frameHeight === 512 &&
    source.camera?.pixelsPerWorld === 512 && source.cameraVerified === true && Number.isFinite(source.pivot?.x) && Number.isFinite(source.pivot?.y) &&
    source.coreReference?.verified === true && !!source.coreReference.landmarks;
}

function clipValid(source, clip) {
  const width = clip?.frameWidth || clip?.frameSize, height = clip?.frameHeight || clip?.frameSize, mapping = clip?.cameraMapping;
  const canonical = width === source?.frameWidth && height === source?.frameHeight && !mapping;
  const mapped = source?.mask === 0 && source.provenance?.kind === "existing-original" && !!source.provenance.sourceHash && !!source.provenance.transform && mapping?.verified === true &&
    !!mapping.sourceHash && Number.isFinite(mapping.pixelsPerWorld) && mapping.pixelsPerWorld > 0 &&
    Math.abs(mapping.scale - source.camera.pixelsPerWorld / mapping.pixelsPerWorld) < .000001 &&
    Math.abs(clip.pivotX * mapping.scale + mapping.offsetX - source.pivot.x) <= 1 &&
    Math.abs(clip.pivotY * mapping.scale + mapping.offsetY - source.pivot.y) <= 1;
  return !!source?.sourceId && clip?.sourceId === source.sourceId && !!clip.image && (canonical || mapped) &&
    Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0 && Number.isInteger(clip.columns) && clip.columns > 0 &&
    Number.isInteger(clip.frameCount) && clip.frameCount > 0 && typeof clip.loop === "boolean" &&
    Number.isFinite(clip.pivotX) && Number.isFinite(clip.pivotY) && Array.isArray(clip.durationsMs) &&
    clip.durationsMs.length > 0 && clip.durationsMs.every(value => Number.isFinite(value) && value > 0) &&
    (clip.frames ? clip.frames.length === clip.durationsMs.length && clip.frames.every(value => Number.isInteger(value) && value >= 0 && value < clip.frameCount) :
      clip.durationsMs.length === clip.frameCount);
}

function unitAppearanceReadiness(definition, mask) {
  const approved = sourceApproved(definition?.source), verified = cameraVerified(definition?.source);
  const complete = !!definition && unitAppearanceRequiredActions(mask).every(action => clipValid(definition.source, definition.actions?.[action]));
  return { sourceApproved: approved === true, cameraVerified: verified === true, actionSetComplete: complete,
    worldReady: approved === true && verified === true && complete, ready: approved === true && verified === true && complete };
}

function unitAppearanceAnimation(tribe, mask, action) {
  const definition = unitAppearanceDefinition(tribe, mask), clip = definition?.actions?.[action];
  return sourceApproved(definition?.source) && cameraVerified(definition?.source) && clipValid(definition?.source, clip) ? clip : null;
}

function unitAppearanceMissingActions(tribe, mask) {
  const definition = unitAppearanceDefinition(tribe, mask);
  return unitAppearanceRequiredActions(mask).filter(action => !clipValid(definition?.source, definition?.actions?.[action]));
}

function unitAppearanceReady(tribe, mask) {
  return unitAppearanceReadiness(unitAppearanceDefinition(tribe, mask), mask).ready;
}

function unitAppearanceForAgent(agent) {
  if (agent.species || agent.dna?.version !== 3 || !Array.isArray(agent.dna.pieces) ||
      [agent.attributes, agent.appearanceAttributes].some(attributes => UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes?.[key] > 0))) return null;
  const tribe = agent.tribe || "bean", actualMask = unitAppearanceMaskFromDna(agent.dna), mask = unitDominantAppearanceMask(actualMask);
  const definition = unitAppearanceDefinition(tribe, mask);
  if (mask === 0 && agent.dna.pieces.some(piece => piece.gene === "gather")) return null;
  return mask !== null && unitAppearanceReadiness(definition, actualMask).ready && ATTRIBUTE_DNA.validate(agent.dna) ?
    { tribe, mask, actualMask, definition } : null;
}

function unitAppearanceBirthSceneForAgent(agent) {
  if (agent.species || agent.dna?.version !== 3 || unitAppearanceMaskFromDna(agent.dna) !== 0 ||
      !ATTRIBUTE_DNA.validate(agent.dna) || [agent.attributes, agent.appearanceAttributes].some(attributes =>
        [...Object.keys(UNIT_APPEARANCE_BITS), ...UNIT_APPEARANCE_LEGACY_VISUAL_KEYS].some(key => attributes?.[key] > 0))) return null;
  const definition = unitAppearanceDefinition(agent.tribe || "bean", 0), scene = definition?.sceneActions?.birth;
  return sourceApproved(definition?.source) && cameraVerified(definition?.source) && scene?.runtimeEnabled === true &&
    scene.sourceId === definition.source.sourceId && scene.mask === 0 && scene.ownership?.bodyOnly === true &&
    scene.validation?.cameraVerified === true && scene.validation?.runtimeRendererConnected === true ? scene : null;
}

function unitAppearancePose(tribe, mask, action, elapsedMs) {
  const definition = unitAppearanceDefinition(tribe, mask), animation = unitAppearanceAnimation(tribe, mask, action);
  if (!animation) return null;
  const durationMs = animation.durationsMs.reduce((sum, value) => sum + value, 0);
  let elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0, index = 0;
  if (animation.loop) elapsed %= durationMs;
  while (index < animation.durationsMs.length - 1 && elapsed >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
  const frame = animation.frames?.[index] ?? index;
  return { action, animation, frame, geometry: { ...animation, ...animation.frameGeometry?.[frame] }, source: definition.source };
}

function unitAppearanceWorldPose(agent, action, elapsedMs) {
  const appearance = unitAppearanceForAgent(agent);
  return appearance ? unitAppearancePose(appearance.tribe, appearance.mask, action, elapsedMs) : null;
}

function unitAppearanceSourceScale(agent, worldPixels, source, animation) {
  const base = UNIT_DISPLAY_SIZES[agent.species || agent.tribe || "bean"] || UNIT_DISPLAY_SIZES.bean;
  const growth = unitDisplaySize(agent) / base;
  return worldPixels * growth / (animation.cameraMapping?.pixelsPerWorld || source.camera.pixelsPerWorld);
}

function unitAppearanceInventory({ includeLegacyCombinations = false } = {}) {
  const masks = includeLegacyCombinations ? Array.from({ length: 32 }, (_, mask) => mask) : UNIT_DISPLAY_MASKS;
  return UNIT_APPEARANCE_TRIBES.flatMap(tribe => masks.map(mask => {
    const definition = unitAppearanceDefinition(tribe, mask);
    return { key: unitAppearanceKey(tribe, mask), tribe, mask, sourceId: definition?.source?.sourceId || null,
      ...unitAppearanceReadiness(definition, includeLegacyCombinations ? mask : unitDisplayAbilityMask(mask)),
      missingActions: unitAppearanceRequiredActions(includeLegacyCombinations ? mask : unitDisplayAbilityMask(mask))
        .filter(action => !clipValid(definition?.source, definition?.actions?.[action])),
      previewStatus: Object.fromEntries(UNIT_APPEARANCE_OPTIONAL_PREVIEW_ACTIONS.map(action => [action,
        definition?.previewStatus?.[action] === "unsupported" ? "unsupported" : unitAppearanceAnimation(tribe, mask, action) ? "ready" : "pending"])) };
  }));
}

const UNIT_APPEARANCE_PIXEL_BUDGETS = Object.freeze({ mobile: 8 * 1024 * 1024, desktop: 32 * 1024 * 1024 });

function unitAppearanceLodRatio(frameSize, screenPixels, devicePixelRatio) {
  const ratio = Math.min(1, screenPixels * devicePixelRatio / frameSize);
  return ratio > 0 ? Math.max(1 / frameSize, 2 ** Math.ceil(Math.log2(ratio))) : 0;
}

function createUnitAppearanceCache(loadSource, makeBitmap, pixelBudget) {
  if (!Number.isSafeInteger(pixelBudget) || pixelBudget <= 0) throw new RangeError("INVALID APPEARANCE PIXEL BUDGET");
  const entries = new Map(), workingSet = new Map(), workingKeys = new Set(), preparing = new Map();
  let residentPixels = 0, decodes = 0, cacheHits = 0, queue = Promise.resolve();
  function dimensions(animation) {
    const width = animation.frameWidth || animation.frameSize, height = animation.frameHeight || animation.frameSize;
    return { width: width * animation.columns, height: height * Math.ceil(animation.frameCount / animation.columns), minimum: 1 / Math.max(width, height) };
  }
  function pixelsAt(animation, ratio) {
    const size = dimensions(animation);
    return Math.max(1, Math.round(size.width * ratio)) * Math.max(1, Math.round(size.height * ratio));
  }
  function setWorkingSet(requests) {
    workingSet.clear(); workingKeys.clear();
    for (const request of requests) {
      if (!(request.ratio > 0)) continue;
      const image = request.animation.image, ratio = Math.max(dimensions(request.animation).minimum, Math.min(1, 2 ** Math.floor(Math.log2(request.ratio))));
      const previous = workingSet.get(image);
      if (!previous || previous.ratio < ratio) workingSet.set(image, { animation: request.animation, ratio });
    }
    let pixels = [...workingSet.values()].reduce((sum, request) => sum + pixelsAt(request.animation, request.ratio), 0);
    while (pixels > pixelBudget) {
      let changed = false;
      for (const request of workingSet.values()) {
        const ratio = Math.max(dimensions(request.animation).minimum, request.ratio / 2);
        if (ratio < request.ratio) { request.ratio = ratio; changed = true; }
      }
      if (!changed) break;
      pixels = [...workingSet.values()].reduce((sum, request) => sum + pixelsAt(request.animation, request.ratio), 0);
    }
    for (const [image, request] of workingSet) workingKeys.add(image + ":" + request.ratio);
    return { atlases: workingSet.size, pixels, ratios: Object.fromEntries([...workingSet].map(([image, request]) => [image, request.ratio])) };
  }
  function remove(key, entry) {
    if (entry.bitmap) { entry.bitmap.close?.(); residentPixels -= entry.pixels; entry.bitmap = null; }
    if (entries.get(key) === entry) entries.delete(key);
  }
  function evict(required) {
    for (const [key, entry] of entries) {
      if (residentPixels + required <= pixelBudget) break;
      if (!entry.pins && !workingKeys.has(key)) remove(key, entry);
    }
  }
  function imageKey(animation, requestedRatio) {
    const ratio = workingSet.get(animation.image)?.ratio || Math.min(1, 2 ** Math.floor(Math.log2(requestedRatio)));
    return animation.image + ":" + ratio;
  }
  // The world paints synchronously. A decode must never draw onto a later
  // frame after terrain, another unit, or the camera has changed.
  function withReadyImage(animation, requestedRatio, draw) {
    if (!(requestedRatio > 0)) return false;
    const key = imageKey(animation, requestedRatio), entry = entries.get(key);
    if (!entry?.bitmap || entry.discard) return false;
    entries.delete(key); entries.set(key, entry); entry.pins++; cacheHits++;
    try {
      draw({ image: entry.bitmap, sourceRatio: entry.ratio, rasterScaleX: entry.rasterScaleX, rasterScaleY: entry.rasterScaleY });
      return true;
    } finally { entry.pins--; if (entry.discard && !entry.pins) remove(key, entry); }
  }
  function prepare(animation, requestedRatio) {
    if (!(requestedRatio > 0)) return Promise.resolve(false);
    const key = imageKey(animation, requestedRatio);
    if (entries.get(key)?.bitmap && !entries.get(key).discard) return Promise.resolve(true);
    if (!preparing.has(key)) {
      const pending = withImage(animation, requestedRatio, () => {});
      preparing.set(key, pending);
      pending.then(() => { if (preparing.get(key) === pending) preparing.delete(key); },
        () => { if (preparing.get(key) === pending) preparing.delete(key); });
    }
    return preparing.get(key);
  }
  async function withImage(animation, requestedRatio, draw) {
    if (!(requestedRatio > 0)) return false;
    const ratio = workingSet.get(animation.image)?.ratio || Math.min(1, 2 ** Math.floor(Math.log2(requestedRatio))), key = animation.image + ":" + ratio;
    let entry = entries.get(key);
    if (entry) { entries.delete(key); entries.set(key, entry); entry.pins++; cacheHits++; }
    else {
      entry = { pins: 1, bitmap: null, pixels: 0, discard: false };
      entries.set(key, entry);
      const current = entry;
      current.pending = queue.then(async () => {
        const frameWidth = animation.frameWidth || animation.frameSize, frameHeight = animation.frameHeight || animation.frameSize;
        const width = frameWidth * animation.columns;
        const height = frameHeight * Math.ceil(animation.frameCount / animation.columns);
        const minimumRatio = 1 / Math.max(frameWidth, frameHeight);
        let selected = Math.max(minimumRatio, ratio), pixels = pixelsAt(animation, selected);
        evict(pixels);
        while (pixels + residentPixels > pixelBudget && selected > minimumRatio) {
          selected = Math.max(minimumRatio, selected / 2); pixels = pixelsAt(animation, selected);
        }
        if (pixels + residentPixels > pixelBudget) return null;
        const acquired = await loadSource(animation.image);
        const lease = acquired && typeof acquired.release === "function" && acquired.blob ? acquired : null;
        const source = lease?.blob || acquired;
        let bitmap;
        try {
          const blob = typeof Blob !== "undefined" && source instanceof Blob;
          const sourceWidth = blob ? width : source.naturalWidth || source.width, sourceHeight = blob ? height : source.naturalHeight || source.height;
          if (sourceWidth !== width || sourceHeight !== height) throw new Error(`APPEARANCE ATLAS GEOMETRY MISMATCH : ${animation.image}`);
          bitmap = await makeBitmap(source, { resizeWidth: Math.max(1, Math.round(width * selected)), resizeHeight: Math.max(1, Math.round(height * selected)), resizeQuality: "high" });
        } finally { lease?.release(); }
        const actualPixels = bitmap.width * bitmap.height;
        if (actualPixels + residentPixels > pixelBudget) { bitmap.close?.(); throw new Error("APPEARANCE DECODED BUDGET EXCEEDED"); }
        decodes++; current.bitmap = bitmap; current.pixels = actualPixels; current.ratio = selected; current.rasterScaleX = bitmap.width / width; current.rasterScaleY = bitmap.height / height; residentPixels += actualPixels;
        return current;
      });
      queue = current.pending.then(() => undefined, () => undefined);
    }
    try {
      const ready = await entry.pending;
      if (!ready) return false;
      await draw({ image: ready.bitmap, sourceRatio: ready.ratio, rasterScaleX: ready.rasterScaleX, rasterScaleY: ready.rasterScaleY });
      return true;
    } finally {
      entry.pins--;
      if (!entry.bitmap || entry.discard && !entry.pins) remove(key, entry);
      for (const [oldKey, oldEntry] of entries) {
        if (entries.size <= Math.max(128, workingKeys.size)) break;
        if (!oldEntry.pins && !workingKeys.has(oldKey)) remove(oldKey, oldEntry);
      }
    }
  }
  function clear() {
    workingSet.clear(); workingKeys.clear();
    for (const [key, entry] of entries) {
      if (entry.pins) entry.discard = true; else remove(key, entry);
    }
  }
  return { withImage, withReadyImage, prepare, setWorkingSet, clear, stats: () => ({ entries: entries.size, residentPixels, pixelBudget, decodes, cacheHits, workingAtlases: workingSet.size, pending: preparing.size }) };
}

return { unitAppearanceRequiredWorldActions, unitAppearanceRequiredActions, UNIT_APPEARANCE_OPTIONAL_PREVIEW_ACTIONS, unitAppearanceDefinition, unitAppearanceReadiness, unitAppearanceAnimation, unitAppearanceMissingActions, unitAppearanceReady, unitAppearanceForAgent, unitAppearanceBirthSceneForAgent, unitAppearancePose, unitAppearanceWorldPose, unitAppearanceSourceScale, unitAppearanceInventory, UNIT_APPEARANCE_PIXEL_BUDGETS, unitAppearanceLodRatio, createUnitAppearanceCache };
})();
modules["client/unit-appearance-renderer.mjs"] = (() => {
const { unitFrameMirror } = modules["client/unit-size.mjs"];
const { createUnitAppearanceCache, unitAppearanceLodRatio, unitAppearanceSourceScale } = modules["client/unit-appearance.mjs"];

function createUnitAppearanceRenderer(loadSource, makeBitmap, pixelBudget) {
  const cache = createUnitAppearanceCache(loadSource, makeBitmap, pixelBudget);
  const pending = new Map(), failures = new Map();
  function samplingRatio(context, agent, pose, worldPixels, pixelRatio) {
    const animation = pose.animation, size = Math.max(animation.frameWidth || animation.frameSize, animation.frameHeight || animation.frameSize);
    const scale = unitAppearanceSourceScale(agent, worldPixels, pose.source, animation), matrix = context.getTransform();
    const deviceRatio = Math.max(Number.isFinite(pixelRatio) ? pixelRatio : 1, Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
    return unitAppearanceLodRatio(size, size * scale, deviceRatio);
  }
  function beginFrame(context, requests, pixelRatio) {
    return cache.setWorkingSet(requests.filter(request => request.pose && request.pose.animation.sourceId === request.pose.source.sourceId).map(request => ({
      animation: request.pose.animation, ratio: samplingRatio(context, request.agent, request.pose, request.worldPixels, pixelRatio)
    })));
  }
  function paint(context, agent, pose, anchor, worldPixels, mirror, raster, beforeDraw) {
    const shape = pose.geometry, animation = pose.animation;
    const width = animation.frameWidth || animation.frameSize, height = animation.frameHeight || animation.frameSize;
    const scale = unitAppearanceSourceScale(agent, worldPixels, pose.source, animation);
    const crop = { x: pose.frame % animation.columns * width * raster.rasterScaleX,
      y: Math.floor(pose.frame / animation.columns) * height * raster.rasterScaleY,
      width: width * raster.rasterScaleX, height: height * raster.rasterScaleY };
    const destination = { x: -shape.pivotX * scale, y: -shape.pivotY * scale, width: width * scale, height: height * scale };
    context.save();
    try {
      context.translate(anchor.x, anchor.y); context.scale(unitFrameMirror(animation.sourceFacing || pose.source.sourceFacing, mirror ? -1 : 1) ? -1 : 1, 1);
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
      beforeDraw?.(context, raster.image, crop, destination);
      context.drawImage(raster.image, crop.x, crop.y, crop.width, crop.height,
        destination.x, destination.y, destination.width, destination.height);
    } finally { context.restore(); }
  }
  function prepareFrame(context, requests, pixelRatio) {
    const working = beginFrame(context, requests, pixelRatio);
    for (const request of requests) {
      const { pose, agent, worldPixels } = request;
      if (!pose || pose.animation.sourceId !== pose.source.sourceId) continue;
      const ratio = samplingRatio(context, agent, pose, worldPixels, pixelRatio), key = pose.animation.image + ":" + working.ratios[pose.animation.image];
      if (pending.has(key) || (failures.get(key) || 0) > Date.now()) continue;
      const promise = cache.prepare(pose.animation, ratio); pending.set(key, promise);
      promise.then(() => { pending.delete(key); failures.delete(key); }, () => {
        pending.delete(key); failures.set(key, Date.now() + 5000);
        while (failures.size > 128) failures.delete(failures.keys().next().value);
      });
    }
    return working;
  }
  function drawReady(context, agent, pose, anchor, worldPixels, mirror, pixelRatio, beforeDraw) {
    if (!pose || pose.animation.sourceId !== pose.source.sourceId) return false;
    return cache.withReadyImage(pose.animation, samplingRatio(context, agent, pose, worldPixels, pixelRatio),
      raster => paint(context, agent, pose, anchor, worldPixels, mirror, raster, beforeDraw));
  }
  function isReady(context, agent, pose, worldPixels, pixelRatio) {
    return !!pose && cache.withReadyImage(pose.animation, samplingRatio(context, agent, pose, worldPixels, pixelRatio), () => {});
  }
  async function draw(context, agent, pose, anchor, worldPixels, mirror, pixelRatio, stillCurrent) {
    if (!pose || pose.animation.sourceId !== pose.source.sourceId || !stillCurrent()) return false;
    const animation = pose.animation;
    const ratio = samplingRatio(context, agent, pose, worldPixels, pixelRatio);
    let drawn = false;
    await cache.withImage(animation, ratio, raster => {
      if (!stillCurrent()) return;
      paint(context, agent, pose, anchor, worldPixels, mirror, raster); drawn = true;
    });
    return drawn;
  }
  return { beginFrame, prepareFrame, drawReady, isReady, draw, clear() { failures.clear(); cache.clear(); }, stats: cache.stats };
}

return { createUnitAppearanceRenderer };
})();
modules["client/unit-appearance-source.mjs"]=(()=>{
const UNIT_APPEARANCE_BYTE_BUDGETS = Object.freeze({ mobile: 8 * 1024 * 1024, desktop: 32 * 1024 * 1024 });

function createUnitAppearanceSource(options = {}) {
  const scope = options.scope || globalThis;
  const files = options.files || scope.SpawnerUnitAppearanceFiles || {};
  const data = scope.SpawnerUnitAppearanceData ||= Object.create(null);
  const protocol = options.protocol || scope.location?.protocol || 'https:';
  const byteBudget = options.byteBudget ?? UNIT_APPEARANCE_BYTE_BUDGETS.desktop;
  if (!Number.isSafeInteger(byteBudget) || byteBudget <= 0) throw new RangeError('INVALID APPEARANCE SOURCE BUDGET');
  const fetchSource = options.fetch || ((...args) => scope.fetch(...args));
  const sourceUrl = options.sourceUrl || (path => path);
  const makeUrl = options.createObjectURL || (blob => scope.URL.createObjectURL(blob));
  const revokeUrl = options.revokeObjectURL || (url => scope.URL.revokeObjectURL(url));
  const loadScript = options.loadScript || (path => new Promise((resolve, reject) => {
    const script = scope.document.createElement('script'); script.src = path; script.async = true;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => { script.remove(); reject(new Error('APPEARANCE FILE SOURCE UNAVAILABLE: ' + path)); };
    scope.document.head.append(script);
  }));
  const decode = options.decode || (async uri => {
    const response = await fetchSource(uri);
    if (!response.ok) throw new Error('APPEARANCE DATA URI DECODE FAILED');
    return response.blob();
  });
  const verify = options.verify || (async (blob, expected) => {
    if (!expected || !scope.crypto?.subtle) return;
    const hash = await scope.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const actual = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw new Error('APPEARANCE SOURCE HASH MISMATCH');
  });
  const entries = new Map();
  let queue = Promise.resolve(), residentBytes = 0, reservedBytes = 0, peakBytes = 0, loads = 0;
  const account = () => { peakBytes = Math.max(peakBytes, residentBytes + reservedBytes); };
  function remove(path, entry) {
    if (entry.url) { revokeUrl(entry.url); entry.url = null; }
    if (entry.blob) { residentBytes -= entry.blob.size; entry.blob = null; }
    if (entries.get(path) === entry) entries.delete(path);
  }
  function reserve(bytes) {
    for (const [path, entry] of entries) {
      if (residentBytes + reservedBytes + bytes <= byteBudget) break;
      if (!entry.refs && entry.blob) remove(path, entry);
    }
    if (residentBytes + reservedBytes + bytes > byteBudget) throw new RangeError('APPEARANCE SOURCE BUDGET EXCEEDED');
    reservedBytes += bytes; account();
  }
  async function acquire(path) {
    const file = files[path];
    if (!file || !Number.isSafeInteger(file.bytes) || file.bytes <= 0) throw new Error('UNKNOWN APPEARANCE SOURCE: ' + path);
    let entry = entries.get(path);
    if (entry) { entries.delete(path); entries.set(path, entry); entry.refs++; }
    else {
      entry = { refs: 1, blob: null, url: null, discard: false };
      entries.set(path, entry);
      const current = entry;
      current.pending = queue.then(async () => {
        // Include transient base64 plus compressed bytes, or hashing's byte copy.
        const reservation = protocol === 'file:' ? Math.ceil(file.bytes / 3) * 4 + file.bytes + 128 : file.bytes * 2;
        reserve(reservation);
        try {
          let blob;
          if (protocol === 'file:') {
            delete data[path];
            try {
              await loadScript(file.script);
              let uri = data[path]; delete data[path];
              if (typeof uri !== 'string' || !uri.startsWith('data:' + file.mime + ';base64,') || uri.length > Math.ceil(file.bytes / 3) * 4 + 128)
                throw new Error('APPEARANCE ENCODED SOURCE MISMATCH: ' + path);
              blob = await decode(uri); uri = null;
            } finally { delete data[path]; }
          } else {
            const response = await fetchSource(sourceUrl(path));
            if (!response.ok) throw new Error('APPEARANCE SOURCE UNAVAILABLE: ' + path);
            blob = await response.blob();
          }
          if (blob.size !== file.bytes || blob.type !== file.mime) throw new Error('APPEARANCE SOURCE SIZE/TYPE MISMATCH: ' + path);
          await verify(blob, file.hash);
          current.blob = blob; residentBytes += blob.size; loads++;
          return current;
        } finally { reservedBytes -= reservation; account(); }
      });
      queue = current.pending.then(() => undefined, () => undefined);
    }
    try { await entry.pending; }
    catch (error) { entry.refs--; if (!entry.refs) remove(path, entry); throw error; }
    let released = false;
    return { blob: entry.blob,
      get url() {
        if (released) throw new Error('APPEARANCE SOURCE LEASE RELEASED');
        return entry.url ||= makeUrl(entry.blob);
      },
      release() {
        if (released) return;
        released = true; entry.refs--;
        if (!entry.refs && entry.discard) remove(path, entry);
      }
    };
  }
  function clear() {
    for (const [path, entry] of entries) {
      if (entry.refs) entry.discard = true;
      else remove(path, entry);
    }
  }
  return { acquire, clear, stats: () => ({ entries: entries.size, residentBytes, reservedBytes, byteBudget, peakBytes, loads,
    leases: [...entries.values()].reduce((sum, entry) => sum + entry.refs, 0) }) };
}

return {UNIT_APPEARANCE_BYTE_BUDGETS,createUnitAppearanceSource};
})();
modules["client/creature-approved-actions.mjs"] = (() => {
const APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS = Object.freeze({
  "bubble-toad": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/bubble-toad/attack.webp",
    "frameSize": 128,
    "pivotX": 73.7181701397773,
    "pivotY": 99.67266996572693,
    "viewSize": 122.62249221100252,
    "registrationScale": 1,
    "groundRadiusX": 0.34626,
    "groundRadiusY": 0.027701,
    "supportAnchor": [
      101.49253731343283,
      99.5820895522388
    ],
    "columns": 4,
    "frameCount": 6,
    "durationsMs": [
      70,
      210,
      50,
      300,
      170,
      220
    ],
    "durationMs": 1020,
    "loop": false,
    "facing": "left",
    "impactFrame": 3,
    "hitTimeMs": 330,
    "fixedSupport": true
  },
  "dew-rabbit": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/dew-rabbit/attack.webp",
    "frameSize": 128,
    "pivotX": 88.43302298870299,
    "pivotY": 92.07242947061347,
    "viewSize": 114.68932699420773,
    "registrationScale": 1.0287769784172662,
    "groundRadiusX": 0.199041,
    "groundRadiusY": 0.03717,
    "supportAnchor": [
      98.5945945945946,
      95.56756756756758
    ],
    "columns": 4,
    "frameCount": 8,
    "durationsMs": [
      100,
      110,
      110,
      40,
      200,
      90,
      130,
      190
    ],
    "durationMs": 970,
    "loop": false,
    "facing": "left",
    "impactFrame": 4,
    "hitTimeMs": 360,
    "fixedSupport": true
  },
  "lantern-keeper": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/lantern-keeper/attack.webp",
    "frameSize": 128,
    "pivotX": 71.91820815789474,
    "pivotY": 98.65081821052632,
    "viewSize": 122.88818130736094,
    "registrationScale": 1,
    "groundRadiusX": 0.182292,
    "groundRadiusY": 0.033854,
    "supportAnchor": [
      89.25,
      101.25
    ],
    "columns": 4,
    "frameCount": 8,
    "durationsMs": [
      70,
      100,
      120,
      40,
      260,
      110,
      160,
      140
    ],
    "durationMs": 1000,
    "loop": false,
    "facing": "left",
    "impactFrame": 4,
    "hitTimeMs": 330,
    "fixedSupport": true
  },
  "soil-boar": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/soil-boar/attack.webp",
    "frameSize": 128,
    "pivotX": 73.01615647049246,
    "pivotY": 90.91383687944646,
    "viewSize": 125.94803856520835,
    "registrationScale": 1,
    "groundRadiusX": 0.325203,
    "groundRadiusY": 0.04607,
    "supportAnchor": [
      108.30769230769232,
      92.06153846153846
    ],
    "columns": 4,
    "frameCount": 6,
    "durationsMs": [
      70,
      210,
      50,
      300,
      170,
      220
    ],
    "durationMs": 1020,
    "loop": false,
    "facing": "left",
    "impactFrame": 3,
    "hitTimeMs": 330,
    "fixedSupport": true
  },
  "soil-mole": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/soil-mole/attack.webp",
    "frameSize": 128,
    "pivotX": 72.94630339128246,
    "pivotY": 70.09282788275803,
    "viewSize": 113.68334782654499,
    "registrationScale": 1.0036630036630036,
    "groundRadiusX": 0.387324,
    "groundRadiusY": 0.087324,
    "supportAnchor": [
      110.22222222222221,
      68.06349206349206
    ],
    "columns": 4,
    "frameCount": 8,
    "durationsMs": [
      100,
      110,
      120,
      40,
      220,
      90,
      130,
      190
    ],
    "durationMs": 1000,
    "loop": false,
    "facing": "left",
    "impactFrame": 4,
    "hitTimeMs": 370,
    "fixedSupport": true
  },
  "walking-forest": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/walking-forest/attack.webp",
    "frameSize": 128,
    "pivotX": 58.252199483870974,
    "pivotY": 112.2815249032258,
    "viewSize": 109.79472140762462,
    "registrationScale": 1.015625,
    "groundRadiusX": 0.414063,
    "groundRadiusY": 0.0625,
    "supportAnchor": [
      96,
      113.29032258064515
    ],
    "columns": 4,
    "frameCount": 8,
    "durationsMs": [
      100,
      180,
      220,
      60,
      320,
      180,
      220,
      180
    ],
    "durationMs": 1460,
    "loop": false,
    "facing": "left",
    "impactFrame": 4,
    "hitTimeMs": 560,
    "fixedSupport": true
  },
  "white-paw": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/white-paw/attack.webp",
    "frameSize": 128,
    "pivotX": 61.707070707070706,
    "pivotY": 93.9040404040404,
    "viewSize": 132.36363636363637,
    "registrationScale": 1,
    "groundRadiusX": 0.267361,
    "groundRadiusY": 0.048611,
    "supportAnchor": [
      95.55555555555556,
      100
    ],
    "columns": 3,
    "frameCount": 6,
    "durationsMs": [
      100,
      100,
      70,
      240,
      140,
      150
    ],
    "durationMs": 800,
    "loop": false,
    "facing": "left",
    "impactFrame": 3,
    "hitTimeMs": 270,
    "fixedSupport": true
  },
  "vine-turtle": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/vine-turtle/attack.webp",
    "frameSize": 128,
    "pivotX": 68.97122665320545,
    "pivotY": 87.6737004688541,
    "viewSize": 109.82574457344775,
    "registrationScale": 1,
    "groundRadiusX": 0.401734,
    "groundRadiusY": 0.028902,
    "supportAnchor": [
      101.94285714285714,
      91.88571428571429
    ],
    "columns": 3,
    "frameCount": 6,
    "durationsMs": [
      70,
      210,
      50,
      300,
      170,
      220
    ],
    "durationMs": 1020,
    "loop": false,
    "facing": "left",
    "impactFrame": 3,
    "hitTimeMs": 330,
    "fixedSupport": true
  },
  "shadow-weasel": {
    "image": "DesignAssets/Animations/CreatureApprovedV5/shadow-weasel/attack.webp",
    "frameSize": 128,
    "pivotX": 66.350167983165,
    "pivotY": 91.74410847811447,
    "viewSize": 117.07407407407405,
    "registrationScale": 1,
    "groundRadiusX": 0.285266,
    "groundRadiusY": 0.037618,
    "supportAnchor": [
      95.55555555555556,
      100
    ],
    "columns": 3,
    "frameCount": 6,
    "durationsMs": [
      100,
      100,
      70,
      240,
      140,
      150
    ],
    "durationMs": 800,
    "loop": false,
    "facing": "left",
    "impactFrame": 3,
    "hitTimeMs": 270,
    "fixedSupport": true
  }
});

const APPROVED_COTTON_SHEEP_WALK_ANIMATION = Object.freeze({
  "image": "DesignAssets/Animations/CreatureApprovedV5/cotton-sheep/walk.webp",
  "frameSize": 128,
  "pivotX": 70.4,
  "pivotY": 86.4,
  "viewSize": 102.4,
  "registrationScale": 1,
  "groundRadiusX": 0.244141,
  "groundRadiusY": 0.064453,
  "columns": 8,
  "frameCount": 64,
  "durationsMs": [
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125,
    4.8828125
  ],
  "durationMs": 312.5,
  "loop": true,
  "temporalCadenceHz": 3.2
});

return { APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS, APPROVED_COTTON_SHEEP_WALK_ANIMATION };
})();
modules["client/creature-approved-animations.mjs"] = (() => {
const APPROVED_CREATURE_WALK_ANIMATIONS = Object.freeze({
  "soil-mole": {
    "image": "DesignAssets/Animations/CreatureApprovedV4/soil-mole/walk.webp",
    "frameSize": 238,
    "viewSize": 237.3314606741573,
    "columns": 8,
    "pivotX": 125.35112359550561,
    "pivotY": 187.85955056179773,
    "durationsMs": [
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875,
      10.421875
    ],
    "loop": true,
    "registrationScale": 1,
    "groundRadiusX": 0.387324,
    "groundRadiusY": 0.087324,
    "cyclesPerCell": 2.5
  },
  "walking-forest": {
    "image": "DesignAssets/Animations/CreatureApprovedV4/walking-forest/walk.webp",
    "frameSize": 440,
    "viewSize": 403.11784073543805,
    "columns": 8,
    "pivotX": 216.6153846153846,
    "pivotY": 362.15384615384613,
    "durationsMs": [
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773,
      20.676631501373773
    ],
    "loop": true,
    "registrationScale": 1,
    "groundRadiusX": 0.414063,
    "groundRadiusY": 0.0625,
    "cyclesPerCell": 1.4
  },
  "shadow-weasel": {
    "image": "DesignAssets/Animations/CreatureApprovedV4/shadow-weasel/walk.webp",
    "frameSize": 229,
    "viewSize": 176.45169082125602,
    "columns": 8,
    "pivotX": 111.18115886714976,
    "pivotY": 193.59903492270533,
    "durationsMs": [
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5
    ],
    "loop": true,
    "registrationScale": 1,
    "groundRadiusX": 0.285266,
    "groundRadiusY": 0.037618,
    "cyclesPerCell": 0.769231
  },
  "white-paw": {
    "image": "DesignAssets/Animations/CreatureApprovedV4/white-paw/walk.webp",
    "frameSize": 248,
    "viewSize": 228.92307692307693,
    "columns": 8,
    "pivotX": 120.82051282051282,
    "pivotY": 205.87179487179486,
    "durationsMs": [
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5,
      12.5
    ],
    "loop": true,
    "registrationScale": 1,
    "groundRadiusX": 0.267361,
    "groundRadiusY": 0.048611,
    "cyclesPerCell": 0.625
  }
});

const APPROVED_CREATURE_DEATH_ANIMATIONS = Object.freeze({
  "bubble-toad": {
    "image": "DesignAssets/Animations/CreatureApprovedV4/bubble-toad/death.webp",
    "frameSize": 202,
    "viewSize": 201.44198895027625,
    "columns": 4,
    "pivotX": 103.23204364088399,
    "pivotY": 171.30939226519337,
    "durationsMs": [
      300,
      90,
      100,
      100,
      90,
      80,
      80,
      80,
      90,
      90,
      90,
      90,
      90,
      90,
      90,
      1200
    ],
    "loop": false,
    "registrationScale": 1,
    "groundRadiusX": 0.34626,
    "groundRadiusY": 0.027701
  }
});

return { APPROVED_CREATURE_WALK_ANIMATIONS, APPROVED_CREATURE_DEATH_ANIMATIONS };
})();
modules["client/image-scales.mjs"] = (() => {
const IMAGE_SCALES = Object.freeze({
  "DesignAssets/Animations/Beetle/attack-right.webp": [
    0.673828125,
    0.673828125
  ],
  "DesignAssets/Animations/Beetle/atlas.webp": [
    0.673828125,
    0.673828125
  ],
  "DesignAssets/Animations/Beetle/neutral.webp": [
    0.673828125,
    0.673828125
  ],
  "DesignAssets/Animations/BeetleDeath/dead-v2.png": [
    0.361328125,
    0.361328125
  ],
  "DesignAssets/Animations/BubbleToadIdle/BreathV1/idle.webp": [
    0.705078125,
    0.705078125
  ],
  "DesignAssets/Animations/CreatureIdleStudies/V1/snare-vine/idle.webp": [
    0.828125,
    0.828125
  ],
  "DesignAssets/Animations/CreatureIdleStudies/V2/shadow-weasel/idle.webp": [
    0.623046875,
    0.623046875
  ],
  "DesignAssets/Animations/CreatureIdleStudies/V2/vine-turtle/idle.webp": [
    0.67578125,
    0.67578125
  ],
  "DesignAssets/Animations/CreatureIdleV3/dew-rabbit/idle.webp": [
    0.814453125,
    0.814453125
  ],
  "DesignAssets/Animations/CreatureIdleV3/flower-tail-bird/idle.webp": [
    0.7578125,
    0.7578125
  ],
  "DesignAssets/Animations/CreatureIdleV3/soil-mole/idle.webp": [
    0.693359375,
    0.693359375
  ],
  "DesignAssets/Animations/CreatureIdleV4/bundle-snail/idle.webp": [
    0.77734375,
    0.77734375
  ],
  "DesignAssets/Animations/Resources/FertileSoil/harvest-sheet.png": [
    0.890625,
    0.890625
  ],
  "DesignAssets/Animations/Resources/HarvestDrawnV2/pebbles/harvest-sheet.png": [
    0.400390625,
    0.400390625
  ],
  "DesignAssets/Animations/Resources/HarvestDrawnV2/wood/harvest-sheet.png": [
    0.462890625,
    0.462890625
  ],
  "DesignAssets/Animations/Resources/HarvestDrawnV3/dew/harvest-sheet.png": [
    0.966796875,
    0.966796875
  ],
  "DesignAssets/Animations/RollingAcornIdle/v1/idle.webp": [
    0.8203125,
    0.8203125
  ],
  "DesignAssets/Animations/SoilBoarIdle/V1/idle.webp": [
    0.720703125,
    0.720703125
  ],
  "DesignAssets/Animations/TalonOwlIdle/PerchedV4/idle.webp": [
    0.84375,
    0.84375
  ],
  "DesignAssets/Animations/UnitAttack/attack.png": [
    0.234375,
    0.234375
  ],
  "DesignAssets/Animations/UnitHurt/V3/hurt.png": [
    0.234375,
    0.234375
  ],
  "DesignAssets/Attributes/SilhouettesV2/04-crescent.png": [
    0.140625,
    0.140625
  ],
  "DesignAssets/Attributes/SilhouettesV2/23-y-branch.png": [
    0.140625,
    0.140625
  ],
  "DesignAssets/Attributes/SilhouettesV2/24-horseshoe.png": [
    0.140625,
    0.140625
  ],
  "DesignAssets/Attributes/SilhouettesV2/27-chevron.png": [
    0.140625,
    0.140625
  ],
  "DesignAssets/Burrows/beetle-burrow-large.png": [
    0.38218714768883877,
    0.38218714768883877
  ],
  "DesignAssets/Burrows/beetle-burrow-small.png": [
    0.20574162679425836,
    0.20574162679425836
  ],
  "DesignAssets/CreatureConcepts/v3/bubble-toad.png": [
    0.21169590643274855,
    0.21168923734853884
  ],
  "DesignAssets/CreatureConcepts/v3/bundle-snail.png": [
    0.21721311475409835,
    0.2168918918918919
  ],
  "DesignAssets/CreatureConcepts/v3/cotton-sheep.png": [
    0.22564102564102564,
    0.22564102564102564
  ],
  "DesignAssets/CreatureConcepts/v3/dew-rabbit.png": [
    0.23980222496909764,
    0.23948019801980197
  ],
  "DesignAssets/CreatureConcepts/v3/flower-tail-bird.png": [
    0.2372986369268897,
    0.23800738007380073
  ],
  "DesignAssets/CreatureConcepts/v3/lantern-keeper.png": [
    0.24166142227816237,
    0.24221668742216687
  ],
  "DesignAssets/CreatureConcepts/v3/old-garden-snail.png": [
    0.2185897435897436,
    0.2185897435897436
  ],
  "DesignAssets/CreatureConcepts/v3/rolling-acorn.png": [
    0.25064102564102564,
    0.25064102564102564
  ],
  "DesignAssets/CreatureConcepts/v3/shadow-weasel.png": [
    0.1750911933298593,
    0.17466561762391816
  ],
  "DesignAssets/CreatureConcepts/v3/snare-vine.png": [
    0.3234946871310508,
    0.32482124616956076
  ],
  "DesignAssets/CreatureConcepts/v3/soil-boar.png": [
    0.2178508514386377,
    0.2175141242937853
  ],
  "DesignAssets/CreatureConcepts/v3/soil-mole.png": [
    0.2128205128205128,
    0.2128205128205128
  ],
  "DesignAssets/CreatureConcepts/v3/spiny-back-leader.png": [
    0.21640826873385013,
    0.21564760026298488
  ],
  "DesignAssets/CreatureConcepts/v3/spring-keeper.png": [
    0.2270560190703218,
    0.22809278350515463
  ],
  "DesignAssets/CreatureConcepts/v3/talon-owl.png": [
    0.24971098265895952,
    0.24910522548317823
  ],
  "DesignAssets/CreatureConcepts/v3/vine-turtle.png": [
    0.21987179487179487,
    0.21987179487179487
  ],
  "DesignAssets/CreatureConcepts/v3/walking-forest.png": [
    0.2240829346092504,
    0.2240829346092504
  ],
  "DesignAssets/CreatureConcepts/v3/white-paw.png": [
    0.18733783082511676,
    0.18781302170283806
  ],
  "DesignAssets/Foods/food-berry-bush.png": [
    0.1722488038277512,
    0.1722488038277512
  ],
  "DesignAssets/Nests/nest-stage-01.png": [
    0.3271484375,
    0.3271484375
  ],
  "DesignAssets/Resources/clay-carry.png": [
    0.04704944178628389,
    0.04704944178628389
  ],
  "DesignAssets/Resources/clay.png": [
    0.1379585326953748,
    0.1379585326953748
  ],
  "DesignAssets/Resources/dew-carry.png": [
    0.1291866028708134,
    0.1291866028708134
  ],
  "DesignAssets/Resources/dew-grass.png": [
    0.1379585326953748,
    0.1379585326953748
  ],
  "DesignAssets/Resources/pebbles-carry.png": [
    0.10127591706539076,
    0.10127591706539076
  ],
  "DesignAssets/Resources/pebbles.png": [
    0.1379585326953748,
    0.1379585326953748
  ],
  "DesignAssets/Resources/wood-carry.png": [
    0.07097288676236045,
    0.07097288676236045
  ],
  "DesignAssets/Terrain/coast-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/deep-water-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/ford-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/forest-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/grassland-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/high-mountain-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/land-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/low-mountain-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/nest-soil-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/ridge-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/shallow-water-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Terrain/standing-tree-smooth-atlas.png": [
    0.27348066298342544,
    0.27348066298342544
  ],
  "DesignAssets/Terrain/swamp-ground.png": [
    0.2109375,
    0.2109375
  ],
  "DesignAssets/Tribes/pebble/Animations/Units/jump/jump.webp": [
    1,
    1
  ],
  "DesignAssets/Tribes/pebble/AnimationStudies/attack-directions-v3/right/attack.webp": [
    0.203125,
    0.203125
  ],
  "DesignAssets/Tribes/pebble/AnimationStudies/birth-den-v1/birth-unit.webp": [
    0.294921875,
    0.294921875
  ],
  "DesignAssets/Tribes/pebble/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": [
    0.205078125,
    0.205078125
  ],
  "DesignAssets/Tribes/pebble/AnimationStudies/hurt-v2/hurt-v2.webp": [
    0.205078125,
    0.205078125
  ],
  "DesignAssets/Tribes/pebble/AnimationStudies/idle-v3/idle-v3.webp": [
    0.4375,
    0.4375
  ],
  "DesignAssets/Tribes/pebble/AnimationStudies/walk-in-place-v1/walk.webp": [
    1,
    1
  ],
  "DesignAssets/Tribes/pebble/AnimationStudies/roll-v2/roll-v2.webp": [
    0.20703125,
    0.20703125
  ],
  "DesignAssets/Tribes/pebble/BaseParts/body.png": [
    0.439453125,
    0.439453125
  ],
  "DesignAssets/Tribes/pebble/Nests/nest-stage-01.png": [
    0.5215311004784688,
    0.5215311004784688
  ],
  "DesignAssets/Tribes/pebble/starter.png": [
    0.0733652312599681,
    0.0733652312599681
  ],
  "DesignAssets/Tribes/spore/Animations/Units/jump/jump.webp": [
    1,
    1
  ],
  "DesignAssets/Tribes/spore/AnimationStudies/attack-directions-v3/right/attack.webp": [
    0.19921875,
    0.19921875
  ],
  "DesignAssets/Tribes/spore/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": [
    0.19921875,
    0.19921875
  ],
  "DesignAssets/Tribes/spore/AnimationStudies/hurt-v2/hurt-v2.webp": [
    0.19921875,
    0.19921875
  ],
  "DesignAssets/Tribes/spore/AnimationStudies/idle-v8/idle-v8.webp": [
    0.4375,
    0.4375
  ],
  "DesignAssets/Tribes/spore/AnimationStudies/walk-v2/walk-v2.webp": [
    1,
    1
  ],
  "DesignAssets/Tribes/spore/BaseParts/body.png": [
    0.439453125,
    0.439453125
  ],
  "DesignAssets/Tribes/spore/Nests/nest-stage-01.png": [
    0.4696969696969697,
    0.4696969696969697
  ],
  "DesignAssets/Tribes/spore/starter.png": [
    0.06937799043062201,
    0.06937799043062201
  ],
  "DesignAssets/Tribes/spring/Animations/Units/jump/jump.webp": [
    1,
    1
  ],
  "DesignAssets/Tribes/spring/AnimationStudies/attack-directions-v3/right/attack.webp": [
    0.318359375,
    0.318359375
  ],
  "DesignAssets/Tribes/spring/AnimationStudies/birth-detach-v1/birth-unit.webp": [
    0.4609375,
    0.4609375
  ],
  "DesignAssets/Tribes/spring/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": [
    0.318359375,
    0.318359375
  ],
  "DesignAssets/Tribes/spring/AnimationStudies/flow-v4/flow-v4.webp": [
    1,
    1
  ],
  "DesignAssets/Tribes/spring/AnimationStudies/hurt-v2/hurt-v2.webp": [
    0.318359375,
    0.318359375
  ],
  "DesignAssets/Tribes/spring/AnimationStudies/idle-v4/idle-v4.webp": [
    0.4375,
    0.4375
  ],
  "DesignAssets/Tribes/spring/BaseParts/body.png": [
    0.439453125,
    0.439453125
  ],
  "DesignAssets/Tribes/spring/Nests/nest-stage-01.png": [
    0.37034949267192785,
    0.3697857948139797
  ],
  "DesignAssets/Tribes/spring/starter.png": [
    0.09170653907496013,
    0.09170653907496013
  ],
  "DesignAssets/Tribes/sprout/AnimationStudies/death-v1/death-runtime.webp": [
    0.45703125,
    0.45703125
  ],
  "DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp": [
    0.4375,
    0.4375
  ],
  "DesignAssets/Units/BaseParts/body.png": [
    0.09090909090909091,
    0.09172661870503597
  ],
  "DesignAssets/Units/BaseParts/sprout-left.png": [
    0.06118881118881119,
    0.06115107913669065
  ],
  "DesignAssets/Units/BaseParts/sprout-right.png": [
    0.06118881118881119,
    0.06115107913669065
  ],
  "DesignAssets/Units/BaseParts/sprout-stem.png": [
    0.055944055944055944,
    0.05575539568345324
  ],
  "DesignAssets/Units/Parts/antenna-1.png": [
    0.07172995780590717,
    0.07176470588235294
  ],
  "DesignAssets/Units/Parts/antenna-2.png": [
    0.059834123222748815,
    0.059490084985835696
  ],
  "DesignAssets/Units/Parts/feet-1.png": [
    0.06878306878306878,
    0.06935483870967742
  ],
  "DesignAssets/Units/Parts/feet-2.png": [
    0.04061784897025172,
    0.041044776119402986
  ],
  "DesignAssets/Units/Parts/strength-1.png": [
    0.06914893617021277,
    0.06761006289308176
  ],
  "DesignAssets/Units/Parts/strength-2.png": [
    0.046875,
    0.046089385474860335
  ],
  "DesignAssets/Units/spiny-back-beetle.png": [
    0.16845703125,
    0.16845703125
  ],
  "DesignAssets/Units/starter-sprout-bean.png": [
    0.09090909090909091,
    0.09172661870503597
  ],
  "DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/birth-unit.webp": [0.3333333333333333, 0.3333333333333333]
});

return { IMAGE_SCALES };
})();
modules["client/unit-sprite-registration.mjs"] = (() => {
const UNIT_SPRITE_REGISTRATION = Object.freeze({
  "DesignAssets/Animations/CreatureWalkV2/flower-tail-bird/walk.webp": Object.freeze({"frameSize":388,"viewSize":388,"pivotX":170.0,"pivotY":320.0,"groundRadiusX":0.14433,"groundRadiusY":0.043814,"registrationScale":1,"cyclesPerCell":1.0}),
  "DesignAssets/Animations/CreatureWalkV2/dew-rabbit/walk.webp": Object.freeze({"frameSize":433,"viewSize":429.51,"pivotX":221.885,"pivotY":401.035,"groundRadiusX":0.199041,"groundRadiusY":0.03717,"registrationScale":1,"travelWindow":[0.18,0.56],"cyclesPerCell":1}),
  "DesignAssets/Animations/CreatureWalkV2/bundle-snail/walk.webp": Object.freeze({"frameSize":398,"viewSize":374.12,"pivotX":201.1,"pivotY":294.83,"groundRadiusX":0.288945,"groundRadiusY":0.04397,"registrationScale":1,"travelWindow":[0.22,0.82],"cyclesPerCell":1,"frameGeometry":{"0":{"pivotX":200.6,"pivotY":294.83},"1":{"pivotX":201.6,"pivotY":294.83},"2":{"pivotX":201.6,"pivotY":295.58},"3":{"pivotX":199.6,"pivotY":293.83},"4":{"pivotX":202.1,"pivotY":295.33},"5":{"pivotX":200.35,"pivotY":295.08},"6":{"pivotX":201.6,"pivotY":295.08},"7":{"pivotX":201.35,"pivotY":294.08}}}),
  "DesignAssets/Animations/CreatureWalkV2/rolling-acorn/walk.webp": Object.freeze({"frameSize":420,"viewSize":420,"pivotX":205.0,"pivotY":335.5,"groundRadiusX":0.178571,"groundRadiusY":0.039286,"registrationScale":1,"cyclesPerCell":0.4}),
  "DesignAssets/Animations/CreatureWalkV2/soil-boar/walk.webp": Object.freeze({"frameSize":256,"viewSize":253.426415,"pivotX":131.077358,"pivotY":180.745283,"groundRadiusX":0.325203,"groundRadiusY":0.04607,"registrationScale":1,"cyclesPerCell":2}),
  "DesignAssets/Animations/CreatureWalkV2/bubble-toad/walk.webp": Object.freeze({"frameSize":288,"viewSize":239.758491,"pivotX":147.854716,"pivotY":216.69434,"groundRadiusX":0.34626,"groundRadiusY":0.027701,"registrationScale":1,"travelWindow":[0.22727272727272727,0.5227272727272727],"cyclesPerCell":1}),
  "DesignAssets/Animations/CreatureWalkV2/vine-turtle/walk.webp": Object.freeze({"frameSize":256,"viewSize":256,"pivotX":131.25,"pivotY":220.81,"groundRadiusX":0.401734,"groundRadiusY":0.028902,"registrationScale":1,"cyclesPerCell":1.5,"frameGeometry":{"0":{"pivotX":132.25,"pivotY":221.31},"1":{"pivotX":132.25,"pivotY":221.06},"2":{"pivotX":128.25,"pivotY":220.31},"3":{"pivotX":134.25,"pivotY":220.31},"4":{"pivotX":129.75,"pivotY":221.81},"5":{"pivotX":131.25,"pivotY":219.56},"6":{"pivotX":129.25,"pivotY":221.81},"7":{"pivotX":133.25,"pivotY":220.31}}}),
  "DesignAssets/Animations/CreatureWalkV2/snare-vine/walk.webp": Object.freeze({"frameSize":256,"viewSize":263.68,"pivotX":128.537358,"pivotY":227.825659,"groundRadiusX":0.122642,"groundRadiusY":0.021226,"registrationScale":1,"cyclesPerCell":1.428571}),
  "DesignAssets/Animations/CreatureWalkV2/talon-owl/walk.webp": Object.freeze({"frameSize":432,"viewSize":271.36,"pivotX":209.783704,"pivotY":318.478519,"registrationScale":1,"cyclesPerCell":1.0}),
  "DesignAssets/Animations/CreatureWalkV2/spring-keeper/walk.webp": Object.freeze({"frameSize":512,"viewSize":384,"pivotX":207.0,"pivotY":344.0,"groundRadiusX":0.125,"groundRadiusY":0.028646,"registrationScale":1,"cyclesPerCell":1.25}),
  "DesignAssets/Animations/CreatureWalkV2/lantern-keeper/walk.webp": Object.freeze({"frameSize":384,"viewSize":360.96,"pivotX":187.4,"pivotY":313.72,"groundRadiusX":0.182292,"groundRadiusY":0.033854,"registrationScale":1,"travelWindow":[0.32432432432432434,0.6486486486486487],"cyclesPerCell":1}),
  "DesignAssets/Animations/CreatureWalkV2/old-garden-snail/walk.webp": Object.freeze({"frameSize":352,"viewSize":352,"pivotX":172.0,"pivotY":291.0,"groundRadiusX":0.318182,"groundRadiusY":0.056818,"registrationScale":1,"travelWindow":[0.25,0.82],"cyclesPerCell":1,"frameGeometry":{"0":{"pivotX":169.0,"pivotY":291.0},"1":{"pivotX":175.0,"pivotY":290.75},"2":{"pivotX":175.0,"pivotY":291.5},"3":{"pivotX":169.0,"pivotY":290.25},"4":{"pivotX":172.75,"pivotY":292.0},"5":{"pivotX":175.0,"pivotY":290.5}}}),
  "DesignAssets/Animations/CreatureWalkV2/spiny-back-leader/walk.webp": Object.freeze({"frameSize":256,"viewSize":248.32,"pivotX":132.87,"pivotY":196.51,"groundRadiusX":0.398438,"groundRadiusY":0.085938,"registrationScale":1,"cyclesPerCell":1.428571,"frameGeometry":{"0":{"pivotX":135.87,"pivotY":196.51},"1":{"pivotX":131.87,"pivotY":196.01},"2":{"pivotX":132.62,"pivotY":197.26},"3":{"pivotX":132.12,"pivotY":196.51},"4":{"pivotX":133.62,"pivotY":196.26},"5":{"pivotX":130.62,"pivotY":196.51}}}),
  "DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp": Object.freeze({"frameSize":631,"pivotX":315.5,"pivotY":553.268115942029,"viewSize":631,"registrationScale":1.2321428571428572}),
  "DesignAssets/Animations/UnitAttack/attack.png": Object.freeze({"frameSize":632,"pivotX":316,"pivotY":555.1351351351351,"viewSize":632,"registrationScale":1.2333333333333334}),
  "DesignAssets/Animations/UnitHurt/V3/hurt.png": Object.freeze({"frameSize":632,"pivotX":316,"pivotY":555.1351351351351,"viewSize":632,"registrationScale":1.2333333333333334}),
  "DesignAssets/Tribes/sprout/AnimationStudies/death-v1/death-runtime.webp": Object.freeze({"frameSize":316,"pivotX":158,"pivotY":276.5,"viewSize":316,"registrationScale":1.2307692307692308}),
  "DesignAssets/Tribes/spore/AnimationStudies/idle-v8/idle-v8.webp": Object.freeze({"frameSize":549,"pivotX":274.5,"pivotY":480.375,"viewSize":549,"registrationScale":1.0714285714285714}),
  "DesignAssets/Tribes/spore/AnimationStudies/attack-directions-v3/right/attack.webp": Object.freeze({"frameSize":553,"pivotX":276.5,"pivotY":482.6181818181818,"viewSize":553,"registrationScale":1.0784313725490196}),
  "DesignAssets/Tribes/spore/AnimationStudies/hurt-v2/hurt-v2.webp": Object.freeze({"frameSize":553,"pivotX":276.5,"pivotY":482.6181818181818,"viewSize":553,"registrationScale":1.0784313725490196}),
  "DesignAssets/Tribes/spore/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": Object.freeze({"frameSize":553,"pivotX":276.5,"pivotY":482.6181818181818,"viewSize":553,"registrationScale":1.0784313725490196}),
  "DesignAssets/Tribes/pebble/AnimationStudies/idle-v3/idle-v3.webp": Object.freeze({"frameSize":512,"pivotX":256,"pivotY":448,"viewSize":512,"registrationScale":1}),
  "DesignAssets/Tribes/pebble/AnimationStudies/attack-directions-v3/right/attack.webp": Object.freeze({"frameSize":512,"pivotX":256,"pivotY":448,"viewSize":512,"registrationScale":1}),
  "DesignAssets/Tribes/pebble/AnimationStudies/hurt-v2/hurt-v2.webp": Object.freeze({"frameSize":517,"pivotX":258.5,"pivotY":453.5943396226415,"viewSize":517,"registrationScale":1.0095238095238095}),
  "DesignAssets/Tribes/pebble/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": Object.freeze({"frameSize":517,"pivotX":258.5,"pivotY":453.5943396226415,"viewSize":517,"registrationScale":1.0095238095238095}),
  "DesignAssets/Tribes/spring/AnimationStudies/idle-v4/idle-v4.webp": Object.freeze({"frameSize":512,"pivotX":256,"pivotY":448,"viewSize":512,"registrationScale":1}),
  "DesignAssets/Tribes/spring/AnimationStudies/attack-directions-v3/right/attack.webp": Object.freeze({"frameSize":516,"pivotX":258,"pivotY":453.07317073170736,"viewSize":516,"registrationScale":1.0061349693251533}),
  "DesignAssets/Tribes/spring/AnimationStudies/hurt-v2/hurt-v2.webp": Object.freeze({"frameSize":516,"pivotX":258,"pivotY":453.07317073170736,"viewSize":516,"registrationScale":1.0061349693251533}),
  "DesignAssets/Tribes/spring/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": Object.freeze({"frameSize":516,"pivotX":258,"pivotY":453.07317073170736,"viewSize":516,"registrationScale":1.0061349693251533}),
  "DesignAssets/Animations/CreatureIdleV3/flower-tail-bird/idle.webp": Object.freeze({"frameSize":440,"pivotX":226,"pivotY":367,"viewSize":440,"registrationScale":1.134020618556701,"groundRadiusX":0.14433,"groundRadiusY":0.043814}),
  "DesignAssets/Animations/CreatureAttackV2/flower-tail-bird/runtime.webp": Object.freeze({"frameSize":320,"pivotX":164.280041,"pivotY":267.159876,"viewSize":312.9622641509434,"registrationScale":1.1307420494699647,"groundRadiusX":0.14433,"groundRadiusY":0.043814}),
  "DesignAssets/Animations/CreatureHurtV6/flower-tail-bird/hurt.webp": Object.freeze({"frameSize":440,"pivotX":226,"pivotY":367,"viewSize":440,"registrationScale":1.134020618556701,"groundRadiusX":0.14433,"groundRadiusY":0.043814}),
  "DesignAssets/Animations/CreatureDeathV4/flower-tail-bird/runtime.webp": Object.freeze({"frameSize":290,"pivotX":148.958763,"pivotY":242.123711,"viewSize":290,"registrationScale":1.1328125,"groundRadiusX":0.14433,"groundRadiusY":0.043814,"frameGeometry":{"0":{"pivotX":148.958763,"pivotY":242.123711,"groundRadiusX":0.14433,"groundRadiusY":0.043814},"1":{"pivotX":149.194866,"pivotY":242.170305,"groundRadiusX":0.146325,"groundRadiusY":0.043683},"2":{"pivotX":149.430968,"pivotY":242.216899,"groundRadiusX":0.148321,"groundRadiusY":0.043551},"3":{"pivotX":149.667071,"pivotY":242.263493,"groundRadiusX":0.150316,"groundRadiusY":0.04342},"4":{"pivotX":149.903174,"pivotY":242.310087,"groundRadiusX":0.152311,"groundRadiusY":0.043289},"5":{"pivotX":150.139276,"pivotY":242.356681,"groundRadiusX":0.154307,"groundRadiusY":0.043157},"6":{"pivotX":150.375379,"pivotY":242.403275,"groundRadiusX":0.156302,"groundRadiusY":0.043026},"7":{"pivotX":150.611482,"pivotY":242.449869,"groundRadiusX":0.158297,"groundRadiusY":0.042894},"8":{"pivotX":150.847584,"pivotY":242.496463,"groundRadiusX":0.160293,"groundRadiusY":0.042763},"9":{"pivotX":151.083687,"pivotY":242.543056,"groundRadiusX":0.162288,"groundRadiusY":0.042631},"10":{"pivotX":151.31979,"pivotY":242.58965,"groundRadiusX":0.164284,"groundRadiusY":0.0425},"11":{"pivotX":151.555892,"pivotY":242.636244,"groundRadiusX":0.166279,"groundRadiusY":0.042368},"12":{"pivotX":151.791995,"pivotY":242.682838,"groundRadiusX":0.168274,"groundRadiusY":0.042237},"13":{"pivotX":152.028098,"pivotY":242.729432,"groundRadiusX":0.17027,"groundRadiusY":0.042105},"14":{"pivotX":152.264201,"pivotY":242.776026,"groundRadiusX":0.172265,"groundRadiusY":0.041974},"15":{"pivotX":152.500303,"pivotY":242.82262,"groundRadiusX":0.17426,"groundRadiusY":0.041842},"16":{"pivotX":152.736406,"pivotY":242.869214,"groundRadiusX":0.176256,"groundRadiusY":0.041711},"17":{"pivotX":152.972509,"pivotY":242.915808,"groundRadiusX":0.178251,"groundRadiusY":0.041579},"18":{"pivotX":153.208611,"pivotY":242.962401,"groundRadiusX":0.180247,"groundRadiusY":0.041448},"19":{"pivotX":153.444714,"pivotY":243.008995,"groundRadiusX":0.182242,"groundRadiusY":0.041316},"20":{"pivotX":153.680817,"pivotY":243.055589,"groundRadiusX":0.184237,"groundRadiusY":0.041185},"21":{"pivotX":153.916919,"pivotY":243.102183,"groundRadiusX":0.186233,"groundRadiusY":0.041054},"22":{"pivotX":154.153022,"pivotY":243.148777,"groundRadiusX":0.188228,"groundRadiusY":0.040922},"23":{"pivotX":154.389125,"pivotY":243.195371,"groundRadiusX":0.190223,"groundRadiusY":0.040791},"24":{"pivotX":154.625227,"pivotY":243.241965,"groundRadiusX":0.192219,"groundRadiusY":0.040659},"25":{"pivotX":154.86133,"pivotY":243.288559,"groundRadiusX":0.194214,"groundRadiusY":0.040528},"26":{"pivotX":155.097433,"pivotY":243.335153,"groundRadiusX":0.19621,"groundRadiusY":0.040396},"27":{"pivotX":155.333535,"pivotY":243.381747,"groundRadiusX":0.198205,"groundRadiusY":0.040265},"28":{"pivotX":155.569638,"pivotY":243.42834,"groundRadiusX":0.2002,"groundRadiusY":0.040133},"29":{"pivotX":155.805741,"pivotY":243.474934,"groundRadiusX":0.202196,"groundRadiusY":0.040002},"30":{"pivotX":156.041844,"pivotY":243.521528,"groundRadiusX":0.204191,"groundRadiusY":0.03987},"31":{"pivotX":156.277946,"pivotY":243.568122,"groundRadiusX":0.206186,"groundRadiusY":0.039739},"32":{"pivotX":156.514049,"pivotY":243.614716,"groundRadiusX":0.208182,"groundRadiusY":0.039607},"33":{"pivotX":156.750152,"pivotY":243.66131,"groundRadiusX":0.210177,"groundRadiusY":0.039476},"34":{"pivotX":156.986254,"pivotY":243.707904,"groundRadiusX":0.212172,"groundRadiusY":0.039344},"35":{"pivotX":157.222357,"pivotY":243.754498,"groundRadiusX":0.214168,"groundRadiusY":0.039213},"36":{"pivotX":157.45846,"pivotY":243.801092,"groundRadiusX":0.216163,"groundRadiusY":0.039081},"37":{"pivotX":157.694562,"pivotY":243.847685,"groundRadiusX":0.218159,"groundRadiusY":0.03895},"38":{"pivotX":157.930665,"pivotY":243.894279,"groundRadiusX":0.220154,"groundRadiusY":0.038819},"39":{"pivotX":158.166768,"pivotY":243.940873,"groundRadiusX":0.222149,"groundRadiusY":0.038687},"40":{"pivotX":158.40287,"pivotY":243.987467,"groundRadiusX":0.224145,"groundRadiusY":0.038556},"41":{"pivotX":158.638973,"pivotY":244.034061,"groundRadiusX":0.22614,"groundRadiusY":0.038424},"42":{"pivotX":158.875076,"pivotY":244.080655,"groundRadiusX":0.228135,"groundRadiusY":0.038293},"43":{"pivotX":159.111178,"pivotY":244.127249,"groundRadiusX":0.230131,"groundRadiusY":0.038161},"44":{"pivotX":159.347281,"pivotY":244.173843,"groundRadiusX":0.232126,"groundRadiusY":0.03803},"45":{"pivotX":159.583384,"pivotY":244.220437,"groundRadiusX":0.234122,"groundRadiusY":0.037898},"46":{"pivotX":159.819487,"pivotY":244.267031,"groundRadiusX":0.236117,"groundRadiusY":0.037767},"47":{"pivotX":160.055589,"pivotY":244.313624,"groundRadiusX":0.238112,"groundRadiusY":0.037635},"48":{"pivotX":160.291692,"pivotY":244.360218,"groundRadiusX":0.240108,"groundRadiusY":0.037504},"49":{"pivotX":160.527795,"pivotY":244.406812,"groundRadiusX":0.242103,"groundRadiusY":0.037372},"50":{"pivotX":160.763897,"pivotY":244.453406,"groundRadiusX":0.244098,"groundRadiusY":0.037241},"51":{"pivotX":161,"pivotY":244.5,"groundRadiusX":0.246094,"groundRadiusY":0.037109}}}),
  "DesignAssets/Animations/CreatureIdleV3/dew-rabbit/idle.webp": Object.freeze({"frameSize":430,"pivotX":223,"pivotY":360.5,"viewSize":430,"registrationScale":1.0311750599520384,"groundRadiusX":0.199041,"groundRadiusY":0.03717}),
  "DesignAssets/Animations/CreatureHurtV5/dew-rabbit/hurt.webp": Object.freeze({"frameSize":430,"pivotX":223,"pivotY":360.5,"viewSize":430,"registrationScale":1.0311750599520384,"groundRadiusX":0.199041,"groundRadiusY":0.03717}),
  "DesignAssets/Animations/CreatureDeathV6/dew-rabbit/runtime.webp": Object.freeze({"frameSize":264,"pivotX":136.911271,"pivotY":221.484412,"viewSize":264,"registrationScale":1.03125,"groundRadiusX":0.199041,"groundRadiusY":0.03717,"frameGeometry":{"0":{"pivotX":136.911271,"pivotY":221.484412,"groundRadiusX":0.199041,"groundRadiusY":0.03717},"1":{"pivotX":137.070949,"pivotY":221.413429,"groundRadiusX":0.200106,"groundRadiusY":0.037224},"2":{"pivotX":137.230627,"pivotY":221.342446,"groundRadiusX":0.201171,"groundRadiusY":0.037278},"3":{"pivotX":137.390305,"pivotY":221.271463,"groundRadiusX":0.202237,"groundRadiusY":0.037332},"4":{"pivotX":137.549983,"pivotY":221.20048,"groundRadiusX":0.203302,"groundRadiusY":0.037387},"5":{"pivotX":137.709661,"pivotY":221.129496,"groundRadiusX":0.204368,"groundRadiusY":0.037441},"6":{"pivotX":137.869339,"pivotY":221.058513,"groundRadiusX":0.205433,"groundRadiusY":0.037495},"7":{"pivotX":138.029017,"pivotY":220.98753,"groundRadiusX":0.206498,"groundRadiusY":0.037549},"8":{"pivotX":138.188695,"pivotY":220.916547,"groundRadiusX":0.207564,"groundRadiusY":0.037603},"9":{"pivotX":138.348373,"pivotY":220.845564,"groundRadiusX":0.208629,"groundRadiusY":0.037657},"10":{"pivotX":138.508051,"pivotY":220.77458,"groundRadiusX":0.209694,"groundRadiusY":0.037711},"11":{"pivotX":138.667729,"pivotY":220.703597,"groundRadiusX":0.21076,"groundRadiusY":0.037765},"12":{"pivotX":138.827407,"pivotY":220.632614,"groundRadiusX":0.211825,"groundRadiusY":0.037819},"13":{"pivotX":138.987085,"pivotY":220.561631,"groundRadiusX":0.21289,"groundRadiusY":0.037873},"14":{"pivotX":139.146763,"pivotY":220.490647,"groundRadiusX":0.213956,"groundRadiusY":0.037927},"15":{"pivotX":139.306441,"pivotY":220.419664,"groundRadiusX":0.215021,"groundRadiusY":0.037981},"16":{"pivotX":139.466119,"pivotY":220.348681,"groundRadiusX":0.216086,"groundRadiusY":0.038035},"17":{"pivotX":139.625797,"pivotY":220.277698,"groundRadiusX":0.217152,"groundRadiusY":0.038089},"18":{"pivotX":139.785474,"pivotY":220.206715,"groundRadiusX":0.218217,"groundRadiusY":0.038143},"19":{"pivotX":139.945152,"pivotY":220.135731,"groundRadiusX":0.219282,"groundRadiusY":0.038197},"20":{"pivotX":140.10483,"pivotY":220.064748,"groundRadiusX":0.220348,"groundRadiusY":0.038252},"21":{"pivotX":140.264508,"pivotY":219.993765,"groundRadiusX":0.221413,"groundRadiusY":0.038306},"22":{"pivotX":140.424186,"pivotY":219.922782,"groundRadiusX":0.222479,"groundRadiusY":0.03836},"23":{"pivotX":140.583864,"pivotY":219.851799,"groundRadiusX":0.223544,"groundRadiusY":0.038414},"24":{"pivotX":140.743542,"pivotY":219.780815,"groundRadiusX":0.224609,"groundRadiusY":0.038468},"25":{"pivotX":140.90322,"pivotY":219.709832,"groundRadiusX":0.225675,"groundRadiusY":0.038522},"26":{"pivotX":141.062898,"pivotY":219.638849,"groundRadiusX":0.22674,"groundRadiusY":0.038576},"27":{"pivotX":141.222576,"pivotY":219.567866,"groundRadiusX":0.227805,"groundRadiusY":0.03863},"28":{"pivotX":141.382254,"pivotY":219.496882,"groundRadiusX":0.228871,"groundRadiusY":0.038684},"29":{"pivotX":141.541932,"pivotY":219.425899,"groundRadiusX":0.229936,"groundRadiusY":0.038738},"30":{"pivotX":141.70161,"pivotY":219.354916,"groundRadiusX":0.231001,"groundRadiusY":0.038792},"31":{"pivotX":141.861288,"pivotY":219.283933,"groundRadiusX":0.232067,"groundRadiusY":0.038846},"32":{"pivotX":142.020966,"pivotY":219.21295,"groundRadiusX":0.233132,"groundRadiusY":0.0389},"33":{"pivotX":142.180644,"pivotY":219.141966,"groundRadiusX":0.234197,"groundRadiusY":0.038954},"34":{"pivotX":142.340322,"pivotY":219.070983,"groundRadiusX":0.235263,"groundRadiusY":0.039008},"35":{"pivotX":142.5,"pivotY":219,"groundRadiusX":0.236328,"groundRadiusY":0.039063}}}),
  "DesignAssets/Animations/CreatureIdleV3/soil-mole/idle.webp": Object.freeze({"frameSize":356,"pivotX":187.5,"pivotY":281,"viewSize":356,"registrationScale":1.0028169014084507,"groundRadiusX":0.387324,"groundRadiusY":0.087324}),
  "DesignAssets/Animations/CreatureHurtV5/soil-mole/hurt.webp": Object.freeze({"frameSize":356,"pivotX":187.5,"pivotY":281,"viewSize":356,"registrationScale":1.0028169014084507,"groundRadiusX":0.387324,"groundRadiusY":0.087324}),
  "DesignAssets/Animations/CreatureDeathV6/soil-mole/runtime.webp": Object.freeze({"frameSize":258,"pivotX":135.852598,"pivotY":203.638891,"viewSize":258.0713165605441,"registrationScale":1.0078125,"groundRadiusX":0.387324,"groundRadiusY":0.087324,"frameGeometry":{"0":{"pivotX":135.852598,"pivotY":203.638891,"groundRadiusX":0.387324,"groundRadiusY":0.087324},"1":{"pivotX":135.730798,"pivotY":202.904764,"groundRadiusX":0.387222,"groundRadiusY":0.086844},"2":{"pivotX":135.608999,"pivotY":202.170636,"groundRadiusX":0.38712,"groundRadiusY":0.086363},"3":{"pivotX":135.487199,"pivotY":201.436509,"groundRadiusX":0.387019,"groundRadiusY":0.085883},"4":{"pivotX":135.365399,"pivotY":200.702382,"groundRadiusX":0.386917,"groundRadiusY":0.085402},"5":{"pivotX":135.243599,"pivotY":199.968255,"groundRadiusX":0.386815,"groundRadiusY":0.084922},"6":{"pivotX":135.1218,"pivotY":199.234127,"groundRadiusX":0.386714,"groundRadiusY":0.084442},"7":{"pivotX":135,"pivotY":198.5,"groundRadiusX":0.386612,"groundRadiusY":0.083961}}}),
  "DesignAssets/Animations/CreatureIdleV4/bundle-snail/idle.webp": Object.freeze({"frameSize":470,"pivotX":227,"pivotY":393.5,"viewSize":469.99999999999994,"registrationScale":1.1809045226130652,"groundRadiusX":0.288945,"groundRadiusY":0.04397}),
  "DesignAssets/Animations/CreatureAttackV2/bundle-snail/runtime.webp": Object.freeze({"frameSize":346,"pivotX":167.645373,"pivotY":291.286754,"viewSize":314.57975375441697,"registrationScale":1.180887372013652,"groundRadiusX":0.288945,"groundRadiusY":0.04397}),
  "DesignAssets/Animations/CreatureHurtV7/bundle-snail/hurt.webp": Object.freeze({"frameSize":470,"pivotX":227,"pivotY":393.5,"viewSize":469.99999999999994,"registrationScale":1.1809045226130652,"groundRadiusX":0.288945,"groundRadiusY":0.04397}),
  "DesignAssets/Animations/SnailDeathV1/bundle-snail/runtime.webp": Object.freeze({"frameSize":304,"pivotX":146.855124,"pivotY":254.745583,"viewSize":303.94964664310953,"registrationScale":1.1875,"groundRadiusX":0.288945,"groundRadiusY":0.04397,"frameGeometry":{"0":{"pivotX":146.855124,"pivotY":254.745583,"groundRadiusX":0.288945,"groundRadiusY":0.04397},"1":{"pivotX":147.120478,"pivotY":254.751641,"groundRadiusX":0.285786,"groundRadiusY":0.043946},"2":{"pivotX":147.385832,"pivotY":254.757698,"groundRadiusX":0.282627,"groundRadiusY":0.043923},"3":{"pivotX":147.651186,"pivotY":254.763756,"groundRadiusX":0.279468,"groundRadiusY":0.043899},"4":{"pivotX":147.91654,"pivotY":254.769813,"groundRadiusX":0.27631,"groundRadiusY":0.043875},"5":{"pivotX":148.181895,"pivotY":254.775871,"groundRadiusX":0.273151,"groundRadiusY":0.043852},"6":{"pivotX":148.447249,"pivotY":254.781928,"groundRadiusX":0.269992,"groundRadiusY":0.043828},"7":{"pivotX":148.712603,"pivotY":254.787986,"groundRadiusX":0.266833,"groundRadiusY":0.043804},"8":{"pivotX":148.977957,"pivotY":254.794043,"groundRadiusX":0.263674,"groundRadiusY":0.043781},"9":{"pivotX":149.243311,"pivotY":254.800101,"groundRadiusX":0.260516,"groundRadiusY":0.043757},"10":{"pivotX":149.508666,"pivotY":254.806159,"groundRadiusX":0.257357,"groundRadiusY":0.043733},"11":{"pivotX":149.77402,"pivotY":254.812216,"groundRadiusX":0.254198,"groundRadiusY":0.04371},"12":{"pivotX":150.039374,"pivotY":254.818274,"groundRadiusX":0.251039,"groundRadiusY":0.043686},"13":{"pivotX":150.304728,"pivotY":254.824331,"groundRadiusX":0.247881,"groundRadiusY":0.043662},"14":{"pivotX":150.570082,"pivotY":254.830389,"groundRadiusX":0.244722,"groundRadiusY":0.043639},"15":{"pivotX":150.835437,"pivotY":254.836446,"groundRadiusX":0.241563,"groundRadiusY":0.043615},"16":{"pivotX":151.100791,"pivotY":254.842504,"groundRadiusX":0.238404,"groundRadiusY":0.043591},"17":{"pivotX":151.366145,"pivotY":254.848561,"groundRadiusX":0.235245,"groundRadiusY":0.043568},"18":{"pivotX":151.631499,"pivotY":254.854619,"groundRadiusX":0.232087,"groundRadiusY":0.043544},"19":{"pivotX":151.896853,"pivotY":254.860676,"groundRadiusX":0.228928,"groundRadiusY":0.04352},"20":{"pivotX":152.162208,"pivotY":254.866734,"groundRadiusX":0.225769,"groundRadiusY":0.043497},"21":{"pivotX":152.427562,"pivotY":254.872792,"groundRadiusX":0.22261,"groundRadiusY":0.043473},"22":{"pivotX":152.692916,"pivotY":254.878849,"groundRadiusX":0.219452,"groundRadiusY":0.043449},"23":{"pivotX":152.95827,"pivotY":254.884907,"groundRadiusX":0.216293,"groundRadiusY":0.043426},"24":{"pivotX":153.223624,"pivotY":254.890964,"groundRadiusX":0.213134,"groundRadiusY":0.043402},"25":{"pivotX":153.488979,"pivotY":254.897022,"groundRadiusX":0.209975,"groundRadiusY":0.043378},"26":{"pivotX":153.754333,"pivotY":254.903079,"groundRadiusX":0.206816,"groundRadiusY":0.043355},"27":{"pivotX":154.019687,"pivotY":254.909137,"groundRadiusX":0.203658,"groundRadiusY":0.043331},"28":{"pivotX":154.285041,"pivotY":254.915194,"groundRadiusX":0.200499,"groundRadiusY":0.043307},"29":{"pivotX":154.550395,"pivotY":254.921252,"groundRadiusX":0.19734,"groundRadiusY":0.043284},"30":{"pivotX":154.81575,"pivotY":254.927309,"groundRadiusX":0.194181,"groundRadiusY":0.04326},"31":{"pivotX":155.081104,"pivotY":254.933367,"groundRadiusX":0.191022,"groundRadiusY":0.043236},"32":{"pivotX":155.346458,"pivotY":254.939425,"groundRadiusX":0.187864,"groundRadiusY":0.043213},"33":{"pivotX":155.611812,"pivotY":254.945482,"groundRadiusX":0.184705,"groundRadiusY":0.043189},"34":{"pivotX":155.877166,"pivotY":254.95154,"groundRadiusX":0.181546,"groundRadiusY":0.043165},"35":{"pivotX":156.142521,"pivotY":254.957597,"groundRadiusX":0.178387,"groundRadiusY":0.043142},"36":{"pivotX":156.407875,"pivotY":254.963655,"groundRadiusX":0.175229,"groundRadiusY":0.043118},"37":{"pivotX":156.673229,"pivotY":254.969712,"groundRadiusX":0.17207,"groundRadiusY":0.043094},"38":{"pivotX":156.938583,"pivotY":254.97577,"groundRadiusX":0.168911,"groundRadiusY":0.043071},"39":{"pivotX":157.203937,"pivotY":254.981827,"groundRadiusX":0.165752,"groundRadiusY":0.043047},"40":{"pivotX":157.469292,"pivotY":254.987885,"groundRadiusX":0.162593,"groundRadiusY":0.043023},"41":{"pivotX":157.734646,"pivotY":254.993942,"groundRadiusX":0.159435,"groundRadiusY":0.043},"42":{"pivotX":158,"pivotY":255,"groundRadiusX":0.156276,"groundRadiusY":0.042976}}}),
  "DesignAssets/Animations/CottonSheepIdle/CalmV5/idle-runtime.webp": Object.freeze({"frameSize":256,"pivotX":142.5,"pivotY":204.5,"viewSize":256,"registrationScale":1,"groundRadiusX":0.244141,"groundRadiusY":0.064453}),
  "DesignAssets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp": Object.freeze({"frameSize":290,"pivotX":159.54366,"pivotY":234.441284,"viewSize":256.7708333333333,"registrationScale":1,"groundRadiusX":0.244141,"groundRadiusY":0.064453,"frameGeometry":{"0":{"pivotX":159.54366,"pivotY":234.441284},"1":{"pivotX":156.04366,"pivotY":234.441284},"2":{"pivotX":158.54366,"pivotY":236.441284},"3":{"pivotX":174.04366,"pivotY":248.441284},"4":{"pivotX":199.54366,"pivotY":240.441284},"5":{"pivotX":166.54366,"pivotY":238.441284},"6":{"pivotX":158.04366,"pivotY":235.441284},"7":{"pivotX":159.54366,"pivotY":234.441284}},"fixedSupport":true}),
  "DesignAssets/Animations/CreatureHurtV5/cotton-sheep/hurt.webp": Object.freeze({"frameSize":256,"pivotX":142.5,"pivotY":204.5,"viewSize":256,"registrationScale":1,"groundRadiusX":0.244141,"groundRadiusY":0.064453}),
  "DesignAssets/Animations/CreatureDeathV6/cotton-sheep/runtime.webp": Object.freeze({"frameSize":256,"pivotX":142.5,"pivotY":204.5,"viewSize":256,"registrationScale":1,"groundRadiusX":0.244141,"groundRadiusY":0.064453,"frameGeometry":{"0":{"pivotX":142.5,"pivotY":204.5,"groundRadiusX":0.244141,"groundRadiusY":0.064453},"1":{"pivotX":140.5,"pivotY":205.214286,"groundRadiusX":0.254185,"groundRadiusY":0.063337},"2":{"pivotX":138.5,"pivotY":205.928571,"groundRadiusX":0.26423,"groundRadiusY":0.062221},"3":{"pivotX":136.5,"pivotY":206.642857,"groundRadiusX":0.274275,"groundRadiusY":0.061105},"4":{"pivotX":134.5,"pivotY":207.357143,"groundRadiusX":0.284319,"groundRadiusY":0.059989},"5":{"pivotX":132.5,"pivotY":208.071429,"groundRadiusX":0.294364,"groundRadiusY":0.058873},"6":{"pivotX":130.5,"pivotY":208.785714,"groundRadiusX":0.304408,"groundRadiusY":0.057757},"7":{"pivotX":128.5,"pivotY":209.5,"groundRadiusX":0.314453,"groundRadiusY":0.056641}}}),
  "DesignAssets/Animations/RollingAcornIdle/v1/idle.webp": Object.freeze({"frameSize":428,"pivotX":215,"pivotY":358.5,"viewSize":428,"registrationScale":1.019047619047619,"groundRadiusX":0.178571,"groundRadiusY":0.039286}),
  "DesignAssets/Animations/CreatureAttackV2/rolling-acorn/runtime.webp": Object.freeze({"frameSize":318,"pivotX":159.669667,"pivotY":266.950502,"viewSize":286.6687831272085,"registrationScale":1.0192307692307692,"groundRadiusX":0.178571,"groundRadiusY":0.039286}),
  "DesignAssets/Animations/CreatureHurtV4/rolling-acorn/hurt.webp": Object.freeze({"frameSize":428,"pivotX":215,"pivotY":358.5,"viewSize":428,"registrationScale":1.019047619047619,"groundRadiusX":0.178571,"groundRadiusY":0.039286}),
  "DesignAssets/Animations/CreatureDeathV4/rolling-acorn/runtime.webp": Object.freeze({"frameSize":262,"pivotX":131.609524,"pivotY":218.942857,"viewSize":262,"registrationScale":1.0234375,"groundRadiusX":0.178571,"groundRadiusY":0.039286,"frameGeometry":{"0":{"pivotX":131.609524,"pivotY":218.942857,"groundRadiusX":0.178571,"groundRadiusY":0.039286},"1":{"pivotX":131.701727,"pivotY":218.932496,"groundRadiusX":0.178326,"groundRadiusY":0.039326},"2":{"pivotX":131.79393,"pivotY":218.922135,"groundRadiusX":0.178081,"groundRadiusY":0.039367},"3":{"pivotX":131.886133,"pivotY":218.911774,"groundRadiusX":0.177836,"groundRadiusY":0.039407},"4":{"pivotX":131.978336,"pivotY":218.901413,"groundRadiusX":0.17759,"groundRadiusY":0.039448},"5":{"pivotX":132.070539,"pivotY":218.891052,"groundRadiusX":0.177345,"groundRadiusY":0.039488},"6":{"pivotX":132.162742,"pivotY":218.880691,"groundRadiusX":0.1771,"groundRadiusY":0.039529},"7":{"pivotX":132.254945,"pivotY":218.87033,"groundRadiusX":0.176854,"groundRadiusY":0.039569},"8":{"pivotX":132.347148,"pivotY":218.859969,"groundRadiusX":0.176609,"groundRadiusY":0.039609},"9":{"pivotX":132.439351,"pivotY":218.849608,"groundRadiusX":0.176364,"groundRadiusY":0.03965},"10":{"pivotX":132.531554,"pivotY":218.839246,"groundRadiusX":0.176119,"groundRadiusY":0.03969},"11":{"pivotX":132.623757,"pivotY":218.828885,"groundRadiusX":0.175873,"groundRadiusY":0.039731},"12":{"pivotX":132.71596,"pivotY":218.818524,"groundRadiusX":0.175628,"groundRadiusY":0.039771},"13":{"pivotX":132.808163,"pivotY":218.808163,"groundRadiusX":0.175383,"groundRadiusY":0.039812},"14":{"pivotX":132.900366,"pivotY":218.797802,"groundRadiusX":0.175137,"groundRadiusY":0.039852},"15":{"pivotX":132.992569,"pivotY":218.787441,"groundRadiusX":0.174892,"groundRadiusY":0.039893},"16":{"pivotX":133.084772,"pivotY":218.77708,"groundRadiusX":0.174647,"groundRadiusY":0.039933},"17":{"pivotX":133.176975,"pivotY":218.766719,"groundRadiusX":0.174401,"groundRadiusY":0.039974},"18":{"pivotX":133.269178,"pivotY":218.756358,"groundRadiusX":0.174156,"groundRadiusY":0.040014},"19":{"pivotX":133.361381,"pivotY":218.745997,"groundRadiusX":0.173911,"groundRadiusY":0.040055},"20":{"pivotX":133.453585,"pivotY":218.735636,"groundRadiusX":0.173666,"groundRadiusY":0.040095},"21":{"pivotX":133.545788,"pivotY":218.725275,"groundRadiusX":0.17342,"groundRadiusY":0.040136},"22":{"pivotX":133.637991,"pivotY":218.714914,"groundRadiusX":0.173175,"groundRadiusY":0.040176},"23":{"pivotX":133.730194,"pivotY":218.704553,"groundRadiusX":0.17293,"groundRadiusY":0.040217},"24":{"pivotX":133.822397,"pivotY":218.694192,"groundRadiusX":0.172684,"groundRadiusY":0.040257},"25":{"pivotX":133.9146,"pivotY":218.68383,"groundRadiusX":0.172439,"groundRadiusY":0.040298},"26":{"pivotX":134.006803,"pivotY":218.673469,"groundRadiusX":0.172194,"groundRadiusY":0.040338},"27":{"pivotX":134.099006,"pivotY":218.663108,"groundRadiusX":0.171949,"groundRadiusY":0.040378},"28":{"pivotX":134.191209,"pivotY":218.652747,"groundRadiusX":0.171703,"groundRadiusY":0.040419},"29":{"pivotX":134.283412,"pivotY":218.642386,"groundRadiusX":0.171458,"groundRadiusY":0.040459},"30":{"pivotX":134.375615,"pivotY":218.632025,"groundRadiusX":0.171213,"groundRadiusY":0.0405},"31":{"pivotX":134.467818,"pivotY":218.621664,"groundRadiusX":0.170967,"groundRadiusY":0.04054},"32":{"pivotX":134.560021,"pivotY":218.611303,"groundRadiusX":0.170722,"groundRadiusY":0.040581},"33":{"pivotX":134.652224,"pivotY":218.600942,"groundRadiusX":0.170477,"groundRadiusY":0.040621},"34":{"pivotX":134.744427,"pivotY":218.590581,"groundRadiusX":0.170232,"groundRadiusY":0.040662},"35":{"pivotX":134.83663,"pivotY":218.58022,"groundRadiusX":0.169986,"groundRadiusY":0.040702},"36":{"pivotX":134.928833,"pivotY":218.569859,"groundRadiusX":0.169741,"groundRadiusY":0.040743},"37":{"pivotX":135.021036,"pivotY":218.559498,"groundRadiusX":0.169496,"groundRadiusY":0.040783},"38":{"pivotX":135.113239,"pivotY":218.549137,"groundRadiusX":0.16925,"groundRadiusY":0.040824},"39":{"pivotX":135.205442,"pivotY":218.538776,"groundRadiusX":0.169005,"groundRadiusY":0.040864},"40":{"pivotX":135.297645,"pivotY":218.528414,"groundRadiusX":0.16876,"groundRadiusY":0.040905},"41":{"pivotX":135.389848,"pivotY":218.518053,"groundRadiusX":0.168515,"groundRadiusY":0.040945},"42":{"pivotX":135.482051,"pivotY":218.507692,"groundRadiusX":0.168269,"groundRadiusY":0.040986},"43":{"pivotX":135.574254,"pivotY":218.497331,"groundRadiusX":0.168024,"groundRadiusY":0.041026},"44":{"pivotX":135.666457,"pivotY":218.48697,"groundRadiusX":0.167779,"groundRadiusY":0.041067},"45":{"pivotX":135.75866,"pivotY":218.476609,"groundRadiusX":0.167533,"groundRadiusY":0.041107},"46":{"pivotX":135.850863,"pivotY":218.466248,"groundRadiusX":0.167288,"groundRadiusY":0.041147},"47":{"pivotX":135.943066,"pivotY":218.455887,"groundRadiusX":0.167043,"groundRadiusY":0.041188},"48":{"pivotX":136.035269,"pivotY":218.445526,"groundRadiusX":0.166797,"groundRadiusY":0.041228},"49":{"pivotX":136.127473,"pivotY":218.435165,"groundRadiusX":0.166552,"groundRadiusY":0.041269},"50":{"pivotX":136.219676,"pivotY":218.424804,"groundRadiusX":0.166307,"groundRadiusY":0.041309},"51":{"pivotX":136.311879,"pivotY":218.414443,"groundRadiusX":0.166062,"groundRadiusY":0.04135},"52":{"pivotX":136.404082,"pivotY":218.404082,"groundRadiusX":0.165816,"groundRadiusY":0.04139},"53":{"pivotX":136.496285,"pivotY":218.393721,"groundRadiusX":0.165571,"groundRadiusY":0.041431},"54":{"pivotX":136.588488,"pivotY":218.383359,"groundRadiusX":0.165326,"groundRadiusY":0.041471},"55":{"pivotX":136.680691,"pivotY":218.372998,"groundRadiusX":0.16508,"groundRadiusY":0.041512},"56":{"pivotX":136.772894,"pivotY":218.362637,"groundRadiusX":0.164835,"groundRadiusY":0.041552},"57":{"pivotX":136.865097,"pivotY":218.352276,"groundRadiusX":0.16459,"groundRadiusY":0.041593},"58":{"pivotX":136.9573,"pivotY":218.341915,"groundRadiusX":0.164345,"groundRadiusY":0.041633},"59":{"pivotX":137.049503,"pivotY":218.331554,"groundRadiusX":0.164099,"groundRadiusY":0.041674},"60":{"pivotX":137.141706,"pivotY":218.321193,"groundRadiusX":0.163854,"groundRadiusY":0.041714},"61":{"pivotX":137.233909,"pivotY":218.310832,"groundRadiusX":0.163609,"groundRadiusY":0.041755},"62":{"pivotX":137.326112,"pivotY":218.300471,"groundRadiusX":0.163363,"groundRadiusY":0.041795},"63":{"pivotX":137.418315,"pivotY":218.29011,"groundRadiusX":0.163118,"groundRadiusY":0.041836},"64":{"pivotX":137.510518,"pivotY":218.279749,"groundRadiusX":0.162873,"groundRadiusY":0.041876},"65":{"pivotX":137.602721,"pivotY":218.269388,"groundRadiusX":0.162628,"groundRadiusY":0.041916},"66":{"pivotX":137.694924,"pivotY":218.259027,"groundRadiusX":0.162382,"groundRadiusY":0.041957},"67":{"pivotX":137.787127,"pivotY":218.248666,"groundRadiusX":0.162137,"groundRadiusY":0.041997},"68":{"pivotX":137.87933,"pivotY":218.238305,"groundRadiusX":0.161892,"groundRadiusY":0.042038},"69":{"pivotX":137.971533,"pivotY":218.227943,"groundRadiusX":0.161646,"groundRadiusY":0.042078},"70":{"pivotX":138.063736,"pivotY":218.217582,"groundRadiusX":0.161401,"groundRadiusY":0.042119},"71":{"pivotX":138.155939,"pivotY":218.207221,"groundRadiusX":0.161156,"groundRadiusY":0.042159},"72":{"pivotX":138.248142,"pivotY":218.19686,"groundRadiusX":0.160911,"groundRadiusY":0.0422},"73":{"pivotX":138.340345,"pivotY":218.186499,"groundRadiusX":0.160665,"groundRadiusY":0.04224},"74":{"pivotX":138.432548,"pivotY":218.176138,"groundRadiusX":0.16042,"groundRadiusY":0.042281},"75":{"pivotX":138.524751,"pivotY":218.165777,"groundRadiusX":0.160175,"groundRadiusY":0.042321},"76":{"pivotX":138.616954,"pivotY":218.155416,"groundRadiusX":0.159929,"groundRadiusY":0.042362},"77":{"pivotX":138.709158,"pivotY":218.145055,"groundRadiusX":0.159684,"groundRadiusY":0.042402},"78":{"pivotX":138.801361,"pivotY":218.134694,"groundRadiusX":0.159439,"groundRadiusY":0.042443},"79":{"pivotX":138.893564,"pivotY":218.124333,"groundRadiusX":0.159193,"groundRadiusY":0.042483},"80":{"pivotX":138.985767,"pivotY":218.113972,"groundRadiusX":0.158948,"groundRadiusY":0.042524},"81":{"pivotX":139.07797,"pivotY":218.103611,"groundRadiusX":0.158703,"groundRadiusY":0.042564},"82":{"pivotX":139.170173,"pivotY":218.09325,"groundRadiusX":0.158458,"groundRadiusY":0.042604},"83":{"pivotX":139.262376,"pivotY":218.082889,"groundRadiusX":0.158212,"groundRadiusY":0.042645},"84":{"pivotX":139.354579,"pivotY":218.072527,"groundRadiusX":0.157967,"groundRadiusY":0.042685},"85":{"pivotX":139.446782,"pivotY":218.062166,"groundRadiusX":0.157722,"groundRadiusY":0.042726},"86":{"pivotX":139.538985,"pivotY":218.051805,"groundRadiusX":0.157476,"groundRadiusY":0.042766},"87":{"pivotX":139.631188,"pivotY":218.041444,"groundRadiusX":0.157231,"groundRadiusY":0.042807},"88":{"pivotX":139.723391,"pivotY":218.031083,"groundRadiusX":0.156986,"groundRadiusY":0.042847},"89":{"pivotX":139.815594,"pivotY":218.020722,"groundRadiusX":0.156741,"groundRadiusY":0.042888},"90":{"pivotX":139.907797,"pivotY":218.010361,"groundRadiusX":0.156495,"groundRadiusY":0.042928},"91":{"pivotX":140,"pivotY":218,"groundRadiusX":0.15625,"groundRadiusY":0.042969}}}),
  "DesignAssets/Animations/BubbleToadIdle/BreathV1/idle.webp": Object.freeze({"frameSize":362,"pivotX":184.999999,"pivotY":307,"viewSize":362,"registrationScale":1.002770083102493,"groundRadiusX":0.34626,"groundRadiusY":0.027701}),
  "DesignAssets/Animations/CreatureHurtV7/bubble-toad/hurt.webp": Object.freeze({"frameSize":362,"pivotX":184.999999,"pivotY":307,"viewSize":362,"registrationScale":1.002770083102493,"groundRadiusX":0.34626,"groundRadiusY":0.027701}),
  "DesignAssets/Animations/CreatureIdleStudies/V1/snare-vine/idle.webp": Object.freeze({"frameSize":456,"pivotX":230,"pivotY":389.999998,"viewSize":456,"registrationScale":1.0754716981132075,"groundRadiusX":0.122642,"groundRadiusY":0.021226}),
  "DesignAssets/Animations/CreatureAttackV2/snare-vine/runtime.webp": Object.freeze({"frameSize":304,"pivotX":153.335937,"pivotY":259.98828,"viewSize":304.2349823321555,"registrationScale":1.0742049469964665,"groundRadiusX":0.122642,"groundRadiusY":0.021226}),
  "DesignAssets/Animations/CreatureHurtV7/snare-vine/hurt.webp": Object.freeze({"frameSize":456,"pivotX":230,"pivotY":389.999998,"viewSize":456,"registrationScale":1.0754716981132075,"groundRadiusX":0.122642,"groundRadiusY":0.021226}),
  "DesignAssets/Animations/CreatureDeathV4/snare-vine/runtime.webp": Object.freeze({"frameSize":276,"pivotX":139.207547,"pivotY":236.566036,"viewSize":276,"registrationScale":1.078125,"groundRadiusX":0.122642,"groundRadiusY":0.021226,"frameGeometry":{"0":{"pivotX":139.207547,"pivotY":236.566036,"groundRadiusX":0.122642,"groundRadiusY":0.021226},"1":{"pivotX":139.193171,"pivotY":236.547393,"groundRadiusX":0.123181,"groundRadiusY":0.021299},"2":{"pivotX":139.178796,"pivotY":236.52875,"groundRadiusX":0.123721,"groundRadiusY":0.021372},"3":{"pivotX":139.16442,"pivotY":236.510107,"groundRadiusX":0.12426,"groundRadiusY":0.021445},"4":{"pivotX":139.150045,"pivotY":236.491463,"groundRadiusX":0.1248,"groundRadiusY":0.021518},"5":{"pivotX":139.135669,"pivotY":236.47282,"groundRadiusX":0.12534,"groundRadiusY":0.021591},"6":{"pivotX":139.121294,"pivotY":236.454177,"groundRadiusX":0.125879,"groundRadiusY":0.021663},"7":{"pivotX":139.106918,"pivotY":236.435533,"groundRadiusX":0.126419,"groundRadiusY":0.021736},"8":{"pivotX":139.092542,"pivotY":236.41689,"groundRadiusX":0.126958,"groundRadiusY":0.021809},"9":{"pivotX":139.078167,"pivotY":236.398247,"groundRadiusX":0.127498,"groundRadiusY":0.021882},"10":{"pivotX":139.063791,"pivotY":236.379604,"groundRadiusX":0.128038,"groundRadiusY":0.021955},"11":{"pivotX":139.049416,"pivotY":236.36096,"groundRadiusX":0.128577,"groundRadiusY":0.022027},"12":{"pivotX":139.03504,"pivotY":236.342317,"groundRadiusX":0.129117,"groundRadiusY":0.0221},"13":{"pivotX":139.020665,"pivotY":236.323674,"groundRadiusX":0.129656,"groundRadiusY":0.022173},"14":{"pivotX":139.006289,"pivotY":236.30503,"groundRadiusX":0.130196,"groundRadiusY":0.022246},"15":{"pivotX":138.991914,"pivotY":236.286387,"groundRadiusX":0.130736,"groundRadiusY":0.022319},"16":{"pivotX":138.977538,"pivotY":236.267744,"groundRadiusX":0.131275,"groundRadiusY":0.022392},"17":{"pivotX":138.963162,"pivotY":236.249101,"groundRadiusX":0.131815,"groundRadiusY":0.022464},"18":{"pivotX":138.948787,"pivotY":236.230457,"groundRadiusX":0.132354,"groundRadiusY":0.022537},"19":{"pivotX":138.934411,"pivotY":236.211814,"groundRadiusX":0.132894,"groundRadiusY":0.02261},"20":{"pivotX":138.920036,"pivotY":236.193171,"groundRadiusX":0.133434,"groundRadiusY":0.022683},"21":{"pivotX":138.90566,"pivotY":236.174527,"groundRadiusX":0.133973,"groundRadiusY":0.022756},"22":{"pivotX":138.891285,"pivotY":236.155884,"groundRadiusX":0.134513,"groundRadiusY":0.022829},"23":{"pivotX":138.876909,"pivotY":236.137241,"groundRadiusX":0.135053,"groundRadiusY":0.022901},"24":{"pivotX":138.862533,"pivotY":236.118597,"groundRadiusX":0.135592,"groundRadiusY":0.022974},"25":{"pivotX":138.848158,"pivotY":236.099954,"groundRadiusX":0.136132,"groundRadiusY":0.023047},"26":{"pivotX":138.833782,"pivotY":236.081311,"groundRadiusX":0.136671,"groundRadiusY":0.02312},"27":{"pivotX":138.819407,"pivotY":236.062668,"groundRadiusX":0.137211,"groundRadiusY":0.023193},"28":{"pivotX":138.805031,"pivotY":236.044024,"groundRadiusX":0.137751,"groundRadiusY":0.023266},"29":{"pivotX":138.790656,"pivotY":236.025381,"groundRadiusX":0.13829,"groundRadiusY":0.023338},"30":{"pivotX":138.77628,"pivotY":236.006738,"groundRadiusX":0.13883,"groundRadiusY":0.023411},"31":{"pivotX":138.761905,"pivotY":235.988094,"groundRadiusX":0.139369,"groundRadiusY":0.023484},"32":{"pivotX":138.747529,"pivotY":235.969451,"groundRadiusX":0.139909,"groundRadiusY":0.023557},"33":{"pivotX":138.733153,"pivotY":235.950808,"groundRadiusX":0.140449,"groundRadiusY":0.02363},"34":{"pivotX":138.718778,"pivotY":235.932165,"groundRadiusX":0.140988,"groundRadiusY":0.023702},"35":{"pivotX":138.704402,"pivotY":235.913521,"groundRadiusX":0.141528,"groundRadiusY":0.023775},"36":{"pivotX":138.690027,"pivotY":235.894878,"groundRadiusX":0.142067,"groundRadiusY":0.023848},"37":{"pivotX":138.675651,"pivotY":235.876235,"groundRadiusX":0.142607,"groundRadiusY":0.023921},"38":{"pivotX":138.661276,"pivotY":235.857591,"groundRadiusX":0.143147,"groundRadiusY":0.023994},"39":{"pivotX":138.6469,"pivotY":235.838948,"groundRadiusX":0.143686,"groundRadiusY":0.024067},"40":{"pivotX":138.632525,"pivotY":235.820305,"groundRadiusX":0.144226,"groundRadiusY":0.024139},"41":{"pivotX":138.618149,"pivotY":235.801662,"groundRadiusX":0.144766,"groundRadiusY":0.024212},"42":{"pivotX":138.603773,"pivotY":235.783018,"groundRadiusX":0.145305,"groundRadiusY":0.024285},"43":{"pivotX":138.589398,"pivotY":235.764375,"groundRadiusX":0.145845,"groundRadiusY":0.024358},"44":{"pivotX":138.575022,"pivotY":235.745732,"groundRadiusX":0.146384,"groundRadiusY":0.024431},"45":{"pivotX":138.560647,"pivotY":235.727088,"groundRadiusX":0.146924,"groundRadiusY":0.024504},"46":{"pivotX":138.546271,"pivotY":235.708445,"groundRadiusX":0.147464,"groundRadiusY":0.024576},"47":{"pivotX":138.531896,"pivotY":235.689802,"groundRadiusX":0.148003,"groundRadiusY":0.024649},"48":{"pivotX":138.51752,"pivotY":235.671158,"groundRadiusX":0.148543,"groundRadiusY":0.024722},"49":{"pivotX":138.503145,"pivotY":235.652515,"groundRadiusX":0.149082,"groundRadiusY":0.024795},"50":{"pivotX":138.488769,"pivotY":235.633872,"groundRadiusX":0.149622,"groundRadiusY":0.024868},"51":{"pivotX":138.474393,"pivotY":235.615229,"groundRadiusX":0.150162,"groundRadiusY":0.024941},"52":{"pivotX":138.460018,"pivotY":235.596585,"groundRadiusX":0.150701,"groundRadiusY":0.025013},"53":{"pivotX":138.445642,"pivotY":235.577942,"groundRadiusX":0.151241,"groundRadiusY":0.025086},"54":{"pivotX":138.431267,"pivotY":235.559299,"groundRadiusX":0.15178,"groundRadiusY":0.025159},"55":{"pivotX":138.416891,"pivotY":235.540655,"groundRadiusX":0.15232,"groundRadiusY":0.025232},"56":{"pivotX":138.402516,"pivotY":235.522012,"groundRadiusX":0.15286,"groundRadiusY":0.025305},"57":{"pivotX":138.38814,"pivotY":235.503369,"groundRadiusX":0.153399,"groundRadiusY":0.025377},"58":{"pivotX":138.373765,"pivotY":235.484726,"groundRadiusX":0.153939,"groundRadiusY":0.02545},"59":{"pivotX":138.359389,"pivotY":235.466082,"groundRadiusX":0.154479,"groundRadiusY":0.025523},"60":{"pivotX":138.345013,"pivotY":235.447439,"groundRadiusX":0.155018,"groundRadiusY":0.025596},"61":{"pivotX":138.330638,"pivotY":235.428796,"groundRadiusX":0.155558,"groundRadiusY":0.025669},"62":{"pivotX":138.316262,"pivotY":235.410152,"groundRadiusX":0.156097,"groundRadiusY":0.025742},"63":{"pivotX":138.301887,"pivotY":235.391509,"groundRadiusX":0.156637,"groundRadiusY":0.025814},"64":{"pivotX":138.287511,"pivotY":235.372866,"groundRadiusX":0.157177,"groundRadiusY":0.025887},"65":{"pivotX":138.273136,"pivotY":235.354223,"groundRadiusX":0.157716,"groundRadiusY":0.02596},"66":{"pivotX":138.25876,"pivotY":235.335579,"groundRadiusX":0.158256,"groundRadiusY":0.026033},"67":{"pivotX":138.244384,"pivotY":235.316936,"groundRadiusX":0.158795,"groundRadiusY":0.026106},"68":{"pivotX":138.230009,"pivotY":235.298293,"groundRadiusX":0.159335,"groundRadiusY":0.026179},"69":{"pivotX":138.215633,"pivotY":235.279649,"groundRadiusX":0.159875,"groundRadiusY":0.026251},"70":{"pivotX":138.201258,"pivotY":235.261006,"groundRadiusX":0.160414,"groundRadiusY":0.026324},"71":{"pivotX":138.186882,"pivotY":235.242363,"groundRadiusX":0.160954,"groundRadiusY":0.026397},"72":{"pivotX":138.172507,"pivotY":235.223719,"groundRadiusX":0.161493,"groundRadiusY":0.02647},"73":{"pivotX":138.158131,"pivotY":235.205076,"groundRadiusX":0.162033,"groundRadiusY":0.026543},"74":{"pivotX":138.143756,"pivotY":235.186433,"groundRadiusX":0.162573,"groundRadiusY":0.026615},"75":{"pivotX":138.12938,"pivotY":235.16779,"groundRadiusX":0.163112,"groundRadiusY":0.026688},"76":{"pivotX":138.115004,"pivotY":235.149146,"groundRadiusX":0.163652,"groundRadiusY":0.026761},"77":{"pivotX":138.100629,"pivotY":235.130503,"groundRadiusX":0.164191,"groundRadiusY":0.026834},"78":{"pivotX":138.086253,"pivotY":235.11186,"groundRadiusX":0.164731,"groundRadiusY":0.026907},"79":{"pivotX":138.071878,"pivotY":235.093216,"groundRadiusX":0.165271,"groundRadiusY":0.02698},"80":{"pivotX":138.057502,"pivotY":235.074573,"groundRadiusX":0.16581,"groundRadiusY":0.027052},"81":{"pivotX":138.043127,"pivotY":235.05593,"groundRadiusX":0.16635,"groundRadiusY":0.027125},"82":{"pivotX":138.028751,"pivotY":235.037287,"groundRadiusX":0.16689,"groundRadiusY":0.027198},"83":{"pivotX":138.014376,"pivotY":235.018643,"groundRadiusX":0.167429,"groundRadiusY":0.027271},"84":{"pivotX":138,"pivotY":235,"groundRadiusX":0.167969,"groundRadiusY":0.027344}}}),
  "DesignAssets/Animations/Beetle/atlas.webp": Object.freeze({"frameSize":346,"pivotX":172,"pivotY":281.999998,"viewSize":346,"registrationScale":1.0028985507246377,"groundRadiusX":0.347826,"groundRadiusY":0.06087,"frameGeometry":{"17":{"pivotX":172.5,"pivotY":285.972972,"groundRadiusX":0.349589,"groundRadiusY":0.049354},"18":{"pivotX":173,"pivotY":289.945945,"groundRadiusX":0.351351,"groundRadiusY":0.037838}}}),
  "DesignAssets/Animations/Beetle/attack-right.webp": Object.freeze({"frameSize":346,"pivotX":172,"pivotY":281.999998,"viewSize":346,"registrationScale":1.0028985507246377,"groundRadiusX":0.347826,"groundRadiusY":0.06087}),
  "DesignAssets/Animations/BeetleDeath/dead-v2.png": Object.freeze({"frameSize":186,"pivotX":93,"pivotY":156,"viewSize":186,"registrationScale":1.0054054054054054,"groundRadiusX":0.351351,"groundRadiusY":0.037838}),
  "DesignAssets/Animations/SoilBoarIdle/V1/idle.webp": Object.freeze({"frameSize":370,"pivotX":195,"pivotY":307,"viewSize":369.99999999999994,"registrationScale":1.002710027100271,"groundRadiusX":0.325203,"groundRadiusY":0.04607}),
  "DesignAssets/Animations/CreatureHurtV7/soil-boar/hurt.webp": Object.freeze({"frameSize":370,"pivotX":195,"pivotY":307,"viewSize":369.99999999999994,"registrationScale":1.002710027100271,"groundRadiusX":0.325203,"groundRadiusY":0.04607}),
  "DesignAssets/Animations/CreatureDeathV6/soil-boar/runtime.webp": Object.freeze({"frameSize":256,"pivotX":134.937669,"pivotY":212.205962,"viewSize":256,"registrationScale":1,"groundRadiusX":0.325203,"groundRadiusY":0.04607,"frameGeometry":{"0":{"pivotX":134.937669,"pivotY":212.205962,"groundRadiusX":0.325203,"groundRadiusY":0.04607},"1":{"pivotX":132.232288,"pivotY":212.60511,"groundRadiusX":0.319482,"groundRadiusY":0.044511},"2":{"pivotX":129.526907,"pivotY":213.004259,"groundRadiusX":0.313761,"groundRadiusY":0.042952},"3":{"pivotX":126.821525,"pivotY":213.403407,"groundRadiusX":0.30804,"groundRadiusY":0.041393},"4":{"pivotX":124.116144,"pivotY":213.802555,"groundRadiusX":0.302319,"groundRadiusY":0.039834},"5":{"pivotX":121.410763,"pivotY":214.201703,"groundRadiusX":0.296598,"groundRadiusY":0.038275},"6":{"pivotX":118.705381,"pivotY":214.600852,"groundRadiusX":0.290877,"groundRadiusY":0.036715},"7":{"pivotX":116,"pivotY":215,"groundRadiusX":0.285156,"groundRadiusY":0.035156}}}),
  "DesignAssets/Animations/CreatureIdleStudies/V2/vine-turtle/idle.webp": Object.freeze({"frameSize":346,"pivotX":173,"pivotY":293.000001,"viewSize":346,"registrationScale":1,"groundRadiusX":0.401734,"groundRadiusY":0.028902}),
  "DesignAssets/Animations/CreatureHurtV7/vine-turtle/hurt.webp": Object.freeze({"frameSize":346,"pivotX":173,"pivotY":293.000001,"viewSize":346,"registrationScale":1,"groundRadiusX":0.401734,"groundRadiusY":0.028902}),
  "DesignAssets/Animations/CreatureDeathV12/vine-turtle/runtime.webp": Object.freeze({"frameSize":256,"pivotX":128,"pivotY":216.601157,"viewSize":256,"registrationScale":1,"groundRadiusX":0.401734,"groundRadiusY":0.028902,"frameGeometry":{"0":{"pivotX":128,"pivotY":216.601157,"groundRadiusX":0.401734,"groundRadiusY":0.028902},"1":{"pivotX":128,"pivotY":216.62015,"groundRadiusX":0.403437,"groundRadiusY":0.028828},"2":{"pivotX":128,"pivotY":216.639142,"groundRadiusX":0.40514,"groundRadiusY":0.028753},"3":{"pivotX":128,"pivotY":216.658135,"groundRadiusX":0.406844,"groundRadiusY":0.028679},"4":{"pivotX":128,"pivotY":216.677127,"groundRadiusX":0.408547,"groundRadiusY":0.028605},"5":{"pivotX":128,"pivotY":216.69612,"groundRadiusX":0.41025,"groundRadiusY":0.028531},"6":{"pivotX":128,"pivotY":216.715112,"groundRadiusX":0.411953,"groundRadiusY":0.028457},"7":{"pivotX":128,"pivotY":216.734105,"groundRadiusX":0.413656,"groundRadiusY":0.028382},"8":{"pivotX":128,"pivotY":216.753097,"groundRadiusX":0.415359,"groundRadiusY":0.028308},"9":{"pivotX":128,"pivotY":216.77209,"groundRadiusX":0.417062,"groundRadiusY":0.028234},"10":{"pivotX":128,"pivotY":216.791082,"groundRadiusX":0.418765,"groundRadiusY":0.02816},"11":{"pivotX":128,"pivotY":216.810075,"groundRadiusX":0.420469,"groundRadiusY":0.028086},"12":{"pivotX":128,"pivotY":216.829067,"groundRadiusX":0.422172,"groundRadiusY":0.028011},"13":{"pivotX":128,"pivotY":216.84806,"groundRadiusX":0.423875,"groundRadiusY":0.027937},"14":{"pivotX":128,"pivotY":216.867052,"groundRadiusX":0.425578,"groundRadiusY":0.027863},"15":{"pivotX":128,"pivotY":216.886045,"groundRadiusX":0.427281,"groundRadiusY":0.027789},"16":{"pivotX":128,"pivotY":216.905037,"groundRadiusX":0.428984,"groundRadiusY":0.027715},"17":{"pivotX":128,"pivotY":216.92403,"groundRadiusX":0.430687,"groundRadiusY":0.027641},"18":{"pivotX":128,"pivotY":216.943022,"groundRadiusX":0.432391,"groundRadiusY":0.027566},"19":{"pivotX":128,"pivotY":216.962015,"groundRadiusX":0.434094,"groundRadiusY":0.027492},"20":{"pivotX":128,"pivotY":216.981007,"groundRadiusX":0.435797,"groundRadiusY":0.027418},"21":{"pivotX":128,"pivotY":217,"groundRadiusX":0.4375,"groundRadiusY":0.027344}}}),
  "DesignAssets/Animations/CreatureIdleStudies/V2/shadow-weasel/idle.webp": Object.freeze({"frameSize":414,"pivotX":200.999999,"pivotY":350.000002,"viewSize":414.00000000000006,"registrationScale":1.297805642633229,"groundRadiusX":0.285266,"groundRadiusY":0.037618}),
  "DesignAssets/Animations/CreatureHurtV6/shadow-weasel/hurt.webp": Object.freeze({"frameSize":414,"pivotX":200.999999,"pivotY":350.000002,"viewSize":414.00000000000006,"registrationScale":1.297805642633229,"groundRadiusX":0.285266,"groundRadiusY":0.037618}),
  "DesignAssets/Animations/CreatureDeathV6/shadow-weasel/runtime.webp": Object.freeze({"frameSize":332,"pivotX":161.417746,"pivotY":281.835495,"viewSize":315.9487343410433,"registrationScale":1.296875,"groundRadiusX":0.285266,"groundRadiusY":0.037618,"frameGeometry":{"0":{"pivotX":161.417746,"pivotY":281.835495,"groundRadiusX":0.285266,"groundRadiusY":0.037618},"1":{"pivotX":161.072354,"pivotY":282.430424,"groundRadiusX":0.283802,"groundRadiusY":0.035176},"2":{"pivotX":160.726961,"pivotY":283.025354,"groundRadiusX":0.282337,"groundRadiusY":0.032734},"3":{"pivotX":160.381569,"pivotY":283.620283,"groundRadiusX":0.280873,"groundRadiusY":0.030292},"4":{"pivotX":160.036176,"pivotY":284.215213,"groundRadiusX":0.279408,"groundRadiusY":0.02785},"5":{"pivotX":159.690784,"pivotY":284.810142,"groundRadiusX":0.277944,"groundRadiusY":0.025408},"6":{"pivotX":159.345391,"pivotY":285.405071,"groundRadiusX":0.276479,"groundRadiusY":0.022966},"7":{"pivotX":158.999999,"pivotY":286.000001,"groundRadiusX":0.275015,"groundRadiusY":0.020524}}}),
  "DesignAssets/Animations/TalonOwlIdle/PerchedV4/idle.webp": Object.freeze({"frameSize":472,"pivotX":236,"pivotY":413,"viewSize":472,"registrationScale":1.0925925925925926}),
  "DesignAssets/Animations/CreatureAttackV2/talon-owl/runtime.webp": Object.freeze({"frameSize":314,"pivotX":157,"pivotY":275,"viewSize":314.18238847583643,"registrationScale":1.0902777777777777}),
  "DesignAssets/Animations/CreatureHurtV6/talon-owl/hurt.webp": Object.freeze({"frameSize":472,"pivotX":236,"pivotY":413,"viewSize":472,"registrationScale":1.0925925925925926}),
  "DesignAssets/Animations/CreatureDeathV6/talon-owl/runtime.webp": Object.freeze({"frameSize":280,"pivotX":140,"pivotY":245,"viewSize":280,"registrationScale":1.09375}),
  "DesignAssets/Animations/UniqueIdleV4/spring-keeper/idle.webp": Object.freeze({"frameSize":412,"pivotX":206,"pivotY":349,"viewSize":412,"registrationScale":1.0729166666666667,"groundRadiusX":0.125,"groundRadiusY":0.028646}),
  "DesignAssets/Animations/CreatureAttackV2/spring-keeper/runtime.webp": Object.freeze({"frameSize":288,"pivotX":144,"pivotY":243.435142,"viewSize":293.4339622641509,"registrationScale":1.070631970260223,"groundRadiusX":0.125,"groundRadiusY":0.028646}),
  "DesignAssets/Animations/CreatureHurtV6/spring-keeper/hurt.webp": Object.freeze({"frameSize":412,"pivotX":206,"pivotY":349,"viewSize":412,"registrationScale":1.0729166666666667,"groundRadiusX":0.125,"groundRadiusY":0.028646}),
  "DesignAssets/Animations/CreatureDeathV11/spring-keeper/runtime.webp": Object.freeze({"frameSize":308,"pivotX":154,"pivotY":261,"viewSize":308,"registrationScale":1.0694444444444444,"groundRadiusX":0.125,"groundRadiusY":0.028646,"frameGeometry":{"0":{"pivotX":154,"pivotY":261,"groundRadiusX":0.125,"groundRadiusY":0.028646},"1":{"pivotX":154,"pivotY":261.050847,"groundRadiusX":0.126824,"groundRadiusY":0.028749},"2":{"pivotX":154,"pivotY":261.101695,"groundRadiusX":0.128649,"groundRadiusY":0.028852},"3":{"pivotX":154,"pivotY":261.152542,"groundRadiusX":0.130473,"groundRadiusY":0.028955},"4":{"pivotX":154,"pivotY":261.20339,"groundRadiusX":0.132298,"groundRadiusY":0.029058},"5":{"pivotX":154,"pivotY":261.254237,"groundRadiusX":0.134122,"groundRadiusY":0.029161},"6":{"pivotX":154,"pivotY":261.305085,"groundRadiusX":0.135946,"groundRadiusY":0.029264},"7":{"pivotX":154,"pivotY":261.355932,"groundRadiusX":0.137771,"groundRadiusY":0.029367},"8":{"pivotX":154,"pivotY":261.40678,"groundRadiusX":0.139595,"groundRadiusY":0.02947},"9":{"pivotX":154,"pivotY":261.457627,"groundRadiusX":0.141419,"groundRadiusY":0.029573},"10":{"pivotX":154,"pivotY":261.508475,"groundRadiusX":0.143244,"groundRadiusY":0.029676},"11":{"pivotX":154,"pivotY":261.559322,"groundRadiusX":0.145068,"groundRadiusY":0.029779},"12":{"pivotX":154,"pivotY":261.610169,"groundRadiusX":0.146893,"groundRadiusY":0.029882},"13":{"pivotX":154,"pivotY":261.661017,"groundRadiusX":0.148717,"groundRadiusY":0.029985},"14":{"pivotX":154,"pivotY":261.711864,"groundRadiusX":0.150541,"groundRadiusY":0.030088},"15":{"pivotX":154,"pivotY":261.762712,"groundRadiusX":0.152366,"groundRadiusY":0.030191},"16":{"pivotX":154,"pivotY":261.813559,"groundRadiusX":0.15419,"groundRadiusY":0.030294},"17":{"pivotX":154,"pivotY":261.864407,"groundRadiusX":0.156015,"groundRadiusY":0.030397},"18":{"pivotX":154,"pivotY":261.915254,"groundRadiusX":0.157839,"groundRadiusY":0.0305},"19":{"pivotX":154,"pivotY":261.966102,"groundRadiusX":0.159663,"groundRadiusY":0.030603},"20":{"pivotX":154,"pivotY":262.016949,"groundRadiusX":0.161488,"groundRadiusY":0.030706},"21":{"pivotX":154,"pivotY":262.067797,"groundRadiusX":0.163312,"groundRadiusY":0.030809},"22":{"pivotX":154,"pivotY":262.118644,"groundRadiusX":0.165137,"groundRadiusY":0.030912},"23":{"pivotX":154,"pivotY":262.169492,"groundRadiusX":0.166961,"groundRadiusY":0.031015},"24":{"pivotX":154,"pivotY":262.220339,"groundRadiusX":0.168785,"groundRadiusY":0.031118},"25":{"pivotX":154,"pivotY":262.271186,"groundRadiusX":0.17061,"groundRadiusY":0.031221},"26":{"pivotX":154,"pivotY":262.322034,"groundRadiusX":0.172434,"groundRadiusY":0.031324},"27":{"pivotX":154,"pivotY":262.372881,"groundRadiusX":0.174258,"groundRadiusY":0.031427},"28":{"pivotX":154,"pivotY":262.423729,"groundRadiusX":0.176083,"groundRadiusY":0.03153},"29":{"pivotX":154,"pivotY":262.474576,"groundRadiusX":0.177907,"groundRadiusY":0.031633},"30":{"pivotX":154,"pivotY":262.525424,"groundRadiusX":0.179732,"groundRadiusY":0.031736},"31":{"pivotX":154,"pivotY":262.576271,"groundRadiusX":0.181556,"groundRadiusY":0.031839},"32":{"pivotX":154,"pivotY":262.627119,"groundRadiusX":0.18338,"groundRadiusY":0.031942},"33":{"pivotX":154,"pivotY":262.677966,"groundRadiusX":0.185205,"groundRadiusY":0.032044},"34":{"pivotX":154,"pivotY":262.728814,"groundRadiusX":0.187029,"groundRadiusY":0.032147},"35":{"pivotX":154,"pivotY":262.779661,"groundRadiusX":0.188854,"groundRadiusY":0.03225},"36":{"pivotX":154,"pivotY":262.830508,"groundRadiusX":0.190678,"groundRadiusY":0.032353},"37":{"pivotX":154,"pivotY":262.881356,"groundRadiusX":0.192502,"groundRadiusY":0.032456},"38":{"pivotX":154,"pivotY":262.932203,"groundRadiusX":0.194327,"groundRadiusY":0.032559},"39":{"pivotX":154,"pivotY":262.983051,"groundRadiusX":0.196151,"groundRadiusY":0.032662},"40":{"pivotX":154,"pivotY":263.033898,"groundRadiusX":0.197976,"groundRadiusY":0.032765},"41":{"pivotX":154,"pivotY":263.084746,"groundRadiusX":0.1998,"groundRadiusY":0.032868},"42":{"pivotX":154,"pivotY":263.135593,"groundRadiusX":0.201624,"groundRadiusY":0.032971},"43":{"pivotX":154,"pivotY":263.186441,"groundRadiusX":0.203449,"groundRadiusY":0.033074},"44":{"pivotX":154,"pivotY":263.237288,"groundRadiusX":0.205273,"groundRadiusY":0.033177},"45":{"pivotX":154,"pivotY":263.288136,"groundRadiusX":0.207097,"groundRadiusY":0.03328},"46":{"pivotX":154,"pivotY":263.338983,"groundRadiusX":0.208922,"groundRadiusY":0.033383},"47":{"pivotX":154,"pivotY":263.389831,"groundRadiusX":0.210746,"groundRadiusY":0.033486},"48":{"pivotX":154,"pivotY":263.440678,"groundRadiusX":0.212571,"groundRadiusY":0.033589},"49":{"pivotX":154,"pivotY":263.491525,"groundRadiusX":0.214395,"groundRadiusY":0.033692},"50":{"pivotX":154,"pivotY":263.542373,"groundRadiusX":0.216219,"groundRadiusY":0.033795},"51":{"pivotX":154,"pivotY":263.59322,"groundRadiusX":0.218044,"groundRadiusY":0.033898},"52":{"pivotX":154,"pivotY":263.644068,"groundRadiusX":0.219868,"groundRadiusY":0.034001},"53":{"pivotX":154,"pivotY":263.694915,"groundRadiusX":0.221693,"groundRadiusY":0.034104},"54":{"pivotX":154,"pivotY":263.745763,"groundRadiusX":0.223517,"groundRadiusY":0.034207},"55":{"pivotX":154,"pivotY":263.79661,"groundRadiusX":0.225341,"groundRadiusY":0.03431},"56":{"pivotX":154,"pivotY":263.847458,"groundRadiusX":0.227166,"groundRadiusY":0.034413},"57":{"pivotX":154,"pivotY":263.898305,"groundRadiusX":0.22899,"groundRadiusY":0.034516},"58":{"pivotX":154,"pivotY":263.949153,"groundRadiusX":0.230815,"groundRadiusY":0.034619},"59":{"pivotX":154,"pivotY":264,"groundRadiusX":0.232639,"groundRadiusY":0.034722}}}),
  "DesignAssets/Animations/UniqueIdleV4/lantern-keeper/idle.webp": Object.freeze({"frameSize":384,"pivotX":182,"pivotY":325,"viewSize":384,"registrationScale":1,"groundRadiusX":0.182292,"groundRadiusY":0.033854}),
  "DesignAssets/Animations/CreatureHurtV5/lantern-keeper/hurt.webp": Object.freeze({"frameSize":384,"pivotX":182,"pivotY":325,"viewSize":384,"registrationScale":1,"groundRadiusX":0.182292,"groundRadiusY":0.033854}),
  "DesignAssets/Animations/CreatureDeathV10/lantern-keeper/runtime.webp": Object.freeze({"frameSize":256,"pivotX":121.523132,"pivotY":216.875445,"viewSize":248.71174377224202,"registrationScale":1,"groundRadiusX":0.182292,"groundRadiusY":0.033854,"frameGeometry":{"0":{"pivotX":121.523132,"pivotY":216.875445,"groundRadiusX":0.182292,"groundRadiusY":0.033854},"1":{"pivotX":121.635053,"pivotY":216.878559,"groundRadiusX":0.183464,"groundRadiusY":0.034013},"2":{"pivotX":121.746975,"pivotY":216.881673,"groundRadiusX":0.184636,"groundRadiusY":0.034172},"3":{"pivotX":121.858897,"pivotY":216.884786,"groundRadiusX":0.185808,"groundRadiusY":0.034331},"4":{"pivotX":121.970819,"pivotY":216.8879,"groundRadiusX":0.186981,"groundRadiusY":0.034489},"5":{"pivotX":122.08274,"pivotY":216.891014,"groundRadiusX":0.188153,"groundRadiusY":0.034648},"6":{"pivotX":122.194662,"pivotY":216.894128,"groundRadiusX":0.189325,"groundRadiusY":0.034807},"7":{"pivotX":122.306584,"pivotY":216.897242,"groundRadiusX":0.190497,"groundRadiusY":0.034966},"8":{"pivotX":122.418505,"pivotY":216.900356,"groundRadiusX":0.19167,"groundRadiusY":0.035125},"9":{"pivotX":122.530427,"pivotY":216.90347,"groundRadiusX":0.192842,"groundRadiusY":0.035284},"10":{"pivotX":122.642349,"pivotY":216.906584,"groundRadiusX":0.194014,"groundRadiusY":0.035442},"11":{"pivotX":122.75427,"pivotY":216.909698,"groundRadiusX":0.195186,"groundRadiusY":0.035601},"12":{"pivotX":122.866192,"pivotY":216.912811,"groundRadiusX":0.196358,"groundRadiusY":0.03576},"13":{"pivotX":122.978114,"pivotY":216.915925,"groundRadiusX":0.197531,"groundRadiusY":0.035919},"14":{"pivotX":123.090036,"pivotY":216.919039,"groundRadiusX":0.198703,"groundRadiusY":0.036078},"15":{"pivotX":123.201957,"pivotY":216.922153,"groundRadiusX":0.199875,"groundRadiusY":0.036237},"16":{"pivotX":123.313879,"pivotY":216.925267,"groundRadiusX":0.201047,"groundRadiusY":0.036395},"17":{"pivotX":123.425801,"pivotY":216.928381,"groundRadiusX":0.20222,"groundRadiusY":0.036554},"18":{"pivotX":123.537722,"pivotY":216.931495,"groundRadiusX":0.203392,"groundRadiusY":0.036713},"19":{"pivotX":123.649644,"pivotY":216.934609,"groundRadiusX":0.204564,"groundRadiusY":0.036872},"20":{"pivotX":123.761566,"pivotY":216.937722,"groundRadiusX":0.205736,"groundRadiusY":0.037031},"21":{"pivotX":123.873488,"pivotY":216.940836,"groundRadiusX":0.206909,"groundRadiusY":0.03719},"22":{"pivotX":123.985409,"pivotY":216.94395,"groundRadiusX":0.208081,"groundRadiusY":0.037348},"23":{"pivotX":124.097331,"pivotY":216.947064,"groundRadiusX":0.209253,"groundRadiusY":0.037507},"24":{"pivotX":124.209253,"pivotY":216.950178,"groundRadiusX":0.210425,"groundRadiusY":0.037666},"25":{"pivotX":124.321174,"pivotY":216.953292,"groundRadiusX":0.211597,"groundRadiusY":0.037825},"26":{"pivotX":124.433096,"pivotY":216.956406,"groundRadiusX":0.21277,"groundRadiusY":0.037984},"27":{"pivotX":124.545018,"pivotY":216.95952,"groundRadiusX":0.213942,"groundRadiusY":0.038142},"28":{"pivotX":124.65694,"pivotY":216.962633,"groundRadiusX":0.215114,"groundRadiusY":0.038301},"29":{"pivotX":124.768861,"pivotY":216.965747,"groundRadiusX":0.216286,"groundRadiusY":0.03846},"30":{"pivotX":124.880783,"pivotY":216.968861,"groundRadiusX":0.217459,"groundRadiusY":0.038619},"31":{"pivotX":124.992705,"pivotY":216.971975,"groundRadiusX":0.218631,"groundRadiusY":0.038778},"32":{"pivotX":125.104626,"pivotY":216.975089,"groundRadiusX":0.219803,"groundRadiusY":0.038937},"33":{"pivotX":125.216548,"pivotY":216.978203,"groundRadiusX":0.220975,"groundRadiusY":0.039095},"34":{"pivotX":125.32847,"pivotY":216.981317,"groundRadiusX":0.222148,"groundRadiusY":0.039254},"35":{"pivotX":125.440391,"pivotY":216.984431,"groundRadiusX":0.22332,"groundRadiusY":0.039413},"36":{"pivotX":125.552313,"pivotY":216.987544,"groundRadiusX":0.224492,"groundRadiusY":0.039572},"37":{"pivotX":125.664235,"pivotY":216.990658,"groundRadiusX":0.225664,"groundRadiusY":0.039731},"38":{"pivotX":125.776157,"pivotY":216.993772,"groundRadiusX":0.226837,"groundRadiusY":0.03989},"39":{"pivotX":125.888078,"pivotY":216.996886,"groundRadiusX":0.228009,"groundRadiusY":0.040048},"40":{"pivotX":126,"pivotY":217,"groundRadiusX":0.229181,"groundRadiusY":0.040207}}}),
  "DesignAssets/Animations/UniqueIdleV3/old-garden-snail/idle.webp": Object.freeze({"frameSize":352,"pivotX":166,"pivotY":288,"viewSize":352,"registrationScale":1,"groundRadiusX":0.318182,"groundRadiusY":0.056818}),
  "DesignAssets/Animations/CreatureAttackV2/old-garden-snail/runtime.webp": Object.freeze({"frameSize":264,"pivotX":125.200549,"pivotY":217.401099,"viewSize":239.34065934065933,"registrationScale":1,"groundRadiusX":0.318182,"groundRadiusY":0.056818}),
  "DesignAssets/Animations/CreatureHurtV7/old-garden-snail/hurt.webp": Object.freeze({"frameSize":352,"pivotX":166,"pivotY":288,"viewSize":352,"registrationScale":1,"groundRadiusX":0.318182,"groundRadiusY":0.056818}),
  "DesignAssets/Animations/SnailDeathV1/old-garden-snail/runtime.webp": Object.freeze({"frameSize":256,"pivotX":120.710623,"pivotY":209.421245,"viewSize":256.5860805860806,"registrationScale":1,"groundRadiusX":0.318182,"groundRadiusY":0.056818,"frameGeometry":{"0":{"pivotX":120.710623,"pivotY":209.421245,"groundRadiusX":0.318182,"groundRadiusY":0.056818},"1":{"pivotX":120.820818,"pivotY":209.537469,"groundRadiusX":0.315775,"groundRadiusY":0.056609},"2":{"pivotX":120.931013,"pivotY":209.653694,"groundRadiusX":0.313368,"groundRadiusY":0.056399},"3":{"pivotX":121.041209,"pivotY":209.769918,"groundRadiusX":0.310962,"groundRadiusY":0.05619},"4":{"pivotX":121.151404,"pivotY":209.886142,"groundRadiusX":0.308555,"groundRadiusY":0.055981},"5":{"pivotX":121.2616,"pivotY":210.002366,"groundRadiusX":0.306148,"groundRadiusY":0.055771},"6":{"pivotX":121.371795,"pivotY":210.11859,"groundRadiusX":0.303742,"groundRadiusY":0.055562},"7":{"pivotX":121.48199,"pivotY":210.234814,"groundRadiusX":0.301335,"groundRadiusY":0.055353},"8":{"pivotX":121.592186,"pivotY":210.351038,"groundRadiusX":0.298928,"groundRadiusY":0.055143},"9":{"pivotX":121.702381,"pivotY":210.467262,"groundRadiusX":0.296522,"groundRadiusY":0.054934},"10":{"pivotX":121.812576,"pivotY":210.583486,"groundRadiusX":0.294115,"groundRadiusY":0.054724},"11":{"pivotX":121.922772,"pivotY":210.69971,"groundRadiusX":0.291708,"groundRadiusY":0.054515},"12":{"pivotX":122.032967,"pivotY":210.815934,"groundRadiusX":0.289302,"groundRadiusY":0.054306},"13":{"pivotX":122.143162,"pivotY":210.932158,"groundRadiusX":0.286895,"groundRadiusY":0.054096},"14":{"pivotX":122.253358,"pivotY":211.048382,"groundRadiusX":0.284488,"groundRadiusY":0.053887},"15":{"pivotX":122.363553,"pivotY":211.164606,"groundRadiusX":0.282082,"groundRadiusY":0.053677},"16":{"pivotX":122.473748,"pivotY":211.28083,"groundRadiusX":0.279675,"groundRadiusY":0.053468},"17":{"pivotX":122.583944,"pivotY":211.397054,"groundRadiusX":0.277268,"groundRadiusY":0.053259},"18":{"pivotX":122.694139,"pivotY":211.513278,"groundRadiusX":0.274862,"groundRadiusY":0.053049},"19":{"pivotX":122.804335,"pivotY":211.629502,"groundRadiusX":0.272455,"groundRadiusY":0.05284},"20":{"pivotX":122.91453,"pivotY":211.745726,"groundRadiusX":0.270048,"groundRadiusY":0.052631},"21":{"pivotX":123.024725,"pivotY":211.861951,"groundRadiusX":0.267641,"groundRadiusY":0.052421},"22":{"pivotX":123.134921,"pivotY":211.978175,"groundRadiusX":0.265235,"groundRadiusY":0.052212},"23":{"pivotX":123.245116,"pivotY":212.094399,"groundRadiusX":0.262828,"groundRadiusY":0.052002},"24":{"pivotX":123.355311,"pivotY":212.210623,"groundRadiusX":0.260421,"groundRadiusY":0.051793},"25":{"pivotX":123.465507,"pivotY":212.326847,"groundRadiusX":0.258015,"groundRadiusY":0.051584},"26":{"pivotX":123.575702,"pivotY":212.443071,"groundRadiusX":0.255608,"groundRadiusY":0.051374},"27":{"pivotX":123.685897,"pivotY":212.559295,"groundRadiusX":0.253201,"groundRadiusY":0.051165},"28":{"pivotX":123.796093,"pivotY":212.675519,"groundRadiusX":0.250795,"groundRadiusY":0.050956},"29":{"pivotX":123.906288,"pivotY":212.791743,"groundRadiusX":0.248388,"groundRadiusY":0.050746},"30":{"pivotX":124.016484,"pivotY":212.907967,"groundRadiusX":0.245981,"groundRadiusY":0.050537},"31":{"pivotX":124.126679,"pivotY":213.024191,"groundRadiusX":0.243575,"groundRadiusY":0.050327},"32":{"pivotX":124.236874,"pivotY":213.140415,"groundRadiusX":0.241168,"groundRadiusY":0.050118},"33":{"pivotX":124.34707,"pivotY":213.256639,"groundRadiusX":0.238761,"groundRadiusY":0.049909},"34":{"pivotX":124.457265,"pivotY":213.372863,"groundRadiusX":0.236355,"groundRadiusY":0.049699},"35":{"pivotX":124.56746,"pivotY":213.489087,"groundRadiusX":0.233948,"groundRadiusY":0.04949},"36":{"pivotX":124.677656,"pivotY":213.605311,"groundRadiusX":0.231541,"groundRadiusY":0.04928},"37":{"pivotX":124.787851,"pivotY":213.721535,"groundRadiusX":0.229135,"groundRadiusY":0.049071},"38":{"pivotX":124.898046,"pivotY":213.837759,"groundRadiusX":0.226728,"groundRadiusY":0.048862},"39":{"pivotX":125.008242,"pivotY":213.953984,"groundRadiusX":0.224321,"groundRadiusY":0.048652},"40":{"pivotX":125.118437,"pivotY":214.070208,"groundRadiusX":0.221914,"groundRadiusY":0.048443},"41":{"pivotX":125.228632,"pivotY":214.186432,"groundRadiusX":0.219508,"groundRadiusY":0.048234},"42":{"pivotX":125.338828,"pivotY":214.302656,"groundRadiusX":0.217101,"groundRadiusY":0.048024},"43":{"pivotX":125.449023,"pivotY":214.41888,"groundRadiusX":0.214694,"groundRadiusY":0.047815},"44":{"pivotX":125.559219,"pivotY":214.535104,"groundRadiusX":0.212288,"groundRadiusY":0.047605},"45":{"pivotX":125.669414,"pivotY":214.651328,"groundRadiusX":0.209881,"groundRadiusY":0.047396},"46":{"pivotX":125.779609,"pivotY":214.767552,"groundRadiusX":0.207474,"groundRadiusY":0.047187},"47":{"pivotX":125.889805,"pivotY":214.883776,"groundRadiusX":0.205068,"groundRadiusY":0.046977},"48":{"pivotX":126,"pivotY":215,"groundRadiusX":0.202661,"groundRadiusY":0.046768}}}),
  "DesignAssets/Animations/MountainPawLeaderIdle/walking-forest/idle-runtime.webp": Object.freeze({"frameSize":260,"pivotX":128,"pivotY":214,"viewSize":260,"registrationScale":1.015625,"groundRadiusX":0.414063,"groundRadiusY":0.0625}),
  "DesignAssets/Animations/CreatureHurtV8/walking-forest/hurt.webp": Object.freeze({"frameSize":260,"pivotX":128,"pivotY":214,"viewSize":260,"registrationScale":1.015625,"groundRadiusX":0.414063,"groundRadiusY":0.0625}),
  "DesignAssets/Animations/CreatureDeathV12/walking-forest/runtime.webp": Object.freeze({"frameSize":260,"pivotX":128,"pivotY":214,"viewSize":260,"registrationScale":1.015625,"groundRadiusX":0.414063,"groundRadiusY":0.0625,"frameGeometry":{"0":{"pivotX":128,"pivotY":214,"groundRadiusX":0.414063,"groundRadiusY":0.0625},"1":{"pivotX":128.076923,"pivotY":214.115385,"groundRadiusX":0.416166,"groundRadiusY":0.0622},"2":{"pivotX":128.153846,"pivotY":214.230769,"groundRadiusX":0.418269,"groundRadiusY":0.061899},"3":{"pivotX":128.230769,"pivotY":214.346154,"groundRadiusX":0.420373,"groundRadiusY":0.061599},"4":{"pivotX":128.307692,"pivotY":214.461538,"groundRadiusX":0.422476,"groundRadiusY":0.061298},"5":{"pivotX":128.384615,"pivotY":214.576923,"groundRadiusX":0.424579,"groundRadiusY":0.060998},"6":{"pivotX":128.461538,"pivotY":214.692308,"groundRadiusX":0.426683,"groundRadiusY":0.060697},"7":{"pivotX":128.538462,"pivotY":214.807692,"groundRadiusX":0.428786,"groundRadiusY":0.060397},"8":{"pivotX":128.615385,"pivotY":214.923077,"groundRadiusX":0.430889,"groundRadiusY":0.060096},"9":{"pivotX":128.692308,"pivotY":215.038462,"groundRadiusX":0.432993,"groundRadiusY":0.059796},"10":{"pivotX":128.769231,"pivotY":215.153846,"groundRadiusX":0.435096,"groundRadiusY":0.059495},"11":{"pivotX":128.846154,"pivotY":215.269231,"groundRadiusX":0.4372,"groundRadiusY":0.059195},"12":{"pivotX":128.923077,"pivotY":215.384615,"groundRadiusX":0.439303,"groundRadiusY":0.058894},"13":{"pivotX":129,"pivotY":215.5,"groundRadiusX":0.441406,"groundRadiusY":0.058594},"14":{"pivotX":129.076923,"pivotY":215.615385,"groundRadiusX":0.44351,"groundRadiusY":0.058293},"15":{"pivotX":129.153846,"pivotY":215.730769,"groundRadiusX":0.445613,"groundRadiusY":0.057993},"16":{"pivotX":129.230769,"pivotY":215.846154,"groundRadiusX":0.447716,"groundRadiusY":0.057692},"17":{"pivotX":129.307692,"pivotY":215.961538,"groundRadiusX":0.44982,"groundRadiusY":0.057392},"18":{"pivotX":129.384615,"pivotY":216.076923,"groundRadiusX":0.451923,"groundRadiusY":0.057091},"19":{"pivotX":129.461538,"pivotY":216.192308,"groundRadiusX":0.454026,"groundRadiusY":0.056791},"20":{"pivotX":129.538462,"pivotY":216.307692,"groundRadiusX":0.45613,"groundRadiusY":0.05649},"21":{"pivotX":129.615385,"pivotY":216.423077,"groundRadiusX":0.458233,"groundRadiusY":0.05619},"22":{"pivotX":129.692308,"pivotY":216.538462,"groundRadiusX":0.460337,"groundRadiusY":0.055889},"23":{"pivotX":129.769231,"pivotY":216.653846,"groundRadiusX":0.46244,"groundRadiusY":0.055589},"24":{"pivotX":129.846154,"pivotY":216.769231,"groundRadiusX":0.464543,"groundRadiusY":0.055288},"25":{"pivotX":129.923077,"pivotY":216.884615,"groundRadiusX":0.466647,"groundRadiusY":0.054988},"26":{"pivotX":130,"pivotY":217,"groundRadiusX":0.46875,"groundRadiusY":0.054688}}}),
  "DesignAssets/Animations/MountainPawLeaderIdle/white-paw/idle-runtime.webp": Object.freeze({"frameSize":312,"pivotX":152,"pivotY":259,"viewSize":312,"registrationScale":1.0833333333333333,"groundRadiusX":0.267361,"groundRadiusY":0.048611}),
  "DesignAssets/Animations/CreatureHurtV6/white-paw/hurt.webp": Object.freeze({"frameSize":312,"pivotX":152,"pivotY":259,"viewSize":312,"registrationScale":1.0833333333333333,"groundRadiusX":0.267361,"groundRadiusY":0.048611}),
  "DesignAssets/Animations/CreatureDeathV12/white-paw/runtime.webp": Object.freeze({"frameSize":276,"pivotX":134.444444,"pivotY":229.555556,"viewSize":276,"registrationScale":1.078125,"groundRadiusX":0.267361,"groundRadiusY":0.048611,"frameGeometry":{"0":{"pivotX":134.444444,"pivotY":229.555556,"groundRadiusX":0.267361,"groundRadiusY":0.048611},"1":{"pivotX":134.51153,"pivotY":229.658281,"groundRadiusX":0.268802,"groundRadiusY":0.048431},"2":{"pivotX":134.578616,"pivotY":229.761006,"groundRadiusX":0.270244,"groundRadiusY":0.048251},"3":{"pivotX":134.645702,"pivotY":229.863732,"groundRadiusX":0.271685,"groundRadiusY":0.048071},"4":{"pivotX":134.712788,"pivotY":229.966457,"groundRadiusX":0.273126,"groundRadiusY":0.04789},"5":{"pivotX":134.779874,"pivotY":230.069182,"groundRadiusX":0.274568,"groundRadiusY":0.04771},"6":{"pivotX":134.84696,"pivotY":230.171908,"groundRadiusX":0.276009,"groundRadiusY":0.04753},"7":{"pivotX":134.914046,"pivotY":230.274633,"groundRadiusX":0.27745,"groundRadiusY":0.04735},"8":{"pivotX":134.981132,"pivotY":230.377358,"groundRadiusX":0.278892,"groundRadiusY":0.04717},"9":{"pivotX":135.048218,"pivotY":230.480084,"groundRadiusX":0.280333,"groundRadiusY":0.04699},"10":{"pivotX":135.115304,"pivotY":230.582809,"groundRadiusX":0.281774,"groundRadiusY":0.046809},"11":{"pivotX":135.18239,"pivotY":230.685535,"groundRadiusX":0.283215,"groundRadiusY":0.046629},"12":{"pivotX":135.249476,"pivotY":230.78826,"groundRadiusX":0.284657,"groundRadiusY":0.046449},"13":{"pivotX":135.316562,"pivotY":230.890985,"groundRadiusX":0.286098,"groundRadiusY":0.046269},"14":{"pivotX":135.383648,"pivotY":230.993711,"groundRadiusX":0.287539,"groundRadiusY":0.046089},"15":{"pivotX":135.450734,"pivotY":231.096436,"groundRadiusX":0.288981,"groundRadiusY":0.045909},"16":{"pivotX":135.51782,"pivotY":231.199161,"groundRadiusX":0.290422,"groundRadiusY":0.045729},"17":{"pivotX":135.584906,"pivotY":231.301887,"groundRadiusX":0.291863,"groundRadiusY":0.045548},"18":{"pivotX":135.651992,"pivotY":231.404612,"groundRadiusX":0.293305,"groundRadiusY":0.045368},"19":{"pivotX":135.719078,"pivotY":231.507338,"groundRadiusX":0.294746,"groundRadiusY":0.045188},"20":{"pivotX":135.786164,"pivotY":231.610063,"groundRadiusX":0.296187,"groundRadiusY":0.045008},"21":{"pivotX":135.853249,"pivotY":231.712788,"groundRadiusX":0.297628,"groundRadiusY":0.044828},"22":{"pivotX":135.920335,"pivotY":231.815514,"groundRadiusX":0.29907,"groundRadiusY":0.044648},"23":{"pivotX":135.987421,"pivotY":231.918239,"groundRadiusX":0.300511,"groundRadiusY":0.044467},"24":{"pivotX":136.054507,"pivotY":232.020964,"groundRadiusX":0.301952,"groundRadiusY":0.044287},"25":{"pivotX":136.121593,"pivotY":232.12369,"groundRadiusX":0.303394,"groundRadiusY":0.044107},"26":{"pivotX":136.188679,"pivotY":232.226415,"groundRadiusX":0.304835,"groundRadiusY":0.043927},"27":{"pivotX":136.255765,"pivotY":232.32914,"groundRadiusX":0.306276,"groundRadiusY":0.043747},"28":{"pivotX":136.322851,"pivotY":232.431866,"groundRadiusX":0.307718,"groundRadiusY":0.043567},"29":{"pivotX":136.389937,"pivotY":232.534591,"groundRadiusX":0.309159,"groundRadiusY":0.043386},"30":{"pivotX":136.457023,"pivotY":232.637317,"groundRadiusX":0.3106,"groundRadiusY":0.043206},"31":{"pivotX":136.524109,"pivotY":232.740042,"groundRadiusX":0.312041,"groundRadiusY":0.043026},"32":{"pivotX":136.591195,"pivotY":232.842767,"groundRadiusX":0.313483,"groundRadiusY":0.042846},"33":{"pivotX":136.658281,"pivotY":232.945493,"groundRadiusX":0.314924,"groundRadiusY":0.042666},"34":{"pivotX":136.725367,"pivotY":233.048218,"groundRadiusX":0.316365,"groundRadiusY":0.042486},"35":{"pivotX":136.792453,"pivotY":233.150943,"groundRadiusX":0.317807,"groundRadiusY":0.042305},"36":{"pivotX":136.859539,"pivotY":233.253669,"groundRadiusX":0.319248,"groundRadiusY":0.042125},"37":{"pivotX":136.926625,"pivotY":233.356394,"groundRadiusX":0.320689,"groundRadiusY":0.041945},"38":{"pivotX":136.993711,"pivotY":233.459119,"groundRadiusX":0.322131,"groundRadiusY":0.041765},"39":{"pivotX":137.060797,"pivotY":233.561845,"groundRadiusX":0.323572,"groundRadiusY":0.041585},"40":{"pivotX":137.127883,"pivotY":233.66457,"groundRadiusX":0.325013,"groundRadiusY":0.041405},"41":{"pivotX":137.194969,"pivotY":233.767296,"groundRadiusX":0.326454,"groundRadiusY":0.041224},"42":{"pivotX":137.262055,"pivotY":233.870021,"groundRadiusX":0.327896,"groundRadiusY":0.041044},"43":{"pivotX":137.32914,"pivotY":233.972746,"groundRadiusX":0.329337,"groundRadiusY":0.040864},"44":{"pivotX":137.396226,"pivotY":234.075472,"groundRadiusX":0.330778,"groundRadiusY":0.040684},"45":{"pivotX":137.463312,"pivotY":234.178197,"groundRadiusX":0.33222,"groundRadiusY":0.040504},"46":{"pivotX":137.530398,"pivotY":234.280922,"groundRadiusX":0.333661,"groundRadiusY":0.040324},"47":{"pivotX":137.597484,"pivotY":234.383648,"groundRadiusX":0.335102,"groundRadiusY":0.040143},"48":{"pivotX":137.66457,"pivotY":234.486373,"groundRadiusX":0.336544,"groundRadiusY":0.039963},"49":{"pivotX":137.731656,"pivotY":234.589099,"groundRadiusX":0.337985,"groundRadiusY":0.039783},"50":{"pivotX":137.798742,"pivotY":234.691824,"groundRadiusX":0.339426,"groundRadiusY":0.039603},"51":{"pivotX":137.865828,"pivotY":234.794549,"groundRadiusX":0.340867,"groundRadiusY":0.039423},"52":{"pivotX":137.932914,"pivotY":234.897275,"groundRadiusX":0.342309,"groundRadiusY":0.039243},"53":{"pivotX":138,"pivotY":235,"groundRadiusX":0.34375,"groundRadiusY":0.039063}}}),
  "DesignAssets/Animations/MountainPawLeaderIdle/spiny-back-leader/idle-runtime.webp": Object.freeze({"frameSize":256,"pivotX":124,"pivotY":202,"viewSize":256,"registrationScale":1,"groundRadiusX":0.398438,"groundRadiusY":0.085938}),
  "DesignAssets/Animations/CreatureAttackV2/spiny-back-leader/runtime.webp": Object.freeze({"frameSize":512,"pivotX":249.454545,"pivotY":412,"viewSize":418.9090909090909,"registrationScale":1,"groundRadiusX":0.398438,"groundRadiusY":0.085938}),
  "DesignAssets/Animations/CreatureHurtV8/spiny-back-leader/hurt.webp": Object.freeze({"frameSize":256,"pivotX":124,"pivotY":202,"viewSize":256,"registrationScale":1,"groundRadiusX":0.398438,"groundRadiusY":0.085938}),
  "DesignAssets/Animations/CreatureDeathV10/spiny-back-leader/runtime.webp": Object.freeze({"frameSize":256,"pivotX":124,"pivotY":202,"viewSize":256,"registrationScale":1,"groundRadiusX":0.398438,"groundRadiusY":0.085938,"frameGeometry":{"0":{"pivotX":124,"pivotY":202,"groundRadiusX":0.398438,"groundRadiusY":0.085938},"1":{"pivotX":125,"pivotY":208.5,"groundRadiusX":0.410156,"groundRadiusY":0.068359},"2":{"pivotX":126,"pivotY":215,"groundRadiusX":0.421875,"groundRadiusY":0.050781}}}),
});

return { UNIT_SPRITE_REGISTRATION };
})();
modules["client/image-geometry.mjs"] = (() => {
const { IMAGE_SCALES } = modules["client/image-scales.mjs"];
const { UNIT_SPRITE_REGISTRATION } = modules["client/unit-sprite-registration.mjs"];

function imageScale(source) {
  return IMAGE_SCALES[source]?.[0] || 1;
}

function imageFrameSize(source, size) {
  return UNIT_SPRITE_REGISTRATION[source]?.frameSize || Math.round(size * imageScale(source));
}

function imageRegion(source, region) {
  const scale = IMAGE_SCALES[source] || [1, 1];
  return { x: region.x * scale[0], y: region.y * scale[1],
    width: region.width * scale[0], height: region.height * scale[1] };
}

function imageAnimation(animation) {
  const scale = imageScale(animation.image);
  const result = { ...animation };
  for (const key of ["frameSize", "pivotX", "pivotY", "outletX", "outletY", "height", "viewSize"])
    if (Number.isFinite(result[key])) result[key] *= scale;
  if (Number.isFinite(result.frameSize)) result.frameSize = Math.round(result.frameSize);
  if (result.nestBounds) result.nestBounds = Object.freeze(imageRegion(animation.image, result.nestBounds));
  Object.assign(result, UNIT_SPRITE_REGISTRATION[animation.image]);
  return result;
}

function imageFrameGeometry(animation, frame) {
  const geometry = animation.frameGeometry?.[frame];
  return geometry ? { ...animation, ...geometry } : animation;
}

return { imageScale, imageFrameSize, imageRegion, imageAnimation, imageFrameGeometry };
})();
modules["client/unit-image-bounds.mjs"] = (() => {
const UNIT_IMAGE_BOUNDS = Object.freeze({
  "DesignAssets/Tribes/spore/Animations/Units/jump/jump.webp": Object.freeze({"height":287,"width":440,"frameSize":512}),
  "DesignAssets/Tribes/pebble/Animations/Units/jump/jump.webp": Object.freeze({"height":287,"width":421,"frameSize":512}),
  "DesignAssets/Tribes/spring/Animations/Units/jump/jump.webp": Object.freeze({"height":287,"width":238,"frameSize":512}),
  "DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp": Object.freeze({"frameSize":631,"width":201,"height":247,"bodyWidth":237.69230769230768,"bodyHeight":290.52287581699346}),
  "DesignAssets/Tribes/sprout/AnimationStudies/death-v1/death-runtime.webp": Object.freeze({"frameSize":316,"width":140,"height":173}),
  "DesignAssets/Animations/UnitAttack/attack.png": Object.freeze({"frameSize":632,"width":295,"height":331}),
  "DesignAssets/Animations/UnitHurt/V3/hurt.png": Object.freeze({"frameSize":632,"width":293,"height":360}),
  "DesignAssets/Tribes/spore/AnimationStudies/idle-v8/idle-v8.webp": Object.freeze({"frameSize":549,"width":423,"height":306,"bodyWidth":85,"bodyHeight":61}),
  "DesignAssets/Tribes/spore/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": Object.freeze({"frameSize":553,"width":424,"height":300}),
  "DesignAssets/Tribes/spore/AnimationStudies/attack-directions-v3/right/attack.webp": Object.freeze({"frameSize":553,"width":424,"height":300}),
  "DesignAssets/Tribes/spore/AnimationStudies/hurt-v2/hurt-v2.webp": Object.freeze({"frameSize":553,"width":424,"height":300}),
  "DesignAssets/Tribes/pebble/AnimationStudies/idle-v3/idle-v3.webp": Object.freeze({"frameSize":512,"width":406,"height":300,"bodyWidth":84,"bodyHeight":63}),
  "DesignAssets/Tribes/pebble/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": Object.freeze({"frameSize":517,"width":406,"height":300}),
  "DesignAssets/Tribes/pebble/AnimationStudies/attack-directions-v3/right/attack.webp": Object.freeze({"frameSize":512,"width":399,"height":303}),
  "DesignAssets/Tribes/pebble/AnimationStudies/hurt-v2/hurt-v2.webp": Object.freeze({"frameSize":517,"width":406,"height":300}),
  "DesignAssets/Tribes/spring/AnimationStudies/idle-v4/idle-v4.webp": Object.freeze({"frameSize":512,"width":230,"height":288,"bodyWidth":74,"bodyHeight":97}),
  "DesignAssets/Tribes/spring/AnimationStudies/death-tail-repair-v6/death-tail-repair-v6.png": Object.freeze({"frameSize":516,"width":230,"height":288}),
  "DesignAssets/Tribes/spring/AnimationStudies/attack-directions-v3/right/attack.webp": Object.freeze({"frameSize":516,"width":230,"height":288}),
  "DesignAssets/Tribes/spring/AnimationStudies/hurt-v2/hurt-v2.webp": Object.freeze({"frameSize":516,"width":230,"height":288}),
  "DesignAssets/Animations/CreatureIdleV3/flower-tail-bird/idle.webp": Object.freeze({"frameSize":440,"width":265,"height":243}),
  "DesignAssets/Animations/CreatureDeathV4/flower-tail-bird/runtime.webp": Object.freeze({"frameSize":290,"width":185,"height":161}),
  "DesignAssets/Animations/CreatureIdleV3/dew-rabbit/idle.webp": Object.freeze({"frameSize":430,"width":257,"height":283}),
  "DesignAssets/Animations/CreatureDeathV6/dew-rabbit/runtime.webp": Object.freeze({"frameSize":264,"width":157,"height":177}),
  "DesignAssets/Animations/CreatureIdleV3/soil-mole/idle.webp": Object.freeze({"frameSize":356,"width":283,"height":199}),
  "DesignAssets/Animations/CreatureDeathV6/soil-mole/runtime.webp": Object.freeze({"frameSize":258,"width":205,"height":144}),
  "DesignAssets/Animations/CreatureIdleV4/bundle-snail/idle.webp": Object.freeze({"frameSize":470,"width":283,"height":220}),
  "DesignAssets/Animations/SnailDeathV1/bundle-snail/runtime.webp": Object.freeze({"frameSize":304,"width":182,"height":138}),
  "DesignAssets/Animations/CottonSheepIdle/CalmV5/idle-runtime.webp": Object.freeze({"frameSize":256,"width":192,"height":175}),
  "DesignAssets/Animations/CreatureDeathV6/cotton-sheep/runtime.webp": Object.freeze({"frameSize":256,"width":193,"height":175}),
  "DesignAssets/Animations/RollingAcornIdle/v1/idle.webp": Object.freeze({"frameSize":428,"width":283,"height":272}),
  "DesignAssets/Animations/CreatureDeathV4/rolling-acorn/runtime.webp": Object.freeze({"frameSize":262,"width":172,"height":167}),
  "DesignAssets/Animations/BubbleToadIdle/BreathV1/idle.webp": Object.freeze({"frameSize":362,"width":265,"height":186}),
  "DesignAssets/Animations/CreatureIdleStudies/V1/snare-vine/idle.webp": Object.freeze({"frameSize":456,"width":239,"height":283}),
  "DesignAssets/Animations/CreatureDeathV4/snare-vine/runtime.webp": Object.freeze({"frameSize":276,"width":144,"height":170}),
  "DesignAssets/Animations/Beetle/atlas.webp": Object.freeze({"frameSize":346,"width":245,"height":195}),
  "DesignAssets/Animations/BeetleDeath/dead-v2.png": Object.freeze({"frameSize":186,"width":144,"height":86}),
  "DesignAssets/Animations/SoilBoarIdle/V1/idle.webp": Object.freeze({"frameSize":370,"width":265,"height":195}),
  "DesignAssets/Animations/CreatureDeathV6/soil-boar/runtime.webp": Object.freeze({"frameSize":256,"width":184,"height":135}),
  "DesignAssets/Animations/CreatureIdleStudies/V2/vine-turtle/idle.webp": Object.freeze({"frameSize":346,"width":283,"height":207}),
  "DesignAssets/Animations/CreatureDeathV12/vine-turtle/runtime.webp": Object.freeze({"frameSize":256,"width":231,"height":143}),
  "DesignAssets/Animations/CreatureIdleStudies/V2/shadow-weasel/idle.webp": Object.freeze({"frameSize":414,"width":264,"height":111}),
  "DesignAssets/Animations/CreatureDeathV6/shadow-weasel/runtime.webp": Object.freeze({"frameSize":332,"width":202,"height":85}),
  "DesignAssets/Animations/TalonOwlIdle/PerchedV4/idle.webp": Object.freeze({"frameSize":472,"width":210,"height":269}),
  "DesignAssets/Animations/CreatureDeathV6/talon-owl/runtime.webp": Object.freeze({"frameSize":280,"width":178,"height":140}),
  "DesignAssets/Animations/UniqueIdleV4/spring-keeper/idle.webp": Object.freeze({"frameSize":412,"width":265,"height":230}),
  "DesignAssets/Animations/CreatureDeathV11/spring-keeper/runtime.webp": Object.freeze({"frameSize":308,"width":178,"height":155}),
  "DesignAssets/Animations/UniqueIdleV4/lantern-keeper/idle.webp": Object.freeze({"frameSize":384,"width":281,"height":256}),
  "DesignAssets/Animations/CreatureDeathV10/lantern-keeper/runtime.webp": Object.freeze({"frameSize":256,"width":182,"height":172}),
  "DesignAssets/Animations/UniqueIdleV3/old-garden-snail/idle.webp": Object.freeze({"frameSize":352,"width":273,"height":261}),
  "DesignAssets/Animations/SnailDeathV1/old-garden-snail/runtime.webp": Object.freeze({"frameSize":256,"width":199,"height":188}),
  "DesignAssets/Animations/MountainPawLeaderIdle/walking-forest/idle-runtime.webp": Object.freeze({"frameSize":260,"width":220,"height":187}),
  "DesignAssets/Animations/CreatureDeathV12/walking-forest/runtime.webp": Object.freeze({"frameSize":260,"width":250,"height":205}),
  "DesignAssets/Animations/MountainPawLeaderIdle/white-paw/idle-runtime.webp": Object.freeze({"frameSize":312,"width":220,"height":125}),
  "DesignAssets/Animations/CreatureDeathV12/white-paw/runtime.webp": Object.freeze({"frameSize":276,"width":200,"height":115}),
  "DesignAssets/Animations/MountainPawLeaderIdle/spiny-back-leader/idle-runtime.webp": Object.freeze({"frameSize":256,"width":220,"height":191}),
  "DesignAssets/Animations/CreatureDeathV10/spiny-back-leader/runtime.webp": Object.freeze({"frameSize":256,"width":203,"height":176}),
});

return { UNIT_IMAGE_BOUNDS };
})();
modules["client/creature-ranged.mjs"] = (() => {
const { imageAnimation } = modules["client/image-geometry.mjs"];
const { UNIT_IMAGE_BOUNDS } = modules["client/unit-image-bounds.mjs"];
const { unitDisplaySize, unitFrameMirror, unitFacing } = modules["client/unit-size.mjs"];

// Approved 2026-11-06. Native cels are unchanged; registration is the exact
// inverse of the approved melee seed's lossless resize-and-padding transform.
const CREATURE_RANGED_ANIMATIONS = Object.freeze({
  "spiny-back-beetle": Object.freeze({
    image: "DesignAssets/Animations/CreatureRangedV1/spiny-back-beetle/shoot.webp",
    frameSize: 512, viewSize: 454.8367346938776, columns: 4,
    pivotX: 263.7510204081633, pivotY: 421.314283077551,
    durationsMs: Object.freeze([120,130,150,100,80,140,160,160]),
    frameCount: 8, durationMs: 1040, launchAtMs: 500, launchFrame: 4,
    outletX: 145, outletY: 339, registrationScale: 1, facing: "left", loop: false,
    idleImage: "DesignAssets/Animations/Beetle/atlas.webp"
  }),
  "spiny-back-leader": Object.freeze({
    image: "DesignAssets/Animations/CreatureRangedV1/spiny-back-leader/shoot.webp",
    frameSize: 512, viewSize: 418.9090909090909, columns: 4,
    pivotX: 263.454545, pivotY: 411,
    durationsMs: Object.freeze([140,170,190,140,90,170,180,160]),
    frameCount: 8, durationMs: 1240, launchAtMs: 640, launchFrame: 4,
    outletX: 145, outletY: 317, registrationScale: 1, facing: "left", loop: false,
    idleImage: "DesignAssets/Animations/MountainPawLeaderIdle/spiny-back-leader/idle-runtime.webp"
  }),
  "flower-tail-bird": Object.freeze({
    image: "DesignAssets/Animations/CreatureRangedV1/flower-tail-bird/shoot.webp",
    frameSize: 512, viewSize: 500.7396226415094, columns: 4,
    pivotX: 228.86883742756186, pivotY: 422.2344753074205,
    durationsMs: Object.freeze([100,120,120,60,100,120,160,220]),
    frameCount: 8, durationMs: 1000, launchAtMs: 400, launchFrame: 4,
    outletX: 92, outletY: 234, registrationScale: 1, facing: "left", loop: false,
    idleImage: "DesignAssets/Animations/CreatureIdleV3/flower-tail-bird/idle.webp"
  }),
  "soil-mole": Object.freeze({
    image: "DesignAssets/Animations/CreatureRangedV1/soil-mole/shoot.png",
    frameSize: 512, viewSize: 445.3180212014134, columns: 4,
    pivotX: 256.16421403663, pivotY: 377.90245216117216,
    durationsMs: Object.freeze([140,110,140,160,70,100,140,180]),
    frameCount: 8, durationMs: 1040, launchAtMs: 550, launchFrame: 4,
    outletX: 99, outletY: 291, registrationScale: 1, facing: "left", loop: false,
    idleImage: "DesignAssets/Animations/CreatureIdleV3/soil-mole/idle.webp"
  }),
  "lantern-keeper": Object.freeze({
      image: "DesignAssets/Animations/CreatureRangedV1/lantern-keeper/ranged.webp",
      frameSize: 512,
      viewSize: 491.95729537366554,
      columns: 4,
      pivotX: 253.11824237037038,
      pivotY: 433.88154714074074,
      durationsMs: Object.freeze([
          100,
          100,
          120,
          100,
          70,
          110,
          160,
          240
      ]),
      frameCount: 8,
      durationMs: 1000,
      launchAtMs: 420,
      launchFrame: 4,
      outletX: 80,
      outletY: 236,
      registrationScale: 1,
      facing: "left",
      loop: false,
      idleImage: "DesignAssets/Animations/UniqueIdleV4/lantern-keeper/idle.webp"
  }),
  "bubble-toad": Object.freeze({
      image: "DesignAssets/Animations/CreatureRangedV1/bubble-toad/ranged.webp",
      frameSize: 512,
      viewSize: 512.211320754717,
      columns: 4,
      pivotX: 264.1522145736434,
      pivotY: 373.28031330232557,
      durationsMs: Object.freeze([
          100,
          110,
          140,
          110,
          70,
          100,
          150,
          220
      ]),
      frameCount: 8,
      durationMs: 1000,
      launchAtMs: 460,
      launchFrame: 4,
      outletX: 125,
      outletY: 190,
      registrationScale: 1,
      facing: "left",
      loop: false,
      idleImage: "DesignAssets/Animations/BubbleToadIdle/BreathV1/idle.webp"
  }),
  "vine-turtle": Object.freeze({
      image: "DesignAssets/Animations/CreatureRangedV1/vine-turtle/ranged.webp",
      frameSize: 512,
      viewSize: 513.4982332155477,
      columns: 4,
      pivotX: 271.0151515151515,
      pivotY: 435.7066318961039,
      durationsMs: Object.freeze([
          160,
          180,
          240,
          100,
          90,
          160,
          210,
          260
      ]),
      frameCount: 8,
      durationMs: 1400,
      launchAtMs: 680,
      launchFrame: 4,
      outletX: 103,
      outletY: 181,
      registrationScale: 1,
      facing: "left",
      loop: false,
      idleImage: "DesignAssets/Animations/CreatureIdleStudies/V2/vine-turtle/idle.webp"
  })
});
const CREATURE_RANGED_ASSETS = Object.freeze(Object.values(CREATURE_RANGED_ANIMATIONS).map(animation => animation.image));

function creatureRangedPose(agent, time) {
  const animation = CREATURE_RANGED_ANIMATIONS[agent.species], attack = agent.attack;
  if (!animation || !(agent.health > 0) || agent.birth || !Number.isFinite(time) ||
      !attack || !(attack.dnaRanged || attack.mode === "ranged" || attack.attackMode === "ranged") ||
      !Number.isFinite(attack.startedAt) || !Number.isFinite(attack.launchedAt) ||
      !Number.isFinite(attack.endsAt) || attack.launchedAt < attack.startedAt ||
      attack.endsAt < attack.launchedAt || attack.endsAt <= attack.startedAt || time < attack.startedAt) return null;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(attack.startedAt), Math.abs(attack.endsAt)) * 4;
  if (time > attack.endsAt + epsilon) return null;
  const recorded = attack.shotLaunches;
  const launches = Array.isArray(recorded) && recorded.length && recorded[0] === attack.launchedAt &&
    recorded.every((at, index) => Number.isFinite(at) && at <= attack.endsAt + epsilon &&
      (!index || at > recorded[index - 1])) ? recorded : [attack.launchedAt];
  if (time > attack.endsAt && time !== launches.at(-1) ||
      time === attack.endsAt && Math.abs(launches.at(-1) - attack.endsAt) > epsilon) return null;
  const recoveryShare = (animation.durationMs - animation.launchAtMs) / animation.durationMs;
  const startFor = index => index ? launches[index-1] +
    (launches[index] - launches[index-1]) * recoveryShare : attack.startedAt;
  let shotIndex = 0;
  while (shotIndex < launches.length - 1 && time >= startFor(shotIndex + 1)) shotIndex++;
  const start = startFor(shotIndex), launch = launches[shotIndex];
  const end = shotIndex + 1 < launches.length ? startFor(shotIndex + 1) : attack.endsAt;
  let elapsed = time < launch ? animation.launchAtMs * (time-start) / Math.max(.001, launch-start) :
    animation.launchAtMs + (animation.durationMs-animation.launchAtMs) * (time-launch) / Math.max(.001, end-launch);
  if (Math.abs(time-launch) <= epsilon) elapsed = animation.launchAtMs;
  let frame = 0;
  while (frame < animation.frameCount-1 && elapsed >= animation.durationsMs[frame]) elapsed -= animation.durationsMs[frame++];
  return { action: "ranged", animation, frame, shotIndex, launchAt: launch,
    mirrorX: unitFrameMirror(animation.sourceFacing || animation.facing || "left", attack.directionX || agent.facing || 1) };
}

// Offsets are in world cells relative to the same idle-normalized body pivot
// used by the world, detail and laboratory renderers. The journal owns timing.
function creatureRangedOutlet(agent, facing) {
  facing ||= unitFacing(agent);
  const animation = CREATURE_RANGED_ANIMATIONS[agent.species];
  if (!animation) return null;
  const idle = imageAnimation({ image: animation.idleImage, frameSize: 512, viewSize: 512 });
  const bounds = UNIT_IMAGE_BOUNDS[animation.idleImage];
  const length = Math.max(bounds.width, bounds.height) * idle.frameSize / bounds.frameSize;
  const scale = unitDisplaySize(agent) * idle.viewSize /
    ((idle.registrationScale || 1) * length * animation.viewSize);
  return { x: (unitFrameMirror(animation.sourceFacing || animation.facing || "left", facing) ? -1 : 1) * (animation.outletX-animation.pivotX) * scale,
    y: (animation.outletY-animation.pivotY) * scale };
}

return { CREATURE_RANGED_ANIMATIONS, CREATURE_RANGED_ASSETS, creatureRangedPose, creatureRangedOutlet };
})();
modules["client/toad-hop.mjs"] = (() => {
// Approved original-cel v5 hop. All timing is normalized to a server cell move;
// no accumulated animation clock, new artwork, gameplay speed, or hitbox changes.
const TOAD_HOP = Object.freeze({ cycleMs:880, takeoffMs:200, airborneMs:260, apex:.44, height:100 });
const CENTERS = [[127.3,165.7],[128.3,169.2],[121.2,91],[127.9,93.2],[127.9,86.4],[127.5,115],[129.7,173.1],[128.1,168.3]];
function clamp01(value) { return Math.max(0,Math.min(1,value)); }
function smooth(value) { const p=clamp01(value); return p*p*(3-2*p); }
function toadHopMotion(progress) {
  const time=clamp01(progress)*TOAD_HOP.cycleMs;
  const phase=clamp01((time-TOAD_HOP.takeoffMs)/TOAD_HOP.airborneMs);
  let travel,height;
  if(phase<=TOAD_HOP.apex) {
    const u=phase/TOAD_HOP.apex;
    travel=.5*smooth(u); height=TOAD_HOP.height*(1-(1-u)**3);
  } else {
    const u=(phase-TOAD_HOP.apex)/(1-TOAD_HOP.apex);
    travel=.5+.5*smooth(u); height=TOAD_HOP.height*(1-u**3);
  }
  const airborne=time>=200&&time<460;
  const frame=time<110?0:time<200?1:airborne?
    phase<.16?1:phase<.48?3:phase<.56?4:phase<.84?5:6:time<560?6:7;
  let degrees=0;
  if(airborne) {
    if(phase<.25) degrees=40*smooth((phase-.08)/.17);
    else if(phase<.40) degrees=40;
    else if(phase<.60) degrees=40-80*smooth((phase-.40)/.20);
    else if(phase<.74) degrees=-40;
    else degrees=-40*(1-smooth((phase-.74)/.18));
  }
  // Blend the body registration into/out of the airborne pose, so takeoff and
  // landing meet the unmodified grounded cel exactly rather than snapping 3-7px.
  const blend=airborne ? smooth(phase/.16)*(1-smooth((phase-.84)/.16)) : 0;
  const [sourceX,sourceY]=CENTERS[frame], [restX,restY]=CENTERS[0];
  return { frame, travel, phase, height, rotation:degrees*Math.PI/180,
    sourceX,sourceY,targetX:sourceX+(restX-sourceX)*blend,
    targetY:sourceY+(restY-sourceY)*blend-height };
}

return { TOAD_HOP, toadHopMotion };
})();
modules["server/attack.mjs"] = (() => {
const AGENT_ATTACK_FRAME_DURATIONS = Object.freeze([
  .06, .07, .06, .08, .03, .05, .05, .05, .05, .05, .05, .07, .08, .09, .10, .06
]);

const AGENT_HURT_FRAME_DURATIONS = Object.freeze([
  .02, .03, .03, .03, .4, .03, .03, .03, .02, .02, .02, .02, .02, .02, .02, .02
]);
const AGENT_HURT_DURATION = AGENT_HURT_FRAME_DURATIONS.reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;

const AGENT_ATTACK_HIT_FRAME = 5;
const AGENT_ATTACK_HIT_TIME = AGENT_ATTACK_FRAME_DURATIONS.slice(0, AGENT_ATTACK_HIT_FRAME).reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;
const AGENT_ATTACK_DURATION = AGENT_ATTACK_FRAME_DURATIONS.reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;
const AGENT_ATTACK_ASSET = "DesignAssets/Animations/UnitAttack/attack.png";

function attackAnimationSegments(attack, time, hitTime, duration) {
  const contacts = attack.meleeContacts?.length ? attack.meleeContacts : [attack.hitAt];
  const startFor = index => index ? Math.max(contacts[index] - hitTime,
    contacts[index - 1] + (contacts[index] - contacts[index - 1]) * (duration - hitTime) / duration) : attack.startedAt;
  let index = 0;
  while (index < contacts.length - 1 && time >= startFor(index + 1)) index++;
  const contact = contacts[index], start = startFor(index);
  const end = Math.min(attack.endsAt, contact + duration - hitTime,
    index < contacts.length - 1 ? startFor(index + 1) : Infinity);
  return [[start, 0], [contact, hitTime], [end, hitTime + Math.max(0, end - contact)]];
}

function attackAnimationElapsed(attack, time, hitTime, duration) {
  const elapsed = time - attack.startedAt;
  if (Number.isFinite(attack.recovery)) {
    const [[start], [contact]] = attackAnimationSegments(attack, time, hitTime, duration);
    if (time < contact) return Math.max(0, (time - start) / Math.max(1e-9, contact - start) * hitTime);
    return Math.min(duration, hitTime + time - contact);
  }

  // DNA melee follow-ups move hitAt forward without beginning a new action.
  // Keep the contact already reached, then finish recovery and prepare the next
  // swing using only the server's recorded contacts, not current unit stats.
  const contacts = attack.meleeContacts;
  if (attack.combatId && !attack.exchange && Array.isArray(contacts) && contacts.length &&
      Number.isFinite(attack.startedAt) && Number.isFinite(attack.endsAt) && attack.endsAt >= attack.hitAt &&
      hitTime > 0 && duration > hitTime &&
      contacts.at(-1) === attack.hitAt && contacts[0] > attack.startedAt &&
      contacts.every((at, index) => Number.isFinite(at) && (!index || at > contacts[index - 1]))) {
    if (time > attack.endsAt || time === attack.endsAt && attack.endsAt > attack.hitAt) return duration;
    const recoveryShare = (duration - hitTime) / duration;
    const startFor = index => index ? contacts[index - 1] +
      (contacts[index] - contacts[index - 1]) * recoveryShare : attack.startedAt;
    let swing = 0;
    while (swing < contacts.length - 1 && time >= startFor(swing + 1)) swing++;
    const start = startFor(swing), hit = contacts[swing];
    const end = swing + 1 < contacts.length ? startFor(swing + 1) : attack.endsAt;
    return time <= hit ? (time - start) / (hit - start) * hitTime :
      hitTime + Math.min(1, (time - hit) / (end - hit)) * (duration - hitTime);
  }
  if (!attack.combatId || attack.exchange || !Number.isFinite(attack.hitAt) || !Number.isFinite(attack.endsAt) ||
      !(attack.hitAt > attack.startedAt) || !(attack.endsAt > attack.hitAt)) return elapsed * (attack.speed || 1);
  if (time >= attack.endsAt) return duration;
  if (time <= attack.hitAt) return elapsed / (attack.hitAt - attack.startedAt) * hitTime;
  return hitTime + Math.min(1, (time - attack.hitAt) / (attack.endsAt - attack.hitAt)) * (duration - hitTime);
}

function agentAttackFrame(attack, time) {
  if (!attack) return -1;
  const elapsed = attackAnimationElapsed(attack, time, AGENT_ATTACK_HIT_TIME, AGENT_ATTACK_DURATION);
  if (elapsed < 0 || elapsed + 1e-8 >= AGENT_ATTACK_DURATION) return -1;
  let end = 0;
  for (let index = 0; index < AGENT_ATTACK_FRAME_DURATIONS.length; index++) {
    end += AGENT_ATTACK_FRAME_DURATIONS[index];
    if (elapsed + 1e-8 < end) return index;
  }
  return -1;
}

return { AGENT_ATTACK_FRAME_DURATIONS, AGENT_HURT_FRAME_DURATIONS, AGENT_HURT_DURATION, AGENT_ATTACK_HIT_FRAME, AGENT_ATTACK_HIT_TIME, AGENT_ATTACK_DURATION, AGENT_ATTACK_ASSET, attackAnimationSegments, attackAnimationElapsed, agentAttackFrame };
})();
modules["server/creature-attack.mjs"] = (() => {
const CREATURE_ATTACK_TIMINGS = Object.freeze({
  "flower-tail-bird": Object.freeze({ durationMs: 970, hitTimeMs: 360 }),
  "dew-rabbit": Object.freeze({ durationMs: 970, hitTimeMs: 360 }),
  "soil-mole": Object.freeze({ durationMs: 1000, hitTimeMs: 370 }),
  "bundle-snail": Object.freeze({ durationMs: 1065, hitTimeMs: 395 }),
  "cotton-sheep": Object.freeze({ durationMs: 1030, hitTimeMs: 370 }),
  "rolling-acorn": Object.freeze({ durationMs: 1020, hitTimeMs: 380 }),
  "soil-boar": Object.freeze({ durationMs: 1020, hitTimeMs: 330 }),
  "bubble-toad": Object.freeze({ durationMs: 1020, hitTimeMs: 330 }),
  "vine-turtle": Object.freeze({ durationMs: 1020, hitTimeMs: 330 }),
  "shadow-weasel": Object.freeze({ durationMs: 1020, hitTimeMs: 330 }),
  "snare-vine": Object.freeze({ durationMs: 1020, hitTimeMs: 330 }),
  "talon-owl": Object.freeze({ durationMs: 1020, hitTimeMs: 330 }),
  "spring-keeper": Object.freeze({ durationMs: 905, hitTimeMs: 295 }),
  "lantern-keeper": Object.freeze({ durationMs: 1000, hitTimeMs: 330 }),
  "old-garden-snail": Object.freeze({ durationMs: 1570, hitTimeMs: 590 }),
  "walking-forest": Object.freeze({ durationMs: 1460, hitTimeMs: 560 }),
  "white-paw": Object.freeze({ durationMs: 920, hitTimeMs: 300 }),
  "spiny-back-leader": Object.freeze({ durationMs: 1440, hitTimeMs: 530 })
});

return { CREATURE_ATTACK_TIMINGS };
})();
modules["server/neutral-unit-stats.mjs"] = (() => {
const NEUTRAL_UNIT_STATS = Object.freeze(Object.fromEntries([
  ["flower-tail-bird",{"health":30,"power":9.6,"armor":0,"speed":1,"movement":0.95,"vision":7.53,"combo":0.15,"comboPower":45,"critical":3,"criticalPower":150,"accuracy":7,"penetration":0,"comboSpeed":0.34,"focus":0.34,"evasion":12,"parry":4,"block":0,"blockPower":50,"counter":0,"counterPower":105,"tenacity":0,"reduction":0,"stun":0,"stunTime":0.2,"bleed":0,"bleedPower":0,"area":0,"areaPower":0,"lifesteal":0,"reflection":0,"regeneration":0.9,"capacity":1,"harvestSpeed":1.9}],
  ["dew-rabbit",{"health":44,"power":9.3,"armor":1,"speed":0.88,"movement":1.01,"vision":6.52,"combo":0.1,"comboPower":45,"critical":3,"criticalPower":150,"accuracy":4,"penetration":0,"comboSpeed":0.4,"focus":0.36,"evasion":11,"parry":4,"block":0,"blockPower":50,"counter":0,"counterPower":102.5,"tenacity":2,"reduction":0,"stun":0,"stunTime":0.22,"bleed":0,"bleedPower":0,"area":0,"areaPower":0,"lifesteal":0,"reflection":0,"regeneration":1,"capacity":2,"harvestSpeed":1.84}],
  ["soil-mole",{"health":100,"power":16,"armor":10,"speed":0.68,"movement":0.65,"vision":2,"combo":0,"comboPower":50,"critical":5,"criticalPower":155,"accuracy":5,"penetration":3,"comboSpeed":0.5,"focus":0.38,"evasion":4,"parry":3,"block":5,"blockPower":50,"counter":1,"counterPower":117.5,"tenacity":18,"reduction":2,"stun":2,"stunTime":0.36,"bleed":2,"bleedPower":1,"area":0,"areaPower":0,"lifesteal":0,"reflection":0,"regeneration":0.8,"capacity":9,"harvestSpeed":1.81}],
  ["bundle-snail",{"health":135,"power":10.5,"armor":30,"speed":0.52,"movement":0.55,"vision":3.29,"combo":0,"comboPower":40,"critical":0,"criticalPower":150,"accuracy":0,"penetration":0,"comboSpeed":0.58,"focus":0.54,"evasion":1,"parry":0,"block":12,"blockPower":50,"counter":0,"counterPower":115,"tenacity":22,"reduction":5,"stun":0,"stunTime":0.26,"bleed":0,"bleedPower":0,"area":0,"areaPower":0,"lifesteal":0,"reflection":1,"regeneration":1.4,"capacity":17,"harvestSpeed":1.31}],
  ["cotton-sheep",{"health":120,"power":9,"armor":5,"speed":0.6,"movement":0.69,"vision":5.69,"combo":0,"comboPower":40,"critical":0,"criticalPower":150,"accuracy":1,"penetration":0,"comboSpeed":0.56,"focus":0.46,"evasion":5,"parry":0,"block":2,"blockPower":50,"counter":0,"counterPower":100,"tenacity":16,"reduction":4,"stun":0,"stunTime":0.24,"bleed":0,"bleedPower":0,"area":0,"areaPower":0,"lifesteal":0,"reflection":0,"regeneration":1.2,"capacity":12,"harvestSpeed":1.74}],
  ["rolling-acorn",{"health":55,"power":10,"armor":20,"speed":0.76,"movement":0.81,"vision":2.79,"combo":0,"comboPower":45,"critical":2,"criticalPower":155,"accuracy":0,"penetration":1,"comboSpeed":0.46,"focus":0.56,"evasion":8,"parry":2,"block":8,"blockPower":50,"counter":0,"counterPower":112.5,"tenacity":6,"reduction":0,"stun":1,"stunTime":0.28,"bleed":0,"bleedPower":0,"area":0,"areaPower":0,"lifesteal":0,"reflection":0,"regeneration":0.1,"capacity":6,"harvestSpeed":1.67}],
  ["bubble-toad",{"health":125,"power":17,"armor":8,"speed":0.8,"movement":0.77,"vision":5.1,"combo":0,"comboPower":45,"critical":4,"criticalPower":155,"accuracy":3,"penetration":2,"comboSpeed":0.44,"focus":0.44,"evasion":9,"parry":2,"block":2,"blockPower":50,"counter":2,"counterPower":120,"tenacity":14,"reduction":1,"stun":6,"stunTime":0.56,"bleed":0,"bleedPower":0,"area":1,"areaPower":25,"lifesteal":0,"reflection":0,"regeneration":1.1,"capacity":8,"harvestSpeed":1.55}],
  ["snare-vine",{"health":155,"power":24,"armor":18,"speed":0.56,"movement":0.3,"vision":6.25,"combo":0,"comboPower":50,"critical":7,"criticalPower":165,"accuracy":6,"penetration":5,"comboSpeed":0.54,"focus":0.32,"evasion":2,"parry":0,"block":4,"blockPower":50,"counter":3,"counterPower":127.5,"tenacity":20,"reduction":1,"stun":0,"stunTime":0.54,"bleed":4,"bleedPower":2,"area":1,"areaPower":20,"lifesteal":5,"reflection":3,"regeneration":1.8,"capacity":13,"harvestSpeed":1.36}],
  ["spiny-back-beetle",{"health":130,"power":18,"armor":25,"speed":0.72,"movement":0.73,"vision":3.71,"combo":0,"comboPower":50,"critical":5,"criticalPower":160,"accuracy":4,"penetration":6,"comboSpeed":0.48,"focus":0.4,"evasion":6,"parry":8,"block":10,"blockPower":50,"counter":12,"counterPower":137.5,"tenacity":26,"reduction":3,"stun":1,"stunTime":0.34,"bleed":3,"bleedPower":1,"area":0,"areaPower":0,"lifesteal":0,"reflection":8,"regeneration":0.2,"capacity":11,"harvestSpeed":1.51}],
  ["soil-boar",{"health":180,"power":31,"armor":22,"speed":0.64,"movement":0.85,"vision":4.45,"combo":0,"comboPower":61,"critical":10,"criticalPower":170,"accuracy":3,"penetration":4,"comboSpeed":0.52,"focus":0.42,"evasion":3,"parry":3,"block":6,"blockPower":50,"counter":4,"counterPower":135,"tenacity":28,"reduction":3,"stun":8,"stunTime":0.4,"bleed":2,"bleedPower":2,"area":1,"areaPower":30,"lifesteal":0,"reflection":0,"regeneration":0.5,"capacity":14,"harvestSpeed":1.42}],
  ["vine-turtle",{"health":295,"power":19,"armor":38,"speed":0.48,"movement":0.6,"vision":4.09,"combo":0,"comboPower":40,"critical":1,"criticalPower":160,"accuracy":2,"penetration":3,"comboSpeed":0.6,"focus":0.48,"evasion":1,"parry":1,"block":24,"blockPower":50,"counter":6,"counterPower":130,"tenacity":30,"reduction":8,"stun":4,"stunTime":0.42,"bleed":0,"bleedPower":1,"area":1,"areaPower":25,"lifesteal":0,"reflection":6,"regeneration":1.5,"capacity":16,"harvestSpeed":1.16}],
  ["shadow-weasel",{"health":88,"power":41,"armor":3,"speed":1.12,"movement":1.07,"vision":6.78,"combo":1,"comboPower":63,"critical":14,"criticalPower":165,"accuracy":9,"penetration":10,"comboSpeed":0.3,"focus":0.24,"evasion":13,"parry":9,"block":0,"blockPower":50,"counter":10,"counterPower":125,"tenacity":8,"reduction":0,"stun":0,"stunTime":0.32,"bleed":8,"bleedPower":3,"area":0,"areaPower":0,"lifesteal":3,"reflection":0,"regeneration":0.7,"capacity":7,"harvestSpeed":1.71}],
  ["talon-owl",{"health":85,"power":59,"armor":2,"speed":0.96,"movement":0.92,"vision":8,"combo":0.9,"comboPower":55,"critical":12,"criticalPower":170,"accuracy":14,"penetration":8,"comboSpeed":0.36,"focus":0.3,"evasion":10,"parry":7,"block":0,"blockPower":50,"counter":5,"counterPower":122.5,"tenacity":4,"reduction":0,"stun":0,"stunTime":0.3,"bleed":6,"bleedPower":2,"area":0,"areaPower":0,"lifesteal":2,"reflection":0,"regeneration":0.4,"capacity":3,"harvestSpeed":1.59}],
  ["spring-keeper",{"health":177,"power":30.4,"armor":14,"speed":1.07,"movement":0.98,"vision":7.76,"combo":0.95,"comboPower":60,"critical":6,"criticalPower":150,"accuracy":11.5,"penetration":2,"comboSpeed":0.32,"focus":0.21,"evasion":17.5,"parry":6,"block":1,"blockPower":50,"counter":1,"counterPower":110,"tenacity":10,"reduction":0,"stun":0,"stunTime":0.38,"bleed":1,"bleedPower":0,"area":0,"areaPower":0,"lifesteal":0,"reflection":0,"regeneration":1.3,"capacity":4,"harvestSpeed":1.87}],
  ["lantern-keeper",{"health":178,"power":29.9,"armor":15,"speed":0.92,"movement":1.04,"vision":7.03,"combo":0.65,"comboPower":54,"critical":4,"criticalPower":150,"accuracy":8,"penetration":0,"comboSpeed":0.38,"focus":0.26,"evasion":15.5,"parry":5,"block":1,"blockPower":50,"counter":0,"counterPower":107.5,"tenacity":12,"reduction":0,"stun":0,"stunTime":0.44,"bleed":0,"bleedPower":0,"area":0,"areaPower":0,"lifesteal":0,"reflection":0,"regeneration":1.6,"capacity":5,"harvestSpeed":1.77}],
  ["old-garden-snail",{"health":420,"power":30.5,"armor":48,"speed":0.44,"movement":0.42,"vision":4.78,"combo":0,"comboPower":40,"critical":1,"criticalPower":160,"accuracy":1,"penetration":1,"comboSpeed":0.62,"focus":0.52,"evasion":0,"parry":0,"block":16,"blockPower":50,"counter":0,"counterPower":132.5,"tenacity":32,"reduction":10,"stun":2,"stunTime":0.46,"bleed":0,"bleedPower":0,"area":1,"areaPower":0,"lifesteal":0,"reflection":2,"regeneration":1.7,"capacity":19,"harvestSpeed":1.24}],
  ["walking-forest",{"health":850,"power":68,"armor":55,"speed":0.4,"movement":0.49,"vision":5.98,"combo":0,"comboPower":40,"critical":2,"criticalPower":175,"accuracy":2,"penetration":4,"comboSpeed":0.64,"focus":0.5,"evasion":0,"parry":1,"block":20,"blockPower":50,"counter":2,"counterPower":142.5,"tenacity":36,"reduction":12,"stun":10,"stunTime":0.52,"bleed":1,"bleedPower":1,"area":2,"areaPower":35,"lifesteal":0,"reflection":4,"regeneration":1.9,"capacity":18,"harvestSpeed":1}],
  ["white-paw",{"health":255,"power":75,"armor":16,"speed":1.08,"movement":1.1,"vision":7.28,"combo":1,"comboPower":65,"critical":16,"criticalPower":185,"accuracy":12,"penetration":12,"comboSpeed":0.28,"focus":0.2,"evasion":18,"parry":12,"block":3,"blockPower":50,"counter":8,"counterPower":140,"tenacity":24,"reduction":2,"stun":3,"stunTime":0.48,"bleed":10,"bleedPower":4,"area":0,"areaPower":20,"lifesteal":4,"reflection":0,"regeneration":0.6,"capacity":10,"harvestSpeed":1.63}],
  ["spiny-back-leader",{"health":310,"power":60,"armor":40,"speed":0.84,"movement":0.88,"vision":5.4,"combo":0.05,"comboPower":62,"critical":8,"criticalPower":180,"accuracy":5,"penetration":7,"comboSpeed":0.42,"focus":0.28,"evasion":7,"parry":10,"block":14,"blockPower":50,"counter":15,"counterPower":145,"tenacity":34,"reduction":6,"stun":5,"stunTime":0.5,"bleed":5,"bleedPower":3,"area":1,"areaPower":30,"lifesteal":0,"reflection":10,"regeneration":0.3,"capacity":15,"harvestSpeed":1.47}]
].map(([key, stats]) => [key, Object.freeze(stats)])));

return { NEUTRAL_UNIT_STATS };
})();
modules["server/creature-movement-profiles.mjs"] = (() => {
const { NEUTRAL_UNIT_STATS } = modules["server/neutral-unit-stats.mjs"];
const CREATURE_MOVEMENT_PROFILES = Object.freeze(Object.fromEntries([
  ["flower-tail-bird", 2, 3],
  ["dew-rabbit", 2.6, 2.5],
  ["soil-mole", .8, 5],
  ["bundle-snail", .4, 6],
  ["cotton-sheep", .8, 4],
  ["rolling-acorn", 1.8, 6],
  ["bubble-toad", .8, 20],
  ["snare-vine", 1.4, 30],
  ["spiny-back-beetle", 1.2, 18],
  ["soil-boar", 1.6, 24],
  ["vine-turtle", .4, 30],
  ["shadow-weasel", 2.6, 30],
  ["talon-owl", 2, 40],
  ["spring-keeper", 1.6, 30],
  ["lantern-keeper", 2.8, 30],
  ["old-garden-snail", .3, 45],
  ["walking-forest", .3, 60],
  ["white-paw", 3.2, 90],
  ["spiny-back-leader", 1.4, 120]
].map(([species, speed, restSeconds]) => [species, Object.freeze({ speed: NEUTRAL_UNIT_STATS[species]?.movement ?? speed, restSeconds })])));

return { CREATURE_MOVEMENT_PROFILES };
})();
modules["client/unit-animation.mjs"] = (() => {
const { unitFrameMirror } = modules["client/unit-size.mjs"];
const { APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS, APPROVED_COTTON_SHEEP_WALK_ANIMATION } = modules["client/creature-approved-actions.mjs"];
const { APPROVED_CREATURE_WALK_ANIMATIONS, APPROVED_CREATURE_DEATH_ANIMATIONS } = modules["client/creature-approved-animations.mjs"];
const { CREATURE_RANGED_ANIMATIONS, CREATURE_RANGED_ASSETS, creatureRangedPose } = modules["client/creature-ranged.mjs"];
const { unitDisplayAttributes } = modules["client/unit-display-appearance.mjs"];
const { toadHopMotion } = modules["client/toad-hop.mjs"];
const { attackAnimationElapsed, AGENT_ATTACK_HIT_TIME } = modules["server/attack.mjs"];
const { CREATURE_ATTACK_TIMINGS } = modules["server/creature-attack.mjs"];
const { imageAnimation } = modules["client/image-geometry.mjs"];
const { CREATURE_MOVEMENT_PROFILES } = modules["server/creature-movement-profiles.mjs"];

const UNIT_ANIMATIONS = Object.freeze({
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

const CREATURE_IDLE_ANIMATIONS = Object.freeze({
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

const CREATURE_WALK_ANIMATIONS = Object.freeze({
  "flower-tail-bird": {"image":"DesignAssets/Animations/CreatureWalkV2/flower-tail-bird/walk.webp","frameSize":388,"columns":4,"durationsMs":[80,80,80,90,90,80,80,87],"loop":true,"pivotX":194,"pivotY":357.0086206896552,"cyclesPerCell":3},
  "dew-rabbit": {"image":"DesignAssets/Animations/CreatureWalkV2/dew-rabbit/walk.webp","frameSize":433,"viewSize":417,"columns":4,"durationsMs":[100,80,100,180,100,100,150,190],"loop":true,"pivotX":216.5,"pivotY":442.9627192982456,"cyclesPerCell":2},
  "soil-mole": { ...APPROVED_CREATURE_WALK_ANIMATIONS["soil-mole"] },
  "bundle-snail": {"image":"DesignAssets/Animations/CreatureWalkV2/bundle-snail/walk.webp","frameSize":398,"columns":4,"durationsMs":[200,250,250,250,300,250,250,250],"loop":true,"pivotX":199,"pivotY":348.25,"cyclesPerCell":1},
  "cotton-sheep": { ...APPROVED_COTTON_SHEEP_WALK_ANIMATION },
  "rolling-acorn": {"image":"DesignAssets/Animations/CreatureWalkV2/rolling-acorn/walk.webp","frameSize":420,"columns":8,"durationsMs":[78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78,78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78,78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78,78,78,78,78,79,78,78,78,78,78,78,79,78,78,78,78],"loop":true,"pivotX":210,"pivotY":349.453125,"cyclesPerCell":0.4},
  "soil-boar": {"image":"DesignAssets/Animations/CreatureWalkApprovedV3/soil-boar/walk.webp","frameSize":640,"viewSize":506.85283,"columns":8,"durationsMs":Array(64).fill(4.8828125),"loop":true,"pivotX":326.154716,"pivotY":425.490566,"cyclesPerCell":2,"registrationScale":1},
  "bubble-toad": {"image":"DesignAssets/Animations/CreatureWalkV2/bubble-toad/walk.webp","frameSize":288,"viewSize":256,"columns":8,"durationsMs":[110,120,80,110,130,90,90,150],"loop":true,"pivotX":145.5,"pivotY":222.26,"cyclesPerCell":2},
  "vine-turtle": {"image":"DesignAssets/Animations/CreatureWalkV2/vine-turtle/walk.webp","frameSize":256,"viewSize":256,"columns":8,"durationsMs":[170,130,120,140,170,130,120,140],"loop":true,"pivotX":131.25,"pivotY":220.81,"cyclesPerCell":1.5},
  "shadow-weasel": { ...APPROVED_CREATURE_WALK_ANIMATIONS["shadow-weasel"] },
  "snare-vine": {"image":"DesignAssets/Animations/CreatureWalkV2/snare-vine/walk.webp","frameSize":256,"viewSize":256,"columns":6,"durationsMs":[180,140,140,160,140,180],"loop":true,"pivotX":127.75,"pivotY":235.08,"cyclesPerCell":1.5},
  "talon-owl": {"image":"DesignAssets/Animations/CreatureWalkV2/talon-owl/walk.webp","frameSize":432,"viewSize":256,"columns":8,"durationsMs":[70,80,80,85,80,70,70,65],"loop":true,"pivotX":205,"pivotY":288,"cyclesPerCell":3},
  "spring-keeper": {"image":"DesignAssets/Animations/CreatureWalkV2/spring-keeper/walk.webp","frameSize":512,"viewSize":384,"columns":4,"durationsMs":[60,60,80,120,80,80,80,80,80,80,80,80,80,80,80,80],"loop":true,"pivotX":221.5,"pivotY":371.5,"cyclesPerCell":3,"takeoffDurationMs":320,"flightDurationMs":640,"landingDurationMs":320},
  "lantern-keeper": {"image":"DesignAssets/Animations/CreatureWalkV2/lantern-keeper/walk.webp","frameSize":384,"columns":6,"durationsMs":[140,100,140,100,120,140],"loop":true,"pivotX":203.25,"pivotY":324.75,"cyclesPerCell":2},
  "old-garden-snail": {"image":"DesignAssets/Animations/CreatureWalkV2/old-garden-snail/walk.webp","frameSize":352,"columns":6,"durationsMs":[220,220,260,220,220,260],"loop":true,"pivotX":180.8125,"pivotY":304.5625,"cyclesPerCell":1},
  "walking-forest": { ...APPROVED_CREATURE_WALK_ANIMATIONS["walking-forest"] },
  "white-paw": { ...APPROVED_CREATURE_WALK_ANIMATIONS["white-paw"] },
  "spiny-back-leader": {"image":"DesignAssets/Animations/CreatureWalkV2/spiny-back-leader/walk.webp","frameSize":256,"columns":6,"durationsMs":[110,100,100,110,100,100],"loop":true,"pivotX":128,"pivotY":224,"cyclesPerCell":2.5}
});

const CREATURE_ATTACK_ANIMATIONS = Object.freeze({
  "spring-keeper": {"image":"DesignAssets/Animations/CreatureAttackV2/spring-keeper/runtime.webp","frameSize":269,"viewSize":274.07547169811323,"columns":4,"pivotX":101.66804245283019,"pivotY":235.25604363207546,"durationsMs":[70,90,100,35,240,100,140,130],"loop":false,"facing":"left","impactFrame":4},
  "lantern-keeper": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["lantern-keeper"] },
  "white-paw": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["white-paw"] },
  "old-garden-snail": {"image":"DesignAssets/Animations/CreatureAttackV2/old-garden-snail/runtime.webp","frameSize":264,"viewSize":239.34065934065933,"columns":4,"pivotX":133.57237293956044,"pivotY":230.11323832417582,"durationsMs":[110,180,220,80,300,220,260,200],"loop":false,"facing":"left","impactFrame":4},
  "cotton-sheep": {"image":"DesignAssets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp","frameSize":290,"viewSize":256.7708333333333,"columns":4,"pivotX":145.43660481770834,"pivotY":249.0771484375,"durationsMs":[100,110,120,40,240,90,140,190],"loop":false,"facing":"left","impactFrame":4},
  "walking-forest": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["walking-forest"] },
  "spiny-back-leader": {"image":"DesignAssets/Animations/CreatureAttackV2/spiny-back-leader/runtime.webp","frameSize":512,"viewSize":418.9090909090909,"columns":4,"pivotX":255.99999999999997,"pivotY":449.5454545454545,"durationsMs":[90,170,220,50,340,180,220,170],"loop":false,"facing":"left","impactFrame":4},
  "vine-turtle": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["vine-turtle"] },
  "shadow-weasel": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["shadow-weasel"] },
  "snare-vine": {"image":"DesignAssets/Animations/CreatureAttackV2/snare-vine/runtime.webp","frameSize":283,"viewSize":283.21875,"columns":6,"pivotX":141.23318481445312,"pivotY":259.8811083984375,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
  "rolling-acorn": {"image":"DesignAssets/Animations/CreatureAttackV2/rolling-acorn/runtime.webp","frameSize":312,"viewSize":281.2599381625442,"columns":4,"pivotX":157.38239840989397,"pivotY":270.69152788896866,"durationsMs":[100,110,130,40,220,90,140,190],"loop":false,"facing":"left","impactFrame":4},
  "bubble-toad": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["bubble-toad"] },
  "soil-boar": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["soil-boar"] },
  "flower-tail-bird": {"image":"DesignAssets/Animations/CreatureAttackV2/flower-tail-bird/runtime.webp","frameSize":283,"viewSize":276.77600235849053,"columns":4,"pivotX":138.03967423349056,"pivotY":259.49940300707544,"durationsMs":[100,110,110,40,220,80,130,180],"loop":false,"facing":"left","impactFrame":4},
  "dew-rabbit": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["dew-rabbit"] },
  "soil-mole": { ...APPROVED_REAR_SUPPORT_ATTACK_ANIMATIONS["soil-mole"] },
  "bundle-snail": {"image":"DesignAssets/Animations/CreatureAttackV2/bundle-snail/runtime.webp","frameSize":293,"viewSize":266.3926816475265,"columns":4,"pivotX":146.9266715437279,"pivotY":270.04213884441253,"durationsMs":[100,130,120,45,220,100,140,210],"loop":false,"facing":"left","impactFrame":4},
  "talon-owl": {"image":"DesignAssets/Animations/CreatureAttackV2/talon-owl/runtime.webp","frameSize":288,"viewSize":288.1672862453532,"columns":6,"pivotX":131.6345405436803,"pivotY":225.24361059479554,"durationsMs":[70,210,50,300,170,220],"loop":false,"facing":"left","impactFrame":3},
});

const CREATURE_HURT_ANIMATIONS = Object.freeze({
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

const CREATURE_DEATH_ANIMATIONS = Object.freeze({
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
  "bubble-toad": { ...APPROVED_CREATURE_DEATH_ANIMATIONS["bubble-toad"] },
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

const UNIT_ANIMATION_ASSETS = Object.freeze([...new Set([
  ...CREATURE_RANGED_ASSETS,
  ...Object.values(UNIT_ANIMATIONS).flatMap(animations => Object.values(animations).map(animation => animation.image)),
  ...[...Object.values(CREATURE_IDLE_ANIMATIONS), ...Object.values(CREATURE_ATTACK_ANIMATIONS), ...Object.values(CREATURE_HURT_ANIMATIONS), ...Object.values(CREATURE_DEATH_ANIMATIONS)].map(animation => animation.image),
  ...Object.values(CREATURE_WALK_ANIMATIONS).map(animation => animation.image)
])]);

function unitAnimationFrame(animation, elapsedMs) {
  let elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : animation.durationMs;
  if (animation.loop) elapsed %= animation.durationMs;
  for (let frame = 0; frame < animation.frameCount; frame++) {
    if (elapsed + 1e-6 < animation.durationsMs[frame]) return frame;
    elapsed -= animation.durationsMs[frame];
  }
  return animation.frameCount - 1;
}

function creatureAttackPose(agent, time) {
  if (CREATURE_RANGED_ANIMATIONS[agent.species] && (agent.attack?.dnaRanged || agent.attack?.mode === "ranged" || agent.attack?.attackMode === "ranged")) return creatureRangedPose(agent, time);
  const animation = CREATURE_ATTACK_ANIMATIONS[agent.species], attack = agent.attack;
  if (!animation || !attack || agent.health <= 0 || !Number.isFinite(attack.startedAt)) return null;
  const timing = CREATURE_ATTACK_TIMINGS[agent.species];
  let elapsed = attackAnimationElapsed(attack, time, timing.hitTimeMs / 1000, timing.durationMs / 1000) * 1000;
  if (Number.isFinite(animation.hitTimeMs) && (animation.hitTimeMs !== timing.hitTimeMs || animation.durationMs !== timing.durationMs)) {
    elapsed = elapsed <= timing.hitTimeMs ? elapsed / timing.hitTimeMs * animation.hitTimeMs :
      animation.hitTimeMs + (elapsed - timing.hitTimeMs) / (timing.durationMs - timing.hitTimeMs) * (animation.durationMs - animation.hitTimeMs);
  }
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed + 1e-6 >= animation.durationMs) return null;
  const direction = attack.directionX || agent.facing || 1;
  return { action: "attack", animation, frame: unitAnimationFrame(animation, elapsed), mirrorX: unitFrameMirror(animation.sourceFacing || animation.facing || "left", direction) };
}

function creatureHurtPose(agent, time) {
  const animation = CREATURE_HURT_ANIMATIONS[agent.species];
  if (!animation || agent.health <= 0 || !Number.isFinite(agent.hurtStartedAt)) return null;
  if (agent.combat?.version === 2 && creatureAttackPose(agent, time)) return null;
  const elapsed = (time - agent.hurtStartedAt) * 1000 * (agent.combat?.version === 2 ? animation.durationMs / 120 : 1);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed + 1e-6 >= animation.durationMs) return null;
  return { action: "hurt", animation, frame: unitAnimationFrame(animation, elapsed) };
}

function unitMovementElapsedMs(agent, time) {
  const start = agent.combat?.position?.moving ? agent.combat.position.moveStartedAt : Number.isFinite(agent.moveAnimationStartedAt) ? agent.moveAnimationStartedAt : agent.moveStartedAt;
  return Number.isFinite(time) && Number.isFinite(start) ? Math.max(0, time - start) * 1000 : 0;
}

function unitAnimationPose(agent, time) {
  if (agent.species || agent.birth || agent.health <= 0) return null;
  const animations = UNIT_ANIMATIONS[agent.tribe || "bean"];
  if (!animations) return null;
  let action = "idle", elapsed = (time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) * 1000;
  const rpg = agent.combat?.version === 2;
  const hurt = (time - agent.hurtStartedAt) * 1000 * (rpg ? animations.hurt.durationMs / 120 : 1);
  const attack = agent.attack ? attackAnimationElapsed(agent.attack, time, AGENT_ATTACK_HIT_TIME, animations.attack.durationMs / 1000) * 1000 : -1;
  const moving = agent.combat?.position?.moving || agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration;
  if (rpg && attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (hurt >= 0 && hurt < animations.hurt.durationMs) { action = "hurt"; elapsed = hurt; }
  else if (attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (agent.mode === "unload" && agent.foodDelivery) { action = "throw"; elapsed = (time - agent.foodDelivery.startedAt) * 1000; }
  else if (agent.mode === "harvest") { action = "harvest"; elapsed = (time - agent.harvestStarted) * 1000; }
  else if (agent.mode === "jump") { action = "jump"; elapsed = (time - (agent.jumpStartedAt ?? agent.moveStartedAt)) * 1000; }
  else if (moving) {
    action = "walk";
    elapsed = unitMovementElapsedMs(agent, time);
  }
  const attributes = unitDisplayAttributes(agent);
  let animation = animations[action] || ((agent.tribe || "bean") !== "bean" && ["harvest", "throw"].includes(action) &&
      ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) ? animations.idle : null);
  if (action === "attack" && agent.tribe === "spring" && !Object.values(attributes).some(value => value > 0) &&
      !agent.attack?.dnaRanged && agent.attack?.mode !== "ranged" && agent.attack?.attackMode !== "ranged") animation = SPRING_BASIC_ATTACK_ANIMATION;
  return animation ? { action, animation, frame: unitAnimationFrame(animation, elapsed) } : null;
}

function creatureWalkPose(agent, time) {
  const animation = CREATURE_WALK_ANIMATIONS[agent.species];
  if (animation && agent.health > 0 && agent.combat?.position?.moving) {
    const elapsed = (time - agent.combat.position.moveStartedAt) * 1000;
    return { action: "walk", animation, frame: unitAnimationFrame(animation, elapsed) };
  }
  const elapsed = time - agent.moveStartedAt;
  if (!animation || agent.health <= 0 || agent.mode !== "walk" ||
    !(agent.moveDuration > 0) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= agent.moveDuration) return null;
  if (agent.species === "spring-keeper") return springKeeperFlightPose(agent, time);
  if (agent.species === "bubble-toad") {
    const hop=toadHopMotion(elapsed / agent.moveDuration);
    return { animation, frame:hop.frame, hop };
  }
  if (Number.isFinite(animation.temporalCadenceHz)) {
    const startedAt = Number.isFinite(agent.animationStartedAt) ? agent.animationStartedAt : agent.moveStartedAt;
    return { animation, frame: unitAnimationFrame(animation, (time - startedAt) * 1000) };
  }
  const progress = Math.max(0, (agent.stepCount || 1) - 1) + elapsed / agent.moveDuration;
  return { animation, frame: unitAnimationFrame(animation, progress * (animation.cyclesPerCell || 1) * animation.durationMs) };
}

function creatureAnimationSpeed(species) {
  return CREATURE_MOVEMENT_PROFILES[species]?.speed || 1;
}

function unitMovementPosition(agent, time, reducedMotion = false) {
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

function springKeeperFlightPose(agent, time) {
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

return { UNIT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, CREATURE_WALK_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, CREATURE_HURT_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, UNIT_ANIMATION_ASSETS, unitAnimationFrame, creatureAttackPose, creatureHurtPose, unitMovementElapsedMs, unitAnimationPose, creatureWalkPose, creatureAnimationSpeed, unitMovementPosition, springKeeperFlightPose };
})();
modules["client/unit-appearance-state.mjs"] = (() => {
const { attackAnimationElapsed, attackAnimationSegments } = modules["server/attack.mjs"];
const { UNIT_ANIMATIONS, unitMovementElapsedMs } = modules["client/unit-animation.mjs"];
const { unitAppearanceForAgent, unitAppearancePose } = modules["client/unit-appearance.mjs"];

const finite = (...values) => values.find(Number.isFinite);
const durationOf = clip => clip?.durationsMs?.reduce((sum,value)=>sum+value,0);
const interpolate = (value,a,b,c,d) => a===b?d:c+(value-a)/(b-a)*(d-c);

// These clocks describe simulation time, not wall-clock render frames.
function unitActionState(agent, time, options = {}) {
  if (!agent || !Number.isFinite(time)) return null;
  const clips=options.animations||UNIT_ANIMATIONS[agent.tribe||'bean']||{};
  const duration=action=>durationOf(clips[action])||({death:1820,birth:2500,hurt:760,attack:1010,ranged:600,throw:450,harvest:1000,walk:1120,carry:1120,jump:1120,idle:6400}[action]);
  function state(action,startedAt,segments,details={}) {
    const ms=duration(action),clock=segments||[[startedAt,0],[startedAt+ms/1000,ms]];
    let segment=clock.length-2;
    for(let i=0;i<clock.length-1;i++)if(time<=clock[i+1][0]){segment=i;break}
    const [a,b]=[clock[segment],clock[segment+1]];
    return {action,startedAt,durationMs:ms,segments:clock,elapsedMs:Math.max(0,interpolate(time,a[0],b[0],a[1],b[1])),unitId:agent.id,...details};
  }
  if(agent.health<=0||agent.mode==='death')return state('death',finite(agent.deathStartedAt,agent.diedAt,agent.animationStartedAt,agent.bornAt,0));
  if(agent.birth){const start=finite(agent.birth.startedAt,agent.bornAt,0),end=finite(agent.birth.readyAt,start+duration('birth')/1000);if(time<end)return state('birth',start,[[start,0],[end,duration('birth')]])}
  const attack=agent.attack;
  function attacking() {
    if(!attack||!Number.isFinite(attack.startedAt)||time<attack.startedAt)return null;
    const ranged=!!(attack.dnaRanged||attack.mode==='ranged'||attack.attackMode==='ranged');
    const action=ranged?'ranged':'attack',ms=duration(action),start=attack.startedAt;
    const end=finite(attack.endsAt,start+ms/1000/(attack.speed||1));if(time>=end)return null;
    // In the world hitAt is projectile arrival. The laboratory uses it for
    // the shot's launch cue; the caller selects that explicit clock contract.
    const contact=ranged?finite(attack.launchedAt,options.attackClock==='lab'?attack.hitAt:undefined):attack.hitAt;
    const cue=ranged?(clips.ranged?.launchAtMs??200):(clips.attack?.hitTimeMs??300);
    if(Number.isFinite(attack.recovery)&&Number.isFinite(contact)) {
      const clock=ranged?{...attack,hitAt:contact,meleeContacts:attack.shotLaunches?.length?attack.shotLaunches:[contact]}:attack;
      const elapsed=attackAnimationElapsed(clock,time,cue/1000,ms/1000)*1000;
      if(elapsed>=ms)return null;
      const contacts=clock.meleeContacts?.length?clock.meleeContacts:[contact];
      const segments=attackAnimationSegments(clock,time,cue/1000,ms/1000).map(([at,elapsed])=>[at,elapsed*1000]);
      return {...state(action,start,segments),elapsedMs:elapsed,hasLaunchAnchor:true,eventAnchors:contacts.map(at=>({atMs:cue,at}))};
    }
    const anchored=Number.isFinite(contact)&&contact>start&&contact<end;
    return state(action,start,anchored?[[start,0],[contact,cue],[end,ms]]:[[start,0],[end,ms]],{hasLaunchAnchor:!ranged||anchored});
  }
  const activeAttack=attacking();if(agent.combat?.version===2&&activeAttack)return activeAttack;
  const hurt=agent.hurtStartedAt,hurtSeconds=agent.combat?.version === 2 ? .12 : duration('hurt')/1000;
  if(Number.isFinite(hurt)&&time>=hurt&&time<hurt+hurtSeconds)return state('hurt',hurt,[[hurt,0],[hurt+hurtSeconds,duration('hurt')]]);
  if(activeAttack)return activeAttack;
  if(agent.mode==='unload'&&agent.foodDelivery){
    const delivery=agent.foodDelivery,start=finite(delivery.startedAt,time),end=delivery.arrivesAt,release=clips.throw?.releaseAtMs,ms=duration('throw');
    return state('throw',start,Number.isFinite(end)&&end>start&&Number.isFinite(release)&&release>0&&release<ms?[[start,0],[start+(end-start)*.24,release],[end,ms]]:undefined);
  }
  if(agent.combat?.position?.moving)return state('walk',agent.combat.position.moveStartedAt);
  if(agent.mode==='harvest')return state('harvest',finite(agent.harvestStarted,agent.animationStartedAt,0));
  if(options.preview?.action==='jump')return state('jump',finite(options.preview.startedAt,time));
  if(agent.moveDuration>0&&Number.isFinite(agent.moveStartedAt)&&time>=agent.moveStartedAt&&time<agent.moveStartedAt+agent.moveDuration){
    const action=agent.carrying>0?'carry':'walk',ms=duration(action),cycles=clips[action]?.cyclesPerCell||clips.walk?.cyclesPerCell||1,start=agent.moveStartedAt,step=Math.max(0,(agent.stepCount||1)-1);
    if(!agent.species){const elapsed=unitMovementElapsedMs(agent,start);return state(action,start,[[start,elapsed],[start+agent.moveDuration,elapsed+agent.moveDuration*1000]])}
    return state(action,start,[[start,step*cycles*ms],[start+agent.moveDuration,(step+1)*cycles*ms]]);
  }
  return state('idle',finite(agent.animationStartedAt,agent.bornAt,0));
}

function unitAppearanceStatePose(agent,time,options={}) {
  const appearance=unitAppearanceForAgent(agent);
  if(!appearance)return null;
  const state=unitActionState(agent,time,{...options,animations:appearance.definition.actions});
  // Missing actions remain unavailable; they never silently become idle clips.
  const pose=state&&unitAppearancePose(appearance.tribe,appearance.mask,state.action,state.elapsedMs);
  return pose?{...pose,state}:null;
}

function absoluteEventTime(state,atMs) {
  const segments=state.segments;
  for(let i=0;i<segments.length-1;i++){
    const [a,b]=[segments[i],segments[i+1]];
    if(atMs>=a[1]-1e-7&&atMs<=b[1]+1e-7)return interpolate(atMs,a[1],b[1],a[0],b[0]);
  }
  // Non-looping actions may continue to hold their final pose.
  if(atMs<segments[0][1])return null;
  const a=segments.at(-2),b=segments.at(-1);
  return interpolate(atMs,a[1],b[1],a[0],b[0]);
}

function createUnitAppearanceEventPlayback({maxGap=.5}={}) {
  const cursors=new Map(),seen=new Map();
  function update(state,animation,time) {
    if(!state||!animation||!Number.isFinite(time))return [];
    const previous=cursors.get(state.unitId);
    // Refresh recency and bound every observation, including first sightings,
    // rewinds and long gaps which return before event traversal.
    cursors.delete(state.unitId);cursors.set(state.unitId,time);
    while(cursors.size>512)cursors.delete(cursors.keys().next().value);
    if(previous===undefined||time<previous||time-previous>maxGap)return [];
    const events=[],ms=durationOf(animation),loop=animation.loop===true;
    if(!(ms>0))return [];
    const segment=state.segments.find((value,index,all)=>index<all.length-1&&previous<=all[index+1][0])||state.segments.at(-2);
    const end=state.segments[state.segments.indexOf(segment)+1];
    const earlier=interpolate(previous,segment[0],end[0],segment[1],end[1]);
    const first=loop?Math.max(0,Math.floor(earlier/ms)-1):0;
    const last=loop?Math.max(first,Math.floor(state.elapsedMs/ms)):0;
    for(let cycle=first;cycle<=last;cycle++)for(const [index,event]of(animation.events||[]).entries()){
      if(event.type==='launch'&&state.hasLaunchAnchor===false)continue;
      const atMs=cycle*ms+event.atMs;if(!Number.isFinite(atMs)||event.atMs<0||event.atMs>ms)continue;
      const anchors=state.eventAnchors?.filter(anchor=>anchor.atMs===atMs);
      const times=anchors?.length?anchors.map(anchor=>anchor.at):[absoluteEventTime(state,atMs)];
      for(const at of times){
        if(at===null||at<=previous+1e-9||at>time+1e-9)continue;
        const id=[state.unitId,animation.sourceId,state.action,index,cycle,at.toFixed(6)].join(':');
        if(seen.has(id))continue;
        seen.set(id,true);events.push({...event,at,cycle,dedupeId:id,unitId:state.unitId,action:state.action});
      }
    }
    while(seen.size>2048)seen.delete(seen.keys().next().value);
    return events;
  }
  return {update,reset(){cursors.clear();seen.clear()}};
}

return { unitActionState, unitAppearanceStatePose, createUnitAppearanceEventPlayback };
})();
modules["client/unit-appearance-world.mjs"]=(()=>{
const { UNIT_APPEARANCE_PIXEL_BUDGETS }=modules["client/unit-appearance.mjs"];
const { createUnitAppearanceSource, UNIT_APPEARANCE_BYTE_BUDGETS }=modules["client/unit-appearance-source.mjs"];
const { createUnitAppearanceRenderer }=modules["client/unit-appearance-renderer.mjs"];
const { unitAppearanceStatePose }=modules["client/unit-appearance-state.mjs"];

// The same adapter is used by the world and combat views. Loading only prepares
// the next frame; it cannot paint asynchronously into either scene.
function createUnitAppearanceWorld(options = {}) {
  const scope = options.scope || globalThis, mobile = options.mobile ?? !!scope.matchMedia?.("(max-width: 900px)").matches;
  const source = createUnitAppearanceSource({ scope, sourceUrl: options.sourceUrl || (path => scope.SpawnerAssets?.source(path) || path),
    byteBudget: UNIT_APPEARANCE_BYTE_BUDGETS[mobile ? "mobile" : "desktop"], ...options.sourceOptions });
  const renderer = createUnitAppearanceRenderer(path => source.acquire(path), options.makeBitmap || ((blob, settings) => scope.createImageBitmap(blob, settings)),
    UNIT_APPEARANCE_PIXEL_BUDGETS[mobile ? "mobile" : "desktop"]);
  function prepare(context, agents, time, worldPixels, pixelRatio, stateOptions) {
    const requests = agents.map(agent => ({ agent, pose: unitAppearanceStatePose(agent, time, stateOptions), worldPixels }))
      // Existing birth scenes own seeds, nest outlets and their placement.
      // They stay active until a separate body-only scene adapter is registered.
      .filter(request => request.pose && request.pose.action !== "birth");
    renderer.prepareFrame(context, requests, pixelRatio);
    return new Map(requests.filter(request => renderer.isReady(context, request.agent, request.pose, worldPixels, pixelRatio))
      .map(request => [String(request.agent.id), request.pose]));
  }
  return { prepare, draw: renderer.drawReady,
    clear() { renderer.clear(); source.clear(); },
    stats: () => ({ encoded: source.stats(), decoded: renderer.stats() }) };
}

return {createUnitAppearanceWorld};
})();
modules["server/birth.mjs"] = (() => {
const AGENT_BIRTH_DURATION = 3.85;
const SPORE_BIRTH_DURATIONS = Object.freeze([180,80,80,80,80,80,80,80,80,160,160,160,160,160,160,160,160,80,80,80,80,700]);
const SPORE_BIRTH_DURATION = SPORE_BIRTH_DURATIONS.reduce((sum, duration) => sum + duration, 0) / 1000;
const SPRING_BIRTH_DURATIONS = Object.freeze([130, 120, 100, 100, 80, 260, 80, 90, 90, 100, 100, 130, 410]);
const SPRING_BIRTH_DURATION = SPRING_BIRTH_DURATIONS.reduce((sum, duration) => sum + duration, 0) / 1000;

const PEBBLE_BIRTH_DURATIONS = Object.freeze([80,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,700]);
const PEBBLE_BIRTH_DURATION = PEBBLE_BIRTH_DURATIONS.reduce((sum, duration) => sum + duration, 0) / 1000;

function agentBirthDuration(tribe) {
  if (tribe === "spore") return SPORE_BIRTH_DURATION;
  if (tribe === "pebble") return PEBBLE_BIRTH_DURATION;
  return tribe === "spring" ? SPRING_BIRTH_DURATION : AGENT_BIRTH_DURATION;
}

const bodyKeys = [
  [0, .76, .49, 0, -.03], [.065, .83, 1.15, 16, .025], [.18, .94, 1.06, 53, -.02],
  [.30, 1, 1, 71, .015], [.44, 1, 1.02, 49, 0], [.62, 1.05, .97, 0, 0],
  [.68, 1.16, .83, 0, -.015], [.82, .96, 1.05, 5, .01], [1.02, 1, 1, 0, 0]
];
const leafKeys = [
  [0, 1, .18, .16], [.15, .62, .62, .8], [.28, -.18, 1.08, 1.05],
  [.43, .10, .97, .96], [.65, -.04, 1.02, 1.01], [.88, 0, 1, 1]
];

function smooth(value) {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
}

function keyPose(keys, elapsed) {
  const t = Math.max(0, elapsed);
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last.slice(1);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b[0]) {
      const p = smooth((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((value, j) => value + (b[j + 1] - value) * p);
    }
  }
  return last.slice(1);
}

function agentBirthMotion(elapsed, dx, dy) {
  if (elapsed < 0 || elapsed >= AGENT_BIRTH_DURATION) return null;
  const length = Math.hypot(dx, dy);
  const direction = dx < -.01 ? -1 : 1;
  const endAngle = direction * (Math.PI * .5 + length * .64 / (.24 * .45));
  let progress = 1, seedLift = 0, seedAngle = endAngle, seedScaleX = 1, seedScaleY = 1;
  if (elapsed < .30) progress = 0;
  else if (elapsed < .72) {
    const p = (elapsed - .30) / .42;
    progress = .07 + .29 * p * p;
    seedLift = .42 * (1 - p) + 4 * p * (1 - p) * 2.1;
    seedAngle = direction * (-.24 + (Math.PI * .5 + .24) * p);
  } else if (elapsed < 1.60) {
    const first = elapsed < 1.18;
    const p = first ? (elapsed - .72) / .46 : (elapsed - 1.18) / .42;
    progress = first ? .36 + .36 * p : .72 + .28 * p;
    seedLift = 4 * p * (1 - p) * (first ? .23 : .14);
    seedAngle = direction * (Math.PI * .5 + length * (progress - .36) / (.24 * .45));
  } else if (elapsed < 1.78) {
    const p = smooth((elapsed - 1.60) / .18);
    seedScaleX += .16 * p;
    seedScaleY -= .18 * p;
  } else if (elapsed < 2.50) {
    const p = (elapsed - 1.78) / .72;
    seedLift = 4 * p * (1 - p) * .62;
    seedAngle += (Math.round(endAngle / (Math.PI * 2)) * Math.PI * 2 - endAngle) * p;
  } else if (elapsed < 2.57) {
    const p = Math.sin(Math.min(1, (elapsed - 2.50) / .07) * Math.PI * .5);
    seedAngle = 0;
    seedScaleX += .22 * p;
    seedScaleY -= .30 * p;
  }
  const unitAge = elapsed - 2.59;
  const [scaleX, scaleY, lift, rotation] = keyPose(bodyKeys, unitAge);
  const left = keyPose(leafKeys, unitAge - .02), right = keyPose(leafKeys, unitAge - .055);
  return { elapsed, progress, seedLift, seedAngle, seedScaleX, seedScaleY,
    seedVisible: elapsed >= .30 && elapsed < 2.57, unitVisible: unitAge >= 0,
    fractureAge: elapsed - 2.57, unitAge, scaleX, scaleY, rotation, lift: lift / 83 * .7 * .55,
    head: { leftRotation: left[0], rightRotation: -right[0], leftScaleX: left[1], rightScaleX: right[1],
      leftScaleY: left[2], rightScaleY: right[2] } };
}

return { AGENT_BIRTH_DURATION, SPORE_BIRTH_DURATIONS, SPORE_BIRTH_DURATION, SPRING_BIRTH_DURATIONS, SPRING_BIRTH_DURATION, PEBBLE_BIRTH_DURATIONS, PEBBLE_BIRTH_DURATION, agentBirthDuration, agentBirthMotion };
})();
modules["client/birth.mjs"] = (() => {
const { imageAnimation, imageScale } = modules["client/image-geometry.mjs"];
const { SPORE_BIRTH_DURATIONS, SPORE_BIRTH_DURATION, SPRING_BIRTH_DURATIONS, SPRING_BIRTH_DURATION, PEBBLE_BIRTH_DURATIONS, PEBBLE_BIRTH_DURATION } = modules["server/birth.mjs"];

const SPORE_BIRTH_ANIMATION = Object.freeze(imageAnimation({
  image: "DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/birth-unit.webp",
  nest: "DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/nest-stationary.png",
  frameSize: 576, columns: 4, frameCount: 22, pivotX: 400, pivotY: 486,
  outletX: 450, outletY: 400,
  unitHeight: 179, detachAt: .82, contactAt: 2.10, audioAt: .45, firstUnitFrame: 2,
  nestBounds: Object.freeze({ x: 37, y: 77, width: 459, height: 344 }),
  duration: SPORE_BIRTH_DURATION, durationsMs: SPORE_BIRTH_DURATIONS
}));

function sporeBirthPlacement(elapsed, outlet, target, height) {
  const animation = SPORE_BIRTH_ANIMATION;
  if (elapsed < 0 || elapsed >= animation.duration) return null;
  let end = 0, frame = animation.frameCount - 1;
  for (let index = 0; index < animation.frameCount; index++) {
    end += animation.durationsMs[index] / 1000;
    if (elapsed + 1e-9 < end) { frame = index; break; }
  }
  const age = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt)));
  const progress = age * age * (3 - 2 * age);
  const rootX = outlet.x + (target.x - outlet.x) * progress;
  const apexY = Math.min(outlet.y, target.y) - 1;
  const rise = Math.min(1, age / .25), fall = Math.max(0, (age - .25) / .75);
  const rootY = age < .25 ? outlet.y + (apexY - outlet.y) * (1 - (1 - rise) ** 2) :
    apexY + (target.y - apexY) * fall * fall;
  return { frame, rootX, rootY, scale: height / (animation.unitHeight * imageScale(animation.image)), unitVisible: frame >= animation.firstUnitFrame };
}

function birthLandingPulse(elapsed, contactAt) {
  const age = elapsed - contactAt;
  const keys = [[-.035, 0], [.02, 1], [.14, -.42], [.30, .16], [.52, 0]];
  if (age <= keys[0][0] || age >= keys.at(-1)[0]) return 0;
  for (let index = 1; index < keys.length; index++) {
    const previous = keys[index - 1], next = keys[index];
    if (age > next[0]) continue;
    const progress = (age - previous[0]) / (next[0] - previous[0]);
    return previous[1] + (next[1] - previous[1]) * progress * progress * (3 - 2 * progress);
  }
  return 0;
}

function sporeBirthMotion(elapsed) {
  const animation = SPORE_BIRTH_ANIMATION;
  const flight = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt)));
  const turn = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - .28 - animation.detachAt)));
  const landing = Math.max(0, elapsed - animation.contactAt);
  const settle = Math.max(0, 1 - landing / .28);
  const impact = birthLandingPulse(elapsed, animation.contactAt);
  return { rotation: flight < 1 ? Math.PI * 4 * turn * turn * (3 - 2 * turn) :
    Math.sin(landing * 24) * .12 * settle * settle,
    scaleX: 1 + impact * .10, scaleY: 1 - impact * .08 };
}

function springBirthMotion(elapsed) {
  const animation = SPRING_BIRTH_ANIMATION;
  if (elapsed < animation.detachAt) {
    const age = Math.max(0, elapsed / animation.detachAt);
    const pulse = Math.sin(age * Math.PI) * Math.sin(age * Math.PI * 3);
    return { scaleX: 1 + pulse * .055, scaleY: 1 - pulse * .035,
      bulge: Math.sin(age * Math.PI) * .10, sway: pulse * .025,
      anchorX: animation.outletX, anchorY: animation.outletY };
  }
  if (elapsed < animation.contactAt) {
    const age = (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt);
    const stretch = Math.sin(age * Math.PI);
    const impact = birthLandingPulse(elapsed, animation.contactAt);
    return { scaleX: 1 - stretch * .12 + impact * .27, scaleY: 1 + stretch * .22 - impact * .22,
      bulge: stretch * .08 + impact * .12, sway: (Math.sin(age * Math.PI * 2) + impact) * .035,
      anchorX: animation.pivotX, anchorY: animation.pivotY };
  }
  const bounce = birthLandingPulse(elapsed, animation.contactAt);
  return { scaleX: 1 + bounce * .27, scaleY: 1 - bounce * .22,
    bulge: bounce * .12, sway: bounce * .035,
    anchorX: animation.pivotX, anchorY: animation.pivotY };
}

function drawSpringBirthSurface(ctx, sprite, source, target, motion) {
  const animation = SPRING_BIRTH_ANIMATION;
  const scale = target.size / source.size;
  const padding = (source.size - animation.frameSize) / 2;
  const anchorX = motion.anchorX + padding, anchorY = motion.anchorY + padding;
  const centerX = animation.pivotX + padding;
  ctx.save();
  ctx.translate(target.x + anchorX * scale, target.y + anchorY * scale);
  ctx.scale(motion.scaleX, motion.scaleY);
  const step = Math.max(1, Math.round(animation.frameSize / 120));
  for (let row = 0; row < source.size; row += step) {
    const height = Math.min(step, source.size - row);
    const depth = Math.max(0, Math.min(1, (row - padding - animation.pivotY + animation.height) / animation.height));
    const width = 1 + motion.bulge * Math.sin(depth * Math.PI);
    const shift = motion.sway * animation.height * Math.sin(depth * Math.PI * 2);
    ctx.drawImage(sprite, source.x, source.y + row, source.size, height,
      ((-centerX) * width + centerX - anchorX + shift) * scale, (row - anchorY) * scale,
      source.size * scale * width, height * scale);
  }
  ctx.restore();
}

function drawSpringBirthWater(ctx, x, floor, cell, elapsed) {
  const age = elapsed - SPRING_BIRTH_ANIMATION.contactAt;
  if (age < 0 || age >= .52) return;
  const progress = age / .52;
  const fade = (1 - progress) ** 2;
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.strokeStyle = "#a4eced";
  ctx.lineWidth = Math.max(.5, cell * .006);
  for (const delay of [0, .14]) {
    const ripple = (age - delay) / .38;
    if (ripple < 0 || ripple > 1) continue;
    ctx.beginPath();
    ctx.ellipse(x, floor + cell * .008, cell * (.10 + ripple * .23), cell * (.025 + ripple * .045), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let index = 0; index < 6; index++) {
    const side = index % 2 ? -1 : 1;
    const travel = cell * (.07 + progress * (.16 + index * .018));
    const lift = Math.sin(Math.min(1, progress * 1.35) * Math.PI) * cell * (.06 + index % 3 * .025);
    const radius = cell * (.016 + index % 3 * .004) * (1 - progress * .6);
    const px = x + side * travel, py = floor - lift;
    const fill = ctx.createRadialGradient(px - radius * .3, py - radius * .4, 0, px, py, radius);
    fill.addColorStop(0, "#ecffff");
    fill.addColorStop(.45, "#a1eeed");
    fill.addColorStop(1, "#259dbb");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(px, py, radius * (1 + progress * .3), radius * (1 - progress * .2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function sporeBirthPixels(scene, nest) {
  const pixels = new Uint8ClampedArray(scene.length);
  for (let index = 0; index < scene.length; index += 4) {
    if (scene[index] === nest[index] && scene[index + 1] === nest[index + 1] &&
        scene[index + 2] === nest[index + 2] && scene[index + 3] === nest[index + 3]) continue;
    const alpha = nest[index + 3] === 255 ? 255 :
      Math.max(0, Math.min(255, (scene[index + 3] - nest[index + 3]) * 255 / (255 - nest[index + 3])));
    if (alpha <= 0) continue;
    pixels[index + 3] = alpha;
    for (let channel = 0; channel < 3; channel++) pixels[index + channel] =
      (scene[index + channel] * scene[index + 3] - nest[index + channel] * nest[index + 3] * (1 - alpha / 255)) / alpha;
  }
  return pixels;
}

const SPRING_BIRTH_ANIMATION = Object.freeze(imageAnimation({
  image: "DesignAssets/Tribes/spring/AnimationStudies/birth-detach-v1/birth-unit.webp",
  frameSize: 512, columns: 4, frameCount: 13, pivotX: 320, pivotY: 448,
  outletX: 86, outletY: 105, height: 224, detachAt: .53, contactAt: .79, audioAt: .70,
  duration: SPRING_BIRTH_DURATION, durationsMs: SPRING_BIRTH_DURATIONS
}));

function springBirthPlacement(elapsed, outlet, target, height) {
  if (elapsed < 0 || elapsed >= SPRING_BIRTH_DURATION) return null;
  const animation = SPRING_BIRTH_ANIMATION;
  let end = 0, frame = animation.frameCount - 1;
  for (let index = 0; index < animation.durationsMs.length; index++) {
    end += animation.durationsMs[index] / 1000;
    if (elapsed + 1e-9 < end) { frame = index; break; }
  }
  const scale = height / animation.height;
  const startX = outlet.x - animation.outletX * scale;
  const startY = outlet.y - animation.outletY * scale;
  const endX = target.x - animation.pivotX * scale;
  const endY = target.y - animation.pivotY * scale;
  const progress = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt)));
  const x = startX + (endX - startX) * progress;
  const y = startY + (endY - startY) * progress * progress;
  return { frame, x, y, scale, rootX: x + animation.pivotX * scale, rootY: y + animation.pivotY * scale };
}

const PEBBLE_BIRTH_ANIMATION = Object.freeze(imageAnimation({
  image: "DesignAssets/Tribes/pebble/AnimationStudies/birth-den-v1/birth-unit.webp",
  foreground: "DesignAssets/Tribes/pebble/AnimationStudies/birth-den-v1/birth-foreground.png",
  frameSize: 512, columns: 8, frameCount: 48, pivotX: 256, pivotY: 460,
  outletX: 256, outletY: 460, height: 229, unitHeight: 229, unitPivotY: 460,
  detachAt: .12, contactAt: 1.48, audioAt: .25,
  nestOutletX: .5, nestOutletY: .82,
  duration: PEBBLE_BIRTH_DURATION, durationsMs: PEBBLE_BIRTH_DURATIONS
}));

function pebbleBirthPlacement(elapsed, outlet, target, height) {
  const animation = PEBBLE_BIRTH_ANIMATION;
  if (elapsed < 0 || elapsed >= animation.duration) return null;
  let end = 0, frame = animation.frameCount - 1;
  for (let index = 0; index < animation.durationsMs.length; index++) {
    end += animation.durationsMs[index] / 1000;
    if (elapsed + 1e-9 < end) { frame = index; break; }
  }
  const scale = height / animation.height;
  const startX = outlet.x - animation.outletX * scale;
  const startY = outlet.y - animation.outletY * scale;
  const endX = target.x - animation.pivotX * scale;
  const endY = target.y - animation.pivotY * scale;
  const progress = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt)));
  const horizontal = progress * progress * (3 - 2 * progress);
  const x = startX + (endX - startX) * horizontal;
  const y = startY + (endY - startY) * horizontal;
  return { frame, x, y, scale, rootX: x + animation.pivotX * scale, rootY: y + animation.pivotY * scale };
}

const pieces = [
  { polygon: [[-.06, -1], [-.43, -.58], [-.46, -.32], [0, -.48]], vx: -82, vy: -145, spin: -5 },
  { polygon: [[-.06, -1], [.42, -.62], [.48, -.32], [0, -.48]], vx: 87, vy: -160, spin: 5 },
  { polygon: [[-.46, -.32], [-.33, -.04], [-.02, 0], [0, -.48]], vx: -130, vy: -93, spin: -8 },
  { polygon: [[0, -.48], [-.02, 0], [.40, -.08], [.48, -.32]], vx: 136, vy: -100, spin: 8 }
];

function seedSurface(ctx, w, h) {
  const fill = ctx.createLinearGradient(-w * .45, -h * .7, w * .46, -h * .2);
  [[0, "#b17a3e"], [.28, "#e6c27b"], [.52, "#b98043"], [.77, "#d2a05a"], [1, "#85532f"]]
    .forEach(([p, color]) => fill.addColorStop(p, color));
  ctx.beginPath();
  ctx.moveTo(-w * .06, -h);
  ctx.bezierCurveTo(w * .08, -h * .87, w * .48, -h * .63, w * .48, -h * .31);
  ctx.bezierCurveTo(w * .48, -h * .11, w * .20, h * .02, -w * .05, -h * .02);
  ctx.bezierCurveTo(-w * .36, -h * .04, -w * .48, -h * .20, -w * .43, -h * .42);
  ctx.bezierCurveTo(-w * .39, -h * .62, -w * .12, -h * .79, -w * .06, -h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "#4d3e26";
  ctx.lineWidth = Math.max(.6, w * .035);
  ctx.stroke();
  ctx.strokeStyle = "#fff0bd70";
  ctx.lineWidth = Math.max(.5, w * .03);
  ctx.beginPath();
  ctx.moveTo(-w * .12, -h * .79);
  ctx.bezierCurveTo(-w * .29, -h * .54, -w * .37, -h * .33, -w * .21, -h * .15);
  ctx.stroke();
  ctx.strokeStyle = "#78502d99";
  ctx.lineWidth = Math.max(.4, w * .018);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-w * .02, -h * .82);
    ctx.bezierCurveTo(side * w * .26, -h * .61, side * w * .29, -h * .32, side * w * .13, -h * .12);
    ctx.stroke();
  }
  ctx.strokeStyle = "#654329";
  ctx.lineWidth = Math.max(.6, w * .037);
  ctx.beginPath();
  ctx.moveTo(-w * .04, -h * .93);
  ctx.bezierCurveTo(w * .09, -h * .61, -w * .05, -h * .27, -w * .02, -h * .08);
  ctx.stroke();
}

function drawBirthSeed(ctx, x, floor, cell, motion) {
  const w = cell * .24, h = w * 1.42;
  const support = Math.hypot(w * .48 * motion.seedScaleX * Math.sin(motion.seedAngle),
    h * .50 * motion.seedScaleY * Math.cos(motion.seedAngle));
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x, floor - support - motion.seedLift * cell);
  ctx.rotate(motion.seedAngle);
  ctx.scale(motion.seedScaleX, motion.seedScaleY);
  ctx.translate(0, h * .5);
  seedSurface(ctx, w, h);
  if (motion.elapsed >= 2.50) {
    ctx.strokeStyle = "#443425";
    ctx.lineWidth = Math.max(.7, w * .044);
    ctx.beginPath();
    ctx.moveTo(-w * .05, -h * .94);
    for (const [px, py] of [[.10, -.66], [-.08, -.48], [.06, -.25], [0, -.03]]) ctx.lineTo(px * w, py * h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBirthFragments(ctx, x, floor, cell, age) {
  if (age < 0 || age >= .74) return;
  const w = cell * .24, h = w * 1.42, scale = w / 46;
  for (const piece of pieces) {
    const dy = piece.vy * age * scale + 240 * age * age * scale;
    const p = Math.max(0, Math.min(1, (age - .40) / .34));
    ctx.save();
    ctx.translate(x + piece.vx * age * scale, Math.min(floor - h * .18, floor - h * .5 + dy));
    ctx.rotate(piece.spin * age);
    ctx.translate(0, h * .5);
    ctx.globalAlpha *= 1 - p * p * (3 - 2 * p);
    ctx.beginPath();
    piece.polygon.forEach(([px, py], index) => {
      if (index === 0) ctx.moveTo(px * w, py * h);
      else ctx.lineTo(px * w, py * h);
    });
    ctx.closePath();
    ctx.clip();
    seedSurface(ctx, w, h);
    ctx.restore();
  }
}

function drawBirthImpact(ctx, x, floor, cell, age, strength) {
  if (age < 0 || age > .26) return;
  const p = age / .26;
  ctx.save();
  ctx.globalAlpha *= (1 - p) * strength;
  ctx.strokeStyle = "#d5c596";
  ctx.lineWidth = Math.max(.5, cell * .007);
  ctx.beginPath();
  ctx.ellipse(x, floor + cell * .008, cell * (.07 + p * .16), cell * (.02 + p * .04), 0, 0, Math.PI * 2);
  ctx.stroke();
  if (strength > .35) {
    ctx.fillStyle = "#dbc28e";
    for (let i = 0; i < 8; i++) {
      const d = cell * (.04 + i * .016) * (1 + p * 1.6);
      ctx.beginPath();
      ctx.ellipse(x + (i % 2 ? 1 : -1) * d, floor - Math.sin(p * Math.PI) * cell * (.025 + i % 3 * .02),
        Math.max(.1, cell * .011 * (1 - p)), Math.max(.1, cell * .009 * (1 - p)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

return { SPORE_BIRTH_ANIMATION, sporeBirthPlacement, sporeBirthMotion, springBirthMotion, drawSpringBirthSurface, drawSpringBirthWater, sporeBirthPixels, SPRING_BIRTH_ANIMATION, springBirthPlacement, PEBBLE_BIRTH_ANIMATION, pebbleBirthPlacement, drawBirthSeed, drawBirthFragments, drawBirthImpact };
})();
modules["client/unit-appearance-birth-scene.mjs"]=(()=>{
// Exact native raw00 body renderer for an external legacy birth scene.
// The caller owns source approval, mask00 eligibility, root travel, scene props, and effects.
const { sporeBirthMotion, springBirthMotion }=modules["client/birth.mjs"];

function drawUnitAppearanceBirthSceneBody(ctx, contract, sheet, options) {
  if (contract?.kind !== 'native-body-with-external-legacy-scene' || contract.mask !== 0 ||
      !contract.ownership?.bodyOnly || contract.body?.sourceId !== contract.sourceId) throw new Error('INVALID_NATIVE_BIRTH_SCENE');
  const clip = contract.body, { frame, elapsed, anchor, worldPixels, facing = 1, growth = 1, drawIdle } = options;
  if (frame === contract.visibility.lastFrame) { drawIdle?.(ctx, anchor, worldPixels, growth); return 'idle-handoff'; }
  if (frame < contract.visibility.firstBodyFrame) return 'body-hidden';
  const stage = contract.legacyPixelStage;
  const topLeft = options.topLeft || { x: anchor.x - worldPixels / 2,
    y: anchor.y - worldPixels / 2 - worldPixels * stage.agentHeight * stage.commonFloorOffsetFromHalfCell };
  const sourceX = frame % clip.columns * clip.frameSize, sourceY = Math.floor(frame / clip.columns) * clip.frameSize;
  ctx.save();
  // Keep the old Canvas operation order as well as its mathematically equal camera:
  // image-vs-canvas sampling and subpixel transform rounding otherwise alter edges.
  if (!options.outerDisplayScaleApplied) {
    ctx.translate(anchor.x, anchor.y);
    ctx.scale(stage.displayScale * growth, stage.displayScale * growth);
    ctx.translate(-anchor.x, -anchor.y);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (contract.deformation.kind === 'spore-affine-body-v1') {
    const baseScale = stage.nativeWorldPerPixelBeforeDisplay;
    const size = clip.frameSize * baseScale * worldPixels;
    const x = -clip.pivotX * baseScale * worldPixels, y = -clip.pivotY * baseScale * worldPixels;
    const motion = sporeBirthMotion(elapsed), height = contract.deformation.nativeHeight * baseScale * worldPixels;
    const frameImage = options.nativeFrame;
    if (!frameImage || frameImage.width !== clip.frameSize || frameImage.height !== clip.frameSize) {
      ctx.restore();
      throw Error('FIXED_NATIVE_FRAME_VIEW_REQUIRED');
    }
    ctx.translate(topLeft.x + worldPixels / 2, topLeft.y + worldPixels / 2 + worldPixels * stage.agentHeight * stage.commonFloorOffsetFromHalfCell);
    ctx.scale(facing, 1);
    ctx.scale(motion.scaleX, motion.scaleY);
    ctx.translate(0, -height * .5);
    ctx.rotate(motion.rotation);
    ctx.translate(0, height * .5);
    ctx.drawImage(frameImage, x, y, size, size);
    ctx.restore();
    return 'native-body';
  }
  if (contract.deformation.kind === 'spring-row-surface-v1') {
    const motion = springBirthMotion(elapsed), spec = contract.deformation;
    const nativeScale = worldPixels * stage.agentHeight * stage.referenceHeight / stage.canonicalFrameSize / spec.nativeHeight;
    const size = clip.frameSize * nativeScale;
    const x = topLeft.x + worldPixels / 2 - clip.pivotX * nativeScale;
    const y = topLeft.y + worldPixels / 2 + worldPixels * stage.agentHeight * stage.commonFloorOffsetFromHalfCell - clip.pivotY * nativeScale;
    const surfaceScale = size / clip.frameSize;
    ctx.translate(x + motion.anchorX * surfaceScale, y + motion.anchorY * surfaceScale);
    ctx.scale(motion.scaleX, motion.scaleY);
    for (let row = 0; row < clip.frameSize; row += spec.rowStep) {
      const height = Math.min(spec.rowStep, clip.frameSize - row);
      const depth = Math.max(0, Math.min(1, (row - spec.nativePivotY + spec.nativeHeight) / spec.nativeHeight));
      const width = 1 + motion.bulge * Math.sin(depth * Math.PI);
      const shift = motion.sway * spec.nativeHeight * Math.sin(depth * Math.PI * 2);
      ctx.drawImage(sheet, sourceX, sourceY + row, clip.frameSize, height,
        (-spec.nativeCenterX * width + spec.nativeCenterX - motion.anchorX + shift) * surfaceScale,
        (row - motion.anchorY) * surfaceScale, clip.frameSize * surfaceScale * width, height * surfaceScale);
    }
  } else {
    const nativeScale = worldPixels * stage.agentHeight * stage.unitHeight / stage.canonicalFrameSize / contract.deformation.nativeHeight;
    const size = clip.frameSize * nativeScale;
    const x = topLeft.x + worldPixels / 2 - clip.pivotX * nativeScale;
    const y = topLeft.y + worldPixels / 2 + worldPixels * stage.agentHeight * (stage.unitPivotY / stage.canonicalFrameSize - .5) - clip.pivotY * nativeScale;
    ctx.drawImage(sheet, sourceX, sourceY, clip.frameSize, clip.frameSize,
      x, y, size, size);
  }
  ctx.restore();
  return 'native-body';
}

return {drawUnitAppearanceBirthSceneBody};
})();
globalThis.SpawnerAppearance=Object.freeze({...modules["client/unit-appearance.mjs"],...modules["client/unit-appearance-renderer.mjs"],...modules["client/unit-appearance-source.mjs"],...modules["client/unit-appearance-state.mjs"],...modules["client/unit-appearance-world.mjs"],...modules["client/unit-appearance-birth-scene.mjs"]});
})();
