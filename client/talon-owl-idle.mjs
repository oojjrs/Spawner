export const TALON_OWL_IDLE = Object.freeze({
  image: "DesignAssets/Animations/TalonOwlIdle/PerchedV4/idle.webp",
  frameSize: 512,
  columns: 4,
  frameCount: 17,
  durationsMs: Object.freeze([1000, 180, 180, 240, 180, 180, 600, 70, 100, 70, 600, 60, 70, 450, 90, 100, 1200]),
  durationMs: 5370,
  pivotX: 234,
  pivotY: 400,
  scale: 2
});

export function talonOwlIdleFrame(elapsedMs) {
  let elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) % TALON_OWL_IDLE.durationMs : 0;
  for (let index = 0; index < TALON_OWL_IDLE.frameCount; index++) {
    if (elapsed + 1e-6 < TALON_OWL_IDLE.durationsMs[index]) return index;
    elapsed -= TALON_OWL_IDLE.durationsMs[index];
  }
  return 0;
}
