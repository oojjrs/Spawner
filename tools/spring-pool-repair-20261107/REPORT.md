# Partial spring birth pool stabilization

Four antenna combinations now stabilize the detached pool environment in frames 9–15. Frames 0–8 remain unchanged. The intact whole-body pixels, 1,790 ms timing, final pivot, source direction, travel and idle transition remain unchanged. The early pool drift is not fixed by this batch.

The existing scene layer renderer uses an environment track and one complete body track. No anatomy parts are assembled. Planning birth previews and lightboxes use the same layers. The original flat scene remains the fallback if either layer is missing or has invalid dimensions; this degraded path retains the old drift. Low-alpha haze overlap changes body-edge composite color by at most 1/255 in two forms.

151 focused tests pass after rebuilding the game, combat laboratory and preview bundles. Coverage includes real DNA5 actors, both facings, frame boundaries, exact source hashes, scene anchors, idle transitions, missing/undersized layer failures, and loading only the selected form's two layers. All 1,463 source image policy entries pass. Existing planning content outside the four birth cells is preserved.

The four new layer pairs total 4.12 MB compressed and 47.12 MB decoded RGBA, compared with 58.98 MB for their old flat atlases. Healthy layer loading does not also retain the flat fallback. Independent ordered-pose and failure-path review passed. Live continuous browser playback remains unverified because the browser connection is unavailable.
