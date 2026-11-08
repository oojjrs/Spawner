# Native source-facing correction, 2026-11-08

## Completed source changes

Two confirmed right-facing Pebble appearances now have native left-facing pixels:

- blade + carapace
- blade + carapace + antenna

For each form: idle, walk, melee attack, hurt, birth and death, plus its portrait. The back shell is now on the right and the exposed face/attack front on the left. The final contact sheet was visually inspected after conversion.

27 atlas/portrait files include 14 published assets and 13 byte-identical source copies. Every atlas cell was mirrored independently, preserving cell order and exact decoded RGBA. No drawing was regenerated, resized, re-timed or split into body parts. The source-facing labels and horizontal pivots now describe the changed pixels. Normal left-facing presentation adds no mirroring. The game's dynamic mirroring when a unit faces right remains intact.

23 linked animated previews (12 WebP, 11 GIF) were also mirrored. All decoded visible RGBA, alpha, frame counts, durations, loops and dimensions were verified. GIF palette/control data were retained rather than re-quantized. Six cover paths in the antenna publication manifest were already absent and were not fabricated; the existing linked animation previews are present.

Publication manifests, exact-byte image policy, source SHA values, native registries, planning-facing data and the relevant offline wrappers were synchronized. The blade+carapace generator now reads the manifest's source-facing instead of hardcoding right. The historical integration test allows this audited source change while continuing to compare every other definition/hash.

## Movement fixes

Separately, combat movement now plays Spring Keeper takeoff/flight even though combat does not use field walk mode. The in-game combat detail renderer applies the same native walk view-size registration as the field, fixing size jumps in moving creatures, including White Paw and Shadow Weasel. New regression checks cover all 18 registered creature walk sheets and both facing directions.

## Verification

- 27 source files: exact per-cell RGBA/alpha mirror, unchanged dimensions/frame order.
- 23 animation previews: exact visible RGBA/alpha and timing/loop preservation.
- Source contact sheet: priority-left-source-review.jpg, two forms × six actions, first/middle/final samples.
- Native geometry/clocks and zero additional left-facing mirror: native-left-facing.test.mjs.
- World/welcome/combat production transform capture: 2,349 draws across all 87 appearances. Except the two independently inspected corrected sources, this existing capture test uses metadata as its direction oracle, not independent pixel certification.
- Client and combat builds completed. Relevant 57-test regression group passed.
- The broader baseline suite has existing failures (2,212 tests: 1,664 passed, 548 failed); this work does not claim a clean whole-project suite.

## Explicitly unfinished audit findings

This is not an all-68-appearance source-direction completion claim.

The 68-form idle/walk contact sheets and 224 attack/ranged/hurt/death clips were sampled visually. Many are frontal, or death debris has no meaningful facing. Those cannot honestly be certified as left or right from metadata or an asymmetric ornament alone. Frontal art does not need a forced correction.

Spring bodies with a trailing tip to the right have a left-facing body, but several attack sources extend/lunge right. Pebble carapace+antenna likewise has an idle-body/attack-progression disagreement. Mirroring an entire family blindly would preserve or invert that disagreement rather than solve it. Those attack drawings require separate whole-body source correction and transition review; they are not changed in this patch. Birth quality and all-frame browser playback remain separately tracked work.
