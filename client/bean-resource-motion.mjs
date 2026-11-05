import { evolutionPose, renderEvolutionFrame } from '../DesignAssets/Animations/CombatAttributesV7/renderer.mjs';
import { unitDisplayAttributes } from './unit-display-appearance.mjs';
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from '../server/unit-appearance.mjs';

// Canonical bean blade harvest only. No cargo, release, yield or combat events.
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const area = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
export function beanResourceHarvestPose(agent, time, animations) {
  const attributes = unitDisplayAttributes(agent), age = (time-agent.harvestStarted)*1000;
  if ((agent.tribe || 'bean') !== 'bean' || agent.species || !(agent.health > 0) || agent.birth ||
      agent.mode !== 'harvest' || !(attributes.blade > 0) || UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes[key] > 0) ||
      !Number.isFinite(age) || age < 0 || agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt+agent.moveDuration) return null;
  // 20 ms work samples; entry ramp is retained once, not restarted each cycle.
  // Existing body breathing/blink keeps its own 6.4 s period.
  const sampleTime = Math.floor((age + 1e-7)/20)*20;
  return {action:'harvest',frame:sampleTime,elapsed:age,sampleTime,animation:animations.idle};
}
export function prepareBeanResourceHarvest(rig, images) {
  try {
    if (rig?.tribe !== 'sprout' || rig.variant !== 'blade' || rig.approvedSource !== 'DesignAssets/Concepts/CombatEvolutionV1/sprout.png' ||
        rig.root?.[0] !== 238.72330397422388 || rig.root?.[1] !== 368 || !point(rig.pivot) || !point(rig.fitOffset) || rig.scale !== .316) return null;
    const parts = {};
    for (const id of ['body','foliage-left','foliage-right','eye-0','eye-1','foot-0','foot-1']) {
      const p=rig.parts.find(part=>part.id===id), image=images[id], leaf=id.startsWith('foliage-');
      if (!p || !point(p.pivot) || !image || image.complete===false ||
          (image.naturalWidth||image.width)!==(leaf?553:506) || (image.naturalHeight||image.height)!==(leaf?415:372)) return null;
      if (leaf && (!point(p.imageOrigin) || p.imageOrigin[0]!==-17 || p.imageOrigin[1]!==-32 ||
          !p.skin?.vertices?.length || !p.skin?.triangles?.length ||
          p.skin.vertices.some(v=>!point(v.uv)||!point(v.point||v.uv)||!Array.isArray(v.weights)||v.weights.length!==3||!v.weights.every(Number.isFinite)) ||
          p.skin.triangles.some(t=>!Array.isArray(t)||t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=p.skin.vertices.length)||
            Math.abs(area(...t.map(i=>p.skin.vertices[i].uv)))<1e-5))) return null;
      parts[id]=p;
    }
    return {rig,images,parts};
  } catch { return null; }
}
export function sampleBeanResourceHarvest(prepared,time) {
  if (!prepared || !Number.isFinite(time) || time<0) return null;
  const {rig,parts}=prepared, pose=evolutionPose(rig,'idle',time%6400), neutralLeaf=evolutionPose(rig,'idle',0).leaf;
  const phase=time/420*Math.PI*2, entry=Math.min(1,time/120), stroke=Math.sin(phase)*.22*entry;
  pose.sy-=Math.max(0,Math.sin(phase))*.018*entry;
  const mapped={};
  for (const id of ['foliage-left','foliage-right']) {
    const part=parts[id], side=id.endsWith('left')?-1:1, base=neutralLeaf*side, bend=base+stroke*side;
    mapped[id]=part.skin.vertices.map(v=>{
      const [x,y]=v.point||v.uv,dx=x-part.pivot[0],dy=y-part.pivot[1],w=v.weights[1]*.45+v.weights[2];
      const raw=angle=>[part.pivot[0]+dx*Math.cos(angle*w)-dy*Math.sin(angle*w),part.pivot[1]+dx*Math.sin(angle*w)+dy*Math.cos(angle*w)];
      const neutral=raw(base), work=raw(bend), seam=smooth((Math.abs(dx)-18)/82)*smooth((Math.hypot(dx,dy)-18)/52);
      const px=neutral[0]+(work[0]-neutral[0])*seam;
      let py=neutral[1]+(work[1]-neutral[1])*seam;
      if (py>neutral[1]) py=neutral[1]+(py-neutral[1])*(1-smooth((y-(rig.root[1]-105))/100));
      return [px,py];
    });
    for (const t of part.skin.triangles) {
      const ratio=area(...t.map(i=>mapped[id][i]))/area(...t.map(i=>part.skin.vertices[i].point||part.skin.vertices[i].uv));
      if (!Number.isFinite(ratio)||ratio<=.02) return null;
    }
  }
  return {prepared,pose,mapped,neutralLeaf,neutral:time===0};
}
function triangle(ctx,image,uv,points) {
  const [a,b,c]=uv,[p,q,r]=points,d=area(a,b,c),center=points.reduce((s,v)=>[s[0]+v[0]/3,s[1]+v[1]/3],[0,0]);
  const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/d,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/d;
  const yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/d,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/d;
  ctx.save();try {
    ctx.beginPath();points.forEach((v,i)=>{const x=v[0]-center[0],y=v[1]-center[1],n=Math.hypot(x,y)||1;
      if(i)ctx.lineTo(v[0]+x/n*2.4,v[1]+y/n*2.4);else ctx.moveTo(v[0]+x/n*2.4,v[1]+y/n*2.4);});
    ctx.closePath();ctx.clip();ctx.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);ctx.drawImage(image,0,0);
  }finally{ctx.restore();}
}
export function renderBeanResourceHarvest(ctx,sample) {
  if(!sample)return false;
  const {prepared:{rig,images,parts},pose,mapped,neutralLeaf}=sample;
  ctx.save();try {
    ctx.translate(256,448);ctx.scale(2,2);ctx.translate(-128,-230);
    // Exact original own-source identity at entry, not an idle alias for work.
    if(sample.neutral){renderEvolutionFrame(ctx,rig,images,'idle',0);return true;}
    ctx.translate(rig.pivot[0]+rig.fitOffset[0],rig.pivot[1]+rig.fitOffset[1]);ctx.scale(rig.scale,rig.scale);ctx.translate(-rig.root[0],-rig.root[1]);
    for(const id of rig.slots){
      const part=parts[id];ctx.save();try{
        if(id.startsWith('foot-')){ctx.drawImage(images[id],0,0);continue;}
        ctx.translate(rig.root[0]+pose.x,rig.root[1]+pose.y);ctx.rotate(pose.angle);ctx.scale(pose.sx,pose.sy);ctx.translate(-rig.root[0],-rig.root[1]);
        if(id.startsWith('eye-')){ctx.translate(...part.pivot);ctx.scale(1/pose.sx,Math.max(.025,pose.blink)/pose.sy);ctx.translate(-part.pivot[0],-part.pivot[1]);ctx.drawImage(images[id],0,0);}
        else if(id.startsWith('foliage-')){ctx.translate(...part.pivot);ctx.rotate(neutralLeaf*(id.endsWith('left')?-1:1)*.08);ctx.translate(-part.pivot[0],-part.pivot[1]);
          for(const t of part.skin.triangles)triangle(ctx,images[id],t.map(i=>part.skin.vertices[i].uv),t.map(i=>mapped[id][i]));
        }else ctx.drawImage(images[id],0,0);
      }finally{ctx.restore();}
    }
    return true;
  }catch{return false;}finally{ctx.restore();}
}
