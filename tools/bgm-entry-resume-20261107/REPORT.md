# Audio activation retry repair

## Scope

A reproducible conditional failure held all later input handlers behind the entry AudioContext.resume() promise. If that first promise never settled, a later activated touch could not call resume again. This change preserves normal initial context/promise reuse, while a fresh pointer, click, key or unmute gesture supersedes the obsolete entry request and attempts resume synchronously.

Old entry promises cannot disable newer attempts. Independent later gesture attempts retain retries rather than sharing a possibly stuck promise. A small attempt counter ignores a stale resume rejection, and a late rejection cannot disable a context already running. A current failure with no recovery retains the existing error handling.

Volume, mute choice, hidden/inactive guards, playback position, track selection, audio assets and device/browser settings are unchanged. The separate iOS interrupted-state proposal is not included.

## Validation

- New conditional state-machine tests: 16/16 pass, including entry/pointer races, late failures, repeated input, closed context, mute/hidden/inactive transitions and peaceful/combat playback selection.
- Existing eight audio test files: 46 pass / 12 fail, exactly the same failure names as the unmodified baseline 5e3106b3. No assertions were weakened or skipped. Existing failures concern missing fixture fields/sources, movement audio metadata and extracted game mocks; this is not a full green suite.
- Focused activation/readiness/combat audio checks: 44/44 pass.
- Client build succeeds. The build's unrelated planning/thumbnail rewrites and removal of historical local-asset list entries were discarded. audio.js is directly loaded by Spawner.html, so no bundled copy needs changing.
- Syntax and whitespace checks pass.

## Limits

The user reported inaudible BGM on Android. This conditional code defect does not establish that their device encountered the same state. The actual browser/WebView, effects audibility and live AudioContext/media state remain unobserved. Managed browser access failed at its transport endpoint, so no Android/desktop audible playback was verified. Do not describe this as a confirmed resolution of that device incident.

The accompanying baseline and after logs deliberately retain known failures and their exact error details.
