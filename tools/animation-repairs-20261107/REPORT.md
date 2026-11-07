# Animation repair batch

This batch updates 28 animation slots without changing combat rules or target-facing directions.

- Three standalone carapace attacks (spore, pebble, spring) now use whole-body left-facing drawings that begin and end on the actual idle frame. This removes the asymmetric feature flip at attack boundaries. Native cell size, pivot, reference length and source direction are registered explicitly. Existing hit times and durations are preserved.
- Four pebble combination births have additional whole-body rolling poses. Each remains 2,140 ms. Original entry and settled key frames, movement coordinates, scene anchors and ready times are preserved.
- Eleven bean combination births exclude their duplicate 650 ms review hold from runtime playback. The 116 motion samples run for 3,850 ms, with the body appearing at 2,590 ms. Original 4,500 ms planning previews and source atlases are retained. Registration scripts verify the duplicate pixels before trimming.
- Ten bean combination walks replace the long airborne hold with whole-body takeoff and landing poses. Each retains 24 samples, 960 ms, its actual idle endpoints and the same registration. Carry reuses the corrected walk. Planning walk/carry links and native asset wrappers are updated together.

The game, combat laboratory and welcome header share these registrations. Planning previews retain truthful source direction while displaying the requested left-facing view. No extra attack column or ranged attack is introduced.

## Validation

135 focused integration and regression tests passed serially, covering source hashes, exact idle endpoints, preserved pebble key frames, runtime frame boundaries, both target directions, layered/baked birth paths and welcome behavior. Separate pose validation covers all ten repaired bean walks and carry states (5,920 checks). Native source image policy, generated runtime bundles and diff checks pass. These are focused checks, not a claim that the complete repository test suite passes.

Independent ordered-pose review approved the new drawings. Continuous live browser playback remains unverified because the browser transport was unavailable or unstable. It is not represented as passed.

## Excluded work

The unfinished bean blade-secretion-carapace walk is unchanged. Four single-attribute pebble birth body restorations remain unregistered until nest/growth occlusion is correct. Spring birth pool drift is a separate investigation. Mobile-only UI candidates remain paused. No unverified weasel atlas or Android audio change is included.
