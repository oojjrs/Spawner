export const TRIBE_UNIT_STATS = Object.freeze({
  bean: Object.freeze({ speed: .5, loadedSpeed: .4 }),
  spore: Object.freeze({ speed: .5, loadedSpeed: .4 }),
  pebble: Object.freeze({ speed: .35, loadedSpeed: .3 }),
  spring: Object.freeze({ speed: .9, loadedSpeed: .275 })
});

export const ATTRIBUTE_STAT_VALUES = Object.freeze({
  movementBonus: .3,
  capacity: 2,
  vision: 6,
  attackBonus: 12,
  armorPenetration: .5,
  damageReduction: .45
});

export function unitMovementInterval(speed, restReduction) {
  const period = 1 / speed;
  if (!restReduction || period <= 1) return period;
  const remaining = Math.max(0, 1 - restReduction / 100);
  return 1 + (period - 1) * remaining;
}
