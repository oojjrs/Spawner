(async () => {
  "use strict";
  await globalThis.SpawnerAssets.ready;
  const welcome = document.getElementById("welcome");
  const title = document.getElementById("welcome-title");
  const stage = document.createElement("div");
  stage.className = "welcome-stage";
  title.before(stage);
  stage.append(title);
  stage.style.backgroundImage = "url(" + JSON.stringify(globalThis.SpawnerWelcomeBackground || "DesignAssets/Welcome/forest-clearing.webp") + ")";
  const waveform = document.createElement("canvas");
  waveform.className = "welcome-waveform";
  waveform.setAttribute("aria-hidden", "true");
  stage.after(waveform);
  const canvas = document.createElement("canvas");
  canvas.className = "welcome-characters";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);
  const context = canvas.getContext("2d");
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
  await Promise.all(globalThis.Spawner.PLAYER_TRIBES.filter(tribe => tribe.key !== "bean").map(async tribe => {
    await tribeArt.prepareUnit(tribe);
    tribeArtReady.add(tribe.key);
  }));
  const appearances = [
    { bean: {}, others: {} },
    { bean: { feet: 1 }, others: { feet: 1 } },
    { bean: { feet: 2, antenna: 1 }, others: { antenna: 1 } },
    { bean: { feet: 1, strength: 1 }, others: { strength: 1 } }
  ];
  const neutralSpecies = [...Object.keys(globalThis.Spawner.CREATURE_IDLE_ANIMATIONS), "talon-owl", "spiny-back-beetle"];
  const pool = [...tribes, ...neutralSpecies];
  let appearanceNumber = 0;
  let current = { key: "bean", variant: 0 };
  let upcoming = null;
  const pendingSources = new Map();
  function neutralAnimations(species) {
    if (species === "spiny-back-beetle") return Object.fromEntries(["idle", "walk", "attack"].map(action => {
      const animation = globalThis.Spawner.BEETLE_ANIMATIONS[action];
      return [action, { ...(action === "attack" ? globalThis.Spawner.BEETLE_ATTACK_SPRITE : globalThis.Spawner.BEETLE_SPRITE),
        durationsMs: animation.durations, durationMs: animation.durationMs, frameIndices: animation.frames, loop: action !== "attack" }];
    }));
    return { idle: species === "talon-owl" ? globalThis.Spawner.TALON_OWL_IDLE : globalThis.Spawner.CREATURE_IDLE_ANIMATIONS[species],
      walk: globalThis.Spawner.CREATURE_WALK_ANIMATIONS[species], attack: globalThis.Spawner.CREATURE_ATTACK_ANIMATIONS[species] };
  }
  function selectChoice(number) {
    if (number < tribes.length) return { key: tribes[number], variant: 0 };
    const key = pool[Math.floor(Math.random() * pool.length)];
    return { key, variant: tribes.includes(key) ? Math.floor(Math.random() * appearances.length) : 0 };
  }
  async function prepareChoice(choice) {
    if (tribes.includes(choice.key)) return;
    await Promise.all(Object.values(neutralAnimations(choice.key)).map(async animation => {
      if (sources.has(animation.image)) return;
      if (!pendingSources.has(animation.image)) pendingSources.set(animation.image, (async () => {
        const image = new Image();
        image.src = globalThis.SpawnerAssets.source(animation.image);
        await image.decode();
        if (image.naturalWidth !== animation.frameSize * animation.columns) throw new Error("Welcome source geometry mismatch: " + animation.image);
        sources.set(animation.image, image);
      })());
      await pendingSources.get(animation.image);
    }));
  }
  function prepareUpcoming() {
    const choice = selectChoice(appearanceNumber + 1);
    upcoming = { choice, ready: false };
    const preparation = upcoming;
    prepareChoice(choice).then(() => { preparation.ready = true; });
  }
  const beanParts = new Map();
  await Promise.all(["body", "sprout-left", "sprout-right", "sprout-stem", "green-foot", "root-rig", "antenna-1", "strength-1"].map(async name => {
    const image = new Image();
    image.src = globalThis.SpawnerAssets.source(["root-rig", "antenna-1", "strength-1"].includes(name) ? "DesignAssets/Units/Parts/" + (name === "root-rig" ? "bean-root-rig" : name) + ".png" : "DesignAssets/Units/BaseParts/" + name + ".png");
    await image.decode();
    beanParts.set(name, image);
  }));
  const roots = globalThis.Spawner.createSproutRoots((width, height) => {
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    return surface;
  });
  const bean = { id: "welcome-bean", attributes: { feet: 1 }, x: -1, y: 0, renderFromX: 0, renderFromY: 0, moveDuration: 0, moveStartedAt: 0 };
  let timeline = 0;
  function drawBean(x, size, moving) {
    const appearance = appearances[current.variant].bean;
    const feet = appearance.feet || 0;
    bean.attributes = appearance;
    const position = { x: x * .7 / size, y: 0 };
    const distance = width / 2 + size / 2;
    bean.moveDuration = moving ? travelDuration / 1000 / (distance * .7 / size) : 0;
    bean.moveStartedAt = moving ? timeline - .001 : 0;
    const gait = feet ? roots.pose(bean, position, timeline) : { phase: 0, rotation: 0, bob: 0 };
    const idlePhase = reducedMotion.matches ? 0 : elapsed / 1000 % 6.8;
    const shrugDuration = Math.PI * 2 / 7.2;
    const shrug = idlePhase / shrugDuration;
    const body = !reducedMotion.matches && shrug < 1 ? Math.sin(shrug * Math.PI) ** 2 : 0;
    let flap = !reducedMotion.matches && shrug < 1 ? -Math.sin(shrug * Math.PI * 2) * .24 : 0;
    const rest = idlePhase < 2.52 ? (idlePhase - shrugDuration) / (2.52 - shrugDuration) : (idlePhase - 2.84) / (6.8 - 2.84);
    if (!reducedMotion.matches && rest >= 0 && rest < 1) flap += Math.sin(rest * Math.PI) ** 2 * .1;
    const flutter = (idlePhase - 2.52) / .32;
    if (!reducedMotion.matches && flutter >= 0 && flutter < 1) flap -= Math.sin(flutter * Math.PI * 2) * Math.sin(flutter * Math.PI) * .34;
    if (moving && feet) flap = Math.sin(gait.phase - .5) * .09 - .05;
    const lift = feet ? 426 - 512 * .94 + globalThis.Spawner.sproutRootGeometry(feet).height * .88 : 0;
    const pivot = 460 - lift;
    context.save();
    const hops = Math.max(1, Math.round(travelDuration / 600));
    const hopProgress = (hops * elapsed / travelDuration) % 1;
    const hop = moving && !feet ? Math.sin(hopProgress * Math.PI) * size * .035 : 0;
    context.translate(x, height - (feet ? 20 : 24) - hop);
    context.scale(size / 512, size / 512);
    context.translate(-256, feet ? -512 * .94 : -460);
    if (feet) roots.drawRig(context, beanParts.get("root-rig"), feet, gait, { rotation: gait.rotation, bob: gait.bob, pivot }, null);
    else for (const footX of [16.5, 66.5]) context.drawImage(beanParts.get("green-foot"),
      136 + footX * 240 / 104, 110 + 136 * 350 / 153, 20 * 240 / 104, 16 * 350 / 153);
    context.translate(256, pivot - gait.bob * 512);
    context.rotate(gait.rotation);
    context.translate(-256, -pivot);
    const headRoot = 110 - lift + 350 * 148.15 / 417;
    const fold = 1 - Math.max(0, -flap) * .7;
    if (!appearance.antenna) for (const [name, pivotX, rotation] of [["sprout-left", 136 + 240 * 133.75 / 286, flap], ["sprout-right", 136 + 240 * 151.95 / 286, -flap]]) {
      context.save();
      context.translate(pivotX, headRoot);
      context.rotate(rotation);
      context.scale(1, fold);
      context.drawImage(beanParts.get(name), 136 - pivotX, 110 - lift - headRoot, 240, 350);
      context.restore();
    }
    if (!appearance.antenna) context.drawImage(beanParts.get("sprout-stem"), 136, 110 - lift, 240, 350);
    else {
      const antenna = beanParts.get("antenna-1");
      const antennaHeight = 196 * antenna.naturalHeight / antenna.naturalWidth;
      context.drawImage(antenna, 158, 260 - lift - antennaHeight, 196, antennaHeight);
    }
    context.translate(256, pivot);
    context.scale(1, moving ? 1 : 1 + body * .02 / (350 / 512));
    context.translate(-256, -pivot);
    context.drawImage(beanParts.get("body"), 136, 110 - lift, 240, 350);
    if (appearance.strength) context.drawImage(beanParts.get("strength-1"),
      256 - 344 * .78 / 2, 460 - lift - 142 * .78, 344 * .78, 142 * .78);
    context.restore();
  }
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const travelDuration = 3600;
  const restDuration = 3500;
  let phase = "perform";
  let elapsed = 0;
  let previousTime = null;
  let frameRequest = 0;
  let width = 0;
  let height = 0;
  function duration(animation) {
    return animation.durationsMs.reduce((total, value) => total + value, 0);
  }
  function phaseDuration() {
    if (phase === "enter" || phase === "exit") return travelDuration;
    if (phase === "perform") return current.key === "bean" ? 6800 : duration(tribes.includes(current.key) ? animations[current.key].jump : neutralAnimations(current.key).attack);
    return restDuration;
  }
  function advance() {
    if (phase === "rest") {
      if (!upcoming.ready) return false;
      phase = "exit";
    } else if (phase === "exit") {
      current = upcoming.choice;
      appearanceNumber++;
      prepareUpcoming();
      phase = "enter";
    } else if (phase === "enter") phase = "perform";
    else phase = "rest";
    return true;
  }
  function draw() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    const tribe = current.key;
    if (!tribes.includes(tribe)) {
      drawNeutral();
      return;
    }
    const moving = phase === "enter" || phase === "exit";
    let action = reducedMotion.matches ? "idle" : moving && animations[tribe].walk ? "walk" : phase === "perform" && animations[tribe].jump ? "jump" : "idle";
    if (!sheets.has(tribe + ":" + action)) action = "idle";
    const animation = animations[tribe][action];
    const image = sheets.get(tribe + ":" + action) || sheets.get(tribe + ":idle");
    if (!image) return;
    const distance = width / 2 + Math.min(184, width * .7) / 2;
    const walkElapsed = moving ? elapsed / travelDuration * distance / (Math.min(184, width * .7) * .42) * duration(animation) : elapsed;
    let remaining = reducedMotion.matches ? 0 : walkElapsed % duration(animation);
    let frame = 0;
    while (frame < animation.durationsMs.length - 1 && remaining >= animation.durationsMs[frame]) {
      remaining -= animation.durationsMs[frame];
      frame++;
    }
    const size = Math.min(184, width * .7);
    const center = width / 2;
    const progress = elapsed / travelDuration;
    const eased = progress;
    let x = center;
    if (!reducedMotion.matches && phase === "enter") x = width + size / 2 + (center - width - size / 2) * eased;
    if (!reducedMotion.matches && phase === "exit") x = center + (-size / 2 - center) * eased;
    if (tribe === "bean" && beanParts.size === 8) {
      drawBean(x, Math.min(220, width * .8), moving && !reducedMotion.matches);
      return;
    }
    const appearance = appearances[current.variant].others;
    const agent = { id: "welcome-" + tribe + ":" + appearanceNumber, tribe, attributes: appearance };
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
    const frameSize = customized ? customized.width : sourceAnimation.frameSize;
    const padding = (frameSize - sourceAnimation.frameSize) / 2;
    const renderedSize = size * frameSize / sourceAnimation.frameSize;
    context.save();
    context.translate(x, height - 24);
    const mirror = moving && !reducedMotion.matches && (sourceAnimation.facing ? sourceAnimation.facing === "right" : tribe === "spore");
    context.scale(mirror ? -1 : 1, 1);
    context.drawImage(customized || source, customized ? 0 : sourceIndex % sourceAnimation.columns * sourceAnimation.frameSize,
      customized ? 0 : Math.floor(sourceIndex / sourceAnimation.columns) * sourceAnimation.frameSize, frameSize, frameSize,
      -(sourceAnimation.pivotX + padding) * renderedSize / frameSize,
      -(sourceAnimation.pivotY + padding) * renderedSize / frameSize, renderedSize, renderedSize);
    context.restore();
  }
  function drawNeutral() {
    const species = current.key;
    const moving = !reducedMotion.matches && (phase === "enter" || phase === "exit");
    const action = reducedMotion.matches ? "idle" : moving ? "walk" : phase === "perform" ? "attack" : "idle";
    const animation = neutralAnimations(species)[action];
    const source = sources.get(animation.image);
    if (!source) throw new Error("Missing welcome neutral source: " + animation.image);
    const cell = species === "talon-owl" ? Math.min(72, width * .24) : Math.min(96, width * .32);
    const typeScale = species === "talon-owl" ? globalThis.Spawner.TALON_OWL_IDLE.scale : species === "spiny-back-beetle" ? globalThis.Spawner.BEETLE_SPRITE.scale : 1.4;
    const geometryScale = action === "walk" ? animation.frameSize / (animation.viewSize || animation.frameSize) : action === "attack" && species !== "spiny-back-beetle" ? animation.frameSize / (animation.viewSize || animation.frameSize) * (animation.registrationScale || 1) : animation.registrationScale || 1;
    const size = cell * typeScale * geometryScale;
    const center = width / 2;
    const distance = center + size / 2;
    const progress = elapsed / travelDuration;
    const x = moving ? phase === "enter" ? width + size / 2 - distance * progress : center - distance * progress : center;
    const animationTime = reducedMotion.matches ? 0 : moving && species !== "talon-owl" ? progress * distance / cell * (animation.cyclesPerCell || 1) * duration(animation) : elapsed;
    let frame;
    if (animation.frameIndices) frame = globalThis.Spawner.beetleAnimationFrame(action, animationTime);
    else if (species === "talon-owl" && action === "idle") frame = globalThis.Spawner.talonOwlIdleFrame(animationTime);
    else if (species === "spring-keeper" && action === "walk") frame = globalThis.Spawner.springKeeperFlightPose({
      species, mode: "walk", health: 1, moveDuration: travelDuration / 1000, moveStartedAt: 0, flightStartedAt: 0, stepCount: 1
    }, elapsed / 1000).frame;
    else frame = globalThis.Spawner.unitAnimationFrame({ ...animation, loop: action !== "attack" }, animationTime);
    context.save();
    const flightProgress = Math.max(0, Math.min(1, elapsed / 180, (travelDuration - elapsed) / 135));
    const flightLift = species === "talon-owl" && moving ? (cell * .14 + 24) * flightProgress * flightProgress * (3 - 2 * flightProgress) : 0;
    context.translate(x, height - 24 - flightLift);
    if (animation.facing === "right") context.scale(-1, 1);
    context.drawImage(source, frame % animation.columns * animation.frameSize,
      Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize,
      -size * animation.pivotX / animation.frameSize, -size * animation.pivotY / animation.frameSize, size, size);
    context.restore();
  }
  function active() {
    return !document.hidden && !welcome.hidden && document.body.dataset.screen === "welcome";
  }
  function tick(time) {
    frameRequest = 0;
    if (!active() || reducedMotion.matches) {
      previousTime = null;
      return;
    }
    if (previousTime !== null) {
      elapsed += time - previousTime;
      timeline += (time - previousTime) / 1000;
    }
    previousTime = time;
    while (elapsed >= phaseDuration()) {
      const completedDuration = phaseDuration();
      if (!advance()) {
        elapsed = completedDuration;
        break;
      }
      elapsed -= completedDuration;
    }
    draw();
    frameRequest = requestAnimationFrame(tick);
  }
  function synchronize() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    previousTime = null;
    if (!active()) return;
    draw();
    if (!reducedMotion.matches) frameRequest = requestAnimationFrame(tick);
  }
  new ResizeObserver(() => {
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
  prepareUpcoming();
  synchronize();
})();
