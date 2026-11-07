export const DNA_STARTER_DESIGNS = [
  {
    "id": "gatherer",
    "name": "기본 채집꾼",
    "design": {
      "version": 5,
      "pieces": [
        {
          "gene": "gather",
          "grade": 1,
          "rotation": 0,
          "q": 0,
          "r": 0
        },
        {
          "gene": "capacity",
          "grade": 1,
          "rotation": 0,
          "q": 0,
          "r": -1
        },
        {
          "gene": "harvestSpeed",
          "grade": 1,
          "rotation": 1,
          "q": -1,
          "r": 0
        }
      ],
      "budget": 0,
      "level": 1
    }
  },
  {
    "id": "melee",
    "name": "기본 근접 전사",
    "design": {
      "version": 5,
      "pieces": [
        {
          "gene": "blade",
          "grade": 2,
          "rotation": 3,
          "q": 0,
          "r": 0
        },
        {
          "gene": "antenna",
          "grade": 2,
          "rotation": 5,
          "q": 1,
          "r": -1
        },
        {
          "gene": "power",
          "grade": 2,
          "rotation": 3,
          "q": -1,
          "r": 0
        },
        {
          "gene": "health",
          "grade": 1,
          "rotation": 4,
          "q": 0,
          "r": -2
        },
        {
          "gene": "movement",
          "grade": 1,
          "rotation": 2,
          "q": 3,
          "r": -3
        },
        {
          "gene": "carapace",
          "grade": 2,
          "rotation": 1,
          "q": 1,
          "r": 0
        }
      ],
      "budget": 0,
      "level": 2
    }
  },
  {
    "id": "ranged",
    "name": "기본 원거리 전사",
    "design": {
      "version": 5,
      "pieces": [
        {
          "gene": "secretion",
          "grade": 2,
          "rotation": 0,
          "q": 0,
          "r": 0
        },
        {
          "gene": "antenna",
          "grade": 2,
          "rotation": 3,
          "q": 0,
          "r": -1
        },
        {
          "gene": "rangedPower",
          "grade": 2,
          "rotation": 1,
          "q": -1,
          "r": 1
        },
        {
          "gene": "health",
          "grade": 1,
          "rotation": 5,
          "q": 2,
          "r": -2
        },
        {
          "gene": "movement",
          "grade": 1,
          "rotation": 2,
          "q": -2,
          "r": -1
        },
        {
          "gene": "carapace",
          "grade": 2,
          "rotation": 4,
          "q": 1,
          "r": -2
        }
      ],
      "budget": 0,
      "level": 2
    }
  }
];
for(const entry of DNA_STARTER_DESIGNS){
  for(const piece of entry.design.pieces)Object.freeze(piece);
  Object.freeze(entry.design.pieces);Object.freeze(entry.design);Object.freeze(entry);
}
Object.freeze(DNA_STARTER_DESIGNS);
