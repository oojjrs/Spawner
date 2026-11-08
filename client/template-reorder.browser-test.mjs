// Run with: node client/template-reorder.browser-test.mjs
import assert from 'node:assert/strict';
import { readFile, mkdir, access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const gameSource = await readFile(resolve(root, 'client/game.js'), 'utf8');
const render = gameSource.match(/^    function renderUnitTemplates\([^]*?^    }/m)[0];
const html = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/client/game.css"><style>
body{margin:0;background:#12191b}.colony-menu{position:relative;inset:auto!important;margin:10px;width:360px!important;height:430px;max-height:90vh;padding:12px} @media(max-width:400px){.colony-menu{width:calc(100vw - 20px)!important}}
</style><section id="colony-menu" class="colony-menu"><h3>저장된 설계</h3><div id="template-list" class="template-list"></div></section><script type="module">
import {createTemplateReorder} from '/client/template-reorder.mjs';
const templateList=document.querySelector('#template-list'), colonyMenu=document.querySelector('#colony-menu');
const state={templates:Array.from({length:18},(_,i)=>({id:i+1,name:'설계 '+(i+1),slots:[],tribe:'bean'})),tribe:'bean'};
const connection={online:true,busy:false,active:true};
const events={birth:0,edit:0,remove:0,commands:0};
const Spawner={createTemplateReorder,dnaAppearance:()=>({})},attributeCounts=()=>({}),birthCost=()=>11;
const agentImageSource=()=>'/DesignAssets/UI/hp-heart.png',prepareAgentTemplate=async()=>{},nestStatus=document.createElement('span');
const createEvolutionCost=()=>{const span=document.createElement('span');span.className='evolution-cost';span.textContent='11P';return span};
const confirmTemplateDelete=async()=>{events.remove++;return false},openUnitDesign=()=>events.edit++;
const evolutionOpenButton=document.createElement('button');evolutionOpenButton.className='template-add';evolutionOpenButton.textContent='+';
let templateListSignature='';
const sendCommand=async action=>{if(action.type==='birth'){events.birth++;return {}} events.commands++; if(window.rejectSave)return null;state.templates=action.templateIds.map(id=>state.templates.find(t=>t.id===id));renderUnitTemplates();return {}};
const templateReorder=createTemplateReorder(templateList,{canReorder:()=>connection.online&&!connection.busy&&!state.ending,scrollContainer:colonyMenu,commit:templateIds=>sendCommand({type:'reorder-designs',templateIds})});
${render}
renderUnitTemplates();
window.qa={state,connection,events,templateReorder,renderUnitTemplates,ids:()=>[...document.querySelectorAll('[data-template-id]')].map(c=>+c.dataset.templateId)};
</script>`;
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}const path=resolve(root,'.'+req.url);if(!path.startsWith(root+'/'))throw Error('path');res.setHeader('Content-Type',extname(path)==='.css'?'text/css':['.js','.mjs'].includes(extname(path))?'text/javascript':'image/png');res.end(await readFile(path))}catch{res.statusCode=404;res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const executablePath=process.env.CHROMIUM_PATH || await access('/usr/bin/chromium').then(()=>'/usr/bin/chromium',()=>undefined);
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
const report=[];
try {
 const page=await browser.newPage({viewport:{width:900,height:700}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForFunction(()=>window.qa);
 const ids=()=>page.evaluate(()=>qa.ids());
 const bounds=id=>page.locator('[data-template-id="'+id+'"]').boundingBox();
 const handle=id=>page.locator('[data-template-id="'+id+'"] .template-reorder').boundingBox();
 let h=await handle(1),target=await bounds(6);await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width-8,target.y+35,{steps:12});await page.mouse.up();
 assert.deepEqual((await ids()).slice(0,6),[2,3,4,5,6,1]);
 assert.equal(await page.evaluate(()=>qa.events.birth),0);report.push('마우스 드래그와 줄바꿈 이동, 탄생 오작동 없음');
 await page.locator('[data-template-id="1"] .template-reorder').focus();await page.keyboard.press('Home');assert.equal((await ids())[0],1);
 await page.keyboard.press('ArrowRight');assert.equal((await ids())[1],1);report.push('키보드 Home·방향키 이동과 포커스 유지');
 h=await handle(1);const before=await ids();await page.mouse.move(h.x+10,h.y+10);await page.mouse.down();await page.mouse.move(800,600,{steps:10});await page.mouse.up();assert.deepEqual(await ids(),before);
 h=await handle(1);target=await bounds(6);await page.mouse.move(h.x+10,h.y+10);await page.mouse.down();await page.mouse.move(target.x+20,target.y+30,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await ids(),before);assert.equal(await page.locator('.template-drag-ghost').count(),0);report.push('영역 밖 놓기·Escape 취소 시 순서와 DOM 보존');
 await page.locator('[data-template-id="1"] .template-spawn').click();await page.locator('[data-template-id="1"] .template-edit').click();await page.locator('[data-template-id="1"] .template-delete').click();assert.deepEqual(await page.evaluate(()=>[qa.events.birth,qa.events.edit,qa.events.remove]),[1,1,1]);
 await page.evaluate(()=>{window.rejectSave=true});await page.locator('[data-template-id="1"] .template-reorder').focus();await page.keyboard.press('End');assert.deepEqual(await ids(),before);await page.evaluate(()=>{window.rejectSave=false});report.push('기존 생산·편집·삭제 클릭 유지, 저장 거절 시 순서 불변');
 h=await handle(2);const panel=await page.locator('#colony-menu').boundingBox();await page.mouse.move(h.x+10,h.y+10);await page.mouse.down();await page.mouse.move(panel.x+40,panel.y+panel.height-8,{steps:8});await page.waitForTimeout(400);assert.ok(await page.locator('#colony-menu').evaluate(el=>el.scrollTop)>0);await page.keyboard.press('Escape');await page.mouse.up();report.push('긴 목록 가장자리 자동 스크롤');
 await page.evaluate(()=>{qa.connection.busy=true;qa.renderUnitTemplates()});assert.ok(await page.locator('.template-reorder').first().isDisabled());await page.evaluate(()=>{qa.connection.busy=false;qa.state.ending={};qa.renderUnitTemplates()});assert.ok(await page.locator('.template-reorder').first().isDisabled());report.push('처리 중·종료 상태에서 재정렬 차단');
 await page.evaluate(()=>{qa.state.ending=null;qa.renderUnitTemplates();document.querySelector('#colony-menu').scrollTop=0});
 await mkdir(resolve(root,'tools/template-order-20261108'),{recursive:true});await page.screenshot({path:resolve(root,'tools/template-order-20261108/desktop.png')});
 const mobile=await browser.newContext({viewport:{width:375,height:700},isMobile:true,hasTouch:true,deviceScaleFactor:1});const touch=await mobile.newPage();touch.on('pageerror',e=>errors.push(e.message));await touch.goto(origin);await touch.waitForFunction(()=>window.qa);
 const cdp=await mobile.newCDPSession(touch), th=await touch.locator('[data-template-id="1"] .template-reorder').boundingBox(),tt=await touch.locator('[data-template-id="6"]').boundingBox();
 const dispatch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}]});
 await dispatch('touchStart',th.x+th.width/2,th.y+th.height/2);await dispatch('touchMove',tt.x+tt.width-8,tt.y+30);await dispatch('touchEnd');assert.deepEqual((await touch.evaluate(()=>qa.ids())).slice(0,6),[2,3,4,5,6,1]);assert.equal(await touch.evaluate(()=>qa.events.birth),0);
 const cancelHandle=await touch.locator('[data-template-id="2"] .template-reorder').boundingBox(),touchBefore=await touch.evaluate(()=>qa.ids());await dispatch('touchStart',cancelHandle.x+15,cancelHandle.y+12);await dispatch('touchMove',tt.x+tt.width-8,tt.y+30);await dispatch('touchCancel');assert.deepEqual(await touch.evaluate(()=>qa.ids()),touchBefore);assert.equal(await touch.locator('.template-drag-ghost').count(),0);report.push('모바일 실제 touchStart/Move/End 드래그·touchCancel 복원');
 await touch.screenshot({path:resolve(root,'tools/template-order-20261108/mobile.png')});
 const stored=await page.evaluate(async()=>{
   const {openStorage}=await import('/client/storage.mjs');const storage=await openStorage();
   const templates=[{id:1,name:'첫째',slots:[]},{id:2,name:'둘째',slots:[]},{id:3,name:'셋째',slots:[]}];
   const room={id:'test-order-room',title:'순서 테스트',version:2,hostId:'host',updatedAt:1,colonies:[{ownerId:'host',tribe:'bean',x:0,y:0}],world:{terrain:[]},games:[['host',JSON.stringify({state:{templates}})]]};
   await storage.put(room);const before=await storage.designs('bean');
   room.games=[['host',JSON.stringify({state:{templates:[templates[2],templates[0],templates[1]],templateOrderEdited:true}})]];room.updatedAt=2;await storage.put(room);
   const library=await storage.designs('bean');const saved=await storage.get(room.id);
   // A later autosave does not overwrite a newer manual library order.
   const other=structuredClone(room);other.id='other';other.designIds=Object.fromEntries(library.map(d=>[JSON.stringify(['host',templates.find(t=>t.name===d.template.name).id]),d.id]));other.games=[['host',JSON.stringify({state:{templates:[templates[1],templates[2],templates[0]],templateOrderEdited:true}})]];await storage.put(other);await storage.put(room);
   return {before:before.map(d=>d.template.name),library:library.map(d=>d.template.name),saved:JSON.parse(saved.games[0][1]).state.templates.map(t=>t.name),latest:(await storage.designs('bean')).map(d=>d.template.name)};
 });
 assert.deepEqual(stored.library,['셋째','첫째','둘째']);assert.deepEqual(stored.saved,stored.library);assert.deepEqual(stored.latest,['둘째','셋째','첫째']);
 await page.reload();await page.waitForFunction(()=>window.qa);const reloaded=await page.evaluate(async()=>{const storage=await(await import('/client/storage.mjs')).openStorage();return (await storage.designs('bean')).map(d=>d.template.name)});assert.deepEqual(reloaded,stored.latest);report.push('실제 IndexedDB 저장·새로고침·새 판 가져오기 순서, 옛 판 자동저장 순서 덮어쓰기 방지');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:report},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
