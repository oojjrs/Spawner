export function savedRoomDesigns(room) {
  const colony = room?.colonies.find(entry => entry.ownerId === room.hostId);
  if (!colony || colony.tribe === null) return [];
  const saved = room.games.find(([owner]) => owner === room.hostId)?.[1];
  if (!saved) return [];
  const state = (typeof saved === "string" ? JSON.parse(saved) : saved).state;
  return state.templates.filter(template => template.automatic !== true).map(template => {
    const key = JSON.stringify([room.hostId, template.id]);
    const { id, ...design } = template;
    return { id: room.designIds?.[key] || room.id + ":" + key, tribe: colony.tribe || "bean", template: design };
  });
}

export function restoreRoomDesigns(room, designs) {
  const colony = room.colonies.find(entry => entry.ownerId === room.hostId);
  if (!colony?.tribe) return;
  const game = room.games.get(room.hostId), saved = JSON.parse(game.save());
  const state = saved.state;
  room.designIds ||= {};
  state.nextTemplateId = Math.max(state.nextTemplateId, ...state.templates.map(template => template.id + 1));
  for (const design of designs) {
    if (design.tribe !== colony.tribe || Object.values(room.designIds).includes(design.id)) continue;
    const source = design.template;
    let template = state.templates.find(candidate => !room.designIds[JSON.stringify([room.hostId, candidate.id])] &&
      candidate.name === source.name && JSON.stringify(candidate.dna) === JSON.stringify(source.dna) &&
      JSON.stringify(candidate.slots) === JSON.stringify(source.slots));
    if (!template) {
      if (state.templates.length >= 100) continue;
      let name = source.name, suffix = 2;
      while (state.templates.some(candidate => candidate.name === name)) {
        const ending = " " + suffix++;
        name = source.name.slice(0, 24 - ending.length) + ending;
      }
      template = { ...structuredClone(source), id: state.nextTemplateId++, name };
      state.templates.push(template);
    }
    room.designIds[JSON.stringify([room.hostId, template.id])] = design.id;
  }
  game.restore(JSON.stringify(saved));
}
