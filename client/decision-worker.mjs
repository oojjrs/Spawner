import { createGame } from "../server/game.mjs";
import { buildingContains } from "../server/buildings.mjs";

let world;
self.onmessage = event => {
  const data = event.data;
  if (data.type === "world") { world = data.world; return; }
  try {
    world.treeCells = data.treeCells; world.hazards = data.hazards;
    const environment = { world, colonies: data.colonies, games: new Map(data.games), food: new Map(data.food),
      foodSpots: new Map(), simSeconds: data.simSeconds, hostId: data.hostId, targetRevision: data.targetRevision,
      creatureSystem: { ...data.creatures, burrowAt(x, y) {
        return data.creatures.burrows.find(burrow => buildingContains(burrow, x, y)) || null;
      } } };
    for (const cell of environment.food.values()) {
      if (cell.kind === "corpse") continue;
      const key = Math.floor(cell.x / 18) + "," + Math.floor(cell.y / 18);
      if (!environment.foodSpots.has(key)) environment.foodSpots.set(key, { cells: [] });
      environment.foodSpots.get(key).cells.push(cell);
    }
    const colony = data.colonies.find(value => value.ownerId === data.owner);
    const game = createGame(environment, colony, data.saved);
    environment.games.set(data.owner, game);
    game.prepare(data.simSeconds);
    const decisions = game.planDecisions(data.requests);
    postMessage({ results: data.requests.map((request, index) =>
      ({ ...request, time: data.simSeconds, candidates: decisions[index], foragerMemory: game.foragerMemory })) });
  } catch (error) { postMessage({ error: error.message }); }
};
