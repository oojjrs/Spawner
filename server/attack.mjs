export const AGENT_ATTACK_FRAME_DURATIONS = Object.freeze([
  .06, .07, .06, .08, .03, .05, .05, .05, .05, .05, .05, .07, .08, .09, .10, .06
]);

export const AGENT_HURT_FRAME_DURATIONS = Object.freeze([
  .02, .03, .03, .03, .4, .03, .03, .03, .02, .02, .02, .02, .02, .02, .02, .02
]);
export const AGENT_HURT_DURATION = AGENT_HURT_FRAME_DURATIONS.reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;

export const AGENT_ATTACK_HIT_FRAME = 5;
export const AGENT_ATTACK_HIT_TIME = AGENT_ATTACK_FRAME_DURATIONS.slice(0, AGENT_ATTACK_HIT_FRAME).reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;
export const AGENT_ATTACK_DURATION = AGENT_ATTACK_FRAME_DURATIONS.reduce((sum, duration) => sum + Math.round(duration * 1000), 0) / 1000;
export const AGENT_ATTACK_ASSET = "DesignAssets/Animations/UnitAttack/attack.png";

export function attackAnimationSegments(attack, time, hitTime, duration) {
  const contacts = attack.meleeContacts?.length ? attack.meleeContacts : [attack.hitAt];
  const startFor = index => index ? Math.max(contacts[index] - hitTime,
    contacts[index - 1] + (contacts[index] - contacts[index - 1]) * (duration - hitTime) / duration) : attack.startedAt;
  let index = 0;
  while (index < contacts.length - 1 && time >= startFor(index + 1)) index++;
  const contact = contacts[index], start = startFor(index);
  const end = Math.min(attack.endsAt, contact + duration - hitTime,
    index < contacts.length - 1 ? startFor(index + 1) : Infinity);
  return [[start, 0], [contact, hitTime], [end, hitTime + Math.max(0, end - contact)]];
}

export function attackAnimationElapsed(attack, time, hitTime, duration) {
  const elapsed = time - attack.startedAt;
  if (Number.isFinite(attack.recovery)) {
    const [[start], [contact]] = attackAnimationSegments(attack, time, hitTime, duration);
    if (time < contact) return Math.max(0, (time - start) / Math.max(1e-9, contact - start) * hitTime);
    return Math.min(duration, hitTime + time - contact);
  }

  // DNA melee follow-ups move hitAt forward without beginning a new action.
  // Keep the contact already reached, then finish recovery and prepare the next
  // swing using only the server's recorded contacts, not current unit stats.
  const contacts = attack.meleeContacts;
  if (attack.combatId && !attack.exchange && Array.isArray(contacts) && contacts.length &&
      Number.isFinite(attack.startedAt) && Number.isFinite(attack.endsAt) && attack.endsAt >= attack.hitAt &&
      hitTime > 0 && duration > hitTime &&
      contacts.at(-1) === attack.hitAt && contacts[0] > attack.startedAt &&
      contacts.every((at, index) => Number.isFinite(at) && (!index || at > contacts[index - 1]))) {
    if (time > attack.endsAt || time === attack.endsAt && attack.endsAt > attack.hitAt) return duration;
    const recoveryShare = (duration - hitTime) / duration;
    const startFor = index => index ? contacts[index - 1] +
      (contacts[index] - contacts[index - 1]) * recoveryShare : attack.startedAt;
    let swing = 0;
    while (swing < contacts.length - 1 && time >= startFor(swing + 1)) swing++;
    const start = startFor(swing), hit = contacts[swing];
    const end = swing + 1 < contacts.length ? startFor(swing + 1) : attack.endsAt;
    return time <= hit ? (time - start) / (hit - start) * hitTime :
      hitTime + Math.min(1, (time - hit) / (end - hit)) * (duration - hitTime);
  }
  if (!attack.combatId || attack.exchange || !Number.isFinite(attack.hitAt) || !Number.isFinite(attack.endsAt) ||
      !(attack.hitAt > attack.startedAt) || !(attack.endsAt > attack.hitAt)) return elapsed * (attack.speed || 1);
  if (time >= attack.endsAt) return duration;
  if (time <= attack.hitAt) return elapsed / (attack.hitAt - attack.startedAt) * hitTime;
  return hitTime + Math.min(1, (time - attack.hitAt) / (attack.endsAt - attack.hitAt)) * (duration - hitTime);
}

export function agentAttackFrame(attack, time) {
  if (!attack) return -1;
  const elapsed = attackAnimationElapsed(attack, time, AGENT_ATTACK_HIT_TIME, AGENT_ATTACK_DURATION);
  if (elapsed < 0 || elapsed + 1e-8 >= AGENT_ATTACK_DURATION) return -1;
  let end = 0;
  for (let index = 0; index < AGENT_ATTACK_FRAME_DURATIONS.length; index++) {
    end += AGENT_ATTACK_FRAME_DURATIONS[index];
    if (elapsed + 1e-8 < end) return index;
  }
  return -1;
}
