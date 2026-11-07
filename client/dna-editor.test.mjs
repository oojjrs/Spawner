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
function piece(gene,rotation){const entry=ATTRIBUTE_DNA.lookup.get(gene);return {gene,rotation,grade:entry.grade,shape:[...entry.steps]};}
function design(pieces){return {version:3,pieces,level:1,budget:0};}
function place(root){root.querySelector('.dna-add').onclick();}
function blockedPieces(){return [['capacity',0],['harvestSpeed',4],['harvestSpeed',4],['capacity',1],['capacity',3],['harvestSpeed',1],['movement',0],['harvestSpeed',0]].map(([gene,rotation])=>piece(gene,rotation));}

test("현재 둥지 레벨 이하 속성만 표시하고 저장한 레벨로 우회하지 않는다",t=>{
  const {editor,root}=fixture(t),genes=()=>root.querySelector('.dna-list').children.map(item=>item.dataset.gene);
  editor.context(1,0,false);editor.load({version:3,pieces:[],level:4,budget:10000},false);
  assert.equal(editor.getDesign().level,1);assert.equal(editor.getDesign().budget,0);
  assert.deepEqual(genes(),ATTRIBUTE_DNA.catalog.filter(gene=>gene.grade<=1).map(gene=>gene.id));
  editor.context(2,400,false);selectGene(root,ATTRIBUTE_DNA.catalog.find(gene=>gene.grade===2).id);
  editor.context(1,70,false);
  assert.equal(editor.getDesign().budget,70);
  assert.deepEqual(genes(),ATTRIBUTE_DNA.catalog.filter(gene=>gene.grade<=1).map(gene=>gene.id));
});

test("둥지·포인트 갱신은 편집 중인 조각과 정상 되돌리기를 유지한다",t=>{
  const {editor,root,changes}=fixture(t);editor.context(1,0,false);place(root);
  const pieces=editor.getDesign().pieces;assert.equal(changes.length,1);
  editor.context(4,2500,false);
  assert.deepEqual(editor.getDesign(),{version:3,pieces,level:4,budget:2500});
  assert.deepEqual(root.querySelector('.dna-list').children.map(item=>item.dataset.gene),ATTRIBUTE_DNA.catalog.map(gene=>gene.id));
  root.dispatch('keydown',{key:'Backspace'});assert.equal(editor.getDesign().pieces.length,0);
});

test("키보드·휠 회전과 Space·Enter 배치, 우클릭·뒤로가기·다시 실행이 한 이력을 쓴다",t=>{
  const {editor,root}=fixture(t),canvas=root.querySelector('canvas');
  root.dispatch('keydown',{key:'e'});canvas.dispatch('wheel',{deltaY:1});root.dispatch('keydown',{key:'q'});
  root.dispatch('keydown',{key:' '});assert.equal(editor.getDesign().pieces[0].rotation,1);
  root.dispatch('keydown',{key:'Backspace'});assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'z',ctrlKey:true,shiftKey:true});assert.equal(editor.getDesign().pieces.length,1);
  root.dispatch('contextmenu',{});assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,1);
  root.dispatch('pointerdown',{button:3});root.dispatch('auxclick',{button:3});assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'Enter'});root.dispatch('keydown',{key:'BrowserBack'});assert.equal(editor.getDesign().pieces.length,0);
});

test("입력 칸과 contenteditable에서는 편집기 단축키를 가로채지 않는다",t=>{
  const {editor,root,changes}=fixture(t),before=editor.getDesign();
  for(const target of [{tagName:'INPUT'},{tagName:'SELECT'},{tagName:'TEXTAREA'},{tagName:'DIV',isContentEditable:true}])
    for(const key of ['q','e','r','ArrowLeft','ArrowRight','f','Enter',' ','Delete','Backspace','z','y'])
      root.dispatch('keydown',{key,target,ctrlKey:key==='z'||key==='y',preventDefault(){assert.fail('typing intercepted');}});
  assert.deepEqual(editor.getDesign(),before);assert.equal(changes.length,0);
});

