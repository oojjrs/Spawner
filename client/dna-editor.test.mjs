import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { createDnaEditor, dnaEditorViewport, dnaDesignStats, renderDnaDesignStats, renderDnaComposition } from "./dna-editor.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { birthCost } from "../server/attributes.mjs";

function fixture(t, dimensions, model) {
  if(!dimensions)dimensions={width:0,height:0};
  if(!model)model=ATTRIBUTE_DNA;
  const draws=[],pending=[];
  const drawing={setTransform(){},clearRect(){draws.length=0;},save(){},restore(){},translate(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},fill(){},arc(x,y,radius){draws.push({kind:'arc',x,y,radius});},stroke(){draws.push({kind:'stroke',color:this.strokeStyle});}};
  class Element {
    constructor(){this.children=[];this.classList={add(){}};this.dataset={};this.style={setProperty(){}};this.attributes={};this.selectors=new Map();this.listeners=new Map();}
    setPointerCapture(){}
    setAttribute(name,value){this.attributes[name]=value;}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items.flatMap(item=>item.fragment?item.children:[item]);}
    querySelector(selector){if(!this.selectors.has(selector))this.selectors.set(selector,new Element());return this.selectors.get(selector);}
    getContext(){return drawing;}
    getBoundingClientRect(){return {left:0,top:0,...dimensions};}
    addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(handler);}
    removeEventListener(type,handler){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==handler));}
    dispatch(type,values){const event={target:this,preventDefault(){},stopPropagation(){},...values};for(const handler of this.listeners.get(type)||[])handler(event);}
    focus(){}
    remove(){}
  }
  const globals={document:{createElement:()=>new Element(),createElementNS:()=>new Element(),createDocumentFragment(){const element=new Element();element.fragment=true;return element;}},
    devicePixelRatio:1,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:callback=>{pending.push(callback);return pending.length;},cancelAnimationFrame:()=>{}};
  for(const [key,value]of Object.entries(globals)){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});
  }
  const container=new Element(),changes=[];
  const editor=createDnaEditor(container,model,value=>changes.push(value));
  return {editor,changes,root:container.children[0],draws,element:()=>new Element(),draw(){for(const callback of pending.splice(0))callback();}};
}

function selectGene(root,id){const item=root.querySelector('.dna-list').children.find(value=>value.dataset.gene===id);assert.ok(item,id);item.onclick();}
function piece(gene,rotation){const entry=ATTRIBUTE_DNA.lookup.get(gene);return {gene,rotation,grade:entry.grade,q:0,r:0};}
function design(pieces){return {version:6,pieces,level:1,budget:0};}
function place(root){root.querySelector('.dna-add').onclick();}

test("현재 둥지 레벨과 예산은 불러온 설계로 우회하지 않는다",t=>{
  const {editor,root}=fixture(t);editor.context(1,0,false);editor.load({version:6,pieces:[],level:4,budget:1000},false);
  assert.equal(editor.getDesign().level,1);assert.equal(editor.getDesign().budget,0);
  assert.deepEqual(root.querySelector('.dna-list').children.map(i=>i.dataset.gene),ATTRIBUTE_DNA.catalog.filter(g=>g.grade<=1).map(g=>g.id));
  editor.context(4,250,false);assert.equal(root.querySelector('.dna-list').children.length,40);assert.equal(editor.getDesign().budget,250);
});

test("조각을 떨어진 칸에 놓고 회전·삭제·undo·redo가 독립 좌표를 보존한다",t=>{
  const {editor,root}=fixture(t);selectGene(root,'vision');place(root);root.dispatch('keydown',{key:'ArrowDown'});root.dispatch('keydown',{key:'ArrowLeft'});place(root);
  assert.deepEqual(editor.getDesign().pieces.map(p=>[p.q,p.r]),[[0,0],[-1,1]]);root.dispatch('keydown',{key:'q'});assert.equal(editor.getDesign().pieces[1].rotation,0);
  root.dispatch('keydown',{key:'Delete'});assert.equal(editor.getDesign().pieces.length,1);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,2);root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,1);
  editor.context(2,100,false);assert.equal(editor.getDesign().pieces[0].q,0);root.dispatch('keydown',{key:'Backspace'});assert.equal(editor.getDesign().pieces.length,2);
});

