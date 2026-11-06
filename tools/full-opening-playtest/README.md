# Actual-room opening playtest

Baseline: main5463d421. Unlike the earlier isolated harvesting tests, this harness calls the production createRoom/tickRoom pipeline with world generation, all four colonies and rival AI, actual movement/pathfinding, wildlife, raider dispatch, combat, resource updates and ending checks enabled. Seeds13/413/731047, all four player tribes. Quarter-second steps. Math.random has a fixed per-case seed; room identifiers are generated normally.

Novice policy: one medium worker at0:30; no nest upgrade until2:00; no military purchases until2:30. Purchase two blade+power+health2+movement soldiers as income permits. From6:00 add/replenish one more soldier per minute up to8, only when affordable. No targeting, teleportation, invulnerability, attack-stat overrides or manual micro. This is one reproducible modest build/order, not every novice behavior.

Baseline12/12 cases survived12min and had two soldiers by2:30–4:30. All first raiders were eventually defeated. One worker and four soldiers died in total; lowest nest199.4/200. The practical problem was waiting: first raid arrival5:39–7:33 despite nominal5min departure policy.

Root cause: colonyRaidPressure added35–105sec arrival grace on top of the300sec opening. Changed only that grace to0–30sec. Paths, cadence, strengths, DNA, prices and gathering are unchanged. Existing saved opening/cooldown records remain preserved rather than silently rewritten.

After adjustment,8/8 cases (seeds13/413×4tribes) survived10min; two soldiers by2:30–4:30; first raiders arrived5:27–5:55 and were all defeated. Total losses: one worker and one soldier. Minimum nest198.5/200. A separate731047pebble replay covers the baseline worker-loss case. Its full record is grace-risk-results.json.

The isolated budget40cases, same-cell combat trials, and these actual-room cases answer different questions. This run includes positioning risk: workers can still be caught alone, and later raiders can kill an isolated soldier. That is not a path/engagement failure or a guaranteed no-loss opening. Twelve minutes is not full-match or high-level balance coverage.

Artifacts: baseline {bean,spore,pebble,spring}-results.json; adjusted grace-*-results.json; summary.json; run.mjs. In-progress files are debugging snapshots, not additional cases.

Run: LABEL=my-run SEEDS=13,413 TRIBES=bean,spore,pebble,spring SECONDS=600 node tools/full-opening-playtest/run.mjs

Regression: raid-pressure,raid-cadence,raids,raid-combat-scale =33/33 passed. Product diff is raid-pressure.mjs plus its boundary test and updated actual-dispatch expectation in raids.test.mjs. No deployment performed by this worker.
