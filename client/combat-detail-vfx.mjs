import { unitRangedProjectile } from "./unit-ranged.mjs";

// User-approved V4 artwork. Detailed combat only; never the world-cell renderer.
const root = "DesignAssets/Animations/CombatVfxV4/";
const speciesRoot = root;
export const DETAIL_COMBAT_VFX = Object.freeze({
  hit: { image: root + "hit.png", frames: [0,1,2,3,4,5,6,7], durations: [25,45,45,55,65,65,70,80] },
  bean: { image: root + "bean.png", frames: [1,2,3,4,5,6,7], durations: [45,45,55,65,65,70,80] },
  ...Object.fromEntries(["spore", "pebble", "spring"].map(key => [key,
    { image: speciesRoot + key + ".png", frames: [1,2,3,4,5,6], durations: [25,45,65,90,100,100] }]))
});
export const DETAIL_DEFENSE_VFX = Object.freeze({
  block: "DesignAssets/Animations/CombatDefenseV1/block.png",
  parry: "DesignAssets/Animations/CombatDefenseV1/parry.png"
});
export const DETAIL_COMBAT_VFX_ASSETS = [...Object.values(DETAIL_COMBAT_VFX).map(clip => clip.image), ...Object.values(DETAIL_DEFENSE_VFX)];
export function detailVfxFrame(clip, milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null;
  for (let index = 0; index < clip.frames.length; index++) {
    if (milliseconds < clip.durations[index]) return clip.frames[index];
    milliseconds -= clip.durations[index];
  }
  return null;
}
function projectileClip(agent) {
  const tribe = agent?.tribe || agent?.key;
  // Effect identity comes from the visible source species, not eligibility for
  // its separate ranged-body animation. Mixed and appendage builds still fire.
  return agent && !agent.species && ["bean", "spore", "pebble", "spring"].includes(tribe) ? DETAIL_COMBAT_VFX[tribe] : null;
}
export function createDetailCombatVfx() {
  const impacts = new Map(), vitals = new Map(), deaths = new Map(), anchors = new Map(), flightAnchors = new Map(), defenses = new Map();
  let viewScope;
  function clearView() { anchors.clear(); flightAnchors.clear(); viewScope = undefined; }
  let projectiles = [];
  function consume(frame, time) {
    if (frame.reset) { impacts.clear(); vitals.clear(); deaths.clear(); defenses.clear(); clearView(); }
    for (const cue of frame.started || []) if (cue.channel === "defense" && DETAIL_DEFENSE_VFX[cue.kind]) {
      const damage = (frame.started || []).find(item => item.eventId === cue.eventId && item.channel === "impact" && item.amount > 0);
      defenses.set(cue.eventId, { ...cue, endsAt: cue.at + .45, residualAmount: cue.kind === "block" ? damage?.amount || 0 : 0 });
    }
    for (const [id, cue] of defenses) {
      if (time < cue.at || time >= cue.endsAt) { defenses.delete(id); continue; }
      const current = (frame.active || []).find(item => item.channel === "defense" && item.eventId === id);
      // Endpoint redaction may change during the same event without replaying it.
      if (current) defenses.set(id, { ...cue, sourceId: current.sourceId, targetId: current.targetId });
    }
    for (const cue of frame.started || []) if (cue.channel === "death") deaths.set(String(cue.targetId), cue.at);
    for (const [id, at] of deaths) if (time < at || time - at >= .85) deaths.delete(id);
    // Retain the last authored cells beyond the journal's shorter semantic cue.
    // Event IDs and simulation time prevent duplicate snapshots from restarting art.
    for (const cue of frame.started || []) if (cue.channel === "impact" && cue.amount > 0 &&
      ["hit", "critical", "followup", "area", "reflect"].includes(cue.kind)) impacts.set(cue.id, cue);
    for (const [id, cue] of impacts) if (time < cue.at || time - cue.at >= .5) impacts.delete(id);
    for (const cue of frame.started || []) if (cue.amount > 0 &&
      (cue.channel === "restore" && ["heal", "drain", "regeneration"].includes(cue.kind) ||
        cue.channel === "impact" && cue.kind === "bleed")) vitals.set(cue.id, cue);
    for (const [id, cue] of vitals) if (time < cue.at || time - cue.at >= .85) vitals.delete(id);
    projectiles = frame.projectiles || [];
    const activeFlights = new Set(projectiles.map(shot => shot.id));
    for (const id of flightAnchors.keys()) if (!activeFlights.has(id)) flightAnchors.delete(id);
  }
  function observe(agents, positions, time, view) {
    if (viewScope !== view.scope) { clearView(); viewScope = view.scope; }
    const width = view.width || 1, height = view.height || 1;
    for (const [id, anchor] of anchors) if (time < anchor.at || time - anchor.at >= .85) anchors.delete(id);
    for (const agent of agents) {
      const id = String(agent.id), point = positions.get(id);
      if (point) anchors.set(id, { at: time, point: { ...point }, width, height, clip: projectileClip(agent) });
    }
  }
  function recipientPoint(id, positions, time, view, retainDeath = true) {
    const point = positions.get(String(id));
    if (point) return point;
    const anchor = anchors.get(String(id)), deathAt = deaths.get(String(id));
    // Only an authoritative recent death permits an off-roster damage effect.
    // Restoring HP must never show on a corpse or an omitted living recipient.
    if (!retainDeath || !anchor || deathAt === undefined || time < deathAt || anchor.at > deathAt) return null;
    const width = view.width || 1, height = view.height || 1;
    return { x: anchor.point.x * width / anchor.width, y: anchor.point.y * height / anchor.height,
      width: anchor.point.width * width / anchor.width, height: anchor.point.height * height / anchor.height };
  }
  function commands(agents, positions, time, cell, view = {}) {
    observe(agents, positions, time, view);
    const width = view.width || 1, height = view.height || 1;
    const byId = new Map(agents.map(agent => [String(agent.id), agent])), result = [];
    for (const shot of projectiles) {
      const source = byId.get(String(shot.sourceId)), target = positions.get(String(shot.targetId));
      const from = positions.get(String(shot.sourceId));
      if (!source || !from || !target) continue;
      let launch = flightAnchors.get(shot.id);
      if (!launch) {
        const clip = projectileClip(source);
        if (!clip) continue;
        const sprite = unitRangedProjectile(source), facing = Math.sign(target.x - from.x) || 1;
        // The server supplies timing, not modal coordinates. Keep the first
        // visible outlet, even for a late snapshot; never invent an unseen pose.
        // Later recoil, recovery and other shots must not drag a fired shot.
        launch = { clip, x: from.x / width, y: from.y / height,
          // Only approved ranged bodies have a measured outlet. Other forms
          // use their displayed body centre without inventing a muzzle pose.
          offsetX: sprite ? facing * (sprite.outletX - 256) * sprite.sourceScale / 100 : 0,
          offsetY: sprite ? (sprite.outletY - 448) * sprite.sourceScale / 100 : -from.height * .5 / cell,
          size: Math.max(from.height, from.width) * .85 / cell };
        flightAnchors.set(shot.id, launch);
      }
      const startX = launch.x * width + launch.offsetX * cell;
      const startY = launch.y * height + launch.offsetY * cell;
      const endY = target.y - target.height * .5, angle = Math.atan2(endY - startY, target.x - startX);
      const size = Math.min(444, launch.size * cell);
      // Flight heads lie right of the cell centre. Anchor the head to the true path.
      result.push({ image: launch.clip.image, frame: 0, x: startX + (target.x - startX) * shot.progress - Math.cos(angle) * size * .25,
        y: startY + (endY - startY) * shot.progress - Math.sin(angle) * size * .25, size, angle, kind: "flight", eventId: shot.id, projectileId: shot.projectileId,
        sourceId: shot.sourceId, targetId: shot.targetId, launchedAt: shot.launchedAt, arrivesAt: shot.arrivesAt });
    }
    for (const cue of impacts.values()) {
      const point = recipientPoint(cue.targetId, positions, time, view);
      if (!point) continue;
      const source = byId.get(String(cue.sourceId));
      // Splash and reflection are separate damage at their recorded recipient,
      // not another projectile landing. Reuse the approved general hit only.
      const projectileImpact = cue.mode === "ranged" && ["hit", "critical", "followup"].includes(cue.kind);
      const clip = projectileImpact ? projectileClip(source) || anchors.get(String(cue.sourceId))?.clip || DETAIL_COMBAT_VFX.hit : DETAIL_COMBAT_VFX.hit;
      const frame = detailVfxFrame(clip, (time - cue.at) * 1000);
      if (frame === null) continue;
      result.push({ image: clip.image, frame, x: point.x, y: point.y - point.height * .5,
        size: Math.min(444, Math.max(point.height, point.width) * (clip === DETAIL_COMBAT_VFX.hit ? 1.35 : 1.65) * (cue.kind === "critical" ? 1.15 : 1)),
        angle: 0, kind: "impact", eventId: cue.eventId, sourceId: cue.sourceId, targetId: cue.targetId,
        eventAt: cue.eventAt ?? cue.at, amount: cue.amount });
    }
    return result;
  }
  function vitalCommands(agents, positions, time, view = {}) {
    observe(agents, positions, time, view);
    const byId = new Map(agents.map(agent => [String(agent.id), agent])), lanes = new Map(), latestRegeneration = new Map();
    for (const cue of vitals.values()) if (cue.kind === "regeneration") {
      const id = String(cue.anchorId ?? cue.targetId), previous = latestRegeneration.get(id);
      if (!previous || cue.at >= previous.at) latestRegeneration.set(id, cue);
    }
    return [...vitals.values()].flatMap(cue => {
      const id = String(cue.anchorId ?? cue.targetId), restore = cue.channel === "restore";
      if (restore && (!byId.has(id) || byId.get(id).health <= 0 || deaths.has(id))) return [];
      // Regeneration can arrive every simulation tick. One recovery ring per
      // recipient is enough; do not stack rings or claim rounded "+0.0" heals.
      if (cue.kind === "regeneration" && latestRegeneration.get(id) !== cue) return [];
      const age = time - cue.at, point = recipientPoint(id, positions, time, view, !restore);
      if (!point || age < 0 || age >= .85) return [];
      const lane = lanes.get(id) || 0; lanes.set(id, lane + 1);
      return [{ kind: cue.kind, channel: cue.channel, eventId: cue.eventId, sourceId: cue.sourceId,
        targetId: cue.anchorId ?? cue.targetId, eventAt: cue.eventAt ?? cue.at, amount: cue.amount,
        age, lane, x: point.x, y: point.y - point.height * .5, bodyHeight: point.height }];
    });
  }
  return { consume, commands, vitalCommands, defenseCommands: (positions, time) => detailDefenseCommands({ active: [...defenses.values()] }, positions, time), vitalActive: time => [...vitals.values()].some(cue => time >= cue.at && time - cue.at < .85), clearView };
}

