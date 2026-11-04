# Native raw00 registration

Registers 22 existing, unmodified native body clips under the four approved base sources. This adds metadata only. Original images, source JSON, frame dimensions, timings, pivots and in-game geometry are preserved. Each whole strip uses one fixed camera; no frame is cropped, resized, fitted by its current bounding box, or replaced with an idle alias.

| Tribe | Registered native actions | Physical frame sizes | Required actions still missing |
| --- | --- | --- | --- |
| bean | idle, attack, hurt, death | 631, 632, 632, 316 | walk, birth, harvest, carry, throw |
| spore | idle, walk, jump, attack, hurt, death | 549, 512, 512, 553, 553, 553 | birth, harvest, carry, throw |
| pebble | idle, walk, jump, attack, hurt, death | 512, 512, 512, 512, 517, 517 | birth, harvest, carry, throw |
| spring | idle, walk, jump, attack, hurt, death | 512, 512, 512, 516, 516, 516 | birth, harvest, carry, throw |

Jump remains optional preview data. An attack clip on mask 00 does not grant the blade bit. All four sources remain **worldReady: false**.

`verify.py` reads every pixel of all 524 native frames and separately inspects all 83 birth candidate frames. It validates source/original/strip hashes, true physical sheet sizes, first-frame alpha bounds, every frame's alpha bounds and source edge clearance. It independently derives each native camera from the same current starter references used by `prepareUnitAnimationSheets`, `prepareUnitDisplaySize`, `drawAgentAnimation` and `drawAgentBody`. All alpha pixel centers are compared against the existing world projection, with numerical error below 1e-12 world units. The old inventory's draft values are cross-checked only after this independent derivation.

The canonical transform is `scale = 512 / nativePixelsPerWorld`, `offsetX = 256 - nativePivotX * scale`, `offsetY = 448 - nativePivotY * scale`. It applies once to the entire strip; native images are still rendered directly from their original pixels. The DNA size multiplier remains `1 + 0.01 * pieceCount`, once.

`report.json` records every frame measurement, exact source hashes, native/canonical transforms, original idle comparison, missing actions and birth rejection evidence. `*-review.jpg` compares the existing-original neutral with its original idle and representative unmodified native frames. `*-all-frames.jpg` shows every registered frame with the same canonical camera and support line for visual inspection. These JPGs are QA artifacts only, and are never runtime images.

Existing differences are preserved and reported, rather than hidden by new image fitting: bean attack starts 16.79 canonical pixels shorter than bean idle under its existing camera; spring flow/jump have different lower-body shapes. Spring native idle/flow/combat/death have a flat bottom while neutral/jump/birth show small feet. The spore idle-v8 cap intentionally drops during its approved idle cycle.

Birth was **not registered**. The existing game replaces the final raw birth frame with idle. The final isolated raw body projects to 186.35 vs 194.56 canonical pixels for spore, 218.74 vs 215.04 for pebble, and 212.57 vs 199.68 for spring. Spore also needs visibility gating and external body rotation/landing squash; spring needs row-wise body deformation around changing anchors; pebble has a separate floor/root/scene contract. Those body-only strips require an explicitly separated and verified birth motion contract before registration. Bean birth is procedural and has no independent body strip. No nest, water, foreground, root travel or projectile was baked into a new body clip.

Verify without changing registration metadata:

```sh
python tools/native-appearance-registration-20261104/verify.py
node --test tools/native-appearance-registration-20261104/native-registration.test.mjs
```

`verify.py --write` updates only the four `00/motions.json` registration files and this directory's QA report/images. It does not run the compiler or edit generated manifests, wrappers, source metadata, policies, memory, runtime or game code.

## Separate birth scene contract and body helper

The follow-up adds `sceneActions.birth` for spore, pebble and spring, separate from `actions.birth`. This contract preserves the existing body strip plus its existing external placement/deformation drivers, source hashes, native sampling stage, visibility and final idle handoff. The main game explicitly connects these three as `runtimeEnabled:true`, `integrationStatus:'legacy-scene-body-adapter'`, and `validation.runtimeRendererConnected:true`. `independentBodyAction:false` keeps them out of the standalone action set. The regular action inventory stays at 22 and world readiness stays at zero. `verify.py` preserves and checks this exact integration state instead of reverting it to the initial disconnected proposal.

