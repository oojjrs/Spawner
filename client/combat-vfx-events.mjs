// Semantic cues only. New combat artwork remains pending user review.
export const COMBAT_VFX_ART_STATUS = "draft-pending-user-review";
const lifetime = { attack: .25, counter: .25, hit: .4, critical: .5, followup: .4,
  dodge: .4, parry: .45, block: .45, stun: .7, "bleed-apply": .5,
  bleed: .4, area: .5, drain: .55, reflect: .45, heal: .55, regeneration: .55, death: .8, shoot: .18 };

export function normalizeCombatVfxEvent(input, scope = "legacy") {
  const at = input?.at ?? input?.time;
  if (!Number.isFinite(at) || typeof input.kind !== "string") return null;
  const sourceId = input.sourceId ?? input.attackerId ?? null, targetId = input.targetId ?? null;
  const amount = input.amount ?? Math.abs(Number(input.damage) || 0);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const id = input.id ?? (input.index === undefined ? scope + ":" + JSON.stringify([
    input.kind, at, sourceId, targetId, input.hitIndex ?? 0, input.projectileId ?? null, amount
  ]) : scope + ":" + input.index);
  return { ...input, ...(input.from ? { from: { ...input.from } } : {}),
    ...(input.to ? { to: { ...input.to } } : {}), id: String(id), at, sourceId, targetId, amount,
    kind: input.kind === "miss" || input.kind === "evasion" ? "dodge" : input.kind === "ranged" ? "hit" : input.kind };
}

export function combatVfxCues(input, scope) {
  const event = normalizeCombatVfxEvent(input, scope);
  if (!event) return [];
  const cues = [], tags = [event.critical ? "critical" : null, event.hitIndex > 0 ? "followup" : null,
    event.counter ? "counter" : null, event.mode === "ranged" ? "ranged" : null].filter(Boolean);
  function add(kind, channel, anchorId, amount = 0, extra = {}) {
    const endsAt = ["attack", "counter", "stun", "bleed-apply"].includes(kind) &&
      Number.isFinite(event.endsAt) ? event.endsAt : event.at + (lifetime[kind] || .4);
    cues.push({ ...event, id: event.id + ":" + channel, eventId: event.id, kind, channel, anchorId,
      amount, endsAt, tags, artStatus: COMBAT_VFX_ART_STATUS, ...extra });
  }
  function impact() {
    if (event.amount > 0) add(event.critical || event.kind === "critical" ? "critical" : event.hitIndex > 0 ? "followup" : "hit",
      "impact", event.targetId, event.amount);
  }
  switch (event.kind) {
    case "hit": case "critical": impact(); break;
    case "block": add("block", "defense", event.targetId); impact(); break;
    case "dodge": case "parry": add(event.kind, "defense", event.targetId); break;
    case "attack": case "counter": add(event.kind, "prepare", event.sourceId); break;
    case "shoot": add("shoot", "launch", event.sourceId); break;
    case "stun": case "bleed-apply": add(event.kind, "status", event.targetId); break;
    case "bleed": case "area": case "reflect":
      if (event.amount > 0) add(event.kind, "impact", event.toId ?? event.targetId, event.amount,
        { phase: "arrival" });
      break;
    case "heal": case "drain": case "regeneration":
      if (event.amount > 0) add(event.kind, "restore", event.toId ?? event.targetId, event.amount,
        { phase: "arrival" });
      break;
    case "death": add("death", "death", event.targetId); break;
    // Cancellation is a transport fact, never an invented impact.
    case "projectile-cancel": break;
  }
  return cues;
}

function eventOrder(a, b) {
  return a.at - b.at || (a.sequence || 0) - (b.sequence || 0) || a.id.localeCompare(b.id);
}

