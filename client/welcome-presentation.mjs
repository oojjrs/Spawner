export function createWelcomeRoster(tribes, species, variants, random = Math.random) {
  const pool = [...new Set(tribes)].flatMap(key => Array.from({ length: variants }, (_, variant) => ({ key, variant })))
    .concat([...new Set(species)].filter(key => !tribes.includes(key)).map(key => ({ key, variant: 0 })));
  let number = 0;
  let bag = [];
  const recent = [];
  return function next() {
    let choice;
    if (number < tribes.length) choice = { key: tribes[number], variant: 0 };
    else {
      if (!bag.length) {
        bag = number === tribes.length ? pool.filter(candidate => candidate.variant !== 0 || !tribes.includes(candidate.key)) : [...pool];
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
    return { ...choice };
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
// before switching to an idle/attack pose in the middle of the header.
export function welcomeTravelMotion(model, { key, attributes = {}, width, size, elapsedMs, timeline, phase, startedAt, reducedMotion = false, id = "welcome" }) {
  const neutral = !["bean", "spore", "pebble", "spring"].includes(key);
  const speed = neutral ? model.creatureAnimationSpeed(key) : model.unitStats(attributes, key).speed;
  const cell = neutral ? Math.min(240, width * .75) : size / .7;
  const steps = Math.max(1, Math.ceil((width / 2 + size) / cell));
  const durationMs = steps / speed * 1000;
  const moving = !reducedMotion && (phase === "enter" || phase === "exit");
  const origin = Number.isFinite(startedAt) ? startedAt : timeline - elapsedMs / 1000;
  let step = Math.max(0, Math.min(steps - 1, Math.floor(elapsedMs / 1000 * speed)));
  while (step > 0 && timeline < origin + step / speed) step--;
  while (step < steps - 1 && timeline >= origin + (step + 1) / speed) step++;
  const moveStartedAt = origin + step / speed;
  const moveEndedAt = origin + (step + 1) / speed;
  const agent = { id, attributes, health: 1, facing: -1, mode: moving ? "walk" : "idle",
    ...(neutral ? { species: key } : { tribe: key }), stepCount: step + 1,
    moveDuration: moving ? moveEndedAt - moveStartedAt : 0, moveStartedAt,
    flightStartedAt: origin, renderFromX: -step, renderFromY: 0, x: -step - 1, y: 0 };
  const position = model.unitMovementPosition(agent, timeline, reducedMotion);
  const x = moving ? width / 2 + (phase === "enter" ? steps * cell : 0) + position.x * cell : width / 2;
  return { agent, position, x, durationMs, cell };
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
    // Basic tribe art is already loaded before the rotation starts. Keep the
    // character moving with that art; a later round may retry its lazy rig.
    const fallback = ["bean", "spore", "pebble", "spring"].includes(choice.key) && choice.variant > 0 ? { ...choice, variant: 0 } : choice;
    try { return await attempt(fallback); }
    catch (retryError) { onError(retryError, fallback); return null; }
  }
}

// A lazy rig can decode successfully and still fail when its first pose is
// rasterized. Keep that failure local to this appearance, just as preparation
// failures are, so the next animation frame and character can still run.
export function drawWelcomeChoice(choice, draw, { onError = () => {} } = {}) {
  try { draw(choice); return choice; }
  catch (error) { onError(error, choice); }
  if (["bean", "spore", "pebble", "spring"].includes(choice.key) && choice.variant > 0) {
    const fallback = { ...choice, variant: 0 };
    try { draw(fallback); return fallback; }
    catch (error) { onError(error, fallback); }
  }
  return null;
}
