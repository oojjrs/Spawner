import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { imageDimensions } from "./image-audit.mjs";
import { unitAppearanceReadiness } from "./unit-appearance.mjs";
import { UNIT_APPEARANCE_ASSETS } from "./unit-appearance-assets.mjs";
import { UNIT_DISPLAY_FORM_COUNT, UNIT_DISPLAY_MASKS } from "./unit-display-appearance.mjs";

const root = new URL("../", import.meta.url);
const messageId = "Sentinel_d9eacf0a67648191b894e7d6f333b47f";
const reviewedMasks = ["01", "02", "04", "05", "06", "08", "09", "0a", "0c", "0d", "0e", "14", "18", "1c"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

test("source approval accepts real message provenance without inventing a tool call", () => {
  const source = { approvalState: "approved", approvalRef: { sourceThread: "thread", messageId: "message" } };
  assert.deepEqual(unitAppearanceReadiness({ source, actions: {} }, 1), {
    sourceApproved: true, cameraVerified: false, actionSetComplete: false, worldReady: false, ready: false
  });
  source.approvalRef = { sourceThread: "thread", callId: "legacy-call" };
  assert.equal(unitAppearanceReadiness({ source, actions: {} }, 1).sourceApproved, true);
  source.approvalRef = { sourceThread: "thread" };
  assert.equal(unitAppearanceReadiness({ source, actions: {} }, 1).sourceApproved, false);
  source.approvalRef = { messageId: "message" };
  assert.equal(unitAppearanceReadiness({ source, actions: {} }, 1).sourceApproved, false);
});

test("the spore art approval is bound to exactly the fourteen reviewed source originals", () => {
  const manifest = JSON.parse(readFileSync(new URL("DesignAssets/Animations/UnitAppearanceV1/manifest.json", root)));
  assert.deepEqual(Object.entries(manifest.forms).filter(([, record]) => record.source.approvalRef?.messageId === messageId)
    .map(([key]) => key).sort(), reviewedMasks.map(mask => `spore/${mask}`));
  for (const mask of reviewedMasks) {
    const key = `spore/${mask}`;
    const source = JSON.parse(readFileSync(new URL(`DesignAssets/Animations/UnitAppearanceV1/${key}/source.json`, root)));
    const image = new URL(source.image, root);
    assert.equal(source.approvalState, "approved");
    assert.deepEqual(source.approvalRef, {
      sourceThread: "01a198e4-4d8c-7250-9b57-bef4b30f603f", messageId, speaker: "user",
      text: "포자버섯 원화는 다 오케이", scope: "reviewed-neutral-source-art-only",
      sourceId: source.sourceId, sourceHash: source.sourceHash
    });
    assert.equal(sha256(readFileSync(image)), source.sourceHash, key);
    assert.equal(sha256(readFileSync(new URL(source.provenance.batchSource, root))), source.provenance.sourceHash, key);
    assert.deepEqual(imageDimensions(fileURLToPath(image)), [512, 512], key);
    assert.equal(source.camera.pixelsPerWorld, 512);
    assert.equal(source.cameraVerified, false);
    assert.equal(source.coreReference.verified, false);
    assert.ok(Object.values(source.states).every(state => state === "pending"));
    assert.deepEqual(manifest.forms[key].source, source);
    assert.deepEqual(manifest.forms[key].actions, {});
    assert.deepEqual(manifest.forms[key].readiness, {
      sourceApproved: true, cameraVerified: false, actionSetComplete: false, worldReady: false, ready: false
    });
    assert.deepEqual(UNIT_APPEARANCE_ASSETS[key].readiness, manifest.forms[key].readiness);
    assert.equal(UNIT_APPEARANCE_ASSETS[key].source.image, undefined);
    assert.deepEqual(UNIT_APPEARANCE_ASSETS[key].actions, {});
  }
  assert.equal(manifest.forms["spore/00"].source.approvalState, "existing-reference");
  assert.equal(manifest.forms["spore/10"].source.approvalRef.callId, "call_855ca484695d4a3eb76d94115969162d");
  assert.deepEqual(UNIT_DISPLAY_MASKS, [0, 1, 16, 2, 4, 8, 3, 18, 17, 19]);
  assert.equal(UNIT_DISPLAY_FORM_COUNT, 40);
});