export function combatVfxAt(inputs, time, scope) {
  if (!Number.isFinite(time)) throw new TypeError("VFX time must be finite simulation seconds");
  const events = [...new Map(inputs.map(input => normalizeCombatVfxEvent(input, scope)).filter(Boolean)
    .map(event => [event.id, event])).values()].sort(eventOrder);
  const active = events.flatMap(event => combatVfxCues(event)).filter(cue => time >= cue.at && time < cue.endsAt)
    .map(cue => ({ ...cue, age: time - cue.at }));
  const closures = new Map();
  for (const event of events) if (event.projectileId &&
    ["hit", "critical", "dodge", "parry", "block", "projectile-cancel"].includes(event.kind))
    closures.set(event.projectileId, Math.min(closures.get(event.projectileId) ?? Infinity, event.at));
  const projectiles = events.filter(event => event.kind === "shoot" && event.projectileId &&
    Number.isFinite(event.arrivesAt) && event.arrivesAt > event.at).flatMap(event => {
      const closed = Math.min(event.arrivesAt, closures.get(event.projectileId) ?? Infinity);
      if (time < event.at || time >= closed) return [];
      return [{ ...event, launchedAt: event.at, endsAt: closed, age: time - event.at,
        progress: Math.max(0, Math.min(1, (time - event.at) / (event.arrivesAt - event.at))) }];
    });
  return { active, projectiles };
}

export function createCombatVfxCursor({ maxLateness = .35, maxEvents = 512 } = {}) {
  if (!Number.isFinite(maxLateness) || maxLateness < 0 || !Number.isInteger(maxEvents) || maxEvents < 1)
    throw new RangeError("Invalid VFX cursor bounds");
  let streamId = null, previousTime = null, latestSequence = 0;
  const events = new Map(), seen = new Map(), eligible = new Set();
  function clear() { events.clear(); seen.clear(); eligible.clear(); latestSequence = 0; }
  function consume(snapshot, time) {
    if (!Number.isFinite(time)) throw new TypeError("VFX time must be finite simulation seconds");
    const nextStream = snapshot?.streamId ?? streamId;
    const reset = previousTime === null || nextStream !== streamId || time < previousTime;
    const gap = !reset && latestSequence > 0 &&
      ((snapshot?.oldestSequence ?? 0) > latestSequence + 1 ||
        (snapshot?.droppedThroughSequence ?? 0) > latestSequence);
    if (reset) { clear(); streamId = nextStream; }
    for (const input of snapshot?.events || []) {
      const event = normalizeCombatVfxEvent(input, streamId || "snapshot");
      // The same journal ID can gain or lose endpoint visibility in later
      // snapshots. Refresh its current fields, including redactions, without
      // clearing the separate seen/eligible markers or replaying its cues.
      if (event) events.set(event.id, event);
    }
    // Retain by incident time, not Map insertion order: replayed packets can
    // reinsert an evicted older ID after a newer one, otherwise evicting its
    // seen marker and repeatedly restarting the same recent impacts.
    const ordered = [...events.values()].sort(eventOrder);
    for (const event of ordered.slice(0, Math.max(0, ordered.length - maxEvents))) {
      events.delete(event.id); seen.delete(event.id); eligible.delete(event.id);
    }
    const started = [];
    for (const event of ordered.slice(-maxEvents)) {
      if (event.at > time || seen.has(event.id)) continue;
      seen.set(event.id, event.at);
      // A first snapshot/backseek reconstructs state, without replaying old bursts.
      if (!reset && time - event.at <= maxLateness) {
        eligible.add(event.id);
        started.push(...combatVfxCues(event).map(cue => ({ ...cue, age: Math.max(0, time - cue.at) })));
      }
    }
    const state = combatVfxAt([...events.values()], time);
    const active = state.active.filter(cue => cue.channel === "status" || eligible.has(cue.eventId));
    previousTime = time;
    latestSequence = Math.max(latestSequence, snapshot?.latestSequence || 0);
    // Inputs can be replayed in snapshots; expired IDs are still too old to burst.
    for (const [id, event] of events) if (time - Math.max(event.at, event.endsAt || 0, event.arrivesAt || 0) > 8) {
      events.delete(id); seen.delete(id); eligible.delete(id);
    }
    while (events.size > maxEvents) {
      const id = events.keys().next().value;
      events.delete(id); seen.delete(id); eligible.delete(id);
    }
    return { started, active, projectiles: state.projectiles, reset, gap, streamId };
  }
  return { consume, reset() { clear(); streamId = null; previousTime = null; } };
}
