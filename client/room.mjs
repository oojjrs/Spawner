import { generateWorld } from "../server/world.mjs";
import { createGame } from "../server/game.mjs";
import { createCreatures } from "../server/creatures.mjs";
import { populateResourceNodes, clearResourceHazards, populateForestResources, populateColonyFood, resourceDefinition } from "../server/resources.mjs";
import { expireCorpses } from "../server/corpses.mjs";
import { isTreeFood } from "../server/food.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { commandRoomCheat } from "../server/cheats.mjs";
import { createUnitIndex } from "../server/unit-index.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const simulationUpdates = new WeakMap();

const mask = ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"];
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge", "swamp", "ford"];

export function requireName(value, limit) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit) throw new Error(`이름은 1~${limit}자로 입력해 주세요.`);
  return value.trim();
}

function indexFood(room) {
  room.foodSpots.clear();
  for (const cell of room.food.values()) {
    if (cell.kind === "corpse") continue;
    const key = Math.floor(cell.x / 18) + "," + Math.floor(cell.y / 18);
    if (!room.foodSpots.has(key)) room.foodSpots.set(key, { cells: [] });
    room.foodSpots.get(key).cells.push(cell);
  }
}

function prepare(room) {
  for (const game of room.games.values()) game.prepare(room.simSeconds);
}

export function roomTribeStarts(room) {
  return PLAYER_TRIBES.map((tribe, index) => {
    const camp = room.world.camps?.find(entry => entry.tribe === tribe.key);
    const site = camp ? [camp.x, camp.y] : room.world.sites[index];
    return { tribe: tribe.key, id: index + 1, x: site[0] - 2, y: site[1] - 2 };
  });
}

function populateColonies(room, tribe) {
  const starts = roomTribeStarts(room);
  room.colonies = starts.map(start => ({ id: start.id, ownerId: start.tribe === (tribe || "bean") ? room.hostId : "tribe:" + start.tribe,
    tribe: start.tribe === (tribe || "bean") ? tribe : start.tribe,
    name: start.tribe === (tribe || "bean") ? room.title + "의 둥지" : PLAYER_TRIBES.find(entry => entry.key === start.tribe).name + "의 둥지",
    x: start.x, y: start.y, occupiedCells: new Set(mask) }));
  populateColonyFood(room);
  indexFood(room);
  populateForestResources(room);
  room.games.clear();
  for (const colony of room.colonies) room.games.set(colony.ownerId, createGame(room, colony));
}

const beginnerHelpKeys = new Set(["intro", "gatherer", "upgrade", "military", "board-3", "board-4", "combat", "nest-defense"]);

function beginnerHelpState(value) {
  const keys = values => Array.isArray(values) ? [...new Set(values.filter(key => beginnerHelpKeys.has(key)))] : [];
  return { enabled: value?.enabled !== false, completed: keys(value?.completed), dismissed: keys(value?.dismissed) };
}

export function updateRoomBeginnerHelp(room, patch) {
  const current = beginnerHelpState(room.beginnerHelp);
  room.beginnerHelp = beginnerHelpState({
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    completed: [...current.completed, ...(Array.isArray(patch.completed) ? patch.completed : [])],
    dismissed: patch.resetDismissed === true ? [] : [...current.dismissed, ...(Array.isArray(patch.dismissed) ? patch.dismissed : [])]
  });
  room.revision += 1;
  return room.beginnerHelp;
}

export function createRoom(title, seed, tribe, onProgress, cheats, beginnerHelpEnabled) {
  if (tribe === undefined) tribe = "bean";
  if (tribe !== null && !PLAYER_TRIBES.some(entry => entry.key === tribe)) throw new Error("시작할 부족을 선택해 주세요.");
  const room = { id: crypto.randomUUID(), title: requireName(title, 24),
    hostId: crypto.randomUUID(), seed, cheats: cheats === true, beginnerHelp: beginnerHelpState({ enabled: beginnerHelpEnabled }), simSeconds: 0, revision: 0, updatedAt: Date.now(),
    world: generateWorld(seed, undefined, progress => onProgress?.(progress * .8)), colonies: [], games: new Map(), food: new Map(), foodSpots: new Map() };
  for (const [x, y, amount, resourceType] of room.world.food) room.food.set(x + "," + y, { x, y, amount, initialAmount: amount, resourceType, terrain: terrainTypes[room.world.terrain[y * (room.world.size || 320) + x]] });
  populateResourceNodes(room);
  clearResourceHazards(room);
  indexFood(room);
  onProgress?.(.85);
  populateColonies(room, tribe);
  onProgress?.(.9);
  room.creatureSystem = createCreatures(room, null);
  onProgress?.(.98);
  prepare(room);
  onProgress?.(1);
  return room;
}

