(() => {
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
  "landing": "DesignAssets/Audio/bean-landing.mp3",
  "throw": "DesignAssets/Audio/mushroom-throw.mp3",
  "catch": "DesignAssets/Audio/nest-catch.mp3"
};
  const harvestSounds = Object.freeze({
    "honey-mushrooms": "harvest", clay: "harvest-soil", tree: "harvest-wood", pebbles: "harvest-pebbles",
    dew: "harvest-dew"
  });
  globalThis.SpawnerAudio = Object.freeze({ create: function () {
    const entryAudio = globalThis.SpawnerEntryAudio;
    entryAudio?.cleanup?.();
    let context = null;
    let entryResume = entryAudio?.resumed || null;
    let worldGain = null;
    let welcomeGain = null;
    let worldVolume = 1, combatGeneration = 0;
    let loading = null;
    let muted = entryAudio?.muted || false;
    let active = true;
    let failed = !entryAudio?.context && !globalThis.AudioContext;
    const harvests = new Map();
    let clickSource = null;
    let clickGain = null;
    let discoverySource = null;
    let discoveryGain = null;
    const music = entryAudio?.music || globalThis.SpawnerMusic.create();
    const buffers = new Map();
    const names = Object.keys(sources);
    const welcomeNames = new Set(["click", "discovery", "footstep", "landing", "move-spore", "move-pebble", "move-spring", "spring-landing"]);
    const pending = new Map();
    const preparedNames = new Set();
    const channels = [];
    const refills = [];
    let refillTimer = null;
    let prepared = false;
    const voices = new Set();
    const lastPlayed = new Map();
    const levels = { harvest: 0.8, "harvest-soil": 0.4765297, landing: 1.2, footstep: 0.6, throw: 1.5, catch: 2, "seed-eject": 0.5308844, "seed-crack": 0.7079458, "sprout-pop": 1, "spring-birth": 0.5560298, "pebble-birth": 1, "spore-birth": 0.3, "spring-landing": 0.3794733, "spring-footstep": 0.6,
      "move-spiny-back-beetle": 0.2140069,
      "move-spiny-back-leader": 0.2107398,
      "move-lantern-keeper": 0.4101223,
      "move-pebble": 0.2307903,
      "move-spore": 0.1847738,
      "harvest-wood": 0.4009498,
      "nest-growth-spring": 0.5308844,
      "pebble-death": 0.5956621,
      "move-walking-forest": 0.2358822,
      "move-bundle-snail": 0.2867195,
      "nest-growth-pebble": 0.7079458,
      "beetle-hurt": 0.7498942,
      "beetle-attack": 0.5623413,
      "flower-tail-bird-attack": 0.7079458,
      "dew-rabbit-attack": 0.9440609,
      "soil-mole-attack": 0.8413951,
      "bundle-snail-attack": 0.9440609,
      "cotton-sheep-attack": 0.6683439,
      "rolling-acorn-attack": 0.7943282,
      "soil-boar-attack": 0.5308844,
      "bubble-toad-attack": 0.8912509,
      "vine-turtle-attack": 0.7498942,
      "shadow-weasel-attack": 0.8413951,
      "snare-vine-attack": 0.7079458,
      "talon-owl-attack": 1.0592537,
      "spring-keeper-attack": 0.7079458,
      "lantern-keeper-attack": 0.5956621,
      "old-garden-snail-attack": 0.7498942,
      "walking-forest-attack": 0.7498942,
      "white-paw-attack": 0.7943282,
      "spiny-back-leader-attack": 0.5623413
    };
    const button = document.getElementById("sound-toggle");

    function updateButton() {
      button.disabled = failed;
      button.setAttribute("aria-label", failed ? "소리 사용 불가" : muted ? "소리 켜기" : "소리 끄기");
      button.setAttribute("aria-pressed", String(!muted && !failed));
      button.title = failed ? "소리 사용 불가" : muted ? "배경음악·효과음 켜기" : "배경음악·효과음 끄기";
    }

    function stopGroup(group) {
      for (const voice of voices) if (voice.group === group) {
        voice.source.stop();
        voice.source = null;
        voice.gain.gain.value = 0;
        voices.delete(voice);
      }
    }

    function stopWorld() {
      combatGeneration++;
      stopGroup("world");
      harvests.clear();
    }

    function stopWelcome() {
      stopGroup("welcome");
      for (const key of lastPlayed.keys()) if (key.startsWith("welcome:")) lastPlayed.delete(key);
    }

    function stop() {
      if (discoverySource) discoverySource.stop();
      discoverySource = null;
      stopWorld();
      stopWelcome();
      lastPlayed.clear();
    }

    function stopClick() {
      if (clickSource) clickSource.stop();
      clickSource = null;
    }

    function initialize() {
      if (failed) return false;
      if (context) return true;
      context = entryAudio?.context || new AudioContext();
      worldGain = context.createGain();
      worldGain.gain.value = worldVolume;
      worldGain.connect(context.destination);
      welcomeGain = context.createGain();
      welcomeGain.connect(context.destination);
      for (let index = 0; index < 8; index++) {
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(worldGain);
        channels.push({ gain, sources: new Map(), source: null, name: null, priority: 0, group: "world" });
      }
      return true;
    }

    function prepareSound(name) {
      if (preparedNames.has(name)) return Promise.resolve();
      if (pending.has(name)) return pending.get(name);
      if (!Object.hasOwn(sources, name)) return Promise.reject(new Error(name));
      const request = (async () => {
        try {
          await (welcomeNames.has(name) ? globalThis.SpawnerAssets.welcomeReady : globalThis.SpawnerAssets.ready);
          if (!buffers.has(name)) {
            const response = await fetch(await globalThis.SpawnerAssets.load(sources[name]));
            if (!response.ok) throw new Error("효과음을 불러오지 못했습니다.");
            buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
          }
          if (name !== "click" && name !== "discovery")
            for (const channel of channels) if (!channel.sources.has(name)) channel.sources.set(name, prepareSource(channel, name));
          preparedNames.add(name);
          prepared = true;
        } finally {
          pending.delete(name);
        }
      })();
      pending.set(name, request);
      return request;
    }

    async function prepare(names) {
      if (!initialize()) return false;
      await Promise.all([...new Set(names)].map(prepareSound));
      return true;
    }

    async function unlock() {
      if (!active || muted || failed || document.hidden) return;
      try {
        if (!initialize()) return;
        if (entryResume) {
          const request = entryResume;
          await request;
          if (entryResume === request) entryResume = null;
        }
        if (context.state === "suspended") await context.resume();
        if (active && !muted && !document.hidden) music.unlock(context);
        if (!loading) {
          const priority = globalThis.SpawnerWelcomeLoading ? names.filter(name => welcomeNames.has(name)) : names;
          loading = Promise.allSettled(priority.map(prepareSound));
          if (priority.length !== names.length)
            Promise.allSettled(names.filter(name => !welcomeNames.has(name)).map(prepareSound));
        }
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

    function setWorldVolume(volume) {
      worldVolume = Math.max(0, Math.min(1, volume));
      if (worldGain) worldGain.gain.value = worldVolume;
      if (worldVolume === 0 && voices.size) stopWorld();
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

    function start(name, volume, loop, group) {
      if (!available() || group === "world" && worldVolume <= 0 || volume <= 0) return null;
      const priority = name.startsWith("nest-growth-") || name.endsWith("-death") ? 3 : name.endsWith("-hurt") ? 2 : name.endsWith("-attack") ? 1 : 0;
      const voice = channels.find(channel => channel.source === null && channel.sources.has(name)) ||
        channels.filter(channel => channel.sources.has(name) && channel.priority < priority)
          .sort((first, second) => first.priority - second.priority)[0];
      if (!voice) return null;
      if (voice.source) {
        for (const [type, channel] of harvests) if (channel === voice) harvests.delete(type);
        voice.source.stop();
      }
      if (voice.group !== group) {
        voice.gain.disconnect();
        voice.gain.connect(group === "welcome" ? welcomeGain : worldGain);
        voice.group = group;
      }
      voice.priority = priority;
      const source = voice.sources.get(name);
      voice.sources.delete(name);
      voice.source = source;
      voice.name = name;
      source.loop = loop;
      voice.gain.gain.value = (levels[name] ?? globalThis.SpawnerMovementAudio?.levels[name] ?? (name.startsWith("harvest-") ? .8 : 1)) * Math.min(1, volume);
      voices.add(voice);
      source.start();
      return voice;
    }

    function play(name, volume) {
      if (!available() || volume <= 0) return;
      if (name === "discovery") {
        if (!buffers.has(name)) return;
        if (context.currentTime - (lastPlayed.get(name) ?? -Infinity) < 1.2) return;
        if (discoverySource) discoverySource.stop();
        const source = context.createBufferSource();
        source.buffer = buffers.get(name);
        if (!discoveryGain) {
          discoveryGain = context.createGain();
          discoveryGain.connect(context.destination);
        }
        discoveryGain.gain.value = 0.65 * Math.min(1, volume);
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
      playGroup(name, volume, "world");
    }

    function playCombat(name, volume) {
      if (!available() || volume <= 0 || !Object.hasOwn(sources, name)) return;
      const at = context.currentTime, generation = combatGeneration;
      prepareSound(name).then(() => {
        if (!available() || generation !== combatGeneration || worldVolume <= 0 || context.currentTime - at > .2) return;
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffers.get(name);
        gain.gain.value = .7 * (levels[name] ?? 1) * Math.min(1, volume);
        source.connect(gain); gain.connect(worldGain);
        const voice = { source, gain, group: "world", name }; voices.add(voice);
        source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); };
        source.start();
      }).catch(() => {});
    }

    function playWelcome(name, volume) {
      playGroup(name, volume, "welcome");
    }

    function playGroup(name, volume, group) {
      if (!available() || volume <= 0) return;
      const key = group + ":" + name;
      const footstep = name === "footstep" || name === "spring-footstep";
      const landing = name === "landing" || name === "spring-landing";
      const movement = name.startsWith("move-");
      const interval = footstep ? 0.04 : landing ? 0.075 : movement ? 0.09 : 0.1;
      if (context.currentTime - (lastPlayed.get(key) ?? -Infinity) < interval) return;
      let concurrent = 0;
      for (const voice of voices) if (voice.name === name && voice.group === group) concurrent++;
      if (landing && concurrent >= 3 || footstep && concurrent >= 6 || movement && concurrent >= 2) return;
      if (start(name, volume, false, group)) lastPlayed.set(key, context.currentTime);
    }

    async function playClick() {
      if (!available()) await unlock();
      if (!active || muted || failed || document.hidden) return;
      try { await prepare(["click"]); } catch { return; }
      if (!available()) return;
      stopClick();
      const source = context.createBufferSource();
      source.buffer = buffers.get("click");
      if (!clickGain) {
        clickGain = context.createGain();
        clickGain.gain.value = 0.3;
        clickGain.connect(context.destination);
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
          voice = start(name, volume, true, "world");
          if (voice) harvests.set(type, voice);
        }
        if (voice) voice.gain.gain.value = (levels[name] ?? .8) * Math.min(1, volume);
      }
    }

    button.addEventListener("click", () => {
      muted = !muted;
      if (muted) { stop(); stopClick(); music.suspend(); }
      else { unlock(); playClick(); }
      updateButton();
    });
    document.addEventListener("click", event => {
      unlock();
      const target = event.target.closest?.("button, [role='button']");
      if (!target || target === button || target.matches(":disabled") || target.closest("[aria-disabled='true'], [inert]")) return;
      playClick();
    }, true);
    document.addEventListener("pointerdown", unlock, true);
    // Touch input gains playback activation on release, after pointerdown.
    document.addEventListener("pointerup", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { stop(); stopClick(); music.suspend(); }
      else unlock();
    });
    window.addEventListener("pagehide", () => { stop(); stopClick(); music.suspend(); });
    music.update(null);
    updateButton();
    unlock();
    return { available, prepare, play, playCombat, playWelcome, stopWelcome, playClick, setHarvest, setActive, setWorldVolume, stop, updateMusic: music.update, musicWaveform: music.waveform };
  } });
})();
