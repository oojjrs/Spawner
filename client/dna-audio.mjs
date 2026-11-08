export function createDnaAudio() {
  const sounds = new Map();
  if (typeof Audio === "function") {
    for (const action of ["place", "remove", "rotate"]) {
      const audio = new Audio("DesignAssets/Audio/DnaV2/dna-" + action + ".wav");
      audio.preload = "auto";
      audio.volume = 0.65;
      sounds.set(action, audio);
    }
  }
  function stop() {
    for (const audio of sounds.values()) audio.pause();
  }
  function visibility() {
    if (document.hidden) stop();
  }
  document.addEventListener?.("visibilitychange", visibility);
  return {
    play(action) {
      const audio = sounds.get(action);
      if (!audio || document.hidden) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    },
    destroy() {
      stop();
      document.removeEventListener?.("visibilitychange", visibility);
      sounds.clear();
    }
  };
}
