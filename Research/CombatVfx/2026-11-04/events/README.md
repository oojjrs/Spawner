# Combat VFX event contract audit

The server previously published the last combat reaction, last ranged impact through shared agent fields. A later same-tick stun/counter could overwrite a hit. Critical and followup information, actual drain/reflection/area damage, bleed ticks, recovery, and unit deaths were not fully observable. The new journal records the actual decisions and HP changes without changing those decisions.

The new semantic mapper and timing cursor are ready. The general-hit illustration is still `draft-pending-user-review`; this work does not approve it or generate a batch of other effects. The review scene reuses existing `UnitRangedV1` bodies and projectile pixels.

## Authoritative events

`server/combat-vfx-journal.mjs` keeps a WeakMap per environment/room, capped at **256 events** and **4 seconds**, retaining an ongoing status/flight until its declared end when the hard cap permits. Nothing is added to agents, combat saves, or DNA. Optional `environment.onCombatEvent` observers receive immutable evidence; observer errors cannot alter combat.

`client/room.mjs` adds `state.combatVfx` to the outgoing room snapshot. Existing state delta transport carries it without a schema change. Visibility uses known agent IDs or visible world cells, floors fractional cell coordinates, removes hidden origins/destinations, and applies before transmission. Sequence bounds describe the whole retained journal, before visibility filtering, so hidden events do not produce false truncation gaps.

An event contains:

| Field | Meaning |
| --- | --- |
| `id`, `streamId`, `sequence` | Unique ephemeral stream and monotonic event identity; shared copies deduplicate by ID. A restored/new world starts a new stream. |
| `kind`, `at` | Actual resolved kind and simulation seconds. Delayed processing preserves each scheduled hit, launch, arrival or bleed tick time. |
| `sourceId`, `targetId` | Responsible actor and entity whose state actually changes; absent hidden identities may be `null`. |
| `amount` | Nonnegative **actual HP change**, after overkill, shields and maximum-health clamping. Status/preparation events carry zero. |
| `causeId` | Attack token for primary decisions; exact parent damage/application event ID for derived drain, reflect, splash, bleed or death. |
| `projectileId` | Same identity on that shot's launch, resolution and cancellation. |
| `mode`, `critical`, `counter`, `hitIndex` | Actual selected attack mode and result, without inferring them from art or later agent state. |
| `from`, `to` | World coordinates captured for the event. Launch endpoints preserve the existing scheduled projectile visual; impact coordinates describe the actual recipient at resolution. |
| `fromId`, `toId` | Explicit transfer direction, especially for drain and reflection. |
| `endsAt`, `duration`, `arrivesAt` | Real status/preparation end or projectile arrival, when present. |

Snapshot metadata is `{version:1, streamId, latestSequence, oldestSequence, droppedThroughSequence, events}`. `oldestSequence` is the first globally retained event; `droppedThroughSequence` also detects a missing middle of history when an older ongoing stun remains retained.

## Mapping and timing

| Real incident | Semantic cue | Anchor/time rule |
| --- | --- | --- |
| Positive normal damage | `hit` / `impact` | Victim at actual HP mutation. |
| Critical or followup damage | `critical` or `followup` / `impact` | One impact. Tags retain critical, followup, counter and ranged simultaneously; critical does not add another damage burst. |
| Evasion (`miss` on server, `dodge` in simulation) | `dodge` / `defense` | Defender at the actual roll; no damage impact. |
| Parry | `parry` / `defense` | Defender at resolution; no damage impact. |
| Block | `block` / `defense`, plus one `impact` if damage remains | Defense cue has zero amount; remaining real damage appears once. |
| Counter preparation | `counter` / `prepare` | Counterattacker when preparation actually begins. The later resolved counter hit is its own impact. |
| Stun | `stun` / `status` | Defender until actual `endsAt`. Legacy stun events carrying the hit's damage cannot create a second impact. |
| Bleed application and ticks | `bleed-apply` / `status`; `bleed` / `impact` | Application begins the status; every actual scheduled tick records its own capped loss and time. |
| Area damage | `area` / `impact` | One event per actual collateral recipient, linked to the main hit. |
| Lifesteal | `drain` / `restore`, `phase:arrival` | `targetId/toId` is the healed attacker; `fromId` is the damaged victim. The cue starts when HP has already been restored, never after an invented travel delay. |
| Reflection | `reflect` / `impact`, `phase:arrival` | `sourceId/fromId` is the reflecting defender; `targetId/toId` is the original attacker receiving real reflected damage. No second attack is invented. |
| Regeneration | `regeneration` / `restore` | Actual recovered HP at the update that applies it, with the interval's `startedAt`; full health produces no event. |
| Unit death | `death` / `death` | Actual positive-to-zero HP transition caused by recorded combat damage, linked to that exact damage event. |
| Shot launch | `shoot` / `launch` | Shooter at the scheduled launch, never attack preparation or arrival. |
| Projectile flight | `projectiles[]` | Existing shot only, from launch inclusive until arrival/cancellation exclusive. Progress uses `(renderTime-at)/(arrivesAt-at)`. |
| Ranged resolution | `hit`/defense at arrival | Actual outcome and HP delta at arrival. Reaching the planned end with no recorded resolution never synthesizes a hit. |

The live integration API is:

```js
const cursor = createCombatVfxCursor();
const frame = cursor.consume(state.combatVfx, renderSimulationSeconds);
// frame: {started, active, projectiles, reset, gap, streamId}
```