test("기본 버튼·조작 안내의 Enter와 Space 및 수정자 조합은 원래 동작을 유지한다",t=>{
  const {editor,root}=fixture(t),canvas=root.querySelector('canvas'),before=editor.getDesign();
  for(const tagName of ['SUMMARY','BUTTON'])for(const key of ['Enter',' ']){
    const target={tagName,closest(selector){return selector.includes(tagName.toLowerCase())?this:null;}};
    root.dispatch('keydown',{key,target,preventDefault(){assert.fail('native key intercepted');}});
  }
  for(const modifier of ['ctrlKey','metaKey','altKey']){
    root.dispatch('keydown',{key:'e',[modifier]:true,preventDefault(){assert.fail('modified rotation intercepted');}});
    canvas.dispatch('wheel',{deltaY:1,[modifier]:true,preventDefault(){assert.fail('modified wheel intercepted');}});
  }
  assert.deepEqual(editor.getDesign(),before);
});

test("읽기 전용에서는 배치·삭제·이력·모든 입력이 DNA를 바꾸지 않는다",t=>{
  const {editor,root,changes}=fixture(t),canvas=root.querySelector('canvas');editor.context(1,0,true);
  const before=editor.getDesign();
  for(const key of ['e','q','r','ArrowLeft','ArrowRight','Enter',' ','Backspace','Delete','BrowserBack'])root.dispatch('keydown',{key});
  for(const key of ['z','y'])root.dispatch('keydown',{key,ctrlKey:true});
  canvas.dispatch('wheel',{deltaY:1});canvas.dispatch('pointerdown',{button:1});root.dispatch('contextmenu',{});root.dispatch('pointerdown',{button:3});
  root.querySelector('.dna-add').onclick();for(const button of root.querySelector('.dna-tools').children)button.onclick();
  assert.deepEqual(editor.getDesign(),before);assert.equal(changes.length,0);assert.equal(root.querySelector('.dna-add').disabled,true);
});

test("빈 영역 클릭도 배치하고 드래그·취소·가운데 클릭은 조각을 추가하지 않는다",t=>{
  const {editor,root}=fixture(t,{width:330,height:260}),canvas=root.querySelector('canvas');
  canvas.dispatch('pointerdown',{button:0,pointerId:1,clientX:1,clientY:1});canvas.dispatch('pointerup',{pointerId:1,clientX:1,clientY:1});
  assert.equal(editor.getDesign().pieces.length,1);
  canvas.dispatch('pointerdown',{button:0,pointerId:2,clientX:1,clientY:1});canvas.dispatch('pointermove',{pointerId:2,clientX:40,clientY:40});canvas.dispatch('pointerup',{pointerId:2});
  canvas.dispatch('pointerdown',{button:0,pointerId:3,clientX:1,clientY:1});canvas.dispatch('pointercancel',{pointerId:3});canvas.dispatch('pointerup',{pointerId:3});
  canvas.dispatch('pointerdown',{button:1});canvas.dispatch('auxclick',{button:1});
  assert.equal(editor.getDesign().pieces.length,1);
});

test("배치 후 막힌 방향을 자동으로 건너뛰고 수동 회전은 조각·이력을 바꾸지 않는다",t=>{
  const {editor,root,changes}=fixture(t),canvas=root.querySelector('canvas');selectGene(root,'capacity');place(root);
  assert.equal(root.dataset.preview,'true');const before=editor.getDesign(),count=changes.length;
  root.dispatch('keydown',{key:'e'});canvas.dispatch('wheel',{deltaY:1});root.querySelector('.dna-rotation').children[0].onclick();
  assert.deepEqual(editor.getDesign(),before);assert.equal(changes.length,count);place(root);
  assert.ok(ATTRIBUTE_DNA.trace(editor.getDesign().pieces,1).valid);
  root.dispatch('keydown',{key:'Backspace'});assert.deepEqual(editor.getDesign(),before);
});

