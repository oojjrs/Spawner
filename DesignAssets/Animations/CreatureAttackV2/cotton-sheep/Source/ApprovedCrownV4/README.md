# Approved cotton-sheep crown ram V4

User approval: “솜양 공격 통과.” This applies only to the sheep attack. Other species' candidates are not included.

The game continues to load `../../runtime.webp` through its existing registered path. World, detailed combat and Combat Lab therefore share this approved artwork without any renderer, size, hit-clock or rear-hoof-registration change. The corresponding local embedded asset contains the same WebP bytes.

- `runtime.png`: the exact approved 1160×580 runtime atlas. Do not resample it.
- `source-cels.png`: approved 2048×1024 authoring atlas, eight 512px cels.
- `previous-runtime.webp`: original V2 runtime retained for regression checks and provenance.
- `head-neck-regions.json`: authored head/neck/shoulder regions and source-body preservation record.
- `approval.json`: approval quote, scope, source/output hashes, original timing and registration.

Cels04–07 carry the new entry, crown-first impact and recovery. Cels01–03/08 and original rear-foot support are retained. Hit onset remains 370ms, impact hold 240ms and total attack 1030ms.

The older `../../attack.webp`, `../../Frames` and original V2 generation files remain unchanged as historical authoring material. They are not the source for the approved V4 runtime. Use `python DesignAssets/Animations/CreatureAttackV2/cotton-sheep/export-approved-crown.py` from the repository root to regenerate the exact-lossless WebP and local wrapper. The global V2 exporter now dispatches this species through the approved exporter using approvedRuntimeExporter in Source/runtime-registration.json, so a bulk export cannot silently restore the legacy art. The approved exporter also verifies the canonical PNG hash before writing.

Verification: 25 focused attack/support/asset tests passed. Combat and preserve-design runtime builds passed in an isolated snapshot, and the generated sheep wrapper matched the delivered wrapper. Real browser/device playback was not performed during integration. No sound or server gameplay changes are part of this update.
