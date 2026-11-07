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
  const drawing={setTransform(){},clearRect(){draws.length=0;},save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},fill(){},arc(x,y,radius){draws.push({kind:'arc',x,y,radius});},stroke(){draws.push({kind:'stroke',color:this.strokeStyle});}};
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
function design(pieces){return {version:4,pieces,level:1,budget:0};}
function place(root){root.querySelector('.dna-add').onclick();}

test("현재 둥지 레벨과 예산은 불러온 설계로 우회하지 않는다",t=>{
  const {editor,root}=fixture(t);editor.context(1,0,false);editor.load({version:4,pieces:[],level:4,budget:1000},false);
  assert.equal(editor.getDesign().level,1);assert.equal(editor.getDesign().budget,0);
  assert.deepEqual(root.querySelector('.dna-list').children.map(i=>i.dataset.gene),ATTRIBUTE_DNA.catalog.filter(g=>g.grade<=1).map(g=>g.id));
  editor.context(4,250,false);assert.equal(root.querySelector('.dna-list').children.length,41);assert.equal(editor.getDesign().budget,250);
});

test("조각을 떨어진 칸에 놓고 회전·삭제·undo·redo가 독립 좌표를 보존한다",t=>{
  const {editor,root}=fixture(t);selectGene(root,'capacity');place(root);root.dispatch('keydown',{key:'ArrowDown'});root.dispatch('keydown',{key:'ArrowLeft'});place(root);
  assert.deepEqual(editor.getDesign().pieces.map(p=>[p.q,p.r]),[[0,0],[-1,1]]);root.dispatch('keydown',{key:'q'});assert.equal(editor.getDesign().pieces[1].rotation,0);
  root.dispatch('keydown',{key:'Delete'});assert.equal(editor.getDesign().pieces.length,1);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,2);root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,1);
  editor.context(2,100,false);assert.equal(editor.getDesign().pieces[0].q,0);root.dispatch('keydown',{key:'Backspace'});assert.equal(editor.getDesign().pieces.length,2);
});

test("겹치는 칸이나 판 밖은 배치하지 않고 새로 놓은 조각은 redo를 지운다",t=>{
  const {editor,root}=fixture(t);selectGene(root,'capacity');place(root);place(root);assert.equal(editor.getDesign().pieces.length,1);
  for(let i=0;i<3;i++)root.dispatch('keydown',{key:'ArrowUp'});place(root);assert.equal(editor.getDesign().pieces.length,1);
  root.dispatch('keydown',{key:'ArrowDown'});place(root);assert.equal(editor.getDesign().pieces.length,2);root.dispatch('contextmenu',{});root.dispatch('keydown',{key:'ArrowDown'});place(root);root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,2);assert.equal(editor.getDesign().pieces[1].r,-1);
});

test("기존 조각은 클릭 후 이동하며 취소는 원래 위치를 유지한다",t=>{
  const dimensions={width:800,height:600},f=fixture(t,dimensions),{editor,root}=f,canvas=root.querySelector('canvas'),v=dnaEditorViewport(ATTRIBUTE_DNA,1,null,null,800,600);
  editor.load(design([piece('capacity',0)]),false);
  function point(q,r){return {button:0,pointerId:1,clientX:v.x+34*Math.sqrt(3)*(q+r/2)*v.scale,clientY:v.y+51*r*v.scale};}
  canvas.dispatch('pointerdown',point(0,0));canvas.dispatch('pointerup',point(0,0));canvas.dispatch('pointermove',point(-2,0));root.dispatch('keydown',{key:'Escape'});assert.equal(editor.getDesign().pieces[0].q,0);
  canvas.dispatch('pointerdown',point(0,0));canvas.dispatch('pointermove',point(-2,0));canvas.dispatch('pointerup',point(-2,0));assert.equal(editor.getDesign().pieces[0].q,-2);root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces[0].q,0);
});

test("읽기전용과 텍스트 입력은 편집을 막고 부분 저장 API는 없다",t=>{
  const {editor,root}=fixture(t),value=design([piece('capacity',0)]);editor.load(value,true);
  for(const key of ['Enter','Delete','Backspace','q','e','ArrowLeft'])root.dispatch('keydown',{key});place(root);assert.deepEqual(editor.getDesign(),value);
  editor.load(value,false);for(const tagName of ['INPUT','TEXTAREA','SELECT'])root.dispatch('keydown',{key:'Delete',target:{tagName}});assert.deepEqual(editor.getDesign(),value);
  assert.equal(editor.partSave,undefined);assert.equal(editor.selectPart,undefined);assert.equal(editor.startPartSelection,undefined);
});

test("기관을 한 번만 놓고 초기화·되돌리기가 조각과 범례를 함께 갱신한다",t=>{
  const {editor,root}=fixture(t);selectGene(root,'gather');place(root);assert.equal(root.querySelector('.dna-list').children.find(i=>i.dataset.gene==='gather').disabled,true);
  root.querySelector('.dna-tools').children[3].onclick();assert.equal(editor.getDesign().pieces.length,0);assert.equal(root.querySelector('.dna-legend').children.length,0);
  root.dispatch('keydown',{key:'z',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,1);assert.equal(root.querySelector('.dna-legend').children.length,1);
});

test("저장한 설계의 좌표와 현재 설계 내부 이력만 복구한다",t=>{
  const {editor,root}=fixture(t),pieces=[piece('capacity',0),{...piece('health',0),q:-2,r:1}];editor.load(design(pieces),false);
  root.dispatch('contextmenu',{});assert.equal(editor.getDesign().pieces.length,1);root.dispatch('contextmenu',{});assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'y',ctrlKey:true});root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign().pieces,pieces);
  editor.load(design([]),false);root.dispatch('contextmenu',{});assert.equal(editor.getDesign().pieces.length,0);
});

test("공통 가격과 실제 탄생비는 제작기 비용과 같다",t=>{
  const {editor,root}=fixture(t);assert.equal(root.querySelector('.dna-cost strong').textContent,'3');selectGene(root,'gather');place(root);const dna=editor.getDesign();
  for(const tribe of ['bean','spore','pebble','spring'])assert.equal(birthCost({dna},tribe),8);assert.equal(root.querySelector('.dna-cost strong').textContent,'8');
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
  assert.equal(health[1].children[0].className,'design-stat-value design-stat-changed');assert.equal(health[1].children[1].textContent,' (+10)');
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
