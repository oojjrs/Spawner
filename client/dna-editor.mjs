import { basicRecoveryRate, totalRecoveryRate, UNIT_RECOVERY_RULES } from "../server/unit-recovery.mjs";
import { createDnaAudio } from "./dna-audio.mjs";
import { dnaGeneTooltip, dnaGeneCapped } from "./dna-gene-effects.mjs";

export const DNA_PLACEMENT_COLORS = Object.freeze({available:'#6bc7ff',blocked:'#ff7b89'});

export function dnaDesignStats(M,pieces,tribe) {
  const stats=M.stats(pieces,tribe),base={...M.stats([],tribe)},organPieces=pieces.filter(piece=>M.lookup.get(piece.gene)?.category==='organ'),organStats=M.stats(organPieces,tribe);
  for(const key of ['harvestTime','comboSpeed','focus'])if(key==='harvestTime'?stats.harvest>0:stats[key]>0)base[key]=organStats[key];
  return {stats,base};
}

export function renderDnaDesignStats(container, stats, base, showScale) {
  const rows = [
    ["health", "체력", ""], ["meleePower", "근접 공격력", ""], ["rangedPower", "원거리 공격력", ""], ["hits", "공격횟수", "회"], ["meleeSpeed", "근접 공속", "/초"], ["rangedSpeed", "원거리 공속", "/초"],
    ["armor", "방어", ""], ["parry", "패링", "%"], ["block", "블록", "%"], ["evasion", "회피", "%"],
    ["capacity", "운반", "개"], ["harvest", "채집량", "개"], ["harvestTime", "채집 시간", "초"], ["movement", "이동", "칸/초"],
    ["lifespan", "수명", "분"], ["vision", "시야", "칸"], ["comboPower", "연격숙련", "%"], ["critical", "치명", "%"], ["criticalPower", "치명위력", "%"],
    ["accuracy", "정밀", "%"], ["penetration", "예리함", ""], ["blockPower", "방어숙련", "%"], ["counter", "반격", "%"],
    ["counterPower", "반격위력", "%"], ["tenacity", "강인함", "%"], ["reduction", "완충", "%"],
    ["stun", "기절", "%"], ["stunTime", "기절연장", "초"], ["bleed", "출혈", "%"],
    ["bleedPower", "출혈강도", ""], ["area", "범위공격", "칸"], ["areaPower", "확산위력", "%"], ["lifesteal", "흡혈", "%"],
    ["reflection", "반사", "%"], ["regeneration", "비전투 총회복", "/초"], ["comboSpeed", "연타 간격", "초"], ["focus", "공격 준비", "초"],
    ["scale", "크기", "배"], ["melee", "칼날", ""], ["ranged", "분비기관", ""], ["hunting", "안테나", ""]
  ];
  const format = value => String(Number(value.toFixed(3)));
  const fragment = document.createDocumentFragment();
  const highlighted = new Set((container.dataset.dnaHoverStats || "").split(" "));
  for (const [key, label, unit] of rows) {
    if (key === "scale" && !showScale) continue;
    if (stats[key] === undefined || base[key] === undefined) continue;
    const divisor = key === "lifespan" ? 60 : 1;
    const value = key === "regeneration" ? totalRecoveryRate(stats.health, stats.regeneration) : Number(stats[key]) / divisor;
    const initial = key === "regeneration" ? totalRecoveryRate(base.health, base.regeneration) : Number(base[key]) / divisor;
    if (initial === 0 && value === 0) continue;
    const term = document.createElement("dt");
    term.textContent = label;
    term.dataset.stat = key;
    const description = document.createElement("dd");
    description.dataset.stat = key;
    if (key === "regeneration") {
      term.title = description.title = '기본 '+format(basicRecoveryRate(stats.health))+'/초 + 추가 '+format(stats.regeneration)+
        '/초. 공격·피격·교전 종료 후 '+UNIT_RECOVERY_RULES.delay+'초부터 회복하며, 전투·출혈 중에는 회복하지 않습니다.';
    }
    const difference = Number((value - initial).toFixed(3));
    term.className = (difference !== 0 ? "design-stat-changed" : "") + (highlighted.has(key) ? " design-stat-highlight" : "");
    description.className = highlighted.has(key) ? "design-stat-highlight" : "";
    const result = document.createElement("span");
    result.className = "design-stat-value" + (difference !== 0 ? " design-stat-changed" : "");
    result.textContent = format(value) + unit;
    description.append(result);
    if (difference !== 0) {
      const delta = document.createElement("span");
      delta.className = "design-stat-delta";
      delta.textContent = " (" + (difference > 0 ? "+" : "") + format(difference) + ")";
      description.append(delta);
    }
    fragment.append(term, description);
  }
  container.replaceChildren(fragment);
}

export const dnaGeneNames={lifespan:'수명',blade:'칼날',carapace:'갑각',antenna:'안테나',gather:'채집기관',legs:'다리',power:'근접 공격력',combo:'연타',speed:'근접 공속',comboPower:'연격숙련',critical:'치명',criticalPower:'치명위력',accuracy:'정밀',penetration:'예리함',health:'체력',armor:'경화',evasion:'회피',parry:'패링',block:'방어본능',blockPower:'방어숙련',counter:'반격',counterPower:'반격위력',tenacity:'강인함',reduction:'완충',movement:'이속',capacity:'운반',harvest:'채집량',harvestSpeed:'채집속도',vision:'시야',loadSpeed:'하중적응',stun:'기절',stunTime:'기절연장',bleed:'출혈',bleedPower:'출혈강도',area:'범위공격',areaPower:'확산위력',lifesteal:'흡혈',reflection:'반사',regeneration:'재생',comboSpeed:'연타속도',focus:'집중',secretion:'분비기관',rangedPower:'원거리 공격력',rangedSpeed:'원거리 공속'};

