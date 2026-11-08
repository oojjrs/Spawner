import { ATTRIBUTE_DNA } from "./dna.mjs";
import { cloneDna } from "./dna-unit.mjs";

const recipes = [
  { antenna: 1, blade: 1, health: 3, power: 2, carapace: 1, movement: 1 },
  { antenna: 1, secretion: 1, health: 3, rangedPower: 3, movement: 1 },
  { antenna: 1, blade: 1, health: 4, power: 3, carapace: 1, movement: 1, combo: 1 },
  { antenna: 1, secretion: 1, health: 4, rangedPower: 4, movement: 1, rangedSpeed: 1 }
];
const placements = [
  [[0,0,0],[0,-1,1],[-2,1,1],[2,-3,5],[3,-1,0],[0,1,0],[0,-2,2],[1,-2,0],[0,-3,1]],
  [[0,0,0],[0,-1,3],[1,1,0],[3,-2,0],[-3,1,3],[-1,1,0],[0,-2,5],[-2,0,1],[-2,3,0]],
  [[0,-1,3],[-1,1,1],[0,-3,4],[1,-3,5],[3,-3,5],[-3,0,1],[0,-2,3],[1,-2,0],[2,0,0],[-2,1,2],[0,3,0],[0,0,0]],
  [[0,0,0],[0,-1,3],[-2,2,1],[3,-1,5],[-3,0,2],[0,-4,2],[-1,1,0],[0,-2,4],[1,-2,5],[-2,0,1],[0,4,0],[1,1,1]]
];
const formations = { bean: [0, 0, 0], spore: [1, 0, 1], pebble: [0, 0, 1], spring: [0, 0, 1] };
const designs = recipes.map((counts, index) => {
  const genes = Object.entries(counts).flatMap(([gene, count]) => Array(count).fill(gene));
  const pieces = genes.map((gene, i) => ({ gene, grade: ATTRIBUTE_DNA.lookup.get(gene).grade,
    q: placements[index][i][0], r: placements[index][i][1], rotation: placements[index][i][2] }));
  return { version: 6, level: index < 2 ? 2 : 3, budget: ATTRIBUTE_DNA.price(pieces), pieces };
});

export function tribeDefenseDesign(tribe, level, index) {
  if (!formations[tribe] || level < 2) return null;
  return cloneDna(designs[(level >= 3 ? 2 : 0) + formations[tribe][index % 3]]);
}

export function tribeDefenseAgent(agent) {
  return !!agent.dna && (agent.dna.level < 4 || designs.some(design =>
    JSON.stringify(design.pieces) === JSON.stringify(agent.dna.pieces)));
}
