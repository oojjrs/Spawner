(() => {
  let currentMusic = null;
  let currentController = null;
  globalThis.SpawnerWelcomeWaveform = Object.freeze({ create: function (music) {
    if (music === currentMusic && currentController) return currentController;
    currentController?.dispose();
    const welcome = document.getElementById("welcome");
    const frequencies = new Float32Array(1024);
    const levels = new Float32Array(30);
    const starts = new Uint16Array(30);
    const ends = new Uint16Array(30);
    let canvas = null;
    let drawing = null;
    let frame = null;
    let previousTime = null;
    let sampleRate = 0;
    let fill = null;
    let width = 0;
    let height = 0;

    function clear() {
      levels.fill(0);
      previousTime = null;
      if (drawing) drawing.clearRect(0, 0, width, height);
    }

    function render(time) {
      frame = null;
      if (!canvas || welcome.hidden || document.hidden) return;
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth;
        height = nextHeight;
        const scale = Math.min(2, globalThis.devicePixelRatio || 1);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        drawing.setTransform(scale, 0, 0, scale, 0, 0);
        fill = drawing.createLinearGradient(0, 5, 0, height - 5);
        fill.addColorStop(0, "rgba(193, 236, 201, .9)");
        fill.addColorStop(.5, "rgba(151, 210, 174, .65)");
        fill.addColorStop(1, "rgba(118, 169, 137, .25)");
        clear();
      }
      const playing = music.readSpectrum(frequencies);
      if (sampleRate !== music.sampleRate && music.sampleRate > 0) {
        sampleRate = music.sampleRate;
        const maximum = Math.min(14000, sampleRate * .5);
        for (let band = 0; band < levels.length; band++) {
          starts[band] = Math.min(1023, Math.floor(60 * Math.pow(maximum / 60, band / levels.length) * 2048 / sampleRate));
          ends[band] = Math.min(1024, Math.max(starts[band] + 1,
            Math.ceil(60 * Math.pow(maximum / 60, (band + 1) / levels.length) * 2048 / sampleRate)));
        }
      }
      if (!playing) clear();
      else {
        const elapsed = previousTime === null ? 16.67 : Math.min(100, time - previousTime);
        let audible = false;
        for (let band = 0; band < levels.length; band++) {
          let power = 0;
          for (let bin = starts[band]; bin < ends[band]; bin++) power += Math.pow(10, frequencies[bin] / 10);
          const decibels = 10 * Math.log10(power / (ends[band] - starts[band]));
          const target = Math.pow(Math.max(0, Math.min(1, (decibels + 85) / 65)), .85);
          if (target > 0) audible = true;
          const response = 1 - Math.exp(-elapsed / (target > levels[band] ? 40 : 160));
          levels[band] += (target - levels[band]) * response;
        }
        if (!audible) clear();
        else previousTime = time;
      }
      drawing.clearRect(0, 0, width, height);
      if (playing) {
        const step = width / levels.length;
        const barWidth = Math.max(1, step * .64);
        const baseline = height - 5;
        drawing.fillStyle = fill;
        drawing.shadowColor = "rgba(153, 214, 175, .3)";
        drawing.shadowBlur = 3;
        drawing.beginPath();
        for (let band = 0; band < levels.length; band++) {
          const barHeight = levels[band] * (height - 10);
          if (barHeight <= 0) continue;
          const x = band * step + (step - barWidth) * .5;
          drawing.roundRect(x, baseline - barHeight, barWidth, barHeight, Math.min(3, barWidth * .5, barHeight * .5));
        }
        drawing.fill();
        drawing.shadowBlur = 0;
      }
      frame = requestAnimationFrame(render);
    }

    function update() {
      const nextCanvas = welcome.querySelector(".welcome-waveform");
      if (canvas !== nextCanvas) {
        canvas = nextCanvas;
        drawing = canvas?.getContext("2d") || null;
        width = 0;
        height = 0;
      }
      const visible = !!drawing && !welcome.hidden && !document.hidden;
      if (canvas && canvas.hidden === visible) canvas.hidden = !visible;
      music.setActive(visible);
      if (visible && frame === null) frame = requestAnimationFrame(render);
      if (!visible) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        clear();
      }
    }

    const observer = new MutationObserver(update);
    observer.observe(welcome, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true });
    document.addEventListener("visibilitychange", update);
    currentMusic = music;
    currentController = Object.freeze({ dispose() {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      music.setActive(false);
      clear();
      if (currentMusic === music) {
        currentMusic = null;
        currentController = null;
      }
    } });
    update();
    return currentController;
  } });
})();
