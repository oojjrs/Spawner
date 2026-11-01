export const TRIBE_UNIT_STATS = Object.freeze({
  bean: Object.freeze({ speed: .5, loadedSpeed: .4, lifespan: 60, lifespanWithAttribute: 180 }),
  spore: Object.freeze({ speed: .5, loadedSpeed: .4, lifespan: 60, lifespanWithAttribute: 180 }),
  pebble: Object.freeze({ speed: .35, loadedSpeed: .3, lifespan: 60, lifespanWithAttribute: 240 }),
  spring: Object.freeze({ speed: .9, loadedSpeed: .275, lifespan: 60, lifespanWithAttribute: 180 })
});

export const ATTRIBUTE_STAT_VALUES = Object.freeze({
  movementBonus: .3,
  movementMultiplier: .8,
  capacity: 2,
  vision: 6,
  attackBonus: 12,
  armorPenetration: .5,
  damageReduction: .45,
  guardProtection: .35,
  regeneration: 2,
  healing: 20
});
