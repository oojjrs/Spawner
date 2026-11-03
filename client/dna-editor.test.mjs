import test from "node:test";
import assert from "node:assert/strict";
import { createDnaEditor } from "./dna-editor.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";

function fixture(t) {
  class Element {
    constructor() { this.children=[];this.dataset={};this.style={setProperty(){}};this.attributes={};this.selectors=new Map(); }
    setAttribute(name,value) { this.attributes[name]=value; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children=items; }
    querySelector(selector) { if(!this.selectors.has(selector))this.selectors.set(selector,new Element());return this.selectors.get(selector); }
    getContext() { return {}; }
    getBoundingClientRect() { return {width:0,height:0}; }
    addEventListener() {}
    remove() {}
  }
  const globals={document:{createElement:()=>new Element(),createElementNS:()=>new Element()},
    ResizeObserver:class {observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
  for(const [key,value] of Object.entries(globals)) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});
  }
  const container=new Element(),changes=[];
  const editor=createDnaEditor(container,ATTRIBUTE_DNA,value=>changes.push(value));
  return {editor,changes,root:container.children[0]};
}

test("실제 둥지 레벨을 저장 DNA보다 우선하고 성장 시 등급을 개방한다",t=>{
  const {editor,root}=fixture(t),grades=()=>root.querySelector('.dna-grades').children;
  editor.context(1,100,false);
  editor.load({version:3,pieces:[],level:4,budget:10000},false);
  assert.equal(editor.getDesign().level,1);
  assert.equal(editor.getDesign().budget,100);
  assert.deepEqual(grades().map(item=>item.disabled),[false,true,true,true]);
  grades()[3].onclick();
  assert.equal(grades()[0].attributes['aria-pressed'],'true');
  editor.context(2,400,false);
  assert.deepEqual(grades().map(item=>item.disabled),[false,false,true,true]);
  grades()[1].onclick();
  assert.equal(grades()[1].attributes['aria-pressed'],'true');
  assert.deepEqual(root.querySelector('.dna-list').children.map(item=>item.dataset.gene),['power','speed','capacity','movement','antenna','carapace']);
  editor.context(1,70,false);
  assert.equal(grades()[0].attributes['aria-pressed'],'true');
  assert.equal(editor.getDesign().budget,70);
  assert.deepEqual(root.querySelector('.dna-list').children.map(item=>item.dataset.gene),['gather','health','blade']);
});

test("둥지 성장과 포인트 갱신은 편집 중인 DNA 조각을 유지한다",t=>{
  const {editor,root,changes}=fixture(t);
  editor.context(1,100,false);
  editor.load({version:3,pieces:[],level:1,budget:100},false);
  root.querySelector('.dna-add').onclick();
  assert.equal(changes.length,1);
  const pieces=editor.getDesign().pieces;
  assert.equal(pieces.length,1);
  editor.context(4,2500,false);
  assert.deepEqual(editor.getDesign(),{version:3,pieces,level:4,budget:2500});
  assert.deepEqual(root.querySelector('.dna-grades').children.map(item=>item.disabled),[false,false,false,false]);
});
