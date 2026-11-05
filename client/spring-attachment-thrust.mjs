// Approved source-only spring/blade combination motion. Coordinates remain in
// the existing 512px portrait space; padding changes the camera, never body size.
export const SPRING_THRUST_CAMERA = Object.freeze({
  width: 896, height: 640, offsetX: 192, offsetY: 64,
  pivotX: 448, pivotY: 512, units: 512
});

export function springThrustAppearance(tribe, attributes = {}) {
  return tribe === "spring" && attributes.blade > 0 && !attributes.piercing && !attributes.carapace &&
    (attributes.strength || attributes.arms) > 0;
}

function smooth(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
function curve(time, keys) {
  for (let i = 1; i < keys.length; i++) if (time <= keys[i][0]) {
    const [start, a] = keys[i - 1], [end, b] = keys[i];
    return a + (b - a) * smooth((time - start) / (end - start));
  }
  return keys.at(-1)[1];
}

// The original four-attribute exemplar deliberately retains its authored tip.
// Other broad bodies use their own rendered feature registration.
export function springThrustRegisteredPose(time, source, socket, tip) {
  const pose = baseSpringThrustPose(time, source, socket);
  const vector = tip.map((value, i) => value - source[i]), length = Math.hypot(...vector);
  const target = [pose.tip[0] + (tip[0] - 441.5) * (1 - pose.aim),
    pose.tip[1] + (tip[1] - 144.5) * (1 - pose.aim)];
  const delta = target.map((value, i) => value - socket[i]), distance = Math.hypot(...delta);
  if (!(length > 120) || !(distance > 0) || ![...target, length, distance].every(Number.isFinite)) return null;
  return raisedSpringThrustPose({ ...pose, tip: target, length, distance, along: vector.map(value => value / length),
    direction: delta.map(value => value / distance), extension: Math.max(0, distance - length) });
}

export function springThrustFeatureTip(pixels, width, height) {
  let right = -1, weight = 0, sum = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = pixels[(y * width + x) * 4 + 3];
    if (alpha < 64) continue;
    if (x > right) { right = x; weight = 0; sum = 0; }
    if (x === right) { weight += alpha; sum += (y + .5) * alpha; }
  }
  return right < 0 ? null : [right + .5, sum / weight];
}

export function springThrustLowerBounds(pixels, width, height, scale = 2) {
  let floor = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] >= 128) floor = Math.max(floor, y + 1);
  }
  let left = width, right = 0;
  for (let y = Math.max(0, floor - 40 * scale); y < floor - 8 * scale; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] >= 128) { left = Math.min(left, x); right = Math.max(right, x + 1); }
  }
  return floor && right > left ? { floor: floor / scale, center: (left + right) / (2 * scale), width: (right - left) / scale } : null;
}

export function renderSpringThrustBody(context, image, current, target) {
  if (!current || !target) return false;
  const correction = { dy: target.floor - current.floor, dx: target.center - current.center, scale: target.width / current.width };
  if (![...Object.values(current), ...Object.values(target), ...Object.values(correction)].every(Number.isFinite) ||
      Math.abs(correction.dy) >= 6 || Math.abs(correction.dx) >= 15 || correction.scale <= .9 || correction.scale >= 1.2) return false;
  // Only the lowest 28 portrait pixels settle onto this body's neutral support.
  // The face/upper silhouette and separately rendered feet are not modified.
  const band = 28, top = current.floor - band;
  context.save(); context.beginPath(); context.rect(-512, -512, 1536, top + 512); context.clip();
  context.drawImage(image, 0, 0, 512, 512); context.restore();
  for (let y = top; y < 512; y += 2) {
    const height = Math.min(2, 512 - y), start = smooth((y - top) / band), end = smooth((y + height - top) / band), weight = (start + end) / 2;
    const y0 = y + correction.dy * start, y1 = y + height + correction.dy * end, scale = 1 + (correction.scale - 1) * weight;
    context.save(); context.beginPath(); context.rect(-512, y0 - .04, 1536, y1 - y0 + .08); context.clip();
    context.translate(current.center + correction.dx * weight, y0); context.scale(scale, (y1 - y0) / height);
    context.translate(-current.center, -y); context.drawImage(image, 0, 0, 512, 512); context.restore();
  }
  return true;
}

// Approved 6-degree upward aim, applied after each body's tip registration.
// Rotation preserves axial reach, width, socket and all contact/recovery keys.
function raisedSpringThrustPose(pose) {
  if (!pose.aim) return pose;
  const turn = -6 * Math.PI / 180 * pose.aim;
  const c = Math.cos(turn), s = Math.sin(turn), [x, y] = pose.direction;
  const direction = [x * c - y * s, x * s + y * c];
  return { ...pose, direction, tip: direction.map((value, i) => pose.socket[i] + pose.distance * value) };
}

export function springThrustPose(time, source, socket) {
  return raisedSpringThrustPose(baseSpringThrustPose(time, source, socket));
}

function baseSpringThrustPose(time, source, socket) {
  const aim = curve(time, [[0,0],[100,.35],[160,1],[620,1],[860,0],[1000,0]]);
  const reach = curve(time, [[0,210],[160,172],[240,160],[300,395],[380,415],[480,415],
    [530,390],[640,260],[700,210],[860,210],[1000,210]]);
  // Tip measured on the approved neutral feature in this fixed portrait camera.
  const vector = [441.5 - source[0], 144.5 - source[1]], length = Math.hypot(...vector);
  const tip = [socket[0] + vector[0] * (1 - aim) + reach * aim,
    socket[1] + vector[1] * (1 - aim) + (330 - socket[1]) * aim];
  const delta = [tip[0] - socket[0], tip[1] - socket[1]], distance = Math.hypot(...delta);
  const width = curve(time, [[0,1],[160,.8],[240,.8],[300,.56],[480,.56],[640,.8],[860,1],[1000,1]]);
  return { source, socket, tip, aim, length, distance, width,
    along: vector.map(value => value / length), direction: delta.map(value => value / distance),
    extension: Math.max(0, distance - length), minimum: -180 * (1 - aim) };
}

export function springThrustLength(pose, longitudinal) {
  // Extend the forward part only: stretching the mounting section exposed its
  // old crop seam and a rear spike. The hidden cut stays behind the torso.
  return pose.extension ? longitudinal + pose.extension * smooth((longitudinal - 120) / (pose.length - 120)) :
    longitudinal * pose.distance / pose.length;
}

export function renderSpringThrust(context, feature, pose) {
  context.save(); context.translate(...pose.socket);
  context.rotate(Math.atan2(pose.direction[1], pose.direction[0]));
  const [ax, ay] = pose.along, [px, py] = pose.source;
  // Axial strips approximate only the 1D monotone extension; the root is rigid.
  // 4px strips avoid a dense 2D mesh. Slight clip overlap prevents AA hairlines.
  for (let start = pose.minimum; start < 512; start += 4) {
    const end = Math.min(512, start + 4), left = springThrustLength(pose, start), right = springThrustLength(pose, end);
    const scale = (right - left) / (end - start);
    context.save(); context.beginPath();
    context.moveTo(left - .08, -512); context.lineTo(right + .08, -512);
    context.lineTo(right + .08, 512); context.lineTo(left - .08, 512); context.closePath(); context.clip();
    context.transform(scale * ax, -pose.width * ay, scale * ay, pose.width * ax,
      left - scale * (start + ax * px + ay * py), pose.width * (ay * px - ax * py));
    context.drawImage(feature, 0, 0); context.restore();
  }
  context.restore();
}