test("겹치는 칸이나 판 밖은 배치하지 않고 새로 놓은 조각은 redo를 지운다",t=>{
  const {editor,root}=fixture(t);selectGene(root,'vision');place(root);place(root);assert.equal(editor.getDesign().pieces.length,1);
  for(let i=0;i<4;i++)root.dispatch('keydown',{key:'ArrowUp'});place(root);assert.equal(editor.getDesign().pieces.length,1);
  root.dispatch('keydown',{key:'ArrowDown'});place(root);assert.equal(editor.getDesign().pieces.length,2);root.dispatch('keydown',{key:'z',ctrlKey:true});root.dispatch('keydown',{key:'ArrowDown'});place(root);root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,2);assert.equal(editor.getDesign().pieces[1].r,-2);
});

test("배치된 중간 조각의 어느 칸을 클릭해도 해당 조각만 삭제하고 undo로 복구한다",t=>{
  const dimensions={width:800,height:600},{editor,root,changes}=fixture(t,dimensions),canvas=root.querySelector('canvas'),v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600);
  const pieces=ATTRIBUTE_DNA.pack(['capacity','gather','health'].map(id=>piece(id,0)),1),value=design(pieces);editor.load(value,false);
  const cell=ATTRIBUTE_DNA.pieceCells(pieces[1])[1],point={button:0,pointerId:1,clientX:v.x+34*Math.sqrt(3)*(cell.q+cell.r/2)*v.scale,clientY:v.y+51*cell.r*v.scale};
  canvas.dispatch('pointerdown',point);canvas.dispatch('pointerup',point);assert.deepEqual(editor.getDesign().pieces,[pieces[0],pieces[2]]);assert.equal(changes.length,1);assert.equal(root.dataset.filled,'8');
  assert.equal(root.querySelector('.dna-list').children.find(i=>i.dataset.gene==='gather').attributes['aria-disabled'],'false');root.dispatch('keydown',{key:'z',ctrlKey:true});assert.deepEqual(editor.getDesign(),value);
  root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign().pieces,[pieces[0],pieces[2]]);
  editor.load(value,true);canvas.dispatch('pointerdown',point);canvas.dispatch('pointerup',point);assert.deepEqual(editor.getDesign(),value);
});

test("드래그는 조각을 이동하고 취소·우클릭은 배치된 조각을 지우지 않는다",t=>{
  const dimensions={width:800,height:600},{editor,root}=fixture(t,dimensions),canvas=root.querySelector('canvas'),v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600);editor.load(design([piece('vision',0)]),false);
  function point(q,r){return {button:0,pointerId:1,clientX:v.x+34*Math.sqrt(3)*(q+r/2)*v.scale,clientY:v.y+51*r*v.scale};}
  canvas.dispatch('pointerdown',point(0,0));canvas.dispatch('pointermove',point(-2,0));canvas.dispatch('pointercancel',{});assert.equal(editor.getDesign().pieces[0].q,0);
  canvas.dispatch('pointerdown',point(0,0));canvas.dispatch('pointermove',point(-.5,0));canvas.dispatch('pointerup',point(-.5,0));assert.equal(editor.getDesign().pieces[0].q,-2);assert.equal(editor.getDesign().pieces.length,1);
  const moved=editor.getDesign();root.dispatch('contextmenu',{});canvas.dispatch('pointerdown',{...point(-2,0),button:2});canvas.dispatch('pointerup',{...point(-2,0),button:2});assert.deepEqual(editor.getDesign(),moved);
  root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces[0].q,0);
});

test("읽기전용과 텍스트 입력은 편집을 막고 부분 저장 API는 없다",t=>{
  const {editor,root}=fixture(t),value=design([piece('capacity',0)]);editor.load(value,true);
  for(const key of ['Enter','Delete','Backspace','q','e','ArrowLeft'])root.dispatch('keydown',{key});place(root);assert.deepEqual(editor.getDesign(),value);
  editor.load(value,false);for(const tagName of ['INPUT','TEXTAREA','SELECT'])root.dispatch('keydown',{key:'Delete',target:{tagName}});assert.deepEqual(editor.getDesign(),value);
  assert.equal(editor.partSave,undefined);assert.equal(editor.selectPart,undefined);assert.equal(editor.startPartSelection,undefined);
});

test("기관을 한 번만 놓고 초기화·되돌리기가 조각과 범례를 함께 갱신한다",t=>{
  const {editor,root}=fixture(t);selectGene(root,'gather');place(root);assert.equal(root.querySelector('.dna-list').children.find(i=>i.dataset.gene==='gather').attributes['aria-disabled'],'true');
  root.querySelector('.dna-tools').children[3].onclick();assert.equal(editor.getDesign().pieces.length,0);assert.equal(root.querySelector('.dna-legend').children.length,0);
  root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,1);assert.equal(root.querySelector('.dna-legend').children.length,1);
});

