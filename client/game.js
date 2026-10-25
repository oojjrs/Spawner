
    "use strict";
    (async () => {
    await globalThis.SpawnerAssets.ready;
    const assetSource = globalThis.SpawnerAssets.source;
    const tribeArt = Spawner.createTribeArt(Spawner.PLAYER_TRIBES, assetSource);
    const tribeColonies = new Map();
    const { TERRAIN_CODEX, HAZARD_CODEX, terrainCodexResources, terrainCodexCell, ATTRIBUTES, ATTRIBUTE_COMBINATIONS, attributeCounts, unitStats, unitMovementSpeed, birthCost, hasSynergy, NEST_LEVELS, createClient,
      agentBirthDuration, agentBirthMotion, SPRING_BIRTH_ANIMATION, springBirthPlacement, PEBBLE_BIRTH_ANIMATION, pebbleBirthPlacement, drawBirthSeed, drawBirthFragments, drawBirthImpact,
      AGENT_ATTACK_ASSET, agentAttackFrame, AGENT_DEATH_ANIMATION, agentDeathFrame } = globalThis.Spawner;
    const connection = { active: false, online: false, busy: false, synchronizing: false, roomId: null, colonyId: null, revision: -1, simSeconds: 0, receivedAt: 0 };
    const connectionStatus = document.getElementById("connection-status");
    const canvas = document.getElementById("world");
    const ctx = canvas.getContext("2d");
    const zoomLayerButtons = [...document.querySelectorAll("[data-zoom-layer]")];
    const colonyFocus = document.getElementById("colony-focus");
    const selectionTerrain = document.getElementById("selection-terrain");
    const controlsGuide = document.getElementById("controls-guide");
    const controlsGuideToggle = document.getElementById("controls-guide-toggle");
    const controlsGuideClose = document.getElementById("controls-guide-close");

    function collapseControlsGuide() {
      if (controlsGuide.hidden) return;
      controlsGuide.hidden = true;
      controlsGuideToggle.hidden = false;
      controlsGuideToggle.setAttribute("aria-expanded", "false");
    }

    controlsGuideClose.addEventListener("click", () => {
      collapseControlsGuide();
      controlsGuideToggle.focus();
    });

    controlsGuideToggle.addEventListener("click", () => {
      if (!unitPanel.hidden || !colonyMenu.hidden) {
        closeColonyMenu();
        closeUnitPanel();
      }
      controlsGuide.hidden = false;
      controlsGuideToggle.hidden = true;
      controlsGuideToggle.setAttribute("aria-expanded", "true");
      controlsGuideClose.focus();
    });

    const colonyMenu = document.getElementById("colony-menu");
    const colonyMenuClose = document.getElementById("colony-menu-close");
    let colonyMenuEntry = null;
    const nestNameDisplay = document.getElementById("nest-name-display");
    const nestRenameOpen = document.getElementById("nest-rename-open");
    const nestNameForm = document.getElementById("nest-name-form");
    const nestNameInput = document.getElementById("nest-name-input");
    const nestNameSave = document.getElementById("nest-name-save");
    const nestNameCancel = document.getElementById("nest-name-cancel");
    const nestNameStatus = document.getElementById("nest-name-status");
    let renamedColonyId = null;
    const discoveryToasts = document.getElementById("discovery-toasts");
    const discoveryToastTimers = new Map();
    const objectPanel = document.getElementById("object-panel");
    const agentList = document.getElementById("agent-list");
    const agentListCount = document.getElementById("agent-list-count");
    const unitPanel = document.getElementById("unit-panel");
    const unitPanelTitle = document.getElementById("unit-panel-title");
    const terrainDetails = document.getElementById("terrain-details");
    const agentDetails = document.getElementById("agent-details");
    const agentBirth = document.getElementById("agent-birth");
    const agentDesign = document.getElementById("agent-design");
    const unitActionStatus = document.getElementById("unit-action-status");
    let unitPanelSelectionKey = null;
    const corpseDetails = document.getElementById("corpse-details");
    const corpseValue = document.getElementById("corpse-value");
    const corpseDesign = document.getElementById("corpse-design");
    const evolutionPanel = document.getElementById("evolution-panel");
    const evolutionOpenButton = document.getElementById("evolution-open-button");
    const evolutionClose = document.getElementById("evolution-close");
    const helpTooltip = document.getElementById("help-tooltip");
    let helpTooltipTarget = null;

    function hideHelpTooltip() {
      if (helpTooltipTarget) helpTooltipTarget.removeAttribute("aria-describedby");
      helpTooltipTarget = null;
      helpTooltip.hidden = true;
    }

    function positionHelpTooltip() {
      if (!helpTooltipTarget) return;
      const rect = helpTooltipTarget.getBoundingClientRect();
      const panel = helpTooltipTarget.closest(".colony-menu, .evolution-panel, .codex");
      const panelRect = panel.getBoundingClientRect();
      if (!helpTooltipTarget.getClientRects().length || rect.bottom <= panelRect.top || rect.top >= panelRect.bottom) {
        hideHelpTooltip();
        return;
      }
      const width = helpTooltip.offsetWidth;
      const left = rect.right + 8 + width <= window.innerWidth - 10 ? rect.right + 8 : rect.left - width - 8;
      helpTooltip.style.left = clamp(left, 10, Math.max(10, window.innerWidth - width - 10)) + "px";
      helpTooltip.style.top = clamp(rect.top, 10, Math.max(10, window.innerHeight - helpTooltip.offsetHeight - 10)) + "px";
    }

    function setEvolutionText(element, text) {
      element.replaceChildren();
      for (const [index, part] of String(text).split("진화 포인트").entries()) {
        if (index) {
          const image = document.createElement("img");
          image.className = "evolution-text-icon";
          image.src = EVOLUTION_SYMBOL;
          image.alt = "진화 포인트";
          element.append(image);
        }
        element.append(part);
      }
    }

    function showHelpTooltip(button) {
      hideHelpTooltip();
      helpTooltipTarget = button;
      const host = button.closest("dialog[open]") || document.body;
      if (helpTooltip.parentElement !== host) host.append(helpTooltip);
      setEvolutionText(helpTooltip, button.dataset.help);
      if (button.dataset.helpHint) {
        const hint = document.createElement("span");
        hint.className = "help-tooltip-hint";
        hint.textContent = button.dataset.helpHint;
        helpTooltip.append(hint);
      }
      helpTooltip.hidden = false;
      button.setAttribute("aria-describedby", "help-tooltip");
      positionHelpTooltip();
    }

    document.querySelectorAll("[data-help]").forEach((button) => {
      button.addEventListener("pointerenter", () => showHelpTooltip(button));
      button.addEventListener("pointerleave", () => {
        if (document.activeElement !== button) hideHelpTooltip();
      });
      button.addEventListener("focus", () => showHelpTooltip(button));
      button.addEventListener("blur", hideHelpTooltip);
      button.addEventListener("click", () => showHelpTooltip(button));
    });
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-help]")) hideHelpTooltip();
    });
    const birthCostOutput = document.getElementById("birth-cost");
    const foodProgressFill = document.getElementById("food-progress-fill");
    const evolutionPointsOutput = document.getElementById("evolution-points");
    const grassGround = new Image();
    grassGround.src = assetSource("DesignAssets/Terrain/grassland-ground.png");
    const colonyGroundSprites = new Map();
    const colonyPollen = { periodMs: 18000, referenceSize: 512, particles: [
      { startMs: 500, lifeMs: 4500, x: 108, y: 272, driftX: 35, driftY: -39, radiusX: 1.5, radiusY: 2, opacity: 0.72 },
      { startMs: 1900, lifeMs: 4600, x: 383, y: 248, driftX: 33, driftY: -36, radiusX: 1.3, radiusY: 1.8, opacity: 0.68 },
      { startMs: 11600, lifeMs: 4800, x: 321, y: 374, driftX: 33, driftY: -43, radiusX: 1.45, radiusY: 1.95, opacity: 0.70 }
    ] };
    colonyPollen.particles.forEach(particle => {
      particle.sprite = createColonyPollenSprite(particle.radiusX, particle.radiusY);
    });
    const colonyGround = new Image();
    colonyGround.src = assetSource("DesignAssets/Terrain/nest-soil-ground.png");
    const foodSprite = new Image();
    foodSprite.src = assetSource("DesignAssets/Foods/food-mushroom-pile.png");
    const treeFruitSprite = new Image();
    treeFruitSprite.src = assetSource("DesignAssets/Foods/food-berry-bush.png");
    const carriedSoilSprite = new Image();
    carriedSoilSprite.src = assetSource("DesignAssets/Resources/clay-carry.png");
    const carriedFoodSprite = new Image();
    carriedFoodSprite.src = assetSource("DesignAssets/Foods/food-mushroom-single.png");
    const resourceSprites = new Map(Spawner.RESOURCE_TYPES.map(definition => {
      const sprite = new Image();
      sprite.src = definition.key === "honey-mushrooms" ? foodSprite.src : assetSource(definition.image);
      return [definition.key, sprite];
    }));
    const resourceCarrySprites = new Map(Spawner.RESOURCE_TYPES.map(definition => {
      const sprite = new Image();
      sprite.src = assetSource(definition.carryImage);
      return [definition.key, sprite];
    }));
    const resourceCarryBounds = new Map();
    const resourceHarvestSprites = new Map(Spawner.RESOURCE_HARVEST_ANIMATIONS.map(animation => {
      const sprite = new Image();
      sprite.src = assetSource(animation.image);
      return [animation.resourceType, { ...animation, sprite }];
    }));
    const harvestPlayback = Spawner.createHarvestPlayback();
    const harvestDisplay = { time: null, agents: null, rivals: null, cells: new Map(), poses: new Map() };
    const burrowAppearances = new Map([
      ["small", "DesignAssets/Burrows/beetle-burrow-small.png", { x:112, y:284, width:1048, height:734 }],
      ["large", "DesignAssets/Burrows/beetle-burrow-large.png", { x:41, y:194, width:1694, height:569 }]
    ].map(([type, source, crop]) => {
      const sprite = new Image();
      sprite.src = assetSource(source);
      return [type, { sprite, crop }];
    }));
    const foodIdle = { smooth: true, frameSize: 1024, frameCount: 1, frameMs: 50,
      restMs: 11800, breathMs: 6200, ready: Promise.resolve(), decodeError: null };
    const idleMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const idleStartedAt = performance.now();
    const colonyAppearances = [
      createColonyAppearance(assetSource("DesignAssets/Animations/Nests/nest-stage-01-idle-sheet.png")),
    ];
    colonyAppearances.forEach((appearance, index) => {
      appearance.groundWidth = [919][index] / 2048;
    });
    colonyAppearances[0].centerY = 384.5 / 512;
    colonyAppearances[0].top = 1181 / 2048;
    const selectionOutlineWidth = 1.2;
    const selectionColor = "#f4f7fa";
    const hoverColor = "#99e6cf";
    const selectionOutlines = new WeakMap();
    const foodSelectionShape = document.createElement("canvas");
    foodSelectionShape.width = 1;
    foodSelectionShape.height = 1;
    foodSelectionShape.getContext("2d").fillRect(0, 0, 1, 1);
    const starterObjectSprite = new Image();
    const agentSprites = new Map();
    const agentRenderingTasks = new Map();
    let agentRenderingQueue = Promise.resolve();
    const agentImageSources = new WeakMap();
    const combatSheets = new Map(Spawner.PLAYER_COMBAT_ANIMATIONS.map(animation => [animation.tribe,
      Object.fromEntries(["attack", "hurt"].map(action => {
        const sheet = new Image(); sheet.src = assetSource(animation[action]); return [action, sheet];
      }))]));
    const agentMovementSheets = new Map([
      ["spore", "DesignAssets/Tribes/spore/AnimationStudies/walk-v2/walk-v2.webp", 424, 300],
      ["pebble", "DesignAssets/Tribes/pebble/AnimationStudies/roll-v2/roll-v2.webp", 406, 300],
      ["spring", "DesignAssets/Tribes/spring/AnimationStudies/flow-v4/flow-v4.webp", 230, 300]
    ].map(([tribe, path, width, height]) => {
      const sprite = new Image();
      sprite.src = assetSource(path);
      return [tribe, { sprite, width, height, scale: 1 }];
    }));
    const attackSheet = new Image();
    attackSheet.src = assetSource(AGENT_ATTACK_ASSET);
    const agentDeathSheet = new Image();
    agentDeathSheet.src = assetSource(AGENT_DEATH_ANIMATION.image);
    const agentSpiritSprite = new Image();
    agentSpiritSprite.src = assetSource("DesignAssets/Effects/Lifespan/spirit-flame.png");
    const springBirthSheet = new Image();
    springBirthSheet.src = assetSource(SPRING_BIRTH_ANIMATION.image);
    const pebbleBirthSheet = new Image();
    pebbleBirthSheet.src = assetSource(PEBBLE_BIRTH_ANIMATION.image);
    const pebbleBirthForeground = new Image();
    pebbleBirthForeground.src = assetSource(PEBBLE_BIRTH_ANIMATION.foreground);
    const agentHeadMotions = new Map();
    const agentDisplayLayout = { time: null, agents: null, rivals: null, positions: [], offsets: new Map() };
    const agentCombatLayout = { time: null, agents: null, rivals: null, placements: new Map() };
    const agentSpriteSet = new WeakSet([starterObjectSprite]);
    const beetleSprite = new Image();
    agentSpriteSet.add(beetleSprite);
    beetleSprite.src = assetSource(globalThis.Spawner.BEETLE_NEUTRAL_ASSET);
    const beetleSheet = new Image();
    agentSpriteSet.add(beetleSheet);
    beetleSheet.src = assetSource(globalThis.Spawner.BEETLE_ANIMATION_ASSET);
    const beetleFrames = new Map();
    const talonOwlSheet = new Image();
    talonOwlSheet.src = assetSource(Spawner.TALON_OWL_IDLE.image);
    const talonOwlFrames = new Map();
    const encounterSprites = new Map();
    await Promise.all(Spawner.ENCOUNTER_TYPES.map(async type => {
      const image = new Image();
      image.src = assetSource(type.image);
      await image.decode();
      const crop = tribeArt.bounds(image, false);
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = 512;
      const scale = Math.min(480 / crop.width, 480 / crop.height);
      sprite.getContext("2d").drawImage(image, crop.x, crop.y, crop.width, crop.height, (512 - crop.width * scale) / 2, 496 - crop.height * scale, crop.width * scale, crop.height * scale);
      encounterSprites.set(type.key, sprite);
    }));
    starterObjectSprite.src = assetSource("DesignAssets/Units/starter-sprout-bean.png");

    const agentParts = new Map([
      ["strength-1", assetSource("DesignAssets/Units/Parts/strength-1.png")],
      ["strength-2", assetSource("DesignAssets/Units/Parts/strength-2.png")],
      ["feet-1", assetSource("DesignAssets/Units/Parts/feet-1.png")],
      ["feet-2", assetSource("DesignAssets/Units/Parts/feet-2.png")],
      ["antenna-1", assetSource("DesignAssets/Units/Parts/antenna-1.png")],
      ["antenna-2", assetSource("DesignAssets/Units/Parts/antenna-2.png")],
      ["lifespan-1", assetSource("DesignAssets/Units/Parts/lifespan-1.png")]
    ].map(([key, source]) => {
      const part = new Image();
      part.src = source;
      return [key, part];
    }));
    const agentBaseParts = new Map([
      ["body", assetSource("DesignAssets/Units/BaseParts/body.png")],
      ["sprout-left", assetSource("DesignAssets/Units/BaseParts/sprout-left.png")],
      ["sprout-right", assetSource("DesignAssets/Units/BaseParts/sprout-right.png")],
      ["sprout-stem", assetSource("DesignAssets/Units/BaseParts/sprout-stem.png")],
    ].map(([key, source]) => {
      const part = new Image();
      part.src = source;
      return [key, part];
    }));
    await Promise.all([starterObjectSprite, beetleSprite, beetleSheet, talonOwlSheet, attackSheet, agentSpiritSprite, foodSprite, treeFruitSprite, carriedFoodSprite,
      ...resourceCarrySprites.values(), ...agentParts.values(), ...agentBaseParts.values(),
      ...[...burrowAppearances.values()].map(appearance => appearance.sprite)].map(part => part.decode()));

    for (const [type, sprite] of resourceCarrySprites) resourceCarryBounds.set(type, tribeArt.bounds(sprite, false));

    for (const index of new Set(Object.values(Spawner.BEETLE_ANIMATIONS).flatMap(animation => animation.frames))) {
      const shape = Spawner.BEETLE_SPRITE;
      const frame = document.createElement("canvas");
      frame.width = shape.frameSize;
      frame.height = shape.frameSize;
      frame.getContext("2d").drawImage(beetleSheet, index % shape.columns * shape.frameSize,
        Math.floor(index / shape.columns) * shape.frameSize, shape.frameSize, shape.frameSize,
        0, 0, shape.frameSize, shape.frameSize);
      beetleFrames.set(index, frame);
      agentSpriteSet.add(frame);
    }

    for (let index = 0; index < Spawner.TALON_OWL_IDLE.frameCount; index++) {
      const shape = Spawner.TALON_OWL_IDLE;
      const frame = document.createElement("canvas");
      frame.width = frame.height = shape.frameSize;
      frame.getContext("2d").drawImage(talonOwlSheet, index % shape.columns * shape.frameSize,
        Math.floor(index / shape.columns) * shape.frameSize, shape.frameSize, shape.frameSize,
        0, 0, shape.frameSize, shape.frameSize);
      talonOwlFrames.set(index, frame);
      agentSpriteSet.add(frame);
    }

    for (const animation of resourceHarvestSprites.values()) {
      animation.frames = new Map();
      animation.sprite.decode().then(() => {
        for (const index of [0, animation.settleFrame]) {
          const frame = document.createElement("canvas");
          frame.width = animation.frameSize;
          frame.height = animation.frameSize;
          frame.getContext("2d").drawImage(animation.sprite, index % animation.columns * animation.frameSize,
            Math.floor(index / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize,
            0, 0, animation.frameSize, animation.frameSize);
          animation.frames.set(index, frame);
        }
      }).catch(() => {});
    }

    await Promise.all(colonyAppearances.map(initializeColonyLight));

    const WORLD_SIZE = 320;
    const worldMap = { terrain: new Uint8Array(WORLD_SIZE * WORLD_SIZE), burrows: [], food: [], origin: { x: 160, y: 160 } };
    const forest = { sprite: new Image(), trees: [], cells: new Map(), steps: new Map(), shakes: new Map(), parts: [], time: null, bounds: [
      { left: 0.087017, top: 0.09116, right: 0.972376, bottom: 0.964088 },
      { left: 0.093923, top: 0.016575, right: 0.907459, bottom: 0.964088 },
      { left: 0.055249, top: 0.13674, right: 0.929558, bottom: 0.964088 }
    ] };
    forest.sprite.src = assetSource("DesignAssets/Terrain/standing-tree-smooth-atlas.png");
    const hazardGroundSprites = ["DesignAssets/Terrain/poison-spore-ground.png", "DesignAssets/Terrain/thorn-root-ground.png"].map(source => {
      const sprite = new Image();
      sprite.src = assetSource(source);
      return sprite;
    });
    const hazardCells = [];
    const hazardGroundTiles = new Map();
    await Promise.all([forest.sprite, ...hazardGroundSprites].map(sprite => sprite.decode()));

    const COLONY_SIZE = 5;
    const COLONY_ORIGIN = {
      x: worldMap.origin.x - Math.floor(COLONY_SIZE / 2),
      y: worldMap.origin.y - Math.floor(COLONY_SIZE / 2)
    };
    const COLONY_CENTER = {
      x: COLONY_ORIGIN.x + COLONY_SIZE / 2,
      y: COLONY_ORIGIN.y + COLONY_SIZE / 2
    };
    const colonyEntries = [{
      id: 1,
      name: "둥지 1",
      nestLevel: 1,
      x: COLONY_ORIGIN.x,
      y: COLONY_ORIGIN.y,
      occupiedCells: new Set([
        "1,0", "2,0", "3,0",
        "0,1", "1,1", "2,1", "3,1", "4,1",
        "0,2", "1,2", "2,2", "3,2", "4,2",
        "0,3", "1,3", "2,3", "3,3", "4,3",
        "1,4", "2,4", "3,4"
      ])
    }];

    function colonyAt(x, y) {
      return colonyEntries.find((entry) =>
        entry.nestHealth !== 0 && entry.occupiedCells.has((x - entry.x) + "," + (y - entry.y))
      ) || null;
    }

    const ZOOM_LAYERS = [144, 36, 8, null];
    const MIN_ZOOM = 0.1;
    const INITIAL_ZOOM = ZOOM_LAYERS[0];
    const MAX_ZOOM = INITIAL_ZOOM;
    const viewport = { width: 0, height: 0, pixelRatio: 0 };
    const TERRAIN_COLORS = {
      land: "#171d1b",
      grassland: "#2b3a29",
      forest: "#34271e",
      lowMountain: "#263029",
      highMountain: "#374139",
      ridge: "#4b554c",
      swamp: "#56562b",
      coast: "#10282d",
      shallow: "#0b1e29",
      deep: "#06131d"
    };
    const terrainGrounds = Object.fromEntries([["land",assetSource("DesignAssets/Terrain/land-ground.png")],["forest",assetSource("DesignAssets/Terrain/forest-ground.png")],["swamp",assetSource("DesignAssets/Terrain/swamp-ground.png")],["lowMountain",assetSource("DesignAssets/Terrain/low-mountain-ground.png")],["highMountain",assetSource("DesignAssets/Terrain/high-mountain-ground.png")],["ridge",assetSource("DesignAssets/Terrain/ridge-ground.png")],["coast",assetSource("DesignAssets/Terrain/coast-ground.png")],["shallow",assetSource("DesignAssets/Terrain/shallow-water-ground.png")],["deep",assetSource("DesignAssets/Terrain/deep-water-ground.png")]].map(([terrain, source]) => {
      const image = new Image();
      image.src = source;
      return [terrain, image];
    }));
    const AGENT_SPEED = 1;
    const AGENT_CAPACITY = 2;
    const AGENT_VISION = 3;
    const AGENT_HEIGHT = 0.7;
    const AGENT_JUMP_PREPARATION = 0.18;
    const AGENT_FOOTSTEPS_PER_CELL = 4;

    const FOOD_REGION_SIZE = 18;
    const FOOD_SPRITE_WIDTH = 0.62;
    const FOOD_PER_CELL = 50;
    const FOOD_SCENT_RADIUS = 6;
    const FOOD_SCENT_GUIDANCE_CHANCE = 0.82;
    const SHARED_TRAIL_FOLLOW_CHANCE = 0.86;
    const FOOD_COLORS = {
      land: "rgba(137, 153, 83, 0.72)",
      grassland: "rgba(169, 185, 92, 0.82)",
      forest: "rgba(169, 185, 92, 0.82)",
      lowMountain: "rgba(137, 153, 83, 0.72)"
    };
    const foodSpotCache = new Map();
    const foodCellMap = new Map();
    const foodDeliveries = new Map();
    const agentMovements = new Map();
    const MOVEMENT_DELAY = 0.15;
    const TERRAIN_TYPES = [
      "deep", "shallow", "coast", "land", "grassland",
      "forest", "lowMountain", "highMountain", "ridge", "swamp"
    ];
    const terrainRendering = {
      types: new Uint8Array(WORLD_SIZE * WORLD_SIZE),
      edges: new Uint8Array(WORLD_SIZE * WORLD_SIZE),
      colors: TERRAIN_TYPES.map(type => TERRAIN_COLORS[type].slice(1).match(/../g).map(value => parseInt(value, 16))),
      grounds: new Map(), atlases: [], slots: new Int32Array(WORLD_SIZE * WORLD_SIZE).fill(-1),
      overview: null, medium: new Map(), forest: new Map(), revealed: new Uint8Array(WORLD_SIZE * WORLD_SIZE),
      regions: new Set(), regionPath: new Path2D(), phase: 0, resolution: 64, key: null, forestKeys: new Map(), ready: false
    };
    forest.revealed = new Map();
    forest.regions = new Set();
    forest.overrides = new Map();
    forest.cacheWrite = Promise.resolve();
    forest.cacheKey = null;
    forest.seed = null;
    forest.colonies = [];

    const state = {
      camera: {
        x: COLONY_CENTER.x,
        y: COLONY_CENTER.y,
        zoom: INITIAL_ZOOM,
        layer: 0,
        followAgentId: null
      },
      simSeconds: 0,
      lastFrame: performance.now(),
      flashes: [],
      colonyFood: 0,
      evolutionPoints: 0,
      resourceInventory: {},
      explored: new Set(), visible: new Set(), markers: [],
      discoveries: [], discoveryReadCount: 0,
      nestLevel: 1,
      templates: [],
      nextTemplateId: 1,
      selectedTemplateId: null,
      rivals: [],
      corpses: [],
      nextRivalAt: null,
      selection: null,
      hover: null,
      hoverPointer: null,
      nextAgentId: 1,
      agents: [],
      roads: new Map(),
      sharedTrails: new Map(),
      footprints: new Map(),
      footprintLifetime: 0,
      draftProfile: {
        direction: 0.65,
        novelty: 0.7,
        richness: 0.45,
        memoryTrips: 8,
        routeSense: 0.55
      },
      dragging: false,
      dragStart: { x: 0, y: 0 },
      dragOffset: { x: 0, y: 0 },
      cameraStart: { x: 0, y: 0 }
    };

    let zoomTransition = null;
    let cameraTransition = null;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function hashNoise(x, y) {
      let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    }

    function terrainAt(x, y) {
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return "deep";
      return TERRAIN_TYPES[worldMap.terrain[y * WORLD_SIZE + x]];
    }

    function foodSpotForRegion(regionX, regionY) {
      return foodSpotCache.get(regionX + "," + regionY) || { cells: [] };
    }

    function ensureFoodAround(x, y, radius) {
      const startRegionX = Math.floor((x - radius) / FOOD_REGION_SIZE);
      const startRegionY = Math.floor((y - radius) / FOOD_REGION_SIZE);
      const endRegionX = Math.floor((x + radius) / FOOD_REGION_SIZE);
      const endRegionY = Math.floor((y + radius) / FOOD_REGION_SIZE);

      for (let regionY = startRegionY; regionY <= endRegionY; regionY += 1) {
        for (let regionX = startRegionX; regionX <= endRegionX; regionX += 1) {
          foodSpotForRegion(regionX, regionY);
        }
      }
    }

    function foodCellAt(x, y) {
      ensureFoodAround(x, y, 1);
      const spot = foodSpotCache.get(Math.floor(x / FOOD_REGION_SIZE) + "," + Math.floor(y / FOOD_REGION_SIZE));
      return spot?.cells.findLast(cell => cell.x === x && cell.y === y && cell.key && cell.amount > 0) ||
        foodCellMap.get(x + "," + y) || null;
    }

    function isWalkable(x, y) {
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE || colonyAt(x, y)) {
        return false;
      }
      const terrain = terrainAt(x, y);
      return terrain === "coast" ||
        terrain === "land" ||
        terrain === "grassland" ||
        terrain === "forest" ||
        terrain === "lowMountain" || terrain === "highMountain" || terrain === "ridge";
    }

    function worldToScreen(x, y) {
      return {
        x: viewport.width / 2 + (x - state.camera.x) * state.camera.zoom,
        y: viewport.height / 2 + (y - state.camera.y) * state.camera.zoom
      };
    }

    function screenToWorld(x, y) {
      return {
        x: state.camera.x + (x - viewport.width / 2) / state.camera.zoom,
        y: state.camera.y + (y - viewport.height / 2) / state.camera.zoom
      };
    }

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      viewport.width = rect.width;
      viewport.height = rect.height;
      viewport.pixelRatio = dpr;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state.camera.layer === ZOOM_LAYERS.length - 1 && rect.width > 0 && rect.height > 0) {
        zoomTransition = null;
        stopCameraTransition();
        state.camera.zoom = zoomForLayer(state.camera.layer);
        state.camera.x = WORLD_SIZE / 2;
        state.camera.y = WORLD_SIZE / 2;
      }
    }

    function drawGrid() {
      const zoom = state.camera.zoom;
      const gridStep = zoom >= 28 ? 1 : zoom >= 14 ? 2 : zoom >= 6 ? 5 : zoom >= 3 ? 10 : 20;
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(viewport.width, viewport.height);
      const startX = Math.floor(topLeft.x / gridStep) * gridStep;
      const startY = Math.floor(topLeft.y / gridStep) * gridStep;

      const pixelRatio = viewport.pixelRatio;
      const lineWidth = Math.max(1, Math.round(pixelRatio));
      const offset = lineWidth % 2 * 0.5;
      ctx.lineWidth = lineWidth / pixelRatio;
      ctx.strokeStyle = "rgba(151, 173, 150, 0.16)";
      ctx.beginPath();

      for (let x = startX; x <= bottomRight.x; x += gridStep) {
        const screen = (Math.round(worldToScreen(x, 0).x * pixelRatio) + offset) / pixelRatio;
        ctx.moveTo(screen, 0);
        ctx.lineTo(screen, viewport.height);
      }

      for (let y = startY; y <= bottomRight.y; y += gridStep) {
        const screen = (Math.round(worldToScreen(0, y).y * pixelRatio) + offset) / pixelRatio;
        ctx.moveTo(0, screen);
        ctx.lineTo(viewport.width, screen);
      }

      ctx.stroke();
    }

    function updateTerrainRendering(seed) {
      const rendering = terrainRendering;
      rendering.key = null;
      rendering.phase = (seed >>> 0) % 4096 * 0.013;
      for (const atlas of rendering.atlases) if (atlas) { atlas.surface.close(); atlas.ground.close(); }
      if (rendering.overview) rendering.overview.close();
      for (const images of rendering.medium.values()) { images.surface.close(); images.ground.close(); }
      rendering.atlases = [];
      rendering.overview = null;
      rendering.medium.clear();
      rendering.slots.fill(-1);
      rendering.edges.fill(0);
      rendering.types.set(worldMap.terrain);
      for (let y = 0; y < WORLD_SIZE; y++) for (let x = 0; x < WORLD_SIZE; x++) {
        const index = y * WORLD_SIZE + x;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const neighbor = clamp(y + oy, 0, WORLD_SIZE - 1) * WORLD_SIZE + clamp(x + ox, 0, WORLD_SIZE - 1);
          if (rendering.types[neighbor] !== rendering.types[index]) rendering.edges[index] = 1;
        }
      }
    }

    function terrainGroundPixels(type) {
      if (terrainRendering.grounds.has(type)) return terrainRendering.grounds.get(type);
      const ground = type === 4 ? grassGround : terrainGrounds[TERRAIN_TYPES[type]];
      if (!ground?.complete || !ground.naturalWidth) return null;
      const surface = document.createElement("canvas");
      surface.width = surface.height = 384;
      const context = surface.getContext("2d");
      context.drawImage(ground, 0, 0, surface.width, surface.height);
      const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
      terrainRendering.grounds.set(type, pixels);
      return pixels;
    }

    function createTerrainSamples(rendering, resolution) {
      const length = 320 * resolution;
      const columns = new Float64Array(length * 12), rows = new Float64Array(length * 12);
      for (let index = 0; index < length; index++) {
        const value = (index + 0.5) / resolution, offset = index * 12;
        const phase = rendering.phase;
        columns[offset] = rows[offset] = value;
        columns[offset + 1] = Math.sin(Math.sin(value * 2.3));
        columns[offset + 2] = Math.cos(Math.sin(value * 2.3));
        columns[offset + 3] = Math.sin(value * 9.2 - phase);
        columns[offset + 4] = Math.cos(value * 9.2 - phase);
        columns[offset + 5] = Math.sin(value * 7.3 - phase);
        columns[offset + 6] = Math.cos(value * 7.3 - phase);
        columns[offset + 7] = Math.sin(value * 19.1 + phase);
        columns[offset + 8] = Math.cos(value * 19.1 + phase);
        rows[offset + 1] = Math.sin(value * 8.1 + phase);
        rows[offset + 2] = Math.cos(value * 8.1 + phase);
        rows[offset + 3] = Math.sin(value * 21.7);
        rows[offset + 4] = Math.cos(value * 21.7);
        rows[offset + 5] = Math.sin(Math.sin(value * 2.1));
        rows[offset + 6] = Math.cos(Math.sin(value * 2.1));
        rows[offset + 7] = Math.sin(-value * 6.7);
        rows[offset + 8] = Math.cos(-value * 6.7);
        columns[offset + 9] = Math.floor(value * 96) % 384 * 4;
        rows[offset + 9] = Math.floor(value * 96) % 384 * 384 * 4;
        columns[offset + 10] = Math.max(0, Math.floor(value - 0.35));
        columns[offset + 11] = Math.min(319, Math.floor(value + 0.35));
        rows[offset + 10] = columns[offset + 10] * 320;
        rows[offset + 11] = columns[offset + 11] * 320;
      }
      return { columns, rows };
    }

    function createTerrainPatch(rendering, x, y, width, height, resolution, textured) {
      const WORLD_SIZE = 320;
      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
      const pixelsWidth = width * resolution, pixelsHeight = height * resolution;
      const colors = new ImageData(pixelsWidth, pixelsHeight);
      const texture = textured ? new ImageData(pixelsWidth, pixelsHeight) : null;
      const grounds = rendering.grounds, palette = rendering.colors, terrain = rendering.types;
      if (!rendering.samples) rendering.samples = new Map();
      if (!rendering.samples.has(resolution)) rendering.samples.set(resolution, createTerrainSamples(rendering, resolution));
      const { columns, rows } = rendering.samples.get(resolution);
      const types = new Uint8Array(4), weights = new Float64Array(4);
      for (let py = 0; py < pixelsHeight; py++) {
        const cy = (y * resolution + py) * 12, wy = rows[cy];
        const flatTop = rows[cy + 10], flatBottom = rows[cy + 11];
        for (let px = 0; px < pixelsWidth; px++) {
          const cx = (x * resolution + px) * 12, wx = columns[cx];
          const offset = (py * pixelsWidth + px) * 4, sample = rows[cy + 9] + columns[cx + 9];
          const flatLeft = columns[cx + 10], flatRight = columns[cx + 11];
          const flatType = terrain[flatTop + flatLeft];
          if (flatType === terrain[flatTop + flatRight] && flatType === terrain[flatBottom + flatLeft] &&
              flatType === terrain[flatBottom + flatRight]) {
            const color = palette[flatType], ground = grounds[flatType];
            colors.data[offset] = color[0]; colors.data[offset + 1] = color[1]; colors.data[offset + 2] = color[2];
            colors.data[offset + 3] = 255;
            if (textured) {
              const alpha = ground ? ground[sample + 3] / 255 : 0;
              for (let channel = 0; channel < 3; channel++) texture.data[offset + channel] =
                ground ? ground[sample + channel] * alpha + color[channel] * (1 - alpha) : color[channel];
              texture.data[offset + 3] = 255;
            }
            continue;
          }
          const warpedX = wx + (rows[cy + 1] * columns[cx + 2] + rows[cy + 2] * columns[cx + 1]) * 0.075 +
            (rows[cy + 3] * columns[cx + 4] + rows[cy + 4] * columns[cx + 3]) * 0.018 - 0.5;
          const warpedY = wy + (columns[cx + 5] * rows[cy + 6] + columns[cx + 6] * rows[cy + 5]) * 0.075 +
            (columns[cx + 7] * rows[cy + 8] + columns[cx + 8] * rows[cy + 7]) * 0.018 - 0.5;
          const ix = Math.floor(warpedX), iy = Math.floor(warpedY);
          const left = clamp(ix, 0, WORLD_SIZE - 1), right = clamp(ix + 1, 0, WORLD_SIZE - 1);
          const top = clamp(iy, 0, WORLD_SIZE - 1) * WORLD_SIZE;
          const bottom = clamp(iy + 1, 0, WORLD_SIZE - 1) * WORLD_SIZE;
          types[0] = terrain[top + left]; types[1] = terrain[top + right];
          types[2] = terrain[bottom + right]; types[3] = terrain[bottom + left];
          const spread = 0.24;
          let tx = clamp((warpedX - ix - 0.5 + spread) / (spread * 2), 0, 1);
          let ty = clamp((warpedY - iy - 0.5 + spread) / (spread * 2), 0, 1);
          tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          weights[0] = (1 - tx) * (1 - ty); weights[1] = tx * (1 - ty);
          weights[2] = tx * ty; weights[3] = (1 - tx) * ty;
          let red = 0, green = 0, blue = 0, detailRed = 0, detailGreen = 0, detailBlue = 0;
          for (let neighbor = 0; neighbor < 4; neighbor++) {
            const weight = weights[neighbor];
            if (!weight) continue;
            const type = types[neighbor], color = palette[type];
            red += color[0] * weight; green += color[1] * weight; blue += color[2] * weight;
            if (textured) {
              const ground = grounds[type], alpha = ground ? ground[sample + 3] / 255 : 0;
              detailRed += (ground ? ground[sample] * alpha + color[0] * (1 - alpha) : color[0]) * weight;
              detailGreen += (ground ? ground[sample + 1] * alpha + color[1] * (1 - alpha) : color[1]) * weight;
              detailBlue += (ground ? ground[sample + 2] * alpha + color[2] * (1 - alpha) : color[2]) * weight;
            }
          }
          colors.data[offset] = red; colors.data[offset + 1] = green; colors.data[offset + 2] = blue; colors.data[offset + 3] = 255;
          if (textured) {
            texture.data[offset] = detailRed; texture.data[offset + 1] = detailGreen;
            texture.data[offset + 2] = detailBlue; texture.data[offset + 3] = 255;
          }
        }
      }
      return { colors, texture };
    }

    function drawForestTree(context, tree, sprite, resolution) {
      const size = sprite.height;
      const height = tree.height * resolution;
      context.save();
      context.translate(tree.x * resolution, tree.y * resolution);
      if (tree.mirrored) context.scale(-1, 1);
      context.drawImage(sprite, tree.frame * size, 0, size, size,
        -height / 2, -height * 0.94, height, height);
      context.restore();
    }

    function buildTerrainAtlas() {
      self.onmessage = async event => {
        try {
          const { rendering, start, indices } = event.data, resolution = rendering.resolution;
          const surface = new OffscreenCanvas(32 * resolution, Math.ceil(indices.length / 32) * resolution);
          const ground = new OffscreenCanvas(surface.width, surface.height);
          const context = surface.getContext("2d"), texture = ground.getContext("2d");
          for (let offset = 0; offset < indices.length; offset++) {
            const index = indices[offset];
            const patch = createTerrainPatch(rendering, index % 320, Math.floor(index / 320), 1, 1, resolution, true);
            const x = offset % 32 * resolution, y = Math.floor(offset / 32) * resolution;
            context.putImageData(patch.colors, x, y);
            texture.putImageData(patch.texture, x, y);
          }
          const [surfaceBlob, groundBlob] = await Promise.all([
            surface.convertToBlob({ type: "image/png" }), ground.convertToBlob({ type: "image/png" })
          ]);
          const image = surface.transferToImageBitmap(), detail = ground.transferToImageBitmap();
          postMessage({ start, indices, surfaceBlob, groundBlob, surface: image, ground: detail }, [image, detail]);
        } catch (error) { postMessage({ error: error.message }); }
      };
    }

    function buildTerrainImages() {
      self.onmessage = async event => {
        const data = event.data, rendering = data.rendering, records = [];
        let database = null, cached = null, cachedImages = false;
        async function transaction(mode, action) {
          return new Promise((resolve, reject) => {
            const task = database.transaction("maps", mode), result = action(task.objectStore("maps"));
            task.oncomplete = () => resolve(result?.result);
            task.onabort = () => reject(task.error);
            task.onerror = () => {};
          });
        }
        async function emit(message, surfaces) {
          const record = { ...message }, transfer = [];
          for (const [name, surface] of Object.entries(surfaces)) {
            record[name] = await surface.convertToBlob({ type: "image/png" });
            message[name] = surface.transferToImageBitmap();
            transfer.push(message[name]);
          }
          if (data.layer === "forest") records[message.index] = record;
          else records.push(record);
          postMessage(message, transfer);
        }
        async function emitRegions(type, sources) {
          for (let start = 0; start < 400; start += 8) {
            const tasks = [];
            for (let index = start; index < Math.min(400, start + 8); index++) {
              const surfaces = {};
              for (const [name, context] of Object.entries(sources)) {
                const surface = new OffscreenCanvas(256, 256);
                surface.getContext("2d").putImageData(context.getImageData(index % 20 * 256, Math.floor(index / 20) * 256, 256, 256), 0, 0);
                surfaces[name] = surface;
              }
              tasks.push(emit({ type, index }, surfaces));
            }
            await Promise.all(tasks);
          }
        }
        try {
          let chunks;
          if (data.layer === "forest") {
            const spriteSurface = new OffscreenCanvas(data.sprite.width, data.sprite.height);
            const spriteContext = spriteSurface.getContext("2d");
            spriteContext.drawImage(data.sprite, 0, 0);
            chunks = [spriteContext.getImageData(0, 0, spriteSurface.width, spriteSurface.height).data];
          } else chunks = [Uint8Array.from(rendering.colors.flat()), ...rendering.grounds.filter(Boolean)];
          const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
          const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
          data.key += ":" + [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
          try {
            database = await new Promise((resolve, reject) => {
              const request = indexedDB.open("spawner-rendering", 1);
              request.onupgradeneeded = () => request.result.createObjectStore("maps", { keyPath: "key" });
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
              request.onblocked = () => reject(new Error("Cache unavailable"));
            });
            cached = await transaction("readonly", store => store.get(data.key));
            if (data.layer === "terrain" && cached?.records?.length) {
              postMessage({ type: "status", cached: true });
              const decoded = [];
              try {
                for (let start = 0; start < cached.records.length; start += 8) {
                  const results = await Promise.allSettled(cached.records.slice(start, start + 8).map(async record => {
                    const message = { ...record }, transfer = [];
                    decoded.push({ message, transfer });
                    for (const name of ["image", "surface", "ground"]) if (record[name] instanceof Blob) {
                      message[name] = await createImageBitmap(record[name]);
                      transfer.push(message[name]);
                    }
                  }));
                  const failed = results.find(result => result.status === "rejected");
                  if (failed) throw failed.reason;
                }
                for (const item of decoded) postMessage(item.message, item.transfer);
                postMessage({ type: "done", cached: true });
                return;
              } catch {
                for (const item of decoded) for (const image of item.transfer) image.close();
              }
            }
          } catch { database?.close(); database = null; }

          if (data.layer === "terrain") {
            postMessage({ type: "status", cached: false });
            const overview = new OffscreenCanvas(1280, 1280);
            overview.getContext("2d").putImageData(createTerrainPatch(rendering, 0, 0, 320, 320, 4, false).colors, 0, 0);
            await emit({ type: "overview" }, { image: overview });
            const edges = [];
            for (let index = 0; index < rendering.edges.length; index++) if (rendering.edges[index]) edges.push(index);
            const medium = new OffscreenCanvas(5120, 5120), mediumGround = new OffscreenCanvas(5120, 5120);
            const mediumContext = medium.getContext("2d"), mediumTexture = mediumGround.getContext("2d");
            mediumContext.imageSmoothingQuality = mediumTexture.imageSmoothingQuality = "high";
            const grounds = rendering.grounds.map(pixels => {
              if (!pixels) return null;
              const surface = new OffscreenCanvas(384, 384);
              surface.getContext("2d").putImageData(new ImageData(pixels, 384, 384), 0, 0);
              return surface;
            });
            for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
              const type = rendering.types[y * 320 + x], color = rendering.colors[type];
              mediumContext.fillStyle = mediumTexture.fillStyle = "rgb(" + color.join(",") + ")";
              mediumContext.fillRect(x * 16, y * 16, 16, 16);
              mediumTexture.fillRect(x * 16, y * 16, 16, 16);
              if (grounds[type]) mediumTexture.drawImage(grounds[type], x % 4 * 96, y % 4 * 96, 96, 96, x * 16, y * 16, 16, 16);
            }
            const program = createTerrainSamples.toString() + "\n" + createTerrainPatch.toString() +
              "\n(" + buildTerrainAtlas.toString() + ")();";
            const url = URL.createObjectURL(new Blob([program], { type: "text/javascript" }));
            const workers = [];
            let next = 0, completed = 0;
            try {
              await new Promise((resolve, reject) => {
                if (!edges.length) { resolve(); return; }
                function dispatch(worker) {
                  if (next >= edges.length) return;
                  const start = next;
                  next += 1024;
                  worker.postMessage({ rendering, start, indices: edges.slice(start, start + 1024) });
                }
                const count = Math.min(Math.ceil(edges.length / 1024), 4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
                for (let index = 0; index < count; index++) {
                  const worker = new Worker(url);
                  workers.push(worker);
                  worker.onerror = event => reject(new Error(event.message));
                  worker.onmessage = event => {
                    const message = event.data;
                    if (message.error) { reject(new Error(message.error)); return; }
                    const resolution = rendering.resolution;
                    for (let offset = 0; offset < message.indices.length; offset++) {
                      const cell = message.indices[offset], x = cell % 320 * 16, y = Math.floor(cell / 320) * 16;
                      const sx = offset % 32 * resolution, sy = Math.floor(offset / 32) * resolution;
                      mediumContext.drawImage(message.surface, sx, sy, resolution, resolution, x, y, 16, 16);
                      mediumTexture.drawImage(message.ground, sx, sy, resolution, resolution, x, y, 16, 16);
                    }
                    completed += message.indices.length;
                    const record = { type: "atlas", start: message.start, indices: message.indices,
                      progress: completed / edges.length, surface: message.surfaceBlob, ground: message.groundBlob };
                    records.push(record);
                    postMessage({ ...record, surface: message.surface, ground: message.ground }, [message.surface, message.ground]);
                    if (completed === edges.length) resolve();
                    else dispatch(worker);
                  };
                  dispatch(worker);
                }
              });
            } finally {
              for (const worker of workers) worker.terminate();
              URL.revokeObjectURL(url);
            }
            await emitRegions("medium", { surface: mediumContext, ground: mediumTexture });
          } else {
            for (const record of cached?.records || []) if (record) records[record.index] = record;
            const missing = [];
            postMessage({ type: "status", cached: true });
            for (let start = 0; start < data.regions.length; start += 8) {
              await Promise.all(data.regions.slice(start, start + 8).map(async region => {
                const record = records[region.index];
                if (record?.key === region.key && record.image instanceof Blob) {
                  try {
                    const image = await createImageBitmap(record.image);
                    postMessage({ ...record, image }, [image]);
                    return;
                  } catch {}
                }
                missing.push(region);
              }));
            }
            cachedImages = missing.length === 0;
            if (missing.length) postMessage({ type: "status", cached: false });
            for (let start = 0; start < missing.length; start += 8) {
              await Promise.all(missing.slice(start, start + 8).map(async region => {
                const surface = new OffscreenCanvas(256, 256);
                const context = surface.getContext("2d");
                context.translate(-(region.index % 20) * 256, -Math.floor(region.index / 20) * 256);
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = "high";
                for (const tree of region.trees) drawForestTree(context, tree, data.sprite, 16);
                await emit({ type: "forest", index: region.index, key: region.key }, { image: surface });
              }));
            }
          }
          if (database) {
            try {
              await transaction("readwrite", store => store.put({ key: data.key, layer: data.layer, savedAt: Date.now(), records: records.filter(Boolean) }));
              const maps = (await transaction("readonly", store => store.getAll())).filter(map => map.layer === data.layer);
              maps.sort((a, b) => b.savedAt - a.savedAt);
              for (const map of maps.slice(2)) await transaction("readwrite", store => store.delete(map.key));
            } catch {}
          }
          postMessage({ type: "done", cached: cachedImages, key: data.key });
        } catch (error) { postMessage({ type: "error", message: error.message }); }
        finally { data.sprite?.close(); database?.close(); }
      };
    }

    const terrainWorkerSource = createTerrainSamples.toString() + "\n" + createTerrainPatch.toString() + "\n" + drawForestTree.toString() +
      "\n" + buildTerrainAtlas.toString() + "\n(" + buildTerrainImages.toString() + ")();";

    function prepareAgentRendering() {
      for (const agent of [...state.agents, ...state.rivals]) {
        if (agent.species) continue;
        const attributes = agent.appearanceAttributes || agent.attributes;
        for (const layer of agentSpriteLayers(attributes)) selectionContour(agentSprite(agent, layer), null);
      }
      for (let frame = 0; frame < 3; frame++) treeParts(frame);
      const surface = document.createElement("canvas");
      surface.width = surface.height = 64;
      const context = surface.getContext("2d");
      for (const image of [hazardCanvas, grassGround, ...Object.values(terrainGrounds)]) context.drawImage(image, 0, 0, 64, 64);
      context.getImageData(0, 0, 1, 1);
    }

    function forestTreeRegions(tree) {
      const regions = [];
      const left = Math.max(0, Math.floor((tree.x - tree.height / 2) / 16));
      const right = Math.min(19, Math.ceil((tree.x + tree.height / 2) / 16) - 1);
      const top = Math.max(0, Math.floor((tree.y - tree.height * 0.94) / 16));
      const bottom = Math.min(19, Math.ceil((tree.y + tree.height * 0.06) / 16) - 1);
      for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) regions.push(row * 20 + column);
      return regions;
    }

    function forestRegionKey(trees, seed) {
      let key = seed >>> 0;
      for (const tree of trees) key = Math.imul(key ^ (tree.row * WORLD_SIZE + tree.column), 16777619) >>> 0;
      return seed + ":" + trees.length + ":" + key;
    }

    function forestImageRegions(trees, seed) {
      const regions = Array.from({ length: 400 }, (value, index) => ({ index, trees: [] }));
      for (const tree of trees) for (const index of forestTreeRegions(tree)) regions[index].trees.push(tree);
      for (const region of regions) region.key = forestRegionKey(region.trees, seed);
      return regions;
    }

    async function prepareWorldRendering(world, colonies) {
      terrainRendering.ready = false;
      await forest.cacheWrite;
      forest.seed = world.seed;
      forest.colonies = colonies;
      updateRoomCreationProgress(40);
      worldMap.terrain = Uint8Array.from(world.terrain);
      worldMap.generationVersion = world.generationVersion;
      worldMap.hazards = Uint8Array.from(world.hazards || []);
      worldMap.burrows = world.burrows || [];
      worldMap.treeCells = world.treeCells ? Uint8Array.from(world.treeCells) : null;
      updateForest(world.seed, world.resourceCells);
      updateHazards(world.seed);
      let key = world.seed >>> 0;
      for (const type of worldMap.terrain) key = Math.imul(key ^ type, 16777619) >>> 0;
      const trees = forest.trees.filter(tree => !colonies.some(colony => {
        return tree.column >= colony.x && tree.column < colony.x + COLONY_SIZE &&
          tree.row >= colony.y && tree.row < colony.y + COLONY_SIZE;
      }));
      const regions = forestImageRegions(trees, world.seed);
      const changedRegions = regions.filter(region => terrainRendering.forestKeys.get(region.index) !== region.key ||
        !terrainRendering.forest.has(region.index));
      const terrainReady = terrainRendering.key === key && terrainRendering.overview && terrainRendering.medium.size === 400;
      const forestReady = changedRegions.length === 0;
      if (terrainReady && forestReady) {
        terrainRendering.ready = true;
        updateRoomCreationProgress(100);
        return;
      }
      setEvolutionText(welcomeStatus, (terrainReady ? "숲" : "고정 지형") + " 이미지 불러오는 중…");
      const images = [...(terrainReady ? [] : [grassGround, ...Object.values(terrainGrounds)]), ...(forestReady ? [] : [forest.sprite])];
      await Promise.all(images.map(image => image.decode()));
      const url = URL.createObjectURL(new Blob([terrainWorkerSource], { type: "text/javascript" }));
      const worker = new Worker(url);
      terrainRendering.cached = true;
      try {
        for (const layer of ["terrain", "forest"]) {
          if (layer === "terrain" ? terrainReady : forestReady) continue;
          const label = layer === "terrain" ? "고정 지형" : "숲";
          let action = "불러오는 중…";
          setEvolutionText(welcomeStatus, label + " 이미지 " + action);
          let data;
          if (layer === "terrain") {
            updateRoomCreationProgress(45);
            updateTerrainRendering(world.seed);
            const grounds = TERRAIN_TYPES.map((type, index) => terrainGroundPixels(index));
            data = { layer, key: "terrain-64-v4:" + world.seed + ":" + key,
              rendering: { types: terrainRendering.types, edges: terrainRendering.edges, colors: terrainRendering.colors,
                grounds, phase: terrainRendering.phase, resolution: terrainRendering.resolution } };
            updateRoomCreationProgress(50);
          } else {
            if (forest.bitmap) forest.bitmap.close();
            forest.bitmap = await createImageBitmap(forest.sprite);
            data = { layer, key: "forest-16-v2:" + world.seed, regions: changedRegions, sprite: await createImageBitmap(forest.bitmap) };
            updateRoomCreationProgress(90);
          }
          await new Promise((resolve, reject) => {
            worker.onerror = event => reject(new Error(event.message));
            worker.onmessage = event => {
              const message = event.data;
              if (message.type === "status") {
                action = message.cached ? "불러오는 중…" : "생성 중…";
                setEvolutionText(welcomeStatus, label + " 이미지 " + action);
              } else if (message.type === "overview") {
                terrainRendering.overview = message.image;
                updateRoomCreationProgress(52);
              } else if (message.type === "atlas") {
                terrainRendering.atlases[Math.floor(message.start / 1024)] = { surface: message.surface, ground: message.ground };
                message.indices.forEach((index, offset) => { terrainRendering.slots[index] = message.start + offset; });
                updateRoomCreationProgress(52 + message.progress * 28);
                setEvolutionText(welcomeStatus, label + " 이미지 " + action + " " + Math.floor(message.progress * 100) + "%");
              } else if (message.type === "medium") {
                terrainRendering.medium.set(message.index, { surface: message.surface, ground: message.ground });
                updateRoomCreationProgress(80 + terrainRendering.medium.size / 400 * 10);
              } else if (message.type === "forest") {
                terrainRendering.forest.get(message.index)?.close?.();
                terrainRendering.forest.set(message.index, message.image);
                terrainRendering.forestKeys.set(message.index, message.key);
                updateRoomCreationProgress(90 + terrainRendering.forest.size / 400 * 9);
              } else if (message.type === "done") {
                terrainRendering.cached &&= message.cached;
                if (layer === "forest") forest.cacheKey = message.key;
                resolve();
              } else if (message.type === "error") reject(new Error(message.message));
            };
            worker.postMessage(data, data.sprite ? [data.sprite] : []);
          });
          if (layer === "terrain") terrainRendering.key = key;
        }
      } finally { worker.terminate(); URL.revokeObjectURL(url); }
      terrainRendering.ready = true;
      updateRoomCreationProgress(100);
    }

    function revealForest(indices) {
      for (const index of indices) {
        const x = index % WORLD_SIZE, y = Math.floor(index / WORLD_SIZE);
        for (let row = Math.max(0, y - 2); row <= Math.min(WORLD_SIZE - 1, y + 2); row++) {
          for (let column = Math.max(0, x - 2); column <= Math.min(WORLD_SIZE - 1, x + 2); column++) {
            const key = row * WORLD_SIZE + column;
            terrainRendering.revealed[key] = 1;
            const region = Math.floor(row / 16) * 20 + Math.floor(column / 16);
            if (!terrainRendering.regions.has(region)) {
              terrainRendering.regions.add(region);
              terrainRendering.regionPath.rect(region % 20 * 16, Math.floor(region / 20) * 16, 16, 16);
            }
            if (forest.revealed.has(key)) continue;
            const tree = forest.cells.get(column + "," + row);
            if (!tree) continue;
            forest.revealed.set(key, tree);
            forest.regions.add(Math.floor(row / 16) * 20 + Math.floor(column / 16));
          }
        }
      }
    }

    function saveForestRegion(index, key, surface) {
      const cacheKey = forest.cacheKey;
      if (!cacheKey) return;
      const image = new Promise(resolve => {
        try { surface.toBlob(resolve, "image/png"); }
        catch { resolve(null); }
      });
      forest.cacheWrite = forest.cacheWrite.then(async () => {
        const blob = await image;
        if (!blob) return;
        const database = await new Promise((resolve, reject) => {
          const request = indexedDB.open("spawner-rendering", 1);
          request.onupgradeneeded = () => request.result.createObjectStore("maps", { keyPath: "key" });
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error("Cache unavailable"));
        });
        try {
          await new Promise((resolve, reject) => {
            const task = database.transaction("maps", "readwrite"), store = task.objectStore("maps");
            const request = store.get(cacheKey);
            request.onsuccess = () => {
              const records = new Map((request.result?.records || []).map(record => [record.index, record]));
              records.set(index, { type: "forest", index, key, image: blob });
              store.put({ key: cacheKey, layer: "forest", savedAt: Date.now(), records: [...records.values()] });
            };
            task.oncomplete = resolve;
            task.onabort = () => reject(task.error);
            task.onerror = () => {};
          });
        } finally { database.close(); }
      }).catch(() => {});
    }

    function updateForestRegion(column, row) {
      if (!terrainRendering.forest.size || !forest.bitmap) return;
      const regionX = Math.floor(column / 16) * 16, regionY = Math.floor(row / 16) * 16;
      const index = Math.floor(row / 16) * 20 + Math.floor(column / 16), trees = [];
      const surface = document.createElement("canvas");
      surface.width = surface.height = 256;
      const context = surface.getContext("2d");
      context.translate(-regionX * 16, -regionY * 16);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      for (let y = Math.max(0, regionY - 2); y < Math.min(WORLD_SIZE, regionY + 18); y++) {
        for (let x = Math.max(0, regionX - 2); x < Math.min(WORLD_SIZE, regionX + 18); x++) {
          const tree = forest.cells.get(x + "," + y);
          if (!tree || treeOverlapsColony(tree) || forest.colonies.some(colony => {
            return tree.column >= colony.x && tree.column < colony.x + COLONY_SIZE &&
              tree.row >= colony.y && tree.row < colony.y + COLONY_SIZE;
          }) || !forestTreeRegions(tree).includes(index)) continue;
          trees.push(tree);
          drawForestTree(context, tree, forest.bitmap, 16);
        }
      }
      const key = forestRegionKey(trees, forest.seed);
      terrainRendering.forest.get(index)?.close?.();
      terrainRendering.forest.set(index, surface);
      terrainRendering.forestKeys.set(index, key);
      forest.overrides.delete(index);
      saveForestRegion(index, key, surface);
    }

    function drawForestOverview(topLeft, bottomRight) {
      ctx.imageSmoothingQuality = "low";
      for (const index of forest.regions) {
        const x = index % 20 * 16, y = Math.floor(index / 20) * 16;
        if (x + 16 < topLeft.x || y + 16 < topLeft.y || x > bottomRight.x || y > bottomRight.y) continue;
        const point = worldToScreen(x, y), size = 16 * state.camera.zoom;
        const replacement = forest.overrides.get(index);
        if (replacement) ctx.drawImage(replacement, point.x, point.y, size, size);
        else ctx.drawImage(terrainRendering.forest.get(index), point.x, point.y, size, size);
      }
    }

    function clipExploredRegions() {
      const zoom = state.camera.zoom;
      ctx.translate(viewport.width / 2 - state.camera.x * zoom, viewport.height / 2 - state.camera.y * zoom);
      ctx.scale(zoom, zoom);
      ctx.clip(terrainRendering.regionPath);
      ctx.setTransform(viewport.pixelRatio, 0, 0, viewport.pixelRatio, 0, 0);
    }

    function drawTerrainOverview() {
      const a = screenToWorld(0, 0), b = screenToWorld(viewport.width, viewport.height);
      const left = Math.max(0, Math.floor(a.x)), top = Math.max(0, Math.floor(a.y));
      const right = Math.min(WORLD_SIZE, Math.ceil(b.x)), bottom = Math.min(WORLD_SIZE, Math.ceil(b.y));
      const point = worldToScreen(left, top), cell = state.camera.zoom;
      ctx.imageSmoothingEnabled = true;
      ctx.save();
      clipExploredRegions();
      if (right > left && bottom > top) ctx.drawImage(terrainRendering.overview,
        left * 4, top * 4, (right - left) * 4, (bottom - top) * 4,
        point.x, point.y, (right - left) * cell, (bottom - top) * cell);
      ctx.restore();
    }

    function drawTerrainMedium() {
      const a = screenToWorld(0, 0), b = screenToWorld(viewport.width, viewport.height);
      const left = Math.max(0, Math.floor(a.x / 16)), top = Math.max(0, Math.floor(a.y / 16));
      const right = Math.min(19, Math.floor(b.x / 16)), bottom = Math.min(19, Math.floor(b.y / 16));
      const size = 16 * state.camera.zoom;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
      for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) {
        if (!terrainRendering.regions.has(row * 20 + column)) continue;
        const image = terrainRendering.medium.get(row * 20 + column);
        const point = worldToScreen(column * 16, row * 16);
        const ratio = viewport.pixelRatio;
        const x = Math.round(point.x * ratio) / ratio, y = Math.round(point.y * ratio) / ratio;
        const width = Math.round((point.x + size) * ratio) / ratio - x;
        const height = Math.round((point.y + size) * ratio) / ratio - y;
        ctx.drawImage(image.surface, x, y, width, height);
      }
      ctx.save();
      ctx.globalAlpha = clamp((state.camera.zoom - 18) / 100, 0, 0.72);
      for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) {
        if (!terrainRendering.regions.has(row * 20 + column)) continue;
        const image = terrainRendering.medium.get(row * 20 + column);
        const point = worldToScreen(column * 16, row * 16);
        const ratio = viewport.pixelRatio;
        const x = Math.round(point.x * ratio) / ratio, y = Math.round(point.y * ratio) / ratio;
        const width = Math.round((point.x + size) * ratio) / ratio - x;
        const height = Math.round((point.y + size) * ratio) / ratio - y;
        ctx.drawImage(image.ground, x, y, width, height);
      }
      ctx.restore();
    }

    function drawTerrain() {
      if (state.camera.zoom <= 18) { drawTerrainOverview(); return; }
      if (state.camera.zoom <= 72) { drawTerrainMedium(); return; }
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(viewport.width, viewport.height);
      const cell = state.camera.zoom;
      const pixelRatio = viewport.pixelRatio;
      const terrainStep = cell >= 8 ? 1 : cell >= 4 ? 2 : 4;
      const startX = clamp(
        Math.floor(topLeft.x / terrainStep) * terrainStep,
        0,
        WORLD_SIZE - 1
      );
      const startY = clamp(
        Math.floor(topLeft.y / terrainStep) * terrainStep,
        0,
        WORLD_SIZE - 1
      );
      const endX = clamp(Math.ceil(bottomRight.x), 0, WORLD_SIZE - 1);
      const endY = clamp(Math.ceil(bottomRight.y), 0, WORLD_SIZE - 1);

      for (let y = startY; y <= endY; y += terrainStep) {
        for (let x = startX; x <= endX; x += terrainStep) {
          if (!terrainRendering.revealed[y * WORLD_SIZE + x]) continue;
          const screen = worldToScreen(x, y);
          const sampleX = clamp(
            x + Math.floor(terrainStep / 2),
            0,
            WORLD_SIZE - 1
          );
          const sampleY = clamp(
            y + Math.floor(terrainStep / 2),
            0,
            WORLD_SIZE - 1
          );
          const terrain = terrainAt(sampleX, sampleY);
          const next = worldToScreen(x + terrainStep, y + terrainStep);
          const left = Math.round(screen.x * pixelRatio) / pixelRatio;
          const top = Math.round(screen.y * pixelRatio) / pixelRatio;
          const right = Math.round(next.x * pixelRatio) / pixelRatio;
          const bottom = Math.round(next.y * pixelRatio) / pixelRatio;
          const slot = terrainRendering.slots[y * WORLD_SIZE + x];
          if (slot >= 0) {
            const atlas = terrainRendering.atlases[Math.floor(slot / 1024)], resolution = terrainRendering.resolution;
            const sx = slot % 32 * resolution, sy = Math.floor(slot % 1024 / 32) * resolution;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(atlas.surface, sx, sy, resolution, resolution, left, top, right - left, bottom - top);
            ctx.save();
            ctx.globalAlpha = clamp((cell - 18) / 100, 0, 0.72);
            ctx.drawImage(atlas.ground, sx, sy, resolution, resolution, left, top, right - left, bottom - top);
            ctx.restore();
            continue;
          }
          ctx.fillStyle = TERRAIN_COLORS[terrain];
          ctx.fillRect(left, top, right - left, bottom - top);
          const ground = terrain === "grassland" ? grassGround : terrainGrounds[terrain];
          if (cell > 18 && ground?.complete && ground.naturalWidth) {
            const sourceCell = ground.naturalWidth / 4;
            ctx.save();
            ctx.globalAlpha = clamp((cell - 18) / 100, 0, 0.72);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(ground, (x % 4) * sourceCell, (y % 4) * sourceCell, sourceCell, sourceCell,
              left, top, right - left, bottom - top);
            ctx.restore();
          }
        }
      }
    }

    function updateForest(seed, resourceCells) {
      forest.trees.length = 0;
      forest.cells.clear();
      forest.revealed.clear();
      forest.regions.clear();
      forest.overrides.clear();
      terrainRendering.revealed.fill(0);
      terrainRendering.regions.clear();
      terrainRendering.regionPath = new Path2D();
      forest.steps.clear();
      forest.shakes.clear();
      forest.time = null;
      const clearings = new Set((resourceCells || []).map(([x, y]) => x + "," + y));
      for (let row = 0; row < WORLD_SIZE; row++) {
        for (let column = 0; column < WORLD_SIZE; column++) {
          if (worldMap.treeCells && !worldMap.treeCells[row * WORLD_SIZE + column] ||
              terrainAt(column, row) !== "forest" || worldMap.hazards?.[row * WORLD_SIZE + column] ||
              clearings.has(column + "," + row)) continue;
          if (worldMap.burrows.some(burrow => column >= burrow.x && column < burrow.x + burrow.width &&
              row >= burrow.y && row < burrow.y + burrow.height)) continue;
          const variation = hashNoise(column + seed, row - seed);
          const height = 0.8 + variation * 0.12;
          const frame = Math.min(2, Math.floor(hashNoise(column + seed, row + 631) * 3));
          const mirrored = hashNoise(column + 97, row - seed) > 0.5;
          const bounds = forest.bounds[frame];
          const left = mirrored ? 1 - bounds.right : bounds.left;
          const right = mirrored ? 1 - bounds.left : bounds.right;
          const width = height * (right - left);
          const visibleHeight = height * (bounds.bottom - bounds.top);
          const x = column + height * (0.5 - left) + 0.01 +
            hashNoise(column + seed + 1201, row - seed - 97) * (0.98 - width);
          const y = row + height * (0.94 - bounds.top) + 0.01 +
            hashNoise(column - seed - 1709, row + seed + 313) * (0.98 - visibleHeight);
          const tree = { id: "tree:" + column + ":" + row, resourceType: "tree", harvestLocked: true, column, row, x, y, height, frame, mirrored };
          forest.trees.push(tree);
          forest.cells.set(column + "," + row, tree);
        }
      }
    }

    function recordTreeSway(x, y, at, dx, dy) {
      const tree = forest.cells.get(x + "," + y);
      if (tree) forest.shakes.set(tree.id, { at, direction: Math.sign(dx || dy || 1) });
    }

    function recordTreeLanding(step) {
      recordTreeSway(step.x, step.y, step.end, step.dx, step.dy);
    }

    function updateTreeMotion() {
      const time = state.simSeconds;
      const reset = idleMotion.matches || forest.time === null || time < forest.time || time - forest.time > 0.5;
      if (reset) {
        forest.steps.clear();
        forest.shakes.clear();
      }
      forest.time = time;
      if (idleMotion.matches) return;
      const active = new Set();
      for (const source of [...state.agents, ...state.rivals]) {
        const agent = displayedAgent(source);
        if (agent.species === "spiny-back-beetle" || agent.health <= 0) continue;
        active.add(agent.id);
        const step = agent.moveStartedAt + ":" + agent.stepCount;
        const end = agent.moveStartedAt + (agent.moveDuration || 0);
        let previous = forest.steps.get(agent.id);
        if (previous && previous.step !== step) {
          if (!previous.landed && time >= previous.end && time - previous.end < 0.34) recordTreeLanding(previous);
          previous = null;
        }
        if (!previous) {
          const fromX = Math.round(agent.renderFromX), fromY = Math.round(agent.renderFromY);
          previous = { step, end, startedAt: agent.moveStartedAt, x: agent.x, y: agent.y, fromX, fromY,
            dx: agent.x - fromX, dy: agent.y - fromY,
            departed: !agent.moveDuration || (reset && time >= agent.moveStartedAt) || time - agent.moveStartedAt >= 0.34,
            landed: !agent.moveDuration || time >= end };
          forest.steps.set(agent.id, previous);
        }
        if (!previous.departed && time >= previous.startedAt) {
          previous.departed = true;
          if (time - previous.startedAt < 0.34) {
            recordTreeSway(previous.fromX, previous.fromY, previous.startedAt, -previous.dx, -previous.dy);
          }
        }
        if (!previous.landed && time >= previous.end) {
          previous.landed = true;
          if (time - previous.end < 0.34) recordTreeLanding(previous);
        }
      }
      for (const id of forest.steps.keys()) if (!active.has(id)) forest.steps.delete(id);
      for (const [id, shake] of forest.shakes) if (time - shake.at >= 0.34) forest.shakes.delete(id);
    }

    function treeSway(tree) {
      const shake = forest.shakes.get(tree.id);
      if (!shake || idleMotion.matches) return 0;
      const progress = (state.simSeconds - shake.at) / 0.34;
      if (progress < 0 || progress >= 1) return 0;
      return Math.sin(progress * Math.PI * 4) * (1 - progress) ** 2 * 0.05 * shake.direction;
    }

    function treeParts(frame) {
      if (forest.parts[frame]) return forest.parts[frame];
      const size = forest.sprite.naturalHeight;
      const parts = {};
      const baseTop = Math.floor(size * 0.78);
      const crownBottom = Math.ceil(size * 0.8);
      for (const [name, top, height] of [["base", baseTop, size - baseTop], ["crown", 0, crownBottom]]) {
        const part = document.createElement("canvas");
        part.width = size;
        part.height = size;
        part.getContext("2d").drawImage(forest.bitmap || forest.sprite, frame * size, top, size, height, 0, top, size, height);
        parts[name] = part;
      }
      forest.parts[frame] = parts;
      return parts;
    }

    function treeOverlapsColony(tree) {
      return colonyEntries.some(colony => tree.column >= colony.x && tree.column < colony.x + COLONY_SIZE &&
        tree.row >= colony.y && tree.row < colony.y + COLONY_SIZE);
    }

    function drawTreeHarvest(tree) {
      const food = foodCellMap.get(tree.column + "," + tree.row);
      if (food?.resourceType !== "tree" || resourceNodePose(food).phase !== "harvest") return false;
      const bounds = forest.bounds[tree.frame];
      drawResourceNode(state.lastFrame, food, undefined, { point: worldToScreen(tree.x, tree.y),
        size: tree.height * state.camera.zoom * (bounds.right - bounds.left) });
      return true;
    }

    function drawTreeFruit(food, height) {
      if (!treeFruitSprite.complete || !treeFruitSprite.naturalWidth) return;
      const ratio = clamp(food.amount / (food.initialAmount || FOOD_PER_CELL), 0, 1);
      const count = Math.max(1, Math.ceil(ratio * 3));
      const size = height * 0.28;
      for (const [x, y] of [[-0.23, -0.48], [0.06, -0.64], [0.25, -0.36]].slice(0, count)) {
        ctx.drawImage(treeFruitSprite, height * x - size / 2, height * y - size / 2, size, size);
      }
    }

    function drawTree(tree) {
      if (drawTreeHarvest(tree)) return;
      if (!forest.sprite.complete || !forest.sprite.naturalWidth) return;
      const sprite = forest.bitmap || forest.sprite;
      const frameSize = sprite.height || sprite.naturalHeight;
      const point = worldToScreen(tree.x, tree.y);
      const height = tree.height * state.camera.zoom;
      const food = foodCellMap.get(tree.column + "," + tree.row);
      const fruit = food?.amount > 0 && Spawner.isTreeFood(food, worldMap);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(point.x, point.y);
      if (tree.mirrored) ctx.scale(-1, 1);
      const sway = treeSway(tree);
      const outlineColor = objectOutlineColor("tree", tree) || (food?.amount > 0 ? objectOutlineColor("food", food) : null);
      if (outlineColor) drawSelectionOutline(sprite,
        -height / 2, -height * 0.94, height, height,
        { owner: forest, size: frameSize, index: tree.frame, x: tree.frame * frameSize, y: 0 }, outlineColor);
      if (sway) {
        const parts = treeParts(tree.frame);
        ctx.drawImage(parts.base, -height / 2, -height * 0.94, height, height);
        ctx.translate(0, -height * 0.15);
        ctx.rotate(sway * (tree.mirrored ? -1 : 1));
        ctx.drawImage(parts.crown, -height / 2, -height * 0.79, height, height);
        if (fruit) drawTreeFruit(food, height);
      } else {
        ctx.drawImage(sprite, tree.frame * frameSize, 0, frameSize, frameSize,
          -height / 2, -height * 0.94, height, height);
        if (fruit) {
          ctx.translate(0, -height * 0.15);
          drawTreeFruit(food, height);
        }
      }
      ctx.restore();
    }

    function drawTreeDetail(tree) {
      if (drawTreeHarvest(tree)) return;
      const sprite = forest.bitmap || forest.sprite, frameSize = sprite.height || sprite.naturalHeight;
      const point = worldToScreen(tree.x, tree.y), height = tree.height * state.camera.zoom;
      const food = foodCellMap.get(tree.column + "," + tree.row);
      const outline = objectOutlineColor("tree", tree) || (food?.amount > 0 ? objectOutlineColor("food", food) : null);
      ctx.save();
      ctx.translate(point.x, point.y);
      if (tree.mirrored) ctx.scale(-1, 1);
      if (outline) drawSelectionOutline(sprite, -height / 2, -height * 0.94, height, height,
        { owner: forest, size: frameSize, index: tree.frame, x: tree.frame * frameSize, y: 0 }, outline);
      if (food?.amount > 0 && Spawner.isTreeFood(food, worldMap)) {
        ctx.translate(0, -height * 0.15);
        drawTreeFruit(food, height);
      }
      ctx.restore();
    }

    function drawBurrow(burrow) {
      if (burrow.health <= 0) return;
      const appearance = burrowAppearances.get(burrow.type);
      if (!appearance) return;
      const { sprite, crop } = appearance;
      const point = worldToScreen(burrow.x, burrow.y + burrow.height);
      const width = burrow.width * state.camera.zoom, height = width * crop.height / crop.width;
      ctx.drawImage(sprite, crop.x, crop.y, crop.width, crop.height, point.x, point.y - height, width, height);
      const outline = objectOutlineColor("burrow", burrow);
      if (outline) {
        ctx.save(); ctx.strokeStyle = outline; ctx.lineWidth = selectionOutlineWidth;
        ctx.strokeRect(point.x, point.y - burrow.height * state.camera.zoom, width, burrow.height * state.camera.zoom);
        ctx.restore();
      }
    }

    function drawWorldObjects(now) {
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(viewport.width, viewport.height);
      const objects = [];
      const harvesters = foodHarvestStarts();
      for (const entry of colonyEntries) objects.push({ kind: "colony", depth: entry.y + 3.3, target: entry });
      const left = Math.max(0, Math.floor(topLeft.x - 1));
      const top = Math.max(0, Math.floor(topLeft.y - 1));
      const right = Math.min(WORLD_SIZE - 1, Math.ceil(bottomRight.x + 1));
      const bottom = Math.min(WORLD_SIZE - 1, Math.ceil(bottomRight.y + 2));
      let trees = forest.revealed.values();
      if (state.camera.zoom <= 18) {
        drawForestOverview(topLeft, bottomRight);
        const details = new Map();
        for (const food of resourceNodeCells()) {
          if (food.amount <= 0 || !Spawner.isTreeFood(food, worldMap)) continue;
          const tree = forest.cells.get(food.x + "," + food.y);
          if (tree) details.set(tree.id, tree);
        }
        for (const object of [state.selection, state.hover]) {
          if (object?.kind === "tree") details.set(object.target.id, object.target);
        }
        trees = details.values();
      } else if ((right - left + 1) * (bottom - top + 1) < forest.revealed.size) {
        trees = [];
        for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) {
          const tree = forest.revealed.get(row * WORLD_SIZE + column);
          if (tree) trees.push(tree);
        }
      }
      for (const tree of trees) {
        const radius = tree.height / 2;
        if (tree.x + radius < topLeft.x || tree.x - radius > bottomRight.x ||
          tree.y + tree.height * 0.06 < topLeft.y || tree.y - tree.height * 0.94 > bottomRight.y ||
          treeOverlapsColony(tree)) continue;
        objects.push({ kind: state.camera.zoom <= 18 ? "treeDetail" : "tree", depth: tree.y, target: tree });
      }
      for (const burrow of worldMap.burrows) {
        if (burrow.health <= 0 || burrow.x + burrow.width < topLeft.x || burrow.x > bottomRight.x ||
            burrow.y + burrow.height < topLeft.y || burrow.y - 1 > bottomRight.y) continue;
        let discovered = false;
        for (let y = burrow.y; y < burrow.y + burrow.height; y++) {
          for (let x = burrow.x; x < burrow.x + burrow.width; x++) {
            if (state.explored.has(y * WORLD_SIZE + x)) discovered = true;
          }
        }
        if (discovered) objects.push({ kind: "burrow", depth: burrow.y + burrow.height - 0.08, target: burrow });
      }
      for (const agent of [...state.agents, ...state.rivals]) {
        const position = interpolatedAgentPosition(agent);
        const birth = agentBirthPose(agent, true);
        const entry = birth && birth.elapsed < .72 ? colonyEntries.find(candidate => candidate.id === agent.birth.colonyId) : null;
        const depth = position.y + 0.5 + AGENT_HEIGHT * 0.44;
        objects.push({ kind: "agent", depth: entry ? Math.max(depth, entry.y + 3.31) : depth, target: agent });
      }
      for (const food of resourceNodeCells()) {
        if (food.kind === "corpse" || food.resourceType === "tree" || Spawner.isTreeFood(food, worldMap) ||
          food.x < topLeft.x - 1 || food.x > bottomRight.x + 1 ||
          food.y < topLeft.y - 1 || food.y > bottomRight.y + 1 || !resourceNodePose(food).visible) continue;
        objects.push({ kind: "food", depth: food.y + 0.92, target: food });
      }
      objects.sort((first, second) => first.depth - second.depth);
      for (const object of objects) {
        if (object.kind === "tree") drawTree(object.target);
        else if (object.kind === "treeDetail") drawTreeDetail(object.target);
        else if (object.kind === "colony") drawColony(now, object.target);
        else if (object.kind === "agent") drawAgent(now, object.target);
        else if (object.kind === "burrow") drawBurrow(object.target);
        else drawFoodSpot(now, object.target, harvesters.get(object.target.x + "," + object.target.y));
      }
    }

    const travelTraceStyles = {
      bean: {
        width: 1, distantAlpha: 0.18, color: "#8e7b58", grainAlpha: 1,
        grains: ["#273323", "#a18b5d"],
        layers: [{ width: 1.7, alpha: 0.025, color: "#6e6344" }, { width: 1, alpha: 0.075, color: "#6e6344" }]
      },
      pebble: {
        width: 1.05, distantAlpha: 0.58, color: "#252419", furrow: true
      },
      spore: {
        width: 1.05, spores: true,
        layers: [{ width: 1.5, alpha: 0.012, color: "#7aab6d" }, { width: 0.8, alpha: 0.015, color: "#a6c981" }]
      },
      spring: {
        width: 2.2, distantAlpha: 0.48, color: "#14342b", grainAlpha: 1.4, wet: true,
        grains: ["#b8e2d6", "#5b9a86"],
        layers: [
          { width: 2.8, alpha: 0.14, color: "#122d24" },
          { width: 2, alpha: 0.21, color: "#183a31" },
          { width: 1.35, alpha: 0.29, color: "#23483e" },
          { width: 0.65, alpha: 0.05, color: "#83afa2", offsetY: -0.015 }
        ]
      }
    };

    function drawTravelFurrow(mark, from, to, width, curl, fade) {
      const cell = state.camera.zoom;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const dx = (to.x - from.x) / length, dy = (to.y - from.y) / length;
      for (const [layerIndex, layer] of [
        { width: 1.5, alpha: 0.13, color: "#705a38" },
        { width: 1, alpha: 0.48, color: "#2b2519" },
        { width: 0.58, alpha: 0.74, color: "#0d110b" }
      ].entries()) {
        const left = [], right = [];
        for (let index = 0; index <= 12; index += 1) {
          const progress = index / 12;
          const bend = 2 * progress * (1 - progress) * curl;
          const wobble = (hashNoise(mark.seed, index + 150) - 0.5) * width * 0.18;
          const x = from.x + (to.x - from.x) * progress - dy * (bend + wobble);
          const y = from.y + (to.y - from.y) * progress + dx * (bend + wobble);
          const upper = width * layer.width * (0.28 + hashNoise(mark.seed, index + layerIndex * 31 + 170) * 0.27);
          const lower = width * layer.width * (0.28 + hashNoise(mark.seed, index + layerIndex * 31 + 210) * 0.27);
          left.push({ x: x - dy * upper, y: y + dx * upper });
          right.push({ x: x + dy * lower, y: y - dx * lower });
        }
        ctx.globalAlpha = fade * layer.alpha;
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.moveTo(left[0].x, left[0].y);
        for (let index = 1; index < left.length; index += 1) ctx.lineTo(left[index].x, left[index].y);
        const tip = width * layer.width * 0.5;
        ctx.quadraticCurveTo(to.x + dx * tip, to.y + dy * tip, right[12].x, right[12].y);
        for (let index = right.length - 2; index >= 0; index -= 1) ctx.lineTo(right[index].x, right[index].y);
        ctx.quadraticCurveTo(from.x - dx * tip, from.y - dy * tip, left[0].x, left[0].y);
        ctx.closePath();
        ctx.fill();
      }
      for (let index = 0; index < 20; index += 1) {
        const progress = hashNoise(mark.seed, index + 250);
        const side = (hashNoise(mark.seed, index + 280) - 0.5) * width * 2.2 +
          2 * progress * (1 - progress) * curl;
        const x = from.x + (to.x - from.x) * progress - dy * side;
        const y = from.y + (to.y - from.y) * progress + dx * side;
        const size = cell * (0.009 + hashNoise(mark.seed, index + 310) * 0.024);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(hashNoise(mark.seed, index + 340) * Math.PI);
        ctx.globalAlpha = fade * (0.1 + hashNoise(mark.seed, index + 370) * 0.18);
        ctx.fillStyle = index % 3 ? "#685438" : "#232317";
        ctx.beginPath();
        ctx.moveTo(-size, -size * 0.3);
        ctx.lineTo(size * 0.1, -size * 0.65);
        ctx.lineTo(size * 0.8, size * 0.2);
        ctx.lineTo(-size * 0.25, size * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    function drawTravelSpores(mark, from, to, width, curl, age, fade) {
      const cell = state.camera.zoom;
      const settled = clamp(age / 1.1, 0, 1);
      const spread = 1 - (1 - settled) ** 2;
      const count = cell < 8 ? 3 : 12;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let index = 0; index < count; index += 1) {
        const progress = hashNoise(mark.seed, index + 20);
        const side = (hashNoise(mark.seed, index + 40) - 0.5) * width * (1 + spread * 2.6) +
          2 * progress * (1 - progress) * curl;
        const lift = cell * (0.04 + hashNoise(mark.seed, index + 60) * 0.08) * (1 - settled);
        const x = from.x + (to.x - from.x) * progress - mark.dy * side;
        const y = from.y + (to.y - from.y) * progress + mark.dx * side - lift;
        const radius = Math.max(0.6, cell * (0.011 + hashNoise(mark.seed, index + 80) * 0.018));
        const opacity = fade * (0.45 + hashNoise(mark.seed, index + 100) * 0.35) * (0.65 + settled * 0.35);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 5.5);
        glow.addColorStop(0, "rgba(167,243,185,0.8)");
        glow.addColorStop(0.3, "rgba(130,224,169,0.35)");
        glow.addColorStop(1, "rgba(104,210,156,0)");
        ctx.fillStyle = glow;
        ctx.globalAlpha = opacity * 0.85;
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 5.5, radius * 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = index % 4 ? "#efffd3" : "#a4ead4";
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawTravelTraces() {
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(viewport.width, viewport.height);
      const cell = state.camera.zoom;
      const groundPoint = (x, y) => worldToScreen(
        x + 0.5 + (hashNoise(x * 29, y * 37) - 0.5) * 0.12,
        y + 0.5 + (hashNoise(x * 43, y * 19) - 0.5) * 0.12);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const footprint of state.footprints.values()) {
        if (footprint.x < topLeft.x - 1 || footprint.x > bottomRight.x + 1 ||
          footprint.y < topLeft.y - 1 || footprint.y > bottomRight.y + 1) continue;
        const to = groundPoint(footprint.x, footprint.y);
        for (const mark of footprint.marks) {
          const age = state.simSeconds - mark.at;
          if (age < 0 || age >= state.footprintLifetime) continue;
          const style = travelTraceStyles[mark.tribe] || travelTraceStyles.bean;
          const fade = clamp(age / 0.1, 0, 1) * (1 - age / state.footprintLifetime);
          const from = groundPoint(footprint.x - mark.dx, footprint.y - mark.dy);
          const curl = (hashNoise(mark.seed, 1) - 0.5) * cell * 0.12;
          const width = cell * (0.12 + hashNoise(mark.seed, 2) * 0.06) * style.width;
          const controlX = (from.x + to.x) / 2 - mark.dy * curl;
          const controlY = (from.y + to.y) / 2 + mark.dx * curl;
          if (cell < 8 && !style.spores) {
            ctx.globalAlpha = fade * style.distantAlpha;
            ctx.strokeStyle = style.color;
            ctx.lineWidth = Math.max(0.65, width);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.quadraticCurveTo(controlX, controlY, to.x, to.y);
            ctx.stroke();
            continue;
          }
          if (style.furrow) {
            drawTravelFurrow(mark, from, to, width, curl, fade);
            continue;
          }
          for (const layer of cell < 8 ? [] : style.layers) {
            const offsetX = cell * (layer.offsetX || 0), offsetY = cell * (layer.offsetY || 0);
            ctx.globalAlpha = fade * layer.alpha;
            ctx.strokeStyle = layer.color;
            ctx.lineWidth = width * layer.width;
            ctx.beginPath();
            ctx.moveTo(from.x + offsetX, from.y + offsetY);
            ctx.quadraticCurveTo(controlX + offsetX, controlY + offsetY, to.x + offsetX, to.y + offsetY);
            ctx.stroke();
          }
          if (style.spores) {
            drawTravelSpores(mark, from, to, width, curl, age, fade);
            continue;
          }
          for (let index = 0; index < 12; index += 1) {
            const progress = hashNoise(mark.seed, index + 20);
            const side = (hashNoise(mark.seed, index + 40) - 0.5) * width * 1.9 + Math.sin(progress * Math.PI) * curl;
            const x = from.x + (to.x - from.x) * progress - mark.dy * side;
            const y = from.y + (to.y - from.y) * progress + mark.dx * side;
            const length = cell * (0.025 + hashNoise(mark.seed, index + 60) * 0.075);
            const breadth = width * (0.08 + hashNoise(mark.seed, index + 80) * 0.24);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.atan2(mark.dy, mark.dx) + (hashNoise(mark.seed, index + 100) - 0.5) * 0.6);
            ctx.globalAlpha = fade * (0.04 + hashNoise(mark.seed, index + 120) * 0.06) * style.grainAlpha;
            ctx.fillStyle = style.grains[index % 3 ? 1 : 0];
            ctx.beginPath();
            if (style.wet) {
              ctx.ellipse(0, 0, length * 1.1, breadth * 0.5, 0, 0, Math.PI * 2);
            } else {
              ctx.moveTo(-length * 0.6, -breadth * 0.3);
              ctx.lineTo(length * 0.2, -breadth * 0.6);
              ctx.lineTo(length * 0.55, breadth * 0.15);
              ctx.lineTo(-length * 0.15, breadth * 0.5);
              ctx.closePath();
            }
            ctx.fill();
            if (style.wet && index % 3 === 0) {
              ctx.globalAlpha = fade * 0.16;
              ctx.strokeStyle = "#b8e2d6";
              ctx.lineWidth = Math.max(0.4, cell * 0.006);
              ctx.beginPath();
              ctx.ellipse(0, 0, length * 1.1, breadth * 0.65, 0, Math.PI * 1.1, Math.PI * 1.8);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }
    function isSelectedObject(kind, target) {
      return state.selection !== null &&
        state.selection.kind === kind && state.selection.target === target;
    }

    function objectOutlineColor(kind, target) {
      if (isSelectedObject(kind, target)) return selectionColor;
      return state.hover?.kind === kind && state.hover.target === target ? hoverColor : null;
    }

    function selectObject(kind, target) {
      state.selection = target ? { kind, target } : null;
      if (kind !== "colony" || target?.id !== connection.colonyId) colonyMenu.hidden = true;
      selectionTerrain.hidden = !selectionTerrainCell() || kind === "terrain" || kind === "hazard";
      state.camera.followAgentId = kind === "agent" && target ? target.id : null;
      if (state.camera.followAgentId !== null) focusAgent(target);
      else if (cameraTransition?.agentId != null) stopCameraTransition();
      for (const item of colonyList.children) {
        if (item.dataset.colonyId) {
          item.setAttribute("aria-current", String(kind === "colony" &&
            target !== null && item.dataset.colonyId === String(target.id)));
        }
      }
      updateAgentList();
    }

    function updateSelection() {
      selectionTerrain.hidden = !selectionTerrainCell() || state.selection?.kind === "terrain" || state.selection?.kind === "hazard";
      const selection = state.selection;
      if (!selection) return;
      const exists = selection.kind === "terrain" ? !!selectionTerrainCell() :
        selection.kind === "agent" ? state.agents.includes(selection.target) :
        selection.kind === "colony" ? colonyEntries.includes(selection.target) :
        selection.kind === "tree" ? forest.cells.get(selection.target.column + "," + selection.target.row) === selection.target :
        selection.kind === "hazard" ? hazardCells[selection.target.row * WORLD_SIZE + selection.target.column] === selection.target :
        selection.kind === "burrow" ?
          worldMap.burrows.includes(selection.target) && selection.target.health > 0 : selection.target.amount > 0;
      if (!exists) {
        selectObject(null, null);
        if (selection.kind !== "corpse") closeColonyMenu();
      }
    }

    function createColonyAppearance(spriteSource) {
      const sprite = new Image();
      sprite.src = spriteSource;
      const animation = { sheet: sprite, frameSize: 2048, columns: 4, frameCount: 16, periodMs: 3960,
        order: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
        durationsMs: [231,175,124,105,96,89,86,84,84,86,89,96,105,124,175,462,175,124,105,96,89,86,84,84,86,89,96,105,124,175,231] };
      return { sprite, animation, scale: 1 };
    }

    function colonyAppearance(entry) {
      if (entry.tribe && entry.tribe !== "bean") return tribeColonies.get(entry.tribe) || colonyAppearances[0];
      const level = entry.id === connection.colonyId ? state.nestLevel : entry.nestLevel;
      return colonyAppearances[Math.min(colonyAppearances.length, Math.max(1, level ?? 1)) - 1];
    }

    function initializeIdleFrames(animation, source) {
      animation.cache = new Map();
      animation.loading = new Map();
      animation.currentGroup = 0;
      animation.poseIndex = -1;
      animation.decodeError = null;
      if (typeof createImageBitmap !== "function") {
        animation.ready = Promise.resolve();
        return;
      }
      animation.ready = fetch(source).then((response) => response.arrayBuffer()).then(async (buffer) => {
        const view = new DataView(buffer);
        if (view.getUint32(0, true) !== 0x31474353 ||
          view.getUint32(4, true) !== animation.frameSize ||
          view.getUint32(8, true) !== animation.frameSize ||
          view.getUint32(12, true) !== animation.frameCount) {
          throw new Error("Invalid idle frame data");
        }
        animation.data = new Uint8Array(buffer);
        animation.crop = {
          x: view.getUint16(16, true), y: view.getUint16(18, true),
          width: view.getUint16(20, true), height: view.getUint16(22, true)
        };
        animation.groupSize = view.getUint16(24, true);
        animation.groupCount = view.getUint16(26, true);
        animation.groups = [];
        for (let index = 0; index < animation.groupCount; index += 1) {
          const offset = view.getUint32(28 + index * 8, true);
          const length = view.getUint32(32 + index * 8, true);
          if (offset + length > buffer.byteLength) throw new Error("Invalid idle frame range");
          animation.groups.push({ offset, length });
        }
        if (!animation.lazy) await Promise.all([requestIdleFrameGroup(animation, 0), requestIdleFrameGroup(animation, 1)]);
      }).catch((error) => { animation.decodeError = error.message; });
    }

    function requestIdleFrameGroup(animation, index) {
      if (animation.cache.has(index)) return Promise.resolve(animation.cache.get(index));
      if (animation.loading.has(index)) return animation.loading.get(index);
      if (!animation.data || animation.decodeError || animation.loading.size >= 2) return Promise.resolve(null);
      const group = animation.groups[index];
      const data = animation.data.subarray(group.offset, group.offset + group.length);
      const task = createImageBitmap(new Blob([data], { type: "image/webp" })).then((bitmap) => {
        if (bitmap.width !== animation.crop.width * animation.groupSize || bitmap.height !== animation.crop.height) {
          bitmap.close();
          throw new Error("Invalid idle frame dimensions");
        }
        animation.cache.set(index, bitmap);
        while (animation.cache.size > animation.cacheLimit) {
          const oldest = [...animation.cache.keys()].find((key) => key !== animation.currentGroup);
          animation.cache.get(oldest).close();
          animation.cache.delete(oldest);
        }
        return bitmap;
      }).catch((error) => {
        animation.decodeError = error.message;
        return null;
      }).finally(() => { animation.loading.delete(index); });
      animation.loading.set(index, task);
      return task;
    }

    function packedIdleSprite(sprite, animation, index) {
      if (!animation.data) return { sprite, index: 0 };
      const group = Math.floor(index / animation.groupSize);
      animation.currentGroup = group;
      requestIdleFrameGroup(animation, group);
      requestIdleFrameGroup(animation, (group + 1) % animation.groupCount);
      if (index === 0 || index === animation.frameCount - 1) return { sprite, index: 0 };
      const bitmap = animation.cache.get(group);
      if (!bitmap) {
        return animation.canvas ? { sprite: animation.canvas, index: animation.poseIndex } : { sprite, index: 0 };
      }
      animation.cache.delete(group);
      animation.cache.set(group, bitmap);
      if (animation.poseIndex !== index) {
        if (!animation.canvas) {
          animation.canvas = document.createElement("canvas");
          animation.canvas.width = animation.frameSize;
          animation.canvas.height = animation.frameSize;
          animation.context = animation.canvas.getContext("2d");
          animation.context.imageSmoothingEnabled = false;
        }
        const context = animation.context;
        const crop = animation.crop;
        context.clearRect(0, 0, animation.frameSize, animation.frameSize);
        context.drawImage(sprite, 0, 0);
        context.clearRect(crop.x, crop.y, crop.width, crop.height);
        context.drawImage(bitmap, (index % animation.groupSize) * crop.width, 0, crop.width, crop.height,
          crop.x, crop.y, crop.width, crop.height);
        animation.poseIndex = index;
      }
      return { sprite: animation.canvas, index };
    }

    function drawSelectionOutline(sprite, x, y, width, height, frame, color) {
      if (sprite === foodSelectionShape) {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.filter = "none";
        ctx.strokeStyle = color;
        ctx.lineWidth = selectionOutlineWidth;
        ctx.strokeRect(x - selectionOutlineWidth / 2, y - selectionOutlineWidth / 2,
          width + selectionOutlineWidth, height + selectionOutlineWidth);
        ctx.restore();
        return;
      }
      const entry = selectionContour(sprite, frame);
      const sizeX = entry.canvas.width, sizeY = entry.canvas.height;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(width / sizeX, height / sizeY);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = selectionOutlineWidth * sizeX / width;
      ctx.stroke(entry.contour);
      ctx.restore();
    }

    function selectionContour(sprite, frame) {
      const key = frame ? frame.owner : sprite;
      const isAgent = agentSpriteSet.has(sprite);
      const sourceWidth = frame ? frame.size : sprite.naturalWidth || sprite.width;
      const sourceHeight = frame ? frame.size : sprite.naturalHeight || sprite.height;
      const scale = isAgent ? Math.min(1, 512 / Math.max(sourceWidth, sourceHeight)) : 1;
      const sizeX = Math.max(1, Math.ceil(sourceWidth * scale));
      const sizeY = Math.max(1, Math.ceil(sourceHeight * scale));
      const index = frame ? frame.index : -1;
      let entry = selectionOutlines.get(key);
      if (!entry || entry.canvas.width !== sizeX || entry.canvas.height !== sizeY) {
        const outline = document.createElement("canvas");
        outline.width = sizeX;
        outline.height = sizeY;
        entry = { canvas: outline, context: outline.getContext("2d"), index: null };
        selectionOutlines.set(key, entry);
      }
      if (entry.index !== index) {
        const context = entry.context;
        context.clearRect(0, 0, sizeX, sizeY);
        if (frame) context.drawImage(sprite, frame.x, frame.y, frame.size, frame.size, 0, 0, sizeX, sizeY);
        else context.drawImage(sprite, 0, 0, sizeX, sizeY);
        entry.contour = createSelectionContour(entry.canvas);
        entry.index = index;
      }
      return entry;
    }

    function createSelectionContour(sprite) {
      const source = sprite.getContext("2d").getImageData(0, 0, sprite.width, sprite.height);
      const width = sprite.width, height = sprite.height, data = source.data;
      const path = new Path2D();
      const pairs = [[], [[3,0]], [[0,1]], [[3,1]], [[1,2]], [[3,0],[1,2]], [[0,2]], [[3,2]],
        [[2,3]], [[0,2]], [[0,1],[2,3]], [[1,2]], [[1,3]], [[0,1]], [[3,0]], []];
      const step = 2;
      for (let y = 0; y < height - step; y += step) {
        for (let x = 0; x < width - step; x += step) {
          const a = data[(y * width + x) * 4 + 3], b = data[(y * width + x + step) * 4 + 3];
          const c = data[((y + step) * width + x + step) * 4 + 3], d = data[((y + step) * width + x) * 4 + 3];
          const mask = (a >= 128 ? 1 : 0) | (b >= 128 ? 2 : 0) | (c >= 128 ? 4 : 0) | (d >= 128 ? 8 : 0);
          if (!mask || mask === 15) continue;
          const alpha = [a, b, c, d];
          const corners = [[x + 0.5, y + 0.5], [x + step + 0.5, y + 0.5],
            [x + step + 0.5, y + step + 0.5], [x + 0.5, y + step + 0.5]];
          const point = edge => {
            const next = (edge + 1) % 4;
            const ratio = (128 - alpha[edge]) / (alpha[next] - alpha[edge]);
            return [corners[edge][0] + (corners[next][0] - corners[edge][0]) * ratio,
              corners[edge][1] + (corners[next][1] - corners[edge][1]) * ratio];
          };
          for (const pair of pairs[mask]) {
            const start = point(pair[0]), end = point(pair[1]);
            path.moveTo(start[0], start[1]);
            path.lineTo(end[0], end[1]);
          }
        }
      }
      return path;
    }

    function idleFramePosition(animation, now, offset) {
      const duration = animation.frameCount * animation.frameMs;
      const position = (Math.max(0, now - idleStartedAt) + offset) % (animation.restMs + duration);
      if (position < animation.restMs) return 0;
      return Math.min(animation.frameCount - 1, (position - animation.restMs) / animation.frameMs);
    }

    function idleFrameIndex(animation, now, offset) {
      if (animation === colonyAppearances[0].animation && animation.order) {
        let elapsed = (Math.max(0, now - idleStartedAt) + offset) % animation.periodMs;
        let index = 0;
        while (elapsed >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
        return animation.order[index];
      }
      return Math.floor(idleFramePosition(animation, now, offset));
    }

    async function initializeColonyLight(appearance) {
      const sprite = appearance.sprite;
      await sprite.decode();
      const mask = document.createElement("canvas");
      mask.width = appearance.animation?.sheet ? appearance.animation.frameSize : sprite.naturalWidth;
      mask.height = appearance.animation?.sheet ? appearance.animation.frameSize : sprite.naturalHeight;
      const context = mask.getContext("2d");
      context.drawImage(sprite, 0, 0, mask.width, mask.height, 0, 0, mask.width, mask.height);
      const pixels = context.getImageData(0, 0, mask.width, mask.height);
      let interior = null;
      if (colonyAppearances.includes(appearance)) {
        interior = new Uint8Array(mask.width * mask.height);
        const queue = new Int32Array(interior.length);
        const seeds = [
          [[0.5, 0.74]],
          [[0.5, 0.48]],
          [[0.5, 0.40], [0.58, 0.31]],
          [[0.5, 0.35], [0.5, 0.52]]
        ][colonyAppearances.indexOf(appearance)];
        let head = 0, tail = 0;
        let minX = mask.width, minY = mask.height, maxX = -1, maxY = -1;
        for (const [x, y] of seeds) {
          const seed = Math.floor(mask.height * y) * mask.width + Math.floor(mask.width * x);
          interior[seed] = 1;
          queue[tail++] = seed;
        }
        while (head < tail) {
          const pixel = queue[head++], x = pixel % mask.width, y = Math.floor(pixel / mask.width);
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          for (const next of [x > 0 ? pixel - 1 : -1, x + 1 < mask.width ? pixel + 1 : -1,
            y > 0 ? pixel - mask.width : -1, y + 1 < mask.height ? pixel + mask.width : -1]) {
            if (next < 0 || interior[next]) continue;
            const offset = next * 4;
            if (pixels.data[offset + 3] < 250 || pixels.data[offset] < pixels.data[offset + 1] - 1 ||
                pixels.data[offset + 1] < pixels.data[offset + 2] - 1) continue;
            interior[next] = 1;
            queue[tail++] = next;
          }
        }
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          const first = y * mask.width + x;
          if (interior[first]) continue;
          head = 0; tail = 1;
          queue[0] = first;
          interior[first] = 2;
          let enclosed = true;
          while (head < tail) {
            const pixel = queue[head++], px = pixel % mask.width, py = Math.floor(pixel / mask.width);
            if (px === minX || px === maxX || py === minY || py === maxY) enclosed = false;
            for (const next of [px > minX ? pixel - 1 : -1, px < maxX ? pixel + 1 : -1,
              py > minY ? pixel - mask.width : -1, py < maxY ? pixel + mask.width : -1]) {
              if (next < 0 || interior[next]) continue;
              interior[next] = 2;
              queue[tail++] = next;
            }
          }
          if (enclosed && tail <= 64) for (let index = 0; index < tail; index++) interior[queue[index]] = 1;
        }
      }
      let left = mask.width, top = mask.height, right = -1, bottom = -1;
      for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
        const offset = (y * mask.width + x) * 4;
        const selected = interior ? interior[y * mask.width + x] === 1 :
          pixels.data[offset + 3] && pixels.data[offset] - pixels.data[offset + 1] >= 8 &&
          pixels.data[offset + 1] - pixels.data[offset + 2] >= 22;
        if (!selected) {
          pixels.data[offset + 3] = 0;
          continue;
        }
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if (right < left) return;
      const glow = document.createElement("canvas");
      glow.width = right - left + 1;
      glow.height = bottom - top + 1;
      glow.getContext("2d").putImageData(pixels, -left, -top);
      const shade = document.createElement("canvas");
      shade.width = glow.width;
      shade.height = glow.height;
      const shadeContext = shade.getContext("2d");
      shadeContext.drawImage(glow, 0, 0);
      shadeContext.globalCompositeOperation = "source-in";
      shadeContext.fillStyle = "#000";
      shadeContext.fillRect(0, 0, shade.width, shade.height);
      appearance.lighting = { shade, glow, x: left / mask.width, y: top / mask.height,
        width: glow.width / mask.width, height: glow.height / mask.height };
    }

    function colonyLight(now) {
      if (idleMotion.matches) return { shade: 0, glow: 0 };
      const wave = 0.5 + 0.5 * Math.cos(Math.max(0, now - idleStartedAt) * Math.PI * 2 / 5500);
      return { shade: (1 - wave) * 0.68, glow: wave * 0.65 };
    }

    function drawIdleSprite(sprite, animation, now, offset, x, y, width, height, outlineColor) {
      ctx.save();
      if (animation.smooth && animation.breathMs && !idleMotion.matches) {
        const breath = Math.sin((Math.max(0, now - idleStartedAt) + offset) * Math.PI * 2 / animation.breathMs) * 0.008;
        ctx.translate(x + width / 2, y + height * 0.96);
        ctx.scale(1 - breath * 0.35, 1 + breath);
        x = -width / 2;
        y = -height * 0.96;
      }
      let frame = null;
      if (!animation.smooth && (animation === colonyAppearances[0].animation || !idleMotion.matches && width >= 24)) {
        const index = animation === colonyAppearances[0].animation && (idleMotion.matches || width < 24) ? 0 : idleFrameIndex(animation, now, offset);
        if (animation.packed) {
          const pose = packedIdleSprite(sprite, animation, index);
          sprite = pose.sprite;
          frame = { x: 0, y: 0, size: animation.frameSize, index: pose.index, owner: animation };
        } else if (animation.sheet.complete && animation.sheet.naturalWidth > 0) {
          frame = {
            x: (index % animation.columns) * animation.frameSize,
            y: Math.floor(index / animation.columns) * animation.frameSize,
            size: animation.frameSize, index, owner: animation
          };
          sprite = animation.sheet;
          if (animation.placement) {
            x += width * animation.placement.x;
            y += height * animation.placement.y;
            width *= animation.placement.width;
            height *= animation.placement.height;
          }
        }
      }
      if (outlineColor && animation !== foodIdle) drawSelectionOutline(sprite, x, y, width, height, frame, outlineColor);
      if (frame) ctx.drawImage(sprite, frame.x, frame.y, frame.size, frame.size, x, y, width, height);
      else ctx.drawImage(sprite, x, y, width, height);
      if (outlineColor && animation === foodIdle) drawSelectionOutline(sprite, x, y, width, height, frame, outlineColor);
      ctx.restore();
    }

    function drawMushroomSpores(now, foodCell, x, y, width, height) {
      if (idleMotion.matches || state.camera.zoom < 24 ||
        x + width < -height || x > viewport.width + height ||
        y + height < 0 || y > viewport.height + height) return;
      const period = 14000 + hashNoise(foodCell.x + 307, foodCell.y + 521) * 12000;
      const phase = hashNoise(foodCell.x + 643, foodCell.y + 877) * period;
      const clock = Math.max(0, now - idleStartedAt) + phase;
      const cycle = Math.floor(clock / period);
      const delay = period * (0.2 + hashNoise(foodCell.x + cycle * 67, foodCell.y + cycle * 71) * 0.3);
      const age = clock - cycle * period - delay;
      if (age < 0 || age > 2800) return;
      const count = 2 + Math.floor(hashNoise(foodCell.x + cycle * 41, foodCell.y + cycle * 53) * 3);
      const opacity = 0.35 + clamp(foodCell.amount / (foodCell.initialAmount || FOOD_PER_CELL), 0, 1) * 0.65;
      ctx.save();
      ctx.fillStyle = "#eadfb8";
      for (let index = 0; index < count; index++) {
        const seedX = foodCell.x + cycle * 97 + index * 43;
        const seedY = foodCell.y + cycle * 101 + index * 59;
        const particleDelay = index * 140 + hashNoise(seedX + 13, seedY + 17) * 260;
        const lifetime = 1400 + hashNoise(seedX + 29, seedY + 31) * 600;
        const progress = (age - particleDelay) / lifetime;
        if (progress <= 0 || progress >= 1) continue;
        const drift = (hashNoise(seedX + 37, seedY + 41) - 0.5) * width * 0.65 * progress;
        const sway = Math.sin(progress * Math.PI * 2 + index) * width * 0.035 * Math.sin(progress * Math.PI);
        const particleX = x + width * (0.25 + hashNoise(seedX + 47, seedY + 61) * 0.5) + drift + sway;
        const particleY = y + height * (0.2 + hashNoise(seedX + 67, seedY + 73) * 0.2) -
          height * (0.4 + hashNoise(seedX + 79, seedY + 83) * 0.3) * progress;
        const radius = Math.max(0.6, width * (0.007 + hashNoise(seedX + 89, seedY + 107) * 0.008));
        ctx.globalAlpha = opacity * Math.sin(progress * Math.PI) * 0.22;
        ctx.beginPath();
        ctx.arc(particleX, particleY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const foodMushroomHarvest = {"resolution":1024,"bounds":[0,0,1024,1024],"frameWidth":1024,"frameHeight":1024,"columns":8,"frameCount":8,"frameMs":62.5,"restMs":500,"cacheLimit":8};
    foodMushroomHarvest.sheet = new Image();
    foodMushroomHarvest.sheet.src = assetSource("DesignAssets/Animations/food-mushroom-pile-harvest.png");
    foodMushroomHarvest.frames = new Map();
    await foodMushroomHarvest.sheet.decode();
    function drawFoodMushroom(count, frameIndex, screen, cell, outlineColor) {
      const animation = foodMushroomHarvest;
      const pose = Math.max(0, frameIndex);
      const index = (count - 1) * animation.frameCount + pose;
      let frame = animation.frames.get(index);
      if (!frame) {
        frame = document.createElement("canvas");
        frame.width = animation.frameWidth;
        frame.height = animation.frameHeight;
        frame.getContext("2d").drawImage(animation.sheet,
          pose * animation.frameWidth, (count - 1) * animation.frameHeight,
          animation.frameWidth, animation.frameHeight, 0, 0, animation.frameWidth, animation.frameHeight);
      }
      animation.frames.delete(index);
      animation.frames.set(index, frame);
      if (animation.frames.size > animation.cacheLimit) animation.frames.delete(animation.frames.keys().next().value);
      const x = screen.x + cell * animation.bounds[0] / animation.resolution;
      const y = screen.y + cell * animation.bounds[1] / animation.resolution;
      const width = cell * animation.frameWidth / animation.resolution;
      const height = cell * animation.frameHeight / animation.resolution;
      ctx.drawImage(frame, x, y, width, height);
      if (outlineColor) drawSelectionOutline(frame, x, y, width, height, null, outlineColor);
    }

    function foodMushroomHarvestFrame(elapsed) {
      const animation = foodMushroomHarvest;
      const motionMs = animation.frameCount * animation.frameMs;
      const cycleMs = motionMs + animation.restMs;
      const time = elapsed * 1000 % cycleMs;
      return time < motionMs ? Math.floor(time / animation.frameMs) : 0;
    }


    function foodHarvestStarts() {
      const harvesters = new Map();
      for (const agent of [...state.agents, ...state.rivals]) {
        if (!isHarvestingFood(agent)) continue;
        const key = agent.x + "," + agent.y;
        harvesters.set(key, Math.min(harvesters.get(key) ?? Infinity, agent.harvestStarted));
      }
      return harvesters;
    }

    function drawFoodSpots(now) {
      const harvesters = foodHarvestStarts();
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(viewport.width, viewport.height);
      const startRegionX = Math.floor(topLeft.x / FOOD_REGION_SIZE) - 1;
      const startRegionY = Math.floor(topLeft.y / FOOD_REGION_SIZE) - 1;
      const endRegionX = Math.floor(bottomRight.x / FOOD_REGION_SIZE) + 1;
      const endRegionY = Math.floor(bottomRight.y / FOOD_REGION_SIZE) + 1;

      for (let regionY = startRegionY; regionY <= endRegionY; regionY += 1) {
        for (let regionX = startRegionX; regionX <= endRegionX; regionX += 1) {
          const spot = foodSpotForRegion(regionX, regionY);
          if (!spot.cells) {
            continue;
          }

          for (const foodCell of spot.cells) {
            drawFoodSpot(now, foodCell, harvesters.get(foodCell.x + "," + foodCell.y));
          }
        }
      }
    }

    function resourceNodeCells() {
      const topLeft = screenToWorld(0, 0), bottomRight = screenToWorld(viewport.width, viewport.height);
      const left = topLeft.x - 2, top = topLeft.y - 2, right = bottomRight.x + 2, bottom = bottomRight.y + 2;
      const cells = [];
      const firstColumn = Math.max(0, Math.floor(left / FOOD_REGION_SIZE));
      const lastColumn = Math.min(Math.floor((WORLD_SIZE - 1) / FOOD_REGION_SIZE), Math.floor(right / FOOD_REGION_SIZE));
      const firstRow = Math.max(0, Math.floor(top / FOOD_REGION_SIZE));
      const lastRow = Math.min(Math.floor((WORLD_SIZE - 1) / FOOD_REGION_SIZE), Math.floor(bottom / FOOD_REGION_SIZE));
      for (let row = firstRow; row <= lastRow; row++) for (let column = firstColumn; column <= lastColumn; column++) {
        const spot = foodSpotCache.get(column + "," + row);
        if (!spot) continue;
        for (const cell of spot.cells) {
          if (cell.x >= left && cell.x <= right && cell.y >= top && cell.y <= bottom) cells.push(cell);
        }
      }
      for (const [key, effect] of harvestPlayback.effects) {
        if (effect.x < left || effect.x > right || effect.y < top || effect.y > bottom ||
          effect.remaining > 0 || foodCellMap.has(key) || state.simSeconds - effect.completedAt >= 0.6) continue;
        cells.push({ ...effect, amount: 0 });
      }
      return cells;
    }

    function resourceNodePose(cell) {
      if (harvestDisplay.time !== state.simSeconds || harvestDisplay.agents !== state.agents || harvestDisplay.rivals !== state.rivals) {
        harvestDisplay.time = state.simSeconds;
        harvestDisplay.agents = state.agents;
        harvestDisplay.rivals = state.rivals;
        harvestDisplay.cells.clear();
        harvestDisplay.poses.clear();
        for (const agent of [...state.agents, ...state.rivals]) {
          if (agent.mode !== "harvest") continue;
          const key = agent.x + "," + agent.y;
          if (!harvestDisplay.cells.has(key)) harvestDisplay.cells.set(key, []);
          harvestDisplay.cells.get(key).push(agent);
        }
      }
      const key = cell.key || cell.x + "," + cell.y;
      if (harvestDisplay.poses.has(key)) return harvestDisplay.poses.get(key);
      const type = Spawner.resourceTypeForCell(cell, worldMap);
      const animation = resourceHarvestSprites.get(type);
      const pose = animation ? Spawner.harvestPlaybackPose(harvestPlayback, { ...cell, resourceType: type },
        harvestDisplay.cells.get(cell.x + "," + cell.y) || [], state.simSeconds,
        { ...animation, harvestSeconds: Spawner.resourceHarvestSeconds(type, worldMap) }) :
        { frame: 0, progress: 0, phase: "idle", opacity: cell.amount > 0 ? 1 : 0,
          remaining: Math.max(0, cell.amount), visible: cell.amount > 0 };
      if (animation && idleMotion.matches) {
        const effect = harvestPlayback.effects.get(key);
        pose.frame = cell.amount > 0 && effect?.resourceType === type && cell.amount <= effect.remaining ? animation.settleFrame : 0;
        pose.visible = cell.amount > 0;
        pose.opacity = pose.visible ? 1 : 0;
      }
      harvestDisplay.poses.set(key, pose);
      return pose;
    }

    function drawResourceNode(now, cell, harvestStarted, placement) {
      const type = Spawner.resourceTypeForCell(cell, worldMap);
      const animation = resourceHarvestSprites.get(type);
      const pose = resourceNodePose(cell);
      const sprite = animation?.frames.get(pose.frame) || animation?.sprite || resourceSprites.get(type);
      if (!pose.visible || !sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) return;
      const point = placement?.point || worldToScreen(cell.x + 0.5, cell.y + 0.92);
      const size = placement?.size || state.camera.zoom * 0.86;
      const scale = size / (animation?.viewSize || sprite.naturalWidth);
      const sourceX = animation && sprite === animation.sprite ? pose.frame % animation.columns * animation.frameSize : 0;
      const sourceY = animation && sprite === animation.sprite ? Math.floor(pose.frame / animation.columns) * animation.frameSize : 0;
      const width = (animation?.frameSize || sprite.naturalWidth) * scale;
      const height = (animation?.frameSize || sprite.naturalHeight) * scale;
      const x = animation ? -animation.pivotX * scale : -width / 2;
      const y = animation ? -animation.pivotY * scale : -height;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = pose.opacity;
      if (cell.kind === "corpse" && Number.isFinite(cell.decaysAt)) {
        const decay = clamp((state.simSeconds - cell.diedAt) / (cell.decaysAt - cell.diedAt), 0, 1);
        ctx.globalAlpha *= 1 - decay * 0.4;
        ctx.filter = "saturate(" + (1 - decay * 0.8) + ")";
      }
      ctx.translate(point.x, point.y);
      const outline = objectOutlineColor(cell.kind === "corpse" ? "corpse" : "food", cell);
      ctx.drawImage(sprite, sourceX, sourceY, animation?.frameSize || sprite.naturalWidth,
        animation?.frameSize || sprite.naturalHeight, x, y, width, height);
      if (outline) drawSelectionOutline(sprite, x, y, width, height,
        animation ? { owner: animation, size: animation.frameSize, index: pose.frame, x: sourceX, y: sourceY } : null, outline);
      ctx.restore();
    }

    function drawFoodSpot(now, foodCell, harvestStarted) {
      if (foodCell.resourceType && Spawner.resourceTypeForCell(foodCell, worldMap) !== "honey-mushrooms") {
        drawResourceNode(now, foodCell, harvestStarted);
        return;
      }
      const cell = state.camera.zoom;
      if (foodCell.amount <= 0 || foodCell.resourceType === "tree" || Spawner.isTreeFood(foodCell, worldMap)) return;
      const screen = worldToScreen(foodCell.x, foodCell.y);
      const remainingRatio = clamp(foodCell.amount / (foodCell.initialAmount || FOOD_PER_CELL), 0, 1);
      const spriteReady = foodMushroomHarvest.sheet.complete && foodMushroomHarvest.sheet.naturalWidth > 0;
      const foodWidth = Math.max(1, cell * FOOD_SPRITE_WIDTH);
      const foodHeight = Math.max(1, foodWidth * 0.75);
      const foodX = screen.x + (cell - foodWidth) / 2;
      const foodY = screen.y + cell * 0.92 - foodHeight;
      const outlineColor = objectOutlineColor("food", foodCell);
      if (outlineColor && !spriteReady) drawSelectionOutline(foodSelectionShape, foodX, foodY, foodWidth, foodHeight, null, outlineColor);
      ctx.save();
      if (spriteReady) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const extraCount = 2 + Math.floor(hashNoise(foodCell.x + 19, foodCell.y + 7) * 2);
        const initialCount = Math.min(3 + extraCount, foodCell.initialAmount || FOOD_PER_CELL);
        const count = Math.max(1, Math.ceil(remainingRatio * initialCount));
        const harvesting = harvestStarted !== undefined && !idleMotion.matches;
        const elapsed = harvesting ? Math.max(0, state.simSeconds - harvestStarted) : 0;
        drawFoodMushroom(count, harvesting ? foodMushroomHarvestFrame(elapsed) : 0, screen, cell, outlineColor);
      } else {
        ctx.fillStyle = FOOD_COLORS[foodCell.terrain];
        ctx.fillRect(foodX, foodY, foodWidth, foodHeight);
      }
      ctx.restore();
      if (spriteReady) drawMushroomSpores(now, foodCell, foodX, foodY, foodWidth, foodHeight);
    }

    function drawFoodStatus() {
      const selectedTree = state.selection?.kind === "tree" ? state.selection.target : null;
      const food = selectedTree ? foodCellMap.get(selectedTree.column + "," + selectedTree.row) || { x: selectedTree.column, y: selectedTree.row, resourceType: "tree", amount: 0 } :
        state.selection?.kind === "food" ? state.selection.target : null;
      if (!food) return;
      const treeFood = Spawner.isTreeFood(food, worldMap);
      const tree = treeFood ? forest.cells.get(food.x + "," + food.y) : null;
      if (treeFood && (!tree || treeOverlapsColony(tree))) return;
      const point = worldToScreen(food.x + 0.5, food.y);
      const cell = state.camera.zoom;
      const margin = Math.min(6, cell * 0.06);
      ctx.save();
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const definition = Spawner.resourceDefinition(Spawner.resourceTypeForCell(food, worldMap));
      const required = Spawner.resourceHarvestRequirements(food, worldMap, colonyEntries.find(colony => colony.id === connection.colonyId)?.tribe);
      const requirement = required && ATTRIBUTES.filter(attribute => required[attribute.key] > 0)
        .map(attribute => attribute.name + (required[attribute.key] > 1 ? "×" + required[attribute.key] : "")).join(" + ");
      const label = [definition.name + (definition.harvestLocked ? "" : " · " + Math.ceil(food.amount) + "개"),
        definition.harvestLocked ? "채집 잠금" : required === null ? "채집 불가" : requirement ? "필요: " + requirement : "기본 채집"];
      const width = Math.max(...label.map(line => ctx.measureText(line).width)) + 20;
      const scale = Math.min(1, (cell - margin * 2) / width, (cell - margin * 2) / 44);
      ctx.translate(point.x, point.y + margin);
      ctx.scale(scale, scale);
      ctx.fillStyle = "rgba(16, 23, 25, 0.96)";
      ctx.beginPath();
      ctx.roundRect(-width / 2, 0, width, 44, 6);
      ctx.fill();
      ctx.fillStyle = "#edc58d";
      ctx.fillText(label[0], 0, 14);
      ctx.fillText(label[1], 0, 30);
      ctx.restore();
    }

    function drawBurrowStatus() {
      const burrow = state.selection?.kind === "burrow" ? state.selection.target : null;
      if (!burrow || burrow.health <= 0) return;
      const point = worldToScreen(burrow.x + burrow.width / 2, burrow.y);
      const maxHealth = burrow.maxHealth || (burrow.type === "small" ? 20 : 60);
      const label = (burrow.type === "small" ? "작은 굴" : "큰 굴") + " · " + Math.ceil(burrow.health) + "/" + maxHealth;
      ctx.save(); ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const width = ctx.measureText(label).width + 20;
      const x = clamp(point.x, width / 2 + 4, viewport.width - width / 2 - 4), y = clamp(point.y - 22, 22, viewport.height - 22);
      ctx.fillStyle = "rgba(16, 23, 25, 0.96)"; ctx.beginPath(); ctx.roundRect(x - width / 2, y - 16, width, 36, 6); ctx.fill();
      ctx.fillStyle = "#edc58d"; ctx.fillText(label, x, y - 3);
      ctx.fillStyle = "#563d35"; ctx.fillRect(x - width / 2 + 8, y + 10, width - 16, 4);
      ctx.fillStyle = "#ddaa72"; ctx.fillRect(x - width / 2 + 8, y + 10, (width - 16) * burrow.health / maxHealth, 4);
      ctx.restore();
    }

    function drawWorldBounds() {
      const topLeft = worldToScreen(0, 0);
      const bottomRight = worldToScreen(WORLD_SIZE, WORLD_SIZE);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(117, 196, 182, 0.26)";
      ctx.strokeRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );
    }

    function drawColonyGround(entry, topLeft, size, appearance) {
      if (!colonyGround.complete || !colonyGround.naturalWidth || topLeft.x + size < 0 || topLeft.y + size < 0 ||
          topLeft.x > viewport.width || topLeft.y > viewport.height) return;
      const resolution = colonyGround.naturalWidth;
      const key = resolution + ":" + [...entry.occupiedCells].sort().join(";");
      let ground = colonyGroundSprites.get(key);
      if (!ground) {
        const sprite = document.createElement("canvas");
        sprite.width = resolution;
        sprite.height = resolution;
        const context = sprite.getContext("2d");
        const cell = sprite.width / COLONY_SIZE;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        const mask = new Path2D();
        for (const position of entry.occupiedCells) {
          const [x, y] = position.split(",").map(Number);
          mask.rect(x * cell, y * cell, cell, cell);
        }
        context.drawImage(colonyGround, 0, 0, resolution, resolution);
        context.globalCompositeOperation = "destination-in";
        context.filter = "blur(" + cell * 0.045 + "px)";
        context.fill(mask);
        ground = { sprite };
        colonyGroundSprites.set(key, ground);
      }
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(ground.sprite, topLeft.x, topLeft.y, size, size);
      const outlineColor = objectOutlineColor("colony", entry);
      if (outlineColor) {
        if (!ground.outline) ground.outline = createSelectionContour(ground.sprite);
        ctx.save();
        ctx.translate(topLeft.x, topLeft.y);
        ctx.scale(size / resolution, size / resolution);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = selectionOutlineWidth * resolution / size;
        ctx.stroke(ground.outline);
        ctx.restore();
      }
      const spriteSize = size * appearance.scale;
      const spriteY = appearance.centerY == null ?
        topLeft.y + (size - spriteSize) * 465 / 512 :
        topLeft.y + size / 2 - spriteSize * appearance.centerY;
      const radiusX = spriteSize * appearance.groundWidth * 0.46;
      const radiusY = size * 0.036;
      ctx.translate(topLeft.x + size / 2, spriteY + spriteSize * 1860 / 2048 - size * 0.012);
      ctx.scale(radiusX, radiusY);
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      shadow.addColorStop(0, "rgba(12, 20, 14, 0.55)");
      shadow.addColorStop(0.55, "rgba(12, 20, 14, 0.30)");
      shadow.addColorStop(1, "rgba(12, 20, 14, 0)");
      ctx.fillStyle = shadow;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }

    function createColonyPollenSprite(radiusX, radiusY) {
      const sprite = document.createElement("canvas");
      sprite.width = 32;
      sprite.height = 32;
      const context = sprite.getContext("2d");
      const image = context.createImageData(32, 32);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const ox = (x + 0.5) / 4 - 4;
        const oy = (y + 0.5) / 4 - 4;
        const u = ox * 0.94 - oy * 0.342;
        const v = ox * 0.342 + oy * 0.94;
        const radius = Math.sqrt(u * u / (radiusX * radiusX) + v * v / (radiusY * radiusY));
        const offset = (y * 32 + x) * 4;
        image.data[offset] = 218;
        image.data[offset + 1] = 202;
        image.data[offset + 2] = 136;
        image.data[offset + 3] = Math.round(clamp((1.25 - radius) * 2.8, 0, 1) * 255);
      }
      context.putImageData(image, 0, 0);
      return sprite;
    }

    function drawColonyPollen(now, entry, topLeft, size) {
      if (idleMotion.matches || state.camera.zoom < 24 || topLeft.x + size < 0 || topLeft.y + size < 0 ||
          topLeft.x > viewport.width || topLeft.y > viewport.height) return;
      const phase = hashNoise(entry.x + 113, entry.y + 397) * colonyPollen.periodMs;
      const elapsed = (Math.max(0, now - idleStartedAt) + phase) % colonyPollen.periodMs;
      const scale = size / colonyPollen.referenceSize;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      for (const particle of colonyPollen.particles) {
        const progress = (elapsed - particle.startMs) / particle.lifeMs;
        if (progress <= 0 || progress >= 1) continue;
        const appear = clamp(progress / 0.18, 0, 1);
        const disappear = clamp((1 - progress) / 0.30, 0, 1);
        ctx.globalAlpha = particle.opacity * appear * appear * (3 - 2 * appear) *
          disappear * disappear * (3 - 2 * disappear);
        const x = topLeft.x + (particle.x + particle.driftX * progress) * scale;
        const y = topLeft.y + (particle.y + particle.driftY * progress - 1.3 * Math.sin(Math.PI * progress)) * scale;
        ctx.drawImage(particle.sprite, x - 4 * scale, y - 4 * scale, 8 * scale, 8 * scale);
      }
      ctx.restore();
    }

    function drawColony(now, entry) {
      const cell = state.camera.zoom;
      const size = COLONY_SIZE * cell;
      const appearance = colonyAppearance(entry);
      const destroyed = entry.nestHealth === 0;
      const pebbleBirth = !destroyed && entry.tribe === "pebble" && [...state.agents, ...state.rivals].some(agent =>
        agent.health > 0 && agent.birth?.colonyId === entry.id && state.simSeconds >= agent.birth.startedAt &&
        state.simSeconds < agent.birth.startedAt + PEBBLE_BIRTH_ANIMATION.duration);
      const sprite = pebbleBirth && appearance.birthSprite ? appearance.birthSprite : appearance.sprite;
      if (destroyed) now = 0;
      const topLeft = worldToScreen(entry.x, entry.y);
      const center = worldToScreen(entry.x + 2.5, entry.y + 2.5);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (destroyed) ctx.filter = "grayscale(1) brightness(0.45)";
      let receive = 0;
      for (const delivery of foodDeliveries.values()) {
        if (delivery.colonyId !== entry.id || delivery.receivedAtFrame == null) continue;
        const age = (now - delivery.receivedAtFrame) / 1000;
        if (age >= 0 && age < 0.12) {
          const impact = age < 0.03 ? 1 - (1 - age / 0.03) ** 2 : (1 - (age - 0.03) / 0.09) ** 2;
          receive = Math.max(receive, impact);
        }
      }
      const spriteSize = size * appearance.scale;
      const centerY = appearance.centerY;
      const spriteY = centerY == null ?
        topLeft.y + (size - spriteSize) * 465 / 512 :
        center.y - spriteSize * centerY;
      const anchorY = spriteY + spriteSize * 1860 / 2048;
      ctx.translate(center.x, anchorY);
      let release = 0, prepare = 0;
      if (!idleMotion.matches) {
        for (const agent of [...state.agents, ...state.rivals]) {
          if (agent.birth?.colonyId !== entry.id) continue;
          const age = state.simSeconds - agent.birth.startedAt;
          if (agent.tribe === "pebble") { receive = 0; continue; }
          if (agent.tribe === "spring") {
            if (age >= 0 && age < SPRING_BIRTH_ANIMATION.detachAt) receive = 0;
            continue;
          }
          if (age >= 0 && age < .30) prepare = Math.max(prepare, Math.sin(age / .30 * Math.PI * .5));
          else if (age >= .30 && age < .56) {
            const p = (age - .30) / .26;
            release = Math.max(release, Math.sin(p * Math.PI) * (1 - p));
          }
        }
      }
      ctx.scale((1 - receive * 0.065) * (1 + prepare * .10 - release * .12),
        (1 - receive * 0.13) * (1 - prepare * .17 + release * .22));
      ctx.translate(-center.x, -anchorY);
      if (sprite.complete && sprite.naturalWidth > 0) {
        const spriteX = topLeft.x + (size - spriteSize) / 2;
        const light = colonyLight(now);
        if (pebbleBirth) ctx.drawImage(sprite, spriteX, spriteY, spriteSize, spriteSize);
        else drawIdleSprite(sprite, appearance.animation, now, 0, spriteX, spriteY, spriteSize, spriteSize, false);
        if (appearance.lighting) {
          const lighting = appearance.lighting;
          const x = spriteX + lighting.x * spriteSize, y = spriteY + lighting.y * spriteSize;
          const width = lighting.width * spriteSize, height = lighting.height * spriteSize;
          ctx.save();
          ctx.globalAlpha = light.shade;
          ctx.drawImage(lighting.shade, x, y, width, height);
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = light.glow;
          ctx.drawImage(lighting.glow, x, y, width, height);
          ctx.restore();
        }
      }

      ctx.restore();
      if (!destroyed) drawColonyPollen(now, entry, topLeft, size);
    }

    const audio = globalThis.SpawnerAudio.create();
    const combatAudio = globalThis.SpawnerCombatAudio.create();
    const agentAudio = new Map();
    const deliveryAudio = new Map();
    let audioTime = null;

    function resetAudio() {
      audio.stop();
      globalThis.SpawnerCombatAudio.reset(combatAudio);
      agentAudio.clear();
      deliveryAudio.clear();
      audioTime = null;
    }

    function audioVolume(x, y) {
      if (!state.visible.has(Math.floor(y) * WORLD_SIZE + Math.floor(x))) return 0;
      const position = worldToScreen(x, y);
      const horizontal = Math.abs(position.x - viewport.width / 2) / (viewport.width / 2);
      const vertical = Math.abs(position.y - viewport.height / 2) / (viewport.height / 2);
      if (horizontal >= 1 || vertical >= 1) return 0;
      return Math.min(1, state.camera.zoom / 72) * (1 - Math.max(horizontal, vertical) * 0.8);
    }

    function updateAudio() {
      if (!connection.active || !connection.online || state.camera.layer > 0 || !audio.available()) {
        if (audioTime != null) resetAudio();
        return;
      }
      const time = state.simSeconds;
      if (audioTime != null && (time < audioTime || time - audioTime > 0.5)) resetAudio();
      const firstFrame = audioTime == null;
      for (const event of globalThis.SpawnerCombatAudio.update(combatAudio,
        [...state.agents, ...state.rivals].map(displayedAgent), state.corpses, time)) {
        const unit = event.unit;
        const position = unit.kind === "corpse" ? { x: unit.renderX ?? unit.x, y: unit.renderY ?? unit.y } :
          interpolatedAgentPosition(unit);
        audio.play(event.name, audioVolume(position.x + .5, position.y + .5));
      }
      const agents = new Set();
      const harvesting = new Map();
      for (const source of [...state.agents, ...state.rivals]) {
        const agent = displayedAgent(source);
        if (agent.species === "spiny-back-beetle" || agent.health <= 0) continue;
        agents.add(agent.id);
        const position = interpolatedAgentPosition(agent);
        const volume = audioVolume(position.x + 0.5, position.y + 0.5);
        const birth = agentBirthPose(agent, true);
        if (birth) {
          const previous = agentAudio.get(agent.id);
          if (birth.kind === "pebble") {
            const sameBirth = previous?.birthStartedAt === agent.birth.startedAt;
            const played = sameBirth && previous.birthSoundPlayed;
            const due = birth.elapsed >= PEBBLE_BIRTH_ANIMATION.audioAt &&
              (sameBirth ? previous.elapsed < PEBBLE_BIRTH_ANIMATION.audioAt : birth.elapsed < PEBBLE_BIRTH_ANIMATION.audioAt + .2);
            if (!firstFrame && !played && due) {
              const entry = colonyEntries.find(colony => colony.id === agent.birth.colonyId);
              const outlet = entry ? colonyBirthOutlet(entry) : null;
              audio.play("pebble-birth", outlet ? audioVolume(outlet.x, outlet.y) : volume);
            }
            agentAudio.set(agent.id, { birthStartedAt: agent.birth.startedAt, elapsed: birth.elapsed, birthSoundPlayed: played || due });
            continue;
          }
          if (birth.kind === "spring") {
            if (!firstFrame && birth.elapsed < .2 && previous?.birthStartedAt !== agent.birth.startedAt) {
              const entry = colonyEntries.find(colony => colony.id === agent.birth.colonyId);
              const outlet = entry ? colonyBirthOutlet(entry) : null;
              audio.play("spring-birth", outlet ? audioVolume(outlet.x, outlet.y) : volume);
            }
            agentAudio.set(agent.id, { birthStartedAt: agent.birth.startedAt });
            continue;
          }
          if (!firstFrame && previous?.birthStartedAt === agent.birth.startedAt) {
            if (birth.seedVisible && !previous.seedVisible) {
              const entry = colonyEntries.find(colony => colony.id === agent.birth.colonyId);
              const mouth = entry ? foodDeliveryTarget(entry) : null;
              audio.play("seed-eject", mouth ? audioVolume(mouth.x, mouth.y) : volume);
            }
            if (birth.fractureAge >= 0 && previous.fractureAge < 0) audio.play("seed-crack", volume);
            if (birth.unitVisible && !previous.unitVisible) audio.play(agent.tribe === "spore" ? "spore-birth" : "sprout-pop", volume);
          }
          agentAudio.set(agent.id, { birthStartedAt: agent.birth.startedAt, seedVisible: birth.seedVisible,
            fractureAge: birth.fractureAge, unitVisible: birth.unitVisible });
          continue;
        }
        if (agent.mode === "harvest") {
          const remembered = foodCellMap.get(agent.rememberedFoodKey);
          const food = remembered?.x === agent.x && remembered.y === agent.y ? remembered : foodCellAt(agent.x, agent.y);
          if (food?.amount > 0) {
            const type = Spawner.resourceTypeForCell(food, worldMap);
            if (!(agent.carrying > 0) || !agent.carryingType || agent.carryingType === type)
              harvesting.set(type, Math.max(harvesting.get(type) || 0, volume));
          }
        }
        const end = agent.moveStartedAt + agent.moveDuration;
        const step = agent.moveStartedAt + ":" + agent.stepCount;
        let previous = agentAudio.get(agent.id);
        const appearance = agent.appearanceAttributes || agent.attributes;
        if (["spore", "pebble", "spring"].includes(agent.tribe)) {
          agentAudio.delete(agent.id);
          continue;
        }
        const footstepSound = "footstep";
        const landingSound = "landing";
        if (appearance.feet) {
          const progress = agent.moveDuration ? clamp((time - agent.moveStartedAt) / agent.moveDuration, 0, 1) : 0;
          const contact = Math.min(AGENT_FOOTSTEPS_PER_CELL, Math.floor(progress * AGENT_FOOTSTEPS_PER_CELL + 1e-7));
          const footstep = agent.stepCount * AGENT_FOOTSTEPS_PER_CELL + contact;
          const contactAt = agent.moveStartedAt + contact * agent.moveDuration / AGENT_FOOTSTEPS_PER_CELL;
          if (previous?.footstep < footstep && agent.moveDuration > 0 &&
            time - contactAt <= Math.min(0.12, agent.moveDuration / AGENT_FOOTSTEPS_PER_CELL)) {
            audio.play(footstepSound, volume);
          }
          agentAudio.set(agent.id, { footstep });
          continue;
        }
        if (previous && previous.step !== step) {
          if (!previous.landed && time >= previous.end && time - previous.end < 0.35) {
            audio.play(landingSound, audioVolume(previous.x + 0.5, previous.y + 0.5));
          }
          previous = null;
        }
        if (!previous) {
          previous = { step, end, x: agent.x, y: agent.y, landed: !agent.moveDuration || time >= end };
          agentAudio.set(agent.id, previous);
        }
        if (!previous.landed && time >= end) {
          previous.landed = true;
          if (time - end < 0.35) audio.play(landingSound, volume);
        }
      }
      for (const id of agentAudio.keys()) if (!agents.has(id)) agentAudio.delete(id);
      audio.setHarvest(harvesting);
      const deliveries = new Set();
      for (const delivery of foodDeliveries.values()) {
        const key = delivery.agentId + ":" + delivery.startedAt;
        deliveries.add(key);
        const releaseAt = delivery.startedAt + (delivery.arrivesAt - delivery.startedAt) * 0.24;
        let previous = deliveryAudio.get(key);
        if (!previous) {
          previous = { thrown: firstFrame && time >= releaseAt, received: firstFrame && delivery.receivedAtFrame != null };
          deliveryAudio.set(key, previous);
        }
        if (!previous.thrown && time >= releaseAt) {
          previous.thrown = true;
          if (time - releaseAt < 0.35) audio.play("throw", audioVolume(delivery.x, delivery.y));
        }
        if (!previous.received && delivery.receivedAtFrame != null) {
          previous.received = true;
          const entry = colonyEntries.find(colony => colony.id === delivery.colonyId);
          if (entry && performance.now() - delivery.receivedAtFrame < 350) {
            const target = foodDeliveryTarget(entry);
            audio.play("catch", audioVolume(target.x, target.y));
          }
        }
      }
      for (const key of deliveryAudio.keys()) if (!deliveries.has(key)) deliveryAudio.delete(key);
      audioTime = time;
    }


    function isHarvestingFood(agent) {
      if (agent.mode !== "harvest") return false;
      const food = foodCellAt(agent.x, agent.y);
      return food?.amount > 0 && food.kind !== "corpse" && !Spawner.isTreeFood(food, worldMap);
    }

    function agentCombatPlacement(agent) {
      const layout = agentCombatLayout;
      if (layout.time !== state.simSeconds || layout.agents !== state.agents || layout.rivals !== state.rivals) {
        layout.time = state.simSeconds; layout.agents = state.agents; layout.rivals = state.rivals;
        layout.placements = Spawner.combatLayout([...state.agents, ...state.rivals].map(displayedAgent));
      }
      return layout.placements.get(String(agent.id));
    }

    function agentDeliveryOffset(agent) {
      const returning = agent.mode === "unload" || agent.mode === "return" && agent.carrying > 0;
      const delivery = agent.foodDelivery;
      const remaining = delivery?.receivedAt != null ? clamp(1 - (state.simSeconds - delivery.receivedAt) / .35, 0, 1) : 0;
      if (!returning && !remaining) return { x: 0, y: 0 };
      const entry = colonyEntries.find(colony => colony.ownerId === agent.ownerId);
      if (!entry) return { x: 0, y: 0 };
      const x = (returning ? agent.x : delivery.x - .5) - entry.x;
      const y = (returning ? agent.y : delivery.y - .5) - entry.y;
      const edge = COLONY_SIZE - 1;
      if (![0, edge].includes(x) || ![0, edge].includes(y)) return { x: 0, y: 0 };
      const progress = returning ? agentBasePosition(agent).progress : remaining;
      const inset = .28 * progress * progress * (3 - 2 * progress);
      return { x: Math.sign(edge / 2 - x) * inset, y: Math.sign(edge / 2 - y) * inset };
    }

    function agentDisplayOffset(agent) {
      const combat = agentCombatPlacement(agent);
      if (combat) return combat;
      const layout = agentDisplayLayout;
      if (layout.time !== state.simSeconds || layout.agents !== state.agents || layout.rivals !== state.rivals) {
        layout.time = state.simSeconds;
        layout.agents = state.agents;
        layout.rivals = state.rivals;
        layout.positions = [...state.agents, ...state.rivals].filter(other => other.health > 0)
          .map(other => ({ id: String(other.id), position: agentBasePosition(other) }));
        layout.offsets.clear();
      }
      const id = String(agent.id);
      if (layout.offsets.has(id)) return layout.offsets.get(id);
      const delivery = agentDeliveryOffset(agent);
      const current = layout.positions.find(other => other.id === id);
      let crowding = 0;
      if (current) for (const other of layout.positions) {
        if (other.id === id) continue;
        const dx = other.position.x - current.position.x, dy = other.position.y - current.position.y;
        if (Math.abs(dx) >= AGENT_HEIGHT || Math.abs(dy) >= AGENT_HEIGHT) continue;
        crowding = Math.max(crowding, clamp(1 - Math.hypot(dx, dy) / AGENT_HEIGHT, 0, 1));
        if (crowding === 1) break;
      }
      if (!crowding) {
        const offset = delivery;
        layout.offsets.set(id, offset);
        return offset;
      }
      const separator = id.lastIndexOf(":");
      const index = Number(id.slice(separator + 1)) || 0;
      const seed = [...id.slice(0, separator)].reduce((value, letter) => Math.imul(value, 31) + letter.charCodeAt(0), 0);
      const angle = index * 2.399963229728653 + hashNoise(seed, 17) * Math.PI * 2;
      const spread = 1 - Math.max(Math.abs(delivery.x), Math.abs(delivery.y)) / .28 * .75;
      const radius = (0.18 + hashNoise(seed, index) * 0.12) * crowding * crowding * (3 - 2 * crowding) * spread;
      const offset = { x: delivery.x + Math.cos(angle) * radius, y: delivery.y + Math.sin(angle) * radius * 0.72 };
      layout.offsets.set(id, offset);
      return offset;
    }

    function agentBirthPose(agent, spread) {
      const birth = agent.birth;
      if (!birth) return null;
      const elapsed = Math.max(0, state.simSeconds - birth.startedAt);
      if (elapsed >= agentBirthDuration(agent.tribe)) return null;
      const entry = colonyEntries.find(candidate => candidate.id === birth.colonyId);
      if (agent.tribe === "pebble") {
        const animation = PEBBLE_BIRTH_ANIMATION;
        const outlet = entry ? colonyBirthOutlet(entry) : { x: birth.fromX + .5, y: birth.fromY + .5 };
        const offset = spread ? agentDisplayOffset(agent) : { x: 0, y: 0 };
        const targetX = agent.x + offset.x, targetY = agent.y + offset.y;
        const foot = AGENT_HEIGHT * (animation.unitPivotY / 512 - .5);
        const placement = pebbleBirthPlacement(idleMotion.matches ? animation.duration - .001 : elapsed,
          outlet, { x: targetX + .5, y: targetY + .5 + foot }, AGENT_HEIGHT * animation.unitHeight / 512);
        return { kind: "pebble", elapsed, frame: placement.frame, seedVisible: false, seedLift: 0,
          unitVisible: idleMotion.matches || elapsed >= animation.contactAt, lift: 0,
          targetX, targetY, x: placement.rootX - .5, y: placement.rootY - .5 - foot,
          head: { leftRotation: 0, rightRotation: 0, leftScaleX: 1, rightScaleX: 1, leftScaleY: 1, rightScaleY: 1 } };
      }
      if (agent.tribe === "spring") {
        const outlet = entry ? colonyBirthOutlet(entry) : { x: birth.fromX + .5, y: birth.fromY + .5 };
        const offset = spread ? agentDisplayOffset(agent) : { x: 0, y: 0 };
        const targetX = agent.x + offset.x, targetY = agent.y + offset.y;
        const placement = springBirthPlacement(idleMotion.matches ? SPRING_BIRTH_ANIMATION.duration - .001 : elapsed,
          outlet, { x: targetX + .5, y: targetY + .5 + AGENT_HEIGHT * .44 }, AGENT_HEIGHT * 350 / 512);
        return { kind: "spring", elapsed, frame: placement.frame, seedVisible: false, seedLift: 0,
          unitVisible: idleMotion.matches || elapsed >= SPRING_BIRTH_ANIMATION.contactAt, lift: 0,
          targetX, targetY, x: placement.rootX - .5, y: placement.rootY - .5 - AGENT_HEIGHT * .44,
          head: { leftRotation: 0, rightRotation: 0, leftScaleX: 1, rightScaleX: 1, leftScaleY: 1, rightScaleY: 1 } };
      }
      const mouth = entry ? foodDeliveryTarget(entry) : null;
      const fromX = mouth ? mouth.x - .5 : birth.fromX;
      const fromY = mouth ? mouth.y - .5 + .24 * 1.42 / 2 + .42 - AGENT_HEIGHT * .44 : birth.fromY;
      const offset = spread ? agentDisplayOffset(agent) : { x: 0, y: 0 };
      const targetX = agent.x + offset.x, targetY = agent.y + offset.y;
      const motion = agentBirthMotion(elapsed, targetX - fromX, targetY - fromY);
      if (idleMotion.matches) {
        Object.assign(motion, { seedLift: 0, seedAngle: 0, seedScaleX: 1, seedScaleY: 1,
          scaleX: 1, scaleY: 1, lift: 0, rotation: 0,
          head: { leftRotation: 0, rightRotation: 0, leftScaleX: 1, rightScaleX: 1, leftScaleY: 1, rightScaleY: 1 } });
      }
      return { ...motion, fromX, fromY, targetX, targetY,
        x: fromX + (targetX - fromX) * motion.progress,
        y: fromY + (targetY - fromY) * motion.progress };
    }

    function syncAgentMovements(agents, sampledAt, reset) {
      if (reset) agentMovements.clear();
      const active = new Set();
      for (const agent of agents) {
        active.add(agent.id);
        let frames = agentMovements.get(agent.id);
        if (!frames) { frames = []; agentMovements.set(agent.id, frames); }
        const previous = frames.at(-1);
        const moved = !previous || previous.agent.stepCount !== agent.stepCount ||
          previous.agent.moveStartedAt !== agent.moveStartedAt;
        if (moved || previous.agent.mode !== agent.mode || !!previous.agent.birth !== !!agent.birth) {
          frames.push({ at: moved ? agent.moveStartedAt : sampledAt, agent });
        } else previous.agent = agent;
        while (frames.length > 2 && frames[1].at < state.simSeconds - 0.5) frames.shift();
      }
      for (const id of agentMovements.keys()) if (!active.has(id)) agentMovements.delete(id);
    }

    function displayedAgent(agent) {
      const frames = agentMovements.get(agent.id);
      if (!frames) return agent;
      for (let index = frames.length - 1; index >= 0; index--) {
        if (state.simSeconds >= frames[index].at) return frames[index].agent;
      }
      return frames[0].agent;
    }

    function agentBasePosition(agent) {
      agent = displayedAgent(agent);
      if (agent.species === "spiny-back-beetle" && agent.health <= 0) return {
        x: agent.deathRenderX ?? agent.x, y: agent.deathRenderY ?? agent.y, progress: 1
      };
      const birth = agentBirthPose(agent, false);
      if (birth) return { x: birth.x, y: birth.y, progress: 1 };
      const rawProgress = agent.moveDuration ? clamp(
        (state.simSeconds - agent.moveStartedAt) / agent.moveDuration,
        0,
        1
      ) : 1;
      const appearance = agent.appearanceAttributes || agent.attributes;
      const grounded = agent.species === "spiny-back-beetle" || appearance.feet || ["spore", "pebble", "spring"].includes(agent.tribe);
      const progress = grounded || idleMotion.matches ? rawProgress :
        clamp((rawProgress - AGENT_JUMP_PREPARATION) / (1 - AGENT_JUMP_PREPARATION), 0, 1);
      const smoothProgress = grounded ? progress : progress * progress * (3 - 2 * progress);
      return {
        x: agent.moveDuration ? agent.renderFromX + (agent.x - agent.renderFromX) * smoothProgress : agent.x,
        y: agent.moveDuration ? agent.renderFromY + (agent.y - agent.renderFromY) * smoothProgress : agent.y,
        progress
      };
    }

    function interpolatedAgentPosition(agent) {
      agent = displayedAgent(agent);
      const birth = agentBirthPose(agent, true);
      if (birth) return { x: birth.x, y: birth.y, progress: 1 };
      const position = agentBasePosition(agent);
      const offset = agentDisplayOffset(agent);
      return { x: position.x + offset.x, y: position.y + offset.y, progress: position.progress };
    }

    function drawTalonOwl(agent, renderPosition) {
      const shape = Spawner.TALON_OWL_IDLE;
      const cell = state.camera.zoom;
      const topLeft = worldToScreen(renderPosition.x, renderPosition.y);
      const elapsed = (state.simSeconds - (agent.animationStartedAt ?? 0)) * 1000;
      const index = idleMotion.matches || agent.mode !== "idle" ? 0 : Spawner.talonOwlIdleFrame(elapsed);
      const sprite = talonOwlFrames.get(index);
      if (!sprite) return;
      const size = cell * shape.scale;
      const left = -size * shape.pivotX / shape.frameSize;
      const top = -size * shape.pivotY / shape.frameSize;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(topLeft.x + cell / 2, topLeft.y + cell * 0.86);
      if (agent.facing > 0) ctx.scale(-1, 1);
      const outlineColor = objectOutlineColor("agent", agent);
      if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, null, outlineColor);
      ctx.drawImage(sprite, left, top, size, size);
      ctx.restore();
    }

    function drawBeetleFrame(index, facing, x, floor, cell, outlineColor) {
      const shape = globalThis.Spawner.BEETLE_SPRITE;
      const size = cell * shape.scale;
      const left = -size * shape.pivotX / shape.frameSize;
      const top = -size * shape.pivotY / shape.frameSize;
      const prepared = beetleFrames.get(index);
      const sprite = prepared || beetleSheet;
      const frame = { owner: beetleSheet, size: shape.frameSize, index,
        x: prepared ? 0 : index % shape.columns * shape.frameSize,
        y: prepared ? 0 : Math.floor(index / shape.columns) * shape.frameSize };
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(x, floor);
      if (facing > 0) ctx.scale(-1, 1);
      if (sprite.complete !== false && (sprite.naturalWidth || sprite.width) > 0) {
        if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, frame, outlineColor);
        ctx.drawImage(sprite, frame.x, frame.y, frame.size, frame.size, left, top, size, size);
      } else if (beetleSprite.complete && beetleSprite.naturalWidth > 0) {
        if (outlineColor) drawSelectionOutline(beetleSprite, left, top, size, size, null, outlineColor);
        ctx.drawImage(beetleSprite, left, top, size, size);
      }
      ctx.restore();
    }

    function drawBeetle(agent, renderPosition) {
      const cell = state.camera.zoom;
      const topLeft = worldToScreen(renderPosition.x, renderPosition.y);
      const centerX = topLeft.x + cell / 2;
      const outlineColor = objectOutlineColor("agent", agent);
      if (cell < 8) {
        if (outlineColor) drawSelectionOutline(foodSelectionShape,
          Math.floor(centerX - 1), Math.floor(topLeft.y + cell / 2 - 1), 3, 3, null, outlineColor);
        ctx.fillStyle = "#c36c87";
        ctx.fillRect(Math.floor(centerX - 1), Math.floor(topLeft.y + cell / 2 - 1), 3, 3);
        return;
      }
      const pose = globalThis.Spawner.beetleAnimationPose(agent, state.simSeconds);
      const index = idleMotion.matches && (pose.action === "idle" || pose.action === "walk") ?
        globalThis.Spawner.BEETLE_ANIMATIONS.idle.frames[0] : pose.frame;
      ctx.save();
      ctx.fillStyle = "rgba(5, 9, 10, .24)";
      ctx.beginPath();
      ctx.ellipse(centerX, topLeft.y + cell * 0.86, cell * 0.3, cell * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawBeetleFrame(index, agent.facing, centerX, topLeft.y + cell * 0.86, cell, outlineColor);

    }

    function syncFoodDeliveries(packet, firstSnapshot) {
      const active = new Set();
      const now = performance.now();
      for (const agent of [...packet.state.agents, ...packet.state.rivals]) {
        const delivery = agent.foodDelivery;
        if (!delivery || delivery.amount <= 0) continue;
        const received = delivery.receivedAt != null;
        if (received && (firstSnapshot || packet.state.simSeconds - delivery.receivedAt > 1.2)) continue;
        if (!received && agent.mode !== "unload") continue;
        active.add(agent.id);
        const previous = foodDeliveries.get(agent.id);
        const same = previous?.startedAt === delivery.startedAt;
        foodDeliveries.set(agent.id, { ...delivery, agentId: agent.id,
          receivedAtFrame: same && previous.receivedAtFrame != null ? previous.receivedAtFrame : received ? now : null });
      }
      for (const [id, delivery] of foodDeliveries) {
        if (delivery.receivedAtFrame == null ? !active.has(id) : now - delivery.receivedAtFrame > 1100 && !active.has(id)) foodDeliveries.delete(id);
      }
    }

    function foodDeliveryPose(agent) {
      const delivery = foodDeliveries.get(agent.id);
      if (!delivery || delivery.receivedAtFrame != null) return { scaleX: 1, scaleY: 1 };
      const progress = clamp((state.simSeconds - delivery.startedAt) / (delivery.arrivesAt - delivery.startedAt), 0, 1);
      return foodDeliveryPoseAt(progress);
    }

    function foodDeliveryPoseAt(progress) {
      const stretch = progress >= 0.12 && progress < 0.56 ? Math.sin((progress - 0.12) / 0.44 * Math.PI) : 0;
      return { scaleX: 1 - stretch * 0.025, scaleY: 1 + stretch * 0.08 };
    }

    function foodCarryPlacement(appearance, resourceType) {
      const strength = appearance.strength ?? appearance.arms ?? 0;
      const crop = resourceCarryBounds.get(resourceType);
      const scale = Math.min((strength ? 0.32 : 0.24) * AGENT_HEIGHT / crop.width,
        (strength ? 0.36 : 0.28) * AGENT_HEIGHT / crop.height);
      const width = crop.width * scale, height = crop.height * scale;
      const lift = appearance.feet ? 24 + appearance.feet * 7 : 0;
      const tray = (460 - lift - (142 + Math.max(0, strength - 1) * 12) * 0.78 * 0.48) / 512;
      return { x: 0, y: (tray - 0.94) * AGENT_HEIGHT, width, height, crop, pivotY: 1 };
    }

    function colonyBirthOutlet(entry) {
      const appearance = colonyAppearance(entry), outlet = appearance.birthOutlet;
      if (!outlet) return foodDeliveryTarget(entry);
      const size = COLONY_SIZE * appearance.scale;
      const spriteY = entry.y + 2.5 - size * appearance.centerY;
      return { x: entry.x + (COLONY_SIZE - size) / 2 + size * outlet.x, y: spriteY + size * outlet.y };
    }

    function foodDeliveryTarget(entry) {
      const appearance = colonyAppearance(entry);
      const size = COLONY_SIZE * appearance.scale;
      const spriteY = appearance.centerY == null ? entry.y + (COLONY_SIZE - size) * 465 / 512 :
        entry.y + 2.5 - size * appearance.centerY;
      return { x: entry.x + 2.5, y: spriteY + size * (appearance.top + 0.9) / 2, top: spriteY + size * appearance.top };
    }

    async function createEvolutionPointCache() {
      await Promise.all([evolutionSprite.decode(), document.fonts.load("bold 38px Arial", "+0123456789.")]);
      const ratio = Math.max(2, window.devicePixelRatio || 1);
      const characters = "+0123456789.";
      const surface = document.createElement("canvas");
      surface.width = Math.ceil(characters.length * 40 * ratio);
      surface.height = Math.ceil(14 * 64 * ratio);
      const context = surface.getContext("2d");
      context.scale(ratio, ratio);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(evolutionSprite, 0, 0, 60, 60);
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.lineWidth = 6;
      context.strokeStyle = "rgba(10, 22, 19, 0.9)";
      context.fillStyle = "#e7f7b5";
      const rows = [];
      for (let size = 26; size <= 38; size++) {
        context.font = "bold " + size + "px Arial";
        const y = (size - 25) * 64;
        const glyphs = Object.create(null);
        for (let index = 0; index < characters.length; index++) {
          const character = characters[index];
          const advance = context.measureText(character).width;
          const x = index * 40;
          context.strokeText(character, x + 3, y + 32);
          context.fillText(character, x + 3, y + 32);
          glyphs[character] = { x: x * ratio, y: y * ratio, width: (advance + 6) * ratio, advance };
        }
        rows.push(glyphs);
      }
      const image = new Image();
      image.src = surface.toDataURL("image/png");
      await image.decode();
      ctx.drawImage(image, 0, 0, 1, 1);
      ctx.getImageData(0, 0, 1, 1);
      ctx.clearRect(0, 0, 1, 1);
      return { image, ratio, rows, labels: Array.from({ length: 17 }, (_, amount) => "+" + amount) };
    }

    function drawEvolutionPoints(amount, x, y, icon, fontSize) {
      const cache = evolutionPointCache;
      const glyphs = cache.rows[Math.round(fontSize) - 26];
      const text = cache.labels[amount] || "+" + amount;
      let width = icon + 10;
      for (let index = 0; index < text.length; index++) width += glyphs[text[index]].advance;
      const ratio = window.devicePixelRatio || 1;
      let left = Math.round((x - width / 2) * ratio) / ratio;
      const top = Math.round((y - icon / 2) * ratio) / ratio;
      ctx.drawImage(cache.image, 0, 0, 60 * cache.ratio, 60 * cache.ratio, left, top, icon, icon);
      left += icon + 10;
      for (let index = 0; index < text.length; index++) {
        const glyph = glyphs[text[index]];
        ctx.drawImage(cache.image, glyph.x, glyph.y, glyph.width, 64 * cache.ratio,
          left - 3, y - 32, glyph.width / cache.ratio, 64);
        left += glyph.advance;
      }
    }

    function drawFoodDeliveries(now) {
      const cell = state.camera.zoom;
      for (const [id, delivery] of foodDeliveries) {
        const entry = colonyEntries.find(colony => colony.id === delivery.colonyId);
        if (!entry) continue;
        const target = foodDeliveryTarget(entry);
        const end = worldToScreen(target.x, target.y);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        if (delivery.receivedAtFrame == null) {
          const releaseAt = delivery.startedAt + (delivery.arrivesAt - delivery.startedAt) * 0.24;
          if (state.simSeconds < releaseAt) { ctx.restore(); continue; }
          const sinceRelease = state.simSeconds - releaseAt;
          const flight = clamp(sinceRelease / ((delivery.arrivesAt - delivery.startedAt) * 0.76), 0, 1);
          const agent = state.agents.find(candidate => candidate.id === id) || state.rivals.find(candidate => candidate.id === id);
          const source = agent || { id };
          const type = delivery.resourceType || "honey-mushrooms";
          const sprite = resourceCarrySprites.get(type);
          const placement = foodCarryPlacement(source.appearanceAttributes || source.attributes || {}, type);
          const renderScale = Math.max(cell, 6 / Math.max(placement.width, placement.height));
          const release = agentBodyPose(source, now - sinceRelease * 1000, foodDeliveryPoseAt(0.24));
          const bodyOffset = AGENT_HEIGHT * (release.pivot - 0.94);
          const offset = agentDisplayOffset(source);
          const start = worldToScreen(delivery.x + offset.x + placement.x * release.scaleX,
            delivery.y + offset.y + AGENT_HEIGHT * 0.44 + bodyOffset + (placement.y - bodyOffset) * release.scaleY);
          start.y -= placement.height * renderScale * (placement.pivotY - 0.5);
          const arc = cell * Math.max(1.1, Math.hypot(target.x - delivery.x, target.y - delivery.y) * 0.45);
          const x = start.x + (end.x - start.x) * flight;
          const y = start.y + (end.y - start.y) * flight - 4 * arc * flight * (1 - flight);
          const scale = 1 + Math.sin(Math.min(1, flight / 0.3) * Math.PI / 2) * 0.65;
          const width = placement.width * renderScale * scale, height = placement.height * renderScale * scale;
          ctx.translate(x, y);
          ctx.rotate(flight * Math.PI * 0.65 * Math.sign(end.x - start.x || 1));
          if (sprite?.complete && sprite.naturalWidth > 0) ctx.drawImage(sprite,
            placement.crop.x, placement.crop.y, placement.crop.width, placement.crop.height, -width / 2, -height / 2, width, height);
          else { ctx.fillStyle = "#bacb78"; ctx.fillRect(-width / 2, -height / 2, width, height); }
        } else {
          const age = (now - delivery.receivedAtFrame) / 1100;
          if (age >= 1) { ctx.restore(); continue; }
          const rise = 1 - (1 - age) ** 3;
          const icon = Math.max(32, Math.min(60, cell * 0.92));
          const y = worldToScreen(target.x, target.top).y - Math.max(48, cell * 0.4) - icon * 0.25 - rise * cell * 0.8;
          ctx.globalAlpha = clamp((1 - age) / 0.3, 0, 1);
          const type = delivery.resourceType || "honey-mushrooms";
          if (!Spawner.isTribeFood(type, entry.tribe, worldMap.generationVersion)) {
            const sprite = resourceSprites.get(type);
            if (sprite?.complete && sprite.naturalWidth) ctx.drawImage(sprite, end.x - icon, y - icon / 2, icon, icon);
            ctx.fillStyle = "#e6edce";
            ctx.font = "bold " + Math.max(20, Math.min(32, cell * 0.48)) + "px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("+" + delivery.amount, end.x + 4, y);
          } else drawEvolutionPoints(delivery.amount, end.x, y, icon, Math.max(26, Math.min(38, cell * 0.62)));
        }
        ctx.restore();
      }
    }

    function agentIdlePose(agent, now) {
      let motion = agentHeadMotions.get(agent.id);
      const end = agent.moveStartedAt + (agent.moveDuration || 0);
      if (["harvest", "unload", "fight"].includes(agent.mode) ||
        agent.moveDuration && state.simSeconds < end + 0.36) {
        if (motion) motion.idleStartedAt = null;
        return null;
      }
      if (!motion) {
        motion = { step: agent.moveStartedAt + ":" + agent.stepCount, end,
          duration: agent.moveDuration, landedAt: -Infinity, time: state.simSeconds };
        agentHeadMotions.set(agent.id, motion);
      }
      if (motion.idleStartedAt == null || now < motion.idleStartedAt) motion.idleStartedAt = now;
      const phase = (now - motion.idleStartedAt) / 1000 % 6.8;
      const shrugDuration = Math.PI * 2 / 7.2;
      const shrug = phase / shrugDuration;
      const body = shrug < 1 ? Math.sin(shrug * Math.PI) ** 2 : 0;
      let flap = shrug < 1 ? -Math.sin(shrug * Math.PI * 2) * 0.24 : 0;
      const rest = phase < 2.52 ? (phase - shrugDuration) / (2.52 - shrugDuration) :
        (phase - 2.84) / (6.8 - 2.84);
      if (rest >= 0 && rest < 1) flap += Math.sin(rest * Math.PI) ** 2 * 0.1;
      const flutter = (phase - 2.52) / 0.32;
      if (flutter >= 0 && flutter < 1) flap -= Math.sin(flutter * Math.PI * 2) * Math.sin(flutter * Math.PI) * 0.34;
      return { bodyOffset: -AGENT_HEIGHT * body * 0.02, flap };
    }

    function agentBobOffset(agent, now) {
      if (idleMotion.matches) return 0;
      const idle = agentIdlePose(agent, now);
      if (idle) return idle.bodyOffset;
      const seconds = now / 1000;
      const phase = Number(String(agent.id).split(":").pop()) || 0;
      return AGENT_HEIGHT * (Math.sin(seconds * 2.4 + phase) * 0.03 +
        Math.sin(seconds * 4.1 + phase * 1.7) * 0.012 +
        Math.sin(seconds * 6.8 + phase * 0.63) * 0.006);
    }

    function agentWalkPose(agent) {
      const appearance = agent.appearanceAttributes || agent.attributes;
      const progress = agent.moveDuration ? (state.simSeconds - agent.moveStartedAt) / agent.moveDuration : 1;
      if (!appearance.feet || progress < 0 || progress >= 1 || idleMotion.matches) return null;
      const phase = (agent.stepCount - 1 + progress) * Math.PI * AGENT_FOOTSTEPS_PER_CELL;
      const sprint = agent.attributes.feet >= 2 && agent.straightSteps > 4;
      const load = Math.min(1, agent.carrying / agent.stats.capacity);
      const dx = agent.x - agent.renderFromX;
      return { phase, stride: (appearance.feet > 1 ? 1.25 : 1) * (sprint ? 1.3 : 1),
        rotation: Math.sin(phase) * (appearance.feet > 1 ? 0.025 : 0.045) * (1 + load * 0.2) + dx * (sprint ? 0.085 : 0.018),
        bob: (1 - Math.cos(phase * 2)) * (appearance.feet > 1 ? 0.006 : 0.009), load, sprint };
    }

    function drawAgentFeet(ctx, agent, x, y, width, height, walk, outlineColor) {
      const appearance = agent.appearanceAttributes || agent.attributes;
      if (!appearance.feet) return;
      const partWidth = 280 + appearance.feet * 16;
      const partHeight = 92 + appearance.feet * 8;
      for (const [side, sign] of [["left", -1], ["right", 1]]) {
        const sprite = agentSprite(agent, "feet-" + side);
        if (!sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) continue;
        const phase = walk ? walk.phase + (sign > 0 ? Math.PI : 0) : 0;
        const lift = walk ? Math.max(0, Math.sin(phase)) ** 1.3 * 0.18 * walk.stride : 0;
        const pivotX = (256 + sign * partWidth * 0.25) / 512;
        const pivotY = (500 - partHeight + partHeight * 0.12) / 512;
        const bodyPivot = ((460 - 24 - appearance.feet * 7) / 512 - 0.94) * height;
        const hipX = x + width * pivotX;
        const hipY = y + height * pivotY - bodyPivot;
        const rotation = walk ? walk.rotation : 0;
        ctx.save();
        ctx.translate(hipX * Math.cos(rotation) - hipY * Math.sin(rotation),
          bodyPivot + hipX * Math.sin(rotation) + hipY * Math.cos(rotation) - (walk ? walk.bob * height : 0));
        ctx.rotate(rotation + (walk ? Math.sin(phase) * 0.22 * walk.stride : 0));
        ctx.scale(1, 1 - lift + (walk ? walk.bob / 0.18 : 0));
        if (outlineColor) drawSelectionOutline(sprite, -width * pivotX, -height * pivotY, width, height, null, outlineColor);
        ctx.drawImage(sprite, -width * pivotX, -height * pivotY, width, height);
        ctx.restore();
      }
    }

    function agentBodyPose(agent, now, deliveryPose) {
      const appearance = agent.appearanceAttributes || agent.attributes || {};
      const lift = appearance.feet ? 24 + appearance.feet * 7 : 0;
      const elapsed = agent.moveDuration ? state.simSeconds - agent.moveStartedAt : -1;
      const launch = agent.moveDuration ? clamp(elapsed /
        (agent.moveDuration * AGENT_JUMP_PREPARATION), 0, 1) : 0;
      const landing = clamp((elapsed - (agent.moveDuration || 0) - 0.04) / 0.22, 0, 1);
      const extension = appearance.feet || ["spore", "pebble", "spring"].includes(agent.tribe) || idleMotion.matches ? 0 :
        launch * launch * (3 - 2 * launch) * (1 - landing * landing * (3 - 2 * landing));
      const stretch = extension * 0.24;
      const bob = agentWalkPose(agent) ? 0 : agentBobOffset(agent, now) * (1 - extension);
      return { pivot: (460 - lift) / 512, scaleX: deliveryPose.scaleX * (1 - stretch * 0.35),
        scaleY: deliveryPose.scaleY * (1 + stretch) - bob / (AGENT_HEIGHT * 350 / 512) };
    }

    function agentHeadPose(agent, now) {
      if (idleMotion.matches) return { leftRotation: 0, rightRotation: 0, leftScaleY: 1, rightScaleY: 1 };
      const time = state.simSeconds;
      const step = agent.moveStartedAt + ":" + agent.stepCount;
      const end = agent.moveStartedAt + (agent.moveDuration || 0);
      let motion = agentHeadMotions.get(agent.id);
      if (!motion || time < motion.time) {
        motion = { step, end, duration: agent.moveDuration, landedAt: -Infinity, time,
          idleStartedAt: motion?.idleStartedAt };
        agentHeadMotions.set(agent.id, motion);
      } else if (motion.step !== step) {
        if (motion.duration && time >= motion.end) motion.landedAt = motion.end;
        motion.step = step;
      }
      motion.end = end;
      motion.duration = agent.moveDuration;
      motion.time = time;
      const elapsed = agent.moveDuration ? Math.max(0, time - agent.moveStartedAt) : 0;
      const progress = agent.moveDuration ? clamp(elapsed / agent.moveDuration, 0, 1) : 1;
      const launch = progress < 1 ? clamp(progress / 0.18, 0, 1) : 0;
      let flap = -0.46 * launch * launch * (3 - 2 * launch);
      const landedAt = agent.moveDuration && time >= end ? end : motion.landedAt;
      const landing = (time - landedAt) / 0.36;
      if (landing >= 0 && landing < 1) flap -= 0.46 * Math.cos(landing * Math.PI * 3) * (1 - landing) ** 1.35;
      const appearance = agent.appearanceAttributes || agent.attributes;
      if (appearance.feet) {
        const walk = agentWalkPose(agent);
        flap = walk ? Math.sin(walk.phase - 0.5) * 0.09 - (walk.sprint ? 0.18 : 0.05) : 0;
      }
      if (agent.mode === "harvest") {
        const age = Math.max(0, time - agent.harvestStarted);
        flap += Math.sin(age * Math.PI * 2 / 0.42) * 0.44 * clamp(age / 0.12, 0, 1);
      }
      let actionAge = -1;
      if (agent.mode === "unload") {
        const delivery = foodDeliveries.get(agent.id) || agent.foodDelivery;
        if (delivery) actionAge = time - delivery.startedAt - (delivery.arrivesAt - delivery.startedAt) * 0.24;
      } else if (agent.attack) {
        actionAge = (time - agent.attack.hitAt) * agent.attack.speed;
      }
      if (actionAge >= 0 && actionAge < 0.3) flap -= Math.sin(actionAge / 0.3 * Math.PI) * 0.44 * (1 - actionAge / 0.3);
      const idle = agentIdlePose(agent, now);
      if (idle) flap += idle.flap;
      flap = clamp(flap, -0.75, 0.75);
      const fold = 1 - Math.max(0, -flap) * 0.7;
      return { leftRotation: flap, rightRotation: -flap, leftScaleY: fold, rightScaleY: fold };
    }

    function drawAgentHead(ctx, agent, x, y, width, height, now, outlineColor) {
      const appearance = agent.appearanceAttributes || agent.attributes || {};
      const antenna = appearance.antenna || 0;
      if (antenna) {
        const sprite = agentSprite(agent, "antenna");
        if (!sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) return;
        const lift = appearance.feet ? 24 + appearance.feet * 7 : 0;
        const root = (260 - lift) / 512;
        const pose = agentBirthPose(agent, true)?.head || agentHeadPose(agent, now);
        ctx.save();
        ctx.translate(x + width / 2, y + height * root);
        ctx.rotate(pose.leftRotation);
        ctx.scale(pose.leftScaleX ?? 1, pose.leftScaleY);
        if (outlineColor) drawSelectionOutline(sprite, -width / 2, -height * root, width, height, null, outlineColor);
        else ctx.drawImage(sprite, -width / 2, -height * root, width, height);
        ctx.restore();
        return;
      }
      const left = agentSprite(agent, "sprout-left");
      const right = agentSprite(agent, "sprout-right");
      const stem = agentSprite(agent, "sprout-stem");
      if (![left, right, ...(stem ? [stem] : [])].every(sprite => sprite && sprite.complete !== false && (sprite.naturalWidth || sprite.width))) return;
      const lift = appearance.feet ? 24 + appearance.feet * 7 : 0;
      const root = (110 - lift + 350 * 148.15 / 417) / 512;
      const pivots = [136 + 240 * 133.75 / 286, 136 + 240 * 151.95 / 286];
      const pose = agentBirthPose(agent, true)?.head || agentHeadPose(agent, now);
      for (const [sprite, sourceX, rotation, scaleX, scaleY] of [
        [left, pivots[0], pose.leftRotation, pose.leftScaleX ?? 1, pose.leftScaleY],
        [right, pivots[1], pose.rightRotation, pose.rightScaleX ?? 1, pose.rightScaleY]
      ]) {
        const pivot = sourceX / 512;
        ctx.save();
        ctx.translate(x + width * pivot, y + height * root);
        ctx.rotate(rotation);
        ctx.scale(scaleX, scaleY);
        if (outlineColor) drawSelectionOutline(sprite, -width * pivot, -height * root, width, height, null, outlineColor);
        else ctx.drawImage(sprite, -width * pivot, -height * root, width, height);
        ctx.restore();
      }
      if (stem) {
        if (outlineColor) drawSelectionOutline(stem, x, y, width, height, null, outlineColor);
        else ctx.drawImage(stem, x, y, width, height);
      }
    }

    function drawAgents(now, behindFood) {
      for (const agent of [...state.agents, ...state.rivals]) {
        if (isHarvestingFood(agent) === behindFood) drawAgent(now, agent);
      }
    }

    function drawSpringBirth(ctx, now, agent, birth, topLeft, cell, outlineColor) {
      if (birth.frame === SPRING_BIRTH_ANIMATION.frameCount - 1) {
        drawAgentAppearance(ctx, now, agent, cell, topLeft, { x: birth.x, y: birth.y, progress: 1 }, null, outlineColor);
        return;
      }
      if (!springBirthSheet.complete || !springBirthSheet.naturalWidth) return;
      const animation = SPRING_BIRTH_ANIMATION;
      const scale = cell * AGENT_HEIGHT * 350 / 512 / animation.height;
      const size = animation.frameSize * scale;
      const x = topLeft.x + cell / 2 - animation.pivotX * scale;
      const y = topLeft.y + cell / 2 + cell * AGENT_HEIGHT * .44 - animation.pivotY * scale;
      const sourceX = birth.frame % animation.columns * animation.frameSize;
      const sourceY = Math.floor(birth.frame / animation.columns) * animation.frameSize;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (outlineColor) drawSelectionOutline(springBirthSheet, x, y, size, size,
        { owner: animation, size: animation.frameSize, index: birth.frame, x: sourceX, y: sourceY }, outlineColor);
      ctx.drawImage(springBirthSheet, sourceX, sourceY, animation.frameSize, animation.frameSize, x, y, size, size);
      ctx.restore();
    }

    function drawPebbleBirth(ctx, now, agent, birth, topLeft, cell, outlineColor) {
      const animation = PEBBLE_BIRTH_ANIMATION;
      if (birth.frame === animation.frameCount - 1) {
        drawAgentAppearance(ctx, now, agent, cell, topLeft, { x: birth.x, y: birth.y, progress: 1 }, null, outlineColor);
        return;
      }
      if (!pebbleBirthSheet.complete || !pebbleBirthSheet.naturalWidth) return;
      const scale = cell * AGENT_HEIGHT * animation.unitHeight / 512 / animation.height;
      const size = animation.frameSize * scale;
      const x = topLeft.x + cell / 2 - animation.pivotX * scale;
      const y = topLeft.y + cell / 2 + cell * AGENT_HEIGHT * (animation.unitPivotY / 512 - .5) - animation.pivotY * scale;
      const sourceX = birth.frame % animation.columns * animation.frameSize;
      const sourceY = Math.floor(birth.frame / animation.columns) * animation.frameSize;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (outlineColor) drawSelectionOutline(pebbleBirthSheet, x, y, size, size,
        { owner: animation, size: animation.frameSize, index: birth.frame, x: sourceX, y: sourceY }, outlineColor);
      ctx.drawImage(pebbleBirthSheet, sourceX, sourceY, animation.frameSize, animation.frameSize, x, y, size, size);
      const entry = colonyEntries.find(value => value.id === agent.birth.colonyId);
      if (entry && pebbleBirthForeground.complete && pebbleBirthForeground.naturalWidth) {
        const appearance = colonyAppearance(entry);
        const origin = worldToScreen(entry.x, entry.y);
        const center = worldToScreen(entry.x + 2.5, entry.y + 2.5);
        const nestSize = COLONY_SIZE * cell * appearance.scale;
        ctx.drawImage(pebbleBirthForeground, origin.x + (COLONY_SIZE * cell - nestSize) / 2,
          center.y - nestSize * appearance.centerY, nestSize, nestSize);
      }
      ctx.restore();
    }

    function drawAgentBirth(ctx, now, agent, birth, topLeft, cell, outlineColor) {
      if (birth.kind === "pebble") {
        drawPebbleBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
        return;
      }
      if (birth.kind === "spring") {
        drawSpringBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
        return;
      }
      const appearance = agent.appearanceAttributes || agent.attributes;
      const body = agentSprite(agent, "body");
      for (const layer of appearance.antenna ? ["antenna"] : ["sprout-left", "sprout-right", "sprout-stem"]) agentSprite(agent, layer);
      if (appearance.feet) for (const layer of ["feet-left", "feet-right"]) agentSprite(agent, layer);
      const height = cell * AGENT_HEIGHT;
      const centerX = topLeft.x + cell / 2;
      const footY = topLeft.y + cell / 2 + height * .44;
      const target = { x: centerX + (birth.targetX - birth.x) * cell,
        y: footY + (birth.targetY - birth.y) * cell };
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (birth.seedVisible || birth.unitVisible) {
        ctx.fillStyle = "rgba(5, 9, 10, .16)";
        ctx.beginPath();
        ctx.ellipse(centerX, footY, cell * (birth.seedVisible ? .10 : .125), cell * .026, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (birth.seedVisible) drawBirthSeed(ctx, centerX, footY, cell, birth);
      drawBirthFragments(ctx, target.x, target.y, cell, birth.fractureAge);
      drawBirthImpact(ctx, target.x, target.y, cell, birth.elapsed - 2.50, .6);
      drawBirthImpact(ctx, target.x, target.y, cell, birth.elapsed - 3.21, .22);
      for (const [progress, at] of [[.36, .72], [.72, 1.18]]) {
        const impact = { x: centerX + (birth.fromX + (birth.targetX - birth.fromX) * progress - birth.x) * cell,
          y: footY + (birth.fromY + (birth.targetY - birth.fromY) * progress - birth.y) * cell };
        drawBirthImpact(ctx, impact.x, impact.y, cell, birth.elapsed - at, .15);
      }
      if (birth.unitVisible) {
        const sprite = body;
        if (sprite && sprite.complete !== false && (sprite.naturalWidth || sprite.width) > 0) {
          const width = height * (sprite.naturalWidth || sprite.width) / (sprite.naturalHeight || sprite.height);
          ctx.translate(centerX, footY - birth.lift * cell);
          ctx.rotate(birth.rotation);
          ctx.scale(birth.scaleX, birth.scaleY);
          drawAgentFeet(ctx, agent, -width / 2, -height * .94, width, height, null, outlineColor);
          if (outlineColor) {
            drawAgentHead(ctx, agent, -width / 2, -height * .94, width, height, now, outlineColor);
            drawSelectionOutline(sprite, -width / 2, -height * .94, width, height, null, outlineColor);
          }
          drawAgentHead(ctx, agent, -width / 2, -height * .94, width, height, now, null);
          ctx.drawImage(sprite, -width / 2, -height * .94, width, height);
        }
      }
      ctx.restore();
    }

    async function prepareAgentMovement(tribe) {
      const unit = await tribeArt.prepareUnit(tribe);
      const animation = agentMovementSheets.get(tribe.key);
      if (animation) {
        await animation.sprite.decode();
        animation.scale = Math.min(unit.box.width / animation.width, unit.box.height / animation.height);
      }
      return unit;
    }

    function drawAgentMovement(ctx, agent, centerX, footY, height, outlineColor) {
      const animation = agentMovementSheets.get(agent.tribe);
      const elapsed = state.simSeconds - agent.moveStartedAt;
      if (!animation || !agent.moveDuration || elapsed < 0 || elapsed >= agent.moveDuration ||
        !animation.sprite.complete || !animation.sprite.naturalWidth) return false;
      const progress = elapsed / agent.moveDuration;
      const index = idleMotion.matches ? 0 : Math.floor((agent.stepCount - 1 + progress) * 16) % 16;
      const sprite = animation.sprite;
      const size = height * animation.scale;
      const frame = { owner: sprite, size: 512, index, x: index % 4 * 512, y: Math.floor(index / 4) * 512 };
      ctx.save();
      ctx.translate(centerX, footY);
      ctx.scale(agent.facing < 0 ? -1 : 1, 1);
      if (outlineColor) drawSelectionOutline(sprite, -size / 2, -size * 448 / 512, size, size, frame, outlineColor);
      ctx.drawImage(sprite, frame.x, frame.y, 512, 512, -size / 2, -size * 448 / 512, size, size);
      ctx.restore();
      return true;
    }

    function drawAgentAttack(ctx, agent, centerX, footY, height, outlineColor) {
      const appearance = agent.appearanceAttributes || agent.attributes || {};
      if (["strength", "feet", "antenna", "lifespan"].some(key => appearance[key] > 0)) return false;
      const attackFrame = agentAttackFrame(agent.attack, state.simSeconds);
      const hurtFrame = Spawner.combatHurtFrame(agent, state.simSeconds);
      const action = attackFrame >= 0 ? "attack" : "hurt";
      const index = attackFrame >= 0 ? attackFrame : hurtFrame;
      const sprite = combatSheets.get(agent.tribe || "bean")?.[action];
      if (index < 0 || !sprite?.complete || !sprite.naturalWidth) return false;
      const size = height * .94;
      const frame = { owner: sprite, size: 512, index, x: index % 4 * 512, y: Math.floor(index / 4) * 512 };
      ctx.save();
      ctx.translate(centerX, footY - height * .054);
      ctx.scale(agent.combat ? agent.combat.side === 0 ? 1 : -1 : agent.attack?.directionX || agent.facing || 1, 1);
      if (outlineColor) drawSelectionOutline(sprite, -size / 2, -size * 448 / 512, size, size, frame, outlineColor);
      ctx.drawImage(sprite, frame.x, frame.y, 512, 512, -size / 2, -size * 448 / 512, size, size);
      ctx.restore();
      return true;
    }

    function drawAttackImpacts() {
      const cell = state.camera.zoom;
      for (const agent of [...state.agents, ...state.rivals]) {
        const attack = agent.attack;
        if (!attack || !attack.resolved || !attack.hit) continue;
        const age = (state.simSeconds - attack.hitAt) * attack.speed;
        if (age < 0 || age >= .18) continue;
        const target = [...state.agents, ...state.rivals].find(candidate => candidate.id === attack.targetId);
        const position = target ? interpolatedAgentPosition(target) : { x: attack.targetX, y: attack.targetY };
        const point = worldToScreen(position.x + .5, position.y + .5);
        const progress = age / .18;
        const radius = Math.max(2, cell * (.10 + progress * .10) * (target ? agentCombatPlacement(target)?.scale || 1 : 1));
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = "#ffe6a0";
        ctx.lineWidth = Math.max(1, cell * .018);
        ctx.beginPath();
        for (let index = 0; index < 6; index++) {
          const angle = index * Math.PI / 3;
          ctx.moveTo(point.x + Math.cos(angle) * radius * .45, point.y + Math.sin(angle) * radius * .45);
          ctx.lineTo(point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawAgent(now, agent) {
      const placement = agentCombatPlacement(agent);
      if (!placement || state.camera.zoom < 8) { drawAgentBody(now, agent); return; }
      agent = displayedAgent(agent);
      const position = interpolatedAgentPosition(agent);
      const center = worldToScreen(position.x + .5, position.y + .5);
      const attack = agent.attack;
      const progress = attack ? (state.simSeconds - attack.startedAt) / (attack.endsAt - attack.startedAt) : -1;
      const lunge = progress >= 0 && progress < 1 ? Math.sin(progress * Math.PI) * .045 * placement.facing : 0;
      const hurt = Spawner.combatHurtFrame(agent, state.simSeconds) >= 0;
      const shake = hurt && !idleMotion.matches ? Math.sin((state.simSeconds - agent.hurtStartedAt) * 70) * .009 : 0;
      ctx.save();
      ctx.translate(center.x + (lunge + shake) * state.camera.zoom, center.y);
      ctx.scale(placement.scale, placement.scale);
      ctx.translate(-center.x, -center.y);
      drawAgentBody(now, agent);
      ctx.restore();
    }

    function drawAgentBody(now, agent) {
      agent = displayedAgent(agent);
      const cell = state.camera.zoom;
      const renderPosition = interpolatedAgentPosition(agent);
      const topLeft = worldToScreen(renderPosition.x, renderPosition.y);
      const birth = agentBirthPose(agent, true);
      const margin = Math.max(4, cell * (birth ? Math.max(1.7, birth.seedLift + .4) : .4));
      if (topLeft.x + cell + margin < 0 || topLeft.x - margin > viewport.width ||
        topLeft.y + cell + margin < 0 || topLeft.y - margin > viewport.height) return;
      if (agent.species === "spiny-back-beetle") {
        drawBeetle(agent, renderPosition);
        return;
      }
      if (agent.species === "talon-owl") {
        drawTalonOwl(agent, renderPosition);
        return;
      }
      if (encounterSprites.has(agent.species)) {
        const sprite = encounterSprites.get(agent.species);
        const width = cell * 1.4;
        ctx.save();
        ctx.translate(topLeft.x + cell / 2, topLeft.y + cell);
        ctx.scale(agent.facing < 0 ? -1 : 1, 1);
        ctx.drawImage(sprite, -width / 2, -width * .95, width, width);
        ctx.restore();
        return;
      }
      drawAgentAppearance(ctx, now, agent, cell, topLeft, renderPosition, birth, objectOutlineColor("agent", agent));
      if (!birth) drawAgentLifespanSpirit(agent, cell, topLeft, renderPosition);
    }

    function drawAgentLifespanSpirit(agent, cell, topLeft, renderPosition) {
      const pose = Spawner.agentSpiritPose(agent, state.simSeconds);
      if (!pose) return;
      const crown = Spawner.AGENT_SPIRIT.anchors[agent.tribe] ?? Spawner.AGENT_SPIRIT.anchors.bean;
      const appearance = agent.appearanceAttributes || agent.attributes;
      const jump = appearance.feet || ["spore", "pebble", "spring"].includes(agent.tribe) ? 0 :
        Math.sin(renderPosition.progress * Math.PI) * cell * AGENT_HEIGHT * .18;
      Spawner.drawAgentSpirit(ctx, agentSpiritSprite, pose,
        { x: topLeft.x + cell / 2, y: topLeft.y + cell * (crown - .07) - jump }, cell);
    }

    function drawAgentAppearance(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor) {
      agent = displayedAgent(agent);
      if (birth) {
        drawAgentBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
        return;
      }
      const spriteHeight = cell * AGENT_HEIGHT;
      const centerX = topLeft.x + cell / 2;
      const centerY = topLeft.y + cell / 2;
      const stride = Math.sin(renderPosition.progress * Math.PI);
      const appearance = agent.appearanceAttributes || agent.attributes;
      const bodyPose = agentBodyPose(agent, now, foodDeliveryPose(agent));
      const walk = agentWalkPose(agent);
      const jumpOffset = appearance.feet || ["spore", "pebble", "spring"].includes(agent.tribe) ? 0 : stride * spriteHeight * 0.18;

      if (cell < 8) {
        if (outlineColor) {
          drawSelectionOutline(foodSelectionShape,
            Math.floor(centerX - 1), Math.floor(centerY - jumpOffset - 1), 3, 3, null, outlineColor);
        }
        ctx.fillStyle = agent.carrying > 0 ? "#d6b26b" : "#75c4b6";
        ctx.fillRect(
          Math.floor(centerX - 1),
          Math.floor(centerY - jumpOffset - 1),
          3,
          3
        );
        return;
      }

      const spriteY = centerY - spriteHeight / 2 - jumpOffset;

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        topLeft.x - cell * 0.1,
        topLeft.y - cell * 0.6,
        cell * 1.2,
        cell * 1.7
      );
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "rgba(5, 9, 10, " + Math.max(0.035, 0.18 - jumpOffset / spriteHeight * 0.45) + ")";
      ctx.beginPath();
      ctx.ellipse(
        centerX,
        centerY + spriteHeight * 0.44,
        spriteHeight * (0.18 - jumpOffset / spriteHeight * 0.2),
        spriteHeight * 0.055,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      const sprite = agentSprite(agent, "body");
      const attacking = drawAgentAttack(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
      const moving = !attacking && drawAgentMovement(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
      if (!attacking && !moving && sprite && sprite.complete !== false && (sprite.naturalWidth || sprite.width) > 0) {
        const spriteWidth = spriteHeight * (sprite.naturalWidth || sprite.width) / (sprite.naturalHeight || sprite.height);
        const spriteX = topLeft.x + (cell - spriteWidth) / 2;
        const footY = spriteY + spriteHeight * 0.94;
        const bodyOffset = spriteHeight * (bodyPose.pivot - 0.94);
        ctx.translate(centerX, footY);
        drawAgentFeet(ctx, agent, spriteX - centerX, spriteY - footY, spriteWidth, spriteHeight, walk, outlineColor);
        ctx.translate(0, bodyOffset - (walk ? walk.bob * spriteHeight : 0));
        ctx.rotate(walk ? walk.rotation : 0);
        if (outlineColor) {
          ctx.save();
          ctx.scale(bodyPose.scaleX, bodyPose.scaleY);
          drawAgentHead(ctx, agent, spriteX - centerX, -spriteHeight * bodyPose.pivot,
            spriteWidth, spriteHeight, now, outlineColor);
          drawSelectionOutline(sprite, spriteX - centerX, -spriteHeight * bodyPose.pivot,
            spriteWidth, spriteHeight, null, outlineColor);
          ctx.restore();
        }
        ctx.scale(bodyPose.scaleX, bodyPose.scaleY);
        drawAgentHead(ctx, agent, spriteX - centerX, -spriteHeight * bodyPose.pivot,
          spriteWidth, spriteHeight, now, null);
        ctx.drawImage(sprite, spriteX - centerX, -spriteHeight * bodyPose.pivot,
          spriteWidth, spriteHeight);
      }
      ctx.restore();
      const delivery = agent.foodDelivery;
      const released = delivery && delivery.receivedAt == null &&
        state.simSeconds >= delivery.startedAt + (delivery.arrivesAt - delivery.startedAt) * 0.24;
      if (agent.carrying - (released ? delivery.amount : 0) > 0) {
        const type = agent.carryingType || "honey-mushrooms";
        const sprite = resourceCarrySprites.get(type);
        const placement = foodCarryPlacement(appearance, type);
        const renderScale = Math.max(cell, 6 / Math.max(placement.width, placement.height));
        const width = placement.width * renderScale, height = placement.height * renderScale;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.translate(centerX, spriteY + spriteHeight * 0.94);
        if (walk) ctx.rotate(walk.rotation + Math.sin(walk.phase - 0.45) * walk.load * 0.018);
        const bodyOffset = AGENT_HEIGHT * (bodyPose.pivot - 0.94);
        ctx.translate(0, bodyOffset * cell - (walk ? walk.bob * spriteHeight : 0));
        ctx.translate(placement.x * cell * bodyPose.scaleX,
          (placement.y - bodyOffset) * cell * bodyPose.scaleY);
        if (sprite?.complete && sprite.naturalWidth > 0) ctx.drawImage(sprite,
          placement.crop.x, placement.crop.y, placement.crop.width, placement.crop.height,
          -width / 2, -height * placement.pivotY, width, height);
        else { ctx.fillStyle = "#bacb78"; ctx.fillRect(-width / 2, -height * placement.pivotY, width, height); }
        ctx.restore();
      }
    }

    function drawAgentGroups() {
      const cell = state.camera.zoom;
      if (cell < 8) return;
      const groups = new Map();
      for (const agent of [...state.agents, ...state.rivals]) {
        if (agent.health <= 0 || agent.combat) continue;
        const base = agentBasePosition(agent);
        const x = Math.floor(base.x + 0.5), y = Math.floor(base.y + 0.5);
        const key = x + "," + y + ":" + (agent.ownerId ?? agent.faction) + ":" + (agent.species || "");
        let group = groups.get(key);
        if (!group) {
          group = { count: 0, x, y, faction: agent.faction };
          groups.set(key, group);
        }
        group.count++;
      }
      ctx.save();
      ctx.font = "bold " + clamp(cell * 0.13, 11, 15) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const group of groups.values()) {
        if (group.count < 5) continue;
        const point = worldToScreen(group.x + 0.5, group.y + 1);
        const label = "×" + group.count;
        const width = ctx.measureText(label).width + 12;
        const height = clamp(cell * 0.18, 18, 22);
        const inset = Math.min(3, cell * 0.08);
        const scale = Math.min(1, (cell - inset * 2) / width, (cell - inset * 2) / height);
        const x = point.x - width * scale / 2, y = point.y - height * scale - inset;
        if (x + width * scale < 0 || x > viewport.width || y + height * scale < 0 || y > viewport.height) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = "rgba(13, 24, 22, 0.92)";
        ctx.strokeStyle = group.faction === "colony" ? "#82b8a2" : "#c78e86";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, height / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f0f4df";
        ctx.fillText(label, width / 2, height / 2);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawSelectedAgentMovement() {
      const agent = state.selection?.kind === "agent" ? state.selection.target : null;
      const plan = agent?.movementPlan;
      if (!plan || !state.agents.includes(agent) || agent.health <= 0) return;
      const cell = state.camera.zoom;
      const position = interpolatedAgentPosition(agent);
      const foot = 0.5 + AGENT_HEIGHT * 0.44;
      const points = [worldToScreen(position.x + 0.5, position.y + foot),
        ...plan.route.map(point => worldToScreen(point.x + 0.5, point.y + foot))];
      const length = points.slice(1).reduce((sum, point, index) =>
        sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
      if (length < Math.max(1, cell * 0.04)) return;
      const destination = worldToScreen(plan.destination.x + 0.5, plan.destination.y + foot);
      const width = clamp(cell * 0.025, 1.5, 2.5);
      const arrow = clamp(cell * 0.08, 4, 7);
      const spacing = clamp(cell * 0.65, 38, 64);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = "rgba(20, 29, 24, 0.85)";
      ctx.lineWidth = width + 3;
      ctx.stroke();
      ctx.strokeStyle = "#f5d47e";
      ctx.lineWidth = width;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      let traveled = 0, nextArrow = Math.min(spacing * 0.5, length * 0.5);
      for (let index = 1; index < points.length; index++) {
        const from = points[index - 1], to = points[index];
        const segment = Math.hypot(to.x - from.x, to.y - from.y);
        if (!segment) continue;
        const dx = (to.x - from.x) / segment, dy = (to.y - from.y) / segment;
        while (nextArrow <= traveled + segment && nextArrow < length - 10) {
          const x = from.x + dx * (nextArrow - traveled), y = from.y + dy * (nextArrow - traveled);
          ctx.beginPath();
          ctx.moveTo(x - dx * arrow - dy * arrow * 0.65, y - dy * arrow + dx * arrow * 0.65);
          ctx.lineTo(x, y);
          ctx.lineTo(x - dx * arrow + dy * arrow * 0.65, y - dy * arrow - dx * arrow * 0.65);
          ctx.strokeStyle = "#17271f";
          ctx.lineWidth = width + 3;
          ctx.stroke();
          ctx.strokeStyle = "#fff0b5";
          ctx.lineWidth = width;
          ctx.stroke();
          nextArrow += spacing;
        }
        traveled += segment;
      }
      const flag = clamp(cell * 0.28, 18, 30);
      const radius = clamp(cell * 0.15, 5, 10);
      ctx.beginPath();
      ctx.ellipse(destination.x, destination.y, radius, radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(24, 39, 30, 0.8)";
      ctx.fill();
      ctx.strokeStyle = "#f5d47e";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(destination.x, destination.y);
      ctx.lineTo(destination.x, destination.y - flag);
      ctx.lineTo(destination.x + flag * 0.7, destination.y - flag * 0.78);
      ctx.lineTo(destination.x, destination.y - flag * 0.5);
      ctx.fillStyle = "#f5d47e";
      ctx.fill();
      ctx.strokeStyle = "#17271f";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(destination.x, destination.y);
      ctx.lineTo(destination.x, destination.y - flag);
      ctx.strokeStyle = "#fff0b5";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    function drawFlashes(now) {
      if (state.selection?.kind === "terrain") {
        const point = worldToScreen(state.selection.target.x, state.selection.target.y);
        const size = state.camera.zoom;
        ctx.save();
        ctx.strokeStyle = selectionColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(point.x + 1, point.y + 1, Math.max(1, size - 2), Math.max(1, size - 2));
        ctx.restore();
      }
      state.flashes = state.flashes.filter((flash) => now - flash.startedAt < 680);

      for (const flash of state.flashes) {
        const age = now - flash.startedAt;
        const ratio = 1 - age / 680;
        const pos = worldToScreen(flash.x, flash.y);
        const cell = state.camera.zoom;
        const glow = ctx.createRadialGradient(
          pos.x + cell / 2,
          pos.y + cell / 2,
          0,
          pos.x + cell / 2,
          pos.y + cell / 2,
          cell * 0.74
        );
        glow.addColorStop(0, `rgba(220, 196, 130, ${0.34 * ratio})`);
        glow.addColorStop(0.72, `rgba(196, 174, 112, ${0.12 * ratio})`);
        glow.addColorStop(1, "rgba(196, 174, 112, 0)");

        ctx.save();
        ctx.fillStyle = glow;
        ctx.fillRect(pos.x, pos.y, cell, cell);
        ctx.restore();
      }
    }

    const mapKeys = new Set();
    const mapVelocity = { x: 0, y: 0 };
    let focusedColonyId = null;

    function stopMapMovement() {
      stopCameraTransition();
      mapKeys.clear();
      mapVelocity.x = 0;
      mapVelocity.y = 0;
    }

    function canUseMapShortcuts(target) {
      return connection.active && welcome.hidden && !codex.open && evolutionPanel.hidden &&
        !target?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=tab], [role=separator]");
    }

    function moveMap(elapsed) {
      if (!connection.active || !welcome.hidden || state.dragging) {
        stopMapMovement();
        return;
      }
      if (!canUseMapShortcuts(document.activeElement)) {
        mapKeys.clear();
        mapVelocity.x = 0;
        mapVelocity.y = 0;
        return;
      }
      const x = Number(mapKeys.has("KeyD") || mapKeys.has("ArrowRight")) - Number(mapKeys.has("KeyA") || mapKeys.has("ArrowLeft"));
      const y = Number(mapKeys.has("KeyS") || mapKeys.has("ArrowDown")) - Number(mapKeys.has("KeyW") || mapKeys.has("ArrowUp"));
      const length = Math.hypot(x, y);
      if (!length && !mapVelocity.x && !mapVelocity.y) return;
      stopCameraTransition();
      state.camera.followAgentId = null;
      const targetX = length ? x * 600 / length : 0;
      const targetY = length ? y * 600 / length : 0;
      const response = length ? 12 : 18;
      const decay = Math.exp(-response * elapsed);
      state.camera.x += (targetX * elapsed + (mapVelocity.x - targetX) * (1 - decay) / response) / state.camera.zoom;
      state.camera.y += (targetY * elapsed + (mapVelocity.y - targetY) * (1 - decay) / response) / state.camera.zoom;
      mapVelocity.x = targetX + (mapVelocity.x - targetX) * decay;
      mapVelocity.y = targetY + (mapVelocity.y - targetY) * decay;
      if (!length && Math.hypot(mapVelocity.x, mapVelocity.y) < 1) {
        mapVelocity.x = 0;
        mapVelocity.y = 0;
      }
      clampCamera();
      if ((state.camera.x === 0 && mapVelocity.x < 0) || (state.camera.x === WORLD_SIZE && mapVelocity.x > 0)) mapVelocity.x = 0;
      if ((state.camera.y === 0 && mapVelocity.y < 0) || (state.camera.y === WORLD_SIZE && mapVelocity.y > 0)) mapVelocity.y = 0;
    }

    document.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
        stopMapMovement();
        return;
      }
      if (event.defaultPrevented || !canUseMapShortcuts(event.target)) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        mapKeys.add(event.code);
        return;
      }
      if (!["PageUp", "PageDown", "Home"].includes(event.code)) return;
      event.preventDefault();
      if (event.repeat || !colonyEntries.length) return;
      const current = colonyEntries.findIndex((entry) => entry.id === focusedColonyId);
      const index = event.code === "Home" || current < 0 ? 0 :
        (current + (event.code === "PageDown" ? 1 : -1) + colonyEntries.length) % colonyEntries.length;
      const entry = colonyEntries[index];
      closeColonyMenu();
      moveToColonyEntry(entry);
      selectObject("colony", entry);
    });
    document.addEventListener("keyup", (event) => mapKeys.delete(event.code));
    document.addEventListener("focusin", stopMapMovement);
    document.addEventListener("visibilitychange", stopMapMovement);
    window.addEventListener("blur", stopMapMovement);

    const fogCanvas = document.createElement("canvas");
    const hazardCanvas = document.createElement("canvas");
    fogCanvas.width = WORLD_SIZE;
    fogCanvas.height = WORLD_SIZE;
    hazardCanvas.width = WORLD_SIZE * 8;
    hazardCanvas.height = WORLD_SIZE * 8;

    const FOG_REVEAL_MS = 100;
    const FOG_DARKEN_MS = 900;
    const FOG_HOLD_MS = 3000;
    const FOG_MEMORY_ALPHA = 155;
    const FOG_CHUNK_SIZE = 16;
    const FOG_CHUNK_COLUMNS = Math.ceil(WORLD_SIZE / FOG_CHUNK_SIZE);
    const fogContext = fogCanvas.getContext("2d");
    const fogPixels = fogContext.createImageData(WORLD_SIZE, WORLD_SIZE);
    const fogTransitions = new Map();
    let fogVisible = new Set();

    function fogAlphaAt(index, now) {
      const transition = fogTransitions.get(index);
      if (!transition) return fogPixels.data[index * 4 + 3];
      const darkening = transition.darkenAt !== null && now >= transition.darkenAt;
      const startedAt = darkening ? transition.darkenAt : transition.startedAt;
      const duration = darkening ? FOG_DARKEN_MS : FOG_REVEAL_MS;
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = darkening ? progress * progress * (3 - 2 * progress) : 1 - (1 - progress) ** 3;
      return darkening ? FOG_MEMORY_ALPHA * eased :
        transition.from + (transition.to - transition.from) * eased;
    }

    function advanceFog(now) {
      const changedChunks = new Set();
      for (const [index, transition] of fogTransitions) {
        const offset = index * 4 + 3;
        const alpha = Math.round(fogAlphaAt(index, now));
        if (fogPixels.data[offset] !== alpha) {
          fogPixels.data[offset] = alpha;
          const column = Math.floor((index % WORLD_SIZE) / FOG_CHUNK_SIZE);
          const row = Math.floor(Math.floor(index / WORLD_SIZE) / FOG_CHUNK_SIZE);
          changedChunks.add(row * FOG_CHUNK_COLUMNS + column);
        }
        const finishedAt = transition.darkenAt === null ? transition.startedAt + FOG_REVEAL_MS :
          transition.darkenAt + FOG_DARKEN_MS;
        if (now >= finishedAt) fogTransitions.delete(index);
      }
      for (const chunk of changedChunks) {
        const x = (chunk % FOG_CHUNK_COLUMNS) * FOG_CHUNK_SIZE;
        const y = Math.floor(chunk / FOG_CHUNK_COLUMNS) * FOG_CHUNK_SIZE;
        fogContext.putImageData(fogPixels, 0, 0, x, y,
          Math.min(FOG_CHUNK_SIZE, WORLD_SIZE - x), Math.min(FOG_CHUNK_SIZE, WORLD_SIZE - y));
      }
    }

    function updateFog(now, reset, exploredChanges) {
      if (reset) {
        fogTransitions.clear();
        for (let index = 0; index < WORLD_SIZE * WORLD_SIZE; index++) {
          fogPixels.data[index * 4] = 230;
          fogPixels.data[index * 4 + 1] = 232;
          fogPixels.data[index * 4 + 2] = 231;
          fogPixels.data[index * 4 + 3] = state.visible.has(index) ? 0 : state.explored.has(index) ? FOG_MEMORY_ALPHA : 255;
        }
        fogContext.putImageData(fogPixels, 0, 0);
      } else {
        for (const index of exploredChanges) {
          if (!state.visible.has(index)) {
            fogTransitions.set(index, { from: fogAlphaAt(index, now), to: FOG_MEMORY_ALPHA, startedAt: now, darkenAt: null });
          }
        }
        for (const index of state.visible) {
          if (!fogVisible.has(index)) {
            fogTransitions.set(index, { from: fogAlphaAt(index, now), to: 0, startedAt: now, darkenAt: null });
          }
        }
        for (const index of fogVisible) {
          if (state.visible.has(index)) continue;
          const transition = fogTransitions.get(index) || { from: 0, to: 0, startedAt: now, darkenAt: null };
          transition.darkenAt = now + FOG_HOLD_MS;
          fogTransitions.set(index, transition);
        }
        advanceFog(now);
      }
      fogVisible = state.visible;
      revealForest(exploredChanges);
    }

    function hazardGroundTile(hazard) {
      const key = hazard.kind + ":" + hazard.neighbors + ":" + hazard.tileColumn + ":" + hazard.tileRow;
      if (hazardGroundTiles.has(key)) return hazardGroundTiles.get(key);
      const image = hazardGroundSprites[hazard.kind - 1], cell = image.naturalWidth / 4;
      const surface = document.createElement("canvas");
      surface.width = surface.height = 64;
      const context = surface.getContext("2d");
      context.drawImage(image, hazard.tileColumn * cell, hazard.tileRow * cell, cell, cell, 0, 0, 64, 64);
      if (hazard.neighbors !== 255) {
        const pixels = context.getImageData(0, 0, 64, 64), neighbors = hazard.neighbors;
        const fade = distance => {
          const weight = clamp(distance / 0.28, 0, 1);
          return weight * weight * (3 - 2 * weight);
        };
        for (let py = 0; py < 64; py++) for (let px = 0; px < 64; px++) {
          const x = (px + 0.5) / 64, y = (py + 0.5) / 64;
          let alpha = 1;
          if (!(neighbors & 8)) alpha *= fade(x);
          if (!(neighbors & 16)) alpha *= fade(1 - x);
          if (!(neighbors & 2)) alpha *= fade(y);
          if (!(neighbors & 64)) alpha *= fade(1 - y);
          if (!(neighbors & 1) && (neighbors & 2) && (neighbors & 8)) alpha *= fade(Math.hypot(x, y));
          if (!(neighbors & 4) && (neighbors & 2) && (neighbors & 16)) alpha *= fade(Math.hypot(1 - x, y));
          if (!(neighbors & 32) && (neighbors & 64) && (neighbors & 8)) alpha *= fade(Math.hypot(x, 1 - y));
          if (!(neighbors & 128) && (neighbors & 64) && (neighbors & 16)) alpha *= fade(Math.hypot(1 - x, 1 - y));
          pixels.data[(py * 64 + px) * 4 + 3] *= alpha;
        }
        context.putImageData(pixels, 0, 0);
      }
      hazardGroundTiles.set(key, surface);
      return surface;
    }

    function drawHazardSelection(context, hazard, x, y, size) {
      const color = objectOutlineColor("hazard", hazard);
      if (!color) return;
      context.save();
      context.globalAlpha = 0.14;
      context.fillStyle = color;
      context.fillRect(x - size / 2, y - size / 2, size, size);
      context.restore();
    }

    function drawHazard(context, hazard, x, y, size) {
      const surface = hazardGroundTile(hazard);
      context.drawImage(surface, x - size / 2, y - size / 2, size, size);
      if (context === ctx) drawHazardSelection(context, hazard, x, y, size);
    }

    function updateHazards(seed) {
      const context = hazardCanvas.getContext("2d");
      context.clearRect(0, 0, hazardCanvas.width, hazardCanvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      hazardGroundTiles.clear();
      hazardCells.length = 0;
      for (let index = 0; index < WORLD_SIZE * WORLD_SIZE; index++) {
        const kind = worldMap.hazards[index];
        if (!kind) continue;
        const column = index % WORLD_SIZE, row = Math.floor(index / WORLD_SIZE);
        let neighbors = 0, neighbor = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = column + dx, y = row + dy;
          if (x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE && worldMap.hazards[y * WORLD_SIZE + x] === kind)
            neighbors |= 1 << neighbor;
          neighbor++;
        }
        const hazard = {
          kind, column, row, neighbors,
          tileColumn: (column + (seed & 3)) % 4,
          tileRow: (row + ((seed >>> 2) & 3)) % 4,
          x: column + 0.5, y: row + 0.5
        };
        hazardCells[index] = hazard;
        drawHazard(context, hazard, hazard.x * 8, hazard.y * 8, 8);
      }
    }

    function drawHazards() {
      const zoom = state.camera.zoom;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (zoom <= 8) {
        const a = screenToWorld(0, 0), b = screenToWorld(viewport.width, viewport.height);
        const left = Math.max(0, Math.floor(a.x) - 1), top = Math.max(0, Math.floor(a.y) - 1);
        const right = Math.min(WORLD_SIZE, Math.ceil(b.x) + 1), bottom = Math.min(WORLD_SIZE, Math.ceil(b.y) + 1);
        const origin = worldToScreen(left, top);
        ctx.imageSmoothingQuality = "low";
        clipExploredRegions();
        if (right > left && bottom > top) ctx.drawImage(hazardCanvas, left * 8, top * 8,
          (right - left) * 8, (bottom - top) * 8, origin.x, origin.y,
          (right - left) * zoom, (bottom - top) * zoom);
        for (const object of [state.hover, state.selection]) {
          if (object?.kind !== "hazard" || object === state.hover && isSelectedObject("hazard", object.target)) continue;
          const hazard = object.target;
          const point = worldToScreen(hazard.x, hazard.y);
          drawHazardSelection(ctx, hazard, point.x, point.y, zoom);
        }
      } else {
        const topLeft = screenToWorld(0, 0);
        const bottomRight = screenToWorld(viewport.width, viewport.height);
        for (let row = Math.max(0, Math.floor(topLeft.y)); row <= Math.min(WORLD_SIZE - 1, Math.ceil(bottomRight.y)); row++) {
          for (let column = Math.max(0, Math.floor(topLeft.x)); column <= Math.min(WORLD_SIZE - 1, Math.ceil(bottomRight.x)); column++) {
            const hazard = hazardCells[row * WORLD_SIZE + column];
            if (!hazard || !terrainRendering.revealed[row * WORLD_SIZE + column]) continue;
            const point = worldToScreen(hazard.x, hazard.y);
            drawHazard(ctx, hazard, point.x, point.y, zoom);
          }
        }
      }
      ctx.restore();
    }

    function drawFog(now) {
      advanceFog(now);
      const cell = state.camera.zoom;
      const topLeft = screenToWorld(0, 0), bottomRight = screenToWorld(viewport.width, viewport.height);
      const left = Math.max(0, Math.floor(topLeft.x) - 1), top = Math.max(0, Math.floor(topLeft.y) - 1);
      const right = Math.min(WORLD_SIZE, Math.ceil(bottomRight.x) + 1), bottom = Math.min(WORLD_SIZE, Math.ceil(bottomRight.y) + 1);
      const origin = worldToScreen(left, top);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
      if (right > left && bottom > top) ctx.drawImage(fogCanvas, left, top, right - left, bottom - top,
        origin.x, origin.y, (right - left) * cell, (bottom - top) * cell);
      ctx.font = "bold " + Math.max(10, Math.min(28, cell * 0.65)) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const marker of state.markers) {
        const point = worldToScreen(marker.x + 0.5, marker.y + 0.5);
        if (point.x < -30 || point.y < -30 || point.x > viewport.width + 30 || point.y > viewport.height + 30) continue;
        ctx.fillStyle = "#101719";
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(6, Math.min(20, cell * 0.4)), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f5d47e";
        ctx.fillText("!", point.x, point.y);
      }
      ctx.restore();
    }

    let renderFrame = null;

    function scheduleRender() {
      if (renderFrame === null && !document.hidden && !connection.synchronizing) renderFrame = requestAnimationFrame(render);
    }

    function render(now) {
      renderFrame = null;
      if (document.hidden || connection.synchronizing) return;
      drawTribePreviews(now);
      if (viewport.pixelRatio !== (window.devicePixelRatio || 1)) resizeCanvas();
      updateZoom(now);
      moveMap(Math.min(0.05, Math.max(0, (now - state.lastFrame) / 1000)));
      state.lastFrame = now;
      if (!connection.active || !terrainRendering.ready) { updateAudio(); scheduleRender(); return; }
      state.simSeconds = Math.max(state.simSeconds, connection.simSeconds +
        Math.min(0.3, (now - connection.receivedAt) / 1000) - MOVEMENT_DELAY);
      for (const delivery of foodDeliveries.values()) {
        if (delivery.receivedAtFrame == null && state.simSeconds >= delivery.arrivesAt) delivery.receivedAtFrame = now;
      }
      updateCameraTransition(now);
      updateCameraFollow();
      updateAudio();
      updateTreeMotion();
      updateSelection();
      updateHover();

      ctx.clearRect(0, 0, viewport.width, viewport.height);
      ctx.fillStyle = "#111619";
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      drawTerrain();
      drawGrid();
      drawHazards();
      for (const signal of state.encounterSignals || []) {
        const point = worldToScreen(signal.x + .5, signal.y + .5);
        const radius = Math.max(2, state.camera.zoom * .18);
        ctx.beginPath();
        if (signal.kind === "light") ctx.arc(point.x, point.y, radius * 3, 0, Math.PI * 2);
        else if (signal.kind === "mound") ctx.ellipse(point.x, point.y, radius, radius * .45, 0, 0, Math.PI * 2);
        else for (let index = -1; index <= 1; index++) ctx.ellipse(point.x + radius * index * 1.5, point.y + (index % 2 ? radius : 0), radius * .3, radius * .5, .4, 0, Math.PI * 2);
        ctx.fillStyle = signal.kind === "light" ? "#f2df91aa" : "#b99c71aa";
        ctx.fill();
      }
      drawTravelTraces();
      drawCorpses();
      drawWorldBounds();
      drawFlashes(now);
      for (const entry of colonyEntries) drawColonyGround(entry,
        worldToScreen(entry.x, entry.y), COLONY_SIZE * state.camera.zoom, colonyAppearance(entry));
      drawSelectedAgentMovement();
      drawWorldObjects(now);
      drawAttackImpacts();
      drawAgentGroups();
      drawFoodDeliveries(now);
      drawFoodStatus();
      drawBurrowStatus();
      drawFog(now);
      positionHelpTooltip();
      drawAgentAvatars(now);

      scheduleRender();
    }

    function zoomForLayer(layer) {
      return ZOOM_LAYERS[layer] ?? Math.max(MIN_ZOOM,
        Math.min(4, Math.min(viewport.width || 1200, viewport.height || 760) * 0.9 / WORLD_SIZE));
    }

    function updateZoomLayerButtons() {
      zoomLayerButtons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === state.camera.layer)));
    }

    function selectZoomLayer(layer, anchorX, anchorY) {
      const selected = clamp(layer, 0, ZOOM_LAYERS.length - 1);
      if (selected === state.camera.layer) return;
      stopCameraTransition();
      state.camera.layer = selected;
      if (selected > 0) resetAudio();
      const continent = selected === ZOOM_LAYERS.length - 1;
      if (continent) state.camera.followAgentId = null;
      zoomTransition = {
        from: state.camera.zoom, to: zoomForLayer(selected),
        anchorX: continent ? viewport.width / 2 : anchorX,
        anchorY: continent ? viewport.height / 2 : anchorY,
        center: continent ? { x: state.camera.x, y: state.camera.y } : null,
        startedAt: performance.now()
      };
      updateZoomLayerButtons();
    }

    function updateZoom(now) {
      if (!zoomTransition) return;
      const progress = clamp((now - zoomTransition.startedAt) / 120, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (zoomTransition.center) {
        state.camera.x = zoomTransition.center.x + (WORLD_SIZE / 2 - zoomTransition.center.x) * eased;
        state.camera.y = zoomTransition.center.y + (WORLD_SIZE / 2 - zoomTransition.center.y) * eased;
      }
      setZoom(zoomTransition.from + (zoomTransition.to - zoomTransition.from) * eased,
        zoomTransition.anchorX, zoomTransition.anchorY);
      if (progress === 1) zoomTransition = null;
    }

    function stopCameraTransition() {
      if (cameraTransition?.agentId != null) state.camera.followAgentId = null;
      cameraTransition = null;
    }

    function moveCameraTo(x, y, zoom) {
      stopMapMovement();
      zoomTransition = null;
      state.camera.followAgentId = null;
      const to = { x: clamp(x, 0, WORLD_SIZE), y: clamp(y, 0, WORLD_SIZE), zoom };
      const distance = Math.hypot(to.x - state.camera.x, to.y - state.camera.y) * Math.max(state.camera.zoom, zoom);
      const viewportSize = Math.max(1, Math.hypot(viewport.width, viewport.height));
      cameraTransition = {
        from: { x: state.camera.x, y: state.camera.y, zoom: state.camera.zoom },
        to,
        duration: clamp(360 + Math.log2(Math.max(1, distance / viewportSize)) * 320, 360, 2200),
        startedAt: performance.now()
      };
    }

    function updateCameraTransition(now) {
      if (!cameraTransition) return;
      if (cameraTransition.agentId != null) {
        const agent = state.agents.find(candidate => candidate.id === cameraTransition.agentId && candidate.health > 0);
        if (!agent) {
          stopCameraTransition();
          return;
        }
        const position = interpolatedAgentPosition(agent);
        cameraTransition.to.x = clamp(position.x + 0.5, 0, WORLD_SIZE);
        cameraTransition.to.y = clamp(position.y + 0.5, 0, WORLD_SIZE);
      }
      const { from, to, startedAt, duration } = cameraTransition;
      const progress = now >= startedAt + duration ? 1 : clamp((now - startedAt) / duration, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      state.camera.x = from.x + (to.x - from.x) * eased;
      state.camera.y = from.y + (to.y - from.y) * eased;
      state.camera.zoom = from.zoom + (to.zoom - from.zoom) * eased;
      clampCamera();
      if (progress === 1) cameraTransition = null;
    }

    function setZoom(nextZoom, anchorX, anchorY) {
      const before = screenToWorld(anchorX, anchorY);
      state.camera.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const after = screenToWorld(anchorX, anchorY);
      state.camera.x += before.x - after.x;
      state.camera.y += before.y - after.y;
      clampCamera();
      if (state.dragging) {
        state.cameraStart.x = state.camera.x + state.dragOffset.x / state.camera.zoom;
        state.cameraStart.y = state.camera.y + state.dragOffset.y / state.camera.zoom;
      }
    }

    function focusColony() {
      stopMapMovement();
      state.camera.followAgentId = null;
      zoomTransition = null;
      focusedColonyId = connection.colonyId;
      state.camera.x = COLONY_CENTER.x;
      state.camera.y = COLONY_CENTER.y;
      state.camera.zoom = INITIAL_ZOOM;
      state.camera.layer = 0;
      updateZoomLayerButtons();
      clampCamera();
    }

    function moveToColony() {
      state.camera.layer = 0;
      focusedColonyId = connection.colonyId;
      moveCameraTo(COLONY_CENTER.x, COLONY_CENTER.y, INITIAL_ZOOM);
      updateZoomLayerButtons();
    }

    colonyFocus.addEventListener("click", () => {
      canvas.focus();
      moveToColony();
    });

    function clampCamera() {
      state.camera.x = clamp(state.camera.x, 0, WORLD_SIZE);
      state.camera.y = clamp(state.camera.y, 0, WORLD_SIZE);
    }

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const anchorX = event.clientX - rect.left;
      const anchorY = event.clientY - rect.top;
      if (event.deltaY === 0) return;
      selectZoomLayer(state.camera.layer + Math.sign(event.deltaY), anchorX, anchorY);
    }, { passive: false });

    zoomLayerButtons.forEach((button, index) => button.addEventListener("click", () => {
      selectZoomLayer(index, viewport.width / 2, viewport.height / 2);
      canvas.focus();
    }));

    function selectableObjectAt(x, y) {
      const world = screenToWorld(x, y);
      const cellX = Math.floor(world.x);
      const cellY = Math.floor(world.y);
      const colony = colonyAt(cellX, cellY);
      const food = foodCellAt(cellX, cellY);
      const agents = [...state.agents].sort((first, second) =>
        interpolatedAgentPosition(second).y - interpolatedAgentPosition(first).y).filter((candidate) => {
        const position = interpolatedAgentPosition(candidate);
        const birth = agentBirthPose(candidate, true);
        if (birth && !birth.unitVisible) return false;
        const appearance = candidate.appearanceAttributes || candidate.attributes;
        const jump = birth ? birth.lift : appearance.feet ? 0 : Math.sin(position.progress * Math.PI) * AGENT_HEIGHT * 0.18;
        const bodyPose = state.camera.zoom < 8 ? { pivot: 0, scaleX: 1, scaleY: 1 } :
          agentBodyPose(candidate, state.lastFrame, foodDeliveryPose(candidate));
        const height = state.camera.zoom < 8 ? 3 / state.camera.zoom : AGENT_HEIGHT * (agentCombatPlacement(candidate)?.scale || 1);
        const sprite = agentSprite(candidate);
        const width = state.camera.zoom < 8 ? height : height *
          (sprite.naturalWidth || sprite.width || starterObjectSprite.naturalWidth) /
          (sprite.naturalHeight || sprite.height || starterObjectSprite.naturalHeight) * Math.max(1, bodyPose.scaleX);
        const left = position.x + (1 - width) / 2;
        const spriteTop = position.y + (1 - height) / 2 - jump;
        const top = spriteTop + Math.min(0, height * bodyPose.pivot * (1 - bodyPose.scaleY));
        const bottom = spriteTop + height * Math.max(1, bodyPose.pivot + (1 - bodyPose.pivot) * bodyPose.scaleY);
        return world.x >= left && world.x <= left + width &&
          world.y >= top && world.y <= bottom;
      });
      const selected = state.selection?.kind === "agent" ? agents.indexOf(state.selection.target) : -1;
      const agent = agents[(selected + 1) % agents.length];
      if (agent) return { kind: "agent", target: agent };
      if (colony) return { kind: "colony", target: colony };
      const burrow = state.explored.has(cellY * WORLD_SIZE + cellX) && worldMap.burrows.find(point => point.health > 0 &&
        cellX >= point.x && cellX < point.x + point.width && cellY >= point.y && cellY < point.y + point.height);
      if (burrow) return { kind: "burrow", target: burrow };
      if (food && food.amount > 0) return { kind: food.kind === "corpse" ? "corpse" : "food", target: food };
      if (cellX >= 0 && cellY >= 0 && cellX < WORLD_SIZE && cellY < WORLD_SIZE &&
          state.explored.has(cellY * WORLD_SIZE + cellX)) {
        const tree = forest.cells.get(cellX + "," + cellY);
        if (tree && !treeOverlapsColony(tree)) return { kind: "tree", target: tree };
        const hazard = hazardCells[cellY * WORLD_SIZE + cellX];
        if (hazard) return { kind: "hazard", target: hazard };
      }
      const cell = terrainCodexCell({ ...worldMap, size: WORLD_SIZE }, state.explored, cellX, cellY);
      return cell ? { kind: "terrain", target: cell } : null;
    }

    function updateHover() {
      const rect = canvas.getBoundingClientRect();
      const pointer = state.hoverPointer;
      const x = pointer ? pointer.x - rect.left : -1;
      const y = pointer ? pointer.y - rect.top : -1;
      state.hover = connection.active && !state.dragging && x >= 0 && y >= 0 &&
        x < viewport.width && y < viewport.height ? selectableObjectAt(x, y) : null;
      canvas.style.cursor = state.dragging && state.didDrag ? "grabbing" : state.hover ? "pointer" : "";
    }

    function trackHoverPointer(event) {
      state.hoverPointer = event.pointerType === "touch" ? null : { x: event.clientX, y: event.clientY };
    }

    canvas.addEventListener("pointerdown", (event) => {
      stopMapMovement();
      trackHoverPointer(event);
      canvas.setPointerCapture(event.pointerId);
      state.dragging = true;
      state.didDrag = false;
      state.dragStart.x = event.clientX;
      state.dragStart.y = event.clientY;
      state.dragOffset.x = 0;
      state.dragOffset.y = 0;
      state.cameraStart.x = state.camera.x;
      state.cameraStart.y = state.camera.y;
      updateHover();
    });

    canvas.addEventListener("pointermove", (event) => {
      trackHoverPointer(event);
      updateHover();
      if (!state.dragging) {
        return;
      }

      const dx = event.clientX - state.dragStart.x;
      const dy = event.clientY - state.dragStart.y;
      state.dragOffset.x = dx;
      state.dragOffset.y = dy;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        state.didDrag = true;
        state.camera.followAgentId = null;
      }
      state.camera.x = state.cameraStart.x - dx / state.camera.zoom;
      state.camera.y = state.cameraStart.y - dy / state.camera.zoom;
      clampCamera();
    });

    canvas.addEventListener("pointerup", (event) => {
      trackHoverPointer(event);
      if (connection.active && !state.didDrag && event.button === 0) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const world = screenToWorld(x, y);
        const object = selectableObjectAt(x, y);

        if (object && event.button === 0) audio.playClick();
        if (object?.kind === "agent") {
          closeColonyMenu();
          selectObject("agent", object.target);
        } else if (object?.kind === "colony") {
          openColonyPanel(object.target);
        } else if (object) {
          closeColonyMenu();
          selectObject(object.kind, object.target);
        } else {
          closeColonyMenu();
          selectObject(null, null);
          state.flashes.push({
            x: Math.floor(world.x),
            y: Math.floor(world.y),
            startedAt: performance.now()
          });
        }
      }

      state.dragging = false;
      updateHover();
    });

    canvas.addEventListener("pointerleave", () => {
      state.hoverPointer = null;
      updateHover();
    });

    function cancelPointer() {
      state.dragging = false;
      state.hoverPointer = null;
      updateHover();
    }

    canvas.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("blur", cancelPointer);

    function dismissDiscoveryToast(toast) {
      clearTimeout(discoveryToastTimers.get(toast));
      discoveryToastTimers.delete(toast);
      toast.remove();
    }

    function clearDiscoveryToasts() {
      for (const timer of discoveryToastTimers.values()) clearTimeout(timer);
      discoveryToastTimers.clear();
      discoveryToasts.replaceChildren();
    }

    function focusDiscovery(entry) {
      state.camera.layer = 0;
      updateZoomLayerButtons();
      moveCameraTo(entry.x + 0.5, entry.y + 0.5, zoomForLayer(0));
      scheduleRender();
    }

    function createObjectImage(sprite, crop) {
      const image = document.createElement("canvas");
      image.className = "object-image";
      image.setAttribute("aria-hidden", "true");
      const ratio = window.devicePixelRatio || 1;
      image.width = image.height = Math.round(96 * ratio);
      function draw() {
        const width = crop?.width || sprite.naturalWidth || sprite.width;
        const height = crop?.height || sprite.naturalHeight || sprite.height;
        if (!width || !height) return;
        const scale = Math.min(image.width / width, image.height / height) * 0.94;
        const context = image.getContext("2d");
        context.clearRect(0, 0, image.width, image.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(sprite, crop?.x || 0, crop?.y || 0, width, height,
          (image.width - width * scale) / 2, (image.height - height * scale) / 2, width * scale, height * scale);
      }
      if (sprite.complete === false) sprite.addEventListener("load", draw, { once: true });
      else draw();
      return image;
    }

    function createColonyImage(entry) {
      const appearance = colonyAppearance(entry);
      const sprite = appearance.sprite;
      const sourceWidth = appearance.animation?.sheet ? appearance.animation.frameSize : sprite.naturalWidth;
      const sourceHeight = appearance.animation?.sheet ? appearance.animation.frameSize : sprite.naturalHeight;
      const width = appearance.groundWidth * sourceWidth;
      return createObjectImage(sprite, { x: (sourceWidth - width) / 2,
        y: appearance.top * sourceHeight, width, height: (1 - appearance.top) * sourceHeight });
    }

    function createDiscoveryImage(entry) {
      const key = entry.key.slice(entry.key.indexOf(":") + 1);
      let sprite = resourceSprites.get(key) || starterObjectSprite;
      let crop = null;
      if (key === "tree") crop = { x: 0, y: 0, width: forest.sprite.naturalHeight, height: forest.sprite.naturalHeight };
      if (entry.kind === "creature" && key === "spiny-back-beetle") sprite = beetleSprite;
      if (entry.kind === "creature" && key === "talon-owl") sprite = talonOwlFrames.get(0);
      if (entry.kind === "creature" && encounterSprites.has(key)) sprite = encounterSprites.get(key);
      if (entry.kind === "burrow") {
        const appearance = burrowAppearances.get(key);
        if (appearance) { sprite = appearance.sprite; crop = appearance.crop; }
      }
      if (entry.kind === "colony") {
        const appearance = colonyAppearances[0];
        sprite = appearance.sprite;
        const sourceWidth = appearance.animation?.sheet ? appearance.animation.frameSize : sprite.naturalWidth;
        const sourceHeight = appearance.animation?.sheet ? appearance.animation.frameSize : sprite.naturalHeight;
        const width = appearance.groundWidth * sourceWidth;
        crop = { x: (sourceWidth - width) / 2, y: appearance.top * sourceHeight,
          width, height: (1 - appearance.top) * sourceHeight };
      }
      const image = createObjectImage(sprite, crop);
      image.classList.add("discovery-image");
      image.dataset.discoveryImage = "";
      return image;
    }

    function showDiscoveryToast(entry) {
      const toast = document.createElement("div");
      toast.className = "discovery-toast";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "discovery-toast-open";
      open.setAttribute("aria-label", entry.name + " · 발견 위치로 이동");
      const label = document.createElement("small");
      label.textContent = "새로운 발견";
      const title = document.createElement("strong");
      title.textContent = entry.name;
      const detail = document.createElement("span");
      detail.textContent = "발견 위치 보기";
      open.append(createDiscoveryImage(entry), label, title, detail);
      open.addEventListener("click", () => {
        dismissDiscoveryToast(toast);
        focusDiscovery(entry);
      });
      const close = document.createElement("button");
      close.type = "button";
      close.className = "discovery-toast-close";
      close.setAttribute("aria-label", entry.name + " 발견 알림 닫기");
      close.textContent = "×";
      close.addEventListener("click", () => dismissDiscoveryToast(toast));
      toast.append(open, close);
      discoveryToasts.append(toast);
      discoveryToastTimers.set(toast, setTimeout(() => dismissDiscoveryToast(toast), 7000));
    }

    function updateNotifications(previousKeys, firstSnapshot) {
      if (firstSnapshot) { clearDiscoveryToasts(); return; }
      const added = state.discoveries.filter(entry => !previousKeys.has(entry.key));
      if (!added.length) return;
      for (const entry of added) showDiscoveryToast(entry);
      discoveryToasts.scrollTop = discoveryToasts.scrollHeight;
      audio.play("discovery", 1);
    }

    function closeNestNameEditor(restoreFocus) {
      nestNameForm.hidden = true;
      nestNameDisplay.hidden = false;
      nestRenameOpen.setAttribute("aria-expanded", "false");
      renamedColonyId = null;
      nestNameStatus.textContent = "";
      nestNameInput.setCustomValidity("");
      if (restoreFocus && !colonyMenu.hidden) nestRenameOpen.focus();
    }

    function openNestNameEditor() {
      if (!colonyMenuEntry || connection.busy || !connection.online) return;
      renamedColonyId = colonyMenuEntry.id;
      nestNameInput.value = colonyMenuEntry.name;
      nestNameInput.setCustomValidity("");
      nestNameStatus.textContent = "";
      nestNameDisplay.hidden = true;
      nestNameForm.hidden = false;
      nestRenameOpen.setAttribute("aria-expanded", "true");
      nestNameInput.focus();
      nestNameInput.select();
    }

    function closeColonyMenu() {
      closeNestNameEditor(false);
      closeEvolutionPanel();
      colonyMenu.hidden = true;
      canvas.focus();
    }

    evolutionOpenButton.addEventListener("click", () => openUnitDesign(null));
    evolutionClose.addEventListener("click", closeEvolutionPanel);

    const colonySearch = document.getElementById("colony-search");
    const colonyList = document.getElementById("colony-list");
    const colonyResults = document.getElementById("colony-results");
    const colonyPrevious = document.getElementById("colony-previous");
    const colonyNext = document.getElementById("colony-next");
    const colonyPage = document.getElementById("colony-page");
    let colonyListPage = 0;

    function renderColonyList() {
      const query = colonySearch.value.trim().toLocaleLowerCase();
      const matches = colonyEntries.filter((entry) => entry.name.toLocaleLowerCase().includes(query) || String(entry.id).includes(query));
      const pageCount = Math.max(1, Math.ceil(matches.length / 50));
      colonyListPage = clamp(colonyListPage, 0, pageCount - 1);
      const start = colonyListPage * 50;
      const entries = matches.slice(start, start + 50);
      const ids = new Set(entries.map(entry => String(entry.id)));
      for (const item of [...colonyList.children]) {
        if (!ids.has(item.dataset.colonyId)) item.remove();
      }
      for (const [index, entry] of entries.entries()) {
        let button = colonyList.querySelector('[data-colony-id="' + entry.id + '"]');
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = "colony-item";
          button.dataset.colonyId = String(entry.id);
          button.append(document.createElement("strong"));
          button.addEventListener("click", () => {
            const current = colonyEntries.find(candidate => candidate.id === entry.id);
            if (current) selectColonyEntry(current);
          });
        }
        button.setAttribute("aria-current", String(isSelectedObject("colony", entry)));
        const level = entry.id === connection.colonyId ? state.nestLevel : entry.nestLevel ?? 1;
        if (button.dataset.nestLevel !== String(level)) {
          const image = createColonyImage(entry);
          const previous = button.querySelector("canvas");
          if (previous) previous.replaceWith(image);
          else button.prepend(image);
          button.dataset.nestLevel = String(level);
        }
        const name = button.querySelector("strong");
        if (name.textContent !== entry.name) name.textContent = entry.name;
        button.title = entry.name + " · Lv." + level + (entry.nestHealth === 0 ? " · 파괴됨" : " · 체력 " + entry.nestHealth + "/" + entry.nestMaxHealth) + " · #" + entry.id + " · (" + entry.x + ", " + entry.y + ")";
        button.setAttribute("aria-label", entry.name + " · 레벨 " + level + " · 둥지로 이동");
        const sibling = colonyList.children[index];
        if (sibling !== button) colonyList.insertBefore(button, sibling || null);
      }
      if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "colony-empty";
        empty.textContent = query ? "검색 결과가 없습니다." : "둥지가 없습니다.";
        colonyList.append(empty);
      }
      colonyResults.textContent = "전체 " + colonyEntries.length.toLocaleString() + "개 · 검색 " + matches.length.toLocaleString() + "개";
      colonyPage.textContent = (colonyListPage + 1) + " / " + pageCount;
      colonyPrevious.disabled = colonyListPage === 0;
      colonyNext.disabled = colonyListPage >= pageCount - 1;
    }

    function moveToColonyEntry(entry) {
      moveCameraTo(entry.x + COLONY_SIZE / 2, entry.y + COLONY_SIZE / 2, zoomForLayer(state.camera.layer));
      focusedColonyId = entry.id;
    }

    function selectColonyEntry(entry) {
      openColonyPanel(entry);
      moveToColonyEntry(entry);
    }

    colonySearch.addEventListener("input", () => {
      colonyListPage = 0;
      renderColonyList();
      colonyList.scrollTop = 0;
    });
    colonyPrevious.addEventListener("click", () => {
      colonyListPage -= 1;
      renderColonyList();
      colonyList.scrollTop = 0;
    });
    colonyNext.addEventListener("click", () => {
      colonyListPage += 1;
      renderColonyList();
      colonyList.scrollTop = 0;
    });
    renderColonyList();

    nestRenameOpen.addEventListener("click", openNestNameEditor);
    nestNameCancel.addEventListener("click", () => closeNestNameEditor(true));
    nestNameInput.addEventListener("input", () => {
      nestNameInput.setCustomValidity("");
      nestNameStatus.textContent = "";
    });
    nestNameForm.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!connection.busy) closeNestNameEditor(true);
    });
    nestNameForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (renamedColonyId === null || connection.busy) return;
      const name = nestNameInput.value.trim();
      if (!name) {
        nestNameInput.setCustomValidity("둥지 이름을 입력해 주세요.");
        nestNameInput.reportValidity();
        return;
      }
      const colonyId = renamedColonyId;
      nestNameStatus.textContent = "";
      nestStatus.textContent = "";
      const result = await sendCommand({ type: "rename-colony", colonyId, name });
      if (renamedColonyId !== colonyId) return;
      if (result) closeNestNameEditor(true);
      else {
        nestNameStatus.textContent = nestStatus.textContent || "이름을 저장하지 못했습니다.";
        nestNameInput.focus();
      }
    });
    colonyMenuClose.addEventListener("click", closeColonyMenu);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!helpTooltip.hidden) {
        hideHelpTooltip();
        event.preventDefault();
        return;
      }
      if (codex.open) {
        closeCodex(true);
        event.preventDefault();
        return;
      }
      if (!evolutionPanel.hidden) {
        closeEvolutionPanel();
        event.preventDefault();
        return;
      }
      if (!unitPanel.hidden || state.selection) {
        closeColonyMenu();
        closeUnitPanel();
        event.preventDefault();
        return;
      }
      if (colonyMenu.hidden) return;
      closeColonyMenu();
      event.preventDefault();
    });

    function closeUnitPanel() {
      selectObject(null, null);
      canvas.focus();
    }

    document.getElementById("unit-panel-close").addEventListener("click", closeUnitPanel);
    document.getElementById("unit-codex").addEventListener("click", () => {
      const selected = state.selection;
      if (!selected) return;
      if (selected.kind === "terrain" || selected.kind === "hazard") {
        const cell = selectionTerrainCell();
        if (cell) openTerrainCodex(cell.x, cell.y);
        return;
      }
      const slots = selected.target.activeSlots || selected.target.slots || [];
      const attribute = slots.find(key => ATTRIBUTES.some(value => value.key === key)) || ATTRIBUTES[0].key;
      openCodex("attribute:" + attribute);
    });
    agentDesign.addEventListener("click", () => {
      if (state.selection?.kind === "agent") openUnitDesign(selectedAgentTemplate() || null);
    });
    agentBirth.addEventListener("click", async () => {
      const template = selectedAgentTemplate();
      if (!template || agentBirth.disabled) return;
      const key = unitPanelSelectionKey;
      unitActionStatus.textContent = "";
      nestStatus.textContent = "";
      const result = await sendCommand({ type: "birth", templateId: template.id });
      if (unitPanelSelectionKey === key) setEvolutionText(unitActionStatus, result ? "새 생명체가 탄생합니다." : nestStatus.textContent);
    });
    corpseDesign.addEventListener("click", () => openUnitDesign(null));

    function updateCorpseDetails() {
      const corpse = state.selection?.kind === "corpse" ? state.selection.target : null;
      corpseDetails.hidden = !corpse || corpse.kind !== "corpse" || corpse.amount <= 0;
      if (corpseDetails.hidden) return;
      unitPanelTitle.textContent = corpse.name ? corpse.name + "의 사체" : "사체";
      corpseValue.textContent = Math.ceil(corpse.amount) + "점";
      document.getElementById("corpse-decay").textContent = Number.isFinite(corpse.decaysAt) ?
        "부패까지 " + formatLifetime(Math.ceil(Math.max(0, corpse.decaysAt - state.simSeconds))) : "";
      corpseDesign.disabled = connection.busy || !connection.online;
    }

    function formatLifetime(seconds) {
      const total = Math.max(0, Math.floor(seconds));
      return Math.floor(total / 60) + "분 " + total % 60 + "초";
    }

    function selectedAgentTemplate() {
      const agent = state.selection?.kind === "agent" ? state.selection.target : null;
      return agent && state.agents.includes(agent) ? state.templates.find(template => template.id === agent.templateId) : null;
    }

    function updateTerrainDetails() {
      const kind = state.selection?.kind;
      const cell = kind === "terrain" || kind === "hazard" ? selectionTerrainCell() : null;
      terrainDetails.hidden = !cell;
      if (!cell) return;
      const value = cell.hazard || cell.terrain;
      unitPanelTitle.textContent = value.name;
      const image = document.getElementById("terrain-image");
      if (image.dataset.key !== value.key) {
        image.dataset.key = value.key;
        image.replaceChildren(codexTerrainImage(value, cell.hazard ? "hazard" : "terrain"));
      }
      document.getElementById("terrain-description").textContent = value.description;
      document.getElementById("terrain-stats").textContent = "좌표 (" + cell.x + ", " + cell.y + ") · " + cell.terrain.name + "\n" +
        (cell.type < 2 ? "일반 유닛 통행 불가" : "일반 이동 속도 " + Math.round(cell.speed * 100) + "%") +
        "\n위험 요소 · " + (cell.hazard ? cell.hazard.name + " · " + cell.hazard.effect : "없음");
    }

    function updateUnitPanel() {
      const agent = state.selection?.kind === "agent" ? state.selection.target : null;
      const target = state.selection?.target;
      const key = target ? state.selection.kind + ":" + (target.id ?? (target.column ?? target.x) + "," + (target.row ?? target.y)) : null;
      if (key !== unitPanelSelectionKey) unitActionStatus.textContent = "";
      unitPanelSelectionKey = key;
      updateCorpseDetails();
      updateTerrainDetails();
      agentDetails.hidden = !agent;
      unitPanel.hidden = !agent && corpseDetails.hidden && terrainDetails.hidden;
      if (unitPanel.hidden) return;
      collapseControlsGuide();
      if (!agent) return;
      unitPanelTitle.textContent = agent.name + " · Lv." + (agent.level || 1);
      document.getElementById("agent-birth-stats").textContent = agent.templateName + " · 설계 " + agent.templateRevision + "세대\n" +
        templateDescription(agent.activeSlots || agent.slots) + " · 발현 " + (agent.activeSlots || agent.slots).length + "/" + agent.slots.length + " · 체력 " + Math.ceil(Math.max(0, agent.health) * 10) / 10 + "/" + agent.stats.health;
      if (Number.isFinite(agent.bornAt) && Number.isFinite(agent.lifespan)) {
        const age = Math.max(0, state.simSeconds - agent.bornAt);
        document.getElementById("agent-birth-stats").textContent += "\n나이 " + formatLifetime(age) +
          " · 남은 수명 " + formatLifetime(Math.ceil(Math.max(0, agent.lifespan - age)));
      }
      document.getElementById("agent-birth-stats").textContent += " · " + Spawner.COMBAT_DISPOSITIONS[agent.combatDisposition || "passive"];
      const personality = agent.personalityLabels;
      document.getElementById("agent-personality").textContent = personality ?
        "대담함 " + personality.boldness + " · 호전성 " + personality.aggression + " · 호기심 " + personality.curiosity : "";
      const template = selectedAgentTemplate();
      const cost = template ? birthCost(template) : Infinity;
      document.getElementById("agent-birth-cost").textContent = Number.isFinite(cost) ? cost : "—";
      agentDesign.textContent = template ? "설계 수정" : "새 유닛 설계";
      agentDesign.disabled = connection.busy || !connection.online;
      agentBirth.hidden = !template;
      agentBirth.disabled = !template || connection.busy || !connection.online || state.nestHealth === 0 || state.evolutionPoints < cost ||
        template.slots.length > slotCapacity() || template.slots.some(key => !ATTRIBUTES.some(attribute => attribute.key === key));
    }

    const AGENT_MODE_LABELS = {
      search: "탐색", approach: "먹이 접근", harvest: "채집",
      return: "귀환", commute: "길 왕복", defend: "방어", unload: "하역", rest: "회복",
      recover: "회복 이동", fight: "전투", flee: "도주", wait: "대기", birth: "발아 중"
    };

    function selectAgent(agent) {
      closeColonyMenu();
      selectObject("agent", agent);
      updateAgentList();
    }

    function updateCameraFollow() {
      if (cameraTransition || state.camera.followAgentId === null || state.dragging) return;
      const agent = state.agents.find(candidate => candidate.id === state.camera.followAgentId && candidate.health > 0);
      if (!agent) {
        state.camera.followAgentId = null;
        return;
      }
      const position = interpolatedAgentPosition(agent);
      state.camera.x = position.x + 0.5;
      state.camera.y = position.y + 0.5;
      clampCamera();
    }

    function focusAgent(agent) {
      const position = interpolatedAgentPosition(agent);
      moveCameraTo(position.x + 0.5, position.y + 0.5, zoomForLayer(state.camera.layer));
      state.camera.followAgentId = agent.id;
      cameraTransition.agentId = agent.id;
    }

    let renderedAgentListSignature = "";
    const agentAvatars = new Map();

    function unitListEntries() {
      return [...state.agents, ...state.corpses.filter(corpse => corpse.colonyId === connection.colonyId && corpse.amount > 0).map(corpse => foodCellMap.get(corpse.key || corpse.x + "," + corpse.y) || corpse)];
    }

    function drawAgentAvatars(now) {
      if (objectPanel.hidden || document.hidden) return;
      const panel = objectPanel.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      for (const agent of unitListEntries()) {
        const avatar = agentAvatars.get(agent.id);
        if (!avatar) continue;
        const bounds = avatar.canvas.getBoundingClientRect();
        if (!bounds.width || bounds.bottom <= panel.top || bounds.top >= panel.bottom) continue;
        const size = Math.min(bounds.width, bounds.height);
        const width = Math.round(bounds.width * ratio);
        const height = Math.round(bounds.height * ratio);
        if (avatar.canvas.width !== width || avatar.canvas.height !== height) {
          avatar.canvas.width = width;
          avatar.canvas.height = height;
        }
        const context = avatar.context;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, bounds.width, bounds.height);
        if (agent.kind === "corpse") {
          if (drawAgentCorpse(context, agent, bounds.width / 2, bounds.height * 0.8, size * 1.4, null, 1)) continue;
          context.save();
          context.filter = "grayscale(0.8)";
          context.globalAlpha = 0.6;
          const sprite = agentSprite(agent);
          context.drawImage(sprite, (bounds.width - size * 0.9) / 2, (bounds.height - size * 0.9) / 2, size * 0.9, size * 0.9);
          context.restore();
          continue;
        }
        const birth = agentBirthPose(agent, true);
        const cell = size * (birth?.seedVisible ? .38 : 1.65);
        const topLeft = { x: (bounds.width - cell) / 2, y: bounds.height * .93 - cell * (.5 + AGENT_HEIGHT * .44) };
        drawAgentAppearance(context, now, agent, cell, topLeft, interpolatedAgentPosition(agent), birth, null);
      }
    }

    function updateAgentList() {
      updateUnitPanel();
      const entries = unitListEntries();
      const corpseCount = entries.length - state.agents.length;
      agentListCount.textContent = state.agents.length + (corpseCount ? " · 사체 " + corpseCount : "");
      const signature = entries.map((agent) => agent.id).join(",");
      if (signature !== renderedAgentListSignature) {
        agentAvatars.clear();
        const fragment = document.createDocumentFragment();
        for (const agent of entries) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "agent-item";
          button.dataset.agentId = agent.id.toString();
          button.innerHTML =
            "<canvas data-agent-avatar aria-hidden=\"true\"></canvas>" +
            "<strong data-agent-name></strong>" +
            "<span data-agent-mode></span>" +
            "<small data-agent-carry></small>" +
            "<span class=\"agent-life\" aria-hidden=\"true\"><img class=\"agent-life-dead\" alt=\"\">" +
            "<img class=\"agent-life-alive\" alt=\"\"></span>";
          button.querySelector(".agent-life-dead").src = assetSource("DesignAssets/UI/Lifespan/leaf-dead.png");
          button.querySelector(".agent-life-alive").src = assetSource("DesignAssets/UI/Lifespan/leaf-alive.png");
          const avatar = button.querySelector("[data-agent-avatar]");
          agentAvatars.set(agent.id, { canvas: avatar, context: avatar.getContext("2d") });
          button.addEventListener("click", () => {
            const current = unitListEntries().find(candidate => candidate.id === button.dataset.agentId);
            if (current?.kind === "corpse") {
              selectObject("corpse", current);
              moveCameraTo(current.x + 0.5, current.y + 0.5, zoomForLayer(0));
            } else if (current) selectAgent(current);
          });
          fragment.appendChild(button);
        }
        agentList.replaceChildren(fragment);
        renderedAgentListSignature = signature;
      }

      for (const agent of entries) {
        const button = agentList.querySelector(
          '[data-agent-id="' + agent.id + '"]'
        );
        if (!button) {
          continue;
        }
        const corpse = agent.kind === "corpse";
        const remaining = Math.max(0, corpse ? agent.decaysAt - state.simSeconds : agent.bornAt + agent.lifespan - state.simSeconds);
        button.className = "agent-item" + (corpse ? " is-corpse" : remaining <= Spawner.AGENT_DEATH_WARNING ? " is-dying" : "") +
          (isSelectedObject(corpse ? "corpse" : "agent", agent) ? " is-selected" : "");
        button.querySelector(".agent-life-alive").style.clipPath = "inset(" + (corpse ? 100 : (1 - clamp(remaining / agent.lifespan, 0, 1)) * 100) + "% 0 0)";
        if (corpse) {
          button.setAttribute("aria-label", agent.name + "의 사체 위치 보기");
          button.title = agent.name + "의 사체 · 부패까지 " + formatLifetime(Math.ceil(remaining));
          button.querySelector("[data-agent-name]").textContent = agent.name;
          button.querySelector("[data-agent-mode]").textContent = "Lv." + (agent.level || 1) + " · 사체";
          button.querySelector("[data-agent-carry]").textContent = "고기 " + Math.ceil(agent.amount) + "개";
          continue;
        }

        button.setAttribute("aria-label", agent.name + " 선택");
        const personality = agent.personalityLabels;
        button.title = agent.name + " · 남은 수명 " + formatLifetime(Math.ceil(remaining)) + (personality ? "\n대담함 " + personality.boldness + " · 호전성 " + personality.aggression + " · 호기심 " + personality.curiosity : "");
        button.querySelector("[data-agent-name]").textContent = agent.name;
        button.querySelector("[data-agent-mode]").textContent =
          "Lv." + (agent.level || 1) + " · " + (AGENT_MODE_LABELS[agent.mode] || agent.mode);
        button.querySelector("[data-agent-carry]").textContent =
          (agent.carrying > 0 ? Spawner.resourceDefinition(agent.carryingType || "honey-mushrooms").name + " " : "운반 ") +
          agent.carrying + "/" + (agent.stats.capacity + (hasSynergy(agent.attributes, ["strength", "strength"]) ? 4 : 0));

      }

    }

    const ATTRIBUTE_SYMBOLS = { antenna: "DesignAssets/Attributes/SilhouettesV2/23-y-branch.png",
      strength: "DesignAssets/Attributes/SilhouettesV2/24-horseshoe.png",
      butchery: "DesignAssets/Attributes/SilhouettesV2/04-crescent.png",
      lifespan: "DesignAssets/Attributes/SilhouettesV2/40-spiral.png",
      feet: "DesignAssets/Attributes/SilhouettesV2/27-chevron.png" };
    const ATTRIBUTE_IMAGES = Object.fromEntries(ATTRIBUTES.map(attribute =>
      [attribute.key, assetSource(ATTRIBUTE_SYMBOLS[attribute.key])]));
    function slotCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].slotCapacity;
    }

    function pointCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].pointCapacity;
    }

    function upgradeCost() {
      return NEST_LEVELS[state.nestLevel - 1].upgradeCost;
    }

    function agentAppearanceKey(attributes) {
      return [attributes.strength ?? attributes.arms ?? 0, attributes.feet || 0,
        attributes.antenna || 0, attributes.lifespan || 0].join(":");
    }

    function agentSpriteLayers(attributes) {
      return ["body", ...(attributes.feet ? ["feet-left", "feet-right"] : []),
        ...(attributes.antenna ? ["antenna"] : ["sprout-left", "sprout-right", "sprout-stem"])];
    }

    function prepareAgentTemplate(template) {
      if (template.tribe && template.tribe !== "bean") {
        const tribe = Spawner.PLAYER_TRIBES.find(entry => entry.key === template.tribe);
        return Promise.all([prepareAgentMovement(tribe), tribe.key === "spring" ? springBirthSheet.decode() : tribe.key === "pebble" ? pebbleBirthSheet.decode() : null]).then(() => {
          for (let count = Math.min(1, template.slots.length); count <= template.slots.length; count++) {
            const attributes = attributeCounts(template.slots.slice(0, count));
            for (const layer of [...agentSpriteLayers(attributes), "full"]) selectionContour(agentSprite({ tribe: tribe.key, attributes }, layer), null);
          }
        });
      }
      const tasks = [];
      for (let count = Math.min(1, template.slots.length); count <= template.slots.length; count++) {
        const attributes = attributeCounts(template.slots.slice(0, count));
        for (const layer of agentSpriteLayers(attributes)) {
          const key = agentAppearanceKey(attributes) + ":" + layer;
          if (!agentRenderingTasks.has(key)) {
            const task = agentRenderingQueue.then(() => new Promise(resolve => setTimeout(resolve, 0))).then(() => {
              selectionContour(agentSprite({ attributes }, layer), null);
            });
            agentRenderingTasks.set(key, task);
            agentRenderingQueue = task.catch(() => {});
            task.catch(() => agentRenderingTasks.delete(key));
          }
          tasks.push(agentRenderingTasks.get(key));
        }
      }
      return Promise.all(tasks);
    }

    function agentSprite(agent, layer) {
      if (agent?.species === "spiny-back-beetle") return beetleSprite;
      if (agent?.species === "talon-owl") return talonOwlFrames.get(0);
      if (encounterSprites.has(agent?.species)) return encounterSprites.get(agent.species);
      const attributes = agent?.appearanceAttributes || agent?.attributes || {};
      if (agent?.tribe && agent.tribe !== "bean") {
        const sprite = tribeArt.sprite(agent.tribe, attributes, layer || "full");
        agentSpriteSet.add(sprite);
        return sprite;
      }
      const counts = { strength: attributes.strength ?? attributes.arms ?? 0,
        feet: attributes.feet || 0, antenna: attributes.antenna || 0, lifespan: attributes.lifespan || 0 };
      const key = agentAppearanceKey(counts) + ":" + (layer || "full");
      if (!agentSprites.has(key)) {
        const sprite = composeAgentSprite(counts, layer);
        agentSprites.set(key, sprite);
        agentSpriteSet.add(sprite);
      }
      return agentSprites.get(key);
    }

    function agentImageSource(agent) {
      const sprite = agentSprite(agent);
      if (!agentImageSources.has(sprite)) agentImageSources.set(sprite, sprite.toDataURL("image/png"));
      return agentImageSources.get(sprite);
    }

    function composeAgentAntennae(context, attributes) {
      const count = attributes.antenna;
      if (!count) return;
      const lift = attributes.feet ? 24 + attributes.feet * 7 : 0;
      const part = agentParts.get("antenna-" + (count === 1 ? 1 : 2));
      const width = count === 1 ? 196 : 344 + (count - 2) * 16;
      const height = width * part.naturalHeight / part.naturalWidth;
      context.drawImage(part, 256 - width / 2, 260 - lift - height, width, height);
    }

    function composeAgentSprite(attributes, layer) {
      const sprite = document.createElement("canvas");
      const resolution = Math.max(512, Math.ceil(ZOOM_LAYERS[0] * AGENT_HEIGHT * (window.devicePixelRatio || 1) * 2 / 256) * 256);
      sprite.width = resolution;
      sprite.height = resolution;
      const context = sprite.getContext("2d");
      context.scale(resolution / 512, resolution / 512);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const lift = attributes.feet ? 24 + attributes.feet * 7 : 0;
      if (layer === "sprout-left" || layer === "sprout-right" || layer === "sprout-stem") {
        if (!attributes.antenna) context.drawImage(agentBaseParts.get(layer), 136, 110 - lift, 240, 350);
        return sprite;
      }
      if (layer === "antenna") {
        composeAgentAntennae(context, attributes);
        return sprite;
      }
      if (attributes.feet && layer !== "body") {
        const width = 280 + attributes.feet * 16;
        const height = 92 + attributes.feet * 8;
        const part = agentParts.get("feet-" + (attributes.feet === 1 ? 1 : 2));
        if (layer === "feet-left" || layer === "feet-right") {
          const right = layer === "feet-right" ? 1 : 0;
          context.drawImage(part, right * part.naturalWidth / 2, 0, part.naturalWidth / 2, part.naturalHeight,
            256 - width / 2 + right * width / 2, 500 - height, width / 2, height);
        } else context.drawImage(part, 256 - width / 2, 500 - height, width, height);
      }
      if (["feet", "feet-left", "feet-right"].includes(layer)) return sprite;
      if (attributes.antenna && layer !== "body") composeAgentAntennae(context, attributes);
      context.drawImage(layer === "body" || attributes.antenna ? agentBaseParts.get("body") : starterObjectSprite,
        136, 110 - lift, 240, 350);
      if (attributes.strength) {
        const width = (344 + (attributes.strength - 1) * 24) * 0.78;
        const height = (142 + (attributes.strength - 1) * 12) * 0.78;
        context.drawImage(agentParts.get("strength-" + (attributes.strength === 1 ? 1 : 2)),
          256 - width / 2, 460 - lift - height, width, height);
      }
      if (attributes.lifespan) {
        const part = agentParts.get("lifespan-1");
        const width = 84;
        const height = width * part.naturalHeight / part.naturalWidth;
        context.drawImage(part, 256 - width / 2, 257 - lift, width, height);
      }
      return sprite;
    }

    function agentSpeed(agent) {
      return unitMovementSpeed(agent.stats);
    }

    function drawAgentCorpse(context, corpse, x, floor, cell, outlineColor, opacity) {
      const index = agentDeathFrame(corpse, state.simSeconds);
      if (index < 0) return false;
      if (!agentDeathSheet.complete || !agentDeathSheet.naturalWidth) return true;
      const animation = AGENT_DEATH_ANIMATION;
      const frame = idleMotion.matches ? animation.frameCount - 1 : index;
      const size = cell * AGENT_HEIGHT * animation.scale;
      const left = -size * animation.pivotX / animation.frameSize;
      const top = -size * animation.pivotY / animation.frameSize;
      const sourceX = frame % animation.columns * animation.frameSize;
      const sourceY = Math.floor(frame / animation.columns) * animation.frameSize;
      const decay = Number.isFinite(corpse.decaysAt) ?
        clamp((state.simSeconds - corpse.diedAt) / (corpse.decaysAt - corpse.diedAt), 0, 1) : 0;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.globalAlpha *= opacity * (1 - decay * 0.4);
      context.filter = "saturate(" + (1 - decay * 0.8) + ")";
      context.translate(x, floor);
      context.drawImage(agentDeathSheet, sourceX, sourceY, animation.frameSize, animation.frameSize,
        left, top, size, size);
      if (outlineColor) drawSelectionOutline(agentDeathSheet, left, top, size, size,
        { owner: agentDeathSheet, size: animation.frameSize, index: frame, x: sourceX, y: sourceY }, outlineColor);
      context.restore();
      return true;
    }

    function drawCorpses() {
      const combatCells = new Set([...(state.agents || []), ...(state.rivals || [])].map(agent => displayedAgent(agent))
        .filter(agent => agent.health > 0 && agent.combat).map(agent => agent.x + "," + agent.y));
      for (const corpse of resourceNodeCells()) {
        if (corpse.kind !== "corpse") continue;
        const pose = resourceNodePose(corpse);
        if (!pose.visible) continue;
        ctx.save();
        if (combatCells.has(corpse.x + "," + corpse.y)) {
          const anchor = worldToScreen(corpse.x + .5, corpse.y + .92);
          ctx.translate(anchor.x, anchor.y);
          ctx.scale(.35, .35);
          ctx.translate(-anchor.x, -anchor.y);
        }
        const point = worldToScreen(corpse.x + 0.5, corpse.y + 0.5 + AGENT_HEIGHT * (460 / 512 - 0.5));
        if (!drawAgentCorpse(ctx, corpse, point.x, point.y, state.camera.zoom,
          objectOutlineColor("corpse", corpse), pose.opacity)) drawResourceNode(state.lastFrame, corpse, undefined);
        ctx.restore();
      }
    }

    const EVOLUTION_SYMBOL = assetSource("DesignAssets/evolution-point-symbol.png");
    const NEST_CODEX = [{ key: "growth", name: "둥지 성장", effect: "속성 슬롯 +1칸 · 진화 포인트 보관량 ×5",
      description: "둥지는 1~4레벨이며 성장할 때마다 속성 슬롯 1칸과 진화 포인트 보관량이 늘어납니다." }];
    const evolutionSprite = new Image();
    evolutionSprite.src = EVOLUTION_SYMBOL;
    const evolutionPointCache = await createEvolutionPointCache();
    for (const image of document.querySelectorAll("[data-evolution-symbol]")) image.src = EVOLUTION_SYMBOL;

    const templateList = document.getElementById("template-list");
    const nestUpgrade = document.getElementById("nest-upgrade");
    const nestStatus = document.getElementById("nest-status");
    const firstDesign = document.getElementById("first-design");
    const designBackdrop = document.getElementById("design-backdrop");
    const designForm = document.getElementById("unit-design-form");
    const designName = document.getElementById("design-name");
    const designSlots = document.getElementById("design-slots");
    const designPalette = document.getElementById("attribute-palette");
    const designSave = document.getElementById("design-save");
    const designBirth = document.getElementById("design-birth");
    const designStatus = document.getElementById("design-status");
    const codex = document.getElementById("codex");
    const codexSearch = document.getElementById("codex-search");
    const codexList = document.getElementById("codex-list");
    const codexBack = document.getElementById("codex-back");
    const codexForward = document.getElementById("codex-forward");
    const codexState = { entry: "attribute:antenna", history: [], index: -1, category: "all", cell: null, returnFocus: null };
    let selectedAttribute = null;
    let unitDraft = null;
    let designReturnFocus = null;
    let templateListSignature = "";

    function templateDescription(slots) {
      const counts = attributeCounts(slots);
      return ATTRIBUTES.filter((attribute) => counts[attribute.key] > 0)
        .map((attribute) => attribute.name + " ×" + counts[attribute.key]).join(" · ") || "기본 생명체";
    }

    function createEvolutionCost(amount) {
      const cost = document.createElement("span");
      cost.className = "evolution-cost";
      cost.setAttribute("aria-label", Number.isFinite(amount) ? "진화 포인트 " + amount + "점" : "설계 수정 필요");
      const image = document.createElement("img");
      image.className = "evolution-symbol";
      image.src = EVOLUTION_SYMBOL;
      image.alt = "";
      const number = document.createElement("strong");
      number.textContent = Number.isFinite(amount) ? amount : "설계 수정";
      cost.append(image, number);
      return cost;
    }

    function renderUnitTemplates() {
      const signature = JSON.stringify(state.templates);
      if (signature === templateListSignature) return;
      templateListSignature = signature;
      const fragment = document.createDocumentFragment();
      for (const template of state.templates) {
        prepareAgentTemplate(template).catch(() => {});
        const card = document.createElement("div");
        card.className = "template-card";
        card.dataset.templateId = template.id;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "template-spawn";
        button.setAttribute("aria-label", template.name + " 탄생, 진화 포인트 " + birthCost(template) + "점");
        const image = document.createElement("img");
        image.src = agentImageSource({ tribe: template.tribe, attributes: attributeCounts(template.slots), carrying: 0 });
        image.alt = "";
        const name = document.createElement("strong");
        name.textContent = template.name;
        button.append(image, name);
        button.addEventListener("click", async () => {
          state.selectedTemplateId = template.id;
          nestStatus.textContent = "";
          await sendCommand({ type: "birth", templateId: template.id });
        });
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "template-edit";
        edit.textContent = "설계 수정";
        edit.setAttribute("aria-label", template.name + " 설계 수정");
        edit.addEventListener("click", () => openUnitDesign(state.templates.find((candidate) => candidate.id === template.id)));
        const footer = document.createElement("div");
        footer.className = "template-card-footer";
        footer.append(createEvolutionCost(birthCost(template)), edit);
        card.append(button, footer);
        fragment.append(card);
      }
      fragment.append(evolutionOpenButton);
      templateList.replaceChildren(fragment);
    }

    function nestGrowthBenefits() {
      return state.nestLevel >= NEST_LEVELS.length ? "최고 둥지 레벨입니다." :
        "유닛의 속성 슬롯 " + slotCapacity() + " → " + NEST_LEVELS[state.nestLevel].slotCapacity +
        "칸 · 진화 포인트 보관량 " + pointCapacity().toLocaleString("ko-KR") + " → " + NEST_LEVELS[state.nestLevel].pointCapacity.toLocaleString("ko-KR");
    }

    function openUnitDesign(template) {
      designReturnFocus = document.activeElement;
      unitDraft = { id: template ? template.id : null, tribe: state.tribe || "bean", slots: template ? template.slots.map(key => key === "arms" ? "strength" : key) : [], error: "" };
      designName.value = template ? template.name : randomTemplateName();
      closeCodex(false);
      designName.setCustomValidity("");
      document.getElementById("design-title").textContent = template ? "유닛 설계 수정" :
        state.templates.length ? "새 유닛 설계" : "첫 생명체 설계";
      designSave.hidden = !template;
      document.getElementById("design-birth-label").textContent = template ? "수정 후 탄생" : "탄생";
      evolutionPanel.hidden = false;
      designBackdrop.hidden = false;
      document.querySelector(".app").inert = true;
      colonyMenu.inert = true;
      unitPanel.inert = true;
      evolutionOpenButton.setAttribute("aria-expanded", "true");
      renderDesignSlots();
      updateUnitDesign();
      designName.focus();
    }

    function renderDesignSlots() {
      if (!unitDraft) return;
      hideHelpTooltip();
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < Math.max(slotCapacity(), unitDraft.slots.length); index += 1) {
        const key = unitDraft.slots[index];
        const attribute = ATTRIBUTES.find((candidate) => candidate.key === key);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "design-slot" + (attribute ? " has-attribute" : "");
        button.dataset.slotIndex = index;
        button.setAttribute("aria-label", "슬롯 " + (index + 1) + (attribute ? " " + attribute.name + " 빼기" : " 비어 있음"));
        if (attribute) {
          button.style.setProperty("--attribute-color", attribute.color);
          const image = document.createElement("img");
          image.src = attribute.image;
          image.alt = "";
          attachAttributeHelp(button, attribute);
          button.dataset.helpHint = "클릭해서 속성 빼기";
          button.append(image);
        } else {
          button.textContent = "+";
        }
        button.addEventListener("click", () => {
          if (!attribute) return;
          unitDraft.slots.splice(index, 1);
          unitDraft.error = "";
          renderDesignSlots();
          updateUnitDesign();
          designSlots.children[Math.min(index, slotCapacity() - 1)]?.focus();
        });
        fragment.append(button);
      }
      designSlots.replaceChildren(fragment);
    }

    function renderDesignEffects(counts) {
      const fragment = document.createDocumentFragment();
      for (const attribute of ATTRIBUTES) {
        const count = counts[attribute.key];
        if (!count) continue;
        const card = document.createElement("div");
        card.className = "design-effect";
        card.dataset.attribute = attribute.key;
        card.style.setProperty("--attribute-color", attribute.color);
        const name = document.createElement("strong");
        name.textContent = attribute.name + (count > 1 ? " ×" + count : "");
        const effect = document.createElement("span");
        effect.textContent = attribute.stacking === false ? attribute.effect : count === 1 ? attribute.effect : attribute.stat + " +" +
          attribute.bonus * count + attribute.unit;
        const description = document.createElement("p");
        description.textContent = attribute.description;
        card.append(name, effect, description);
        fragment.append(card);
      }
      for (const combination of ATTRIBUTE_COMBINATIONS) {
        if (!hasSynergy(counts, combination.keys)) continue;
        const card = document.createElement("div");
        card.className = "design-effect is-synergy";
        const name = document.createElement("strong");
        name.textContent = "시너지 · " + combination.name;
        const description = document.createElement("p");
        description.textContent = combination.description;
        card.append(name, description);
        fragment.append(card);
      }
      const effects = document.getElementById("design-effects");
      effects.replaceChildren(fragment);
      effects.hidden = !effects.childElementCount;
    }

    function updateUnitDesign() {
      if (!unitDraft || evolutionPanel.hidden) return;
      const counts = attributeCounts(unitDraft.slots);
      const stats = unitStats(counts);
      prepareAgentTemplate(unitDraft).catch(() => {});
      document.getElementById("design-preview-image").src = agentImageSource({ tribe: unitDraft.tribe, attributes: counts, carrying: 0 });
      const statValues = [["시야", stats.vision + "칸"], ["운반", stats.capacity + "개"],
        ["이동", Number(agentSpeed({ stats }).toFixed(2)) + "칸/초"], ["체력", stats.health], ["수명", formatLifetime(stats.lifespan)]];
      const statsFragment = document.createDocumentFragment();
      for (const [label, value] of statValues) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        statsFragment.append(term, description);
      }
      document.getElementById("design-stats").replaceChildren(statsFragment);
      renderDesignEffects(counts);
      for (const button of designPalette.querySelectorAll(".attribute-choice")) {
        const count = counts[button.dataset.attribute];
        button.querySelector("b").textContent = count ? "×" + count : "";
        button.dataset.equipped = String(count > 0);
        button.setAttribute("aria-disabled", String(unitDraft.slots.length >= slotCapacity()));
        const attribute = ATTRIBUTES.find((candidate) => candidate.key === button.dataset.attribute);
        button.setAttribute("aria-label", attribute.name + (count ? " " + count + "개 장착, " : ", ") + "속성 장착");
      }
      for (const button of designPalette.querySelectorAll(".attribute-info")) {
        button.setAttribute("aria-expanded", String(button.dataset.attributeInfo === selectedAttribute));
      }
      const cost = birthCost(unitDraft);
      birthCostOutput.textContent = Number.isFinite(cost) ? cost : "설계 수정";
      document.getElementById("design-points").textContent = state.evolutionPoints;
      document.getElementById("design-budget").dataset.insufficient = String(state.evolutionPoints < cost);
      updateCodex();
      designBirth.disabled = connection.busy || !connection.online || state.nestHealth === 0 || unitDraft.slots.length > slotCapacity();
      designSave.disabled = connection.busy || !connection.online || unitDraft.slots.length > slotCapacity();
      setEvolutionText(designStatus, unitDraft.error || (state.nestHealth === 0 ? "둥지가 파괴되어 설계만 저장할 수 있습니다." : state.evolutionPoints < cost ?
        "탄생에 " + (cost - state.evolutionPoints) + "점이 더 필요해 템플릿만 저장합니다." : "속성은 1·3·6·9·12레벨에 순서대로 발현합니다."));
    }

    async function saveUnitDesign(shouldBirth) {
      if (!unitDraft) return;
      const name = designName.value.trim();
      if (!name) {
        designName.setCustomValidity("템플릿 이름을 지어 주세요.");
        designName.reportValidity();
        return;
      }
      const result = await sendCommand({ type: "design", templateId: unitDraft.id,
        name, slots: [...unitDraft.slots], birth: shouldBirth });
      if (!result || !unitDraft) return;
      state.selectedTemplateId = result.templateId;
      unitDraft.id = result.templateId;
      if (!shouldBirth || state.evolutionPoints < birthCost(unitDraft)) closeEvolutionPanel();
      updateColonyPanel();
    }

    function closeEvolutionPanel() {
      closeCodex(false);
      hideHelpTooltip();
      evolutionPanel.hidden = true;
      designBackdrop.hidden = true;
      document.querySelector(".app").inert = false;
      colonyMenu.inert = false;
      unitPanel.inert = false;
      evolutionOpenButton.setAttribute("aria-expanded", "false");
      unitDraft = null;
      if (designReturnFocus?.isConnected) designReturnFocus.focus();
    }

    function openColonyPanel(entry) {
      if (entry.id !== connection.colonyId) {
        selectObject("colony", entry);
        return;
      }
      closeNestNameEditor(false);
      selectObject("colony", entry);
      colonyMenuEntry = entry;
      closeEvolutionPanel();
      colonyMenu.hidden = false;
      collapseControlsGuide();
      nestStatus.textContent = "";
      updateColonyPanel();
      if (!state.templates.length) openUnitDesign(null);
      else colonyMenuClose.focus();
    }

    const resourceInventoryRows = new Map();
    function updateResourceInventory() {
      const inventory = document.getElementById("resource-inventory");
      if (!resourceInventoryRows.size) {
        for (const definition of Spawner.RESOURCE_TYPES) {
          const row = document.createElement("div");
          row.className = "resource-inventory-item";
          const image = definition.key === "tree" ? createObjectImage(forest.sprite,
            { x: 0, y: 0, width: forest.sprite.naturalHeight, height: forest.sprite.naturalHeight }) : document.createElement("img");
          if (definition.key !== "tree") { image.src = assetSource(definition.image); image.alt = ""; }
          const name = document.createElement("span");
          name.textContent = definition.name;
          const count = document.createElement("strong");
          row.append(image, name, count);
          inventory.append(row);
          resourceInventoryRows.set(definition.key, { row, count });
        }
      }
      let total = 0;
      for (const [key, entry] of resourceInventoryRows) {
        const amount = state.resourceInventory?.[key] || 0;
        total += amount;
        entry.count.textContent = amount;
        entry.row.hidden = amount === 0 && Spawner.isTribeFood(key, state.tribe, worldMap.generationVersion);
        entry.row.classList.toggle("is-empty", amount === 0);
      }
      document.getElementById("resource-inventory-total").textContent = total + "개";
    }

    function updateColonyPanel() {
      if (document.hidden) return;
      updateResourceInventory();
      const capacity = pointCapacity();
      foodProgressFill.style.width = (state.evolutionPoints / capacity * 100) + "%";
      const progress = document.getElementById("evolution-progress");
      progress.setAttribute("aria-valuenow", state.evolutionPoints);
      progress.setAttribute("aria-valuemax", capacity);
      evolutionPointsOutput.textContent = state.evolutionPoints;
      document.getElementById("point-capacity").textContent = capacity;
      const own = colonyEntries.find((entry) => entry.id === connection.colonyId);
      document.getElementById("nest-name").textContent = own ? own.name : "둥지";
      nestRenameOpen.disabled = connection.busy || !connection.online || !own;
      nestNameSave.disabled = connection.busy || !connection.online;
      nestNameInput.disabled = connection.busy;
      nestNameCancel.disabled = connection.busy;
      document.getElementById("nest-level").textContent = "Lv." + state.nestLevel + (state.nestHealth === 0 ? " · 파괴됨" :
        " · 체력 " + Math.ceil(state.nestHealth ?? NEST_LEVELS[state.nestLevel - 1].health) + "/" + NEST_LEVELS[state.nestLevel - 1].health);
      document.getElementById("nest-upgrade-points").textContent = state.nestLevel >= NEST_LEVELS.length ? "—" : upgradeCost();
      document.getElementById("nest-upgrade-help").dataset.help = nestGrowthBenefits();
      nestUpgrade.setAttribute("aria-label", state.nestLevel >= NEST_LEVELS.length ? "최고 둥지 레벨" : "둥지 성장, 진화 포인트 " + upgradeCost() + "점");
      nestUpgrade.disabled = connection.busy || !connection.online || state.nestHealth === 0 || state.nestLevel >= NEST_LEVELS.length || state.evolutionPoints < upgradeCost();
      firstDesign.hidden = state.templates.length > 0 || !evolutionPanel.hidden;
      renderUnitTemplates();
      for (const card of templateList.querySelectorAll("[data-template-id]")) {
        const template = state.templates.find((candidate) => candidate.id === Number(card.dataset.templateId));
        card.querySelector(".template-spawn").disabled = connection.busy || !connection.online || state.nestHealth === 0 || state.evolutionPoints < birthCost(template) || template.slots.length > slotCapacity() || template.slots.some(key => !ATTRIBUTES.some(attribute => attribute.key === key));
        card.querySelector(".template-edit").disabled = connection.busy || !connection.online;
      }
      updateUnitDesign();
      updateCodex();
      updateAgentList();
    }

    function randomTemplateName() {
      const categories = ["일꾼", "전사", "정찰병", "수송꾼", "파수꾼", "개척자", "사냥꾼", "수호자"];
      const available = categories.filter((name) => !state.templates.some((template) => template.name === name));
      const choices = available.length ? available : categories;
      const category = choices[Math.floor(Math.random() * choices.length)];
      if (available.length) return category;
      let number = 2;
      while (state.templates.some((template) => template.name === category + " " + number)) number += 1;
      return category + " " + number;
    }

    function codexEntry(entry) {
      const [kind, key] = entry.split(":");
      const value = kind === "attribute" ? ATTRIBUTES.find((attribute) => attribute.key === key) :
        kind === "synergy" ? ATTRIBUTE_COMBINATIONS[Number(key)] :
        kind === "nest" ? NEST_CODEX.find((entry) => entry.key === key) :
        kind === "terrain" ? TERRAIN_CODEX.find(value => value.key === key) :
        kind === "hazard" ? HAZARD_CODEX.find(value => value.key === key) : null;
      return value ? { kind, key, value } : null;
    }

    function attachAttributeHelp(button, attribute) {
      button.dataset.help = attribute.name + " · " + attribute.effect + "\n" + attribute.description;
      button.addEventListener("pointerenter", () => showHelpTooltip(button));
      button.addEventListener("pointerleave", hideHelpTooltip);
      button.addEventListener("focus", () => showHelpTooltip(button));
      button.addEventListener("blur", hideHelpTooltip);
    }

    function codexAttributeLink(attribute) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "codex-attribute-link";
      button.dataset.codexAttribute = attribute.key;
      button.style.setProperty("--attribute-color", attribute.color);
      button.setAttribute("aria-label", attribute.name + " 항목 보기");
      const image = document.createElement("img");
      image.src = attribute.image;
      image.alt = "";
      button.append(image);
      attachAttributeHelp(button, attribute);
      button.addEventListener("click", () => navigateCodex("attribute:" + attribute.key, true));
      return button;
    }

    function codexAttributeIcons(keys) {
      const icons = document.createElement("div");
      icons.className = "attribute-combination-icons";
      for (const key of keys) {
        if (icons.childElementCount) {
          const plus = document.createElement("span");
          plus.textContent = "+";
          plus.setAttribute("aria-hidden", "true");
          icons.append(plus);
        }
        icons.append(codexAttributeLink(ATTRIBUTES.find((attribute) => attribute.key === key)));
      }
      return icons;
    }

    function selectionTerrainCell() {
      const selected = state.selection;
      if (!connection.active || !selected) return null;
      const target = selected.target;
      return terrainCodexCell({ ...worldMap, size: WORLD_SIZE }, state.explored,
        Math.floor(target.column ?? target.x), Math.floor(target.row ?? target.y));
    }

    function openTerrainCodex(x, y) {
      if (!connection.active) return;
      const cell = terrainCodexCell({ ...worldMap, size: WORLD_SIZE }, state.explored, x, y);
      if (!cell) return;
      openCodex(cell.hazard ? "hazard:" + cell.hazard.key : "terrain:" + cell.terrain.key, { x, y, roomId: connection.roomId });
    }

    selectionTerrain.addEventListener("click", () => {
      const cell = selectionTerrainCell();
      if (cell) {
        closeColonyMenu();
        selectObject("terrain", cell);
      }
    });

    function codexTerrainImage(value, kind) {
      const frame = document.createElement("span");
      frame.className = "codex-terrain-image" + (kind === "hazard" ? " is-hazard" : "");
      const image = document.createElement("img");
      image.src = assetSource(value.image);
      image.alt = value.name;
      frame.append(image);
      return frame;
    }

    function codexCell() {
      const cell = codexState.cell;
      return connection.active && cell?.roomId === connection.roomId ?
        terrainCodexCell({ ...worldMap, size: WORLD_SIZE }, state.explored, cell.x, cell.y) : null;
    }

    function updateTerrainCodexCell(entry) {
      const section = document.getElementById("codex-cell");
      const cell = codexCell();
      section.hidden = !cell || !(entry.kind === "terrain" && entry.key === cell.terrain.key ||
        entry.kind === "hazard" && entry.key === cell.hazard?.key);
      if (section.hidden) return;
      const food = foodCellAt(cell.x, cell.y);
      const definition = food?.amount > 0 ? Spawner.resourceDefinition(Spawner.resourceTypeForCell(food, worldMap)) : null;
      const rows = [["좌표", "(" + cell.x + ", " + cell.y + ") · " + cell.terrain.name],
        ["통행", cell.type < 2 ? "일반 유닛 통행 불가" : "통행 가능"],
        ["일반 이동 속도", cell.type < 2 ? "—" : "평소의 " + Math.round(cell.speed * 100) + "%"],
        ["위험 요소", cell.hazard?.name || "없음"],
        ["현재 자원", definition ? definition.name + " · " + Math.ceil(food.amount) + "개" + (definition.harvestLocked ? " · 채집 잠금" : "") : "없음"]];
      const list = document.getElementById("codex-cell-details");
      const signature = JSON.stringify(rows);
      if (list.dataset.signature === signature) return;
      list.dataset.signature = signature;
      const fragment = document.createDocumentFragment();
      for (const [name, value] of rows) {
        const term = document.createElement("dt"), detail = document.createElement("dd");
        term.textContent = name; detail.textContent = value;
        fragment.append(term, detail);
      }
      list.replaceChildren(fragment);
      section.classList.toggle("has-hazard", !!cell.hazard);
    }

    function renderTerrainCodex(entry, related) {
      const { kind, value } = entry;
      const cell = codexCell();
      const terrain = kind === "terrain" ? value : cell?.hazard?.key === value.key ? cell.terrain :
        TERRAIN_CODEX.find(terrain => terrain.key === value.terrain);
      document.getElementById("codex-related-title").textContent = "발견 가능한 자원";
      const guide = document.createElement("p");
      guide.className = "codex-terrain-guide";
      guide.textContent = kind === "hazard" ? "위험 요소가 없는 " + terrain.name + "의 자원 분포입니다." :
        "지형의 분포 목록이며, 선택한 칸의 자원과 다릅니다.";
      const list = document.createElement("ul");
      list.className = "codex-terrain-resources";
      const resources = terrainCodexResources(terrain.type, worldMap.generationVersion);
      for (const resource of resources) {
        const item = document.createElement("li"), image = document.createElement("img"), name = document.createElement("span");
        image.src = assetSource(resource.carryImage); image.alt = "";
        name.textContent = resource.name; item.append(image, name); list.append(item);
      }
      if (!resources.length) guide.textContent = "이 지형에 자연 배치되는 채집 가능한 자원이 없습니다.";
      related.append(guide, list);
      const heading = document.createElement("h4");
      heading.textContent = "관련 정보";
      const links = document.createElement("div");
      links.className = "codex-terrain-links";
      const entries = kind === "hazard" ? [["terrain:" + terrain.key, terrain.name]] :
        HAZARD_CODEX.filter(hazard => hazard.terrain === terrain.key).map(hazard => ["hazard:" + hazard.key, hazard.name]);
      if (terrain.type >= 6 && terrain.type <= 8) for (const mountain of TERRAIN_CODEX.slice(6, 9)) {
        if (mountain.key !== terrain.key) entries.push(["terrain:" + mountain.key, mountain.name]);
      }
      if (terrain.type >= 2) entries.push(["attribute:feet", "이속 증가"]);
      for (const [key, name] of entries) {
        const link = document.createElement("button");
        link.type = "button"; link.className = "codex-text-link"; link.textContent = name;
        link.addEventListener("click", () => navigateCodex(key, true, codexState.cell));
        links.append(link);
      }
      if (entries.length) related.append(heading, links);
    }

    function renderCodexList() {
      const query = codexSearch.value.trim().toLocaleLowerCase();
      const fragment = document.createDocumentFragment();
      for (const [kind, title, values] of [["attribute", "속성", ATTRIBUTES], ["synergy", "조합 시너지", ATTRIBUTE_COMBINATIONS], ["nest", "둥지", NEST_CODEX], ["terrain", "지형", TERRAIN_CODEX], ["hazard", "위험 요소", HAZARD_CODEX]]) {
        if (codexState.category !== "all" && codexState.category !== kind) continue;
        const matches = values.map((value, index) => ({ value, key: kind === "synergy" ? String(index) : value.key }))
          .filter(({ value }) => [value.name, value.effect || "", value.description,
            ...(kind === "terrain" ? terrainCodexResources(value.type, worldMap.generationVersion).map(resource => resource.name) : []),
            ...(value.keys || []).map((key) => ATTRIBUTES.find((attribute) => attribute.key === key).name)].join(" ").toLocaleLowerCase().includes(query));
        if (!matches.length) continue;
        const heading = document.createElement("h3");
        heading.textContent = title;
        fragment.append(heading);
        for (const { value, key } of matches) {
          const entry = kind + ":" + key;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "codex-entry";
          button.dataset.codexEntry = entry;
          if (entry === codexState.entry) button.setAttribute("aria-current", "page");
          const icons = document.createElement("span");
          icons.className = "codex-nav-images";
          for (const attributeKey of kind === "attribute" ? [key] : value.keys || []) {
            const image = document.createElement("img");
            image.src = ATTRIBUTE_IMAGES[attributeKey];
            image.alt = "";
            icons.append(image);
          }
          if (kind === "terrain" || kind === "hazard") icons.append(codexTerrainImage(value, kind));
          if (kind === "nest") {
            const image = document.createElement("img");
            image.className = "evolution-symbol";
            image.src = EVOLUTION_SYMBOL;
            image.alt = "";
            icons.append(image);
          }
          const label = document.createElement("span");
          label.textContent = value.name;
          button.append(icons, label);
          if (kind === "attribute") attachAttributeHelp(button, value);
          button.addEventListener("click", () => navigateCodex(entry, true));
          fragment.append(button);
        }
      }
      if (!fragment.childElementCount) {
        const empty = document.createElement("p");
        empty.className = "codex-empty";
        empty.textContent = "검색 결과가 없습니다.";
        fragment.append(empty);
      }
      codexList.replaceChildren(fragment);
    }

    function renderCodexArticle(entry) {
      const { kind, key, value } = entry;
      const article = document.getElementById("codex-article");
      article.style.setProperty("--attribute-color", kind === "attribute" ? value.color : "#b4dfcf");
      document.getElementById("codex-entry-kind").textContent = kind === "attribute" ? "속성" : kind === "nest" ? "둥지" : kind === "terrain" ? "지형" : kind === "hazard" ? "위험 요소" : "조합 시너지";
      document.getElementById("codex-article-name").textContent = value.name;
      setEvolutionText(document.getElementById("codex-article-effect"), kind !== "synergy" ? value.effect :
        value.keys.map((attributeKey) => ATTRIBUTES.find((attribute) => attribute.key === attributeKey).name).join(" + "));
      setEvolutionText(document.getElementById("codex-description"), value.description);
      const hero = document.getElementById("codex-article-icons");
      hero.replaceChildren();
      const related = document.getElementById("codex-related");
      related.replaceChildren();
      if (kind === "terrain" || kind === "hazard") {
        hero.append(codexTerrainImage(value, kind));
        renderTerrainCodex(entry, related);
      } else if (kind === "attribute") {
        const image = document.createElement("img");
        image.src = value.image;
        image.alt = value.name + " 문양";
        hero.append(image);
        const list = document.createElement("ul");
        list.className = "attribute-combinations";
        for (const [index, combination] of ATTRIBUTE_COMBINATIONS.entries()) {
          if (!combination.keys.includes(key)) continue;
          const keys = [...combination.keys].sort((left, right) => Number(right === key) - Number(left === key));
          const item = document.createElement("li");
          item.dataset.combination = index;
          const heading = document.createElement("div");
          heading.className = "attribute-combination-heading";
          const label = document.createElement("div");
          label.className = "attribute-combination-label";
          const link = document.createElement("button");
          link.type = "button";
          link.className = "codex-synergy-link";
          link.dataset.codexSynergy = index;
          const name = document.createElement("strong");
          name.textContent = combination.name;
          link.append(name);
          link.addEventListener("click", () => navigateCodex("synergy:" + index, true));
          const effects = document.createElement("small");
          effects.textContent = keys.map((attributeKey) => ATTRIBUTES.find((attribute) => attribute.key === attributeKey).effect).join(" · ");
          const description = document.createElement("p");
          description.textContent = combination.description;
          label.append(link, effects);
          heading.append(codexAttributeIcons(keys), label);
          item.append(heading, description);
          list.append(item);
        }
        document.getElementById("codex-related-title").textContent = "관련 시너지";
        related.append(list);
      } else if (kind === "nest") {
        const image = document.createElement("img");
        image.className = "evolution-symbol";
        image.src = EVOLUTION_SYMBOL;
        image.alt = "진화 심볼";
        hero.append(image);
        document.getElementById("codex-related-title").textContent = "레벨별 성장";
        related.append(createNestGrowthTable());
        updateNestGrowthCodex();
      } else {
        hero.append(codexAttributeIcons(value.keys));
        document.getElementById("codex-related-title").textContent = "구성 속성";
        const components = document.createElement("div");
        components.className = "codex-components";
        for (const attributeKey of value.keys) {
          const attribute = ATTRIBUTES.find((candidate) => candidate.key === attributeKey);
          const button = codexAttributeLink(attribute);
          button.classList.add("codex-component");
          const label = document.createElement("span");
          const name = document.createElement("strong");
          name.textContent = attribute.name;
          const effect = document.createElement("small");
          effect.textContent = attribute.effect;
          const description = document.createElement("span");
          description.className = "codex-component-description";
          description.textContent = attribute.description;
          label.append(name, effect, description);
          button.append(label);
          components.append(button);
        }
        related.append(components);
      }
      document.getElementById("codex-content").scrollTop = 0;
    }

    function createNestGrowthTable() {
      const wrapper = document.createElement("div");
      wrapper.className = "codex-growth-table-wrap";
      const table = document.createElement("table");
      table.className = "codex-growth-table";
      table.id = "codex-growth-table";
      table.setAttribute("aria-label", "둥지 레벨별 성장");
      const head = document.createElement("thead");
      const headings = document.createElement("tr");
      for (const title of ["레벨", "유닛 속성 슬롯", "속성 종류(목표)", "진화 포인트 보관량", "진화 포인트 다음 성장 비용"]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        setEvolutionText(cell, title);
        headings.append(cell);
      }
      head.append(headings);
      const body = document.createElement("tbody");
      for (const [index, balance] of NEST_LEVELS.entries()) {
        const level = index + 1;
        const row = document.createElement("tr");
        row.dataset.level = level;
        const name = document.createElement("th");
        name.scope = "row";
        name.textContent = "Lv." + level;
        const slots = document.createElement("td");
        slots.textContent = balance.slotCapacity + "칸";
        const attributes = document.createElement("td");
        attributes.textContent = ATTRIBUTES.length + "종";
        const capacity = document.createElement("td");
        capacity.textContent = balance.pointCapacity.toLocaleString("ko-KR");
        const cost = document.createElement("td");
        cost.textContent = balance.upgradeCost === null ? "—" : balance.upgradeCost.toLocaleString("ko-KR");
        row.append(name, slots, attributes, capacity, cost);
        body.append(row);
      }
      table.append(head, body);
      wrapper.append(table);
      return wrapper;
    }

    function updateNestGrowthCodex() {
      const table = document.getElementById("codex-growth-table");
      if (!table) return;
      const maximum = state.nestLevel >= NEST_LEVELS.length;
      document.getElementById("codex-article-effect").textContent = maximum ? "최고 둥지 레벨 · Lv.4" :
        "Lv." + state.nestLevel + " → Lv." + (state.nestLevel + 1);
      for (const row of table.querySelectorAll("tbody tr")) {
        row.setAttribute("aria-current", String(Number(row.dataset.level) === state.nestLevel));
      }
    }

    function updateCodex() {
      const entry = codexEntry(codexState.entry);
      if (!entry) return;
      document.getElementById("nest-growth-info").setAttribute("aria-expanded", String(codex.open && entry.kind === "nest"));
      if (entry.kind === "nest") updateNestGrowthCodex();
      updateTerrainCodexCell(entry);
      const counts = attributeCounts(unitDraft ? unitDraft.slots : []);
      const stack = document.getElementById("codex-stack");
      stack.hidden = entry.kind !== "attribute";
      if (entry.kind === "attribute") {
        const attribute = entry.value;
        const count = counts[attribute.key];
        stack.textContent = attribute.stacking === false ? (count ? "능력 보유 · 중복 장착 추가 효과 없음" : "첫 장착으로 능력 획득") : count ? "현재 설계 " + count + "개 장착 · " + attribute.stat + " +" + (attribute.key === "shell" ? Math.round((1 - 0.75 ** count) * 10000) / 100 : attribute.bonus * count) + attribute.unit :
          "장착 1개마다 " + attribute.effect + " 누적";
      }
      for (const item of document.querySelectorAll("#codex-related [data-combination]")) {
        const combination = ATTRIBUTE_COMBINATIONS[Number(item.dataset.combination)];
        const active = hasSynergy(counts, combination.keys);
        item.dataset.active = String(active);
        item.querySelector("strong").textContent = combination.name + (active ? " · 조합 중" : "");
      }
      codexBack.disabled = codexState.index <= 0;
      codexForward.disabled = codexState.index >= codexState.history.length - 1;
    }

    function navigateCodex(entry, recordHistory, cell) {
      const target = codexEntry(entry);
      if (!target) return;
      hideHelpTooltip();
      if (codexState.category !== "all" && codexState.category !== target.kind) {
        codexState.category = target.kind;
        for (const filter of document.querySelectorAll("[data-codex-category]")) {
          filter.setAttribute("aria-pressed", String(filter.dataset.codexCategory === target.kind));
        }
      }
      const previous = codexState.history[codexState.index];
      const context = cell || null;
      if (recordHistory && (previous?.entry !== entry || previous?.cell?.x !== context?.x ||
          previous?.cell?.y !== context?.y || previous?.cell?.roomId !== context?.roomId)) {
        codexState.history = codexState.history.slice(0, codexState.index + 1);
        codexState.history.push({ entry, cell: context });
        codexState.index = codexState.history.length - 1;
      }
      codexState.entry = entry;
      codexState.cell = context;
      selectedAttribute = target.kind === "attribute" ? target.key : null;
      renderCodexArticle(target);
      renderCodexList();
      updateCodex();
      updateUnitDesign();
      document.getElementById("codex-article-name").focus({ preventScroll: true });
    }

    function openCodex(entry, cell) {
      const opening = !codex.open;
      if (opening) {
        codexState.returnFocus = document.activeElement;
        evolutionPanel.inert = !evolutionPanel.hidden;
        codex.showModal();
      }
      codexState.category = entry.split(":")[0];
      codexSearch.value = "";
      for (const filter of document.querySelectorAll("[data-codex-category]")) {
        filter.setAttribute("aria-pressed", String(filter.dataset.codexCategory === codexState.category));
      }
      navigateCodex(entry, true, cell);
    }

    function closeCodex(restoreFocus) {
      hideHelpTooltip();
      document.body.append(helpTooltip);
      codex.close();
      selectedAttribute = null;
      evolutionPanel.inert = false;
      updateUnitDesign();
      updateCodex();
      if (restoreFocus && codexState.returnFocus?.isConnected) {
        codexState.returnFocus.focus();
        hideHelpTooltip();
      }
    }

    function moveCodexHistory(direction) {
      const index = codexState.index + direction;
      if (index < 0 || index >= codexState.history.length) return;
      codexState.index = index;
      const previous = codexState.history[index];
      navigateCodex(previous.entry, false, previous.cell);
    }

    function equipDesignAttribute(attributeKey) {
      if (!unitDraft || evolutionPanel.hidden || !ATTRIBUTES.some(attribute => attribute.key === attributeKey) || unitDraft.slots.length >= slotCapacity()) return;
      if (ATTRIBUTES.find(attribute => attribute.key === attributeKey)?.stacking === false && unitDraft.slots.includes(attributeKey)) return;
      unitDraft.slots.push(attributeKey);
      unitDraft.error = "";
      renderDesignSlots();
      updateUnitDesign();
    }

    for (const attribute of ATTRIBUTES) {
      attribute.image = ATTRIBUTE_IMAGES[attribute.key];
      const item = document.createElement("div");
      item.className = "attribute-item";
      item.style.setProperty("--attribute-color", attribute.color);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "attribute-choice";
      button.dataset.attribute = attribute.key;
      button.setAttribute("aria-label", attribute.name + " 속성 장착");
      const image = document.createElement("img");
      image.src = attribute.image;
      image.alt = "";
      const count = document.createElement("b");
      button.append(image, count);
      attachAttributeHelp(button, attribute);
      button.addEventListener("click", () => equipDesignAttribute(attribute.key));
      const info = document.createElement("button");
      info.type = "button";
      info.className = "attribute-info";
      info.dataset.attributeInfo = attribute.key;
      info.textContent = "i";
      info.title = attribute.name + " 디테일 보기";
      info.setAttribute("aria-label", attribute.name + " 디테일 보기");
      info.setAttribute("aria-expanded", "false");
      info.setAttribute("aria-controls", "codex");
      info.setAttribute("aria-haspopup", "dialog");
      info.addEventListener("click", () => openCodex("attribute:" + attribute.key));
      item.append(button, info);
      designPalette.append(item);
    }
    document.querySelector(".design-body").addEventListener("scroll", hideHelpTooltip);
    document.getElementById("codex-close").addEventListener("click", () => closeCodex(true));
    codexBack.addEventListener("click", () => moveCodexHistory(-1));
    codexForward.addEventListener("click", () => moveCodexHistory(1));
    codexSearch.addEventListener("input", renderCodexList);
    document.querySelectorAll("[data-codex-category]").forEach((button) => {
      button.addEventListener("click", () => {
        codexState.category = button.dataset.codexCategory;
        for (const filter of document.querySelectorAll("[data-codex-category]")) {
          filter.setAttribute("aria-pressed", String(filter === button));
        }
        renderCodexList();
      });
    });
    codex.addEventListener("scroll", hideHelpTooltip, true);
    codex.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeCodex(true);
    });
    for (const type of ["mousedown", "mouseup", "auxclick"]) {
      codex.addEventListener(type, (event) => {
        if (!codex.open || event.button !== 3) return;
        event.preventDefault();
        if (event.type === "mouseup") moveCodexHistory(-1);
      });
    }
    codex.addEventListener("keydown", (event) => {
      if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      moveCodexHistory(event.key === "ArrowLeft" ? -1 : 1);
    });
    codex.addEventListener("click", (event) => {
      if (event.target !== codex) return;
      const rect = codex.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeCodex(true);
    });
    designName.addEventListener("input", () => {
      designName.setCustomValidity("");
      if (unitDraft) unitDraft.error = "";
      updateUnitDesign();
    });
    designForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveUnitDesign(true);
    });
    designSave.addEventListener("click", () => saveUnitDesign(false));
    designBackdrop.addEventListener("click", closeEvolutionPanel);
    evolutionPanel.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const controls = [...evolutionPanel.querySelectorAll("button, input, [tabindex='0']")].filter((element) => !element.disabled && element.getClientRects().length);
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && index === controls.length - 1) {
        event.preventDefault();
        controls[0].focus();
      }
    });
    firstDesign.addEventListener("click", () => {
      openColonyPanel(colonyEntries.find((entry) => entry.id === connection.colonyId));
      moveToColony();
    });
    document.getElementById("nest-growth-info").addEventListener("click", () => openCodex("nest:growth"));
    nestUpgrade.addEventListener("focus", () => showHelpTooltip(document.getElementById("nest-upgrade-help")));
    nestUpgrade.addEventListener("blur", hideHelpTooltip);
    nestUpgrade.addEventListener("click", async () => {
      nestStatus.textContent = "";
      await sendCommand({ type: "upgrade" });
    });

    const agentPanel = document.getElementById("agent-panel");
    const agentPanelResize = document.getElementById("agent-panel-resize");
    let agentPanelDrag = null;

    function setAgentPanelWidth(width) {
      const minimum = Math.min(220, window.innerWidth * 0.55);
      const maximum = Math.min(560, window.innerWidth * 0.7);
      const value = Math.max(minimum, Math.min(maximum, width));
      document.documentElement.style.setProperty("--agent-panel-width", value + "px");
      agentPanelResize.setAttribute("aria-valuemin", Math.round(minimum));
      agentPanelResize.setAttribute("aria-valuemax", Math.round(maximum));
      agentPanelResize.setAttribute("aria-valuenow", Math.round(value));
      resizeCanvas();
    }

    agentPanelResize.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || agentPanelDrag) return;
      event.preventDefault();
      agentPanelDrag = { pointerId: event.pointerId, x: event.clientX, width: agentPanel.getBoundingClientRect().width };
      agentPanelResize.setPointerCapture(event.pointerId);
    });
    agentPanelResize.addEventListener("pointermove", (event) => {
      if (!agentPanelDrag || event.pointerId !== agentPanelDrag.pointerId) return;
      setAgentPanelWidth(agentPanelDrag.width + agentPanelDrag.x - event.clientX);
    });
    function stopAgentPanelResize(event) {
      if (!agentPanelDrag || event.pointerId !== agentPanelDrag.pointerId) return;
      agentPanelDrag = null;
      if (agentPanelResize.hasPointerCapture(event.pointerId)) agentPanelResize.releasePointerCapture(event.pointerId);
    }
    agentPanelResize.addEventListener("pointerup", stopAgentPanelResize);
    agentPanelResize.addEventListener("pointercancel", stopAgentPanelResize);
    agentPanelResize.addEventListener("lostpointercapture", stopAgentPanelResize);
    agentPanelResize.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const width = agentPanel.getBoundingClientRect().width;
      setAgentPanelWidth(event.key === "Home" ? 0 : event.key === "End" ? window.innerWidth : width + (event.key === "ArrowLeft" ? 20 : -20));
    });
    window.addEventListener("resize", () => setAgentPanelWidth(agentPanel.getBoundingClientRect().width));
    setAgentPanelWidth(agentPanel.getBoundingClientRect().width);

    const welcome = document.getElementById("welcome");
    const welcomeStatus = document.getElementById("welcome-status");
    const roomTitle = document.getElementById("room-title");
    const roomSeed = document.getElementById("room-seed");
    const roomList = document.getElementById("room-list");
    const tribeSelection = document.getElementById("tribe-selection");
    const tribeSelectionStatus = document.getElementById("tribe-selection-status");
    const tribeGrid = document.getElementById("tribe-grid");
    const tribePreviews = new Map();
    const tribeWorldMap = document.getElementById("tribe-world-map");
    const tribeWorldLocation = document.getElementById("tribe-world-location");
    const tribeStart = document.getElementById("tribe-start");
    let tribePacket = null;
    let selectedTribe = null;
    let tribeRoomId = null;
    let lobbyBusy = false;
    let roomCreationProgress = null;

    function setLobbyBusy(busy) {
      lobbyBusy = busy;
      welcome.querySelectorAll("input, button, select, textarea").forEach(control => { control.disabled = busy; });
    }

    function updateRoomCreationProgress(progress) {
      if (roomCreationProgress === null || !Number.isFinite(progress)) return;
      roomCreationProgress = Math.min(100, Math.max(roomCreationProgress, Math.floor(progress)));
      const button = document.querySelector('#welcome-form button[type="submit"]');
      const text = "생성 중… " + roomCreationProgress + "%";
      if (button.textContent !== text) button.textContent = text;
    }
    let lobbyVersion = 0;
    let roomsSignature = "";
    const client = createClient(packet => {
      if (connection.active && welcome.hidden && !document.hidden) applySnapshot(packet);
    }, showConnectionError, () => {});

    function showTribeSelection(packet) {
      tribeRoomId = packet.roomId;
      tribePacket = packet;
      selectedTribe = null;
      tribeStart.disabled = true;
      tribeStart.textContent = "이 부족으로 시작";
      tribeWorldLocation.textContent = "부족을 선택하면 시작 위치를 강조합니다.";
      tribeWorldMap.setAttribute("aria-label", "생성된 전체 월드맵");
      document.getElementById("tribe-seed").textContent = "시드 " + packet.world.seed;
      tribeGrid.querySelectorAll("button").forEach(button => {
        button.setAttribute("aria-pressed", "false");
        button.querySelector(".tribe-choice-footer > span").textContent = "선택하기 →";
      });
      drawTribeWorld();
      connection.active = false;
      welcome.hidden = true;
      tribeSelection.hidden = false;
      document.body.dataset.screen = "tribe";
      document.querySelector(".app").hidden = true;
      document.querySelector(".app").inert = true;
      document.getElementById("tribe-room-title").textContent = packet.title;
      document.getElementById("tribe-selection-title").focus();
      tribeSelectionStatus.textContent = "미리보기를 불러오는 중…";
      tribeGrid.setAttribute("aria-busy", "true");
      tribeGrid.querySelectorAll("button").forEach(button => { button.disabled = false; });
      Promise.allSettled(Spawner.PLAYER_TRIBES.map(async tribe => {
        const art = await tribeArt.preparePreview(tribe);
        tribePreviews.set(tribe.key, art);
      })).then(results => {
        if (tribeRoomId !== packet.roomId || tribeSelection.hidden) return;
        tribeGrid.setAttribute("aria-busy", "false");
        if (!selectedTribe && !lobbyBusy) tribeSelectionStatus.textContent = results.some(result => result.status === "rejected") ?
          "일부 미리보기를 불러오지 못했습니다. 부족 선택은 가능합니다." : "";
      });
    }

    function drawTribeWorld() {
      const context = tribeWorldMap.getContext("2d");
      const size = tribeWorldMap.width;
      context.clearRect(0, 0, size, size);
      context.drawImage(terrainRendering.overview, 0, 0, size, size);
      for (const [index, image] of terrainRendering.forest) {
        context.drawImage(image, index % 20 * size / 20, Math.floor(index / 20) * size / 20, size / 20, size / 20);
      }
      context.drawImage(hazardCanvas, 0, 0, size, size);
      for (const colony of tribePacket.tribeStarts) {
        const x = (colony.x + 2.5) / tribePacket.world.size * size;
        const y = (colony.y + 2.5) / tribePacket.world.size * size;
        const color = { bean: "#95c97b", spore: "#e79791", pebble: "#d7b478", spring: "#85cece" }[colony.tribe];
        const selected = colony.tribe === selectedTribe?.key;
        if (selected) {
          context.beginPath();
          context.arc(x, y, 20, 0, Math.PI * 2);
          context.fillStyle = color + "55";
          context.fill();
          context.lineWidth = 4;
          context.strokeStyle = "#ffffff";
          context.stroke();
        }
        context.beginPath();
        context.arc(x, y, selected ? 7 : 6, 0, Math.PI * 2);
        context.fillStyle = selected ? color : color + "bb";
        context.fill();
        if (!selected) {
          context.lineWidth = 2;
          context.strokeStyle = "#101719";
          context.stroke();
        }
      }
    }

    function drawTribePreviews(now) {
      if (tribeSelection.hidden) return;
      for (const tribe of Spawner.PLAYER_TRIBES) {
        const art = tribePreviews.get(tribe.key);
        if (!art) continue;
        const preview = tribeGrid.querySelector('[data-tribe="' + tribe.key + '"] canvas');
        const rect = preview.getBoundingClientRect();
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
        if (!width || !height) continue;
        if (preview.width !== width || preview.height !== height) { preview.width = width; preview.height = height; }
        tribeArt.drawPreview(preview.getContext("2d"), art, tribe, now, width, height, idleMotion.matches);
      }
    }

    async function prepareTribeRendering(colonies) {
      await Promise.all([...new Set(colonies.map(colony => colony.tribe).filter(key => key && key !== "bean"))].map(async key => {
        const tribe = Spawner.PLAYER_TRIBES.find(entry => entry.key === key);
        await prepareAgentMovement(tribe);
        if (key === "spring") await springBirthSheet.decode();
        if (key === "pebble") await Promise.all([pebbleBirthSheet.decode(), pebbleBirthForeground.decode()]);
        if (tribeColonies.has(key)) return;
        const source = new Image();
        source.src = assetSource(tribe.nest);
        await source.decode();
        const bounds = tribeArt.bounds(source, false);
        const scale = Math.min(1126 / bounds.width, 1000 / bounds.height);
        const width = bounds.width * scale, height = bounds.height * scale;
        const surface = document.createElement("canvas");
        surface.width = surface.height = 2048;
        surface.getContext("2d").drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height,
          (2048 - width) / 2, 1860 - height, width, height);
        const sprite = new Image();
        sprite.src = surface.toDataURL("image/png");
        await sprite.decode();
        const appearance = { sprite, scale: 1, groundWidth: width / 2048,
          top: (1860 - height) / 2048, centerY: 384.5 / 512,
          animation: { smooth: true, frameCount: 1, frameMs: 1, restMs: 0 } };
        if (key === "spring") {
          const sheet = new Image();
          sheet.src = assetSource("DesignAssets/Tribes/spring/Animations/Nests/stage-01-idle-v5/nest-stage-01-idle-sheet.png");
          await sheet.decode();
          const sourceScale = 420 / 1492;
          const frameScale = scale / sourceScale;
          appearance.animation = {
            smooth: false, sheet, frameSize: 512, columns: 10, frameCount: 60, frameMs: 4000 / 60, restMs: 0,
            placement: {
              x: ((2048 - width) / 2 - bounds.x * scale - (46 - 142 * sourceScale) * frameScale) / 2048,
              y: (1860 - height - bounds.y * scale - (466 - 774 * sourceScale) * frameScale) / 2048,
              width: 512 * frameScale / 2048, height: 512 * frameScale / 2048
            }
          };
          appearance.birthOutlet = {
            x: ((2048 - width) / 2 + (1616 - bounds.x) * scale) / 2048,
            y: (1860 - height + (646 - bounds.y) * scale) / 2048
          };
        }
        if (key === "pebble") {
          const sheet = new Image();
          sheet.src = assetSource("DesignAssets/Tribes/pebble/Animations/Nests/stage-01-idle-den-v1/nest-stage-01-idle-sheet.webp");
          await sheet.decode();
          appearance.animation = { smooth: false, sheet, frameSize: 512, columns: 8, frameCount: 48, frameMs: 50, restMs: 2400 };
          appearance.birthOutlet = { x: PEBBLE_BIRTH_ANIMATION.nestOutletX, y: PEBBLE_BIRTH_ANIMATION.nestOutletY };
        }
        tribeColonies.set(key, appearance);
      }));
    }

    for (const tribe of Spawner.PLAYER_TRIBES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tribe-choice";
      button.dataset.tribe = tribe.key;
      button.setAttribute("aria-label", tribe.name + " 부족 선택");
      button.setAttribute("aria-pressed", "false");
      const preview = document.createElement("canvas");
      preview.setAttribute("aria-hidden", "true");
      const footer = document.createElement("span");
      footer.className = "tribe-choice-footer";
      const name = document.createElement("strong");
      name.textContent = tribe.name;
      const select = document.createElement("span");
      select.textContent = "선택하기 →";
      footer.append(name, select);
      button.append(preview, footer);
      button.addEventListener("click", () => {
        if (lobbyBusy || !tribeRoomId) return;
        selectedTribe = tribe;
        tribeGrid.querySelectorAll("button").forEach(choice => {
          choice.setAttribute("aria-pressed", String(choice === button));
          choice.querySelector(".tribe-choice-footer > span").textContent = choice === button ? "선택됨 ✓" : "선택하기 →";
        });
        const colony = tribePacket.tribeStarts.find(entry => entry.tribe === tribe.key);
        tribeWorldLocation.textContent = tribe.name + " · 시작 위치 (" + (colony.x + 2) + ", " + (colony.y + 2) + ")";
        tribeWorldMap.setAttribute("aria-label", "전체 월드맵 · " + tribeWorldLocation.textContent);
        tribeStart.textContent = tribe.name + " 부족으로 시작";
        tribeStart.disabled = false;
        tribeSelectionStatus.textContent = "";
        drawTribeWorld();
        if (window.matchMedia("(max-width: 900px)").matches) tribeWorldMap.closest("section").scrollIntoView({ block: "nearest", behavior: idleMotion.matches ? "instant" : "smooth" });
      });
      tribeGrid.append(button);
    }

    tribeStart.addEventListener("click", async () => {
      if (lobbyBusy || !tribeRoomId || !selectedTribe) return;
      setLobbyBusy(true);
      tribeStart.disabled = true;
      tribeGrid.querySelectorAll("button").forEach(choice => { choice.disabled = true; });
      document.getElementById("tribe-selection-back").disabled = true;
      tribeSelectionStatus.textContent = selectedTribe.name + " 부족으로 시작하는 중…";
      try {
        await client.call("choose-tribe", { roomId: tribeRoomId, tribe: selectedTribe.key });
        await enterRoom(tribeRoomId);
      } catch (error) { tribeSelectionStatus.textContent = error.message; }
      finally {
        setLobbyBusy(false);
        tribeStart.disabled = false;
        tribeGrid.querySelectorAll("button").forEach(choice => { choice.disabled = false; });
        document.getElementById("tribe-selection-back").disabled = false;
      }
    });

    document.getElementById("tribe-selection-back").addEventListener("click", async () => {
      if (lobbyBusy) return;
      tribeSelection.hidden = true;
      tribeRoomId = null;
      tribePacket = null;
      selectedTribe = null;
      welcome.hidden = false;
      document.body.dataset.screen = "welcome";
      welcomeStatus.textContent = "";
      await refreshRooms();
      document.getElementById("welcome-title").focus();
    });

    function showConnectionError(message, storageError) {
      connection.online = false;
      audio.updateMusic(null);
      setEvolutionText(connectionStatus, message);
      connectionStatus.hidden = false;
      setEvolutionText(welcomeStatus, message);
      if (storageError) {
        const actions = document.createElement("span");
        actions.className = "storage-recovery";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "secondary-action";
        retry.textContent = "저장 재시도";
        retry.addEventListener("click", async () => {
          retry.disabled = true;
          try { await client.call("resume", { visible: !document.hidden }); }
          catch (error) { showConnectionError(error.message, true); }
          finally { retry.disabled = false; }
        });
        actions.append(retry);
        connectionStatus.append(actions);
      }
      updateColonyPanel();
    }

    function beginSynchronization() {
      connection.synchronizing = true;
      connection.online = false;
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      renderFrame = null;
      audio.setActive(false);
      resetAudio();
      setEvolutionText(connectionStatus, "게임을 다시 표시하고 있습니다.");
      connectionStatus.hidden = false;
      updateColonyPanel();
    }

    function applySnapshot(packet) {
      if (packet.roomId !== connection.roomId) return;
      if (packet.revision < connection.revision) return;
      const selection = state.selection;
      const previousDiscoveryKeys = new Set(state.discoveries.map(entry => entry.key));
      const firstSnapshot = connection.revision < 0 || connection.synchronizing;
      const knownColonies = new Set(colonyEntries.map(colony => colony.id));
      const renderedAt = state.simSeconds;
      syncFoodDeliveries(packet, firstSnapshot);
      connection.revision = packet.revision;
      connection.colonyId = packet.colonyId;
      connection.simSeconds = packet.state.simSeconds;
      connection.receivedAt = performance.now();
      if (Number.isFinite(packet.sampledAt)) connection.receivedAt -= Math.max(0,
        performance.timeOrigin + connection.receivedAt - packet.sampledAt);
      connection.online = true;
      connectionStatus.hidden = true;
      colonyEntries.splice(0, colonyEntries.length, ...packet.colonies.map((colony) => ({
        ...colony, occupiedCells: new Set(colony.occupiedCells)
      })));
      if (!firstSnapshot) for (const colony of colonyEntries) {
        if (knownColonies.has(colony.id)) continue;
        for (let row = Math.max(0, Math.floor((colony.y - 2) / 16)); row <= Math.min(19, Math.floor((colony.y + 7) / 16)); row++) {
          for (let column = Math.max(0, Math.floor((colony.x - 2) / 16)); column <= Math.min(19, Math.floor((colony.x + 7) / 16)); column++) {
            updateForestRegion(column * 16, row * 16);
          }
        }
      }
      const own = colonyEntries.find((colony) => colony.id === connection.colonyId);
      Object.assign(COLONY_ORIGIN, { x: own.x, y: own.y });
      Object.assign(COLONY_CENTER, { x: own.x + 2.5, y: own.y + 2.5 });
      const { food, sharedTrails, footprints, explored, visible, ...view } = packet.state;
      Object.assign(state, view);
      if (!firstSnapshot) state.simSeconds = renderedAt;
      syncAgentMovements([...state.agents, ...state.rivals], packet.state.simSeconds, firstSnapshot);
      Spawner.syncHarvestPlayback(harvestPlayback, [...state.agents, ...state.rivals], packet.state.simSeconds, firstSnapshot);
      harvestDisplay.time = null;
      if (Array.isArray(view.burrows)) worldMap.burrows = view.burrows;
      audio.updateMusic(packet.state);
      if (firstSnapshot) agentHeadMotions.clear();
      const agents = new Set([...state.agents, ...state.rivals].map(agent => agent.id));
      for (const id of agentHeadMotions.keys()) if (!agents.has(id)) agentHeadMotions.delete(id);
      state.sharedTrails = new Map(sharedTrails);
      state.footprints = new Map((footprints || []).map(cell => [cell.x + "," + cell.y, cell]));
      const exploredChanges = firstSnapshot ? explored : explored.slice(state.explored.size);
      if (firstSnapshot) state.explored = new Set(explored);
      else for (const index of exploredChanges) state.explored.add(index);
      state.visible = new Set(visible);
      updateFog(connection.receivedAt, firstSnapshot, exploredChanges);
      foodCellMap.clear();
      foodSpotCache.clear();
      let forestChanged = false;
      for (const cell of food) {
        foodCellMap.set(cell.key || cell.x + "," + cell.y, cell);
        const key = Math.floor(cell.x / FOOD_REGION_SIZE) + "," + Math.floor(cell.y / FOOD_REGION_SIZE);
        if (!foodSpotCache.has(key)) foodSpotCache.set(key, { cells: [] });
        foodSpotCache.get(key).cells.push(cell);
        const tree = forest.cells.get(cell.x + "," + cell.y);
        if ((!cell.key || cell.key === cell.x + "," + cell.y) && cell.kind !== "corpse" &&
            !Spawner.isTreeFood(cell, worldMap) && !(cell.resourceType === "tree" && cell.amount > 0) &&
            tree) {
          forest.cells.delete(cell.x + "," + cell.y);
          if (worldMap.treeCells) worldMap.treeCells[cell.y * WORLD_SIZE + cell.x] = 0;
          forest.revealed.delete(cell.y * WORLD_SIZE + cell.x);
          for (const index of forestTreeRegions(tree)) updateForestRegion(index % 20 * 16, Math.floor(index / 20) * 16);
          forestChanged = true;
        }
      }
      if (forestChanged) forest.trees = forest.trees.filter(tree => forest.cells.has(tree.column + "," + tree.row));
      if (selection) {
        const target = selection.kind === "terrain" ? terrainCodexCell({ ...worldMap, size: WORLD_SIZE }, state.explored, selection.target.x, selection.target.y) :
          selection.kind === "agent" ? state.agents.find((agent) => agent.id === selection.target.id) :
          selection.kind === "colony" ? colonyEntries.find((colony) => colony.id === selection.target.id) :
          selection.kind === "tree" ? forest.cells.get(selection.target.column + "," + selection.target.row) :
          selection.kind === "hazard" ? hazardCells[selection.target.row * WORLD_SIZE + selection.target.column] :
          selection.kind === "burrow" ? worldMap.burrows.find(burrow => burrow.id === selection.target.id && burrow.health > 0) :
          foodCellMap.get(selection.target.key || selection.target.x + "," + selection.target.y);
        const corpse = selection.kind === "agent" && !target ? state.corpses.find(cell => cell.agentId === selection.target.id) : null;
        state.selection = corpse ? { kind: "corpse", target: corpse } : target && (selection.kind !== "corpse" ||
          target.kind === "corpse" && target.amount > 0) ? { kind: selection.kind, target } : null;
        if (corpse) state.camera.followAgentId = null;
      }
      if (colonyMenuEntry) colonyMenuEntry = own;
      if (!state.templates.some((template) => template.id === state.selectedTemplateId)) {
        state.selectedTemplateId = state.templates[0]?.id || null;
      }
      connection.synchronizing = false;
      if (firstSnapshot) {
        resetAudio();
        state.lastFrame = performance.now();
      }
      audio.setActive(!document.hidden);
      updateNotifications(previousDiscoveryKeys, firstSnapshot);
      renderColonyList();
      updateColonyPanel();
      scheduleRender();
    }

    async function sendCommand(action) {
      if (connection.busy || !connection.active || !connection.online) return null;
      const roomId = connection.roomId;
      connection.busy = true;
      updateColonyPanel();
      try {
        if (action.type === "birth" || action.type === "design" && action.birth) {
          const template = action.type === "birth" ? state.templates.find(candidate => candidate.id === action.templateId) : action;
          if (template) await prepareAgentTemplate(template);
          if (connection.roomId !== roomId || !connection.active || !connection.online) return null;
        }
        const result = await client.call("command", { roomId, action });
        return result;
      } catch (error) {
        if (!connectionStatus.querySelector(".storage-recovery")) {
          setEvolutionText(connectionStatus, error.message);
        }
        connectionStatus.hidden = false;
        if (unitDraft) unitDraft.error = error.message;
        setEvolutionText(nestStatus, error.message);
        return null;
      } finally {
        connection.busy = false;
        updateColonyPanel();
      }
    }

    async function enterRoom(roomId) {
      audio.updateMusic(null);
      connection.roomId = roomId;
      connection.revision = -1;
      clearDiscoveryToasts();
      foodDeliveries.clear();
      resetAudio();
      connection.active = false;
      connection.online = false;
      try {
        const packet = await client.call("enter", { roomId, visible: false });
        document.getElementById("game-seed").textContent = "시드 " + packet.world.seed;
        await prepareWorldRendering(packet.world, packet.tribeStarts || packet.colonies);
        if (packet.colonies.find(colony => colony.id === packet.colonyId).tribe === null) {
          showTribeSelection(packet);
          return;
        }
        await prepareTribeRendering(Spawner.PLAYER_TRIBES.map(tribe => ({ tribe: tribe.key })));
        connection.active = true;
        applySnapshot(packet);
        if (!connection.online) return;
        prepareAgentRendering();
        closeEvolutionPanel();
        closeColonyMenu();
        selectObject(null, null);
        state.flashes = [];
        state.dragging = false;
        welcome.hidden = true;
        tribeSelection.hidden = true;
        document.body.dataset.screen = "game";
        document.querySelector(".app").hidden = false;
        document.querySelector(".app").inert = false;
        resizeCanvas();
        focusColony();
        canvas.focus();
        await client.call("resume", { visible: !document.hidden });
      } catch (error) {
        connection.active = false;
        setEvolutionText(tribeSelection.hidden ? welcomeStatus : tribeSelectionStatus, error.message);
      }
    }

    async function refreshRooms() {
      const version = ++lobbyVersion;
      roomList.setAttribute("aria-busy", "true");
      try {
        const rooms = await client.call("list", null);
        if (version !== lobbyVersion) return;
        const signature = JSON.stringify([connection.roomId, rooms]);
        if (signature === roomsSignature) return;
        roomsSignature = signature;
        document.getElementById("room-count").textContent = String(rooms.length);
        const fragment = document.createDocumentFragment();
        for (const room of rooms.toSorted((a, b) => Number(b.id === connection.roomId) - Number(a.id === connection.roomId))) {
          const row = document.createElement("div");
          row.className = "room-item" + (room.id === connection.roomId ? " is-host" : "");
          const text = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = room.title;
          if (room.id === connection.roomId) {
            const badge = document.createElement("span");
            badge.className = "room-owner-badge";
            badge.textContent = "최근 방";
            title.append(badge);
          }
          const detail = document.createElement("small");
          detail.textContent = (room.tribe === null ? "부족 선택 전" : Math.floor(room.simSeconds / 60) + "분 진행") + " · " + new Date(room.updatedAt).toLocaleString("ko-KR");
          const seed = document.createElement("small");
          seed.className = "room-seed-label";
          seed.textContent = "시드 " + room.seed;
          text.append(title, detail, seed);
          const join = document.createElement("button");
          join.type = "button";
          join.className = "primary-action";
          join.textContent = room.tribe === null ? "부족 선택" : "이어하기";
          join.addEventListener("click", () => lobbyAction("enter", { roomId: room.id }));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "secondary-action room-delete";
          remove.textContent = "×";
          remove.setAttribute("aria-label", room.title + " 삭제");
          remove.title = "방 삭제";
          remove.addEventListener("click", () => deleteRoom(room));
          const actions = document.createElement("div");
          actions.className = "room-actions";
          actions.append(join, remove);
          row.append(text, actions);
          fragment.append(row);
        }
        if (!rooms.length) {
          const empty = document.createElement("p");
          empty.className = "room-empty";
          empty.textContent = "아직 만든 방이 없습니다.";
          fragment.append(empty);
        }
        roomList.replaceChildren(fragment);
        setLobbyBusy(lobbyBusy);
      } catch (error) {
        setEvolutionText(welcomeStatus, error.message);
        if (!roomsSignature) roomList.textContent = "방 목록을 불러오지 못했습니다.";
      } finally {
        if (version === lobbyVersion) {
          roomList.setAttribute("aria-busy", "false");
          document.getElementById("room-create-panel").hidden = false;
        }
      }
    }

    async function deleteRoom(room) {
      if (lobbyBusy) return;
      if (!window.confirm(room.title + " 방의 진행 기록을 삭제할까요?\n삭제한 진행 기록은 복구할 수 없습니다.")) return;
      setLobbyBusy(true);
      welcomeStatus.textContent = "방 삭제 중…";
      try {
        await client.call("delete", { roomId: room.id, title: room.title });
        if (connection.roomId === room.id) connection.roomId = null;
        welcomeStatus.textContent = "방을 삭제했습니다.";
      } catch (error) { setEvolutionText(welcomeStatus, error.message); }
      finally {
        await refreshRooms();
        setLobbyBusy(false);
      }
    }

    async function lobbyAction(type, data) {
      if (lobbyBusy) return;
      if (type === "create" && !data.title) {
        roomTitle.setCustomValidity("방 이름을 입력해 주세요.");
        roomTitle.reportValidity();
        return;
      }
      setLobbyBusy(true);
      const createButton = document.querySelector('#welcome-form button[type="submit"]');
      const createButtonText = createButton.textContent;
      if (type === "create") {
        roomCreationProgress = 0;
        updateRoomCreationProgress(0);
      }
      welcomeStatus.textContent = "입장 준비 중…";
      try {
        const result = type === "create" ? await client.call("create", data, progress => updateRoomCreationProgress(progress * 40)) : data;
        await enterRoom(result.roomId);
        if (welcome.hidden) welcomeStatus.textContent = "";
      } catch (error) { setEvolutionText(welcomeStatus, error.message); }
      finally {
        setLobbyBusy(false);
        roomCreationProgress = null;
        createButton.textContent = createButtonText;
      }
    }

    function randomRoomName() {
      const adjectives = ["느긋한", "용감한", "졸린", "반짝이는", "호기심많은", "씩씩한", "춤추는", "행복한"];
      const places = ["숲", "정원", "들판", "계곡", "언덕", "세계"];
      const prefix = adjectives[Math.floor(Math.random() * adjectives.length)] +
        " " + places[Math.floor(Math.random() * places.length)] + " ";
      let number = Math.floor(Math.random() * 1000);
      if (prefix + number === roomTitle.value) number = (number + 1) % 1000;
      roomTitle.value = prefix + number;
      roomTitle.setCustomValidity("");
    }

    function randomRoomSeed() {
      roomSeed.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    }

    document.getElementById("room-seed-random").addEventListener("click", randomRoomSeed);
    roomTitle.addEventListener("input", () => roomTitle.setCustomValidity(""));
    document.getElementById("room-name-random").addEventListener("click", randomRoomName);
    document.getElementById("welcome-form").addEventListener("submit", (event) => {
      event.preventDefault();
      lobbyAction("create", { title: roomTitle.value.trim(), seed: roomSeed.value === "" ? null : Number(roomSeed.value) });
    });
    document.getElementById("rooms-refresh").addEventListener("click", refreshRooms);
    randomRoomName();
    randomRoomSeed();
    {
      client.call("session", null).then((result) => {
        connection.roomId = result.roomId;
        refreshRooms();
      }).catch((error) => {
        setEvolutionText(welcomeStatus, error.message);
        roomList.textContent = "방 목록을 불러오지 못했습니다.";
        roomList.setAttribute("aria-busy", "false");
        document.getElementById("room-create-panel").hidden = false;
      });
      function updateVisibility(visible) {
        if (renderFrame !== null) cancelAnimationFrame(renderFrame);
        renderFrame = null;
        audio.setActive(false);
        resetAudio();
        if (!connection.active || !welcome.hidden) {
          if (visible) { audio.setActive(true); scheduleRender(); }
          return;
        }
        if (visible) beginSynchronization();
        client.call(visible ? "resume" : "pause", { visible }).catch(error => {
          connection.online = false;
          connection.synchronizing = false;
          if (!connectionStatus.querySelector(".storage-recovery")) {
            setEvolutionText(connectionStatus, error.message);
          }
          connectionStatus.hidden = false;
          scheduleRender();
        });
      }
      document.addEventListener("visibilitychange", () => updateVisibility(!document.hidden));
      document.addEventListener("freeze", () => updateVisibility(false));
      document.addEventListener("resume", () => updateVisibility(!document.hidden));
      window.addEventListener("pagehide", () => updateVisibility(false));
      window.addEventListener("pageshow", event => {
        if (event.persisted) updateVisibility(!document.hidden);
      });
    }

    resizeCanvas();
    focusColony();
    setInterval(updateColonyPanel, 200);
    updateColonyPanel();
    scheduleRender();
    })().catch(error => {
      console.error(error);
      document.getElementById("welcome-status").textContent = "게임을 초기화하지 못했습니다. 페이지를 새로고침해 주세요.";
      document.querySelector('#welcome-form button[type="submit"]').disabled = true;
    });
