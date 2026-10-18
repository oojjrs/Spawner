import { createServer } from "node:http";
import { createServer as createControlServer } from "node:net";
import { randomBytes, randomInt, createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { generateWorld } from "./world.mjs";
import { createGame } from "./game.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(process.env.SPAWNER_DATA_DIR || resolve(root, ".data"));
const dataPath = resolve(dataDirectory, "rooms.json");
const instanceId = createHash("sha256").update(root.replace(/[\\/]+$/, "").toLowerCase()).digest("hex");
const revision = (await Promise.all(["game.mjs", "server.mjs", "world.mjs"].map(async (file) =>
  createHash("sha256").update(await readFile(resolve(root, "server", file))).digest("hex")))).join("");
const sessions = new Map();
const rooms = new Map();
const mask = ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1",
  "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"];
let persistence = Promise.resolve();
let mutation = Promise.resolve();
let storageError = false;

function id() { return randomBytes(24).toString("hex"); }
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function name(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 24) fail(400, "이름은 1~24자로 입력해 주세요.");
  return value.trim();
}

function makeRoom(roomId, title, hostId, seed) {
  const world = generateWorld(seed);
  const room = { id: roomId, title, hostId, seed, world, simSeconds: 0, revision: 0,
    colonies: [], games: new Map(), food: new Map(), foodSpots: new Map(), lastActive: 0 };
  const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge"];
  for (const [x, y] of world.food) {
    const cell = { x, y, amount: 50, terrain: terrainTypes[world.terrain[y * 320 + x]] };
    room.food.set(x + "," + y, cell);
  }
  indexFood(room);
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

function join(room, session) {
  if (!room.games.has(session.id)) {
    if (room.colonies.length >= room.world.sites.length) fail(409, "방이 가득 찼습니다.");
    const site = room.world.sites[room.colonies.length];
    const colony = { id: room.colonies.length + 1, ownerId: session.id, name: session.name + "의 둥지",
      x: site[0] - 2, y: site[1] - 2, occupiedCells: new Set(mask) };
    room.colonies.push(colony);
    room.games.set(session.id, createGame(room, colony));
    room.revision += 1;
  }
  session.roomId = room.id;
  room.lastActive = Date.now();
  prepare(room);
}

function prepare(room) {
  for (const game of room.games.values()) game.prepare(room.simSeconds);
}

function payload(room, session, includeWorld) {
  prepare(room);
  return { roomId: room.id, title: room.title, hostId: room.hostId, userId: session.id,
    revision: room.revision, colonyId: room.colonies.find((colony) => colony.ownerId === session.id).id,
    colonies: room.colonies.map((colony) => ({ ...colony, occupiedCells: [...colony.occupiedCells] })),
    world: includeWorld ? { size: 320, seed: room.seed, terrain: [...room.world.terrain] } : undefined,
    state: room.games.get(session.id).snapshot() };
}

function persist() {
  const body = JSON.stringify({ version: 1, sessions: [...sessions], rooms: [...rooms.values()].map((room) => ({
    id: room.id, title: room.title, hostId: room.hostId, seed: room.seed, simSeconds: room.simSeconds,
    revision: room.revision, colonies: room.colonies.map((colony) => ({ ...colony, occupiedCells: [...colony.occupiedCells] })),
    food: [...room.food], games: [...room.games].map(([owner, game]) => [owner, game.save()])
  })) });
  const task = persistence.catch(() => {}).then(async () => {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataPath + ".tmp", body, "utf8");
    await rename(dataPath + ".tmp", dataPath);
    storageError = false;
  });
  persistence = task;
  return task.catch((error) => { storageError = true; throw error; });
}

