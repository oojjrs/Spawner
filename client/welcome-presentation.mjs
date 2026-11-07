import { UNIT_COMBINATION_FORMS } from "./unit-combination-forms.mjs";
import { unitActionArtDefinition } from "./unit-action-art.mjs";

export const WELCOME_UNIT_APPEARANCES = Object.freeze([
  {}, { strength: 1 }, { antenna: 1 }, { blade: 1 }, { secretion: 1 }, { carapace: 1 }, ...UNIT_COMBINATION_FORMS.map(form => form.attributes)
].map(attributes => Object.freeze(attributes)));

export function welcomeUnitPerformance(agent, startedAt) {
  const definition = unitActionArtDefinition(agent);
  const animation = definition?.actions.idle || definition?.reference;
  const durationMs = animation?.durationsMs.reduce((sum, value) => sum + value, 0) || 2000;
  const performer = { ...agent, animationStartedAt: startedAt, moveDuration: 0, mode: "idle", attack: null, attackStartedAt: undefined };
  return { agent: performer, action: "idle", animation, durationMs };
}

// Select the category before the appearance so adding playable forms cannot
// crowd out the neutral species. Each category keeps its own shuffle bag.
export const WELCOME_NEUTRAL_SHARE = .8;
export function createWelcomeRoster(tribes, species, variants, random = Math.random) {
  const playable = [...new Set(tribes)];
  const pools = {
    playable: playable.flatMap(key => Array.from({ length: variants }, (_, variant) => ({ key, variant }))),
    neutral: [...new Set(species)].filter(key => !playable.includes(key)).map(key => ({ key, variant: 0 }))
  };
  const bags = { playable: [], neutral: [] }, rounds = { playable: 0, neutral: 0 };
  let number = 0;
  const recent = [];
  return function next() {
    let choice;
    if (number < playable.length) choice = { key: playable[number], variant: 0 };
    else {
      const category = pools.neutral.length && (!pools.playable.length || random() < WELCOME_NEUTRAL_SHARE) ? "neutral" : "playable";
      let bag = bags[category];
      if (!bag.length) {
        const candidates = category === "playable" && rounds.playable === 0 ? pools.playable.filter(candidate => candidate.variant !== 0) : pools[category];
        bag = bags[category] = [...(candidates.length ? candidates : pools[category])];
        rounds[category]++;
        if (!bag.length) return null;
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      let index = bag.findIndex(candidate => !recent.some(previous => previous.key === candidate.key));
      if (index < 0) index = bag.findIndex(candidate => !recent.some(previous => previous.key === candidate.key && previous.variant === candidate.variant));
      choice = bag.splice(index < 0 ? 0 : index, 1)[0];
    }
    number++;
    recent.push(choice);
    if (recent.length > 2) recent.shift();
    return Object.freeze({ ...choice });
  };
}

// All poses share one scale. Include wing tips and attack poses in the envelope.
export function welcomeCreatureScale(animation, bounds, top, displaySize, width, height, envelope) {
  const length = Math.max(bounds.width, bounds.height);
  const pixels = Math.min(240, width * .75) * displaySize;
  const nominal = pixels / length * animation.frameSize / (animation.registrationScale || 1);
  if (!envelope) return Math.min(nominal, width * .86 / length * animation.frameSize / (animation.registrationScale || 1),
    (height - 36) / Math.max(1, animation.pivotY - top) * animation.frameSize / (animation.registrationScale || 1));
  const ground = height * 214 / 280;
  return Math.min(nominal, (width / 2 - 8) / Math.max(.001, -envelope.left, envelope.right),
    (ground - 34) / Math.max(.001, -envelope.top), (height - 6 - ground) / Math.max(.001, envelope.bottom));
}

// Construct the same cell moves used by the game; a complete move always lands
// before switching to an idle pose in the middle of the header.
export function welcomeTravelMotion(model, { key, attributes = {}, width, size, elapsedMs, timeline, phase, startedAt, reducedMotion = false, id = "welcome", worldPixels }) {
  const neutral = !["bean", "spore", "pebble", "spring"].includes(key);
  const stats = neutral ? null : model.unitStats(attributes, key);
  const speed = neutral ? model.creatureAnimationSpeed(key) : model.unitTravelSpeed ?
    model.unitTravelSpeed({ tribe: key, stats }, 0) : stats.speed;
  const cell = Number.isFinite(worldPixels) ? worldPixels : neutral ? Math.min(240, width * .75) : size / .7;
  const steps = Math.max(1, Math.ceil((width / 2 + size / 2) / cell));
  const moveDuration = neutral ? 1 / speed : Math.min(1, 1 / speed);
  const durationMs = steps * moveDuration * 1000;
  const moving = !reducedMotion && (phase === "enter" || phase === "exit");
  const origin = Number.isFinite(startedAt) ? startedAt : timeline - elapsedMs / 1000;
  let step = Math.max(0, Math.min(steps - 1, Math.floor(elapsedMs / 1000 / moveDuration)));
  while (step > 0 && timeline < origin + step * moveDuration) step--;
  while (step < steps - 1 && timeline >= origin + (step + 1) * moveDuration) step++;
  const moveStartedAt = origin + step * moveDuration;
  const moveEndedAt = origin + (step + 1) * moveDuration;
  const agent = { id, attributes, stats, carrying: 0, straightSteps: 0, health: stats?.health || 1, facing: -1, mode: moving ? "walk" : "idle",
    ...(neutral ? { species: key } : { tribe: key }), stepCount: step + 1,
    moveDuration: moving ? moveEndedAt - moveStartedAt : 0, moveStartedAt,
    ...(!neutral ? { moveAnimationStartedAt: origin } : {}),
    flightStartedAt: origin, renderFromX: -step, renderFromY: 0, x: -step - 1, y: 0 };
  const position = model.unitMovementPosition(agent, timeline, reducedMotion);
  const x = moving ? width / 2 + (phase === "enter" ? steps * cell : 0) + position.x * cell : width / 2;
  return { agent, position, x, durationMs, cell, size };
}

// A rejected decode or lazy rig must not leave the rotation waiting forever.
export async function prepareWelcomeChoice(choice, prepare, { timeoutMs = 15000, onError = () => {} } = {}) {
  async function attempt(value) {
    let timer;
    try { await Promise.race([Promise.resolve().then(() => prepare(value)), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Welcome asset preparation timed out")), timeoutMs);
    })]); return value; }
    finally { clearTimeout(timer); }
  }
  try { return await attempt(choice); }
  catch (error) {
    onError(error, choice);
    try { return await attempt(choice); }
    catch (retryError) { onError(retryError, choice); return null; }
  }
}

export function drawWelcomeChoice(choice, draw, options) {
  try { draw(choice); return choice; }
  catch (error) { options?.onError?.(error, choice); }
  if (options?.fallback) {
    try { options.fallback(choice); return choice; }
    catch (error) { options.onError?.(error, choice); }
  }
  return null;
}
