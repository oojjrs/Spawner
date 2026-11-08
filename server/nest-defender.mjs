// Ordinary, editable DNA. These level-two designs use the same prices and combat rules as player designs.
const designs = {
  "bean": {
    "version": 6,
    "level": 2,
    "budget": 0,
    "pieces": [
      {
        "gene": "blade",
        "grade": 2,
        "rotation": 0,
        "q": -4,
        "r": 3
      },
      {
        "gene": "carapace",
        "grade": 2,
        "rotation": 3,
        "q": 4,
        "r": -2
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 0,
        "q": 0,
        "r": -4
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 5,
        "q": -4,
        "r": 2
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 2,
        "q": 2,
        "r": 2
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": 3,
        "r": -4
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": -1,
        "r": -3
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": -3,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": 3,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": 4,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": 0,
        "r": 0
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": 2,
        "r": 1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": -3,
        "r": 2
      },
      {
        "gene": "regeneration",
        "grade": 1,
        "rotation": 3,
        "q": 0,
        "r": -1
      }
    ]
  },
  "spore": {
    "version": 6,
    "level": 2,
    "budget": 0,
    "pieces": [
      {
        "gene": "secretion",
        "grade": 2,
        "rotation": 0,
        "q": 1,
        "r": -3
      },
      {
        "gene": "carapace",
        "grade": 2,
        "rotation": 1,
        "q": -4,
        "r": 1
      },
      {
        "gene": "rangedPower",
        "grade": 2,
        "rotation": 0,
        "q": 3,
        "r": -4
      },
      {
        "gene": "rangedPower",
        "grade": 2,
        "rotation": 0,
        "q": -2,
        "r": -2
      },
      {
        "gene": "rangedPower",
        "grade": 2,
        "rotation": 3,
        "q": 1,
        "r": 0
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": 1,
        "r": -4
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": -2,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": 4,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": -3,
        "r": 1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": -1,
        "r": 1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": 1,
        "r": 1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": -1,
        "r": 3
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": 1,
        "r": 3
      },
      {
        "gene": "regeneration",
        "grade": 1,
        "rotation": 2,
        "q": 3,
        "r": -1
      }
    ]
  },
  "pebble": {
    "version": 6,
    "level": 2,
    "budget": 0,
    "pieces": [
      {
        "gene": "blade",
        "grade": 2,
        "rotation": 0,
        "q": 0,
        "r": -3
      },
      {
        "gene": "carapace",
        "grade": 2,
        "rotation": 3,
        "q": 4,
        "r": -4
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 2,
        "q": 1,
        "r": 1
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 4,
        "q": -4,
        "r": 2
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 2,
        "q": 2,
        "r": 2
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": 4,
        "r": -3
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": 1,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": 4,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": -1,
        "r": 0
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": -3,
        "r": 1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": -4,
        "r": 3
      },
      {
        "gene": "regeneration",
        "grade": 1,
        "rotation": 5,
        "q": -2,
        "r": -1
      }
    ]
  },
  "spring": {
    "version": 6,
    "level": 2,
    "budget": 0,
    "pieces": [
      {
        "gene": "blade",
        "grade": 2,
        "rotation": 0,
        "q": -4,
        "r": 3
      },
      {
        "gene": "carapace",
        "grade": 2,
        "rotation": 3,
        "q": 4,
        "r": -2
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 0,
        "q": 0,
        "r": -4
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 5,
        "q": -4,
        "r": 2
      },
      {
        "gene": "power",
        "grade": 2,
        "rotation": 2,
        "q": 2,
        "r": 2
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": 3,
        "r": -4
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": -1,
        "r": -3
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": -3,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": 3,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": 4,
        "r": -1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 1,
        "q": 0,
        "r": 0
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 2,
        "q": 2,
        "r": 1
      },
      {
        "gene": "health",
        "grade": 1,
        "rotation": 0,
        "q": -3,
        "r": 2
      },
      {
        "gene": "regeneration",
        "grade": 1,
        "rotation": 3,
        "q": 0,
        "r": -1
      }
    ]
  }
};

export function nestDefenderDesign(tribe = "bean") {
  const design = designs[tribe] || designs.bean;
  return { name: "둥지 수비대", design: { ...design, pieces: design.pieces.map(piece => ({ ...piece })) } };
}

// The saved role follows this design's offspring, not every carapace unit.
// Adding antenna/gather or removing the weapon restores the normal DNA behavior.
export function isNestDefender(unit) {
  return unit.defenseMode === "nest" && !!unit.dna &&
    unit.dna.pieces.some(piece => ["blade", "secretion"].includes(piece.gene)) &&
    !unit.dna.pieces.some(piece => ["antenna", "gather"].includes(piece.gene));
}
