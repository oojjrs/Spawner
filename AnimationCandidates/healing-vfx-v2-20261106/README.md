# Healing V2: redrawn animation sequence

UNAPPROVED standalone visual asset. No game logic, integration, deployment, or sound changed.

User feedback: V1 was too much like a static image. V2 uses 16 distinct generated key poses rather than enlarging one picture. The ribbons grow from the floor, curl upward, separate into streaks, then disappear. Eight independently timed sparkle particles travel upward on separate paths.

Source: generated with built-in image_gen from V1 as style reference. First sequence was rejected locally because blooms touched neighboring cells. Second source is retained as source-sheet.png. Its generated cell-divider lines are excluded by a uniform 7px inset crop; no per-frame silhouette reframing. The crop is uniformly resized to 384x384.

Timing: 16 key poses over 1.60s plus 0.25s final fade, transparent end frames. Crisp keyframe holds avoid crossfade ghosting. The effect is NOT 60 independently drawn poses: frames/ contains 60 output RGBA frames at 30fps, made from 16 redrawn key poses plus independently moving sparkle particles. Atlas is 10 columns x 6 rows, 384px cells. Pivot recommendation for review only: canvas center X, floor approx Y=0.83. No game timing/size has been changed.

healing-v2-comparison.mp4: 12 seconds at 30fps, H.264, 1280x720, silent. Old single-picture effect, new redrawn effect and small-scale new effect play side by side, all at 1x normal timing. Gray silhouette is a scale guide, not a game character or real game playback.

Limits: generated key-pose outlines have small per-frame variations; precise ring anchor consistency and integration with real units remain unapproved. Readability and actual player perception require user's review. V1 files preserved unchanged.

Generation prompt: 4x4 sequential transparent healing sprite sheet, consistent floor anchor, emerald-white glossy ribbons with small gold accents, ring grows into upward spiralling ribbons which split into streaks and dissipate, distinct shapes across 16 cells, ample padding, no unit/text/background. Style reference V1 healing-surge.png. Built-in tool used, no API fallback.
