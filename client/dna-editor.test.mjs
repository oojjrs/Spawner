import test from "node:test";
import assert from "node:assert/strict";
import { createDnaEditor, dnaEditorViewport } from "./dna-editor.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";

function fixture(t, dimensions = {width:0,height:0}) {
  const draws=[],pending=[];
  const drawing={setTransform(){},clearRect(){draws.length=0;},save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},fill(){},arc(x,y,radius){draws.push({kind:'arc',x,y,radius});},stroke(){draws.push({kind:'stroke',color:this.strokeStyle});}};
  class Element {
    constructor() { this.children=[];this.dataset={};this.style={setProperty(){}};this.attributes={};this.selectors=new Map();this.listeners=new Map(); }
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

test("판 밖과 충돌하는 후보도 빨간색으로 보이지만 배치는 막는다",t=>{
  const f=fixture(t,{width:330,height:260});
  f.editor.context(1,100,false);
  f.root.querySelector('.dna-add').onclick();
  f.draw();
  assert.equal(f.root.querySelector('.dna-status').dataset.kind,'boundary');
  assert.equal(f.root.querySelector('.dna-add').disabled,true);
  assert.ok(f.draws.some(draw=>draw.kind==='stroke'&&draw.color==='#ed9293'));
  for(const draw of f.draws.filter(draw=>draw.kind==='arc')){
    assert.ok(draw.x-draw.radius>=0&&draw.x+draw.radius<=330);
    assert.ok(draw.y-draw.radius>=0&&draw.y+draw.radius<=260);
  }
  for(let i=0;i<3;i++)f.root.dispatch('keydown',{key:'e'});
  f.draw();
  assert.equal(f.root.querySelector('.dna-status').dataset.kind,'collision');
  assert.ok(f.draws.some(draw=>draw.kind==='stroke'&&draw.color==='#ed9293'));
  f.root.querySelector('.dna-add').onclick();
  assert.equal(f.editor.getDesign().pieces.length,1);
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
