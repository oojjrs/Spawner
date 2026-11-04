(() => {
const modules=Object.create(null);
modules["client/unit-size.mjs"]=globalThis.Spawner;
modules["server/dna.mjs"]=globalThis.Spawner;
modules["client/unit-animation.mjs"]=globalThis.Spawner;
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
  const entries = new Map(), workingSet = new Map(), workingKeys = new Set();
  let residentPixels = 0, decodes = 0, cacheHits = 0, queue = Promise.resolve();
  function dimensions(animation) {
    const width = animation.frameWidth || animation.frameSize, height = animation.frameHeight || animation.frameSize;
    return { width: width * animation.columns, height: height * Math.ceil(animation.frameCount / animation.columns), minimum: 1 / Math.max(width, height) };
  }
  function pixelsAt(animation, ratio) {
    const size = dimensions(animation);
    return Math.round(size.width * ratio) * Math.round(size.height * ratio);
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
          bitmap = await makeBitmap(source, { resizeWidth: Math.round(width * selected), resizeHeight: Math.round(height * selected), resizeQuality: "high" });
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
  return { withImage, setWorkingSet, clear, stats: () => ({ entries: entries.size, residentPixels, pixelBudget, decodes, cacheHits, workingAtlases: workingSet.size }) };
}
return {unitAppearanceRequiredWorldActions,unitAppearanceRequiredActions,UNIT_APPEARANCE_OPTIONAL_PREVIEW_ACTIONS,unitAppearanceDefinition,unitAppearanceReadiness,unitAppearanceAnimation,unitAppearanceMissingActions,unitAppearanceReady,unitAppearanceForAgent,unitAppearancePose,unitAppearanceWorldPose,unitAppearanceSourceScale,unitAppearanceInventory,UNIT_APPEARANCE_PIXEL_BUDGETS,unitAppearanceLodRatio,createUnitAppearanceCache};
})();
modules["client/unit-appearance-renderer.mjs"]=(()=>{
const { createUnitAppearanceCache, unitAppearanceLodRatio, unitAppearanceSourceScale }=modules["client/unit-appearance.mjs"];

function createUnitAppearanceRenderer(loadSource, makeBitmap, pixelBudget) {
  const cache = createUnitAppearanceCache(loadSource, makeBitmap, pixelBudget);
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
  async function draw(context, agent, pose, anchor, worldPixels, mirror, pixelRatio, stillCurrent) {
    if (!pose || pose.animation.sourceId !== pose.source.sourceId || !stillCurrent()) return false;
    const shape = pose.geometry, animation = pose.animation;
    const width = animation.frameWidth || animation.frameSize, height = animation.frameHeight || animation.frameSize;
    const scale = unitAppearanceSourceScale(agent, worldPixels, pose.source, animation);
    const ratio = samplingRatio(context, agent, pose, worldPixels, pixelRatio);
    let drawn = false;
    await cache.withImage(animation, ratio, raster => {
      if (!stillCurrent()) return;
      context.save(); context.translate(anchor.x, anchor.y); context.scale(mirror ? -1 : 1, 1);
      context.imageSmoothingEnabled = true;
      context.drawImage(raster.image, pose.frame % animation.columns * width * raster.rasterScaleX,
        Math.floor(pose.frame / animation.columns) * height * raster.rasterScaleY,
        width * raster.rasterScaleX, height * raster.rasterScaleY,
        -shape.pivotX * scale, -shape.pivotY * scale, width * scale, height * scale);
      context.restore(); drawn = true;
    });
    return drawn;
  }
  return { beginFrame, draw, clear: cache.clear, stats: cache.stats };
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
globalThis.SpawnerAppearance=Object.freeze({...modules["client/unit-appearance.mjs"],...modules["client/unit-appearance-renderer.mjs"],...modules["client/unit-appearance-source.mjs"],...modules["client/unit-appearance-state.mjs"]});
})();
