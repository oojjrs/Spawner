import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
import { unitActionArtPose } from './unit-action-art.mjs';
import { UNIT_BIRTH_ART } from './unit-birth-art-assets.mjs';
const root = new URL('../', import.meta.url);

test('three carapace attacks preserve actual LEFT idle endpoint pixels and registrations', () => {
  const records=[];
  for (const [tribe, ref, duration, hit] of [['spore',177,1000,300],['pebble',181,980,450],['spring',157,1000,300]]) {
    const definition=UNIT_ACTION_ART[tribe+'/carapace'], attack=definition.actions.attack, idle=definition.actions.idle;
    assert.equal(attack.sourceFacing,'left'); assert.equal(idle.sourceFacing,'left');
    assert.equal(attack.frameSize,256); assert.equal(attack.referenceLength,ref); assert.equal(attack.viewSize,256);
    assert.equal(attack.pivotX,128); assert.equal(attack.pivotY,230); assert.equal(attack.durationMs,duration); assert.equal(attack.hitTimeMs,hit);
    assert.equal(attack.pivotX,idle.pivotX); assert.equal(attack.pivotY,idle.pivotY);
    records.push({attack,idle});
  }
  execFileSync('python',['-c',`import sys,json
from PIL import Image
for record in json.loads(sys.argv[1]):
 a,b=record['attack'],record['idle'];attack=Image.open(a['image']).convert('RGBA');idle=Image.open(b['image']).convert('RGBA');w=a['frameSize'];h=a['frameHeight'];cols=a['columns'];n=a['frameCount']-1
 reference=idle.crop((0,0,w,h)).tobytes()
 assert attack.crop((0,0,w,h)).tobytes()==reference
 assert attack.crop((n%cols*w,n//cols*h,n%cols*w+w,n//cols*h+h)).tobytes()==reference
`,JSON.stringify(records)],{cwd:root});
});

for(const form of ['blade-carapace','blade-secretion','secretion-carapace','blade-secretion-carapace']) {
 test(`pebble ${form}: all new roll boundaries and original key poses remain exact`,()=>{
  const key='pebble/'+form,clip=UNIT_ACTION_ART[key].actions.birth;
  assert.equal(UNIT_BIRTH_ART[key],undefined); assert.equal(clip.durationMs,2140);
  assert.equal(clip.frameCount,form==='blade-carapace'?13:14);
  const publication=JSON.parse(readFileSync(new URL(`AnimationCandidates/pebble-combo-birth-roll-v2-20261107/${form}/publication-manifest.json`,root)));
  for(const start of [0,100.125])for(const duration of [2.14,5])for(const facing of [-1,1]) {
   const agent={tribe:'pebble',attributes:Object.fromEntries(form.split('-').map(gene=>[gene,1])),health:10,facing,birth:{startedAt:start,readyAt:start+duration}};
   let ms=0;
   for(let frame=0;frame<clip.frameCount;frame++) {
    const at=start+ms/2140*duration; const pose=unitActionArtPose(agent,at);
    assert.equal(pose.animation,clip);assert.equal(pose.frame,frame);
    if(frame)assert.equal(unitActionArtPose(agent,at-1e-6).frame,frame-1);
    assert.equal(unitActionArtPose(agent,at+1e-6).frame,frame); ms+=clip.durationsMs[frame];
   }
   assert.equal(ms,2140);assert.equal(unitActionArtPose(agent,agent.birth.readyAt).action,'idle');
  }
  execFileSync('python',['-c',`import sys,json
from PIL import Image
p=json.loads(sys.argv[1]);a=p['actions']['birth'];new=Image.open(a['sheet']).convert('RGBA');old=Image.open(p['originalSourceSheet']).convert('RGBA');w=a['frameSize'];h=a['frameHeight'];cols=a['columns']
for pair in p['preservedOriginalFrames']:
 i,j=pair['candidateFrame'],pair['sourceFrame'];assert new.crop((i%cols*w,i//cols*h,i%cols*w+w,i//cols*h+h)).tobytes()==old.crop((j%4*w,j//4*h,j%4*w+w,j//4*h+h)).tobytes()
`,JSON.stringify(publication)],{cwd:root});
 });
}
