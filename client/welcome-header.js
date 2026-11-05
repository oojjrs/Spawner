globalThis.SpawnerWelcomeHeaderReady = (async () => {
  "use strict";
  let audioConnection = null;
  let audioReset = null;
  let startPresentation = null;
  globalThis.SpawnerWelcomeHeader = Object.freeze({ attachAudio(audio) {
    if (audioConnection === audio) return;
    audioReset?.();
    audioConnection = audio;
  }, start() { return startPresentation?.(); } });
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
  const animations = globalThis.Spawner.UNIT_ANIMATIONS;
  const sheets = new Map();
  const sources = new Map();
  await Promise.all(tribes.flatMap(tribe => Object.entries(animations[tribe])
    .filter(([action]) => action === "idle" || action === "walk" || action === "jump")
    .map(async ([action, animation]) => {
      const image = new Image();
      image.src = globalThis.SpawnerAssets.source(animation.image);
      try {
        await image.decode();
        sheets.set(tribe + ":" + action, image);
        sources.set(animation.image, image);
      } catch {}
    })));
  const tribeArt = globalThis.Spawner.createTribeArt(globalThis.Spawner.PLAYER_TRIBES, globalThis.SpawnerAssets.source);
  const tribeArtReady = new Set();
  const appearances = [
    { bean: {}, others: {} },
    { bean: { feet: 1 }, others: { feet: 1 } },
    { bean: { feet: 2, antenna: 1 }, others: { antenna: 1 } },
    { bean: { feet: 1, strength: 1 }, others: { strength: 1 } }
  ];
  const neutralSpecies = [...Object.keys(globalThis.Spawner.CREATURE_IDLE_ANIMATIONS), "talon-owl", "spiny-back-beetle"];
  const nextChoice = globalThis.Spawner.createWelcomeRoster(tribes, neutralSpecies, appearances.length);
  const neutralMetrics = new Map();
  let appearanceNumber = 0;
  let current = nextChoice();
  let upcoming = null;
  let departing = [];
  const pendingSources = new Map();
  const reportedDraws = new WeakSet();
  const renderedChoices = new Map();
  const beanMotions = new Map();
  let started = false;
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
      if (choice.key !== "bean" && choice.variant > 0 && !tribeArtReady.has(choice.key)) {
        await globalThis.SpawnerAssets.ready;
        await tribeArt.prepareUnit(globalThis.Spawner.PLAYER_TRIBES.find(tribe => tribe.key === choice.key));
        tribeArtReady.add(choice.key);
      }
      prepareFrame(choice);
      return;
    }
    await globalThis.SpawnerAssets.ready;
    await Promise.all(Object.values(neutralAnimations(choice.key)).map(async animation => {
      if (sources.has(animation.image)) return;
      if (!pendingSources.has(animation.image)) pendingSources.set(animation.image, (async () => {
        const image = new Image();
        image.src = globalThis.SpawnerAssets.source(animation.image);
        await image.decode();
        if (image.naturalWidth !== animation.frameSize * animation.columns) throw new Error("Welcome source geometry mismatch: " + animation.image);
        sources.set(animation.image, image);
      })());
      try { await pendingSources.get(animation.image); }
      catch (error) { pendingSources.delete(animation.image); throw error; }
    }));
    if (!neutralMetrics.has(choice.key)) {
      const poses = neutralAnimations(choice.key);
      const idle = poses.idle;
      const bounds = await tribeArt.prepareBounds(sources.get(idle.image), idle.frameSize);
      const sample = document.createElement("canvas");
      sample.width = sample.height = 96;
      const pixels = sample.getContext("2d", { willReadFrequently: true });
      const envelope = { left: 0, right: 0, top: 0, bottom: 0 };
      for (const [action, animation] of Object.entries(poses)) {
        const image = sources.get(animation.image);
        for (let i = 0; i < animation.durationsMs.length; i++) {
          const frame = animation.frameIndices?.[i] ?? i;
          const geometry = globalThis.Spawner.imageFrameGeometry(animation, frame);
          const scale = poseScale(geometry, action, choice.key);
          pixels.clearRect(0, 0, 96, 96);
          pixels.drawImage(image, frame % animation.columns * animation.frameSize,
            Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize, 0, 0, 96, 96);
          const data = pixels.getImageData(0, 0, 96, 96).data;
          for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) if (data[(y * 96 + x) * 4 + 3] >= 16) {
            envelope.left = Math.min(envelope.left, (x / 96 - geometry.pivotX / geometry.frameSize) * scale);
            envelope.right = Math.max(envelope.right, ((x + 1) / 96 - geometry.pivotX / geometry.frameSize) * scale);
            envelope.top = Math.min(envelope.top, (y / 96 - geometry.pivotY / geometry.frameSize) * scale);
            envelope.bottom = Math.max(envelope.bottom, ((y + 1) / 96 - geometry.pivotY / geometry.frameSize) * scale);
          }
        }
      }
      neutralMetrics.set(choice.key, { bounds, envelope });
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
  const beanParts = new Map();
  await Promise.all(["body", "sprout-left", "sprout-right", "sprout-stem", "green-foot", "root-rig", "antenna-1", "strength-1"].map(async name => {
    const image = new Image();
    image.src = globalThis.SpawnerAssets.source(["root-rig", "antenna-1", "strength-1"].includes(name) ? "DesignAssets/Units/Parts/" + (name === "root-rig" ? "bean-root-rig" : name) + ".png" : "DesignAssets/Units/BaseParts/" + name + ".png");
    try {
      await image.decode();
      beanParts.set(name, image);
    } catch (error) {
      // Incomplete parts use the already loaded bean sprite below. A failed
      // decorative asset must not reject initialization of the entire header.
      console.warn("Welcome bean part unavailable:", name, error);
    }
  }));
  const roots = globalThis.Spawner.createSproutRoots((width, height) => {
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    return surface;
  });
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
    const agents = motions.filter(value => value && value.x + motionSize() / 2 >= 0 && value.x - motionSize() / 2 <= width).map(value => value.agent);
    const events = [...globalThis.SpawnerMovementAudio.update(movementPlayback, agents, time, globalThis.Spawner),
      ...globalThis.SpawnerCombatAudio.update(combatPlayback, agents, [], time)];
    for (const event of events) audioConnection.playWelcome(event.name, 1);
  }
  function drawBean(motion, size, moving) {
    const { x, agent: bean } = motion;
    const appearance = appearances[current.variant].bean;
    const feet = appearance.feet || 0;
    bean.attributes = appearance;
    const position = { x: x * .7 / size, y: 0 };
    const gait = feet ? roots.pose(bean, position, timeline) : { phase: 0, rotation: 0, bob: 0 };
    const step = bean.moveStartedAt + ":" + bean.stepCount;
    const end = bean.moveStartedAt + bean.moveDuration;
    let state = beanMotions.get(bean.id);
    if (!state || timeline < state.time) {
      state = { step, end, duration: bean.moveDuration, landedAt: -Infinity, time: timeline, idleStartedAt: timeline };
      beanMotions.set(bean.id, state);
    } else if (state.step !== step) {
      if (state.duration && timeline >= state.end) state.landedAt = state.end;
      state.step = step;
    }
    state.end = end;
    state.duration = bean.moveDuration;
    state.time = timeline;
    if (moving) state.idleStartedAt = null;
    else if (state.idleStartedAt === null) state.idleStartedAt = phase === "perform" ? phaseStartedAt : timeline;
    const idle = !moving && !reducedMotion.matches ? globalThis.Spawner.sproutIdlePose((timeline - state.idleStartedAt) * 1000, size) : null;
    const landedAt = bean.moveDuration && timeline >= end ? end : state.landedAt;
    const head = globalThis.Spawner.sproutHeadPose(bean, appearance, timeline, landedAt,
      feet && (gait.moving || gait.settling) ? gait : null, idle, -1, reducedMotion.matches);
    const flap = head.leftRotation;
    const lift = feet ? 426 - 512 * .94 + globalThis.Spawner.sproutRootGeometry(feet).height * .88 : 0;
    const pivot = 460 - lift;
    context.save();
    try {
    const hop = globalThis.Spawner.sproutJumpOffset(bean, appearance, motion.position, size);
    const body = globalThis.Spawner.sproutBodyPose(bean, appearance, timeline, size, { scaleX: 1, scaleY: 1 }, lift,
      feet && (gait.moving || gait.settling) ? gait : null,
      reducedMotion.matches ? 0 : idle?.bodyOffset ?? globalThis.Spawner.sproutBobOffset(bean.id, timeline * 1000, size), reducedMotion.matches);
    context.translate(x, groundY() + (feet ? 4 : 0) - hop);
    context.scale(size / 512, size / 512);
    context.translate(-256, feet ? -512 * .94 : -460);
    if (feet) roots.drawRig(context, beanParts.get("root-rig"), feet, gait, { rotation: gait.rotation, bob: gait.bob, pivot }, null);
    else for (const footX of [16.5, 66.5]) context.drawImage(beanParts.get("green-foot"),
      136 + footX * 240 / 104, 110 + 136 * 350 / 153, 20 * 240 / 104, 16 * 350 / 153);
    context.translate(256, pivot - gait.bob * 512);
    context.rotate(gait.rotation);
    context.translate(-256, -pivot);
    const headRoot = 110 - lift + 350 * 148.15 / 417;
    const fold = head.leftScaleY;
    if (!appearance.antenna) for (const [name, pivotX, rotation] of [["sprout-left", 136 + 240 * 133.75 / 286, flap], ["sprout-right", 136 + 240 * 151.95 / 286, -flap]]) {
      context.save();
      try {
      context.translate(pivotX, headRoot);
      context.rotate(rotation);
      context.scale(1, fold);
      context.drawImage(beanParts.get(name), 136 - pivotX, 110 - lift - headRoot, 240, 350);
      } finally { context.restore(); }
    }
    if (!appearance.antenna) context.drawImage(beanParts.get("sprout-stem"), 136, 110 - lift, 240, 350);
    else {
      const antenna = beanParts.get("antenna-1");
      const antennaHeight = 196 * antenna.naturalHeight / antenna.naturalWidth;
      context.save();
      try {
        context.translate(256, 260 - lift);
        context.rotate(head.leftRotation);
        context.scale(1, head.leftScaleY);
        context.drawImage(antenna, -98, -antennaHeight, 196, antennaHeight);
      } finally { context.restore(); }
    }
    context.translate(256, pivot);
    context.scale(body.scaleX, body.scaleY);
    context.translate(-256, -pivot);
    context.drawImage(beanParts.get("body"), 136, 110 - lift, 240, 350);
    if (appearance.strength) context.drawImage(beanParts.get("strength-1"),
      256 - 344 * .78 / 2, 460 - lift - 142 * .78, 344 * .78, 142 * .78);
    } finally { context.restore(); }
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
  function groundY() { return height * 214 / 280; }
  function poseScale(animation, action, species) {
    return action === "walk" ? animation.frameSize / (animation.viewSize || animation.frameSize) :
      action === "attack" && species !== "spiny-back-beetle" ? animation.frameSize / (animation.viewSize || animation.frameSize) * (animation.registrationScale || 1) : animation.registrationScale || 1;
  }
  function motionSize() {
    return current.key === "bean" ? Math.min(210, width * .8) : tribes.includes(current.key) ? Math.min(184, width * .7) : Math.min(240, width * .75);
  }
  function travelMotion(atElapsed, atTime) {
    const size = motionSize();
    const request = { key: current.key,
      attributes: appearances[current.variant][current.key === "bean" ? "bean" : "others"], width, size, elapsedMs: Number.isFinite(atElapsed) ? atElapsed : elapsed,
      timeline: Number.isFinite(atTime) ? atTime : timeline, phase, startedAt: phaseStartedAt, reducedMotion: reducedMotion.matches,
      id: "welcome-" + current.key + ":" + appearanceNumber };
    let lead = 0;
    if (phase === "enter" && !reducedMotion.matches) {
      const initial = globalThis.Spawner.welcomeTravelMotion(globalThis.Spawner, { ...request, elapsedMs: 0, timeline: phaseStartedAt });
      lead = Math.max(0, initial.x - width - size / 2) / initial.cell * initial.agent.moveDuration * 1000;
      request.elapsedMs += lead;
      request.startedAt -= lead / 1000;
    }
    const motion = globalThis.Spawner.welcomeTravelMotion(globalThis.Spawner, request);
    motion.durationMs -= lead;
    motion.agent.animationStartedAt = phaseStartedAt;
    if (phase === "perform" && tribes.includes(current.key) && animations[current.key].jump) {
      motion.agent.mode = "jump";
      motion.agent.jumpStartedAt = phaseStartedAt;
    }
    if (phase === "perform" && !tribes.includes(current.key)) {
      motion.agent.mode = "attack";
      motion.agent.attackStartedAt = phaseStartedAt;
      motion.agent.attack = { startedAt: phaseStartedAt, speed: 1, directionX: -1 };
    }
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
    if (phase === "perform") return current.key === "bean" ? globalThis.Spawner.SPROUT_IDLE_SHRUG_DURATION_MS :
      duration(tribes.includes(current.key) ? animations[current.key].jump : neutralAnimations(current.key).attack);
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
    if (!width || !height) return;
    departing = departing.filter(departure => (timeline - departure.startedAt) * 1000 < departureMotion(departure, timeline).durationMs);
    const retained = new Set([phase === "waiting" ? null : current, upcoming?.choice, ...departing.map(departure => departure.choice)]);
    for (const [choice, value] of renderedChoices) if (!retained.has(choice)) {
      value.front.width = value.back.width = 0;
      renderedChoices.delete(choice);
    }
    const retainedIds = new Set(["welcome-" + current.key + ":" + appearanceNumber,
      ...departing.map(departure => "welcome-" + departure.choice.key + ":" + departure.number)]);
    for (const id of beanMotions.keys()) if (!retainedIds.has(id)) beanMotions.delete(id);
    context.clearRect(0, 0, width, height);
    for (const departure of departing) presentDeparture(departure, timeline, () => drawUnit(travelMotion(), false));
    if (phase !== "waiting") drawUnit(motion, false);
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
    const tribe = current.key;
    if (!tribes.includes(tribe)) {
      drawNeutral(motion);
      return;
    }
    const moving = phase === "enter" || phase === "exit";
    const agent = reducedMotion.matches ? { ...motion.agent, mode: "idle", moveDuration: 0, attack: null } : motion.agent;
    const animationPose = globalThis.Spawner.unitAnimationPose(agent, reducedMotion.matches ? 0 : timeline);
    const action = animationPose?.action || "idle";
    const animation = animationPose?.animation || animations[tribe].idle;
    const frame = animationPose?.frame || 0;
    const image = sheets.get(tribe + ":" + action);
    if (!image) throw new Error("Missing welcome animation source: " + animation.image);
    const size = Math.min(184, width * .7);
    const x = motion.x;
    if (tribe === "bean" && beanParts.size === 8) {
      drawBean(motion, Math.min(210, width * .8), moving && !reducedMotion.matches);
      return;
    }
    const pose = tribeArtReady.has(tribe) ? tribeArt.animationPose(agent, { action, animation, frame }, timeline) : null;
    const registeredAnimation = pose?.sourceAnimation || animation;
    const sourceIndex = pose?.sourceFrame ?? frame;
    const source = sources.get(registeredAnimation.image);
    if (!source) throw new Error("Missing welcome animation source: " + registeredAnimation.image);
    const physicalFrameSize = source.naturalWidth / registeredAnimation.columns;
    const registrationScale = physicalFrameSize / registeredAnimation.frameSize;
    const sourceAnimation = { ...registeredAnimation, frameSize: physicalFrameSize,
      pivotX: registeredAnimation.pivotX * registrationScale, pivotY: registeredAnimation.pivotY * registrationScale };
    if (Number.isFinite(registeredAnimation.viewSize)) sourceAnimation.viewSize = registeredAnimation.viewSize * registrationScale;
    const customized = tribeArtReady.has(tribe) ? tribeArt.animationFrame(agent, source, sourceAnimation, sourceIndex, action, timeline, pose) : null;
    if (current.variant > 0 && !customized) throw new Error("Missing welcome appearance frame: " + tribe + ":" + action);
    const frameSize = customized ? customized.width : sourceAnimation.frameSize;
    const padding = (frameSize - sourceAnimation.frameSize) / 2;
    const renderedSize = size * frameSize / sourceAnimation.frameSize;
    context.save();
    try {
    context.translate(x, groundY());
    const mirror = moving && !reducedMotion.matches && (sourceAnimation.facing ? sourceAnimation.facing === "right" : tribe === "spore");
    context.scale(mirror ? -1 : 1, 1);
    context.drawImage(customized || source, customized ? 0 : sourceIndex % sourceAnimation.columns * sourceAnimation.frameSize,
      customized ? 0 : Math.floor(sourceIndex / sourceAnimation.columns) * sourceAnimation.frameSize, frameSize, frameSize,
      -(sourceAnimation.pivotX + padding) * renderedSize / frameSize,
      -(sourceAnimation.pivotY + padding) * renderedSize / frameSize, renderedSize, renderedSize);
    } finally { context.restore(); }
  }
  function drawNeutral(motion) {
    const species = current.key;
    const moving = !reducedMotion.matches && (phase === "enter" || phase === "exit");
    const action = reducedMotion.matches ? "idle" : moving ? "walk" : phase === "perform" ? "attack" : "idle";
    const sourceAnimation = neutralAnimations(species)[action];
    const source = sources.get(sourceAnimation.image);
    if (!source) throw new Error("Missing welcome neutral source: " + sourceAnimation.image);
    const idle = neutralAnimations(species).idle;
    const metrics = neutralMetrics.get(species);
    const baseSize = globalThis.Spawner.welcomeCreatureScale(idle, metrics.bounds, 0,
      globalThis.Spawner.UNIT_DISPLAY_SIZES[species], width, height, metrics.envelope);
    const animationTime = reducedMotion.matches ? 0 : elapsed;
    let frame;
    if (sourceAnimation.frameIndices) frame = globalThis.Spawner.beetleAnimationPose(motion.agent, timeline).frame;
    else if (moving) frame = globalThis.Spawner.creatureWalkPose(motion.agent, timeline)?.frame ??
      globalThis.Spawner.unitAnimationFrame({ ...sourceAnimation, loop: false }, sourceAnimation.durationMs);
    else if (action === "attack") frame = globalThis.Spawner.creatureAttackPose(motion.agent, timeline)?.frame ?? globalThis.Spawner.unitAnimationFrame(sourceAnimation, animationTime);
    else if (species === "talon-owl" && action === "idle") frame = globalThis.Spawner.talonOwlIdleFrame(animationTime);
    else frame = globalThis.Spawner.unitAnimationFrame({ ...sourceAnimation, loop: action !== "attack" }, animationTime);
    const animation = globalThis.Spawner.imageFrameGeometry(sourceAnimation, frame);
    const size = baseSize * poseScale(animation, action, species);
    context.save();
    try {
    context.translate(motion.x, groundY());
    if (animation.facing === "right") context.scale(-1, 1);
    context.drawImage(source, frame % animation.columns * animation.frameSize,
      Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize,
      -size * animation.pivotX / animation.frameSize, -size * animation.pivotY / animation.frameSize, size, size);
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
  startPresentation = async () => {
    if (started) return;
    await globalThis.Spawner.prepareWelcomeChoice(current, prepareChoice);
    started = true;
    previousTime = null;
    timeline = elapsed = phaseStartedAt = 0;
    prepareUpcoming();
    synchronize();
  };
  synchronize();
})();
