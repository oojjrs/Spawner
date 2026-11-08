import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const html=readFileSync(new URL('../Spawner.html',import.meta.url),'utf8');
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const css=readFileSync(new URL('./game.css',import.meta.url),'utf8');
const declaration=name=>source.match(new RegExp('^    function '+name+'\\([^]*?^    }','m'))[0];
const handler=source.match(/^    document.getElementById\("nest-codex"\).addEventListener[^\n]+/m)?.[0];

test('자기 둥지 정보창에 이름 있는 도감 버튼을 복구하고 다른 진입점도 유지한다',()=>{
 const panel=html.match(/<aside class="colony-menu"[^]*?<\/aside>/)[0];
 const button=panel.match(/<button[^>]*id="nest-codex"[^]*?<\/button>/)?.[0];
 assert.ok(button);assert.match(button,/type="button"/);assert.match(button,/aria-label="둥지 도감 열기"/);
 assert.match(button,/aria-haspopup="dialog"/);assert.match(button,/aria-controls="codex"/);assert.match(button,/<span>도감<\/span>/);
 assert.doesNotMatch(button,/\s(?:hidden|disabled)(?:\s|>|=)/);assert.equal((html.match(/id="nest-codex"/g)||[]).length,1);
 assert.match(html,/id="unit-codex"/);assert.match(panel,/id="nest-growth-info"/);
 assert.match(css,/\.nest-heading-actions\s*\{[^}]*flex-wrap:\s*wrap/);assert.match(css,/#colony-menu \.nest-codex\s*\{[^}]*min-height:\s*44px/);
});

test('둥지 도감 버튼은 선택 상태와 무관하게 둥지 항목을 연다',()=>{
 let click;const opened=[];assert.ok(handler);
 const scope=createContext({document:{getElementById(id){assert.equal(id,'nest-codex');return {addEventListener(event,callback){assert.equal(event,'click');click=callback;}};}},openCodex:id=>opened.push(id)});
 runInContext(handler,scope);click();click();assert.deepEqual(opened,['nest:colony','nest:colony']);
});

test('반복 열기와 닫기는 기존 모달 동작을 쓰고 둥지 버튼으로 포커스를 돌린다',()=>{
 let shows=0,closed=0,focused=0;const entries=[];
 const button={isConnected:true,focus(){focused++;}},codex={open:false,showModal(){this.open=true;shows++;},close(){this.open=false;closed++;}};
 const scope=createContext({codex,codexState:{returnFocus:null},codexSearch:{value:''},evolutionPanel:{hidden:true,inert:false},selectedAttribute:null,
 document:{activeElement:button,querySelectorAll:()=>[],body:{append(){}}},helpTooltip:{},hideHelpTooltip(){},updateUnitDesign(){},updateCodex(){},
 codexEntry:()=>({kind:'nest',key:'colony'}),navigateCodex:entry=>entries.push(entry)});
 runInContext(declaration('openCodex')+declaration('closeCodex'),scope);
 scope.openCodex('nest:colony');scope.openCodex('nest:colony');assert.equal(shows,1);assert.equal(scope.codexState.returnFocus,button);
 scope.closeCodex(true);assert.equal(focused,1);assert.equal(closed,1);assert.equal(codex.open,false);
 scope.openCodex('nest:colony');scope.closeCodex(true);assert.equal(shows,2);assert.equal(focused,2);assert.equal(scope.evolutionPanel.inert,false);
 assert.deepEqual(entries,['nest:colony','nest:colony','nest:colony']);
});
