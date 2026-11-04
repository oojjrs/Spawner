export function createWelcomeRoster(tribes, species, variants, random = Math.random) {
  const pool = [...new Set([...tribes, ...species])];
  let number = 0;
  let bag = [];
  const recent = [];
  return function next() {
    let key;
    if (number < tribes.length) key = tribes[number];
    else {
      if (!bag.length) {
        bag = [...pool];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      const index = bag.findIndex(candidate => !recent.includes(candidate));
      key = bag.splice(index < 0 ? 0 : index, 1)[0];
    }
    const variant = number++ < tribes.length || !tribes.includes(key) ? 0 : Math.floor(random() * variants);
    recent.push(key);
    if (recent.length > 2) recent.shift();
    return { key, variant };
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
export function welcomeTravelMotion(model, { key, attributes = {}, width, size, elapsedMs, timeline, phase, reducedMotion = false, id = "welcome" }) {
  const neutral = !["bean", "spore", "pebble", "spring"].includes(key);
  const speed = neutral ? model.creatureAnimationSpeed(key) : model.unitStats(attributes, key).speed;
  const cell = neutral ? Math.min(240, width * .75) : size / .7;
  const steps = Math.max(1, Math.ceil((width / 2 + size) / cell));
  const durationMs = steps / speed * 1000;
  const moving = !reducedMotion && (phase === "enter" || phase === "exit");
  const age = Math.max(0, Math.min(elapsedMs / 1000, durationMs / 1000 - 1e-8));
  const step = Math.floor(age * speed), within = age - step / speed;
  const agent = { id, attributes, health: 1, facing: -1, mode: moving ? "walk" : "idle",
    ...(neutral ? { species: key } : { tribe: key }), stepCount: step + 1,
    moveDuration: moving ? 1 / speed : 0, moveStartedAt: timeline - within,
    flightStartedAt: timeline - age, renderFromX: -step, renderFromY: 0, x: -step - 1, y: 0 };
  const position = model.unitMovementPosition(agent, timeline, reducedMotion);
  const x = moving ? width / 2 + (phase === "enter" ? steps * cell : 0) + position.x * cell : width / 2;
  return { agent, position, x, durationMs, cell };
}
