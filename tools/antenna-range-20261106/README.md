# Starting DNA and antenna movement boundary

User direction (2026-11-06): no-antenna units remain near their nest; starting units use normal DNA, modest tribe-specific worker designs with comparable costs.

Changes:
- Legacy player units no longer bypass the nest movement boundary simply because they lack DNA. Antenna grants roaming; wild creatures retain independent behavior.
- The same predicate covers AI routes, actual steps and combat escape. It permits an out-of-range unit loaded from an older save to approach home, never move laterally/farther out. Enemy nests do not enlarge its permitted range.
- New starts use the normal DNA spawn/stat/clone/save path. No extra stat bonuses. Existing saved legacy designs are preserved, not destructively converted.
- Existing starting counts remain bean/spore 4 and pebble/spring 3. All starting DNA currently cost 28P to reproduce, free initial gifts do not deduct starting points.
- Bean: gather + capacity x3. Spore: gather + harvestSpeed + capacity + health. Pebble: gather + health + capacity + movement. Spring: gather + movement x2 + health.
- All four are legal level-one designs without antenna or military genes. Choices are balance candidates, not claims of equal actual income.

Verification:
- 129 tests passed: antenna-range, tribe-start, dna, combat*.test.mjs.
- New coverage: three-cell boundary, enemy nests, antenna/wild exemptions, outside-save recovery, actual ticks/save restore, combat escape, and all-tribe starting DNA legality/stats/cost/clone/save identity.
- Existing combat tests now create explicit legacy combat fixtures rather than incorrectly assuming new worker DNA can attack.
- Client build passed. Broader repository suite has existing failures; no full-suite success claimed. Economic simulations and deployment are coordinated separately.
