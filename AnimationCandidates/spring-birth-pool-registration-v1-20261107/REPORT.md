# Spring birth pool registration: diagnosis and partial candidate

## Result

**Four-form baked registration defect confirmed. A partial, isolated environment-layer candidate is ready for integration review, not a full-clip pass.** It changes only frames 9–15 (900–1790 ms), using frame 8 as the environment anchor. Frames 0–8 retain all original visible RGBA values. No production source, catalogue, manifest or approved asset was edited.

The pool crest moves in a four-frame staircase tied to sprite-sheet rows, and two forms also reset x every four columns. The silhouette stays almost the same width while the whole pool translates. Native rendering uses one fixed final-body pivot with world travel already present in pixels; there is no per-frame camera or pivot movement causing the drift. That combination distinguishes this from merely changing liquid shape.

Snapshot HEAD: `0e9ad27517ed4c283f2e16d89e471fcbbbe3c2f8`. The working tree already contained unrelated integration changes. Exact source hashes below were rechecked after candidate construction. All outputs are under this directory, 9,195,237 bytes before this small report update; candidate PNGs total 4,122,885 bytes. `space-cost.json` records per-form compressed and decoded sizes.

## Evidence and comparisons

All 16 cells of each suspect were inspected, including the complete secretion-antenna pool previously clipped by the 200px comparison window. The 13-frame current base was inspected; it is body-only and is not falsely treated as a visible-pool anchor. Stable full-scene references include carapace-antenna, secretion-carapace-antenna, blade-carapace, and blade-secretion. Their post-detachment pool position varies roughly 1–3 raw px. Blade-carapace-antenna is stable after frame 4 but has its own 16px early y step, so it is not certified fixed over the entire clip.

The larger audit geometry covers all 11 combination pools in `geometry.json` and `drift-summary.json`. Measurements use the main alpha>=16 pool component, not an all-alpha bounding box and not the earlier clipped viewport.

| Form | Frames 5–15 x/y travel, raw px | x/y at normal 79px body | Pool width, raw px |
|---|---:|---:|---:|
| blade-antenna | 8 / 24 | 4.938 / 14.812 | 202–204 |
| secretion-antenna | 27 / 26 | 18.231 / 17.556 | 189–190 |
| blade-secretion-antenna | 41 / 17 | 22.338 / 9.262 | 189–192 |
| blade-secretion-carapace-antenna | 1 / 9 | 0.612 / 5.512 | 203–205 |

Pool top y by sheet row:
- blade-antenna: 146 → 133 → 121 → 109.
- secretion-antenna: 146 → 133 → 119/120 → 107/108.
- blade-secretion-antenna: 134 → 125 → 116/117 → 108.
- blade-secretion-carapace-antenna: 143/144 → 135 → 131 → 126.

## Why the candidate is partial

Frames 0–3 are genuinely joined pool/drop artwork. Some frames 4–5 remain joined in low-opacity edge pixels. Those frames were not cut or independently centered. A prototype anchored at frame 5 was rejected because the unchanged growing secretion-antenna body then overlaps the lowered pool near frames 12–15. The delivered candidate instead leaves frames 0–8 unchanged and corrects only the later detached environment. The earlier row steps and early x drift remain unresolved.

No creature trajectory was moved to accommodate the pool. No new anatomy, body-part rig, rotation, scaling, warp, repainting or generated art is present. Local pool-shape variation remains. A complete early-phase fix requires a clean separate environment/body source or new artwork that preserves the whole creature and intended travel; this candidate must not be described as completing that work.

## Proposed registration

Use only the existing opt-in `sceneLayers.version=1` renderer. Keep the existing baked image as fallback and add exactly the two layer definitions from `candidate-registration.json` to each existing `UNIT_ACTION_ART[key].actions.birth`. The original fallback still has the drift if layer loading fails. No renderer change is needed for the native scene layer path. Any Design/Combat catalogue copies and packaged runtime synchronization remain the integration owner’s job.

Candidate files: `candidate/<form>/environment.png` and `candidate/<form>/body.png`. Proposed destination root: `DesignAssets/Animations/SpringBirthPoolRegistrationV1/<form>/`. Per-file SHA256, exact atlas dimensions, and every destination rectangle are in `candidate-registration.json`.

All four originals have 16 × 480×480 cells, 4 columns, RIGHT authored facing, 15×100ms then290ms, total1790ms, loop=false, fullScene=true and worldTravelIncludedInPixels=true. These were verified independently per form, not inherited from blade-antenna.

