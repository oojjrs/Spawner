import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createDnaEditor, dnaEditorViewport } from "./dna-editor.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";

function fixture(t, dimensions = {width:0,height:0}) {
  const draws=[],pending=[];
  const drawing={setTransform(){},clearRect(){draws.length=0;},save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},fill(){},arc(x,y,radius){draws.push({kind:'arc',x,y,radius});},stroke(){draws.push({kind:'stroke',color:this.strokeStyle});}};
  class Element {
    constructor() { this.children=[];this.dataset={};this.style={setProperty(){}};this.attributes={};this.selectors=new Map();this.listeners=new Map(); }
    setPointerCapture() {}
    setAttribute(name,value) { this.attributes[name]=value; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children=items; }
    querySelector(selector) { if(!this.selectors.has(selector))this.selectors.set(selector,new Element());return this.selectors.get(selector); }
    getContext() { return drawing; }
    getBoundingClientRect() { return {left:0,top:0,...dimensions}; }
    addEventListener(type,handler) { if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(handler); }
    dispatch(type,values) { const event={target:this,preventDefault(){},stopPropagation(){},...values};for(const handler of this.listeners.get(type)||[])handler(event); }
    focus() {}
    remove() {}
  }
  const globals={document:{createElement:()=>new Element(),createElementNS:()=>new Element()},
    devicePixelRatio:1,ResizeObserver:class {observe(){}disconnect(){}},requestAnimationFrame:callback=>{pending.push(callback);return pending.length;},cancelAnimationFrame:()=>{}};
  for(const [key,value] of Object.entries(globals)) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});
  }
  const container=new Element(),changes=[];
  const editor=createDnaEditor(container,ATTRIBUTE_DNA,value=>changes.push(value));
  return {editor,changes,root:container.children[0],draws,draw(){for(const callback of pending.splice(0))callback();}};
}

test("현재 둥지 레벨 이하의 모든 속성을 표시하고 저장 레벨로 우회하지 않는다",t=>{
  const {editor,root}=fixture(t),genes=()=>root.querySelector('.dna-list').children.map(item=>item.dataset.gene);
  editor.context(1,0,false);
  editor.load({version:3,pieces:[],level:4,budget:10000},false);
  assert.equal(editor.getDesign().level,1);
  assert.equal(editor.getDesign().budget,0);
  assert.deepEqual(genes(),ATTRIBUTE_DNA.catalog.filter(gene=>gene.grade<=1).map(gene=>gene.id));
  editor.context(2,400,false);
  assert.deepEqual(genes(),ATTRIBUTE_DNA.catalog.filter(gene=>gene.grade<=2).map(gene=>gene.id));
  root.querySelector('.dna-list').children.find(item=>ATTRIBUTE_DNA.lookup.get(item.dataset.gene).grade===2).onclick();
  editor.context(1,70,false);
  assert.equal(editor.getDesign().budget,70);
  assert.deepEqual(genes(),ATTRIBUTE_DNA.catalog.filter(gene=>gene.grade<=1).map(gene=>gene.id));
});

test("둥지 성장과 포인트 갱신은 편집 중인 DNA 조각을 유지한다",t=>{
  const {editor,root,changes}=fixture(t);
  editor.context(1,0,false);
  editor.load({version:3,pieces:[],level:1,budget:0},false);
  assert.equal(root.querySelector('.dna-add').disabled,false);
  root.querySelector('.dna-add').onclick();
  assert.equal(changes.length,1);
  const pieces=editor.getDesign().pieces;
  assert.equal(pieces.length,1);
  editor.context(4,2500,false);
  assert.deepEqual(editor.getDesign(),{version:3,pieces,level:4,budget:2500});
  assert.deepEqual(root.querySelector('.dna-list').children.map(item=>item.dataset.gene),ATTRIBUTE_DNA.catalog.map(gene=>gene.id));
});

test("키보드와 휠로 회전하고 Space 배치와 최신 변경 되돌리기를 수행한다",t=>{
  const {editor,root}=fixture(t),canvas=root.querySelector('canvas');
  editor.context(1,0,false);
  root.dispatch('keydown',{key:'e'});
  canvas.dispatch('wheel',{deltaY:1});
  root.dispatch('keydown',{key:'q'});
  root.dispatch('keydown',{key:' '});
  assert.equal(editor.getDesign().pieces.length,1);
  assert.equal(editor.getDesign().pieces[0].rotation,1);
  root.dispatch('keydown',{key:'Backspace'});
  assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'Enter'});
  assert.equal(editor.getDesign().pieces.length,1);
  root.dispatch('contextmenu',{});
  assert.equal(editor.getDesign().pieces.length,0);
});

