import { createGame } from "../server/game.mjs";
import { createCreatures } from "../server/creatures.mjs";
import { generateWorld } from "../server/world.mjs";

const worlds = new Map();
const mask = ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"];
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge"];

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function id() { return crypto.randomUUID().replaceAll("-", ""); }
function requireName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 24) fail(400, "이름은 1~24자로 입력해 주세요.");
  return value.trim();
}
function renameColony(room, ownerId, action) {
  if (!Number.isInteger(action.colonyId)) fail(400, "둥지를 선택해 주세요.");
  const colony = room.colonies.find((entry) => entry.id === action.colonyId);
  if (!colony || colony.ownerId !== ownerId) fail(403, "자신의 둥지만 이름을 바꿀 수 있습니다.");
  if (typeof action.name !== "string" || !action.name.trim() || action.name.trim().length > 32) fail(400, "둥지 이름은 1~32자로 입력해 주세요.");
  colony.name = action.name.trim();
  colony.hasCustomName = true;
  return { colonyId: colony.id };
}

function reply(value, status, cookie) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(value), { status, headers });
}
function world(seed) {
  if (!worlds.has(seed)) {
    if (worlds.size >= 8) worlds.delete(worlds.keys().next().value);
    worlds.set(seed, generateWorld(seed));
  }
  return worlds.get(seed);
}
function makeRoom(roomId, title, hostId, seed) {
  const room = { id: roomId, title, hostId, seed, world: world(seed), revision: 0, simSeconds: 0,
    lastStepAt: Date.now(), colonies: [], games: new Map(), food: new Map(), foodSpots: new Map(), commands: new Map() };
  for (const [x, y] of room.world.food) room.food.set(x + "," + y, { x, y, amount: 50, terrain: terrainTypes[room.world.terrain[y * 320 + x]] });
  indexFood(room);
  room.creatureSystem = createCreatures(room, null);
  return room;
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
function prepare(room) { for (const game of room.games.values()) game.prepare(room.simSeconds); }
function advance(room) {
  const now = Date.now();
  let remaining = now - room.lastStepAt <= 30000 ? Math.max(0, (now - room.lastStepAt) / 1000) : 0;
  while (remaining > 0.000001) {
    const elapsed = Math.min(0.1, remaining);
    room.simSeconds += elapsed;
    prepare(room);
    for (const game of room.games.values()) game.tick(elapsed);
    room.creatureSystem.tick();
    remaining -= elapsed;
  }
  room.lastStepAt = now;
  prepare(room);
}
function join(room, player) {
  if (room.games.has(player.id)) {
    const colony = room.colonies.find((entry) => entry.ownerId === player.id);
    if (!colony.hasCustomName) colony.name = player.name + "의 둥지";
    return;
  }
  if (room.colonies.length >= room.world.sites.length) fail(409, "방이 가득 찼습니다.");
  const site = room.world.sites[room.colonies.length];
  const colony = { id: room.colonies.length + 1, ownerId: player.id, name: player.name + "의 둥지", x: site[0] - 2, y: site[1] - 2, occupiedCells: new Set(mask) };
  room.colonies.push(colony);
  room.games.set(player.id, createGame(room, colony));
  prepare(room);
}
function save(room) {
  return JSON.stringify({ simSeconds: room.simSeconds, lastStepAt: room.lastStepAt,
    colonies: room.colonies.map((colony) => ({ ...colony, occupiedCells: [...colony.occupiedCells] })),
    food: [...room.food], creatures: room.creatureSystem.save(), games: [...room.games].map(([owner, game]) => [owner, game.save()]), commands: [...room.commands] });
}
async function loadRoom(db, roomId) {
  const row = await db.prepare("SELECT * FROM spawner_rooms WHERE id = ?").bind(roomId).first();
  if (!row) fail(404, "방을 찾을 수 없습니다.");
  const room = makeRoom(row.id, row.title, row.host_id, row.seed);
  const saved = JSON.parse(row.state);
  room.revision = row.revision;
  room.simSeconds = saved.simSeconds;
  room.lastStepAt = saved.lastStepAt;
  room.colonies = saved.colonies.map((colony) => ({ ...colony, occupiedCells: new Set(colony.occupiedCells) }));
  room.food = new Map(saved.food);
  room.commands = new Map(saved.commands);
  indexFood(room);
  for (const [owner, data] of saved.games) {
    const game = createGame(room, room.colonies.find((colony) => colony.ownerId === owner));
    game.restore(data);
    room.games.set(owner, game);
  }
  room.creatureSystem = createCreatures(room, saved.creatures);
  return room;
}
async function changeRoom(db, roomId, change) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const room = await loadRoom(db, roomId);
    advance(room);
    const value = change(room);
    const changed = await db.prepare("UPDATE spawner_rooms SET state = ?, members = ?, revision = revision + 1 WHERE id = ? AND revision = ?")
      .bind(save(room), JSON.stringify(room.colonies.map((colony) => colony.ownerId)), room.id, room.revision).run();
    if (changed.meta.changes === 1) {
      room.revision += 1;
      return { room, value };
    }
  }
  fail(409, "다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요.");
}
function payload(room, player, includeWorld) {
  return { roomId: room.id, title: room.title, hostId: room.hostId, userId: player.id, revision: room.revision,
    colonyId: room.colonies.find((colony) => colony.ownerId === player.id).id,
    colonies: room.colonies.map((colony) => ({ ...colony, nestLevel: room.games.get(colony.ownerId).nestLevel, occupiedCells: [...colony.occupiedCells] })),
    world: includeWorld ? { size: 320, seed: room.seed, terrain: [...room.world.terrain] } : undefined,
    state: room.games.get(player.id).snapshot() };
}
async function body(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) fail(415, "JSON 요청이 필요합니다.");
  let text = "";
  let size = 0;
  const decoder = new TextDecoder();
  for await (const chunk of request.body || []) {
    size += chunk.byteLength;
    if (size > 8192) fail(413, "요청이 너무 큽니다.");
    text += decoder.decode(chunk, { stream: true });
  }
  text += decoder.decode();
  let value;
  try { value = JSON.parse(text); } catch { fail(400, "요청 형식이 올바르지 않습니다."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(400, "요청 형식이 올바르지 않습니다.");
  return value;
}
function requestLog(db, token, requestId, result) {
  return [db.prepare("INSERT INTO spawner_requests (id, token, result, created_at) VALUES (?, ?, ?, ?)")
    .bind(token + ":" + requestId, token, JSON.stringify(result), Date.now()),
  db.prepare("DELETE FROM spawner_requests WHERE token = ? AND id NOT IN (SELECT id FROM spawner_requests WHERE token = ? ORDER BY created_at DESC, rowid DESC LIMIT 64)").bind(token, token)];
}
async function previousRequest(db, token, requestId) {
  const previous = await db.prepare("SELECT result FROM spawner_requests WHERE id = ?").bind(token + ":" + requestId).first();
  return previous ? JSON.parse(previous.result) : null;
}
async function route(request, db, revision) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/health") return reply({ app: "Spawner", revision, ready: true, storageError: false, hosting: "Sites" }, 200, null);
  if (!db) fail(503, "서버 저장소에 연결하지 못했습니다.");
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("spawner="))?.slice(8);
  const player = token ? await db.prepare("SELECT * FROM spawner_players WHERE token = ?").bind(token).first() : null;
  if (request.method === "GET" && url.pathname === "/api/session") return reply({ user: player ? { name: player.name, roomId: player.room_id } : null }, 200, null);
  if (request.method === "GET" && url.pathname === "/api/rooms") {
    const result = await db.prepare("SELECT r.id, r.title, r.host_id, r.members, p.name AS host_name FROM spawner_rooms r LEFT JOIN spawner_players p ON p.id = r.host_id ORDER BY r.rowid").all();
    return reply({ rooms: result.results.map((room) => {
      const members = JSON.parse(room.members);
      return { id: room.id, title: room.title, players: members.length, capacity: 12, joined: !!player && members.includes(player.id), isHost: !!player && room.host_id === player.id, host: room.host_name || "" };
    }) }, 200, null);
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    if (!player) fail(401, "이름을 입력하고 입장해 주세요.");
    if (!player.room_id) fail(404, "먼저 방에 참가해 주세요.");
    const result = await changeRoom(db, player.room_id, (room) => {
      if (!room.games.has(player.id)) fail(404, "먼저 방에 참가해 주세요.");
      const colony = room.colonies.find((entry) => entry.ownerId === player.id);
      if (!colony.hasCustomName) colony.name = player.name + "의 둥지";
    });
    return reply(payload(result.room, player, url.searchParams.get("world") === "1"), 200, null);
  }
  if (request.method !== "POST") fail(404, "요청을 찾을 수 없습니다.");
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") fail(403, "다른 사이트의 요청은 허용하지 않습니다.");
  const action = await body(request);
  if (url.pathname === "/api/session") {
    const name = requireName(action.name);
    if (player) {
      await db.prepare("UPDATE spawner_players SET name = ? WHERE token = ?").bind(name, token).run();
      return reply({ name }, 200, null);
    }
    const count = await db.prepare("SELECT COUNT(*) AS count FROM spawner_players").first();
    if (count.count >= 500) fail(503, "참가 가능한 유저 수를 초과했습니다.");
    const nextToken = id() + id();
    await db.prepare("INSERT INTO spawner_players (token, id, name, room_id) VALUES (?, ?, ?, NULL)").bind(nextToken, id(), name).run();
    return reply({ name }, 201, "spawner=" + nextToken + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000" + (url.protocol === "https:" ? "; Secure" : ""));
  }
  if (!player) fail(401, "이름을 입력하고 입장해 주세요.");
  if (typeof action.requestId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(action.requestId)) fail(400, "요청 번호가 필요합니다.");
  const previous = await previousRequest(db, token, action.requestId);
  if (previous) return reply(previous, 200, null);
  if (url.pathname === "/api/rooms") {
    const title = requireName(action.title);
    const count = await db.prepare("SELECT COUNT(*) AS count FROM spawner_rooms").first();
    if (count.count >= 64) fail(409, "새 방을 만들 수 없습니다.");
    const room = makeRoom(id(), title, player.id, crypto.getRandomValues(new Uint32Array(1))[0]);
    join(room, player);
    const result = { roomId: room.id };
    try {
      await db.batch([db.prepare("INSERT INTO spawner_rooms (id, title, host_id, seed, members, state, revision) VALUES (?, ?, ?, ?, ?, ?, 0)")
        .bind(room.id, room.title, room.hostId, room.seed, JSON.stringify([player.id]), save(room)),
      db.prepare("UPDATE spawner_players SET room_id = ? WHERE token = ?").bind(room.id, token), ...requestLog(db, token, action.requestId, result)]);
    } catch (error) {
      const replay = await previousRequest(db, token, action.requestId);
      if (replay) return reply(replay, 200, null);
      throw error;
    }
    return reply(result, 200, null);
  }
  if (url.pathname === "/api/join") {
    if (typeof action.roomId !== "string") fail(400, "방을 선택해 주세요.");
    await changeRoom(db, action.roomId, (room) => join(room, player));
    const result = { roomId: action.roomId };
    try {
      await db.batch([db.prepare("UPDATE spawner_players SET room_id = ? WHERE token = ?").bind(action.roomId, token), ...requestLog(db, token, action.requestId, result)]);
    } catch (error) {
      const replay = await previousRequest(db, token, action.requestId);
      if (replay) return reply(replay, 200, null);
      throw error;
    }
    return reply(result, 200, null);
  }
  if (url.pathname === "/api/action") {
    if (!player.room_id || action.roomId !== player.room_id) fail(409, "참가한 방이 변경되었습니다. 다시 입장해 주세요.");
    const result = await changeRoom(db, player.room_id, (room) => {
      const game = room.games.get(player.id);
      if (!game) fail(404, "먼저 방에 참가해 주세요.");
      const commands = room.commands.get(player.id) || [];
      const previous = commands.find((command) => command.id === action.requestId);
      if (previous) return previous.result;
      let value;
      if (action.type === "rename-colony") value = renameColony(room, player.id, action);
      else {
        try { value = game.command(action); } catch (error) { fail(400, error.message); }
      }
      room.commands.set(player.id, [...commands.slice(-63), { id: action.requestId, result: value }]);
      return value;
    });
    return reply(result.value, 200, null);
  }
  fail(404, "요청을 찾을 수 없습니다.");
}

export async function handleSpawnerRequest(request, database, revision) {
  try { return await route(request, database, revision); }
  catch (error) {
    if (!error.status) console.error(error);
    return reply({ error: error.status ? error.message : "서버 저장을 완료하지 못했습니다. 잠시 후 다시 연결해 주세요." }, error.status || 503, null);
  }
}
