# Late-game actual-world validation

Baseline eff864a4 (v36), 2026-11-06. Results pending.
World runs extend to43 minutes to include encounters with40-minute cohorts.

Four tribes on seed13 and spring on seed413. Spring413 uses the separate
worker-recovery policy; do not replace its failed original 25-minute result.

`run.mjs` continues the earlier policy through43 minutes, with a fixed maximum
of eight level-three soldiers even after nest4. This is a deliberate stagnation
control, not a fair assumption that a growing player never upgrades units.

`growing-run.mjs` resumes the exact25-minute saved world, RNG and policy state.
It targets12 soldiers at nest3 and14 at nest4, subject to actual affordability.
At nest4 it produces legal99P moderate melee units (50/91 occupied board cells),
without retroactively upgrading existing units. Workers retain the economical
45P level-three build; blindly replacing them with the81P alternative would
confound the army experiment. No manual formation, attack or retreat commands.

The comparison retains all rival colonies, wildlife, movement, resources,
raids and combat. Tick size0.25seconds. Every five minutes produces a compressed
full-world checkpoint. These large checkpoints stay outside the repository.

Fields: food is cumulative delivered food, points current spendable DNA budget.

A40-minute cutoff alone does not validate battles against newly dispatched
40-minute full-strength cohorts. State that limit unless an extended run is
performed. Same-cell combat calibration is separate from world verification.

Run examples:
`SEEDS=13 TRIBES=bean LABEL=bean SECONDS=2580 node tools/lategame-playtest/run.mjs`
`RESUME=/path/to/bean-1500.json.gz SEEDS=13 TRIBES=bean LABEL=growing-bean SECONDS=2580 node tools/lategame-playtest/growing-run.mjs`

An initial high-concurrency run lost one process (`Killed`; memory pressure was
observed but OOM was not proven). Incomplete runs were excluded, retained
checkpoints used to resume, and concurrency reduced to three.

## Archived, not current validation
Stopped at user request. These scripts/profiles describe the earlier50P/20P-growth baseline. They do not validate current30P/80/200/500 costs or current gathering. No pending run or completion claim is implied.