test("읽기 전용에서는 키보드·휠·추가 입력이 DNA를 바꾸지 않는다",t=>{
  const {editor,root,changes}=fixture(t),canvas=root.querySelector('canvas');
  editor.context(1,0,true);
  const before=editor.getDesign();
  for(const key of ['e','q','Enter',' ','Backspace'])root.dispatch('keydown',{key});
  canvas.dispatch('wheel',{deltaY:1});
  root.dispatch('contextmenu',{});
  root.querySelector('.dna-add').onclick();
  assert.deepEqual(editor.getDesign(),before);
  assert.equal(changes.length,0);
  assert.equal(root.querySelector('.dna-add').disabled,true);
});

test("배치 후 현재 방향이 막히면 다음 유효 방향으로 자동 회전하고 빈 영역 클릭으로 배치한다",t=>{
  const {editor,root}=fixture(t,{width:330,height:260}),canvas=root.querySelector('canvas');
  editor.context(1,0,false);
  root.querySelector('.dna-add').onclick();
  assert.equal(root.querySelector('.dna-status').dataset.kind,'ready');
  assert.equal(root.querySelector('.dna-add').disabled,false);
  canvas.dispatch('pointerdown',{button:0,pointerId:1,clientX:1,clientY:1});
  canvas.dispatch('pointerup',{pointerId:1,clientX:1,clientY:1});
  assert.equal(editor.getDesign().pieces[1].rotation,2);
});

test("모든 등급의 여섯 회전 후보가 PC와 모바일의 도구·비용 영역 안쪽에 들어온다",()=>{
  for(const [width,height]of [[700,480],[330,260],[280,260]])for(const level of [1,2,3,4]){
    const radius=ATTRIBUTE_DNA.boardRadius(level);
    for(const start of [{q:0,r:0},{q:radius,r:0},{q:0,r:radius},{q:-radius,r:radius},{q:-radius,r:0},{q:0,r:-radius},{q:radius,r:-radius}])
      for(const gene of ATTRIBUTE_DNA.catalog.filter(g=>g.grade<=level)){
        const view=dnaEditorViewport(ATTRIBUTE_DNA,level,start,gene,width,height);
        for(let rotation=0;rotation<6;rotation++)for(const point of ATTRIBUTE_DNA.route(start,gene,gene.grade,rotation)){
          const x=34*Math.sqrt(3)*(point.q+point.r/2)*view.scale+view.x,y=51*point.r*view.scale+view.y,pad=25*view.scale;
          assert.ok(x-pad>=20-1e-6&&x+pad<=width-20+1e-6,gene.id);
          assert.ok(y-pad>=54-1e-6&&y+pad<=height-66+1e-6,gene.id);
        }
      }
  }
});


