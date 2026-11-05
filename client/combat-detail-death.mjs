import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { unitRangedAppearance } from "./unit-ranged.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";
import { imageFrameGeometry } from "./image-geometry.mjs";

// These two V12 slump sequences were explicitly approved together. Do not open
// every creature route: the registry also contains unfinished/rejected studies.
export const DETAIL_DEATH_CREATURES = Object.freeze(["vine-turtle", "walking-forest"]);

// Existing complete base/secretion and the two approved creature death routes.
// Other families keep their behavior; no readiness/hidden-anatomy workaround.
export function detailDeathForm(unit) {
  if (!unit) return null;
  if (unit.species) return DETAIL_DEATH_CREATURES.includes(unit.species) ? "creature/" + unit.species : null;
  if (!["bean", "spore", "pebble", "spring"].includes(unit.tribe)) return null;
  const attributes = unitDisplayAttributes(unit);
  if ([...UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, "blade", "carapace", "antenna", "feet"].some(key => attributes[key] > 0)) return null;
  return unit.tribe + "/" + (unitRangedAppearance(unit) ? "secretion" : "base");
}

// Match the existing world corpse support geometry using the already prepared
// death entry. The caller draws its existing ground-shadow surface, not new art.
export function detailCreatureDeathShadow(command, entry, reducedMotion = false) {
  if (!DETAIL_DEATH_CREATURES.includes(command?.corpse?.species) || !entry?.animation ||
    ![entry.scale, command.scale, command.cell, command.age].every(Number.isFinite) ||
    entry.scale <= 0 || command.scale <= 0 || command.cell <= 0 || command.age < 0) return null;
  const animation = entry.animation;
  const frame = reducedMotion ? animation.frameCount - 1 : unitAnimationFrame(animation, command.age * 1000);
  const geometry = imageFrameGeometry(animation, frame);
  if (!(geometry.groundRadiusX > 0 && geometry.groundRadiusY > 0)) return null;
  const reference = 1.4 * entry.scale / (animation.registrationScale || 1) * command.cell * command.scale;
  const lifetime = command.corpse.decaysAt - command.corpse.diedAt;
  const decay = Number.isFinite(lifetime) && lifetime > 0 ? Math.min(1, command.age / lifetime) : 0;
  return { radiusX: geometry.groundRadiusX * reference, radiusY: geometry.groundRadiusY * reference,
    opacity: .3 * (1 - decay * .4), frame };
}

export function createDetailCombatDeath() {
  const anchors = new Map(), living = new Set();
  let scope, previousSnapshotTime, current;
  function clear() { anchors.clear(); living.clear(); scope = undefined; previousSnapshotTime = undefined; current = null; }
  function begin(time, view) {
    if (!Number.isFinite(time) || view?.scope == null || ![view.width, view.height].every(Number.isFinite) || view.width <= 0 || view.height <= 0) { clear(); return; }
    const snapshotTime = Number.isFinite(view.snapshotTime) ? view.snapshotTime : time;
    // A terminal snapshot can correct an extrapolated render clock backward.
    // Only an authoritative rewind invalidates this otherwise unchanged view.
    if (scope !== view.scope || current?.roomId !== view.roomId || current?.streamId !== view.streamId ||
      previousSnapshotTime !== undefined && snapshotTime < previousSnapshotTime) clear();
    scope = view.scope; previousSnapshotTime = snapshotTime;
    current = { time, snapshotTime,
      width: view.width, height: view.height, roomId: view.roomId, streamId: view.streamId }; living.clear();
    for (const id of view.visibleIds || []) living.add(String(id));
    // A still-living actor omitted from this arena or leaving this fight is not
    // a future death anchor. Do not later bring its corpse back from elsewhere.
    for (const agent of view.livingAgents || []) if (agent.health > 0 && !living.has(String(agent.id))) anchors.delete(String(agent.id));
    for (const [id, anchor] of anchors) if (time - (anchor.deathAt ?? anchor.at) >= (anchor.deathAt === undefined ? .85 : 3)) anchors.delete(id);
  }
  function observe(agent, point, { scale, facing } = {}) {
    if (!current || !(agent?.health > 0) || agent.birth || String(agent.combat?.id) !== String(scope)) return;
    const id = String(agent.id); living.add(id);
    const form = detailDeathForm(agent);
    if (!form || ![point?.x, point?.y, point?.width, point?.height, scale, facing, agent.x, agent.y, current.width, current.height].every(Number.isFinite) ||
      point.width <= 0 || point.height <= 0 || scale <= 0 || current.width <= 0 || current.height <= 0) { anchors.delete(id); return; }
    anchors.set(id, { at: current.time, snapshotAt: current.snapshotTime, form, point: { ...point }, scale, facing: facing < 0 ? -1 : 1,
      worldX: agent.x, worldY: agent.y, width: current.width, height: current.height });
  }
  function commands(corpses, time, { width, height, cell } = {}) {
    if (!current || ![time, width, height, cell].every(Number.isFinite) || width <= 0 || height <= 0 || cell <= 0) return [];
    const output = [], seen = new Set();
    for (const corpse of corpses || []) {
      if (corpse?.kind !== "corpse" || corpse.agentId == null) continue;
      const id = String(corpse.agentId), anchor = anchors.get(id);
      if (!anchor || living.has(id) || seen.has(id) || detailDeathForm(corpse) !== anchor.form ||
        corpse.x !== anchor.worldX || corpse.y !== anchor.worldY || ![corpse.diedAt, corpse.decaysAt].every(Number.isFinite) ||
        // Rendering extrapolates ahead of the last authoritative snapshot. A
        // delayed death may predate the last paint, but never that living record.
        corpse.diedAt + 1e-6 < anchor.snapshotAt || time < corpse.diedAt || time >= Math.min(corpse.decaysAt, corpse.diedAt + 3) ||
        (anchor.deathAt === undefined ? time - corpse.diedAt >= .85 || corpse.diedAt - anchor.snapshotAt > .85 : anchor.deathAt !== corpse.diedAt)) continue;
      anchor.deathAt = corpse.diedAt; seen.add(id);
      const point = { x: anchor.point.x * width / anchor.width, y: anchor.point.y * height / anchor.height,
        width: anchor.point.width * width / anchor.width, height: anchor.point.height * height / anchor.height };
      output.push({ agentId: id, form: anchor.form, corpse: { ...corpse, health: 0, facing: anchor.facing },
        point, scale: anchor.scale, cell, age: time - corpse.diedAt });
    }
    return output.sort((a, b) => a.point.y - b.point.y);
  }
  return { begin, observe, commands, clear };
}
