> Latest status: the two motions shown in V5 passed user review (Sentinel_0f4b3a7e7f588191b45341ac0e968123). No specific 1x/2x/3x multiplier was selected. See APPROVAL.md. Historical pending labels below describe the earlier review state.

# Weasel V4 rigged visual candidate — NOT APPROVED

V3 was rejected by the user. This alternative generates a single torso/head/tail layer and four attached limb textures per character, then renders 64 continuous phases. The upper body is completely fixed instead of changing drawings every frame. Near fore + far hind are in phase; the other diagonal pair is half a cycle later. A 64% support interval and 36% lifted recovery keep multiple feet in support. Foot target travel is 36px with 13px lift, cycle 800ms.

The cutout limb roots stay pinned. Connected textured strips distribute lower-leg displacement without separating parts. This is a 2D cutout/warp rig, not a fully skeletal physically validated gait. Torso layers occlude the upper roots. All planted foot targets share a near or far ground plane. The body images were generated from preserved original art, not pixel-identical erasures; shape/face differences require user review.

Contents: source parts PNGs, deterministic render.mjs, each character's 64 RGBA Frames and 8x8 sheet.png, 12s H.264 review at normal then 0.25x, large and small view. Transparent output frames 640x440; sheets 5120x3520. No game code, source animation, registration, deployment or rabbit artwork changed.

Potential limits: rigid torso may look overly stiff; rigid tail; perspective means rear-plane paws sit 11px higher; rooted limb warp is not anatomical IK. Camera, movement speed and ground contact have not been verified inside the actual game. Must be reviewed before replacing production assets.

Generation: built-in imagegen used with original brown and white-paw art as identity reference. Prompt requested one legless torso/head/tail and four connected short limb pieces with rounded overlap roots, transparent background. White source then received a background extraction edit. Original generations retained in generated_images.

Final seam revision: far legs behind torso, near legs above it with continuous root alpha blending. Recovery adds a small mid-limb bend. Independent visual review of phase 0/9/18 found previous crossed torso/haunch seam removed and no severed or disconnected pieces. Brown shoulder still has a faint round patch boundary and paws overlap in some phases. Not a claim of full real-time/physics validation.