test("독립 제작기는 유효한 후보만 경로와 끝점을 표시한다",()=>{
  const html=readFileSync(new URL('../Attribute.html',import.meta.url),'utf8');
  const candidate=html.match(/  function candidate\(\)\{[^\r\n]+/)[0];
  const draw=html.match(/  function draw\(\)\{[\s\S]*?\n  \}/)[0];
  const gene=ATTRIBUTE_DNA.lookup.get('gather'),pieces=[{gene:'gather',grade:1,rotation:0,shape:[...gene.steps]}];
  const model=ATTRIBUTE_DNA.trace(pieces,1),paths=[],nodes=[];
  const scope={M:ATTRIBUTE_DNA,pieces,model,selected:'gather',rotation:0,insertion:1,level:1,
    devicePixelRatio:1,view:{width:700,height:480},context:{setTransform(){},clearRect(){}},drawGrid(){},
    dnaPath(path,color){paths.push({path,color});},node(point,index,color,ghost){nodes.push({point,index,color,ghost});}};
  runInNewContext(candidate+'\n'+draw+'\nthis.candidate=candidate;this.draw=draw;',scope);
  for(const rotation of [0,3,2]){
    scope.rotation=rotation;scope.preview=scope.candidate();paths.length=0;nodes.length=0;scope.draw();
    assert.equal(paths.some(entry=>entry.color==='#8be3c3'),rotation===2);
    assert.equal(nodes.some(entry=>entry.ghost),rotation===2);
    assert.equal(paths.some(entry=>entry.color==='#ed9293'),false);
  }
});

test("여섯 방향이 모두 막힌 실제 설계는 후보를 숨기고 클릭과 회전으로 변경되지 않는다",t=>{
  const {editor,root,draw,draws}=fixture(t,{width:700,height:480}),canvas=root.querySelector('canvas');
  const values=[['gather',0],['movement',4],['movement',4],['gather',1],['gather',3],['movement',1],['blade',0],['movement',0]];
  const pieces=values.map(([id,rotation])=>{const gene=ATTRIBUTE_DNA.lookup.get(id);return {gene:id,grade:1,rotation,shape:[...ATTRIBUTE_DNA.shape(gene,1)]};});
  assert.equal(ATTRIBUTE_DNA.trace(pieces,1).valid,true);
  editor.load({version:3,pieces,level:1,budget:0},false);
  const before=editor.getDesign();draw();
  assert.equal(root.dataset.preview,'false');
  assert.equal(root.querySelector('.dna-add').disabled,true);
  assert.equal(draws.some(entry=>entry.kind==='stroke'&&(entry.color==='#8be3c3'||entry.color==='#9cf0ce')),false);
  canvas.dispatch('pointerdown',{button:0,pointerId:1,clientX:2,clientY:2});
  canvas.dispatch('pointerup',{pointerId:1,clientX:2,clientY:2});
  root.dispatch('keydown',{key:'e'});root.dispatch('keydown',{key:'q'});
  assert.deepEqual(editor.getDesign(),before);
  assert.equal(root.dataset.preview,'false');
});

test("게임 회전 입력은 양방향의 막힌 방향을 건너뛰고 조각과 이력을 유지한다",t=>{
  const {editor,root,changes}=fixture(t),canvas=root.querySelector('canvas');
  root.querySelector('.dna-add').onclick();
  const before=editor.getDesign(),count=changes.length;
  root.dispatch('keydown',{key:'e'});
  canvas.dispatch('wheel',{deltaY:1});
  root.querySelector('.dna-rotation').children[0].onclick();
  assert.deepEqual(editor.getDesign(),before);
  assert.equal(changes.length,count);
  root.querySelector('.dna-add').onclick();
  assert.equal(editor.getDesign().pieces[1].rotation,4);
  root.dispatch('keydown',{key:'Backspace'});
  assert.deepEqual(editor.getDesign(),before);
});

test("게임 가운데 클릭은 표시된 목록에서 순환하고 보조 클릭으로 중복 실행하지 않는다",t=>{
  const {editor,root,changes}=fixture(t),canvas=root.querySelector('canvas');
  root.querySelector('.dna-filters').children.find(item=>item.textContent==='스탯').onclick();
  let items=root.querySelector('.dna-list').children;
  items.at(-1).onclick();
  const first=items[0].dataset.gene,before=editor.getDesign();
  canvas.dispatch('pointerdown',{button:1});
  items=root.querySelector('.dna-list').children;
  assert.equal(items.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,first);
  canvas.dispatch('auxclick',{button:1});
  assert.equal(root.querySelector('.dna-list').children.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,first);
  assert.deepEqual(editor.getDesign(),before);
  assert.equal(changes.length,0);
  editor.context(1,0,true);
  canvas.dispatch('pointerdown',{button:1});
  assert.equal(root.querySelector('.dna-list').children.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,first);
});

test("양 편집기의 회전 탐색은 여섯 방향까지만 확인하고 모두 막히면 원래 방향을 유지한다",()=>{
  for(const file of ['dna-editor.mjs','../Attribute.html']){
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    const rotate=source.match(/  function rotate\(delta\)\{[^\r\n]+/)[0];
    let checks=0,states=0;
    const scope={rotation:1,readOnly:false,notice:'',candidate(){checks++;return {result:{valid:false}};},state(){states++;}};
    runInNewContext(rotate+'\nthis.rotate=rotate;',scope);
    scope.rotate(-1);
    assert.equal(scope.rotation,1);
    assert.equal(checks,6);
    assert.equal(states,0);
    checks=0;
    scope.candidate=()=>{checks++;return {valid:false,reason:'budget',result:{valid:scope.rotation===4}};};
    scope.rotate(-1);
    assert.equal(scope.rotation,4);
    assert.equal(checks,3);
    assert.equal(states,1);
  }
});

test("독립 제작기의 휠은 확대 대신 회전하고 가운데 클릭은 활성 목록에서 순환한다",()=>{
  const source=readFileSync(new URL('../Attribute.html',import.meta.url),'utf8'),listeners=new Map(),rotations=[];
  const items=['power','health'].map(gene=>({dataset:{gene},disabled:false,onclick(){scope.selected=gene;}}));
  items.splice(1,0,{dataset:{gene:'locked'},disabled:true,onclick(){assert.fail('disabled gene');}});
  const scope={selected:'health',$(){return {children:items};},canvas:{addEventListener(type,handler){listeners.set(type,handler);}},rotate(delta){rotations.push(delta);}};
  const cycle=source.match(/  function cycleGene\(\)\{[^\r\n]+/)[0];
  const pointer=source.match(/canvas.addEventListener\('pointerdown',[\s\S]*?\}\);/)[0];
  const wheel=source.match(/canvas.addEventListener\('wheel',[\s\S]*?\},\{passive:false\}\);/)[0];
  const aux=source.match(/canvas.addEventListener\('auxclick',[\s\S]*?\}\);/)[0];
  runInNewContext([cycle,pointer,wheel,aux].join('\n'),scope);
  const event={button:1,deltaY:10,preventDefault(){},stopPropagation(){}};
  listeners.get('pointerdown')(event);
  assert.equal(scope.selected,'power');
  listeners.get('auxclick')(event);
  assert.equal(scope.selected,'power');
  listeners.get('wheel')(event);
  listeners.get('wheel')({...event,deltaY:-10});
  for(const modifier of ['ctrlKey','metaKey','altKey'])listeners.get('wheel')({...event,[modifier]:true});
  assert.deepEqual(rotations,[1,-1]);
});


