// Exact native raw00 body renderer for an external legacy birth scene.
// The caller owns source approval, mask00 eligibility, root travel, scene props, and effects.
import { sporeBirthMotion, springBirthMotion } from './birth.mjs';

export function drawUnitAppearanceBirthSceneBody(ctx, contract, sheet, options) {
  if (contract?.kind !== 'native-body-with-external-legacy-scene' || contract.mask !== 0 ||
      !contract.ownership?.bodyOnly || contract.body?.sourceId !== contract.sourceId) throw new Error('INVALID_NATIVE_BIRTH_SCENE');
  const clip = contract.body, { frame, elapsed, anchor, worldPixels, facing = 1, growth = 1, drawIdle } = options;
  if (frame === contract.visibility.lastFrame) { drawIdle?.(ctx, anchor, worldPixels, growth); return 'idle-handoff'; }
  if (frame < contract.visibility.firstBodyFrame) return 'body-hidden';
  const stage = contract.legacyPixelStage;
  const topLeft = options.topLeft || { x: anchor.x - worldPixels / 2,
    y: anchor.y - worldPixels / 2 - worldPixels * stage.agentHeight * stage.commonFloorOffsetFromHalfCell };
  const sourceX = frame % clip.columns * clip.frameSize, sourceY = Math.floor(frame / clip.columns) * clip.frameSize;
  ctx.save();
  // Keep the old Canvas operation order as well as its mathematically equal camera:
  // image-vs-canvas sampling and subpixel transform rounding otherwise alter edges.
  if (!options.outerDisplayScaleApplied) {
    ctx.translate(anchor.x, anchor.y);
    ctx.scale(stage.displayScale * growth, stage.displayScale * growth);
    ctx.translate(-anchor.x, -anchor.y);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (contract.deformation.kind === 'spore-affine-body-v1') {
    const baseScale = stage.nativeWorldPerPixelBeforeDisplay;
    const size = clip.frameSize * baseScale * worldPixels;
    const x = -clip.pivotX * baseScale * worldPixels, y = -clip.pivotY * baseScale * worldPixels;
    const motion = sporeBirthMotion(elapsed), height = contract.deformation.nativeHeight * baseScale * worldPixels;
    const frameImage = options.nativeFrame;
    if (!frameImage || frameImage.width !== clip.frameSize || frameImage.height !== clip.frameSize) {
      ctx.restore();
      throw Error('FIXED_NATIVE_FRAME_VIEW_REQUIRED');
    }
    ctx.translate(topLeft.x + worldPixels / 2, topLeft.y + worldPixels / 2 + worldPixels * stage.agentHeight * stage.commonFloorOffsetFromHalfCell);
    ctx.scale(facing, 1);
    ctx.scale(motion.scaleX, motion.scaleY);
    ctx.translate(0, -height * .5);
    ctx.rotate(motion.rotation);
    ctx.translate(0, height * .5);
    ctx.drawImage(frameImage, x, y, size, size);
    ctx.restore();
    return 'native-body';
  }
  if (contract.deformation.kind === 'spring-row-surface-v1') {
    const motion = springBirthMotion(elapsed), spec = contract.deformation;
    const nativeScale = worldPixels * stage.agentHeight * stage.referenceHeight / stage.canonicalFrameSize / spec.nativeHeight;
    const size = clip.frameSize * nativeScale;
    const x = topLeft.x + worldPixels / 2 - clip.pivotX * nativeScale;
    const y = topLeft.y + worldPixels / 2 + worldPixels * stage.agentHeight * stage.commonFloorOffsetFromHalfCell - clip.pivotY * nativeScale;
    const surfaceScale = size / clip.frameSize;
    ctx.translate(x + motion.anchorX * surfaceScale, y + motion.anchorY * surfaceScale);
    ctx.scale(motion.scaleX, motion.scaleY);
    for (let row = 0; row < clip.frameSize; row += spec.rowStep) {
      const height = Math.min(spec.rowStep, clip.frameSize - row);
      const depth = Math.max(0, Math.min(1, (row - spec.nativePivotY + spec.nativeHeight) / spec.nativeHeight));
      const width = 1 + motion.bulge * Math.sin(depth * Math.PI);
      const shift = motion.sway * spec.nativeHeight * Math.sin(depth * Math.PI * 2);
      ctx.drawImage(sheet, sourceX, sourceY + row, clip.frameSize, height,
        (-spec.nativeCenterX * width + spec.nativeCenterX - motion.anchorX + shift) * surfaceScale,
        (row - motion.anchorY) * surfaceScale, clip.frameSize * surfaceScale * width, height * surfaceScale);
    }
  } else {
    const nativeScale = worldPixels * stage.agentHeight * stage.unitHeight / stage.canonicalFrameSize / contract.deformation.nativeHeight;
    const size = clip.frameSize * nativeScale;
    const x = topLeft.x + worldPixels / 2 - clip.pivotX * nativeScale;
    const y = topLeft.y + worldPixels / 2 + worldPixels * stage.agentHeight * (stage.unitPivotY / stage.canonicalFrameSize - .5) - clip.pivotY * nativeScale;
    ctx.drawImage(sheet, sourceX, sourceY, clip.frameSize, clip.frameSize,
      x, y, size, size);
  }
  ctx.restore();
  return 'native-body';
}
