export const TRIBE_DNA_STATS = Object.freeze(Object.fromEntries(Object.entries({
  bean: {
    base: { health: 1, armor: 0, meleePower: 1, rangedPower: 1, meleeSpeed: 1, rangedSpeed: 1, movement: 1 },
    growth: {}
  },
  pebble: {
    base: { health: 1.2, armor: 6, meleePower: .85, rangedPower: .85, meleeSpeed: .9, rangedSpeed: .9, movement: .9, gatherCapacity: 2, loadSpeed: 65 },
    growth: { health: 1.2, carapace: 1.6, armor: 1.6, power: .85, rangedPower: .85, speed: .9, rangedSpeed: .9,
      block: 1.2, tenacity: 1.2, reduction: 1.15, reflection: 1.2, regeneration: 1.2, evasion: .8, movement: .85, gatherMovement: 1.2 }
  },
  spore: {
    base: { health: .9, armor: 0, meleePower: .85, rangedPower: 1.15, meleeSpeed: .95, rangedSpeed: 1.05, movement: 1, gatherMovement: .55 },
    growth: { health: .85, carapace: .85, armor: .85, power: .8, rangedPower: 1.25, speed: .9, rangedSpeed: 1.15,
      accuracy: 1.2, penetration: 1.1, critical: 1.1, evasion: .9, block: .85, regeneration: .9, movement: .95 }
  },
  spring: {
    base: { health: .95, armor: 0, meleePower: 1.1, rangedPower: .85, meleeSpeed: 1.05, rangedSpeed: .95, movement: 1 },
    growth: { health: .95, carapace: .8, armor: .8, power: 1.2, rangedPower: .8, speed: 1.15, rangedSpeed: .9,
      evasion: 1.2, parry: 1.1, counter: 1.15, lifesteal: 1.15, regeneration: 1.05, focus: 1.1, movement: 1.15, gatherMovement: .9 }
  }
}).map(([tribe, profile]) => [tribe, Object.freeze({ base: Object.freeze(profile.base), growth: Object.freeze(profile.growth) })])));

export function tribeDnaStats(tribe) {
  return Object.hasOwn(TRIBE_DNA_STATS, tribe) ? TRIBE_DNA_STATS[tribe] : TRIBE_DNA_STATS.bean;
}
