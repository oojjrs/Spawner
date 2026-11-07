# High-resolution whole-body birth scenes

## Scope

Fourteen existing antenna-combination births (seven bean and seven spore) now use one environment track and one intact high-resolution body track. No anatomy layers, added rotation, gameplay changes, or independently running clocks. Original baked scene/preview files remain available for fallback. Original birth timing, final pivot, reference length, source facing, and pixel-authored world travel remain unchanged.

The document table and lightbox use the same source samples, including rectangular 768×512 spore scenes. Game, combat-lab and welcome bundles share the registered clips. Offline wrappers include all 16 unique layer atlases.

## Verification

- Original-to-layer reconstruction: all 1,365 frames. Whole-body source cells and final idle endpoints are pixel-exact. Bean comparison uses native environment copy plus original body sampling; spore comparison uses original Lanczos sampling.
- Runtime contract: all 1,365 boundaries and both facings, exactly one whole body or a hidden-body sample, correct scene crops/destinations, zero ready-path promise allocations, exactly 16 shared atlas loads.
- Failure/retry tests: no partial body/environment mixing, baked fallback only after layer failure, retry recovery, decoded dimension mismatch, reference-independent readiness.
- Document tests include every actual payload/sample, rectangular backing, visible-only loading, offscreen and close release, shared resources, bounded table activation and fallback.
- Focused final suite: 160 tests pass. Existing neutral registration pixel suite passed 10/10 separately; later repeat attempts sometimes received SIGKILL under resource pressure. A SIGKILL is not counted as a passing run.
- Image policy: 1,425 files pass. Game and lab rebuilt. Existing broader legacy test failures were not claimed fixed.

## Browser and resource limits

The managed preview opened the actual renderer harness. A paused final bean scene rendered with two layers and no fallback; its nest and body were visually checked. Subsequent DOM/screenshot operations repeatedly timed out. Sustained all-form playback, multi-birth frame rate and live fallback remain unverified; no browser-wide pass is claimed. The fixture is retained for continued audit.

Unique layer PNGs total 42,822,842 bytes. Decoded RGBA minimum across all 14 forms is 518,425,600 bytes (~494.4 MiB), versus 1,761,607,680 bytes for the old baked scenes (70.6% lower). This is not measured total browser memory; decoder/GPU copies and other assets add overhead. The runtime cache's 64-entry bound retains all 16 current layer atlases. Pre-existing combat-stage image ownership can retain additional image references. A decoded-byte lifetime policy and live performance validation remain follow-up work, not completed claims.

## Reproduction

Source packages, hashes, composition evidence and generators are under AnimationCandidates/birth-scene-layers-v1-20261107. Use the original authoring sources via SPAWNER_SOURCE/SPORE_BUILD_SOURCE when running generators. Registration is additive through scripts/register-antenna-combos.py; scripts/publish-antenna-combo-docs.py republishes existing rows without new columns. User camera, formation, VFX and unknown original-worktree changes are preserved.

## Concurrent remote changes and second correction

Preserved upstream commits 57b3f1b2, e91aee10 and cb006f13 (DNA v5 pricing, tribe efficiency, editor and combat clocks); rebuilt generated runtime/lab. Post-merge focused suite passed 128/128, including new upstream tests. Antenna expectations now use DNA v5 and the tribe base armor rather than incorrectly requiring zero base armor.

The independently reviewed pebble carapace+antenna birth v2 corrects the final two body poses to within 0.7% of idle aspect. First six scene frames, 8-frame/2140ms clock, and all other actions remain unchanged. Last two nest images were redrawn as part of whole scenes, not claimed byte-identical.

Independent browser audit also observed Chromium error code 9 after static one-form fixture failure. This is recorded as a renderer crash limitation, not merely a CDP observation timeout. The animation code or memory as cause is not established. Full live audit remains open.

Pebble correction verification: 57 integration tests passed, including direct source-pixel identity for first six frames and measured final body aspect/floor/reference.
