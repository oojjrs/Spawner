import { SPRING_SECRETION_ASSETS } from "./spring-secretion-assets.mjs";
import { APPROVED_SPROUT_DEATH_ANIMATIONS } from "./sprout-death-animations.mjs";
import { PEBBLE_BIRTH_ANIMATION, SPRING_BIRTH_ANIMATION } from "./birth.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";

// Existing authored lifecycle bodies plus this form's own approved organ
// pixels. Keep the body's camera and clock; this is not a world-ready rig.
const bodies = {
  bean: { death: AGENT_DEATH_ANIMATION },
  spore: { death: UNIT_ANIMATIONS.spore.death },
  pebble: { birth: PEBBLE_BIRTH_ANIMATION, death: UNIT_ANIMATIONS.pebble.death },
  spring: { birth: SPRING_BIRTH_ANIMATION, death: UNIT_ANIMATIONS.spring.death }
};
// Bean birth uses its own source-space leaf/body adapter in unit-ranged.mjs,
// not a substituted atlas. This table contains only authored sheet routes.
export const UNIT_SECRETION_LIFECYCLE_ANIMATIONS = Object.freeze(Object.fromEntries(
  Object.entries(bodies).map(([tribe, actions]) => [tribe, Object.freeze(Object.fromEntries(
    Object.entries(actions).map(([action, body]) => [action, Object.freeze({ ...body,
      image: "DesignAssets/Animations/UnitRangedV1/" + tribe + "/" + action + ".png",
      bodyReferenceImage: body.image, secretionLifecycle: true,
      ...(["bean", "spore"].includes(tribe) ? { sourceFacing: "left" } : {}),
      // This separate frontal-left source keeps its original pixels.
      ...(tribe === "pebble" ? { sourceFacing: "left" } : {}),
      ...(tribe === "bean" && action === "death" ? APPROVED_SPROUT_DEATH_ANIMATIONS.secretion : {}),
      ...(tribe === "spring" ? SPRING_SECRETION_ASSETS[action] : {})
    })])
  ))])
));
export const UNIT_SECRETION_LIFECYCLE_ASSETS = Object.freeze(Object.values(UNIT_SECRETION_LIFECYCLE_ANIMATIONS)
  .flatMap(form => Object.values(form).map(animation => animation.image)));
