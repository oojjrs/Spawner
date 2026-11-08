import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { createCanvas, Image, GlobalFonts } = require('@napi-rs/canvas');
const root = fileURLToPath(new URL('../', import.meta.url)), output = resolve(process.argv[2] || '/tmp/spawner-reflection-review');
mkdirSync(output, { recursive: true });
const selected = process.argv[3];
if (!selected) {
  const records = [];
  for (const key of ['left-motion','left-reduced','right-motion','right-reduced']) {
    execFileSync(process.execPath,[fileURLToPath(import.meta.url),output,key],{stdio:'inherit'});
    records.push(...JSON.parse(readFileSync(resolve(output,`canvas-report-${key}.json`),'utf8')));
  }
  writeFileSync(resolve(output,'canvas-report.json'),JSON.stringify(records,null,2)+'\n');
  console.log(`Actual stage Canvas QA: ${records.length} isolated cases passed. ${output}`);
  process.exit(0);
}
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc','Malgun Gothic');
globalThis.Image = Image;
globalThis.document = { createElement: () => createCanvas(1,1) };
globalThis.SpawnerAssets = { source: path => resolve(root,path), image: () => new Image() };
const { createCombatStage } = await import('../client/combat-stage.mjs');
const { createSimulationTrial } = await import('../client/combat-simulation.mjs');
const results = [], contact = createCanvas(1040,960), contactContext = contact.getContext('2d');
for (const reverse of [false,true]) for (const reduced of [false,true]) {
  if(selected !== `${reverse?'right':'left'}-${reduced?'reduced':'motion'}`)continue;
  globalThis.window = { matchMedia: () => ({matches:reduced}), devicePixelRatio:1 };
  const builds = [{key:'bean',organs:{attack:1},counts:{power:20,vitality:50}},{key:'spiny-back-beetle'}];
  if(reverse)builds.reverse();
  const trial = createSimulationTrial({left:builds[0],right:builds[1],random:false});
  let reflection;
  while(!reflection&&!trial.reason){trial.step();reflection=trial.vfx.events.find(event=>event.kind==='reflect');}
  assert.ok(reflection);
  const scene = { agents:structuredClone(trial.agents), history:[], projectiles:[], time:reflection.at-.1,
    vfx:{...trial.vfx,events:[]}, result:()=>({reason:null}) };
  const canvas = createCanvas(1040,480); canvas.clientWidth=1040;canvas.clientHeight=480;
  const context=canvas.getContext('2d'),stage=createCombatStage(canvas);
  await stage.prepare(scene);
  stage.render(scene,100,false);
  const paths=[],texts=[],fill=context.fillText.bind(context),quadratic=context.quadraticCurveTo.bind(context);
  context.fillText=(text,x,y)=>{texts.push({text,x,y});fill(text,x,y);};
  context.quadraticCurveTo=(...args)=>{paths.push(args);quadratic(...args);};
  scene.time=reflection.at+.06;scene.vfx.events=trial.vfx.events.filter(event=>event.at>=reflection.at-.001);
  scene.history=trial.history.filter(event=>event.time>=reflection.at-.001);
  stage.render(scene,160,true);
  assert.ok(paths.length); const label=texts.find(row=>row.text.startsWith('반사 피해'));assert.ok(label);
  const filename=`reflect-${reverse?'right':'left'}-${reduced?'reduced':'motion'}.png`;
  writeFileSync(resolve(output,filename),canvas.toBuffer('image/png'));
  if(!reduced)contactContext.drawImage(canvas,0,reverse?480:0);
  const phases=[];
  for(const [now,age] of [[190,.09],[280,.18],[370,.27],[460,.36]]){
    scene.time=reflection.at+age;stage.render(scene,now,true);
    writeFileSync(resolve(output,filename.replace('.png',`-${Math.round(age*1000)}.png`)),canvas.toBuffer('image/png'));
    phases.push(age);
  }
  for(let now=560;now<=1260;now+=100){scene.time=reflection.at+(now-100)/1000;stage.render(scene,now,true);}
  paths.length=0;texts.length=0;stage.render(scene,1360,true);
  assert.equal(paths.length,0);assert.equal(texts.some(row=>row.text.startsWith('반사 피해')),false);
  stage.clear();scene.time=reflection.at-.1;scene.vfx.events=[];scene.history=[];stage.render(scene,1460,false);
  assert.equal(paths.length,0);
  results.push({reverse,reduced,reflection:{amount:reflection.amount,sourceId:reflection.sourceId,targetId:reflection.targetId},label,phases,expiry:true,clear:true,filename});
}
writeFileSync(resolve(output,`contact-${selected}.png`),contact.toBuffer('image/png'));
writeFileSync(resolve(output,`canvas-report-${selected}.json`),JSON.stringify(results,null,2)+'\n');
console.log(`Actual stage Canvas QA: ${results.length} cases passed, five animation phases, expiry and clear. ${output}`);
