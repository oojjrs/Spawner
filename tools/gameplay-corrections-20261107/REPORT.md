# Gameplay corrections

- Welcome keeps the first four playable tribes fixed, then chooses neutral creatures with 80% category weight and playable variants with 20%. Independent shuffled bags preserve variety.
- Creature corpse facing now honors the beetle corpse source direction. The source-facing transform, world target direction and combat side direction are tested independently; raw right-facing art is not mislabeled as left.
- Room entry waits for the terrain and all four required nest/idle previews. Failed or timed-out previews keep the lobby open, permit a retry of the same created room, reuse completed previews and reject stale completions. Combat/birth/growth images are not prerequisites for the selection screen.
- Each playable tribe harvests only its own resource: bean/clay, spore/tree, pebble/pebbles and spring/dew. Shared rules cover DNA and legacy attributes, AI targets, approaching and harvesting. Existing inventory and carried items are not erased. Resource details show foreign resources as unavailable.
- Nest HP uses the existing circular unit health painter, on the ground at the actual nest footprint. The status pass follows nest sprites so walls cannot hide it; growing nests follow their growth placement. Destroyed, invalid, distant and offscreen nests are excluded.
- Mobile-only camera, pinch, DNA placement and panel candidates are excluded because the user paused that work. BGM and weasel movement remain separate investigations; no unverified replacement atlas or audio change is included.

## Validation

213 focused tests passed serially: room entry, terrain, welcome roster and compiled runtime, source/target-facing render captures, nest health, resource rules and source/worker gameplay behavior. A parallel test process terminated without an assertion; the same facing test and the complete serial suite passed. This is not a full repository test pass.

The managed browser transport was unavailable at validation time. Actual UI/continuous playback is not claimed. Existing independent facing checks cover 2,349 body draws plus corpse shadow captures, not visual animation quality approval. The three standalone carapace attack endpoint redraws are separate pending candidates.
