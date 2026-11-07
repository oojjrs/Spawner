# Pebble single-form native birth integration

Base commit: 00321467694827df653898b1085e1afade5448d5.
Scope: gather, blade, carapace and secretion births in the game world and independent sidebar avatars. No server rule, original action catalog, planning full-scene preview, duration, path or timing change.

## Implementation
- Four losslessly packed intact body atlases reconstruct the original full-cell camera in a reusable scratch canvas. The 272 source cells and 140 unchanged late cells retain their earlier byte-level verification. A native per-frame nest capture provides whole-birth roof/doorway occlusion from the actual static, growth or destroyed-idle draw, with no body parts assembly.
- The room entry gate prepares the four bounded packed images before activation. Deadline/failure uses the original path when first chosen. A birth's first actual world or avatar draw fixes its source separately; later readiness cannot swap a visible birth midway. Back, leave, newer entry and observed room/terrain/clock reset are handled. Ordinary same-room synchronization preserves choices.
- World pruning uses the whole displayed roster before viewport culling. Avatars are unmasked and cannot reserve world mask slots. Restored drawing failure is counted and never silently swaps to different source art.
- Four packed images use 6.77 MiB decoded RGBA plus one 1.21 MiB scratch. Up to 12 active nests lazily allocate 512-square masks, at most 12 MiB. These are metadata budgets, not measured browser/GPU memory. Composition surfaces, contours, textures and existing assets are additional costs.
- Image policy retains the original 144-square display target and pins the irregular packed storage as a 1x1 native atlas with exact dimensions and SHA. The catalog retains actual original frame cameras and crop placements. Existing local asset entries are preserved; only four wrappers were added.

## Verification
- 14 bounded source/lifecycle/native-hook regressions pass after relocation to this repository.
- Two added compiled-runtime/delivery tests pass: all four images decode exactly once; all four avatar bodies render in both directions; one scratch is reused; no old body atlas is requested by this adapter; each offline wrapper and image-policy SHA matches the PNG.
- The combined focused suite passes 86/86, covering room entry, loading, welcome lifecycle, action selection, birth rendering and prior gather idle clock.
- 1465 image policy checks pass. Full client build and combat/appearance/VFX builders completed. Generated runtime and game syntax/diff checks pass.
- The approved 15-file input manifest is retained. One otherwise blank native-layer line and an extra final blank line had trailing whitespace removed; all other source input bytes remain exact. Generated files and image policy were added separately.

## Limits
This is not a full live browser or all-zoom quality approval. The browser control transport failed before opening a page. Native representative world/avatar/static/growth/destroyed/reduced contacts were inspected separately, not as one complete DOM/network session. Earlier actual-atlas raster characterization differs by at most 2 opaque RGB levels and 1 alpha level, despite exact source-cell reconstruction; those strict raster failures were not relabeled as exact passes. Existing successful large matrices were not rerun.

The original catalog remains available for fallback and unrelated consumers. Planning already displays intact complete scenes. A timeout or unavailable/unsupported source can retain the original appearance for that birth. Identical external replacement packets with unchanged observed room identity, terrain and clock cannot be distinguished without a protocol nonce, which this change does not add.

Native tests require the available @napi-rs/canvas development environment; it is not a production runtime dependency.
