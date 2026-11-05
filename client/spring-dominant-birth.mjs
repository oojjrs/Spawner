import { SPRING_BIRTH_ANIMATION as birth } from "./birth.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";

// Source-owned water-body birth for the two canonical spring combat forms.
// The body is the very same current idle sprite used by the terminal handoff.
// Only a common water deformation is applied; no new art or readiness claim.
const profiles = Object.freeze({ blade: Object.freeze({ top: 150, tip: 383.5 }),
  carapace: Object.freeze({ top: 156, tip: 219.5 }) });
export const SPRING_DOMINANT_BIRTH_SETTLED_AT = 1.22;
export function springDominantBirthForm(agent) {
  if (agent?.species || agent?.tribe !== "spring" || !(agent.health > 0) || !agent.birth) return null;
  const attributes = unitDisplayAttributes(agent);
  if (["piercing", "strength", "arms", "antenna", "feet", "legs", "secretion"].some(key => attributes[key] > 0)) return null;
  return attributes.blade > 0 && !(attributes.carapace > 0) ? "blade" : attributes.carapace > 0 && !(attributes.blade > 0) ? "carapace" : null;
}

const smooth = v => {const t=Math.max(0,Math.min(1,v)); return t*t*(3-2*t);};
export function springDominantBirthPose(elapsed) {
 const growth=smooth(elapsed/1.22), release=smooth((elapsed-birth.detachAt)/.17);
 const impact= Math.sin(Math.min(1,Math.max(0,(elapsed-birth.contactAt)/.42))*Math.PI*2)*Math.max(0,1-(elapsed-birth.contactAt)/.42);
 return {sx:.58+.42*growth+impact*.13,sy:.58+.42*growth-impact*.12,
 rootY:448-68*(1-smooth(elapsed/birth.contactAt)),tether:1-release,
 outlet:[256+(birth.outletX-birth.pivotX)*350/(2*birth.height),448+(birth.outletY-birth.pivotY)*350/(2*birth.height)]};
}
export function springDominantBirthRow(y,p,profile) {
 const depth=(y-profile.top)/(448-profile.top),w=(1-smooth(depth/.50))*p.tether;
 const naturalTop=p.rootY+(profile.top-448)*p.sy;
 return {y:p.rootY+(y-448)*p.sy+w*(p.outlet[1]-naturalTop),
 sx:p.sx*(1-.85*w),x:256+w*(p.outlet[0]-(256+(profile.tip-256)*p.sx))+profile.tip*p.sx*.85*w};
}