test("저장한 설계의 좌표와 현재 설계 내부 이력만 복구한다",t=>{
  const {editor,root}=fixture(t),pieces=[piece('capacity',0),{...piece('health',0),q:-2,r:1}];editor.load(design(pieces),false);
  root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,1);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'y',ctrlKey:true});root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign().pieces,pieces);
  editor.load(design([]),false);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,0);
});

test("공통 가격과 실제 탄생비는 제작기 비용과 같다",t=>{
  const {editor,root}=fixture(t);assert.equal(root.querySelector('.dna-cost strong').textContent,'3');selectGene(root,'gather');place(root);const dna=editor.getDesign();
  for(const tribe of ['bean','spore','pebble','spring'])assert.equal(birthCost({dna},tribe),11);assert.equal(root.querySelector('.dna-cost strong').textContent,'11');
  for(const id of ['capacity','harvestSpeed','health','movement'])assert.equal(root.querySelector('.dna-list').children.find(item=>item.dataset.gene===id).children.find(child=>child.className==='dna-gene-cost').textContent,'5');
  for(const [count,cost] of [[1,16],[2,21],[3,26],[7,46]]){
    const pieces=ATTRIBUTE_DNA.pack([piece('gather',0),...Array.from({length:7},()=>piece('capacity',0)),piece('movement',0)],1).slice(0,count+1);assert.equal(ATTRIBUTE_DNA.trace(pieces,1).valid,true);editor.load(design(pieces),false);
    assert.equal(root.querySelector('.dna-cost strong').textContent,String(cost));for(const tribe of ['bean','spore','pebble','spring'])assert.equal(birthCost({dna:editor.getDesign()},tribe),cost);
  }
});

test("공통 스탯 표시는 기본0 숨김과 합산·괄호 증감·색상을 양쪽에 동일하게 제공한다",t=>{
  const {element}=fixture(t),pieces=[piece('gather',0),piece('health',3)],values=dnaDesignStats(ATTRIBUTE_DNA,pieces);
  assert.deepEqual(values.stats,ATTRIBUTE_DNA.stats(pieces));assert.equal(values.base.harvestTime,4);
  const game=element(),tool=element();renderDnaDesignStats(game,values.stats,values.base,true);renderDnaDesignStats(tool,values.stats,values.base,false);
  const rows=container=>container.children.map(item=>({stat:item.dataset.stat,text:item.textContent,classes:item.className,children:item.children.map(child=>({text:child.textContent,classes:child.className}))}));
  assert.deepEqual(rows(game).filter(row=>row.stat!=='scale'),rows(tool));
  assert.ok(game.children.some(item=>item.dataset.stat==='scale'));assert.equal(tool.children.some(item=>item.dataset.stat==='scale'),false);
  assert.equal(tool.children.some(item=>item.dataset.stat==='rangedPower'),false);
  const health=tool.children.filter(item=>item.dataset.stat==='health');assert.equal(health[0].className,'design-stat-changed');
  assert.equal(health[1].children[0].className,'design-stat-value design-stat-changed');assert.equal(health[1].children[1].textContent,' (+20)');
});

