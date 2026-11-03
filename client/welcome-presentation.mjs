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

export function welcomeCreatureScale(animation, bounds, top, displaySize, width, height) {
  const length = Math.max(bounds.width, bounds.height);
  const pixels = Math.min(240, width * .75) * displaySize;
  const scale = Math.min(pixels / length, width * .86 / length,
    (height - 36) / Math.max(1, animation.pivotY - top));
  return scale * animation.frameSize / (animation.registrationScale || 1);
}
