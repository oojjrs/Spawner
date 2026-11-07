# Animation re-audit: carry, birth registration and welcome

## Product changes

- Bean antenna carrying now reuses its own full 25-frame walk with identical clock, scale and ground pivot. Cargo and movement behavior are unchanged. The design table's carry preview links that same approved walk.
- Base spore, pebble and spring body-only births use measured endpoint registration (reference lengths 79, 93 and 105). Their original 83 frames, durations, pixels and scene-independent behavior are unchanged. Independent visual review confirmed the body-to-idle scale/floor continuity; silhouette differences below 5% are retained rather than distorted.
- The welcome header now displays each playable and neutral unit's idle after arriving, then exits with the existing movement animation. All welcome travelers face left, matching their right-to-left motion. Actual combat targeting, authored sourceFacing and projectile directions are untouched.

## Tests

- Focused final suite: 182 cases across 16 files. Includes exact source hashes and 83 birth time boundaries, both-facing body crops and grounding, all 25 carry poses, loaded/unloaded clock equality, idle fallback, native header phase functions for playable and neutral units, and compiled runtime parity.
- Held-hurt test harnesses now await actual asynchronous preparation and provide the missing VM dependencies. Existing current left-facing source banks and three user-modified rig hashes are verified. The rig changes remove only obsolete birth metadata; geometry and held atlases are unchanged. See rig-provenance-check.json.
- Older integration baselines explicitly permit the audited bean antenna carry correction and expect idle welcome presentation. The secretion armor check now compares against the current tribe base armor introduced upstream.
- These are focused checks, not a claim that the entire legacy test suite passes.

## Visual verification limits

The carry and birth before/after contacts were independently reviewed. Actual world nest occlusion for the three larger base births remains unverified. Full animation browser replay has experienced intermittent Chromium renderer error 9; the source and cause are not established. A native welcome component browser replay is requested separately and its exact observed result will be recorded before completion.

Four pebble early-birth full-body restoration candidates are not registered by this batch. They remain under review for initial world nest/body overlap. Their untouched candidate folder is deliberately excluded from this commit.
