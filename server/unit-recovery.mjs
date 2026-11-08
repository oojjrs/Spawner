// Pure numbers shared by combat and design previews. Neutral ownership and
// recovery eligibility remain the responsibility of the combat engine.
export const UNIT_RECOVERY_RULES = Object.freeze({ delay: 5, base: .05, healthFraction: .005, scaledCap: .3 });

export function basicRecoveryRate(maxHealth) {
  return Number.isFinite(maxHealth) && maxHealth > 0 ? UNIT_RECOVERY_RULES.base +
    Math.min(maxHealth * UNIT_RECOVERY_RULES.healthFraction, UNIT_RECOVERY_RULES.scaledCap) : 0;
}

export function totalRecoveryRate(maxHealth, additional = 0) {
  return basicRecoveryRate(maxHealth) + (Number.isFinite(additional) ? Math.max(0, additional) : 0);
}
