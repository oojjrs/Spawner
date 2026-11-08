(() => {
  "use strict";
  const storageKey = "spawner.audio-settings.v1";
  const clamp = value => Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
  let volume = 1, muted = false, lastVolume = 1;
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") {
      if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) volume = clamp(saved.volume);
      muted = saved.muted === true;
      if (typeof saved.lastVolume === "number" && Number.isFinite(saved.lastVolume) && saved.lastVolume > 0)
        lastVolume = clamp(saved.lastVolume) || 1;
      if (volume > 0) lastVolume = volume;
    }
  } catch {}
  const listeners = new Set();
  const read = () => ({ volume, muted, lastVolume, effectiveVolume: muted ? 0 : volume });
  function save() {
    try { globalThis.localStorage?.setItem(storageKey, JSON.stringify({ volume, muted, lastVolume })); } catch {}
    for (const listener of listeners) listener(read());
  }
  function setVolume(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    volume = clamp(value);
    if (volume > 0) lastVolume = volume;
    muted = false;
    save();
  }
  function toggleMute() {
    if (muted || volume === 0) {
      if (volume === 0) volume = lastVolume;
      muted = false;
    } else muted = true;
    save();
  }
  const controls = document.getElementById("sound-controls");
  const toggle = document.getElementById("sound-settings-toggle");
  const panel = document.getElementById("sound-settings");
  const slider = document.getElementById("sound-volume");
  const output = document.getElementById("sound-volume-value");
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
    const percent = Math.round(volume * 100);
    if (slider) {
      slider.value = String(percent);
      slider.setAttribute("aria-valuetext", percent + "%" + (muted ? " (음소거)" : ""));
    }
    if (output) output.textContent = percent + "%";
  }
  slider?.addEventListener("input", () => setVolume(Number(slider.value) / 100));
  listeners.add(update);
  update();
  globalThis.SpawnerSoundSettings = Object.freeze({ read, setVolume, toggleMute, close,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
})();
