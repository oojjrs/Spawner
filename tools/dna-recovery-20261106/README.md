# DNA colony extinction recovery

2026-11-06. Midgame simulation reported a colony with no units and 3P remaining waiting for nest destruction instead of ending.

Cause: checkEnding used the old blank-slot birth cost (2–4P by tribe), while the new UI creates DNA designs. An empty DNA body can be born at 3P but has no harvesting or combat ability, so it cannot restore income. A productive basic gathering DNA currently costs 8P. Only delivery/initial grants/cheats add P; corpses and material inventory cannot restore income without workers.

Fix: derive the minimum productive DNA cost from the current gather gene and validator, not a hardcoded number. Existing legacy templates remain a legitimate fallback because the UI can still edit those to plain legacy gatherers. Autonomous tribes retain their actual legacy production fallback. Existing living/newborn units and destroyed-nest behavior are unchanged.

Tests: 43 passed across ending, tribe-start, antenna-range, dna and combat-stats. Coverage includes all four tribes at cost−1 and exact cost, actual worker creation, blank DNA excluded from recovery, legacy fallback, and save/restore/end immutability. Client build passed. No full-suite or browser claim.
