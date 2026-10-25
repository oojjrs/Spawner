import { generateWorld } from "../server/world.mjs";
import { createGame } from "../server/game.mjs";
import { createCreatures } from "../server/creatures.mjs";
import { populateResourceNodes, clearResourceHazards, populateForestResources, populateColonyFood } from "../server/resources.mjs";
import { isTreeFood } from "../server/food.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";

const mask = ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"];
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge", "swamp"];

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

export function createRoom(title, seed, tribe, onProgress) {
  if (tribe === undefined) tribe = "bean";
  if (tribe !== null && !PLAYER_TRIBES.some(entry => entry.key === tribe)) throw new Error("시작할 부족을 선택해 주세요.");
  const room = { id: crypto.randomUUID(), title: requireName(title, 24),
    hostId: crypto.randomUUID(), seed, simSeconds: 0, revision: 0, updatedAt: Date.now(),
    world: generateWorld(seed, undefined, progress => onProgress?.(progress * .8)), colonies: [], games: new Map(), food: new Map(), foodSpots: new Map() };
  for (const [x, y, amount, resourceType] of room.world.food) room.food.set(x + "," + y, { x, y, amount, initialAmount: amount, resourceType, terrain: terrainTypes[room.world.terrain[y * 320 + x]] });
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
  return { version: 1, id: room.id, title: room.title, hostId: room.hostId, seed: room.seed,
    worldGenerationVersion: room.world.generationVersion,
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
  if (!saved || saved.version !== 1 || typeof saved.id !== "string" || typeof saved.hostId !== "string" ||
      !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 4294967295 ||
      !Number.isFinite(saved.simSeconds) || saved.simSeconds < 0 || !Array.isArray(saved.colonies) ||
      saved.colonies.length < 1 || saved.colonies.length > 12 || !Array.isArray(saved.games) ||
      saved.games.length !== saved.colonies.length || !Array.isArray(saved.food) || saved.food.length > 102400 ||
      !saved.creatures || ![1, 2, 3, 4, 5].includes(saved.creatures.version) || !Array.isArray(saved.creatures.agents)) throw new Error("월드 저장 형식이 올바르지 않습니다.");
  const room = { id: saved.id, title: requireName(saved.title, 24),
    hostId: saved.hostId, seed: saved.seed, simSeconds: saved.simSeconds, revision: 0, updatedAt: saved.updatedAt,
    resourceVersion: Number.isInteger(saved.resourceVersion) ? saved.resourceVersion : 0,
    world: generateWorld(saved.seed, saved.worldGenerationVersion ?? 1), colonies: [], games: new Map(), food: new Map(saved.food), foodSpots: new Map() };
  room.world.depletedTrees = new Set((saved.depletedTrees || []).filter(index => Number.isInteger(index) && index >= 0 && index < 320 * 320));
  const owners = new Set();
  const colonyIds = new Set();
  for (const colony of saved.colonies) {
    if (!colony || typeof colony.ownerId !== "string" || owners.has(colony.ownerId) || !Number.isInteger(colony.id) ||
        colonyIds.has(colony.id) || !Number.isInteger(colony.x) || !Number.isInteger(colony.y) ||
        colony.x < 0 || colony.y < 0 || colony.x > 315 || colony.y > 315 || !Array.isArray(colony.occupiedCells)) throw new Error("둥지 저장 형식이 올바르지 않습니다.");
    requireName(colony.name, 32);
    owners.add(colony.ownerId);
    colonyIds.add(colony.id);
    const tribe = Object.hasOwn(colony, "tribe") ? colony.tribe : "bean";
    if (tribe !== null && !PLAYER_TRIBES.some(entry => entry.key === tribe)) throw new Error("저장된 부족 정보가 올바르지 않습니다.");
    room.colonies.push({ ...colony, tribe, occupiedCells: new Set(colony.occupiedCells) });
  }
  if (!owners.has(room.hostId)) throw new Error("플레이할 둥지를 찾을 수 없습니다.");
  for (const [key, cell] of room.food) {
    if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x >= 320 || cell.y >= 320 ||
        key !== cell.x + "," + cell.y && (key !== "corpse:" + cell.agentId || cell.key !== key) || !Number.isFinite(cell.amount) || cell.amount < 0) throw new Error("먹이 저장 형식이 올바르지 않습니다.");
  }
  populateResourceNodes(room);
  clearResourceHazards(room);
  populateColonyFood(room);
  indexFood(room);
  populateForestResources(room);
  for (const [owner, data] of saved.games) {
    if (!owners.has(owner) || room.games.has(owner) || typeof data !== "string") throw new Error("개체 저장 형식이 올바르지 않습니다.");
    const state = JSON.parse(data)?.state;
    if (!state || !Array.isArray(state.agents) || !Array.isArray(state.templates) || !Number.isFinite(state.evolutionPoints) ||
        state.evolutionPoints < 0 || !Number.isInteger(state.nestLevel) || state.nestLevel < 1) throw new Error("개체 저장 형식이 올바르지 않습니다.");
    const game = createGame(room, room.colonies.find(colony => colony.ownerId === owner));
    game.restore(data);
    room.games.set(owner, game);
  }
  room.creatureSystem = createCreatures(room, saved.creatures);
  prepare(room);
  return room;
}

export function tickRoom(room, elapsed) {
  if (room.colonies.find(colony => colony.ownerId === room.hostId).tribe === null) return;
  room.simSeconds += elapsed;
  prepare(room);
  for (const game of room.games.values()) game.tick(elapsed);
  room.creatureSystem.tick();
  room.revision += 1;
}

export function snapshotRoom(room, includeWorld) {
  prepare(room);
  const game = room.games.get(room.hostId);
  return { roomId: room.id, title: room.title, hostId: room.hostId, userId: room.hostId,
    revision: room.revision, tribeStarts: includeWorld ? roomTribeStarts(room) : undefined, colonyId: room.colonies.find(colony => colony.ownerId === room.hostId).id,
    colonies: room.colonies.filter(colony => game.colonyKnown(colony)).map(colony => ({ ...colony, occupiedCells: [...colony.occupiedCells], nestLevel: room.games.get(colony.ownerId).nestLevel,
      nestHealth: room.games.get(colony.ownerId).nest.health, nestMaxHealth: room.games.get(colony.ownerId).nest.maxHealth })),
    world: includeWorld ? { size: 320, seed: room.seed, generationVersion: room.world.generationVersion, terrain: room.world.terrain, hazards: room.world.hazards, burrows: room.world.burrows, treeCells: room.world.treeCells,
      resourceCells: [...room.food.values()].filter(cell => cell.kind !== "corpse" && cell.resourceType !== "tree" && !isTreeFood(cell, room.world)).map(cell => [cell.x, cell.y]) } : undefined,
    state: game.snapshot() };
}

export function commandRoom(room, action) {
  if (room.colonies.find(colony => colony.ownerId === room.hostId).tribe === null) throw new Error("시작할 부족을 먼저 선택해 주세요.");
  prepare(room);
  let result;
  if (action.type === "rename-colony") {
    const colony = room.colonies.find(entry => entry.id === action.colonyId && entry.ownerId === room.hostId);
    if (!colony) throw new Error("자신의 둥지만 이름을 바꿀 수 있습니다.");
    colony.name = requireName(action.name, 32);
    colony.hasCustomName = true;
    result = { colonyId: colony.id };
  } else result = room.games.get(room.hostId).command(action);
  room.revision += 1;
  return result;
}
