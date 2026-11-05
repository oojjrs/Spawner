import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateArchivedBodyAction } from "./unit-appearance-archive.mjs";
import { imageDimensions } from "./image-audit.mjs";
import { unitAppearanceAnimation, unitAppearanceInventory, unitAppearanceMissingActions, unitAppearanceReadiness } from "./unit-appearance.mjs";
import { UNIT_APPEARANCE_ASSETS } from "./unit-appearance-assets.mjs";
import { UNIT_DISPLAY_MASKS } from "./unit-display-appearance.mjs";

const root = new URL("../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const source = read("DesignAssets/Animations/UnitAppearanceV1/bean/1f/source.json");
const motions = read("DesignAssets/Animations/UnitAppearanceV1/bean/1f/motions.json");
const archive = motions.archivedBodyActions.harvest;
const hashFile = path => createHash("sha256").update(readFileSync(new URL(path, root))).digest("hex");
const io = { hashFile, imageDimensions: path => imageDimensions(new URL(path, root)) };

test("accepted bean1f body loop retains exact source, atlas and honest approval provenance", () => {
  assert.equal(hashFile(source.image), source.sourceHash);
  assert.equal(validateArchivedBodyAction(source, "harvest", archive, io), archive);
  assert.equal(archive.sourceHash, "030e75b71127be552ac3ab9bdf51c707884d5c234706b1803c10ba2abcb39dfb");
  assert.equal(archive.approval.evidence.user, "1f 채집만 통과고 나머진 다 새로 만들어야겠다. 새싹콩은 머리가 찢어지고 몽돌하고 포자는 아예 이미지도 제대로 안 맞고 난리네");
  assert.equal(archive.approval.scope, "body-motion-only");
  assert.deepEqual(Object.keys(motions.archivedBodyActions), ["harvest"]);
});

test("24 playback frames preserve 420 ms cadence and exclude the closure proof frame", () => {
  assert.deepEqual(archive.clip.frames, Array.from({ length: 24 }, (_, index) => index));
  assert.deepEqual(archive.clip.durationsMs, Array(24).fill(17.5));
  assert.equal(archive.clip.durationsMs.reduce((sum, ms) => sum + ms, 0), 420);
  assert.equal(archive.clock.closureProofFrame, 24);
  assert.equal(archive.clip.frameCount, 25);
  assert.equal(archive.clock.entry.blendImplemented, false);
  assert.equal(archive.clock.recovery.interruptionVerified, false);
  assert.equal(archive.clock.recovery.reentryVerified, false);
  assert.equal(archive.clock.cargoClockChanged, false);
  assert.equal(archive.clock.resourceYieldClockChanged, false);
  assert.deepEqual(archive.clip.events, []);
});

test("archive fails closed on source, evidence, clock, cargo or readiness changes", () => {
  const changes = [
    value => { value.sourceHash = "different-source"; },
    value => { value.clip.sourceId = "other-form"; },
    value => { value.clip.imageHash = "changed-atlas"; },
    value => { value.approval.reviewedAsset.sha256 = "changed-video"; },
    value => { value.validation.offlineReport.sha256 = "changed-report"; },
    value => { value.approval.scope = "all-actions"; },
    value => { value.clip.pivotY = 447; },
    value => { value.clip.columns = 5; },
    value => { value.clip.durationsMs[0] = 18; },
    value => { value.clip.frames[0] = 24; },
    value => { value.clip.events.push({ type: "yield", atMs: 315 }); },
    value => { value.ownership.cargo = "body"; },
    value => { value.clock.cargoClockChanged = true; },
    value => { value.clock.recovery.interruptionVerified = true; },
    value => { value.canonicalTarget = true; },
    value => { value.runtimeEnabled = true; },
    value => { value.worldActionComplete = true; }
  ];
  for (const change of changes) {
    const value = structuredClone(archive); change(value);
    assert.throws(() => validateArchivedBodyAction(source, "harvest", value, io), /APPEARANCE ARCHIVED BODY/);
  }
  assert.throws(() => validateArchivedBodyAction({ ...source, approvalState: "pending" }, "harvest", archive, io), /CONTRACT MISMATCH/);
});

test("archive adds no game action, runtime file, canonical target or readiness", () => {
  const manifest = read("DesignAssets/Animations/UnitAppearanceV1/manifest.json");
  assert.deepEqual(manifest.forms["bean/1f"].archivedBodyActions.harvest, archive);
  assert.equal(UNIT_APPEARANCE_ASSETS["bean/1f"].archivedBodyActions, undefined);
  assert.equal(unitAppearanceAnimation("bean", 31, "harvest"), null);
  assert.ok(unitAppearanceMissingActions("bean", 31).includes("harvest"));
  assert.equal(unitAppearanceReadiness({ source, ...motions }, 31).worldReady, false);
  assert.equal(UNIT_DISPLAY_MASKS.includes(31), false);
  assert.equal(unitAppearanceInventory().length, 24);
  assert.equal(unitAppearanceInventory().some(row => row.key === "bean/1f"), false);
  assert.equal(unitAppearanceInventory().some(row => row.worldReady), false);
  assert.equal(readFileSync(new URL("client/unit-appearance-lazy-assets.js", root), "utf8").includes(archive.clip.image), false);
});
