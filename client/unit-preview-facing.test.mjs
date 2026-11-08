import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('./unit-matrix-preview.js',import.meta.url),'utf8');
const dataCode=fs.readFileSync(new URL('./unit-preview-facing-data.js',import.meta.url),'utf8');
const context={};vm.runInNewContext(dataCode,context);
context.aliases={'sprout-bean':'bean','spore-tribe':'spore','pebble-tribe':'pebble','spring-tribe':'spring'};
vm.runInNewContext(code.slice(code.indexOf('  const previewFacingData'),code.indexOf('  let scheduled')),context);
const {previewSourceFacing,setPreviewFacing}=context.SpawnerUnitPreviewDirection;
function linkFor(key,action,variant){
 const [tribe,form]=key.split('/'),img={style:{}},row={id:'unit-'+tribe+(form==='base'?'':'-'+form),dataset:{},closest:()=>({dataset:{appearanceGene:form}}),querySelector:()=>null};
 const link={dataset:{action},closest(selector){if(selector==='tr')return row;if(selector==='a')return this;if(selector==='[data-combat-clip]')return variant?{dataset:{variant}}:null;return null},querySelector:()=>img};return {link,img};
}
test('all current form and action previews face left without relabeling native art',()=>{
 const data=context.SpawnerUnitPreviewFacing;let count=0;
 for(const[key,actions]of Object.entries(data.forms))for(const[action,facing]of Object.entries(actions)){
  const {link,img}=linkFor(key,action);assert.equal(previewSourceFacing(link,{tribe:true},null,action),facing,key+'/'+action);
  assert.equal(setPreviewFacing(link,{tribe:true},null,action),facing==='right');
  assert.equal(link.dataset.mirror,String(facing==='right'));assert.equal(img.style.transform,facing==='right'?'scaleX(-1)':'');count++;
 }
 assert.ok(count>=500);
});
test('native animation metadata takes priority over same-form catalog defaults',()=>{
 const {link}=linkFor('spore/carapace','attack');assert.equal(previewSourceFacing(link,{tribe:true},{sourceFacing:'left'},'attack'),'left');
 const legacy=linkFor('spore/carapace','attack','carapace').link;assert.equal(previewSourceFacing(legacy,{tribe:true},{image:'old/left-source.webp'},'attack'),'left');
});
test('neutral left sources remain left and right sources mirror exactly once',()=>{
 const {link,img}=linkFor('unknown/base','attack');
 assert.equal(setPreviewFacing(link,{tribe:false},{facing:'left'},'attack'),false);assert.equal(img.style.transform,'');
 assert.equal(setPreviewFacing(link,{tribe:false},{facing:'right'},'attack'),true);assert.equal(img.style.transform,'scaleX(-1)');
});
test('planning projectile remains in the same mirrored canvas coordinate system',()=>{
 const body=code.slice(code.indexOf('  function draw(panel'),code.indexOf('  function tick(now)'));
 assert.ok(body.indexOf('if (panel.mirror)')<body.indexOf('context.drawImage(sprite'));
 assert.ok(body.indexOf('context.drawImage(sprite')<body.indexOf('drawProjectile(context'));
});
test('whole scene preview mirrors environment and body together without modifying the source',()=>{
 const body=code.slice(code.indexOf('    function drawScene('),code.indexOf('    function tickScenes('));
 assert.ok(body.indexOf('if (scene.mirror)')<body.indexOf('clip.sceneLayers.layers.forEach'));
 assert.match(body,/context\.translate\(sceneWidth, 0\); context\.scale\(-1, 1\)/);
 assert.match(code,/clip: source.clip, mirror: source.mirror/);
});
test('standalone preview and cargo travel use left as their display direction',()=>{
 assert.match(fs.readFileSync(new URL('./unit-appearance-preview.js',import.meta.url),'utf8'),/width\*\.9,true,devicePixelRatio/);
 assert.match(fs.readFileSync(new URL('./unit-work-previews.js',import.meta.url),'utf8'),/context\.translate\(96, 0\); context\.scale\(-1, 1\)/);
});

