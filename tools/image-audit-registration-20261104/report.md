# Runtime image audit registration, updated 2026-11-07

The original registration on 2026-11-04 resolved a build failure on 36 assets at `a319b0e9bede88e276b6ff2e5f6b7887d2a5f299`: 15 missing registrations and 21 existing native camera cells above their older display budgets. It registered the actual assets without changing images, display targets, rendering cameras, or the global 100% preferred / 150% maximum policy.

Before that registration, `git hash-object` for all 36 image paths equaled their `HEAD` blobs; that change preserved every image byte. The machine-readable [evidence.json](evidence.json) is now maintained against the current approved runtime assets, with the two sprout replacements described below. Its revision records the checkout used for the latest measurements; no image bytes were changed by the audit update.

## Why the registrations are valid

### Combat death: 12 current registered clips

Ten current `CombatDeathV1` clips retain a **2048×1024 atlas, four columns, two rows, eight 512×512 cells**. `client/combat-death.mjs` and their adjacent `sequence.json` files agree on this camera and layout.

The approved sprout blade and carapace clips are now `SproutDeathV2/{blade,carapace}/death.webp`: **1024×1024 atlases, four columns, four rows, sixteen 256×256 cells**, defined in `client/sprout-death-animations.mjs`. The evidence now references these exact current files and hashes, rather than their superseded V1 counterparts.

All 12 display targets remain **256×256**. The ten retained 512px cameras use their existing exact native-source allowances. The two approved 256px V2 cameras already fit the ordinary display budget and need no native-source exception. The test verifies actual dimensions, per-cell geometry, frame count, exact approved bytes, and exact coverage of the current combat-death registry. Reintroducing a superseded image or changing a frame count, grid or camera fails explicitly.

### Combat backgrounds: three missing registrations

`Combat/{grassland,forest,riverbank}.webp` are each **1774×887**, with one cell. `client/combat-stage.mjs` fits the background to the stage using `Math.max(width / naturalWidth, height / naturalHeight)`, while the existing policy defines a **1920×1080 viewport**. They are registered against that viewport and fit below the ordinary 150% ceiling. They need no native-source exception.

### Neutral creatures: 21 existing registrations

These already registered assets use the exact native frame sizes in `client/unit-sprite-registration.mjs`. Its `frameSize` selects the source cell; `viewSize`, pivots and `registrationScale` define the rendering camera. Older `display` values are screen budgets, not native camera dimensions. Every existing display and atlas grid is preserved; each current native atlas is pinned instead of shrinking pixels or inflating display sizes.

Paths below are relative to `DesignAssets/Animations/`. A display value applies to both axes; the full precision remains unchanged in the policy.

| Asset | Grid | Native cell | Existing display |
| --- | --- | --- | --- |
| UniqueIdleV4/spring-keeper/idle.webp | 8×5 | 412×412 | 274 |
| CreatureIdleStudies/V2/shadow-weasel/idle.webp | 8×16 | 414×414 | 228.375 |
| CreatureIdleStudies/V1/snare-vine/idle.webp | 8×11 | 456×456 | 283.1661 |
| RollingAcornIdle/v1/idle.webp | 4×14 | 428×428 | 280.4947 |
| CreatureIdleV3/flower-tail-bird/idle.webp | 4×6 | 440×440 | 276.7245 |
| CreatureIdleV3/dew-rabbit/idle.webp | 4×6 | 430×430 | 278.4912 |
| CreatureIdleV3/soil-mole/idle.webp | 4×4 | 356×356 | 237.0848 |
| CreatureIdleV4/bundle-snail/idle.webp | 4×6 | 470×470 | 265.8021 |
| CreatureHurtV6/flower-tail-bird/hurt.webp | 4×4 | 440×440 | 276.7245 |
| CreatureHurtV5/dew-rabbit/hurt.webp | 4×4 | 430×430 | 278.4912 |
| CreatureHurtV5/soil-mole/hurt.webp | 4×4 | 356×356 | 237.0848 |
| CreatureHurtV7/bundle-snail/hurt.webp | 4×4 | 470×470 | 265.8021 |
| CreatureHurtV4/rolling-acorn/hurt.webp | 4×4 | 428×428 | 280.4947 |
| CreatureHurtV6/shadow-weasel/hurt.webp | 4×4 | 414×414 | 228.375 |
| CreatureHurtV7/snare-vine/hurt.webp | 4×4 | 456×456 | 283.1661 |
| CreatureHurtV6/talon-owl/hurt.webp | 4×4 | 472×472 | 288 |
| CreatureHurtV6/spring-keeper/hurt.webp | 4×4 | 412×412 | 274 |
| Beetle/atlas.webp | 5×4 | 346×346 | 230.4 |
| Beetle/attack-right.webp | 5×1 | 346×346 | 230.4 |
| TalonOwlIdle/PerchedV4/idle.webp | 4×5 | 472×472 | 288 |
| BeetleDeath/dead-v2.png | 1×1 | 186×186 | 123.84 |

