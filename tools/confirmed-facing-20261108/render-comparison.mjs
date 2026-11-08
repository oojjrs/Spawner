// Visual review: current corrected source vs exact horizontal reconstruction of previous display.
// Whole-family pixels were verified as exact mirrors; no preview-only runtime fix is shipped.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createUnitPresentation} from '../../client/unit-presentation.mjs';
const {createCanvas,Image}=createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json')('@napi-rs/canvas');
const root=new URL('../../',import.meta.url),out=new URL('comparison-frames/',import.meta.url);mkdirSync(out,{recursive:true});
const forms=[{tribe:'bean',attributes:{blade:1,carapace:1,antenna:1},name:'Bean: blade + shell + antenna'}, {tribe:'bean',attributes:{blade:1,secretion:1,carapace:1,antenna:1},name:'Bean: blade + ranged + shell + antenna'}, {tribe:'pebble',attributes:{secretion:1},name:'Pebble: ranged'}];
let time=0;globalThis.SpawnerAssets={source:p=>new URL(p,root).pathname,image:()=>new Image()};
const p=createUnitPresentation({model:{},height:.7,time:()=>time,displayScale:()=>1,createSurface:(w,h)=>createCanvas(w,h)});
const c=createCanvas(960,780),ctx=c.getContext("2d");
for(let f=0;f<170;f++){
 const ms=f*40;time=ms/1000;
 const action=ms<1600?'walk':ms<2600?'idle':ms<3600?'attack':ms<4800?'ranged':'walk';
 const phase=ms<1600?'ENTER':ms<2600?'IDLE':ms<3600?'MELEE':ms<4800?'RANGED':'EXIT';
 ctx.fillStyle='#edf0e5';ctx.fillRect(0,0,960,780);
 ctx.fillStyle='#273c30';ctx.font='bold 24px sans-serif';ctx.fillText('PREVIOUS',30,35);ctx.fillText('CORRECTED SOURCE',510,35);ctx.font='15px sans-serif';ctx.fillText('All actions follow the corrected source. Same movement and timing.',30,61);
 ctx.fillStyle='#ccd4c6';ctx.fillRect(479,80,2,690);
 for(let row=0;row<forms.length;row++){
  const form=forms[row],start=ms<1600?0:ms>=4800?4.8:ms<2600?1.6:ms<3600?2.6:3.6;
  const a={...form,id:'review-'+row,health:10,facing:-1,mode:action==='walk'?'walk':'idle',animationStartedAt:start,moveStartedAt:start,moveDuration:action==='walk'?1.6:0,moveAnimationStartedAt:start,stepCount:1};
  if(action==='attack'||action==='ranged')a.attack={startedAt:start,hitAt:start+.3,endsAt:start+1,directionX:-1,mode:row===2||(row===1&&action==='ranged')?'ranged':'melee'};
  await p.prepareAnimation(a,time);
  const localX=phase==='ENTER'?340-(ms/1600)*100:phase==='EXIT'?240-((ms-4800)/2000)*140:240;
  const floor=270+row*235;ctx.strokeStyle='#cbd3c2';ctx.beginPath();ctx.moveTo(0,floor);ctx.lineTo(960,floor);ctx.stroke();
  ctx.fillStyle='#273c30';ctx.font='16px sans-serif';ctx.fillText(form.name+' / '+phase,20,100+row*235);
  for(const column of [0,1]){
   const x=localX+column*480;ctx.save();
   if(column===0){ctx.translate(x*2,0);ctx.scale(-1,1);}
   p.drawAgentAnimation(ctx,a,x,floor,230);ctx.restore();
  }
 }
 writeFileSync(new URL(String(f).padStart(3,'0')+'.png',out),c.toBuffer('image/png'));
 if(f%10===0)global.gc?.();
}
console.log('Rendered 170 review frames, no production asset writes.');