test('animated preview links without atlas geometry stay native in the lightbox',()=>{
 const html=fs.readFileSync(new URL('../DesignAssets/codex-units.html',import.meta.url),'utf8');
 assert.ok(html.includes('if(!element.dataset.durations||(!element.dataset.columns&&!element.dataset.nativeAnimation&&!element.dataset.runtimeGeometry))return;'));
});

test('all 44 combination planning rows resolve work previews using their declared source action',()=>{
 let html='';vm.runInNewContext(fs.readFileSync(new URL('../DesignAssets/sections/unit-appearance.js',import.meta.url),'utf8'),{document:{write:value=>html+=value}});
 const forms=['blade-carapace','secretion-carapace','blade-secretion','blade-secretion-carapace','blade-antenna','secretion-antenna','carapace-antenna','blade-secretion-antenna','blade-carapace-antenna','secretion-carapace-antenna','blade-secretion-carapace-antenna'];
 let cells=0,workCells=0,formerlyFallback=0;
 for(const tribe of ['bean','spore','pebble','spring'])for(const form of forms){
  const row=html.match(new RegExp('<tr id="unit-'+tribe+'-'+form+'">([\\s\\S]*?)</tr>'))?.[1];assert.ok(row,tribe+'/'+form);
  for(const cell of row.matchAll(/<td data-action="([^"]+)"[^>]*>([\s\S]*?)<\/td>/g)){
   const anchor=cell[2].match(/<a\b([^>]*)>/)?.[1];if(!anchor)continue;
   const action=anchor.match(/data-action="([^"]+)"/)?.[1]||cell[1];
   const source=cell[2].match(/data-work-source="([^"]+)"/)?.[1];
   const {link,img}=linkFor(tribe+'/'+form,action);const closest=link.closest.bind(link);
   link.closest=selector=>selector==='figure[data-work-source]'?(source?{dataset:{workSource:source}}:null):closest(selector);
   const sourceAction=source||action,normalized=sourceAction==='ranged-attack'?'ranged':sourceAction;
   const expected=context.SpawnerUnitPreviewFacing.forms[tribe+'/'+form][normalized];assert.ok(expected,tribe+'/'+form+'/'+normalized);
   assert.equal(previewSourceFacing(link,undefined,undefined,action),expected);
   assert.equal(setPreviewFacing(link,undefined,undefined,action),expected!=='left');
   assert.equal(img.style.transform,expected==='left'?'':'scaleX(-1)');cells++;
   if(source){workCells++;if(!context.SpawnerUnitPreviewFacing.forms[tribe+'/'+form][action==='ranged-attack'?'ranged':action])formerlyFallback++;}
  }
 }
 assert.equal(cells,456);assert.equal(workCells,132);assert.equal(formerlyFallback,36);
});

test('defensive antenna planning aliases open the registered left-facing sheet and pebble birth preview exists',()=>{
 let html='';vm.runInNewContext(fs.readFileSync(new URL('../DesignAssets/sections/unit-appearance.js',import.meta.url),'utf8'),{document:{write:value=>html+=value}});
 for(const tribe of ['bean','spore']){
  const row=html.match(new RegExp('<tr id="unit-'+tribe+'-carapace-antenna">([\\s\\S]*?)</tr>'))[1];
  const registered='DesignAssets/Animations/DefensiveAttackV1/'+tribe+'/carapace-antenna/attack.png';
  for(const action of ['attack','harvest','throw']){
   const cell=row.match(new RegExp('<td data-action="'+action+'"[^>]*>([\\s\\S]*?)</td>'))[1];
   assert.ok(cell.includes('href="'+registered+'"'),tribe+'/'+action);
  }
 }
 const row=html.match(/<tr id="unit-pebble-blade-carapace">([\s\S]*?)<\/tr>/)[1];
 const birth=row.match(/<td data-action="birth"[^>]*>([\s\S]*?)<\/td>/)[1];
 const preview=birth.match(/data-preview="([^"]+)"/)[1];
 assert.equal(preview,'AnimationCandidates/pebble-combo-birth-roll-v2-20261107/blade-carapace/birth-preview.webp');
 assert.ok(fs.existsSync(new URL('../'+preview,import.meta.url)));
});
