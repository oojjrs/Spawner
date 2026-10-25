import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { generateWorld } from "./world.mjs";
import { createGame } from "./game.mjs";
import { isTribeFood } from "./resources.mjs";

export function simulateStartingEconomy(world, randomSeed) {
  return world.camps.map((camp, order) => {
    const random = Math.random;
    let state = randomSeed >>> 0;
    Math.random = () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = Math.imul(state ^ state >>> 15, 1 | state);
      value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
    try {
      const colony = { id: order + 1, ownerId: "balance", tribe: camp.tribe === "sprout" ? "bean" : camp.tribe,
        x: camp.x - 2, y: camp.y - 2, occupiedCells: new Set() };
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!([0, 4].includes(x) && [0, 4].includes(y))) colony.occupiedCells.add(x + "," + y);
      const food = new Map([...world.food, ...world.resources].map(([x, y, amount, resourceType]) =>
        [x + "," + y, { x, y, amount, initialAmount: amount, resourceType, kind: "resource", terrain: ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge", "swamp"][world.terrain[y * 320 + x]] }]));
      const foodSpots = new Map();
      for (const cell of food.values()) {
        const key = Math.floor(cell.x / 18) + "," + Math.floor(cell.y / 18);
        if (!foodSpots.has(key)) foodSpots.set(key, { cells: [] });
        foodSpots.get(key).cells.push(cell);
      }
      const environment = { simSeconds: 0, seed: world.seed, world, colonies: [colony], games: new Map(), food, foodSpots };
      const game = createGame(environment, colony);
      environment.games.set(colony.ownerId, game);
      const template = game.command({ type: "design", templateId: null, name: "기본 개체", slots: [], birth: false });
      let births = 0, firstBirth = null, lastFood = 0, foundersDelivered = 0;
      const founders = new Set(game.agents.map(agent => agent.id)), deliveries = new Set(), hatched = new Set();
      for (let step = 1; step <= 1200; step++) {
        environment.simSeconds = step / 4;
        game.prepare(environment.simSeconds); game.tick(.25);
        for (const agent of game.agents) {
          if (!founders.has(agent.id) && (!agent.birth || agent.birth.readyAt <= environment.simSeconds)) hatched.add(agent.id);
          const delivery = agent.foodDelivery;
          if (!founders.has(agent.id) || !delivery?.receivedAt || !isTribeFood(delivery.resourceType, colony.tribe, world.generationVersion)) continue;
          const key = agent.id + ":" + delivery.receivedAt;
          if (!deliveries.has(key)) { foundersDelivered += delivery.amount; deliveries.add(key); }
        }
        if (game.colonyFood !== lastFood || step % 4 === 0) {
          lastFood = game.colonyFood;
          const available = lastFood - births * 3;
          if (available >= 3) {
            const result = game.command({ type: "design", templateId: template.templateId, name: "기본 개체", slots: [], birth: true });
            if (result.agentId) { births++; firstBirth ??= environment.simSeconds; }
          }
        }
      }
      return { tribe: colony.tribe, delivered: game.colonyFood, foundersDelivered, births,
        hatched: hatched.size,
        alive: game.agents.length, firstBirth, remainingPoints: game.colonyFood - births * 3 };
    } finally { Math.random = random; }
  });
}

export function summarizeBalance(results) {
  return results[0].simulation.map(entry => {
    const samples = results.map(result => result.simulation.find(sample => sample.tribe === entry.tribe));
    const mean = key => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
    return { tribe: entry.tribe, foundersDelivered: mean("foundersDelivered"), delivered: mean("delivered"),
      births: mean("births"), hatched: mean("hatched"), alive: mean("alive"),
      deliveredRange: [Math.min(...samples.map(sample => sample.delivered)), Math.max(...samples.map(sample => sample.delivered))] };
  });
}

export function balanceSeeds(count) {
  const seeds = new Set([0, 13, 413, 731047, 4294967295]);
  for (let index = 1; seeds.size < count; index++) seeds.add(Math.imul(index, 0x9E3779B1) >>> 0);
  return [...seeds].slice(0, count);
}

export function balanceVariation(results) {
  const seeds = results.map(result => {
    const delivered = result.simulation.map(entry => entry.delivered), hatched = result.simulation.map(entry => entry.hatched);
    return { seed: result.seed, deliveredRatio: Math.max(...delivered) / Math.max(1, Math.min(...delivered)),
      hatchedRatio: Math.max(...hatched) / Math.max(1, Math.min(...hatched)),
      minimumDelivered: Math.min(...delivered), maximumDelivered: Math.max(...delivered),
      delivered, hatched };
  });
  const sorted = seeds.map(seed => seed.deliveredRatio).sort((left, right) => left - right);
  return { seedCount: seeds.length, medianRatio: sorted[Math.floor((sorted.length - 1) * .5)],
    p90Ratio: sorted[Math.ceil(sorted.length * .9) - 1], worstRatio: sorted.at(-1),
    overOneAndHalf: sorted.filter(value => value > 1.5).length, overTwo: sorted.filter(value => value > 2).length,
    zeroYieldSeeds: seeds.filter(seed => seed.minimumDelivered === 0).map(seed => seed.seed), seeds };
}

function balanceSample(seed, version) {
  const world = generateWorld(seed, version);
  return { seed, generationVersion: world.generationVersion, resources: world.economy?.resources,
    starts: world.economy?.starts, simulation: simulateStartingEconomy(world, seed + 123) };
}

if (!isMainThread) {
  parentPort.postMessage(balanceSample(workerData.seed, workerData.version));
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), seeds = [];
  let count = 36, jobs = 4, version, output, baseline;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--output") output = args[++index];
    else if (args[index] === "--baseline") baseline = args[++index];
    else if (args[index] === "--count") count = Number(args[++index]);
    else if (args[index] === "--jobs") jobs = Number(args[++index]);
    else if (args[index] === "--version") version = Number(args[++index]);
    else if (/^\d+$/.test(args[index])) seeds.push(Number(args[index]));
    else throw new Error("알 수 없는 밸런스 계산 인수입니다.");
  }
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(jobs) || jobs < 1 || jobs > 8) throw new Error("표본 수와 병렬 계산 수를 확인해 주세요.");
  const selected = seeds.length ? seeds : balanceSeeds(count);
  const results = [];
  let cursor = 0;
  async function run() {
    while (cursor < selected.length) {
      const seed = selected[cursor++];
      const sample = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), { workerData: { seed, version } });
        worker.once("message", resolve); worker.once("error", reject);
        worker.once("exit", code => { if (code !== 0) reject(new Error("밸런스 계산이 중단되었습니다: " + seed)); });
      });
      results.push(sample);
      process.stdout.write(JSON.stringify({ completed: results.length, total: selected.length, seed,
        delivered: sample.simulation.map(entry => entry.delivered) }) + "\n");
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, selected.length) }, run));
  results.sort((left, right) => selected.indexOf(left.seed) - selected.indexOf(right.seed));
  const summary = summarizeBalance(results);
  const variation = balanceVariation(results);
  process.stdout.write(JSON.stringify({ summary, variation: { ...variation, seeds: undefined } }) + "\n");
  const previous = baseline ? JSON.parse(readFileSync(baseline, "utf8")) : null;
  if (output) writeFileSync(output, JSON.stringify({ seconds: 300, stepSeconds: .25,
    initialWorkers: "antenna + strength", birthCost: 3, newbornSlots: [], combat: false, lifespan: true, summary, variation, results,
    baseline: previous ? { summary: previous.summary, variation: balanceVariation(previous.results), results: previous.results } : undefined }, null, 2).replace(/\r?\n/g, "\r\n") + "\r\n");
}
