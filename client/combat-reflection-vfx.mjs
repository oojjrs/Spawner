// Reflection is a return of damage, never a defensive shield on its recipient.
// These marks only explain an observed journal event; they cannot change HP,
// create a projectile, or infer a hidden reflector's position.
export function reflectionReturnCommand(cue, target, time, source, { reducedMotion = false } = {}) {
  const age = time - cue.at;
  const valid = point => point && [point.x, point.y, point.height].every(Number.isFinite) && point.height > 0;
  if (cue.kind !== "reflect" || !(cue.amount > 0) || !Number.isFinite(cue.amount) || !Number.isFinite(age) || age < 0 || time >= cue.at + .45 || !valid(target)) return null;
  const origin = cue.sourceId != null && String(cue.sourceId) !== String(cue.targetId) && valid(source) ?
    { x: source.x, y: source.y - source.height * .5, height: source.height, width: source.width || source.height * .6 } : null;
  return { renderer: "reflection-return", image: null, kind: "impact", effectKind: "reflect",
    x: target.x, y: target.y - target.height * .5, size: Math.max(12, Math.min(90, target.height * .42)),
    bodyWidth: target.width || target.height * .6, origin, age, reducedMotion,
    eventId: cue.eventId, sourceId: cue.sourceId, targetId: cue.targetId,
    eventAt: cue.eventAt ?? cue.at, amount: cue.amount, critical: false };
}

export function reflectionReturnPath(command) {
  if (!command.origin) return null;
  const from = command.origin, dx = command.x - from.x, dy = command.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 4) return null;
  const ux = dx / distance, uy = dy / distance;
  const startInset = Math.min(distance * .2, from.width * .4);
  const endInset = Math.min(distance * .15, command.bodyWidth * .25);
  const start = { x: from.x + ux * startInset, y: from.y + uy * startInset };
  const end = { x: command.x - ux * endInset, y: command.y - uy * endInset };
  const lift = Math.min(36, distance * .16);
  const control = { x: (start.x + end.x) * .5, y: (start.y + end.y) * .5 - lift };
  const progress = command.reducedMotion ? 1 : Math.min(1, Math.max(0, command.age / .18));
  const sample = t => ({ x: (1-t)**2*start.x + 2*(1-t)*t*control.x + t*t*end.x,
    y: (1-t)**2*start.y + 2*(1-t)*t*control.y + t*t*end.y });
  const head = sample(progress);
  const angle = Math.atan2((1-progress)*(control.y-start.y)+progress*(end.y-control.y),
    (1-progress)*(control.x-start.x)+progress*(end.x-control.x));
  return { start, end, control, progress, head, angle, sample };
}

export function drawReflectionReturn(context, command) {
  if (command.renderer !== "reflection-return" || !(command.amount > 0) || !Number.isFinite(command.age) || command.age < 0 || command.age >= .45) return false;
  const progress = command.age / .45, path = reflectionReturnPath(command);
  const weight = Math.max(1.5, Math.min(3.5, command.size * .06));
  context.save();
  context.lineCap = "round"; context.lineJoin = "round";
  context.strokeStyle = "#e3baff"; context.fillStyle = "#f5dcff";
  if (path) {
    // Keep the causal route visible while the brighter arrow travels back.
    context.globalAlpha = (1 - progress) * .4;
    context.lineWidth = weight;
    context.beginPath(); context.moveTo(path.start.x, path.start.y);
    context.quadraticCurveTo(path.control.x, path.control.y, path.end.x, path.end.y); context.stroke();
    context.globalAlpha = (1 - progress) ** .55;
    context.lineWidth = weight * 1.4;
    const tail = command.reducedMotion ? 0 : Math.max(0, path.progress - .38);
    context.beginPath();
    const start = path.sample(tail); context.moveTo(start.x, start.y);
    for (let step = 1; step <= 8; step++) {
      const point = path.sample(tail + (path.progress - tail) * step / 8);
      context.lineTo(point.x, point.y);
    }
    context.stroke();
    const arrow = Math.max(5, Math.min(11, command.size * .22));
    context.beginPath(); context.moveTo(path.head.x, path.head.y);
    context.lineTo(path.head.x - Math.cos(path.angle - .55) * arrow, path.head.y - Math.sin(path.angle - .55) * arrow);
    context.lineTo(path.head.x - Math.cos(path.angle + .55) * arrow, path.head.y - Math.sin(path.angle + .55) * arrow);
    context.closePath(); context.fill();
    // A small outward flare identifies the reflecting body, not a second hit.
    context.globalAlpha = command.reducedMotion ? .65 : Math.max(0, 1 - command.age / .22);
    context.lineWidth = weight;
    const radius = Math.max(5, Math.min(20, command.origin.height * .15));
    const angle = Math.atan2(path.end.y-path.start.y, path.end.x-path.start.x);
    context.beginPath(); context.arc(path.start.x, path.start.y, radius, angle - 1.1, angle + 1.1); context.stroke();
  }
  // The original attacker receives a compact, distinct damage burst. No shield
  // artwork is reused, including when an endpoint or image asset is unavailable.
  context.globalAlpha = (1 - progress) ** .7;
  context.lineWidth = weight;
  const radius = command.size * (command.reducedMotion ? .42 : .28 + progress * .25);
  context.beginPath();
  for (let ray = 0; ray < 6; ray++) {
    const angle = ray * Math.PI / 3 + Math.PI / 6;
    context.moveTo(command.x + Math.cos(angle) * radius * .45, command.y + Math.sin(angle) * radius * .45);
    context.lineTo(command.x + Math.cos(angle) * radius, command.y + Math.sin(angle) * radius);
  }
  context.stroke(); context.restore();
  return true;
}
