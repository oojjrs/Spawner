import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function lobby(tribe) {
  const rendering = Promise.withResolvers(), started = Promise.withResolvers();
  const packet = { roomId: "room", colonyId: 1, world: {}, colonies: [{ id: 1, tribe }] };
  const progress = [], entries = [], calls = [];
  const button = { textContent: "방 만들기" };
  const context = createContext({
    lobbyBusy: false, roomCreationProgress: null, welcomeStatus: {}, welcome: { hidden: false },
    document: { querySelector: () => button },
    setLobbyBusy: value => { context.lobbyBusy = value; },
    updateRoomCreationProgress: value => progress.push(value),
    setEvolutionText: (element, text) => { element.textContent = text; },
    client: { call: async (type, data) => {
      calls.push({ type, data: structuredClone(data) });
      return type === "create" ? { roomId: "room" } : packet;
    } },
    prepareWorldRendering: () => { started.resolve(); return rendering.promise; },
    prepareTribePreviews: async () => {},
    enterRoom: async (roomId, value) => { entries.push({ roomId, packet: value }); }
  });
  for (const name of ["prepareRoom", "lobbyAction"]) {
    const declaration = source.match(new RegExp("^    async function " + name + "\\([^]*?^    }", "m"));
    assert.ok(declaration, name);
    runInContext(declaration[0], context);
  }
  return { context, rendering, started, packet, progress, entries, calls, button };
}

for (const [action, tribe] of [["create", null], ["enter", "bean"]]) {
  test(action + " waits for the complete map before entering", async () => {
    const client = lobby(tribe);
    const pending = client.context.lobbyAction(action, { title: "test", roomId: "room" });
    await client.started.promise;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(client.context.lobbyBusy, true);
    assert.equal(client.entries.length, 0);
    assert.equal(client.progress.includes(100), false);
    assert.deepEqual(client.calls.at(-1), { type: "enter", data: { roomId: "room", visible: false } });
    client.rendering.resolve();
    await pending;
    assert.deepEqual(client.entries, [{ roomId: "room", packet: client.packet }]);
    assert.equal(client.progress.at(-1), 100);
    assert.equal(client.context.lobbyBusy, false);
    assert.equal(client.button.textContent, "방 만들기");
  });
}

test("failed map preparation keeps the lobby open and allows retry", async () => {
  const client = lobby(null);
  const pending = client.context.lobbyAction("create", { title: "test" });
  await client.started.promise;
  client.rendering.reject(new Error("map failed"));
  await pending;
  assert.equal(client.entries.length, 0);
  assert.equal(client.progress.includes(100), false);
  assert.equal(client.context.welcome.hidden, false);
  assert.equal(client.context.welcomeStatus.textContent, "map failed");
  assert.equal(client.context.lobbyBusy, false);
  assert.equal(client.button.textContent, "방 만들기");
});
