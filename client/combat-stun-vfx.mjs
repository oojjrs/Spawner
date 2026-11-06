import { COMBAT_EFFECT_ANIMATIONS, combatEffectFrame, drawCombatEffect } from "./combat-effect-assets.mjs";

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export function combatStunPose(agent, point, time, { width, height, reducedMotion = false } = {}) {
  if (!agent || !(agent.health > 0) || agent.birth || agent.kind === "corpse" ||
      !Number.isFinite(time) || !Number.isFinite(agent.combat?.stunnedUntil) || agent.combat.stunnedUntil <= time ||
      !point || ![point.x, point.y, point.width, point.height, width, height].every(Number.isFinite) ||
      point.width <= 0 || point.height <= 0 || width < 32 || height < 32) return null;
  const scale = clamp(point.height / 108, .65, 1.5);
  const radiusX = Math.min(clamp(point.width * .28, 15, 44), width / 2 - 4 * scale);
  const radiusY = 6 * scale, dotSize = 4 * scale, margin = dotSize / 2 + 1;
  const x = clamp(point.x, radiusX + margin, width - radiusX - margin);
  // Nominal body bounds can miss a small antenna/stone crown. Keep a
  // conservative clearance verified against current dominant-form pixels.
  const y = clamp(point.y - point.height - 20 * scale, radiusY + margin, height - radiusY - margin);
  // Simulation time keeps pausing/reconnecting deterministic. Reduced motion
  // freezes the existing orbit but still shows the persistent stun status.
  const angle = reducedMotion ? 0 : (time % (Math.PI * 2 / 3)) * 3;
  const dots = Array.from({ length: 3 }, (_, index) => {
    const phase = angle + index * Math.PI * 2 / 3;
    return { x: x + Math.cos(phase) * radiusX, y: y + Math.sin(phase) * radiusY };
  });
  return { targetId: agent.id, until: agent.combat.stunnedUntil, x, y, radiusX, radiusY, dotSize, lineWidth: 2 * scale, dots };
}

export function drawCombatStun(context, agent, point, time, options) {
  const pose = combatStunPose(agent, point, time, options);
  if (!pose) return false;
  context.save();
  try {
    const animation = COMBAT_EFFECT_ANIMATIONS.stun;
    const frame = combatEffectFrame(animation, time * 1000, options.reducedMotion);
    const width = Math.min(animation.frameWidth, pose.radiusX * 3, options.width - 2);
    const height = Math.min(width * animation.frameHeight / animation.frameWidth, options.height - 2);
    const x = clamp(pose.x, width / 2 + 1, options.width - width / 2 - 1);
    const y = clamp(pose.y - height * .1, height / 2 + 1, options.height - height / 2 - 1);
    if (drawCombatEffect(context, options.image?.(animation.image), animation, frame, x, y, width, height)) return true;
    context.strokeStyle = "#f6d983"; context.lineWidth = pose.lineWidth;
    context.beginPath(); context.ellipse(pose.x, pose.y, pose.radiusX, pose.radiusY, 0, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "#ffe9a7";
    for (const dot of pose.dots) context.fillRect(dot.x - pose.dotSize / 2, dot.y - pose.dotSize / 2, pose.dotSize, pose.dotSize);
  } finally { context.restore(); }
  return true;
}
