import { APPROVED_SPROUT_DEATH_ANIMATIONS } from "./sprout-death-animations.mjs";

export const UNIT_COMBAT_DEATH_ANIMATIONS = Object.freeze({
  "sprout/blade": Object.freeze({ ...APPROVED_SPROUT_DEATH_ANIMATIONS.blade }),
  "sprout/piercing": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/sprout/piercing/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "sprout/carapace": Object.freeze({ ...APPROVED_SPROUT_DEATH_ANIMATIONS.carapace }),
  "spore/blade": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/spore/blade/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "spore/piercing": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/spore/piercing/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "spore/carapace": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/spore/carapace/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "pebble/blade": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/pebble/blade/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "pebble/piercing": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/pebble/piercing/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "pebble/carapace": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/pebble/carapace/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "spring/blade": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/spring/blade/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "spring/piercing": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/spring/piercing/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false}),
  "spring/carapace": Object.freeze({"action":"death","image":"DesignAssets/Animations/CombatDeathV1/spring/carapace/death.webp","frameSize":512,"columns":4,"frameCount":8,"pivotX":256,"pivotY":448,"durationsMs":[100,90,90,100,140,100,100,1100],"durationMs":1820,"loop":false})
});
