# Planning direction audit

Scope: all 44 combination forms, 456 populated planning cells. Fixes: 36 work-preview direction lookups, two mirrored attack previews used by six cells, and one missing birth preview. No in-game source atlas pixels changed.

## Confirmed findings

- All 44 combination rows are absent from `SpawnerUnitMatrixData.units`. `client/unit-matrix-preview.js:190-191` skips their runtime installation. Planning uses independently linked `AnimationCandidates` previews, not the game registration atlases. Game sourceFacing validation alone does not validate planning pixels.
- `initializeDefaultFacing` sets their image CSS transform using the form catalog. Before the fix, 420 cells were unmirrored and 36 were mirrored. The 36 are harvest/carry/throw for secretion-carapace, blade-secretion, blade-secretion-carapace across all four tribes. Their data-action remains the work verb, absent from facing catalog; fallback returns right despite explicitly declared data-work-source.
- Minimal fix: `previewSourceFacing` resolves figure[data-work-source] before catalog lookup. Explicit animation sourceFacing/facing and image metadata still take priority. All 456 combination cells now resolve to left, avoiding the incorrect 36 flips. Unit test evaluates the real function against attributes extracted from the actual generated planning HTML. It is not a browser DOM screenshot test.
- `bean/carapace-antenna` attack and `spore/carapace-antenna` attack preview art are mirrored relative to registered attack atlas. Visual comparison confirms opposite hair overlap / mushroom gill asymmetry in frame zero. `planning-compare-defensive.png` shows game left and planning right. Spore's sampled normalized mirrored pixel difference is exactly zero. Both previews and their attack/harvest/throw original-open links were corrected in the follow-up below.
- `pebble/blade-carapace` birth preview path has a repeated AnimationCandidates prefix and does not exist locally: AnimationCandidates/pebble-blade-carapace-fullbody-v1-20261107/AnimationCandidates/pebble-combo-birth-roll-v2-20261107/blade-carapace/birth-preview.webp.

## Lightbox

`DesignAssets/page.js:32` selects data-preview for the lightbox image and href for original-open. `DesignAssets/codex-units.html:60-62` copies data-mirror, falling back to the anchor for these no-span combination rows. `DesignAssets/design.css:43` mirrors the native lightbox image when that flag is true. Thus wrong work fallback affects both thumbnails and lightbox. Opening original href bypasses this CSS.

## Validation

`node --test client/unit-preview-facing.test.mjs`: 9/9 passed, including 44 rows, 456 populated cells, 132 work cells and the 36 formerly missing catalog lookups. Existing native metadata, source art, base and non-work lookup precedence preserved.

Pixel screening: 280 action previews, 277 direct-preferred, 2 flip-preferred, 1 missing path. This compares frame indices 0/middle/last after alpha bounding-box normalization; some animated WebPs merge identical frames, so differing indices are not necessarily aligned times. It is evidence of orientation, not an all-frame timing or visual approval. Most direct matches have strong score separation. Birth is particularly unsuitable for inferring body orientation from whole-scene error alone.

Browser execution attempted with installed Playwright and /usr/bin/chromium, then sandbox escalation. Both failed before page load with Chromium process_singleton socket() Operation not permitted. No browser screenshot or real UI run is claimed. `planning-browser-audit.mjs` is prepared but did not run successfully.

Artifacts: planning-offline-audit.json (all cells before fix), planning-pixel-compare.json, planning-compare-defensive.png. Product files changed: client/unit-matrix-preview.js, client/unit-preview-facing.test.mjs, DesignAssets/sections/unit-appearance.js and the two named WebPs.

## Authorized follow-up fixes

Both bean and spore carapace-antenna attack previews were confirmed by frame-zero pixel equality after reflection. Both WebPs now have exact reflected alpha and visible RGB across every decoded frame; original durations, frame count, and infinite loop retained. Encoding may alter unused RGB at alpha zero, with no displayed pixel difference. New hashes and duration arrays are in planning-preview-fixes.json. Historical publication manifests and earlier evidence hashes are intentionally untouched.

The attack, harvest, and throw original-open href aliases (six total) now point at the existing registered DefensiveAttackV1 atlas. Original candidate sheets and optional unlinked GIFs remain historical source evidence; game atlas pixels are untouched. The duplicated pebble birth preview prefix was corrected in data-preview, data-original-src, and data-src. Nine focused tests pass.

## Final focused regression

Six facing/planning test files passed sequentially: 28/28, zero skipped. This includes combat sides, corpse directions, current registrations and the complete 44-row planning lookup. Initial concurrent run terminated one test file without assertion details; the isolated test and full sequential run both passed. The complete project suite and browser UI remain unverified.
