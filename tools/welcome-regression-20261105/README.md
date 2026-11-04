# Current welcome verification, 2026-11-05

The original antenna-pebble freeze is still unconfirmed. The repository already
contains preparation timeout/retry, draw-failure fallback/skip, balanced canvas
state and a shared bitmap pixel budget.

Additional browser-free startup diagnosis found that rejection of any bean part
decode aborted the whole header before its first animation frame. The production
loader now warns and uses its existing basic-sprite fallback when the parts set is
incomplete. This is a separately reproduced startup failure, not proof of the
original antenna-pebble freeze cause.

Completed in this checkout:

- `node tools/welcome-regression-20261105/check-startup.mjs`: 36/36 pass; the actual
  header source runs against stub DOM/canvas with eight individual decode failures,
  healthy control, two widths and motion on/off. The failure rejected initialization
  before the fix. This verifies scheduling and sprite fallback, not real pixels.

- `node --test client/welcome-presentation.test.mjs client/canvas-cache.test.mjs`: 11/11 pass.
- `node --check client/welcome-header.js`: pass.
- `python -m py_compile tools/welcome-regression-20261105/verify.py`: pass.

Pending actual browser verification:

- Chromium at 390×844 mobile and 1440×1000 desktop.
- All 35 appearance identities, initial four order, antenna-pebble fifth.
- Injected first-draw errors for antenna-pebble and a neutral creature, subsequent
  animation continuity, no uncaught errors and cache budget compliance.
- Screenshots and report.json are written only by a completed browser run.

The script derives from the previous mobile regression but serves the actual
built runtime without injecting a replacement source helper. Run `npm run build`
before verification when source changed. The controlled animation clock and
roster make this a deterministic browser regression, not a natural-time soak or
physical Android-device test.

Execution blocker: local Chromium aborts before opening a page with
`socket() failed: Operation not permitted`, both in the normal runner and the
approved execution attempt. The separately connected cloud browser cannot reach
this runner's loopback HTTP server (`ERR_CONNECTION_REFUSED`). Neither viewport
has been verified in this attempt, and no browser report or screenshot is claimed.
