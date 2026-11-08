# Follow-up thirteen spring source-facing candidates

Status: integrated into the shared local source snapshot after validation. Thirteen native sheets, thirteen byte-identical aliases, twenty-five linked previews and thirty source publication metadata files were updated. Runtime registries, image-sizes, tests and the completed seven-source repair are handled separately from this source-only package. No build, commit or push was run.

## Result

Five melee sheets and eight ranged sheets have complete image-generated leftward middle poses. The original complete first and last cels are retained byte-for-byte in visible RGBA and alpha. No full-body reflection, organ reflection, body-part compositing, mesh warp or runtime direction workaround was used.

Melee attacks now bend the flexible blade toward the left. Ranged attacks extend the original upper-right forehead pore across the forehead, with the attached nozzle opening pointing left. The trailing crest, antenna and carapace identities remain distinct. Front-facing neutral expressions are preserved.

Every candidate preserves the source sheet dimensions, original cell dimensions and frame count. Timing, pivot, reference length and registry geometry are unchanged. The existing runtime source-facing registration must be updated by the audit owner when integrating these images.

## Verification

- All thirteen candidates pass dimension, source hash, endpoint alpha, endpoint visible RGBA and cell-border checks in `followup13-validation.json`.
- All two hundred complete cels were reviewed in dark-background contact sheets. All attack/launch peaks move left, and every sequence returns to the original neutral body.
- The blade-carapace melee peak at frame 6 needed a small complete-cel placement adjustment to keep the fully drawn blade tip and antialias margin inside its original 480-pixel cell. This changes neither anatomy nor the declared pivot. The adjustment is recorded in its manifest.
- The first blade-secretion-carapace ranged generation contained a faint translucent exterior matte. The image generation tool cleaned that background, and the cleaned candidate was packaged and revalidated. The prior generated sheet is retained separately for provenance.
- Three ranged generated atlases placed an adjacent nozzle tip a few pixels across a nominal grid line. Final packaging locates the complete connected body in the full generated atlas, then crops that complete pose with antialias padding. This preserves the full tip and avoids packing a fragment of the neighboring cel. It does not mask, redraw or composite body parts. Each final middle cel has exactly one significant connected silhouette.
- Original production source hashes were checked immediately before integration. All thirteen native files now match their verified candidates byte-for-byte. The complete old/new SHA journal is `followup13-integration-changes.json`.

## Limits requiring final in-game review

These are regenerated middle cels, so their highlights are not exact copies of the original endpoint art. The average opaque RGB difference near endpoint transitions is approximately 2–17 levels out of 255, depending on the form. Contact sheets show no large size jump, detached organ or visible background matte. GIF previews are provided, but the actual game registration and simultaneous left/right targeting still require the audit owner's integrated build check. These local source changes are not claimed to be deployed.

## Handoff

`followup13-integration-map.json` lists all exact source and candidate paths, SHA-256 values, geometry, peak frames, visual evidence and previews. Each candidate has a matching manifest and contact sheet. All files from this batch use the `followup13-` prefix.

The integration map and original candidate validation record the pre-integration candidate stage. Use `followup13-integration-changes.json` for the latest publication status, `followup13-integration-files.txt` for the exact eighty-one changed production paths, and `followup13-integration-verification.json` for the post-write checks.
