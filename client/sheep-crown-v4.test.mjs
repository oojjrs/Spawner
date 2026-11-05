import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { CREATURE_ATTACK_ANIMATIONS, UNIT_ANIMATION_ASSETS, creatureAttackPose } from './unit-animation.mjs';
import { UNIT_SPRITE_REGISTRATION } from './unit-sprite-registration.mjs';
import { CREATURE_ATTACK_TIMINGS } from '../server/creature-attack.mjs';
import { auditImages, imageDimensions } from './image-audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const home='DesignAssets/Animations/CreatureAttackV2/cotton-sheep', source=home+'/Source/ApprovedCrownV4', asset=home+'/runtime.webp';
const read=p=>fs.readFileSync(root+p), json=p=>JSON.parse(read(p)), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const approval=json(source+'/approval.json'), animation=CREATURE_ATTACK_ANIMATIONS['cotton-sheep'];
function rgba(p){const r=spawnSync('python',['-c',"from PIL import Image; import sys; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').tobytes())",root+p],{maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr?.toString());return r.stdout;}
const raw=rgba(asset), approved=rgba(source+'/runtime.png'), previous=rgba(source+'/previous-runtime.webp');

test('sheep V4 production pixels are the approved lossless atlas, not a rejected candidate',()=>{
  assert.equal(approval.status,'user-approved');assert.equal(approval.artworkRevision,4);assert.equal(approval.userApprovalQuote,'솜양 공격 통과.');
  assert.equal(hash(read(source+'/runtime.png')),approval.sourceRuntimePngSha256);
  assert.equal(hash(read(source+'/source-cels.png')),approval.sourceCelsPngSha256);
  assert.equal(hash(read(asset)),approval.runtimeWebpSha256);
  assert.equal(hash(raw),approval.runtimeRawRgbaSha256);assert.deepEqual(raw,approved);
  assert.equal(approval.approvedReviewVideoSha256,'741e0d290aa4314440cc942538bc9fb00e8b194a75b9d4d7375297e33e2d20d9');
});

test('sheep V4 keeps every rear-hoof alpha pixel and opaque foot pixel',()=>{
  let checked=0;
  for(let f=0;f<8;f++)for(let y=225;y<290;y++)for(let x=190;x<290;x++){
    const k=(((f>>2)*290+y)*1160+(f%4)*290+x)*4;
    assert.equal(raw[k+3],previous[k+3],`cel ${f+1} foot alpha ${x},${y}`);
    if(raw[k+3]===255)assert.deepEqual(raw.subarray(k,k+4),previous.subarray(k,k+4));
    checked++;
  }
  assert.equal(checked,52000);
});

test('sheep V4 retains unchanged cels and all alpha silhouettes outside edited head/neck cels',()=>{
  for(const f of [0,1,2,7])for(let y=0;y<290;y++)for(let x=0;x<290;x++){
    const k=(((f>>2)*290+y)*1160+(f%4)*290+x)*4;
    assert.equal(raw[k+3],previous[k+3]);
    if(raw[k+3]===255)assert.deepEqual(raw.subarray(k,k+4),previous.subarray(k,k+4));
  }
  assert.deepEqual(approval.editedCels,[4,5,6,7]);
});

test('world detail and lab share the same existing registered sheep path and unchanged hit clock',()=>{
  assert.equal(animation.image,asset);assert.ok(UNIT_ANIMATION_ASSETS.includes(asset));
  assert.deepEqual(animation.durationsMs,[100,110,120,40,240,90,140,190]);assert.equal(animation.durationMs,1030);
  assert.equal(CREATURE_ATTACK_TIMINGS['cotton-sheep'].hitTimeMs,370);
  assert.deepEqual(UNIT_SPRITE_REGISTRATION[asset],approval.registration);assert.equal(animation.fixedSupport,true);
  for(const directionX of [-1,1]){let ms=0;for(let f=0;f<8;f++){const pose=creatureAttackPose({species:'cotton-sheep',health:10,attack:{startedAt:1,directionX}},1+ms/1000);assert.equal(pose.frame,f);assert.equal(pose.mirrorX,directionX>0);ms+=animation.durationsMs[f];}}
});

test('both online and embedded loading return the same approved runtime bytes',()=>{
  const context={SpawnerLocalAssetSources:{}};runInNewContext(read('client/local-assets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp.js').toString(),context);
  const embedded=context.SpawnerLocalAssetSources[asset];assert.ok(embedded.startsWith('data:image/webp;base64,'));
  assert.deepEqual(Buffer.from(embedded.split(',')[1],'base64'),read(asset));
  assert.ok(read('client/local-assets.js').toString().includes('./client/local-assets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp.js'));
});

test('sheep V4 source metadata and image audit preserve the production camera',()=>{
  const metadata=json(home+'/runtime.json');assert.equal(metadata.artworkRevision,4);assert.equal(metadata.source,'Source/ApprovedCrownV4/runtime.png');assert.equal(metadata.exporter,'export-approved-crown.py');
  assert.deepEqual(metadata.durationsMs,animation.durationsMs);assert.equal(json(home+'/attack.json').runtimeArtwork.revision,4);
  assert.deepEqual(imageDimensions(root+asset),[1160,580]);assert.deepEqual(imageDimensions(root+source+'/source-cels.png'),[2048,1024]);
  auditImages(root,[asset]);
});

test('the bulk V2 exporter preserves the approved sheep override instead of restoring legacy art',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheep-approved-export-'));
  try {
    const files=[home+'/Source/runtime-registration.json',home+'/runtime.json',home+'/export-approved-crown.py',source+'/runtime.png',source+'/approval.json','DesignAssets/Animations/CreatureAttackV2/export-runtime.py','client/local-assets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp.js'];
    for(const file of files){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.copyFileSync(root+file,path.join(temp,file));}
    fs.writeFileSync(path.join(temp,home,'attack.webp'),'LEGACY INPUT MUST NOT BE READ');
    const metadataBefore=fs.readFileSync(path.join(temp,home,'runtime.json'));
    const r=spawnSync('python',[path.join(temp,'DesignAssets/Animations/CreatureAttackV2/export-runtime.py')],{encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/approved runtime override/);
    assert.deepEqual(fs.readFileSync(path.join(temp,asset)),read(asset));
    assert.deepEqual(fs.readFileSync(path.join(temp,home,'runtime.json')),metadataBefore);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
