import { ATTRIBUTE_DNA } from "./dna.mjs";

// Worker production is affordable immediately; gathering funds nest growth.
export const PLAYER_STARTING_POINTS = 30;

export const TRIBE_STARTING_UNITS = Object.freeze({
  bean: Object.freeze([["antenna"], ["strength"], [], []].map(slots => Object.freeze(slots))),
  spore: Object.freeze([["strength"], ["blade"], [], []].map(slots => Object.freeze(slots))),
  pebble: Object.freeze([["strength"], ["strength"], ["antenna"], []].map(slots => Object.freeze(slots))),
  spring: Object.freeze([["feet"], ["feet"], ["antenna"], []].map(slots => Object.freeze(slots)))
});

// Each tribe gets a modest legal level-one worker, priced through the same
// DNA catalog as user designs (currently 17P each, including birth cost).
export const STARTING_WORKER_GENES = Object.freeze({
  bean: Object.freeze(["gather", "capacity", "capacity", "capacity"]),
  spore: Object.freeze(["gather", "harvestSpeed", "capacity", "capacity"]),
  pebble: Object.freeze(["gather", "health", "capacity", "capacity"]),
  spring: Object.freeze(["gather", "movement", "capacity", "capacity"])
});

export function startingWorkerDna(tribe = "bean") {
  const genes = STARTING_WORKER_GENES[tribe] || STARTING_WORKER_GENES.bean;
  const place = (index, pieces) => {
    if (index === genes.length) return pieces;
    const gene = ATTRIBUTE_DNA.lookup.get(genes[index]);
    for (let rotation = 0; rotation < 6; rotation++) {
      const next = [...pieces, { gene: gene.id, grade: gene.grade, rotation, shape: [...gene.steps] }];
      const trace = ATTRIBUTE_DNA.trace(next, 1);
      if (!trace.valid || trace.closed && index < genes.length - 1) continue;
      const result = place(index + 1, next);
      if (result) return result;
    }
    return null;
  };
  const pieces = place(0, []);
  if (!pieces) throw new Error("시작 일꾼 DNA가 1레벨 보드에 맞지 않습니다.");
  return { version: 3, level: 1, budget: 30, pieces };
}
