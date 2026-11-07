import { NEUTRAL_UNIT_STATS } from "./neutral-unit-stats.mjs";
export const CREATURE_MOVEMENT_PROFILES = Object.freeze(Object.fromEntries([
  ["flower-tail-bird", 2, 3],
  ["dew-rabbit", 2.6, 2.5],
  ["soil-mole", .8, 5],
  ["bundle-snail", .4, 6],
  ["cotton-sheep", .8, 4],
  ["rolling-acorn", 1.8, 6],
  ["bubble-toad", .8, 20],
  ["snare-vine", 1.4, 30],
  ["spiny-back-beetle", 1.2, 18],
  ["soil-boar", 1.6, 24],
  ["vine-turtle", .4, 30],
  ["shadow-weasel", 2.6, 30],
  ["talon-owl", 2, 40],
  ["spring-keeper", 1.6, 30],
  ["lantern-keeper", 2.8, 30],
  ["old-garden-snail", .3, 45],
  ["walking-forest", .3, 60],
  ["white-paw", 3.2, 90],
  ["spiny-back-leader", 1.4, 120]
].map(([species, speed, restSeconds]) => [species, Object.freeze({ speed: NEUTRAL_UNIT_STATS[species]?.movement ?? speed, restSeconds })])));
