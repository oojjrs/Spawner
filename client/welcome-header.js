globalThis.SpawnerWelcomeHeaderReady = (async () => {
  "use strict";
  let audioConnection = null;
  let audioReset = null;
  let startPresentation = null;
  let resourcesReady = false;
  globalThis.SpawnerWelcomeHeader = Object.freeze({ attachAudio(audio) {
    if (audioConnection === audio) return;
    audioReset?.();
    audioConnection = audio;
  }, start() { return startPresentation?.(); },
  presentationResources() { if (!resourcesReady) return null; return { images: sources, sheets: nativeAssets.sheets, creatures: creatureResources }; } });
  await globalThis.SpawnerAssets.welcomeReady;
  const welcome = document.getElementById("welcome");
  const title = document.getElementById("welcome-title");
  const stage = welcome.querySelector(".welcome-stage") || document.createElement("div");
  stage.className = "welcome-stage";
  if (!stage.parentNode) {
    title.before(stage);
    stage.append(title);
  }
  stage.style.backgroundImage = "url(" + JSON.stringify(globalThis.SpawnerWelcomeBackground || "DesignAssets/Welcome/forest-clearing.webp") + ")";
  let waveform = welcome.querySelector(".welcome-waveform");
  if (!waveform) {
    waveform = document.createElement("canvas");
    waveform.className = "welcome-waveform";
    waveform.setAttribute("aria-hidden", "true");
    stage.after(waveform);
  }
  const canvas = document.createElement("canvas");
  canvas.className = "welcome-characters";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);
  let context = canvas.getContext("2d");
  const tribes = ["bean", "spore", "pebble", "spring"];
  const model = globalThis.Spawner;
  function createSurface(width, height) {
    const surface = document.createElement("canvas"); surface.width = width; surface.height = height; return surface;
  }
  let unitPresentation;
  const nativeAssets = model.createUnitPresentationAssets({ model, createImage: globalThis.SpawnerAssets.image, source: globalThis.SpawnerAssets.source, makeSurface: createSurface,
    prepareSproutFrames: (entry, count) => unitPresentation.prepareSproutCombatFrames(entry, count) });
  const tribeArt = nativeAssets.tribeArt;
  const sources = nativeAssets.images;
  const parts = new Map(), spriteCache = new Map(), headMotions = new Map();
  const movementSheets = new Map();
  const roots = model.createSproutRoots(createSurface);
  function agentSprite(agent, layer) {
    const attributes = model.unitDisplayAttributes(agent);
    if (agent.tribe && agent.tribe !== "bean") return tribeArt.sprite(agent.tribe, attributes, layer || "full");
    const counts = { strength: attributes.strength ?? attributes.arms ?? 0, feet: attributes.feet || 0, antenna: attributes.antenna || 0 };
    const key = unitPresentation.agentAppearanceKey(counts) + ":" + (layer || "full");
    if (!spriteCache.has(key)) spriteCache.set(key, unitPresentation.composeAgentSprite(counts, layer));
    return spriteCache.get(key);
  }
  unitPresentation = model.createUnitPresentation({ model, height: .7, footsteps: 4,
    time: () => timeline, reducedMotion: () => reducedMotion.matches, tribeArt, sheets: nativeAssets.sheets,
    movementSheets, combatSheets: new Map(), parts, baseParts: nativeAssets.baseParts, roots, headMotions, combatMounts: new Map(),
    foodDelivery: () => null, sprite: agentSprite, birthPose: () => null, deliveryPose: () => ({ scaleX: 1, scaleY: 1 }),
    position: agent => model.unitMovementPosition(agent, timeline, reducedMotion.matches), displayScale: nativeAssets.displayScale,
    rangedImage: path => { const image = sources.get(path); return image?.complete && image.naturalWidth ? image : null; },
    drawBirth: () => false, drawOutline: () => {}, selectionShape: () => null, maxZoom: () => 288,
    pixelRatio: () => devicePixelRatio || 1, createSurface });
  function prepareInitialAssets() {
    return Promise.all([
      ...["body", "green-foot", "sprout-left", "sprout-right", "sprout-stem"].map(async name => {
        nativeAssets.baseParts.set(name, await nativeAssets.loadImage("DesignAssets/Units/BaseParts/" + name + ".png"));
      }),
      ...["root-rig", "feet-1", "antenna-1", "strength-1"].map(async name => {
        parts.set(name, await nativeAssets.loadImage("DesignAssets/Units/Parts/" + (name === "root-rig" ? "bean-root-rig" : name) + ".png"));
      }),
      ...tribes.map(async key => {
        await nativeAssets.prepareTribe(key, ["idle", "walk"], {});
        await unitPresentation.prepareAnimation({ tribe: key, attributes: {} });
        const walk = nativeAssets.sheets.get(key).get("walk");
        if (walk) movementSheets.set(key, { ...walk.animation, sprite: walk.sprite, scale: walk.scale });
      })
    ]);
  }
  const creatureResources = { idle: new Map(), walk: new Map(), attack: new Map(), ranged: new Map(), hurt: new Map(),
    owlFrames: new Map(), beetleFrames: new Map(), beetleSheet: null, beetleAttackSheet: null, beetleSprite: null };
  const appearances = model.WELCOME_UNIT_APPEARANCES;
  const neutralSpecies = [...Object.keys(globalThis.Spawner.CREATURE_IDLE_ANIMATIONS), "talon-owl", "spiny-back-beetle"];
  const nextChoice = globalThis.Spawner.createWelcomeRoster(tribes, neutralSpecies, appearances.length);
  const preparedCreatures = new Set();
  let appearanceNumber = 0;
  let current = nextChoice();
  let upcoming = null;
  let departing = [];
  const reportedDraws = new WeakSet();
  const renderedChoices = new Map();
  let started = false;
  let initialAssetsReady = false;
  let starting = null;
  function neutralAnimations(species) {
    if (species === "spiny-back-beetle") return Object.fromEntries(["idle", "walk", "attack"].map(action => {
      const animation = globalThis.Spawner.BEETLE_ANIMATIONS[action];
      return [action, { ...(action === "attack" ? globalThis.Spawner.BEETLE_ATTACK_SPRITE : globalThis.Spawner.BEETLE_SPRITE),
        durationsMs: animation.durations, durationMs: animation.durationMs, frameIndices: animation.frames, loop: action !== "attack" }];
    }));
    return { idle: species === "talon-owl" ? globalThis.Spawner.TALON_OWL_IDLE : globalThis.Spawner.CREATURE_IDLE_ANIMATIONS[species],
      walk: globalThis.Spawner.CREATURE_WALK_ANIMATIONS[species], attack: globalThis.Spawner.CREATURE_ATTACK_ANIMATIONS[species] };
  }
  function soundNames(choice) {
    if (choice.key === "bean") return ["footstep", "landing"];
    const definition = globalThis.SpawnerMovementAudio.definitions[choice.key];
    const attack = globalThis.SpawnerCombatAudio.cue(globalThis.SpawnerCombatAudio.material({ species: choice.key }), "attack", 1);
    return [definition?.name, tribes.includes(choice.key) ? choice.key === "spring" ? "spring-landing" : definition?.name : attack?.name].filter(Boolean);
  }
  async function prepareChoice(choice) {
    await audioConnection?.prepare(soundNames(choice));
    if (tribes.includes(choice.key)) {
      if (choice.variant > 0) await globalThis.SpawnerAssets.ready;
      const attributes = appearances[choice.variant];
      await nativeAssets.prepareTribe(choice.key, ["idle", "walk"], attributes);
      const agent = { tribe: choice.key, attributes, health: 1 };
      const preparedAgents = [agent,
        { ...agent, mode: "walk", moveStartedAt: 0, moveDuration: 1, stepCount: 1 },
        model.welcomeUnitPerformance(agent, 0).agent];
      await Promise.all(preparedAgents.map(value => unitPresentation.prepareAnimation(value, 0)));
      if (preparedAgents.some(value => !unitPresentation.animationReady(value, 0)))
        throw new Error("Missing welcome appearance assets: " + choice.key);
      prepareFrame(choice);
      return;
    }
    await globalThis.SpawnerAssets.ready;
    if (!preparedCreatures.has(choice.key)) {
      const poses = neutralAnimations(choice.key);
      const images = new Map(await Promise.all(Object.entries(poses).map(async ([action, animation]) =>
        [action, await nativeAssets.loadImage(animation.image)])));
      const idle = poses.idle, sprite = images.get("idle");
      const bounds = await tribeArt.prepareBounds(sprite, idle.frameSize);
      const scale = model.creatureIdleSheetScale(idle, bounds);
      if (choice.key === "spiny-back-beetle") {
        creatureResources.beetleSheet = sprite;
        creatureResources.beetleAttackSheet = images.get("attack");
        for (const index of new Set(Object.values(model.BEETLE_ANIMATIONS).flatMap(animation => animation.frames))) {
          if (creatureResources.beetleFrames.has(index)) continue;
          const shape = model.BEETLE_SPRITE, frame = createSurface(shape.frameSize, shape.frameSize);
          frame.getContext("2d").drawImage(sprite, index % shape.columns * shape.frameSize, Math.floor(index / shape.columns) * shape.frameSize,
            shape.frameSize, shape.frameSize, 0, 0, shape.frameSize, shape.frameSize);
          creatureResources.beetleFrames.set(index, frame);
        }
        nativeAssets.prepareDisplaySize(choice.key, sprite, model.BEETLE_SPRITE,
          model.BEETLE_SPRITE.scale * (model.BEETLE_SPRITE.registrationScale || 1));
      } else if (choice.key === "talon-owl") {
        for (let index = 0; index < model.TALON_OWL_IDLE.frameCount; index++) {
          if (creatureResources.owlFrames.has(index)) continue;
          const shape = model.TALON_OWL_IDLE, frame = createSurface(shape.frameSize, shape.frameSize);
          frame.getContext("2d").drawImage(sprite, index % shape.columns * shape.frameSize, Math.floor(index / shape.columns) * shape.frameSize,
            shape.frameSize, shape.frameSize, 0, 0, shape.frameSize, shape.frameSize);
          creatureResources.owlFrames.set(index, frame);
        }
        nativeAssets.prepareDisplaySize(choice.key, sprite, idle, idle.scale * (idle.registrationScale || 1));
      } else {
        creatureResources.idle.set(choice.key, { animation: idle, sprite, scale });
        nativeAssets.prepareDisplaySize(choice.key, sprite, idle, 1.4 * scale * (idle.registrationScale || 1));
      }
      for (const action of ["walk", "attack"]) creatureResources[action].set(choice.key, { animation: poses[action], sprite: images.get(action), scale });
      preparedCreatures.add(choice.key);
    }
    prepareFrame(choice);
  }
  function prepareUpcoming() {
    const choice = nextChoice();
    upcoming = { choice, ready: false };
    const preparation = upcoming;
    globalThis.Spawner.prepareWelcomeChoice(choice, prepareChoice, {
      onError: (error, failed) => console.warn("Welcome asset unavailable:", failed.key, failed.variant, error)
    }).then(prepared => {
      if (upcoming !== preparation) return;
      if (prepared) { preparation.choice = prepared; preparation.ready = true; }
      else setTimeout(() => { if (upcoming === preparation) prepareUpcoming(); }, 100);
    });
  }
  let timeline = 0;
  let phaseStartedAt = 0;
  const movementPlayback = globalThis.SpawnerMovementAudio.create();
  const combatPlayback = globalThis.SpawnerCombatAudio.create();
  let audioPrimed = false;
  function resetPresentationAudio() {
    globalThis.SpawnerMovementAudio.reset(movementPlayback);
    globalThis.SpawnerCombatAudio.reset(combatPlayback);
    audioConnection?.stopWelcome();
    audioPrimed = false;
  }
  audioReset = resetPresentationAudio;
  function updatePresentationAudio(motion, time) {
    if (!active() || reducedMotion.matches || !audioConnection?.available()) {
      if (audioPrimed) resetPresentationAudio();
      return;
    }
    audioPrimed = true;
    const motions = Array.isArray(motion) ? motion : [motion];
    const agents = motions.filter(value => value && value.x + value.size / 2 >= 0 && value.x - value.size / 2 <= width).map(value => value.agent);
    const events = [...globalThis.SpawnerMovementAudio.update(movementPlayback, agents, time, globalThis.Spawner),
      ...globalThis.SpawnerCombatAudio.update(combatPlayback, agents, [], time)];
    for (const event of events) audioConnection.playWelcome(event.name, 1);
  }
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const restDuration = 2000;
  let phase = "perform";
  let elapsed = 0;
  let previousTime = null;
  let frameRequest = 0;
  let width = 0;
  let height = 0;
  function duration(animation) {
    return animation.durationsMs.reduce((total, value) => total + value, 0);
  }
  function groundY() { return height * .88; }
  function worldPixels() { return Math.min(288, width * .58, height * .54); }
  function motionSize() { return model.unitDisplaySize({ species: current.key }) * worldPixels(); }
  function travelMotion(atElapsed, atTime) {
    const size = motionSize();
    const request = { key: current.key,
      attributes: appearances[current.variant], width, size, elapsedMs: Number.isFinite(atElapsed) ? atElapsed : elapsed,
      timeline: Number.isFinite(atTime) ? atTime : timeline, phase, startedAt: phaseStartedAt, reducedMotion: reducedMotion.matches,
      id: "welcome-" + current.key + ":" + appearanceNumber, worldPixels: worldPixels() };
    const motion = globalThis.Spawner.welcomeTravelMotion(globalThis.Spawner, request);
    motion.agent.animationStartedAt = phaseStartedAt;
    if (phase === "perform" && tribes.includes(current.key))
      motion.agent = model.welcomeUnitPerformance(motion.agent, phaseStartedAt).agent;
    return motion;
  }
  function presentDeparture(departure, time, callback) {
    const saved = { current, phase, elapsed, phaseStartedAt, appearanceNumber };
    current = departure.choice;
    phase = "exit";
    elapsed = Math.max(0, time - departure.startedAt) * 1000;
    phaseStartedAt = departure.startedAt;
    appearanceNumber = departure.number;
    try { return callback(); }
    finally { ({ current, phase, elapsed, phaseStartedAt, appearanceNumber } = saved); }
  }
  function departureMotion(departure, time) {
    return presentDeparture(departure, time, () => travelMotion(elapsed, time));
  }
  function phaseDuration() {
    if (phase === "waiting") return 0;
    if (phase === "enter") return travelMotion().durationMs;
    if (phase === "perform") return tribes.includes(current.key) ?
      model.welcomeUnitPerformance({ tribe: current.key, attributes: appearances[current.variant] }, phaseStartedAt).durationMs :
      duration(neutralAnimations(current.key).idle);
    return restDuration;
  }
  function advance(completedAt) {
    if (phase === "rest") {
      departing.push({ choice: current, number: appearanceNumber, startedAt: completedAt });
      phase = "waiting";
    } else if (phase === "waiting") {
      if (!upcoming.ready) return false;
      current = upcoming.choice;
      appearanceNumber++;
      phase = "enter";
      prepareUpcoming();
    } else if (phase === "enter") phase = "perform";
    else phase = "rest";
    return true;
  }
  function draw(motion) {
    if (!started || !width || !height) return;
    departing = departing.filter(departure => (timeline - departure.startedAt) * 1000 < departureMotion(departure, timeline).durationMs);
    const retained = new Set([phase === "waiting" && !reducedMotion.matches ? null : current, upcoming?.choice, ...departing.map(departure => departure.choice)]);
    for (const [choice, value] of renderedChoices) if (!retained.has(choice)) {
      value.front.width = value.back.width = 0;
      renderedChoices.delete(choice);
    }
    const retainedIds = new Set(["welcome-" + current.key + ":" + appearanceNumber,
      ...departing.map(departure => "welcome-" + departure.choice.key + ":" + departure.number)]);
    for (const id of headMotions.keys()) if (!retainedIds.has(id)) headMotions.delete(id);
    context.clearRect(0, 0, width, height);
    for (const departure of reducedMotion.matches ? [] : departing) presentDeparture(departure, timeline, () => drawUnit(travelMotion(), false));
    if (phase !== "waiting" || reducedMotion.matches) drawUnit(motion, false);
  }
  function prepareFrame(choice) {
    if (!width || !height) return;
    const saved = { current, phase, elapsed };
    current = choice;
    phase = "rest";
    elapsed = 0;
    try {
      const motion = travelMotion();
      motion.agent.id += ":prepared";
      if (!drawUnit(motion, false, false)) throw new Error("Missing welcome appearance frame: " + choice.key);
    } finally { ({ current, phase, elapsed } = saved); }
  }
  function drawUnit(motion, clear, compose) {
    motion ||= travelMotion();
    const choice = current;
    const target = context;
    let rendered = renderedChoices.get(choice);
    if (!rendered) {
      rendered = { front: document.createElement("canvas"), back: document.createElement("canvas"), valid: false, x: motion.x };
      renderedChoices.set(choice, rendered);
    }
    if (rendered.back.width !== canvas.width || rendered.back.height !== canvas.height) {
      rendered.back.width = canvas.width;
      rendered.back.height = canvas.height;
    }
    const surface = rendered.back.getContext("2d");
    function render(fallback) {
      const saved = { phase, elapsed };
      surface.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      surface.clearRect(0, 0, width, height);
      context = surface;
      try {
        if (fallback) { phase = "rest"; elapsed = 0; }
        drawPreparedUnit(fallback ? { ...motion, agent: { ...motion.agent, mode: "idle", attack: null, moveDuration: 0 } } : motion, false);
      } finally {
        context = target;
        ({ phase, elapsed } = saved);
      }
    }
    const drawn = globalThis.Spawner.drawWelcomeChoice(choice, () => render(false), {
      fallback: () => render(true),
      onError: (error, failed) => {
        if (reportedDraws.has(failed)) return;
        reportedDraws.add(failed);
        console.warn("Welcome pose unavailable:", failed.key, failed.variant, error);
      }
    });
    if (drawn) {
      [rendered.front, rendered.back] = [rendered.back, rendered.front];
      rendered.valid = true;
      rendered.x = motion.x;
    }
    if (compose !== false) {
      if (clear !== false) target.clearRect(0, 0, width, height);
      if (rendered.valid) target.drawImage(rendered.front, motion.x - rendered.x, 0, width, height);
    }
    return rendered.valid;
  }
  function drawPreparedUnit(motion, clear) {
    if (!width || !height) return;
    motion ||= travelMotion();
    if (clear !== false) context.clearRect(0, 0, width, height);
    const agent = motion.agent, cell = motion.cell;
    const scale = nativeAssets.displayScale(agent);
    context.save();
    try {
      context.translate(motion.x, groundY());
      context.scale(scale, scale);
      context.translate(-motion.x, -groundY());
      if (agent.species) {
        const pose = model.creaturePresentationPose(model, agent, timeline, reducedMotion.matches, creatureResources, null);
        if (!pose || !model.drawCreaturePresentation(context, pose, motion.x, groundY() - (agent.species === "spiny-back-beetle" ? .14 * cell : 0), cell, null, null))
          throw new Error("Missing welcome neutral source: " + agent.species);
      } else {
        const topLeft = { x: motion.x - cell / 2, y: groundY() - cell * (.5 + .7 * .44) };
        const now = performance.now();
        unitPresentation.drawRootMotion(context, now, agent, cell, topLeft, motion.position, null,
          () => unitPresentation.drawAgentAppearanceBody(context, now, agent, cell, topLeft, motion.position, null, null));
      }
    } finally { context.restore(); }
  }
  function active() {
    return !document.hidden && !welcome.hidden && document.body.dataset.screen === "welcome";
  }
  function tick(time) {
    frameRequest = 0;
    if (!active() || reducedMotion.matches) {
      previousTime = null;
      resetPresentationAudio();
      return;
    }
    if (previousTime !== null) {
      elapsed += time - previousTime;
      timeline += (time - previousTime) / 1000;
    }
    previousTime = time;
    while (elapsed >= phaseDuration()) {
      const completedDuration = phaseDuration();
      const completedAt = timeline - (elapsed - completedDuration) / 1000;
      if (phase === "enter" || phase === "perform") {
        const completedMotion = travelMotion(completedDuration, completedAt);
        updatePresentationAudio([completedMotion, ...departing.map(departure => departureMotion(departure, completedAt))],
          completedAt);
      }
      if (!advance(completedAt)) {
        elapsed = completedDuration;
        break;
      }
      elapsed -= completedDuration;
      phaseStartedAt = timeline - elapsed / 1000;
    }
    const motion = phase === "waiting" ? null : travelMotion();
    draw(motion);
    updatePresentationAudio([motion, ...departing.map(departure => departureMotion(departure, timeline))], timeline);
    frameRequest = requestAnimationFrame(tick);
  }
  function synchronize() {
    resetPresentationAudio();
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    previousTime = null;
    if (!active()) return;
    draw();
    if (started && !reducedMotion.matches) frameRequest = requestAnimationFrame(tick);
  }
  new ResizeObserver(() => {
    resetPresentationAudio();
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }).observe(canvas);
  new MutationObserver(synchronize).observe(welcome, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(synchronize).observe(document.body, { attributes: true, attributeFilter: ["data-screen"] });
  document.addEventListener("visibilitychange", synchronize);
  reducedMotion.addEventListener("change", synchronize);
  startPresentation = () => {
    if (started) return Promise.resolve(true);
    if (starting) return starting;
    starting = (async () => {
      if (!initialAssetsReady) {
        const prepared = await model.prepareWelcomeChoice(current, prepareInitialAssets, {
          onError: error => console.warn("Welcome initial assets unavailable:", error)
        });
        if (!prepared) return false;
        initialAssetsReady = true;
      }
      const prepared = await model.prepareWelcomeChoice(current, prepareChoice, {
        onError: (error, failed) => console.warn("Welcome asset unavailable:", failed.key, failed.variant, error)
      });
      if (!prepared) return false;
      resourcesReady = started = true;
      previousTime = null;
      timeline = elapsed = phaseStartedAt = 0;
      prepareUpcoming();
      synchronize();
      return true;
    })().finally(() => { starting = null; });
    return starting;
  };
  synchronize();
})();
