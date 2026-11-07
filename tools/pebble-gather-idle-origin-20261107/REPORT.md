# Pebble gather birth-to-idle origin repair

Baseline: 2c952c828cb36e47a232a4598d52c9f3505e9c11.

Only a completed DNA version 5 Pebble gather birth records birthIdleStartedAt = readyAt. Only its final idle branch consumes the marker; explicit animationStartedAt has precedence. Retained birth snapshots use the same readyAt until the completed snapshot arrives. The birth duration remains 2.62 seconds. Existing founders, completed old saves, other 67 forms and non-idle clocks are unchanged. This is a persistent origin, not an idle timer reset after every walk.

The old clock entered the tilted idle frame 11 immediately after birth. The corrected clock enters upright frame 0, holding its authored 1000 ms before frame 1. Original image pixels, registration, birth paths and combat numbers are unchanged. Existing small terminal-versus-idle raster/foot-edge differences are not corrected. The separate four-form restored body/occlusion candidate remains unregistered.

## Checks
- Seven new focused integration/compiled-surface tests pass, including real game spawn, server tick, JSON snapshot, save/restore, all 67 excluded forms, explicit clocks and generated game/preview/combat module consistency.
- 52 focused tests pass (focused-green.txt).
- The expanded related suite has 66 passes and four failures (related.txt). All four failure names reproduce on baseline: two old server birth fixtures, the warrior Bean composed-birth expectation and decision worker forager-memory fixture. Their assertions were not changed.
- The original six new regression tests produce three baseline failures and all six pass after the patch (baseline-regressions.txt).
- Deterministic complete server snapshots and saved states match baseline at spawn, before ready, completion and restore after removing only the new marker (server-equivalence.json).
- Full client, combat and standalone appearance builds completed. Source and generated JavaScript syntax and diff checks pass. Unrelated generator drift was discarded.
- Actual native draw boundary contact was independently inspected in both directions. This is not continuous browser playback: the browser tool transport still failed before opening a page.

## Preview harness prerequisite correction
The initial bare-VM probe omitted the required globalThis.Spawner runtime and therefore failed on UNIT_DISPLAY_SIZES. The preview builder intentionally aliases shared seed modules from that runtime; Spawner.html loads runtime.js first through the sequential loader. This is not evidence of a product defect. preview-baseline-limit.txt retains only that invalid standalone-harness observation.

The corrected integration test executes the full game runtime first, then the complete appearance preview bundle in the same VM, and invokes the actual preview unitActionState API. It passes and selects the corrected readyAt origin. The earlier defect diagnosis was withdrawn; no preview builder or product workaround was added.
