// A deposited resource remains one collected resource. This conversion is the
// common player/AI evolution income, independent of species and cargo design.
export const RESOURCE_EVOLUTION_POINTS = 1;

export function resourceEvolutionPoints(amount) {
  return Math.max(0, amount) * RESOURCE_EVOLUTION_POINTS;
}
