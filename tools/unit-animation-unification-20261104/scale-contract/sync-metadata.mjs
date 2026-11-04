import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='H:/Spawner';
const records=[];
for(const file of ['client/runtime.js','Combat.html']){
 const path=root+'/'+file, before=fs.readFileSync(path,'utf8');
 let after=before;
 const names=['client/image-scales.mjs','client/unit-sprite-registration.mjs',...(file==='Combat.html'?['client/unit-image-bounds.mjs']:[])];
 for(const name of names){
  const marker='modules['+JSON.stringify(name)+'] = (() => {', start=after.indexOf(marker);
  assert.ok(start>=0,name);
  const end=after.indexOf('\r\n})();',start)+'\r\n})();'.length;
  assert.ok(end>start);
  const source=fs.readFileSync(root+'/'+name,'utf8');
  const exports=[...source.matchAll(/^export\s+(?:const|function|let|class)\s+(\w+)/gm)].map(m=>m[1]);
  const block=(marker+'\n'+source.replace(/^export\s+/gm,'')+'\nreturn { '+exports.join(', ')+' };\n})();').replace(/\r?\n/g,'\r\n');
  after=after.slice(0,start)+block+after.slice(end);
 }
 assert.equal(fs.readFileSync(path,'utf8'),before);
 fs.writeFileSync(path,after,'utf8');
 records.push({file,modules:names});
}
const entries=['restored-first-frame-bounds.json','restored-movement-bounds.json'].flatMap(name=>JSON.parse(fs.readFileSync(root+'/$Trash/unit-animation-unification-20261104/art-resolution/'+name)));
const list=fs.readFileSync(root+'/client/local-assets.js','utf8');
let count=0;
for(const entry of entries){
 const local='client/local-assets/'+entry.image.replace('DesignAssets/','')+'.js';
 if(!list.includes('./'+local))continue;
 const data=fs.readFileSync(root+'/'+entry.image).toString('base64');
 const mime=entry.image.endsWith('.png')?'image/png':'image/webp';
 fs.writeFileSync(root+'/'+local,'globalThis.SpawnerLocalAssetSources['+JSON.stringify(entry.image)+'] = '+JSON.stringify('data:'+mime+';base64,'+data)+';\r\n','utf8');
 count++;
}
fs.writeFileSync(root+'/$Trash/unit-animation-unification-20261104/scale-contract/sync-result.json',JSON.stringify({records,localAssets:count},null,2));
console.log(JSON.stringify({records,localAssets:count}));