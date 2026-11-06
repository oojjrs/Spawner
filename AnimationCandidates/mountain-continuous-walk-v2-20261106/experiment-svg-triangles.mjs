import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
import { drawRig } from './rig.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
export const art = {};
for (const [key, file] of Object.entries({ paws: 'lower-paws-source.png', body: 'body-source.png', occluder: 'shell-occluder.png' })) {
  const bytes = await fs.readFile(path.join(here, file));
  const { width, height } = await sharp(bytes).metadata();
  art[key] = { id: key, w: width, h: height, data: bytes.toString('base64') };
}

export class SVGContext {
  calls = [];
  transforms = [];
  stack = [];
  clips = [];
  save() { this.stack.push([...this.transforms]); }
  restore() { this.transforms = this.stack.pop(); }
  translate(x, y) { this.transforms.push(`translate(${x},${y})`); }
  drawImage(image, x, y, width, height) {
    this.calls.push(`<g transform="${this.transforms.join(' ')}"><svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${image.w} ${image.h}"><use href="#${image.id}"/></svg></g>`);
  }
  drawTriangle(image, source, destination) {
    const [[x0,y0],[x1,y1],[x2,y2]] = source;
    const [[u0,v0],[u1,v1],[u2,v2]] = destination;
    const det = (x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
    if (Math.abs(det) < 1e-9) throw Error('Degenerate source triangle');
    const a=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/det;
    const c=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/det;
    const b=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/det;
    const d=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/det;
    const e=u0-a*x0-c*y0, f=v0-b*x0-d*y0;
    const id=`clip-${this.clips.length}`;
    // A quarter-pixel overlap removes raster cracks at shared triangle edges.
    // It does not bridge any physical gap between a leg and the torso.
    const cx=(u0+u1+u2)/3, cy=(v0+v1+v2)/3;
    const points=destination.map(([x,y])=>{const length=Math.hypot(x-cx,y-cy);return `${x+(x-cx)/length*.25},${y+(y-cy)/length*.25}`;}).join(' ');
    this.clips.push(`<clipPath id="${id}"><polygon points="${points}"/></clipPath>`);
    this.calls.push(`<g transform="${this.transforms.join(' ')}"><g clip-path="url(#${id})"><use href="#${image.id}" transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})"/></g></g>`);
  }
  render() {
    const images=Object.values(art).map(a=>`<image id="${a.id}" width="${a.w}" height="${a.h}" href="data:image/png;base64,${a.data}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs>${images}${this.clips.join('')}</defs>${this.calls.join('')}</svg>`;
  }
}

export async function renderRig(phase, options={}) {
  const context = new SVGContext();
  context.translate(64,64);
  drawRig(context,art,phase,options);
  return sharp(Buffer.from(context.render())).png().toBuffer();
}