## Retained-source contract

`nativeSource` stores `sha256`, full atlas `dimensions`, and per-cell `frame`. The audit checks the exact bytes, exact atlas dimensions, and exact cell dimensions derived from the live grid before granting that source's native limit. Changing the file with identical dimensions still fails its hash. Growing or shrinking the source, changing the grid, malformed registrations, and conflicting legacy `sourceMaximum` values also fail. A source replacement therefore requires an explicit new source review and policy change.

Older `sourceMaximum` registrations remain compatible; no existing allowance was broadened. Newly added native exceptions use the stronger pinned contract.

## Original registration validation (2026-11-04)

- `node client/image-audit.test.mjs`: **4 tests passed**. Checks ordinary 150% acceptance/rejection, missing registration, unchanged global limits, same-size image replacement, native source growth/shrinkage, incorrect grids, invalid contracts, all 36 real source registrations, and unchanged neutral display budgets.
- `node --test client/image-audit.test.mjs`: passed through the repository's Node test runner.
- In `/workspace/scratch/image-audit-build-20261104`, a separate copy of `client`, `server` and HTML inputs with read-only use of the original images: `node client/build.mjs --runtime-only` **passed**.
- In the same isolated copy: `node client/build.mjs` **passed**, reporting `ENV> CLIENT BUNDLE : 2063296 BYTES`.

No runtime output, HTML, manifest, library, memory or hosting file in the working repository was written by this task. Build outputs stayed in the isolated copy.

## Current evidence validation (2026-11-07)

The former failure was a stale test lookup: the evidence still named the two old sprout V1 images after the runtime had moved to approved V2. The evidence and its tests were updated without changing game logic, artwork, image budgets, runtime registrations, generated bundles or deployment files. Exact-byte and camera validation remains active; the new negative test proves that stale images and incorrect frame counts, grids or cameras are rejected.

- Focused run: `node --test client/image-audit.test.mjs client/published-image-audit.test.mjs client/retired-resource-art.test.mjs server/removed-resources.test.mjs` passed **15/15**, with no skipped tests.
- `npm run audit:images` passed **1,019 registered images**.
- Full baseline: `node --test --test-concurrency=4` ran **1,789 tests: 1,350 passed, 439 failed**.
- Full updated run using the same command ran **1,790 tests: 1,352 passed, 438 failed**. Both runs had zero skipped, cancelled or todo tests.
- The complete failure lists were compared by test location and name: this stale 36-asset test is the only resolved failure, **438 failures remain identical**, and **there are no new failures**. The repository-wide suite is therefore still failing; unrelated failures were neither changed nor hidden.
- An independent read-only review verified all 36 actual dimensions and cell geometries, all 33 recorded source hashes, exact coverage of the 12 current death clips, and the two V2 ordinary-budget registrations.
- `git diff --check` and syntax checks for both changed test files passed. Only these tests, their evidence and this report changed. No build or deployment was performed.
