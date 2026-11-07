# Restore the base bean birth

The current generic whole-body renderer had no bean/base birth registration and displayed its idle fallback. This restores a dedicated birth without restoring removed body/head/feet rig composition.

- 116 master samples over 3850 ms preserve the seed, crack, emergence and landing sequence.
- A previously published environment atlas is reused unchanged. A single intact 631×631 body atlas contains 16 poses.
- The body first appears at 2590 ms, reaches the exact current idle pose at 3610 ms, and changes to idle state at 3850 ms.
- The last full-body cell is RGBA-byte-identical to the current idle cell. Its final rendered rectangle matches the idle rectangle within 1e-10.
- Game and Combat share the registration. The existing design birth cell uses the same two tracks and left-facing preview. Welcome remains arrival → idle → exit.
- The source facing stays truthful (right). Only target-facing display applies the mirror.
- Offline assets include both layers and the baked complete-scene fallback. The fallback is requested only after a layer failure; simultaneous births share the two decoded layer atlases.

## Validation

Focused tests cover validated version-5 base DNA, every master boundary in both directions, body visibility, exact idle handoff, independent source hashes, layered fallback, 64 simultaneous actors, the built runtime and design payload. The image-policy audit passes 1427 files.

The artist and independent auditor inspected all 16 full-body poses and the complete scene sequence. A stable live-browser continuous replay has not been confirmed because the available browser has intermittently terminated with error 9. No claim of a completed whole-game/browser audit is made.

The separate four-form pebble source-restoration candidate remains unregistered. Early-world nest occlusion must be corrected before those images can be used.