function sharedModuleSource(name){
  return readFileSync(new URL('../'+name,import.meta.url),'utf8')
    .replace(/^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?\r?$/gm,(_,names,path)=>'const {'+names.replace(/\s+as\s+/g,': ')+'} = modules['+JSON.stringify(posix.normalize(posix.join(posix.dirname(name),path)))+'];')
    .replace(/^export\s+/gm,'').replaceAll('\r\n','\n').trimEnd();
}
function bundledModule(source,name){
  const escaped=JSON.stringify(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=source.match(new RegExp('modules\\['+escaped+'\\] = \\(\\(\\) => \\{\\r?\\n([\\s\\S]*?)\\r?\\nreturn \\{ [^}]+ \\};\\r?\\n\\}\\)\\(\\);'));
  assert.ok(match,name);return match[1].replaceAll('\r\n','\n').trimEnd();
}

test("제작기·인게임·게임워커·판단워커는 동일한 새 DNA 모듈을 사용한다",()=>{
  const runtime=readFileSync(new URL('./runtime.js',import.meta.url),'utf8'),tool=readFileSync(new URL('../Attribute.html',import.meta.url),'utf8');
  const worker=JSON.parse(runtime.match(/const workerSource = ("(?:\\.|[^"\\])*");/)[1]),decision=JSON.parse(worker.match(/globalThis\.SpawnerDecisionWorkerSource = ("(?:\\.|[^"\\])*");/)[1]);
  for(const source of [runtime,tool,worker,decision])for(const name of ['server/dna-board.mjs','server/dna.mjs'])assert.equal(bundledModule(source,name),sharedModuleSource(name));
  for(const source of [runtime,tool]){assert.equal(bundledModule(source,'client/dna-editor.mjs'),sharedModuleSource('client/dna-editor.mjs'));assert.equal(source.includes('modules["client/dna-part-library.mjs"] ='),false);}
  assert.equal(bundledModule(worker,'server/tribe-start.mjs'),sharedModuleSource('server/tribe-start.mjs'));
});

test("이미 배치한 모든 기관은 hover·키보드·클릭으로 중복 경고를 표시한다",t=>{
  const {editor,root}=fixture(t),status=root.querySelector('.dna-status');editor.context(4,1000,false);
  for(const gene of ATTRIBUTE_DNA.catalog.filter(g=>g.category==='organ')){
    editor.load({version:6,pieces:ATTRIBUTE_DNA.pack([piece(gene.id,0)],4),level:4,budget:1000},false);
    const item=root.querySelector('.dna-list').children.find(i=>i.dataset.gene===gene.id),before=editor.getDesign();
    assert.equal(item.attributes['aria-disabled'],'true');item.dispatch('pointerenter',{});assert.equal(status.hidden,false);assert.equal(status.dataset.kind,'organ-limit');assert.match(status.textContent,/하나만 배치할 수 있습니다/);
    item.dispatch('pointerleave',{});assert.equal(status.hidden,true);item.dispatch('focus',{});assert.equal(status.hidden,false);item.dispatch('blur',{});assert.equal(status.hidden,true);
    item.onclick();assert.equal(status.hidden,false);assert.deepEqual(editor.getDesign(),before);
    editor.load(before,true);root.querySelector('.dna-list').children.find(i=>i.dataset.gene===gene.id).dispatch('pointerenter',{});assert.equal(status.hidden,true);
  }
});

test("기관 배치·삭제·undo 뒤 경고를 갱신하며 기존 기관 이동은 허용한다",t=>{
  const dimensions={width:800,height:600},{editor,root}=fixture(t,dimensions),status=root.querySelector('.dna-status'),canvas=root.querySelector('canvas');
  selectGene(root,'gather');place(root);assert.equal(status.hidden,true);selectGene(root,'gather');assert.equal(status.hidden,false);assert.equal(status.dataset.kind,'organ-limit');place(root);assert.equal(editor.getDesign().pieces.length,1);
  root.dispatch('keydown',{key:'Delete'});assert.equal(status.hidden,true);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(status.hidden,true);selectGene(root,'gather');assert.equal(status.dataset.kind,'organ-limit');
  const v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600),point={button:0,pointerId:1,clientX:v.x,clientY:v.y};canvas.dispatch('pointerdown',point);
  assert.equal(status.hidden,true);assert.equal(root.querySelector('.dna-add').disabled,false);canvas.dispatch('pointercancel',{});assert.equal(status.hidden,true);
});

test("겹침·경계와 빈칸이 남아도 더 놓을 수 없는 판을 안내한다",t=>{
  const {editor,root}=fixture(t),status=root.querySelector('.dna-status');selectGene(root,'capacity');place(root);place(root);assert.equal(status.hidden,false);assert.equal(status.dataset.kind,'collision');
  for(let index=0;index<4;index++)root.dispatch('keydown',{key:'ArrowUp'});place(root);assert.equal(status.dataset.kind,'boundary');
  const pieces=ATTRIBUTE_DNA.pack(['gather',...Array(7).fill('capacity'),'movement'].map(id=>piece(id,0)),1);assert.ok(pieces);
  editor.load(design(pieces),false);assert.equal(root.dataset.filled,'36');assert.equal(root.dataset.total,'37');assert.equal(status.hidden,false);assert.equal(status.dataset.kind,'full');assert.equal(status.textContent,'꽉 찼습니다');
});

