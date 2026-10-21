export const AGENT_BIRTH_DURATION = 3.85;

const bodyKeys = [
  [0, .76, .49, 0, -.03], [.065, .83, 1.15, 16, .025], [.18, .94, 1.06, 53, -.02],
  [.30, 1, 1, 71, .015], [.44, 1, 1.02, 49, 0], [.62, 1.05, .97, 0, 0],
  [.68, 1.16, .83, 0, -.015], [.82, .96, 1.05, 5, .01], [1.02, 1, 1, 0, 0]
];
const leafKeys = [
  [0, 1, .18, .16], [.15, .62, .62, .8], [.28, -.18, 1.08, 1.05],
  [.43, .10, .97, .96], [.65, -.04, 1.02, 1.01], [.88, 0, 1, 1]
];

function smooth(value) {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
}

function keyPose(keys, elapsed) {
  const t = Math.max(0, elapsed);
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last.slice(1);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b[0]) {
      const p = smooth((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((value, j) => value + (b[j + 1] - value) * p);
    }
  }
  return last.slice(1);
}

export function agentBirthMotion(elapsed, dx, dy) {
  if (elapsed < 0 || elapsed >= AGENT_BIRTH_DURATION) return null;
  const length = Math.hypot(dx, dy);
  const direction = dx < -.01 ? -1 : 1;
  const endAngle = direction * (Math.PI * .5 + length * .64 / (.24 * .45));
  let progress = 1, seedLift = 0, seedAngle = endAngle, seedScaleX = 1, seedScaleY = 1;
  if (elapsed < .30) progress = 0;
  else if (elapsed < .72) {
    const p = (elapsed - .30) / .42;
    progress = .07 + .29 * p * p;
    seedLift = .42 * (1 - p) + 4 * p * (1 - p) * 2.1;
    seedAngle = direction * (-.24 + (Math.PI * .5 + .24) * p);
  } else if (elapsed < 1.60) {
    const first = elapsed < 1.18;
    const p = first ? (elapsed - .72) / .46 : (elapsed - 1.18) / .42;
    progress = first ? .36 + .36 * p : .72 + .28 * p;
    seedLift = 4 * p * (1 - p) * (first ? .23 : .14);
    seedAngle = direction * (Math.PI * .5 + length * (progress - .36) / (.24 * .45));
  } else if (elapsed < 1.78) {
    const p = smooth((elapsed - 1.60) / .18);
    seedScaleX += .16 * p;
    seedScaleY -= .18 * p;
  } else if (elapsed < 2.50) {
    const p = (elapsed - 1.78) / .72;
    seedLift = 4 * p * (1 - p) * .62;
    seedAngle += (Math.round(endAngle / (Math.PI * 2)) * Math.PI * 2 - endAngle) * p;
  } else if (elapsed < 2.57) {
    const p = Math.sin(Math.min(1, (elapsed - 2.50) / .07) * Math.PI * .5);
    seedAngle = 0;
    seedScaleX += .22 * p;
    seedScaleY -= .30 * p;
  }
  const unitAge = elapsed - 2.59;
  const [scaleX, scaleY, lift, rotation] = keyPose(bodyKeys, unitAge);
  const left = keyPose(leafKeys, unitAge - .02), right = keyPose(leafKeys, unitAge - .055);
  return { elapsed, progress, seedLift, seedAngle, seedScaleX, seedScaleY,
    seedVisible: elapsed >= .30 && elapsed < 2.57, unitVisible: unitAge >= 0,
    fractureAge: elapsed - 2.57, unitAge, scaleX, scaleY, rotation, lift: lift / 83 * .7 * .55,
    head: { leftRotation: left[0], rightRotation: -right[0], leftScaleX: left[1], rightScaleX: right[1],
      leftScaleY: left[2], rightScaleY: right[2] } };
}
