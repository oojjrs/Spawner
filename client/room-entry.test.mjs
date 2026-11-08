import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function lobby(tribe, actualPreviews = false) {
  const rendering = Promise.withResolvers(), started = Promise.withResolvers();
  const packet = { roomId: "room", colonyId: 1, world: {}, colonies: [{ id: 1, tribe }] };
  const progress = [], entries = [], calls = [];
  const button = { textContent: "방 만들기" };
  const context = createContext({
    roomPreparationVersion: 0, tribePreviewVersion: 0, pendingCreatedRoom: null,
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
    prepareTribeWorld: async () => {},
    enterRoom: async (roomId, value) => { entries.push({ roomId, packet: value }); }
  });
  for (const name of ["prepareRoom", "lobbyAction"]) {
    const declaration = source.match(new RegExp("^    async function " + name + "\\([^]*?^    }", "m"));
    assert.ok(declaration, name);
    runInContext(declaration[0], context);
  }
  if (actualPreviews) installPreviews(context);
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

test("selection waits for its composited map even after terrain and previews finish", async () => {
  const fixture = lobby(null);
  const map = Promise.withResolvers();
  fixture.context.prepareTribeWorld = () => map.promise;
  const pending = fixture.context.lobbyAction("create", { title: "test" });
  fixture.rendering.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.entries.length, 0);
  assert.equal(fixture.progress.includes(100), false);
  assert.equal(fixture.context.welcome.hidden, false);
  map.resolve();
  await pending;
  assert.equal(fixture.entries.length, 1);
  assert.equal(fixture.progress.at(-1), 100);
});

test("a failed selection map stays in the lobby and can be retried", async () => {
  const fixture = lobby(null);
  fixture.context.prepareTribeWorld = async () => { throw new Error("map composition failed"); };
  fixture.rendering.resolve();
  await fixture.context.lobbyAction("create", { title: "test" });
  assert.equal(fixture.entries.length, 0);
  assert.equal(fixture.progress.includes(100), false);
  assert.equal(fixture.context.welcome.hidden, false);
  assert.equal(fixture.context.lobbyBusy, false);
  assert.equal(fixture.context.welcomeStatus.textContent, "map composition failed");
  fixture.context.prepareTribeWorld = async () => {};
  await fixture.context.lobbyAction("create", { title: "test" });
  assert.equal(fixture.entries.length, 1);
  assert.equal(fixture.calls.filter(call => call.type === "create").length, 1);
});

