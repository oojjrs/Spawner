
    "use strict";
    (async () => {
    await globalThis.SpawnerAssets.ready;
    const assetSource = globalThis.SpawnerAssets.source;
    const tribeArt = Spawner.createTribeArt(Spawner.PLAYER_TRIBES, assetSource);
    const combatAttributeArt = Spawner.createCombatAttributeArt(assetSource, (width, height) => {
      const surface = document.createElement("canvas"); surface.width = width; surface.height = height; return surface;
    }, async path => {
      const image = new Image(); image.src = assetSource(path); await image.decode(); return image;
    });
    const tribeColonies = new Map();
    const colonyImageFrames = new WeakMap();
    const nestGrowthRendering = new Map();
    const nestGrowthLoading = new Map();
    const nestGrowthPlayback = Spawner.createNestGrowthPlayback();
    const structureEffectPlayback = Spawner.createStructureEffectPlayback();
    const structureEffectRendering = Spawner.createStructureEffectRendering((width, height) => {
      const surface = document.createElement("canvas"); surface.width = width; surface.height = height; return surface;
    });
    const { BURROW_CODEX } = Spawner;
    const { TERRAIN_CODEX, HAZARD_CODEX, terrainCodexResources, terrainCodexCell, ATTRIBUTES, attributeUnlockLevel, isAttributeUnlocked, ATTRIBUTE_COMBINATIONS, attributeCounts, unitStats, unitTravelSpeed, birthCost, hasSynergy, NEST_LEVELS, nestUpgradeCost, createClient,
      agentBirthDuration, agentBirthMotion, SPRING_BIRTH_ANIMATION, springBirthPlacement, PEBBLE_BIRTH_ANIMATION, pebbleBirthPlacement, drawBirthSeed, drawBirthFragments, drawBirthImpact,
      AGENT_ATTACK_ASSET, agentAttackFrame, agentDeathFrame } = globalThis.Spawner;
    const connection = { active: false, online: false, busy: false, synchronizing: false, roomId: null, colonyId: null, revision: -1, simSeconds: 0, receivedAt: 0 };
    const connectionStatus = document.getElementById("connection-status");
    const cheats = Spawner.createCheats(document, sendCommand);
    const canvas = document.getElementById("world");
    const ctx = canvas.getContext("2d");
    const groundShadow = createGroundShadow();
    const zoomLayerButtons = [...document.querySelectorAll("[data-zoom-layer]")];
    const portraitLayout = window.matchMedia("(orientation: portrait) and (max-width: 900px)");
    const portraitZoomSlider = document.getElementById("portrait-zoom-slider");
    const portraitZoomIn = document.getElementById("portrait-zoom-in");
    const portraitZoomOut = document.getElementById("portrait-zoom-out");
    const colonyFocus = document.getElementById("colony-focus");
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
    const discoveryToastQueue = [];
    const notifiedCombatIds = new Set();
    const objectPanel = document.getElementById("object-panel");
    const agentList = document.getElementById("agent-list");
    const agentListCount = document.getElementById("agent-list-count");
    const unitPanel = document.getElementById("unit-panel");
    const unitPanelTitle = document.getElementById("unit-panel-title");
    const agentNameDisplay = document.createElement("div");
    agentNameDisplay.id = "agent-name-display";
    agentNameDisplay.className = "unit-name-row";
    const agentRenameOpen = nestRenameOpen.cloneNode(true);
    agentRenameOpen.id = "agent-rename-open";
    agentRenameOpen.hidden = true;
    agentRenameOpen.setAttribute("aria-label", nestRenameOpen.title);
    agentRenameOpen.setAttribute("aria-controls", "agent-name-form");
    const agentNameForm = nestNameForm.cloneNode(true);
    for (const element of [agentNameForm, ...agentNameForm.querySelectorAll("[id]")]) element.id = element.id.replace("nest-name", "agent-name");
    agentNameForm.hidden = true;
    const agentNameInput = agentNameForm.querySelector("input");
    agentNameInput.maxLength = 24;
    agentNameInput.removeAttribute("aria-label");
    agentNameInput.setAttribute("aria-labelledby", "unit-panel-title");
    const agentNameSave = agentNameForm.querySelector("#agent-name-save");
    const agentNameCancel = agentNameForm.querySelector("#agent-name-cancel");
    const agentNameStatus = agentNameForm.querySelector("#agent-name-status");
    const agentHeading = document.createElement("div");
    agentHeading.className = "unit-heading";
    unitPanelTitle.before(agentHeading);
    agentNameDisplay.append(agentRenameOpen, unitPanelTitle);
    agentHeading.append(agentNameDisplay, agentNameForm);
    let renamedAgentId = null;
    const terrainDetails = document.getElementById("terrain-details");
    document.querySelector("#terrain-speed > img").src = assetSource("DesignAssets/UI/movement-speed.png");
    const resourceDetails = document.getElementById("resource-details");
    const burrowDetails = document.createElement("section");
    burrowDetails.id = "burrow-details";
    burrowDetails.className = "building-details";
    burrowDetails.setAttribute("aria-label", "굴 정보");
    burrowDetails.hidden = true;
    document.querySelector(".unit-actions").before(burrowDetails);
    const foreignColonyDetails = document.createElement("section");
    foreignColonyDetails.id = "foreign-colony-details";
    foreignColonyDetails.className = "building-details";
    foreignColonyDetails.setAttribute("aria-label", "다른 군락 둥지 정보");
    foreignColonyDetails.hidden = true;
    document.querySelector(".unit-actions").before(foreignColonyDetails);
    const resourceLocation = document.getElementById("resource-location");
    const resourceLocationHelp = resourceLocation.dataset.help;
    const agentDetails = document.getElementById("agent-details");
    const agentBirth = document.getElementById("agent-birth");
    const agentDesign = document.getElementById("agent-design");
    const unitActionStatus = document.getElementById("unit-action-status");
    let unitPanelSelectionKey = null;
    const corpseDetails = document.getElementById("corpse-details");
    const evolutionPanel = document.getElementById("evolution-panel");
    const evolutionOpenButton = document.getElementById("evolution-open-button");
    const evolutionClose = document.getElementById("evolution-close");
    const helpTooltip = document.getElementById("help-tooltip");
    let helpTooltipTarget = null;
    let helpTooltipTimer = null;

    function hideHelpTooltip() {
      clearTimeout(helpTooltipTimer);
      if (helpTooltipTarget) helpTooltipTarget.removeAttribute("aria-describedby");
      helpTooltipTarget = null;
      helpTooltip.hidden = true;
    }

    function scheduleHelpTooltipHide() {
      if (!helpTooltip.querySelector(".codex-resource-link")) { hideHelpTooltip(); return; }
      clearTimeout(helpTooltipTimer);
      helpTooltipTimer = setTimeout(hideHelpTooltip, 180);
    }

    helpTooltip.addEventListener("pointerenter", () => clearTimeout(helpTooltipTimer));
    helpTooltip.addEventListener("pointerleave", () => {
      if (!helpTooltip.contains(document.activeElement)) scheduleHelpTooltipHide();
    });
    helpTooltip.addEventListener("focusin", () => clearTimeout(helpTooltipTimer));
    helpTooltip.addEventListener("focusout", event => {
      if (!helpTooltip.contains(event.relatedTarget) && event.relatedTarget !== helpTooltipTarget) scheduleHelpTooltipHide();
    });

    function positionHelpTooltip() {
      if (!helpTooltipTarget) return;
      const rect = helpTooltipTarget.getBoundingClientRect();
      const panel = helpTooltipTarget.closest(".colony-menu, .evolution-panel, .codex, .unit-panel, .agent-panel-scroll, .resource-inventory-bar");
      const panelRect = panel.getBoundingClientRect();
      if (!helpTooltipTarget.getClientRects().length || rect.bottom <= panelRect.top || rect.top >= panelRect.bottom) {
        hideHelpTooltip();
        return;
      }
      const right = window.innerWidth - 10;
      helpTooltip.style.maxWidth = Math.max(0, right - 10) + "px";
      const width = helpTooltip.offsetWidth;
      const left = rect.right + 8 + width <= right ? rect.right + 8 : rect.left - width - 8;
      const x = clamp(left, 10, Math.max(10, right - width));
      let top = clamp(rect.top, 10, Math.max(10, window.innerHeight - helpTooltip.offsetHeight - 10));
      const notifications = discoveryToasts.childElementCount ? discoveryToasts.getBoundingClientRect() : null;
      if (notifications && x + width > notifications.left && x < notifications.right &&
          top + helpTooltip.offsetHeight > notifications.top && top < notifications.bottom) {
        top = Math.max(10, notifications.top - helpTooltip.offsetHeight - 12);
      }
      helpTooltip.style.left = x + "px";
      helpTooltip.style.top = top + "px";
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

    function setCodexResourceText(element, text) {
      const resources = Spawner.RESOURCE_TYPES;
      const parts = String(text).split(new RegExp("(" + resources.map(resource => resource.name).join("|") + "|\n)", "g"));
      element.replaceChildren();
      for (const part of parts) {
        const resource = resources.find(resource => resource.name === part);
        element.append(resource ? codexResourceLink(resource) : part === "\n" ? document.createElement("br") : part);
      }
    }

    function showHelpTooltip(button) {
      hideHelpTooltip();
      if (button.dataset.helpAttribute && button.dataset.locked !== "true") {
        const attribute = ATTRIBUTES.find(attribute => attribute.key === button.dataset.helpAttribute);
        updateAttributeHelp(button, attribute, Number(button.dataset.helpLevel), button.dataset.helpTribe || unitDraft?.tribe || state.tribe);
      }
      helpTooltipTarget = button;
      const host = button.closest("dialog[open]") || document.body;
      if (helpTooltip.parentElement !== host) host.append(helpTooltip);
      helpTooltip.setAttribute("role", button.dataset.helpResources === "true" ? "group" : "tooltip");
      if (button.dataset.helpResources === "true") setCodexResourceText(helpTooltip, button.dataset.help);
      else setEvolutionText(helpTooltip, button.dataset.help);
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
      button.addEventListener("click", hideHelpTooltip);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-help]") && !helpTooltip.contains(event.target)) hideHelpTooltip();
    });
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
    foodSprite.src = assetSource("DesignAssets/Resources/clay.png");
    const treeFruitSprite = new Image();
    treeFruitSprite.src = assetSource("DesignAssets/Foods/food-berry-bush.png");
    const carriedSoilSprite = new Image();
    carriedSoilSprite.src = assetSource("DesignAssets/Resources/clay-carry.png");
    const carriedFoodSprite = new Image();
    carriedFoodSprite.src = assetSource("DesignAssets/Resources/clay-carry.png");
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
    const resourceGroundContacts = {
      tree: { x: .48, y: .98, width: .15, depth: .025, opacity: .4 },
      dew: { x: .41, y: .89, width: .17, depth: .018, opacity: .42 },
      pebbles: { x: .56, y: .94, width: .83, depth: .025, opacity: .4 },
      clay: { x: .47, y: .98, width: .84, depth: .025, opacity: .42 },
    };
    const beetleCorpseSprite = new Image();
    beetleCorpseSprite.src = assetSource("DesignAssets/Animations/BeetleDeath/dead-v2.png");
    const resourceHarvestSprites = new Map(Spawner.RESOURCE_HARVEST_ANIMATIONS.map(animation => {
      const sprite = new Image();
      sprite.src = assetSource(animation.image);
      return [animation.resourceType, { ...animation, sprite }];
    }));
    const agentLevelUpPlayback = Spawner.createAgentLevelUpPlayback();
    const harvestPlayback = Spawner.createHarvestPlayback();
    const harvestDisplay = { time: null, agents: null, rivals: null, cells: new Map(), poses: new Map() };
    const burrowAppearances = new Map([
      ["small", "DesignAssets/Burrows/beetle-burrow-small.png", { x:112, y:284, width:1048, height:734 }],
      ["large", "DesignAssets/Burrows/beetle-burrow-large.png", { x:41, y:194, width:1694, height:569 }]
    ].map(([type, source, crop]) => {
      const sprite = new Image();
      sprite.src = assetSource(source);
      return [type, { sprite, crop: Spawner.imageRegion(source, crop) }];
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
    const agentSelectionLayer = document.createElement("canvas");
    const agentSelectionMask = document.createElement("canvas");
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
      ["pebble", "DesignAssets/Tribes/pebble/AnimationStudies/walk-in-place-v1/walk.webp", 406, 300],
      ["spring", "DesignAssets/Tribes/spring/AnimationStudies/flow-v4/flow-v4.webp", 230, 300]
    ].map(([tribe, path, width, height]) => {
      const sprite = new Image();
      sprite.src = assetSource(path);
      return [tribe, { sprite, width, height, scale: 1, ...Spawner.UNIT_ANIMATIONS[tribe].walk }];
    }));
    const unitAnimationSheets = new Map(Object.entries(Spawner.UNIT_ANIMATIONS).map(([tribe, animations]) => [tribe,
      new Map(Object.entries({ ...animations, death: Spawner.AGENT_DEATH_ANIMATIONS[tribe] }).map(([action, animation]) => {
        const sprite = combatSheets.get(tribe)?.[action] || (action === "walk" ? agentMovementSheets.get(tribe)?.sprite : null) || new Image();
        sprite.src = assetSource(animation.image);
        return [action, { animation, sprite, scale: 1 }];
      }))]));
    const unitAnimationReady = new Map();
    const sproutCombatMounts = new Map();
    const sproutRoots = Spawner.createSproutRoots((width, height) => {
      const surface = document.createElement("canvas"); surface.width = width; surface.height = height; return surface;
    });
    const AGENT_HEIGHT = 0.7;
    const unitDisplayScales = new Map();
    const unitAttributeScales = new Map();
    const UNIT_ATTRIBUTE_GROWTH = Object.freeze({ common: .03, combat: .05 });
    const unitGroundContacts = {
      bean: { x: .5, y: .98, width: .72, depth: .032, opacity: .32 },
      spore: { x: .5, y: .98, width: .42, depth: .025, opacity: .3 },
      pebble: { x: .5, y: .98, width: .68, depth: .035, opacity: .34 },
      spring: { x: .5, y: .985, width: .78, depth: .035, opacity: .32 },
      "flower-tail-bird": { x: .39, y: .988, width: .42, depth: .026, opacity: .3 },
      "dew-rabbit": { x: .52, y: .989, width: .74, depth: .033, opacity: .3 },
      "cotton-sheep": { x: .58, y: .966, width: .67, depth: .04, opacity: .32 },
      "soil-mole": { x: .52, y: .945, width: .92, depth: .06, opacity: .32 },
      "bundle-snail": { x: .51, y: .977, width: .78, depth: .036, opacity: .34 },
      "rolling-acorn": { x: .38, y: .989, width: .44, depth: .03, opacity: .3 },
      "bubble-toad": { x: .47, y: .962, width: .9, depth: .05, opacity: .32 },
      "vine-turtle": { x: .5, y: .966, width: .97, depth: .05, opacity: .32 },
      "spiny-back-beetle": { x: .5, y: .97, width: .8, depth: .05, opacity: .34 },
      "snare-vine": { x: .41, y: .986, width: .37, depth: .026, opacity: .3 },
      "soil-boar": { x: .53, y: .964, width: .91, depth: .05, opacity: .32 },
      "shadow-weasel": { x: .45, y: .937, width: .64, depth: .035, opacity: .3 },
      "talon-owl": { x: .36, y: .945, width: .45, depth: .032, opacity: .32 },
      "spring-keeper": { x: .29, y: .991, width: .34, depth: .026, opacity: .3 },
      "lantern-keeper": { x: .54, y: .984, width: .57, depth: .033, opacity: .3 },
      "old-garden-snail": { x: .48, y: .985, width: .78, depth: .036, opacity: .34 },
      "walking-forest": { x: .51, y: .963, width: .97, depth: .052, opacity: .34 },
      "spiny-back-leader": { x: .61, y: .969, width: .49, depth: .04, opacity: .34 },
      "white-paw": { x: .42, y: .92, width: .73, depth: .035, opacity: .3 }
    };
    const unitGroundVariants = {
      "bean:feet": { x: 0, y: -0.0116, radiusX: 0.0931, radiusY: 0.0102 },
      "bean:feet4": { x: -0.0136, y: -0.0116, radiusX: 0.1067, radiusY: 0.0119 },
      "bean:combatFeet": { x: -0.0543, y: 0.0815, radiusX: 0.1358, radiusY: 0.0154 },
      "spore:feet": { x: 0, y: -0.0087, radiusX: 0.0998, radiusY: 0.0109 },
      "spore:feet4": { x: 0, y: -0.0087, radiusX: 0.0998, radiusY: 0.0109 },
      "spore:combatFeet": { x: -0.0911, y: -0.0043, radiusX: 0.191, radiusY: 0.0219 },
      "pebble:feet": { x: 0, y: -0.0079, radiusX: 0.1656, radiusY: 0.0189 },
      "pebble:feet4": { x: 0, y: -0.0079, radiusX: 0.1656, radiusY: 0.0189 },
      "pebble:combatFeet": { x: -0.0808, y: -0.0039, radiusX: 0.3528, radiusY: 0.0237 },
      "spring:feet": { x: 0, y: -0.0091, radiusX: 0.214, radiusY: 0.0246 },
      "spring:feet4": { x: 0, y: -0.0091, radiusX: 0.214, radiusY: 0.0246 },
      "spring:combatFeet": { x: -0.1184, y: -0.0046, radiusX: 0.4917, radiusY: 0.0273 }
    };
    const unitCorpseContacts = {
      "bean": { start: {"x":-0.0019,"y":-0.0039,"radiusX":0.1144,"radiusY":0.0097}, end: {"x":0,"y":0.0698,"radiusX":0.1823,"radiusY":0.0157}, duration: 2.26 },
      "spore": { start: {"x":0,"y":-0.0043,"radiusX":0.0911,"radiusY":0.0108}, end: {"x":0.0087,"y":-0.0043,"radiusX":0.2083,"radiusY":0.018}, duration: 1.44 },
      "pebble": { start: {"x":0,"y":-0.0039,"radiusX":0.1537,"radiusY":0.0131}, end: {"x":-0.0118,"y":-0.0039,"radiusX":0.1734,"radiusY":0.0149}, duration: 1.44 },
      "spring": { start: {"x":-0.0023,"y":-0.0046,"radiusX":0.1571,"radiusY":0.0133}, end: {"x":0,"y":-0.0046,"radiusX":0.2367,"radiusY":0.0205}, duration: 1.44 },
      "flower-tail-bird": { start: {"x":-0.0197,"y":-0.0986,"radiusX":0.4141,"radiusY":0.0493}, end: {"x":0.0887,"y":-0.0986,"radiusX":0.7197,"radiusY":0.0612}, duration: 3.04 },
      "dew-rabbit": { start: {"x":0.0796,"y":-0.0177,"radiusX":0.4685,"radiusY":0.0442}, end: {"x":-0.0265,"y":-0.0177,"radiusX":0.5746,"radiusY":0.0485}, duration: 2.155 },
      "cotton-sheep": { start: {"x":0.1041,"y":0,"radiusX":0.4566,"radiusY":0.0401}, end: {"x":-0.008,"y":-0.016,"radiusX":0.6649,"radiusY":0.057}, duration: 1.76 },
      "soil-mole": { start: {"x":-0.1904,"y":-0.1758,"radiusX":0.4541,"radiusY":0.0382}, end: {"x":-0.1685,"y":-0.1758,"radiusX":0.4761,"radiusY":0.0402}, duration: 1.71 },
      "bundle-snail": { start: {"x":0.0607,"y":-0.1889,"radiusX":0.6139,"radiusY":0.0528}, end: {"x":0.1282,"y":-0.1889,"radiusX":0.4115,"radiusY":0.0346}, duration: 2.68 },
      "rolling-acorn": { start: {"x":-0.081,"y":-0.0944,"radiusX":0.3778,"radiusY":0.0337}, end: {"x":0.1484,"y":-0.0944,"radiusX":0.5262,"radiusY":0.0449}, duration: 4.64 },
      "bubble-toad": { start: {"x":-0.0296,"y":0.0099,"radiusX":0.6014,"radiusY":0.0524}, end: {"x":-0.0296,"y":0.0099,"radiusX":0.6014,"radiusY":0.0524}, duration: 2.07 },
      "vine-turtle": { start: {"x":0.0197,"y":-0.0099,"radiusX":0.6704,"radiusY":0.0586}, end: {"x":0.0197,"y":-0.0099,"radiusX":0.6704,"radiusY":0.0586}, duration: 1.6 },
      "spiny-back-beetle": { start: {"x":0.0268,"y":-0.0077,"radiusX":0.5701,"radiusY":0.0499}, end: {"x":0.0268,"y":-0.0077,"radiusX":0.5701,"radiusY":0.0499}, duration: 0 },
      "snare-vine": { start: {"x":-0.0455,"y":-0.0165,"radiusX":0.2605,"radiusY":0.022}, end: {"x":0.1488,"y":0,"radiusX":0.5044,"radiusY":0.0439}, duration: 3.7 },
      "soil-boar": { start: {"x":0.2563,"y":0,"radiusX":0.3573,"radiusY":0.0308}, end: {"x":-0.2602,"y":0.0233,"radiusX":0.3379,"radiusY":0.029}, duration: 1.44 },
      "shadow-weasel": { start: {"x":0.0641,"y":0.0214,"radiusX":0.5412,"radiusY":0.0474}, end: {"x":0.0142,"y":0.0356,"radiusX":0.6622,"radiusY":0.0498}, duration: 1.76 },
      "talon-owl": { start: {"x":-0.0686,"y":-0.1559,"radiusX":0.1185,"radiusY":0.0156}, end: {"x":0.2432,"y":0.0187,"radiusX":0.3804,"radiusY":0.0331}, duration: 1.7 },
      "spring-keeper": { start: {"x":-0.2185,"y":0.0175,"radiusX":0.2127,"radiusY":0.0181}, end: {"x":0.1078,"y":0.0117,"radiusX":0.9118,"radiusY":0.0408}, duration: 2 },
      "lantern-keeper": { start: {"x":-0.0167,"y":-0.0056,"radiusX":0.3734,"radiusY":0.0326}, end: {"x":0.0529,"y":0,"radiusX":0.443,"radiusY":0.0389}, duration: 2.07 },
      "old-garden-snail": { start: {"x":0.0077,"y":-0.0051,"radiusX":0.5153,"radiusY":0.0359}, end: {"x":0.1077,"y":-0.0051,"radiusX":0.2205,"radiusY":0.0189}, duration: 2.92 },
      "walking-forest": { start: {"x":0.0343,"y":-0.0046,"radiusX":0.5928,"radiusY":0.032}, end: {"x":0.0343,"y":-0.0046,"radiusX":0.5928,"radiusY":0.032}, duration: 1.85 },
      "spiny-back-leader": { start: {"x":-0.0145,"y":0.0041,"radiusX":0.0393,"radiusY":0.0103}, end: {"x":0.0124,"y":0.0083,"radiusX":0.645,"radiusY":0.0289}, duration: 0.72 },
      "white-paw": { start: {"x":-0.2813,"y":-0.2563,"radiusX":0.1958,"radiusY":0.017}, end: {"x":-0.0676,"y":-0.2599,"radiusX":0.4985,"radiusY":0.0249}, duration: 1.97 }
    };
    const unitDisplayBounds = new Map();
    let beetleCorpseScale = 1.6;
    const creatureIdleSheets = new Map(Object.entries(Spawner.CREATURE_IDLE_ANIMATIONS).map(([species, animation]) => {
      const sprite = new Image();
      sprite.src = assetSource(animation.image);
      return [species, { animation, sprite, scale: 1 }];
    }));
    const creatureWalkSheets = new Map(Object.entries(Spawner.CREATURE_WALK_ANIMATIONS).map(([species, animation]) => {
      const sprite = new Image();
      sprite.src = assetSource(animation.image);
      return [species, { animation, sprite, scale: 1 }];
    }));
    const creatureHurtSheets = new Map(Object.entries(Spawner.CREATURE_HURT_ANIMATIONS).map(([species, animation]) => {
      const sprite = new Image();
      sprite.src = assetSource(animation.image);
      return [species, { animation, sprite, scale: 1 }];
    }));
    const creatureDeathSheets = new Map(Object.entries(Spawner.CREATURE_DEATH_ANIMATIONS).map(([species, animation]) => {
      const sprite = new Image();
      sprite.src = assetSource(animation.image);
      return [species, { animation, sprite, scale: 1 }];
    }));
    const creatureAttackSheets = new Map(Object.entries(Spawner.CREATURE_ATTACK_ANIMATIONS).map(([species, animation]) => {
      const sprite = new Image();
      sprite.src = assetSource(animation.image);
      return [species, { animation, sprite, scale: 1 }];
    }));
    const attackSheet = new Image();
    attackSheet.src = assetSource(AGENT_ATTACK_ASSET);
    const agentLevelUpSprites = Object.fromEntries(["ring", "sparkle"].map(key => {
      const sprite = new Image();
      sprite.src = assetSource(Spawner.AGENT_LEVEL_UP[key]);
      return [key, sprite];
    }));
    const sporeBirthSheet = new Image();
    sporeBirthSheet.src = assetSource(Spawner.SPORE_BIRTH_ANIMATION.image);
    const sporeBirthFrames = new Map();
    let sporeBirthReady = null;
    const springBirthSheet = new Image();
    springBirthSheet.src = assetSource(SPRING_BIRTH_ANIMATION.image);
    const pebbleBirthSheet = new Image();
    pebbleBirthSheet.src = assetSource(PEBBLE_BIRTH_ANIMATION.image);
    const pebbleBirthForeground = new Image();
    pebbleBirthForeground.src = assetSource(PEBBLE_BIRTH_ANIMATION.foreground);
    const agentHeadMotions = new Map();
    const agentDisplayLayout = { time: null, agents: null, rivals: null, positions: new Map(), cells: new Map(), offsets: new Map() };
    const agentView = { time: null, agents: null, rivals: null, units: [] };
    const agentPositions = new WeakMap();
    const snapshotCollections = {};
    const agentCombatLayout = { time: null, agents: null, rivals: null, placements: new Map() };
    const agentSpriteSet = new WeakSet([starterObjectSprite]);
    const beetleSprite = new Image();
    agentSpriteSet.add(beetleSprite);
    beetleSprite.src = assetSource(globalThis.Spawner.BEETLE_NEUTRAL_ASSET);
    const beetleSheet = new Image();
    agentSpriteSet.add(beetleSheet);
    beetleSheet.src = assetSource(globalThis.Spawner.BEETLE_ANIMATION_ASSET);
    const beetleAttackSheet = new Image();
    agentSpriteSet.add(beetleAttackSheet);
    beetleAttackSheet.src = assetSource(Spawner.BEETLE_ATTACK_ASSET);
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
      ["root-rig", assetSource("DesignAssets/Units/Parts/bean-root-rig.png")],
      ["antenna-1", assetSource("DesignAssets/Units/Parts/antenna-1.png")],
      ["antenna-2", assetSource("DesignAssets/Units/Parts/antenna-2.png")],
    ].map(([key, source]) => {
      const part = new Image();
      part.src = source;
      return [key, part];
    }));
    const agentBaseParts = new Map([
      ["body", assetSource("DesignAssets/Units/BaseParts/body.png")],
      ["green-foot", assetSource("DesignAssets/Units/BaseParts/green-foot.png")],
      ["sprout-left", assetSource("DesignAssets/Units/BaseParts/sprout-left.png")],
      ["sprout-right", assetSource("DesignAssets/Units/BaseParts/sprout-right.png")],
      ["sprout-stem", assetSource("DesignAssets/Units/BaseParts/sprout-stem.png")],
    ].map(([key, source]) => {
      const part = new Image();
      part.src = source;
      return [key, part];
    }));
    await Promise.all([starterObjectSprite, beetleSprite, beetleSheet, beetleAttackSheet, talonOwlSheet, attackSheet, foodSprite, treeFruitSprite, carriedFoodSprite,
      beetleCorpseSprite, ...resourceCarrySprites.values(), ...agentParts.values(), ...agentBaseParts.values(),
      ...[...burrowAppearances.values()].map(appearance => appearance.sprite)].map(part => part.decode()));

    await Promise.all([...Spawner.PLAYER_TRIBES.map(prepareUnitAnimationSheets),
      ...[...creatureIdleSheets.values()].map(async entry => {
      await entry.sprite.decode();
      const bounds = tribeArt.bounds(entry.sprite, entry.animation.frameSize);
      entry.scale = entry.animation.frameSize / 512 * 480 / Math.max(bounds.width, bounds.height);
    })]);
    await Promise.all([...creatureWalkSheets.entries()].map(async ([species, entry]) => {
      await entry.sprite.decode();
      entry.scale = creatureIdleSheets.get(species)?.scale || 1;
    }));
    await Promise.all([...creatureHurtSheets].map(async ([species, entry]) => {
      await entry.sprite.decode();
      entry.scale = creatureIdleSheets.get(species)?.scale || 1;
    }));
    await Promise.all([...creatureAttackSheets, ...creatureDeathSheets].map(async ([species, entry]) => {
      await entry.sprite.decode();
      entry.scale = creatureIdleSheets.get(species)?.scale || 1;
    }));
    for (const tribe of Spawner.PLAYER_TRIBES) {
      const entry = unitAnimationSheets.get(tribe.key).get("idle");
      prepareUnitDisplaySize(tribe.key, entry.sprite, entry.animation, AGENT_HEIGHT * entry.scale);
    }
    for (const [species, entry] of creatureIdleSheets)
      prepareUnitDisplaySize(species, entry.sprite, entry.animation, 1.4 * entry.scale);
    prepareUnitDisplaySize("talon-owl", talonOwlSheet, Spawner.TALON_OWL_IDLE, Spawner.TALON_OWL_IDLE.scale);
    prepareUnitDisplaySize("spiny-back-beetle", beetleSheet, Spawner.BEETLE_SPRITE, Spawner.BEETLE_SPRITE.scale);
    for (const [species, entry] of creatureDeathSheets) prepareCreatureDeathSize(species, entry);
    const beetleCorpseBounds = tribeArt.bounds(beetleCorpseSprite, false);
    beetleCorpseScale = Spawner.UNIT_DISPLAY_SIZES["spiny-back-beetle"] * beetleCorpseSprite.naturalWidth /
      (unitDisplayScales.get("spiny-back-beetle") * Math.max(beetleCorpseBounds.width, beetleCorpseBounds.height));
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

    await Promise.all([...resourceHarvestSprites.values()].map(async animation => {
      animation.frames = new Map();
      await prepareAnimationFrames(animation.sprite, animation.frameSize, animation.columns,
        animation.frameCount, animation.frameSize).then(frames => { animation.frames = frames; }).catch(() => {});
    }));

    await Promise.all(colonyAppearances.map(initializeColonyLight));

    let WORLD_SIZE = Spawner.WORLD_SIZE;
    const worldMap = { terrain: new Uint8Array(WORLD_SIZE * WORLD_SIZE), burrows: [], food: [], origin: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 } };
    const forest = { sprite: new Image(), trees: [], cells: new Map(), steps: new Map(), shakes: new Map(), parts: [], time: null, bounds: [
      { left: 0.087017, top: 0.09116, right: 0.972376, bottom: 0.964088 },
      { left: 0.093923, top: 0.016575, right: 0.907459, bottom: 0.964088 },
      { left: 0.055249, top: 0.13674, right: 0.929558, bottom: 0.964088 }
    ] };
    forest.sprite.src = assetSource("DesignAssets/Terrain/standing-tree-smooth-atlas.png");
    const hazardGroundSprites = ["DesignAssets/Terrain/poison-spore-ground.png"].map(source => {
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

    const ZOOM_LAYERS = [288, 144, 36, 8, null];
    const ZOOM_STEPS_PER_LAYER = 4;
    const INITIAL_ZOOM_LAYER = 1;
    const MIN_ZOOM = 0.1;
    const INITIAL_ZOOM = ZOOM_LAYERS[INITIAL_ZOOM_LAYER];
    const MAX_ZOOM = ZOOM_LAYERS[0];
    const viewport = { width: 0, height: 0, pixelRatio: 0 };
    const TERRAIN_COLORS = {
      land: "#171d1b",
      grassland: "#2b3a29",
      forest: "#34271e",
      lowMountain: "#263029",
      highMountain: "#374139",
      ridge: "#4b554c",
      swamp: "#56562b",
      coast: "#39747d",
      shallow: "#1b4962",
      deep: "#1b4962",
      ford: "#9da899"
    };
    const terrainGrounds = Object.fromEntries([["land",assetSource("DesignAssets/Terrain/land-ground.png")],["forest",assetSource("DesignAssets/Terrain/forest-ground.png")],["swamp",assetSource("DesignAssets/Terrain/swamp-ground.png")],["lowMountain",assetSource("DesignAssets/Terrain/low-mountain-ground.png")],["highMountain",assetSource("DesignAssets/Terrain/high-mountain-ground.png")],["ridge",assetSource("DesignAssets/Terrain/ridge-ground.png")],["coast",assetSource("DesignAssets/Terrain/coast-ground.png")],["shallow",assetSource("DesignAssets/Terrain/deep-water-ground.png")],["ford",assetSource("DesignAssets/Terrain/ford-ground.png")],["deep",assetSource("DesignAssets/Terrain/deep-water-ground.png")]].map(([terrain, source]) => {
      const image = new Image();
      image.src = source;
      return [terrain, image];
    }));
    const AGENT_SPEED = 1;
    const AGENT_CAPACITY = 2;
    const AGENT_VISION = 3;
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
      "forest", "lowMountain", "highMountain", "ridge", "swamp", "ford"
    ];
    const terrainRendering = {
      types: new Uint8Array(WORLD_SIZE * WORLD_SIZE),
      edges: new Uint8Array(WORLD_SIZE * WORLD_SIZE),
      colors: TERRAIN_TYPES.map(type => TERRAIN_COLORS[type].slice(1).match(/../g).map(value => parseInt(value, 16))),
      waterEdge: TERRAIN_COLORS.coast.slice(1).match(/../g).map(value => parseInt(value, 16)),
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
        layer: INITIAL_ZOOM_LAYER,
        followAgentId: null
      },
      simSeconds: 0,
      lastFrame: performance.now(),
      flashes: [],
      colonyFood: 0,
      ending: null,
      evolutionPoints: 0,
      resourceInventory: {},
      resourceInventoryLimits: {},
      resourceCapacity: Spawner.materialCapacity(1, []),
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
        terrain === "lowMountain" || terrain === "highMountain" || terrain === "ridge" || terrain === "ford";
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

    function updateTerrainRendering(seed, prepared) {
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
      if (prepared) {
        rendering.phase = prepared.phase;
        rendering.edges.set(prepared.edges);
        return;
      }
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
      const size = Math.sqrt(rendering.types.length), length = size * resolution;
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
        columns[offset + 11] = Math.min(size - 1, Math.floor(value + 0.35));
        rows[offset + 10] = columns[offset + 10] * size;
        rows[offset + 11] = columns[offset + 11] * size;
      }
      return { columns, rows };
    }

    function createTerrainPatch(rendering, x, y, width, height, resolution, textured) {
      const WORLD_SIZE = Math.sqrt(rendering.types.length);
      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
      const pixelsWidth = width * resolution, pixelsHeight = height * resolution;
      const colors = new ImageData(pixelsWidth, pixelsHeight);
      const texture = textured ? new ImageData(pixelsWidth, pixelsHeight) : null;
      const grounds = rendering.grounds, palette = rendering.colors, terrain = rendering.types, waterEdge = rendering.waterEdge;
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
          let red = 0, green = 0, blue = 0, detailRed = 0, detailGreen = 0, detailBlue = 0, water = 0;
          for (let neighbor = 0; neighbor < 4; neighbor++) {
            const weight = weights[neighbor];
            if (!weight) continue;
            const type = types[neighbor], color = palette[type];
            if (type < 2) water += weight;
            red += color[0] * weight; green += color[1] * weight; blue += color[2] * weight;
            if (textured) {
              const ground = grounds[type], alpha = ground ? ground[sample + 3] / 255 : 0;
              detailRed += (ground ? ground[sample] * alpha + color[0] * (1 - alpha) : color[0]) * weight;
              detailGreen += (ground ? ground[sample + 1] * alpha + color[1] * (1 - alpha) : color[1]) * weight;
              detailBlue += (ground ? ground[sample + 2] * alpha + color[2] * (1 - alpha) : color[2]) * weight;
            }
          }
          if (waterEdge && water > 0.5 && water < 1) {
            const edge = Math.min(1, (1 - water) * 5);
            red += (waterEdge[0] - red) * edge;
            green += (waterEdge[1] - green) * edge;
            blue += (waterEdge[2] - blue) * edge;
            if (textured) {
              detailRed += (waterEdge[0] - detailRed) * edge;
              detailGreen += (waterEdge[1] - detailGreen) * edge;
              detailBlue += (waterEdge[2] - detailBlue) * edge;
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
          const { rendering, start, indices } = event.data, resolution = rendering.resolution, size = Math.sqrt(rendering.types.length);
          const surface = new OffscreenCanvas(32 * resolution, Math.ceil(indices.length / 32) * resolution);
          const ground = new OffscreenCanvas(surface.width, surface.height);
          const context = surface.getContext("2d"), texture = ground.getContext("2d");
          for (let offset = 0; offset < indices.length; offset++) {
            const index = indices[offset];
            const patch = createTerrainPatch(rendering, index % size, Math.floor(index / size), 1, 1, resolution, true);
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
      let loadGrounds;
      self.onmessage = async event => {
        if (event.data.type === "grounds") { loadGrounds(event.data.grounds); return; }
        const data = event.data, rendering = data.rendering, records = [];
        const size = data.size, columns = Math.ceil(size / 16);
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
          for (let start = 0; start < (columns * columns); start += 8) {
            const tasks = [];
            for (let index = start; index < Math.min((columns * columns), start + 8); index++) {
              const surfaces = {};
              for (const [name, context] of Object.entries(sources)) {
                const surface = new OffscreenCanvas(256, 256);
                surface.getContext("2d").putImageData(context.getImageData(index % columns * 256, Math.floor(index / columns) * 256, 256, 256), 0, 0);
                surfaces[name] = surface;
              }
              tasks.push(emit({ type, index }, surfaces));
            }
            await Promise.all(tasks);
          }
        }
        try {
          if (data.assetKey) data.key += ":" + data.assetKey;
          else {
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
          }
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
                postMessage({ type: "done", cached: true, key: data.key });
                return;
              } catch {
                for (const item of decoded) for (const image of item.transfer) image.close();
              }
            }
          } catch (error) { database?.close(); database = null; data.cacheError = error.message; }

          if (data.layer === "terrain") {
            postMessage({ type: "status", cached: false });
            if (data.assetKey) rendering.grounds = await new Promise(resolve => {
              loadGrounds = resolve;
              postMessage({ type: "grounds" });
            });
            const overview = new OffscreenCanvas(size * 4, size * 4);
            overview.getContext("2d").putImageData(createTerrainPatch(rendering, 0, 0, size, size, 4, false).colors, 0, 0);
            await emit({ type: "overview" }, { image: overview });
            const edges = [];
            for (let index = 0; index < rendering.edges.length; index++) if (rendering.edges[index]) edges.push(index);
            const medium = new OffscreenCanvas(size * 16, size * 16), mediumGround = new OffscreenCanvas(size * 16, size * 16);
            const mediumContext = medium.getContext("2d"), mediumTexture = mediumGround.getContext("2d");
            mediumContext.imageSmoothingQuality = mediumTexture.imageSmoothingQuality = "high";
            const grounds = rendering.grounds.map(pixels => {
              if (!pixels) return null;
              const surface = new OffscreenCanvas(384, 384);
              surface.getContext("2d").putImageData(new ImageData(pixels, 384, 384), 0, 0);
              return surface;
            });
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
              const type = rendering.types[y * size + x], color = rendering.colors[type];
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
                      const cell = message.indices[offset], x = cell % size * 16, y = Math.floor(cell / size) * 16;
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
                context.translate(-(region.index % columns) * 256, -Math.floor(region.index / columns) * 256);
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
            } catch (error) { data.cacheError = error.message; }
          }
          postMessage({ type: "done", cached: cachedImages, key: data.key, cacheError: data.cacheError });
        } catch (error) { postMessage({ type: "error", message: error.message }); }
        finally { data.sprite?.close(); database?.close(); }
      };
    }

    const terrainWorkerSource = createTerrainSamples.toString() + "\n" + createTerrainPatch.toString() + "\n" + drawForestTree.toString() +
      "\n" + buildTerrainAtlas.toString() + "\n(" + buildTerrainImages.toString() + ")();";

    async function prepareAnimationFrames(sprite, frameSize, columns, frameCount, resolution) {
      await sprite.decode();
      const source = await createImageBitmap(sprite);
      const frames = new Map();
      try {
        for (let index = 0; index < frameCount; index++) {
          const frame = await createImageBitmap(source, index % columns * frameSize,
            Math.floor(index / columns) * frameSize, frameSize, frameSize,
            { resizeWidth: resolution, resizeHeight: resolution, resizeQuality: "high" });
          frames.set(index, frame);
        }
      } finally { source.close(); }
      return frames;
    }

    async function prepareAgentRendering() {
      const combatTribes = new Set([...state.agents, ...state.rivals].filter(agent => !agent.species &&
        Spawner.combatAttributeKeys(agent.attributes).length).map(agent => agent.tribe || "bean"));
      await Promise.all([...combatTribes].map(tribe => combatAttributeArt.prepare(tribe)));
      const tribes = new Set([...state.agents, ...state.rivals].filter(agent => !agent.species).map(agent => agent.tribe || "bean"));
      await Promise.all([...tribes].map(async tribe => {
        for (const entry of unitAnimationSheets.get(tribe).values()) {
          if (entry.frames) continue;
          const animation = entry.animation;
          entry.frames = await prepareAnimationFrames(entry.sprite, animation.frameSize,
            animation.columns, animation.frameCount, animation.frameSize);
        }
      }));
      for (const agent of [...state.agents, ...state.rivals]) {
        if (agent.species) continue;
        const attributes = agent.appearanceAttributes || agent.attributes;
        for (const layer of agentSpriteLayers(attributes)) selectionContour(agentSprite(agent, layer), null);
      }
      const sprite = forest.bitmap || forest.sprite, frameSize = sprite.height || sprite.naturalHeight;
      for (let frame = 0; frame < 3; frame++) {
        treeParts(frame);
        selectionContour(sprite, { owner: forest, size: frameSize, index: frame, x: frame * frameSize, y: 0 });
      }
      const surface = document.createElement("canvas");
      surface.width = surface.height = 64;
      const context = surface.getContext("2d");
      for (const image of [hazardCanvas, grassGround, ...Object.values(terrainGrounds)]) context.drawImage(image, 0, 0, 64, 64);
      context.getImageData(0, 0, 1, 1);
    }

    function forestTreeRegions(tree) {
      const regions = [];
      const left = Math.max(0, Math.floor((tree.x - tree.height / 2) / 16));
      const right = Math.min((Math.ceil(WORLD_SIZE / 16) - 1), Math.ceil((tree.x + tree.height / 2) / 16) - 1);
      const top = Math.max(0, Math.floor((tree.y - tree.height * 0.94) / 16));
      const bottom = Math.min((Math.ceil(WORLD_SIZE / 16) - 1), Math.ceil((tree.y + tree.height * 0.06) / 16) - 1);
      for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) regions.push(row * Math.ceil(WORLD_SIZE / 16) + column);
      return regions;
    }

    function forestRegionKey(trees, seed) {
      let key = seed >>> 0;
      for (const tree of trees) key = Math.imul(key ^ (tree.row * WORLD_SIZE + tree.column), 16777619) >>> 0;
      return seed + ":" + trees.length + ":" + key;
    }

    function forestImageRegions(trees, seed) {
      const regions = Array.from({ length: (Math.ceil(WORLD_SIZE / 16) * Math.ceil(WORLD_SIZE / 16)) }, (value, index) => ({ index, trees: [] }));
      for (const tree of trees) for (const index of forestTreeRegions(tree)) regions[index].trees.push(tree);
      for (const region of regions) region.key = forestRegionKey(region.trees, seed);
      return regions;
    }

    function openRenderingStorage() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("spawner-rendering", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("maps", { keyPath: "key" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("지형 캐시를 열지 못했습니다."));
      });
    }

    function worldRenderingKey(world, colonies) {
      const assets = Spawner.renderingAssets;
      if (!assets) return null;
      return "world-v1:" + (world.roomId || world.seed) + ":" + world.seed + ":" + world.generationVersion + ":" +
        [assets.terrain, assets.forest, assets.hazards].join(":") + ":" + colonies.map(colony => colony.x + "," + colony.y).join(";");
    }

    function worldRenderingMatches(layout, world) {
      if (!layout || layout.regions?.length !== (Math.ceil(WORLD_SIZE / 16) * Math.ceil(WORLD_SIZE / 16)) || !Array.isArray(layout.trees) ||
          layout.rendering?.edges?.length !== WORLD_SIZE * WORLD_SIZE || !(layout.hazardImage instanceof Blob)) return false;
      for (const name of ["terrain", "hazards", "treeCells"]) {
        const cells = world[name] || [];
        if (!layout[name] || layout[name].length !== cells.length || !layout[name].every((value, index) => value === cells[index])) return false;
      }
      return JSON.stringify(layout.resourceCells) === JSON.stringify(world.resourceCells || []);
    }

    async function readWorldRendering(key, world) {
      if (forest.layout?.key === key && worldRenderingMatches(forest.layout, world)) return forest.layout;
      let database;
      try {
        database = await openRenderingStorage();
        const layout = await new Promise((resolve, reject) => {
          const task = database.transaction("maps", "readonly"), request = task.objectStore("maps").get(key);
          task.oncomplete = () => resolve(request.result);
          task.onabort = () => reject(task.error);
          task.onerror = () => {};
        });
        return worldRenderingMatches(layout, world) ? layout : null;
      } catch { return null; }
      finally { database?.close(); }
    }

    async function restoreWorldRendering(layout) {
      const image = await createImageBitmap(layout.hazardImage);
      resetForestRendering();
      forest.trees = layout.trees;
      for (const tree of forest.trees) forest.cells.set(tree.column + "," + tree.row, tree);
      hazardCells.length = layout.hazardCells.length;
      for (let index = 0; index < hazardCells.length; index++) hazardCells[index] = layout.hazardCells[index];
      hazardGroundTiles.clear();
      const context = hazardCanvas.getContext("2d");
      context.clearRect(0, 0, hazardCanvas.width, hazardCanvas.height);
      context.drawImage(image, 0, 0);
      image.close();
      forest.hazardImage = layout.hazardImage;
    }

    function worldRenderingRecord() {
      return { key: forest.layoutKey, layer: "world", terrain: worldMap.terrain, hazards: worldMap.hazards,
        treeCells: worldMap.treeCells ? worldMap.treeCells.slice() : new Uint8Array(), resourceCells: forest.resourceCells,
        rendering: { key: terrainRendering.key, phase: terrainRendering.phase, edges: terrainRendering.edges },
        trees: [...forest.cells.values()], regions: [...forest.imageRegions.values()],
        hazardCells, hazardImage: forest.hazardImage };
    }

    function reportRenderingCacheError(error) {
      terrainRendering.cacheError = "지형 캐시를 저장하지 못했습니다. 다음 접속에서 다시 준비할 수 있습니다. " + error.message;
      setEvolutionText(connectionStatus, terrainRendering.cacheError);
      connectionStatus.hidden = false;
    }

    async function saveWorldRendering() {
      if (!forest.layoutKey) return;
      if (!forest.hazardImage) forest.hazardImage = await new Promise(resolve => hazardCanvas.toBlob(resolve, "image/png"));
      if (!forest.hazardImage) throw new Error("위험 지형 이미지를 저장하지 못했습니다.");
      const layout = worldRenderingRecord(), database = await openRenderingStorage();
      try {
        await new Promise((resolve, reject) => {
          const task = database.transaction("maps", "readwrite");
          task.objectStore("maps").put(layout);
          task.oncomplete = resolve;
          task.onabort = () => reject(task.error);
          task.onerror = () => {};
        });
        forest.layout = layout;
      } finally { database.close(); }
    }

    async function prepareWorldRendering(world, colonies) {
      terrainRendering.ready = false;
      terrainRendering.cacheError = null;
      await forest.cacheWrite;
      const size = world.size || Math.sqrt(world.terrain.length);
      if (WORLD_SIZE !== size) {
        WORLD_SIZE = size;
        terrainRendering.types = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
        terrainRendering.edges = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
        terrainRendering.slots = new Int32Array(WORLD_SIZE * WORLD_SIZE).fill(-1);
        terrainRendering.revealed = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
        for (const image of terrainRendering.forest.values()) image.close();
        terrainRendering.forest.clear();
        terrainRendering.forestKeys.clear();
        terrainRendering.key = null;
        fogCanvas.width = fogCanvas.height = WORLD_SIZE;
        hazardCanvas.width = hazardCanvas.height = WORLD_SIZE * 8;
        FOG_CHUNK_COLUMNS = Math.ceil(WORLD_SIZE / FOG_CHUNK_SIZE);
        fogPixels = fogContext.createImageData(WORLD_SIZE, WORLD_SIZE);
        fogTransitions.clear();
        fogVisible = new Set();
      }
      forest.seed = world.seed;
      forest.colonies = colonies;
      updateRoomCreationProgress(40);
      worldMap.terrain = Uint8Array.from(world.terrain);
      worldMap.generationVersion = world.generationVersion;
      worldMap.creatureHabitats = world.creatureHabitats || [];
      worldMap.hazards = Uint8Array.from(world.hazards || []);
      worldMap.burrows = world.burrows || [];
      worldMap.treeCells = world.treeCells ? Uint8Array.from(world.treeCells) : null;
      forest.layoutKey = worldRenderingKey(world, colonies);
      forest.resourceCells = world.resourceCells || [];
      let layout = forest.layoutKey ? await readWorldRendering(forest.layoutKey, world) : null;
      if (layout) {
        try { await restoreWorldRendering(layout); }
        catch { layout = null; }
      }
      if (!layout) {
        updateForest(world.seed, world.resourceCells);
        updateHazards(world.seed);
        forest.hazardImage = null;
      }
      let key = layout ? layout.rendering.key : world.seed >>> 0;
      if (!layout) for (const type of worldMap.terrain) key = Math.imul(key ^ type, 16777619) >>> 0;
      const trees = forest.trees.filter(tree => !colonies.some(colony => {
        return tree.column >= colony.x && tree.column < colony.x + COLONY_SIZE &&
          tree.row >= colony.y && tree.row < colony.y + COLONY_SIZE;
      }));
      const regions = layout ? layout.regions : forestImageRegions(trees, world.seed);
      forest.imageRegions = new Map(regions.map(region => [region.index, region]));
      const changedRegions = regions.filter(region => terrainRendering.forestKeys.get(region.index) !== region.key ||
        !terrainRendering.forest.has(region.index));
      const terrainReady = terrainRendering.key === key && terrainRendering.overview && terrainRendering.medium.size === (Math.ceil(WORLD_SIZE / 16) * Math.ceil(WORLD_SIZE / 16));
      const forestReady = changedRegions.length === 0;
      if (terrainReady && forestReady) {
        if (!layout) await saveWorldRendering().catch(reportRenderingCacheError);
        terrainRendering.ready = true;
        updateRoomCreationProgress(95);
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
            updateTerrainRendering(world.seed, layout?.rendering);
            const grounds = Spawner.renderingAssets ? null : TERRAIN_TYPES.map((type, index) => terrainGroundPixels(index));
            data = { layer, size: WORLD_SIZE, key: "terrain-64-v4:" + world.seed + ":" + key, assetKey: Spawner.renderingAssets?.terrain,
              rendering: { types: terrainRendering.types, edges: terrainRendering.edges, colors: terrainRendering.colors, waterEdge: terrainRendering.waterEdge,
                grounds, phase: terrainRendering.phase, resolution: terrainRendering.resolution } };
            updateRoomCreationProgress(50);
          } else {
            if (forest.bitmap) forest.bitmap.close();
            forest.bitmap = await createImageBitmap(forest.sprite);
            data = { layer, size: WORLD_SIZE, key: "forest-16-v2:" + world.seed + (world.roomId ? ":" + world.roomId : ""), assetKey: Spawner.renderingAssets?.forest,
              regions: changedRegions, sprite: await createImageBitmap(forest.bitmap) };
            updateRoomCreationProgress(90);
          }
          await new Promise((resolve, reject) => {
            worker.onerror = event => reject(new Error(event.message));
            worker.onmessage = event => {
              const message = event.data;
              if (message.type === "status") {
                action = message.cached ? "불러오는 중…" : "생성 중…";
                setEvolutionText(welcomeStatus, label + " 이미지 " + action);
              } else if (message.type === "grounds") {
                worker.postMessage({ type: "grounds", grounds: TERRAIN_TYPES.map((type, index) => terrainGroundPixels(index)) });
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
                updateRoomCreationProgress(80 + terrainRendering.medium.size / (Math.ceil(WORLD_SIZE / 16) * Math.ceil(WORLD_SIZE / 16)) * 10);
              } else if (message.type === "forest") {
                terrainRendering.forest.get(message.index)?.close?.();
                terrainRendering.forest.set(message.index, message.image);
                terrainRendering.forestKeys.set(message.index, message.key);
                updateRoomCreationProgress(90 + terrainRendering.forest.size / (Math.ceil(WORLD_SIZE / 16) * Math.ceil(WORLD_SIZE / 16)) * 4);
              } else if (message.type === "done") {
                terrainRendering.cached &&= message.cached;
                if (message.cacheError) reportRenderingCacheError(new Error(message.cacheError));
                if (layer === "forest") forest.cacheKey = message.key;
                resolve();
              } else if (message.type === "error") reject(new Error(message.message));
            };
            worker.postMessage(data, data.sprite ? [data.sprite] : []);
          });
          if (layer === "terrain") terrainRendering.key = key;
        }
      } finally { worker.terminate(); URL.revokeObjectURL(url); }
      if (!layout) await saveWorldRendering().catch(reportRenderingCacheError);
      terrainRendering.ready = true;
      updateRoomCreationProgress(95);
    }

    function revealForest(indices) {
      for (const index of indices) {
        const x = index % WORLD_SIZE, y = Math.floor(index / WORLD_SIZE);
        for (let row = Math.max(0, y - 2); row <= Math.min(WORLD_SIZE - 1, y + 2); row++) {
          for (let column = Math.max(0, x - 2); column <= Math.min(WORLD_SIZE - 1, x + 2); column++) {
            const key = row * WORLD_SIZE + column;
            terrainRendering.revealed[key] = 1;
            const region = Math.floor(row / 16) * Math.ceil(WORLD_SIZE / 16) + Math.floor(column / 16);
            if (!terrainRendering.regions.has(region)) {
              terrainRendering.regions.add(region);
              terrainRendering.regionPath.rect(region % Math.ceil(WORLD_SIZE / 16) * 16, Math.floor(region / Math.ceil(WORLD_SIZE / 16)) * 16, 16, 16);
            }
            if (forest.revealed.has(key)) continue;
            const tree = forest.cells.get(column + "," + row);
            if (!tree) continue;
            forest.revealed.set(key, tree);
            forest.regions.add(Math.floor(row / 16) * Math.ceil(WORLD_SIZE / 16) + Math.floor(column / 16));
          }
        }
      }
    }

    function saveForestRegion(index, key, surface) {
      const cacheKey = forest.cacheKey;
      if (!cacheKey) return;
      const preparation = Promise.resolve().then(() => forest.layoutKey ? worldRenderingRecord() : null);
      const image = new Promise(resolve => {
        try { surface.toBlob(resolve, "image/png"); }
        catch { resolve(null); }
      });
      forest.cacheWrite = forest.cacheWrite.then(async () => {
        const blob = await image;
        if (!blob) throw new Error("변경된 숲 이미지를 저장하지 못했습니다.");
        const layout = await preparation;
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
              if (layout) store.put(layout);
            };
            task.oncomplete = resolve;
            task.onabort = () => reject(task.error);
            task.onerror = () => {};
          });
          if (layout) forest.layout = layout;
        } finally { database.close(); }
      }).catch(reportRenderingCacheError);
    }

    function updateForestRegion(column, row) {
      if (!terrainRendering.forest.size || !forest.bitmap) return;
      const regionX = Math.floor(column / 16) * 16, regionY = Math.floor(row / 16) * 16;
      const index = Math.floor(row / 16) * Math.ceil(WORLD_SIZE / 16) + Math.floor(column / 16), trees = [];
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
      forest.imageRegions.set(index, { index, trees, key });
      terrainRendering.forest.get(index)?.close?.();
      terrainRendering.forest.set(index, surface);
      terrainRendering.forestKeys.set(index, key);
      forest.overrides.delete(index);
      saveForestRegion(index, key, surface);
    }

    function applyForestMapStyle(context, detail) {
      context.globalAlpha *= 0.9 + detail * 0.1;
      context.filter = `saturate(${0.78 + detail * 0.22}) contrast(${0.8 + detail * 0.2}) brightness(${0.86 + detail * 0.14})`;
    }

    function drawForestOverview(topLeft, bottomRight) {
      ctx.save();
      applyForestMapStyle(ctx, clamp((state.camera.zoom - 6) / 12, 0, 1));
      ctx.imageSmoothingQuality = "low";
      for (const index of forest.regions) {
        const x = index % Math.ceil(WORLD_SIZE / 16) * 16, y = Math.floor(index / Math.ceil(WORLD_SIZE / 16)) * 16;
        if (x + 16 < topLeft.x || y + 16 < topLeft.y || x > bottomRight.x || y > bottomRight.y) continue;
        const point = worldToScreen(x, y), size = 16 * state.camera.zoom;
        const replacement = forest.overrides.get(index);
        if (replacement) ctx.drawImage(replacement, point.x, point.y, size, size);
        else ctx.drawImage(terrainRendering.forest.get(index), point.x, point.y, size, size);
      }
      ctx.restore();
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
      const right = Math.min((Math.ceil(WORLD_SIZE / 16) - 1), Math.floor(b.x / 16)), bottom = Math.min((Math.ceil(WORLD_SIZE / 16) - 1), Math.floor(b.y / 16));
      const size = 16 * state.camera.zoom;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
      for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) {
        if (!terrainRendering.regions.has(row * Math.ceil(WORLD_SIZE / 16) + column)) continue;
        const image = terrainRendering.medium.get(row * Math.ceil(WORLD_SIZE / 16) + column);
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
        if (!terrainRendering.regions.has(row * Math.ceil(WORLD_SIZE / 16) + column)) continue;
        const image = terrainRendering.medium.get(row * Math.ceil(WORLD_SIZE / 16) + column);
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

    function resetForestRendering() {
      forest.trees = [];
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
    }

    function updateForest(seed, resourceCells) {
      resetForestRendering();
      const clearings = new Set((resourceCells || []).map(([x, y]) => x + "," + y));
      for (let row = 0; row < WORLD_SIZE; row++) {
        for (let column = 0; column < WORLD_SIZE; column++) {
          const index = row * WORLD_SIZE + column;
          const occupied = worldMap.generationVersion >= 32 ? !worldMap.treeCells?.[index] :
            worldMap.treeCells && !worldMap.treeCells[index] || terrainAt(column, row) !== "forest" || worldMap.hazards?.[index];
          if (occupied || clearings.has(column + "," + row)) continue;
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
      for (const source of state.camera.zoom < 18 ? [] : visibleAgents()) {
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
      const bounds = forest.bounds[tree.frame];
      drawGroundShadow(point.x, point.y + (bounds.bottom - .94) * height,
        height * .065, height * .022, .4);
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
      if (burrow.health <= 0 && structureEffectPlayback.effects.get("burrow:" + burrow.id + ":damage")?.type !== "destroy") return;
      const appearance = burrowAppearances.get(burrow.type);
      if (!appearance) return;
      const { sprite, crop } = appearance;
      const point = worldToScreen(burrow.x, burrow.y + burrow.height);
      const width = burrow.width * state.camera.zoom, height = width * crop.height / crop.width;
      drawStructureEffects("burrow", burrow, sprite, crop, point.x, point.y - height, width, height, false);
      if (burrow.health > 0) ctx.drawImage(sprite, crop.x, crop.y, crop.width, crop.height, point.x, point.y - height, width, height);
      drawStructureEffects("burrow", burrow, sprite, crop, point.x, point.y - height, width, height, true);
      const outline = objectOutlineColor("burrow", burrow);
      if (outline) {
        ctx.save(); ctx.strokeStyle = outline; ctx.lineWidth = selectionOutlineWidth;
        ctx.strokeRect(point.x, point.y - burrow.height * state.camera.zoom, width, burrow.height * state.camera.zoom);
        ctx.restore();
      }
    }

    function visibleAgents() {
      const view = agentView, camera = state.camera;
      if (view.time === state.simSeconds && view.agents === state.agents && view.rivals === state.rivals && view.visible === state.visible &&
          view.x === camera.x && view.y === camera.y && view.zoom === camera.zoom &&
          view.width === viewport.width && view.height === viewport.height) return view.units;
      Object.assign(view, { time: state.simSeconds, agents: state.agents, rivals: state.rivals, visible: state.visible,
        x: camera.x, y: camera.y, zoom: camera.zoom, width: viewport.width, height: viewport.height });
      const left = camera.x - viewport.width / camera.zoom / 2 - 6;
      const right = camera.x + viewport.width / camera.zoom / 2 + 6;
      const top = camera.y - viewport.height / camera.zoom / 2 - 6;
      const bottom = camera.y + viewport.height / camera.zoom / 2 + 6;
      view.units = [];
      for (const list of [state.agents, state.rivals]) for (const source of list) {
        const agent = displayedAgent(source), birth = agent.birth;
        const x = agent.renderFromX ?? agent.x, y = agent.renderFromY ?? agent.y;
        if (Math.max(agent.x, x, birth?.fromX ?? x) < left || Math.min(agent.x, x, birth?.fromX ?? x) > right ||
            Math.max(agent.y, y, birth?.fromY ?? y) < top || Math.min(agent.y, y, birth?.fromY ?? y) > bottom) continue;
        if (list === state.rivals) {
          if (!state.visible.has(source.y * WORLD_SIZE + source.x)) continue;
          const position = camera.zoom < 8 ? agent : agentBasePosition(agent);
          if (!state.visible.has(Math.floor(position.y + .5) * WORLD_SIZE + Math.floor(position.x + .5))) continue;
        }
        view.units.push(source);
      }
      return view.units;
    }

    function agentRenderCandidates() {
      const units = visibleAgents();
      if (state.camera.zoom < 8 || state.camera.zoom > 32 || units.length <= 256) return units;
      const groups = new Map(), result = [];
      for (const agent of units) {
        if (agent.birth || agent.combat || agent.health <= 0) { result.push(agent); continue; }
        const position = agentBasePosition(agent);
        const key = Math.floor(position.x + .5) + "," + Math.floor(position.y + .5) + ":" +
          (agent.ownerId ?? agent.faction) + ":" + (agent.species || "");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(agent);
      }
      for (const group of groups.values()) {
        if (group.length < 5) result.push(...group);
        else result.push(group.find(agent => state.selection?.target === agent) ||
          group.find(agent => state.hover?.target === agent) || group[0]);
      }
      return result;
    }

    function drawWorldObjects(now) {
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(viewport.width, viewport.height);
      const objects = [];
      const harvesters = foodHarvestStarts();
      const movementAgents = selectedMovementAgents();
      const movementVisible = state.selection?.kind === "agent" || movementAgents.length > 0;
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
        if (burrow.health <= 0 && structureEffectPlayback.effects.get("burrow:" + burrow.id + ":damage")?.type !== "destroy" ||
            burrow.x + burrow.width < topLeft.x || burrow.x > bottomRight.x ||
            burrow.y + burrow.height < topLeft.y || burrow.y - 1 > bottomRight.y) continue;
        let discovered = false;
        for (let y = burrow.y; y < burrow.y + burrow.height; y++) {
          for (let x = burrow.x; x < burrow.x + burrow.width; x++) {
            if (state.explored.has(y * WORLD_SIZE + x)) discovered = true;
          }
        }
        if (discovered) objects.push({ kind: "burrow", depth: burrow.y + burrow.height - 0.08, target: burrow });
      }
      for (const agent of agentRenderCandidates()) {
        if (agent.combat) continue;
        const position = interpolatedAgentPosition(agent);
        const birth = state.camera.zoom < 8 ? null : agentBirthPose(agent, true);
        const depth = position.y + 0.5 + AGENT_HEIGHT * 0.44;
        objects.push({ kind: "agent", depth, birth: !!birth, target: agent });
      }
      for (const food of resourceNodeCells()) {
        if (food.dropped) { drawDroppedResource(food); continue; }
        if (food.kind === "corpse" || food.resourceType === "tree" || Spawner.isTreeFood(food, worldMap) ||
          food.x < topLeft.x - 1 || food.x > bottomRight.x + 1 ||
          food.y < topLeft.y - 1 || food.y > bottomRight.y + 1 || !resourceNodePose(food).visible) continue;
        objects.push({ kind: "food", depth: food.y + 0.92, target: food });
      }
      objects.sort((first, second) => Number(!!first.birth) - Number(!!second.birth) || first.depth - second.depth);
      for (const object of objects) {
        if (object.kind === "tree") drawTree(object.target);
        else if (object.kind === "treeDetail") drawTreeDetail(object.target);
        else if (object.kind === "colony") drawColony(now, object.target);
        else if (object.kind === "agent") {
          if (!movementVisible) drawAgent(now, object.target);
        }
        else if (object.kind === "burrow") drawBurrow(object.target);
        else drawFoodSpot(now, object.target, harvesters.get(object.target.x + "," + object.target.y));
      }
      drawCorpses();
      if (movementVisible) {
        for (const agent of movementAgents) drawSelectedAgentMovement(agent);
        for (const object of objects) if (object.kind === "agent") drawAgent(now, object.target);
      }
    }

    function drawCombatAgents(now) {
      const agents = visibleAgents().filter(agent => agent.combat);
      agents.sort((first, second) => interpolatedAgentPosition(first).y - interpolatedAgentPosition(second).y);
      for (const agent of agents) drawAgent(now, agent);
    }

    function drawCombatDust() {
      if (state.camera.layer !== 0) return;
      for (const units of combatGroups().values()) {
        const combat = units[0].combat;
        const point = worldToScreen(combat.x + .5, combat.y + .5);
        const size = state.camera.zoom;
        ctx.save();
        for (let index = 0; index < 7; index++) {
          const phase = state.simSeconds * 3 + index * 2.4;
          ctx.fillStyle = "rgba(198,180,140,.22)";
          ctx.beginPath();
          ctx.ellipse(point.x + Math.sin(phase) * size * .25, point.y + Math.cos(phase * .7) * size * .13,
            size * (.09 + index % 3 * .025), size * .07, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (size >= 18) {
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          for (let side = 0; side < 2; side++) {
            const members = units.filter(agent => agent.combat.side === side);
            ctx.fillStyle = side ? "#f6ada3" : "#97e4d6";
            ctx.fillText(members.length + " · " + Math.ceil(members.reduce((sum, agent) => sum + agent.health, 0)), point.x, point.y + (side ? .57 : -.5) * size);
          }
        }
        ctx.restore();
      }
    }
    const travelTraceStyles = {
      bean: {
        width: 1.3, distantAlpha: 0.6, color: "#725437", edgeColor: "#d2ba85", edgeAlpha: 0.32, grainAlpha: 1.6,
        grains: ["#352b1d", "#b29a69"],
        layers: [
          { width: 1.8, alpha: 0.05, color: "#b59a69" },
          { width: 1.3, alpha: 0.4, color: "#30281b" },
          { width: 0.8, alpha: 0.16, color: "#80613e" }
        ]
      },
      pebble: {
        width: 1.15, distantAlpha: 0.68, color: "#252419", edgeColor: "#c7b28a", edgeAlpha: 0.38, furrow: true
      },
      spore: {
        width: 1.15, distantAlpha: 0.5, color: "#c8efad", edgeColor: "#203d30", edgeAlpha: 0.4, spores: true,
        layers: [{ width: 1.6, alpha: 0.025, color: "#294b35" }, { width: 0.8, alpha: 0.04, color: "#b7d99b" }]
      },
      spring: {
        width: 2.2, distantAlpha: 0.64, color: "#14342b", edgeColor: "#9dcbb9", edgeAlpha: 0.32, grainAlpha: 1.6, wet: true,
        grains: ["#cbeee0", "#68af98"],
        layers: [
          { width: 2.8, alpha: 0.045, color: "#a0c6b3" },
          { width: 2, alpha: 0.3, color: "#183a31" },
          { width: 1.35, alpha: 0.38, color: "#23483e" },
          { width: 0.65, alpha: 0.07, color: "#a9d9c7", offsetY: -0.015 }
        ]
      }
    };

    const travelTraceLayer = { canvas: null, footprints: null, worker: null, bitmap: null, pending: false, failed: false };

    function prepareTravelTraceWorker() {
      const layer = travelTraceLayer;
      if (layer.worker || layer.failed || typeof OffscreenCanvas === "undefined") return;
      const source = "let state, viewport, idleMotion, canvas; const AGENT_JUMP_PREPARATION = " + AGENT_JUMP_PREPARATION + ";\n" +
        "const travelTraceStyles = " + JSON.stringify(travelTraceStyles) + ";\n" +
        [clamp, hashNoise, worldToScreen, screenToWorld, drawTravelFurrow, drawTravelSpores, drawTravelTraces].map(fn => fn.toString()).join("\n") +
        "\nself.onmessage = event => { const data = event.data; state = data.state; viewport = data.viewport; idleMotion = data.idleMotion;" +
        "const width = Math.max(1, Math.round(viewport.width * viewport.pixelRatio)), height = Math.max(1, Math.round(viewport.height * viewport.pixelRatio));" +
        "if (!canvas) canvas = new OffscreenCanvas(width, height); if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }" +
        "const context = canvas.getContext('2d', {willReadFrequently:true}); context.setTransform(viewport.pixelRatio, 0, 0, viewport.pixelRatio, 0, 0);" +
        "context.clearRect(0, 0, viewport.width, viewport.height); drawTravelTraces(context); const image = canvas.transferToImageBitmap();" +
        "postMessage({image, camera:state.camera, time:state.simSeconds, viewport, roomId:data.roomId}, [image]); };";
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      try {
        layer.worker = new Worker(url);
        layer.worker.onmessage = event => {
          layer.pending = false;
          const result = event.data;
          if (result.roomId !== connection.roomId) { result.image.close(); return; }
          layer.bitmap?.image.close(); layer.bitmap = result;
        };
        layer.worker.onerror = () => { layer.worker.terminate(); layer.worker = null; layer.pending = false; layer.failed = true; layer.footprints = null; };
      } catch { layer.failed = true; }
      finally { URL.revokeObjectURL(url); }
    }

    function drawTravelTraceLayer() {
      if (!(viewport.width > 0 && viewport.height > 0)) return;
      const layer = travelTraceLayer, camera = state.camera, ratio = viewport.pixelRatio || 1;
      const time = Math.floor(state.simSeconds * 30);
      prepareTravelTraceWorker();
      if (layer.bitmap && layer.bitmap.roomId !== connection.roomId) { layer.bitmap.image.close(); layer.bitmap = null; }
      if (layer.worker) {
        if (!layer.pending && (layer.footprints !== state.footprints || layer.time !== time || layer.x !== camera.x || layer.y !== camera.y ||
            layer.zoom !== camera.zoom || layer.width !== viewport.width || layer.height !== viewport.height || layer.ratio !== ratio)) {
          Object.assign(layer, { footprints: state.footprints, time, x: camera.x, y: camera.y, zoom: camera.zoom,
            width: viewport.width, height: viewport.height, ratio, pending: true });
          const topLeft = screenToWorld(0, 0), bottomRight = screenToWorld(viewport.width, viewport.height);
          layer.worker.postMessage({ roomId: connection.roomId, viewport: { ...viewport, pixelRatio: ratio }, idleMotion: { matches: idleMotion.matches },
            state: { camera: { ...camera }, tribe: state.tribe, simSeconds: state.simSeconds, footprintLifetime: state.footprintLifetime,
              footprints: new Map([...state.footprints].filter(([, cell]) => cell.x >= topLeft.x - 1 && cell.x <= bottomRight.x + 1 &&
                cell.y >= topLeft.y - 1 && cell.y <= bottomRight.y + 1)) } });
        }
        if (layer.bitmap) {
          const cached = layer.bitmap, scale = camera.zoom / cached.camera.zoom;
          ctx.drawImage(cached.image, viewport.width / 2 + (cached.camera.x - camera.x) * camera.zoom - cached.viewport.width / 2 * scale,
            viewport.height / 2 + (cached.camera.y - camera.y) * camera.zoom - cached.viewport.height / 2 * scale,
            cached.viewport.width * scale, cached.viewport.height * scale);
        }
        return;
      }
      if (!layer.canvas) { layer.canvas = document.createElement("canvas"); layer.context = layer.canvas.getContext("2d"); }
      if (layer.footprints !== state.footprints || layer.time !== time || layer.x !== camera.x || layer.y !== camera.y ||
          layer.zoom !== camera.zoom || layer.width !== viewport.width || layer.height !== viewport.height || layer.ratio !== ratio) {
        Object.assign(layer, { footprints: state.footprints, time, x: camera.x, y: camera.y, zoom: camera.zoom,
          width: viewport.width, height: viewport.height, ratio });
        const width = Math.round(viewport.width * ratio), height = Math.round(viewport.height * ratio);
        if (layer.canvas.width !== width || layer.canvas.height !== height) { layer.canvas.width = width; layer.canvas.height = height; }
        layer.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        layer.context.clearRect(0, 0, viewport.width, viewport.height);
        drawTravelTraces(layer.context, true);
      }
      ctx.drawImage(layer.canvas, 0, 0, viewport.width, viewport.height);
      drawTravelTraces(undefined, false);
    }

    function drawTravelFurrow(mark, from, to, width, curl, fade, context) {
      const target = context || ctx;
      const cell = state.camera.zoom;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const dx = (to.x - from.x) / length, dy = (to.y - from.y) / length;
      for (const [layerIndex, layer] of [
        { width: 1.7, alpha: 0.12, color: "#c7b28a" },
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
        target.globalAlpha = fade * layer.alpha;
        target.fillStyle = layer.color;
        target.beginPath();
        target.moveTo(left[0].x, left[0].y);
        for (let index = 1; index < left.length; index += 1) target.lineTo(left[index].x, left[index].y);
        const tip = width * layer.width * 0.5;
        target.quadraticCurveTo(to.x + dx * tip, to.y + dy * tip, right[12].x, right[12].y);
        for (let index = right.length - 2; index >= 0; index -= 1) target.lineTo(right[index].x, right[index].y);
        target.quadraticCurveTo(from.x - dx * tip, from.y - dy * tip, left[0].x, left[0].y);
        target.closePath();
        target.fill();
      }
      for (let index = 0; index < 20; index += 1) {
        const progress = hashNoise(mark.seed, index + 250);
        const side = (hashNoise(mark.seed, index + 280) - 0.5) * width * 2.2 +
          2 * progress * (1 - progress) * curl;
        const x = from.x + (to.x - from.x) * progress - dy * side;
        const y = from.y + (to.y - from.y) * progress + dx * side;
        const size = cell * (0.009 + hashNoise(mark.seed, index + 310) * 0.024);
        target.save();
        target.translate(x, y);
        target.rotate(hashNoise(mark.seed, index + 340) * Math.PI);
        target.globalAlpha = fade * (0.1 + hashNoise(mark.seed, index + 370) * 0.18);
        target.fillStyle = index % 3 ? "#685438" : "#232317";
        target.beginPath();
        target.moveTo(-size, -size * 0.3);
        target.lineTo(size * 0.1, -size * 0.65);
        target.lineTo(size * 0.8, size * 0.2);
        target.lineTo(-size * 0.25, size * 0.55);
        target.closePath();
        target.fill();
        target.restore();
      }
    }

    function drawTravelSpores(mark, from, to, width, curl, age, fade, context) {
      const target = context || ctx;
      const cell = state.camera.zoom;
      const settled = clamp(age / 1.1, 0, 1);
      const spread = 1 - (1 - settled) ** 2;
      const count = cell < 8 ? 3 : 12;
      target.save();
      target.globalCompositeOperation = "screen";
      for (let index = 0; index < count; index += 1) {
        const progress = hashNoise(mark.seed, index + 20);
        const side = (hashNoise(mark.seed, index + 40) - 0.5) * width * (1 + spread * 2.6) +
          2 * progress * (1 - progress) * curl;
        const lift = cell * (0.04 + hashNoise(mark.seed, index + 60) * 0.08) * (1 - settled);
        const x = from.x + (to.x - from.x) * progress - mark.dy * side;
        const y = from.y + (to.y - from.y) * progress + mark.dx * side - lift;
        const radius = Math.max(0.6, cell * (0.011 + hashNoise(mark.seed, index + 80) * 0.018));
        const opacity = fade * (0.45 + hashNoise(mark.seed, index + 100) * 0.35) * (0.65 + settled * 0.35);
        const glow = target.createRadialGradient(x, y, 0, x, y, radius * 5.5);
        glow.addColorStop(0, "rgba(167,243,185,0.8)");
        glow.addColorStop(0.3, "rgba(130,224,169,0.35)");
        glow.addColorStop(1, "rgba(104,210,156,0)");
        target.fillStyle = glow;
        target.globalAlpha = opacity * 0.85;
        target.beginPath();
        target.ellipse(x, y, radius * 5.5, radius * 4, 0, 0, Math.PI * 2);
        target.fill();
        target.fillStyle = index % 4 ? "#efffd3" : "#a4ead4";
        target.globalAlpha = opacity;
        target.beginPath();
        target.ellipse(x, y, radius, radius * 0.65, 0, 0, Math.PI * 2);
        target.fill();
      }
      target.restore();
    }

    function drawTravelTraces(context, settledOnly) {
      const target = context || ctx;
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(viewport.width, viewport.height);
      const cell = state.camera.zoom;
      const groundPoint = (x, y) => worldToScreen(
        x + 0.5 + (hashNoise(x * 29, y * 37) - 0.5) * 0.12,
        y + 0.5 + (hashNoise(x * 43, y * 19) - 0.5) * 0.12);
      target.save();
      target.lineCap = "round";
      target.lineJoin = "round";
      for (const footprint of state.footprints.values()) {
        if (footprint.x < topLeft.x - 1 || footprint.x > bottomRight.x + 1 ||
          footprint.y < topLeft.y - 1 || footprint.y > bottomRight.y + 1) continue;
        const traffic = clamp(Math.log2(Math.max(1, footprint.visits || 1)) / 5, 0, 1);
        const to = groundPoint(footprint.x, footprint.y);
        for (const mark of footprint.marks) {
          const age = state.simSeconds - mark.at;
          const startedAt = Number.isFinite(mark.startedAt) ? mark.startedAt : mark.at;
          let progress = mark.at > startedAt ? clamp((state.simSeconds - startedAt) / (mark.at - startedAt), 0, 1) : age < 0 ? 0 : 1;
          if (mark.grounded === false) {
            const travel = idleMotion.matches ? progress : clamp((progress - AGENT_JUMP_PREPARATION) / (1 - AGENT_JUMP_PREPARATION), 0, 1);
            progress = travel * travel * (3 - 2 * travel);
          }
          if (progress <= 0 || !(state.footprintLifetime > 0) || age >= state.footprintLifetime) continue;
          const settled = progress >= 1 && age >= 1.1;
          if (settledOnly === true && !settled || settledOnly === false && settled) continue;
          if (typeof settledOnly === "number" && mark.at + 1.1 <= settledOnly) continue;
          const style = travelTraceStyles[mark.tribe || state.tribe] || travelTraceStyles.bean;
          const fade = clamp((state.simSeconds - startedAt) / 0.1, 0, 1) * (1 - Math.max(0, age) / state.footprintLifetime) * (0.65 + traffic * 0.35);
          const from = groundPoint(footprint.x - mark.dx, footprint.y - mark.dy);
          const curl = (hashNoise(mark.seed, 1) - 0.5) * cell * 0.12;
          const width = cell * (0.12 + hashNoise(mark.seed, 2) * 0.06) * style.width * (1 + traffic * 0.5);
          target.save();
          try {
            if (progress < 1) {
              const length = Math.hypot(to.x - from.x, to.y - from.y);
              const dx = (to.x - from.x) / length, dy = (to.y - from.y) / length;
              const edgeX = from.x + (to.x - from.x) * progress, edgeY = from.y + (to.y - from.y) * progress;
              const reach = Math.max(viewport.width, viewport.height) + cell * 2;
              target.beginPath();
              target.moveTo(edgeX + dy * reach, edgeY - dx * reach);
              target.lineTo(edgeX - dy * reach, edgeY + dx * reach);
              target.lineTo(edgeX - dy * reach - dx * reach * 2, edgeY + dx * reach - dy * reach * 2);
              target.lineTo(edgeX + dy * reach - dx * reach * 2, edgeY - dx * reach - dy * reach * 2);
              target.closePath();
              target.clip();
            }
            const controlX = (from.x + to.x) / 2 - mark.dy * curl;
            const controlY = (from.y + to.y) / 2 + mark.dx * curl;
            if (cell < 8) {
              target.globalAlpha = fade * style.edgeAlpha;
              target.strokeStyle = style.edgeColor;
              target.lineWidth = Math.max(1.2, width * 1.8);
              target.beginPath();
              target.moveTo(from.x, from.y);
              target.quadraticCurveTo(controlX, controlY, to.x, to.y);
              target.stroke();
              target.globalAlpha = fade * style.distantAlpha;
              target.strokeStyle = style.color;
              target.lineWidth = Math.max(0.65, width);
              target.beginPath();
              target.moveTo(from.x, from.y);
              target.quadraticCurveTo(controlX, controlY, to.x, to.y);
              target.stroke();
              if (style.spores) drawTravelSpores(mark, from, to, width, curl, age, fade, target);
              continue;
            }
            if (style.furrow) {
              drawTravelFurrow(mark, from, to, width, curl, fade, target);
              continue;
            }
            for (const layer of cell < 8 ? [] : style.layers) {
              const offsetX = cell * (layer.offsetX || 0), offsetY = cell * (layer.offsetY || 0);
              target.globalAlpha = fade * layer.alpha;
              target.strokeStyle = layer.color;
              target.lineWidth = width * layer.width;
              target.beginPath();
              target.moveTo(from.x + offsetX, from.y + offsetY);
              target.quadraticCurveTo(controlX + offsetX, controlY + offsetY, to.x + offsetX, to.y + offsetY);
              target.stroke();
            }
            if (style.spores) {
              drawTravelSpores(mark, from, to, width, curl, age, fade, target);
              continue;
            }
            for (let index = 0; index < 12; index += 1) {
              const progress = hashNoise(mark.seed, index + 20);
              const side = (hashNoise(mark.seed, index + 40) - 0.5) * width * 1.9 + Math.sin(progress * Math.PI) * curl;
              const x = from.x + (to.x - from.x) * progress - mark.dy * side;
              const y = from.y + (to.y - from.y) * progress + mark.dx * side;
              const length = cell * (0.025 + hashNoise(mark.seed, index + 60) * 0.075);
              const breadth = width * (0.08 + hashNoise(mark.seed, index + 80) * 0.24);
              target.save();
              target.translate(x, y);
              target.rotate(Math.atan2(mark.dy, mark.dx) + (hashNoise(mark.seed, index + 100) - 0.5) * 0.6);
              target.globalAlpha = fade * (0.04 + hashNoise(mark.seed, index + 120) * 0.06) * style.grainAlpha;
              target.fillStyle = style.grains[index % 3 ? 1 : 0];
              target.beginPath();
              if (style.wet) {
                target.ellipse(0, 0, length * 1.1, breadth * 0.5, 0, 0, Math.PI * 2);
              } else {
                target.moveTo(-length * 0.6, -breadth * 0.3);
                target.lineTo(length * 0.2, -breadth * 0.6);
                target.lineTo(length * 0.55, breadth * 0.15);
                target.lineTo(-length * 0.15, breadth * 0.5);
                target.closePath();
              }
              target.fill();
              if (style.wet && index % 3 === 0) {
                target.globalAlpha = fade * 0.16;
                target.strokeStyle = "#b8e2d6";
                target.lineWidth = Math.max(0.4, cell * 0.006);
                target.beginPath();
                target.ellipse(0, 0, length * 1.1, breadth * 0.65, 0, Math.PI * 1.1, Math.PI * 1.8);
                target.stroke();
              }
              target.restore();
            }
          } finally {
            target.restore();
          }
        }
      }
      target.restore();
    }
    function isSelectedObject(kind, target) {
      return state.selection !== null &&
        state.selection.kind === kind && state.selection.target === target;
    }

    function objectOutlineColor(kind, target) {
      if (isSelectedObject(kind, target)) return selectionColor;
      return state.hover?.kind === kind && state.hover.target === target ? hoverColor : null;
    }

    function agentById(id) {
      return state.agents.find(agent => agent.id === id) || state.rivals.find(agent => agent.id === id);
    }

    function isAgentSelectable(agent) {
      if (!agent || agent.health <= 0 || agent.hidden) return false;
      if (state.agents.includes(agent)) return true;
      if (!state.rivals.includes(agent) || !state.visible.has(agent.y * WORLD_SIZE + agent.x)) return false;
      const position = state.camera.zoom < 8 ? agent : agentBasePosition(agent);
      return state.visible.has(Math.floor(position.y + .5) * WORLD_SIZE + Math.floor(position.x + .5));
    }

    function selectObject(kind, target) {
      state.selection = target ? { kind, target } : null;
      if (kind !== "colony" || target?.id !== connection.colonyId) colonyMenu.hidden = true;
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
      scrollSelectedObject();
    }

    function scrollSelectedObject() {
      const selection = state.selection;
      if (!selection || objectPanel.hidden) return;
      let item = null;
      if (selection.kind === "colony") {
        const query = colonySearch.value.trim().toLocaleLowerCase();
        const matches = colonyEntries.filter(entry => entry.name.toLocaleLowerCase().includes(query) || String(entry.id).includes(query));
        let index = matches.indexOf(selection.target);
        if (index < 0) {
          index = colonyEntries.indexOf(selection.target);
          if (index < 0) return;
          colonySearch.value = "";
        }
        colonyListPage = Math.floor(index / 50);
        renderColonyList();
        item = colonyList.querySelector('[aria-current="true"]');
      } else if (selection.kind === "agent" || selection.kind === "corpse") {
        item = agentList.querySelector(".is-selected");
      }
      if (!item) return;
      const bounds = item.getBoundingClientRect();
      const panel = objectPanel.getBoundingClientRect();
      if (bounds.top < panel.top) objectPanel.scrollTop += bounds.top - panel.top;
      else if (bounds.bottom > panel.bottom) objectPanel.scrollTop += bounds.bottom - panel.bottom;
    }

    function updateSelection() {
      const selection = state.selection;
      if (!selection) return;
      const exists = selection.kind === "terrain" ? !!selectionTerrainCell() :
        selection.kind === "agent" ? isAgentSelectable(selection.target) :
        selection.kind === "colony" ? colonyEntries.includes(selection.target) :
        selection.kind === "tree" ? forest.cells.get(selection.target.column + "," + selection.target.row) === selection.target :
        selection.kind === "hazard" ? hazardCells[selection.target.row * WORLD_SIZE + selection.target.column] === selection.target :
        selection.kind === "burrow" ?
          worldMap.burrows.includes(selection.target) && selection.target.health > 0 :
        selection.kind === "corpse" ? state.corpses.some(corpse => corpse.id === selection.target.id) : selection.target.amount > 0;
      if (!exists) {
        selectObject(null, null);
        if (selection.kind !== "corpse") closeColonyMenu();
      }
    }

    function createColonyAppearance(spriteSource) {
      const sprite = new Image();
      sprite.src = spriteSource;
      const animation = { sheet: sprite, frameSize: 512, columns: 4, frameCount: 16, periodMs: 3960,
        order: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],
        durationsMs: [231,175,124,105,96,89,86,84,84,86,89,96,105,124,175,462,175,124,105,96,89,86,84,84,86,89,96,105,124,175,231] };
      return { sprite, animation, scale: 1 };
    }

    function colonyInactive(entry) {
      return entry.nestHealth === 0 || !!state.ending && entry.id === connection.colonyId;
    }

    function colonyAppearance(entry) {
      const level = entry.id === connection.colonyId ? state.nestLevel : entry.nestLevel;
      const grown = nestGrowthRendering.get(entry.tribe || "bean");
      if (grown?.levels[level]) return grown.levels[level];
      if (level >= 2 && grown) return grown.appearance;
      if (entry.tribe && entry.tribe !== "bean") return tribeColonies.get(entry.tribe) || colonyAppearances[0];
      return colonyAppearances[Math.min(colonyAppearances.length, Math.max(1, level ?? 1)) - 1];
    }

    function colonyAppearanceBounds(appearance) {
      const animation = appearance.animation;
      const sprite = animation.sheet || appearance.sprite;
      const bounds = tribeArt.bounds(sprite, animation.sheet ? animation.frameSize : false);
      const size = animation.sheet ? animation.frameSize : sprite.naturalWidth;
      const placement = animation.placement;
      return { width: bounds.width / size * (placement?.width || 1),
        top: (placement?.y || 0) + bounds.y / size * (placement?.height || 1),
        bottom: (placement?.y || 0) + (bounds.y + bounds.height) / size * (placement?.height || 1) };
    }

    function fitColonyAppearance(appearance, reference) {
      const bounds = colonyAppearanceBounds(appearance);
      const target = colonyAppearanceBounds(reference);
      const offset = reference.scale * (target.bottom - reference.centerY);
      appearance.scale = reference.scale * target.width / bounds.width;
      appearance.centerY = bounds.bottom - offset / appearance.scale;
      appearance.groundWidth = bounds.width;
      appearance.top = bounds.top;
    }

    function colonyGrowthPlacement(sheet, animation, previous, appearance) {
      const frameSize = animation.frameSize;
      const first = tribeArt.bounds(sheet, frameSize);
      const frame = animation.frameCount - 1;
      const surface = document.createElement("canvas");
      surface.width = surface.height = frameSize;
      surface.getContext("2d").drawImage(sheet, frame % animation.columns * frameSize,
        Math.floor(frame / animation.columns) * frameSize, frameSize, frameSize, 0, 0, frameSize, frameSize);
      const last = tribeArt.bounds(surface, false);
      const start = colonyAppearanceBounds(previous), finish = colonyAppearanceBounds(appearance);
      return { fromScale: previous.scale * start.width / (first.width / frameSize),
        toScale: appearance.scale * finish.width / (last.width / frameSize),
        fromBottom: (first.y + first.height) / frameSize, toBottom: (last.y + last.height) / frameSize,
        fromOffset: previous.scale * (start.bottom - previous.centerY),
        toOffset: appearance.scale * (finish.bottom - appearance.centerY) };
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
      const contour = new Path2D();
      contour.addPath(entry.contour, ctx.getTransform());
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.lineWidth = selectionOutlineWidth * viewport.pixelRatio;
      ctx.stroke(contour);
      ctx.restore();
    }

    function selectionContour(sprite, frame) {
      const key = frame ? frame.owner : sprite;
      const sourceWidth = frame ? frame.size : sprite.naturalWidth || sprite.width;
      const sourceHeight = frame ? frame.size : sprite.naturalHeight || sprite.height;
      const scale = Math.min(1, 512 / Math.max(sourceWidth, sourceHeight));
      const sizeX = Math.max(1, Math.ceil(sourceWidth * scale));
      const sizeY = Math.max(1, Math.ceil(sourceHeight * scale));
      const index = frame ? frame.index : -1;
      let entry = selectionOutlines.get(key);
      if (!entry || entry.canvas.width !== sizeX || entry.canvas.height !== sizeY) {
        const outline = document.createElement("canvas");
        outline.width = sizeX;
        outline.height = sizeY;
        entry = { canvas: outline, context: outline.getContext("2d", { willReadFrequently: true }), index: null, contours: new Map() };
        selectionOutlines.set(key, entry);
      }
      if (!entry.contours.has(index)) {
        const context = entry.context;
        context.clearRect(0, 0, sizeX, sizeY);
        if (frame) context.drawImage(sprite, frame.x, frame.y, frame.size, frame.size, 0, 0, sizeX, sizeY);
        else context.drawImage(sprite, 0, 0, sizeX, sizeY);
        entry.contours.set(index, createSelectionContour(entry.canvas));
      }
      entry.contour = entry.contours.get(index);
      entry.index = index;
      return entry;
    }

    function createSelectionContour(sprite) {
      return Spawner.createSpriteContour(sprite);
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

    function drawIdleSprite(sprite, animation, now, offset, x, y, width, height, outlineColor, poseIndex, colony) {
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
        const index = poseIndex ?? (animation === colonyAppearances[0].animation && (idleMotion.matches || width < 24) ? 0 : idleFrameIndex(animation, now, offset));
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
      if (colony) drawStructureEffects("colony", colony, sprite, frame, x, y, width, height, false);
      if (frame) ctx.drawImage(sprite, frame.x, frame.y, frame.size, frame.size, x, y, width, height);
      else ctx.drawImage(sprite, x, y, width, height);
      if (colony) drawStructureEffects("colony", colony, sprite, frame, x, y, width, height, true);
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

    function foodHarvestStarts() {
      const harvesters = new Map();
      for (const agent of visibleAgents()) {
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
      if (cell.dropped) return { frame: 0, progress: 0, phase: "idle", opacity: cell.amount > 0 ? 1 : 0,
        remaining: Math.max(0, cell.amount), visible: cell.amount > 0 };
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
        (harvestDisplay.cells.get(cell.x + "," + cell.y) || []).filter(agent =>
          !agent.harvestResourceKey || agent.harvestResourceKey === key), state.simSeconds,
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

    function createGroundShadow() {
      const surface = document.createElement("canvas");
      surface.width = 96;
      surface.height = 32;
      const context = surface.getContext("2d");
      context.translate(48, 16);
      context.scale(48, 16);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, "rgba(3, 8, 4, 1)");
      gradient.addColorStop(.4, "rgba(3, 8, 4, 1)");
      gradient.addColorStop(.7, "rgba(3, 8, 4, .75)");
      gradient.addColorStop(1, "rgba(3, 8, 4, 0)");
      context.fillStyle = gradient;
      context.fillRect(-1, -1, 2, 2);
      return surface;
    }

    function drawGroundShadow(x, y, radiusX, radiusY, opacity) {
      if (state.camera.zoom < 8 || opacity <= 0 || x + radiusX < 0 || x - radiusX > viewport.width ||
          y + radiusY < 0 || y - radiusY > viewport.height) return;
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * opacity;
      ctx.drawImage(groundShadow, x - radiusX, y - radiusY, radiusX * 2, radiusY * 2);
      ctx.globalAlpha = alpha;
    }

    function drawDroppedResource(cell) {
      const sprite = resourceCarrySprites.get(cell.resourceType), crop = resourceCarryBounds.get(cell.resourceType);
      if (!(cell.amount > 0) || !sprite?.complete || !sprite.naturalWidth || !crop) return;
      const point = worldToScreen(cell.x + .5, cell.y + .8);
      const scale = state.camera.zoom * .24 / Math.max(crop.width, crop.height);
      const width = sprite.naturalWidth * scale, height = sprite.naturalHeight * scale;
      const outline = objectOutlineColor("food", cell);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      for (let index = 0; index < Math.min(5, Math.ceil(cell.amount)); index++) {
        const x = point.x + (index % 3 - 1) * state.camera.zoom * .12;
        const y = point.y - Math.floor(index / 3) * state.camera.zoom * .08;
        const left = x - (crop.x + crop.width / 2) * scale;
        const top = y - (crop.y + crop.height) * scale;
        drawGroundShadow(x, y, crop.width * scale * .45, state.camera.zoom * .025, .25);
        ctx.drawImage(sprite, left, top, width, height);
        if (outline) drawSelectionOutline(sprite, left, top, width, height, null, outline);
      }
      ctx.restore();
    }

    function drawResourceNode(now, cell, harvestStarted, placement) {
      if (cell.dropped) { drawDroppedResource(cell); return; }
      const type = Spawner.resourceTypeForCell(cell, worldMap);
      const animation = resourceHarvestSprites.get(type);
      const pose = resourceNodePose(cell);
      const sprite = animation?.frames.get(pose.frame) || animation?.sprite || resourceSprites.get(type);
      if (!pose.visible || !sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) return;
      const point = worldToScreen(cell.x, cell.y);
      const frameWidth = animation?.frameSize || sprite.naturalWidth;
      const frameHeight = animation?.frameSize || sprite.naturalHeight;
      const bounds = Spawner.resourceImageBounds(animation?.image || Spawner.resourceDefinition(type).image);
      const layout = Spawner.resourceNodePlacement(type, bounds, frameWidth, frameHeight, state.camera.zoom);
      if (placement && animation) {
        layout.scale = Math.min(layout.scale, placement.size / animation.viewSize);
        layout.width = frameWidth * layout.scale;
        layout.height = frameHeight * layout.scale;
        layout.x = clamp(placement.point.x - point.x - animation.pivotX * layout.scale,
          state.camera.zoom * .04 - bounds.x * layout.scale,
          state.camera.zoom * .96 - (bounds.x + bounds.width) * layout.scale);
        layout.y = clamp(placement.point.y - point.y - animation.pivotY * layout.scale,
          state.camera.zoom * .04 - bounds.y * layout.scale,
          state.camera.zoom * .96 - (bounds.y + bounds.height) * layout.scale);
      }
      const sourceX = animation && sprite === animation.sprite ? pose.frame % animation.columns * animation.frameSize : 0;
      const sourceY = animation && sprite === animation.sprite ? Math.floor(pose.frame / animation.columns) * animation.frameSize : 0;
      const { x, y, width, height } = layout;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = pose.opacity;
      if (cell.kind === "corpse" && Number.isFinite(cell.decaysAt)) {
        const decay = clamp((state.simSeconds - cell.diedAt) / (cell.decaysAt - cell.diedAt), 0, 1);
        ctx.globalAlpha *= 1 - decay * 0.4;
        ctx.filter = "saturate(" + (1 - decay * 0.8) + ")";
      }
      const contact = resourceGroundContacts[type];
      if (cell.kind !== "corpse") drawGroundShadow(point.x + x + (bounds.x + bounds.width * contact.x) * layout.scale,
        point.y + y + (bounds.y + bounds.height * contact.y) * layout.scale,
        bounds.width * contact.width * layout.scale / 2,
        Math.max(bounds.width, bounds.height) * contact.depth * layout.scale, contact.opacity);
      ctx.translate(point.x, point.y);
      const outline = objectOutlineColor(cell.kind === "corpse" ? "corpse" : "food", cell);
      ctx.drawImage(sprite, sourceX, sourceY, animation?.frameSize || sprite.naturalWidth,
        animation?.frameSize || sprite.naturalHeight, x, y, width, height);
      if (outline) drawSelectionOutline(sprite, x, y, width, height,
        animation ? { owner: animation, size: animation.frameSize, index: pose.frame, x: sourceX, y: sourceY } : null, outline);
      ctx.restore();
    }

    function drawFoodSpot(now, foodCell, harvestStarted) {
      if (Spawner.resourceDefinition(Spawner.resourceTypeForCell(foodCell, worldMap))) drawResourceNode(now, foodCell, harvestStarted);
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
      const label = [definition.name + (definition.harvestLocked ? "" : " · " + Number(Math.max(0, food.amount).toFixed(1)) + "개"),
        definition.harvestLocked ? "채집 잠금" : required === null ? "채집 불가" : requirement ? "필요: " + requirement : "속성 없이 채집 가능"];
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

    function colonyGrowthRendering(entry) {
      const rendering = nestGrowthRendering.get(entry.tribe || "bean");
      return rendering?.upgrades[entry.nestLevel] || rendering;
    }

    function drawColonyGrowth(entry) {
      if (colonyInactive(entry)) return false;
      const frame = Spawner.nestGrowthFrame(nestGrowthPlayback, entry, state.simSeconds, idleMotion.matches);
      const rendering = colonyGrowthRendering(entry);
      if (frame === null || !rendering?.animation.sheet.complete) return false;
      const appearance = rendering.appearance;
      const progress = frame / Math.max(1, rendering.animation.frameCount - 1);
      const placement = rendering.placement;
      const scale = placement ? placement.fromScale + (placement.toScale - placement.fromScale) * progress : appearance.scale;
      const bottom = placement ? placement.fromBottom + (placement.toBottom - placement.fromBottom) * progress : .875;
      const offset = placement ? placement.fromOffset + (placement.toOffset - placement.fromOffset) * progress :
        appearance.scale * (.875 - appearance.centerY);
      const size = COLONY_SIZE * state.camera.zoom * scale;
      const center = worldToScreen(entry.x + 2.5, entry.y + 2.5);
      const y = center.y + COLONY_SIZE * state.camera.zoom * offset - size * bottom;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const frameSize = rendering.animation.frameSize;
      const region = { x: frame % rendering.animation.columns * frameSize,
        y: Math.floor(frame / rendering.animation.columns) * frameSize, size: frameSize };
      drawStructureEffects("colony", entry, rendering.animation.sheet, region,
        center.x - size / 2, y, size, size, false);
      ctx.drawImage(rendering.animation.sheet, frame % rendering.animation.columns * frameSize,
        Math.floor(frame / rendering.animation.columns) * frameSize, frameSize, frameSize,
        center.x - size / 2, y, size, size);
      drawStructureEffects("colony", entry, rendering.animation.sheet, region,
        center.x - size / 2, y, size, size, true);
      ctx.restore();
      return true;
    }

    function drawColony(now, entry) {
      const point = worldToScreen(entry.x, entry.y), margin = COLONY_SIZE * state.camera.zoom * 3;
      if (point.x + margin < 0 || point.y + margin < 0 || point.x - margin > viewport.width || point.y - margin > viewport.height) return;
      if (drawColonyGrowth(entry)) return;
      const cell = state.camera.zoom;
      const size = COLONY_SIZE * cell;
      const appearance = colonyAppearance(entry);
      const destroyed = colonyInactive(entry);
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
          if (agent.tribe === "pebble" || agent.tribe === "spore") { receive = 0; continue; }
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
        if (pebbleBirth) {
          drawStructureEffects("colony", entry, sprite, null, spriteX, spriteY, spriteSize, spriteSize, false);
          ctx.drawImage(sprite, spriteX, spriteY, spriteSize, spriteSize);
          drawStructureEffects("colony", entry, sprite, null, spriteX, spriteY, spriteSize, spriteSize, true);
        }
        else drawIdleSprite(sprite, appearance.animation, now, 0, spriteX, spriteY, spriteSize, spriteSize, false,
          Spawner.nestIdleFrame(nestGrowthPlayback, entry, state.simSeconds, idleMotion.matches || destroyed), entry);
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

    function drawStructureEffects(kind, structure, sprite, frame, x, y, width, height, foreground) {
      if (!structureEffectPlayback.effects.size || state.camera.zoom < 8) return;
      const key = kind + ":" + structure.id;
      const time = corpsePlaybackTime();
      let visible = kind === "colony" && structure.id === connection.colonyId;
      const columns = kind === "colony" ? COLONY_SIZE : structure.width;
      const rows = kind === "colony" ? COLONY_SIZE : structure.height;
      for (let row = structure.y; !visible && row < structure.y + rows; row++) {
        for (let column = structure.x; column < structure.x + columns; column++) {
          if (state.visible.has(row * WORLD_SIZE + column)) { visible = true; break; }
        }
      }
      if (!visible) return;
      for (const suffix of [":complete", ":damage"]) {
        const effect = structureEffectPlayback.effects.get(key + suffix);
        if (!effect) continue;
        const pose = Spawner.structureEffectPose(effect, time, idleMotion.matches);
        structureEffectRendering.draw(ctx, agentLevelUpSprites, pose, sprite, frame, x, y, width, height, foreground);
      }
    }

    const audio = globalThis.SpawnerAudio.create();
    const combatAudio = globalThis.SpawnerCombatAudio.create();
    const movementAudio = globalThis.SpawnerMovementAudio.create();
    const agentAudio = new Map();
    const deliveryAudio = new Map();
    let audioTime = null;

    function resetAudio() {
      audio.stop();
      globalThis.SpawnerCombatAudio.reset(combatAudio);
      globalThis.SpawnerMovementAudio?.reset(movementAudio);
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
      return 1 - Math.max(horizontal, vertical) * 0.8;
    }

    function updateAudio() {
      if (state.ending || !connection.active || !connection.online || !audio.available()) {
        if (audioTime != null) resetAudio();
        return;
      }
      const time = state.simSeconds;
      if (audioTime != null && (time < audioTime || time - audioTime > 0.5)) resetAudio();
      for (const event of Spawner.nestGrowthSounds(nestGrowthPlayback, time)) {
        audio.play(event.name, audioVolume(event.colony.x + 2.5, event.colony.y + 2.5));
      }
      const firstFrame = audioTime == null;
      const audible = [...state.agents, ...state.rivals].filter(agent =>
        audioVolume(agent.x + .5, agent.y + .5) > 0 || agent.moveDuration > 0 && audioVolume(agent.renderFromX + .5, agent.renderFromY + .5) > 0);
      for (const event of globalThis.SpawnerCombatAudio.update(combatAudio,
        audible.map(displayedAgent), (state.corpses || []).filter(corpse => audioVolume(corpse.x + .5, corpse.y + .5) > 0), time)) {
        const unit = event.unit;
        const position = unit.kind === "corpse" ? { x: unit.renderX ?? unit.x, y: unit.renderY ?? unit.y } :
          interpolatedAgentPosition(unit);
        audio.play(event.name, audioVolume(position.x + .5, position.y + .5));
      }
      for (const event of globalThis.SpawnerMovementAudio?.update(movementAudio,
        audible.map(displayedAgent), time, Spawner) || []) {
        const position = interpolatedAgentPosition(event.unit);
        audio.play(event.name, audioVolume(position.x + .5, position.y + .5));
      }
      const agents = new Set();
      const harvesting = new Map();
      for (const source of audible) {
        const agent = displayedAgent(source);
        if (agent.species || agent.health <= 0) continue;
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
          if (birth.kind === "spore" || birth.kind === "spring") {
            const animation = birth.kind === "spore" ? Spawner.SPORE_BIRTH_ANIMATION : SPRING_BIRTH_ANIMATION;
            const sameBirth = previous?.birthStartedAt === agent.birth.startedAt;
            const played = sameBirth && previous.birthSoundPlayed;
            const due = birth.elapsed >= animation.audioAt &&
              (sameBirth ? previous.elapsed < animation.audioAt : birth.elapsed < animation.audioAt + .2);
            if (!firstFrame && !played && due) {
              const entry = birth.kind === "spring" ?
                colonyEntries.find(colony => colony.id === agent.birth.colonyId) : null;
              const outlet = entry ? colonyBirthOutlet(entry) : null;
              audio.play(birth.kind + "-birth", outlet ? audioVolume(outlet.x, outlet.y) : volume);
            }
            agentAudio.set(agent.id, { birthStartedAt: agent.birth.startedAt, elapsed: birth.elapsed, birthSoundPlayed: played || due });
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
          const entry = deliveryNest(delivery);
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
      const units = visibleAgents();
      const layout = agentCombatLayout;
      if (layout.time !== state.simSeconds || layout.agents !== state.agents || layout.rivals !== state.rivals || layout.view !== units) {
        layout.view = units; layout.time = state.simSeconds; layout.agents = state.agents; layout.rivals = state.rivals;
        layout.placements = Spawner.combatLayout(units.map(displayedAgent));
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
      const units = visibleAgents();
      const layout = agentDisplayLayout;
      if (layout.time !== state.simSeconds || layout.agents !== state.agents || layout.rivals !== state.rivals || layout.view !== units) {
        layout.view = units; layout.time = state.simSeconds;
        layout.agents = state.agents;
        layout.rivals = state.rivals;
        layout.positions.clear(); layout.cells.clear();
        for (const other of units) {
          if (other.health <= 0) continue;
          const entry = { id: String(other.id), position: agentBasePosition(other) };
          layout.positions.set(entry.id, entry);
          const key = Math.floor(entry.position.x / AGENT_HEIGHT) + "," + Math.floor(entry.position.y / AGENT_HEIGHT);
          if (!layout.cells.has(key)) layout.cells.set(key, []);
          layout.cells.get(key).push(entry);
        }
        layout.offsets.clear();
      }
      const id = String(agent.id);
      if (layout.offsets.has(id)) return layout.offsets.get(id);
      const delivery = agentDeliveryOffset(agent);
      const current = layout.positions.get(id);
      let crowding = 0;
      const nearby = [];
      if (current) {
        const column = Math.floor(current.position.x / AGENT_HEIGHT), row = Math.floor(current.position.y / AGENT_HEIGHT);
        for (let y = row - 1; y <= row + 1; y++) for (let x = column - 1; x <= column + 1; x++) {
          const entries = layout.cells.get(x + "," + y);
          if (entries) nearby.push(...entries);
        }
      }
      for (const other of nearby) {
        if (other.id === id) continue;
        const dx = other.position.x - current.position.x, dy = other.position.y - current.position.y;
        if (Math.abs(dx) >= AGENT_HEIGHT || Math.abs(dy) >= AGENT_HEIGHT) continue;
        crowding = Math.max(crowding, clamp(1 - Math.hypot(dx, dy) / AGENT_HEIGHT, 0, 1));
        if (crowding === 1) break;
      }
      if (!crowding) {
        const offset = { x: delivery.x, y: delivery.y };
        layout.offsets.set(id, offset);
        return offset;
      }
      const separator = id.lastIndexOf(":");
      const index = Number(id.slice(separator + 1)) || 0;
      const seed = [...id.slice(0, separator)].reduce((value, letter) => Math.imul(value, 31) + letter.charCodeAt(0), 0);
      const angle = index * 2.399963229728653 + hashNoise(seed, 17) * Math.PI * 2;
      const spread = 1 - Math.max(Math.abs(delivery.x), Math.abs(delivery.y)) / .28 * .75;
      const radius = (0.18 + hashNoise(seed, index) * 0.12) * crowding * crowding * (3 - 2 * crowding) * spread;
      const offset = { x: delivery.x + Math.cos(angle) * radius,
        y: delivery.y + Math.sin(angle) * radius * 0.72 };
      layout.offsets.set(id, offset);
      return offset;
    }

    function agentBirthPose(agent, spread) {
      const birth = agent.birth;
      if (!birth) return null;
      const elapsed = Math.max(0, state.simSeconds - birth.startedAt);
      if (elapsed >= agentBirthDuration(agent.tribe)) return null;
      const entry = colonyEntries.find(candidate => candidate.id === birth.colonyId);
      if (agent.tribe === "spore") {
        const shape = Spawner.SPORE_BIRTH_ANIMATION;
        const offset = spread ? agentDisplayOffset(agent) : { x: 0, y: 0 };
        const targetX = agent.x + offset.x, targetY = agent.y + offset.y;
        const outlet = entry ? colonyBirthOutlet(entry) : { x: birth.fromX + .5, y: birth.fromY + .5 };
        const index = Number(agent.id.slice(agent.id.lastIndexOf(":") + 1)) || 0;
        const facing = index % 2 ? -1 : 1;
        if (entry) {
          if (facing < 0) outlet.x = entry.x * 2 + COLONY_SIZE - outlet.x;
          if (index % 4 >= 2) outlet.y -= COLONY_SIZE * colonyAppearance(entry).scale * .1;
        }
        const height = AGENT_HEIGHT * (unitAnimationSheets.get("spore")?.get("idle")?.referenceHeight || 219) / 512;
        const placement = Spawner.sporeBirthPlacement(idleMotion.matches ? shape.duration - .001 : elapsed,
          outlet, { x: targetX + .5, y: targetY + .5 + AGENT_HEIGHT * .44 }, height);
        return { kind: "spore", elapsed, facing, frame: placement.frame, scale: placement.scale, seedVisible: false, seedLift: 0,
          unitVisible: idleMotion.matches || placement.unitVisible, lift: 0, targetX, targetY,
          x: placement.rootX - .5, y: placement.rootY - .5 - AGENT_HEIGHT * .44,
          head: { leftRotation: 0, rightRotation: 0, leftScaleX: 1, rightScaleX: 1, leftScaleY: 1, rightScaleY: 1 } };
      }
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
      const cached = agentPositions.get(agent);
      if (cached?.time === state.simSeconds && cached.agents === state.agents && cached.rivals === state.rivals && cached.visible === state.visible &&
          cached.zoom === state.camera.zoom && cached.x === state.camera.x && cached.y === state.camera.y &&
          cached.width === viewport.width && cached.height === viewport.height) return cached.position;
      const birth = state.camera.zoom < 8 ? null : agentBirthPose(agent, true);
      const base = state.camera.zoom < 8 ? { x: agent.x, y: agent.y, progress: 1 } :
        birth ? { x: birth.x, y: birth.y, progress: 1 } : agentBasePosition(agent);
      const offset = birth || state.camera.zoom < 8 ? { x: 0, y: 0 } : agentDisplayOffset(agent);
      const position = { x: base.x + offset.x, y: base.y + offset.y, progress: base.progress };
      agentPositions.set(agent, { time: state.simSeconds, agents: state.agents, rivals: state.rivals, visible: state.visible,
        zoom: state.camera.zoom, x: state.camera.x, y: state.camera.y, width: viewport.width, height: viewport.height, position });
      return position;
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

    function drawBeetleFrame(index, facing, x, floor, cell, outlineColor, action) {
      const attack = action === "attack";
      const shape = attack ? Spawner.BEETLE_ATTACK_SPRITE : Spawner.BEETLE_SPRITE;
      const sheet = attack ? beetleAttackSheet : beetleSheet;
      const size = cell * shape.scale;
      const left = -size * shape.pivotX / shape.frameSize;
      const top = -size * shape.pivotY / shape.frameSize;
      const prepared = attack ? null : beetleFrames.get(index);
      const sprite = prepared || sheet;
      const frame = { owner: sheet, size: shape.frameSize, index,
        x: prepared ? 0 : index % shape.columns * shape.frameSize,
        y: prepared ? 0 : Math.floor(index / shape.columns) * shape.frameSize };
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(x, floor);
      if (shape.facing === "right" ? facing < 0 : facing > 0) ctx.scale(-1, 1);
      if (sprite.complete !== false && (sprite.naturalWidth || sprite.width) > 0) {
        if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, frame, outlineColor);
        ctx.drawImage(sprite, frame.x, frame.y, frame.size, frame.size, left, top, size, size);
      } else if (beetleSprite.complete && beetleSprite.naturalWidth > 0) {
        const fallbackLeft = -size * Spawner.BEETLE_SPRITE.pivotX / Spawner.BEETLE_SPRITE.frameSize;
        if (attack) ctx.scale(-1, 1);
        if (outlineColor) drawSelectionOutline(beetleSprite, fallbackLeft, top, size, size, null, outlineColor);
        ctx.drawImage(beetleSprite, fallbackLeft, top, size, size);
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
      const facing = pose.action === "attack" ? agent.attack?.directionX || agent.facing || 1 : agent.facing;
      drawBeetleFrame(index, facing, centerX, topLeft.y + cell * 0.86, cell, outlineColor, pose.action);

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
      const scale = Spawner.resourceCarryScale(crop);
      const width = crop.width * scale, height = crop.height * scale;
      const lift = agentBodyLift(appearance);
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

    function deliveryNest(delivery) {
      return colonyEntries.find(entry => entry.id === delivery.colonyId);
    }

    function foodDeliveryTarget(entry) {
      if (entry.key === "outpost") return { x: entry.x + entry.width / 2, y: entry.y + entry.height * .6, top: entry.y };
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
        const entry = deliveryNest(delivery);
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
          const offset = agentDisplayOffset(source), displayScale = unitDisplayScale(source);
          const start = worldToScreen(delivery.x + offset.x + placement.x * release.scaleX * displayScale,
            delivery.y + offset.y + AGENT_HEIGHT * 0.44 + (bodyOffset + (placement.y - bodyOffset) * release.scaleY) * displayScale);
          start.y -= placement.height * renderScale * (placement.pivotY - 0.5);
          const arc = cell * Math.max(1.1, Math.hypot(target.x - delivery.x, target.y - delivery.y) * 0.45);
          const x = start.x + (end.x - start.x) * flight;
          const y = start.y + (end.y - start.y) * flight - 4 * arc * flight * (1 - flight);
          const width = placement.width * renderScale, height = placement.height * renderScale;
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
          if (!Spawner.isColonyFood(type, entry.tribe, worldMap.generationVersion)) {
            const sprite = resourceCarrySprites.get(type), crop = resourceCarryBounds.get(type);
            if (sprite?.complete && sprite.naturalWidth && crop) {
              const scale = icon / Math.max(crop.width, crop.height);
              const width = crop.width * scale, height = crop.height * scale;
              ctx.drawImage(sprite, crop.x, crop.y, crop.width, crop.height,
                end.x - icon / 2 - width / 2, y - height / 2, width, height);
            }
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
      if ((agent.tribe || "bean") === "bean" && appearance.feet && !idleMotion.matches) {
        const roots = sproutRoots.pose(agent, interpolatedAgentPosition(agent), state.simSeconds);
        return roots.moving || roots.settling ? { ...roots, roots } : null;
      }
      const progress = agent.moveDuration ? (state.simSeconds - agent.moveStartedAt) / agent.moveDuration : 1;
      if (!appearance.feet || progress < 0 || progress >= 1 || idleMotion.matches) return null;
      const phase = (agent.stepCount - 1 + progress) * Math.PI * AGENT_FOOTSTEPS_PER_CELL;
      const sprint = hasSynergy(agent.attributes, ["feet", "feet"]) && agent.straightSteps > 4;
      const load = Math.min(1, agent.carrying / agent.stats.capacity);
      const dx = agent.x - agent.renderFromX;
      return { phase, stride: (appearance.feet > 1 ? 1.25 : 1) * (sprint ? 1.3 : 1),
        rotation: Math.sin(phase) * (appearance.feet > 1 ? 0.025 : 0.045) * (1 + load * 0.2) + dx * (sprint ? 0.085 : 0.018),
        bob: (1 - Math.cos(phase * 2)) * (appearance.feet > 1 ? 0.006 : 0.009), load, sprint };
    }

    function drawAgentFeet(ctx, agent, x, y, width, height, walk, outlineColor) {
      const appearance = agent.appearanceAttributes || agent.attributes;
      if (!appearance.feet || (agent.tribe || "bean") !== "bean") return;
      const roots = walk?.roots || (idleMotion.matches ? null : sproutRoots.pose(agent, interpolatedAgentPosition(agent), state.simSeconds));
      ctx.save(); ctx.translate(x, y); ctx.scale(width / 512, height / 512);
      sproutRoots.drawRig(ctx, agentParts.get("root-rig"), appearance.feet, roots,
        { rotation: walk?.rotation || 0, bob: walk?.bob || 0, pivot: 460 - agentBodyLift(appearance) },
        outlineColor ? (sprite, x, y, w, h) => drawSelectionOutline(sprite, x, y, w, h, null, outlineColor) : null);
      ctx.restore();
    }

    function agentJumpOffset(agent, position) {
      const appearance = agent.appearanceAttributes || agent.attributes || {};
      return !agent.species && (agent.tribe || "bean") === "bean" && !appearance.feet ?
        Math.sin(position.progress * Math.PI) * AGENT_HEIGHT * .18 : 0;
    }

    function agentAppearanceBodyPose(agent, now) {
      const pose = agentBodyPose(agent, now, foodDeliveryPose(agent));
      const attributes = agent.appearanceAttributes || agent.attributes || {};
      return !agent.species && (agent.tribe || "bean") === "bean" && !attributes.feet ?
        { ...pose, scaleX: 1, scaleY: 1 } : pose;
    }

    function agentBodyPose(agent, now, deliveryPose) {
      const appearance = agent.appearanceAttributes || agent.attributes || {};
      const lift = agentBodyLift(appearance);
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
        const lift = agentBodyLift(appearance);
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
      const lift = agentBodyLift(appearance);
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
        drawAgentAppearanceLayer(ctx, now, { ...agent, birth: null }, cell, topLeft, { x: birth.x, y: birth.y, progress: 1 }, null, outlineColor);
        return;
      }
      if (!springBirthSheet.complete || !springBirthSheet.naturalWidth) return;
      const animation = SPRING_BIRTH_ANIMATION;
      const scale = cell * AGENT_HEIGHT * 350 / 512 / animation.height;
      const attributeFrame = tribeArt.animationFrame(agent, springBirthSheet, animation, birth.frame, "birth", birth.elapsed);
      const sprite = attributeFrame || springBirthSheet, frameSize = attributeFrame ? sprite.width : animation.frameSize;
      const padding = (frameSize - animation.frameSize) / 2;
      const size = frameSize * scale;
      const x = topLeft.x + cell / 2 - (animation.pivotX + padding) * scale;
      const y = topLeft.y + cell / 2 + cell * AGENT_HEIGHT * .44 - (animation.pivotY + padding) * scale;
      const sourceX = attributeFrame ? 0 : birth.frame % animation.columns * animation.frameSize;
      const sourceY = attributeFrame ? 0 : Math.floor(birth.frame / animation.columns) * animation.frameSize;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const elapsed = idleMotion.matches ? animation.duration : birth.elapsed;
      Spawner.drawSpringBirthWater(ctx, topLeft.x + cell / 2,
        topLeft.y + cell / 2 + cell * AGENT_HEIGHT * .44, cell, elapsed);
      const source = { x: sourceX, y: sourceY, size: frameSize };
      const motion = Spawner.springBirthMotion(elapsed);
      if (outlineColor) {
        const surface = document.createElement("canvas");
        surface.width = surface.height = frameSize * 2;
        Spawner.drawSpringBirthSurface(surface.getContext("2d"), sprite, source,
          { x: frameSize / 2, y: frameSize / 2, size: frameSize }, motion);
        drawSelectionOutline(surface, x - size / 2, y - size / 2, size * 2, size * 2, null, outlineColor);
      }
      Spawner.drawSpringBirthSurface(ctx, sprite, source, { x, y, size }, motion);
      ctx.restore();
    }

    function drawPebbleBirth(ctx, now, agent, birth, topLeft, cell, outlineColor) {
      const animation = PEBBLE_BIRTH_ANIMATION;
      if (birth.frame === animation.frameCount - 1) {
        drawAgentAppearanceLayer(ctx, now, { ...agent, birth: null }, cell, topLeft, { x: birth.x, y: birth.y, progress: 1 }, null, outlineColor);
        return;
      }
      if (!pebbleBirthSheet.complete || !pebbleBirthSheet.naturalWidth) return;
      const scale = cell * AGENT_HEIGHT * animation.unitHeight / 512 / animation.height;
      const attributeFrame = tribeArt.animationFrame(agent, pebbleBirthSheet, animation, birth.frame, "birth", birth.elapsed);
      const sprite = attributeFrame || pebbleBirthSheet, frameSize = attributeFrame ? sprite.width : animation.frameSize;
      const padding = (frameSize - animation.frameSize) / 2;
      const size = frameSize * scale;
      const x = topLeft.x + cell / 2 - (animation.pivotX + padding) * scale;
      const y = topLeft.y + cell / 2 + cell * AGENT_HEIGHT * (animation.unitPivotY / 512 - .5) - (animation.pivotY + padding) * scale;
      const sourceX = attributeFrame ? 0 : birth.frame % animation.columns * animation.frameSize;
      const sourceY = attributeFrame ? 0 : Math.floor(birth.frame / animation.columns) * animation.frameSize;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const entry = colonyEntries.find(value => value.id === agent.birth.colonyId);
      if (entry && pebbleBirthForeground.complete && pebbleBirthForeground.naturalWidth) {
        const appearance = colonyAppearance(entry);
        const origin = worldToScreen(entry.x, entry.y);
        const center = worldToScreen(entry.x + 2.5, entry.y + 2.5);
        const nestSize = COLONY_SIZE * cell * appearance.scale;
        ctx.drawImage(pebbleBirthForeground, origin.x + (COLONY_SIZE * cell - nestSize) / 2,
          center.y - nestSize * appearance.centerY, nestSize, nestSize);
      }
      if (outlineColor) drawSelectionOutline(sprite, x, y, size, size,
        { owner: sprite, size: frameSize, index: attributeFrame ? 0 : birth.frame, x: sourceX, y: sourceY }, outlineColor);
      ctx.drawImage(sprite, sourceX, sourceY, frameSize, frameSize, x, y, size, size);
      ctx.restore();
    }

    function drawAgentBirth(ctx, now, agent, birth, topLeft, cell, outlineColor) {
      if (birth.kind === "spore") {
        drawSporeBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
        return;
      }
      if (birth.kind === "pebble") {
        drawPebbleBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
        return;
      }
      if (birth.kind === "spring") {
        drawSpringBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
        return;
      }
      const appearance = agent.appearanceAttributes || agent.attributes;
      const evolved = Spawner.hasCombatEvolution(appearance) && combatAttributeArt.ready(agent.tribe || "bean");
      const body = agentSprite(agent, evolved ? "full" : "body");
      if (!evolved) {
        for (const layer of appearance.antenna ? ["antenna"] : ["sprout-left", "sprout-right", "sprout-stem"]) agentSprite(agent, layer);
        if (appearance.feet) for (const layer of ["feet-left", "feet-right"]) agentSprite(agent, layer);
      }
      const height = cell * AGENT_HEIGHT;
      const centerX = topLeft.x + cell / 2;
      const footY = topLeft.y + cell / 2 + height * .44;
      const target = { x: centerX + (birth.targetX - birth.x) * cell,
        y: footY + (birth.targetY - birth.y) * cell };
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
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
          const spriteHeight = height * (evolved ? 2 : 1), pivot = evolved ? .875 : .94;
          const width = spriteHeight * (sprite.naturalWidth || sprite.width) / (sprite.naturalHeight || sprite.height);
          ctx.translate(centerX, footY - birth.lift * cell);
          ctx.rotate(birth.rotation);
          ctx.scale(birth.scaleX, birth.scaleY);
          if (!evolved) drawAgentFeet(ctx, agent, -width / 2, -spriteHeight * pivot, width, spriteHeight, null, outlineColor);
          if (outlineColor) {
            if (!evolved) {
              drawAgentHead(ctx, agent, -width / 2, -spriteHeight * pivot, width, spriteHeight, now, outlineColor);
            }
            drawSelectionOutline(sprite, -width / 2, -spriteHeight * pivot, width, spriteHeight, null, outlineColor);
          }
          if (!evolved) {
            drawAgentHead(ctx, agent, -width / 2, -spriteHeight * pivot, width, spriteHeight, now, null);
          }
          ctx.drawImage(sprite, -width / 2, -spriteHeight * pivot, width, spriteHeight);
        }
      }
      ctx.restore();
    }

    function prepareSporeBirth() {
      if (!sporeBirthReady) sporeBirthReady = sporeBirthSheet.decode().then(() => {
        const shape = Spawner.SPORE_BIRTH_ANIMATION;
        for (let frame = shape.firstUnitFrame; frame < shape.frameCount; frame++) {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = shape.frameSize;
          const target = canvas.getContext("2d", { willReadFrequently: true });
          target.drawImage(sporeBirthSheet, frame % shape.columns * shape.frameSize, Math.floor(frame / shape.columns) * shape.frameSize,
            shape.frameSize, shape.frameSize, 0, 0, shape.frameSize, shape.frameSize);
          sporeBirthFrames.set(frame, canvas);
        }
      }).catch(error => { sporeBirthReady = null; throw error; });
      return sporeBirthReady;
    }

    function drawSporeBirth(ctx, now, agent, birth, topLeft, cell, outlineColor) {
      if (!birth.unitVisible) return;
      const shape = Spawner.SPORE_BIRTH_ANIMATION;
      const frame = idleMotion.matches ? shape.frameCount - 1 : birth.frame;
      if (frame === shape.frameCount - 1) {
        drawAgentAppearanceLayer(ctx, now, { ...agent, birth: null }, cell, topLeft, { x: birth.x, y: birth.y, progress: 1 }, null, outlineColor);
        return;
      }
      const attributeFrame = tribeArt.animationFrame(agent, sporeBirthSheet, shape, frame, "birth", birth.elapsed);
      const sprite = attributeFrame || sporeBirthFrames.get(frame);
      if (!sprite) return;
      const frameSize = attributeFrame ? sprite.width : shape.frameSize;
      const padding = (frameSize - shape.frameSize) / 2;
      const size = frameSize * birth.scale * cell;
      const x = -(shape.pivotX + padding) * birth.scale * cell;
      const height = shape.unitHeight * Spawner.imageScale(shape.image) * birth.scale * cell;
      const y = -(shape.pivotY + padding) * birth.scale * cell;
      const motion = Spawner.sporeBirthMotion(idleMotion.matches ? shape.duration : birth.elapsed);
      ctx.save();
      ctx.translate(topLeft.x + cell / 2, topLeft.y + cell / 2 + cell * AGENT_HEIGHT * .44);
      ctx.scale(birth.facing, 1);
      ctx.scale(motion.scaleX, motion.scaleY);
      ctx.translate(0, -height * .5);
      ctx.rotate(motion.rotation);
      ctx.translate(0, height * .5);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (outlineColor) drawSelectionOutline(sprite, x, y, size, size, null, outlineColor);
      ctx.drawImage(sprite, x, y, size, size);
      ctx.restore();
    }

    async function prepareAgentMovement(tribe) {
      const unit = await tribeArt.prepareUnit(tribe);
      const animation = agentMovementSheets.get(tribe.key);
      if (animation) {
        await animation.sprite.decode();
        animation.scale = Math.min(unit.box.width / animation.width, unit.box.height / animation.height);
      }
      await prepareUnitAnimationSheets(tribe);
      return unit;
    }

    async function prepareUnitAnimationSheets(tribe) {
      if (!unitAnimationReady.has(tribe.key)) unitAnimationReady.set(tribe.key, (async () => {
        const body = tribe.key === "bean" ? tribeArt.bounds(starterObjectSprite, false) : null;
        const reference = body ? { width: body.width * 240 / starterObjectSprite.naturalWidth,
          height: body.height * 350 / starterObjectSprite.naturalHeight } : (await tribeArt.prepareUnit(tribe)).box;
        const sheets = unitAnimationSheets.get(tribe.key), idle = sheets.get("idle");
        await idle.sprite.decode();
        const idleBounds = tribeArt.bounds(idle.sprite, idle.animation.frameSize);
        await Promise.all([...sheets.entries()].map(async ([action, entry]) => {
          await entry.sprite.decode();
          const bounds = action === "walk" ? idleBounds : tribeArt.bounds(entry.sprite, entry.animation.frameSize);
          const frameSize = action === "walk" ? idle.animation.frameSize : entry.animation.frameSize;
          entry.scale = frameSize / 512 * Math.min(reference.width / bounds.width, reference.height / bounds.height);
          entry.referenceHeight = reference.height;
          if (tribe.key === "bean" && ["idle", "attack", "hurt", "death"].includes(action)) prepareSproutCombatFrames(entry, action === "idle" ? 1 : entry.animation.frameCount);
          if (action === "walk") agentMovementSheets.get(tribe.key).scale = entry.scale;
        }));
      })().catch(error => { unitAnimationReady.delete(tribe.key); throw error; }));
      return unitAnimationReady.get(tribe.key);
    }

    function prepareSproutCombatFrames(entry, frameCount) {
      const animation = entry.animation, size = animation.frameSize;
      entry.bodyBounds = [];
      entry.bodyFrames = [];
      entry.floors = [];
      entry.attributeFrames = new Map();
      const surface = document.createElement("canvas");
      surface.width = surface.height = size;
      const context = surface.getContext("2d", { willReadFrequently: true });
      for (let index = 0; index < frameCount; index++) {
        context.clearRect(0, 0, size, size);
        context.drawImage(entry.sprite, index % animation.columns * size, Math.floor(index / animation.columns) * size,
          size, size, 0, 0, size, size);
        const data = context.getImageData(0, 0, size, size), pixels = data.data, mask = new Uint8Array(size * size);
        for (let pixel = 0; pixel < mask.length; pixel++) {
          const offset = pixel * 4;
          mask[pixel] = pixels[offset + 3] > 100 && pixels[offset] > 130 &&
            pixels[offset + 2] > pixels[offset] * .78 && pixels[offset + 1] - pixels[offset] < 35 ? 1 : 0;
        }
        let largest = 0, silhouette = [], bounds = { x: size * .25, y: size * .43, width: size * .5, height: size * .4 };
        for (let pixel = 0; pixel < mask.length; pixel++) {
          if (!mask[pixel]) continue;
          const queue = [pixel]; mask[pixel] = 0;
          let left = size, top = size, right = 0, bottom = 0;
          for (let cursor = 0; cursor < queue.length; cursor++) {
            const current = queue[cursor], x = current % size, y = Math.floor(current / size);
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
            for (const next of [x > 0 ? current - 1 : -1, x + 1 < size ? current + 1 : -1, current - size, current + size]) {
              if (next < 0 || next >= mask.length || !mask[next]) continue;
              mask[next] = 0; queue.push(next);
            }
          }
          if (queue.length > largest) { largest = queue.length; silhouette = queue; bounds = { x: left, y: top, width: right - left, height: bottom - top }; }
        }
        entry.bodyBounds.push(bounds);
        let floor = bounds.y + bounds.height;
        for (let y = size - 1; y >= bounds.y + bounds.height / 2; y--) {
          let found = false;
          for (let x = Math.max(0, bounds.x - 2); x < Math.min(size, bounds.x + bounds.width + 2); x++)
            if (pixels[(y * size + x) * 4 + 3] > 100) { found = true; break; }
          if (found) { floor = y + 1; break; }
        }
        entry.floors.push(floor);
        const rows = Array.from({ length: size }, () => ({ left: size, right: 0 }));
        for (const pixel of silhouette) {
          const x = pixel % size, row = rows[Math.floor(pixel / size)];
          row.left = Math.min(row.left, x); row.right = Math.max(row.right, x + 1);
        }
        const margin = Math.max(1, Math.round(size * .008));
        for (let y = 0; y < bounds.y + bounds.height * .7; y++) {
          let left = size, right = 0;
          for (let row = Math.max(0, y - margin); row <= Math.min(size - 1, y + margin); row++) {
            left = Math.min(left, rows[row].left); right = Math.max(right, rows[row].right);
          }
          for (let x = 0; x < size; x++) if (x < left - margin || x >= right + margin) pixels[(y * size + x) * 4 + 3] = 0;
        }
        const body = document.createElement("canvas"); body.width = body.height = size;
        body.getContext("2d").putImageData(data, 0, 0);
        entry.bodyFrames.push(body);
      }
    }

    function sproutCombatFrame(agent, entry, index) {
      if (!entry?.bodyBounds) return null;
      const attributes = agent.appearanceAttributes || agent.attributes || {}, key = agentAppearanceKey(attributes);
      if (!entry.attributeFrames.has(key)) entry.attributeFrames.set(key, new Map());
      const frames = entry.attributeFrames.get(key);
      if (frames.has(index)) return frames.get(index);
      const feet = attributes.feet || 0;
      if (!sproutCombatMounts.has(feet)) {
        const body = agentSprite({ attributes: { feet } }, "body"), bounds = tribeArt.bounds(body, false);
        const scale = 512 / (body.naturalWidth || body.width);
        sproutCombatMounts.set(feet, { x: bounds.x * scale, y: bounds.y * scale, width: bounds.width * scale, height: bounds.height * scale });
      }
      const animation = entry.animation, size = animation.frameSize, mount = sproutCombatMounts.get(feet), body = entry.bodyBounds[index];
      const padding = feet ? Math.ceil(size / 4) : 0;
      const surface = document.createElement("canvas"); surface.width = surface.height = size + padding * 2;
      const context = surface.getContext("2d"), scaleX = body.width / mount.width, scaleY = body.height / mount.height;
      const left = body.x - mount.x * scaleX, top = body.y - mount.y * scaleY;
      const roots = feet ? Spawner.sproutRootGeometry(feet) : null;
      const rootHeight = roots ? roots.height * scaleY : 0, rootWidth = roots ? roots.width * scaleX : 0;
      const cut = body.y + body.height - size * .04;
      const rootTop = cut - rootHeight * .12;
      const lift = feet ? Math.max(0, rootTop + rootHeight - entry.floors[index]) : 0;
      context.translate(padding, padding - lift);
      if (feet) context.drawImage(agentParts.get("feet-1"),
        body.x + body.width / 2 - rootWidth / 2, rootTop, rootWidth, rootHeight);
      context.save();
      if (attributes.feet) {
        context.beginPath(); context.rect(0, 0, size, cut); context.clip();
      }
      if (attributes.antenna) context.drawImage(entry.bodyFrames[index], 0, 0);
      else context.drawImage(entry.sprite, index % animation.columns * size, Math.floor(index / animation.columns) * size,
        size, size, 0, 0, size, size);
      context.restore();
      context.drawImage(agentSprite(agent, feet ? "attributes-no-feet" : "attributes"), left, top, 512 * scaleX, 512 * scaleY);
      frames.set(index, surface);
      return surface;
    }

    function drawAgentAnimation(ctx, agent, centerX, floor, height, outlineColor) {
      const attributes = agent.appearanceAttributes || agent.attributes || {};
      let pose = Spawner.unitAnimationPose(agent, state.simSeconds);
      if (!pose) return false;
      if ((agent.tribe || "bean") !== "bean") pose = tribeArt.animationPose(agent, pose, state.simSeconds);
      const customized = (agent.tribe || "bean") === "bean" && ["strength", "arms", "feet", "antenna"].some(key => attributes[key] > 0);
      const combat = ["attack", "hurt"].includes(pose.action);
      if (customized && !combat) return false;
      const sheets = unitAnimationSheets.get(agent.tribe || "bean");
      const entry = sheets?.get(pose.sourceAction || pose.action) || (["harvest", "throw"].includes(pose.action) ? sheets?.get("idle") : null);
      if (!entry?.sprite.complete || !entry.sprite.naturalWidth) return false;
      let animation = pose.sourceAnimation || pose.animation;
      const index = idleMotion.matches ? 0 : pose.sourceFrame ?? pose.frame;
      const attributeAction = pose.action === "walk" && agent.carrying > 0 ? "carry" : pose.action;
      const motionTime = pose.action === "harvest" ? state.simSeconds - agent.harvestStarted :
        pose.action === "throw" ? state.simSeconds - agent.foodDelivery.startedAt : state.simSeconds;
      const attributeFrame = (agent.tribe || "bean") === "bean" ||
        !["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) ? null :
        tribeArt.animationFrame(agent, entry.sprite, animation, index, attributeAction, motionTime, pose);
      const composedFrame = attributeFrame || (customized && combat ? sproutCombatFrame(agent, entry, index) : null);
      const sprite = composedFrame || entry.frames?.get(index) || entry.sprite;
      if (!sprite) return false;
      const frameSize = composedFrame ? sprite.width : animation.frameSize;
      const padding = (frameSize - animation.frameSize) / 2;
      const size = height * entry.scale * frameSize / animation.frameSize;
      const left = -size * (animation.pivotX + padding) / frameSize;
      const top = -size * (animation.pivotY + padding) / frameSize;
      const frame = { owner: sprite, size: frameSize, index: sprite === entry.sprite ? index : 0,
        x: sprite === entry.sprite ? index % animation.columns * animation.frameSize : 0,
        y: sprite === entry.sprite ? Math.floor(index / animation.columns) * animation.frameSize : 0 };
      const facing = agent.tribe === "pebble" && pose.action === "walk" ? 1 : agent.combat ? agent.combat.side === 0 ? -1 : 1 :
        pose.action === "attack" ? agent.attack?.directionX || agent.facing || 1 : agent.facing || 1;
      ctx.save();
      ctx.translate(centerX, floor);
      ctx.scale(facing < 0 ? -1 : 1, 1);
      if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, frame, outlineColor);
      ctx.drawImage(sprite, frame.x, frame.y, frameSize, frameSize, left, top, size, size);
      ctx.restore();
      return pose;
    }

    function drawBurrowForeground(burrow) {
      const appearance = burrowAppearances.get(burrow.type);
      if (!appearance || burrow.health <= 0) return;
      const { sprite, crop } = appearance;
      const point = worldToScreen(burrow.x, burrow.y + burrow.height);
      const width = burrow.width * state.camera.zoom, height = width * crop.height / crop.width;
      ctx.save(); ctx.beginPath(); ctx.rect(point.x, point.y - height * .18, width, height * .18); ctx.clip();
      ctx.drawImage(sprite, crop.x, crop.y, crop.width, crop.height, point.x, point.y - height, width, height);
      ctx.restore();
    }

    function drawCreatureSpawn(agent, renderPosition) {
      const pose = Spawner.creatureSpawnPose(agent, state.simSeconds);
      if (!pose) return false;
      const cell = state.camera.zoom;
      const position = { x: pose.x, y: pose.y - (pose.kind === "burrow" ? (1 - pose.progress) * .45 : 0), progress: pose.progress };
      if (pose.kind === "burrow") {
        const burrow = worldMap.burrows.find(burrow => burrow.id === agent.burrowId || burrow.id === agent.spawn.burrowId);
        const mouth = worldToScreen(agent.spawn.fromX + .5, agent.spawn.fromY + .86);
        const moving = { ...agent, mode: "walk", moveStartedAt: agent.spawn.startedAt,
          moveDuration: agent.spawn.readyAt - agent.spawn.startedAt, stepCount: 1 };
        ctx.save(); ctx.globalAlpha *= Math.min(1, pose.progress / .16); ctx.beginPath();
        ctx.ellipse(mouth.x, mouth.y - cell * .17, cell * .28, cell * .3, 0, 0, Math.PI * 2);
        ctx.rect(mouth.x - cell * 5, mouth.y - cell * .015, cell * 10, cell * 6); ctx.clip();
        if (agent.species === "spiny-back-beetle") drawBeetle(moving, position);
        else if (!drawCreatureWalk(moving, position)) drawCreatureIdle({ ...agent, mode: "idle" }, position);
        ctx.restore();
        if (burrow) drawBurrowForeground(burrow);
        return true;
      }
      if (pose.kind === "water") {
        const point = worldToScreen(renderPosition.x + .5, renderPosition.y + 1);
        const lift = (1 - pose.progress) * cell * .5;
        const moving = { ...agent, mode: "walk", moveStartedAt: agent.spawn.startedAt,
          moveDuration: agent.spawn.readyAt - agent.spawn.startedAt, stepCount: 1 };
        ctx.save(); ctx.beginPath(); ctx.rect(point.x - cell * 2, point.y - cell * 3, cell * 4, cell * 3); ctx.clip();
        ctx.translate(0, lift);
        if (!drawCreatureWalk(moving, renderPosition)) drawCreatureIdle({ ...agent, mode: "idle" }, renderPosition);
        ctx.restore();
        if (!idleMotion.matches) {
          ctx.save(); ctx.strokeStyle = "rgba(160,215,196," + (1 - pose.progress) * .65 + ")";
          ctx.lineWidth = Math.max(.75, cell * .018);
          for (const offset of [0, .25]) {
            ctx.beginPath(); ctx.ellipse(point.x, point.y - cell * .08, cell * (.2 + pose.progress * .45 + offset),
              cell * (.05 + pose.progress * .1 + offset * .2), 0, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
        }
        return true;
      }
      return false;
    }

    function drawCreatureWalk(agent, renderPosition) {
      const pose = agent.species === "spring-keeper" ? Spawner.springKeeperFlightPose(agent, state.simSeconds) :
        Spawner.creatureWalkPose(agent, state.simSeconds);
      const entry = creatureWalkSheets.get(agent.species);
      if (!pose || !entry?.sprite.complete || !entry.sprite.naturalWidth) return false;
      const animation = pose.animation;
      const frame = idleMotion.matches ? pose.stage === "flight" ? 4 : 0 : pose.frame;
      const owl = agent.species === "talon-owl";
      const point = worldToScreen(renderPosition.x + .5, renderPosition.y + (owl ? .86 : 1));
      const size = state.camera.zoom * (owl ? Spawner.TALON_OWL_IDLE.scale : 1.4 * entry.scale) *
        animation.frameSize / (animation.viewSize || animation.frameSize);
      const left = -size * animation.pivotX / animation.frameSize;
      const top = -size * animation.pivotY / animation.frameSize;
      const source = { owner: entry.sprite, size: animation.frameSize, index: frame,
        x: frame % animation.columns * animation.frameSize, y: Math.floor(frame / animation.columns) * animation.frameSize };
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.scale(agent.facing > 0 ? -1 : 1, 1);
      const outline = objectOutlineColor("agent", agent);
      if (outline) drawSelectionOutline(entry.sprite, left, top, size, size, source, outline);
      ctx.drawImage(entry.sprite, source.x, source.y, animation.frameSize, animation.frameSize, left, top, size, size);
      ctx.restore();
      return true;
    }

    function drawCreatureAttack(agent, renderPosition) {
      const pose = Spawner.creatureAttackPose(agent, state.simSeconds);
      const entry = pose && creatureAttackSheets.get(agent.species);
      if (!entry || !entry.sprite.complete || !entry.sprite.naturalWidth) return false;
      const animation = pose.animation, owl = agent.species === "talon-owl";
      const point = worldToScreen(renderPosition.x + .5, renderPosition.y + (owl ? .86 : 1));
      const size = state.camera.zoom * (owl ? Spawner.TALON_OWL_IDLE.scale : 1.4 * entry.scale) *
        animation.frameSize / animation.viewSize;
      const left = -size * animation.pivotX / animation.frameSize;
      const top = -size * animation.pivotY / animation.frameSize;
      const frame = { owner: entry.sprite, size: animation.frameSize, index: pose.frame,
        x: pose.frame % animation.columns * animation.frameSize,
        y: Math.floor(pose.frame / animation.columns) * animation.frameSize };
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.scale(pose.mirrorX ? -1 : 1, 1);
      const outline = objectOutlineColor("agent", agent);
      if (outline) drawSelectionOutline(entry.sprite, left, top, size, size, frame, outline);
      ctx.drawImage(entry.sprite, frame.x, frame.y, animation.frameSize, animation.frameSize, left, top, size, size);
      ctx.restore();
      return true;
    }

    function drawCreatureHurt(agent, renderPosition) {
      const pose = Spawner.creatureHurtPose(agent, state.simSeconds);
      const entry = pose && creatureHurtSheets.get(agent.species);
      if (!entry || !entry.sprite.complete || !entry.sprite.naturalWidth) return false;
      const animation = pose.animation, owl = agent.species === "talon-owl";
      const point = worldToScreen(renderPosition.x + .5, renderPosition.y + (owl ? .86 : 1));
      const size = state.camera.zoom * (owl ? Spawner.TALON_OWL_IDLE.scale : 1.4 * entry.scale);
      const left = -size * animation.pivotX / animation.frameSize;
      const top = -size * animation.pivotY / animation.frameSize;
      const frame = { owner: entry.sprite, size: animation.frameSize, index: pose.frame,
        x: pose.frame % animation.columns * animation.frameSize,
        y: Math.floor(pose.frame / animation.columns) * animation.frameSize };
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.scale(agent.facing > 0 ? -1 : 1, 1);
      const outline = objectOutlineColor("agent", agent);
      if (outline) drawSelectionOutline(entry.sprite, left, top, size, size, frame, outline);
      ctx.drawImage(entry.sprite, frame.x, frame.y, animation.frameSize, animation.frameSize, left, top, size, size);
      ctx.restore();
      return true;
    }

    function drawCreatureIdle(agent, renderPosition) {
      const entry = creatureIdleSheets.get(agent.species);
      if (!entry || !["idle", "fight"].includes(agent.mode) || !entry.sprite.complete || !entry.sprite.naturalWidth) return false;
      const animation = entry.animation;
      const frame = idleMotion.matches ? 0 : Spawner.unitAnimationFrame(animation,
        (state.simSeconds - (agent.animationStartedAt ?? agent.moveStartedAt ?? 0)) * 1000);
      const point = worldToScreen(renderPosition.x + .5, renderPosition.y + 1);
      const size = state.camera.zoom * 1.4 * entry.scale;
      const left = -size * animation.pivotX / animation.frameSize;
      const top = -size * animation.pivotY / animation.frameSize;
      const source = { owner: entry.sprite, size: animation.frameSize, index: frame,
        x: frame % animation.columns * animation.frameSize, y: Math.floor(frame / animation.columns) * animation.frameSize };
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.scale(agent.facing > 0 ? -1 : 1, 1);
      const outline = objectOutlineColor("agent", agent);
      if (outline) drawSelectionOutline(entry.sprite, left, top, size, size, source, outline);
      ctx.drawImage(entry.sprite, source.x, source.y, animation.frameSize, animation.frameSize, left, top, size, size);
      ctx.restore();
      return true;
    }

    function drawCreatureDeath(context, corpse, x, floor, cell, outlineColor, opacity) {
      const entry = creatureDeathSheets.get(corpse.species);
      if (!entry?.sprite.complete || !entry.sprite.naturalWidth) return true;
      const animation = entry.animation;
      const frame = idleMotion.matches ? animation.frameCount - 1 :
        Spawner.unitAnimationFrame(animation, (corpsePlaybackTime() - corpse.diedAt) * 1000);
      const size = cell * 1.4 * entry.scale * animation.frameSize / animation.viewSize;
      const left = -size * animation.pivotX / animation.frameSize;
      const top = -size * animation.pivotY / animation.frameSize;
      const source = { owner: entry.sprite, size: animation.frameSize, index: frame,
        x: frame % animation.columns * animation.frameSize, y: Math.floor(frame / animation.columns) * animation.frameSize };
      const decay = Number.isFinite(corpse.decaysAt) ?
        clamp((state.simSeconds - corpse.diedAt) / (corpse.decaysAt - corpse.diedAt), 0, 1) : 0;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.globalAlpha *= opacity * (1 - decay * .4);
      context.filter = "saturate(" + (1 - decay * .8) + ")";
      context.translate(x, floor);
      context.scale(corpse.facing > 0 ? -1 : 1, 1);
      context.drawImage(entry.sprite, source.x, source.y, animation.frameSize, animation.frameSize, left, top, size, size);
      if (outlineColor) drawSelectionOutline(entry.sprite, left, top, size, size, source, outlineColor);
      context.restore();
      return true;
    }

    function drawCreatureCorpse(context, corpse, x, floor, cell, outlineColor, opacity) {
      if (Spawner.CREATURE_DEATH_ANIMATIONS?.[corpse.species])
        return drawCreatureDeath(context, corpse, x, floor, cell, outlineColor, opacity);
      const sprite = corpse.species === "talon-owl" ? talonOwlFrames.get(0) :
        corpse.species === "spiny-back-beetle" ? beetleCorpseSprite : encounterSprites.get(corpse.species);
      if (!sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) return false;
      const decay = Number.isFinite(corpse.decaysAt) ?
        clamp((state.simSeconds - corpse.diedAt) / (corpse.decaysAt - corpse.diedAt), 0, 1) : 0;
      const size = cell * (corpse.species === "talon-owl" ? Spawner.TALON_OWL_IDLE.scale : corpse.species === "spiny-back-beetle" ? beetleCorpseScale : 1.4);
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.globalAlpha *= opacity * (1 - decay * .4);
      context.filter = "saturate(" + (1 - decay * .8) + ")";
      context.translate(x, floor);
      if (corpse.species !== "spiny-back-beetle") {
        context.rotate(Math.PI / 2);
        context.scale(corpse.facing < 0 ? -1 : 1, 1);
      }
      const left = -size * (corpse.species === "talon-owl" ? Spawner.TALON_OWL_IDLE.pivotX / Spawner.TALON_OWL_IDLE.frameSize : .5);
      const top = -size * (corpse.species === "talon-owl" ? Spawner.TALON_OWL_IDLE.pivotY / Spawner.TALON_OWL_IDLE.frameSize : .88);
      context.drawImage(sprite, left, top, size, size);
      if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, null, outlineColor);
      context.restore();
      return true;
    }

    function drawAgentMovement(ctx, agent, centerX, footY, height, outlineColor) {
      const animation = agentMovementSheets.get(agent.tribe);
      const elapsed = state.simSeconds - agent.moveStartedAt;
      if (!animation || !agent.moveDuration || elapsed < 0 || elapsed >= agent.moveDuration ||
        !animation.sprite.complete || !animation.sprite.naturalWidth) return false;
      const progress = elapsed / agent.moveDuration;
      const index = idleMotion.matches ? 0 : Math.floor((agent.stepCount - 1 + progress) * (animation.cyclesPerCell || 1) * animation.frameCount) % animation.frameCount;
      const sprite = animation.sprite;
      const size = height * animation.scale;
      const frameSize = animation.frameSize;
      const frame = { owner: sprite, size: frameSize, index, x: index % animation.columns * frameSize, y: Math.floor(index / animation.columns) * frameSize };
      ctx.save();
      ctx.translate(centerX, footY);
      ctx.scale(agent.tribe === "pebble" ? 1 : agent.facing < 0 ? -1 : 1, 1);
      if (outlineColor) drawSelectionOutline(sprite, -size * animation.pivotX / frameSize, -size * animation.pivotY / frameSize, size, size, frame, outlineColor);
      ctx.drawImage(sprite, frame.x, frame.y, frameSize, frameSize, -size * animation.pivotX / frameSize, -size * animation.pivotY / frameSize, size, size);
      ctx.restore();
      return true;
    }

    function drawAgentAttack(ctx, agent, centerX, footY, height, outlineColor) {
      const appearance = agent.appearanceAttributes || agent.attributes || {};
      const attackFrame = agentAttackFrame(agent.attack, state.simSeconds);
      const hurtFrame = Spawner.combatHurtFrame(agent, state.simSeconds);
      const action = attackFrame >= 0 ? "attack" : "hurt";
      const index = attackFrame >= 0 ? attackFrame : hurtFrame;
      if (index < 0) return false;
      const customized = (agent.tribe || "bean") === "bean" && ["strength", "arms", "feet", "antenna"].some(key => appearance[key] > 0);
      const sprite = customized ? sproutCombatFrame(agent, unitAnimationSheets.get("bean")?.get(action), index) : combatSheets.get(agent.tribe || "bean")?.[action];
      if (!sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) return false;
      const size = height * .94;
      const frameSize = customized ? sprite.width : sprite.naturalWidth / 4;
      const frame = { owner: sprite, size: frameSize, index: customized ? 0 : index,
        x: customized ? 0 : index % 4 * frameSize, y: customized ? 0 : Math.floor(index / 4) * frameSize };
      ctx.save();
      ctx.translate(centerX, footY - height * .054);
      ctx.scale(agent.combat ? agent.combat.side === 0 ? -1 : 1 : agent.attack?.directionX || agent.facing || 1, 1);
      const pivot = 448 / 512;
      if (outlineColor) drawSelectionOutline(sprite, -size / 2, -size * pivot, size, size, frame, outlineColor);
      ctx.drawImage(sprite, frame.x, frame.y, frameSize, frameSize, -size / 2, -size * pivot, size, size);
      ctx.restore();
      return true;
    }

    function drawAttackImpacts() {
      const cell = state.camera.zoom;
      if (cell < 8) return;
      for (const agent of visibleAgents()) {
        const attack = agent.attack;
        if (agent.combat || !attack || !attack.resolved || !attack.hit) continue;
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
      const position = interpolatedAgentPosition(agent);
      if ((agent.species || agent.faction === "rival") &&
          !state.visible.has(Math.floor(position.y + .5) * WORLD_SIZE + Math.floor(position.x + .5))) return;
      if (state.camera.zoom < 8) {
        const point = worldToScreen(position.x + .5, position.y + .5);
        ctx.fillStyle = agent.species ? agent.faction === "hostile" ? "#c36c87" : "#b9c685" : agent.carrying > 0 ? "#d6b26b" : agent.faction === "rival" ? "#c78e86" : "#75c4b6";
        if (objectOutlineColor("agent", agent)) { ctx.fillStyle = "#fff2ba"; ctx.fillRect(Math.floor(point.x - 2), Math.floor(point.y - 2), 5, 5); }
        ctx.fillRect(Math.floor(point.x - 1), Math.floor(point.y - 1), 3, 3);
        return;
      }
      const placement = agentCombatPlacement(agent);
      if (!placement || state.camera.zoom < 8) {
        drawAgentGroundShadow(agent);
        drawAgentBody(now, agent);
        return;
      }
      agent = displayedAgent(agent);
      const center = worldToScreen(position.x + .5, position.y + .5);
      const attack = agent.attack;
      const progress = attack ? (state.simSeconds - attack.startedAt) / (attack.endsAt - attack.startedAt) : -1;
      const lunge = !idleMotion.matches && !Spawner.CREATURE_ATTACK_ANIMATIONS[agent.species] && progress >= 0 && progress < 1 ?
        Math.sin(progress * Math.PI) * .045 * placement.facing : 0;
      ctx.save();
      ctx.translate(center.x + lunge * state.camera.zoom, center.y);
      ctx.scale(placement.scale, placement.scale);
      ctx.translate(-center.x, -center.y);
      drawAgentGroundShadow(agent);
      drawAgentBody(now, agent);
      ctx.restore();
    }

    function prepareUnitDisplaySize(key, sprite, animation, size) {
      const bounds = tribeArt.bounds(sprite, animation.frameSize);
      const length = Math.max(bounds.width, bounds.height);
      const target = Spawner.UNIT_DISPLAY_SIZES[key];
      unitDisplayScales.set(key, target * animation.frameSize / (size * length));
      const scale = target / length;
      unitDisplayBounds.set(key, { x: (bounds.x - animation.pivotX) * scale,
        y: (bounds.y - animation.pivotY) * scale, width: bounds.width * scale, height: bounds.height * scale });
    }

    function prepareCreatureDeathSize(species, entry) {
      const animation = entry.animation;
      const bounds = tribeArt.bounds(entry.sprite, animation.frameSize);
      entry.scale = Spawner.UNIT_DISPLAY_SIZES[species] * (animation.viewSize || animation.frameSize) /
        (1.4 * unitDisplayScales.get(species) * Math.max(bounds.width, bounds.height));
    }

    function unitDisplayScale(unit) {
      const tribe = unit.tribe || "bean";
      const base = unitDisplayScales.get(unit.species || tribe) || 1;
      if (unit.species) return base;
      const attributes = unit.appearanceAttributes || unit.attributes || {};
      const equipped = ATTRIBUTES.filter(attribute => attributes[attribute.key] > 0);
      if (!equipped.length || equipped.some(attribute => attribute.kind === "combat") && !combatAttributeArt.ready(tribe)) return base;
      const key = tribe + ":" + equipped.map(attribute => attribute.key + ":" + attributes[attribute.key]).join(",");
      if (!unitAttributeScales.has(key)) {
        const growth = 1 + equipped.reduce((sum, attribute) => sum + UNIT_ATTRIBUTE_GROWTH[attribute.kind === "combat" ? "combat" : "common"], 0);
        const scale = measureUnitDisplayScale(tribe, attributes, growth);
        if (scale) unitAttributeScales.set(key, scale);
      }
      return unitAttributeScales.get(key) || base;
    }

    function measureUnitDisplayScale(tribe, attributes, growth) {
      const reference = unitBodySize(tribe, {}), size = unitBodySize(tribe, attributes);
      const scale = (unitDisplayScales.get(tribe) || 1) * growth;
      return size.width > 0 ? scale * reference.width / size.width : null;
    }

    function unitBodySize(tribe, attributes) {
      const idle = unitAnimationSheets.get(tribe).get("idle");
      const customized = ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0);
      let size;
      const scaled = (size, scale) => ({ width: size.width * scale, height: size.height * scale });
      if (tribe === "bean") {
        if (customized) {
          const image = agentBaseParts.get("body");
          const bounds = tribeArt.bounds(image, false);
          size = { width: AGENT_HEIGHT * 240 / 512 * bounds.width / image.naturalWidth,
            height: AGENT_HEIGHT * 350 / 512 * bounds.height / image.naturalHeight };
        } else size = scaled(idle.bodyBounds[0], AGENT_HEIGHT * idle.scale / idle.animation.frameSize);
      } else size = scaled(tribeArt.bodySize(tribe, attributes, false), AGENT_HEIGHT * idle.scale / 144);
      if (Spawner.combatAttributeKeys(attributes).length) {
        const replacement = tribe !== "bean" && customized ? tribeArt.bodySize(tribe, attributes, true) : scaled(size, 256 / AGENT_HEIGHT);
        size = scaled(combatAttributeArt.bodySize({ tribe, attributes }, replacement), AGENT_HEIGHT * 2 / 512);
      }
      return size;
    }

    function unitDisplayFloor(unit) {
      return unit.species === "talon-owl" ? .86 : unit.species ? 1 : .5 + AGENT_HEIGHT * .44;
    }

    function drawAgentGroundShadow(agent) {
      agent = displayedAgent(agent);
      const birth = agentBirthPose(agent, true);
      if (birth && !birth.seedVisible && !birth.unitVisible) return;
      const key = agent.species || agent.tribe || "bean";
      const contact = unitGroundContacts[key], bounds = unitDisplayBounds.get(key);
      const scale = unitDisplayScale(agent), anchor = unitDisplayFloor(agent);
      const appearance = agent.appearanceAttributes || agent.attributes;
      const spawn = agent.spawn ? Spawner.creatureSpawnPose(agent, state.simSeconds) : null;
      const renderPosition = interpolatedAgentPosition(agent), position = birth || spawn || renderPosition;
      let offsetX = bounds.x + bounds.width * contact.x;
      let offsetY = bounds.y + bounds.height * contact.y;
      let radiusX = bounds.width * contact.width / 2;
      let radiusY = Spawner.UNIT_DISPLAY_SIZES[key] * contact.depth;
      let opacity = contact.opacity;
      if (birth?.seedVisible) {
        offsetX = 0; offsetY = 0; radiusX = .055 * scale; radiusY = .018 * scale;
      } else if (!agent.species && appearance.feet) {
        const family = Spawner.hasCombatEvolution(appearance) ? "combatFeet" : "feet";
        const variant = unitGroundVariants[key + ":" + family];
        offsetX = variant.x * scale; offsetY = variant.y * scale;
        radiusX = variant.radiusX * scale; radiusY = variant.radiusY * scale;
        if (family === "feet") {
          const maximum = unitGroundVariants[key + ":feet4"], growth = (Math.min(4, appearance.feet) - 1) / 3;
          offsetX += (maximum.x - variant.x) * growth * scale;
          offsetY += (maximum.y - variant.y) * growth * scale;
          radiusX += (maximum.radiusX - variant.radiusX) * growth * scale;
          radiusY += (maximum.radiusY - variant.radiusY) * growth * scale;
        } else if (key === "bean" && appearance.feet > 1) {
          radiusX *= Spawner.sproutRootGeometry(appearance.feet).width / Spawner.sproutRootGeometry(1).width;
        }
      }
      if (spawn) opacity *= Math.min(1, spawn.progress / .25);
      else if (birth) opacity *= Math.max(.25, 1 - (birth.unitVisible ? birth.lift : birth.seedLift) * .6);
      else if (!agent.species && !appearance.feet && key === "bean") {
        const lift = Math.sin(position.progress * Math.PI);
        radiusX *= 1 - lift * .18;
        opacity *= 1 - lift * .35;
      }
      const attacking = agent.attack && state.simSeconds >= agent.attack.startedAt && state.simSeconds < agent.attack.endsAt;
      const facing = agent.combat ? agent.combat.side === 0 ? -1 : 1 : attacking ? agent.attack.directionX || agent.facing || 1 : agent.facing || 1;
      if (agent.species ? facing > 0 : facing < 0) offsetX = -offsetX;
      const floor = key === "spiny-back-beetle" ? .86 : anchor;
      const point = worldToScreen(renderPosition.x + .5 + (position.x - renderPosition.x) * scale + offsetX,
        renderPosition.y + anchor + (position.y + floor - renderPosition.y - anchor) * scale + offsetY);
      drawGroundShadow(point.x, point.y, radiusX * state.camera.zoom, radiusY * state.camera.zoom, opacity);
      if (!birth && !spawn && agent.health > 0) drawAgentHealthRing(agent, point,
        Math.max(radiusX * 1.4, Spawner.unitDisplaySize(agent) * .63) * state.camera.zoom);
    }

    function drawAgentHealthRing(agent, point, radius) {
      const maximum = agent.stats?.health;
      if (!(maximum > 0) || !Number.isFinite(maximum) || !Number.isFinite(agent.health)) return;
      const ratio = clamp(agent.health / maximum, 0, 1);
      const depth = radius * .327;
      if (state.camera.zoom < 8 || ratio <= 0 || ratio >= 1 || point.x + radius < 0 || point.x - radius > viewport.width ||
          point.y + depth < 0 || point.y - depth > viewport.height) return;
      const thickness = clamp(radius * .064, 1, 6);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = thickness + 2;
      ctx.strokeStyle = "#111b17e8";
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius, depth, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = thickness;
      ctx.strokeStyle = "#485650";
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius, depth, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#eee1c8";
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius, depth, 0,
        Math.PI / 2 - Math.PI * ratio, Math.PI / 2 + Math.PI * ratio);
      ctx.stroke();
      ctx.restore();
    }

    function drawAgentBody(now, agent) {
      agent = displayedAgent(agent);
      const position = interpolatedAgentPosition(agent);
      const point = worldToScreen(position.x + .5, position.y + unitDisplayFloor(agent));
      const scale = unitDisplayScale(agent);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.scale(scale, scale);
      ctx.translate(-point.x, -point.y);
      drawAgentUnscaledBody(now, agent);
      ctx.restore();
    }

    function drawAgentUnscaledBody(now, agent) {
      agent = displayedAgent(agent);
      const cell = state.camera.zoom;
      const renderPosition = interpolatedAgentPosition(agent);
      const topLeft = worldToScreen(renderPosition.x, renderPosition.y);
      const birth = agentBirthPose(agent, true);
      const walk = agent.mode === "walk" || agent.species === "spring-keeper" ? creatureWalkSheets.get(agent.species) : null;
      const walkMargin = walk?.animation.viewSize ? walk.animation.frameSize / walk.animation.viewSize *
        (agent.species === "talon-owl" ? Spawner.TALON_OWL_IDLE.scale : 1.4 * walk.scale) : .4;
      const margin = Math.max(4, cell * (birth ? Math.max(1.7, birth.seedLift + .4) : Math.max(.4, walkMargin)));
      if (topLeft.x + cell + margin < 0 || topLeft.x - margin > viewport.width ||
        topLeft.y + cell + margin < 0 || topLeft.y - margin > viewport.height) return;
      if (agent.species && drawCreatureSpawn(agent, renderPosition)) return;
      if (agent.species && drawCreatureHurt(agent, renderPosition)) return;
      if (agent.species && drawCreatureAttack(agent, renderPosition)) return;
      if (agent.species === "spiny-back-beetle") {
        drawBeetle(agent, renderPosition);
        return;
      }
      if (drawCreatureWalk(agent, renderPosition)) return;
      if (agent.species === "talon-owl") {
        drawTalonOwl(agent, renderPosition);
        return;
      }
      if (encounterSprites.has(agent.species)) {
        if (drawCreatureIdle(agent, renderPosition)) return;
        const sprite = encounterSprites.get(agent.species);
        const width = cell * 1.4;
        ctx.save();
        ctx.translate(topLeft.x + cell / 2, topLeft.y + cell);
        ctx.scale(agent.facing > 0 ? -1 : 1, 1);
        ctx.drawImage(sprite, -width / 2, -width * .95, width, width);
        ctx.restore();
        return;
      }
      const levelUp = Spawner.agentLevelUpPose(agentLevelUpPlayback, agent, state.simSeconds, idleMotion.matches);
      const levelUpAnchor = { x: topLeft.x + cell / 2, y: topLeft.y + cell * .82 };
      Spawner.drawAgentLevelUp(ctx, agentLevelUpSprites, levelUp, levelUpAnchor, cell, false);
      drawAgentAppearance(ctx, now, agent, cell, topLeft, renderPosition, birth, objectOutlineColor("agent", agent));
      Spawner.drawAgentLevelUp(ctx, agentLevelUpSprites, levelUp, levelUpAnchor, cell, true);
    }

    function drawAgentAppearance(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor) {
      agent = displayedAgent(agent);
      const attributes = agent.appearanceAttributes || agent.attributes || {};
      const jumping = !birth && !agent.species && (agent.tribe || "bean") === "bean" && !attributes.feet;
      ctx.save();
      if (jumping) {
        const centerX = topLeft.x + cell / 2, floor = topLeft.y + cell * (.5 + AGENT_HEIGHT * .44);
        const pose = agentBodyPose(agent, now, foodDeliveryPose(agent));
        ctx.translate(centerX, floor - agentJumpOffset(agent, renderPosition) * cell);
        ctx.scale(pose.scaleX, pose.scaleY);
        ctx.translate(-centerX, -floor);
      }
      drawAgentAppearanceSurface(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor);
      ctx.restore();
    }

    function drawAgentAppearanceSurface(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor) {
      agent = displayedAgent(agent);
      const attributes = agent.appearanceAttributes || agent.attributes;
      if (!outlineColor || birth || cell < 8 || ctx.canvas !== canvas || (agent.tribe || "bean") !== "bean" || !attributes.feet) {
        drawAgentAppearanceLayer(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor);
        if (!birth && cell >= 8) drawAgentCarrying(ctx, agent, cell, topLeft, renderPosition);
        return;
      }
      const maskWidth = 1024, maskHeight = 1024, maskCell = 512 / AGENT_HEIGHT;
      const anchor = { x: 512, y: 896 };
      if (agentSelectionLayer.width !== maskWidth || agentSelectionLayer.height !== maskHeight) {
        agentSelectionLayer.width = maskWidth; agentSelectionLayer.height = maskHeight;
      }
      const layer = agentSelectionLayer.getContext("2d", { willReadFrequently: true });
      layer.setTransform(1, 0, 0, 1, 0, 0); layer.clearRect(0, 0, maskWidth, maskHeight);
      const origin = { x: anchor.x - maskCell / 2, y: anchor.y - maskCell * (.5 + AGENT_HEIGHT * .44) };
      drawAgentAppearanceLayer(layer, now, agent, maskCell, origin, renderPosition, birth, null);
      const pixels = layer.getImageData(0, 0, maskWidth, maskHeight).data;
      let x0 = maskWidth, y0 = maskHeight, x1 = -1, y1 = -1;
      for (let y = 0; y < maskHeight; y++) for (let x = 0; x < maskWidth; x++) if (pixels[(y * maskWidth + x) * 4 + 3] >= 128) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      if (x1 >= x0 && y1 >= y0) {
        agentSelectionMask.width = x1 - x0 + 5; agentSelectionMask.height = y1 - y0 + 5;
        agentSelectionMask.getContext("2d").drawImage(agentSelectionLayer, x0, y0, x1 - x0 + 1, y1 - y0 + 1,
          2, 2, x1 - x0 + 1, y1 - y0 + 1);
        selectionOutlines.delete(agentSelectionMask);
        const scale = cell / maskCell;
        const floor = topLeft.y + cell * (.5 + AGENT_HEIGHT * .44);
        drawSelectionOutline(agentSelectionMask, topLeft.x + cell / 2 + (x0 - 2 - anchor.x) * scale,
          floor + (y0 - 2 - anchor.y) * scale, agentSelectionMask.width * scale, agentSelectionMask.height * scale, null, outlineColor);
      }
      drawAgentAppearanceLayer(ctx, now, agent, cell, topLeft, renderPosition, birth, null);
      drawAgentCarrying(ctx, agent, cell, topLeft, renderPosition);
    }

    function drawAgentAppearanceLayer(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor) {
      const attributes = agent.appearanceAttributes || agent.attributes || {};
      if (birth || cell < 8 || !Spawner.combatAttributeKeys(attributes).length || !combatAttributeArt.ready(agent.tribe || "bean")) {
        drawAgentAppearanceBody(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor);
        return;
      }
      const pose = Spawner.unitAnimationPose(agent, state.simSeconds);
      const scale = unitAnimationSheets.get(agent.tribe || "bean")?.get(pose?.action || "idle")?.scale || 1;
      const forward = { ...agent, facing: 1, combat: agent.combat ? { ...agent.combat, side: 1 } : null,
        attack: agent.attack ? { ...agent.attack, directionX: 1 } : null };
      const maskCell = 256 / AGENT_HEIGHT;
      const origin = { x: 256 - maskCell / 2, y: 448 - maskCell * (.5 + AGENT_HEIGHT * .44) };
      const sprite = combatAttributeArt.frame(forward, idleMotion.matches ? agent.bornAt || 0 : state.simSeconds, scale, (context, sampled) => {
        const neutral = Spawner.hasCombatEvolution(attributes) && sampled ? { ...forward, attack: null, hurtStartedAt: -Infinity,
          carrying: 0, birth: null, mode: sampled.action === "walk" ? forward.mode : "idle",
          moveDuration: sampled.action === "walk" ? forward.moveDuration : 0 } : forward;
        if (Spawner.hasCombatEvolution(attributes) && sampled && (agent.tribe || "bean") !== "bean" &&
            ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0)) {
          context.drawImage(tribeArt.sprite(agent.tribe, attributes, "full"), 0, 0, 512, 512); return;
        }
        drawAgentAppearanceBody(context, now, neutral, maskCell, origin, renderPosition, birth, null);
      }, context =>
        drawCombatAgentAttributes(context, forward));
      const size = cell * AGENT_HEIGHT * 2;
      const floor = topLeft.y + cell * (.5 + AGENT_HEIGHT * .44);
      const facing = agent.combat ? agent.combat.side === 0 ? -1 : 1 : agent.facing || 1;
      ctx.save(); ctx.translate(topLeft.x + cell / 2, floor); ctx.scale(facing < 0 ? -1 : 1, 1);
      if (outlineColor) drawSelectionOutline(sprite, -size / 2, -size * .875, size, size, null, outlineColor);
      ctx.drawImage(sprite, -size / 2, -size * .875, size, size); ctx.restore();

    }

    function drawCombatAgentAttributes(context, agent) {
      const appearance = { ...(agent.appearanceAttributes || agent.attributes || {}) };
      if (!["feet", "antenna", "strength", "arms"].some(key => appearance[key] > 0)) return;
      if ((agent.tribe || "bean") === "bean") {
        context.save(); context.globalCompositeOperation = "destination-over";
        if (appearance.feet) {
          if (Number.isFinite(agent.x) && Number.isFinite(agent.y)) drawAgentFeet(context, agent, 0, 0, 512, 512, agentWalkPose(agent), null);
          else context.drawImage(composeAgentSprite(appearance, "feet"), 0, 0, 512, 512);
        }
        context.restore();
        context.drawImage(composeAgentSprite(appearance, "attributes-no-feet"), 0, 0, 512, 512);
      }
    }

    function drawAgentCarrying(ctx, agent, cell, topLeft, renderPosition) {
      const appearance = agent.appearanceAttributes || agent.attributes, spriteHeight = cell * AGENT_HEIGHT;
      const centerX = topLeft.x + cell / 2, centerY = topLeft.y + cell / 2;
      const bodyPose = agentAppearanceBodyPose(agent, performance.now()), walk = agentWalkPose(agent);
      const spriteY = centerY - spriteHeight / 2;
      const delivery = agent.foodDelivery;
      const released = delivery && delivery.receivedAt == null &&
        state.simSeconds >= delivery.startedAt + (delivery.arrivesAt - delivery.startedAt) * 0.24;
      if (agent.carrying - (released ? delivery.amount : 0) > 0) {
        const type = agent.carryingType || "honey-mushrooms";
        const sprite = resourceCarrySprites.get(type);
        const placement = foodCarryPlacement(appearance, type);
        const renderScale = Math.max(cell, 6 / Math.max(placement.width, placement.height));
        const transform = ctx.getTransform();
        const displayScale = ctx.canvas === canvas ? Math.hypot(transform.a, transform.b) / viewport.pixelRatio : 1;
        const width = placement.width * renderScale / displayScale, height = placement.height * renderScale / displayScale;
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

    function drawAgentAppearanceBody(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor) {
      if (birth) {
        drawAgentBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
        return;
      }
      const spriteHeight = cell * AGENT_HEIGHT;
      const centerX = topLeft.x + cell / 2;
      const centerY = topLeft.y + cell / 2;
      const appearance = agent.appearanceAttributes || agent.attributes;
      const bodyPose = agentAppearanceBodyPose(agent, now);
      const walk = agentWalkPose(agent);

      if (cell < 8) {
        if (outlineColor) {
          drawSelectionOutline(foodSelectionShape,
            Math.floor(centerX - 1), Math.floor(centerY - 1), 3, 3, null, outlineColor);
        }
        ctx.fillStyle = agent.carrying > 0 ? "#d6b26b" : "#75c4b6";
        ctx.fillRect(
          Math.floor(centerX - 1),
          Math.floor(centerY - 1),
          3,
          3
        );
        return;
      }

      const spriteY = centerY - spriteHeight / 2;

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
      const sprite = agentSprite(agent, "body");
      const animated = drawAgentAnimation(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
      const attacking = !animated && drawAgentAttack(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
      const moving = !animated && !attacking && drawAgentMovement(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
      if (!animated && !attacking && !moving && sprite && sprite.complete !== false && (sprite.naturalWidth || sprite.width) > 0) {
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
    }

    function drawAgentGroups() {
      const cell = state.camera.zoom;
      if (cell < 8) return;
      const groups = new Map();
      for (const agent of visibleAgents()) {
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

    function selectedMovementAgents() {
      const selection = state.selection;
      const agents = selection?.kind === "agent" ? [selection.target] : [];
      return agents.filter(agent => isAgentSelectable(agent) &&
        (displayedAgent(agent).movementPlan || agent.species || displayedAgent(agent).combatTarget));
    }

    function drawSelectedAgentTarget(agent) {
      const target = agent.combatTarget;
      if (!target) return;
      const unit = target.kind === "agent" ? agentById(target.id) : null;
      if (target.kind === "agent" && !isAgentSelectable(unit)) return;
      const foot = .5 + AGENT_HEIGHT * .44;
      const position = interpolatedAgentPosition(agent);
      const destination = unit ? interpolatedAgentPosition(unit) : target;
      const from = worldToScreen(position.x + .5, position.y + foot);
      const to = worldToScreen(destination.x + (unit ? .5 : target.width / 2),
        destination.y + (unit ? foot : target.height / 2));
      const radius = clamp(state.camera.zoom * .13, 6, 12);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff9986";
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(to.x, to.y, radius, radius * .6, 0, 0, Math.PI * 2);
      ctx.moveTo(to.x - radius - 4, to.y);
      ctx.lineTo(to.x + radius + 4, to.y);
      ctx.moveTo(to.x, to.y - radius * .6 - 4);
      ctx.lineTo(to.x, to.y + radius * .6 + 4);
      ctx.stroke();
      ctx.restore();
    }

    function drawSelectedAgentMovement(selectedAgent) {
      const agent = selectedAgent ? displayedAgent(selectedAgent) : null;
      if (!isAgentSelectable(selectedAgent)) return;
      drawSelectedAgentTarget(agent);
      const plan = agent.movementPlan || (agent.species && agent.mode === "walk" &&
        state.simSeconds < agent.moveStartedAt + agent.moveDuration ?
        { destination: { x: agent.x, y: agent.y }, route: [{ x: agent.x, y: agent.y }] } : null);
      if (!plan) return;
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
      return connection.active && welcome.hidden && !codex.open && !endingReport.open && !templateDeleteDialog.open && !combatPanel.open && evolutionPanel.hidden &&
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
    let FOG_CHUNK_COLUMNS = Math.ceil(WORLD_SIZE / FOG_CHUNK_SIZE);
    const fogContext = fogCanvas.getContext("2d");
    let fogPixels = fogContext.createImageData(WORLD_SIZE, WORLD_SIZE);
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
        if (!HAZARD_CODEX.some(hazard => hazard.hazard === kind)) continue;
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
      const elapsedMs = Math.max(0, now - state.lastFrame);
      state.lastFrame = now;
      if (!connection.active || !terrainRendering.ready) { updateAudio(); scheduleRender(); return; }
      updateEndingPresentation(elapsedMs);
      state.simSeconds = state.ending ? state.ending.endedAt : Math.max(state.simSeconds, connection.simSeconds +
        Math.min(0.3, (now - connection.receivedAt) / 1000) - MOVEMENT_DELAY);
      expireClientCorpses();
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
      drawTravelTraceLayer();
      drawWorldBounds();
      drawFlashes(now);
      for (const entry of colonyEntries) drawColonyGround(entry,
        worldToScreen(entry.x, entry.y), COLONY_SIZE * state.camera.zoom, colonyAppearance(entry));
      drawWorldObjects(now);
      drawCombatAgents(now);
      drawAttackImpacts();
      drawCombatDust();
      drawCombatPanel(now);
      drawAgentGroups();
      drawFoodDeliveries(now);
      drawFoodStatus();
      drawBurrowStatus();
      drawFog(now);
      positionHelpTooltip();
      drawColonyImages(now);
      drawAgentAvatars(now);

      scheduleRender();
    }

    function zoomForLayer(layer) {
      const selected = clamp(layer, 0, ZOOM_LAYERS.length - 1);
      const nearLayer = Math.floor(selected);
      const farLayer = Math.min(nearLayer + 1, ZOOM_LAYERS.length - 1);
      const continentZoom = Math.max(MIN_ZOOM,
        Math.min(4, Math.min(viewport.width || 1200, viewport.height || 760) * 0.9 / WORLD_SIZE));
      const nearZoom = ZOOM_LAYERS[nearLayer] ?? continentZoom;
      const farZoom = ZOOM_LAYERS[farLayer] ?? continentZoom;
      return nearZoom * Math.pow(farZoom / nearZoom, selected - nearLayer);
    }

    function syncPortraitZoomControls() {
      const lastLayer = ZOOM_LAYERS.length - 1;
      portraitZoomSlider.max = String(lastLayer);
      portraitZoomSlider.step = String(1 / ZOOM_STEPS_PER_LAYER);
      portraitZoomSlider.value = String(lastLayer - state.camera.layer);
      const label = zoomLayerButtons[Math.round(state.camera.layer)]?.textContent.trim() || "지도";
      portraitZoomSlider.setAttribute("aria-valuetext", label + " 배율");
      portraitZoomIn.disabled = state.camera.layer <= 0;
      portraitZoomOut.disabled = state.camera.layer >= lastLayer;
    }

    function bindPortraitZoomControls() {
      portraitZoomIn.addEventListener("click", () => {
        selectZoomLayer(state.camera.layer - 1 / ZOOM_STEPS_PER_LAYER, viewport.width / 2, viewport.height / 2);
      });
      portraitZoomOut.addEventListener("click", () => {
        selectZoomLayer(state.camera.layer + 1 / ZOOM_STEPS_PER_LAYER, viewport.width / 2, viewport.height / 2);
      });
      portraitZoomSlider.addEventListener("input", () => {
        selectZoomLayer(ZOOM_LAYERS.length - 1 - Number(portraitZoomSlider.value), viewport.width / 2, viewport.height / 2);
      });
      portraitZoomSlider.addEventListener("keydown", event => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) event.stopPropagation();
      });
    }

    function updateZoomLayerButtons() {
      document.getElementById("zoom-layers").style.setProperty("--zoom-layer", state.camera.layer);
      zoomLayerButtons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === state.camera.layer)));
      syncPortraitZoomControls();
    }

    function selectZoomLayer(layer, anchorX, anchorY) {
      const selected = clamp(layer, 0, ZOOM_LAYERS.length - 1);
      if (selected === state.camera.layer) return;
      stopCameraTransition();
      state.camera.layer = selected;
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
      if (zoomTransition) {
        const progress = clamp((now - zoomTransition.startedAt) / 240, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        if (zoomTransition.center) {
          state.camera.x = zoomTransition.center.x + (WORLD_SIZE / 2 - zoomTransition.center.x) * eased;
          state.camera.y = zoomTransition.center.y + (WORLD_SIZE / 2 - zoomTransition.center.y) * eased;
        }
        setZoom(zoomTransition.from * Math.pow(zoomTransition.to / zoomTransition.from, eased),
          zoomTransition.anchorX, zoomTransition.anchorY);
        if (progress === 1) zoomTransition = null;
      }
      audio.setWorldVolume((state.camera.zoom - ZOOM_LAYERS[2]) / (ZOOM_LAYERS[1] - ZOOM_LAYERS[2]));
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
        const agent = agentById(cameraTransition.agentId);
        if (!isAgentSelectable(agent)) {
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
      audio.setWorldVolume((state.camera.zoom - ZOOM_LAYERS[2]) / (ZOOM_LAYERS[1] - ZOOM_LAYERS[2]));
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
      state.camera.layer = INITIAL_ZOOM_LAYER;
      updateZoomLayerButtons();
      clampCamera();
    }

    function moveToColony() {
      state.camera.layer = INITIAL_ZOOM_LAYER;
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
      selectZoomLayer(state.camera.layer + Math.sign(event.deltaY) / ZOOM_STEPS_PER_LAYER, anchorX, anchorY);
    }, { passive: false });

    bindPortraitZoomControls();
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
      const agents = visibleAgents().filter((candidate) => {
        if (!isAgentSelectable(candidate)) return false;
        const fromX = candidate.renderFromX ?? candidate.x, fromY = candidate.renderFromY ?? candidate.y;
        if (world.x < Math.min(candidate.x, fromX, candidate.birth?.fromX ?? fromX) - 6 ||
            world.x > Math.max(candidate.x, fromX, candidate.birth?.fromX ?? fromX) + 6 ||
            world.y < Math.min(candidate.y, fromY, candidate.birth?.fromY ?? fromY) - 6 ||
            world.y > Math.max(candidate.y, fromY, candidate.birth?.fromY ?? fromY) + 6) return false;
        const position = interpolatedAgentPosition(candidate);
        const birth = agentBirthPose(candidate, true);
        if (birth && !birth.unitVisible) return false;
        const appearance = candidate.appearanceAttributes || candidate.attributes;
        const bounds = unitDisplayBounds.get(candidate.species || candidate.tribe || "bean");
        if (bounds && !birth && state.camera.zoom >= 8 &&
            (candidate.species || !Object.values(appearance || {}).some(value => value > 0))) {
          const scale = agentCombatPlacement(candidate)?.scale || 1;
          const centerX = position.x + .5;
          const floor = position.y + .5 + (unitDisplayFloor(candidate) - .5) * scale;
          const left = centerX + bounds.x * scale, top = floor + bounds.y * scale;
          const padding = .04;
          return world.x >= left - padding && world.x <= left + bounds.width * scale + padding &&
            world.y >= top - padding && world.y <= top + bounds.height * scale + padding;
        }
        const jump = birth ? birth.lift : agentJumpOffset(candidate, position);
        const bodyPose = state.camera.zoom < 8 ? { pivot: 0, scaleX: 1, scaleY: 1 } :
          agentBodyPose(candidate, state.lastFrame, foodDeliveryPose(candidate));
        const height = state.camera.zoom < 8 ? 3 / state.camera.zoom : AGENT_HEIGHT * unitDisplayScale(candidate) * (agentCombatPlacement(candidate)?.scale || 1);
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
      }).sort((first, second) => interpolatedAgentPosition(second).y - interpolatedAgentPosition(first).y);
      const selected = state.selection?.kind === "agent" ? agents.indexOf(state.selection.target) : -1;
      const agent = agents[(selected + 1) % agents.length];
      if (agent) return { kind: "agent", target: agent };
      if (colony) return { kind: "colony", target: colony };
      const burrow = state.explored.has(cellY * WORLD_SIZE + cellX) && worldMap.burrows.find(point => point.health > 0 &&
        cellX >= point.x && cellX < point.x + point.width && cellY >= point.y && cellY < point.y + point.height);
      if (burrow) return { kind: "burrow", target: burrow };
      if (food?.amount > 0) return { kind: "food", target: food };
      const corpse = state.corpses.findLast(cell => cell.x === cellX && cell.y === cellY);
      if (corpse) return { kind: "corpse", target: corpse };
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
      const pointer = state.hoverPointer;
      if (!pointer) { state.hover = null; canvas.style.cursor = state.dragging && state.didDrag ? "grabbing" : ""; return; }
      const rect = canvas.getBoundingClientRect();
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

    canvas.addEventListener("pointerup", async (event) => {
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

    for (const surface of [canvas, unitPanel, colonyMenu]) {
      surface.addEventListener("contextmenu", (event) => {
        if (connection.active && !event.target.closest("input, textarea, [contenteditable]")) event.preventDefault();
      });
      surface.addEventListener("pointerup", (event) => {
        if (event.button !== 2 || !connection.active || surface === canvas && state.didDrag ||
            !state.selection && unitPanel.hidden && colonyMenu.hidden || !evolutionPanel.hidden ||
            codex.open || endingReport.open || templateDeleteDialog.open ||
            event.target.closest("input, textarea, [contenteditable]")) return;
        event.preventDefault();
        closeColonyMenu();
        closeUnitPanel();
      });
    }

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
      if (!discoveryToastTimers.has(toast)) return;
      clearTimeout(discoveryToastTimers.get(toast));
      discoveryToastTimers.delete(toast);
      toast.remove();
      showNextDiscoveryToast();
    }

    function clearDiscoveryToasts() {
      discoveryToastQueue.length = 0;
      notifiedCombatIds.clear();
      for (const timer of discoveryToastTimers.values()) clearTimeout(timer);
      discoveryToastTimers.clear();
      discoveryToasts.replaceChildren();
    }

    function focusDiscovery(entry) {
      state.camera.layer = INITIAL_ZOOM_LAYER;
      updateZoomLayerButtons();
      moveCameraTo(entry.x + 0.5, entry.y + 0.5, zoomForLayer(INITIAL_ZOOM_LAYER));
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
      const image = document.createElement("canvas");
      image.className = "object-image";
      image.setAttribute("aria-hidden", "true");
      drawColonyImage(image, entry, performance.now());
      return image;
    }

    function drawColonyImage(image, entry, now) {
      const appearance = colonyAppearance(entry);
      const growth = colonyInactive(entry) ? null : Spawner.nestGrowthFrame(nestGrowthPlayback, entry, state.simSeconds, idleMotion.matches);
      const animation = growth === null ? appearance.animation : colonyGrowthRendering(entry)?.animation;
      const sprite = animation?.sheet || appearance.sprite;
      if (!sprite.complete || !sprite.naturalWidth) return;
      const size = Math.round((Number(image.dataset.size) || 96) * (window.devicePixelRatio || 1));
      if (image.width !== size || image.height !== size) image.width = image.height = size;
      const index = growth ?? Spawner.nestIdleFrame(nestGrowthPlayback, entry, state.simSeconds, idleMotion.matches || colonyInactive(entry)) ??
        (animation?.sheet && !idleMotion.matches && !colonyInactive(entry) ? idleFrameIndex(animation, now, 0) : 0);
      const inactive = colonyInactive(entry), previous = colonyImageFrames.get(image);
      if (previous?.sprite === sprite && previous.index === index && previous.size === size && previous.inactive === inactive) return;
      colonyImageFrames.set(image, { sprite, index, size, inactive });
      const context = image.getContext("2d");
      context.clearRect(0, 0, size, size);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const width = appearance.groundWidth, height = 1 - appearance.top;
      const scale = Math.min(size / width, size / height) * .94;
      const x = (size - width * scale) / 2 - (1 - width) / 2 * scale;
      const y = (size - height * scale) / 2 - appearance.top * scale;
      const placement = animation?.placement || { x: 0, y: 0, width: 1, height: 1 };
      const frameWidth = animation?.sheet ? animation.frameSize : sprite.naturalWidth;
      const frameHeight = animation?.sheet ? animation.frameSize : sprite.naturalHeight;
      context.save();
      if (colonyInactive(entry)) context.filter = "grayscale(1) brightness(0.45)";
      context.drawImage(sprite, index % (animation?.columns || 1) * frameWidth,
        Math.floor(index / (animation?.columns || 1)) * frameHeight, frameWidth, frameHeight,
        x + placement.x * scale, y + placement.y * scale, placement.width * scale, placement.height * scale);
      context.restore();
    }

    function drawColonyImages(now) {
      if (objectPanel.hidden || document.hidden) return;
      const panel = objectPanel.getBoundingClientRect();
      for (const button of colonyList.children) {
        const image = button.querySelector("canvas");
        if (!image) continue;
        const bounds = image.getBoundingClientRect();
        if (!bounds.width || bounds.bottom <= panel.top || bounds.top >= panel.bottom) continue;
        const entry = colonyEntries.find(entry => String(entry.id) === button.dataset.colonyId);
        if (entry) drawColonyImage(image, entry, now);
      }
    }

    function createDiscoveryImage(entry) {
      const key = entry.key.slice(entry.key.indexOf(":") + 1);
      let sprite = entry.kind === "combat" ? agentSprite(entry.agent) : resourceSprites.get(key) || starterObjectSprite;
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

    function positionDiscoveryToasts(sidebarWidth) {
      const style = getComputedStyle(unitPanel);
      const menuStyle = getComputedStyle(colonyMenu);
      const panelWidth = Math.max(parseFloat(style.width), parseFloat(menuStyle.width));
      const availableWidth = window.innerWidth - 2 * (parseFloat(style.right) + panelWidth + 12);
      const infoAbove = availableWidth < 280;
      const width = window.innerWidth <= 640 ? window.innerWidth - 24 :
        infoAbove ? Math.max(144, window.innerWidth - sidebarWidth * 2 - 24) : availableWidth;
      document.documentElement.toggleAttribute("data-discovery-info-above", infoAbove);
      document.documentElement.style.setProperty("--discovery-toasts-area-width", width + "px");
      const inventory = document.getElementById("resource-inventory");
      const bounds = inventory.getBoundingClientRect();
      document.documentElement.style.setProperty("--resource-inventory-height", bounds.height + "px");
      document.documentElement.toggleAttribute("data-resource-info-above", !inventory.hidden && availableWidth < bounds.width);
    }

    function showDiscoveryToast(entry) {
      const toast = document.createElement("div");
      toast.className = "discovery-toast";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "discovery-toast-open";
      const combat = entry.kind === "combat";
      open.setAttribute("aria-label", combat ? "전투 위치로 이동" : entry.name + " · 발견 위치로 이동");
      const label = document.createElement("small");
      label.textContent = combat ? "전투" : "발견";
      open.append(createDiscoveryImage(entry), label);
      open.addEventListener("click", () => {
        dismissDiscoveryToast(toast);
        focusDiscovery(entry);
      });
      const close = document.createElement("button");
      close.type = "button";
      close.className = "discovery-toast-close";
      close.setAttribute("aria-label", combat ? "전투 알림 닫기" : entry.name + " 발견 알림 닫기");
      close.textContent = "×";
      close.addEventListener("click", () => dismissDiscoveryToast(toast));
      toast.append(open, close);
      discoveryToasts.append(toast);
      discoveryToastTimers.set(toast, setTimeout(() => dismissDiscoveryToast(toast), 120000));
      audio.play("discovery", 1);
    }

    function showNextDiscoveryToast() {
      if (discoveryToasts.childElementCount || !discoveryToastQueue.length) return;
      showDiscoveryToast(discoveryToastQueue.shift());
    }

    function updateNotifications(previousKeys, firstSnapshot) {
      if (firstSnapshot) clearDiscoveryToasts();
      const added = firstSnapshot ? [] : state.discoveries.filter(entry => !previousKeys.has(entry.key));
      for (const agent of [...state.agents, ...state.rivals]) {
        const combat = agent.health > 0 && agent.combat;
        if (!combat || notifiedCombatIds.has(combat.id)) continue;
        notifiedCombatIds.add(combat.id);
        if (!firstSnapshot) added.push({ key: combat.id, kind: "combat", name: "전투",
          x: combat.x, y: combat.y, agent });
      }
      discoveryToastQueue.push(...added);
      showNextDiscoveryToast();
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

    const playTime = document.getElementById("play-time");
    const colonySearch = document.getElementById("colony-search");
    const colonyList = document.getElementById("colony-list");
    const colonyResults = document.getElementById("colony-results");
    const colonyPrevious = document.getElementById("colony-previous");
    const colonyNext = document.getElementById("colony-next");
    const colonyPage = document.getElementById("colony-page");
    let colonyListPage = 0;

    function renderColonyList() {
      const seconds = Math.floor(state.ending?.endedAt ?? connection.simSeconds);
      const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map(value => String(value).padStart(2, "0")).join(":");
      if (playTime.textContent !== time) {
        playTime.textContent = time;
        playTime.dateTime = "PT" + seconds + "S";
      }
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

    function closeAgentNameEditor(restoreFocus) {
      agentNameForm.hidden = true;
      agentNameDisplay.hidden = false;
      agentRenameOpen.setAttribute("aria-expanded", "false");
      renamedAgentId = null;
      agentNameStatus.textContent = "";
      agentNameInput.setCustomValidity("");
      if (restoreFocus && !unitPanel.hidden) agentRenameOpen.focus();
    }

    function openAgentNameEditor() {
      const agent = state.selection?.kind === "agent" ? state.selection.target : null;
      if (!agent || !state.agents.includes(agent) || state.ending || connection.busy || !connection.online) return;
      renamedAgentId = agent.id;
      agentNameInput.value = agent.name;
      agentNameInput.setCustomValidity("");
      agentNameStatus.textContent = "";
      agentNameDisplay.hidden = true;
      agentNameForm.hidden = false;
      agentRenameOpen.setAttribute("aria-expanded", "true");
      agentNameInput.focus();
      agentNameInput.select();
    }

    agentRenameOpen.addEventListener("click", openAgentNameEditor);
    agentNameCancel.addEventListener("click", () => closeAgentNameEditor(true));
    agentNameInput.addEventListener("input", () => { agentNameStatus.textContent = ""; });
    agentNameForm.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!connection.busy) closeAgentNameEditor(true);
    });
    agentNameForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (renamedAgentId === null || connection.busy || !agentNameInput.reportValidity()) return;
      const agentId = renamedAgentId, name = agentNameInput.value.trim();
      if (!name) return;
      agentNameStatus.textContent = "";
      nestStatus.textContent = "";
      const result = await sendCommand({ type: "rename", agentId, name });
      if (renamedAgentId !== agentId) return;
      if (result) closeAgentNameEditor(true);
      else { agentNameStatus.textContent = nestStatus.textContent; agentNameInput.focus(); }
    });

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
      if (event.key !== "Escape" || endingReport.open || templateDeleteDialog.open || combatPanel.open) return;
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
    resourceLocation.addEventListener("click", () => {
      if (state.selection?.kind === "colony" && !foreignColonyDetails.hidden) {
        hideHelpTooltip();
        state.camera.layer = INITIAL_ZOOM_LAYER;
        moveToColonyEntry(state.selection.target);
        updateZoomLayerButtons();
        canvas.focus();
        return;
      }
      const cell = selectionTerrainCell();
      if (!cell || (resourceDetails.hidden && terrainDetails.hidden)) return;
      hideHelpTooltip();
      focusDiscovery(cell);
      canvas.focus();
    });
    unitPanel.addEventListener("scroll", hideHelpTooltip);
    objectPanel.addEventListener("scroll", hideHelpTooltip);
    document.getElementById("unit-codex").addEventListener("click", () => {
      const selected = state.selection;
      if (!selected) return;
      if (["terrain", "hazard", "food", "tree"].includes(selected.kind)) {
        const cell = selectionTerrainCell();
        if (cell) openTerrainCodex(cell.x, cell.y);
        return;
      }
      if (selected.kind === "burrow") {
        openCodex("burrow:" + selected.target.type);
        return;
      }
      if (selected.kind === "colony") {
        openCodex("nest:colony");
        return;
      }
      const slots = selected.target.activeSlots || selected.target.slots || [];
      const attribute = slots.find(key => ATTRIBUTES.some(value => value.key === key)) || ATTRIBUTES[0].key;
      openCodex("attribute:" + attribute);
    });
    agentDesign.addEventListener("click", () => {
      const agent = state.selection?.kind === "agent" ? state.selection.target : null;
      if (agent) openUnitDesign({ name: agent.templateName || agent.name, tribe: agent.tribe, slots: [...agent.slots], attributeLevels: { ...agent.attributeLevels }, combatPrimary: agent.combatPrimary }, true);
    });
    agentBirth.addEventListener("click", async () => {
      const template = selectedAgentTemplate();
      if (!template || agentBirth.disabled) return;
      const key = unitPanelSelectionKey;
      unitActionStatus.textContent = "";
      nestStatus.textContent = "";
      const result = await sendCommand({ type: "birth", agentId: state.selection.target.id, combatPrimary: template.combatPrimary });
      if (unitPanelSelectionKey === key) setEvolutionText(unitActionStatus, result ? "새 생명체가 탄생합니다." : nestStatus.textContent);
    });
    function updateCorpseDetails() {
      const corpse = state.selection?.kind === "corpse" ? state.selection.target : null;
      corpseDetails.hidden = !corpse || corpse.kind !== "corpse";
      if (corpseDetails.hidden) return;
      const species = Spawner.ENCOUNTER_TYPES.find(type => type.key === corpse.species);
      const name = corpse.name || species?.name || (corpse.species === "spiny-back-beetle" ? "가시등벌레" : "");
      unitPanelTitle.textContent = name ? name + (Number.isFinite(corpse.level) ? " · Lv." + (corpse.level || 1) : "") + " · 사체" : "사체";
      const attributes = document.getElementById("corpse-attributes");
      const counts = corpse.attributes || {};
      const signature = (corpse.tribe || corpse.species || state.tribe) + ":" + ATTRIBUTES.map(attribute => attribute.key + ":" + (counts[attribute.key] || 0)).join(",");
      if (attributes.dataset.signature !== signature) {
        if (helpTooltipTarget && attributes.contains(helpTooltipTarget)) hideHelpTooltip();
        attributes.dataset.signature = signature;
        const fragment = document.createDocumentFragment();
        for (const attribute of ATTRIBUTES) {
          const level = counts[attribute.key] || 0;
          if (!level) continue;
          const icon = document.createElement("span");
          icon.className = "unit-attribute";
          icon.tabIndex = 0;
          icon.setAttribute("role", "img");
          icon.setAttribute("aria-label", attribute.name + " Lv." + level);
          const image = document.createElement("img");
          image.src = attribute.image;
          image.alt = "";
          const value = document.createElement("small");
          value.textContent = "Lv." + level;
          icon.append(image, value);
          attachAttributeHelp(icon, attribute, level, corpse.tribe || corpse.species || state.tribe);
          fragment.append(icon);
        }
        attributes.replaceChildren(fragment);
      }
      const decay = document.getElementById("corpse-decay");
      const remaining = Math.ceil(Math.max(0, corpse.decaysAt - state.simSeconds));
      decay.hidden = !Number.isFinite(corpse.decaysAt);
      document.getElementById("corpse-decay-value").textContent = decay.hidden ? "" : Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
      decay.dataset.help = "사라짐까지 " + formatLifetime(remaining);
      decay.setAttribute("aria-label", decay.dataset.help);
    }

    function formatLifetime(seconds) {
      const total = Math.max(0, Math.floor(seconds));
      return Math.floor(total / 60) + "분 " + total % 60 + "초";
    }

    function selectedAgentTemplate() {
      const agent = state.selection?.kind === "agent" ? state.selection.target : null;
      return agent && state.agents.includes(agent) ? {
        id: agent.templateId, name: agent.templateName, tribe: agent.tribe, slots: [...agent.slots], combatPrimary: agent.combatPrimary, revision: agent.templateRevision
      } : null;
    }

    function updateTerrainDetails() {
      const kind = state.selection?.kind;
      const cell = kind === "terrain" || kind === "hazard" ? selectionTerrainCell() : null;
      terrainDetails.hidden = !cell;
      if (!cell) return;
      const previousHelp = helpTooltipTarget?.dataset.help;
      const value = cell.hazard || cell.terrain;
      unitPanelTitle.textContent = cell.terrain.name + (cell.hazard ? " · " + cell.hazard.name : "");
      const image = document.getElementById("terrain-image");
      if (image.dataset.key !== value.key) {
        image.dataset.key = value.key;
        const artwork = document.createElement("img");
        artwork.src = assetSource(value.image);
        artwork.alt = "";
        image.replaceChildren(artwork);
      }
      image.dataset.help = cell.terrain.name + "\n" + cell.terrain.description +
        (cell.hazard ? "\n" + cell.hazard.name + " · " + cell.hazard.description : "");
      image.setAttribute("aria-label", image.dataset.help);
      const speed = document.getElementById("terrain-speed");
      const groundSpeed = cell.type === 0 ? 0 : Math.round(Spawner.unitTerrainSpeedMultiplier({ tribe: state.tribe }, cell.type) * 100);
      document.getElementById("terrain-speed-value").textContent = groundSpeed;
      const flyingSpeed = Math.round(Spawner.unitTerrainSpeedMultiplier({ movementType: "flying" }, cell.type) * 100);
      speed.dataset.help = !groundSpeed ? "현재 종족 통행 불가" : "현재 종족 이동 속도 " + groundSpeed + "%" +
        (flyingSpeed !== groundSpeed ? "\n비행 유닛 " + flyingSpeed + "%" : "") +
        (cell.hazard ? "\n" + cell.hazard.name + " · " + cell.hazard.effect : "");
      speed.setAttribute("aria-label", speed.dataset.help);
      const creatures = (worldMap.creatureHabitats || []).filter(habitat => habitat.terrains?.includes(cell.type))
        .map(habitat => Spawner.ENCOUNTER_TYPES.find(type => type.key === habitat.key) ||
          (habitat.key === "spiny-back-beetle" ? { key: habitat.key, name: "가시등벌레", hostile: true } : null)).filter(Boolean);
      const objects = [...terrainCodexResources(cell.type, worldMap.generationVersion),
        ...HAZARD_CODEX.filter(hazard => hazard.terrain === cell.terrain.key), ...creatures];
      document.getElementById("terrain-discoveries").hidden = !objects.length;
      const list = document.getElementById("terrain-objects");
      const signature = objects.map(object => object.key).join(",");
      if (list.dataset.signature !== signature) {
        if (helpTooltipTarget && list.contains(helpTooltipTarget)) hideHelpTooltip();
        list.dataset.signature = signature;
        const fragment = document.createDocumentFragment();
        for (const object of objects) {
          const item = document.createElement("span");
          item.className = "terrain-object";
          item.tabIndex = 0;
          item.setAttribute("role", "img");
          item.dataset.help = object.name;
          item.setAttribute("aria-label", item.dataset.help);
          if (object.hazard) {
            const artwork = document.createElement("img");
            artwork.src = assetSource(object.image);
            artwork.alt = "";
            item.append(artwork);
          } else {
            const sprite = resourceSprites.get(object.key) || encounterSprites.get(object.key) || beetleSprite;
            item.append(createObjectImage(sprite, tribeArt.bounds(sprite, object.key === "tree" ? sprite.naturalHeight : false)));
          }
          item.addEventListener("pointerenter", () => showHelpTooltip(item));
          item.addEventListener("pointerleave", hideHelpTooltip);
          item.addEventListener("focus", () => showHelpTooltip(item));
          item.addEventListener("blur", hideHelpTooltip);
          fragment.append(item);
        }
        list.replaceChildren(fragment);
      }
      resourceLocation.dataset.help = "지형 위치로 이동\n(" + cell.x + ", " + cell.y + ")";
      resourceLocation.setAttribute("aria-label", "지형 위치로 이동");
      if (helpTooltipTarget && terrainDetails.contains(helpTooltipTarget) && helpTooltipTarget.dataset.help !== previousHelp) showHelpTooltip(helpTooltipTarget);
    }

    const resourceImageCache = new Map();

    function createResourceImage(definition) {
      const ratio = window.devicePixelRatio || 1;
      const key = definition.key + ":" + ratio;
      if (resourceImageCache.has(key)) return resourceImageCache.get(key);
      const image = document.createElement("canvas");
      image.className = "object-image";
      image.setAttribute("aria-hidden", "true");
      image.width = Math.round(128 * ratio);
      image.height = Math.round(96 * ratio);
      const sprite = resourceSprites.get(definition.key);
      function draw() {
        const width = definition.key === "tree" ? sprite.naturalHeight : sprite.naturalWidth;
        const height = sprite.naturalHeight;
        if (!width || !height) return;
        const surface = document.createElement("canvas");
        surface.width = width; surface.height = height;
        const context = surface.getContext("2d");
        context.drawImage(sprite, 0, 0, width, height, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let left = width, top = height, right = 0, bottom = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          if (pixels[(y * width + x) * 4 + 3] < 16) continue;
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
        }
        if (right <= left || bottom <= top) return;
        const scale = Math.min(128 / width, 128 / height, 128 / (right - left), 96 / (bottom - top)) * ratio;
        const target = image.getContext("2d");
        target.clearRect(0, 0, image.width, image.height);
        target.imageSmoothingEnabled = true;
        target.imageSmoothingQuality = "high";
        target.drawImage(sprite, 0, 0, width, height,
          image.width / 2 - (left + right) / 2 * scale,
          image.height / 2 - (top + bottom) / 2 * scale, width * scale, height * scale);
      }
      if (sprite.complete) draw();
      else sprite.addEventListener("load", draw, { once: true });
      resourceImageCache.set(key, image);
      return image;
    }

    function updateResourceDetails() {
      const selected = state.selection;
      const tree = selected?.kind === "tree" ? selected.target : null;
      const cell = tree ? foodCellMap.get(tree.column + "," + tree.row) : selected?.kind === "food" ? selected.target : null;
      const definition = cell ? Spawner.resourceDefinition(Spawner.resourceTypeForCell(cell, worldMap)) : tree ? Spawner.resourceDefinition("tree") : null;
      resourceDetails.hidden = !definition;
      if (!definition) return;
      const previousHelp = helpTooltipTarget?.dataset.help;
      unitPanelTitle.textContent = definition.name;
      const image = document.getElementById("resource-image");
      if (image.dataset.key !== definition.key) {
        image.dataset.key = definition.key;
        image.replaceChildren(createResourceImage(definition));
      }
      const required = cell ? Spawner.resourceHarvestRequirements(cell, worldMap, state.tribe) : null;
      const amount = Number(Math.max(0, cell?.amount || 0).toFixed(1));
      const capacity = Math.max(amount, Number((cell?.initialAmount ?? amount).toFixed(1)));
      const seconds = definition.harvestLocked || !cell ? null : Spawner.resourceHarvestSeconds(definition.key, worldMap);
      const amountElement = document.getElementById("resource-amount");
      document.getElementById("resource-amount-value").textContent = amount;
      document.getElementById("resource-capacity").textContent = "/" + capacity;
      amountElement.dataset.wide = String(String(amount).length + String(capacity).length > 4);
      amountElement.dataset.help = "남은 " + definition.name + " " + amount + "개 / 처음 자원 " + capacity + "개";
      amountElement.setAttribute("aria-label", amountElement.dataset.help);
      image.dataset.help = definition.name;
      image.setAttribute("aria-label", definition.name);
      let harvest = resourceDetails.querySelector(".resource-harvest");
      if (!harvest) {
        harvest = document.createElement("div");
        harvest.className = "resource-harvest";
        const time = document.createElement("span");
        time.className = "resource-harvest-time";
        time.append(document.querySelector("#corpse-decay svg").cloneNode(true), document.createElement("strong"));
        attachObjectHelp(time, "");
        const conditions = document.createElement("div");
        conditions.className = "resource-harvest-conditions";
        harvest.append(time, conditions);
        resourceDetails.append(harvest);
      }
      const time = harvest.querySelector(".resource-harvest-time");
      time.querySelector("strong").textContent = seconds === null ? "—" : seconds;
      time.dataset.help = "채집 시간 · " + (seconds === null ? "—" : "1개당 " + seconds + "초");
      time.setAttribute("aria-label", time.dataset.help);
      const boost = required !== null && !Object.values(required).some(value => value > 0);
      const signature = definition.key + ":" + boost + ":" + (required === null);
      const conditions = harvest.querySelector(".resource-harvest-conditions");
      if (conditions.dataset.signature !== signature) {
        if (helpTooltipTarget && conditions.contains(helpTooltipTarget)) hideHelpTooltip();
        conditions.dataset.signature = signature;
        conditions.replaceChildren();
        for (const key of definition.requirements) {
          const attribute = ATTRIBUTES.find(attribute => attribute.key === key);
          const icon = document.createElement("span");
          icon.className = "resource-harvest-condition";
          const artwork = document.createElement("img");
          artwork.src = attribute.image;
          artwork.alt = "";
          const badge = boost ? document.createElement("small") : createDesignLock();
          badge.classList.add("resource-condition-badge");
          if (boost) badge.textContent = "↑";
          icon.append(artwork, badge);
          attachObjectHelp(icon, (boost ? "채집 속도 증가" : "채집 조건") + " · " + attribute.name);
          conditions.append(icon);
        }
      }
      resourceLocation.dataset.help = "자원 위치로 이동\n(" + (tree?.column ?? cell.x) + ", " + (tree?.row ?? cell.y) + ")";
      resourceLocation.setAttribute("aria-label", "자원 위치로 이동");
      if (helpTooltipTarget && resourceDetails.contains(helpTooltipTarget) && helpTooltipTarget.dataset.help !== previousHelp) showHelpTooltip(helpTooltipTarget);
    }

    function createBurrowImage(type, size) {
      const { sprite, crop } = burrowAppearances.get(type);
      const image = document.createElement("canvas");
      image.className = "burrow-codex-image";
      image.width = image.height = Math.round(size * (window.devicePixelRatio || 1));
      function draw() {
        const scale = Math.min(image.width / crop.width, image.height / crop.height) * .94;
        image.getContext("2d").drawImage(sprite, crop.x, crop.y, crop.width, crop.height,
          (image.width - crop.width * scale) / 2, (image.height - crop.height * scale) / 2,
          crop.width * scale, crop.height * scale);
      }
      if (sprite.complete && sprite.naturalWidth) draw();
      else sprite.addEventListener("load", draw, { once: true });
      image.setAttribute("role", "img");
      image.setAttribute("aria-label", BURROW_CODEX.find(value => value.key === type).name);
      return image;
    }

    function updateBurrowDetails() {
      const target = state.selection?.kind === "burrow" ? state.selection.target : null;
      const value = target && BURROW_CODEX.find(value => value.key === target.type);
      burrowDetails.hidden = !value || target.health <= 0;
      if (burrowDetails.hidden) return;
      let overview = burrowDetails.firstElementChild;
      if (!overview) {
        overview = document.createElement("div"); overview.className = "building-overview";
        const picture = document.createElement("span"); picture.className = "building-picture"; picture.tabIndex = 0;
        const health = document.createElement("span"); health.className = "building-health"; health.tabIndex = 0;
        health.append(Spawner.createHealthIcon(assetSource));
        const quantity = document.createElement("span"); quantity.className = "building-health-value";
        quantity.append(document.createElement("strong"), document.createElement("span"));
        health.append(quantity);
        for (const element of [picture, health]) {
          element.addEventListener("pointerenter", () => showHelpTooltip(element));
          element.addEventListener("pointerleave", hideHelpTooltip);
          element.addEventListener("focus", () => showHelpTooltip(element));
          element.addEventListener("blur", hideHelpTooltip);
        }
        overview.append(picture, health); burrowDetails.append(overview);
      }
      const previousHelp = helpTooltipTarget?.dataset.help;
      unitPanelTitle.textContent = value.name;
      const picture = overview.querySelector(".building-picture");
      const imageKey = target.type + ":" + (window.devicePixelRatio || 1);
      if (picture.dataset.key !== imageKey) {
        picture.replaceChildren(createBurrowImage(target.type, 128));
        picture.dataset.key = imageKey;
      }
      picture.dataset.help = value.name + "\n" + value.description;
      picture.setAttribute("aria-label", picture.dataset.help);
      const health = overview.querySelector(".building-health"), maximum = target.maxHealth || value.health;
      health.querySelector("strong").textContent = Math.ceil(target.health);
      health.querySelector(".building-health-value > span").textContent = "/" + maximum;
      health.dataset.help = "체력 " + Math.ceil(target.health) + "/" + maximum;
      health.setAttribute("aria-label", health.dataset.help);
      if (helpTooltipTarget && burrowDetails.contains(helpTooltipTarget) && previousHelp !== helpTooltipTarget.dataset.help) showHelpTooltip(helpTooltipTarget);
    }

    function colonyInfoEntry() {
      return state.selection?.kind === "colony" ? state.selection.target :
        colonyEntries.find(entry => entry.id === connection.colonyId) || colonyEntries[0] || null;
    }

    function createColonyInfoImage(entry, size) {
      const image = document.createElement("canvas");
      image.className = "colony-info-image";
      image.dataset.size = size;
      image.setAttribute("role", "img");
      image.setAttribute("aria-label", entry?.name || COLONY_CODEX.name);
      if (entry) {
        drawColonyImage(image, entry, performance.now());
        const appearance = colonyAppearance(entry), sprite = appearance.animation?.sheet || appearance.sprite;
        if (!sprite.complete) sprite.addEventListener("load", () => drawColonyImage(image, entry, performance.now()), { once: true });
      }
      return image;
    }

    function updateForeignColonyDetails() {
      const entry = state.selection?.kind === "colony" ? state.selection.target : null;
      foreignColonyDetails.hidden = !entry || entry.id === connection.colonyId;
      if (foreignColonyDetails.hidden) return;
      resourceLocation.dataset.help = resourceLocationHelp;
      resourceLocation.setAttribute("aria-label", resourceLocationHelp);
      let overview = foreignColonyDetails.firstElementChild;
      if (!overview) {
        overview = document.createElement("div"); overview.className = "building-overview";
        const picture = document.createElement("span"); picture.className = "building-picture"; picture.tabIndex = 0;
        const health = document.createElement("span"); health.className = "building-health"; health.tabIndex = 0;
        health.append(Spawner.createHealthIcon(assetSource));
        const quantity = document.createElement("span"); quantity.className = "building-health-value";
        quantity.append(document.createElement("strong"), document.createElement("span"));
        health.append(quantity);
        for (const element of [picture, health]) {
          element.addEventListener("pointerenter", () => showHelpTooltip(element));
          element.addEventListener("pointerleave", hideHelpTooltip);
          element.addEventListener("focus", () => showHelpTooltip(element));
          element.addEventListener("blur", hideHelpTooltip);
        }
        overview.append(picture, health); foreignColonyDetails.append(overview);
      }
      const level = entry.nestLevel || 1, tribe = Spawner.PLAYER_TRIBES.find(tribe => tribe.key === entry.tribe);
      const previousHelp = helpTooltipTarget?.dataset.help;
      unitPanelTitle.textContent = entry.name + " · Lv." + level;
      const picture = overview.querySelector(".building-picture");
      const imageKey = entry.id + ":" + entry.tribe + ":" + (window.devicePixelRatio || 1);
      if (picture.dataset.key !== imageKey) {
        picture.replaceChildren(createColonyInfoImage(entry, 128));
        picture.dataset.key = imageKey;
      } else drawColonyImage(picture.firstElementChild, entry, performance.now());
      picture.dataset.help = (tribe?.name || "새싹콩") + " · 군락 #" + entry.id + "\n" + COLONY_CODEX.description;
      picture.setAttribute("aria-label", picture.dataset.help);
      const health = overview.querySelector(".building-health");
      const current = Math.ceil(Math.max(0, entry.nestHealth ?? NEST_LEVELS[level - 1].health));
      const maximum = entry.nestMaxHealth ?? NEST_LEVELS[level - 1].health;
      health.querySelector("strong").textContent = current;
      health.querySelector(".building-health-value > span").textContent = "/" + maximum;
      health.dataset.help = "체력 " + current + "/" + maximum;
      health.setAttribute("aria-label", health.dataset.help);
      if (helpTooltipTarget && foreignColonyDetails.contains(helpTooltipTarget) && previousHelp !== helpTooltipTarget.dataset.help) showHelpTooltip(helpTooltipTarget);
    }

    function updateUnitPanel() {
      const agent = state.selection?.kind === "agent" ? state.selection.target : null;
      const target = state.selection?.target;
      const key = target ? state.selection.kind + ":" + (target.id ?? (target.column ?? target.x) + "," + (target.row ?? target.y)) : null;
      if (key !== unitPanelSelectionKey) {
        closeAgentNameEditor(false);
        unitActionStatus.textContent = "";
        if (helpTooltipTarget && unitPanel.contains(helpTooltipTarget)) hideHelpTooltip();
      }
      unitPanelSelectionKey = key;
      updateCorpseDetails();
      updateTerrainDetails();
      updateResourceDetails();
      updateBurrowDetails();
      updateForeignColonyDetails();
      document.getElementById("unit-codex").hidden = !!agent?.species;
      resourceLocation.hidden = resourceDetails.hidden && terrainDetails.hidden && foreignColonyDetails.hidden;
      agentDetails.hidden = !agent;
      agentRenameOpen.hidden = !agent || !state.agents.includes(agent);
      agentRenameOpen.disabled = !!state.ending || connection.busy || !connection.online;
      agentNameInput.disabled = connection.busy;
      agentNameSave.disabled = connection.busy || !connection.online;
      agentNameCancel.disabled = connection.busy;
      agentBirth.hidden = !agent || !state.agents.includes(agent);
      agentDesign.hidden = !agent || !state.agents.includes(agent);
      unitPanel.hidden = !agent && corpseDetails.hidden && terrainDetails.hidden && resourceDetails.hidden && burrowDetails.hidden && foreignColonyDetails.hidden;
      if (unitPanel.hidden) return;
      collapseControlsGuide();
      if (!agent) return;
      unitPanelTitle.textContent = agent.name + " · Lv." + (agent.level || 1);
      const attributes = document.getElementById("agent-attributes");
      const slots = agent.activeSlots || agent.slots || [];
      const signature = JSON.stringify([agent.tribe, agent.species, slots, agent.attributeLevels, agent.attributes]);
      if (attributes.dataset.signature !== signature) {
        attributes.dataset.signature = signature;
        const fragment = document.createDocumentFragment();
        for (const slot of slots) {
          const attribute = ATTRIBUTES.find(candidate => candidate.key === slot);
          if (!attribute) continue;
          const icon = document.createElement("span");
          icon.className = "unit-attribute";
          icon.tabIndex = 0;
          icon.setAttribute("role", "img");
          icon.setAttribute("aria-label", attribute.name);
          const image = document.createElement("img");
          image.src = attribute.image;
          image.alt = "";
          const level = document.createElement("small");
          level.textContent = "Lv." + (agent.attributes[slot] || 1);
          icon.append(image, level);
          attachAttributeHelp(icon, attribute, agent.attributes[slot] || 1, agent.tribe || agent.species || state.tribe);
          fragment.append(icon);
        }
        if (helpTooltipTarget && attributes.contains(helpTooltipTarget)) hideHelpTooltip();
        attributes.replaceChildren(fragment);
      }
      updateCombatUnitStats(agent);
      const template = selectedAgentTemplate();
      const cost = template ? birthCost(template, state.tribe) : Infinity;
      agentBirth.disabled = !!state.ending || !template || connection.busy || !connection.online || !hasBirthplace() || state.agents.filter(agent => agent.health > 0).length >= unitCapacity() || state.evolutionPoints < cost ||
        template.slots.length > slotCapacity() || template.slots.some(key => !isAttributeUnlocked(key, state.nestLevel, state.tribe));
      const help = "같은 설계로 탄생" + (Number.isFinite(cost) ? "\n진화 포인트 " + cost + "점" : "");
      const hint = unitActionStatus.textContent || (connection.busy ? "처리 중입니다." : !connection.online ? "연결을 확인해 주세요." :
        !hasBirthplace() ? "살아 있는 둥지가 없습니다." : state.evolutionPoints < cost ? "진화 포인트가 부족합니다." :
        agentBirth.disabled ? "둥지에서 설계를 확인해 주세요." : "");
      const helpChanged = agentBirth.dataset.help !== help || agentBirth.dataset.helpHint !== hint;
      agentBirth.dataset.help = help;
      agentBirth.dataset.helpHint = hint;
      if (helpChanged && helpTooltipTarget === agentBirth) showHelpTooltip(agentBirth);
    }

    const AGENT_MODE_LABELS = {
      build: "건물 변태", transform: "변태 중", search: "탐색", approach: "자원 접근", harvest: "채집",
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
      const agent = agentById(state.camera.followAgentId);
      if (!isAgentSelectable(agent)) {
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
    const agentListButtons = new Map();

    function updatePanelText(node, value) {
      const text = String(value);
      if (node.textContent !== text) node.textContent = text;
    }

    function unitListEntries() {
      return [...state.agents, ...state.corpses.filter(corpse => corpse.colonyId === connection.colonyId)];
    }

    function invalidateAgentAvatarLayout() {
      for (const avatar of agentAvatars.values()) avatar.bounds = null;
    }

    objectPanel.addEventListener("scroll", invalidateAgentAvatarLayout, { passive: true });
    const agentAvatarResize = new ResizeObserver(invalidateAgentAvatarLayout);
    agentAvatarResize.observe(objectPanel);
    for (const section of objectPanel.children) agentAvatarResize.observe(section);

    function drawAgentAvatars(now) {
      if (objectPanel.hidden || document.hidden) return;
      const panel = objectPanel.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const frame = Math.floor(now / (1000 / 60) + 1e-6);
      for (const agent of unitListEntries()) {
        const avatar = agentAvatars.get(agent.id);
        if (!avatar || avatar.frame === frame && avatar.pixelRatio === ratio && avatar.bounds) continue;
        const bounds = avatar.bounds || (avatar.bounds = avatar.canvas.getBoundingClientRect());
        if (!bounds.width || bounds.bottom <= panel.top || bounds.top >= panel.bottom) continue;
        avatar.frame = frame;
        avatar.pixelRatio = ratio;
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
        const scale = unitDisplayScale(agent);
        if (agent.kind === "corpse") {
          if (drawAgentCorpse(context, agent, bounds.width / 2, bounds.height * .93, size * .75 * scale, null, 1)) continue;
          context.save();
          context.filter = "grayscale(0.8)";
          context.globalAlpha = 0.6;
          const sprite = agentSprite(agent);
          context.drawImage(sprite, (bounds.width - size * 0.9) / 2, (bounds.height - size * 0.9) / 2, size * 0.9, size * 0.9);
          context.restore();
          continue;
        }
        const birth = agentBirthPose(agent, true);
        const cell = size * (birth?.seedVisible ? .38 : .75) * scale;
        const topLeft = { x: (bounds.width - cell) / 2, y: bounds.height * .93 - cell * (.5 + AGENT_HEIGHT * .44) };
        const levelUp = Spawner.agentLevelUpPose(agentLevelUpPlayback, agent, state.simSeconds, idleMotion.matches);
        const levelUpAnchor = { x: bounds.width / 2, y: bounds.height * .88 };
        Spawner.drawAgentLevelUp(context, agentLevelUpSprites, levelUp, levelUpAnchor, size * .55, false);
        drawAgentAppearance(context, now, agent, cell, topLeft, interpolatedAgentPosition(agent), birth, null);
        Spawner.drawAgentLevelUp(context, agentLevelUpSprites, levelUp, levelUpAnchor, size * .55, true);
      }
    }

    function updateAgentList() {
      updateUnitPanel();
      const entries = unitListEntries();
      const corpseCount = entries.length - state.agents.length;
      updatePanelText(agentListCount, state.agents.filter(agent => agent.health > 0).length + "/" + unitCapacity() + (corpseCount ? " · 사체 " + corpseCount : ""));
      const signature = entries.map((agent) => agent.id).join(",");
      if (signature !== renderedAgentListSignature) {
        const active = new Set(entries.map(agent => String(agent.id)));
        for (const [id, entry] of agentListButtons) {
          if (active.has(id)) continue;
          if (helpTooltipTarget && entry.button.contains(helpTooltipTarget)) hideHelpTooltip();
          entry.button.remove(); agentListButtons.delete(id); agentAvatars.delete(id);
        }
        for (const agent of entries) {
          const id = String(agent.id);
          if (agentListButtons.has(id)) continue;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "agent-item";
          button.dataset.agentId = agent.id.toString();
          button.innerHTML =
            "<canvas data-agent-avatar aria-hidden=\"true\"></canvas>" +
            "<strong data-agent-name></strong>" +
            "<span data-agent-mode></span>" +
            "<small data-agent-carry></small>";
          const avatar = button.querySelector("[data-agent-avatar]");
          agentAvatars.set(agent.id, { canvas: avatar, context: avatar.getContext("2d") });
          button.addEventListener("click", () => {
            hideHelpTooltip();
            const current = unitListEntries().find(candidate => candidate.id === button.dataset.agentId);
            if (current?.kind === "corpse") {
              selectObject("corpse", current);
              moveCameraTo(current.x + 0.5, current.y + 0.5, zoomForLayer(INITIAL_ZOOM_LAYER));
            } else if (current) selectAgent(current);
          });
          agentListButtons.set(id, { button, name: button.querySelector("[data-agent-name]"),
            mode: button.querySelector("[data-agent-mode]"), carry: button.querySelector("[data-agent-carry]") });
        }
        let next = agentList.firstElementChild;
        for (const agent of entries) {
          const button = agentListButtons.get(String(agent.id)).button;
          if (button === next) next = next.nextElementSibling;
          else agentList.insertBefore(button, next);
        }
        invalidateAgentAvatarLayout();
        renderedAgentListSignature = signature;
      }

      for (const agent of entries) {
        const entry = agentListButtons.get(String(agent.id));
        if (!entry) continue;
        const button = entry.button;
        const corpse = agent.kind === "corpse";
        button.className = "agent-item" + (corpse ? " is-corpse" : "") +
          (isSelectedObject(corpse ? "corpse" : "agent", agent) ? " is-selected" : "");
        if (corpse) {
          button.setAttribute("aria-label", agent.name + "의 사체 위치 보기");
          updatePanelText(entry.name, agent.name);
          updatePanelText(entry.mode, "Lv." + (agent.level || 1) + " · 사체");
          entry.mode.title = "";
          updatePanelText(entry.carry, "");
          continue;
        }

        button.setAttribute("aria-label", agent.name + " 선택");
        updatePanelText(entry.name, agent.name);
        updatePanelText(entry.mode, "Lv." + (agent.level || 1) + " · " + (AGENT_MODE_LABELS[agent.mode] || agent.mode));
        entry.mode.title = "";
        updatePanelText(entry.carry, (agent.carrying > 0 ? Spawner.resourceDefinition(agent.carryingType || "honey-mushrooms").name + " " : "운반 ") +
          agent.carrying + "/" + (Spawner.unitCarryCapacity(agent, agent.carryingType) + (hasSynergy(agent.attributes, ["strength", "strength"]) ? 4 : 0)));

      }

    }

    const ATTRIBUTE_SYMBOLS = { antenna: "DesignAssets/Attributes/SilhouettesV2/23-y-branch.png",
      strength: "DesignAssets/Attributes/SilhouettesV2/24-horseshoe.png",
      feet: "DesignAssets/Attributes/SilhouettesV2/27-chevron.png",
      blade: "DesignAssets/Attributes/CombatDnaV1/blade.png",
      piercing: "DesignAssets/Attributes/CombatDnaV1/piercing.png",
      carapace: "DesignAssets/Attributes/CombatDnaV1/carapace.png" };
    const ATTRIBUTE_IMAGES = Object.fromEntries(ATTRIBUTES.map(attribute =>
      [attribute.key, assetSource(ATTRIBUTE_SYMBOLS[attribute.key])]));
    function hasBirthplace() {
      return state.nestHealth !== 0;
    }

    function unitCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].unitCapacity;
    }

    function slotCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].slotCapacity;
    }

    function pointCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].pointCapacity;
    }

    function upgradeCost() {
      return nestUpgradeCost(state.nestLevel, state.tribe);
    }

    function agentAppearanceKey(attributes) {
      return [attributes.strength ?? attributes.arms ?? 0, attributes.feet || 0,
        attributes.antenna || 0].join(":");
    }

    function agentSpriteLayers(attributes) {
      return ["body", ...(attributes.feet ? ["feet-left", "feet-right"] : []),
        ...(attributes.antenna ? ["antenna"] : ["sprout-left", "sprout-right", "sprout-stem"])];
    }

    function prepareAgentTemplate(template) {
      if (template.slots.some(key => Spawner.COMBAT_ATTRIBUTE_KEYS.includes(key)) && !combatAttributeArt.ready(template.tribe || "bean")) {
        return combatAttributeArt.prepare(template.tribe || "bean").then(() => prepareAgentTemplate(template));
      }
      if (template.tribe && template.tribe !== "bean") {
        const tribe = Spawner.PLAYER_TRIBES.find(entry => entry.key === template.tribe);
        return Promise.all([prepareAgentMovement(tribe), tribe.key === "spore" ? prepareSporeBirth() : tribe.key === "spring" ? springBirthSheet.decode() : tribe.key === "pebble" ? pebbleBirthSheet.decode() : null]).then(() => {
          for (let count = Math.min(1, template.slots.length); count <= template.slots.length; count++) {
            const attributes = attributeCounts(template.slots.slice(0, count), template.attributeLevels);
            for (const layer of [...agentSpriteLayers(attributes), "full"]) selectionContour(agentSprite({ tribe: tribe.key, attributes }, layer), null);
          }
        });
      }
      const tasks = [];
      for (let count = Math.min(1, template.slots.length); count <= template.slots.length; count++) {
        const attributes = attributeCounts(template.slots.slice(0, count), template.attributeLevels);
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
      if ((!layer || ["full", "body"].includes(layer)) && (agent.tribe || "bean") !== "bean" &&
          Spawner.hasCombatEvolution(attributes) && ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) && combatAttributeArt.ready(agent.tribe)) {
        const body = tribeArt.sprite(agent.tribe, attributes, layer || "full");
        const sprite = combatAttributeArt.frame({ ...agent, health: 1, birth: null, attack: null, hurtStartedAt: -Infinity, moveDuration: 0 }, 0, 1, context => context.drawImage(body, 0, 0, 512, 512));
        agentSpriteSet.add(sprite); return sprite;
      }
      if ((!layer || ["full", "body"].includes(layer)) && Spawner.hasCombatEvolution(attributes) && combatAttributeArt.ready(agent.tribe || "bean")) {
        const sprite = combatAttributeArt.portrait(agent, context => drawCombatAgentAttributes(context, agent));
        if (sprite) { agentSpriteSet.add(sprite); return sprite; }
      }
      if (agent?.tribe && agent.tribe !== "bean") {
        const sprite = tribeArt.sprite(agent.tribe, attributes, layer || "full");
        agentSpriteSet.add(sprite);
        return sprite;
      }
      const counts = { strength: attributes.strength ?? attributes.arms ?? 0,
        feet: attributes.feet || 0, antenna: attributes.antenna || 0 };
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

    function agentBodyLift(attributes) {
      if (!attributes.feet) return 0;
      const height = Spawner.sproutRootGeometry(attributes.feet).height;
      const lift = 426 - 512 * .94 + height * .88;
      return lift;
    }

    function composeAgentAntennae(context, attributes) {
      const count = attributes.antenna;
      if (!count) return;
      const lift = agentBodyLift(attributes);
      const part = agentParts.get("antenna-" + (count === 1 ? 1 : 2));
      const width = count === 1 ? 196 : 344 + (count - 2) * 16;
      const height = width * part.naturalHeight / part.naturalWidth;
      context.drawImage(part, 256 - width / 2, 260 - lift - height, width, height);
    }

    function composeAgentBaseFeet(context, attributes, layer) {
      if (attributes.feet) return;
      const sourceHeight = 153;
      const top = 110, height = 350, y = 136;
      const part = agentBaseParts.get("green-foot");
      for (const [index, x] of [16.5, 66.5].entries()) {
        if (layer === "feet-left" && index || layer === "feet-right" && !index) continue;
        context.drawImage(part, 136 + x * 240 / 104, top + y * height / sourceHeight,
          20 * 240 / 104, 16 * height / sourceHeight);
      }
    }

    function composeAgentSprite(attributes, layer) {
      const expression = layer === "body-half" ? "half" : layer === "body-closed" ? "closed" : "open";
      if (layer === "body-half" || layer === "body-closed") layer = "body";
      const portraitPadding = 0;
      const sprite = document.createElement("canvas");
      const resolution = Math.max(512, Math.ceil(ZOOM_LAYERS[0] * AGENT_HEIGHT * (window.devicePixelRatio || 1) * 2 / 256) * 256);
      sprite.width = sprite.height = resolution * (512 + portraitPadding * 2) / 512;
      const context = sprite.getContext("2d");
      context.scale(resolution / 512, resolution / 512);
      context.translate(portraitPadding, portraitPadding);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const lift = agentBodyLift(attributes);
      if (layer === "sprout-left" || layer === "sprout-right" || layer === "sprout-stem") {
        if (!attributes.antenna) context.drawImage(agentBaseParts.get(layer), 136, 110 - lift, 240, 350);
        return sprite;
      }
      if (layer === "antenna") {
        composeAgentAntennae(context, attributes);
        return sprite;
      }
      if (attributes.feet && layer !== "body" && layer !== "attributes-no-feet") {
        const { width, height } = Spawner.sproutRootGeometry(attributes.feet);
        const part = agentParts.get("feet-1");
        if (layer === "feet-left" || layer === "feet-right") {
          const right = layer === "feet-right" ? 1 : 0;
          context.drawImage(part, right * part.naturalWidth / 2, 0, part.naturalWidth / 2, part.naturalHeight,
            256 - width / 2 + right * width / 2, 512 * 0.94 - height, width / 2, height);
        } else sproutRoots.drawRig(context, agentParts.get("root-rig"), attributes.feet, null,
          { rotation: 0, bob: 0, pivot: 460 - lift }, null);
      }
      if (["feet", "feet-left", "feet-right"].includes(layer)) {
        if (!attributes.feet) composeAgentBaseFeet(context, attributes, layer);
        return sprite;
      }
      if (attributes.antenna && layer !== "body") composeAgentAntennae(context, attributes);
      if (layer !== "attributes" && layer !== "attributes-no-feet") {
        context.save();
          if (layer !== "body" && !attributes.antenna)
            for (const name of ["sprout-left", "sprout-right", "sprout-stem"])
              context.drawImage(agentBaseParts.get(name), 136, 110 - lift, 240, 350);
          context.drawImage(agentBaseParts.get("body"),
            136, 110 - lift, 240, 350);
        context.restore();
        composeAgentBaseFeet(context, attributes, layer);
      }
      if (attributes.strength) {
        const width = (344 + (attributes.strength - 1) * 24) * 0.78;
        const height = (142 + (attributes.strength - 1) * 12) * 0.78;
        context.drawImage(agentParts.get("strength-" + (attributes.strength === 1 ? 1 : 2)),
          256 - width / 2, 460 - lift - height, width, height);
      }
      return sprite;
    }

    function agentSpeed(agent) {
      return unitTravelSpeed(agent, agent.carrying);
    }

    function drawAgentCorpse(context, corpse, x, floor, cell, outlineColor, opacity) {
      if (corpse.species) return drawCreatureCorpse(context, corpse, x, floor, cell, outlineColor, opacity);
      const appearance = corpse.appearanceAttributes || corpse.attributes || {};
      if (Spawner.hasCombatEvolution(appearance) && combatAttributeArt.ready(corpse.tribe || "bean")) {
        const normal = Object.fromEntries(Object.entries(appearance).filter(([key]) => !Spawner.COMBAT_ATTRIBUTE_KEYS.includes(key)));
        const sprite = combatAttributeArt.frame({ ...corpse, health: 0 }, corpsePlaybackTime(), 1, target =>
          target.drawImage(agentSprite({ ...corpse, health: 1, birth: null, attributes: normal, appearanceAttributes: normal }, "full"), 0, 0, 512, 512), target => drawCombatAgentAttributes(target, corpse));
        if (sprite) {
          const size = cell * AGENT_HEIGHT * 2;
          context.save(); context.translate(x, floor); context.globalAlpha *= opacity;
          if (outlineColor) drawSelectionOutline(sprite, -size / 2, -size * .875, size, size, null, outlineColor);
          context.drawImage(sprite, -size / 2, -size * .875, size, size); context.restore(); return true;
        }
      }
      const index = agentDeathFrame(corpse, corpsePlaybackTime());
      if (index < 0) return false;
      const attributes = corpse.appearanceAttributes || corpse.attributes || {};
      const animation = Spawner.agentDeathAnimation(corpse);
      const entry = unitAnimationSheets.get(corpse.tribe || "bean")?.get("death");
      if (!entry?.sprite.complete || !entry.sprite.naturalWidth) return true;
      const frame = idleMotion.matches ? animation.frameCount - 1 : index;
      const attributeFrame = ((corpse.tribe || "bean") === "bean" ||
        !["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) ? null :
        tribeArt.animationFrame(corpse, entry.sprite, animation, frame, "death", corpsePlaybackTime()));
      const sheet = attributeFrame || entry.sprite;
      const frameSize = attributeFrame ? sheet.width : animation.frameSize;
      const padding = (frameSize - animation.frameSize) / 2;
      const size = cell * AGENT_HEIGHT * entry.scale * frameSize / animation.frameSize;
      const left = -size * (animation.pivotX + padding) / frameSize;
      const top = -size * (animation.pivotY + padding) / frameSize;
      const sourceX = attributeFrame ? 0 : frame % animation.columns * animation.frameSize;
      const sourceY = attributeFrame ? 0 : Math.floor(frame / animation.columns) * animation.frameSize;
      const decay = Number.isFinite(corpse.decaysAt) ?
        clamp((state.simSeconds - corpse.diedAt) / (corpse.decaysAt - corpse.diedAt), 0, 1) : 0;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.globalAlpha *= opacity * (1 - decay * 0.4);
      context.filter = "saturate(" + (1 - decay * 0.8) + ")";
      context.translate(x, floor);
      context.drawImage(sheet, sourceX, sourceY, frameSize, frameSize,
        left, top, size, size);
      if (outlineColor) drawSelectionOutline(sheet, left, top, size, size,
        { owner: sheet, size: frameSize, index: attributeFrame ? 0 : frame, x: sourceX, y: sourceY }, outlineColor);
      context.restore();
      return true;
    }

    function drawCorpseGroundShadow(corpse, point) {
      const contact = unitCorpseContacts[corpse.species || corpse.tribe || "bean"];
      const age = corpsePlaybackTime() - corpse.diedAt;
      const progress = contact.duration && Number.isFinite(age) ? clamp(age / contact.duration, 0, 1) : 1;
      const x = contact.start.x + (contact.end.x - contact.start.x) * progress;
      const y = contact.start.y + (contact.end.y - contact.start.y) * progress;
      const radiusX = contact.start.radiusX + (contact.end.radiusX - contact.start.radiusX) * progress;
      const radiusY = contact.start.radiusY + (contact.end.radiusY - contact.start.radiusY) * progress;
      const mirror = corpse.species && corpse.species !== "spiny-back-beetle" && corpse.facing > 0 ? -1 : 1;
      const decay = Number.isFinite(corpse.decaysAt) && Number.isFinite(age) ? clamp(age / (corpse.decaysAt - corpse.diedAt), 0, 1) : 0;
      const cell = state.camera.zoom;
      drawGroundShadow(point.x + x * mirror * cell, point.y + y * cell,
        radiusX * cell, radiusY * cell, .3 * (1 - decay * .4));
    }

    function expireClientCorpses() {
      const expired = state.corpses.filter(corpse => corpsePlaybackTime() >= corpse.decaysAt);
      if (!expired.length) return;
      const ids = new Set(expired.map(corpse => String(corpse.id)));
      state.corpses = state.corpses.filter(corpse => !ids.has(String(corpse.id)));
      if (state.selection?.kind === "corpse" && ids.has(String(state.selection.target.id))) selectObject(null, null);
      if (state.hover?.kind === "corpse" && ids.has(String(state.hover.target.id))) state.hover = null;
      for (const id of ids) {
        const entry = agentListButtons.get(id);
        if (entry) {
          if (helpTooltipTarget && entry.button.contains(helpTooltipTarget)) hideHelpTooltip();
          entry.button.remove();
          agentListButtons.delete(id);
        }
        agentAvatars.delete(id);
      }
      combatAttributeArt.clearDeaths();
      for (const sheets of unitAnimationSheets.values()) sheets.get("death")?.attributeFrames?.clear();
      renderedAgentListSignature = "";
      updateAgentList();
    }

    function drawCorpses() {
      const combatCells = new Set([...(state.agents || []), ...(state.rivals || [])].map(agent => displayedAgent(agent))
        .filter(agent => agent.health > 0 && agent.combat).map(agent => agent.x + "," + agent.y));
      for (const corpse of state.corpses) {
        if (corpsePlaybackTime() >= corpse.decaysAt) continue;
        ctx.save();
        if (combatCells.has(corpse.x + "," + corpse.y)) {
          const anchor = worldToScreen(corpse.x + .5, corpse.y + .92);
          ctx.translate(anchor.x, anchor.y);
          ctx.scale(.35, .35);
          ctx.translate(-anchor.x, -anchor.y);
        }
        const animated = Spawner.CREATURE_DEATH_ANIMATIONS?.[corpse.species];
        const point = worldToScreen(corpse.x + 0.5, corpse.y + (animated ? 1 : 0.5 + AGENT_HEIGHT * .44));
        const scale = unitDisplayScale(corpse);
        ctx.translate(point.x, point.y);
        ctx.scale(scale, scale);
        ctx.translate(-point.x, -point.y);
        drawCorpseGroundShadow(corpse, point);
        drawAgentCorpse(ctx, corpse, point.x, point.y, state.camera.zoom,
          objectOutlineColor("corpse", corpse), 1);
        ctx.restore();
      }
    }

    const EVOLUTION_SYMBOL = assetSource("DesignAssets/evolution-point-symbol.png");
    const COLONY_CODEX = { key: "colony", name: "군락 둥지", effect: "군락의 본둥지",
      description: "진화 포인트로 둥지를 성장시키면 체력과 속성 슬롯이 늘고 새 속성이 열립니다. 진화 포인트와 자원의 보관량도 늘어납니다. 몽돌의 성장 비용은 25% 적습니다." };
    const NEST_CODEX = [COLONY_CODEX];
    const evolutionSprite = new Image();
    evolutionSprite.src = EVOLUTION_SYMBOL;
    const evolutionPointCache = await createEvolutionPointCache();
    for (const image of document.querySelectorAll("[data-evolution-symbol]")) image.src = EVOLUTION_SYMBOL;

    const templateList = document.getElementById("template-list");
    const templateDeleteDialog = document.getElementById("template-delete-dialog");
    const templateDeleteCancel = document.getElementById("template-delete-cancel");
    const templateDeleteTitle = document.getElementById("template-delete-title").textContent;
    const nestUpgrade = document.getElementById("nest-upgrade");
    const nestStatus = document.getElementById("nest-status");
    const firstDesign = document.getElementById("first-design");
    const designBackdrop = document.getElementById("design-backdrop");
    const designForm = document.getElementById("unit-design-form");
    const designName = document.getElementById("design-name");
    const designSlots = document.getElementById("design-slots");
    const designPalette = document.getElementById("attribute-palette");
    const designSave = document.getElementById("design-save");
    const designStatus = document.getElementById("design-status");
    const codex = document.getElementById("codex");
    const codexSearch = document.getElementById("codex-search");
    const codexList = document.getElementById("codex-list");
    const codexBack = document.getElementById("codex-back");
    const codexForward = document.getElementById("codex-forward");
    const codexBrowse = document.createElement("button");
    codexBrowse.type = "button";
    codexBrowse.className = "codex-browse";
    document.querySelector(".codex-sidebar").id = "codex-sidebar";
    codexBrowse.setAttribute("aria-controls", "codex-sidebar");
    codexBack.before(codexBrowse);
    codexBrowse.addEventListener("click", () => {
      setCodexView(codex.dataset.view === "list" ? "article" : "list");
      if (codex.dataset.view === "list") {
        revealCodexEntry();
        codexSearch.focus({ preventScroll: true });
      } else document.getElementById("codex-article-name").focus({ preventScroll: true });
    });
    setCodexView("article");
    const burrowCodexFilter = document.createElement("button");
    burrowCodexFilter.type = "button";
    burrowCodexFilter.dataset.codexCategory = "burrow";
    burrowCodexFilter.setAttribute("aria-pressed", "false");
    burrowCodexFilter.textContent = "굴";
    document.querySelector(".codex-filter").append(burrowCodexFilter);
    const resourceCodexFilter = document.createElement("button");
    resourceCodexFilter.type = "button";
    resourceCodexFilter.dataset.codexCategory = "resource";
    resourceCodexFilter.setAttribute("aria-pressed", "false");
    resourceCodexFilter.textContent = "자원";
    document.querySelector(".codex-filter").append(resourceCodexFilter);
    const hazardCodexFilter = document.querySelector('[data-codex-category="hazard"]');
    if (hazardCodexFilter) hazardCodexFilter.hidden = !HAZARD_CODEX.length;
    const codexState = { entry: "attribute:antenna", history: [], index: -1, category: "all", cell: null, returnFocus: null };
    let selectedAttribute = null;
    let unitDraft = null;
    let designReturnFocus = null;
    let templateListSignature = "";

    const combatPrimaryRow = document.createElement("label");
    combatPrimaryRow.className = "combat-primary";
    const combatPrimaryLabel = document.createElement("span");
    combatPrimaryLabel.textContent = "주력";
    const combatPrimarySelect = document.createElement("select");
    combatPrimarySelect.setAttribute("aria-label", "주력");
    combatPrimaryRow.append(combatPrimaryLabel, combatPrimarySelect);
    designSlots.after(combatPrimaryRow);
    combatPrimarySelect.addEventListener("change", () => {
      if (!unitDraft || unitDraft.readOnly) return;
      unitDraft.combatPrimary = combatPrimarySelect.value || null;
      updateUnitDesign();
    });
    function updateCombatPrimary() {
      const keys = ["blade", "piercing", "carapace"].filter(key => unitDraft.slots.includes(key));
      if (!keys.includes(unitDraft.combatPrimary)) unitDraft.combatPrimary = keys[0] || null;
      combatPrimaryRow.hidden = !keys.length;
      combatPrimarySelect.disabled = unitDraft.readOnly;
      if (combatPrimarySelect.dataset.keys !== keys.join(",")) {
        combatPrimarySelect.replaceChildren(...keys.map(key => {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = ATTRIBUTES.find(attribute => attribute.key === key)?.name || key;
          return option;
        }));
        combatPrimarySelect.dataset.keys = keys.join(",");
      }
      combatPrimarySelect.value = unitDraft.combatPrimary || "";
    }
    const combatUnitStats = document.createElement("p");
    combatUnitStats.className = "combat-unit-stats";
    document.getElementById("agent-attributes").after(combatUnitStats);
    function combatStatsText(agent) {
      const profile = Spawner.combatProfile(agent);
      return "HP " + Math.ceil(Math.max(0, agent.health ?? agent.stats?.health ?? 100)) + "/" + (agent.stats?.health || 100) +
        " · 공격 " + Math.round(profile.attackPower) + " · 방어 " + Math.round(profile.defense) + " · 공속 " + profile.attackSpeed.toFixed(2);
    }
    function updateCombatUnitStats(agent) {
      if (agent) combatUnitStats.textContent = combatStatsText(agent);
    }
    const combatOpen = document.createElement("button");
    combatOpen.type = "button";
    combatOpen.className = "combat-open";
    combatOpen.textContent = "⌕ 전투 확대";
    combatOpen.hidden = true;
    document.body.append(combatOpen);
    const combatPanel = document.createElement("dialog");
    combatPanel.className = "combat-panel";
    combatPanel.setAttribute("aria-label", "전투 확대");
    const combatHeading = document.createElement("h2");
    combatHeading.textContent = "전투";
    const combatClose = document.createElement("button");
    combatClose.type = "button";
    combatClose.textContent = "닫기";
    const combatHeader = document.createElement("header");
    combatHeader.append(combatHeading, combatClose);
    const combatSummary = document.createElement("div");
    combatSummary.className = "combat-summary";
    const combatCanvas = document.createElement("canvas");
    combatCanvas.setAttribute("aria-label", "전투 중인 유닛");
    const combatRoster = document.createElement("div");
    combatRoster.className = "combat-roster";
    const combatDetail = document.createElement("p");
    const combatGauge = document.createElement("progress");
    combatGauge.max = 1;
    combatGauge.setAttribute("aria-label", "다음 공격");
    combatPanel.append(combatHeader, combatSummary, combatCanvas, combatRoster, combatDetail, combatGauge);
    document.body.append(combatPanel);
    let combatWatch = null;
    let combatSelected = null;
    let combatReturnFocus = null;
    combatClose.addEventListener("click", () => combatPanel.close());
    combatPanel.addEventListener("keydown", event => event.stopPropagation());
    combatPanel.addEventListener("close", () => {
      combatOpen.hidden = !selectedCombatUnits().length;
      const focus = combatReturnFocus?.isConnected && !combatReturnFocus.hidden ? combatReturnFocus : unitPanel.querySelector("button:not([hidden])");
      focus?.focus({ preventScroll: true });
    });
    combatOpen.addEventListener("click", () => {
      const units = selectedCombatUnits();
      if (!units.length) return;
      combatWatch = { id: units[0].combat.id, summary: "" };
      combatSelected = String(units[0].id);
      combatReturnFocus = document.activeElement;
      stopMapMovement();
      combatPanel.showModal();
      combatClose.focus();
      scheduleRender();
    });
    function combatGroups() {
      const groups = new Map();
      for (const agent of visibleAgents()) {
        if (!agent.combat || agent.health <= 0) continue;
        if (!groups.has(agent.combat.id)) groups.set(agent.combat.id, []);
        groups.get(agent.combat.id).push(agent);
      }
      return groups;
    }
    function selectedCombatUnits() {
      const selection = state.selection;
      if (!selection?.target || state.camera.layer !== 0 || !["agent", "terrain", "hazard"].includes(selection.kind)) return [];
      const combat = selection.kind === "agent" ? selection.target.combat : null;
      const x = combat?.x ?? selection.target.x ?? selection.target.column;
      const y = combat?.y ?? selection.target.y ?? selection.target.row;
      return [...combatGroups().values()].find(units => combat ? units[0].combat.id === combat.id : units[0].combat.x === x && units[0].combat.y === y) || [];
    }
    function combatVisualEvent(agent) {
      if (!agent?.combat) return null;
      const relevant = event => event && (String(event.sourceId) === String(agent.id) || String(event.targetId) === String(agent.id)) && ["hit", "counter", "parry", "block", "stun"].includes(event.kind);
      const reaction = agent.combat.lastReaction;
      if (relevant(reaction) && String(reaction.targetId) === String(agent.id) && state.simSeconds >= reaction.at && state.simSeconds - reaction.at < .5) return reaction;
      const event = agent.combat.lastEvent;
      return relevant(event) ? event : null;
    }
    function drawCombatCreature(context, agent, x, floor, height) {
      if (agent.species === "spiny-back-beetle") {
        const pose = Spawner.beetleAnimationPose(agent, state.simSeconds);
        const attack = pose.action === "attack";
        const shape = attack ? Spawner.BEETLE_ATTACK_SPRITE : Spawner.BEETLE_SPRITE;
        const sprite = attack ? beetleAttackSheet : beetleSheet;
        if (!sprite.complete || !sprite.naturalWidth) return false;
        const size = height * shape.scale;
        context.save(); context.translate(x, floor);
        if (shape.facing === "right" ? agent.facing < 0 : agent.facing > 0) context.scale(-1, 1);
        context.drawImage(sprite, pose.frame % shape.columns * shape.frameSize, Math.floor(pose.frame / shape.columns) * shape.frameSize,
          shape.frameSize, shape.frameSize, -size * shape.pivotX / shape.frameSize, -size * shape.pivotY / shape.frameSize, size, size);
        context.restore(); return true;
      }
      const hurt = Spawner.creatureHurtPose(agent, state.simSeconds);
      const attack = Spawner.creatureAttackPose(agent, state.simSeconds);
      const pose = hurt || attack;
      const entry = hurt ? creatureHurtSheets.get(agent.species) : attack ? creatureAttackSheets.get(agent.species) : creatureIdleSheets.get(agent.species);
      if (!entry?.sprite.complete || !entry.sprite.naturalWidth) return false;
      const animation = pose?.animation || entry.animation;
      const frame = pose?.frame ?? Spawner.unitAnimationFrame(animation, (state.simSeconds - (agent.animationStartedAt || 0)) * 1000);
      const size = height * (agent.species === "talon-owl" ? Spawner.TALON_OWL_IDLE.scale : 1.4 * entry.scale) * (attack && !hurt ? animation.frameSize / animation.viewSize : 1);
      context.save(); context.translate(x, floor);
      if (attack && !hurt ? attack.mirrorX : agent.facing > 0) context.scale(-1, 1);
      context.drawImage(entry.sprite, frame % animation.columns * animation.frameSize, Math.floor(frame / animation.columns) * animation.frameSize,
        animation.frameSize, animation.frameSize, -size * animation.pivotX / animation.frameSize, -size * animation.pivotY / animation.frameSize, size, size);
      context.restore(); return true;
    }
    function combatArenaUnits(units, selected) {
      if (units.length <= 6) return units;
      const target = selected && units.find(agent => String(agent.id) === String(selected.attack?.targetId ?? selected.combat.targetId));
      return [0, 1].flatMap(side => {
        const priority = [selected, target].filter(agent => agent?.combat.side === side);
        return [...priority, ...units.filter(agent => agent.combat.side === side && !priority.includes(agent))].slice(0, 3);
      });
    }
    function drawCombatPanel(now) {
      combatOpen.hidden = !selectedCombatUnits().length || !evolutionPanel.hidden || !welcome.hidden || combatPanel.open;
      if (!combatPanel.open || !combatWatch) return;
      const units = [...state.agents, ...state.rivals].filter(agent => agent.health > 0 && agent.combat?.id === combatWatch.id);
      if (!units.some(agent => String(agent.id) === combatSelected)) combatSelected = units.length ? String(units[0].id) : null;
      const sides = [0, 1].map(side => units.filter(agent => agent.combat.side === side));
      if (units.length) combatWatch.summary = sides.map((members, side) => "진영 " + (side + 1) + " · " + members.length + "명 · HP " + Math.ceil(members.reduce((sum, agent) => sum + agent.health, 0))).join("   /   ");
      combatSummary.textContent = units.length ? combatWatch.summary : "전투 종료";
      const rosterKey = units.map(agent => agent.id).join(",");
      if (combatRoster.dataset.key !== rosterKey) {
        combatRoster.replaceChildren(...units.map(agent => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.agent = String(agent.id);
          button.textContent = agent.name || agent.species || "유닛";
          button.addEventListener("click", () => { combatSelected = String(agent.id); scheduleRender(); });
          return button;
        }));
        combatRoster.dataset.key = rosterKey;
      }
      for (const button of combatRoster.children) button.setAttribute("aria-pressed", String(button.dataset.agent === combatSelected));
      const selected = units.find(agent => String(agent.id) === combatSelected);
      const arenaUnits = combatArenaUnits(units, selected);
      combatHeading.textContent = units.length > 6 ? "전투 · 선택 유닛 중심" : "전투";
      const events = { parry: "패링", block: "방어", stun: "기절", counter: "반격", hit: "타격" };
      const selectedEvent = combatVisualEvent(selected);
      const status = selected?.combat.stunnedUntil > state.simSeconds ? "기절" : selectedEvent && state.simSeconds - selectedEvent.at < .5 && ["parry", "block", "stun"].includes(selectedEvent.kind) ? events[selectedEvent.kind] : selected?.attack?.counter ? "반격" : selected?.attack?.heavy ? "모아 찌르기" : selected?.attack && state.simSeconds < selected.attack.hitAt ? "공격 준비" : selectedEvent && state.simSeconds - selectedEvent.at < .5 ? events[selectedEvent.kind] : "교전 중";
      combatDetail.textContent = selected ? (selected.name || "유닛") + " · " + combatStatsText(selected) + " · " + status : "전투 종료";
      const profile = selected ? Spawner.combatProfile(selected) : null;
      combatGauge.value = selected ? clamp(1 - ((selected.combat.nextAttackAt || state.simSeconds) - state.simSeconds) / profile.attackInterval, 0, 1) : 0;
      const width = Math.max(1, Math.round(combatCanvas.clientWidth)), height = 260;
      if (combatCanvas.width !== width || combatCanvas.height !== height) { combatCanvas.width = width; combatCanvas.height = height; }
      const context = combatCanvas.getContext("2d");
      context.clearRect(0, 0, width, height);
      const positions = new Map();
      [0, 1].forEach(side => arenaUnits.filter(agent => agent.combat.side === side).forEach((agent, index, members) => {
        const rows = Math.max(3, members.length);
        positions.set(String(agent.id), { x: width / 2 + (side ? 36 : -36) + Math.sin(index * 2.4) * 10,
          y: 48 + (index + .5) / rows * 170 + (side ? 8 : -8) });
      }));
      const target = selected && positions.get(String(selected.attack?.targetId ?? selected.combat.targetId));
      if (target) {
        const source = positions.get(String(selected.id));
        context.strokeStyle = "#f7da88";
        context.setLineDash([4, 4]);
        context.beginPath(); context.moveTo(source.x, source.y); context.lineTo(target.x, target.y); context.stroke();
        context.setLineDash([]);
      }
      for (const agent of [...arenaUnits].sort((a, b) => positions.get(String(a.id)).y - positions.get(String(b.id)).y)) {
        const point = positions.get(String(agent.id));
        const primary = Spawner.combatPrimary(agent);
        const attack = agent.attack;
        const impact = combatVisualEvent(agent);
        const age = impact ? state.simSeconds - impact.at : Infinity;
        const hit = impact && String(impact.targetId) === String(agent.id) && ["hit", "counter", "stun"].includes(impact.kind);
        const opponent = positions.get(String(attack?.targetId ?? agent.combat.targetId));
        const facing = opponent ? Math.sign(opponent.x - point.x) || (agent.combat.side ? 1 : -1) : agent.combat.side ? 1 : -1;
        const progress = attack ? clamp((state.simSeconds - attack.startedAt) / (attack.endsAt - attack.startedAt), 0, 1) : 0;
        const distance = opponent ? Math.hypot(opponent.x - point.x, opponent.y - point.y) : 0;
        const lunge = attack && state.simSeconds < attack.endsAt ? Math.sin(progress * Math.PI) * Math.min(30, distance * .28) : 0;
        const recoil = hit && age >= 0 && age < .16 ? Math.sin(age / .16 * Math.PI) * 7 : 0;
        const directionX = distance ? (opponent.x - point.x) / distance : facing;
        const directionY = distance ? (opponent.y - point.y) / distance : 0;
        const x = point.x + directionX * (lunge - recoil);
        const y = point.y + directionY * (lunge - recoil);
        const size = Math.min(72, width / 4);
        context.save();
        if (agent.combat.stunnedUntil > state.simSeconds) context.globalAlpha = .65;
        const frozen = hit && age >= 0 && age < .055;
        const visual = { ...agent, facing, hurtStartedAt: Number.isFinite(agent.hurtStartedAt) ? agent.hurtStartedAt + (frozen ? age : 0) : agent.hurtStartedAt, combat: { ...agent.combat, side: facing > 0 ? 1 : 0 }, attack: attack ? { ...attack, directionX: facing, startedAt: attack.startedAt + (frozen ? age : 0), hitAt: attack.hitAt + (frozen ? age : 0), endsAt: attack.endsAt + (frozen ? age : 0) } : null };
        if (!(agent.species ? drawCombatCreature(context, visual, x, y + size * .45, size) : drawAgentAttack(context, visual, x, y + size * .45, size, null))) {
          const sprite = agentSprite(agent);
          if (sprite && sprite.complete !== false && (sprite.naturalWidth || sprite.width)) context.drawImage(sprite, x - size / 2, y - size / 2, size, size);
        }
        context.globalAlpha = 1;
        context.fillStyle = "#182323"; context.fillRect(x - 20, y + size * .45, 40, 4);
        context.fillStyle = agent.combat.side ? "#e18c82" : "#83d6c1";
        context.fillRect(x - 20, y + size * .45, 40 * clamp(agent.health / (agent.stats?.health || 100), 0, 1), 4);
        if (String(agent.id) === combatSelected) { context.strokeStyle = "#ffe7a5"; context.strokeRect(x - size / 2, y - size / 2, size, size); }
        if (attack && state.simSeconds < attack.hitAt) {
          const progress = clamp((state.simSeconds - attack.startedAt) / (attack.hitAt - attack.startedAt), 0, 1);
          context.strokeStyle = primary === "piercing" ? "#f0b86b" : primary === "carapace" ? "#8edbe1" : "#e7e3b6";
          context.lineWidth = attack.heavy ? 4 : 2;
          context.beginPath();
          if (primary === "piercing") { context.moveTo(x, y); context.lineTo(x + facing * 35 * progress, y); }
          else context.arc(x, y, size * .4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          context.stroke();
        }
        if (impact && String(impact.targetId) === String(agent.id) && age >= 0 && age < .25) {
          context.globalAlpha = 1 - age / .25;
          context.strokeStyle = impact.kind === "block" || impact.kind === "parry" ? "#a6e4fa" : "#ffe1a0";
          context.beginPath();
          if (primary === "piercing") { context.moveTo(x - 22, y); context.lineTo(x + 22, y); }
          else context.arc(x, y, 14 + age * 30, 0, primary === "carapace" ? Math.PI * 2 : Math.PI);
          context.stroke();
        }
        context.restore();
      }
    }
    function templateDescription(slots, levels) {
      const counts = attributeCounts(slots, levels);
      return ATTRIBUTES.filter((attribute) => counts[attribute.key] > 0)
        .map((attribute) => attribute.name + " Lv." + counts[attribute.key]).join(" · ") || "기본 생명체";
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

    function confirmTemplateDelete(template) {
      return confirmDelete(templateDeleteTitle, "“" + template.name + "” 설계를 삭제할까요?");
    }

    function confirmDelete(title, message) {
      if (templateDeleteDialog.open) return Promise.resolve(false);
      return new Promise(resolve => {
        templateDeleteDialog.returnValue = "cancel";
        document.getElementById("template-delete-title").textContent = title;
        const description = document.getElementById("template-delete-message");
        description.textContent = message;
        description.style.whiteSpace = "pre-line";
        templateDeleteDialog.addEventListener("close", () => resolve(templateDeleteDialog.returnValue === "delete"), { once: true });
        hideHelpTooltip();
        templateDeleteDialog.showModal();
        templateDeleteCancel.focus();
      });
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
        button.setAttribute("aria-label", template.name + " 탄생, 진화 포인트 " + birthCost(template, state.tribe) + "점");
        const image = document.createElement("img");
        image.src = agentImageSource({ tribe: template.tribe, attributes: attributeCounts(template.slots, template.attributeLevels), carrying: 0 });
        image.alt = "";
        const name = document.createElement("strong");
        name.textContent = template.name;
        button.append(image, name);
        button.addEventListener("click", async () => {
          state.selectedTemplateId = template.id;
          nestStatus.textContent = "";
          await sendCommand({ type: "birth", templateId: template.id, combatPrimary: template.combatPrimary });
        });
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "template-edit";
        const editIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        editIcon.setAttribute("viewBox", "0 0 24 24");
        editIcon.setAttribute("aria-hidden", "true");
        editIcon.setAttribute("focusable", "false");
        const editPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        editPath.setAttribute("d", "M14 5l5 5M4 20l4.5-1L20 7.5a2.12 2.12 0 0 0-3-3L5.5 16 4 20Z");
        editIcon.append(editPath);
        edit.append(editIcon);
        edit.title = "설계 변경";
        edit.setAttribute("aria-label", template.name + " 설계 변경");
        edit.addEventListener("click", () => openUnitDesign(state.templates.find((candidate) => candidate.id === template.id)));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "template-delete";
        remove.title = "설계 삭제";
        remove.setAttribute("aria-label", template.name + " 설계 삭제");
        remove.setAttribute("aria-haspopup", "dialog");
        remove.setAttribute("aria-controls", "template-delete-dialog");
        const removeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        removeIcon.setAttribute("viewBox", "0 0 24 24");
        removeIcon.setAttribute("aria-hidden", "true");
        removeIcon.setAttribute("focusable", "false");
        const removePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        removePath.setAttribute("d", "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7");
        removeIcon.append(removePath);
        remove.append(removeIcon);
        remove.addEventListener("click", async () => {
          if (connection.busy || !connection.online || state.ending) return;
          if (!await confirmTemplateDelete(template)) return;
          nestStatus.textContent = "";
          const result = await sendCommand({ type: "delete-design", templateId: template.id });
          if (result) evolutionOpenButton.focus();
        });
        const actions = document.createElement("div");
        actions.className = "template-card-actions";
        actions.append(edit, remove);
        const header = document.createElement("div");
        header.className = "template-card-header";
        header.append(createEvolutionCost(birthCost(template, state.tribe)), actions);
        card.append(header, button);
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

    function openUnitDesign(template, readOnly) {
      readOnly = readOnly || !!state.ending;
      designReturnFocus = document.activeElement;
      unitDraft = { id: template ? template.id : null, tribe: template?.tribe || state.tribe || "bean", slots: template ? [...new Set(template.slots.map(key => key === "arms" ? "strength" : key))] : [], attributeLevels: { ...template?.attributeLevels }, combatPrimary: template?.combatPrimary ?? null, error: "", readOnly: !!readOnly, nameEdited: Spawner.isTemplateNameEdited(template) };
      designName.value = template?.name || Spawner.suggestTemplateName(unitDraft.slots, state.templates, unitDraft.id);
      designName.readOnly = !!readOnly;
      designPalette.hidden = !!readOnly;
      designSave.closest(".design-footer").hidden = !!readOnly;
      closeCodex(false);
      designName.setCustomValidity("");
      document.getElementById("design-title").textContent = readOnly ? "유닛 설계도" : template ? "유닛 설계 수정" : "새 유닛 설계";
      evolutionPanel.hidden = false;
      designBackdrop.hidden = false;
      document.querySelector(".app").inert = true;
      colonyMenu.inert = true;
      unitPanel.inert = true;
      evolutionOpenButton.setAttribute("aria-expanded", "true");
      renderDesignSlots();
      updateUnitDesign();
      if (readOnly) evolutionClose.focus();
      else designName.focus();
    }

    function createDesignLock() {
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M8 10V7a4 4 0 0 1 8 0v3M6 10h12v11H6zM12 14v3");
      icon.append(path);
      return icon;
    }

    function renderDesignSlots() {
      if (!unitDraft) return;
      hideHelpTooltip();
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < NEST_LEVELS[NEST_LEVELS.length - 1].slotCapacity; index += 1) {
        const key = unitDraft.slots[index];
        const attribute = ATTRIBUTES.find((candidate) => candidate.key === key);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "design-slot" + (attribute ? " has-attribute" : "");
        button.dataset.slotIndex = index;
        const locked = !attribute && index >= slotCapacity();
        button.classList.toggle("is-locked", locked);
        button.setAttribute("aria-disabled", String(locked || unitDraft.readOnly));
        button.setAttribute("aria-label", "슬롯 " + (index + 1) + (attribute ? " " + attribute.name + (unitDraft.readOnly ? "" : " 빼기") : " 비어 있음"));
        if (attribute) {
          button.style.setProperty("--attribute-color", attribute.color);
          const image = document.createElement("img");
          image.src = attribute.image;
          image.alt = "";
          attachAttributeHelp(button, attribute, unitDraft.attributeLevels[key] || 1, unitDraft.tribe);
          if (!unitDraft.readOnly) button.dataset.helpHint = "클릭해서 속성 빼기";
          const level = document.createElement("small");
          level.className = "attribute-level";
          level.textContent = "Lv." + (unitDraft.attributeLevels[key] || 1);
          button.append(image, level);
        } else if (locked) {
          const level = NEST_LEVELS.findIndex(nest => nest.slotCapacity > index) + 1;
          button.dataset.help = "둥지 " + level + "레벨에 개방";
          button.setAttribute("aria-label", button.dataset.help);
          button.append(createDesignLock());
          button.addEventListener("pointerenter", () => showHelpTooltip(button));
          button.addEventListener("pointerleave", hideHelpTooltip);
          button.addEventListener("focus", () => showHelpTooltip(button));
          button.addEventListener("blur", hideHelpTooltip);
        } else {
          button.textContent = unitDraft.readOnly ? "" : "+";
        }
        button.addEventListener("click", () => {
          if (locked || !attribute || unitDraft?.readOnly) return;
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

    function updateUnitDesign() {
      if (!unitDraft || evolutionPanel.hidden) return;
      updateCombatPrimary();
      if (!unitDraft.nameEdited && !unitDraft.readOnly) designName.value = Spawner.suggestTemplateName(unitDraft.slots, state.templates, unitDraft.id);
      const counts = attributeCounts(unitDraft.slots, unitDraft.attributeLevels);
      const stats = unitStats(counts, unitDraft.tribe);
      prepareAgentTemplate(unitDraft).catch(() => {});
      document.getElementById("design-preview-image").src = agentImageSource({ tribe: unitDraft.tribe, attributes: counts, carrying: 0 });
      const profile = Spawner.combatProfile({ tribe: unitDraft.tribe, attributes: counts, stats, combatPrimary: unitDraft.combatPrimary });
      const statValues = [["공격", Math.round(profile.attackPower)], ["방어", Math.round(profile.defense)], ["공속", profile.attackSpeed.toFixed(2) + "/초"], ["시야", stats.vision + "칸"], ["운반", stats.capacity + "개"],
        ["이동", Number(agentSpeed({ stats, tribe: unitDraft.tribe, carrying: 0 }).toFixed(2)) + "칸/초"], ["체력", stats.health]];
      const statsFragment = document.createDocumentFragment();
      for (const [label, value] of statValues) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        statsFragment.append(term, description);
      }
      document.getElementById("design-stats").replaceChildren(statsFragment);
      for (const button of designPalette.querySelectorAll(".attribute-choice")) {
        const count = counts[button.dataset.attribute];
        const locked = !isAttributeUnlocked(button.dataset.attribute, state.nestLevel, unitDraft.tribe);
        button.dataset.locked = String(locked);
        button.querySelector(".attribute-lock").classList.toggle("is-visible", locked);
        button.querySelector("b").textContent = count ? "Lv." + count : "";
        button.dataset.equipped = String(count > 0);
        button.disabled = !locked && (count > 0 || unitDraft.slots.length >= slotCapacity());
        button.setAttribute("aria-disabled", String(locked || button.disabled));
        const attribute = ATTRIBUTES.find((candidate) => candidate.key === button.dataset.attribute);
        const previousHelp = button.dataset.help;
        updateAttributeHelp(button, attribute, count || 1, unitDraft.tribe);
        if (locked) button.dataset.help = attribute.name + "\n둥지 " + attributeUnlockLevel(attribute.key, unitDraft.tribe) + "레벨에 개방";
        button.setAttribute("aria-label", locked ? button.dataset.help : attribute.name + (count ? " Lv." + count + " 장착됨" : " 속성 장착"));
        if (helpTooltipTarget === button && previousHelp !== button.dataset.help) showHelpTooltip(button);
      }
      const ordered = Array.from(designPalette.querySelectorAll(".attribute-choice")).sort((first, second) =>
        Number(first.dataset.locked === "true") - Number(second.dataset.locked === "true") ||
        (first.dataset.locked === "true" ? attributeUnlockLevel(first.dataset.attribute, unitDraft.tribe) - attributeUnlockLevel(second.dataset.attribute, unitDraft.tribe) : 0) ||
        ATTRIBUTES.findIndex(attribute => attribute.key === first.dataset.attribute) - ATTRIBUTES.findIndex(attribute => attribute.key === second.dataset.attribute))
        .map(button => button.parentElement);
      if (ordered.some((item, index) => item !== designPalette.children[index])) {
        const focused = designPalette.contains(document.activeElement) ? document.activeElement : null;
        hideHelpTooltip();
        designPalette.append(...ordered);
        focused?.focus();
      }
      for (const button of designPalette.querySelectorAll(".attribute-info")) {
        button.setAttribute("aria-expanded", String(button.dataset.attributeInfo === selectedAttribute));
      }
      updateCodex();
      designSave.disabled = !!state.ending || connection.busy || !connection.online || unitDraft.slots.length > slotCapacity() ||
        unitDraft.slots.some(key => !isAttributeUnlocked(key, state.nestLevel, unitDraft.tribe));
      setEvolutionText(designStatus, unitDraft.error);
    }

    async function saveUnitDesign() {
      if (!unitDraft || unitDraft.readOnly) return;
      const name = designName.value.trim();
      if (!name) {
        designName.setCustomValidity("템플릿 이름을 지어 주세요.");
        designName.reportValidity();
        return;
      }
      const result = await sendCommand({ type: "design", templateId: unitDraft.id,
        name, nameEdited: unitDraft.nameEdited, slots: [...unitDraft.slots], combatPrimary: unitDraft.combatPrimary, birth: false });
      if (!result || !unitDraft) return;
      state.selectedTemplateId = result.templateId;
      closeEvolutionPanel();
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
      if (designReturnFocus?.isConnected) {
        designReturnFocus.focus();
        hideHelpTooltip();
      }
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
      if (!state.ending && !state.templates.length) openUnitDesign(null);
      else colonyMenuClose.focus();
    }

    const resourceInventoryRows = new Map();

    function updateResourceInventory() {
      const inventory = document.getElementById("resource-inventory");
      if (!resourceInventoryRows.size) {
        for (const definition of Spawner.RESOURCE_TYPES) {
          const row = document.createElement("div");
          row.tabIndex = 0;
          row.className = "resource-inventory-item";
          const image = document.createElement("canvas");
          image.setAttribute("aria-hidden", "true");
          const count = document.createElement("strong");
          row.append(image, count);
          row.addEventListener("pointerenter", () => showHelpTooltip(row));
          row.addEventListener("pointerleave", hideHelpTooltip);
          row.addEventListener("focus", () => showHelpTooltip(row));
          row.addEventListener("blur", hideHelpTooltip);
          inventory.append(row);
          resourceInventoryRows.set(definition.key, { row, count, image, definition });
        }
      }
      const previousHelp = helpTooltipTarget?.dataset.help;
      let visible = 0;
      for (const [key, entry] of resourceInventoryRows) {
        const amount = Math.max(0, state.resourceInventory?.[key] || 0);
        const limit = state.resourceInventoryLimits?.[key] ?? "—";
        updatePanelText(entry.count, amount + "/" + limit);
        entry.row.hidden = amount <= 0;
        entry.row.dataset.help = entry.definition.name + " · 보유 " + amount + "개 / 비축 한도 " + limit + "개\n" +
          (Spawner.isColonyFood(key, state.tribe, worldMap.generationVersion) ?
            "비축 한도를 넘는 납품은 진화 포인트로 전환됩니다." : "다른 자원과 창고 공간을 공유합니다.");
        entry.row.setAttribute("aria-label", entry.definition.name + " · 보유 " + amount + "개 / 비축 한도 " + limit + "개");
        if (amount <= 0) continue;
        visible++;
        const ratio = window.devicePixelRatio || 1;
        if (entry.image.dataset.ratio === String(ratio)) continue;
        const sprite = resourceCarrySprites.get(key), crop = resourceCarryBounds.get(key);
        entry.image.width = entry.image.height = Math.round(24 * ratio);
        const scale = Math.min(entry.image.width / crop.width, entry.image.height / crop.height) * .94;
        entry.image.getContext("2d").drawImage(sprite, crop.x, crop.y, crop.width, crop.height,
          (entry.image.width - crop.width * scale) / 2, (entry.image.height - crop.height * scale) / 2, crop.width * scale, crop.height * scale);
        entry.image.dataset.ratio = ratio;
      }
      if (helpTooltipTarget && inventory.contains(helpTooltipTarget)) {
        if (helpTooltipTarget.hidden) hideHelpTooltip();
        else if (helpTooltipTarget.dataset.help !== previousHelp) showHelpTooltip(helpTooltipTarget);
      }
      inventory.hidden = !visible;
      inventory.setAttribute("aria-label", "자원 재고");
      const layout = inventory.offsetWidth + "x" + inventory.offsetHeight;
      if (inventory.dataset.layout !== layout || visible && document.documentElement.style.getPropertyValue("--resource-inventory-height") === "0px") {
        inventory.dataset.layout = layout;
        positionDiscoveryToasts(document.getElementById("agent-panel").getBoundingClientRect().width);
      }
    }

    function updateColonyPanel() {
      if (document.hidden) return;
      cheats?.update(connection.active && document.body.dataset.screen === "game",
        connection.busy || !connection.online, state.tribe, !!state.ending);
      updateResourceInventory();
      const capacity = pointCapacity();
      foodProgressFill.style.width = (state.evolutionPoints / capacity * 100) + "%";
      const progress = document.getElementById("evolution-progress");
      progress.setAttribute("aria-valuenow", state.evolutionPoints);
      progress.setAttribute("aria-valuemax", capacity);
      updatePanelText(evolutionPointsOutput, state.evolutionPoints);
      updatePanelText(document.getElementById("point-capacity"), capacity);
      const own = colonyEntries.find((entry) => entry.id === connection.colonyId);
      updatePanelText(document.getElementById("nest-name"), own ? own.name : "둥지");
      nestRenameOpen.disabled = !!state.ending || connection.busy || !connection.online || !own;
      nestNameSave.disabled = connection.busy || !connection.online;
      nestNameInput.disabled = connection.busy;
      nestNameCancel.disabled = connection.busy;
      updatePanelText(document.getElementById("nest-level"), "Lv." + state.nestLevel + (state.nestHealth === 0 ? " · 파괴됨" :
        " · 체력 " + Math.ceil(state.nestHealth ?? NEST_LEVELS[state.nestLevel - 1].health) + "/" + NEST_LEVELS[state.nestLevel - 1].health));
      updatePanelText(document.getElementById("nest-upgrade-points"), state.nestLevel >= NEST_LEVELS.length ? "—" : upgradeCost());
      document.getElementById("nest-upgrade-help").dataset.help = nestGrowthBenefits();
      nestUpgrade.setAttribute("aria-label", state.nestLevel >= NEST_LEVELS.length ? "최고 둥지 레벨" : "둥지 성장, 진화 포인트 " + upgradeCost() + "점");
      nestUpgrade.disabled = !!state.ending || connection.busy || !connection.online || state.nestHealth === 0 || state.nestLevel >= NEST_LEVELS.length || state.evolutionPoints < upgradeCost();
      firstDesign.hidden = !!state.ending || state.templates.length > 0 || !evolutionPanel.hidden;
      if (!firstDesign.hidden) firstDesign.querySelector("img").src = agentImageSource({ tribe: state.tribe, attributes: attributeCounts([]), carrying: 0 });
      renderUnitTemplates();
      for (const card of templateList.querySelectorAll("[data-template-id]")) {
        const template = state.templates.find((candidate) => candidate.id === Number(card.dataset.templateId));
        card.querySelector(".template-spawn").disabled = !!state.ending || connection.busy || !connection.online || !hasBirthplace() || state.agents.filter(agent => agent.health > 0).length >= unitCapacity() || state.evolutionPoints < birthCost(template, state.tribe) || template.slots.length > slotCapacity() || template.slots.some(key => !isAttributeUnlocked(key, state.nestLevel, state.tribe));
        card.querySelector(".template-edit").disabled = connection.busy || !connection.online;
        card.querySelector(".template-delete").disabled = !!state.ending || connection.busy || !connection.online;
      }
      updateUnitDesign();
      updateCodex();
      updateAgentList();
    }

    function codexEntry(entry) {
      const [kind, key] = entry.split(":");
      const value = kind === "attribute" ? ATTRIBUTES.find((attribute) => attribute.key === key) :
        kind === "synergy" ? ATTRIBUTE_COMBINATIONS[Number(key)] :
        kind === "nest" ? NEST_CODEX.find((entry) => entry.key === key) :
        kind === "resource" ? Spawner.resourceDefinition(key) :
        kind === "burrow" ? BURROW_CODEX.find(value => value.key === key) :
        kind === "terrain" ? TERRAIN_CODEX.find(value => value.key === key) :
        kind === "hazard" ? HAZARD_CODEX.find(value => value.key === key) : null;
      return value && !(kind === "synergy" && value.kind === "upgrade") ? { kind, key, value } : null;
    }

    function attachObjectHelp(element, text) {
      element.tabIndex = 0;
      element.dataset.help = text;
      element.setAttribute("aria-label", text);
      element.addEventListener("pointerenter", () => showHelpTooltip(element));
      element.addEventListener("pointerleave", hideHelpTooltip);
      element.addEventListener("focus", () => showHelpTooltip(element));
      element.addEventListener("blur", hideHelpTooltip);
    }

    function updateAttributeHelp(button, attribute, level, tribe) {
      button.dataset.helpLevel = String(level || 1);
      const description = Spawner.codexAttributeDescription(attribute, tribe);
      button.dataset.helpResources = String(!!attribute.harvests?.length);
      button.dataset.help = attribute.name + (description ? "\n" + description : "");
    }

    function attachAttributeHelp(button, attribute, level, tribe) {
      button.dataset.helpAttribute = attribute.key;
      button.dataset.helpTribe = tribe || "";
      updateAttributeHelp(button, attribute, level, tribe || unitDraft?.tribe || state.tribe);
      button.addEventListener("pointerenter", () => showHelpTooltip(button));
      button.addEventListener("pointerleave", scheduleHelpTooltipHide);
      button.addEventListener("focus", () => showHelpTooltip(button));
      button.addEventListener("blur", scheduleHelpTooltipHide);
    }

    function attachCodexAttributeHelp(button, attribute, level) {
      attachAttributeHelp(button, attribute, level);
    }

    function codexResourceLink(resource) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "codex-resource-link";
      button.dataset.codexResource = resource.key;
      button.title = resource.name;
      button.setAttribute("aria-label", resource.name + " 항목 보기");
      const image = document.createElement("img");
      image.src = assetSource(resource.carryImage);
      image.alt = resource.name;
      button.append(image);
      button.addEventListener("click", () => {
        const origin = helpTooltip.contains(button) ? helpTooltipTarget : null;
        openCodex("resource:" + resource.key);
        if (origin && codexState.returnFocus === button) codexState.returnFocus = origin;
      });
      return button;
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
      attachCodexAttributeHelp(button, attribute);
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
      const speed = cell.type === 0 ? 0 : Spawner.unitTerrainSpeedMultiplier({ tribe: state.tribe }, cell.type);
      const rows = [["좌표", "(" + cell.x + ", " + cell.y + ") · " + cell.terrain.name],
        ["통행", !speed ? "현재 종족 통행 불가" : "통행 가능"],
        ["현재 종족 이동 속도", !speed ? "—" : "평소의 " + Math.round(speed * 100) + "%"],
        ["위험 요소", cell.hazard?.name || "없음"],
        ["현재 자원", definition ? definition.name + " · " + Number(Math.max(0, food.amount).toFixed(1)) + "개" + (definition.harvestLocked ? " · 채집 잠금" : "") : "없음"]];
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
      const list = document.createElement("ul");
      list.className = "codex-terrain-resources codex-resource-icons";
      const resources = terrainCodexResources(terrain.type, worldMap.generationVersion);
      for (const resource of resources) {
        const item = document.createElement("li"), image = document.createElement("img");
        image.src = assetSource(resource.carryImage); image.alt = "";
        attachObjectHelp(item, resource.name);
        item.append(image); list.append(item);
      }
      document.getElementById("codex-related-title").textContent = resources.length ? "발견 가능한 자원" : "";
      related.append(list);
      const movement = document.createElement("h4");
      movement.textContent = "종족별 이동";
      related.append(movement, createCodexStats(Spawner.codexTerrainDetails(terrain.type)));
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
      for (const [kind, title, values] of [["attribute", "속성", ATTRIBUTES], ["resource", "자원", Spawner.RESOURCE_TYPES], ["synergy", "조합 시너지", ATTRIBUTE_COMBINATIONS], ["nest", "둥지", NEST_CODEX], ["burrow", "굴", BURROW_CODEX], ["terrain", "지형", TERRAIN_CODEX]]) {
        if (codexState.category !== "all" && codexState.category !== kind) continue;
        const matches = values.map((value, index) => ({ value, key: kind === "synergy" ? String(index) : value.key }))
          .filter(({ value }) => kind !== "synergy" || value.kind !== "upgrade")
          .filter(({ value }) => [value.name, ...(kind === "attribute" ? [] : [value.effect || "", value.description]),
            ...(kind === "attribute" ? [Spawner.codexAttributeDescription(value, unitDraft?.tribe || state.tribe), Spawner.codexAttributeEffect(value, 1, unitDraft?.tribe || state.tribe),
              ...(value.harvests || []).map(key => Spawner.resourceDefinition(key).name)] : []),
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
          for (const attributeKey of kind === "attribute" ? [key] : [...new Set(value.keys || [])]) {
            const image = document.createElement("img");
            image.src = ATTRIBUTE_IMAGES[attributeKey];
            image.alt = "";
            icons.append(image);
          }
          if (kind === "terrain" || kind === "hazard") icons.append(codexTerrainImage(value, kind));
          if (kind === "burrow") icons.append(createBurrowImage(key, 96));
          if (kind === "resource") {
            const image = document.createElement("img");
            image.src = assetSource(value.carryImage); image.alt = "";
            icons.append(image);
          }
          if (kind === "nest" && key === "colony") icons.append(createColonyInfoImage(colonyInfoEntry(), 96));
          if (kind === "nest" && key !== "colony") {
            const image = document.createElement("img");
            image.className = "evolution-symbol";
            image.src = EVOLUTION_SYMBOL;
            image.alt = "";
            icons.append(image);
          }
          const label = document.createElement("span");
          label.textContent = value.name;
          button.append(icons, label);
          if (kind === "attribute") attachCodexAttributeHelp(button, value);
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
      revealCodexEntry();
    }

    function renderCodexArticle(entry) {
      const { kind, key, value } = entry;
      setCodexView("article");
      const article = document.getElementById("codex-article");
      article.style.setProperty("--attribute-color", kind === "attribute" ? value.color : "#b4dfcf");
      document.getElementById("codex-entry-kind").textContent = kind === "attribute" ? "속성" : kind === "resource" ? "자원" : kind === "nest" ? "둥지" : kind === "burrow" ? "굴" : kind === "terrain" ? "지형" : kind === "hazard" ? "위험 요소" : "조합 시너지";
      document.getElementById("codex-article-name").textContent = value.name;
      const attributeLevel = kind === "attribute" ? attributeCounts(unitDraft?.slots || [], unitDraft?.attributeLevels)[key] || 1 : 1;
      const setEffectText = kind === "attribute" && value.harvests?.length ? setCodexResourceText : setEvolutionText;
      setEffectText(document.getElementById("codex-article-effect"), kind === "burrow" ? "체력 " + value.health : kind === "attribute" ? Spawner.codexAttributeEffect(value, attributeLevel, unitDraft?.tribe || state.tribe) : kind === "resource" ? "채집 시간 · 1개당 " + value.harvestSeconds + "초" : kind !== "synergy" ? value.effect : value.requirement ||
        value.keys.map((attributeKey) => ATTRIBUTES.find((attribute) => attribute.key === attributeKey).name).join(" + "));
      const description = document.getElementById("codex-description");
      if (kind === "attribute" && value.harvests?.length) setCodexResourceText(description, Spawner.codexAttributeDescription(value, unitDraft?.tribe || state.tribe));
      else setEvolutionText(description, ["burrow", "resource"].includes(kind) ? "" : kind === "attribute" ? Spawner.codexAttributeDescription(value, unitDraft?.tribe || state.tribe) : value.description);
      const hero = document.getElementById("codex-article-icons");
      hero.replaceChildren();
      const related = document.getElementById("codex-related");
      related.replaceChildren();
      if (kind === "terrain" || kind === "hazard") {
        hero.append(codexTerrainImage(value, kind));
        renderTerrainCodex(entry, related);

      } else if (kind === "burrow") {
        renderBurrowCodex(value, hero, related);
      } else if (kind === "resource") {
        renderResourceCodex(value, hero, related);
      } else if (kind === "attribute") {
        const image = document.createElement("img");
        image.src = value.image;
        image.alt = value.name + " 문양";
        hero.append(image);
        renderAttributeCodex(value, related);
        const list = document.createElement("ul");
        list.className = "attribute-combinations";
        for (const [index, combination] of ATTRIBUTE_COMBINATIONS.entries()) {
          if (combination.kind === "upgrade" || !combination.keys.includes(key)) continue;
          const keys = [...new Set(combination.keys)].sort((left, right) => Number(right === key) - Number(left === key));
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
          effects.textContent = combination.requirement || keys.map((attributeKey) => ATTRIBUTES.find((attribute) => attribute.key === attributeKey).name).join(" + ");
          const description = document.createElement("p");
          description.textContent = combination.description;
          label.append(link, effects);
          heading.append(codexAttributeIcons(keys), label);
          item.append(heading, description);
          list.append(item);
        }
        document.getElementById("codex-related-title").textContent = "종족별 해금";
        if (list.childElementCount) {
          const heading = document.createElement("h4");
          heading.textContent = "관련 시너지";
          related.append(heading, list);
        }
      } else if (kind === "nest") {
        renderColonyCodex(hero, related);
      } else {
        hero.append(codexAttributeIcons([...new Set(value.keys)]));
        document.getElementById("codex-related-title").textContent = "구성 속성";
        const components = document.createElement("div");
        components.className = "codex-components";
        for (const attributeKey of new Set(value.keys)) {
          const attribute = ATTRIBUTES.find((candidate) => candidate.key === attributeKey);
          const button = codexAttributeLink(attribute);
          button.classList.add("codex-component");
          const label = document.createElement("span");
          const name = document.createElement("strong");
          name.textContent = attribute.name;
          const effect = document.createElement("small");
          const level = value.attributeLevels?.[attributeKey] || 1;
          effect.textContent = Spawner.codexAttributeEffect(attribute, level, unitDraft?.tribe || state.tribe);
          const description = document.createElement("span");
          description.className = "codex-component-description";
          description.textContent = Spawner.codexAttributeDescription(attribute, unitDraft?.tribe || state.tribe);
          label.append(name, effect, description);
          button.append(label);
          components.append(button);
        }
        related.append(components);
      }
      document.getElementById("codex-content").scrollTop = 0;
    }

    function createCodexStats(rows) {
      const details = document.createElement("dl");
      details.className = "codex-building-stats";
      for (const [name, value] of rows) {
        const term = document.createElement("dt"), detail = document.createElement("dd");
        term.textContent = name; detail.textContent = value;
        details.append(term, detail);
      }
      return details;
    }

    function renderResourceCodex(resource, hero, related) {
      const image = document.createElement("img");
      image.src = assetSource(resource.carryImage); image.alt = resource.name;
      hero.append(image);
      document.getElementById("codex-related-title").textContent = "종족별 채집 조건";
      related.append(createCodexStats(Spawner.PLAYER_TRIBES.map(tribe => {
        const requirements = Spawner.resourceHarvestRequirements({ resourceType: resource.key }, worldMap, tribe.key);
        const keys = Object.keys(requirements).filter(key => requirements[key] > 0);
        return [tribe.name, keys.length ? keys.map(key => ATTRIBUTES.find(attribute => attribute.key === key).name).join(" · ") : "속성 없이 채집 가능"];
      })));
      const heading = document.createElement("h4");
      heading.textContent = "채집 관련 속성";
      const attributes = document.createElement("div");
      attributes.className = "codex-components";
      for (const key of resource.requirements) {
        const link = document.createElement("button");
        link.type = "button"; link.className = "codex-text-link";
        link.textContent = ATTRIBUTES.find(attribute => attribute.key === key).name;
        link.addEventListener("click", () => navigateCodex("attribute:" + key, true));
        attributes.append(link);
      }
      related.append(heading, attributes);
    }

    function renderAttributeCodex(attribute, related) {
      const details = Spawner.codexAttributeDetails(attribute, unitDraft?.tribe || state.tribe);
      related.append(createCodexStats(details.unlocks));
      if (details.resources.length) {
        const heading = document.createElement("h4");
        heading.textContent = "채집 관련 자원";
        const resources = document.createElement("ul");
        resources.className = "codex-terrain-resources";
        for (const resource of details.resources) {
          const item = document.createElement("li");
          item.append(codexResourceLink(resource)); resources.append(item);
        }
        related.append(heading, resources);
      }
    }

    function renderColonyCodex(hero, related) {
      hero.append(createColonyInfoImage(colonyInfoEntry(), 96));
      document.getElementById("codex-related-title").textContent = "레벨별 성장";
      related.append(createNestGrowthTable());
      updateColonyCodex();
    }

    function renderBurrowCodex(value, hero, related) {
      hero.append(createBurrowImage(value.key, 96));
      document.getElementById("codex-related-title").textContent = "";
    }

    function createNestGrowthTable() {
      const tribe = colonyInfoEntry()?.tribe || state.tribe;
      const wrapper = document.createElement("div");
      wrapper.className = "codex-growth-table-wrap";
      const table = document.createElement("table");
      table.className = "codex-growth-table";
      table.id = "codex-growth-table";
      table.setAttribute("aria-label", "둥지 레벨별 성장");
      const head = document.createElement("thead");
      const headings = document.createElement("tr");
      for (const title of ["레벨", "최대 체력", "속성 슬롯", "속성 종류", "진화 포인트 보관량", "기본 자원 보관량", "다음 성장 비용"]) {
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
        const health = document.createElement("td");
        health.textContent = balance.health;
        const slots = document.createElement("td");
        slots.textContent = balance.slotCapacity + "칸";
        const attributes = document.createElement("td");
        const icons = document.createElement("div");
        icons.className = "codex-growth-attributes";
        for (const attribute of ATTRIBUTES) {
          if (attributeUnlockLevel(attribute.key, tribe) === level) icons.append(codexAttributeLink(attribute));
        }
        attributes.append(icons);
        const capacity = document.createElement("td");
        capacity.textContent = balance.pointCapacity.toLocaleString("ko-KR");
        const materials = document.createElement("td");
        materials.textContent = Spawner.materialCapacity(level, []);
        const cost = document.createElement("td");
        const nextCost = nestUpgradeCost(level, tribe);
        cost.textContent = nextCost === null ? "—" : nextCost.toLocaleString("ko-KR");
        row.append(name, health, slots, attributes, capacity, materials, cost);
        body.append(row);
      }
      table.append(head, body);
      wrapper.append(table);
      return wrapper;
    }

    function updateColonyCodex() {
      const table = document.getElementById("codex-growth-table");
      if (!table) return;
      const entry = colonyInfoEntry();
      const level = entry?.nestLevel || state.nestLevel;
      const tribe = entry?.tribe || state.tribe;
      const maximum = level >= NEST_LEVELS.length;
      document.getElementById("codex-article-effect").textContent = maximum ? "최고 둥지 레벨 · Lv." + NEST_LEVELS.length :
        "Lv." + level + " → Lv." + (level + 1);
      for (const row of table.querySelectorAll("tbody tr")) {
        row.setAttribute("aria-current", String(Number(row.dataset.level) === level));
        const cost = nestUpgradeCost(Number(row.dataset.level), tribe);
        row.lastElementChild.textContent = cost === null ? "—" : cost.toLocaleString("ko-KR");
      }
    }

    function updateCodex() {
      const entry = codexEntry(codexState.entry);
      if (!entry) return;
      document.getElementById("nest-growth-info").setAttribute("aria-expanded", String(codex.open && entry.kind === "nest" && entry.key === "colony"));
      if (entry.kind === "nest" && entry.key === "colony") updateColonyCodex();
      updateTerrainCodexCell(entry);
      const counts = attributeCounts(unitDraft ? unitDraft.slots : [], unitDraft?.attributeLevels);
      const stack = document.getElementById("codex-stack");
      stack.hidden = entry.kind !== "attribute";
      if (entry.kind === "attribute") {
        const attribute = entry.value;
        const count = counts[attribute.key];
        const tribe = unitDraft?.tribe || state.tribe;
        setCodexResourceText(stack, (count ? "현재 설계에 장착됨 · " + Spawner.codexAttributeEffect(attribute, count, tribe) :
          "미장착") + " · 해금: 둥지 Lv." + attributeUnlockLevel(attribute.key, tribe));
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

    function setCodexView(view) {
      codex.dataset.view = view;
      codexBrowse.textContent = view === "list" ? "본문" : "목록";
      codexBrowse.setAttribute("aria-label", view === "list" ? "도감 본문 보기" : "도감 목록 보기");
      codexBrowse.setAttribute("aria-expanded", String(view === "list"));
    }

    function revealCodexEntry() {
      const current = codexList.querySelector('[aria-current="page"]');
      if (!current) return;
      const list = codexList.getBoundingClientRect(), entry = current.getBoundingClientRect();
      if (entry.top < list.top) codexList.scrollTop += entry.top - list.top;
      else if (entry.bottom > list.bottom) codexList.scrollTop += entry.bottom - list.bottom;
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
      if (!unitDraft || unitDraft.readOnly || evolutionPanel.hidden || !isAttributeUnlocked(attributeKey, state.nestLevel, unitDraft.tribe) || unitDraft.slots.length >= slotCapacity()) return;
      if (unitDraft.slots.includes(attributeKey)) return;
      unitDraft.slots.push(attributeKey);
      unitDraft.attributeLevels[attributeKey] ||= 1;
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
      const lock = createDesignLock();
      lock.classList.add("attribute-lock");
      button.append(image, count, lock);
      attachAttributeHelp(button, attribute);
      button.addEventListener("click", () => equipDesignAttribute(attribute.key));
      const info = document.createElement("button");
      info.type = "button";
      info.className = "attribute-info";
      info.dataset.attributeInfo = attribute.key;
      info.textContent = "i";
      info.title = attribute.name + " 자세히 보기";
      info.setAttribute("aria-label", attribute.name + " 자세히 보기");
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
      if (unitDraft) {
        unitDraft.nameEdited = true;
        unitDraft.error = "";
      }
      updateUnitDesign();
    });
    designForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveUnitDesign();
    });
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
    document.getElementById("nest-growth-info").addEventListener("click", () => openCodex("nest:colony"));
    nestUpgrade.addEventListener("focus", () => showHelpTooltip(document.getElementById("nest-upgrade-help")));
    nestUpgrade.addEventListener("blur", hideHelpTooltip);
    nestUpgrade.addEventListener("click", async () => {
      nestStatus.textContent = "";
      await sendCommand({ type: "upgrade" });
    });

    const agentPanel = document.getElementById("agent-panel");
    const agentPanelResize = document.getElementById("agent-panel-resize");
    let agentPanelDrag = null;
    let desktopPanelWidth = 280;
    const portraitPanelToggle = document.getElementById("portrait-panel-toggle");
    portraitPanelToggle.addEventListener("click", () => {
      const expanded = agentPanel.dataset.portraitExpanded !== "true";
      agentPanel.dataset.portraitExpanded = String(expanded);
      portraitPanelToggle.setAttribute("aria-expanded", String(expanded));
      portraitPanelToggle.textContent = expanded ? "접기" : "펼치기";
    });

    function setAgentPanelWidth(width) {
      agentPanelResize.tabIndex = portraitLayout.matches ? -1 : 0;
      agentPanelResize.setAttribute("aria-hidden", String(portraitLayout.matches));
      if (portraitLayout.matches) {
        positionDiscoveryToasts(0);
        resizeCanvas();
        return;
      }
      const minimum = Math.min(220, window.innerWidth * 0.55);
      const maximum = Math.min(560, window.innerWidth * 0.7);
      const value = Math.max(minimum, Math.min(maximum, width));
      desktopPanelWidth = value;
      document.documentElement.style.setProperty("--agent-panel-width", value + "px");
      agentPanelResize.setAttribute("aria-valuemin", Math.round(minimum));
      agentPanelResize.setAttribute("aria-valuemax", Math.round(maximum));
      agentPanelResize.setAttribute("aria-valuenow", Math.round(value));
      positionDiscoveryToasts(value);
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
    window.addEventListener("resize", () => setAgentPanelWidth(desktopPanelWidth));
    portraitLayout.addEventListener("change", () => setAgentPanelWidth(desktopPanelWidth));
    const portraitStageResize = new ResizeObserver(() => {
      positionDiscoveryToasts(portraitLayout.matches ? 0 : desktopPanelWidth);
      resizeCanvas();
    });
    portraitStageResize.observe(document.querySelector(".stage"));
    setAgentPanelWidth(desktopPanelWidth);

    const welcome = document.getElementById("welcome");
    const welcomeStatus = document.getElementById("welcome-status");
    const roomTitle = document.getElementById("room-title");
    const roomSeed = document.getElementById("room-seed");
    const roomList = document.getElementById("room-list");
    const roomsDeleteAll = document.getElementById("rooms-delete-all");
    const roomsDeleteEnded = document.getElementById("rooms-delete-ended");
    for (const button of [roomsDeleteAll, roomsDeleteEnded]) {
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "template-delete-dialog");
    }
    const tribeSelection = document.getElementById("tribe-selection");
    const tribeSelectionStatus = document.getElementById("tribe-selection-status");
    const tribeGrid = document.getElementById("tribe-grid");
    const tribePreviews = new Map();
    const tribeWorldMap = document.getElementById("tribe-world-map");
    const tribeStart = document.getElementById("tribe-start");
    function positionTribeStart() {
      const target = document.getElementById(portraitLayout.matches ? "tribe-start-mobile" : "tribe-start-desktop");
      if (tribeStart.parentElement === target) return;
      const focused = document.activeElement === tribeStart;
      target.appendChild(tribeStart);
      if (focused) tribeStart.focus({ preventScroll: true });
    }
    portraitLayout.addEventListener("change", positionTribeStart);
    positionTribeStart();
    let tribePacket = null;
    let selectedTribe = null;
    let tribeRoomId = null;
    let tribePreviewError = "";
    let lobbyBusy = false;
    let roomCount = 0;
    let roomNames = new Set();
    let generatedRoomName = roomTitle.value;
    let endedRoomIds = [];
    let roomCreationProgress = null;

    function setLobbyBusy(busy) {
      lobbyBusy = busy;
      welcome.querySelectorAll("input, button:not(#sound-toggle), select, textarea").forEach(control => { control.disabled = busy; });
      roomsDeleteAll.disabled = busy || roomCount === 0;
      roomsDeleteAll.hidden = roomCount === 0;
      document.getElementById("rooms-refresh").hidden = roomCount === 0;
      roomsDeleteEnded.disabled = busy || endedRoomIds.length === 0;
      roomsDeleteEnded.hidden = endedRoomIds.length === 0;
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
      tribeGrid.querySelectorAll("button").forEach(button => {
        button.setAttribute("aria-pressed", "false");
      });
      connection.active = false;
      welcome.hidden = true;
      tribeSelection.hidden = false;
      drawTribeWorld();
      document.body.dataset.screen = "tribe";
      document.querySelector(".tribe-selection-heading").appendChild(document.getElementById("sound-toggle"));
      document.querySelector(".app").hidden = true;
      document.querySelector(".app").inert = true;
      document.getElementById("tribe-selection-back").focus();
      tribeSelectionStatus.textContent = tribePreviewError;
      tribeGrid.setAttribute("aria-busy", "false");
      tribeGrid.querySelectorAll("button").forEach(button => { button.disabled = false; });
    }

    async function prepareTribePreviews() {
      welcomeStatus.textContent = "미리보기를 불러오는 중…";
      const results = await Promise.allSettled(Spawner.PLAYER_TRIBES.map(async tribe => {
        await prepareTribeRendering([{ tribe: tribe.key }]);
        await prepareUnitAnimationSheets(tribe);
        const art = await tribeArt.preparePreview(tribe);
        const appearance = tribe.key === "bean" ? colonyAppearances[0] : tribeColonies.get(tribe.key);
        art.nestWidth = COLONY_SIZE * appearance.scale * appearance.groundWidth;
        art.nestHeight = COLONY_SIZE * appearance.scale * (1860 / 2048 - appearance.top);
        art.unitSize = AGENT_HEIGHT * unitAnimationSheets.get(tribe.key).get("idle").scale * 2;
        art.unitBounds = tribeArt.bounds(art.idle, Spawner.imageFrameSize(tribe.idle, 512));
        return { tribe, art };
      }));
      for (const result of results) {
        if (result.status === "fulfilled") tribePreviews.set(result.value.tribe.key, result.value.art);
      }
      tribePreviewError = results.some(result => result.status === "rejected") ?
        "일부 미리보기를 불러오지 못했습니다. 부족 선택은 가능합니다." : "";
    }

    function drawTribeWorld() {
      const context = tribeWorldMap.getContext("2d");
      const size = tribeWorldMap.width;
      const displayScale = size / (tribeWorldMap.clientWidth || size);
      context.clearRect(0, 0, size, size);
      context.drawImage(terrainRendering.overview, 0, 0, size, size);
      context.save();
      applyForestMapStyle(context, 0);
      for (const [index, image] of terrainRendering.forest) {
        context.drawImage(image, index % Math.ceil(WORLD_SIZE / 16) * size / Math.ceil(WORLD_SIZE / 16), Math.floor(index / Math.ceil(WORLD_SIZE / 16)) * size / Math.ceil(WORLD_SIZE / 16), size / Math.ceil(WORLD_SIZE / 16), size / Math.ceil(WORLD_SIZE / 16));
      }
      context.restore();
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
        const art = tribePreviews.get(colony.tribe);
        if (art) {
          const crop = art.unitBounds;
          const scale = 22 * displayScale / Math.max(crop.width, crop.height);
          const width = crop.width * scale, height = crop.height * scale;
          const padding = 3 * displayScale, gap = 20 + 4 * displayScale;
          const unitX = x + gap + width <= size - padding ? x + gap : x - gap - width;
          const left = Math.max(padding, Math.min(size - padding - width, unitX));
          const top = Math.max(padding, Math.min(size - padding - height, y - height / 2));
          context.save();
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.shadowColor = "#101719";
          context.shadowBlur = 3 * displayScale;
          context.shadowOffsetY = displayScale;
          context.drawImage(art.idle, crop.x, crop.y, crop.width, crop.height, left, top, width, height);
          context.restore();
        }
      }
    }

    window.addEventListener("resize", () => {
      if (!tribeSelection.hidden) drawTribeWorld();
    });

    function drawTribePreviews(now) {
      if (tribeSelection.hidden) return;
      const previews = [];
      for (const tribe of Spawner.PLAYER_TRIBES) {
        const art = tribePreviews.get(tribe.key);
        if (!art) continue;
        const preview = tribeGrid.querySelector('[data-tribe="' + tribe.key + '"] canvas');
        const rect = preview.getBoundingClientRect();
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
        if (!width || !height) continue;
        if (preview.width !== width || preview.height !== height) { preview.width = width; preview.height = height; }
        previews.push({ tribe, art, preview, width, height });
      }
      if (!previews.length) return;
      const nestWidth = Math.max(...previews.map(entry => entry.art.nestWidth));
      const nestHeight = Math.max(...previews.map(entry => entry.art.nestHeight));
      const scale = Math.min(...previews.map(entry => Math.min(entry.width * .72 / nestWidth, entry.height * .73 / nestHeight)));
      for (const { tribe, art, preview, width, height } of previews) {
        tribeArt.drawPreview(preview.getContext("2d"), art, tribe, now, width, height, idleMotion.matches, scale);
      }
    }

    async function prepareNestGrowthRendering(key) {
      if (nestGrowthRendering.has(key)) return;
      if (nestGrowthLoading.has(key)) return nestGrowthLoading.get(key);
      const task = (async () => {
        if (key !== "bean") await prepareNestGrowthRendering("bean");
        const definition = Spawner.NEST_GROWTH_ANIMATIONS[key];
        if (!definition) return;
        const sheet = new Image(), sprite = new Image(), idleSheet = new Image();
        sheet.src = assetSource(definition.image);
        sprite.src = assetSource(definition.resting);
        idleSheet.src = assetSource(definition.idle.image);
        await Promise.all([sheet.decode(), sprite.decode(), idleSheet.decode()]);
        const base = key === "bean" ? colonyAppearances[0] : tribeColonies.get(key);
        const start = tribeArt.bounds(sheet, definition.frameSize), finish = tribeArt.bounds(sprite, false);
        const reference = base.animation?.sheet || base.sprite;
        const source = tribeArt.bounds(reference, !!base.animation?.sheet);
        const placementWidth = base.animation?.placement?.width || 1;
        const referenceSize = base.animation?.sheet ? base.animation.frameSize : reference.naturalWidth;
        const ratio = source.width / referenceSize * placementWidth / (start.width / definition.frameSize);
        const scale = base.scale * ratio;
        const root = 1860 / 2048;
        const offset = base.centerY == null ? root - .5 : base.scale * (root - base.centerY);
        const appearance = { sprite, scale, centerY: .875 - offset / scale,
          groundWidth: finish.width / definition.frameSize, top: finish.y / definition.frameSize,
          animation: { ...definition.idle, sheet: idleSheet, smooth: false } };
        if (base.birthOutlet) appearance.birthOutlet = {
          x: .5 + (base.birthOutlet.x - .5) / ratio,
          y: .875 + (base.birthOutlet.y - root) / ratio
        };
        if (base.birthScene) appearance.birthScene = {
          x: .5 + (base.birthScene.x - .5) / ratio,
          y: .875 + (base.birthScene.y - root) / ratio, size: base.birthScene.size / ratio
        };
        const referenceLevels = nestGrowthRendering.get("bean")?.levels;
        if (key !== "bean") fitColonyAppearance(appearance, referenceLevels[2]);
        const levels = { 2: appearance };
        await Promise.all(Object.entries(definition.levels).map(async ([level, source]) => {
          const sprite = new Image();
          const idle = Spawner.nestIdleAnimation(key, Number(level));
          const idleSheet = idle ? new Image() : null;
          sprite.src = assetSource(source);
          if (idleSheet) idleSheet.src = assetSource(idle.image);
          await Promise.all([sprite.decode(), idleSheet?.decode()]);
          const bounds = tribeArt.bounds(sprite, false);
          levels[level] = { ...appearance, sprite,
            groundWidth: bounds.width / sprite.naturalWidth, top: bounds.y / sprite.naturalHeight,
            animation: idle ? { ...idle, sheet: idleSheet, smooth: false } :
              { smooth: true, frameCount: 1, frameMs: 1, restMs: 0 } };
          if (key !== "bean") fitColonyAppearance(levels[level], referenceLevels[level]);
        }));
        const upgrades = {};
        await Promise.all(Object.entries(definition.upgrades).map(async ([level, upgrade]) => {
          const sheet = new Image();
          sheet.src = assetSource(upgrade.image);
          await sheet.decode();
          const placement = key === "bean" ? null : colonyGrowthPlacement(sheet, upgrade, levels[upgrade.fromLevel], levels[level]);
          upgrades[level] = { appearance: levels[level], placement, animation: { ...upgrade, sheet } };
        }));
        const placement = key === "bean" ? null : colonyGrowthPlacement(sheet, definition, base, appearance);
        nestGrowthRendering.set(key, { appearance, levels, upgrades, placement,
          animation: { sheet, frameSize: definition.frameSize, columns: definition.columns, frameCount: definition.frameCount } });
      })();
      nestGrowthLoading.set(key, task);
      try { await task; }
      finally { nestGrowthLoading.delete(key); }
    }

    async function prepareTribeRendering(colonies) {
      await colonyAppearances[0].sprite.decode();
      await Promise.all([...new Set(colonies.map(colony => colony.tribe).filter(key => key && key !== "bean"))].map(async key => {
        const tribe = Spawner.PLAYER_TRIBES.find(entry => entry.key === key);
        await prepareAgentMovement(tribe);
        if (key === "spore") await prepareSporeBirth();
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
        if (key === "spore") {
          const sheet = new Image();
          sheet.src = assetSource("DesignAssets/Tribes/spore/Animations/Nests/stage-01-idle-spine-v1/nest-stage-01-idle-sheet.png");
          await sheet.decode();
          const frameBounds = tribeArt.bounds(sheet, true);
          const frameScale = Math.min(width / frameBounds.width, height / frameBounds.height);
          appearance.animation = { smooth: false, sheet, frameSize: 512, columns: 12, frameCount: 96,
            frameMs: 4000 / 96, restMs: 0, placement: {
              x: ((2048 - width) / 2 - frameBounds.x * frameScale) / 2048,
              y: (1860 - height - frameBounds.y * frameScale) / 2048,
              width: 512 * frameScale / 2048, height: 512 * frameScale / 2048
            } };
          const bounds = Spawner.SPORE_BIRTH_ANIMATION.nestBounds;
          const sceneScale = Math.min(width / bounds.width, height / bounds.height);
          appearance.birthScene = { x: ((2048 - width) / 2 - bounds.x * sceneScale) / 2048,
            y: (1860 - height - bounds.y * sceneScale) / 2048, size: Spawner.SPORE_BIRTH_ANIMATION.frameSize * sceneScale / 2048 };
          appearance.birthOutlet = { x: appearance.birthScene.x + Spawner.SPORE_BIRTH_ANIMATION.outletX * sceneScale / 2048,
            y: appearance.birthScene.y + Spawner.SPORE_BIRTH_ANIMATION.outletY * sceneScale / 2048 };
        }
        if (key === "spring") {
          const sheet = new Image();
          sheet.src = assetSource("DesignAssets/Tribes/spring/Animations/Nests/stage-01-idle-v5/nest-stage-01-idle-sheet.png");
          await sheet.decode();
          const sourceScale = 420 / 1492;
          const nestScale = Spawner.imageScale(tribe.nest);
          const frameScale = scale * nestScale / sourceScale;
          appearance.animation = {
            smooth: false, sheet, frameSize: 512, columns: 10, frameCount: 60, frameMs: 4000 / 60, restMs: 0,
            placement: {
              x: ((2048 - width) / 2 - bounds.x * scale - (46 - 142 * sourceScale) * frameScale) / 2048,
              y: (1860 - height - bounds.y * scale - (466 - 774 * sourceScale) * frameScale) / 2048,
              width: 512 * frameScale / 2048, height: 512 * frameScale / 2048
            }
          };
          appearance.birthOutlet = {
            x: ((2048 - width) / 2 + (1616 * nestScale - bounds.x) * scale) / 2048,
            y: (1860 - height + (646 * nestScale - bounds.y) * scale) / 2048
          };
        }
        if (key === "pebble") {
          const sheet = new Image();
          sheet.src = assetSource("DesignAssets/Tribes/pebble/Animations/Nests/stage-01-idle-glow-v3/nest-stage-01-idle-sheet.webp");
          await sheet.decode();
          appearance.animation = { smooth: false, sheet, frameSize: 512, columns: 8, frameCount: 48, frameMs: 100, restMs: 0 };
          appearance.birthOutlet = { x: PEBBLE_BIRTH_ANIMATION.nestOutletX, y: PEBBLE_BIRTH_ANIMATION.nestOutletY };
        }
        fitColonyAppearance(appearance, colonyAppearances[0]);
        tribeColonies.set(key, appearance);
      }));
      await Promise.all([...new Set(colonies.map(colony => colony.tribe || "bean"))].map(prepareNestGrowthRendering));
    }

    for (const tribe of Spawner.PLAYER_TRIBES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tribe-choice";
      button.dataset.tribe = tribe.key;
      const tagText = tribe.key === "bean" ? "초보자 추천" : tribe.key === "spring" ? "어려움" : "";
      button.setAttribute("aria-label", tribe.name + " 부족 선택" + (tagText ? " · " + tagText : ""));
      button.setAttribute("aria-pressed", "false");
      const preview = document.createElement("canvas");
      preview.setAttribute("aria-hidden", "true");
      const footer = document.createElement("span");
      footer.className = "tribe-choice-footer";
      const name = document.createElement("strong");
      name.textContent = tribe.name;
      footer.append(name);
      if (tagText) {
        const tag = document.createElement("span");
        tag.className = "tribe-choice-tag";
        tag.textContent = tagText;
        footer.append(tag);
      }
      button.append(preview, footer);
      button.addEventListener("click", () => {
        if (lobbyBusy || !tribeRoomId) return;
        selectedTribe = tribe;
        tribeGrid.querySelectorAll("button").forEach(choice => {
          choice.setAttribute("aria-pressed", String(choice === button));
        });
        tribeStart.textContent = tribe.name + " 부족으로 시작";
        tribeStart.disabled = false;
        tribeSelectionStatus.textContent = "";
        drawTribeWorld();
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
      rememberRoom(null);
      tribeSelection.hidden = true;
      tribeRoomId = null;
      tribePacket = null;
      selectedTribe = null;
      welcome.hidden = false;
      randomRoomSeed();
      document.body.dataset.screen = "welcome";
      document.querySelector(".welcome-heading").appendChild(document.getElementById("sound-toggle"));
      welcomeStatus.textContent = "";
      await refreshRooms();
      document.getElementById("welcome-title").focus();
    });

    const endingReport = document.getElementById("ending-report");
    const endingToolbar = document.getElementById("ending-toolbar");
    let endingRoomId = null;
    const endingPlayback = { elapsedMs: 0, pending: false };

    function resetEnding() {
      endingPlayback.elapsedMs = 0;
      endingPlayback.pending = false;
      endingRoomId = null;
      canvas.style.removeProperty("--ending-fade");
      endingReport.close();
      endingToolbar.hidden = true;
      delete document.body.dataset.ending;
    }

    function openEndingReport() {
      if (!state.ending || !connection.active || document.body.dataset.screen !== "game" ||
          endingPlayback.elapsedMs < 4000 || endingReport.open) return;
      closeCodex(false);
      closeEvolutionPanel();
      closeColonyMenu();
      closeUnitPanel();
      hideHelpTooltip();
      stopMapMovement();
      state.dragging = false;
      endingReport.showModal();
      document.getElementById("ending-browse").focus();
    }

    function corpsePlaybackTime() {
      return state.simSeconds + (state.ending && endingRoomId === connection.roomId ? endingPlayback.elapsedMs / 1000 : 0);
    }

    function updateEndingPresentation(elapsedMs) {
      if (!state.ending || endingRoomId !== connection.roomId || document.body.dataset.screen !== "game") return;
      endingPlayback.elapsedMs = Math.min(4000, endingPlayback.elapsedMs + elapsedMs);
      const progress = clamp((endingPlayback.elapsedMs - 2000) / 2000, 0, 1);
      const fade = idleMotion.matches ? Number(progress > 0) : progress * progress * (3 - 2 * progress);
      canvas.style.setProperty("--ending-fade", String(fade));
      endingToolbar.hidden = endingPlayback.elapsedMs < 4000;
      if (endingPlayback.elapsedMs >= 4000 && endingPlayback.pending) {
        endingPlayback.pending = false;
        openEndingReport();
      }
    }

    function updateEnding(live) {
      if (!state.ending) {
        endingToolbar.hidden = true;
        delete document.body.dataset.ending;
        return;
      }
      if (document.body.dataset.screen !== "game" || endingRoomId === connection.roomId) return;
      endingRoomId = connection.roomId;
      endingPlayback.elapsedMs = live ? 0 : 4000;
      endingPlayback.pending = true;
      state.lastFrame = performance.now();
      canvas.style.setProperty("--ending-fade", live ? "0" : "1");
      document.body.dataset.ending = "true";
      clearDiscoveryToasts();
      const report = state.ending;
      document.getElementById("ending-colony").textContent = colonyEntries.find(entry => entry.id === connection.colonyId)?.name || "군락의 기록";
      document.getElementById("ending-reason").textContent = report.reason === "nest-destroyed" ?
        "둥지가 무너지고 마지막 생명도 떠났습니다." : "유닛이 모두 떠났고, 새 생명을 탄생시킬 진화 포인트가 부족합니다.";
      const seconds = Math.floor(report.endedAt);
      const values = [["생존 시간", Math.floor(seconds / 60) + "분 " + seconds % 60 + "초"],
        ["탄생한 생명", report.bornCount.toLocaleString("ko-KR") + "개체"],
        ["탐사한 땅", report.exploredCells.toLocaleString("ko-KR") + "칸"],
        ["발견한 대상", report.discoveryCount.toLocaleString("ko-KR") + "종"],
        ["둥지 성장", "Lv." + report.nestLevel], ["모은 진화 포인트", report.colonyFood.toLocaleString("ko-KR")]];
      const fragment = document.createDocumentFragment();
      for (const [label, value] of values) {
        const entry = document.createElement("div");
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        description.textContent = value;
        entry.append(term, description);
        fragment.append(entry);
      }
      document.getElementById("ending-stats").replaceChildren(fragment);
      document.getElementById("ending-status").textContent = "";
      updateEndingPresentation(0);
    }

    const reloadToast = document.getElementById("reload-toast");
    let reloadToastTimer = null;

    function showReloadToast() {
      clearTimeout(reloadToastTimer);
      reloadToast.classList.add("is-visible");
      reloadToastTimer = setTimeout(() => {
        reloadToast.classList.remove("is-visible");
        reloadToastTimer = null;
      }, 2200);
    }

    const roomExit = document.getElementById("room-exit");
    const roomExitDialog = document.getElementById("room-exit-dialog");
    const roomExitCancel = document.getElementById("room-exit-cancel");
    for (const button of [roomExit, document.getElementById("ending-leave"), document.getElementById("ending-rooms")]) {
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "room-exit-dialog");
    }
    let roomTransition = false;

    function confirmRoomExit() {
      if (roomExitDialog.open) return Promise.resolve(false);
      return new Promise(resolve => {
        const form = roomExitDialog.querySelector("form");
        const onCancel = event => { event.preventDefault(); finish(false); };
        const onSubmit = event => { event.preventDefault(); finish(event.submitter?.value === "leave"); };
        function finish(confirmed) {
          roomExitDialog.removeEventListener("cancel", onCancel);
          form.removeEventListener("submit", onSubmit);
          roomExitDialog.close(confirmed ? "leave" : "cancel");
          resolve(confirmed);
        }
        roomExitDialog.returnValue = "cancel";
        roomExitDialog.addEventListener("cancel", onCancel);
        form.addEventListener("submit", onSubmit);
        hideHelpTooltip();
        roomExitDialog.showModal();
        roomExitCancel.focus();
      });
    }

    async function leaveRoom() {
      if (connection.busy || !connection.active || roomTransition || roomExitDialog.open) return;
      if (!await confirmRoomExit() || connection.busy || !connection.active || roomTransition) return;
      roomTransition = true;
      connection.busy = true;
      connection.active = false;
      document.querySelector(".app").inert = true;
      const buttons = [roomExit, ...endingReport.querySelectorAll("button"), ...endingToolbar.querySelectorAll("button")];
      buttons.forEach(button => { button.disabled = true; });
      try {
        await client.call("pause", { visible: false });
        rememberRoom(null);
        connection.active = false;
        connection.online = false;
        audio.setActive(false);
        audio.updateMusic(null);
        resetEnding();
        closeCodex(false);
        closeEvolutionPanel();
        closeColonyMenu();
        closeUnitPanel();
        document.querySelector(".app").hidden = true;
        document.querySelector(".app").inert = true;
        welcome.hidden = false;
        randomRoomSeed();
        document.body.dataset.screen = "welcome";
        document.querySelector(".welcome-heading").appendChild(document.getElementById("sound-toggle"));
        audio.setActive(!document.hidden);
        await refreshRooms();
        document.getElementById("welcome-title").focus();
      } catch (error) {
        connection.active = true;
        document.querySelector(".app").inert = false;
        if (state.ending) {
          document.getElementById("ending-status").textContent = error.message;
          openEndingReport();
        } else if (!connectionStatus.querySelector(".storage-recovery")) showConnectionError(error.message);
      } finally {
        roomTransition = false;
        connection.busy = false;
        buttons.forEach(button => { button.disabled = false; });
      }
    }

    async function reloadRoom() {
      roomTransition = true;
      connection.active = false;
      document.querySelector(".app").inert = true;
      try {
        await client.call("pause", { visible: false });
        location.reload();
      } catch (error) {
        roomTransition = false;
        connection.active = true;
        document.querySelector(".app").inert = false;
        if (!connectionStatus.querySelector(".storage-recovery")) showConnectionError(error.message);
      }
    }

    window.addEventListener("keydown", event => {
      const reloadKey = !event.altKey && !event.shiftKey && (event.code === "F5" && !event.ctrlKey && !event.metaKey ||
        event.code === "KeyR" && (event.ctrlKey || event.metaKey));
      if (!reloadKey || !welcome.hidden || !connection.active && !roomTransition) return;
      event.preventDefault();
      if (globalThis.SpawnerProduction === true) {
        if (!event.repeat) showReloadToast();
        return;
      }
      if (!event.repeat && !roomTransition) reloadRoom();
    }, true);
    roomExit.addEventListener("click", leaveRoom);

    document.getElementById("ending-report-open").addEventListener("click", openEndingReport);
    document.getElementById("ending-browse").addEventListener("click", () => {
      endingReport.close();
      canvas.focus();
    });
    endingReport.addEventListener("close", () => {
      if (connection.active && document.body.dataset.screen === "game") canvas.focus();
    });
    document.getElementById("ending-leave").addEventListener("click", leaveRoom);
    document.getElementById("ending-rooms").addEventListener("click", leaveRoom);

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
      const colonyChanged = connection.colonyId !== null && connection.colonyId !== packet.colonyId;
      if (colonyChanged) {
        resetEnding();
        closeEvolutionPanel();
        closeColonyMenu();
        closeUnitPanel();
        selectObject(null, null);
        clearDiscoveryToasts();
        foodDeliveries.clear();
        forest.revealed.clear();
        state.flashes = [];
        state.dragging = false;
        state.selectedTemplateId = null;
      }
      const selection = state.selection;
      const previousDiscoveryKeys = new Set(state.discoveries.map(entry => entry.key));
      const firstSnapshot = connection.revision < 0 || connection.synchronizing || colonyChanged;
      const endingStarted = !firstSnapshot && !state.ending && !!packet.state.ending;
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
      if (colonyChanged) focusColony();
      const { food, sharedTrails, footprints, explored, visible, ...view } = packet.state;
      if (state.corpses.some(corpse => !view.corpses.some(current => current.id === corpse.id))) {
        combatAttributeArt.clearDeaths();
        for (const sheets of unitAnimationSheets.values()) sheets.get("death")?.attributeFrames?.clear();
      }
      Object.assign(state, view);
      if (!firstSnapshot && !state.ending) state.simSeconds = renderedAt;
      syncAgentMovements([...state.agents, ...state.rivals], packet.state.simSeconds, firstSnapshot);
      Spawner.syncAgentLevelUpPlayback(agentLevelUpPlayback, [...state.agents, ...state.rivals], packet.state.simSeconds, firstSnapshot);
      Spawner.syncNestGrowthPlayback(nestGrowthPlayback, colonyEntries, state.simSeconds, firstSnapshot);
      Spawner.syncStructureEffectPlayback(structureEffectPlayback, colonyEntries,
        view.burrows || worldMap.burrows, state.simSeconds, firstSnapshot, packet.state.simSeconds);
      Spawner.syncHarvestPlayback(harvestPlayback, [...state.agents, ...state.rivals], packet.state.simSeconds, firstSnapshot);
      harvestDisplay.time = null;
      if (Array.isArray(view.burrows)) worldMap.burrows = view.burrows;
      audio.updateMusic(packet.state);
      if (firstSnapshot) agentHeadMotions.clear();
      const agents = new Set([...state.agents, ...state.rivals].map(agent => agent.id));
      for (const id of agentHeadMotions.keys()) if (!agents.has(id)) agentHeadMotions.delete(id);
      if (firstSnapshot || snapshotCollections.sharedTrails !== sharedTrails) state.sharedTrails = new Map(sharedTrails);
      if (firstSnapshot || snapshotCollections.footprints !== footprints) state.footprints = new Map((footprints || []).map(cell => [cell.x + "," + cell.y, cell]));
      const exploredChanges = firstSnapshot ? explored : explored.slice(state.explored.size);
      if (firstSnapshot) state.explored = new Set(explored);
      else for (const index of exploredChanges) state.explored.add(index);
      if (firstSnapshot || snapshotCollections.visible !== visible) state.visible = new Set(visible);
      if (firstSnapshot || snapshotCollections.visible !== visible || exploredChanges.length) updateFog(connection.receivedAt, firstSnapshot, exploredChanges);
      if (firstSnapshot || snapshotCollections.food !== food) {
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
            for (const index of forestTreeRegions(tree)) updateForestRegion(index % Math.ceil(WORLD_SIZE / 16) * 16, Math.floor(index / Math.ceil(WORLD_SIZE / 16)) * 16);
            forestChanged = true;
          }
        }
        if (forestChanged) forest.trees = forest.trees.filter(tree => forest.cells.has(tree.column + "," + tree.row));
      }
      Object.assign(snapshotCollections, { food, sharedTrails, footprints, visible });
      if (selection) {
        const target = selection.kind === "terrain" ? terrainCodexCell({ ...worldMap, size: WORLD_SIZE }, state.explored, selection.target.x, selection.target.y) :
          selection.kind === "agent" ? agentById(selection.target.id) :
          selection.kind === "corpse" ? state.corpses.find(corpse => corpse.id === selection.target.id) :
          selection.kind === "colony" ? colonyEntries.find((colony) => colony.id === selection.target.id) :
          selection.kind === "tree" ? forest.cells.get(selection.target.column + "," + selection.target.row) :
          selection.kind === "hazard" ? hazardCells[selection.target.row * WORLD_SIZE + selection.target.column] :
          selection.kind === "burrow" ? worldMap.burrows.find(burrow => burrow.id === selection.target.id && burrow.health > 0) :
          foodCellMap.get(selection.target.key || selection.target.x + "," + selection.target.y);
        const corpse = selection.kind === "agent" && !target ? state.corpses.find(cell => cell.agentId === selection.target.id) : null;
        state.selection = corpse ? { kind: "corpse", target: corpse } : target &&
          (selection.kind !== "agent" || isAgentSelectable(target)) && (selection.kind !== "corpse" ||
          target.kind === "corpse") ? { kind: selection.kind, target } : null;
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
      updateEnding(endingStarted);
      scheduleRender();
    }

    async function sendCommand(action, allowEnded) {
      if (connection.busy || !connection.active || !connection.online || state.ending && !allowEnded && action.type !== "read-discoveries") return null;
      const roomId = connection.roomId;
      connection.busy = true;
      updateColonyPanel();
      try {
        if (action.type === "birth" || action.type === "design" && action.birth) {
          const template = action.type === "birth" ? action.agentId !== undefined ?
            state.agents.find(candidate => candidate.id === action.agentId) : state.templates.find(candidate => candidate.id === action.templateId) : action;
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

    function rememberRoom(roomId) {
      history.replaceState({ ...history.state, spawnerRoomId: roomId }, "");
    }

    async function prepareRoom(roomId) {
      const packet = await client.call("enter", { roomId, visible: false });
      await prepareWorldRendering(packet.world, packet.tribeStarts || packet.colonies);
      if (packet.colonies.find(colony => colony.id === packet.colonyId).tribe === null) await prepareTribePreviews();
      updateRoomCreationProgress(100);
      return packet;
    }

    async function enterRoom(roomId, packet) {
      resetEnding();
      audio.updateMusic(null);
      connection.roomId = roomId;
      connection.revision = -1;
      clearDiscoveryToasts();
      foodDeliveries.clear();
      resetAudio();
      connection.active = false;
      connection.online = false;
      try {
        packet ||= await prepareRoom(roomId);
        rememberRoom(roomId);
        if (packet.colonies.find(colony => colony.id === packet.colonyId).tribe === null) {
          showTribeSelection(packet);
          return;
        }
        await prepareTribeRendering(Spawner.PLAYER_TRIBES.map(tribe => ({ tribe: tribe.key })));
        connection.active = true;
        applySnapshot(packet);
        if (!connection.online) return;
        if (terrainRendering.cacheError) {
          setEvolutionText(connectionStatus, terrainRendering.cacheError);
          connectionStatus.hidden = false;
        }
        await prepareAgentRendering();
        closeEvolutionPanel();
        closeColonyMenu();
        selectObject(null, null);
        state.flashes = [];
        state.dragging = false;
        welcome.hidden = true;
        tribeSelection.hidden = true;
        document.body.dataset.screen = "game";
        canvas.parentElement.appendChild(document.getElementById("sound-toggle"));
        document.querySelector(".app").hidden = false;
        document.querySelector(".app").inert = false;
        resizeCanvas();
        focusColony();
        canvas.focus();
        updateEnding(false);
        await client.call("resume", { visible: !document.hidden });
      } catch (error) {
        connection.active = false;
        setEvolutionText(tribeSelection.hidden ? welcomeStatus : tribeSelectionStatus, error.message);
      }
    }

    function createRoomWorldPreview(room) {
      const canvas = document.createElement("canvas");
      canvas.className = "room-world-preview";
      canvas.width = canvas.height = 96;
      canvas.setAttribute("aria-hidden", "true");
      const preview = room.worldPreview;
      if (!preview) return canvas;
      const context = canvas.getContext("2d");
      const image = context.createImageData(preview.size, preview.size);
      const colors = TERRAIN_TYPES.map(type => TERRAIN_COLORS[type].slice(1).match(/../g).map(value => parseInt(value, 16)));
      for (let index = 0; index < preview.tiles.length; index++) {
        const color = colors[parseInt(preview.tiles[index], 16)] || colors[0];
        image.data.set([...color, 255], index * 4);
      }
      context.putImageData(image, 0, 0);
      if (preview.colony) {
        const x = Math.max(5, Math.min(91, preview.colony.x * canvas.width));
        const y = Math.max(5, Math.min(91, preview.colony.y * canvas.height));
        context.beginPath();
        context.arc(x, y, 3.5, 0, Math.PI * 2);
        context.fillStyle = { bean: "#95c97b", spore: "#e79791", pebble: "#d7b478", spring: "#85cece" }[preview.colony.tribe] || "#ffffff";
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = "#101719";
        context.stroke();
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.lineWidth = 1;
        context.strokeStyle = "#ffffffcc";
        context.stroke();
      }
      return canvas;
    }

    async function refreshRooms() {
      const version = ++lobbyVersion;
      roomList.setAttribute("aria-busy", "true");
      try {
        const rooms = await client.call("list", null);
        if (version !== lobbyVersion) return;
        roomNames = new Set(rooms.map(room => room.title));
        if (!roomTitle.value || roomTitle.value === generatedRoomName && (!roomsSignature || roomNames.has(roomTitle.value))) randomRoomName();
        const signature = JSON.stringify([connection.roomId, rooms]);
        if (signature === roomsSignature) return;
        roomsSignature = signature;
        roomCount = rooms.length;
        roomList.closest("section").hidden = roomCount === 0;
        endedRoomIds = rooms.filter(room => room.ending).map(room => room.id);
        document.getElementById("room-count").textContent = String(roomCount);
        const fragment = document.createDocumentFragment();
        for (const room of rooms.toSorted((a, b) => Number(!!a.ending) - Number(!!b.ending) ||
          Number(b.id === connection.roomId) - Number(a.id === connection.roomId))) {
          const row = document.createElement("div");
          row.className = "room-item" + (room.id === connection.roomId ? " is-host" : "") + (room.ending ? " is-ended" : "");
          const text = document.createElement("div");
          text.className = "room-info";
          const title = document.createElement("strong");
          title.textContent = room.title;
          if (room.ending) {
            const badge = document.createElement("span");
            badge.className = "room-ending-badge";
            badge.textContent = "멸망";
            title.append(badge);
          }
          if (room.id === connection.roomId) {
            const badge = document.createElement("span");
            badge.className = "room-owner-badge";
            badge.textContent = "최근 방";
            title.append(badge);
          }
          const detail = document.createElement("small");
          detail.textContent = (room.ending ? "멸망 · " + Math.floor(room.ending.endedAt / 60) + "분의 기록" : room.tribe === null ? "부족 선택 전" : Math.floor(room.simSeconds / 60) + "분 진행") + " · " + new Date(room.updatedAt).toLocaleString("ko-KR");
          const seed = document.createElement("small");
          seed.className = "room-seed-label";
          seed.textContent = "시드 " + room.seed;
          text.append(title, detail, seed);
          const join = document.createElement("button");
          join.type = "button";
          join.className = room.ending ? "secondary-action" : "primary-action";
          join.textContent = room.ending ? "둘러보기" : room.tribe === null ? "부족 선택" : "이어하기";
          join.addEventListener("click", () => lobbyAction("enter", { roomId: room.id }));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "secondary-action room-delete";
          remove.textContent = "×";
          remove.setAttribute("aria-label", room.title + " 삭제");
          remove.title = "방 삭제";
          remove.setAttribute("aria-haspopup", "dialog");
          remove.setAttribute("aria-controls", "template-delete-dialog");
          remove.addEventListener("click", () => deleteRoom(room));
          const actions = document.createElement("div");
          actions.className = "room-actions";
          actions.append(join, remove);
          row.append(createRoomWorldPreview(room), text, actions);
          fragment.append(row);
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
          welcome.setAttribute("aria-busy", "false");
        }
      }
    }

    async function deleteRoom(room) {
      if (lobbyBusy) return;
      if (!await confirmDelete("방 삭제", room.title + " 방의 진행 기록을 삭제할까요?\n삭제한 진행 기록은 복구할 수 없습니다.") || lobbyBusy) return;
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

    async function deleteEndedRooms() {
      if (lobbyBusy || endedRoomIds.length === 0) return;
      const roomIds = [...endedRoomIds];
      if (!await confirmDelete("멸망한 방 삭제", "멸망한 방 " + roomIds.length + "개와 진행 기록을 삭제할까요?\n삭제한 진행 기록은 복구할 수 없습니다.") || lobbyBusy) return;
      setLobbyBusy(true);
      welcomeStatus.textContent = "멸망한 방 삭제 중…";
      try {
        const result = await client.call("delete-ended", { roomIds });
        if (result.roomIds.includes(connection.roomId)) connection.roomId = null;
        welcomeStatus.textContent = result.roomIds.length ? "멸망한 방 " + result.roomIds.length + "개를 삭제했습니다." : "삭제할 멸망한 방이 없습니다.";
      } catch (error) { setEvolutionText(welcomeStatus, error.message); }
      finally {
        await refreshRooms();
        setLobbyBusy(false);
      }
    }

    async function deleteAllRooms() {
      if (lobbyBusy || roomCount === 0) return;
      if (!await confirmDelete("전체 삭제", "내 방 목록의 모든 방(" + roomCount + "개)과 진행 기록을 삭제할까요?\n삭제한 진행 기록은 복구할 수 없습니다.") || lobbyBusy) return;
      setLobbyBusy(true);
      welcomeStatus.textContent = "모든 방 삭제 중…";
      try {
        await client.call("delete-all", null);
        connection.roomId = null;
        welcomeStatus.textContent = "모든 방을 삭제했습니다.";
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
      welcomeStatus.textContent = type === "create" ? "생성 중…" : "입장 준비 중…";
      try {
        const result = type === "create" ? await client.call("create", data, progress => updateRoomCreationProgress(progress * 40)) : data;
        const packet = await prepareRoom(result.roomId);
        await enterRoom(result.roomId, packet);
        if (welcome.hidden) welcomeStatus.textContent = "";
      } catch (error) { setEvolutionText(welcomeStatus, error.message); }
      finally {
        setLobbyBusy(false);
        roomCreationProgress = null;
        createButton.textContent = createButtonText;
      }
    }

    function randomRoomName() {
      const names = [
        "아르카디아", "아발론", "엘도라도", "아틀란티스", "샹그릴라", "무릉도원",
        "에덴", "판게아", "레무리아", "하이페리온", "아스가르드", "엘리시움",
        "미드가르드", "알프헤임", "발할라", "이그드라실", "올림포스", "헤스페리아",
        "테라노바", "솔라리스", "오로라", "네뷸라", "루미나", "코스모스",
        "셀레스티아", "실바니아", "아르보리아", "아스테리아", "에테르", "아우렐리아",
        "라피스", "아카샤", "파라디소", "에버그린", "이스", "에레혼"
      ];
      const available = names.filter(name => !roomNames.has(name));
      const alternatives = available.filter(name => name !== roomTitle.value);
      const choices = alternatives.length ? alternatives : available;
      generatedRoomName = choices.length ? choices[Math.floor(Math.random() * choices.length)] : "";
      roomTitle.value = generatedRoomName;
      roomTitle.setCustomValidity("");
    }

    function randomRoomSeed() {
      roomSeed.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    }

    document.getElementById("room-seed-random").addEventListener("click", randomRoomSeed);
    roomTitle.addEventListener("input", () => {
      generatedRoomName = "";
      roomTitle.setCustomValidity("");
    });
    document.getElementById("room-name-random").addEventListener("click", randomRoomName);
    document.getElementById("welcome-form").addEventListener("submit", (event) => {
      event.preventDefault();
      lobbyAction("create", { title: roomTitle.value.trim(), seed: roomSeed.value === "" ? null : Number(roomSeed.value) });
    });
    document.getElementById("rooms-refresh").addEventListener("click", refreshRooms);
    roomsDeleteAll.addEventListener("click", deleteAllRooms);
    roomsDeleteEnded.addEventListener("click", deleteEndedRooms);
    async function restoreSession() {
      setLobbyBusy(true);
      try {
        const result = await client.call("session", null);
        connection.roomId = result.roomId;
        const reloading = performance.getEntriesByType("navigation")[0]?.type === "reload";
        const roomId = Object.hasOwn(history.state || {}, "spawnerRoomId") ? history.state.spawnerRoomId : result.roomId;
        if (!reloading) rememberRoom(null);
        await refreshRooms();
        if (reloading && roomId) await enterRoom(roomId);
      } catch (error) {
        setEvolutionText(welcomeStatus, error.message);
        roomList.textContent = "방 목록을 불러오지 못했습니다.";
        roomList.setAttribute("aria-busy", "false");
        document.getElementById("room-create-panel").hidden = false;
        welcome.setAttribute("aria-busy", "false");
      } finally { setLobbyBusy(false); }
    }

    randomRoomSeed();
    {
      restoreSession();
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
      document.getElementById("welcome").setAttribute("aria-busy", "false");
      document.querySelector('#welcome-form button[type="submit"]').disabled = true;
    });
