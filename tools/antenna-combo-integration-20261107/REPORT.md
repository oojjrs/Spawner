# Antenna combination integration, 2026-11-07

## Delivered

- Seven non-gather organ sets with antenna across four tribes: 28 new forms, 172 authored clips, 28 portraits and 84 work-preview cells.
- Game, combat laboratory, welcome roster, portraits and design table share the same registered whole-body sources. Compiled game and actual embedded Combat bundle are checked against the source definitions.
- Melee exists only with blade; ranged exists only with secretion. Ranged sheets contain the body, with projectiles remaining separate. Passive carapace+antenna has neither attack.
- Harvest and throw reuse melee, then ranged, then walk. Carry reuses walk. These aliases do not emit combat events or alter simulation outcomes.
- All birth clips retain the full authored scene and use the final body's measured floor anchor and size. Both facing directions and three display scales are tested.
- Existing sixteen combinations and four antenna-only forms retain their original image hashes and clocks. The grounded pebble blade+carapace walk remains intact.
- Latest user code through main 8e25d03948f147e148fb02708577dfabaf124845 is preserved. No server files or gameplay rules were changed. Version-4 DNA, exact four-organ selection and current laboratory controls remain in use.

## Checks

- `python scripts/validate-antenna-publications.py --complete`: 28/28 forms and 172/172 transparent clips and looping previews passed. Checks include SHA, geometry, cell-edge clipping, preview decoding and exact preview duration.
- `python scripts/register-antenna-combos.py --complete`: 28 forms, 172 byte-exact source sheets and 28 first-cell portraits registered. Measured pivots, facing and frame-boundary hit/launch cues validated.
- `python scripts/publish-antenna-combo-docs.py --runtime-complete`: all 28 rows and 84 work cells published; total combined catalogue is 44 forms and 276 basic clips.
- Runtime, Combat and full offline builds completed. All 200 offline PNG wrappers are indexed and byte-identical to their native images. Unrelated generated files were preserved.
- 86 focused integration tests passed across antenna, prior combinations, laboratory, exact selection and welcome presentation.
- Image audit passed all 1,397 registered files.
- The same 83 older regression tests report 40 pass / 43 fail on both this change and clean 8e25d039, with identical failing test names. These pre-existing failures are not reported as passes.
- A further 29 source/renderer/approval tests report 27 pass / 2 fail on both this change and clean 8e25d039. The existing spore-approval fixture and world-decode fixture failures remain. Tests tied to the old dominant blade path were updated to the newly authored combination and native atlas geometry.
- Independent read-only review found no actionable integration defect. It verified metadata, unchanged server files, old-art preservation and hosting dependency coverage.

## Browser verification

- The real shared whole-body renderer loaded authored states and animated representative spring, pebble and bean antenna forms. The final spring four-organ form loaded all ten states; both facing directions and terminal frames were visually checked.
- The actual combat laboratory retained all eleven combination options and current user controls. A secretion+antenna trial emitted real shooting events and reached a result; two passive carapace+antenna agents produced zero attack events and an attack-disabled draw.
- The native welcome component reached its running status for bean blade+antenna after the 26-form asset synchronization, but screenshot inspection timed out. Full game entry and welcome visual playback also timed out on a clean pre-change runtime fixture. These browser paths remain unverified; no new defect is inferred from the shared timeout.

Only authored sources and integration files are included. Unrelated local CodexWorkMemory.md edits and historical candidate scratch files are not staged.