test("완전히 막힌 유효 설계는 후보를 숨기고 여섯 방향만 확인한다",t=>{
  let checks=0;const model={...ATTRIBUTE_DNA,trace(...args){checks++;return ATTRIBUTE_DNA.trace(...args);}};
  const {editor,root,draw,draws}=fixture(t,{width:700,height:480},model),canvas=root.querySelector('canvas'),pieces=blockedPieces();
  assert.equal(ATTRIBUTE_DNA.trace(pieces,1).valid,true);selectGene(root,'capacity');editor.load(design(pieces),false);selectGene(root,'capacity');
  const before=editor.getDesign();draw();assert.equal(root.dataset.preview,'false');assert.equal(root.querySelector('.dna-add').disabled,true);
  assert.equal(draws.some(entry=>entry.kind==='stroke'&&(entry.color==='#8be3c3'||entry.color==='#9cf0ce')),false);
  checks=0;root.dispatch('keydown',{key:'e'});assert.equal(checks,6);
  canvas.dispatch('pointerdown',{button:0,pointerId:1,clientX:2,clientY:2});canvas.dispatch('pointerup',{pointerId:1});
  assert.deepEqual(editor.getDesign(),before);assert.equal(root.dataset.preview,'false');
});

test("가운데 클릭은 현재 필터 목록을 순회하고 배치한 채집기관을 건너뛴다",t=>{
  const {editor,root,changes}=fixture(t),canvas=root.querySelector('canvas');selectGene(root,'gather');place(root);
  const before=editor.getDesign(),count=changes.length;
  assert.equal(root.querySelector('.dna-list').children.find(item=>item.dataset.gene==='gather').disabled,true);
  selectGene(root,'capacity');canvas.dispatch('pointerdown',{button:1});
  assert.equal(root.querySelector('.dna-list').children.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,'harvestSpeed');
  canvas.dispatch('auxclick',{button:1});
  assert.equal(root.querySelector('.dna-list').children.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,'harvestSpeed');
  root.querySelector('.dna-filters').children.find(item=>item.textContent==='스탯').onclick();
  const items=root.querySelector('.dna-list').children;items.at(-1).onclick();canvas.dispatch('pointerdown',{button:1});
  assert.equal(root.querySelector('.dna-list').children.find(item=>item.attributes['aria-pressed']==='true').dataset.gene,items[0].dataset.gene);
  assert.deepEqual(editor.getDesign(),before);assert.equal(changes.length,count);
});

test("모든 등급의 회전 후보가 PC와 모바일 도구·비용 영역 안쪽에 들어온다",()=>{
  for(const [width,height]of [[700,480],[330,260],[280,260]])for(const level of [1,2,3,4]){
    const radius=ATTRIBUTE_DNA.boardRadius(level);
    for(const start of [{q:0,r:0},{q:radius,r:0},{q:0,r:radius},{q:-radius,r:radius},{q:-radius,r:0},{q:0,r:-radius},{q:radius,r:-radius}])
      for(const gene of ATTRIBUTE_DNA.catalog.filter(value=>value.grade<=level)){
        const view=dnaEditorViewport(ATTRIBUTE_DNA,level,start,gene,width,height);
        for(let rotation=0;rotation<6;rotation++)for(const point of ATTRIBUTE_DNA.route(start,gene,gene.grade,rotation)){
          const x=34*Math.sqrt(3)*(point.q+point.r/2)*view.scale+view.x,y=51*point.r*view.scale+view.y,pad=25*view.scale;
          assert.ok(x-pad>=20-1e-6&&x+pad<=width-20+1e-6,gene.id);
          assert.ok(y-pad>=54-1e-6&&y+pad<=height-66+1e-6,gene.id);
        }
      }
  }
});

test("설치 범례는 필터와 독립이고 되돌리기·삭제·초기화·읽기 전용 불러오기를 따른다",t=>{
  const {editor,root}=fixture(t),legend=root.querySelector('.dna-legend');
  const quantities=()=>Object.fromEntries(legend.children.map(item=>[item.dataset.gene,Number(item.children[1].textContent.slice(1))]));
  assert.equal(legend.hidden,true);selectGene(root,'gather');place(root);selectGene(root,'health');place(root);
  assert.deepEqual(quantities(),{gather:1,health:1});
  assert.ok(root.querySelector('.dna-list').children.every(item=>item.children[2].children.length===0));
  root.querySelector('.dna-filters').children.find(item=>item.textContent==='기관').onclick();assert.deepEqual(quantities(),{gather:1,health:1});
  root.dispatch('keydown',{key:'Backspace'});assert.deepEqual(quantities(),{gather:1});
  root.dispatch('keydown',{key:'Delete'});assert.equal(legend.hidden,true);
  editor.load(design([piece('gather',0)]),true);assert.deepEqual(quantities(),{gather:1});
  editor.context(1,0,false);root.querySelector('.dna-tools').children[3].onclick();assert.equal(legend.hidden,true);
});