function sourceBounds(source) {
 let x=512,y=512,right=-1,bottom=-1;
 for(let j=0;j<512;j++)for(let i=0;i<512;i++)if(source[(j*512+i)*4+3]){x=Math.min(x,i);y=Math.min(y,j);right=Math.max(right,i);bottom=Math.max(bottom,j);}
 return {x:Math.max(0,x-1),y:Math.max(0,y-1),right:Math.min(512,right+2),bottom:Math.min(512,bottom+2)};
}
export function springDominantBirthPixels(source,elapsed,profile,facing=1,displayScale=1,bounds=sourceBounds(source),density=1) {
 const pose=springDominantBirthPose(elapsed);pose.outlet=[256+(pose.outlet[0]-256)/displayScale*(facing<0?-1:1),448+(pose.outlet[1]-448)/displayScale];
 const rows=Array.from({length:513},(_,y)=>springDominantBirthRow(y,pose,profile));
 let minX=Infinity,maxX=-Infinity;for(let j=bounds.y;j<=bounds.bottom;j++){const r=rows[j],origin=r.x-256*pose.sx;minX=Math.min(minX,origin+bounds.x*r.sx);maxX=Math.max(maxX,origin+bounds.right*r.sx);}
 minX=Math.floor(minX)-1;maxX=Math.ceil(maxX)+1;const minY=Math.floor(rows[bounds.y].y)-1,maxY=Math.ceil(rows[bounds.bottom].y)+1;
 const width=Math.ceil((maxX-minX)*density),height=Math.ceil((maxY-minY)*density),out=new Uint8ClampedArray(width*height*4);let j=0;
 for(let y=0;y<height;y++){
  const py=minY+(y+.5)/density;while(j<511&&rows[j+1].y<=py)j++;
  if(py<rows[0].y||py>=rows[512].y)continue;
  const u=(py-rows[j].y)/(rows[j+1].y-rows[j].y),sy=j+u-.5,iy=Math.floor(sy),fy=sy-iy;
  const sx=rows[j].sx+(rows[j+1].sx-rows[j].sx)*u,origin=rows[j].x+(rows[j+1].x-rows[j].x)*u-256*pose.sx;
  const start=Math.max(0,Math.floor((origin+bounds.x*sx-minX)*density)),end=Math.min(width,Math.ceil((origin+bounds.right*sx-minX)*density));
  for(let x=start;x<end;x++){
   const px=(minX+(x+.5)/density-origin)/sx-.5,ix=Math.floor(px),fx=px-ix;if(ix<0||ix>=511||iy<0||iy>=511)continue;
   const a=(iy*512+ix)*4,b=a+4,c=a+2048,d=c+4,wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
   const aa=source[a+3]*wa,ab=source[b+3]*wb,ac=source[c+3]*wc,ad=source[d+3]*wd,alpha=aa+ab+ac+ad;if(!alpha)continue;
   const i=(y*width+x)*4;out[i+3]=alpha;for(let k=0;k<3;k++)out[i+k]=(source[a+k]*aa+source[b+k]*ab+source[c+k]*ac+source[d+k]*ad)/alpha;
  }
 }
 return {data:out,width,height,x:minX,y:minY,pose,density};
}


// Four source buffers and four deformed frames bound temporary birth memory.
// A tainted/unavailable canvas or unsupported size leaves the authored fallback.
export function createSpringDominantBirthArt(createSurface) {
  const sources = new Map(), frames = new Map(); let serial = 0;
  const remember = (map, key, value) => { map.set(key, value); if (map.size > 4) map.delete(map.keys().next().value); return value; };
  function frame(sprite, agent, elapsed, displayScale, facing = 1) {
    const form = springDominantBirthForm(agent);
    if (!form || !sprite || sprite.width !== 512 || sprite.height !== 512 || !Number.isFinite(elapsed) || elapsed < 0 ||
        !Number.isFinite(displayScale) || displayScale < .2 || displayScale > 10) return null;
    if (elapsed >= SPRING_DOMINANT_BIRTH_SETTLED_AT) return sprite;
    try {
      let source = sources.get(sprite);
      if (!source) {
        const pixels = sprite.getContext("2d").getImageData(0, 0, 512, 512).data;
        if (!pixels || pixels.length !== 512 * 512 * 4) return null;
        const bounds = sourceBounds(pixels);
        if (bounds.right <= bounds.x || bounds.bottom <= bounds.y) return null;
        source = remember(sources, sprite, { pixels, bounds, id: ++serial });
      }
      const time = Math.round(elapsed * 50) / 50, direction = facing < 0 ? -1 : 1;
      const key = [source.id, form, time, displayScale, direction].join("|");
      if (frames.has(key)) return frames.get(key);
      // Birth samples at the existing 256px native-art resolution, not the
      // doubled 512px compositor camera. World units and pivot stay unchanged.
      const pixels = springDominantBirthPixels(source.pixels, time, profiles[form], direction, displayScale, source.bounds, .5);
      if (pixels.width < 1 || pixels.height < 1 || pixels.width > 2048 || pixels.height > 2048) return null;
      const surface = createSurface(pixels.width, pixels.height), ctx = surface.getContext("2d");
      const image = ctx.createImageData(pixels.width, pixels.height); image.data.set(pixels.data); ctx.putImageData(image, 0, 0);
      surface.combatCamera = { width: pixels.width, height: pixels.height, units: 512 * pixels.density, pivotX: (256 - pixels.x) * pixels.density, pivotY: (448 - pixels.y) * pixels.density };
      return remember(frames, key, surface);
    } catch { return null; }
  }
  return { frame, clear: () => { sources.clear(); frames.clear(); } };
}
