import {regenerationPose} from '../CombatAttributesV5/regeneration.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=v=>{const t=clamp(v,0,1);return t*t*(3-2*t)};
export const HEALING_TIMING={cycle:3.2,aimStart:.24,aimReady:.68,release:.86,impact:1.24,recoverStart:1.42,recoverEnd:1.95,effectEnd:2.18};
export function healingPose(rig,track,time,mode,target){
 const phase=time%HEALING_TIMING.cycle,base=regenerationPose(rig,track,'idle',time*1000,6400),aim=ease((phase-.24)/.44)*(1-ease((phase-1.42)/.53)),start=base.start,length=rig.parts['healing-tube'].height*base.tubeScale;
 const dx=target[0]-start[0],dy=target[1]-start[1],distance=Math.hypot(dx,dy)||1,direction=[dx/distance,dy/distance],reach=length*(mode==='self'?.60:.70),tip=[start[0]+direction[0]*reach,start[1]+direction[1]*reach],p1=[start[0],start[1]+length*.25],p2=[tip[0]-direction[0]*length*.24,tip[1]-direction[1]*length*.24],desired=[start,p1,p2,tip];
 base.points=base.points.map((point,i)=>[point[0]*(1-aim)+desired[i][0]*aim,point[1]*(1-aim)+desired[i][1]*aim]);base.phase=clamp((phase-.52)/.34,0,1);
 return{pose:base,phase,aim,charging:phase>=.52&&phase<.86,flight:phase>=.86&&phase<1.24,received:phase>=1.24&&phase<2.18};
}
export function healingFlight(start,target,phase){const t=clamp((phase-.86)/.38,0,1),arc=Math.sin(t*Math.PI)*Math.min(18,Math.hypot(target[0]-start[0],target[1]-start[1])*.10);return{point:[start[0]*(1-t)+target[0]*t,start[1]*(1-t)+target[1]*t-arc],angle:Math.atan2(target[1]-start[1],target[0]-start[0]),progress:t}}
export function drawReceivingEffect(context,effects,target,phase){
 const age=phase-1.24;if(age<0||age>=.94)return;
 const t=age/.94,pulse=Math.sin(Math.PI*Math.min(1,t/.45)),fade=(1-t)**1.3,width=target.width*(.75+.55*t),height=width*.37;
 context.save();context.globalCompositeOperation='screen';context.globalAlpha=fade*.8;context.drawImage(effects.ring,target.point[0]-width/2,target.point[1]+target.height*.12-height/2,width,height);
 context.globalAlpha=pulse*.55;const flashSize=target.width*.33;context.drawImage(effects.sparkle,target.point[0]-flashSize/2,target.point[1]-flashSize/2,flashSize,flashSize);
 for(let i=0;i<6;i++){const a=i*Math.PI*2/6+.3,x=target.point[0]+Math.cos(a)*target.width*.33,y=target.point[1]+Math.sin(a)*target.height*.25-target.height*.6*t,size=5.5+1.5*(i%2);context.globalAlpha=fade*Math.sin(Math.PI*clamp(t*1.5-i*.045,0,1));context.drawImage(effects.sparkle,x-size/2,y-size/2,size,size)}context.restore();
}
