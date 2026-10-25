(() => {
  const sources = {
  "click": "DesignAssets/Audio/ui-click.wav",
  "discovery": "DesignAssets/Audio/new-discovery.mp3",
  "footstep": "DesignAssets/Audio/bean-footstep.mp3",
  "seed-eject": "DesignAssets/Audio/nest-seed-eject.mp3",
  "seed-crack": "DesignAssets/Audio/seed-shell-crack.mp3",
  "sprout-pop": "DesignAssets/Audio/bean-sprout-pop.mp3",
  "spring-birth": "DesignAssets/Audio/spring-birth.mp3",
  "pebble-birth": "DesignAssets/Audio/pebble-birth-roll.mp3",
  "spring-landing": "DesignAssets/Audio/spring-landing.mp3",
  "spring-footstep": "DesignAssets/Audio/spring-footstep.mp3",
  "harvest": "DesignAssets/Audio/mushroom-harvest-loop.mp3",
  "landing": "DesignAssets/Audio/bean-landing.mp3",
  "throw": "DesignAssets/Audio/mushroom-throw.mp3",
  "catch": "DesignAssets/Audio/nest-catch.mp3"
};
  globalThis.SpawnerAudio = Object.freeze({ create: function () {
    let context = null;
    let loading = null;
    let muted = false;
    let active = true;
    let failed = !globalThis.AudioContext;
    let harvest = null;
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
    const levels = { harvest: 0.8, landing: 1.2, footstep: 0.6, throw: 1.5, catch: 2, "seed-eject": 1, "seed-crack": 1, "sprout-pop": 1, "spring-birth": 1, "pebble-birth": 1, "spring-landing": 1.2, "spring-footstep": 0.6 };
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
      harvest = null;
      lastPlayed.clear();
    }

    function stopClick() {
      if (clickSource) clickSource.stop();
      clickSource = null;
    }

    async function unlock() {
      if (!active || muted || failed || document.hidden) return;
      try {
        if (!context) context = new AudioContext();
        if (context.state === "suspended") await context.resume();
        if (active && !muted && !document.hidden) music.unlock(context);
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
            gain.connect(context.destination);
            const channel = { gain, sources: new Map(), source: null, name: null };
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
          if (harvest === channel) harvest = null;
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
      if (!available() || volume <= 0 || voices.size >= 8) return null;
      const voice = channels.find(channel => channel.source === null && channel.sources.has(name));
      if (!voice) return null;
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
      const footstep = name === "footstep" || name === "spring-footstep";
      const landing = name === "landing" || name === "spring-landing";
      const interval = footstep ? 0.04 : landing ? 0.075 : 0.1;
      if (context.currentTime - (lastPlayed.get(name) ?? -Infinity) < interval) return;
      let concurrent = 0;
      for (const voice of voices) if (voice.name === name) concurrent++;
      if (landing && concurrent >= 3 || footstep && concurrent >= 6) return;
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

    function setHarvest(volume) {
      if (!available() || volume <= 0) {
        if (harvest) harvest.source.stop();
        harvest = null;
        return;
      }
      if (!harvest) harvest = start("harvest", volume, true);
      if (harvest) harvest.gain.gain.value = levels.harvest * Math.min(1, volume);
    }

    button.addEventListener("click", () => {
      muted = !muted;
      if (muted) { stop(); stopClick(); music.suspend(); }
      else playClick();
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
    updateButton();
    return { available, play, playClick, setHarvest, setActive, stop, updateMusic: music.update };
  } });
})();
