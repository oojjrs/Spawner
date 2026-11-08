// Re-bake the approved native cutout rig with an observable walking stride.
// The original body, face, tail and limb artwork are not repainted or replaced.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../AnimationCandidates/weasel-rig-v4-20261106');
export const gait = Object.freeze({ stance: .64, sweep: 120, lift: 35, frames: 64, periodMs: 500 });
export const configs = {
  'shadow-weasel': { file:'brown-parts.png', body:[37,114,1181,496], bodyY:130,
    legs:[[66,771,258,336],[363,770,244,337],[679,749,210,361],[975,749,209,361]],
    roots:[[237,238],[228,226],[407,227],[398,217]], footY:[356,345,356,345], w:[87,77,88,78], rootU:[.65,.65,.48,.48] },
  'white-paw': { file:'white-parts.png', body:[159,18,1207,587], bodyY:40,
    legs:[[163,663,230,271],[492,660,239,277],[883,650,205,284],[1226,650,186,285]],
    roots:[[238,236],[226,226],[403,234],[391,224]], footY:[354,343,354,343], w:[81,72,76,70], rootU:[.65,.65,.5,.5] }
};
for (const config of Object.values(configs)) {
  config.image = await loadImage(path.join(source, config.file));
  config.parts = config.legs.map(bounds => {
    const part = createCanvas(bounds[2], bounds[3]);
    part.getContext('2d').drawImage(config.image, ...bounds, 0, 0, bounds[2], bounds[3]);
    return part;
  });
}
export function foot(phase, settings = gait) {
  const p = ((phase % 1) + 1) % 1;
  return p < settings.stance ? {
    x: -settings.sweep / 2 + settings.sweep * p / settings.stance, y: 0, stance: true
  } : {
    x: settings.sweep / 2 - settings.sweep * (p - settings.stance) / (1 - settings.stance),
    y: -settings.lift * Math.sin(Math.PI * (p - settings.stance) / (1 - settings.stance)), stance: false
  };
}
function limb(target, config, index, phase, settings) {
  const layer = createCanvas(640, 640), context = layer.getContext('2d');
  const local = (phase + [0, .5, .5, 0][index]) % 1;
  const p = foot(local, settings), root = config.roots[index], w = config.w[index];
  const h = config.footY[index] - root[1] + 10, image = config.parts[index];
  const ox = root[0] - w * config.rootU[index], oy = root[1] - 10;
  const smooth = q => { const u = Math.min(1, Math.max(0, (q - .12) / .72)); return u * u * (3 - 2 * u); };
  for (let k = 0; k < 48; k++) {
    const a = k / 48, b = (k + 1) / 48, wa = smooth(a), wb = smooth(b);
    const y1 = oy + a * h + p.y * wa, y2 = oy + b * h + p.y * wb;
    const bend = (p.stance ? 0 : 8 * Math.sin(Math.PI * (local - settings.stance) / (1 - settings.stance))) * Math.sin(Math.PI * (a + b) / 2);
    const dx = p.x * (wa + wb) / 2 + bend;
    context.drawImage(image, 0, a * image.height, image.width, (b - a) * image.height, ox + dx, y1, w, y2 - y1 + .6);
  }
  if (index % 2 === 0) {
    context.globalCompositeOperation = 'destination-in';
    const gradient = context.createLinearGradient(0, oy, 0, oy + h * .38);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,1)');
    context.fillStyle = gradient; context.fillRect(0, 0, 640, 640);
  }
  target.drawImage(layer, 0, 0);
}
export function frame(species, phase, settings = gait) {
  const config = configs[species], canvas = createCanvas(640, 640), context = canvas.getContext('2d');
  for (const index of [1, 3]) limb(context, config, index, phase, settings);
  const body = config.body;
  context.drawImage(config.image, ...body, 45, config.bodyY, body[2] * .46, body[3] * .46);
  for (const index of [0, 2]) limb(context, config, index, phase, settings);
  return canvas;
}
if (process.argv.includes('--render') || process.argv.includes('--contact')) {
  for (const species of Object.keys(configs)) {
    const atlas = process.argv.includes('--render') ? createCanvas(640 * 8, 640 * 8) : null, context = atlas?.getContext('2d');
    const contact = createCanvas(1280, 960), preview = contact.getContext('2d');
    preview.fillStyle = '#e7efdf'; preview.fillRect(0, 0, 1280, 960);
    for (let index = 0; index < gait.frames; index++) {
      if (!atlas && index % 4 !== 0) continue;
      // Materialize the native strip rig before compositing, so the atlas does
      // not retain all limb canvases and hundreds of deferred draw commands.
      const image = await loadImage(frame(species, index / gait.frames).toBuffer('image/png'));
      context?.drawImage(image, index % 8 * 640, Math.floor(index / 8) * 640);
      if (index % 4 === 0) {
        const i = index / 4, x = i % 4 * 320, y = Math.floor(i / 4) * 240;
        preview.drawImage(image, 0, 0, 640, 440, x, y + 15, 320, 220);
        preview.fillStyle = '#253c30'; preview.font = '14px sans-serif'; preview.fillText(species + ' f' + index, x + 4, y + 14);
      }
      global.gc?.();
    }
    if (atlas) await fs.writeFile(path.join(here, species + '-stride-candidate.png'), atlas.toBuffer('image/png'));
    await fs.writeFile(path.join(here, species + '-stride-contact.png'), contact.toBuffer('image/png'));
  }
  await fs.writeFile(path.join(here, 'stride-candidate-settings.json'), JSON.stringify(gait, null, 2) + '\n');
}
