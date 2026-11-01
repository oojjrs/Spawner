export const ACTIONS = {
  idle: { durations: Array(32).fill(75), loop: true },
  walk: { durations: Array(24).fill(50), loop: true },
  attack: { durations: [60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60], loop: false, contact: 300 },
  hurt: { durations: [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20], loop: false },
  guard: { durations: Array(20).fill(50), loop: false, contact: 300 },
  heal: { durations: Array(24).fill(50), loop: false, contact: 480 },
  birth: { durations: Array(24).fill(50), loop: false },
  death: { durations: Array(24).fill(60), loop: false }
};
for (const action of Object.values(ACTIONS)) action.duration = action.durations.reduce((a,b)=>a+b,0);
export const VARIANTS = [
  ["blade"], ["piercing"], ["carapace"], ["guard"], ["regeneration"], ["blade","carapace"], ["piercing","guard"], ["blade","piercing","carapace"], ["guard","carapace","regeneration"], ];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v)};
function curve(p,keys) {
  for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){const a=keys[i-1],b=keys[i],t=smooth((p-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*t}
  return keys[keys.length-1][1];
}
function affine(ctx,image,uv,xy) {
  const [a,b,c]=uv,[p,q,r]=xy,det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  if(Math.abs(det)<.00001)return;
  const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det;
  const xyv=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det;
  const yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det;
  const yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
  ctx.save();ctx.beginPath();
  const center=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3];
  for(let i=0;i<3;i++){const v=xy[i],dx=v[0]-center[0],dy=v[1]-center[1],l=Math.hypot(dx,dy)||1;const x=v[0]+dx/l*.35,y=v[1]+dy/l*.35;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.closePath();ctx.clip();ctx.transform(xx,yx,xyv,yy,p[0]-xx*a[0]-xyv*a[1],p[1]-yx*a[0]-yy*a[1]);ctx.drawImage(image,0,0);ctx.restore();
}
function skin(ctx,image,part,bend,branch) {
  const mesh=part.mesh;
  if(!mesh||(!bend&&!branch)){ctx.drawImage(image,0,0);return}
  const points=mesh.vertices.map(v=>{
    const rotate=(point,joint,theta)=>{const dx=point[0]-joint[0],dy=point[1]-joint[1];return[joint[0]+dx*Math.cos(theta)-dy*Math.sin(theta),joint[1]+dx*Math.sin(theta)+dy*Math.cos(theta)]};
    const side=v.uv[0]<part.width/2?-1:1,theta1=bend*.55+branch*side,theta2=bend+branch*side;
    const a=rotate(v.uv,mesh.joints[0],theta1),b=rotate(rotate(v.uv,mesh.joints[1],theta2),mesh.joints[0],theta1);
    const w=v.weights.length===3?v.weights:[1-v.weights[0],v.weights[0]-v.weights[1],v.weights[1]];
    return[v.uv[0]*w[0]+a[0]*w[1]+b[0]*w[2],v.uv[1]*w[0]+a[1]*w[1]+b[1]*w[2]];
  });
  for(const t of mesh.triangles)affine(ctx,image,t.map(i=>mesh.vertices[i].uv),t.map(i=>points[i]));
}
export function createCombatRenderer(rig,images,createSurface) {
  const deformed=new Map(),contacts=new Map();
  function render(ctx,attributes,action,elapsed,settings) {
    const descriptor=ACTIONS[action]||ACTIONS.idle;
    const time=descriptor.loop?((elapsed%descriptor.duration)+descriptor.duration)%descriptor.duration:clamp(elapsed,0,descriptor.duration-1);
    const p=time/descriptor.duration,t=time/1000,has=key=>attributes.includes(key),kind=rig.tribe;
    let contactOffset=0,maxSupport=-Infinity;
    if(action==="death"&&createSurface&&!settings?.measureDeath){
      const key=attributes.join("-")+":"+time.toFixed(2);let support=contacts.get(key);
      if(support===undefined){const surface=createSurface(1,1);support=render(surface.getContext("2d"),attributes,action,time,{fit:{scale:1,x:160,y:280},measureDeath:true}).maxSupport;contacts.set(key,support);if(contacts.size>768)contacts.delete(contacts.keys().next().value)}
      contactOffset=Math.min(0,280-support);
    }
    const stone=kind==="pebble",water=kind==="spring",spore=kind==="spore";
    const walk=action==="walk",attack=action==="attack",hurt=action==="hurt",dead=action==="death";
    const block=action==="guard"&&(has("guard")||has("carapace")),heal=action==="heal"&&has("regeneration");
    const cycle=descriptor.loop?p*Math.PI*2:0,gait=p*Math.PI*2,breath=Math.sin(cycle);
    const hit=attack?curve(p,[[0,0],[.17,-.35],[.30,1],[.44,.72],[.8,0],[1,0]]):0;
    const recoil=hurt?curve(p,[[0,0],[.10,1],[.67,.65],[1,0]]):0;
    const blockAmount=block?curve(p,[[0,0],[.22,.8],[.3,1],[.7,1],[1,0]]):0;
    const support=heal?curve(p,[[0,0],[.22,.5],[.4,1],[.76,.85],[1,0]]):0;
    const death=dead?smooth(p/.85):0,birth=action==="birth"?curve(p,[[0,.08],[.22,.35],[.72,1.035],[1,1]]):1;
    const fit=settings&&settings.fit||{scale:1+Math.min(4,attributes.length)*.1,x:160,y:280};
    const scale=fit.scale*birth;
    ctx.save();ctx.translate(settings&&settings.offsetX||0,settings&&settings.offsetY||0);
    ctx.translate(fit.x,fit.y);ctx.scale(scale,scale);ctx.translate(-160,-280+contactOffset);
    const floor=280,body=rig.bind.body;
    const bx=160+hit*6-recoil*6,by=body.y+(walk?Math.abs(Math.sin(gait*2))*-2:stone?0:breath*.65)+recoil*2;
    const bodyAngle=hit*.045-recoil*.10-blockAmount*.035+(walk?Math.sin(gait)*.025:0)+(dead?(water?0:.85)*death:0);
    const bodyFlatten=dead?(water?1-.68*death:stone?1:1-.16*death):water?1+breath*.012:stone?1:1+breath*.005;
    const bodyH=rig.parts.body.height/rig.parts.body.width*body.width;
    const restExtent=water?bodyH*bodyFlatten:Math.hypot(Math.sin(bodyAngle)*body.width,Math.cos(bodyAngle)*bodyH*bodyFlatten);
    const bodyDrop=dead?(floor-restExtent*.5-by)*death:0;
    function part(name,x,y,width,px,py,angle,bend,flip,sy,branch) {
      const texture=images[name],definition=rig.parts[name];if(!texture||!definition)return;
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);const k=width/definition.width;
      ctx.scale((flip?-1:1)*k,k*sy);ctx.translate(-definition.width*px,-definition.height*py);
      if(settings?.measureDeath){const m=ctx.getTransform();for(const point of definition.contactHull||[[0,0],[definition.width,0],[0,definition.height],[definition.width,definition.height]])maxSupport=Math.max(maxSupport,m.b*point[0]+m.d*point[1]+m.f);ctx.restore();return}
      if(createSurface&&definition.mesh&&(bend||branch)){
        const key=name+":"+bend.toFixed(3)+":"+branch.toFixed(3);let cached=deformed.get(key);
        if(!cached){const padding=Math.ceil(Math.max(definition.width,definition.height)*.35),surface=createSurface(definition.width+padding*2,definition.height+padding*2),c=surface.getContext("2d");c.translate(padding,padding);skin(c,texture,definition,bend,branch);cached={surface,padding};deformed.set(key,cached);if(deformed.size>768)deformed.delete(deformed.keys().next().value)}
        ctx.drawImage(cached.surface,-cached.padding,-cached.padding);
      }else skin(ctx,texture,definition,bend,branch);ctx.restore();
    }
    function onBody(name,dx,dy,width,px,py,angle,bend,flip,sy,branch) {
      ctx.save();ctx.translate(bx,by+bodyDrop);ctx.rotate(bodyAngle);
      part(name,dx,dy*bodyFlatten,width,px,py,angle,bend,flip,sy,branch);ctx.restore();
    }
    function glow(x,y,r,color,a) {
      if(a<=0||settings?.measureDeath)return;ctx.save();ctx.globalAlpha=a;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,"rgba(200,255,210,0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    const healBend=heal?Math.sin(p*Math.PI)*.85:Math.sin(cycle)*.10;
    if(has("regeneration")){
      onBody("tendril",-39,-28,51,.90,.88,-.15,healBend,false,1,0);
      onBody("tendril",-35,-15,45,.90,.88,-.65,-healBend*.8,false,1,0);
      onBody("bud",-42,-36,55,.87,.62,Math.sin(cycle)*.025,0,false,stone?1:1+support*.045,0);
      if(heal)glow(bx-58,by-42,34,"rgba(225,255,210,1)",support*.22);
    }
    
    for(const side of [-1,1]){
      const phase=gait+(side>0?Math.PI:0),raised=walk?Math.max(0,Math.sin(phase))*7:0;
      const x=160+side*rig.bind.feet.spread+(walk?Math.cos(phase)*5:0)+death*side*5;
      const footName=side<0?"foot-left":"foot-right",definition=rig.parts[footName],w=rig.bind.feet.width;
      const angle=walk?Math.sin(phase)*.12:dead?side*death*.12:0;
      const h=definition.height/definition.width*w;
      const bottom=Math.abs(Math.sin(angle))*w*.5+Math.cos(angle)*h*.5;
      if(dead)onBody(footName,side*rig.bind.feet.spread,floor-body.y-bottom,w,.5,.5,side*death*.12,0,false,1,0);
      else part(footName,x,floor-bottom-raised,w,.5,.5,angle,0,false,1,0);
    }
    onBody("body",0,0,body.width,.5,.5,0,0,false,bodyFlatten,0);
    if(!water&&!stone&&!has("carapace")||kind==="sprout") {
      const c=rig.bind.crown,headLag=(walk?Math.sin(gait-.4)*.025:Math.sin(cycle-.45)*.018);
      onBody("crown",0,c.y-body.y,c.width,.5,.88,headLag+death*.22,kind==="sprout"?Math.sin(cycle-.5)*.045:0,false,1,kind==="sprout"?Math.sin(cycle-.9)*.025:0);
    }
    let faceY=rig.bind.eyes.y;
    if(has("carapace")){
      const pivot=rig.parts.armor.facePivot||[.5,.5];
      const height=rig.parts.armor.height/rig.parts.armor.width*rig.bind.armor.width;
      faceY=Math.min(faceY,floor-height*(1-pivot[1])-4);
      onBody("armor",0,faceY-body.y,rig.bind.armor.width,pivot[0],pivot[1],0,0,false,water&&dead?bodyFlatten:1,0);
    }
    const blinking=(action==="idle"||walk)&&((t%2.4)>1.95&&(t%2.4)<2.1);
    const eyeScale=dead?1-death*.94:blinking?.09:1;
    onBody("eyes",0,faceY-body.y,rig.bind.eyes.width,.5,.5,0,0,false,eyeScale,0);
    if(has("blade")){
      const swing=attack?curve(p,[[0,0],[.18,-.28],[.30,1.9],[.43,1.45],[.76,.15],[1,0]]):dead?death*.28:walk?Math.sin(gait-.4)*.055:Math.sin(cycle)*.018;
      onBody("blade",-43,12,62,.87,.85,swing,0,false,1,0);
      onBody("joint",-43,12,20,.5,.5,0,0,false,1,0);
    }
    if(has("piercing")){
      const extension=attack?curve(p,[[0,0],[.18,-4],[.30,15],[.45,10],[.8,0],[1,0]]):0;
      onBody("piercing",48+extension,9,81,.10,.53,dead?-bodyAngle:0,0,false,1,0);
      onBody("joint",48,9,22,.5,.5,0,0,false,1,0);
    }
    if(has("guard")){
      const height=rig.parts.guard.height/rig.parts.guard.width*105,guardY=floor-body.y-height*.45-6;
      onBody("guard",25+blockAmount*9+Math.max(0,hit)*5,guardY-blockAmount*10,105,.86,.55,dead?-bodyAngle-death*Math.PI/2:-blockAmount*.13,0,true,1,0);
      if(block&&p>.27&&p<.44)glow(bx+99,by-3,12,"rgba(255,240,185,1)",Math.sin((p-.27)/.17*Math.PI)*.4);
    }
    ctx.restore();
    return {phase:p,time,contact:descriptor.contact||null,footBaseline:floor,bodyAngle,scale,maxSupport,contactOffset};
  }
  return { render };
}

