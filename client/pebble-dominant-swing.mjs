// Canonical pebble blade attack: an anchored overhead sweep, rather than a
// complete body roll. Only the approved V7 body, eyes, and feet are sampled.
// The emerald blade is grown into the stone and travels with its upper body.
const KEYS = Object.freeze([
  [0, 0, 0, 1], [80, -.20, -3, .90], [160, -.50, -9, .75],
  [220, -.56, -12, .65], [260, -.17, 0, .38], [300, .58, 14, .28],
  [340, .70, 18, .32], [410, .64, 14, .42], [520, .38, 4, .62],
  [660, -.06, -3, .90], [800, 0, 0, 1], [1000, 0, 0, 1],
].map(Object.freeze));
const point2 = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const area = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
const smooth = t => t*t*(3-2*t);
function motion(time) {
  let i=0; while(i<KEYS.length-2 && KEYS[i+1][0]<time)i++;
  const a=KEYS[i],b=KEYS[i+1],t=smooth((time-a[0])/(b[0]-a[0]));
  return { angle:a[1]+(b[1]-a[1])*t, x:a[2]+(b[2]-a[2])*t, blink:a[3]+(b[3]-a[3])*t };
}
export function pebbleDominantSwingAppearance(tribe, attributes) {
  return tribe === 'pebble' && attributes?.blade > 0 &&
    !['piercing','carapace','antenna','strength','arms','feet','legs','secretion'].some(key => attributes[key] > 0);
}
export function preparePebbleDominantSwing(rig, images) {
  try {
    if(rig?.tribe!=='pebble'||rig.variant!=='blade'||
      rig.approvedSource!=='DesignAssets/Concepts/CombatEvolutionV1/pebble.png'||
      rig.canvas?.[0]!==440||rig.canvas?.[1]!==360||
      ![rig.root,rig.fitOffset].every(point2)||Math.abs(rig.root[0]-231.37333943614905)>.00001||rig.root[1]!==356||
      !Number.isFinite(rig.scale)||!(rig.scale>0))return null;
    const ids=['body','eye-0','eye-1','foot-0','foot-1'];
    const parts=Object.fromEntries(ids.map(id=>[id,rig.parts?.find(p=>p.id===id)]));
    for(const id of ids){const image=images?.[id];if(!point2(parts[id]?.pivot)||!image||image.complete===false||
      (image.naturalWidth||image.width)!==440||(image.naturalHeight||image.height)!==360)return null;}
    const vertices=[],triangles=[];
    for(let y=0;y<=360;y+=30)for(let x=0;x<=440;x+=40)vertices.push([x,y]);
    for(let row=0;row<12;row++)for(let col=0;col<11;col++){
      const i=row*12+col;triangles.push([i,i+1,i+13],[i,i+13,i+12]);
    }
    return {rig,parts,images:Object.fromEntries(ids.map(id=>[id,images[id]])),vertices,triangles,
      areas:triangles.map(ids=>area(...ids.map(i=>vertices[i])))};
  }catch{return null;}
}
export function pebbleSwingPoint(prepared, pose, [x,y]) {
  const w=Math.max(0,Math.min(1,(335-y)/180)),px=x-prepared.rig.root[0],py=y-320;
  const c=Math.cos(pose.angle),s=Math.sin(pose.angle);
  return [x+(prepared.rig.root[0]+pose.x+px*c-py*s-x)*w,
    y+(320+px*s+py*c-y)*w];
}
export function samplePebbleDominantSwing(prepared,time) {
  try{
    if(!prepared||!Number.isFinite(time)||time<0||time>1000)return null;
    const pose=motion(time),points=prepared.vertices.map(p=>pebbleSwingPoint(prepared,pose,p));
    const ratios=prepared.triangles.map((ids,i)=>area(...ids.map(j=>points[j]))/prepared.areas[i]);
    if(points.some(p=>!point2(p))||ratios.some(r=>!Number.isFinite(r)||r<=.02))return null;
    return {prepared,time,pose,points,minRatio:Math.min(...ratios),neutral:pose.angle===0&&pose.x===0};
  }catch{return null;}
}
function triangle(ctx,image,uv,points){
  const [a,b,c]=uv,[p,q,r]=points,d=area(a,b,c),center=points.reduce((s,p)=>[s[0]+p[0]/3,s[1]+p[1]/3],[0,0]);
  const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/d,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/d;
  const yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/d,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/d;
  ctx.save();try{
    ctx.beginPath();points.forEach((p,i)=>{const x=p[0]-center[0],y=p[1]-center[1],n=Math.hypot(x,y)||1;
      const v=[p[0]+x/n*1.6,p[1]+y/n*1.6];i?ctx.lineTo(...v):ctx.moveTo(...v);});
    ctx.closePath();ctx.clip();ctx.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);ctx.drawImage(image,0,0);
  }finally{ctx.restore();}
}
export function renderPebbleDominantSwing(ctx,sample){
  if(!sample)return false;
  const {prepared,pose,points,neutral}=sample,{rig,parts,images,vertices,triangles}=prepared;
  ctx.save();try{
    ctx.translate(256+rig.fitOffset[0]*2,448+rig.fitOffset[1]*2);ctx.scale(rig.scale*2,rig.scale*2);ctx.translate(-rig.root[0],-rig.root[1]);
    if(neutral)ctx.drawImage(images.body,0,0);
    else{
      // The source's lower support strip is untouched. A slow wind-up precedes
      // the short, fast sweep through the unchanged 300 ms contact pose.
      for(const ids of triangles)triangle(ctx,images.body,ids.map(i=>vertices[i]),ids.map(i=>points[i]));
      ctx.save();try{ctx.beginPath();ctx.rect(0,335,440,25);ctx.clip();ctx.globalCompositeOperation='copy';ctx.drawImage(images.body,0,0);}finally{ctx.restore();}
    }
    for(const id of ['eye-0','eye-1']){
      const pivot=parts[id].pivot,p=pebbleSwingPoint(prepared,pose,pivot),w=Math.max(0,Math.min(1,(335-pivot[1])/180));
      ctx.save();try{ctx.translate(...p);ctx.rotate(pose.angle*w);ctx.scale(1,pose.blink);ctx.translate(-pivot[0],-pivot[1]);ctx.drawImage(images[id],0,0);}finally{ctx.restore();}
    }
    for(const id of ['foot-0','foot-1'])ctx.drawImage(images[id],0,0);
    return true;
  }catch{return false;}finally{ctx.restore();}
}
