# Approved neutral ranged bodies

Flower-tail bird and soil mole body motions were approved on 2026-11-06.
The native atlases are copied without changes from the reviewed artwork.
Their SHA-256 identities are pinned in `DesignAssets/image-sizes.json`.

- Bird: eight 512-pixel cells, 1,000 ms authored duration, release cell 4 at 400 ms.
- Mole: eight 512-pixel cells, 1,040 ms authored duration, release cell 4 at 550 ms.
- `ranged.json` retains the source creation details and the production registration.
- Runtime registration is in `client/creature-ranged.mjs`. Recorded `launchedAt`
  and valid `shotLaunches` control each release; `hitAt` remains projectile arrival.
- Melee artwork, combat rules, movement speed and audio are unchanged.
- Only the bodies are newly approved. Flight and impact use existing generic
  rendering, with measured outlets, without adding unapproved projectile artwork.
- The game, detailed fight view and combat laboratory share this registration.
  The generated runtime and offline asset wrappers are included in the commit.

Tests cover release timing, multiple and terminal shots, cancellation, mirrored
outlets, native frame selection, source hashes and unchanged melee routing.
Browser playback has not been verified in this environment.