test("초기화·불러오기·저장 이력 경계에서 이전 설계가 되살아나지 않는다",t=>{
  const {editor,root,changes}=fixture(t);place(root);const saved=editor.getDesign();editor.load(saved,false);place(root);
  root.querySelector('.dna-tools').children[3].onclick();root.dispatch('contextmenu',{});root.dispatch('keydown',{key:'y',ctrlKey:true});
  assert.equal(editor.getDesign().pieces.length,0);
  place(root);const current=editor.getDesign(),count=changes.length;editor.clearHistory();
  assert.deepEqual(editor.getDesign(),current);assert.equal(changes.length,count);
  root.dispatch('keydown',{key:'Backspace'});root.dispatch('keydown',{key:'z',ctrlKey:true,shiftKey:true});assert.deepEqual(editor.getDesign(),current);
  selectGene(root,'harvestSpeed');place(root);root.dispatch('contextmenu',{});assert.deepEqual(editor.getDesign(),current);
  root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,2);
  editor.load(design([]),false);root.dispatch('contextmenu',{});root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,0);
});

test("불러온 설계는 모든 조각을 우클릭으로 되돌리고 원래 도형으로 다시 실행한다",t=>{
  const {editor,root,changes}=fixture(t),pieces=blockedPieces(),saved=design(pieces),original=structuredClone(saved);
  assert.equal(editor.load(saved,false),true);assert.equal(changes.length,0);
  const [undo,redo]=root.querySelector('.dna-tools').children;
  assert.equal(undo.disabled,false);assert.equal(redo.disabled,true);
  saved.pieces[0].shape[0]=5;
  for(let count=pieces.length-1;count>=0;count--){
    root.dispatch('contextmenu',{});assert.deepEqual(editor.getDesign(),{...original,pieces:original.pieces.slice(0,count)});
  }
  assert.equal(undo.disabled,true);root.dispatch('contextmenu',{});assert.equal(editor.getDesign().pieces.length,0);
  for(let count=1;count<=pieces.length;count++){
    root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign(),{...original,pieces:original.pieces.slice(0,count)});
  }
  assert.equal(redo.disabled,true);assert.equal(changes.length,pieces.length*2);
});

test("설계 전환과 저장 재로드는 현재 설계 안에서만 이력을 만들고 새 배치는 redo를 지운다",t=>{
  const {editor,root}=fixture(t),first=design([piece('gather',0)]),second=design(blockedPieces().slice(0,2));
  editor.load(first,false);root.dispatch('contextmenu',{});editor.load(second,false);
  root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign(),second);
  root.dispatch('contextmenu',{});root.dispatch('contextmenu',{});root.dispatch('contextmenu',{});assert.equal(editor.getDesign().pieces.length,0);
  root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign().pieces,second.pieces.slice(0,1));
  selectGene(root,'harvestSpeed');place(root);const current=editor.getDesign();assert.equal(current.pieces.length,2);assert.equal(root.querySelector('.dna-tools').children[1].disabled,true);
  root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign(),current);
  editor.load(current,false);root.dispatch('contextmenu',{});assert.deepEqual(editor.getDesign().pieces,current.pieces.slice(0,1));
  root.dispatch('keydown',{key:'y',ctrlKey:true});assert.deepEqual(editor.getDesign(),current);
  editor.load(design([]),false);root.dispatch('contextmenu',{});root.dispatch('keydown',{key:'y',ctrlKey:true});assert.equal(editor.getDesign().pieces.length,0);
});