export function saveRoom(room) {
  return { version: 2, id: room.id, title: room.title, hostId: room.hostId, seed: room.seed, world: room.world,
    cheats: room.cheats === true, beginnerHelp: beginnerHelpState(room.beginnerHelp),
    worldGenerationVersion: room.world.generationVersion,
    simulationUpdates: [...room.games].map(([owner, game]) => [owner, simulationUpdates.get(room)?.get(game) || null]),
    ending: room.games.get(room.hostId).ending,
    depletedTrees: [...(room.world.depletedTrees || [])],
    simSeconds: room.simSeconds, revision: room.revision, updatedAt: Date.now(), resourceVersion: room.resourceVersion,
    colonies: room.colonies.map(colony => ({ ...colony, occupiedCells: [...colony.occupiedCells] })),
    food: [...room.food], creatures: room.creatureSystem.save(), games: [...room.games].map(([owner, game]) => [owner, game.save()]) };
}

export function chooseRoomTribe(room, tribe) {
  const colony = room.colonies.find(entry => entry.ownerId === room.hostId);
  if (!PLAYER_TRIBES.some(entry => entry.key === tribe)) throw new Error("시작할 부족을 선택해 주세요.");
  if (colony.tribe !== null && colony.tribe !== tribe) throw new Error("이미 선택한 부족은 바꿀 수 없습니다.");
  if (colony.tribe === tribe) return;
  populateColonies(room, tribe);
  prepare(room);
  room.revision += 1;
}

