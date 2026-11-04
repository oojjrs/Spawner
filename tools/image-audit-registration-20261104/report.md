# Runtime image audit registration, 2026-11-04

The standard build failed on 36 assets at `a319b0e9bede88e276b6ff2e5f6b7887d2a5f299`: 15 missing registrations and 21 existing native camera cells above their older display budgets. This change registers the actual assets without changing any image, display target, rendering camera, or the global 100% preferred / 150% maximum policy.

Before registration, `git hash-object` for every one of the 36 image paths equaled its `HEAD` blob. All image bytes are unchanged. The machine-readable measurements and original SHA-256 values are in [evidence.json](evidence.json).

## Why the registrations are valid

### Combat death: 12 missing registrations

`CombatDeathV1/{sprout,spore,pebble,spring}/{blade,piercing,carapace}/death.webp` contains a **2048×1024 atlas, four columns, two rows, eight 512×512 cells**. Both `client/combat-death.mjs` and each committed adjacent `sequence.json` declare the same 512px fixed asset camera, frame count and columns. The sequences were read from `HEAD` without restoring absent source files.

The display target is **256×256**, matching the existing `CombatAttributesV7` neutral/idle registrations that these death clips extend. Setting the display target to 512 to silence the audit would confuse the fixed authoring camera with the display budget. Instead, each existing atlas is pinned by exact hash, atlas dimensions and 512px cell dimensions.

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

## Validation

- `node client/image-audit.test.mjs`: **4 tests passed**. Checks ordinary 150% acceptance/rejection, missing registration, unchanged global limits, same-size image replacement, native source growth/shrinkage, incorrect grids, invalid contracts, all 36 real source registrations, and unchanged neutral display budgets.
- `node --test client/image-audit.test.mjs`: passed through the repository's Node test runner.
- In `/workspace/scratch/image-audit-build-20261104`, a separate copy of `client`, `server` and HTML inputs with read-only use of the original images: `node client/build.mjs --runtime-only` **passed**.
- In the same isolated copy: `node client/build.mjs` **passed**, reporting `ENV> CLIENT BUNDLE : 2063296 BYTES`.

No runtime output, HTML, manifest, library, memory or hosting file in the working repository was written by this task. Build outputs stayed in the isolated copy.
