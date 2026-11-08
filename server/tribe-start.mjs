import { ATTRIBUTE_DNA } from "./dna.mjs";

// Worker production is affordable immediately; gathering funds nest growth.
export const PLAYER_STARTING_POINTS = 30;

export const TRIBE_STARTING_UNITS = Object.freeze({
  bean: Object.freeze([["antenna"], ["strength"], [], []].map(slots => Object.freeze(slots))),
  spore: Object.freeze([["strength"], ["blade"], [], []].map(slots => Object.freeze(slots))),
  pebble: Object.freeze([["strength"], ["strength"], ["antenna"], []].map(slots => Object.freeze(slots))),
  spring: Object.freeze([["feet"], ["feet"], ["antenna"], []].map(slots => Object.freeze(slots)))
});

export const STARTING_WORKER_GENES = Object.freeze({
  bean: Object.freeze(["gather", "capacity", "capacity", "capacity"]),
  spore: Object.freeze(["gather", "harvestSpeed", "capacity", "capacity"]),
  pebble: Object.freeze(["gather", "health", "capacity", "capacity"]),
  spring: Object.freeze(["gather", "movement", "capacity", "capacity"])
});

export function startingWorkerDna(tribe = "bean") {
  const genes = STARTING_WORKER_GENES[tribe] || STARTING_WORKER_GENES.bean;
  const pieces = ATTRIBUTE_DNA.pack(genes.map(id => {
    const gene = ATTRIBUTE_DNA.lookup.get(id);
    return { gene: gene.id, grade: gene.grade, rotation: 0 };
  }), 1);
  if (!pieces) throw new Error("시작 일꾼 DNA가 1레벨 보드에 맞지 않습니다.");
  return { version: 6, level: 1, budget: 30, pieces };
}