export function restoreRoom(saved) {
  if (!saved || ![1, 2].includes(saved.version) || typeof saved.id !== "string" || typeof saved.hostId !== "string" ||
      !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 4294967295 ||
      !Number.isFinite(saved.simSeconds) || saved.simSeconds < 0 || !Array.isArray(saved.colonies) ||
      saved.colonies.length < 1 || saved.colonies.length > 12 || !Array.isArray(saved.games) ||
      saved.games.length !== saved.colonies.length || !Array.isArray(saved.food) || saved.food.length > 102400 ||
      !saved.creatures || ![1, 2, 3, 4, 5].includes(saved.creatures.version) || !Array.isArray(saved.creatures.agents)) throw new Error("월드 저장 형식이 올바르지 않습니다.");
  let world;
  if (saved.version === 2) {
    world = structuredClone(saved.world);
    const size = world?.size ?? 320;
    if (!world || ![160, 320].includes(size)) throw new Error("지형 저장 형식이 올바르지 않습니다.");
    world.size = size;
    for (const name of ["terrain", "hazards", "treeCells"]) {
      const cells = world?.[name];
      if (!cells || (cells.length ?? Object.keys(cells).length) !== size * size) throw new Error("지형 저장 형식이 올바르지 않습니다.");
      world[name] = cells instanceof Uint8Array ? cells : Uint8Array.from(Object.values(cells));
    }
    if (world.seed !== saved.seed || !Array.isArray(world.sites) || !Array.isArray(world.burrows) ||
        world.generationVersion !== saved.worldGenerationVersion) throw new Error("지형 저장 형식이 올바르지 않습니다.");
  } else world = generateWorld(saved.seed, saved.worldGenerationVersion ?? 1);
  const size = (world.size || 320);
  const room = { id: saved.id, title: requireName(saved.title, 24),
    hostId: saved.hostId, seed: saved.seed, cheats: saved.cheats === true, simSeconds: saved.simSeconds, revision: 0, updatedAt: saved.updatedAt,
    beginnerHelp: beginnerHelpState(saved.beginnerHelp || { enabled: saved.beginnerHelpEnabled }),
    resourceVersion: Number.isInteger(saved.resourceVersion) ? saved.resourceVersion : 0,
    world, colonies: [], games: new Map(), food: new Map(saved.food), foodSpots: new Map() };
  room.world.depletedTrees = new Set((saved.depletedTrees || []).filter(index => Number.isInteger(index) && index >= 0 && index < size * size));
  if (room.world.treeCells) for (const index of room.world.depletedTrees) room.world.treeCells[index] = 0;
  const owners = new Set();
  const colonyIds = new Set();
  for (const colony of saved.colonies) {
    if (!colony || typeof colony.ownerId !== "string" || owners.has(colony.ownerId) || !Number.isInteger(colony.id) ||
        colonyIds.has(colony.id) || !Number.isInteger(colony.x) || !Number.isInteger(colony.y) ||
        colony.x < 0 || colony.y < 0 || colony.x > size - 5 || colony.y > size - 5 || !Array.isArray(colony.occupiedCells)) throw new Error("둥지 저장 형식이 올바르지 않습니다.");
    requireName(colony.name, 32);
    owners.add(colony.ownerId);
    colonyIds.add(colony.id);
    const tribe = Object.hasOwn(colony, "tribe") ? colony.tribe : "bean";
    if (tribe !== null && !PLAYER_TRIBES.some(entry => entry.key === tribe)) throw new Error("저장된 부족 정보가 올바르지 않습니다.");
    room.colonies.push({ ...colony, tribe, occupiedCells: new Set(colony.occupiedCells) });
  }
  if (!owners.has(room.hostId)) throw new Error("플레이할 둥지를 찾을 수 없습니다.");
  for (const [key, cell] of room.food) {
    if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x >= size || cell.y >= size ||
        key !== cell.x + "," + cell.y && (key !== "corpse:" + cell.agentId || cell.key !== key) &&
        !(cell.dropped === true && cell.kind === "resource" && resourceDefinition(cell.resourceType) && cell.key === key &&
          key === "drop:" + cell.resourceType + ":" + cell.x + "," + cell.y) || cell.kind !== "corpse" && (!Number.isFinite(cell.amount) || cell.amount < 0)) throw new Error("자원 저장 형식이 올바르지 않습니다.");
  }
  expireCorpses(room.food, room.simSeconds);
  populateResourceNodes(room);
  clearResourceHazards(room);
  populateColonyFood(room);
  indexFood(room);
  if (saved.version === 1) populateForestResources(room);
  for (const [owner, data] of saved.games) {
    if (!owners.has(owner) || room.games.has(owner) || typeof data !== "string") throw new Error("개체 저장 형식이 올바르지 않습니다.");
    const state = JSON.parse(data)?.state;
    if (!state || !Array.isArray(state.agents) || !Array.isArray(state.templates) || !Number.isFinite(state.evolutionPoints) ||
        state.evolutionPoints < 0 || !Number.isInteger(state.nestLevel) || state.nestLevel < 1) throw new Error("개체 저장 형식이 올바르지 않습니다.");
    const game = createGame(room, room.colonies.find(colony => colony.ownerId === owner), data);
    room.games.set(owner, game);
  }
  if (saved.simulationUpdates !== undefined) {
    if (!Array.isArray(saved.simulationUpdates) || saved.simulationUpdates.length !== room.games.size ||
        new Set(saved.simulationUpdates.map(entry => entry?.[0])).size !== room.games.size ||
        saved.simulationUpdates.some(entry => !Array.isArray(entry) || !room.games.has(entry[0]) || entry[1] !== null &&
          (!Number.isFinite(entry[1]?.time) || entry[1].time < 0 || entry[1].time > room.simSeconds ||
           !Number.isFinite(entry[1].at) || !Number.isSafeInteger(entry[1].count) || entry[1].count < 0)))
      throw new Error("월드 저장 형식이 올바르지 않습니다.");
    simulationUpdates.set(room, new Map(saved.simulationUpdates.filter(([, update]) => update !== null)
      .map(([owner, update]) => [room.games.get(owner), { ...update }])));
  }
  room.creatureSystem = createCreatures(room, saved.creatures);
  prepare(room);
  room.games.get(room.hostId).checkEnding();
  return room;
}

