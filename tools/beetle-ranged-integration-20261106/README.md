# Approved beetle ranged integration

The user approved both beetles, including the flight and impact review, on 2026-11-06. This change starts from the approved bird/mole common ranged route in a8a34ecc.

## Scope

- Two body atlases copied byte-for-byte. Six approved effect cells per species repacked into a 4×2 atlas without changing any RGBA pixel.
- Species-specific flight, release and impact selection for world, detailed combat and laboratory. Launch and closure still come exclusively from the authoritative journal. No server stats, flight speed, damage, range, cadence, defense or cancellation rules changed.
- Beetle special-renderer guards now allow its ranged body in the modal/lab. Its world floor remains .86, with idle-normalized scale. Leader registration inverts the approved seed-to-runtime translation.
- Frozen mouth origin, mirrored physical projectile tip, release clipping and physical fallback coordinates preserve emission and loading behavior. Actual misses, parries and cancellations cannot invent impacts. World block residuals retain their previous presentation.
- No sound, deployment or website changes.

## Validation

`node --test client/beetle-ranged.test.mjs client/creature-ranged.test.mjs client/combat-stage-flight-fallback.test.mjs client/combat-projectile-anchor.test.mjs server/creature-attack-role.test.mjs` passes 99 tests.

`node tools/beetle-ranged-integration-20261106/verify-assets.mjs <approved-source-checkout>` verifies exact body bytes and all twelve effect RGBA cells.

The actual createCombatStage renderer was sampled at idle, preparation, launch, flight, impact and recovery with real assets through Canvas. Headless Chromium could not start because the executor disallows its process singleton socket, including after an approved escalation. This is not a claim of successful browser/gameplay QA. The Canvas decoder could not decode the existing block/parry PNGs; no such defense art was changed here. Focused defense semantics tests remain separate.

The concept endpoint used by the approved normal beetle has different proportions from its older idle: registration preserves width, x and floor; its approved silhouette is approximately 9.3% taller. No new body redraw was introduced.

Generated runtime/local-asset bundles are deliberately left for the final integration owner to regenerate with `node client/build.mjs` and `node client/build-combat.mjs`. Global regression failures must be compared with the unchanged main baseline; focused passes are not a full green suite.