test("우클릭은 선택만 해제하고 빈칸 클릭·회전·Enter와 되돌리기 이력을 구분한다",t=>{
  const dimensions={width:800,height:600},{editor,root,changes,draw}=fixture(t,dimensions),canvas=root.querySelector('canvas'),v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600);
  selectGene(root,'capacity');place(root);const before=editor.getDesign(),count=changes.length;root.dispatch('contextmenu',{});
  const selected=()=>root.querySelector('.dna-list').children.filter(item=>item.attributes['aria-pressed']==='true');
  assert.equal(selected().length,0);assert.equal(root.querySelector('.dna-add').disabled,true);assert.equal(root.dataset.preview,'false');
  const empty={button:0,pointerId:1,clientX:v.x-34*Math.sqrt(3)*v.scale,clientY:v.y-51*v.scale};
  canvas.dispatch('pointerdown',empty);canvas.dispatch('pointerup',empty);canvas.dispatch('wheel',{deltaY:1});root.dispatch('keydown',{key:'e'});root.dispatch('keydown',{key:'Enter'});draw();
  assert.deepEqual(editor.getDesign(),before);assert.equal(changes.length,count);editor.context(2,100,false);assert.equal(selected().length,0);
  root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,0);root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign().pieces,before.pieces);
  const occupied={button:0,pointerId:2,clientX:v.x,clientY:v.y};editor.context(1,0,false);canvas.dispatch('pointerdown',occupied);canvas.dispatch('pointerup',occupied);assert.equal(editor.getDesign().pieces.length,0);assert.equal(selected().length,1);assert.equal(selected()[0].dataset.gene,'capacity');
  selectGene(root,'capacity');assert.equal(selected().length,1);root.dispatch('keydown',{key:'Enter'});assert.equal(editor.getDesign().pieces.length,1);
});

test("조각을 드래그하다 우클릭하면 이동을 취소하고 포인터를 놓아도 배치가 변하지 않는다",t=>{
  const dimensions={width:800,height:600},{editor,root,changes}=fixture(t,dimensions),canvas=root.querySelector('canvas'),v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600),before=design([piece('capacity',0)]);editor.load(before,false);editor.clearHistory();
  const start={button:0,pointerId:1,clientX:v.x,clientY:v.y},end={...start,clientX:v.x-2*34*Math.sqrt(3)*v.scale};canvas.dispatch('pointerdown',start);canvas.dispatch('pointermove',end);root.dispatch('contextmenu',{});canvas.dispatch('pointerup',end);
  assert.deepEqual(editor.getDesign(),before);assert.equal(changes.length,0);assert.equal(root.dataset.moving,'-1');assert.equal(root.querySelector('.dna-add').disabled,true);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.deepEqual(editor.getDesign(),before);
});

test("회전한 기관의 끝 칸을 클릭하면 중심을 커서에 맞춰 다시 배치한다",t=>{
  const dimensions={width:800,height:600},{editor,root}=fixture(t,dimensions),canvas=root.querySelector('canvas'),v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600),original={...piece('gather',2)},before=design([original]);editor.load(before,false);editor.clearHistory();
  const cell=ATTRIBUTE_DNA.pieceCells(original)[2];
  function point(q,r){return {button:0,pointerId:1,clientX:v.x+34*Math.sqrt(3)*(q+r/2)*v.scale,clientY:v.y+51*r*v.scale};}
  const start=point(cell.q,cell.r);canvas.dispatch('pointerdown',start);canvas.dispatch('pointerup',start);
  assert.equal(editor.getDesign().pieces.length,0);assert.equal(root.querySelector('.dna-list').children.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,'gather');assert.equal(root.dataset.preview,'true');assert.equal(root.querySelector('.dna-add').disabled,false);
  const outside=point(cell.q+10,cell.r);canvas.dispatch('pointerdown',outside);canvas.dispatch('pointerup',outside);assert.equal(editor.getDesign().pieces.length,0);assert.equal(root.querySelector('.dna-status').dataset.kind,'boundary');
  const end=point(.25,.5);canvas.dispatch('pointermove',end);assert.equal(root.dataset.anchor,'1,0');canvas.dispatch('pointerdown',end);canvas.dispatch('pointerup',end);
  assert.deepEqual(editor.getDesign().pieces,[{...original,q:1}]);assert.equal(root.dataset.filled,'4');assert.equal(root.querySelector('.dna-list').children.find(item=>item.dataset.gene==='gather').attributes['aria-disabled'],'true');
  root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,0);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.deepEqual(editor.getDesign(),before);root.dispatch('keydown',{key:'y',ctrlKey:true});root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign().pieces,[{...original,q:1}]);
});

