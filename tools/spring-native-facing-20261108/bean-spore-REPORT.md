# Bean and Spore native-left source normalization

Status: native source, alias, preview and renderer checks completed; combined build/publication pending. This report is not a claim that all four species or every historical generation recipe has been completed.

## Scope and decision

All 34 Bean/Spore forms were inspected. Twenty-eight forms have coherent right-oriented action families and are normalized in the native artwork. Six forms are intentionally preserved: Bean blade/carapace already have left-oriented actions, Spore blade/carapace already have left-oriented actions, and Bean antenna/Spore gather are frontal defensive gestures. Frontal art is not forced into an invented facing judgment.

The 28 forms contain 176 effective canonical action records: idle/walk/hurt/death/birth each 28, attack 20, ranged 16. They also include 12 harvest/carry/throw records and one non-exposed jump record. UNIT_BIRTH_ART supplies five birth routes absent from the authored action table.

The source pixels are reflected within each original cell, not across an atlas and not at display time. Native pivots are reflected as W−X, source clocks/dimensions remain unchanged, and scene-layer destinations are reflected as W−X−width. Five bilateral held-hurt atlases exchange their impact-side blocks in addition to reflecting complete cells. Two canonical hurt references remap their frame indices to preserve the same temporal sequence. Two projectile sprites and their target-oriented launch anchors are deliberately preserved.

Nineteen originals remain unchanged for content-addressed/shared references. New content-addressed files or a same-directory copy-on-write seed layer serve the selected forms. Bean antenna retains its original shared seed image.

## Verified work

- Final source total: 561 transformed native, alias, layer and raw-source images, 280 animated previews and 164 local source JSON records. The initial plan's two projectile images were explicitly excluded and restored byte-for-byte.
- Additional source review found the two blade+carapace publication manifests omitted by the initial registry-based inventory. Their active original copies, previews and raw sources were reconciled separately, including eleven additional global source aliases and the planning held-hurt preview. Final SHA and fourteen global origin-reference checks pass. Final birth regression also found the Bean/base publication alias missing from the original inventory. Its two sheet aliases, three raw/reference images, sixteen body poses, three previews and nine source JSON files are now synchronized. All sixteen packed body frames reproduce exactly from the mirrored raw grid and updated crop/translation recipe.
- Independent Git-baseline comparison: 242 actual registered image files and 7,270 cells agree in visible RGBA and alpha with exact cell reflection/block permutation. Fifty-eight protected files retain their exact bytes.
- All 184 authored action descriptors and effective birth overrides preserve their clocks and geometry under the declared coordinate transform.
- Production renderer tests cover 752 left/right endpoint draws and 264 held-hurt draws. These are real renderer functions with mock canvas instrumentation, not browser screenshots.
- A separate source review compared 112 before/after pixel pairs across all 28 forms. Blade/leaf/cap/nozzle arrangement and action endpoints remain coherent. Spore/secretion's static outlet is now on the left, but those images do not independently prove a projectile trajectory.
- The concurrently repaired thirteen Spring attack/ranged sheets contain 200 complete poses. All 400 left/right renderer draws preserve exact clip geometry/timing and select the new source pixels. First/last whole-body cels retain original visible RGBA and alpha.

## Limits

Live browser gameplay has not been verified by this batch. Raw-source and animated-preview proofs are recorded by their own normalization tools; the independent 242-file test covers actual registry images, not every raw intermediate.

Twenty-six historical intermediate metadata records and shared old nest-generation inputs are intentionally preserved. Old packers that re-import earlier generation jobs were not executed and are not certified to reproduce the normalized current release. Historical rig/deformation snapshots are not rebound to new artwork merely by changing their old hashes.

Across all four species, the cumulative local correction count is 48 forms and 284 of 428 canonical records. The remaining 144 records are not automatically defects: they include normal/frontal art and unverified states. Two Pebble blade+secretion+carapace forms remain visually ambiguous, and fifteen Spring birth directions still require a separate complete audit.
