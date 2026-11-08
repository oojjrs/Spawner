(() => {
  "use strict";
  const interval = 1000 / 240;
  let previous = null, accumulated = 0, sampleStart = null, sampleFrames = 0;
  let manual = false, automaticFrame = null, hud = null, topLayerPending = false;

  function reset() {
    previous = null;
    accumulated = 0;
    sampleStart = null;
    sampleFrames = 0;
  }

  function allow(now) {
    if (!Number.isFinite(now)) return false;
    if (previous === null || now < previous || now - previous > 250) {
      previous = now;
      accumulated = 0;
      return true;
    }
    accumulated += now - previous;
    previous = now;
    if (accumulated + 0.000001 < interval) return false;
    accumulated = Math.max(0, accumulated - Math.floor((accumulated + 0.000001) / interval) * interval);
    return true;
  }

  function record(now) {
    if (!Number.isFinite(now)) return;
    if (sampleStart === null || now < sampleStart || now - sampleStart > 2000) {
      sampleStart = now;
      sampleFrames = 0;
      return;
    }
    sampleFrames++;
    const elapsed = now - sampleStart;
    if (elapsed < 500) return;
    if (hud) hud.textContent = Math.round(sampleFrames * 1000 / elapsed) + " FPS";
    sampleStart = now;
    sampleFrames = 0;
  }

  function automatic(now) {
    automaticFrame = null;
    if (manual || document.hidden) return;
    if (allow(now)) record(now);
    automaticFrame = requestAnimationFrame(automatic);
  }

  function cancelAutomatic() {
    if (automaticFrame !== null) cancelAnimationFrame(automaticFrame);
    automaticFrame = null;
  }

  function useManual() {
    if (manual) return;
    manual = true;
    cancelAutomatic();
    reset();
  }

  function refreshTopLayer() {
    if (!hud?.showPopover || topLayerPending) return;
    topLayerPending = true;
    queueMicrotask(() => {
      topLayerPending = false;
      if (!hud.isConnected) return;
      try {
        if (hud.matches(":popover-open")) hud.hidePopover();
        hud.showPopover();
      } catch {}
    });
  }

  function install() {
    hud = document.createElement("div");
    hud.id = "frame-rate";
    hud.setAttribute("aria-hidden", "true");
    hud.textContent = "0 FPS";
    hud.style.cssText = "position:fixed;inset:auto;left:6px;top:6px;margin:0;padding:0;border:0;background:transparent;color:#fff;font:11px/1.2 monospace;text-shadow:0 1px 2px #000;pointer-events:none;user-select:none;z-index:2147483647;width:max-content;height:auto;";
    if (typeof hud.showPopover === "function") hud.setAttribute("popover", "manual");
    document.body.appendChild(hud);
    refreshTopLayer();
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target.tagName === "DIALOG")) refreshTopLayer();
    });
    observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("toggle", event => {
      if (event.target !== hud && event.newState === "open") refreshTopLayer();
    }, true);
    document.addEventListener("fullscreenchange", refreshTopLayer);
    if (!manual && !document.hidden) automaticFrame = requestAnimationFrame(automatic);
  }

  document.addEventListener("visibilitychange", () => {
    reset();
    cancelAutomatic();
    if (!document.hidden) {
      refreshTopLayer();
      if (!manual) automaticFrame = requestAnimationFrame(automatic);
    }
  });
  window.addEventListener("pagehide", () => { cancelAutomatic(); reset(); });
  window.addEventListener("pageshow", () => {
    refreshTopLayer();
    if (!manual && !document.hidden && automaticFrame === null) automaticFrame = requestAnimationFrame(automatic);
  });
  globalThis.SpawnerFrameTiming = Object.freeze({ allow, record, useManual });
  if (document.body) install();
  else document.addEventListener("DOMContentLoaded", install, { once: true });
})();
