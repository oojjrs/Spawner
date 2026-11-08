(() => {
  "use strict";
  const storageKey = "spawner.audio-settings.v1";
  const clamp = value => Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
  const channels = ["effects", "music"];
  const volumes = { effects: 1, music: 1 }, lastVolumes = { effects: 1, music: 1 };
  let muted = false;
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") {
      muted = saved.muted === true;
      for (const channel of channels) {
        const value = saved[channel + "Volume"] ?? saved.volume;
        const last = saved["last" + (channel === "effects" ? "Effects" : "Music") + "Volume"] ?? saved.lastVolume;
        if (typeof value === "number" && Number.isFinite(value)) volumes[channel] = clamp(value);
        if (typeof last === "number" && Number.isFinite(last) && last > 0) lastVolumes[channel] = clamp(last) || 1;
        if (volumes[channel] > 0) lastVolumes[channel] = volumes[channel];
      }
    }
  } catch {}
  const listeners = new Set();
  const read = () => ({ effectsVolume: volumes.effects, musicVolume: volumes.music, muted,
    lastEffectsVolume: lastVolumes.effects, lastMusicVolume: lastVolumes.music,
    effectiveEffectsVolume: muted ? 0 : volumes.effects, effectiveMusicVolume: muted ? 0 : volumes.music,
    effectiveMuted: muted || volumes.effects === 0 && volumes.music === 0 });
  function save() {
    const { effectsVolume, musicVolume, lastEffectsVolume, lastMusicVolume } = read();
    try { globalThis.localStorage?.setItem(storageKey, JSON.stringify({ effectsVolume, musicVolume, muted, lastEffectsVolume, lastMusicVolume })); } catch {}
    for (const listener of listeners) listener(read());
  }
  function setVolume(channel, value) {
    if (!channels.includes(channel) || typeof value !== "number" || !Number.isFinite(value)) return;
    volumes[channel] = clamp(value);
    if (volumes[channel] > 0) lastVolumes[channel] = volumes[channel];
    muted = false;
    save();
  }
  function toggleMute() {
    if (read().effectiveMuted) {
      if (volumes.effects === 0 && volumes.music === 0)
        for (const channel of channels) volumes[channel] = lastVolumes[channel];
      muted = false;
    } else muted = true;
    save();
  }
  const controls = document.getElementById("sound-controls");
  const toggle = document.getElementById("sound-settings-toggle");
  const panel = document.getElementById("sound-settings");
  const sliders = channels.map(channel => ({ channel,
    slider: document.getElementById("sound-" + channel + "-volume"),
    output: document.getElementById("sound-" + channel + "-volume-value") }));
  function close(restoreFocus = false) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) toggle.focus();
  }
  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      if (!panel.hidden) { close(true); return; }
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      document.getElementById("sound-toggle")?.focus();
    });
    document.addEventListener("pointerdown", event => {
      if (!controls.contains(event.target)) close();
    });
    controls.addEventListener("keydown", event => {
      if (event.key !== "Escape" || panel.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    });
    controls.addEventListener("focusout", event => {
      if (event.relatedTarget && !controls.contains(event.relatedTarget)) close();
    });
  }
  function update() {
    for (const { channel, slider, output } of sliders) {
      const percent = Math.round(volumes[channel] * 100);
      if (slider) {
        slider.value = String(percent);
        slider.setAttribute("aria-valuetext", percent + "%" + (muted ? " (음소거)" : ""));
      }
      if (output) output.textContent = percent + "%";
    }
  }
  for (const { channel, slider } of sliders)
    slider?.addEventListener("input", () => setVolume(channel, Number(slider.value) / 100));
  listeners.add(update);
  update();
  globalThis.SpawnerSoundSettings = Object.freeze({ read, setVolume, toggleMute, close,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
})();
