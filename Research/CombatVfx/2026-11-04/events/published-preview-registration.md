# Five published-preview image registrations

The full published `dist/client/assets.js` image map exposed five registrations omitted by the main game build's asset list. These are existing tracked source images. Each current file's Git blob matches `a319b0e9bede88e276b6ff2e5f6b7887d2a5f299`; no image or motion was rewritten.

This is a separate group from the earlier **36 runtime-audit repairs** and **three bean ranged-source registrations**. The three evidence groups contain **44 distinct policy rows**. [published-preview-registration.json](published-preview-registration.json) records the five exact SHA-256 values, dimensions and final registrations.

| Existing image | Atlas | Grid / frames | Native cell | Display budget | Rationale |
| --- | --- | --- | --- | --- | --- |
| `UnitAppearanceV1/bean/1f/Motions/idle.webp` | 2048×8192 | 4×16 / 64 | 512×512 | 256×256 | Existing motions/source metadata uses the same 512px fixed camera. |
| `UnitAppearanceV1/bean/1f/Motions/walk.webp` | 2048×3584 | 4×7 / 28 | 512×512 | 256×256 | Same source ID, source hash, 512px camera and `(256,448)` pivot. |
| `UnitAppearanceV1/bean/1f/Motions/hurt.webp` | 2048×2048 | 4×4 / 16 | 512×512 | 256×256 | Same original body camera; no per-frame fitting or resampling. |
| `Welcome/forest-clearing.webp` | 1200×400 | 1×1 | 1200×400 | 1920×1080 | Fits the existing viewport budget under the ordinary 150% ceiling. |
| `CombatVfxV3Draft/general-hit/hit.webp` | 1024×512 | 4×2 / 8 | 256×256 | 256×256 | Exact existing fixed-extent export declared by the draft sequence metadata. |

Image paths are relative to `DesignAssets/Animations/`, except `Welcome/forest-clearing.webp`, which is relative to `DesignAssets/`.

The three motion atlases use the same 256px display target already used by their neutral source and other `UnitAppearanceV1` sources. Their exact 512px native cameras are retained through SHA/atlas/cell-bound `nativeSource` contracts. The background requires no native exception.

The general-hit export is also pinned to its existing metadata hash `a6ef48b5a50e1fc4e10d277e4d9ea7bfe6b9faab02e72bf8430a654b5e79ea1d`, 1024×512 atlas and 256px cells. Its sequence remains **`draft-pending-user-review`** and its image is not referenced by `client/game.js`. A source-size registration is not an art approval or a connection to the game.

The current review draws that effect at `min(canvasWidth × .72, canvasHeight × 1.45) × .32 × effectScale`. Its actual scale control tops out at **1.5**, not 2. At the widest supported mobile canvas (under 658px) the conservative maximum is **227.4048 CSS pixels**; at the desktop layout's maximum two-column canvas it is under 188px. The individual frame strip is 160px. A 256px export budget therefore preserves the native draft while covering the current review's display. The draft's original generated 443.5px source cells and packing method were not changed.

Validation:

- `node client/published-image-audit.test.mjs`: **four tests passed**. Audits all **44** distinct originals together; verifies these five hashes/dimensions, the three source-camera/grid contracts, ordinary background budget, and the draft's unchanged status and lack of game connection.
- All five current image blobs equal their tracked originals. No global preferred/maximum policy value changed.
- The original 36-row evidence/test and separate three-row ranged evidence/test remain intact.
- `git diff --check` passed for the added registrations and tests.

The parent task adds the final publication-wide audit gate, so future review pages are checked together with game assets. Hosting files were not modified by this registration work.