[client/unit-appearance-birth-scene.mjs](../../client/unit-appearance-birth-scene.mjs) exports `drawUnitAppearanceBirthSceneBody(ctx, contract, sheet, options)`. It draws only the native body, or invokes the final `drawIdle` callback. Root travel, nest, foreground, water, audio and selection outlines remain with the existing scene. A host can retain the legacy outline branch when an outline is requested. The host must enforce the approved exact mask00 source and normal readiness gates; this helper does not grant whole-world readiness or approve a different source.

Required inputs are the current original body sheet, `frame`, `elapsed` seconds, `worldPixels` (the existing `cell` size), `topLeft` (the existing screen-space tile origin), and `anchor` (the common native idle floor). Spore additionally requires the exact `frameSize × frameSize` Canvas from the existing `sporeBirthFrames` map and its existing `facing`. This fixed native frame copy preserves the current browser sampler; it does not crop alpha bounds or alter source pixels. Pass the existing last-frame idle handoff through `drawIdle`.

Inside the current `drawAgentBody` scale wrapper, pass `outerDisplayScaleApplied:true`. The caller already owns the outer display/DNA scale, so the helper must not apply it again. Outside that wrapper, leave the option false and pass `growth: 1 + 0.01 * pieceCount`; the helper then applies the recorded original display scale and DNA multiplier once.

```js
drawUnitAppearanceBirthSceneBody(ctx, definition.sceneActions.birth, birthSheet, {
  frame: birth.frame, elapsed: birth.elapsed, worldPixels: cell, topLeft,
  anchor: { x: topLeft.x + cell / 2,
    y: topLeft.y + cell / 2 + cell * .7 * .44 },
  outerDisplayScaleApplied: true,
  facing: birth.facing,
  nativeFrame: sporeBirthFrames.get(birth.frame), // required only for spore
  drawIdle: () => existingIdleHandoff()
});
```

`legacy-body-reference.json` captures the original, unchanged `drawSporeBirth`, `drawPebbleBirth` and `drawSpringBirth` function bodies from `client/game.js`. The initial comparison matched their exact function hashes; the baseline is then pinned so an adapter added later cannot silently replace its own comparison target. Refreshing this reference requires the explicit `scene-contracts.mjs --refresh-legacy-reference` option. In headless Chromium, `run-scene-render-qa.py` compares the pinned original pixels against the runtime helper, with external scene props/effects excluded on both sides. It exercises all 83 source frames, detach/contact boundaries, 100/220 pixel world scales, DNA counts 0/12, both spore directions, and both caller/helper ownership of the outer scale. **1,032 render comparisons pass with zero changed pixels and zero channel error**, including 32 hidden-body samples and 32 idle handoffs. The report binds those results to the exact helper, contract and source hashes. Source images are never rewritten.

```sh
python tools/native-appearance-registration-20261104/audit-action-sources.py
python tools/native-appearance-registration-20261104/run-scene-render-qa.py
node tools/native-appearance-registration-20261104/native-registration.test.mjs
```

`followup-action-audit.json` also checks all 108 named indexed harvest/carry/throw/gather/delivery candidates and reads the 12 exact tribe resource-preview descriptors. All 12 identify themselves as `runtime-composite` rendered by `client/game.js` with resource props. They are planning exports, rather than independent source-identical body strips; none were promoted or substituted with idle/walk aliases.

The same QA page also executes the **current `client/game.js` birth function bodies**, using the actual compiled thin runtime getter/helper and valid DNA3 inputs. All 516 integration renders match the original baseline with zero pixel changes; the helper branch actually fires 484 times. The other 32 samples exercise hidden bodies and final idle handoffs. It also checks 28 cases covering allowed raw00 and rejected legacy DNA, invalid DNA, nonzero masks, neutral species, visual attributes, outlines, replacement attribute frames and a different spore scale. Current integration function hashes are recorded separately from the immutable original baseline hashes. Spring water-before-body ordering is checked 72 times; scene props remain with the unchanged scene path. Missing standalone actions and `worldReady:false` remain explicit.
