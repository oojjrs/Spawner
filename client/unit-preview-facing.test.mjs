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
