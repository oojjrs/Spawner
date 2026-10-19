import { generateWorld } from "../server/world.mjs";
import { createGame } from "../server/game.mjs";
import { createCreatures } from "../server/creatures.mjs";

const mask = ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"];
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge"];

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

export function createRoom(title, playerName, seed) {
  const room = { id: crypto.randomUUID(), title: requireName(title, 24), playerName: requireName(playerName, 24),
    hostId: crypto.randomUUID(), seed, simSeconds: 0, revision: 0, updatedAt: Date.now(),
    world: generateWorld(seed), colonies: [], games: new Map(), food: new Map(), foodSpots: new Map() };
  for (const [x, y] of room.world.food) room.food.set(x + "," + y, { x, y, amount: 50, terrain: terrainTypes[room.world.terrain[y * 320 + x]] });
  indexFood(room);
  const site = room.world.sites[0];
  const colony = { id: 1, ownerId: room.hostId, name: room.playerName + "의 둥지", x: site[0] - 2, y: site[1] - 2, occupiedCells: new Set(mask) };
  room.colonies.push(colony);
  room.games.set(room.hostId, createGame(room, colony));
  room.creatureSystem = createCreatures(room, null);
  prepare(room);
  return room;
}

export function saveRoom(room) {
  return { version: 1, id: room.id, title: room.title, hostId: room.hostId, playerName: room.playerName, seed: room.seed,
    simSeconds: room.simSeconds, revision: room.revision, updatedAt: Date.now(),
    colonies: room.colonies.map(colony => ({ ...colony, occupiedCells: [...colony.occupiedCells] })),
    food: [...room.food], creatures: room.creatureSystem.save(), games: [...room.games].map(([owner, game]) => [owner, game.save()]) };
}

export function restoreRoom(saved) {
  if (!saved || saved.version !== 1 || typeof saved.id !== "string" || typeof saved.hostId !== "string" ||
      !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 4294967295 ||
      !Number.isFinite(saved.simSeconds) || saved.simSeconds < 0 || !Array.isArray(saved.colonies) ||
      saved.colonies.length < 1 || saved.colonies.length > 12 || !Array.isArray(saved.games) ||
      saved.games.length !== saved.colonies.length || !Array.isArray(saved.food) || saved.food.length > 102400 ||
      !saved.creatures || ![1, 2, 3].includes(saved.creatures.version) || !Array.isArray(saved.creatures.agents)) throw new Error("월드 저장 형식이 올바르지 않습니다.");
  const room = { id: saved.id, title: requireName(saved.title, 24), playerName: requireName(saved.playerName, 24),
    hostId: saved.hostId, seed: saved.seed, simSeconds: saved.simSeconds, revision: 0, updatedAt: saved.updatedAt,
    world: generateWorld(saved.seed), colonies: [], games: new Map(), food: new Map(saved.food), foodSpots: new Map() };
  const owners = new Set();
  const colonyIds = new Set();
  for (const colony of saved.colonies) {
    if (!colony || typeof colony.ownerId !== "string" || owners.has(colony.ownerId) || !Number.isInteger(colony.id) ||
        colonyIds.has(colony.id) || !Number.isInteger(colony.x) || !Number.isInteger(colony.y) ||
        colony.x < 0 || colony.y < 0 || colony.x > 315 || colony.y > 315 || !Array.isArray(colony.occupiedCells)) throw new Error("둥지 저장 형식이 올바르지 않습니다.");
    requireName(colony.name, 32);
    owners.add(colony.ownerId);
    colonyIds.add(colony.id);
    room.colonies.push({ ...colony, occupiedCells: new Set(colony.occupiedCells) });
  }
  if (!owners.has(room.hostId)) throw new Error("플레이할 둥지를 찾을 수 없습니다.");
  for (const [key, cell] of room.food) {
    if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x >= 320 || cell.y >= 320 ||
        key !== cell.x + "," + cell.y || !Number.isFinite(cell.amount) || cell.amount < 0) throw new Error("먹이 저장 형식이 올바르지 않습니다.");
  }
  indexFood(room);
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
  room.simSeconds += elapsed;
  prepare(room);
  for (const game of room.games.values()) game.tick(elapsed);
  room.creatureSystem.tick();
  room.revision += 1;
}

export function snapshotRoom(room, includeWorld) {
  prepare(room);
  const game = room.games.get(room.hostId);
  return { roomId: room.id, title: room.title, hostId: room.hostId, userId: room.hostId, playerName: room.playerName,
    revision: room.revision, colonyId: room.colonies.find(colony => colony.ownerId === room.hostId).id,
    colonies: room.colonies.filter(colony => game.colonyKnown(colony)).map(colony => ({ ...colony, occupiedCells: [...colony.occupiedCells], nestLevel: room.games.get(colony.ownerId).nestLevel })),
    world: includeWorld ? { size: 320, seed: room.seed, terrain: room.world.terrain, hazards: room.world.hazards } : undefined,
    state: game.snapshot() };
}

export function commandRoom(room, action) {
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

export function importRooms(value) {
  let entries;
  if (value?.format === "spawner-local" && value.version === 1 && Array.isArray(value.rooms)) entries = value.rooms;
  else if (value?.version === 1 && Array.isArray(value.rooms) && Array.isArray(value.sessions)) {
    entries = value.rooms.map(room => ({ ...room, version: 1,
      playerName: value.sessions.find(entry => entry[1]?.id === room.hostId)?.[1].name || "나" }));
  } else throw new Error("Spawner 백업 파일을 선택해 주세요.");
  if (!entries.length || entries.length > 64) throw new Error("백업에는 1~64개의 월드가 필요합니다.");
  return entries.map(entry => {
    const room = restoreRoom(entry);
    room.id = crypto.randomUUID();
    snapshotRoom(room, false);
    return saveRoom(room);
  });
}
