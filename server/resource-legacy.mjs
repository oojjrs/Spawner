export const LEGACY_FOOD_HABITATS = Object.freeze([
  ["honey-mushrooms", ["forest"], []],
  ["tree-fruit", ["forest"], []],
  ["berry-bush", ["grassland"], ["forest"]],
  ["seed-pods", ["land", "grassland"], []],
  ["root-bulbs", ["grassland"], []],
  ["nutrient-moss", ["forest"], []]
].map(([key, terrains, neighbors]) => Object.freeze({
  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors)
})));

export const LEGACY_RESOURCE_HABITATS = Object.freeze([
  {"key":"twigs","terrains":["forest"],"neighbors":[],"rarity":"common","minDistance":4,"nodes":48,"separation":6},
  {"key":"bark","terrains":["forest"],"neighbors":[],"rarity":"uncommon","minDistance":24,"nodes":20,"separation":8},
  {"key":"pebbles","terrains":["coast","land","lowMountain"],"neighbors":[],"rarity":"common","minDistance":4,"nodes":36,"separation":7},
  {"key":"clay","terrains":["coast","grassland"],"neighbors":["deep","shallow","coast"],"rarity":"uncommon","minDistance":24,"nodes":20,"separation":8},
  {"key":"sand","terrains":["coast"],"neighbors":[],"rarity":"common","minDistance":4,"nodes":28,"separation":7},
  {"key":"grass-fiber","terrains":["grassland"],"neighbors":[],"rarity":"common","minDistance":4,"nodes":42,"separation":6},
  {"key":"root-fiber","terrains":["forest","grassland"],"neighbors":["forest"],"rarity":"uncommon","minDistance":24,"nodes":18,"separation":9},
  {"key":"spider-silk","terrains":["forest","lowMountain"],"neighbors":[],"rarity":"uncommon","minDistance":30,"nodes":12,"separation":10},
  {"key":"water","terrains":["coast"],"neighbors":["deep","shallow"],"rarity":"common","minDistance":4,"nodes":24,"separation":8},
  {"key":"tree-sap","terrains":["forest"],"neighbors":[],"rarity":"uncommon","minDistance":28,"nodes":16,"separation":10},
  {"key":"leaf-mold","terrains":["forest"],"neighbors":[],"rarity":"uncommon","minDistance":24,"nodes":20,"separation":8},
  {"key":"resin","terrains":["forest"],"neighbors":[],"rarity":"rare","minDistance":42,"nodes":10,"separation":8},
  {"key":"beeswax","terrains":["forest"],"neighbors":[],"rarity":"rare","minDistance":42,"nodes":6,"separation":10},
  {"key":"carapace","terrains":["grassland","forest","lowMountain"],"neighbors":[],"rarity":"uncommon","minDistance":30,"nodes":12,"separation":11},
  {"key":"iron-ore","terrains":["lowMountain"],"neighbors":[],"rarity":"rare","minDistance":48,"nodes":10,"separation":9},
  {"key":"copper-ore","terrains":["lowMountain"],"neighbors":[],"rarity":"rare","minDistance":48,"nodes":8,"separation":9},
  {"key":"quartz","terrains":["lowMountain"],"neighbors":[],"rarity":"rare","minDistance":56,"nodes":5,"separation":10}
]);