export function dnaEditorViewport(M,level,start,gene,width,height) {
  const radius=M.boardRadius(level),halfWidth=34*Math.sqrt(3)*(radius+.5)+28,halfHeight=51*radius+62;
  const scale=Math.max(.01,Math.min(Math.max(1,width-40)/(halfWidth*2),Math.max(1,height-150)/(halfHeight*2)));
  return {scale,x:width/2,y:66+(height-150)/2};
}

function dnaWorld(point) {return {x:34*Math.sqrt(3)*(point.q+point.r/2),y:51*point.r};}
function dnaHex(point,radius) {return Array.from({length:6},(_,index)=>{const angle=(60*index-30)*Math.PI/180;return {x:point.x+radius*Math.cos(angle),y:point.y+radius*Math.sin(angle)};});}
function dnaOutline(points) {
  const edges=new Map();
  for(const cell of points){const vertices=dnaHex(dnaWorld(cell),34);for(let index=0;index<6;index++){const a=vertices[index],b=vertices[(index+1)%6],key=[a,b].map(p=>Math.round(p.x*1000)+','+Math.round(p.y*1000)).sort().join(':');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
  return [...edges.values()];
}
function dnaLinks(points) {
  const links=[],visited=new Set([0]);
  while(visited.size<points.length){let found=false;for(const index of [...visited].reverse()){if(found)break;for(let next=0;next<points.length;next++){if(visited.has(next))continue;const q=points[next].q-points[index].q,r=points[next].r-points[index].r;if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))!==1)continue;links.push([index,next]);visited.add(next);found=true;break;}}if(!found)break;}
  return links;
}
function dnaChains(points) {
  const links=dnaLinks(points),neighbors=points.map(()=>[]),visited=new Set(),chains=[];
  for(const [a,b] of links){neighbors[a].push(b);neighbors[b].push(a);}
  for(let start=0;start<points.length;start++){if(neighbors[start].length===2)continue;for(const next of neighbors[start]){let previous=start,current=next;const chain=[dnaWorld(points[start])];if(visited.has([start,next].sort().join(',')))continue;while(true){visited.add([previous,current].sort().join(','));chain.push(dnaWorld(points[current]));if(neighbors[current].length!==2)break;const following=neighbors[current].find(index=>index!==previous);previous=current;current=following;}chains.push(chain);}}
  return chains;
}
function dnaStrands(points) {
  const samples=[],one=[],two=[],rungs=[];
  for(let edge=0;edge<points.length-1;edge++){
    const a=points[Math.max(0,edge-1)],b=points[edge],c=points[edge+1],d=points[Math.min(points.length-1,edge+2)];
    for(let index=0;index<24;index++){const t=index/24,t2=t*t,t3=t2*t,point={};for(const axis of ['x','y'])point[axis]=.5*(2*b[axis]+(-a[axis]+c[axis])*t+(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t2+(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t3);samples.push(point);}
  }
  samples.push(points[points.length-1]);let distance=0;
  for(let index=0;index<samples.length;index++){const p=samples[index],before=samples[Math.max(0,index-1)],after=samples[Math.min(samples.length-1,index+1)],length=Math.hypot(after.x-before.x,after.y-before.y);distance+=Math.hypot(p.x-before.x,p.y-before.y);const wave=Math.sin(distance*Math.PI/23)*10,nx=-(after.y-before.y)/length,ny=(after.x-before.x)/length;one.push({x:p.x+nx*wave,y:p.y+ny*wave});two.push({x:p.x-nx*wave,y:p.y-ny*wave});if(index%3===0)rungs.push([one[index],two[index]]);}
  return {one,two,rungs};
}
function dnaCellsSvg(points,color) {
  const path=line=>line.map((p,index)=>(index?'L':'M')+p.x+','+p.y).join('');
  return points.map(point=>'<polygon points="'+dnaHex(dnaWorld(point),32).map(p=>p.x+','+p.y).join(' ')+'" fill="'+color+'" fill-opacity=".08"/>').join('')+dnaChains(points).map(chain=>{const strands=dnaStrands(chain);return '<path d="'+strands.rungs.map(path).join('')+'" fill="none" stroke="'+color+'" stroke-opacity=".65" stroke-width="1.7"/><path d="'+path(strands.two)+'" fill="none" stroke="'+color+'" stroke-opacity=".65" stroke-width="2.8" stroke-linecap="round"/><path d="'+path(strands.one)+'" fill="none" stroke="'+color+'" stroke-width="3.5" stroke-linecap="round"/>';}).join('');
}
export function dnaGeneShapeSvg(M,gene) {
  const points=M.pieceCells({gene:gene.id,q:0,r:0,rotation:0}),world=points.map(dnaWorld),minX=Math.min(...world.map(p=>p.x))-14,maxX=Math.max(...world.map(p=>p.x))+14,minY=Math.min(...world.map(p=>p.y))-14,maxY=Math.max(...world.map(p=>p.y))+14;
  const scale=Math.min(40/(maxX-minX),34/(maxY-minY));
  return '<g transform="translate(22 19) scale('+scale+') translate('+(-(minX+maxX)/2)+' '+(-(minY+maxY)/2)+')">'+dnaCellsSvg(points,gene.fillColor)+'</g>';
}

export function renderDnaComposition(container,M,dna) {
  const value=M.validate(dna);if(!value){container.replaceChildren();return;}
  const fragment=document.createDocumentFragment(),board=document.createElementNS('http://www.w3.org/2000/svg','svg'),radius=M.boardRadius(value.level);
  board.classList.add('unit-dna-board');board.setAttribute('viewBox',[-34*Math.sqrt(3)*(radius+.6),-51*radius-40,68*Math.sqrt(3)*(radius+.6),102*radius+80].join(' '));board.setAttribute('role','img');board.setAttribute('aria-label','DNA');
  board.innerHTML=M.boardCells(value.level).map(point=>'<polygon points="'+dnaHex(dnaWorld(point),32).map(p=>p.x+','+p.y).join(' ')+'" fill="#182c28" stroke="#3a5248" stroke-width="1"/>').join('')+value.pieces.map(piece=>'<g data-gene="'+piece.gene+'">'+dnaCellsSvg(M.pieceCells(piece),M.lookup.get(piece.gene).fillColor)+'</g>').join('');
  fragment.append(board);
  const list=document.createElement('div');list.className='unit-dna-list';const counts=M.counts(value.pieces);
  for(const gene of M.genes){if(!counts[gene.id])continue;const item=document.createElement('span');item.className='unit-dna-gene';item.dataset.gene=gene.id;item.dataset.category=gene.category;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 44 38');svg.setAttribute('aria-hidden','true');svg.innerHTML=dnaGeneShapeSvg(M,gene);const name=document.createElement('span');name.className='unit-dna-name';name.textContent=dnaGeneNames[gene.id];const count=document.createElement('strong');count.textContent='×'+counts[gene.id];item.append(svg,name,count);list.append(item);}
  fragment.append(list);container.replaceChildren(fragment);
}

export function createDnaEditor(container,dnaModel,onChange,onAction,statsContainer) {
  const M=dnaModel,names=dnaGeneNames,root=document.createElement('section');root.className='dna-editor';root.tabIndex=0;
  root.innerHTML='<div class="dna-board"><canvas aria-label="DNA 편집 영역" tabindex="0"></canvas><div class="dna-legend" hidden></div><div class="dna-tools"></div><details class="dna-guide"><summary aria-label="조작 안내"></summary><div class="dna-guide-grid"></div></details><output class="dna-status dna-organ-limit" aria-live="polite" hidden></output><output class="dna-placement" aria-live="polite" hidden></output><output class="dna-cost">비용 <strong></strong></output></div><aside class="dna-catalog"><div class="dna-filters"></div><div class="dna-list"></div></aside><div class="dna-dock"><div class="dna-rotation"></div><button class="dna-add" type="button" aria-label="조각 추가"></button></div>';
  container.replaceChildren(root);
  const find=selector=>root.querySelector(selector),canvas=find('canvas'),board=find('.dna-board'),context=canvas.getContext('2d');
  const sound=typeof onAction==='function'?null:createDnaAudio(),playSound=onAction||sound.play;
  const tooltip=document.createElement('div');tooltip.className='control-tooltip dna-piece-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;root.append(tooltip);
  const view={x:0,y:0,scale:1,width:0,height:0};
  let hoveredPiece=null;
  const panKeys=new Set();let panTime=0;
  let tribe, pieces=[],level=1,budget=0,readOnly=false,contextSet=false,filter='all',selected=M.catalog[0].id,rotation=0,anchor={q:0,r:0},moving=-1,history=[],future=[],model=M.trace([],1),preview,frame=0,destroyed=false,pointer=null,hover=null,keyboardPlacement=false,warningGene=null,boardFull=false,offset=null,cursor=null;
  function button(parent,label,glyph,action){const element=document.createElement('button');element.type='button';element.title=label;element.setAttribute('aria-label',label);element.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+glyph+'"/></svg>';element.onclick=action;parent.append(element);return element;}
  const undoButton=button(find('.dna-tools'),'되돌리기','M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',undo);
  const redoButton=button(find('.dna-tools'),'다시 실행','m15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12',redo);
  const removeButton=button(find('.dna-tools'),'조각 삭제','M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 10v7m4-7v7',remove);
  const clearButton=button(find('.dna-tools'),'초기화','M5 10a8 8 0 1 1 1 8M5 4v6h6',()=>{if(readOnly||!pieces.length)return;checkpoint();pieces=[];moving=-1;changed('remove');});
  const leftButton=button(find('.dna-rotation'),'왼쪽 회전','m8 3-5 5 5 5M3 8h10a7 7 0 1 1-6 11',()=>rotate(-1));
  const rightButton=button(find('.dna-rotation'),'오른쪽 회전','m16 3 5 5-5 5m5-5H11a7 7 0 1 0 6 11',()=>rotate(1));
  const icon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
  const mouse=part=>'<svg class="dna-input-mouse" viewBox="0 0 24 28" aria-hidden="true"><rect x="5" y="2" width="14" height="24" rx="7"/><path d="M5 12h14M12 2v10"/>'+({left:'<path class="dna-input-active" d="M11 3a6 6 0 0 0-5 6v2h5Z"/>',right:'<path class="dna-input-active" d="M13 3a6 6 0 0 1 5 6v2h-5Z"/>',middle:'<rect class="dna-input-active" x="10" y="5" width="4" height="8" rx="2"/>',wheel:'<path d="m2 5 2-3 2 3M4 2v7m14 14 2 3 2-3m-2 3v-7"/>'}[part]||'')+'</svg>';
  const key=value=>'<kbd>'+value+'</kbd>';
  find('.dna-guide summary').innerHTML=mouse('middle');
  find('.dna-guide-grid').innerHTML=[
    ['DNA 선택','M4 3v16l4-4 4 6 3-2-4-6h6Z',mouse('left')+mouse('middle')],
    ['회전·배치','m8 3-5 5 5 5M3 8h10a7 7 0 1 1-6 11',mouse('wheel')+key('Q')+key('E')],
    ['회전·배치','M5 3h14v18H5ZM8 12h8m-4-4v8',mouse('left')+key('↵')],
    ['이동·삭제','M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',mouse('left')+icon('M3 12h18m-4-4 4 4-4 4M7 8l-4 4 4 4')],
    ['이동·삭제','M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 10v7m4-7v7',mouse('left')],
    ['선택 취소','m6 6 12 12M6 18 18 6',mouse('right')],
    ['되돌리기','M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',key('Ctrl')+key('Z')],
    ['다시 실행','m15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12',key('Ctrl')+key('Y')]
  ].map(([label,path,input])=>'<div class="dna-guide-item" aria-label="'+label+'">'+icon(path)+'<span class="dna-guide-input">'+input+'</span></div>').join('');
  const addButton=find('.dna-add');addButton.innerHTML=icon('M12 5v14M5 12h14')+key('↵');addButton.onclick=commit;
  for(const element of [undoButton,redoButton,removeButton,clearButton,leftButton,rightButton,addButton])element.dataset.dnaSound='true';
  function getDesign(){return {version:6,pieces:pieces.map(M.clonePiece),level,budget};}
  function snapshot(){return pieces.map(M.clonePiece);}
  function checkpoint(){history.push(snapshot());if(history.length>200)history.shift();future=[];}
  function clearHistory(){history=[];future=[];renderControls();}
  function candidate(){
    if(!selected)return {piece:null,pieces:snapshot(),result:model,valid:false,reason:''};
    const gene=M.lookup.get(selected),piece={gene:selected,grade:moving>=0?pieces[moving].grade:gene.grade,rotation,q:anchor.q,r:anchor.r},proposed=pieces.map(M.clonePiece);
    if(moving>=0)proposed[moving]=piece;else proposed.push(piece);
    const result=M.trace(proposed,level);
    if(gene.category==='organ'&&pieces.some((other,index)=>index!==moving&&other.gene===selected)){result.valid=false;result.reason='organ-limit';}
    if(moving<0&&geneCapped(selected)){result.valid=false;result.reason='stat-cap';}
    return {piece,pieces:proposed,result,valid:result.valid,reason:result.reason};
  }
  function organBlocked(id){return M.lookup.get(id)?.category==='organ'&&pieces.some((piece,index)=>piece.gene===id&&index!==moving);}
  function geneCapped(id){return !(moving>=0&&pieces[moving].gene===id)&&dnaGeneCapped(M,pieces,id,tribe);}
  function geneFits(gene){
    const occupied=new Set(pieces.flatMap((piece,index)=>index===moving&&piece.gene===gene.id?[]:M.pieceCells(piece)).map(M.key));
    const available=new Set(M.boardCells(level).filter(cell=>!occupied.has(M.key(cell))).map(M.key));
    if(gene.grade>level||organBlocked(gene.id)||gene.cells.length>available.size)return false;
    return M.boardCells(level).some(cell=>Array.from({length:6},(_,rotation)=>rotation).some(rotation=>M.pieceCells({gene:gene.id,rotation,q:cell.q,r:cell.r}).every(point=>available.has(M.key(point)))));
  }
  function hasPlacement(){
    const cells=M.boardCells(level),available=new Set(cells.filter(cell=>!model.occupied.has(M.key(cell))).map(M.key));
    for(const gene of M.catalog){if(gene.grade>level||organBlocked(gene.id)||geneCapped(gene.id)||gene.cells.length>available.size)continue;for(const cell of cells)for(let rotation=0;rotation<6;rotation++)if(M.pieceCells({gene:gene.id,rotation,q:cell.q,r:cell.r}).every(point=>available.has(M.key(point))))return true;}
    return false;
  }
  function state(){hoveredPiece=null;model=M.trace(pieces,level);preview=candidate();boardFull=model.valid&&!hasPlacement();renderCatalog();renderLegend();renderControls();requestDraw();}
  function changed(action){state();if(typeof onChange==='function')onChange(getDesign());playSound(action);}
  function renderLegend(){
    const legend=find('.dna-legend'),counts=M.counts(pieces),stats=M.stats(pieces,tribe);
    const keys={blade:'meleePower',secretion:'rangedPower',gather:'harvest',carapace:'armor',legs:'evasion',power:'meleePower',speed:'meleeSpeed',combo:'hits',harvestSpeed:'harvestTime'};
    const units={lifespan:'분',hits:'회',meleeSpeed:'/초',rangedSpeed:'/초',capacity:'개',harvest:'개',harvestTime:'초',movement:'칸/초',vision:'칸',stunTime:'초',area:'칸',regeneration:'/초',comboSpeed:'초',focus:'초'};
    const percentages=['parry','block','evasion','comboPower','critical','criticalPower','accuracy','blockPower','counter','counterPower','tenacity','reduction','stun','bleed','areaPower','lifesteal','reflection'];
    const labels={meleePower:'근접 공격력',rangedPower:'원거리 공격력',meleeSpeed:'근접 공속',rangedSpeed:'원거리 공속',hits:'공격횟수',harvestTime:'채집 시간',movement:'이동',armor:'방어',evasion:'회피'};
    const unlocks={gather:'채집 기능 해금',blade:'근접 선제 공격 기능 해금',secretion:'원거리 선제 공격 기능 해금'};
    legend.replaceChildren();
    for(const gene of [...M.catalog,...M.genes.filter(gene=>gene.retired)]){
      if(!counts[gene.id])continue;
      const item=document.createElement('span');item.dataset.gene=gene.id;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 44 38');
      svg.innerHTML=dnaGeneShapeSvg(M,gene);const last=pieces.findIndex(piece=>piece.gene===gene.id);item.title=dnaGeneTooltip(M,pieces.filter((_,index)=>index!==last),gene.id,tribe,names).replace('현재 설계에 1개 추가 시:','배치된 조각 1개의 효과:');item.tabIndex=0;
      const count=document.createElement('span');count.textContent='×'+counts[gene.id];
      const key=keys[gene.id]||gene.id,without=M.stats(pieces.filter(piece=>piece.gene!==gene.id),tribe);
      const difference=Number(((stats[key]-without[key])/(key==='lifespan'?60:1)).toFixed(3)),unit=units[key]||(percentages.includes(key)?'%':'');
      const effect=gene.id==='harvestSpeed'?labels.harvestTime+' -'+stats.harvestReduction+'%':unlocks[gene.id]||((labels[key]||names[gene.id])+' '+(difference>=0?'+':'')+difference+unit);
      const delta=document.createElement('span');delta.className='dna-legend-delta';delta.textContent=' ('+effect+')';
      item.append(svg,count);if(gene.id!=='antenna')item.append(delta);legend.append(item);
    }
    legend.hidden=!legend.children.length;
  }
  function renderCatalog(){
    warningGene=null;
    const available=new Set(M.catalog.filter(gene=>gene.grade<=level).map(gene=>gene.group));
    if(filter!=='all'&&!available.has(filter))filter='all';
    const filters=find('.dna-filters');filters.replaceChildren();
    for(const [type,label,id] of [['all','전체'],['gathering','채집','gather'],['other','기타','health'],['melee','근거리','blade'],['ranged','원거리','secretion'],['defense','방어','carapace']]){const item=document.createElement('button');item.type='button';item.textContent=label;item.dataset.category=type;item.disabled=type==='all'?available.size===0:!available.has(type);if(id)item.style.setProperty('--dna-filter-color',M.lookup.get(id).fillColor);item.setAttribute('aria-pressed',String(filter===type));item.onclick=()=>{if(item.disabled)return;filter=type;renderCatalog();root.focus({preventScroll:true});};filters.append(item);}
    const list=find('.dna-list');list.replaceChildren();
    for(const gene of M.catalog){
      if(gene.grade>level||(filter!=='all'&&gene.group!==filter))continue;
      const item=document.createElement('button');item.type='button';item.className='dna-gene';const blocked=organBlocked(gene.id),capped=geneCapped(gene.id),fits=geneFits(gene),available=!readOnly&&!blocked&&!capped&&fits;
      const availability=readOnly?'읽기 전용':blocked?'이미 배치됨':capped?'':!fits?'공간 부족':'배치 가능';
      item.setAttribute('aria-label',names[gene.id]+(availability?' · '+availability:''));item.title=dnaGeneTooltip(M,pieces,gene.id,tribe,names)+(available||!availability?'':'\n'+availability);item.dataset.gene=gene.id;item.dataset.category=gene.category;if(gene.category==='organ')item.dataset.placed=String(pieces.some(piece=>piece.gene===gene.id));item.disabled=false;item.setAttribute('aria-disabled',String(!available));item.dataset.blocked=String(blocked||capped||!fits);item.dataset.availability=available?'available':'blocked';item.setAttribute('aria-pressed',String(selected===gene.id));item.style.setProperty('--dna-gene-color',gene.fillColor);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 44 38');svg.innerHTML=dnaGeneShapeSvg(M,gene);
      const name=document.createElement('strong');name.textContent=names[gene.id];const cost=document.createElement('span');cost.className='dna-gene-cost';cost.textContent=String(M.piecePrice({gene:gene.id,grade:gene.grade}));const badge=document.createElement('small');badge.className='dna-gene-availability';badge.textContent=(available?'✓ ':'× ')+availability;item.append(svg,name,cost,badge);
      item.addEventListener('pointerenter',()=>{if(blocked){warningGene=gene.id;renderControls();}});item.addEventListener('pointerleave',()=>{warningGene=null;renderControls();});item.addEventListener('focus',()=>{if(blocked){warningGene=gene.id;renderControls();}});item.addEventListener('blur',()=>{warningGene=null;renderControls();});
      item.onclick=()=>{if(readOnly)return;if(blocked){warningGene=gene.id;renderControls();return;}if(capped||!fits)return;moving=-1;offset=null;selected=gene.id;rotation=0;state();root.focus({preventScroll:true});};list.append(item);
    }
  }
  function renderPieceHover(){
    const index=hover&&!pointer&&moving<0&&!offset?model.occupied.get(M.key(hover))?.index:-1,piece=pieces[index]||null;
    if(piece!==hoveredPiece||!piece){
      hoveredPiece=piece;
      const baseline=piece?pieces.filter((_,at)=>at!==index):[],keys=[];
      if(piece){
        tooltip.textContent=dnaGeneTooltip(M,baseline,piece.gene,tribe,names);
        const before=M.stats(baseline,tribe),after=M.stats(pieces,tribe);
        for(const key of Object.keys(after)){
          const a=key==='regeneration'?totalRecoveryRate(before.health,before.regeneration):before[key],b=key==='regeneration'?totalRecoveryRate(after.health,after.regeneration):after[key];
          if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(b-a)>1e-9)keys.push(key);
        }
      }
      if(statsContainer){statsContainer.dataset.dnaHoverStats=keys.join(' ');for(const row of statsContainer.querySelectorAll('[data-stat]'))row.classList.toggle('design-stat-highlight',keys.includes(row.dataset.stat));}
    }
    tooltip.hidden=!piece;
    if(piece&&cursor)globalThis.SpawnerTooltips?.position(tooltip,{getBoundingClientRect:()=>({left:cursor.clientX-8,right:cursor.clientX+8,top:cursor.clientY-8,bottom:cursor.clientY+8,width:16,height:16})});
  }
  function renderControls(){
    renderPieceHover();
    addButton.disabled=readOnly||!preview.valid;leftButton.disabled=readOnly||!selected;rightButton.disabled=readOnly||!selected;undoButton.disabled=readOnly||!history.length;redoButton.disabled=readOnly||!future.length;removeButton.disabled=readOnly||!pieces.length;clearButton.disabled=readOnly||!pieces.length;
    const duplicate=warningGene&&organBlocked(warningGene)?warningGene:preview.reason==='organ-limit'?selected:null,status=find('.dna-status'),active=!(pointer?.panning&&pointer.moved)&&(hover||moving>=0||keyboardPlacement);
    const reason=duplicate?'organ-limit':!model.valid?model.reason:boardFull&&moving<0?'full':active?preview.reason:'';
    const labels={full:'꽉 찼습니다',collision:'경로가 겹칩니다',boundary:'판을 벗어납니다',level:'둥지 레벨이 부족합니다'};
    status.textContent=duplicate?names[duplicate]+(names[duplicate].endsWith('기관')?'은':' 기관은')+' 하나만 배치할 수 있습니다':labels[reason]||'';status.hidden=readOnly||!status.textContent;status.dataset.kind=reason;
    const placement=find('.dna-placement'),occupied=hover?model.occupied.get(M.key(hover))?.index:-1;
    const showing=!readOnly&&preview.piece&&active&&(moving>=0||offset||occupied===undefined||occupied===-1);
    canvas.style.cursor=pointer?.panning&&pointer.moved?'grabbing':readOnly||moving<0&&(occupied===undefined||occupied===-1)?'grab':'default';
    placement.hidden=!showing;placement.dataset.state=preview.valid?'available':'blocked';
    placement.textContent=preview.valid?'✓ 배치 가능':preview.reason==='stat-cap'?'× 배치 불가':'× 배치 불가 · '+(duplicate?'같은 기관은 하나만':labels[preview.reason]||'공간을 확인해 주세요');
    canvas.setAttribute('aria-label','DNA 편집 영역'+(showing?' · '+placement.textContent:''));
    find('.dna-cost strong').textContent=String(M.cost(pieces));root.dataset.readonly=String(readOnly);root.dataset.preview=String(preview.valid);root.dataset.filled=String(model.filled);root.dataset.total=String(model.total);root.dataset.moving=String(moving);root.dataset.anchor=anchor.q+','+anchor.r;
  }
  function requestDraw(){if(!frame&&!destroyed)frame=requestAnimationFrame(time=>{
    if(destroyed)return;
    if(root.getClientRects?.().length===0)stopPan();
    if(panKeys.size){
      const dx=Number(panKeys.has('d'))-Number(panKeys.has('a')),dy=Number(panKeys.has('s'))-Number(panKeys.has('w')),length=Math.hypot(dx,dy);
      const distance=420*Math.min(.05,panTime?(time-panTime)/1000:1/60);panTime=time;
      if(length)panBy(dx/length*distance,dy/length*distance);
    }
    frame=0;draw();if(panKeys.size)requestDraw();
  });}
  function stopPan(){panKeys.clear();panTime=0;}
  function panBy(dx,dy){
    if(!view.width||!view.height)return;
    const radius=M.boardRadius(level),halfWidth=34*Math.sqrt(3)*(radius+.5)*view.scale,halfHeight=(51*radius+34)*view.scale;
    view.x=Math.max(48-halfWidth,Math.min(view.width-48+halfWidth,view.x+dx));
    view.y=Math.max(48-halfHeight,Math.min(view.height-48+halfHeight,view.y+dy));
    if(hover&&cursor)pointAt(cursor);else requestDraw();
  }
  function screen(point){const p=dnaWorld(point);return {x:p.x*view.scale+view.x,y:p.y*view.scale+view.y};}
  function polygon(points){context.beginPath();points.forEach((p,index)=>index?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();}
  function drawPiece(piece,alpha,color,highlight,placement){
    const cells=M.pieceCells(piece),organ=!placement&&M.lookup.get(piece.gene).category==='organ';context.save();
    context.globalAlpha=alpha*(organ?.32:.12);context.fillStyle=color;
    for(const cell of cells){polygon(dnaHex(screen(cell),32*view.scale));context.fill();}
    context.globalAlpha=alpha*(organ?.95:highlight?.8:.32);context.beginPath();for(const [a,b] of dnaOutline(cells)){context.moveTo(a.x*view.scale+view.x,a.y*view.scale+view.y);context.lineTo(b.x*view.scale+view.x,b.y*view.scale+view.y);}context.strokeStyle=organ?'#f1d58c':color;context.lineWidth=organ?3:highlight?2:1;context.stroke();context.strokeStyle=color;
    function strand(points,width,opacity){context.globalAlpha=alpha*opacity;context.beginPath();points.forEach((p,index)=>index?context.lineTo(p.x*view.scale+view.x,p.y*view.scale+view.y):context.moveTo(p.x*view.scale+view.x,p.y*view.scale+view.y));context.lineWidth=width*view.scale;context.stroke();}
    context.lineCap='round';context.lineJoin='round';
    for(const chain of dnaChains(cells)){const strands=dnaStrands(chain);for(const rung of strands.rungs)strand(rung,1.7,.65);strand(strands.two,2.8,.65);strand(strands.one,7,.12);strand(strands.one,3.5,1);}
    context.restore();
  }
  function draw(){
    context.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);context.clearRect(0,0,view.width,view.height);
    for(const cell of M.boardCells(level)){polygon(dnaHex(screen(cell),32*view.scale));context.fillStyle='#102922';context.fill();context.strokeStyle='#3a574c';context.lineWidth=1;context.stroke();}
    const hovered=hover?model.occupied.get(M.key(hover))?.index:-1;
    for(let index=0;index<pieces.length;index++)drawPiece(pieces[index],index===moving?.18:.88,M.lookup.get(pieces[index].gene).fillColor,index===hovered&&moving<0,false);
    if(!readOnly&&!(pointer?.panning&&pointer.moved)&&preview.piece&&(hover||moving>=0||keyboardPlacement)&&(moving>=0||offset||hovered===undefined||hovered===-1))drawPiece(preview.piece,.9,preview.valid?DNA_PLACEMENT_COLORS.available:DNA_PLACEMENT_COLORS.blocked,true,true);
  }
  function commit(){if(readOnly||!selected)return;const proposed=candidate();if(!proposed.valid){keyboardPlacement=!hover;preview=proposed;renderControls();requestDraw();return;}if(moving>=0&&JSON.stringify(proposed.pieces[moving])===JSON.stringify(pieces[moving])){cancel();return;}checkpoint();pieces=proposed.pieces;moving=-1;offset=null;if(M.lookup.get(selected).category==='organ'){selected=null;rotation=0;keyboardPlacement=false;}changed('place');}
  function cancel(){releasePointer();moving=-1;selected=null;rotation=0;hover=null;keyboardPlacement=false;offset=null;state();}
  function center(){const points=M.pieceCells({gene:selected,rotation,q:0,r:0}).map(dnaWorld);return {x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,y:(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2};}
  function rotate(delta){if(readOnly||!selected)return;rotation=(rotation+delta+6)%6;playSound('rotate');if(offset){offset=center();if(cursor&&hover&&!keyboardPlacement){pointAt(cursor);return;}}preview=candidate();renderControls();requestDraw();}
  function undo(){if(readOnly)return;if(moving>=0){cancel();return;}if(!history.length)return;future.push(snapshot());const next=history.pop(),action=next.length<pieces.length?'remove':'place';pieces=next;changed(action);}
  function redo(){if(readOnly||!future.length)return;history.push(snapshot());const next=future.pop(),action=next.length<pieces.length?'remove':'place';pieces=next;moving=-1;changed(action);}
  function remove(){if(readOnly||!pieces.length)return;checkpoint();pieces.splice(moving>=0?moving:pieces.length-1,1);moving=-1;offset=null;changed('remove');}
  function cycleGene(){if(readOnly)return;const items=[...find('.dna-list').children].filter(item=>!item.disabled&&item.dataset.blocked!=='true');if(!items.length)return;const index=items.findIndex(item=>item.dataset.gene===selected);items[(index+1)%items.length].onclick();}
  function fit(){
    stopPan();
    if(!view.width||!view.height)return;Object.assign(view,dnaEditorViewport(M,level,null,null,view.width,view.height));
    if(model.outside.length){const points=M.boardCells(level).concat(pieces.flatMap(M.pieceCells)).map(dnaWorld),minX=Math.min(...points.map(p=>p.x))-52,maxX=Math.max(...points.map(p=>p.x))+52,minY=Math.min(...points.map(p=>p.y))-52,maxY=Math.max(...points.map(p=>p.y))+52;view.scale=Math.max(.005,Math.min((view.width-40)/(maxX-minX),(view.height-150)/(maxY-minY)));view.x=view.width/2-(minX+maxX)*view.scale/2;view.y=66+(view.height-150)/2-(minY+maxY)*view.scale/2;}
    if(hover&&cursor)pointAt(cursor);else requestDraw();
  }
  function zoom(factor){if(!Number.isFinite(factor)||factor<=0||!view.width||!view.height)return;const next=Math.max(.005,Math.min(2.7,view.scale*factor)),ratio=next/view.scale,x=view.width/2,y=view.height/2;view.x=x-(x-view.x)*ratio;view.y=y-(y-view.y)*ratio;view.scale=next;if(hover&&cursor)pointAt(cursor);else requestDraw();}
  function resize(){const bounds=board.getBoundingClientRect();if(!bounds.width||!bounds.height||(view.width===bounds.width&&view.height===bounds.height))return;view.width=bounds.width;view.height=bounds.height;canvas.width=Math.ceil(bounds.width*devicePixelRatio);canvas.height=Math.ceil(bounds.height*devicePixelRatio);fit();}
  function eventCell(event,shift){
    const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left-view.x)/view.scale-(shift?.x||0),y=(event.clientY-bounds.top-view.y)/view.scale-(shift?.y||0),r=y/51,q=x/(34*Math.sqrt(3))-r/2;
    let rq=Math.round(q),rr=Math.round(r),rs=Math.round(-q-r);const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs+q+r);if(dq>dr&&dq>ds)rq=-rr-rs;else if(dr>ds)rr=-rq-rs;
    return {q:rq,r:rr};
  }
  function pointAt(event){cursor={clientX:event.clientX,clientY:event.clientY};keyboardPlacement=false;hover=eventCell(event);anchor=eventCell(event,offset);preview=candidate();renderControls();requestDraw();}
  function releasePointer(){const previous=pointer;pointer=null;if(previous&&canvas.hasPointerCapture?.(previous.id))canvas.releasePointerCapture(previous.id);return previous;}
  function movePointer(event){
    if(!pointer||pointer.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>4)pointer.moved=true;
    if(pointer.panning&&pointer.moved){hover=null;keyboardPlacement=false;panBy(pointer.viewX+event.clientX-pointer.x-view.x,pointer.viewY+event.clientY-pointer.y-view.y);renderControls();}
    else pointAt(event);
  }
  function cancelPointer(){const previous=releasePointer();if(!previous)return;if(previous.panning){hover=null;renderControls();requestDraw();}else cancel();}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button===1){event.preventDefault();event.stopPropagation();cycleGene();return;}if(event.button!==0||pointer)return;
    event.preventDefault();stopPan();
    root.focus({preventScroll:true});const point=eventCell(event),hit=model.occupied.get(M.key(point))?.index;let picked=false;
    const panning=readOnly||moving<0&&hit===undefined;
    if(!readOnly&&moving<0&&hit!==undefined){moving=hit;selected=pieces[hit].gene;rotation=pieces[hit].rotation;offset=center();picked=true;renderCatalog();}
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,viewX:view.x,viewY:view.y,panning,picked,moved:false};pointAt(event);canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{if(pointer){movePointer(event);return;}pointAt(event);});
  canvas.addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;movePointer(event);const previous=releasePointer();if(previous.panning&&previous.moved){hover=null;renderControls();requestDraw();return;}pointAt(event);if(readOnly)return;if(previous.picked&&!previous.moved){const pickedOffset=offset;remove();offset=pickedOffset;}else commit();});
  canvas.addEventListener('pointercancel',cancelPointer);
  canvas.addEventListener('lostpointercapture',cancelPointer);
  canvas.addEventListener('pointerleave',()=>{if(pointer)return;hover=null;renderControls();requestDraw();});
  canvas.addEventListener('auxclick',event=>{if(event.button===1){event.preventDefault();event.stopPropagation();}});
  canvas.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();event.stopPropagation();if(event.deltaY)rotate(event.deltaY>0?1:-1);},{passive:false});
  root.addEventListener('contextmenu',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();event.stopPropagation();if(!readOnly)cancel();});
  root.addEventListener('pointerdown',event=>{if(event.button===3){event.preventDefault();event.stopPropagation();undo();}});
  root.addEventListener('keydown',event=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||event.target.isContentEditable)return;const key=event.key.toLowerCase();
    const panKey=/^Key[WASD]$/.test(event.code)?event.code.slice(3).toLowerCase():key;
    if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&['w','a','s','d'].includes(panKey)){event.preventDefault();event.stopPropagation();if(!pointer){panKeys.add(panKey);requestDraw();}return;}
    if((key==='enter'||key===' ')&&event.target.closest?.('button,summary'))return;
    if((event.ctrlKey||event.metaKey)&&['z','y'].includes(key)){event.preventDefault();event.stopPropagation();key==='y'||event.shiftKey?redo():undo();return;}
    if(event.ctrlKey||event.metaKey||event.altKey||!['q','e','r','arrowleft','arrowright','arrowup','arrowdown','enter',' ','delete','backspace','browserback','f','escape'].includes(key))return;
    event.preventDefault();event.stopPropagation();if(key==='f'){fit();return;}if(readOnly)return;
    if(key==='q')rotate(-1);else if(key==='e'||key==='r')rotate(1);else if(key==='enter'||key===' ')commit();else if(key==='backspace'||key==='browserback')undo();else if(key==='escape')cancel();else if(key==='delete')remove();else {anchor={q:anchor.q+(key==='arrowleft'?-1:key==='arrowright'?1:0),r:anchor.r+(key==='arrowup'?-1:key==='arrowdown'?1:0)};hover=null;keyboardPlacement=true;preview=candidate();renderControls();requestDraw();}
  });
  root.addEventListener('keyup',event=>{const key=/^Key[WASD]$/.test(event.code)?event.code.slice(3).toLowerCase():event.key.toLowerCase();if(!panKeys.delete(key))return;event.preventDefault();event.stopPropagation();if(!panKeys.size)panTime=0;});
  root.addEventListener('focusout',blur);
  function blur(){stopPan();cancelPointer();hover=null;renderPieceHover();}
  globalThis.addEventListener?.('blur',blur);
  const dialog=root.closest?.('dialog');dialog?.addEventListener('close',blur);
  const observer=new ResizeObserver(resize);observer.observe(board);state();resize();
  return {
    load(design,locked){const value=M.validate(design);if(!value)return false;releasePointer();stopPan();pieces=value.pieces.map(M.clonePiece);if(!contextSet){level=value.level;budget=value.budget;}readOnly=locked===true;history=pieces.map((_,index)=>pieces.slice(0,index).map(M.clonePiece));future=[];moving=-1;hover=null;keyboardPlacement=false;anchor={q:0,r:0};offset=null;selected=M.catalog.find(gene=>gene.grade<=level&&!(gene.category==='organ'&&pieces.some(piece=>piece.gene===gene.id)))?.id||M.catalog[0].id;rotation=0;state();fit();return true;},
    context(nextLevel,nextBudget,locked,nextTribe){const previousLevel=level,previousBudget=budget,previousReadOnly=readOnly,previousTribe=tribe;tribe=nextTribe;if(Number.isInteger(nextLevel)&&nextLevel>=1&&nextLevel<=4)level=nextLevel;if(Number.isFinite(nextBudget)&&nextBudget>=0)budget=Math.floor(nextBudget);contextSet=true;readOnly=locked===true;if(previousLevel===level&&previousBudget===budget&&previousReadOnly===readOnly&&previousTribe===tribe)return;if(previousLevel!==level||previousReadOnly!==readOnly){releasePointer();stopPan();}if(readOnly||M.lookup.get(selected)?.grade>level){moving=-1;selected=M.catalog[0].id;}state();if(previousLevel!==level)fit();},
    getDesign,clearHistory,fit,zoom,
    destroy(){destroyed=true;hover=null;renderPieceHover();stopPan();releasePointer();globalThis.removeEventListener?.('blur',blur);dialog?.removeEventListener('close',blur);sound?.destroy();observer.disconnect();if(frame)cancelAnimationFrame(frame);root.remove();}
  };
}
