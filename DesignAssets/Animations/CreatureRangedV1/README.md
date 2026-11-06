# Approved neutral ranged assets

Body motions approved on 2026-11-06 are registered for flower-tail bird, soil
mole, lantern keeper, bubble toad, vine turtle, spiny-back beetle and its leader.
The reviewed body atlases are retained without changes. Their SHA-256 identities
are pinned in `DesignAssets/image-sizes.json`.

- Bird: eight 512-pixel cells, 1,000 ms, release cell 4 at 400 ms.
- Mole: eight 512-pixel cells, 1,040 ms, release cell 4 at 550 ms.
- Lantern: eight 512-pixel cells, 1,000 ms, release cell 4 at 420 ms.
- Toad: eight 512-pixel cells, 1,000 ms, release cell 4 at 460 ms.
- Turtle: eight 512-pixel cells, 1,400 ms, release cell 4 at 680 ms from its back plant.
- Beetle and leader retain the timing and registration in `client/creature-ranged.mjs`.

Recorded `launchedAt` and valid `shotLaunches` control each release; `hitAt` remains
projectile arrival. The game, detailed fight view and combat laboratory share
this registration. Generated runtime and offline asset wrappers accompany it.
Melee artwork, combat rules, projectile speed, arrival timing, movement and audio
remain unchanged. Rejected turtle walking is not installed.

## Approved effects

- Beetle and leader: their approved flight, release and impact artwork.
- Lantern: the approved v2 gathering glow, muzzle fan, golden/teal seed projectile
  and contact bloom. Native rectangular flight cells face right.
- Toad: the approved water projectile, impact animation and parabolic visual path.
  Flight duration still comes from the server, not the review video's duration.
- Turtle: the approved static seed projectile, enlarged by 25 percent to a width
  of 125 pixels per displayed original 512-pixel body canvas. There is no new
  turtle impact artwork; existing impact handling remains in use.
- Bird and mole retain existing generic flight and impact rendering.

Effects and their rendering contracts are in `client/creature-ranged-vfx.mjs`.
Only approved assets are registered. Native coordinates are transformed with the
same body registration as each displayed sprite, including mirrored outlets.

## Source registration and verification

Lantern, toad and turtle registration inverts the existing melee seed resize and
translation. Reference hashes and measured alignment are recorded in each
`Source/runtime-registration.json`. Turtle translucent edge colors differ by at
most one value from its PNG seed due to the original atlas compositor; opaque
pixels and alpha are identical. The reviewed atlas itself is unchanged.

Tests cover release timing, multiple and terminal shots, cancellation, mirrored
outlets, native frame selection, source hashes, unchanged melee routing and the
actual combat-stage renderer. Visual checks use the real Canvas renderer;
live browser playback has not been verified in this environment.
