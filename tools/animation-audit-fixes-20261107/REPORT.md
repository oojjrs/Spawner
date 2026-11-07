# First animation audit corrections

Baseline: 9b0da3b0. This is a first correction batch, not completion of the comprehensive animation audit.

## Corrected

- Bean antenna and carapace attack v2 use each actual runtime idle body's identity and proportions. First and final attack cells are byte-identical to actual idle frame zero. The original 1000 ms duration and 300 ms contact cue remain. The antenna's unwanted leaves and carapace silhouette change are removed. Direction follows the actual source: antenna right, carapace left.
- Seven existing action registrations use the measured neutral body length: bean/base attack 331 and death 173; spore/secretion ranged, harvest and throw 195; pebble/secretion death 406, pivot (261,453); spring/secretion death 50. These corrections do not alter source image pixels, frame sequence, animation duration, gameplay or military balance. Pebble's former 1.853× and spore's former 0.530× entry sizes now match their respective idle bodies.
- Game, laboratory, welcome and offline bundles share the corrected registry. Existing design attack cells now open the two v2 previews.
- Updated stale antenna-attack and creature-ranged async test fixtures to test the current authorized behavior without weakening crop, state or count assertions.

## Verification

- Registrar passes all twelve defensive attacks; v2 source hashes, complete time samples, geometry, transparent edges and looping previews verified.
- Final sequential targeted suite: 132/132 pass, including seven neutral-entry scale/ground checks and exact RGBA endpoint checks for both corrected bean attacks.
- Actual creature stage ranged fixture: 1/1 pass (five species, both directions). This does not claim the remaining older creature suite is green.
- Source image audit: 1409 files pass. Full game/offline build and laboratory build pass. Diff whitespace check passes.
- Pixel contact sheets were visually reviewed. Browser playback remains a separate incomplete check; earlier simultaneous browser review attempts timed out. Bean antenna idle alone is a 6144×13056 RGBA atlas, so pixel tests crop before conversion to avoid an unnecessary full-atlas memory duplicate.

## Continuing work

Spore carapace attack body-proportion correction and other newly identified audit items remain separate follow-ups. Do not describe this first batch as all animations visually approved. Original image sources and earlier publications remain available for comparison.

## Second correction batch

- Spore carapace attack v2 replaces the vertically elongated body with a redrawn whole-body clip based on its actual idle silhouette. Width-normalized height difference changes from +20.15% to -2.76% at entry and -0.13% at return. It retains 16 frames, 1000 ms, 300 ms contact, authored right-facing art and floor registration. No nonuniform body scaling or body-part assembly was used.
- Bean secretion death gets referenceLength 45.55769230769231, matching the actual idle scale while preserving all source pixels, pivot, frame sequence and timing.
- Combined targeted tests: 134/134 pass. The ten-case pixel registration/endpoint suite additionally checks spore carapace entry aspect within 5%; 10/10 pass after this assertion was added.
- Broader birth-scene resolution and other ongoing audit items remain separate, not claimed complete here.
