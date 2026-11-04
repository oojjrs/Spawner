// Narrow playback checks; no browser, art registration or approval changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('client/bean-rig-preview.js','utf8');
const functions=code.slice(code.indexOf('  function duration()'),code.indexOf('  function clearSelected()'));
const context=vm.createContext({console});
vm.runInContext(`
let now=0, age=0, start=0, speed=1, paused=false, lastFrame=0;
const document={hidden:false}, performance={now:()=>now};
const elements={action:{value:'idle'},pause:{textContent:''}};
const $=id=>elements[id];
const selected={entry:{draftActions:{idle:{durationMs:3600},hurt:{durationMs:760}}}};
${functions}
globalThis.read=()=>({age,start,paused,label:elements.pause.textContent});
globalThis.run=(body)=>eval(body);
`,context);
const run=body=>context.run(body), read=()=>context.read();
run('advance(1000)');assert.equal(read().age,1000);
run('speed=.25;advance(2000)');assert.equal(read().age,1250);
run('seek(1800);advance(3000)');assert.equal(read().age,1800);assert.equal(read().paused,true);
run('seek(9999)');assert.equal(read().age,3600);
run('seek(-100)');assert.equal(read().age,0);
run('seek(3600);now=3000;setPaused(false);advance(4000)');assert.equal(read().age,250);
run("elements.action.value='hurt';reset();now=5000;setPaused(false);speed=1;advance(6000)");assert.equal(read().age,760);
run('advance(7000)');assert.equal(read().age,760);
run('seek(400);seek(age-1000/30)');assert.ok(Math.abs(read().age-366.6666666667)<1e-8);
run('document.hidden=true;paused=false;advance(90000)');assert.ok(read().age<400);
run("document.hidden=false;elements.action.value='neutral';advance(91000)");assert.equal(read().age,0);
const html=fs.readFileSync('BeanRigPreview.html','utf8');
for(const id of ['seek','phase','previous-frame','next-frame','speed'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
assert.match(html,/30fps/);
console.log('PASS: speed, pause, seek endpoints, idle wrap, hurt completion, step, hidden-tab freeze, neutral, control wiring.');
