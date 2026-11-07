# Conditional welcome lifecycle repair

Two reproducible lifecycle conditions are corrected:

- Switching reduced motion on while the previous character exits and the next enters no longer leaves both frozen together in the center. Only the current identity is drawn while reduced motion is enabled; selection, upcoming preparation and phase clock remain intact. Normal motion resumes from that clock.
- A failed initial common decode no longer permanently rejects the header's startup facade. Initial preparation has bounded retries and one shared pending start; a later explicit start can retry. No drawing, animation scheduling or shared resource exposure occurs until success. The native readiness API also checks the same appearance's idle/walk/center presentation, because some lower-level load errors are caught instead of thrown.

The Ready promise now means structural initialization. Successful start() returning true establishes asset readiness. Existing entry code already awaits Ready and then start(), and game initialization accepts absent shared resources. Persistent failures are not retried forever and do not substitute a different appearance. No new retry button is added.

Art, frame geometry, source facing, current/next selection, first four introductions, neutral 80% weighting, center idle, volume and user preferences are unchanged. No asset cache eviction or broad memory changes are included.

## Validation

- The unmodified header reproduces all four targeted failure regressions.
- Final lifecycle plus welcome/facing/turtle checks: 32/32 pass, including the seven new complete native-header lifecycle tests.
- Related room-entry/cache/unit-loading checks: 16 pass / one unrelated existing beginner-help default assertion fails. Those tests and all inputs they load are unchanged and do not load welcome-header.js.
- Client build, syntax and whitespace checks pass. No generated bundle contains this separately loaded header, so unrelated build-only planning/thumbnail/list churn was discarded.
- Tests execute current native preparation/readiness, action-art load behavior and movement clocks with mocked DOM, decoding and raster output. They do not establish real browser pixels, continuous playback or memory use.

The originally reported weasel movement symptom remains unconfirmed. These two conditional defects are not claimed to explain it. Browser access still fails at the managed transport endpoint, so actual browser playback remains unverified.
