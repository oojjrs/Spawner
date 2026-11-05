import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { createCombatAttributeArt } from "./combat-attributes.mjs";
import { createTribeAttributeAnimation } from "./attribute-animation.mjs";
import { createBeanCombatArt, BEAN_COMBAT_ART_ASSETS } from "./combat-stage-bean-art.mjs";
import { imageFrameGeometry } from "./image-geometry.mjs";
import { unitDisplaySize } from "./unit-size.mjs";

// Existing approved renderers are a fallback below world-ready unified art.
// This adapter neither registers new art nor changes the readiness inventory.
export function createCombatStageAppearance(image) {
  let combat, attributes, bean;
  const prepared = new Map(), retryAfter = new Map(), referenceSizes = new Map();
  const beanImages = new Map();
  const source = path => globalThis.SpawnerAssets?.source(path) || path;
  const surface = (width, height) => {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; return canvas;
  };
  const load = async path => {
    const ready = image(path);
    if (ready) return ready;
    const asset = globalThis.SpawnerAssets?.image?.() || new Image();
    asset.src = source(path); await asset.decode();
    if (!asset.complete || !asset.naturalWidth) throw new Error("Appearance image is unavailable");
    return asset;
  };
  function prepare(key, renderer, tribe) {
    const now = Date.now();
    if (!prepared.has(key) && now >= (retryAfter.get(key) ?? -Infinity)) {
      prepared.set(key, renderer.prepare(tribe).then(() => true).catch(() => {
        prepared.delete(key); retryAfter.set(key, now + 2000); return false;
      }));
    }
  }

  function referenceSize(agent, key) {
    if (referenceSizes.has(key)) return referenceSizes.get(key);
    const portrait = combat.portrait(agent);
    if (!portrait) return null;
    try {
      const { width, height } = portrait;
      const pixels = portrait.getContext("2d").getImageData(0, 0, width, height).data;
      let left = width, right = 0, top = height, bottom = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] >= 16) {
        left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      }
      const length = Math.max(right - left, bottom - top);
      if (!(length > 0)) return null;
      referenceSizes.set(key, length); return length;
    } catch { return null; }
  }

  function draw(context, agent, time, deathAge, fallback, cell, mirror) {
    if (agent.species || !["bean", "spore", "pebble", "spring"].includes(agent.tribe) ||
        !globalThis.document?.createElement) return false;
    const visual = unitDisplayAttributes(agent);
    // Historical compound rigs retain the pre-existing laboratory fallback;
    // selecting one retired organ here would silently discard their authored rig.
    if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => visual[key] > 0)) return false;
    const evolved = visual.blade > 0 || visual.carapace > 0;
    if (!evolved && !(visual.antenna > 0 || visual.feet > 0)) return false;
    let sprite, scale, pivotX, pivotY;
    if (evolved) {
      combat ||= createCombatAttributeArt(source, surface, load);
      prepare("combat/" + agent.tribe, combat, agent.tribe);
      if (!combat.ready(agent.tribe)) return false;
      const local = agent.health <= 0 ? { ...agent, diedAt: time - deathAge } : agent;
      sprite = combat.frame(local, time, 1);
      const length = referenceSize(local, agent.tribe + "/" + (visual.blade > 0 ? "blade" : "carapace"));
      if (!sprite || !length) return false;
      // Match the laboratory's unit-size/growth contract, then keep the
      // compositor's own ground pivot rather than fitting its padded camera.
      // The arena sizes a unit by its full idle silhouette, including cap or
      // weapon. Use one fixed reference for every action, never per-frame fit.
      scale = cell * unitDisplaySize(agent) / length;
      pivotX = sprite.combatCamera?.pivotX ?? 256; pivotY = sprite.combatCamera?.pivotY ?? 448;
    } else {
      const { pose, asset } = fallback;
      if (!pose || !asset || pose.animation.rangedBody) return false;
      let animation = pose.animation, frame = pose.frame;
      if (agent.tribe === "bean") {
        // Keep decoded parts separately so the bean compositor can recover
        // as soon as a bounded asset retry succeeds.
        prepare("bean", { prepare: () => Promise.all(BEAN_COMBAT_ART_ASSETS.map(async path => {
          beanImages.set(path, await load(path));
        })) });
        bean ||= createBeanCombatArt({ createSurface: surface, imageFor: path => beanImages.get(path) || image(path) });
        sprite = bean.frame(asset, animation, frame, { antenna: visual.antenna || 0, feet: visual.feet || 0 }, pose.action);
      } else {
        attributes ||= createTribeAttributeAnimation(source, surface, load);
        prepare("attributes/" + agent.tribe, attributes, agent.tribe);
        const tracked = attributes.pose(agent, pose, time);
        animation = tracked.sourceAnimation || animation; frame = tracked.sourceFrame ?? frame;
        const sourceImage = image(animation.image);
        if (!sourceImage) return false;
        sprite = attributes.frame(agent.tribe, visual, sourceImage, animation, frame, pose.action, time, tracked);
      }
      if (!sprite) return false;
      const size = fallback.sizeFor?.({ ...pose, animation, frame }) ?? fallback.size;
      const geometry = imageFrameGeometry(animation, frame), padding = (sprite.width - geometry.frameSize) / 2;
      scale = size * (geometry.registrationScale || 1) / (geometry.viewSize || geometry.frameSize);
      pivotX = geometry.pivotX + padding; pivotY = geometry.pivotY + padding;
    }
    context.save(); context.scale(mirror ? -1 : 1, 1);
    context.drawImage(sprite, -pivotX * scale, -pivotY * scale, sprite.width * scale, sprite.height * scale);
    context.restore(); return true;
  }
  return { draw };
}
