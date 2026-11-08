import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {UNIT_ACTION_ART as A} from '../../client/unit-action-art-assets.mjs';
const root=new URL('../../',import.meta.url),load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const baseline=load('runtime-before.json').UNIT_ACTION_ART,plan=load('plan.json'),changes=load('bean-spore-image-changes.json');
const rewrite=v=>typeof v==='string'?(changes.pathMap[v]||v):Array.isArray(v)?v.map(rewrite):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,rewrite(x)])):v;
function reflected(old){const next=structuredClone(old),w=old.frameSize??old.frameWidth;next.sourceFacing='left';if(Number.isFinite(old.pivotX))next.pivotX=w-old.pivotX;if(Number.isFinite(old.scene?.outletX))next.scene.outletX=w-old.scene.outletX;if(next.sceneLayers)for(const layer of next.sceneLayers.layers)for(const sample of layer.samples)if(sample)sample.destination[0]=w-sample.destination[0]-sample.destination[2];return rewrite(next)}
function compare(a,b,path){if(typeof b==='number'){assert.ok(Math.abs(a-b)<1e-8,path);return}if(!b||typeof b!=='object'){assert.equal(a,b,path);return}assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path+' fields');for(const k of Object.keys(b))compare(a[k],b[k],path+'/'+k)}
let clips=0,hashes=0,protectedOriginals=0;
for(const key of plan.candidateForms){const old=baseline[key],expected=rewrite({...old,reference:reflected(old.reference),actions:Object.fromEntries(Object.entries(old.actions).map(([k,c])=>[k,reflected(c)]))});compare(A[key],expected,key);clips+=1+Object.keys(old.actions).length}
for(const [path,c]of Object.entries(changes.changes)){const hash=createHash('sha256').update(readFileSync(new URL(c.newImage,root))).digest('hex');assert.equal(hash,c.afterSha256,path+' current pixels equal verified reflected output');hashes++;if(c.newImage!==path){assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),c.beforeSha256,path+' shared original preserved');protectedOriginals++}}
const result={forms:plan.candidateForms.length,exactMetadataClips:clips,verifiedCurrentSourceHashes:hashes,protectedOriginals};writeFileSync(new URL('bean-native-metadata.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