| Form | Unchanged pivot x,y | Unchanged referenceLength | Environment shifts for frames9–15, raw x,y |
|---|---|---:|---|
| blade-antenna | 260.5, 332 | 128 | [[3, 0], [5, 0], [8, 0], [0, 12], [3, 12], [5, 12], [8, 12]] |
| secretion-antenna | 257, 333 | 117 | [[8, -1], [17, -1], [27, -1], [0, 12], [8, 12], [17, 11], [27, 11]] |
| blade-secretion-antenna | 234, 349 | 145 | [[14, 0], [26, 0], [41, -1], [0, 8], [14, 8], [26, 8], [41, 8]] |
| blade-secretion-carapace-antenna | 271, 341 | 129 | [[-1, 0], [0, 0], [-1, 0], [0, 5], [-1, 5], [0, 5], [-1, 5]] |

Environment samples are null for frames0–8; the body layer contains the intact original full scene then. For frames9–15, the body layer contains one intact creature at its original source coordinates, and only environment destinations receive integer translations. The layer dimensions equal their destination dimensions, with one common runtime scale. All translated nonzero-alpha bounds stay inside the original480×480 cell.

## Continuity and fixed-scale checks

Native `unitActionArtPose` and `createUnitActionArt.draw` were exercised with instrumented draw contexts, 152 before/after cases across all four forms, including every frame onset and1789.999/1790/1790.001ms. All current source hashes matched. Frame order, elapsed times, fixed pivot, normal79px body target at cell200, truthful RIGHT source facing with LEFT render mirroring, and idle exit were unchanged. The per-form temporary in-memory registrations were restored. The contexts use mocked image resources; the output contacts rasterize the native draw calls using PIL. This is deterministic source/runtime geometry evidence, not a browser screenshot or continuous-playback test.

| Form | Observed pool top-left range f8–15 before→after, raw x/y | f8→9 movement before, LEFT-world px | After f8→9 |
|---|---|---|---|
| blade-antenna | 8/12 → 0/0 | 1.852, 0.000 | 0, 0 |
| secretion-antenna | 27/13 → 0/0 | 5.402, 0.675 | 0, 0 |
| blade-secretion-antenna | 41/9 → 0/0 | 7.628, 0.000 | 0, 0 |
| blade-secretion-carapace-antenna | 1/5 → 0/0 | -0.612, 0.000 | 0, 0 |

The native clips are one-shots, not loops. Frame15 holds from1500ms to just before1790ms. Both versions remove the pool and select the same idle frame at1790ms. Pool removal and the original birth→idle body transition are unchanged, not newly certified aesthetically. There is no runtime loop seam to pass. Exact f11→12 and full per-frame bounds are in `composite-body-check.json`.

## Alpha preservation: zero alpha is not the same as visible separation

These sheets contain extensive alpha=1 residue, which can connect distant regions at the all-nonzero-alpha level. It was not mislabeled as visible opaque RGB striping and was not denoised. The candidate is not claimed to have zero-alpha-perfect environment/body separation.

The partition uses the disconnected visible pool/body geometry, keeps every alpha>=2 connected component indivisible, and checks every cut edge: the lower-alpha side is never above1/255. The complete alpha>=16 creature component plus a six-pixel source fringe is retained byte-exact in the body layer. Recombining the unshifted partitions reconstructs source pixels exactly before atlas cropping. Early frames preserve all nonzero-alpha RGBA, and original source files retain identical SHA256. Zero-alpha RGB outside tight atlas bounds is irrelevant to rendering and is not claimed to be reproduced in the new atlas.

The shifted environment has no alpha>=2 overlap with the alpha>=16 body core. A few alpha=1 environment pixels overlap translucent body edges in two variants. Thus source-body bytes are exact but post-composite unpremultiplied RGBA is not bit-identical there. The appropriate rendered check composites onto real opaque backgrounds:

| Form | Dark RGB(37,42,48): maximum body-core channel change; affected pixel-frames | Light RGB(240,240,240) |
|---|---|---|
| blade-antenna | 0/255; 0 | 0/255; 0 |
| secretion-antenna | 1/255; 22 | 1/255; 23 |
| blade-secretion-antenna | 1/255; 14 | 1/255; 13 |
| blade-secretion-carapace-antenna | 0/255; 0 | 0/255; 0 |

Those counts sum affected native-resolution pixels across all16 frames, not unique world pixels or opaque-body loss. The whole-cell image changes much more because moving the pool is intended; it is not mixed into the body-core metric. Full raw RGBA and actual-background results are separate in `composite-body-check.json`.

