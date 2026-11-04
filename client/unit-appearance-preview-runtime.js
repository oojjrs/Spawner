(() => {
const modules=Object.create(null);
modules["client/unit-size.mjs"]=globalThis.Spawner;
modules["server/dna.mjs"]=globalThis.Spawner;
modules["client/unit-animation.mjs"]=globalThis.Spawner;
modules["client/birth.mjs"]=globalThis.Spawner;
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
        "imageHash": "54cb430a848400e1f6742a737f135467de1852600b8555e42ae16c484d351682",
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
          "sourceHash": "54cb430a848400e1f6742a737f135467de1852600b8555e42ae16c484d351682",
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
      "approvalState": "pending",
      "approvalRef": null,
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
      "sourceApproved": false,
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
modules["client/unit-appearance.mjs"]=(()=>{
const { UNIT_DISPLAY_SIZES, unitDisplaySize }=modules["client/unit-size.mjs"];
const { ATTRIBUTE_DNA }=modules["server/dna.mjs"];
const { UNIT_APPEARANCE_ASSETS }=modules["client/unit-appearance-assets.mjs"];
const { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, unitAppearanceKey, unitAppearanceMaskFromDna }=modules["server/unit-appearance.mjs"];

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
  return source?.approvalState === "approved" && !!source.approvalRef?.callId && !!source.approvalRef?.sourceThread ||
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
  const tribe = agent.tribe || "bean", mask = unitAppearanceMaskFromDna(agent.dna);
  return mask !== null && unitAppearanceReady(tribe, mask) && ATTRIBUTE_DNA.validate(agent.dna) ? { tribe, mask, definition: unitAppearanceDefinition(tribe, mask) } : null;
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

function unitAppearanceInventory() {
  return UNIT_APPEARANCE_TRIBES.flatMap(tribe => Array.from({ length: 32 }, (_, mask) => {
    const definition = unitAppearanceDefinition(tribe, mask);
    return { key: unitAppearanceKey(tribe, mask), tribe, mask, sourceId: definition?.source?.sourceId || null,
      ...unitAppearanceReadiness(definition, mask), missingActions: unitAppearanceMissingActions(tribe, mask),
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

return {unitAppearanceRequiredWorldActions,unitAppearanceRequiredActions,UNIT_APPEARANCE_OPTIONAL_PREVIEW_ACTIONS,unitAppearanceDefinition,unitAppearanceReadiness,unitAppearanceAnimation,unitAppearanceMissingActions,unitAppearanceReady,unitAppearanceForAgent,unitAppearanceBirthSceneForAgent,unitAppearancePose,unitAppearanceWorldPose,unitAppearanceSourceScale,unitAppearanceInventory,UNIT_APPEARANCE_PIXEL_BUDGETS,unitAppearanceLodRatio,createUnitAppearanceCache};
})();
modules["client/unit-appearance-renderer.mjs"]=(()=>{
const { createUnitAppearanceCache, unitAppearanceLodRatio, unitAppearanceSourceScale }=modules["client/unit-appearance.mjs"];

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
      context.translate(anchor.x, anchor.y); context.scale(mirror ? -1 : 1, 1);
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

return {createUnitAppearanceRenderer};
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
modules["client/unit-appearance-state.mjs"]=(()=>{
const { UNIT_ANIMATIONS }=modules["client/unit-animation.mjs"];
const { unitAppearanceForAgent, unitAppearancePose }=modules["client/unit-appearance.mjs"];

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
    const anchored=Number.isFinite(contact)&&contact>start&&contact<end;
    return state(action,start,anchored?[[start,0],[contact,cue],[end,ms]]:[[start,0],[end,ms]],{hasLaunchAnchor:!ranged||anchored});
  }
  const activeAttack=attacking();if(agent.combat?.version===2&&activeAttack)return activeAttack;
  const hurt=agent.hurtStartedAt,hurtSeconds=agent.combat?.version === 2 ? .12 : duration('hurt')/1000;
  if(Number.isFinite(hurt)&&time>=hurt&&time<hurt+hurtSeconds)return state('hurt',hurt,[[hurt,0],[hurt+hurtSeconds,duration('hurt')]]);
  if(activeAttack)return activeAttack;
  if(agent.mode==='unload'&&agent.foodDelivery)return state('throw',finite(agent.foodDelivery.startedAt,time));
  if(agent.mode==='harvest')return state('harvest',finite(agent.harvestStarted,agent.animationStartedAt,0));
  if(options.preview?.action==='jump')return state('jump',finite(options.preview.startedAt,time));
  if(agent.moveDuration>0&&Number.isFinite(agent.moveStartedAt)&&time>=agent.moveStartedAt&&time<agent.moveStartedAt+agent.moveDuration){
    const action=agent.carrying>0?'carry':'walk',ms=duration(action),cycles=clips[action]?.cyclesPerCell||clips.walk?.cyclesPerCell||1,start=agent.moveStartedAt,step=Math.max(0,(agent.stepCount||1)-1);
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
    const previous=cursors.get(state.unitId);cursors.set(state.unitId,time);
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
      const at=absoluteEventTime(state,atMs);
      if(at===null||at<=previous+1e-9||at>time+1e-9)continue;
      const id=[state.unitId,animation.sourceId,state.action,index,cycle,at.toFixed(6)].join(':');
      if(seen.has(id))continue;
      seen.set(id,true);events.push({...event,at,cycle,dedupeId:id,unitId:state.unitId,action:state.action});
    }
    while(seen.size>2048)seen.delete(seen.keys().next().value);
    while(cursors.size>512)cursors.delete(cursors.keys().next().value);
    return events;
  }
  return {update,reset(){cursors.clear();seen.clear()}};
}

return {unitActionState,unitAppearanceStatePose,createUnitAppearanceEventPlayback};
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
