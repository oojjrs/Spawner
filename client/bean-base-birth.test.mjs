import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {UNIT_BIRTH_ART, UNIT_BIRTH_ART_ASSETS} from './unit-birth-art-assets.mjs';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {createUnitActionArt, unitActionArtPose} from './unit-action-art.mjs';
import {validateDna} from '../server/dna-unit.mjs';
import {unitDisplaySize} from './unit-size.mjs';
const clip = UNIT_BIRTH_ART['bean/base'], idle = UNIT_ACTION_ART['bean/base'].reference;
const dna = validateDna({version:6, level:1, budget:0, pieces:[]},1,0);
const actor = {tribe:'bean',dna,health:10,birth:{startedAt:10,readyAt:13.85}};
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const body = clip.sceneLayers.layers[1], environment = clip.sceneLayers.layers[0];
const at = ms => 10 + ms / 1000;
const surface = (width,height) => ({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(width*height*4)})})});
const record = () => { const calls=[], transforms=[]; return {calls,transforms,save(){},restore(){},translate(...v){transforms.push(v)},scale(...v){transforms.push(v)},drawImage(...v){calls.push(v)}}; };

test('base DNA selects its full 3.85 second birth rather than the idle fallback',()=>{
 assert.ok(dna);assert.equal(clip.frameCount,116);assert.equal(clip.durationsMs.reduce((a,b)=>a+b,0),3850);
 let ms=0;for(let frame=0;frame<116;frame++){
  const pose=unitActionArtPose(actor,at(ms));assert.equal(pose.action,'birth');assert.equal(pose.missing,false);assert.equal(pose.animation,clip);assert.equal(pose.frame,frame);
  assert.equal(!!body.samples[frame],ms>=2590);ms+=clip.durationsMs[frame];
 }
 assert.equal(unitActionArtPose(actor,at(3849.999)).action,'birth');assert.equal(unitActionArtPose(actor,at(3850)).action,'idle');
 assert.equal(body.samples[unitActionArtPose(actor,at(3610)).frame].frame,15);
});
test('all authored boundaries draw one whole body after emergence in both facings',async()=>{
 const requested=[],art=createUnitActionArt(v=>v,surface,async image=>{requested.push(image);return {image}});
 await art.prepare(actor,at(0));assert.deepEqual(requested.sort(),[body.image,environment.image].sort());
 for(const mirror of [false,true]){let ms=0;for(let frame=0;frame<116;frame++){
  const ctx=record();assert.equal(art.draw(ctx,actor,at(ms),100,200,100,mirror),true);
  assert.deepEqual(ctx.transforms,[[100,200],[mirror?-1:1,1]]);
  assert.equal(ctx.calls.filter(c=>c[0].image===body.image).length,ms>=2590?1:0);
  if(ms>=2590){const c=ctx.calls.at(-1),s=body.samples[frame];assert.deepEqual(c.slice(1,5),[s.frame%8*631,Math.floor(s.frame/8)*631,631,631]);}
  ms+=clip.durationsMs[frame];
 }}
 assert.equal(requested.includes(clip.image),false);
});
test('final whole-body pixels and registration match the actual current idle',()=>{
 const result=JSON.parse(execFileSync('python3',['-c',`import json,sys,hashlib
from PIL import Image
b,i=json.load(sys.stdin)
def cell(a,f):
 w=a['frameSize'];h=a.get('frameHeight',w);c=a['columns'];im=Image.open(a['image']).convert('RGBA');return im.crop((f%c*w,f//c*h,(f%c+1)*w,(f//c+1)*h))
x,y=cell(b,15),cell(i,0)
print(json.dumps({'equal':x.tobytes()==y.tobytes(),'bbox':y.getchannel('A').point(lambda v:255 if v>=16 else 0).getbbox()}))`],{input:JSON.stringify([body,idle]),encoding:'utf8'}));
 assert.equal(result.equal,true);const bounds=result.bbox,length=Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);assert.equal(length,247);
 const sceneScale=100*unitDisplaySize(actor)/clip.referenceLength,idleScale=100*unitDisplaySize(actor)/length;
 const d=body.samples.at(-1).destination,expected=[-idle.pivotX*idleScale,-idle.pivotY*idleScale,idle.frameSize*idleScale,(idle.frameHeight||idle.frameSize)*idleScale];
 const actual=[(d[0]-clip.pivotX)*sceneScale,(d[1]-clip.pivotY)*sceneScale,d[2]*sceneScale,d[3]*sceneScale];
 actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-10));
});
test('offline publication includes both layers and the independently verified fallback',()=>{
 const source=JSON.parse(readFileSync('AnimationCandidates/bean-base-birth-fullbody-v1-20261107/publication-manifest.json'));
 assert.equal(sha(clip.image),source.actions.birth.sheetSHA256);
 for(const [index,layer]of clip.sceneLayers.layers.entries()){
  assert.ok(UNIT_BIRTH_ART_ASSETS.includes(layer.image));assert.equal(sha(layer.image),source.actions.birth.sceneLayers.layers[index].sha256);
 }
 assert.ok(UNIT_BIRTH_ART_ASSETS.includes(clip.image));assert.equal(new Set(UNIT_BIRTH_ART_ASSETS).size,UNIT_BIRTH_ART_ASSETS.length);
});
test('failed layer uses the complete-scene fallback without reviving part rigs',async()=>{
 const art=createUnitActionArt(v=>v,surface,async image=>{if(image===body.image)throw Error('offline');return {image}});
 await art.prepare(actor,at(2800));const ctx=record();assert.equal(art.draw(ctx,actor,at(2800),0,0,100,true),true);
 assert.deepEqual(ctx.calls.map(c=>c[0].image),[clip.image]);assert.equal(art.readyAction(actor,at(2800)),true);
});
test('design and compiled runtime use the same layered base birth with left-facing preview',()=>{
 let html='';runInNewContext(readFileSync('DesignAssets/sections/unit-appearance.js','utf8'),{document:{write:s=>html+=s}});
 const row=html.match(/<tr id="unit-sprout-bean">[\s\S]*?<\/tr>/)[0],cell=row.match(/<td data-action="birth">[\s\S]*?<\/td>/)[0];
 const payload=JSON.parse(cell.match(/data-birth-scene="([^"]+)"/)[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
 assert.deepEqual(payload.sceneLayers,clip.sceneLayers);assert.equal(payload.sourceFacing,'right');assert.equal(payload.loop,true);
 assert.ok(cell.includes('bean-base-birth-complete-v1-preview.webp'));assert.ok(!cell.includes('birth-game.webp'));
 const context={};runInNewContext(readFileSync('client/unit-preview-facing-data.js','utf8'),context);assert.equal(context.SpawnerUnitPreviewFacing.forms['bean/base'].birth,'right');
 const scope={console,setTimeout,clearTimeout,URL,performance};runInNewContext(readFileSync('client/runtime.js','utf8'),scope);
 assert.equal(scope.Spawner.unitActionArtPose(actor,at(2800)).missing,false);assert.equal(scope.Spawner.unitActionArtPose(actor,at(2800)).animation.image,clip.image);
});
test('many simultaneous base births reuse two decoded atlases and keep each body clock',async()=>{
 const requested=[],art=createUnitActionArt(v=>v,surface,async image=>{requested.push(image);return {image}});
 const actors=Array.from({length:64},(_,index)=>({...actor,birth:{startedAt:10+index*.01,readyAt:13.85+index*.01}}));
 await Promise.all(actors.map(agent=>art.prepare(agent,12.9)));
 assert.deepEqual(requested.sort(),[body.image,environment.image].sort());
 for(const agent of actors){const ctx=record();art.draw(ctx,agent,12.9,0,0,100,false);const frame=unitActionArtPose(agent,12.9).frame;assert.equal(ctx.calls.length,body.samples[frame]?2:1);}
 assert.equal(requested.length,2);
});
