const POST_SECONDS = 0.6;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function createHarvestPlayback() {
  return { effects: new Map(), seen: new Map() };
}

export function syncHarvestPlayback(playback, agents, simSeconds, firstSnapshot) {
  if (firstSnapshot) {
    playback.effects.clear();
    playback.seen.clear();
  }
  for (const agent of agents) {
    const result = agent.harvestResult;
    if (!result || !Number.isInteger(result.sequence) || result.sequence < 0) continue;
    const previousSequence = playback.seen.get(agent.id);
    if (previousSequence !== undefined && result.sequence <= previousSequence) continue;
    playback.seen.set(agent.id, result.sequence);
    if (firstSnapshot || !Number.isFinite(result.completedAt) || result.amount <= 0 ||
      simSeconds < result.completedAt || simSeconds - result.completedAt + 1e-9 >= POST_SECONDS) continue;
    const key = result.x + "," + result.y;
    const previous = playback.effects.get(key);
    if (previous && (previous.completedAt > result.completedAt || previous.completedAt === result.completedAt &&
      previous.remaining < result.remaining)) continue;
    playback.effects.set(key, { ...result });
  }
}

export function harvestPlaybackPose(playback, cell, agents, now, definition) {
  const lastFrame = Number.isInteger(definition.frameCount) ? Math.max(1, definition.frameCount - 1) : 20;
  const contactFrame = clamp(Math.floor(definition.contactFrame), 1, lastFrame);
  const settleFrame = clamp(Math.floor(definition.settleFrame), contactFrame, lastFrame);
  const postSeconds = definition.postSeconds > 0 ? definition.postSeconds : POST_SECONDS;
  const harvestSeconds = definition.harvestSeconds > 0 ? definition.harvestSeconds : 1.5;
  const resourceType = cell.resourceType || (cell.kind === "corpse" ? "meat" : definition.key || "honey-mushrooms");
  const key = cell.x + "," + cell.y;
  let effect = playback.effects.get(key);
  if (effect?.resourceType !== resourceType || Number.isFinite(cell.amount) && cell.amount > effect.remaining) effect = null;
  const remaining = Math.max(0, Number.isFinite(cell.amount) ? cell.amount : effect?.remaining || 0);
  const idle = { frame: effect ? settleFrame : 0, progress: effect ? 1 : 0, phase: "idle",
    opacity: remaining > 0 ? 1 : 0, remaining, visible: remaining > 0 };
  if (effect) {
    const age = now - effect.completedAt;
    if (age >= 0 && age + 1e-9 < postSeconds) {
      const progress = clamp(age / postSeconds, 0, 1);
      const durations = definition.postFrameDurationsMs;
      let frame = contactFrame + Math.floor((settleFrame - contactFrame) * progress + 1e-9);
      if (Array.isArray(durations) && durations.length === settleFrame - contactFrame) {
        let elapsedMs = age * 1000;
        frame = contactFrame;
        for (const duration of durations) {
          if (elapsedMs + 1e-6 < duration) break;
          elapsedMs -= duration;
          frame++;
        }
      }
      return { frame, progress, phase: "collected",
        opacity: remaining > 0 ? 1 : 1 - progress, remaining, visible: true };
    }
  }
  if (remaining <= 0) return idle;
  let active = null;
  let nextHarvest = Infinity;
  for (const agent of agents) {
    if (agent.mode !== "harvest" || agent.x !== cell.x || agent.y !== cell.y || agent.health <= 0 ||
      !Number.isFinite(agent.harvestReady) ||
      (agent.harvestResourceType || agent.carryingType || resourceType) !== resourceType) continue;
    const next = agent.harvestReady + (agent.harvestPrepared ? 0 : harvestSeconds);
    if (next < nextHarvest) {
      active = agent;
      nextHarvest = next;
    }
  }
  if (!active) return idle;
  if (!active.harvestPrepared && now < active.harvestReady) {
    return { frame: 0, progress: 0, phase: "prepare", opacity: 1, remaining, visible: true };
  }
  const progress = clamp((now - (nextHarvest - harvestSeconds)) / harvestSeconds, 0, 1);
  const preFrames = Number.isInteger(definition.preFrameCount) ? clamp(definition.preFrameCount, 1, contactFrame) : contactFrame - 1;
  return { frame: Math.min(contactFrame - 1, Math.floor(preFrames * progress)), progress, phase: "harvest", opacity: 1, remaining, visible: true };
}