## Review artifacts and reproducibility

- `candidate-registration.json`: exact additive metadata and source/output hashes.
- `candidate-validation.json`: per-frame shifts, protected body hashes, exact partition checks, alpha cut bounds, translated bounds.
- `native-draw-calls.json`: actual native selected frames and draw geometry.
- `composite-body-check.json`: source-body invariance, observed pool bounds, alpha1 caveat and opaque-background effects.
- `candidate/<form>/full-cell-before-after.jpg`: every full source cell at a common0.5 scale, paired before/after.
- `candidate/<form>/native-fixed-scale-0.jpg` and `native-fixed-scale-1.jpg`: every frame at actual native cell200 /79px body geometry, LEFT presentation, unclipped380×300 viewport.
- `candidate/<form>/native-exit-boundary.jpg`:1500ms,1789.999ms,1790ms before/after.
- `spring_<form>-full-cells.jpg`: raw all-frame references and stable peers.
- Reproduce with `python build_candidate.py`, `node native-attributes-check.mjs`, `node native-check.mjs`, `python render_native.py`, `python render_dna.py`, `python validate_composite.py` from this directory. These scripts use the canonical checkout read-only and write only here.

Direct visual review covered all64 suspect source cells, all64 paired full-cell results, all32 corrected-phase native contacts, all4 exit-boundary contacts, the initial secretion native page, the exact base, and five stable-peer full-cell sheets. Other initial candidate pages are generated and numerically verified identical to their originals but are not individually claimed as direct visual reviews. No live browser playback was available. No full repository test suite or deployment was run.

## Source SHA256

- `spring/blade-antenna`: `1be3a9178da98bf727536fd7f6798c3ae408f729f2f3de6402357bc1a5848c9f`
- `spring/secretion-antenna`: `44b3888781bd4185fdad61312007e406ac0ebce40332c5714c67ebe69e139d75`
- `spring/blade-secretion-antenna`: `f1df65fdd4c17508bf358e52f86935afc3fe0c7a5cdfe5df7885069135827eee`
- `spring/blade-secretion-carapace-antenna`: `f066680ae39fe2281779ae5625ea058ce7ee18714d2eb0308d8e8cda10b47e9a`

Recommendation: review/integrate only as a **late detached-pool partial stabilization**, preserving the early-drift follow-up. Do not count this as full birth reauthoring or full-speed animation clearance.

## Final real-DNA and both-direction expansion

`native-check.mjs` now runs **304 real-DNA5 cases**: 4 forms × 2 before/after modes × 2 facing directions × 19 times. Every actor is made with `combatLabCombinationDna(form)`, is version5, passes `validateDna(dna,dna.level,dna.budget)`, has no attributes override, and resolves to the expected exact form. Both LEFT and RIGHT runtime transform signs are asserted. Timing, source hashes,1790ms idle exit and in-memory restoration pass. Results are `native-dna-validation.json` and `native-dna-draw-calls.json`.

At fixed native cell200, real DNA piece-count scaling produces79.78px for blade-antenna/secretion-antenna,80.17px for blade-secretion-antenna, and80.56px for blade-secretion-carapace-antenna. This is not silently normalized away. The existing `native-fixed-scale-*` comparisons retain the explicit79px reference-body normalization from the original attribute-only152-case pass; that reproducible pass is now `native-attributes-check.mjs`.

Each `candidate/<form>/native-dna-both-directions.jpg` shows before/after at800,900,1200,1500ms for both facings with actual DNA scale. All4 new DNA contact pages were directly visually inspected. The parent additionally reported directly viewing all8 initial/native-fixed-scale pages and visually accepted only the late-phase partial stabilization, with the same early-drift and alpha1 limitations.

No failure-injection test was run in this task. Source inspection confirms the existing layer loader falls back to the unchanged original baked scene if a layer fails, which preserves the body but restores the original pool drift in that degraded path. All original files and registrations remain unchanged on disk.

## Independent fallback and final handoff
The parent audit independently reran304 real-DNA5 draws and added48 failure-injection draws, failing each layer in turn at900/1200/1789ms on both facings. Every fallback draw selected the unchanged original baked source. No shared product files were changed. See audit-fallback.mjs and audit-fallback-checks.json. The parent directly viewed all8 fixed-scale before/after pages and approves only the documented late-phase partial correction. Handoff was sent to the sole integration owner.
