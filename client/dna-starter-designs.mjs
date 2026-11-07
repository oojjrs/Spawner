export const DNA_STARTER_DESIGNS = [
  {
    "id": "gatherer",
    "name": "기본 채집꾼",
    "design": {
      "version": 3,
      "level": 1,
      "budget": 0,
      "pieces": [
        {
          "gene": "gather",
          "grade": 1,
          "rotation": 0,
          "shape": [
            0,
            1
          ]
        },
        {
          "gene": "capacity",
          "grade": 1,
          "rotation": 3,
          "shape": [
            0,
            0
          ]
        },
        {
          "gene": "harvestSpeed",
          "grade": 1,
          "rotation": 4,
          "shape": [
            0,
            5
          ]
        }
      ]
    }
  },
  {
    "id": "melee",
    "name": "기본 근접 전사",
    "design": {
      "version": 3,
      "level": 2,
      "budget": 0,
      "pieces": [
        {
          "gene": "blade",
          "grade": 2,
          "rotation": 0,
          "shape": [
            0,
            2,
            3
          ]
        },
        {
          "gene": "antenna",
          "grade": 2,
          "rotation": 3,
          "shape": [
            0,
            4,
            0
          ]
        },
        {
          "gene": "power",
          "grade": 2,
          "rotation": 4,
          "shape": [
            0,
            0,
            1
          ]
        },
        {
          "gene": "health",
          "grade": 1,
          "rotation": 0,
          "shape": [
            0,
            4
          ]
        },
        {
          "gene": "movement",
          "grade": 1,
          "rotation": 5,
          "shape": [
            0,
            2
          ]
        },
        {
          "gene": "carapace",
          "grade": 2,
          "rotation": 0,
          "shape": [
            0,
            5,
            1
          ]
        }
      ]
    }
  },
  {
    "id": "ranged",
    "name": "기본 원거리 전사",
    "design": {
      "version": 3,
      "level": 2,
      "budget": 0,
      "pieces": [
        {
          "gene": "secretion",
          "grade": 2,
          "rotation": 0,
          "shape": [
            0,
            1,
            3
          ]
        },
        {
          "gene": "antenna",
          "grade": 2,
          "rotation": 2,
          "shape": [
            0,
            4,
            0
          ]
        },
        {
          "gene": "rangedPower",
          "grade": 2,
          "rotation": 3,
          "shape": [
            0,
            0,
            2
          ]
        },
        {
          "gene": "health",
          "grade": 1,
          "rotation": 5,
          "shape": [
            0,
            4
          ]
        },
        {
          "gene": "movement",
          "grade": 1,
          "rotation": 2,
          "shape": [
            0,
            2
          ]
        },
        {
          "gene": "carapace",
          "grade": 2,
          "rotation": 5,
          "shape": [
            0,
            5,
            1
          ]
        }
      ]
    }
  }
];
for(const entry of DNA_STARTER_DESIGNS){
  for(const piece of entry.design.pieces){Object.freeze(piece.shape);Object.freeze(piece);}
  Object.freeze(entry.design.pieces);Object.freeze(entry.design);Object.freeze(entry);
}
Object.freeze(DNA_STARTER_DESIGNS);