function declaration(name, context) {
  const match = source.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  runInContext(match[0], context);
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function installPreviews(context) {
  const keys = ["bean", "spore", "pebble", "spring"];
  const assets = new Map(keys.map(key => [key, Promise.withResolvers()]));
  const loaded = [], timers = new Set();
  const image = { decode: async () => {}, naturalWidth: 512, naturalHeight: 512 };
  const bounds = { x: 0, y: 0, width: 100, height: 200 };
  const appearance = { sprite: image, scale: 1, groundWidth: 1, top: 0 };
  Object.assign(context, {
    assets, loaded, timers, COLONY_SIZE: 5, AGENT_HEIGHT: 1,
    SpawnerAssets: { image: () => ({ ...image }) }, assetSource: path => path,
    Spawner: { PLAYER_TRIBES: keys.map(key => ({ key, starter: key + '.png', idle: key + '-idle.png' })),
      unitTribeReference: () => bounds, unitAnimationSheetScale: () => 1, imageFrameSize: () => 512 },
    starterObjectSprite: image, colonyAppearances: [appearance], tribeColonies: new Map(keys.map(key => [key, appearance])),
    unitAnimationSheets: new Map(keys.map(key => [key, new Map([["idle", { animation: { frameSize: 512 } }]])])),
    tribePreviews: new Map(), tribePreviewError: "", tribePreviewVersion: 0,
    tribeArt: { preparePreview: tribe => { loaded.push(tribe.key); return assets.get(tribe.key).promise; },
      prepareBounds: async () => bounds, bounds: () => bounds },
    prepareTribeRendering: async (colonies, options) => { assert.equal(options.previewOnly, true); },
    setTimeout: (callback, ms) => { assert.equal(ms, 45000); timers.add(callback); return callback; },
    clearTimeout: callback => timers.delete(callback),
  });
  context.resolveAsset = key => assets.get(key).resolve({ nest: image, idle: image, nestBounds: bounds });
  declaration("prepareTribePreviews", context);
}

function installSelection(context) {
  const buttons = [ {}, {}, {}, {} ].map(() => ({ disabled: true, setAttribute() {} }));
  const app = { hidden: true, inert: true };
  Object.assign(context, {
    tribeRoomId: null, tribePacket: null, selectedTribe: null, tribeStart: {},
    tribeSelection: { hidden: true }, tribeSelectionStatus: {}, connection: {},
    tribeGrid: { querySelectorAll: () => buttons, setAttribute() {} },
    drawTribeWorld: () => { assert.equal(context.tribePreviews.size, 4); },
    document: { body: { dataset: { screen: 'welcome' } },
      querySelector: selector => selector === '.app' ? app : { appendChild() {} },
      getElementById: () => ({ focus() {} }) }
  });
  declaration("showTribeSelection", context);
  return { buttons, app };
}

test("selection and map remain closed until every actual preview is ready", async () => {
  const fixture = lobby(null, true), { context } = fixture;
  const screen = installSelection(context);
  const pending = context.prepareRoom("room");
  await fixture.started.promise;
  assert.equal(context.loaded.length, 0);
  fixture.rendering.resolve();
  await flush();
  for (const key of ['bean', 'spore', 'pebble']) context.resolveAsset(key);
  await flush();
  assert.equal(context.tribePreviews.size, 3);
  assert.equal(context.tribeSelection.hidden, true);
  assert.equal(screen.app.hidden, true);
  assert.equal(fixture.progress.includes(100), false);
  context.resolveAsset('spring');
  const packet = await pending;
  assert.equal(fixture.progress.at(-1), 100);
  context.showTribeSelection(packet);
  assert.equal(context.tribeSelection.hidden, false);
  assert.equal(context.welcome.hidden, true);
  assert.equal(screen.app.hidden, true);
  assert.ok(screen.buttons.every(button => !button.disabled));
  assert.equal(context.timers.size, 0);
});

test("failed preview blocks entry and retries the same created room, reusing completed previews", async () => {
  const fixture = lobby(null, true), { context } = fixture;
  const data = { title: 'test' };
  const pending = context.lobbyAction('create', data);
  fixture.rendering.resolve();
  await flush();
  for (const key of ['bean', 'spore', 'pebble']) context.resolveAsset(key);
  await flush();
  context.assets.get('spring').reject(new Error('image failed'));
  await pending;
  assert.equal(fixture.entries.length, 0);
  assert.equal(context.welcome.hidden, false);
  assert.equal(context.lobbyBusy, false);
  assert.match(context.welcomeStatus.textContent, /다시 시도/);
  assert.equal(fixture.progress.includes(100), false);
  context.assets.set('spring', Promise.withResolvers());
  const retry = context.lobbyAction('create', data);
  await flush();
  context.resolveAsset('spring');
  await retry;
  assert.equal(fixture.calls.filter(call => call.type === 'create').length, 1);
  assert.equal(fixture.entries.length, 1);
  assert.deepEqual(context.loaded, ['bean', 'spore', 'pebble', 'spring', 'spring']);
});

test("timeout releases lobby controls; late old preview cannot complete a retry", async () => {
  const fixture = lobby(null, true), { context } = fixture;
  fixture.rendering.resolve();
  const pending = context.lobbyAction('create', { title: 'test' });
  await flush();
  const old = new Map(context.assets);
  for (const timer of context.timers) timer();
  await pending;
  assert.equal(context.lobbyBusy, false);
  assert.equal(context.timers.size, 0);
  assert.equal(fixture.entries.length, 0);
  assert.match(context.welcomeStatus.textContent, /시간이 초과/);
  for (const key of context.assets.keys()) context.assets.set(key, Promise.withResolvers());
  const retry = context.lobbyAction('create', { title: 'test' });
  await flush();
  for (const asset of old.values()) asset.resolve({ idle: {}, nest: {} });
  await flush();
  assert.equal(fixture.entries.length, 0);
  assert.equal(context.tribePreviews.size, 0);
  for (const key of context.assets.keys()) context.resolveAsset(key);
  await retry;
  assert.equal(fixture.entries.length, 1);
});

test("a superseded room request cannot open its selection or overwrite newer status on rejection", async () => {
  const fixture = lobby(null, true), { context } = fixture;
  fixture.rendering.resolve();
  const old = context.prepareRoom('old-room');
  await flush();
  const oldAssets = new Map(context.assets);
  for (const key of context.assets.keys()) context.assets.set(key, Promise.withResolvers());
  const current = context.prepareRoom('new-room');
  await flush();
  for (const key of context.assets.keys()) context.resolveAsset(key);
  assert.ok(await current);
  const status = context.welcomeStatus.textContent;
  oldAssets.get('bean').reject(new Error('late failure'));
  assert.equal(await old, null);
  assert.equal(context.welcomeStatus.textContent, status);
});

test("already selected tribes do not prepare selection art", async () => {
  const fixture = lobby('bean', true);
  fixture.rendering.resolve();
  await fixture.context.lobbyAction('enter', { roomId: 'room' });
  assert.equal(fixture.context.loaded.length, 0);
  assert.equal(fixture.entries.length, 1);
});

test("preview rendering skips combat, births and upgrades but full rendering still runs them", async () => {
  const events = [];
  const context = createContext({
    Spawner: { PLAYER_TRIBES: [{ key: 'bean' }] },
    unitPresentation: { prepareAnimation: async () => events.push('combat') },
    colonyAppearances: [{ sprite: { decode: async () => events.push('nest') } }],
    prepareNestGrowthRendering: async () => events.push('growth')
  });
  declaration('prepareTribeRendering', context);
  await context.prepareTribeRendering([{ tribe: 'bean' }], { previewOnly: true });
  assert.deepEqual(events, ['nest']);
  events.length = 0;
  await context.prepareTribeRendering([{ tribe: 'bean' }]);
  assert.equal(events.filter(value => value === 'combat').length, 1);
  assert.ok(events.includes('growth'));
});

test("world preparation still decodes hazards before drawing them", () => {
  const context = createContext({});
  declaration('prepareWorldRendering', context);
  const body = context.prepareWorldRendering.toString();
  assert.ok(body.indexOf('await Promise.all(hazardGroundSprites.map(sprite => sprite.decode()))') < body.indexOf('updateHazards(world.seed)'));
});

test("preview image retry replaces a stalled cached promise without a late rejection evicting its replacement", async () => {
  const artSource = readFileSync(new URL('./tribe-art.mjs', import.meta.url), 'utf8');
  const match = artSource.match(/^  function preparePreview\([^]*?^  }/m);
  assert.ok(match);
  const requests = [], previews = new Map();
  const context = createContext({ previews, bounds: () => ({}), image: path => {
    const request = Promise.withResolvers();
    requests.push({ ...request, path });
    return request.promise;
  } });
  runInContext(match[0], context);
  const tribe = { key: 'bean', nest: 'nest', idle: 'idle' };
  const first = context.preparePreview(tribe);
  const firstRejected = assert.rejects(first, /old failed/);
  assert.equal(context.preparePreview(tribe), first);
  const retry = context.preparePreview(tribe, { retry: true });
  requests[0].reject(new Error('old failed'));
  await firstRejected;
  assert.equal(previews.get('bean'), retry);
  requests[2].resolve({});
  requests[3].resolve({});
  await retry;
  assert.equal(context.preparePreview(tribe), retry);
});

test("repeated create clicks during preparation do not start duplicate requests", async () => {
  const fixture = lobby(null, true);
  const pending = fixture.context.lobbyAction('create', { title: 'test' });
  await fixture.started.promise;
  await fixture.context.lobbyAction('create', { title: 'test' });
  assert.equal(fixture.calls.filter(call => call.type === 'create').length, 1);
  fixture.rendering.resolve();
  await flush();
  for (const key of fixture.context.assets.keys()) fixture.context.resolveAsset(key);
  await pending;
  assert.equal(fixture.entries.length, 1);
});

function gameEntry() {
  const assets = Promise.withResolvers(), effects = Promise.withResolvers();
  const packet = { roomId: "room", colonyId: 1, colonies: [{ id: 1, tribe: "bean" }] };
  const app = { hidden: true, inert: true }, calls = [];
  const context = createContext({
    pebbleRoomEntryVersion: 0, roomPreparationVersion: 0, connection: {},
    resetEnding() {}, audio: { updateMusic() {} }, clearDiscoveryToasts() {}, foodDeliveries: new Map(), resetAudio() {},
    welcome: { hidden: false }, welcomeStatus: {}, tribeSelection: { hidden: true }, tribeSelectionStatus: {},
    setEvolutionText: (element, value) => { element.textContent = value; },
    pebbleBirthRuntime: { enter: async () => ({ stale: false }) }, rememberRoom() {},
    prepareTribeRendering: async () => {}, prepareAgentRendering: () => assets.promise,
    prepareDetailVfx: () => effects.promise,
    applySnapshot: () => { calls.push('snapshot'); context.connection.online = true; },
    terrainRendering: {}, closeEvolutionPanel() {}, closeColonyMenu() {}, selectObject() {}, state: {},
    document: { body: { dataset: { screen: 'welcome' } }, querySelector: () => app, getElementById: () => ({}) },
    canvas: { parentElement: { appendChild() {} }, focus() {} }, resizeCanvas() {}, focusColony() {}, updateEnding() {},
    client: { call: async name => calls.push(name) }
  });
  declaration('enterRoom', context);
  return { context, assets, effects, packet, app, calls };
}

test("game remains hidden and paused until unit art and effects are ready", async () => {
  const fixture = gameEntry();
  const pending = fixture.context.enterRoom('room', fixture.packet);
  await flush();
  assert.equal(fixture.context.connection.active, false);
  assert.equal(fixture.app.hidden, true);
  assert.deepEqual(fixture.calls, []);
  fixture.assets.resolve();
  await flush();
  assert.deepEqual(fixture.calls, []);
  fixture.effects.resolve();
  await pending;
  assert.equal(fixture.app.hidden, false);
  assert.equal(fixture.context.document.body.dataset.screen, 'game');
  assert.deepEqual(fixture.calls, ['snapshot', 'resume']);
});

test("failed unit preparation preserves the entry screen and does not resume simulation", async () => {
  const fixture = gameEntry();
  const pending = fixture.context.enterRoom('room', fixture.packet);
  await flush();
  fixture.assets.reject(new Error('unit art unavailable'));
  fixture.effects.resolve();
  await pending;
  assert.equal(fixture.context.connection.active, false);
  assert.equal(fixture.app.hidden, true);
  assert.equal(fixture.context.welcomeStatus.textContent, 'unit art unavailable');
  assert.deepEqual(fixture.calls, []);
});

test("a superseded room cannot open after its remaining assets finish", async () => {
  const fixture = gameEntry();
  const pending = fixture.context.enterRoom('room', fixture.packet);
  await flush();
  fixture.context.roomPreparationVersion++;
  fixture.assets.resolve(); fixture.effects.resolve();
  await pending;
  assert.equal(fixture.app.hidden, true);
  assert.deepEqual(fixture.calls, []);
});

test("a superseded room failure cannot deactivate a newer room", async () => {
  const fixture = gameEntry();
  const pending = fixture.context.enterRoom('room', fixture.packet);
  await flush();
  fixture.context.pebbleRoomEntryVersion++;
  fixture.context.connection.roomId = 'new-room';
  fixture.context.connection.active = true;
  fixture.context.welcomeStatus.textContent = 'new room ready';
  fixture.assets.reject(new Error('old room failed'));
  fixture.effects.resolve();
  await pending;
  assert.equal(fixture.context.connection.active, true);
  assert.equal(fixture.context.welcomeStatus.textContent, 'new room ready');
  assert.deepEqual(fixture.calls, []);
});
