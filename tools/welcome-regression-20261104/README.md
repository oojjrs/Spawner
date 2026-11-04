# Welcome recovery regression, 2026-11-04

The earlier antenna-pebble report did not include a console trace, so its exact
original exception remains unconfirmed. All 35 current appearance identities
complete the HTTP browser sequence successfully. A separate injected first-draw
failure reproduced a remaining freeze: the incoming pebble's draw threw before
`tick()` scheduled the next frame, leaving the outgoing spring in `exit`
permanently. Preparation retry alone cannot recover that failure.

The fix isolates rendering failure to one appearance. A tribe variant retries
its basic form; an unrenderable basic or neutral appearance is skipped for that
occurrence while timing and the next character continue. Nested canvas state is
restored even when drawing throws. A later roster occurrence can retry the art.

Verification:

- `node client/welcome-presentation.test.mjs`: 9 passing tests.
- `node --check client/welcome-header.js`: passes.
- `python tools/welcome-regression-20261104/verify.py`: three real HTTP/Chromium
  mobile scenarios pass: all 35 identities after the first four, antenna-pebble
  first-draw failure with basic-form recovery and subsequent characters, and
  neutral first-draw failure with the next neutral continuing.
- No uncaught browser errors in those scenarios. Normal-run bitmap cache peak
  is 8,353,408 pixels, below the mobile 8,388,608-pixel budget.

The browser harness controls only the roster, clock, and failure point. It
appends the current `drawWelcomeChoice` source to the served runtime for this
source-level check because the shared generated runtime belongs to the parent
integration task. The parent must rebuild the runtime before publishing. The
harness does not change product assets, runtime files, or art approvals.

Run the browser verification with network/listener permission. `report.json`
contains the actual sequence, expected caught warnings, and cache statistics.
