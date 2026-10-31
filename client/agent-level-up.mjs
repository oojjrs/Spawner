export const AGENT_LEVEL_UP = Object.freeze({
  ring: "DesignAssets/Effects/LevelUp/ring.png",
  sparkle: "DesignAssets/Effects/LevelUp/sparkle.png",
  duration: 1.15
});

export function createAgentLevelUpPlayback() {
  return { levels: new Map(), effects: new Map() };
}

export function syncAgentLevelUpPlayback(playback, agents, time, firstSnapshot) {
  if (firstSnapshot) {
    playback.levels.clear();
    playback.effects.clear();
  }
  const active = new Set();
  for (const agent of agents) {
    if (agent.species || !Number.isInteger(agent.level) || agent.level < 1) continue;
    active.add(agent.id);
    const previous = playback.levels.get(agent.id);
    playback.levels.set(agent.id, agent.level);
    if (firstSnapshot || previous === undefined || agent.level < previous || !(agent.health > 0)) {
      playback.effects.delete(agent.id);
      continue;
    }
    if (agent.level > previous && !(agent.birth && time < agent.birth.readyAt)) {
      playback.effects.set(agent.id, { level: agent.level, startedAt: time });
    }
  }
  for (const id of playback.levels.keys()) if (!active.has(id)) playback.levels.delete(id);
  for (const [id, effect] of playback.effects) {
    if (!active.has(id) || time < effect.startedAt || time - effect.startedAt >= AGENT_LEVEL_UP.duration) {
      playback.effects.delete(id);
    }
  }
}

export function agentLevelUpPose(playback, agent, time, reducedMotion) {
  const effect = playback.effects.get(agent.id);
  if (!effect || !(agent.health > 0) || agent.birth && time < agent.birth.readyAt) return null;
  const elapsed = time - effect.startedAt;
  if (elapsed < 0 || elapsed >= AGENT_LEVEL_UP.duration) return null;
  const progress = elapsed / AGENT_LEVEL_UP.duration;
  return { level: effect.level, progress, reducedMotion,
    opacity: Math.min(1, elapsed / .08) * Math.min(1, (1 - progress) / .35) };
}

export function drawAgentLevelUp(context, sprites, pose, anchor, cell, foreground) {
  if (!pose || cell < 8) return;
  const sprite = foreground ? sprites.sparkle : sprites.ring;
  if (!sprite?.complete || !sprite.naturalWidth) return;
  const progress = pose.progress;
  const rise = pose.reducedMotion ? .35 : 1 - (1 - progress) ** 2;
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.globalAlpha *= pose.opacity;
  if (!foreground) {
    const width = cell * (pose.reducedMotion ? 1.3 : .65 + rise * 1.1);
    const height = width * sprite.naturalHeight / sprite.naturalWidth;
    context.globalAlpha *= .8;
    context.drawImage(sprite, anchor.x - width / 2, anchor.y - height / 2, width, height);
  } else {
    for (const [index, x] of [-.44, .42, -.23, .25, 0].entries()) {
      const delay = pose.reducedMotion ? 0 : index * .065;
      const phase = (progress - delay) / (1 - delay);
      if (phase <= 0 || phase >= 1) continue;
      const lift = pose.reducedMotion ? .45 + index * .1 : phase * 1.25;
      const size = cell * (.09 + .08 * Math.sin(phase * Math.PI));
      context.save();
      context.globalAlpha *= Math.sin(phase * Math.PI);
      context.drawImage(sprite, anchor.x + x * cell - size / 2,
        anchor.y - cell * (.15 + lift) - size / 2, size, size);
      context.restore();
    }
    if (cell >= 24) {
      const y = anchor.y - cell * (.72 + (pose.reducedMotion ? 0 : rise * .16));
      context.font = "700 " + Math.max(10, Math.round(cell * .16)) + "px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.lineJoin = "round";
      context.lineWidth = Math.max(2, cell * .025);
      context.strokeStyle = "#443017";
      context.fillStyle = "#fff0a6";
      const text = "Lv." + pose.level + " ↑";
      context.strokeText(text, anchor.x, y);
      context.fillText(text, anchor.x, y);
    }
  }
  context.restore();
}
