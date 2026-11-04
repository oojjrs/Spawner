# Bean rig draft review timeline

`BeanRigPreview.html` now supports position scrubbing (which pauses), 30fps
reference stepping, and 0.25×/0.5×/1× playback. The end of idle can be held at
100%; hurt holds its recovery endpoint. Hidden-tab time is excluded so returning
to a phone browser does not skip the review. Reduced-motion starts paused.

This changes review controls only. No image, rig, motion equation, source hash,
approval, registration, game runtime or ready count changes. The 30fps steps are
review samples of the procedural draft, not a claim of completed animation clips.

Validation: `node --check client/bean-rig-preview.js` and
`node tools/bean-rig-timeline-20261105/check.mjs` passed. The latter executes the
actual clock helpers in an isolated VM and checks control IDs. No real-browser
visual/input verification was possible in this environment; that remains open.