test("조작 안내 summary의 Enter와 Space는 기본 접기 동작을 유지한다",t=>{
  const {editor,root,changes}=fixture(t),before=editor.getDesign();
  const target={tagName:'SUMMARY',closest(selector){return selector.includes('summary')?this:null;}};
  for(const key of ['Enter',' '])root.dispatch('keydown',{key,target,preventDefault(){assert.fail('native summary input prevented');}});
  assert.deepEqual(editor.getDesign(),before);
  assert.equal(changes.length,0);
});


test("설치 수량은 필터와 무관한 뷰어 범례로 옮기고 되돌리기·삭제·초기화·읽기 전용 불러오기에 맞춘다",t=>{
  const {editor,root}=fixture(t),legend=root.querySelector('.dna-legend');
  const quantities=()=>legend.children.map(item=>[item.dataset.gene,Number(item.children[1].textContent.slice(1))]);
  assert.equal(legend.hidden,true);
  root.querySelector('.dna-add').onclick();
  root.querySelector('.dna-add').onclick();
  assert.deepEqual(quantities(),[['gather',2]]);
  assert.equal(quantities().reduce((total,item)=>total+item[1],0),editor.getDesign().pieces.length);
  assert.ok(root.querySelector('.dna-list').children.every(item=>item.children[2].children.length===0));
  root.querySelector('.dna-filters').children.find(item=>item.textContent==='스탯').onclick();
  assert.deepEqual(quantities(),[['gather',2]]);
  root.dispatch('keydown',{key:'Backspace'});
  assert.deepEqual(quantities(),[['gather',1]]);
  root.dispatch('keydown',{key:'Delete'});
  assert.equal(legend.hidden,true);
  const gene=ATTRIBUTE_DNA.lookup.get('gather'),piece={gene:gene.id,grade:1,rotation:0,shape:[...gene.steps]};
  editor.load({version:3,pieces:[piece],level:1,budget:0},true);
  assert.deepEqual(quantities(),[['gather',1]]);
  editor.context(1,0,false);
  root.querySelector('.dna-tools').children[3].onclick();
  assert.equal(legend.hidden,true);
  assert.deepEqual(quantities(),[]);
});

test("양 편집기 조작 안내에 좌클릭 배치와 우클릭 되돌리기를 표시한다",()=>{
  for(const file of ['dna-editor.mjs','../Attribute.html']){
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    assert.ok(source.includes('<kbd>좌클릭 / Enter</kbd>'));
    assert.ok(source.includes('<kbd>우클릭 / Ctrl+Z</kbd>'));
  }
});

