(() => {
  const volume = 0.28;
  const fadeSeconds = 2;
  const gapMs = 3000;

  globalThis.SpawnerMusic = Object.freeze({ create: function () {
    const playlists = globalThis.SpawnerMusicCatalog;
    const cursors = { peace: 0, combat: 0 };
    const failedTracks = new Set();
    const channels = [];
    let context = null;
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

    function prepare(channel) {
      const tracks = playlists[mode];
      let index = cursors[mode];
      for (let count = 0; count < tracks.length; count++) {
        if (!failedTracks.has(tracks[index].file)) break;
        index = (index + 1) % tracks.length;
      }
      const track = tracks[index];
      if (failedTracks.has(track.file)) return false;
      if (channel.track !== track) {
        release(channel);
        channel.track = track;
        channel.audio.src = track.file;
        channel.audio.load();
      }
      channel.index = index;
      return true;
    }

    function preload() {
      if (!enabled || !mode || pending) return;
      const channel = channels.find(candidate => candidate !== active && candidate.timer === null);
      if (channel) prepare(channel);
    }

    function start() {
      if (!enabled || !mode || pending || context.state !== "running") return;
      clearGap();
      const nextTrack = playlists[mode][cursors[mode]];
      const channel = channels.find(candidate => candidate !== active && candidate.track === nextTrack) ||
        channels.find(candidate => candidate !== active);
      release(channel);
      if (!prepare(channel)) return;
      clearTimeout(channel.timer);
      channel.timer = null;
      channel.audio.currentTime = 0;
      const ticket = ++generation;
      const nextMode = mode;
      pending = channel;
      channel.audio.play().then(() => {
        if (ticket !== generation) return;
        clearGap();
        pending = null;
        const previous = active;
        active = channel;
        cursors[nextMode] = (channel.index + 1) % playlists[nextMode].length;
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
        if (previous) {
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
        if (error.name === "NotAllowedError") return;
        failedTracks.add(channel.track.file);
        start();
      });
    }

    function setMode(next) {
      if (mode === next) return;
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
        setMode(null);
        return;
      }
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
      if (!channels.length) {
        for (let index = 0; index < 2; index++) {
          const audio = new Audio();
          audio.preload = "auto";
          audio.loop = false;
          audio.volume = 0;
          channels.push({ audio, timer: null, track: null, index: 0, from: 0, to: 0, at: 0, until: 0 });
        }
      }
      enabled = true;
      if (!pending && gapTimer === null && (!active || !playlists[mode]?.includes(active.track))) start();
    }

    function suspend() {
      enabled = false;
      generation++;
      clearGap();
      for (const channel of channels) release(channel);
      clearInterval(fadeTimer);
      fadeTimer = null;
      active = null;
      pending = null;
    }

    return { update, unlock, suspend };
  } });
})();
