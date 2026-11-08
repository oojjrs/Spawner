import { imageDimensions } from "./image-audit.mjs";
import { unitAppearanceReadiness } from "./unit-appearance.mjs";
import { validateArchivedBodyAction } from "./unit-appearance-archive.mjs";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, rmSync } from "node:fs";
import { resolve, dirname, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, unitAppearanceKey } from "../server/unit-appearance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), records = {}, runtime = {}, files = {};
process.stdout.write("UnitAppearanceBuilder> BUILD BEGIN.\n");
function assetPath(image) {
  const path = resolve(root, image);
  if (!path.startsWith(root + sep)) throw new Error(`APPEARANCE ASSET LEAVES PROJECT : ${image}`);
  return path;
}
function hashFile(image) { return createHash("sha256").update(readFileSync(assetPath(image))).digest("hex"); }
function writeText(path, text) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text.replace(/\r?\n/g, existsSync(path) && readFileSync(path, "utf8").includes("\r\n") ? "\r\n" : "\n"), "utf8"); }
function pick(value, keys) { return Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]])); }
function registerFile(image) {
  if (files[image]) return;
  const extension = extname(image), mime = { ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" }[extension];
  if (!mime) throw new Error(`UNSUPPORTED APPEARANCE RUNTIME IMAGE : ${image}`);
  const bytes = readFileSync(assetPath(image)), relative = image.replace(/^DesignAssets\//, ""), script = `client/unit-appearance-files/${relative}.js`;
  files[image] = { script, bytes: statSync(assetPath(image)).size, hash: createHash("sha256").update(bytes).digest("hex"), mime };
  writeText(resolve(root, script), `globalThis.SpawnerUnitAppearanceData[${JSON.stringify(image)}] = ${JSON.stringify(`data:${mime};base64,${bytes.toString("base64")}`)};\n`);
}
function runtimeRecord(record) {
  const source = record.source, publish = record.readiness.sourceApproved && record.readiness.cameraVerified;
  const clean = pick(source, ["tribe", "mask", "sourceId", "approvalState", "approvalRef", "sourceHash", "frameWidth", "frameHeight", "pivot", "camera", "cameraVerified", "visualBits"]);
  clean.coreReference = pick(source.coreReference, ["sourceId", "verified", "coreBounds", "landmarks", "canonicalSpeciesSize", "canonicalCoreLongest"]);
  if (source.provenance) clean.provenance = { ...pick(source.provenance, ["kind", "sourceHash", "transform"]), referenceVerified: source.provenance.kind === "existing-original", reuseAuthorized: !!source.provenance.reuseDirective };
  if (publish) { clean.image = source.image; registerFile(source.image); }
  const actions = {};
  if (publish) for (const [action, clip] of Object.entries(record.actions)) {
    const animation = pick(clip, ["sourceId", "image", "imageHash", "frameSize", "frameWidth", "frameHeight", "columns", "frameCount", "frames", "durationsMs", "loop", "pivotX", "pivotY", "facing", "sourceFacing", "frameGeometry", "cameraMapping", "events", "attachmentTransforms", "projectile", "rootMotion"]);
    if (animation.cameraMapping) animation.cameraMapping = pick(animation.cameraMapping, ["verified", "sourceHash", "pixelsPerWorld", "scale", "offsetX", "offsetY"]);
    registerFile(animation.image);
    if (animation.projectile?.image) registerFile(animation.projectile.image);
    actions[action] = animation;
  }
  return { source: clean, actions, previewStatus: record.previewStatus, readiness: record.readiness,
    ...(publish && record.sceneActions ? { sceneActions: record.sceneActions } : {}) };
}
for (const tribe of UNIT_APPEARANCE_TRIBES) for (let mask = 0; mask < 32; mask++) {
  const key = unitAppearanceKey(tribe, mask), folder = resolve(root, "DesignAssets/Animations/UnitAppearanceV1", key);
  const candidates = [resolve(folder, "source.json"), resolve(folder, "Source/source.json")].filter(existsSync);
  if (candidates.length > 1) throw new Error(`MULTIPLE APPEARANCE SOURCES : ${key}`);
  if (!candidates.length) continue;
  const source = JSON.parse(readFileSync(candidates[0], "utf8"));
  if (source.tribe !== tribe || source.mask !== mask || !source.sourceId || source.frameWidth !== 512 || source.frameHeight !== 512 ||
      source.camera?.pixelsPerWorld !== 512 || !source.coreReference?.landmarks || !["pending", "approved", "withdrawn", "existing-reference"].includes(source.approvalState))
    throw new Error(`APPEARANCE SOURCE CONTRACT MISMATCH : ${key}`);
  if (hashFile(source.image) !== source.sourceHash) throw new Error(`APPEARANCE SOURCE HASH MISMATCH : ${key}`);
  if (source.approvalState === "approved" && (!(source.approvalRef?.callId || source.approvalRef?.messageId) || !source.approvalRef?.sourceThread)) throw new Error(`APPEARANCE APPROVAL MISSING : ${key}`);
  const sourceDimensions = imageDimensions(assetPath(source.image));
  if (sourceDimensions[0] !== 512 || sourceDimensions[1] !== 512) throw new Error(`APPEARANCE SOURCE FRAME MISMATCH : ${key}`);
  if (source.provenance?.kind === "existing-original") {
    if (mask !== 0 || !source.provenance.reuseDirective || !source.provenance.sourceImage || !source.provenance.sourceHash || !source.provenance.transform)
      throw new Error(`APPEARANCE REUSE DIRECTIVE MISSING : ${key}`);
    if (hashFile(source.provenance.sourceImage) !== source.provenance.sourceHash) throw new Error(`APPEARANCE ORIGINAL REFERENCE CHANGED : ${key}`);
  }
  const motionsPath = resolve(folder, "motions.json"), motions = existsSync(motionsPath) ? JSON.parse(readFileSync(motionsPath, "utf8")) : null;
  if (motions && motions.sourceId !== source.sourceId) throw new Error(`APPEARANCE MOTION SOURCE MISMATCH : ${key}`);
  const actions = motions?.actions || {};
  for (const [action, clip] of Object.entries(actions)) {
    if (clip.sourceId !== source.sourceId || !existsSync(assetPath(clip.image))) throw new Error(`APPEARANCE CLIP MISMATCH : ${key}/${action}`);
    const dimensions = imageDimensions(assetPath(clip.image)), width = clip.frameWidth || clip.frameSize, height = clip.frameHeight || clip.frameSize;
    if (dimensions[0] !== clip.columns * width || dimensions[1] !== Math.ceil(clip.frameCount / clip.columns) * height) throw new Error(`APPEARANCE ATLAS FRAME MISMATCH : ${key}/${action}`);
    const imageHash = hashFile(clip.image);
    if (clip.cameraMapping && imageHash !== clip.cameraMapping.sourceHash) throw new Error(`APPEARANCE RAW CAMERA SOURCE CHANGED : ${key}/${action}`);
    if (clip.imageHash && imageHash !== clip.imageHash) throw new Error(`APPEARANCE IMAGE HASH MISMATCH : ${key}/${action}`);
    clip.imageHash = imageHash;
  }
  for (const scene of Object.values(motions?.sceneActions || {})) {
    if (mask !== 0 || scene.sourceId !== source.sourceId || scene.body?.sourceId !== source.sourceId ||
        scene.ownership?.bodyOnly !== true || scene.independentBodyAction !== false ||
        hashFile(scene.body.image) !== scene.body.sourceHash) throw new Error(`APPEARANCE BIRTH SCENE CONTRACT MISMATCH : ${key}`);
    for (const asset of scene.separatedSceneAssets || []) if (asset.image && hashFile(asset.image) !== asset.sourceHash)
      throw new Error(`APPEARANCE BIRTH SCENE PROP CHANGED : ${key}`);
  }
  // Preserve accepted historical body studies separately. They are deliberately
  // absent from runtimeRecord, the lazy asset list and action readiness checks.
  for (const [action, archive] of Object.entries(motions?.archivedBodyActions || {})) {
    validateArchivedBodyAction(source, action, archive, { hashFile, imageDimensions: image => imageDimensions(assetPath(image)) });
  }
  const record = { source, actions, previewStatus: motions?.previewStatus || {},
    ...(motions?.archivedBodyActions ? { archivedBodyActions: motions.archivedBodyActions } : {}),
    ...(motions?.sceneActions ? { sceneActions: motions.sceneActions } : {}) };
  record.readiness = unitAppearanceReadiness(record, mask); records[key] = record;
  // Keep source provenance for old saves and review history, not retired art in production.
  if (!(mask & UNIT_APPEARANCE_BITS.feet)) runtime[key] = runtimeRecord(record);
}
// Remove generated browser copies as well, so retired variants cannot ship as stale lazy files.
// Authored source art and its provenance remain in DesignAssets for historical review.
for (const tribe of UNIT_APPEARANCE_TRIBES) for (let mask = 0; mask < 32; mask++) {
  if (mask & UNIT_APPEARANCE_BITS.feet)
    rmSync(resolve(root, "client/unit-appearance-files/Animations/UnitAppearanceV1", unitAppearanceKey(tribe, mask)), { recursive: true, force: true });
}
const manifestRoot = resolve(root, "DesignAssets/Animations/UnitAppearanceV1");
writeText(resolve(manifestRoot, "manifest.json"), JSON.stringify({ version: 1, slots: 128, bits: UNIT_APPEARANCE_BITS, forms: records }, null, 2) + "\n");
writeText(resolve(root, "client/unit-appearance-assets.mjs"), "export const UNIT_APPEARANCE_ASSETS = Object.freeze(" + JSON.stringify(runtime, null, 2) + ");\n");
writeText(resolve(root, "client/unit-appearance-lazy-assets.js"), "globalThis.SpawnerUnitAppearanceFiles = Object.freeze(" + JSON.stringify(files, null, 2) + ");\n");
const summary = { slots: 128, registeredSources: Object.keys(records).length, sourceApproved: Object.values(records).filter(record => record.readiness.sourceApproved).length,
  cameraVerified: Object.values(records).filter(record => record.readiness.cameraVerified).length, ready: Object.values(records).filter(record => record.readiness.ready).length, runtimeFiles: Object.keys(files).length };
process.stdout.write(`UnitAppearanceBuilder> BUILD END : ${JSON.stringify(summary)}\n`);