export function tickRoom(room, elapsed) {
  if (room.colonies.find(colony => colony.ownerId === room.hostId).tribe === null || room.games.get(room.hostId).ending) return;
  room.simSeconds += elapsed;
  prepare(room);
  room.unitIndex = createUnitIndex(room);
  try {
    let updates = simulationUpdates.get(room);
    if (!updates) { updates = new Map(); simulationUpdates.set(room, updates); }
    const host = room.games.get(room.hostId), size = room.world.size || 320;
    for (const [owner,game] of room.games) {
      const previous = updates.get(game);
      const active = owner === room.hostId || !previous || previous.count !== game.agents.length || game.agents.some(agent =>
        agent.health <= 0 || agent.combat || agent.attack || agent.retreat || agent.mode === "rest" ||
        room.world.hazards?.[agent.y * size + agent.x] ||
        host.isVisible(agent.x, agent.y) || room.unitIndex.nearby(agent.x, agent.y, agent.stats.vision + 1)
          .some(entry => entry.game !== game && entry.agent.health > 0));
      if (active || room.simSeconds + 1e-8 >= previous.at) {
        game.tick(previous ? room.simSeconds - previous.time : elapsed);
        updates.set(game, { time: room.simSeconds, at: game.nextUpdateAt(), count: game.agents.length });
      }
      if (owner !== room.hostId) game.produce();
    }
    room.creatureSystem.tick();
    room.decisionPlanner?.flush();
    room.games.get(room.hostId).checkEnding();
  } finally { room.unitIndex = null; }
  room.revision += 1;
}

export function snapshotRoom(room, includeWorld) {
  prepare(room);
  const game = room.games.get(room.hostId);
  const state = game.snapshot();
  const agentIds = new Set([...state.agents, ...state.rivals].map(agent => agent.id));
  const combatVfx = snapshotCombatVfx(room, room.simSeconds, {
    agentIds, isVisible: (x, y) => game.isVisible(Math.floor(x), Math.floor(y))
  });
  return { roomId: room.id, title: room.title, hostId: room.hostId, userId: room.hostId,
    cheats: room.cheats === true,
    revision: room.revision, tribeStarts: includeWorld ? roomTribeStarts(room) : undefined, colonyId: room.colonies.find(colony => colony.ownerId === room.hostId).id,
    colonies: room.colonies.filter(colony => game.colonyKnown(colony)).map(colony => ({ ...colony, occupiedCells: [...colony.occupiedCells], nestLevel: room.games.get(colony.ownerId).nestLevel,
      nestHealth: room.games.get(colony.ownerId).nest.health, nestMaxHealth: room.games.get(colony.ownerId).nest.maxHealth })),
    world: includeWorld ? { roomId: room.id, size: (room.world.size || 320), seed: room.seed, generationVersion: room.world.generationVersion, terrain: room.world.terrain, hazards: room.world.hazards, burrows: room.world.burrows, treeCells: room.world.treeCells,
      creatureHabitats: (room.world.encounters || []).map(plan => ({ key: plan.key, terrains: plan.terrains })),
      resourceCells: [...room.food.values()].filter(cell => cell.kind !== "corpse" && cell.resourceType !== "tree" && !isTreeFood(cell, room.world)).map(cell => [cell.x, cell.y]) } : undefined,
    state: { ...state, combatVfx, beginnerHelp: beginnerHelpState(room.beginnerHelp) } };
}

export function commandRoom(room, action) {
  if (room.colonies.find(colony => colony.ownerId === room.hostId).tribe === null) throw new Error("시작할 부족을 먼저 선택해 주세요.");
  prepare(room);
  const cheat = commandRoomCheat(action, room);
  if (cheat !== null) {
    room.revision += 1;
    return cheat;
  }
  if (room.games.get(room.hostId).ending && action.type !== "read-discoveries") throw new Error("끝난 군락은 둘러보기만 할 수 있습니다.");
  let result;
  if (action.type === "rename-colony") {
    const colony = room.colonies.find(entry => entry.id === action.colonyId && entry.ownerId === room.hostId);
    if (!colony) throw new Error("자신의 둥지만 이름을 바꿀 수 있습니다.");
    requireName(action.name, 32);
    result = room.games.get(room.hostId).command(action);
  } else result = room.games.get(room.hostId).command(action);
  room.revision += 1;
  return result;
}
