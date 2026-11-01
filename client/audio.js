(() => {
  const levels = Object.freeze({
    "unit-attack": 0.025703958,
    "beetle-attack": 0.0072443592,
    "flower-tail-bird-attack": 0.010592537,
    "dew-rabbit-attack": 0.017579236,
    "soil-mole-attack": 0.0096605087,
    "bundle-snail-attack": 0.012589254,
    "cotton-sheep-attack": 0.01083927,
    "rolling-acorn-attack": 0.014621772,
    "soil-boar-attack": 0.0060255959,
    "bubble-toad-attack": 0.011748976,
    "vine-turtle-attack": 0.012589254,
    "shadow-weasel-attack": 0.01216186,
    "snare-vine-attack": 0.013645831,
    "talon-owl-attack": 0.020653801,
    "spring-keeper-attack": 0.0076736149,
    "lantern-keeper-attack": 0.0069984196,
    "old-garden-snail-attack": 0.0088104888,
    "walking-forest-attack": 0.016982437,
    "white-paw-attack": 0.010964782,
    "spiny-back-leader-attack": 0.0072443592,
    "sprout-hurt": 0.84139514,
    "spore-hurt": 0.011614486,
    "pebble-hurt": 0.15310875,
    "spring-hurt": 0.011091747,
    "beetle-hurt": 0.011091748,
    "sprout-death": 0.050118723,
    "spore-death": 0.069984199,
    "pebble-death": 0.016032455,
    "spring-death": 0.087096359,
    "beetle-death": 0.023988329,
    "move-spore": 0.0038904515,
    "move-pebble": 0.0056885293,
    "move-spring": 0.0085113804,
    "move-spiny-back-beetle": 0.0037583741,
    "move-flower-tail-bird": 0.0036307805,
    "move-dew-rabbit": 0.0048417237,
    "move-soil-mole": 0.013803842,
    "move-bundle-snail": 0.0060255959,
    "move-cotton-sheep": 0.012445146,
    "move-rolling-acorn": 0.0065313054,
    "move-soil-boar": 0.0038018939,
    "move-bubble-toad": 0.0032359366,
    "move-vine-turtle": 0.035481339,
    "move-shadow-weasel": 0.0026915347,
    "move-snare-vine": 0.0042169651,
    "move-talon-owl": 0.0014621772,
    "move-spring-keeper": 0.02113489,
    "move-lantern-keeper": 0.013645832,
    "move-old-garden-snail": 0.003672823,
    "move-walking-forest": 0.0073282453,
    "move-white-paw": 0.016982437,
    "move-spiny-back-leader": 0.0043651584,
    "click": 0.091201084,
    "discovery": 0.057543997,
    "footstep": 0.0699842,
    "seed-eject": 0.0051286138,
    "seed-crack": 0.017378009,
    "sprout-pop": 0.015310874,
    "spring-birth": 0.028183829,
    "pebble-birth": 0.029512093,
    "spore-birth": 0.0038459179,
    "nest-growth-bean": 0.1,
    "nest-growth-spore": 0.45185595,
    "nest-growth-pebble": 0.029853826,
    "nest-growth-spring": 0.023442288,
    "spring-landing": 0.013031667,
    "spring-footstep": 0.02818383,
    "harvest": 0.02113489,
    "harvest-soil": 0.0081283052,
    "harvest-wood": 0.0064565421,
    "harvest-pebbles": 0.042657952,
    "harvest-dew": 0.013645831,
    "harvest-grass-fiber": 0.006095369,
    "harvest-sand": 0.007161434,
    "harvest-iron-ore": 0.0074131025,
    "harvest-copper-ore": 0.007161434,
    "harvest-quartz": 0.0054325033,
    "landing": 0.063826349,
    "throw": 0.013335214,
    "catch": 0.030902954
  });
  const sources = {
  ...globalThis.SpawnerCombatAudio.sources,
  ...globalThis.SpawnerMovementAudio?.sources,
  "click": "DesignAssets/Audio/ui-click.wav",
  "discovery": "DesignAssets/Audio/new-discovery.mp3",
  "footstep": "DesignAssets/Audio/bean-footstep.mp3",
  "seed-eject": "DesignAssets/Audio/nest-seed-eject.mp3",
  "seed-crack": "DesignAssets/Audio/seed-shell-crack.mp3",
  "sprout-pop": "DesignAssets/Audio/bean-sprout-pop.mp3",
  "spring-birth": "DesignAssets/Audio/spring-birth.mp3",
  "pebble-birth": "DesignAssets/Audio/pebble-birth-roll.mp3",
  "spore-birth": "DesignAssets/Audio/spore-birth.mp3",
  "nest-growth-bean": "DesignAssets/Audio/NestGrowthV3/sprout.mp3",
  "nest-growth-spore": "DesignAssets/Audio/NestGrowthV3/spore.mp3",
  "nest-growth-pebble": "DesignAssets/Audio/NestGrowthV3/pebble.mp3",
  "nest-growth-spring": "DesignAssets/Audio/NestGrowthV3/spring.mp3",
  "spring-landing": "DesignAssets/Audio/spring-landing.mp3",
  "spring-footstep": "DesignAssets/Audio/spring-footstep.mp3",
  "harvest": "DesignAssets/Audio/mushroom-harvest-loop.mp3",
  "harvest-soil": "DesignAssets/Audio/clay-harvest-handful.mp3",
  "harvest-wood": "DesignAssets/Audio/wood-harvest-loop.mp3",
  "harvest-pebbles": "DesignAssets/Audio/pebbles-harvest-loop.mp3",
  "harvest-dew": "DesignAssets/Audio/dew-harvest-loop.mp3",
  "harvest-grass-fiber": "DesignAssets/Audio/grass-fiber-harvest-loop.mp3",
  "harvest-sand": "DesignAssets/Audio/sand-harvest-loop.mp3",
  "harvest-iron-ore": "DesignAssets/Audio/iron-ore-harvest-loop.wav",
  "harvest-copper-ore": "DesignAssets/Audio/copper-ore-harvest-loop.mp3",
  "harvest-quartz": "DesignAssets/Audio/quartz-harvest-loop.mp3",
  "landing": "DesignAssets/Audio/bean-landing.mp3",
  "throw": "DesignAssets/Audio/mushroom-throw.mp3",
  "catch": "DesignAssets/Audio/nest-catch.mp3"
};
  const harvestSounds = Object.freeze({
    "honey-mushrooms": "harvest", clay: "harvest-soil", tree: "harvest-wood", pebbles: "harvest-pebbles",
    dew: "harvest-dew", nutrients: "harvest-dew", "grass-fiber": "harvest-grass-fiber",
    sand: "harvest-sand", "iron-ore": "harvest-iron-ore", "copper-ore": "harvest-copper-ore", quartz: "harvest-quartz"
  });
  function createMix(context) {
    const input = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -32;
    compressor.knee.value = 3;
    compressor.ratio.value = 20;
    compressor.attack.value = .001;
    compressor.release.value = .08;
    const limiter = context.createWaveShaper();
    const ceiling = 10 ** (-32 / 20);
    limiter.curve = Float32Array.from({ length: 65537 }, (_, index) =>
      Math.max(-ceiling, Math.min(ceiling, index / 32768 - 1)));
    const output = context.createGain();
    output.gain.value = 0;
    input.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(output);
    output.connect(context.destination);
    return { input, output };
  }

  globalThis.SpawnerAudio = Object.freeze({ create: function () {
    let context = null;
    let sfxGain = null;
    let sfxOutput = null;
    let loading = null;
    let muted = false;
    let active = true;
    let failed = !globalThis.AudioContext;
    const harvests = new Map();
    let clickSource = null;
    let clickGain = null;
    let discoverySource = null;
    let discoveryGain = null;
    const music = globalThis.SpawnerMusic.create();
    const buffers = new Map();
    const names = Object.keys(sources).filter(name => name !== "click" && name !== "discovery");
    const channels = [];
    const refills = [];
    let refillTimer = null;
    let prepared = false;
    const voices = new Set();
    const lastPlayed = new Map();
    const button = document.getElementById("sound-toggle");

    function updateButton() {
      button.disabled = failed;
      button.setAttribute("aria-label", failed ? "소리 사용 불가" : muted ? "소리 켜기" : "소리 끄기");
      button.setAttribute("aria-pressed", String(!muted && !failed));
      button.title = failed ? "소리 사용 불가" : muted ? "배경음악·효과음 켜기" : "배경음악·효과음 끄기";
    }

    function stop() {
      if (discoverySource) discoverySource.stop();
      discoverySource = null;
      for (const voice of voices) voice.source.stop();
      voices.clear();
      harvests.clear();
      lastPlayed.clear();
    }

    function stopClick() {
      if (clickSource) clickSource.stop();
      clickSource = null;
    }

    async function unlock() {
      if (!active || muted || failed || document.hidden) return;
      try {
        if (!context) {
          context = new AudioContext();
          const mix = createMix(context);
          sfxGain = mix.input;
          sfxOutput = mix.output;
        }
        if (context.state === "suspended") await context.resume();
        if (active && !muted && !document.hidden) music.unlock(context, sfxOutput);
        if (!loading) loading = Promise.all(Object.entries(sources).map(async ([name, source]) => {
          const encoded = await fetch(globalThis.SpawnerAssets.source(source)).then(response => {
              if (!response.ok) throw new Error("효과음을 불러오지 못했습니다.");
              return response.arrayBuffer();
            });
          buffers.set(name, await context.decodeAudioData(encoded));
        })).then(() => {
          for (let index = 0; index < 8; index++) {
            const gain = context.createGain();
            gain.gain.value = 0;
            gain.connect(sfxGain);
            const channel = { gain, sources: new Map(), source: null, name: null, priority: 0 };
            channels.push(channel);
            for (const name of names) channel.sources.set(name, prepareSource(channel, name));
          }
          prepared = true;
        });
        await loading;
      } catch {
        failed = true;
        stop();
        stopClick();
        music.suspend();
        updateButton();
      }
    }

    function available() {
      return active && !muted && !failed && !document.hidden && prepared && context?.state === "running";
    }

    function setActive(value) {
      if (active === value) return;
      active = value;
      if (active) unlock();
      else { stop(); stopClick(); music.suspend(); }
    }

    function prepareSource(channel, name) {
      const source = context.createBufferSource();
      source.buffer = buffers.get(name);
      source.connect(channel.gain);
      source.onended = () => {
        source.disconnect();
        if (channel.source === source) {
          voices.delete(channel);
          channel.source = null;
          for (const [type, voice] of harvests) if (voice === channel) harvests.delete(type);
        }
        refills.push({ channel, name });
        if (refillTimer === null) refillTimer = setTimeout(refillSources, 0);
      };
      return source;
    }

    function refillSources() {
      refillTimer = null;
      const deadline = performance.now() + 1;
      while (refills.length) {
        const { channel, name } = refills.pop();
        channel.sources.set(name, prepareSource(channel, name));
        if (performance.now() >= deadline) break;
      }
      if (refills.length) refillTimer = setTimeout(refillSources, 0);
    }

    function start(name, volume, loop) {
      if (!available() || volume <= 0) return null;
      const priority = name.startsWith("nest-growth-") || name.endsWith("-death") ? 3 : name.endsWith("-hurt") ? 2 : name.endsWith("-attack") ? 1 : 0;
      const voice = channels.find(channel => channel.source === null && channel.sources.has(name)) ||
        channels.filter(channel => channel.sources.has(name) && channel.priority < priority)
          .sort((first, second) => first.priority - second.priority)[0];
      if (!voice) return null;
      if (voice.source) {
        for (const [type, channel] of harvests) if (channel === voice) harvests.delete(type);
        voice.source.stop();
      }
      voice.priority = priority;
      const source = voice.sources.get(name);
      voice.sources.delete(name);
      voice.source = source;
      voice.name = name;
      source.loop = loop;
      voice.gain.gain.value = levels[name] * Math.min(1, volume);
      voices.add(voice);
      source.start();
      return voice;
    }

    function play(name, volume) {
      if (!available() || volume <= 0) return;
      if (name === "discovery") {
        if (context.currentTime - (lastPlayed.get(name) ?? -Infinity) < 1.2) return;
        if (discoverySource) discoverySource.stop();
        const source = context.createBufferSource();
        source.buffer = buffers.get(name);
        if (!discoveryGain) {
          discoveryGain = context.createGain();
          discoveryGain.connect(sfxGain);
        }
        discoveryGain.gain.value = levels.discovery * Math.min(1, volume);
        source.connect(discoveryGain);
        source.onended = () => {
          source.disconnect();
          if (discoverySource === source) discoverySource = null;
        };
        discoverySource = source;
        lastPlayed.set(name, context.currentTime);
        source.start();
        return;
      }
      const footstep = name === "footstep" || name === "spring-footstep";
      const landing = name === "landing" || name === "spring-landing";
      const movement = name.startsWith("move-");
      const interval = footstep ? 0.04 : landing ? 0.075 : movement ? 0.09 : 0.1;
      if (context.currentTime - (lastPlayed.get(name) ?? -Infinity) < interval) return;
      let concurrent = 0;
      for (const voice of voices) if (voice.name === name) concurrent++;
      if (landing && concurrent >= 3 || footstep && concurrent >= 6 || movement && concurrent >= 2) return;
      if (start(name, volume, false)) lastPlayed.set(name, context.currentTime);
    }

    async function playClick() {
      if (!available()) await unlock();
      if (!available()) return;
      stopClick();
      const source = context.createBufferSource();
      source.buffer = buffers.get("click");
      if (!clickGain) {
        clickGain = context.createGain();
        clickGain.gain.value = levels.click;
        clickGain.connect(sfxGain);
      }
      source.connect(clickGain);
      source.onended = () => {
        source.disconnect();
        if (clickSource === source) clickSource = null;
      };
      clickSource = source;
      source.start();
    }

    function setHarvest(volumes) {
      for (const [type, voice] of harvests) {
        if (!available() || !(volumes.get(type) > 0)) {
          voice.source.stop();
          harvests.delete(type);
        }
      }
      if (!available()) return;
      for (const [type, volume] of volumes) {
        const name = harvestSounds[type];
        if (!name || !(volume > 0)) continue;
        let voice = harvests.get(type);
        if (!voice) {
          voice = start(name, volume, true);
          if (voice) harvests.set(type, voice);
        }
        if (voice) voice.gain.gain.value = levels[name] * Math.min(1, volume);
      }
    }

    button.addEventListener("click", () => {
      muted = !muted;
      if (muted) { stop(); stopClick(); music.suspend(); }
      else { unlock(); playClick(); }
      updateButton();
    });
    document.addEventListener("click", event => {
      const target = event.target.closest?.("button, [role='button']");
      if (!target || target === button || target.matches(":disabled") || target.closest("[aria-disabled='true'], [inert]")) return;
      playClick();
    }, true);
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { stop(); stopClick(); music.suspend(); }
      else unlock();
    });
    window.addEventListener("pagehide", () => { stop(); stopClick(); music.suspend(); });
    music.update(null);
    updateButton();
    unlock();
    return { available, play, playClick, setHarvest, setActive, stop, updateMusic: music.update };
  } });
})();