// Reuse the laboratory's existing healing ring/plus and signed HP labels.
// Bleed is damage over time, not a new collision, projectile or attack recoil.
export function drawDetailVitalEffect(context, command, { width, height, reducedMotion = false }) {
  const progress = Math.max(0, Math.min(1, command.age / .85)), restore = command.channel === "restore";
  const scale = Math.max(.65, Math.min(1, width / 1040));
  context.save(); context.globalAlpha = 1 - progress ** 2;
  if (restore) {
    context.strokeStyle = "#c1ffc4"; context.lineWidth = 3 * scale;
    context.beginPath(); context.arc(command.x, command.y, (15 + (reducedMotion ? 0 : progress * 30)) * scale, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.moveTo(command.x - 8 * scale, command.y); context.lineTo(command.x + 8 * scale, command.y);
    context.moveTo(command.x, command.y - 8 * scale); context.lineTo(command.x, command.y + 8 * scale); context.stroke();
  }
  if (command.kind !== "regeneration") {
    const lift = reducedMotion ? 0 : progress * 45;
    const labelY = Math.max(20, Math.min(height - 20, command.y - command.bodyHeight * .5 - 20 - lift - command.lane * 24));
    // Keep fractional positive HP changes readable without inventing zero.
    const amount = command.amount >= .1 ? command.amount.toFixed(1) : Number(command.amount.toPrecision(2)).toString();
    const label = (restore ? "+" : "−") + amount;
    context.textAlign = "center"; context.textBaseline = "middle"; context.lineJoin = "round";
    context.font = '700 ' + Math.max(17, Math.min(30, width / 30)) + 'px "Malgun Gothic", sans-serif';
    context.lineWidth = 4; context.strokeStyle = "#203125"; context.fillStyle = restore ? "#c1ffc4" : "#fff9df";
    context.strokeText(label, command.x, labelY); context.fillText(label, command.x, labelY);
  }
  context.restore();
}
export function drawDetailVfxCell(context, image, command) {
  if (!image?.complete || !image.naturalWidth) return false;
  const cell = image.naturalWidth / 4;
  context.save(); context.translate(command.x, command.y); context.rotate(command.angle);
  context.drawImage(image, command.frame % 4 * cell, Math.floor(command.frame / 4) * cell, cell, cell,
    -command.size / 2, -command.size / 2, command.size, command.size);
  context.restore(); return true;
}

// User-approved defense artwork, timed only by observed authoritative outcomes.
export function detailDefenseCommands(frame, positions, time) {
  const output = [], seen = new Set();
  for (const cue of frame.active || []) {
    const age = time - cue.at;
    if (cue.channel !== 'defense' || !['block', 'parry'].includes(cue.kind) || !Number.isFinite(age) || age < 0 || age >= .45 || time >= cue.endsAt || seen.has(cue.eventId)) continue;
    const target = positions.get(String(cue.targetId)), source = positions.get(String(cue.sourceId));
    if (!target || ![target.x, target.y, target.width, target.height].every(Number.isFinite) || target.height <= 0) continue;
    const directionKnown = !!source && [source.x, source.y].every(Number.isFinite);
    seen.add(cue.eventId);
    const damage = (frame.active || []).find(item => item.eventId === cue.eventId && item.channel === 'impact' && item.amount > 0);
    output.push({ kind: cue.kind, eventId: cue.eventId, projectileId: cue.projectileId, targetId: cue.targetId, sourceId: cue.sourceId,
      image: DETAIL_DEFENSE_VFX[cue.kind], directionKnown, age, at: cue.at, eventAt: cue.eventAt ?? cue.at, x: target.x, y: target.y - target.height * .5, bodyWidth: target.width, bodyHeight: target.height,
      towardSource: directionKnown ? Math.sign(source.x - target.x) || target.direction || 1 : 1, amount: cue.kind === 'block' ? cue.residualAmount ?? damage?.amount ?? 0 : 0 });
  }
  return output;
}
export function detailDefenseImageReady(image, command) {
  return !!(command?.directionKnown && DETAIL_DEFENSE_VFX[command.kind] && image?.complete && image.naturalWidth);
}
export function drawDetailDefenseEffect(context, command, image, { reducedMotion = false } = {}) {
  if (!detailDefenseImageReady(image, command) || command.age < 0 || command.age >= .45) return false;
  const t = command.age / .45;
  const scale = reducedMotion ? 1 : t < .10 ? .66 + t / .10 * .45 : t < .24 ? 1.11 - (t - .10) / .14 * .11 : 1 + (t - .24) * .15;
  const opacity = t < .35 ? 1 : Math.pow(1 - (t - .35) / .65, 1.2);
  const size = Math.min(500, Math.max(32, command.bodyHeight * (command.kind === 'block' ? 2.12 : 2.25))) * scale;
  const contactX = command.x + command.towardSource * command.bodyWidth * .40;
  const originX = command.kind === 'block' ? .36 : .52, originY = command.kind === 'block' ? .50 : .57;
  context.save(); context.translate(contactX, command.y); context.scale(-command.towardSource, 1);
  context.globalAlpha = opacity;
  context.drawImage(image, -size * originX, -size * originY, size, size);
  // Only dissipating light fragments, never a reflected shot or additional hit.
  if (!reducedMotion && t > .16) {
    const spread = (t - .16) * command.bodyHeight * .75, fade = Math.max(0, 1 - t);
    context.globalAlpha = fade * .85; context.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const angle = command.kind === 'block' ? Math.PI * (.60 + i * .13) : Math.PI * (1.03 + i * .065);
      const radius = command.bodyHeight * (.33 + (i % 3) * .12) + spread;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      context.strokeStyle = command.kind === 'block' ? '#e0ffff' : '#fff1b1'; context.lineWidth = Math.max(1, command.bodyHeight * .025 * fade);
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.cos(angle) * command.bodyHeight * .12 * fade, y + Math.sin(angle) * command.bodyHeight * .12 * fade); context.stroke();
    }
  }
  context.restore(); return true;
}

