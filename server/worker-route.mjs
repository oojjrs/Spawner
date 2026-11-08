// A completed return trip measures already traversed cells, never hidden food or
// a guessed straight line. Average both directions so the same distance models
// empty outbound and loaded inbound travel with their separate base speeds.
export function recordWorkerRoute(state, agent, speedMultiplierAt) {
 const route = agent.returnPath;
 if (!(agent.carrying > 0) || agent.combat || agent.retreat || !Array.isArray(route) || route.length < 2 || route.length > 256) return;
 if (route.at(-1).x !== agent.x || route.at(-1).y !== agent.y) return;
 let distance = 0;
 for (let index = 1; index < route.length; index++) {
  const from = route[index - 1], to = route[index];
  if (![from.x, from.y, to.x, to.y].every(Number.isInteger) || Math.abs(to.x - from.x) + Math.abs(to.y - from.y) !== 1) return;
  const first = speedMultiplierAt(from), second = speedMultiplierAt(to);
  if (!(first > 0) || !(second > 0) || !Number.isFinite(first + second)) return;
  distance += .5 / first + .5 / second;
 }
 const samples = (state.workerRouteSamples || []).filter(sample => Number.isFinite(sample.at) &&
  sample.at <= state.simSeconds && sample.at > state.simSeconds - 300 && Number.isFinite(sample.distance) && sample.distance > 0);
 samples.push({ at: state.simSeconds, distance });
 state.workerRouteSamples = samples.slice(-8);
 // Let the next production decision use the newly completed journey.
 state.workerRouteMeasuredAt = 0;
}