try {
  const saved = JSON.parse(await readFile(dataPath, "utf8"));
  if (saved.version !== 1) throw new Error("지원하지 않는 저장 형식입니다.");
  for (const [token, session] of saved.sessions) sessions.set(token, session);
  for (const savedRoom of saved.rooms) {
    const room = makeRoom(savedRoom.id, savedRoom.title, savedRoom.hostId, savedRoom.seed);
    room.simSeconds = savedRoom.simSeconds;
    room.revision = savedRoom.revision;
    room.food = new Map(savedRoom.food);
    indexFood(room);
    room.colonies = savedRoom.colonies.map((colony) => ({ ...colony, occupiedCells: new Set(colony.occupiedCells) }));
    for (const [owner, savedGame] of savedRoom.games) {
      const game = createGame(room, room.colonies.find((colony) => colony.ownerId === owner));
      game.restore(savedGame);
      room.games.set(owner, game);
    }
    prepare(room);
    rooms.set(room.id, room);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function body(request) {
  if (!request.headers["content-type"]?.startsWith("application/json")) fail(415, "JSON 요청이 필요합니다.");
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) fail(413, "요청이 너무 큽니다.");
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { fail(400, "요청 형식이 올바르지 않습니다."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(400, "요청 형식이 올바르지 않습니다.");
  return value;
}

function currentRoom(session) {
  const room = rooms.get(session.roomId);
  if (!room || !room.games.has(session.id)) fail(404, "먼저 방에 참가해 주세요.");
  room.lastActive = Date.now();
  return room;
}

async function route(request, response) {
  const url = new URL(request.url, "http://localhost");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  const token = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("spawner="))?.slice(8);
  const session = sessions.get(token);
  if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { app: "Spawner", instanceId, revision, ready: !stopping, storageError, shutdownProtocol: "pipe-v1" });
  if (request.method === "GET" && url.pathname === "/api/session") {
    return json(response, 200, { user: session ? { name: session.name, roomId: session.roomId } : null });
  }
  if (request.method === "GET" && url.pathname === "/api/rooms") {
    return json(response, 200, { rooms: [...rooms.values()].map((room) => ({ id: room.id, title: room.title,
      players: room.colonies.length, capacity: 12, joined: !!session && room.games.has(session.id),
      isHost: !!session && room.hostId === session.id,
      host: room.colonies.find((colony) => colony.ownerId === room.hostId)?.name.replace(/의 둥지$/, "") || "" })) });
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    if (!session) fail(401, "이름을 입력하고 입장해 주세요.");
    const room = currentRoom(session);
    return json(response, 200, payload(room, session, url.searchParams.get("world") === "1"));
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/")) {
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) fail(403, "다른 사이트의 요청은 허용하지 않습니다.");
    if (request.headers["sec-fetch-site"] === "cross-site") fail(403, "다른 사이트의 요청은 허용하지 않습니다.");
    const action = await body(request);
    const task = mutation.catch(() => {}).then(async () => {
      if (url.pathname === "/api/session") {
        const userName = name(action.name);
        if (session) {
          session.name = userName;
          for (const room of rooms.values()) {
            const colony = room.colonies.find((entry) => entry.ownerId === session.id);
            if (colony) colony.name = userName + "의 둥지";
          }
          await persist();
          return json(response, 200, { name: userName });
        }
        if (sessions.size >= 500) fail(503, "참가 가능한 유저 수를 초과했습니다.");
        const nextToken = id();
        sessions.set(nextToken, { id: id(), name: userName, roomId: null, commands: [] });
        await persist();
        response.setHeader("Set-Cookie", "spawner=" + nextToken + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000" + (process.env.COOKIE_SECURE === "1" ? "; Secure" : ""));
        return json(response, 201, { name: userName });
      }
      if (!session) fail(401, "이름을 입력하고 입장해 주세요.");
      if (typeof action.requestId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(action.requestId)) fail(400, "요청 번호가 필요합니다.");
      const previous = session.commands.find((command) => command.id === action.requestId);
      if (previous) {
        await persist();
        return json(response, 200, previous.result);
      }
      let result;
      if (url.pathname === "/api/rooms") {
        const title = name(action.title);
        if (rooms.size >= 64) fail(409, "새 방을 만들 수 없습니다.");
        const room = makeRoom(id(), title, session.id, randomInt(4294967296));
        join(room, session);
        rooms.set(room.id, room);
        result = { roomId: room.id };
      } else if (url.pathname === "/api/join") {
        const room = rooms.get(action.roomId);
        if (!room) fail(404, "방을 찾을 수 없습니다.");
        join(room, session);
        result = { roomId: room.id };
      } else if (url.pathname === "/api/action") {
        const room = currentRoom(session);
        if (action.roomId !== room.id) fail(409, "참가한 방이 변경되었습니다. 다시 입장해 주세요.");
        prepare(room);
        try { result = room.games.get(session.id).command(action); }
        catch (error) { fail(400, error.message); }
        room.revision += 1;
      } else fail(404, "요청을 찾을 수 없습니다.");
      session.commands.push({ id: action.requestId, result });
      session.commands = session.commands.slice(-64);
      await persist();
      return json(response, 200, result);
    });
    mutation = task;
    return task;
  }
  if (request.method === "GET" && ["/", "/Spawner.html"].includes(url.pathname)) {
    const html = await readFile(resolve(root, "Spawner.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    return response.end(html);
  }
  fail(404, "페이지를 찾을 수 없습니다.");
}

const requests = new Set();
const server = createServer((request, response) => {
  if (stopping) return json(response, 503, { error: "서버를 저장하고 재시작하고 있습니다." });
  const task = route(request, response).catch((error) => {
    if (!error.status) console.error(error);
    if (!response.headersSent) json(response, error.status || 503,
      { error: error.status ? error.message : "서버 저장을 완료하지 못했습니다. 잠시 후 다시 연결해 주세요." });
    else response.end();
  });
  requests.add(task);
  task.finally(() => requests.delete(task));
});
server.requestTimeout = 10000;
let lastTick = performance.now();
const simulation = setInterval(() => {
  const now = performance.now();
  const elapsed = Math.min(0.25, (now - lastTick) / 1000);
  lastTick = now;
  if (storageError || stopping) return;
  for (const room of rooms.values()) {
    if (Date.now() - room.lastActive > 30000) continue;
    room.simSeconds += elapsed;
    prepare(room);
    for (const game of room.games.values()) game.tick(elapsed);
    room.revision += 1;
  }
}, 100);
const autosave = setInterval(() => { if (stopping) return; persist().catch((error) => console.error(error)); }, 5000);
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
server.listen(port, host, () => { process.stdout.write("SYSTEM> 서버 시작 : http://" + host + ":" + server.address().port + "\n"); });
let stopping = false;
let shutdown;
const control = createControlServer((socket) => {
  socket.on("error", () => {});
  socket.setTimeout(30000, () => socket.destroy());
  let command = "";
  socket.on("data", (chunk) => {
    command += chunk.toString("utf8");
    if (command.length > 128) return socket.destroy();
    if (!command.includes("\n")) return;
    socket.removeAllListeners("data");
    if (command.trim() !== "stop") return socket.end("invalid\n");
    stop().then(() => socket.end("saved\n"), () => socket.end("failed\n"));
  });
});
if (process.platform === "win32") control.listen(String.raw`\\.\pipe\Spawner-${instanceId}-${port}`);
function stop() {
  if (shutdown) return shutdown;
  stopping = true;
  shutdown = (async () => {
    try {
      await Promise.allSettled([...requests]);
      await mutation.catch(() => {});
      await persist();
      clearInterval(simulation);
      clearInterval(autosave);
      server.close();
      server.closeIdleConnections();
      if (control.listening) control.close();
    } catch (error) {
      stopping = false;
      shutdown = undefined;
      throw error;
    }
  })();
  return shutdown;
}
process.on("SIGINT", () => { stop().catch((error) => { console.error(error); }); });
process.on("SIGTERM", () => { stop().catch((error) => { console.error(error); }); });