test("초기화 뒤 우클릭과 다시 실행이 이전 설계를 되살리지 않는다",t=>{
  const {editor,root}=fixture(t);
  root.querySelector('.dna-add').onclick();
  const saved=editor.getDesign();
  editor.load(saved,false);
  root.querySelector('.dna-add').onclick();
  root.querySelector('.dna-tools').children[3].onclick();
  for(const key of ['Backspace','BrowserBack'])root.dispatch('keydown',{key});
  root.dispatch('contextmenu',{});
  root.dispatch('keydown',{key:'z',ctrlKey:true,shiftKey:true});
  assert.equal(editor.getDesign().pieces.length,0);
  assert.equal(root.querySelector('.dna-tools').children[0].disabled,true);
  assert.equal(root.querySelector('.dna-tools').children[1].disabled,true);
  root.querySelector('.dna-add').onclick();
  root.dispatch('contextmenu',{});
  assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'z',ctrlKey:true,shiftKey:true});
  assert.equal(editor.getDesign().pieces.length,1);
});

function attributeHistoryFixture(){
  const source=readFileSync(new URL('../Attribute.html',import.meta.url),'utf8'),elements=new Map();
  const element=()=>({children:[],value:'',files:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){},focus(){}});
  const scope={M:ATTRIBUTE_DNA,pieces:[],level:1,insertion:0,notice:'',history:[],future:[],library:[],
    $(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
    document:{createElement:element},state(){},fit(){},persist(){},renderControls(){},icon(){return '';},copy(){return '';},
    commit(){},rotate(){},remove(){},zoom(){}};
  const functions=['design','snapshot','checkpoint','restore','loadDesign','undo','redo','renderTemplates'];
  const lines=source.split(/\r?\n/);
  const declarations=functions.map(name=>lines.find(line=>line.startsWith('  function '+name+'(')));
  assert.ok(declarations.every(Boolean));
  const bindings=["  $('add').onclick=", "  $('save-template').onclick=", "  $('export').onclick="].map(prefix=>lines.find(line=>line.startsWith(prefix)));
  assert.ok(bindings.every(Boolean));
  runInNewContext([...declarations,...bindings].join('\n'),scope);
  return scope;
}

function historyPiece(gene){
  const entry=ATTRIBUTE_DNA.lookup.get(gene);
  return {gene,grade:entry.grade,rotation:0,shape:[...entry.steps]};
}

for(const action of ['clear','load','save','import'])test('제작기 '+action+' 경계 뒤 되돌리기는 이전 저장 설계로 넘어가지 않는다',async()=>{
  const scope=attributeHistoryFixture(),old=[historyPiece('gather')],current=[historyPiece('health')];
  scope.pieces=old;
  scope.checkpoint();
  scope.pieces=current;
  scope.future=[JSON.stringify({version:3,pieces:old,budget:0,level:1})];
  let expected=current;
  if(action==='clear'){
    scope.$('clear').onclick();
    expected=[];
  }else if(action==='load'){
    scope.library=[{name:'saved',design:{version:3,pieces:old,budget:0,level:1}}];
    scope.renderTemplates();
    scope.$('templates').children[0].children[0].onclick();
    expected=old;
  }else if(action==='save'){
    scope.$('template-name').value='current';
    scope.$('save-template').onclick();
    assert.equal(scope.library.length,1);
  }else{
    const design={version:3,pieces:old,budget:0,level:1};
    scope.$('file').files=[{size:100,async text(){return JSON.stringify(design);}}];
    await scope.$('file').onchange();
    expected=old;
  }
  assert.equal(scope.history.length,0);
  assert.equal(scope.future.length,0);
  scope.undo();scope.redo();scope.undo();
  assert.deepEqual(JSON.parse(JSON.stringify(scope.pieces)),expected);
  scope.checkpoint();
  scope.pieces=[historyPiece('movement')];
  scope.undo();
  assert.deepEqual(JSON.parse(JSON.stringify(scope.pieces)),expected);
  scope.redo();
  assert.deepEqual(JSON.parse(JSON.stringify(scope.pieces)),[historyPiece('movement')]);
});

test("실행 번들의 DNA 편집기는 수정한 원본 모듈과 일치한다",()=>{
  const source=readFileSync(new URL('./dna-editor.mjs',import.meta.url),'utf8').replace(/^export\s+/gm,'').replaceAll('\r\n','\n').trimEnd();
  const runtime=readFileSync(new URL('./runtime.js',import.meta.url),'utf8');
  const match=runtime.match(/modules\["client\/dna-editor.mjs"\] = \(\(\) => \{\r?\n([\s\S]*?)\r?\nreturn \{ dnaEditorViewport, createDnaEditor \};\r?\n\}\)\(\);/);
  assert.ok(match);
  assert.equal(match[1].replaceAll('\r\n','\n').trimEnd(),source);
});
