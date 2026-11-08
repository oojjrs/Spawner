import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unitActionArtPose, unitActionArtDefinition } from './unit-action-art.mjs';
const source=JSON.parse(readFileSync(new URL('../AnimationCandidates/pebble-carapace-antenna-birth-proportion-v2-20261107/publication-manifest.json',import.meta.url)));
const actor={tribe:'pebble',attributes:{carapace:1,antenna:1},health:10,birth:{startedAt:4,readyAt:6.14}};
test('pebble corrected birth preserves authored clock and enters its own idle',()=>{
 const definition=unitActionArtDefinition(actor),clip=definition.actions.birth;let elapsed=0;
 assert.deepEqual(clip.durationsMs,[330,250,200,130,130,200,250,650]);
 for(let frame=0;frame<8;frame++){
  const pose=unitActionArtPose(actor,4+elapsed/1000+.000001);
  assert.equal(pose.animation,clip);assert.equal(pose.frame,frame);assert.equal(pose.missing,false);elapsed+=clip.durationsMs[frame];
 }
 const idle=unitActionArtPose(actor,6.14);assert.equal(idle.action,'idle');assert.equal(idle.animation,definition.actions.idle);
 assert.equal(clip.pivotX,512-392.5);assert.equal(clip.sourceFacing,'left');assert.equal(clip.pivotY,439);assert.equal(clip.referenceLength,155);
});
test('first six whole scenes are pixel-identical and final body registration matches idle proportions',()=>{
 const idle=unitActionArtDefinition(actor).actions.idle;
 const result=JSON.parse(execFileSync('python3',['-c',`
import json,sys
from PIL import Image,ImageDraw
j,idle=json.load(sys.stdin);b=j['actions']['birth'];old=Image.open(j['sourceBirth']);new=Image.open(b['sheet']);w=512;c=4
same=[]
for f in range(6):
 box=(f%c*w,f//c*w,(f%c+1)*w,(f//c+1)*w);same.append(old.crop(box).tobytes()==new.crop(box).tobytes())
old.close();tile=new.crop((3*w,w,4*w,2*w));new.close();mask=Image.new('L',(w,w));ImageDraw.Draw(mask).polygon([tuple(p) for p in b['finalBodyMeasurementRegion']],fill=255)
a=tile.getchannel('A').point(lambda x:255 if x>=16 else 0)
from PIL import ImageChops
a=ImageChops.multiply(a,mask);box=a.getbbox()
with Image.open(idle['image']) as im:
 iw=idle['frameSize'];ref=im.crop((0,0,iw,iw)).getchannel('A').point(lambda x:255 if x>=16 else 0).getbbox()
print(json.dumps({'same':same,'body':box,'idle':ref}))
`],{cwd:new URL('../',import.meta.url),input:JSON.stringify([source,idle]),encoding:'utf8'}));
 assert.deepEqual(result.same,[true,true,true,true,true,true]);
 const ratio=box=>(box[3]-box[1])/(box[2]-box[0]);
 assert.ok(Math.abs(ratio(result.body)/ratio(result.idle)-1)<.015);
 assert.equal(result.body[3],source.actions.birth.pivotY);
 assert.equal(Math.max(result.body[2]-result.body[0],result.body[3]-result.body[1]),source.actions.birth.referenceLength);
});
