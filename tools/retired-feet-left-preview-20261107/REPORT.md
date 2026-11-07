# Retire legged variants and use left-facing previews

## Scope

Four obsolete playable feet forms are removed from live action, held-hurt and minor-action registries, the welcome roster and preload selection. Legacy feet/legs save fields and their gameplay statistics are preserved; display selection maps them to current base/gather or valid organ forms. Ordinary animal legs and the current playable bodies' own feet are untouched. There are now 68 playable action forms and 17 welcome variants per tribe.

The authored UnitAppearanceV1 images and approval/source documents remain historical records. The runtime excludes retired masks. Thirty-one exact generated browser wrappers are removed (list attached); future builders no longer recreate them. Existing manually registered non-retired local assets are preserved.

Planning table previews, image links, lightboxes, work overlays and the standalone appearance viewer now use left as the display direction. A small generated source-facing table reads current action metadata, without relabeling right-facing originals. Complete birth environment/body tracks mirror together only in previews. Projectile/body overlays share the same canvas transform. Actual world and combat target-facing, projectile timing/outlets, original images and pivots are unchanged. Twenty-two published neutral source portraits were visually reviewed; no clearly left-oriented exception to their current default source convention was found.

## Verification

- 179 focused integration cases pass, including all 14 layered birth document timelines and mirrors, 28 antenna combinations, both gameplay and document registries, welcome phases, archived source contracts and retired-form save compatibility.
- Source image size policy: 1,425 files pass.
- Main game, combat lab and standalone appearance bundles regenerated. The VFX presentation bundle regenerated with existing event fixtures preserved; a runtime-only build option avoids rewriting unrelated approved fixtures.
- Broader checks still expose pre-existing stale fixture failures: three unit-display old-renderer assertions, an appearance renderer async fixture and a VFX fixture with obsolete body registration. No assertion was skipped to claim a full project pass.
- The VFX scenario-data generator still expects old DNA gene.steps; only its presentation bundle is rebuilt here. Existing event data is byte-preserved.
- Live browser replay remains limited by the unstable browser process (renderer error 9 and later kernel termination). No complete real-time visual pass is claimed. Source pixels, timeline samples and renderer calls were checked independently.

## Open animation work

Bean base birth needs an intact-body replacement clip; the removed old seed/body/leaf rig must not be revived. Four pebble early-birth whole-body restoration candidates remain unregistered until world nest overlap is validated. New bean walk continuity corrections are separate artwork work. These issues are not hidden by the removal or direction changes.

## Preserved upstream source synchronization

Rebuilding the derived appearance manifest synchronizes user commits e2e512b8 (spore walk) and dd1e1d2e (obsolete spore births removed). Authored Source and Motions files are byte-identical to HEAD. The updated walk file hash and approved neutral provenance match actual files. Restoring the stale generated manifest would reintroduce removed birth references, so these derived updates are retained.

The minor held-hurt rig fixture is corrected only for DesignAssets/Tribes/spore/Animations/Attributes/v1/rig.json: removing animations.birth from the dd1e1d2e parent JSON yields the current JSON exactly. Old hash 067b5cdb8b6d77a7b7bf522655d9d26b442cab755b1857b5ca9bb694f5666051 is recognized only for that path, and the new exact hash 43c03691ab35da445567937d854fcd70c518b630730f44f88d874c6c5d53c86a is still asserted. All other dependency hashes remain unchanged.
