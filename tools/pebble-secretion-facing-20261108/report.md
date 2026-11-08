# Pebble secretion source-facing correction

The inspected source is frontal-left (right-side dark body surface and cap), rather than a right-facing image needing a pixel reflection. Corrected `sourceFacing` labels only. Original atlas pixels, geometry, pivots, durations, registration scale, projectile coordinates and gameplay opponent-facing behavior were preserved.

## Scope

- `client/unit-action-art-assets.mjs`: pebble/secretion reference and nine registered actions, including aliases.
- `client/unit-birth-art-assets.mjs`: effective pebble/secretion birth override.
- `client/pebble-packed-birth-catalog.mjs`: secretion packed animation facing label only; atlas coordinates and bounds unchanged.
- `client/species-held-hurt-assets.mjs`: pebble secretion held source label, no source-block swap.
- `client/unit-ranged-assets.mjs`, `client/unit-ranged.mjs`, `client/secretion-idle.mjs`, `client/secretion-walk.mjs`, `client/secretion-lifecycle.mjs`: consistent legacy sources.
- `client/pebble-native-facing.test.mjs`, `client/bean-spore-native-facing.test.mjs`: narrow explicit label-only exception to historical baselines, retaining exact comparisons for every other field.
- `client/species-held-hurt.test.mjs`: expected native source direction updated.
- `client/pebble-secretion-facing.test.mjs`: new exact metadata, pixel SHA and real native Canvas regression tests.

No global rendering/mirroring code or gameplay code changed. No build, Git operation or push performed. `client/build.mjs` already derives planning direction from action/birth registries. The integrator must regenerate `client/unit-preview-facing-data.js` and distribution through the normal build; no generator logic change is needed.

## Verification

- `before.json` captures pre-edit registered data and SHA-256 for all ten reachable source/layer/packed image files. New regression proves byte equality and allows only `sourceFacing` field changes.
- 43 focused tests passed (action selection, action art, idle/walk, held hurt, global facing render, new metadata/hash assertions).
- Four existing Pebble exact-baseline metadata tests passed.
- Existing bean/spore excluded-form exact-baseline test passed with only explicit secretion label corrections.
- Real native `@napi-rs/canvas`, actual production action-art code: nine routes × first/middle/last frames × both target directions = 54 raster comparisons. Also 56 held-hit side draws, six birth-layer failure fallback draws, two birth-to-idle handoffs.
- Real native Canvas, actual extracted welcome-header draw function and actual world presentation: four phases (enter/perform/exit/stationary-ranged), 12 draws, four exact RGBA matches. Left target keeps native pixels unmirrored; right target mirrors through the unchanged ordinary renderer.
- Full-frame native sampling exceeded worker memory limits; bounded first/middle/last coverage was used and is explicitly recorded. This is not a browser screenshot claim.

## Repeat

`node --test client/pebble-secretion-facing.test.mjs`

Native action summaries are `native-secretion-<action>.json`; welcome/world summary is `welcome-world.json`. `regression.txt` records the complete new regression run; `tests.txt` records the 43 focused checks before adding native checks to the regression wrapper.
