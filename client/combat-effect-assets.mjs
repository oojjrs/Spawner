const root = "DesignAssets/Animations/CombatEffectsV2/";

export const COMBAT_EFFECT_ANIMATIONS = Object.freeze({
  bleed: Object.freeze({ image: root + "bleed.webp", frameWidth: 64, frameHeight: 64, columns: 4, frameCount: 16, frameMs: 1000 / 12, durationMs: 4000 / 3, loop: false, stillFrame: 6 }),
  drain: Object.freeze({ image: root + "drain.webp", frameWidth: 64, frameHeight: 64, columns: 4, frameCount: 16, frameMs: 1000 / 12, durationMs: 4000 / 3, loop: false, stillFrame: 6 }),
  stun: Object.freeze({ image: root + "stun.webp", frameWidth: 128, frameHeight: 80, columns: 9, frameCount: 72, frameMs: 1000 / 30, durationMs: 2400, loop: true, stillFrame: 0 })
});

export const COMBAT_EFFECT_ASSETS = Object.freeze(Object.values(COMBAT_EFFECT_ANIMATIONS).map(animation => animation.image));

export function combatEffectFrame(animation, elapsedMs, reducedMotion) {
  if (!animation || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  if (reducedMotion) return animation.stillFrame;
  const elapsed = animation.loop ? elapsedMs % animation.durationMs : Math.min(elapsedMs, animation.durationMs);
  return Math.min(animation.frameCount - 1, Math.floor(elapsed / animation.frameMs));
}

export function drawCombatEffect(context, image, animation, frame, x, y, width, height) {
  if (!image || image.complete === false || !(image.naturalWidth || image.width) ||
      !Number.isInteger(frame) || frame < 0 || frame >= animation.frameCount ||
      ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return false;
  const left = frame % animation.columns * animation.frameWidth;
  const top = Math.floor(frame / animation.columns) * animation.frameHeight;
  if (left + animation.frameWidth > (image.naturalWidth || image.width) ||
      top + animation.frameHeight > (image.naturalHeight || image.height)) return false;
  context.drawImage(image, left, top, animation.frameWidth, animation.frameHeight, x - width / 2, y - height / 2, width, height);
  return true;
}
