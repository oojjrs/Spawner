# Four authored combination forms, 2026-11-07

The game, combat laboratory, welcome presentation, portraits and design document share the same exact-mask form catalogue. The new secretion set has 12 forms, 80 complete-body clips and 12 idle portraits. Together with blade+carapace there are 16 forms, 104 authored clips and 48 work-action previews.

- Blade+carapace has melee and no ranged clip.
- Secretion+carapace has ranged and no melee clip.
- Blade+secretion and the triple form have both attacks.
- Harvest and delivery reuse the same body's melee clip when a blade exists, otherwise its ranged body clip. These aliases never emit projectiles or modify gameplay. Carry uses walk.
- Birth owns its full scene and travel, preventing duplicate movement. Death holds its terminal frame.
- Additional visible antenna/feet and historical organs preserve the previous routing policy. Real DNA, stats, cargo and serialized state are unchanged.
- The combat laboratory offers all four DNA combinations and a real melee/ranged starting-distance control. Each selection creates valid, independently owned DNA, not a visual override.
- Welcome now cycles 63 identities, including all 16 combination identities, with each body's native animation.
- Pebble blade+carapace walk/carry uses the corrected grounded 12-frame, 840 ms atlas. The other 23 existing clips and all four portraits are unchanged.

## Verification

`node client/build.mjs --preserve-design` and `node client/build-combat.mjs` completed. The relevant integration, asset, welcome and lab suites pass 53 tests. Source image audit passes 1,198 files. Both asset generators are deterministic, source atlases are byte-exact and idle portraits use the exact first source cell.

A broader 100-test rendering regression subset passes 59 and fails 41. A clean baseline at `6c6b2c8f4128d06993b39890168e63d07e8dc818` has exactly the same 41 failing test names. These are existing legacy renderer expectations, not a passing full suite. The three expectations affected by the newly authored combination policy were updated and pass. The complete repository suite is not reported as green.

Browser verification covered real ranged combat (bean secretion+carapace versus pebble triple), real melee combat (spring triple versus spore blade+secretion), common-renderer birth/death/work states, mirrored grounded pebble walking, spring terminal frames, and normal welcome loading. The diagnostic review page uses the actual production renderer and can be served as `/secretion-review.html` by copying `review.html` to the managed preview's dist directory.

Site preparation now hashes and caches one asset at a time instead of retaining every image buffer. This avoids publication running out of memory as the original animation collection grows; asset bytes and source-pinned paths remain unchanged.