Call it with the **render clock**, including movement interpolation delay, every frame. Future events in a newer snapshot remain queued until that render clock reaches `at`. `started` contains fresh cues once; `active` carries exact `age = renderTime - at`. Duplicate snapshots do not restart timers. Initial snapshots, stream changes and backseeks seed past IDs without bursting old one-shots; they can reconstruct an ongoing status or a launched projectile. Packets more than 350ms late do not start stale bursts. Storage is also bounded on the client.

For an explicit review seek/replay, `combatVfxAt(events, time)` returns the real active frame at that time without a live cursor's reconnection policy. This is how the review time slider works.

## Existing engines and deliberate coverage limits

- `server/combat.mjs`: instruments the existing unit-vs-unit RPG/DNA melee and ranged engines. Original legacy `lastEvent`, `dnaActionEvent`, projectile visuals, attack states, HP formulas, XP, timing and random calls remain intact.
- `server/combat-stats.mjs`: existing mode selection, armor, injury, counters and power formulas required no change.
- `client/combat-simulation.mjs`: exposes `trial.vfx` and records the existing actions separately from `history`. Lifesteal evidence uses the actual capped simultaneous recovery and links each share to its hit. Original result/history remain exact.
- The experiment's simulation does **not calculate bleed, area, reflection or out-of-combat regeneration**. It does not emit fictional versions of those incidents. Those cases are audited against the actual server instead.
- `client/combat-analysis.mjs` performs aggregate batches and swaps; it does not play a realtime battle. Its returned samples and statistical results are unchanged.
- The older `createCombatTrial` still uses its legacy damage-only history. The current experiment UI uses `createSimulationTrial`.
- Structure attacks in `server/game.mjs` (`nest`/`burrow`) and environmental damage/noncombat deaths are outside this unit-combat journal. No synthetic unit hit is inferred from those HP changes.
- If a busy world's journal cap drops events, `gap` reports missing history. The client does not invent the missing hits. Reconnection does not replay old impacts.

## Validation and review

- New semantic/timing tests: **8 passed** (`client/combat-vfx-events.test.mjs`): variants without duplicate damage, defense/stun semantics, drain/reflection direction, future render times, snapshot duplicates, lateness, reconnect/backseek, launch/flight/cancel, bounded/truncated history, actual simulation flight and capped drain.
- New real-server journal tests: **6 passed** (`server/combat-vfx-journal.test.mjs`): immutability, observer isolation, save exclusion, bounds, visibility/delta transport, actual critical/followup/area/drain/reflect/death links, bleed catch-up times, capped regeneration, real launch/arrival and zero-damage defense.
- New review tests: **3 passed** (`client/vfx-event-preview.test.mjs`): existing source registration/projectile pixels, actual 300ms launch and 633ms arrival, recovery ending while the projectile is still in flight, no premature HP loss, generated browser bundle matching the module.
- Existing `combat-rpg`, `dna-actions`, `combat-simulation`, `combat-analysis`, `state-delta` and general-hit review tests pass. All nine related test files pass together.
- [head-comparison.json](head-comparison.json): **38 baseline-vs-candidate comparisons passed**, including 28 real-server scenarios, eight experiment simulations, two legacy trials. Compared exact results, full agent state/HP checkpoints, damage/history rows and RNG sample counts. Real incidents covered every requested unit-combat category. The simulation's pure keyed sampler was counted in temporary instrumented copies; production sources and random outputs were unchanged.
- Baseline core sources came directly from committed `a319b0e9bede88e276b6ff2e5f6b7887d2a5f299` into `/workspace/scratch/combat-vfx-head-20261104`. Reproduce with `node Research/CombatVfx/2026-11-04/events/compare-head.mjs BASELINE_ROOT CANDIDATE_ROOT OUTPUT_JSON`.
- Older `client/combat-lab.test.mjs` has **six existing failures** against obsolete fixed-exchange expectations. The same six failures reproduce in the untouched pre-journal copy; this work does not change battle rules to satisfy them.
- [browser-check.json](browser-check.json): Chromium at **390×844** and **1440×1000**, reduced motion and manual seek. No page errors, failed asset requests or horizontal overflow. Verified prepare at 299ms, flight with HP100 at 300/500ms, arrival with HP98.6 at 634ms.
- Review screenshots: [mobile flight](ranged-mobile-500.png), [mobile arrival](ranged-mobile-634.png), [desktop](ranged-desktop.png).

`node tools/build-vfx-event-preview.mjs` regenerates the small browser review and deterministic fixture from the actual server. Its three original bean assets were hydrated only after verifying that each exact path was absent and tracked; all three match their committed blobs. No source image was edited.

Those same three bean ranged assets were also missing from the image policy, although the other three tribes were registered. They now follow the same 256px body display / 512px native camera contract, with a 6×4 shooting atlas and a one-cell idle. The existing 62×36 projectile uses its 31×18 display target. All three native allowances are bound to the exact original SHA-256, atlas and frame dimensions rather than a loose maximum. [ranged-source-registration.json](ranged-source-registration.json) records the three registrations, and the review test audits the actual sources. These are separate from the earlier 36-row runtime-audit repair.

The final published image-map audit found five more existing preview images: three bean `1f` motion atlases, the welcome background and the general-hit draft export. [Their separate registration report](published-preview-registration.md) records the exact source-camera/display rationale and verification. The three groups total **44 distinct policy changes**; the new four-case `client/published-image-audit.test.mjs` audits all 44 together. The draft remains unapproved.
