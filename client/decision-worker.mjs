import { createGame } from "../server/game.mjs";

let world, environment;
const games = new Map();
self.onmessage = event => {
  const data = event.data;
  if (data.type === "world") { world = data.world; environment = null; games.clear(); return; }
  try {
    world.treeCells = data.treeCells; world.hazards = data.hazards;
    if (!environment) environment = { world, games: new Map(), food: new Map(), foodSpots: new Map() };
    Object.assign(environment, { colonies: data.colonies, simSeconds: data.simSeconds,
      hostId: data.hostId, targetRevision: data.targetRevision,
      creatureSystem: { ...data.creatures, burrowAt(x, y) {
        return data.creatures.burrows.find(burrow => x >= burrow.x && x < burrow.x + burrow.width && y >= burrow.y && y < burrow.y + burrow.height) || null;
      } } });
    environment.games.clear();
    for (const [owner, game] of data.games) environment.games.set(owner, game);
    environment.food.clear(); environment.foodSpots.clear();
    for (const [key, cell] of data.food) {
      environment.food.set(key, cell);
      if (cell.kind === "corpse") continue;
      const region = Math.floor(cell.x / 18) + "," + Math.floor(cell.y / 18);
      if (!environment.foodSpots.has(region)) environment.foodSpots.set(region, { cells: [] });
      environment.foodSpots.get(region).cells.push(cell);
    }
    let game = games.get(data.owner);
    if (!game) {
      const colony = data.colonies.find(value => value.ownerId === data.owner);
      game = createGame(environment, colony, data.saved);
      games.set(data.owner, game);
      environment.games.set(data.owner, game);
      game.prepare(data.simSeconds);
    } else {
      environment.games.set(data.owner, game);
      game.updateDecisionState(data.saved);
    }
    const decisions = game.planDecisions(data.requests);
    postMessage({ results: data.requests.map((request, index) =>
      ({ ...request, time: data.simSeconds, candidates: decisions[index] })) });
  } catch (error) { postMessage({ error: error.message }); }
};