# Vine turtle V3 walk replacement

The requested newer turtle animation is now the exact recovered V3 atlas: 64 native640px poses, 8×8 cells, left-authored source, viewSize512 and fixed pivot326.5/511. Its SHA-256 matches the archived original; all64 original frame hashes were verified during recovery. No MP4 extraction or new artwork is used.

Game, combat movement, welcome enter/exit, design table/lightbox and generated bundles use the same V3 source. The obsolete V2 live registration, eight-frame pivot offsets, published source/preview/thumbnail and local wrapper are removed. Their tracked history remains recoverable in Git. The historical V2 reference receipt is retained beside this report, not used as a runtime source. Other creature actions and gameplay speeds are unchanged.

Native combat period remains563.549028ms. Existing distance synchronization uses4.436171255 cycles/cell; at the current0.6 world speed, world/welcome cycles are375.699ms. This preserves current game speed rather than reverting it to the older authored0.4 speed. Ground-radius continuity metadata matches the existing idle; it is not a new footprint measurement.

## Validation

25 focused tests pass, including all64 frame addresses in both directions for world/combat drawing and selection (256 cases), fixed pivots, accumulated cell phase, stop/death handling and welcome enter/exit. The wider movement-registration suite has three unchanged failures, independently reproduced on baseline2cadac1e: cotton-sheep stride metadata, welcome speed expectation, and an old exact-cell-boundary expectation. No assertions were weakened or skipped to hide them.

Source image policy passes1,461 entries. Current generated game/design/preview files contain no live V2 turtle references. Continuous browser playback is unverified because the browser transport remains unavailable. Earlier unreleased pebble birth occlusion and other unfinished animation candidates are excluded.
