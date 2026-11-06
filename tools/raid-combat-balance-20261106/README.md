# Early raid combat calibration

User goal: prepare level-two military before five minutes without delaying raids; easy opening with progressively stronger pressure. Board occupancy is not the performance target. Modest and imperfect DNA designs must remain viable.

## Implementation
Only departing spiny-back-beetle raiders are scaled. Ambient beetles, burrow guards, all other species remain unchanged.
- Departure <08:00: health20%, unit/nest damage10%.
-08:00–11:59: health30%, damage15%.
-12:00–17:59: health50%, damage30%.
-18:00–24:59: health75%, damage60%.
-25:00 onward: full baseline.
Stage is fixed at departure and stored per creature. Already dispatched creatures do not suddenly strengthen. Injury fraction and stage survive restore; repeated restoration does not multiply the scale. Old active raids without a marker use their recorded departure time. A former raider remains at its original cohort strength after its raid assignment ends. Dead agents remain dead.
Unit attackPower and nest attack are both scaled; defense, speed, vision and attack cadence are unchanged.

## Evidence and limits
Baseline32P pre-price-change recipe (blade+health2+movement) versus first target20HP,10% damage with two defenders and starting DNA workers:4 tribes×100 RNG seeds, all enemy killed, defenders survived, zero worker deaths.39P power-enhanced recipe also succeeded. This is same-cell combat, not a complete map/arrival/reinforcement simulation. Later stages are initial progression targets, not verified global balance. Do not report these as all-game victory rates.
Raw experimental records are /tmp/spawner-unit-power/with-workers.json and README.md.

## Regression
server/raid-combat-scale.test.mjs covers stage boundaries, all cohort serialization, death/injury preservation, old active saves, retired raiders, non-raider exclusion, actual dispatch and both unit/nest damage.
Focused scale+creature-combat suite:21 tests passed.
