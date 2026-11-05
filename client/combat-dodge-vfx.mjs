// User-approved shared dodge: redraw the current body, never species-specific art.
// Only eligible observed dodge cues drive this presentation. No future-outcome
// filtering, projectile generation, damage, simulation movement, or RNG here.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ease = x => 1 - (1 - clamp(x, 0, 1)) ** 3;

export function combatDodgePose(frame, positions, targetId, time, reducedMotion = false) {
  const cues = (frame.active || []).filter(e => e.kind === 'dodge' && e.channel === 'defense' &&
    String(e.targetId) === String(targetId) && time >= e.at && time < Math.min(e.endsAt, e.at + .4));
  const cue = cues.sort((a,b) => b.at - a.at)[0];
  if (!cue) return null;
  const p = positions.get(String(cue.targetId)), source = positions.get(String(cue.sourceId));
  if (!p || !source || ![p.x,p.y,p.width,p.height,source.x,source.y].every(Number.isFinite) || p.width <= 0 || p.height <= 0) return null;
  const age = time - cue.at, t = age / .4;
  const away = Math.sign(p.x - source.x) || 1;
  const distance = clamp(p.height * .40, 20, 54);
  const displacement = t < .23 ? ease(t / .23) : t < .5 ? 1 : 1 - ease((t - .5) / .5);
  return { eventId: cue.eventId, targetId, age, t, x:p.x, y:p.y, width:p.width, height:p.height,
    away, dx: reducedMotion ? 0 : away * distance * displacement,
    dy: reducedMotion ? 0 : -distance * .65 * displacement,
    maxX: away * distance, maxY: -distance * .65, alpha: (1-t) ** .55,
    reducedMotion, ghosts: reducedMotion ? [] : [.08,.35,.66] };
}

export function drawCombatDodgeTrails(ctx, p) {
  if (!p) return;
  const scale = clamp(p.height/108,.6,1.5);
  ctx.save(); ctx.translate(p.x, p.y-p.height*.48); ctx.scale(p.away,1);
  ctx.lineCap='round'; ctx.lineJoin='round';
  // Open, parallel slipstreams. No star, ring, hit flash, projectile or sparks.
  const progress = p.reducedMotion ? 1 : ease(p.t/.24);
  for (const [row,weight,len] of [[-.37,6,1],[-.08,11,1.18],[.28,6,.86]]) {
    ctx.globalAlpha=p.alpha*.92;
    for (const [color,width] of [['#163c47',weight+6],['#63e9f0',weight],['#e0ffff',Math.max(1.8,weight*.3)]]) {
      ctx.strokeStyle=color; ctx.lineWidth=width*scale;
      ctx.beginPath();
      ctx.moveTo(-p.width*.59, p.height*row);
      ctx.bezierCurveTo(-p.width*.24, p.height*(row+.04), Math.abs(p.maxX)*.6*progress,
        p.height*row+p.maxY*.76*progress, Math.abs(p.maxX)*len*progress, p.height*row+p.maxY*progress);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawCombatDodgeGhosts(ctx, p, drawBody) {
  if (!p || p.reducedMotion || p.t>.72) return;
  for (const [i, fraction] of p.ghosts.entries()) {
    ctx.save(); ctx.globalAlpha=p.alpha*(.12+i*.06);
    ctx.shadowColor='#a4ffff'; ctx.shadowBlur=7;
    drawBody(p.dx*fraction,p.dy*fraction);
    ctx.restore();
  }
}

export function drawCombatDodgeLabel(ctx, p, point, { width, height, vitals = [] } = {}) {
  if (!p || !point) return;
  const labels = vitals.filter(c => c.kind !== "regeneration" && String(c.targetId) === String(p.targetId));
  const top = Math.min(point.y - point.height - 20, ...labels.map(c =>
    Math.max(20, Math.min(height - 20, c.y - c.bodyHeight * .5 - 20 -
      (p.reducedMotion ? 0 : Math.min(1, c.age / .85) * 45) - c.lane * 24)) - 32));
  const y = top < 20 ? Math.min(height - 20, point.y + 36) : top;
  ctx.save(); ctx.globalAlpha = p.alpha; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  ctx.font = '700 ' + Math.max(17, Math.min(30, width / 30)) + 'px "Malgun Gothic", sans-serif';
  ctx.lineWidth = 4; ctx.strokeStyle = "#203125"; ctx.fillStyle = "#d3f1ff";
  ctx.strokeText("회피", point.x, y); ctx.fillText("회피", point.x, y); ctx.restore();
}