test("클릭해 집은 DNA는 우클릭으로 내려놓고 undo로 원래 배치를 복구한다",t=>{
  const dimensions={width:800,height:600},{editor,root}=fixture(t,dimensions),canvas=root.querySelector('canvas'),v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600),before=design([piece('health',0)]);editor.load(before,false);editor.clearHistory();
  const point={button:0,pointerId:1,clientX:v.x,clientY:v.y};canvas.dispatch('pointerdown',point);canvas.dispatch('pointerup',point);assert.equal(editor.getDesign().pieces.length,0);assert.equal(root.querySelector('.dna-add').disabled,false);
  root.dispatch('contextmenu',{});assert.equal(root.querySelector('.dna-add').disabled,true);canvas.dispatch('pointerdown',point);canvas.dispatch('pointerup',point);assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'z',ctrlKey:true});assert.deepEqual(editor.getDesign(),before);
});

test("단일 기관은 배치 즉시 선택을 해제하지만 목록의 중복 경고는 유지한다",t=>{
  const {editor,root}=fixture(t),status=root.querySelector('.dna-status');editor.context(4,1000,false);
  for(const gene of ATTRIBUTE_DNA.catalog.filter(item=>item.category==='organ')){
    editor.load({version:6,pieces:[],level:4,budget:1000},false);selectGene(root,gene.id);place(root);
    assert.equal(editor.getDesign().pieces.length,1,gene.id);assert.equal(root.querySelector('.dna-list').children.some(item=>item.attributes['aria-pressed']==='true'),false);assert.equal(root.dataset.preview,'false');assert.equal(root.querySelector('.dna-add').disabled,true);assert.equal(root.querySelector('.dna-rotation').children.every(item=>item.disabled),true);assert.equal(status.hidden,true);
    const before=editor.getDesign(),item=root.querySelector('.dna-list').children.find(item=>item.dataset.gene===gene.id);assert.equal(item.attributes['aria-disabled'],'true');
    for(const event of ['pointerenter','focus']){item.dispatch(event,{});assert.equal(status.hidden,false);assert.equal(status.dataset.kind,'organ-limit');assert.match(status.textContent,/하나만 배치할 수 있습니다/);item.dispatch(event==='focus'?'blur':'pointerleave',{});assert.equal(status.hidden,true);}
    item.onclick();assert.equal(status.hidden,false);assert.equal(item.attributes['aria-pressed'],'false');place(root);root.dispatch('keydown',{key:'Enter'});assert.deepEqual(editor.getDesign(),before);
  }
});

test("반복 가능한 DNA는 배치 후에도 선택과 회전을 유지한다",t=>{
  const {editor,root}=fixture(t);selectGene(root,'capacity');root.dispatch('keydown',{key:'e'});place(root);assert.equal(editor.getDesign().pieces[0].rotation,1);
  assert.equal(root.querySelector('.dna-list').children.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,'capacity');assert.equal(root.querySelector('.dna-rotation').children.some(item=>item.disabled),false);
});

test("범례는 종류별 개수와 실효 변화량을 표시하고 칸 수 배지는 만들지 않는다",t=>{
  const {editor,root}=fixture(t),legend=root.querySelector('.dna-legend');editor.context(4,1000,false);
  const pieces=ATTRIBUTE_DNA.pack(['gather','capacity','capacity','harvestSpeed','harvestSpeed','health','movement','antenna','block','armor'].map(id=>piece(id,0)),4);editor.load({version:6,pieces,level:4,budget:1000},false);
  const rows=()=>Object.fromEntries(legend.children.map(row=>[row.dataset.gene,row.children.slice(1).map(child=>child.textContent)]));
  assert.deepEqual(rows(),{capacity:['×2',' (운반 +2개)'],gather:['×1',' (채집 기능 해금)'],harvestSpeed:['×2',' (채집 시간 -0.667초)'],health:['×1',' (체력 +20)'],movement:['×1',' (이동 +0.04칸/초)'],antenna:['×1'],block:['×1',' (방어본능 +25%)'],armor:['×1',' (방어 +30)']});
  assert.equal(legend.hidden,false);assert.equal(root.querySelector('.dna-board').children.some(child=>child.className==='dna-fill'),false);
  root.dispatch('keydown',{key:'Delete'});assert.equal(rows().armor,undefined);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.deepEqual(rows().armor,['×1',' (방어 +30)']);editor.load({version:6,pieces:[],level:4,budget:1000},false);assert.equal(legend.hidden,true);
});
