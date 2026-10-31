const territories = new Map([
  ["soil-boar", 4, 6], ["bubble-toad", 3, 4], ["vine-turtle", 3, 4], ["shadow-weasel", 5, 8],
  ["snare-vine", 2, 4], ["talon-owl", 6, 8], ["white-paw", 6, 10], ["spiny-back-leader", 5, 8]
].map(([species, detectionRadius, pursuitRadius]) => [species, Object.freeze({ roamRadius: 4, detectionRadius, pursuitRadius })]));

export function encounterTerritory(agent) {
  return territories.get(agent.species) || null;
}

export function withinEncounterTerritory(agent, cell, pursuit) {
  const territory = encounterTerritory(agent);
  return !territory || Math.hypot(cell.x - agent.homeX, cell.y - agent.homeY) <=
    (pursuit ? territory.pursuitRadius : territory.roamRadius);
}
