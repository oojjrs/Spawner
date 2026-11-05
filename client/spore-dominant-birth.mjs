import { SPORE_BIRTH_ANIMATION, sporeBirthMotion } from "./birth.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";

// The current canonical idle is the source, not a different birth body. Native
// birth measurements drive cap unfolding, the stem and eyes until that same
// current idle can be returned unchanged. Scene flight and spin stay with host.
export const SPORE_DOMINANT_BIRTH_SETTLED_AT = 2.38;
const profiles = Object.freeze({
  blade: Object.freeze({ centerX: 223.34580745080255, neckY: 340.7542001645393, eyeY: 390.7342001645393, stemWidth: 132.09, stemHeight: 96.39, top: 220 }),
  carapace: Object.freeze({ centerX: 223.34580745080255, neckY: 339.4806852602443, eyeY: 389.4606852602443, stemWidth: 134.232, stemHeight: 94.962, top: 202 })
});
// Seconds, measured native stem center/width/height/floor, authored cap width/height/lean.
// Measurements: tools/spore-dominant-birth-20261105/native-measurements.json.
const tracks = Object.freeze([
  [.26,130.5,31,21,119,30.378,28.082,.264], [.34,144.5,31,26,150,36.994,21.578,.398],
  [.42,152.5,35,25,162,47.979,23.032,.208], [.50,154.5,33,26,167,46.417,22.987,.253],
  [.58,148.5,33,25,169,46.094,21.101,.308], [.66,144,34,25,173,33.755,22.660,.205],
  [.74,142.5,33,28,173,30.417,19.395,.407], [.82,139.5,35,31,166,40.178,24.156,.293],
  [.98,134,38,32,163,48.296,25.574,.239], [1.14,128,40,33,162,55.534,26.834,.204],
  [1.30,125,38,33,160,55.341,25.022,.224], [1.46,127,40,34,163,59.215,27.464,.087],
  [1.62,123.5,41,34,163,57.514,28.219,.240], [1.78,127,38,33,163,54.588,26.001,.223],
  [1.94,129.5,39,32,167,57.394,26.561,.086], [2.10,129,40,31,167,59.693,29.712,.159],
  [2.18,134.5,41,28,166,59.043,24.840,.017], [2.26,135,38,28,164,54.063,25.599,-.028],
  [2.34,134.5,37,28,164,55.052,26.363,-.022], [2.38,133.5,37,30,162,57.035,26.944,0]
].map(Object.freeze));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const smooth = v => {const p=clamp(v,0,1);return p*p*(3-2*p);};
export function sporeDominantBirthMotion(elapsed) {
  const motion=sporeBirthMotion(elapsed),remaining=1-smooth((elapsed-2.26)/.12);
  // The authored pulse lasts beyond the existing frame-21 idle switch. Settle
  // its tail before that boundary instead of dropping a non-neutral scale.
  return {rotation:motion.rotation*remaining,scaleX:1+(motion.scaleX-1)*remaining,scaleY:1+(motion.scaleY-1)*remaining};
}
export function sporeDominantBirthForm(agent) {
  if (agent?.species || agent?.tribe !== "spore" || !(agent.health > 0) || !agent.birth) return null;
  const attributes = unitDisplayAttributes(agent);
  if (["piercing","strength","arms","antenna","feet","legs","secretion"].some(key=>attributes[key]>0)) return null;
  return attributes.blade>0 && !(attributes.carapace>0) ? "blade" : attributes.carapace>0 && !(attributes.blade>0) ? "carapace" : null;
}
function trackAt(time) {
  if(time<=tracks[0][0])return tracks[0];
  for(let i=1;i<tracks.length;i++)if(time<=tracks[i][0]){
    const a=tracks[i-1],b=tracks[i],p=smooth((time-a[0])/(b[0]-a[0]));return a.map((v,j)=>v+(b[j]-v)*p);
  }
  return tracks.at(-1);
}
export function sporeDominantBirthPose(form,elapsed,nativePixelScale,facing=1,birthFacing=1) {
  const profile=profiles[form];
  if(SPORE_BIRTH_ANIMATION.frameSize!==192||SPORE_BIRTH_ANIMATION.frameCount!==22||SPORE_BIRTH_ANIMATION.pivotY!==162||
    !profile||!Number.isFinite(elapsed)||elapsed<0||!Number.isFinite(nativePixelScale)||nativePixelScale<=0||nativePixelScale>.1)return null;
  const t=trackAt(elapsed),grow=smooth((elapsed-SPORE_BIRTH_ANIMATION.detachAt)/1.16),settle=smooth((elapsed-2.10)/.28);
  const ratio=nativePixelScale/(1.4/512),nativeGrowth=t[2]*ratio/profile.stemWidth;
  const growth=nativeGrowth+(1-nativeGrowth)*grow,weight=(1-grow)*(1-settle);
  const direction=(facing<0?-1:1)*(birthFacing<0?-1:1);
  const nativeBodyY=t[3]*ratio/(profile.stemHeight*nativeGrowth);
  return {form,elapsed,profile,neutral:elapsed>=SPORE_DOMINANT_BIRTH_SETTLED_AT,
    growth,bodyY:1+(clamp(nativeBodyY,.55,1.5)-1)*(1-grow),
    capX:1+(clamp(t[5]/57.035/(t[2]/37),.48,1.2)-1)*(1-settle),
    capY:1+(clamp(t[6]/26.944/(t[3]/30),.70,1.5)-1)*(1-settle),
    lean:(t[7]-.013)*.65*(1-settle),open:.20+.80*smooth((elapsed-1.16)/.20),
    rootX:((t[1]-SPORE_BIRTH_ANIMATION.pivotX)*ratio*direction-(profile.centerX-256))*weight,
    rootY:(t[4]-SPORE_BIRTH_ANIMATION.pivotY)*ratio*weight};
}
function eyeRow(y,center,open) {
  const d=y-center,a=Math.abs(d);if(a>=30)return y;
  const mapped=a<=13?a*open:13*open+(a-13)*(30-13*open)/17;
  return center+Math.sign(d)*mapped;
}
export function sporeDominantBirthRow(y,pose) {
  const p=pose.profile,upper=1-smooth((y-p.neckY+8)/42);
  const v=y<p.neckY?p.neckY+(y-p.neckY)*pose.capY:eyeRow(y,p.eyeY,pose.open);
  const sx=pose.growth*(1+(pose.capX-1)*upper);
  return {y:448+pose.rootY+(v-448)*pose.growth*pose.bodyY,sx,
    x:p.centerX+pose.rootX-p.centerX*sx+(p.neckY-y)*pose.lean*upper*pose.growth};
}
function boundsOf(pixels) {
  let x=512,y=512,right=-1,bottom=-1;
  for(let j=0;j<512;j++)for(let i=0;i<512;i++)if(pixels[(j*512+i)*4+3]){x=Math.min(x,i);y=Math.min(y,j);right=Math.max(right,i);bottom=Math.max(bottom,j);}
  return {x:Math.max(0,x-1),y:Math.max(0,y-1),right:Math.min(512,right+2),bottom:Math.min(512,bottom+2)};
}
export function sporeDominantBirthPixels(source,pose,bounds=boundsOf(source),density=.5) {
  const rows=Array.from({length:513},(_,y)=>sporeDominantBirthRow(y,pose));
  let minX=Infinity,maxX=-Infinity;
  for(let y=bounds.y;y<=bounds.bottom;y++){const r=rows[y];if(!(r.sx>0)||y&&!(r.y>rows[y-1].y))return null;minX=Math.min(minX,r.x+bounds.x*r.sx);maxX=Math.max(maxX,r.x+bounds.right*r.sx);}
  minX=Math.floor(minX)-2;maxX=Math.ceil(maxX)+2;const minY=Math.floor(rows[bounds.y].y)-2,maxY=Math.ceil(rows[bounds.bottom].y)+2;
  const width=Math.ceil((maxX-minX)*density),height=Math.ceil((maxY-minY)*density);
  if(width<1||height<1||width>1024||height>1024)return null;
  const data=new Uint8ClampedArray(width*height*4);let j=0;
  for(let y=0;y<height;y++){
    const py=minY+(y+.5)/density;while(j<511&&rows[j+1].y<=py)j++;
    if(py<rows[0].y||py>=rows[512].y)continue;
    const u=(py-rows[j].y)/(rows[j+1].y-rows[j].y),sy=j+u-.5,iy=Math.floor(sy),fy=sy-iy;
    const sx=rows[j].sx+(rows[j+1].sx-rows[j].sx)*u,origin=rows[j].x+(rows[j+1].x-rows[j].x)*u;
    const first=Math.max(0,Math.floor((origin+bounds.x*sx-minX)*density)),last=Math.min(width,Math.ceil((origin+bounds.right*sx-minX)*density));
    for(let x=first;x<last;x++){
      const px=(minX+(x+.5)/density-origin)/sx-.5,ix=Math.floor(px),fx=px-ix;if(ix<0||ix>=511||iy<0||iy>=511)continue;
      const a=(iy*512+ix)*4,b=a+4,c=a+2048,d=c+4;
      const aa=source[a+3]*(1-fx)*(1-fy),ab=source[b+3]*fx*(1-fy),ac=source[c+3]*(1-fx)*fy,ad=source[d+3]*fx*fy,alpha=aa+ab+ac+ad;if(!alpha)continue;
      const at=(y*width+x)*4;data[at+3]=alpha;for(let k=0;k<3;k++)data[at+k]=(source[a+k]*aa+source[b+k]*ab+source[c+k]*ac+source[d+k]*ad)/alpha;
    }
  }
  return {data,width,height,x:minX,y:minY,density};
}
// Only the detached body changes ownership. This short original stalk stays
// in its native scene camera behind the cap during frames 3–8.
const SPORE_STALK_BOXES=Object.freeze([[117,101,22,19],[116,103,26,27],[115,103,30,29],[115,105,26,29],[114,108,18,28],[114,106,23,29]].map(Object.freeze));
export function createSporeDominantBirthArt(createSurface) {
  const sources=new Map(),frames=new Map(),stalks=new Map();let serial=0;
  const keep=(map,key,value)=>{map.set(key,value);if(map.size>4)map.delete(map.keys().next().value);return value;};
  function frame(sprite,agent,elapsed,nativePixelScale,facing=1,birthFacing=1) {
    const form=sporeDominantBirthForm(agent),pose=sporeDominantBirthPose(form,elapsed,nativePixelScale,facing,birthFacing);
    if(!pose||!sprite||sprite.width!==512||sprite.height!==512)return null;
    if(pose.neutral)return sprite;
    try{
      let source=sources.get(sprite);
      if(!source){const pixels=sprite.getContext("2d").getImageData(0,0,512,512).data;if(!pixels||pixels.length!==512*512*4)return null;
        const bounds=boundsOf(pixels);if(bounds.right<=bounds.x||bounds.bottom<=bounds.y)return null;
        source=keep(sources,sprite,{pixels,bounds,id:++serial});}
      const time=Math.round(elapsed*50)/50,key=[source.id,form,time,nativePixelScale,facing<0,birthFacing<0].join("|");
      if(frames.has(key))return frames.get(key);
      const sample=sporeDominantBirthPose(form,time,nativePixelScale,facing,birthFacing),pixels=sporeDominantBirthPixels(source.pixels,sample,source.bounds);
      if(!pixels)return null;
      const surface=createSurface(pixels.width,pixels.height),context=surface.getContext("2d"),image=context.createImageData(pixels.width,pixels.height);
      image.data.set(pixels.data);context.putImageData(image,0,0);
      surface.combatCamera={width:pixels.width,height:pixels.height,units:512*pixels.density,pivotX:(256-pixels.x)*pixels.density,pivotY:(448-pixels.y)*pixels.density};
      return keep(frames,key,surface);
    }catch{return null;}
  }
  function stalk(sprite,index) {
    if(index<3||index>8)return null;
    if(stalks.has(index)&&stalks.get(index).source===sprite)return stalks.get(index).image;
    try {
      if(!sprite||sprite.width!==192||sprite.height!==192)return null;
      const input=sprite.getContext("2d").getImageData(0,0,192,192).data;
      const box=SPORE_STALK_BOXES[index-3],mask=new Uint8Array(192*192);let retained=0;
      for(let y=box[1];y<box[1]+box[3];y++)for(let x=box[0];x<box[0]+box[2];x++){
        const i=(y*192+x)*4,r=input[i],g=input[i+1],b=input[i+2];
        if(input[i+3]>=128&&r>140&&g>120&&b>95&&r-g<44&&r-b<78)
          for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
            const xx=x+dx,yy=y+dy;if(xx>=box[0]&&yy>=box[1]&&xx<box[0]+box[2]&&yy<box[1]+box[3])mask[yy*192+xx]=1;
          }
      }
      const surface=createSurface(192,192),context=surface.getContext("2d"),image=context.createImageData(192,192);
      for(let i=0;i<mask.length;i++)if(mask[i]){image.data.set(input.subarray(i*4,i*4+4),i*4);if(input[i*4+3])retained++;}
      if(retained<12)return null;
      context.putImageData(image,0,0);stalks.set(index,{source:sprite,image:surface});return surface;
    }catch{return null;}
  }
  return {frame,stalk,clear(){sources.clear();frames.clear();stalks.clear();}};
}
