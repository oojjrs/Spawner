export const UNIT_DISPLAY_SIZES = Object.freeze({
  bean: .40, spore: .38, pebble: .42, spring: .39,
  "flower-tail-bird": .26, "dew-rabbit": .29, "cotton-sheep": .32,
  "soil-mole": .35, "bundle-snail": .38, "rolling-acorn": .38,
  "bubble-toad": .52, "vine-turtle": .52, "spiny-back-beetle": .58,
  "snare-vine": .62, "soil-boar": .66, "shadow-weasel": .72, "talon-owl": .78,
  "spring-keeper": .88, "lantern-keeper": .92, "old-garden-snail": 1.00, "walking-forest": 1.12,
  "spiny-back-leader": 1.24, "white-paw": 1.44
});

export function unitDisplaySize(unit) {
  const scale=Array.isArray(unit.dna?.pieces)?1+.01*unit.dna.pieces.length:1;
  return (UNIT_DISPLAY_SIZES[unit.species || unit.tribe || "bean"] || UNIT_DISPLAY_SIZES.bean)*scale;
}
