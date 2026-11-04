import { COMBAT_EVOLUTION_ASSETS } from "./combat-evolution-assets.mjs";
import { UNIT_COMBAT_DEATH_ANIMATIONS } from "./combat-death.mjs";

export const COMBAT_ATTRIBUTE_ASSETS = Object.freeze([
  ...COMBAT_EVOLUTION_ASSETS,
  ...Object.values(UNIT_COMBAT_DEATH_ANIMATIONS).map(animation => animation.image),
  "DesignAssets/Attributes/CombatDnaV1/blade.png",
  "DesignAssets/Attributes/CombatDnaV1/piercing.png",
  "DesignAssets/Attributes/CombatDnaV1/carapace.png"
]);
