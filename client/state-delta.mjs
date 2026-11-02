const collectionKeys = {
  agents: value => value.id, rivals: value => value.id,
  food: value => value.key || value.x + "," + value.y,
  footprints: value => value.x + "," + value.y,
  sharedTrails: value => value[0], explored: value => value, visible: value => value,
  corpses: value => value.id || value.key || value.agentId,
  templates: value => value.id,
  discoveries: value => value.key, burrows: value => value.id
};

export function createStateEncoder() {
  let previous = null;
  let signatures = new Map(), collections = new Map(), explored = [];
  function encode(packet, reset) {
    const full = reset || !previous || packet.roomId !== previous.roomId || packet.colonyId !== previous.colonyId ||
      packet.state.simSeconds < previous.state.simSeconds;
    const state = { simSeconds: packet.state.simSeconds }, patches = {};
    const nextSignatures = new Map(), nextCollections = new Map();
    for (const [name, value] of Object.entries(packet.state)) {
      if (name === "explored" && Array.isArray(value)) {
        if (!full && (value.length !== explored.length || value.some((cell, index) => cell !== explored[index]))) {
          const append = value.length >= explored.length && explored.every((cell, index) => cell === value[index]);
          patches[name] = append ? { append: value.slice(explored.length) } : { replace: value };
        }
        explored = value;
        continue;
      }
      const keyOf = collectionKeys[name];
      if (keyOf && Array.isArray(value)) {
        const before = full ? new Map() : collections.get(name) || new Map();
        const after = new Map(), upsert = [];
        for (const item of value) {
          const key = keyOf(item), signature = JSON.stringify(item);
          after.set(key, signature);
          if (before.get(key) !== signature) upsert.push(item);
        }
        const removed = [...before.keys()].filter(key => !after.has(key));
        const order = [...after.keys()], oldOrder = [...before.keys()];
        const reordered = order.length !== oldOrder.length || order.some((key, index) => key !== oldOrder[index]);
        if (upsert.length || removed.length || reordered) patches[name] = { upsert, removed, order: reordered ? order : null };
        nextCollections.set(name, after);
      } else {
        const signature = JSON.stringify(value);
        if (full || signatures.get(name) !== signature) state[name] = value;
        nextSignatures.set(name, signature);
      }
    }
    const result = full ? packet : { ...packet, state, patches, baseRevision: previous.revision };
    previous = { roomId: packet.roomId, colonyId: packet.colonyId, revision: packet.revision, state: { simSeconds: packet.state.simSeconds } };
    signatures = nextSignatures; collections = nextCollections;
    return result;
  }
  return { encode };
}

export function createStateDecoder() {
  let previous = null;
  function decode(packet) {
    if (!Object.hasOwn(packet, "baseRevision")) { previous = packet; return packet; }
    if (!previous || previous.roomId !== packet.roomId || previous.colonyId !== packet.colonyId || previous.revision !== packet.baseRevision)
      throw new Error("월드 상태를 다시 동기화해야 합니다.");
    const state = { ...previous.state, ...packet.state };
    for (const [name, patch] of Object.entries(packet.patches)) {
      if (name === "explored") { state[name] = patch.replace || state[name].concat(patch.append); continue; }
      const keyOf = collectionKeys[name], items = new Map(state[name].map(item => [keyOf(item), item]));
      for (const key of patch.removed) items.delete(key);
      for (const item of patch.upsert) items.set(keyOf(item), item);
      state[name] = patch.order ? patch.order.map(key => items.get(key)) : [...items.values()];
    }
    const { patches, baseRevision, ...metadata } = packet;
    previous = { ...metadata, state };
    return previous;
  }
  return { decode };
}
