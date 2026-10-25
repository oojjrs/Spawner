import { AGENT_DEATH_WARNING } from "../server/lifespan.mjs";

export const AGENT_SPIRIT = Object.freeze({
  image: "DesignAssets/Effects/Lifespan/spirit-flame.png",
  height: .25,
  opacity: .95,
  anchors: Object.freeze({ bean: .43, spore: .52, pebble: .5, spring: .35 })
});

export function agentSpiritPose(agent, time) {
  const remaining = agent.bornAt + agent.lifespan - time;
  if (agent.faction !== "colony" || !(agent.health > 0) ||
    !(remaining > 0 && remaining <= AGENT_DEATH_WARNING) || agent.birth && time < agent.birth.readyAt) return null;
  return { opacity: AGENT_SPIRIT.opacity };
}

export function drawAgentSpirit(context, sprite, pose, anchor, cell) {
  if (!pose || cell < 8 || !sprite.complete || !sprite.naturalWidth) return;
  const height = cell * AGENT_SPIRIT.height;
  const width = height * sprite.naturalWidth / sprite.naturalHeight;
  context.save();
  context.globalAlpha *= pose.opacity;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(sprite, anchor.x - width / 2, anchor.y - height, width, height);
  context.restore();
}
