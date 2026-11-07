# Attack integration, 2026-11-07

## Delivered scope

- Four playable tribes × carapace, antenna and carapace+antenna: twelve new whole-body melee attack clips in the shared game, laboratory and welcome renderer. Existing idle, walk, hurt, birth and death pixels and metadata are preserved.
- Existing attack columns only, with twelve animated design previews. No additional attack-type column. All empty appearance-table image cells use the common `no image` placeholder.
- Current playable DNA units have basic attack power 1 without an offensive organ. They cannot initiate combat. Receiving an enemy attack activates their normal melee attack cycle for that fight. Existing blade/secretion values, projectile behavior and chance-based counter skill are unchanged. Defensive-only units cannot attack buildings. A passive-versus-passive laboratory match remains a no-offense draw.
- Carapace+antenna harvest/throw reuse its own attack body; other existing work actions remain unchanged. No ranged animations were added.
- Laboratory appearance choices now include carapace and antenna singles alongside the eleven combinations. Existing default and exact-organ selection remain unchanged.
- Native atlases and all twelve byte-exact offline wrappers are included. Game, laboratory, attribute and design-world bundles are rebuilt.

## Verification

- Final source registrar: all 12 publications pass geometry, native PNG hashes, transparency boundaries, animated-preview clocks, loop and source identity checks.
- Focused art/surface integration: 103/103 tests pass.
- Focused gameplay: 104/104 tests pass, including 35 new defensive-base cases.
- Existing combat/DNA comparison: 203 tests at both baseline e1bdcb9d and changed tree: 124 pass, 79 pre-existing failures, no additional failures.
- Numeric preservation comparison: 516 military DNA combinations and 38 neutral combat profiles unchanged apart from the new defensive capability flag.
- Image audit: 1,409 files pass. Full builds and `git diff --check` pass.
- Full server suite is not green: existing assertion failures and resource-related SIGKILLs remain. This is not represented as a complete regression pass.
- Browser attempts for twelve-clip native rendering and the actual laboratory timed out with unresponsive pages. No successful browser visual check is claimed for this release. The separately requested whole-animation quality review follows publication and includes this limitation.

## Preservation and follow-up

Unknown pre-existing `CodexWorkMemory.md` edits and unrelated untracked artwork were not changed or staged. Original 12-form action metadata and asset hashes are captured in `existing-art-baseline.json`. Attack-only replacements are tested against that baseline.

The user subsequently requested push first, then the full animation audit. Push/deployment results are verified separately and reported immediately when available.

## Concurrent update reconciliation

Before push, main advanced through three user-authored camera, formation and VFX commits to 0b0b8536. Their changes were merged without replacing the dirty original checkout. The combined game and laboratory were rebuilt from the merged source.

The subsequent visual audit identified appearance-continuity defects in bean/antenna and bean/carapace: foliage and body proportions change between idle and attack. These are known follow-up corrections, not visually approved clips. The user explicitly requested pushing the completed implementation first and then the comprehensive animation audit.
