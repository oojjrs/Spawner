(() => {
  "use strict";
  const gate = document.getElementById("entry-gate");
  const button = document.getElementById("entry-button");
  const welcome = document.getElementById("welcome");
  const tribeSelection = document.getElementById("tribe-selection");
  const scripts = [...document.querySelectorAll("script[data-src]")].map(script => script.dataset.src);
  const releaseCacheKey = document.currentScript?.src ? new URL(document.currentScript.src).searchParams.get("v") : null;
  let cursor = 0;
  const loaded = new Set();
  let loading = false;
  let timer = null;
  function seedAudio() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    try {
      const seed = globalThis.SpawnerEntryAudio || { context: new AudioContext(), resumed: null };
      globalThis.SpawnerEntryAudio = seed;
      seed.resumed = seed.context.resume();
      seed.resumed?.catch(() => {});
    } catch {}
  }
  function beginMessages() {
    const messages = [...document.querySelectorAll(".welcome-loading-message > span")];
    let selected = Math.floor(Math.random() * messages.length);
    messages.forEach((message, index) => { message.hidden = index !== selected; });
    timer = setInterval(() => {
      if (welcome.getAttribute("aria-busy") !== "true") { clearInterval(timer); timer = null; return; }
      selected = (selected + 1) % messages.length;
      messages.forEach((message, index) => { message.hidden = index !== selected; });
    }, 1500);
  }
  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const url = new URL(source, document.baseURI);
      if (releaseCacheKey) url.searchParams.set("v", releaseCacheKey);
      script.src = url.href;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => { script.remove(); reject(new Error(source)); };
      document.body.append(script);
    });
  }
  async function prepareWelcome() {
    for (const source of ["./client/music-catalog.js", "./client/music.js", "./client/welcome-art.js", "./client/welcome-waveform.js"]) {
      if (loaded.has(source)) continue;
      await loadScript(source);
      loaded.add(source);
    }
    let stage = welcome.querySelector(".welcome-stage");
    if (!stage) {
      stage = document.createElement("div");
      stage.className = "welcome-stage";
      const title = document.getElementById("welcome-title");
      title.before(stage);
      stage.append(title);
    }
    let waveform = welcome.querySelector(".welcome-waveform");
    if (!waveform) {
      waveform = document.createElement("canvas");
      waveform.className = "welcome-waveform";
      waveform.setAttribute("aria-hidden", "true");
      stage.after(waveform);
    }
    const image = new globalThis.Image();
    image.src = globalThis.SpawnerWelcomeBackground || "DesignAssets/Welcome/forest-clearing.webp";
    stage.style.backgroundImage = "url(" + JSON.stringify(image.src) + ")";
    const backgroundReady = image.decode().catch(() => {});
    const seed = globalThis.SpawnerEntryAudio;
    if (!seed) {
      backgroundReady.catch(() => {});
      return;
    }
    globalThis.SpawnerLocalAssetSources ||= Object.create(null);
    if (!seed.music) {
      seed.music = globalThis.SpawnerMusic.create();
      const settings = globalThis.SpawnerSoundSettings;
      seed.muted = settings ? settings.read().effectiveMuted : false;
      seed.music.setVolume?.(settings?.read().effectiveMusicVolume ?? 1);
      const sound = document.getElementById("sound-toggle");
      let settlePriority;
      seed.priority = new Promise(resolve => { settlePriority = resolve; });
      function updateSound() {
        sound.disabled = false;
        sound.textContent = seed.muted ? "꺼짐" : "켜짐";
        sound.setAttribute("aria-label", seed.muted ? "소리 켜기" : "소리 끄기");
        sound.setAttribute("aria-pressed", String(!seed.muted));
        sound.title = seed.muted ? "배경음악·효과음 켜기" : "배경음악·효과음 끄기";
      }
      function resumeMusic() {
        if (seed.muted || document.hidden || document.body.dataset.screen !== "welcome") { seed.music.suspend(); settlePriority(false); return; }
        Promise.resolve(seed.context.resume()).then(() => {
          if (!seed.muted && !document.hidden && document.body.dataset.screen === "welcome") seed.music.unlock(seed.context);
        }).catch(() => settlePriority(false));
      }
      function applySettings() {
        const wasMuted = seed.muted, value = settings.read();
        seed.muted = value.effectiveMuted;
        seed.music.setVolume?.(value.effectiveMusicVolume);
        updateSound();
        if (seed.muted || wasMuted) resumeMusic();
      }
      const unsubscribe = settings?.subscribe(applySettings);
      function toggleSound() {
        if (settings) { settings.toggleMute(); return; }
        seed.muted = !seed.muted;
        updateSound();
        resumeMusic();
      }
      function hideMusic() { seed.music.suspend(); settlePriority(false); }
      sound.addEventListener("click", toggleSound);
      document.addEventListener("visibilitychange", resumeMusic);
      window.addEventListener("pagehide", hideMusic);
      seed.cleanup = () => {
        unsubscribe?.();
        sound.removeEventListener("click", toggleSound);
        document.removeEventListener("visibilitychange", resumeMusic);
        window.removeEventListener("pagehide", hideMusic);
        seed.cleanup = null;
        seed.resumeMusic = null;
      };
      updateSound();
      seed.music.update(null);
      seed.resumeMusic = resumeMusic;
    }
    for (const source of ["./client/local-assets.js", "./client/assets.js", "./client/combat-audio.js", "./client/movement-audio.js", "./client/audio.js"]) {
      if (loaded.has(source) || source === "./client/local-assets.js" && location.protocol !== "file:") continue;
      await loadScript(source);
      loaded.add(source);
    }
    if (!seed.audio) {
      seed.audio = globalThis.SpawnerAudio.create();
      seed.audio.playClick();
    }
    globalThis.SpawnerWelcomeWaveform.create(seed.music.waveform);
    seed.resumeMusic?.();
    Promise.all([backgroundReady, Promise.race([seed.music.ready, seed.priority])]).catch(() => {});
  }
  button.addEventListener("click", async () => {
    if (loading) return;
    seedAudio();
    loading = true;
    button.disabled = true;
    gate.hidden = true;
    welcome.hidden = false;
    welcome.inert = false;
    tribeSelection.inert = false;
    document.body.dataset.screen = "welcome";
    beginMessages();
    document.getElementById("welcome-title").focus();
    let releaseAssets;
    globalThis.SpawnerWelcomeLoading = new Promise(resolve => { releaseAssets = resolve; });
    try {
      await prepareWelcome();
      for (; cursor < scripts.length; cursor++) {
        if (scripts[cursor] === "./client/local-assets.js" && location.protocol !== "file:") continue;
        if (!loaded.has(scripts[cursor])) {
          await loadScript(scripts[cursor]);
          loaded.add(scripts[cursor]);
        }
        if (scripts[cursor] === "./client/welcome-header.js") {
          globalThis.SpawnerWelcomeHeaderReady.then(async () => {
            const seed = globalThis.SpawnerEntryAudio;
            if (seed) {
              seed.audio ||= globalThis.SpawnerAudio.create();
              globalThis.SpawnerWelcomeHeader.attachAudio(seed.audio);
            }
            await globalThis.SpawnerWelcomeHeader.start();
          }).catch(() => {});
          await new Promise(resolve => {
            let frame = null, task = null, settled = false;
            function finish() {
              if (settled) return;
              settled = true;
              clearTimeout(fallback);
              if (task !== null) clearTimeout(task);
              if (frame !== null) cancelAnimationFrame(frame);
              resolve();
            }
            const fallback = setTimeout(finish, 50);
            if (document.hidden) task = setTimeout(finish, 0);
            else frame = requestAnimationFrame(() => { frame = null; task = setTimeout(finish, 0); });
          });
          releaseAssets();
        }
      }
    } catch {
      releaseAssets();
      globalThis.SpawnerEntryAudio?.music?.suspend();
      clearInterval(timer);
      timer = null;
      welcome.hidden = true;
      welcome.inert = true;
      tribeSelection.hidden = true;
      tribeSelection.inert = true;
      gate.hidden = false;
      document.body.dataset.screen = "entry";
      button.disabled = false;
      loading = false;
      button.focus();
    }
  });
})();
