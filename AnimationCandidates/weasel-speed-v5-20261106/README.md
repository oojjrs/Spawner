> Latest status: the two motions shown in V5 passed user review (Sentinel_0f4b3a7e7f588191b45341ac0e968123). No specific 1x/2x/3x multiplier was selected. See APPROVAL.md. Historical pending labels below describe the earlier review state.

# Weasel speed V5 comparison — unapproved timing options

V4 body, poses, leg paths and 64-frame source sheets are unchanged. This comparison displays 1x (800ms), 2x (400ms) and 3x (266.6667ms) cycle options with actual leftward translation. Every column is presented in real time, not slow motion. Lanes reset at 3 seconds for viewing.

## Foot speed derivation
V4 planted-foot relative displacement = 36 source pixels over 64% of a cycle. Root velocity must cancel it during stance:

v = 36 / (0.64 * T)

- T=0.8s: 70.3125 source px/s; at video scale .35: 24.6094 display px/s.
- T=0.4s: 140.625 source px/s; display 49.2188 px/s.
- T=0.2666667s: 210.9375 source px/s; display 73.8281 px/s.

Near fore/far hind phase offset 0, far fore/near hind .5. Limb toe row has full displacement weight and is level in support. Root movement is continuous; animation sampled at 64 phases gives maximum source support quantization error under 0.879px (under .308 display px). Source rendering and gait are the same native rig as V4.

## Scope/limits
No production game speed or cells-per-second value has been changed. Source pixels are not world cells: actual game sprite scale is needed to choose cyclesPerCell. For sourcePixelsPerCell S, cyclesPerCell = .64*S/36, and period = 1/(gameSpeedCellsPerSecond*cyclesPerCell). The tiny original step inherently requires a high cadence at high travel speeds. To move much faster without excessive foot cadence, stride length would need a separate approved extension. This review deliberately preserves the user's liked motion.

No new image generation, original assets modified, integration, deployment or sound. This is a preview-only animation timing/translation comparison, not a recording of actual in-game locomotion.
