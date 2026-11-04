# Approved bean source rigs and grounded motion drafts

## Visible parts and idle/hurt drafts

The follow-up stage adds **292 real visible regions across 31 source-specific
rigs** (`00`–`1e`): body, individual eye patches, feet, innate leaves/blade,
antenna cap/stalk, carapace and secretion. Each own `Rig/visible-parts.json`
contains exact source-pixel ownership runs, per-part source UV meshes, bone
bindings and visible junction annotations. The previous verified 1f rig is read
for its part vocabulary only; none of its art or generated backing is borrowed.

`Rig/body-weight.png` is **8-bit deformation data**, not new art. Idle and hurt
drafts keep annotated feet, the recorded support band and all hard elements
pixel-for-pixel fixed. Eye patches translate rigidly without scaling. Observed
body skin connects those regions through one continuous source-surface field;
separating a patch cannot reveal a fabricated concealed body. Both actions start
and end at the exact neutral pose. Their amplitudes are bounded per source to
avoid folds in bilinear cells, and camera/scale stay fixed throughout.

These are intentionally small early movements, not final art quality or action
readiness. **Each mask remains pending** for exact part-boundary review,
independent leaf/antenna/armor movement, larger hurt poses, walking and the other
required actions. No `motions.json`, source metadata, shared manifest or runtime
is changed. `productionActionClipsAdded` and `worldReadyAdded` remain zero.

`visible-parts-report.json` records raw neutral partition reconstruction and
34 actual raster frames per source (17 per action), full contact/hard-pixel
comparisons, canvas bounds and bilinear-cell Jacobian checks. It does not claim
human motion approval. `visible-parts-contact-31.png` shows the actual annotated
regions. `visible-idle-hurt-drafts.mp4` shows 00/08/12/1e through a full idle cycle
and hurt recovery in separate unchanged 512px cameras.

The hosted review page is **`/BeanRigPreview.html`**. It reuses existing
`SpawnerAssets`, the thin appearance runtime and `Source.acquire` with source
hash verification, bounded encoded bytes and file-protocol lazy scripts. Compact
part annotations and compressed deformation data live in
`client/bean-rig-preview-data.js`; no DesignAssets JSON fetch or new atlas is
needed by that page. Only the selected source image and selected decoded field
are kept active. The GPU applies the same continuous inverse deformation; a
software fallback is available. The UI labels these as production drafts and
links the separate existing representative motion viewer.

```sh
python tools/approved-bean-source-rigs-20261104/build_visible_parts.py --check
python tools/approved-bean-source-rigs-20261104/export_visible_drafts.py
python tools/approved-bean-source-rigs-20261104/check_visible_parts_browser.py
```

The browser report covers all 31 sources / 310 actual GPU action frames,
fixed-pixel comparisons, real changed pixels in both actions, exact endpoint
recovery, mobile layout and a file-lazy source-loader protocol simulation.
`visible-parts-cpu-validation.json` separately records 20 software fallback
frames from unarmored and armored sources, with the same fixed-pixel result.

## Initial bind-only preparation

This prepares all **32 approved bean neutral sources** for further rig work without
changing their art, approvals, registration, camera, runtime or action readiness.
There are 31 additive per-mask `Rig/source-bind.json` files for `00`–`1e`.
`representative-1f-source-bind.json` is a validation companion kept here: the
existing verified `bean/1f/Rig/rig.json`, parts and representative clips are untouched.

Each rig refers exclusively to its **own integrated original**. It records exact
source/decoded-RGBA/metadata hashes, approval reference and provenance, the 512px
camera and `[256,448]` pivot, source-specific eye/face/support anchors, a triangle
surface with those exact anchor vertices, and half-open row runs owning every
nonzero source RGBA pixel exactly once. No texture, body, limb or concealed surface
from another mask is reused. No duplicate unit PNGs or atlases are produced.

The whole source stays one rigid surface. Eye and trait bindings explicitly say
they are unsegmented; mesh deformation is disabled. These are bind resources,
**not completed idle/hurt or other action clips**. No `motions.json`, action state,
shared manifest, generated library, runtime, image-size mapping or hosting changes
are part of this work. Each new bind resource keeps `worldReady: false`.

## Evidence

`report.json` records all 32 independent source hashes, a family digest and
per-source results. `build.py` independently decodes the saved coverage runs and
copies exact source RGBA bytes to their unchanged coordinates, compares all
1,048,576 RGBA channel values per image, checks ownership has no holes/overlap,
checks every visible pixel center is covered by positive-area triangles, verifies
the registered anchors are exact mesh vertices and preserves source metadata.
It also records the unchanged original 1f rig hash.

`bind-contact-32.png` is a **review sheet** at half camera size. Red marks the
recorded support landmark; blue marks the eyes. The 32 original unit PNGs remain
unchanged and are the only texture inputs.

The standalone viewer has an optional ±0.45° **rigid support-pivot diagnostic**.
Its support landmark is analytically fixed and all source distances remain fixed.
This is a transform diagnostic, not a validated idle/hurt motion: individual foot
pixels rotate with the source and the complete contact footprint is not pinned.
It must not be registered as a game action.

`browser-validation.json` records all 32 browser coverage reconstructions, 64
diagnostic transform samples per source, and mobile viewer checks. Browser PNG
decoding may round low-alpha RGB; raw source RGBA fidelity is independently
verified by Python rather than inferred from canvas decoding.

## Run

From the repository root:

```sh
python tools/approved-bean-source-rigs-20261104/build.py --check
python -m http.server 8768 --bind 127.0.0.1
# In another shell:
python tools/approved-bean-source-rigs-20261104/check_browser.py
```

Open `/tools/approved-bean-source-rigs-20261104/` on that local HTTP server.
Use `build.py` without `--check` only to explicitly regenerate these additive rigs
after an authorized source update. It will reject unapproved art or stale hashes.

## Remaining work

Visible parts/joints need individual source annotations before they can move
independently. Any separation that reveals absent pixels needs an explicit art
decision; this tool does not invent hidden anatomy. Foot-contact walks, idle/hurt
and the other required actions then need actual production and review at game
scale. Only a complete validated action set can advance world registration.
