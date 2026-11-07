# Whole-body birth layers v1

Opt-in layered playback for 7 bean and 7 spore antenna-combination forms. No runtime, catalog, existing publication, source artwork, or baked fallback was changed here.

## Deliverables

- `layer-publications/index.json`: all 14 entries. Each entry has tribe/form/sourcePublication, original birth metadata plus sceneLayers, and sceneLayers directly for integration.
- `bean/environment.png` and `spore/environment-blade-antenna.png`: shared tribe environment atlases.
- `{tribe}/{form}/body.png`: deduplicated original 512x512 whole-body cells, pixel-identical including transparent RGB. Never anatomical parts.
- `validation-report.json`, `source-hashes.json`, `memory-estimates.json`.
- `qa/*-original-layered.jpg`: original left, layered right, matching timeline boundaries at preserved aspect ratio.

## Schema

`sceneLayers.version=1`, layers ordered environment then body. Only body has `wholeBody:true`. Each image carries SHA256, frameSize/frameHeight, columns/frameCount. Each layer samples array has the original birth frameCount. A sample is null or `{frame,destination:[x,y,width,height]}`. Coordinates are scene-local, not world coordinates. All timing, final pivot, reference length and world travel metadata remain in the original birth record without modification. Do not add a second clock or rotate spore bodies again.

Bean: 117 frames, 4500ms including 650ms hold. Original 80/512 body scale and fractional destination geometry. Spore: 78 frames, 3120ms, original integer rounded top-left and dimensions. Deduplication uses exact pixel hashes only. Environment is exported before body draw and uniformly trimmed with retained offsets. It is never obtained by erasing the body.

## Reproduce

Set SPAWNER_SOURCE and SPORE_BUILD_SOURCE to the original project and original spore candidate builder directories if needed. Run `python generate.py`. Then run `node validate-bean.mjs FORM` separately for each of the seven forms (listed in generate.py), followed by `python finalize-validation.py`.

Dependencies: Pillow, numpy, Node, @napi-rs/canvas. The generator points to the installed official runtime canvas package. Per-form validator processes avoid retaining decoded fallback canvases across forms. No massive complete-scene intermediate atlases are generated. Environment-frame PNG intermediates are small and reproducible, but not needed at runtime.

## Validation and memory

All 1,365 original scene frames tested. Every mapped body cell and every final idle endpoint is byte-exact. All spore compositions are RGBA byte-exact using original Pillow Lanczos sampling. All bean compositions have zero visible-channel difference using original high-quality body sampling and no-op environment copying at native 1:1 resolution. @napi-rs/canvas high-quality smoothing re-filters even 1:1 cropped atlas draws, so this no-op environment copy is essential for offline pixel comparison; browser scaling remains a separate runtime QA responsibility.

Unique 16 layer assets: 42,822,842 PNG bytes, 518,425,600 decoded RGBA bytes across all 14 forms with environments shared, versus 1,761,607,680 decoded bytes for all 14 original baked fallbacks (70.6% lower). These are texture estimates excluding browser overhead. Initial fallback/layer overlap can temporarily require both; releasing unused decoded fallback textures is a runtime decision.
