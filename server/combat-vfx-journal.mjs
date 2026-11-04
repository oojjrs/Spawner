// Presentation evidence only. WeakMap storage never enters an agent or a save.
export const COMBAT_VFX_JOURNAL_LIMIT = 256;
export const COMBAT_VFX_JOURNAL_SECONDS = 4;
const journals = new WeakMap();
let streams = 0;

function journal(environment) {
  let value = journals.get(environment);
  if (!value) {
    const instance = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + ":" + ++streams;
    value = { streamId: "combat-vfx:" + instance, sequence: 0, token: 0,
      newestAt: -Infinity, droppedThroughSequence: 0, events: [] };
    journals.set(environment, value);
  }
  return value;
}

export function combatVfxToken(environment, kind = "action") {
  const value = journal(environment);
  return value.streamId + ":" + kind + ":" + ++value.token;
}

export function recordCombatVfx(environment, detail) {
  if (!Number.isFinite(detail.at) || !Number.isFinite(detail.amount) || detail.amount < 0) return null;
  const value = journal(environment), sequence = ++value.sequence;
  const event = Object.freeze({ ...detail,
    ...(detail.from ? { from: Object.freeze({ ...detail.from }) } : {}),
    ...(detail.to ? { to: Object.freeze({ ...detail.to }) } : {}),
    id: value.streamId + ":" + sequence, sequence, streamId: value.streamId });
  value.newestAt = Math.max(value.newestAt, event.at);
  value.events.push(event);
  const retained = value.events.filter(item => item.at >= value.newestAt - COMBAT_VFX_JOURNAL_SECONDS ||
    item.endsAt > value.newestAt || item.arrivesAt > value.newestAt)
    .slice(-COMBAT_VFX_JOURNAL_LIMIT);
  const kept = new Set(retained.map(item => item.sequence));
  for (const item of value.events) if (!kept.has(item.sequence))
    value.droppedThroughSequence = Math.max(value.droppedThroughSequence, item.sequence);
  value.events = retained;
  // An optional observer must not be able to change combat resolution.
  try { environment.onCombatEvent?.(event); } catch { /* presentation observers are isolated */ }
  return event;
}

export function snapshotCombatVfx(environment, time, visibility) {
  const value = journal(environment);
  const visible = (id, point) => !visibility || visibility.agentIds.has(id) ||
    !!point && !!visibility.isVisible?.(point.x, point.y);
  const retained = value.events.filter(event => event.at <= time + 1e-8 &&
    (event.at >= time - COMBAT_VFX_JOURNAL_SECONDS || event.endsAt > time || event.arrivesAt > time));
  const kept = new Set(retained.map(event => event.sequence));
  const droppedThroughSequence = value.events.filter(event => event.at <= time && !kept.has(event.sequence))
    .reduce((last, event) => Math.max(last, event.sequence), value.droppedThroughSequence);
  const events = retained.flatMap(event => {
      const fromVisible = visible(event.fromId ?? event.sourceId, event.from);
      const toVisible = visible(event.toId ?? event.targetId, event.to);
      if (!fromVisible && !toVisible) return [];
      // Keep a known impact, but do not expose the off-screen origin/destination.
      const copy = { ...event };
      if (!fromVisible) { delete copy.from; delete copy.fromId; copy.sourceId = null; }
      if (!toVisible) { delete copy.to; delete copy.toId; copy.targetId = null; }
      return [copy];
    });
  return { version: 1, streamId: value.streamId, latestSequence: value.sequence,
    oldestSequence: retained[0]?.sequence ?? value.sequence + 1, droppedThroughSequence,
    events: events.map(event => ({ ...event, ...(event.from ? { from: { ...event.from } } : {}),
      ...(event.to ? { to: { ...event.to } } : {}) })) };
}
