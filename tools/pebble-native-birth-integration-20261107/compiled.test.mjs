import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ATTRIBUTE_DNA} from '../../server/dna.mjs';
import {PEBBLE_PACKED_BIRTH_CATALOG as catalog} from '../../client/pebble-packed-birth-catalog.mjs';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const actor=form=>({id:form,tribe:'pebble',health:1,attributes:{[form]:1},dna:{version:5,level:4,budget:999999,pieces:ATTRIBUTE_DNA.pack([{gene:form,grade:ATTRIBUTE_DNA.lookup.get(form).grade,rotation:0}],4)},birth:{startedAt:0,readyAt:2.62,colonyId:1}});

test('compiled runtime prepares the four packed images once and draws all four avatar bodies without original atlas loads',async()=>{
 const scope={console,setTimeout,clearTimeout,URL,performance,structuredClone,atob};
 vm.runInNewContext(fs.readFileSync(path.join(root,'client/runtime.js'),'utf8'),scope);
 const requested=[],surfaces=[];
 const r=scope.Spawner.createPebbleBirthRuntime({source:p=>{requested.push(p);return path.join(root,p);},image:()=>new Image(),createCanvas:(w,h)=>{surfaces.push([w,h]);return createCanvas(w,h);}});
 const packet={roomId:'compiled',revision:1,world:{seed:13,size:320},state:{simSeconds:0}};
 const entry=await r.enter(packet);
 assert.equal(entry.stale,false);assert.ok(entry.outcome.forms.every(f=>f.status==='ready'));
 assert.deepEqual([...requested].sort(),Object.values(catalog).map(c=>c.path).sort());
 for(const form of Object.keys(catalog))for(const mirror of [false,true]){
  const canvas=createCanvas(1024,1024),ctx=canvas.getContext('2d');
  const result=r.draw(ctx,actor(form),.4,512,768,144,mirror,{surface:'avatar'});
  assert.equal(result.source,'restored');assert.equal(result.drawn,true);
  assert.ok(ctx.getImageData(0,0,1024,1024).data.some((v,i)=>i%4===3&&v>0),form+' / '+mirror);
 }
 assert.equal(r.adapter.stats.loads,4);assert.equal(r.adapter.stats.scratchAllocations,1);
 assert.deepEqual(surfaces,[[512,620]]);
 assert.equal(r.bridge.bank.reservedNests,0);
 await r.enter({...packet,revision:2,state:{simSeconds:.5}});assert.equal(requested.length,4);
 r.leave();assert.equal(r.active,false);
});

test('packed asset delivery wrappers and native image policy pin the same bytes',()=>{
 const policy=JSON.parse(fs.readFileSync(path.join(root,'DesignAssets/image-sizes.json'))),scope={};
 vm.runInNewContext(fs.readFileSync(path.join(root,'client/local-assets.js'),'utf8'),scope);
 for(const e of Object.values(catalog)){
  const bytes=fs.readFileSync(path.join(root,e.path)),p=policy.images[e.path];
  assert.equal(p.nativeSource.sha256,sha(bytes));assert.deepEqual(p.nativeSource.dimensions,e.atlasSize);
  const wrapper='./client/local-assets/'+e.path.replace(/^DesignAssets\//,'')+'.js';assert.ok(scope.SpawnerLocalAssetFiles.includes(wrapper));
  const text=fs.readFileSync(path.join(root,wrapper),'utf8'),match=text.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match);assert.equal(sha(Buffer.from(match[1],'base64')),sha(bytes));
 }
});
