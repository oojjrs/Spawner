/** Review renderer for exact source surfaces. This is not a game action loader. */
export async function loadSourceBind(rootUrl, entry) {
  const rig = await fetch(new URL(entry.rig, rootUrl)).then(response => {
    if (!response.ok) throw new Error(`Rig ${response.status}: ${entry.rig}`);
    return response.json();
  });
  if (rig.schema !== 'spawner.source-surface-bind.v1') throw new Error('Unsupported bind schema');
  if (rig.sourceHash !== entry.sourceHash || rig.mask !== entry.mask) throw new Error('Source identity mismatch');
  const image = new Image();
  image.src = new URL(rig.sourceImage, rootUrl).href;
  await image.decode();
  if (image.naturalWidth !== 512 || image.naturalHeight !== 512) throw new Error('Source camera changed');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  context.drawImage(image, 0, 0);
  const source = context.getImageData(0, 0, 512, 512);
  const neutral = new ImageData(512, 512);
  const ownership = new Uint8Array(512 * 512);
  for (const [y, start, end] of rig.surface.coverageRuns) {
    if (y < 0 || y >= 512 || start < 0 || start >= end || end > 512) throw new Error('Invalid coverage run');
    for (let x = start; x < end; x++) {
      const pixel = y * 512 + x;
      if (++ownership[pixel] !== 1) throw new Error('Overlapping coverage');
      neutral.data.set(source.data.subarray(pixel * 4, pixel * 4 + 4), pixel * 4);
    }
  }
  let differentRgbaValues = 0;
  let maxRgbaError = 0;
  for (let index = 0; index < source.data.length; index++) {
    const error = Math.abs(source.data[index] - neutral.data[index]);
    if (error) differentRgbaValues++;
    maxRgbaError = Math.max(maxRgbaError, error);
  }
  if (differentRgbaValues) throw new Error('Browser neutral reconstruction differs');
  return {rig, image, source, neutral, validation: {differentRgbaValues, maxRgbaError}};
}

/** A rigid review diagnostic, never an idle/hurt animation or a foot-contact claim. */
export function supportLeanTransform(rig, phase) {
  const angle = Math.sin(phase * Math.PI * 2) * .45 * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const [x, y] = rig.landmarks.supportPoint;
  return [cos, sin, -sin, cos, x - cos*x + sin*y, y - sin*x - cos*y];
}

export function projectPoint([a, b, c, d, e, f], [x, y]) {
  return [a*x+c*y+e, b*x+d*y+f];
}

export function drawSourceBind(context, loaded, {phase = 0, diagnostic = false, mesh = false, anchors = true} = {}) {
  const {rig, image, neutral} = loaded;
  context.clearRect(0, 0, 512, 512);
  const transform = diagnostic ? supportLeanTransform(rig, phase) : [1, 0, 0, 1, 0, 0];
  if (diagnostic) {
    context.save();
    context.setTransform(...transform);
    context.drawImage(image, 0, 0);
    context.restore();
  } else {
    // No resampling, triangles, seams, color-space conversion or alpha blending
    // is introduced by the neutral assembly after the browser decodes the PNG.
    context.putImageData(neutral, 0, 0);
  }
  context.save();
  context.setTransform(...transform);
  if (mesh) {
    context.strokeStyle = '#80d4f650';
    context.lineWidth = .65;
    context.beginPath();
    for (const triangle of rig.mesh.triangles) {
      const [a, b, c] = triangle.map(index => rig.mesh.positions[index]);
      context.moveTo(...a); context.lineTo(...b); context.lineTo(...c); context.closePath();
    }
    context.stroke();
  }
  if (anchors) {
    for (const key of ['leftEye', 'rightEye', 'faceMidpoint', 'supportPoint']) {
      const [x, y] = rig.landmarks[key];
      context.strokeStyle = key === 'supportPoint' ? '#ff9a71' : '#74d8ff';
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(x-5, y); context.lineTo(x+5, y);
      context.moveTo(x, y-5); context.lineTo(x, y+5); context.stroke();
    }
  }
  context.restore();
}
