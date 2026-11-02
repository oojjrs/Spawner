import { SIMULATION_STATS, deriveSimulationStats, createSimulationTrial } from "./combat-simulation.mjs";

const statKeys = new Set(SIMULATION_STATS.map(stat => stat.key));

function validateBatch(count, seed) {
  if (!Number.isInteger(count) || count < 1 || count > 2000) throw new RangeError("count must be an integer between 1 and 2000");
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new RangeError("seed must be a uint32 integer");
}

export function runSimulationBatch(settings, count, seed) {
  validateBatch(count, seed);
  const leftProfile = deriveSimulationStats(settings.left, settings.rules);
  const rightProfile = deriveSimulationStats(settings.right, settings.rules);
  const report = { count, seed, leftWins: 0, rightWins: 0, draws: 0, timeouts: 0, noOffense: 0,
    meanDuration: 0, meanLeftHealth: 0, meanRightHealth: 0, meanLeftHealthRatio: 0, meanRightHealthRatio: 0,
    leftWinRate: 0, rightWinRate: 0, samples: [] };
  for (let index = 0; index < count; index++) {
    const sampleSeed = (seed + index) >>> 0;
    const trial = createSimulationTrial({ ...structuredClone(settings), seed: sampleSeed });
    const result = trial.finish();
    if (result.reason === "event-limit") throw new Error("Simulation event limit reached; adjust the experiment settings");
    if (!["left", "right", "draw"].includes(result.winner)) throw new Error("Simulation did not finish");
    if (!["death", "time-limit", "no-offense"].includes(result.reason) || !Number.isFinite(result.time) || result.time < 0 ||
        !Number.isFinite(result.leftHealth) || result.leftHealth < 0 || !Number.isFinite(result.rightHealth) || result.rightHealth < 0)
      throw new Error("Simulation returned an invalid result");
    if (result.winner === "left") report.leftWins++;
    else if (result.winner === "right") report.rightWins++;
    else report.draws++;
    if (result.reason === "time-limit") report.timeouts++;
    if (result.reason === "no-offense") report.noOffense++;
    const sample = { seed: sampleSeed, ...result, leftHealthRatio: result.leftHealth / leftProfile.health,
      rightHealthRatio: result.rightHealth / rightProfile.health };
    report.samples.push(sample);
    report.meanDuration += sample.time / count;
    report.meanLeftHealth += sample.leftHealth / count;
    report.meanRightHealth += sample.rightHealth / count;
    report.meanLeftHealthRatio += sample.leftHealthRatio / count;
    report.meanRightHealthRatio += sample.rightHealthRatio / count;
  }
  report.leftWinRate = report.leftWins / count;
  report.rightWinRate = report.rightWins / count;
  return report;
}

export function compareSimulationSwap(settings, side, removeKey, addKey, count, seed) {
  validateBatch(count, seed);
  if (!["left", "right"].includes(side)) throw new RangeError("side must be left or right");
  if (!statKeys.has(removeKey) || !statKeys.has(addKey) || removeKey === addKey)
    throw new RangeError("Select two different stat keys");
  const original = settings[side];
  const baselinePieces = deriveSimulationStats(original, settings.rules).pieceCount;
  if (!Number.isInteger(original.counts?.[removeKey]) || original.counts[removeKey] < 1)
    throw new RangeError("The removed stat must occupy a piece");
  const variantBuild = structuredClone(original);
  variantBuild.counts[removeKey]--;
  variantBuild.counts[addKey] = (variantBuild.counts[addKey] || 0) + 1;
  const variantPieces = deriveSimulationStats(variantBuild, settings.rules).pieceCount;
  if (baselinePieces !== variantPieces) throw new Error("Swap changed the piece count");
  const baseline = runSimulationBatch(settings, count, seed);
  const variant = runSimulationBatch({ ...structuredClone(settings), [side]: variantBuild }, count, seed);
  let pairedImproved = 0, pairedWorsened = 0, pairedUnchanged = 0;
  const score = sample => sample.winner === side ? 1 : sample.winner === "draw" ? .5 : 0;
  for (let index = 0; index < count; index++) {
    const difference = score(variant.samples[index]) - score(baseline.samples[index]);
    if (difference > 0) pairedImproved++;
    else if (difference < 0) pairedWorsened++;
    else pairedUnchanged++;
  }
  const winRate = side === "left" ? "leftWinRate" : "rightWinRate";
  return { side, removeKey, addKey, count, seed, baseline, variant, variantBuild,
    deltaWinRate: variant[winRate] - baseline[winRate], pairedImproved, pairedWorsened, pairedUnchanged,
    baselinePieces, variantPieces };
}
