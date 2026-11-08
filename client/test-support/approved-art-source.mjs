import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const directory = new URL("../../tools/spring-native-facing-20261108/", import.meta.url);
const audits = ["bean-spore-image-changes.json", "bean-spore-extra-image-changes.json",
  "bean-spore-global-source-alias-changes.json", "remaining-facing-pebble-image-changes.json"]
  .map(name => ({ name, document: JSON.parse(readFileSync(new URL(name, directory))) }));

// User-confirmed corrections are chronological stages, each applied at most once.
// A later reflection may return to an earlier hash/path; it is not a graph cycle.
const confirmedStages = [
  "../../tools/confirmed-facing-20261108/bean-spore-image-changes.json",
  "../../tools/facing-combo-audit-20261108/bean-reflect-image-changes.json",
].map(path => JSON.parse(readFileSync(new URL(path, import.meta.url))));
function confirmedSource(source) {
  let current = source;
  for (const stage of confirmedStages) {
    const change = stage.changes[current.path];
    if (!change || change.beforeSha256 !== current.sha256) continue;
    assert.equal(stage.status, "completed");
    assert.equal(change.verification.exactRgbaMirror, true);
    assert.equal(change.verification.alphaExact, true);
    assert.equal(change.verification.dimensionsUnchanged, true);
    current = { ...current, path: change.newImage, sha256: change.afterSha256,
      mirrored: !current.mirrored, confirmedFacingCorrection: true };
  }
  return current;
}

export function approvedArtSource(path, approvedHash) {
  let current = { path, sha256: approvedHash, mirrored: false };
  const visited = new Set();
  for (let step = 0; step < audits.length; step++) {
    const matches = audits.flatMap(({ name, document }) => {
      const record = document.changes[current.path];
      return record?.beforeSha256 === current.sha256 && record.afterSha256 !== current.sha256 ? [{ name, document, record }] : [];
    });
    if (!matches.length) return confirmedSource(current);
    assert.equal(matches.length, 1, path + " unique approved transform");
    const { name, document, record } = matches[0];
    assert.equal(document.status, "completed", name);
    assert.ok(!visited.has(current.sha256), path + " acyclic approval chain");
    visited.add(current.sha256);
    const verification = record.verification;
    if (name === "bean-spore-image-changes.json") {
      assert.ok(["mirror-each-cell", "mirror-each-cell-and-swap-hit-side-blocks"].includes(record.operation), path);
      assert.equal(verification.exactRgbaMirror, true, path);
      assert.equal(verification.alphaExact, true, path);
      assert.equal(verification.dimensionsUnchanged, true, path);
    } else if (name === "bean-spore-extra-image-changes.json") {
      assert.equal(verification.exactRgbaPerCellMirror, true, path);
      assert.equal(verification.alphaExact, true, path);
      assert.equal(verification.geometryUnchanged, true, path);
    } else if (name === "bean-spore-global-source-alias-changes.json") {
      assert.equal(verification.exactPerCellRgbaMirror, true, path);
    } else {
      assert.equal(verification.decodedRgbaExact, true, path);
      assert.equal(verification.dimensionsPreserved, true, path);
      assert.ok(record.owners?.every(owner => owner.startsWith("pebble/")), path);
    }
    assert.match(record.afterSha256, /^[a-f0-9]{64}$/);
    assert.ok(record.cellRectangles.length > 0, path);
    current = { path: record.afterPath || record.newImage || current.path,
      sha256: record.afterSha256, mirrored: !current.mirrored };
  }
  assert.fail(path + " approval chain exceeds known audit stages");
}

export function approvedArtClip(clip, approvedHash) {
  const source = approvedArtSource(clip.image, approvedHash);
  if (source.confirmedFacingCorrection) return { ...clip, image: source.path, sourceFacing: "left",
    ...(source.mirrored && Number.isFinite(clip.pivotX) ? { pivotX: (clip.frameSize ?? clip.frameWidth) - clip.pivotX } : {}) };
  if (!source.mirrored) {
    const labels = JSON.parse(readFileSync(new URL("label-changes.json", directory)));
    if (!labels.images.includes(source.path)) return { ...clip, image: source.path };
    const facing = JSON.parse(readFileSync(new URL("verified-pixel-facing.json", directory)));
    assert.equal(labels.status, "completed"); assert.equal(facing[source.path], "left");
    return { ...clip, image: source.path, sourceFacing: "left" };
  }
  const reflected = { ...clip, image: source.path, sourceFacing: clip.sourceFacing === "left" ? "right" : "left" };
  if (Number.isFinite(clip.pivotX)) reflected.pivotX = (clip.frameSize ?? clip.frameWidth) - clip.pivotX;
  return reflected;
}

export function approvedAttackSource(path, approvedHash) {
  const source = approvedArtSource(path, approvedHash);
  const repairs = JSON.parse(readFileSync(new URL("attack-metadata-changes.json", directory)));
  const record = repairs.changes[source.path];
  if (record?.kind !== "nativeWholeBodyRepair" || record.beforeSha256 !== source.sha256) return source;
  const validation = JSON.parse(readFileSync(new URL("attack-validation.json", directory)));
  const proof = validation.assets.find(asset => asset.source.endsWith("/" + source.path) && asset.sourceSHA256 === source.sha256);
  assert.ok(proof, path + " approved whole-body repair");
  assert.equal(repairs.status, "completed");
  assert.equal(proof.outputSHA256, record.afterSha256);
  assert.equal(proof.geometryUnchanged, true); assert.equal(proof.timingUnchanged, true);
  assert.equal(proof.checksPass, true); assert.equal(proof.sourceFacingRequired, "left");
  return { ...source, sha256: record.afterSha256, repaired: true };
}
