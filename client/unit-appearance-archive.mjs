import { UNIT_DISPLAY_MASKS } from "./unit-display-appearance.mjs";

// An accepted body study is not a complete game action. Keep its exact source,
// review evidence and loop in the manifest, without exposing it to runtime clips.
export function validateArchivedBodyAction(source, action, archive, { hashFile, imageDimensions }) {
  const fail = detail => { throw new Error(`APPEARANCE ARCHIVED BODY ${detail} : ${source.tribe}/${source.mask.toString(16)}/${action}`); };
  const clip = archive?.clip, approval = archive?.approval, clock = archive?.clock;
  if (source.approvalState !== "approved" || source.cameraVerified !== true ||
      archive?.kind !== "approved-source-locked-body-loop" || archive.scope !== "archived-original-art" ||
      archive.sourceId !== source.sourceId || archive.sourceHash !== source.sourceHash ||
      archive.tribe !== source.tribe || archive.mask !== source.mask || archive.action !== action ||
      UNIT_DISPLAY_MASKS.includes(source.mask) || archive.canonicalTarget !== false ||
      archive.runtimeEnabled !== false || archive.worldActionComplete !== false ||
      archive.ownership?.bodyOnly !== true || archive.ownership.cargo !== "external" ||
      archive.ownership.contactAndYield !== "existing-resource-scene-and-server" ||
      !Array.isArray(archive.ownership.events) || archive.ownership.events.length) fail("CONTRACT MISMATCH");
  if (approval?.state !== "approved" || approval.scope !== "body-motion-only" ||
      approval.evidence?.source !== "parent-conversation" || !approval.evidence.assistant || !approval.evidence.user)
    fail("APPROVAL MISSING");
  for (const evidence of [approval.reviewedAsset, archive.validation?.offlineReport]) {
    if (!evidence?.path || !evidence.sha256 || hashFile(evidence.path) !== evidence.sha256) fail("EVIDENCE CHANGED");
  }
  if (clip?.sourceId !== source.sourceId || clip.sourceHash !== source.sourceHash ||
      clip.frameSize !== source.frameWidth || source.frameWidth !== source.frameHeight ||
      clip.pivotX !== source.pivot.x || clip.pivotY !== source.pivot.y || clip.cameraMapping ||
      !Number.isInteger(clip.columns) || clip.columns <= 0 || !Number.isInteger(clip.frameCount) || clip.frameCount <= 1 ||
      clip.loop !== true || !Array.isArray(clip.events) || clip.events.length ||
      !Array.isArray(clip.frames) || !Array.isArray(clip.durationsMs) || !clip.frames.length ||
      clip.frames.length !== clip.durationsMs.length ||
      clip.frames.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= clip.frameCount) ||
      clip.durationsMs.some(ms => !Number.isFinite(ms) || ms <= 0)) fail("CLIP MISMATCH");
  if (!clip.image || !clip.imageHash || hashFile(clip.image) !== clip.imageHash) fail("IMAGE CHANGED");
  const [width, height] = imageDimensions(clip.image);
  if (width !== clip.columns * clip.frameSize || height !== Math.ceil(clip.frameCount / clip.columns) * clip.frameSize)
    fail("ATLAS MISMATCH");
  if (!Number.isFinite(clock?.loopDurationMs) || clock.loopDurationMs !== clip.durationsMs.reduce((a, b) => a + b, 0) ||
      !Number.isInteger(clock.closureProofFrame) || clock.closureProofFrame < 0 || clock.closureProofFrame >= clip.frameCount ||
      clip.frames.includes(clock.closureProofFrame) ||
      clock.entry?.blendImplemented !== false || clock.recovery?.status !== "not-implemented" ||
      clock.recovery.interruptionVerified !== false || clock.recovery.reentryVerified !== false ||
      clock.simulationClockChanged !== false || clock.cargoClockChanged !== false || clock.resourceYieldClockChanged !== false)
    fail("CLOCK CONTRACT MISMATCH");
  return archive;
}
