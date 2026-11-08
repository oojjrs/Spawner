(() => {
  const volume = 0.28;
  const fadeSeconds = 2;
  const gapMs = 3000;

  globalThis.SpawnerMusic = Object.freeze({ create: function () {
    const playlists = globalThis.SpawnerMusicCatalog;
    let settleReady;
    const ready = new Promise(resolve => { settleReady = resolve; });
    const cursors = { peace: 0, combat: 0 };
    const failedTracks = new Set();
    const localTracks = new Map();
    const channels = [];
    let context = null;
    let output = null;
    let masterVolume = 1;
    let analyser = null;
    let analysisActive = false;
    let analysisConnected = false;
    let enabled = false;
    let mode = null;
    let active = null;
    let pending = null;
    let generation = 0;
    let gapTimer = null;
    let fadeTimer = null;
    let combatUntil = -Infinity;
    let lastTime = -Infinity;

    function clearGap() {
      clearTimeout(gapTimer);
      gapTimer = null;
    }

    function ramp(channel, target, seconds) {
      const now = context.currentTime;
      Object.assign(channel, { from: channel.audio.volume, to: target, at: now, until: now + seconds });
      if (seconds <= 0) channel.audio.volume = target;
      else if (fadeTimer === null) fadeTimer = setInterval(updateFades, 20);
    }

    function updateFades() {
      let fading = false;
      for (const channel of channels) {
        const progress = channel.until > channel.at ? Math.min(1, Math.max(0,
          (context.currentTime - channel.at) / (channel.until - channel.at))) : 1;
        channel.audio.volume = channel.from + (channel.to - channel.from) * progress;
        if (progress < 1) fading = true;
      }
      if (!fading) {
        clearInterval(fadeTimer);
        fadeTimer = null;
      }
    }

    function release(channel) {
      clearTimeout(channel.timer);
      channel.timer = null;
      channel.audio.onended = null;
      channel.audio.pause();
      ramp(channel, 0, 0);
    }

    function loadTrack(track) {
      if (location.protocol !== "file:") return Promise.resolve(track.file);
      if (!localTracks.has(track.file)) localTracks.set(track.file, new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const timer = setTimeout(fail, 15000);
        function finish() {
          clearTimeout(timer);
          script.onload = null;
          script.onerror = null;
          script.remove();
        }
        function fail() {
          finish();
          reject(new Error());
        }
        script.onload = () => {
          finish();
          const source = globalThis.SpawnerAssets?.source(track.file) || globalThis.SpawnerLocalAssetSources?.[track.file] || track.file;
          if (source.startsWith("data:audio/")) resolve(source);
          else reject(new Error());
        };
        script.onerror = fail;
        script.src = track.file.replace("DesignAssets/Audio/Bgm/", "client/local-bgm/") + ".js";
        document.head.append(script);
      }));
      return localTracks.get(track.file);
    }

    async function prepare(channel, nextMode, ticket) {
      const tracks = playlists[nextMode];
      let index = cursors[nextMode];
      for (let count = 0; count < tracks.length; count++) {
        if (!failedTracks.has(tracks[index].file)) break;
        index = (index + 1) % tracks.length;
      }
      const track = tracks[index];
      if (failedTracks.has(track.file)) return false;
      let source;
      try { source = await loadTrack(track); } catch {
        failedTracks.add(track.file);
        return false;
      }
      if (ticket !== generation || !enabled || mode !== nextMode) return false;
      if (channel.track !== track) {
        release(channel);
        channel.track = track;
        channel.audio.src = source;
        channel.audio.load();
      }
      channel.index = index;
      return true;
    }

    function preload() {
      if (!enabled || !mode || pending) return;
      const channel = channels.find(candidate => candidate !== active && candidate.timer === null);
      if (channel) prepare(channel, mode, generation);
    }

    async function start() {
      if (!enabled || !mode || pending || context.state !== "running") return;
      clearGap();
      const nextTrack = playlists[mode][cursors[mode]];
      const resuming = active?.audio.paused && playlists[mode].includes(active.track);
      const channel = resuming ? active : channels.find(candidate => candidate !== active && candidate.track === nextTrack) ||
        channels.find(candidate => candidate !== active);
      const ticket = ++generation;
      const nextMode = mode;
      pending = channel;
      if (!resuming) {
        release(channel);
        if (!await prepare(channel, nextMode, ticket)) {
          if (ticket === generation) {
            pending = null;
            if (playlists[nextMode].some(track => !failedTracks.has(track.file))) start(); else settleReady(false);
          }
          return;
        }
        if (context.state !== "running") { pending = null; return; }
        channel.audio.currentTime = 0;
      }
      clearTimeout(channel.timer);
      channel.timer = null;
      channel.audio.play().then(() => {
        if (ticket !== generation) return;
        clearGap();
        pending = null;
        settleReady(true);
        const previous = active;
        active = channel;
        if (!resuming) cursors[nextMode] = (channel.index + 1) % playlists[nextMode].length;
        ramp(channel, volume, fadeSeconds);
        channel.audio.onended = () => {
          if (active !== channel) return;
          active = null;
          release(channel);
          clearGap();
          gapTimer = setTimeout(() => {
            gapTimer = null;
            start();
          }, gapMs);
        };
        if (previous && previous !== channel) {
          previous.audio.onended = null;
          ramp(previous, 0, fadeSeconds);
          previous.timer = setTimeout(() => {
            release(previous);
            preload();
          }, fadeSeconds * 1000);
        } else preload();
      }).catch(error => {
        if (ticket !== generation) return;
        pending = null;
        release(channel);
        if (error.name === "NotAllowedError") { settleReady(false); return; }
        if (active === channel) active = null;
        failedTracks.add(channel.track.file);
        start();
      });
    }

    function setMode(next) {
      if (mode === next) return;
      if (!mode && next) {
        cursors.peace = Math.floor(Math.random() * playlists.peace.length);
        cursors.combat = Math.floor(Math.random() * playlists.combat.length);
      }
      mode = next;
      generation++;
      clearGap();
      if (pending) release(pending);
      pending = null;
      if (!mode) {
        for (const channel of channels) release(channel);
        active = null;
      } else start();
    }

    function update(snapshot) {
      if (!snapshot) {
        combatUntil = -Infinity;
        lastTime = -Infinity;
        setMode("peace");
        return;
      }
      if (snapshot.ending && mode) return;
      const time = snapshot.simSeconds;
      if (time < lastTime) combatUntil = -Infinity;
      lastTime = time;
      const agents = snapshot.agents.filter(agent => agent.health > 0);
      const ownIds = new Set(agents.map(agent => agent.id));
      const fighting = agents.some(agent => agent.action === "fight" || agent.action === "flee" ||
        agent.attack && time < agent.attack.endsAt) ||
        snapshot.rivals.some(agent => agent.health > 0 &&
          (agent.mode === "attack" && ownIds.has(agent.attackTargetId) ||
           agent.attack && ownIds.has(agent.attack.targetId) &&
           time < agent.attack.endsAt));
      if (fighting) combatUntil = time + 5;
      setMode(time < combatUntil ? "combat" : "peace");
    }

    function unlock(audioContext) {
      context = audioContext;
      if (!output) {
        output = context.createGain();
        output.gain.value = masterVolume;
        output.connect(context.destination);
        if (analysisActive) setAnalysisActive(true);
      }
      if (!channels.length) {
        for (let index = 0; index < 2; index++) {
          const audio = new Audio();
          audio.crossOrigin = "anonymous";
          audio.preload = "auto";
          audio.loop = false;
          audio.volume = 0;
          const source = context.createMediaElementSource(audio);
          source.connect(output);
          channels.push({ audio, source, timer: null, track: null, index: 0, from: 0, to: 0, at: 0, until: 0 });
        }
      }
      enabled = true;
      if (!pending && gapTimer === null && (!active || active.audio.paused || !playlists[mode]?.includes(active.track))) start();
    }

    function setVolume(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      masterVolume = Math.max(0, Math.min(1, value));
      if (output) output.gain.value = masterVolume;
    }

    function suspend() {
      enabled = false;
      generation++;
      clearGap();
      for (const channel of channels) release(channel);
      clearInterval(fadeTimer);
      fadeTimer = null;
      pending = null;
    }

    function setAnalysisActive(value) {
      analysisActive = value;
      if (!output) return;
      if (value && !analyser) {
        analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0;
      }
      if (analyser && analysisConnected !== value) {
        if (analysisConnected) output.disconnect(analyser);
        if (value) output.connect(analyser);
        analysisConnected = value;
      }
    }

    function analysisAvailable() {
      return analysisActive && enabled && masterVolume > 0 && !!analyser && context.state === "running" &&
        channels.some(channel => !channel.audio.paused && !channel.audio.ended &&
          !channel.audio.muted && channel.audio.volume > 0 && channel.audio.readyState >= 3);
    }

    function readWaveform(samples) {
      samples.fill(0);
      if (!analysisAvailable()) return false;
      analyser.getFloatTimeDomainData(samples);
      return true;
    }
    function readSpectrum(samples) {
      samples.fill(-Infinity);
      if (!analysisAvailable()) return false;
      analyser.getFloatFrequencyData(samples);
      return true;
    }

    return { ready, update, unlock, suspend, setVolume, waveform: Object.freeze({
      read: readWaveform, readSpectrum, setActive: setAnalysisActive,
      get sampleRate() { return context?.sampleRate || 0; }
    }) };
  } });
})();
