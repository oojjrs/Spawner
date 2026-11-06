# Midgame world playtest (2026-11-06)

## Scope
Actual `createRoom` / `tickRoom`, 0.25-second simulation steps, all four colonies,
world resources, pathfinding, wildlife, raids, combat and endings. Seeds 13 and
413; 25 minutes per completed case. Seeded random generator is stable for a
specific source version but code changes can change random consumption. These
are automated policies, not human usability tests or a proof that all maps are
survivable. There is no teleport, invulnerability or injected combat stats.

Source baseline: f7011761. Later balanced and candidate runs additionally include
3c676b5b (actual DNA recovery cost) and 2d91e7e4 (ignore retreating heal targets).
No stage after 25 minutes is covered by this world test.

## Policies and controls
- `run.mjs`: additional 17P worker, level two at/after 2 minutes, first two 23P
  soldiers from 2:30. Later 33P roaming workers and 37P roaming soldiers, targeting
  ten soldiers. This costly policy is a stress case, not the sole balance target.
- `defender-run.mjs`: replaces later roaming soldiers with 40P armored guards.
- `mixed-run.mjs`: additionally maintains one 19P medic.
- `balanced-run.mjs`: cheap 17P workers first, six guards maximum, one medic.
  These controls retain the deployed 20/400/2000 nest prices.
- Candidate comparisons use cheap workers, a research priority once four
  soldiers survive, and actual tier-three DNA after reaching level three.
  Nest prices 20/100/500 preserve a fivefold progression between levels.
  Separate economy-only and combined raid/economy cases distinguish effects.

The unit designs are legal DNA paths. They are not full-board maxima. A medic
has healing range two, and stopping at that distance is expected behavior.

## Reading results
`summary.json` groups completed scenarios. `*-in-progress.json` is not a finished
case. A completed 25-minute survival is not a win or a claim of later safety.
Non-military deaths include medics as well as gathering workers.
`damageSources` is a historical field name: it collects positive combat event
amounts, including healing. A same-tribe source is friendly healing, not enemy
damage. Raid kills count recorded raid states, not every wildlife kill.

## Final result

- Deployed prices/strength, balanced worker-first policy: 0/4 survived 25 minutes;
  all fell at 21:34–23:14, with no level-three nest.
- Economy-only (20/100/500), improved research policy: 1/8 survived. Four reached
  level three. This control uses the same research/growth policy as the combined
  candidate, so changing prices alone did not remove the combat cliff.
- Combined calibrated prices/raid strength, same improved policy: **7/8 survived**.
  All seven survivors reached level three at 10:15–17:45, retained 5–8 soldiers,
  and ended with 398.5–400/400 nest health. They lost 1–5 soldiers and 0–3
  non-military units each. This is not a no-combat scenario: 10–16 raids departed
  toward surviving colonies over 25 minutes, with 60.75–104.25 combat seconds.
- Spring seed 413 still failed at about 20 minutes. Its first raid killed two
  east-side gatherers before the defender arrived, reducing income to 4–6P/min.
  The policy bought a medic before replacing workers and later waited for a 17P
  worker at a 15P balance, although an 8P basic worker was affordable.
- A separate **same-source** recovery-policy rerun of spring 413 survived 25
  minutes at 200/200 nest health, six soldiers, 71P. This policy replaces lost
  gatherers with 8P basic workers and delays the medic until four soldiers.
  It remained level two. Do not replace the failed original result with this
  success or claim an unqualified 8/8 success rate.

## Changes and limits

Nest prices are 20/100/500 (pebble 15/75/375), restoring a fivefold step rather
than the unintended 20-to-400 twentyfold jump. First raid timing and 5/8-minute
combat stages are unchanged. Later raid HP/damage fractions are:
12m .4/.2; 18m .5/.2; 25m .65/.25; 30m .8/.4; 35m .9/.6; 40m 1/1.
The 25-minute-and-later cohorts are **not world-validated** by a test ending at
25 minutes. The 25-minute stage has separate same-cell combat checks only.
Older version-one saved cohorts retain their original strength and injury;
new cohorts use version two. Therefore existing saves can retain stronger old
raiders than fresh-game results here.

`duel.mjs` uses actual combat code, 30 seeds per case. One 40P guard defeated
12/18-minute beetles in 30/30 cases; one 59P level-three soldier defeated the
25-minute beetle in 30/30. Same-cell duels omit approach, escorts and rejoining,
so they do not replace the world tests.

Regression: 39/39 raid cadence/pressure/combat/nest tests passed. Including the
creatures suite yields 59/60; its existing wandering/chasing nest-safe-radius
failure also reproduces on unchanged 2d91e7e4. No unrelated fix was hidden here.

Run: `SEEDS=13,413 TRIBES=bean,spore,pebble,spring LABEL=recheck node tools/midgame-playtest/candidate-run.mjs`.
Recovery: `SEEDS=413 TRIBES=spring LABEL=recovery node tools/midgame-playtest/recovery-run.mjs`.
The automated policy omits active human formations/retreat orders; the small
map sample is not a guarantee of beginner success or later-game balance.