test("공통 가격은 빈 설계·실제 탄생비·표시 비용에 동일하게 적용된다",t=>{
  const {editor,root}=fixture(t);assert.equal(ATTRIBUTE_DNA.cost([]),3);assert.equal(root.querySelector('.dna-cost strong').textContent,'3');
  selectGene(root,'gather');place(root);const dna=editor.getDesign();assert.equal(ATTRIBUTE_DNA.cost(dna.pieces),8);
  for(const tribe of ['bean','spore','pebble','spring'])assert.equal(birthCost({dna},tribe),ATTRIBUTE_DNA.cost(dna.pieces));
  assert.equal(root.querySelector('.dna-cost strong').textContent,String(ATTRIBUTE_DNA.cost(dna.pieces)));
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

test("제작기와 인게임 번들은 공통 편집기와 계산 모듈을 그대로 포함한다",()=>{
  const runtime=readFileSync(new URL('./runtime.js',import.meta.url),'utf8'),tool=readFileSync(new URL('../Attribute.html',import.meta.url),'utf8');
  for(const name of ['client/dna-editor.mjs','server/dna.mjs','server/dna-combat-stats.mjs']){
    const expected=sharedModuleSource(name);
    assert.equal(bundledModule(runtime,name),expected,'runtime:'+name);
    assert.equal(bundledModule(tool,name),expected,'standalone:'+name);
  }
  assert.equal(bundledModule(runtime,'server/attributes.mjs'),sharedModuleSource('server/attributes.mjs'));
});
test("외부 테스트 확대와 F 전체보기는 DNA·이력을 바꾸지 않고 같은 viewport로 복귀한다",t=>{
  const {editor,root,draw,draws,changes}=fixture(t,{width:700,height:480});draw();
  const positions=()=>draws.filter(item=>item.kind==='arc').map(item=>({x:item.x,y:item.y,radius:item.radius}));
  const before=editor.getDesign(),original=positions();editor.zoom(.5);draw();assert.notDeepEqual(positions(),original);
  root.dispatch('keydown',{key:'f'});draw();assert.deepEqual(positions(),original);
  assert.deepEqual(editor.getDesign(),before);assert.equal(changes.length,0);
});

test("기관은 종류별 한 번만 배치하고 다른 기관은 함께 선택할 수 있다",t=>{
  const {editor,root}=fixture(t),canvas=root.querySelector('canvas');editor.context(4,10000,false);
  const organs=ATTRIBUTE_DNA.catalog.filter(gene=>gene.category==='organ');
  for(const organ of organs){
    assert.equal(editor.load({version:3,pieces:[piece(organ.id,0)],level:4,budget:10000},false),true);
    const before=editor.getDesign(),items=root.querySelector('.dna-list').children;
    assert.equal(items.find(item=>item.dataset.gene===organ.id).disabled,true,organ.id);
    for(const other of organs.filter(gene=>gene.id!==organ.id))assert.equal(items.find(item=>item.dataset.gene===other.id).disabled,false,other.id);
    assert.equal(root.dataset.preview,'false');root.dispatch('keydown',{key:'Enter'});root.querySelector('.dna-add').onclick();
    canvas.dispatch('pointerdown',{button:0,pointerId:1,clientX:1,clientY:1});canvas.dispatch('pointerup',{pointerId:1,clientX:1,clientY:1});
    assert.deepEqual(editor.getDesign(),before,organ.id);
  }
});

test("새 치유량과 받는 회복력은 서로 다른 최종 수치로 표시한다",t=>{
  const {element}=fixture(t),pieces=[piece('healer',0),piece('healPower',0),piece('healing',0)],values=dnaDesignStats(ATTRIBUTE_DNA,pieces),list=element();
  renderDnaDesignStats(list,values.stats,values.base,false);
  const value=key=>list.children.find(item=>item.dataset.stat===key&&item.children.length)?.children[0].textContent;
  assert.equal(value('healPower'),'3');assert.equal(value('healing'),'30%');
});

test("구형 경화와 다리의 이름·저장 도형은 신규 카드에서 숨겨도 읽기 목록에 남는다",t=>{
  const {element}=fixture(t),container=element();
  for(const id of ['armor','legs']){
    const gene=ATTRIBUTE_DNA.lookup.get(id),piece={gene:id,grade:3,rotation:2,shape:[...gene.steps]};
    renderDnaComposition(container,ATTRIBUTE_DNA,{version:3,level:4,budget:1000,pieces:[piece]});
    assert.equal(ATTRIBUTE_DNA.catalog.some(gene=>gene.id===id),false);
    const item=container.children[1].children[0];assert.equal(item.dataset.gene,id);
    assert.equal(item.children[1].textContent,id==='armor'?'경화':'다리');
    assert.ok(container.children[0].innerHTML.includes('data-gene="'+id+'"'));
  }
});