export function drawDetailDefenseFallback(context, command) {
  if (!command.directionKnown || command.age < 0 || command.age >= .45) return false;
  context.save(); context.globalAlpha = 1 - command.age / .45; context.strokeStyle = "#c3f1ff"; context.lineWidth = 3;
  context.beginPath(); context.ellipse(command.x + command.towardSource * command.bodyWidth * .4, command.y,
    Math.max(6, command.bodyWidth * .16), command.bodyHeight * .65, 0, -Math.PI / 2, Math.PI / 2); context.stroke(); context.restore(); return true;
}
export function drawDetailDefenseLabels(context, commands, { width, height, reducedMotion = false, vitals = [], reservedLabels = [] }) {
  const occupied = reservedLabels.map(label => ({ targetId: String(label.targetId), y: label.y }));
  for (const vital of vitals) if (vital.kind !== "regeneration") occupied.push({ targetId: String(vital.targetId), y: Math.max(20, Math.min(height - 20,
    vital.y - vital.bodyHeight * .5 - 20 - (reducedMotion ? 0 : Math.min(1, vital.age / .85) * 45) - vital.lane * 24)) });
  const lanes = new Map();
  for (const command of commands) {
    if (command.age < 0 || command.age >= .45) continue;
    const id = String(command.targetId), lane = lanes.get(id) || 0; lanes.set(id, lane + 1);
    const floor = command.y + command.bodyHeight * .5, lift = reducedMotion ? 0 : command.age * 28;
    let damageY = command.y - command.bodyHeight * .5 - 20 - lift;
    while (occupied.some(label => label.targetId === id && Math.abs(label.y - damageY) < 26)) damageY -= 28;
    damageY = Math.max(20, damageY);
    let labelY = floor + 34 + lane * 26;
    if (labelY > height - 18) labelY = Math.max(20, damageY - 30 - lane * 26);
    context.save(); context.globalAlpha = 1 - (command.age / .45) ** 2;
    context.textAlign = "center"; context.textBaseline = "middle"; context.lineJoin = "round";
    context.font = '700 ' + Math.max(17, Math.min(30, width / 30)) + 'px "Malgun Gothic", sans-serif';
    context.lineWidth = 4; context.strokeStyle = "#203125"; context.fillStyle = command.kind === "block" ? "#d3f1ff" : "#fff1ba";
    const label = command.kind === "block" ? "방어" : "패링";
    context.strokeText(label, command.x, labelY); context.fillText(label, command.x, labelY);
    if (command.kind === "block" && command.amount > 0) {
      const damage = "−" + (command.amount >= .1 ? command.amount.toFixed(1) : Number(command.amount.toPrecision(2)).toString());
      context.fillStyle = "#fff9df"; context.strokeText(damage, command.x, damageY); context.fillText(damage, command.x, damageY);
      occupied.push({ targetId: id, y: damageY });
    }
    occupied.push({ targetId: id, y: labelY }); context.restore();
  }
}
