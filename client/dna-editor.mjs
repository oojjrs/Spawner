import { dnaPartRange, dnaPartAppend, dnaPartValidate } from './dna-parts.mjs';

export function dnaDesignStats(M,pieces) {
  const stats=M.stats(pieces),base={...M.stats([])},organPieces=pieces.filter(piece=>M.lookup.get(piece.gene)?.category==='organ'),organStats=M.stats(organPieces);
  for(const key of ['harvestTime','comboSpeed','focus'])if(stats[key]>0)base[key]=organStats[key];
  return {stats,base};
}

export function renderDnaDesignStats(container, stats, base, showScale) {
  const rows = [
    ["health", "체력", ""], ["meleePower", "근접 공격력", ""], ["rangedPower", "원거리 공격력", ""], ["hits", "공격횟수", "회"], ["meleeSpeed", "근접 공속", "/초"], ["rangedSpeed", "원거리 공속", "/초"],
    ["armor", "방어", ""], ["parry", "패링", "%"], ["block", "블록", "%"], ["evasion", "회피", "%"],
    ["capacity", "운반", "개"], ["harvest", "채집량", "개"], ["harvestTime", "채집 시간", "초"], ["movement", "이동", "칸/초"],
    ["vision", "시야", "칸"], ["comboPower", "연격숙련", "%"], ["critical", "치명", "%"], ["criticalPower", "치명위력", "%"],
    ["accuracy", "정밀", "%"], ["penetration", "예리함", ""], ["blockPower", "방어숙련", "%"], ["counter", "반격", "%"],
    ["counterPower", "반격위력", "%"], ["tenacity", "강인함", "%"], ["reduction", "완충", "%"], ["loadSpeed", "하중적응", "%"],
    ["healing", "회복력", "%"], ["stun", "기절", "%"], ["stunTime", "기절연장", "초"], ["bleed", "출혈", "%"],
    ["bleedPower", "출혈강도", ""], ["area", "범위공격", "칸"], ["areaPower", "확산위력", "%"], ["lifesteal", "흡혈", "%"],
    ["reflection", "반사", "%"], ["regeneration", "재생", "/초"], ["comboSpeed", "연타 간격", "초"], ["focus", "공격 준비", "초"],
    ["scale", "크기", "배"], ["melee", "칼날", ""], ["ranged", "분비기관", ""], ["roaming", "안테나", ""]
  ];
  const format = value => String(Number(value.toFixed(3)));
  const fragment = document.createDocumentFragment();
  for (const [key, label, unit] of rows) {
    if (key === "scale" && !showScale) continue;
    if (stats[key] === undefined || base[key] === undefined) continue;
    const value = Number(stats[key]), initial = Number(base[key]);
    if (initial === 0 && value === 0) continue;
    const term = document.createElement("dt");
    term.textContent = label;
    term.dataset.stat = key;
    const description = document.createElement("dd");
    description.dataset.stat = key;
    const difference = Number((value - initial).toFixed(3));
    term.className = difference !== 0 ? "design-stat-changed" : "";
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

export function dnaEditorViewport(M,level,start,gene,width,height) {
  const radius=M.boardRadius(level),halfWidth=34*Math.sqrt(3)*(radius+.5),halfHeight=51*radius+34;
  let minX=-halfWidth,maxX=halfWidth,minY=-halfHeight,maxY=halfHeight;
  if(start&&gene)for(let rotation=0;rotation<6;rotation++)for(const point of M.route(start,gene,gene.grade,rotation)){
    const x=34*Math.sqrt(3)*(point.q+point.r/2),y=51*point.r;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  const margin=46,top=54,bottom=66;
  minX-=margin;maxX+=margin;minY-=margin;maxY+=margin;
  const scale=Math.max(.01,Math.min(Math.max(1,width-40)/(maxX-minX),Math.max(1,height-top-bottom)/(maxY-minY)));
  return {scale,x:width/2-(minX+maxX)*scale/2,y:top+(height-top-bottom)/2-(minY+maxY)*scale/2};
}

const dnaGeneNames={blade:'칼날',carapace:'갑각',antenna:'안테나',gather:'채집기관',legs:'다리',power:'근접 공격력',combo:'연타',speed:'근접 공속',comboPower:'연격숙련',critical:'치명',criticalPower:'치명위력',accuracy:'정밀',penetration:'예리함',health:'체력',armor:'경화',evasion:'회피',parry:'패링',block:'방어본능',blockPower:'방어숙련',counter:'반격',counterPower:'반격위력',tenacity:'강인함',reduction:'완충',movement:'이속',capacity:'운반',harvest:'채집량',harvestSpeed:'채집속도',vision:'시야',loadSpeed:'하중적응',healPower:'치유량 강화',healing:'회복력',stun:'기절',stunTime:'기절연장',bleed:'출혈',bleedPower:'출혈강도',area:'범위공격',areaPower:'확산위력',lifesteal:'흡혈',reflection:'반사',regeneration:'재생',comboSpeed:'연타속도',focus:'집중',healer:'치유기관',secretion:'분비기관',rangedPower:'원거리 공격력',rangedSpeed:'원거리 공속'};

function dnaGeneShape(M,gene){const points=M.route({q:0,r:0},gene,gene.grade,0).map(point=>({x:34*Math.sqrt(3)*(point.q+point.r/2),y:51*point.r})),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),scale=Math.min(30/Math.max(1,maxX-minX),24/Math.max(1,maxY-minY));return points.map(p=>[(p.x-(minX+maxX)/2)*scale+22,(p.y-(minY+maxY)/2)*scale+19]);}

function dnaGeneShapeSvg(M,gene){const points=dnaGeneShape(M,gene),organ=gene.category==='organ';return '<polyline points="'+points.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="'+gene.color+'" stroke-width="'+(organ?4.5:2)+'" stroke-linejoin="round"/>'+points.slice(1,-1).map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(organ?3:1.8)+'" fill="#fff" stroke="none"/>').join('')+'<circle cx="'+points[0][0]+'" cy="'+points[0][1]+'" r="'+(organ?5:4)+'" fill="#14252a" stroke="'+gene.color+'" stroke-width="1.5"/><circle cx="'+points[points.length-1][0]+'" cy="'+points[points.length-1][1]+'" r="'+(organ?5:4)+'" fill="#14252a" stroke="'+gene.color+'" stroke-width="1.5"/>';}

export function renderDnaComposition(container, M, dna) {
  const fragment = document.createDocumentFragment();
  const model = M.trace(dna.pieces, dna.level);
  const world = point => ({ x: 34 * Math.sqrt(3) * (point.q + point.r / 2), y: 51 * point.r });
  const nodes = model.nodes.map(world);
  const points = [...nodes, ...model.paths.flatMap(path => path.points.map(world))];
  const minX = Math.min(...points.map(point => point.x)) - 22, maxX = Math.max(...points.map(point => point.x)) + 22;
  const minY = Math.min(...points.map(point => point.y)) - 22, maxY = Math.max(...points.map(point => point.y)) + 22;
  const board = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  board.classList.add('unit-dna-board');
  board.setAttribute('viewBox', [minX, minY, maxX - minX, maxY - minY].join(' '));
  board.setAttribute('role', 'img');
  board.setAttribute('aria-label', 'DNA');
  board.innerHTML = model.paths.map(path => {
    const gene = M.lookup.get(path.gene), organ = gene.category === 'organ';
    return '<polyline data-gene="' + gene.id + '" points="' + path.points.map(world).map(point => point.x + ',' + point.y).join(' ') + '" fill="none" stroke="' + gene.color + '" stroke-width="' + (organ ? 7 : 4) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
      path.points.slice(1, -1).map(world).map(point => '<circle cx="' + point.x + '" cy="' + point.y + '" r="' + (organ ? 4 : 2.5) + '" fill="#fff"/>').join('');
  }).join('') + nodes.map((point, index) => '<circle cx="' + point.x + '" cy="' + point.y + '" r="6" fill="' + (index === 0 ? '#e8f0e9' : '#14252a') + '" stroke="#9fcab6" stroke-width="2"/>').join('');
  fragment.append(board);
  const list = document.createElement('div');
  list.className = 'unit-dna-list';
  const counts = M.counts(dna.pieces);
  for (const gene of [...M.catalog,...M.genes.filter(gene=>gene.retired)]) {
    if (!counts[gene.id]) continue;
    const item = document.createElement('span');
    item.className = 'unit-dna-gene';
    item.dataset.gene = gene.id;
    item.dataset.category = gene.category;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 44 38');
    svg.setAttribute('aria-hidden', 'true');
    const piece = dna.pieces.find(piece=>piece.gene===gene.id);
    svg.innerHTML = dnaGeneShapeSvg(M, {...gene,grade:piece.grade===undefined?gene.grade:piece.grade,steps:piece.shape||gene.steps});
    const name = document.createElement('span');
    name.className = 'unit-dna-name';
    name.textContent = dnaGeneNames[gene.id];
    const count = document.createElement('strong');
    count.textContent = '×' + counts[gene.id];
    item.append(svg, name, count);
    list.append(item);
  }
  fragment.append(list);
  container.replaceChildren(fragment);
}

export function createDnaEditor(container, dnaModel, onChange) {
  const M=dnaModel;
  const names=dnaGeneNames;
  const root=document.createElement('section');root.className='dna-editor';root.tabIndex=0;
  root.innerHTML='<div class="dna-board"><canvas aria-label="DNA 편집 영역" tabindex="0"></canvas><div class="dna-legend" hidden></div><div class="dna-tools"></div><details class="dna-guide"><summary>조작 안내</summary><dl><dt>DNA 선택</dt><dd><kbd>휠 클릭</kbd></dd><dt>회전</dt><dd><kbd>휠 위·아래 / Q·E</kbd></dd><dt>배치</dt><dd><kbd>좌클릭 / Enter</kbd></dd><dt>되돌리기</dt><dd><kbd>우클릭 / Ctrl+Z</kbd></dd></dl></details><output class="dna-status dna-organ-limit" aria-live="polite" hidden></output><output class="dna-cost">비용 <strong></strong></output></div><aside class="dna-catalog"><div class="dna-filters"></div><div class="dna-list"></div></aside><div class="dna-dock"><div class="dna-rotation"></div><button class="dna-add" type="button">조각 추가</button></div>';
  container.replaceChildren(root);
  const find=selector=>root.querySelector(selector),canvas=find('canvas'),board=find('.dna-board'),context=canvas.getContext('2d');
  const catalog=find('.dna-catalog'),geneName=document.createElement('div');geneName.className='dna-gene-name';geneName.setAttribute('role','tooltip');geneName.hidden=true;board.append(geneName);
  const organLimit=document.createElement('output');organLimit.className='dna-organ-limit';organLimit.setAttribute('role','tooltip');organLimit.setAttribute('aria-live','polite');organLimit.hidden=true;board.append(organLimit);
  let partHandler=null,partMode='',partFirst=-1,partLast=-1,partCursor=0,partCursorHint=false,partValue=null,partRotation=0;
  let geneHold=null,geneTimer=0,geneClick=null,geneTouch=null,hoveredGene=null;
  const mobileQuery=typeof globalThis.matchMedia==='function'?globalThis.matchMedia('(max-width:700px)'):null;
  const view={x:0,y:0,scale:1,width:0,height:0};
  let pieces=[],level=1,budget=0,readOnly=false,contextSet=false,filter='all',selected=M.catalog[0].id,rotation=0,insertion=0,history=[],future=[],notice='',boardFull=false,model=M.trace([],1),preview,frame=0,destroyed=false,pointer=null,moved=false;
  function button(parent,label,glyph,action){const element=document.createElement('button');element.type='button';element.title=label;element.setAttribute('aria-label',label);element.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+glyph+'"/></svg>';element.onclick=action;parent.append(element);return element;}
  const undoButton=button(find('.dna-tools'),'되돌리기','M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',undo);
  const redoButton=button(find('.dna-tools'),'다시 실행','m15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12',redo);
  const removeButton=button(find('.dna-tools'),'조각 삭제','M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 10v7m4-7v7',remove);
  const clearButton=button(find('.dna-tools'),'초기화','M5 10a8 8 0 1 1 1 8M5 4v6h6',()=>{if(readOnly||partMode||!pieces.length)return;clearHistory();pieces=[];insertion=0;changed();});
  const leftButton=button(find('.dna-rotation'),'왼쪽 회전','m8 3-5 5 5 5M3 8h10a7 7 0 1 1-6 11',()=>rotate(-1));
  const rightButton=button(find('.dna-rotation'),'오른쪽 회전','m16 3 5 5-5 5m5-5H11a7 7 0 1 0 6 11',()=>rotate(1));
  const addButton=find('.dna-add');addButton.onclick=commit;
  const partButton=document.createElement('button');partButton.type='button';partButton.className='dna-part-save';partButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/></svg><span>부분 저장</span>';partButton.onclick=startPartSelection;find('.dna-tools').append(partButton);
  const partExitButton=document.createElement('button');partExitButton.type='button';partExitButton.className='dna-part-cancel';partExitButton.textContent='취소';partExitButton.onclick=cancelPart;find('.dna-tools').append(partExitButton);
  const partPanel=document.createElement('div');partPanel.className='dna-part-panel';partPanel.hidden=true;
  const partPreview=document.createElement('div');partPreview.className='dna-part-preview';
  const partStats=document.createElement('dl');partStats.className='dna-part-stats design-stats';
  const partName=document.createElement('input');partName.setAttribute('aria-label','템플릿 이름');partName.maxLength=32;
  const partActions=document.createElement('div');partActions.className='dna-part-actions';
  const partSaveButton=document.createElement('button');partSaveButton.type='button';partSaveButton.textContent='저장';partSaveButton.onclick=savePart;
  const partCancelButton=document.createElement('button');partCancelButton.type='button';partCancelButton.textContent='취소';partCancelButton.onclick=cancelPart;
  partActions.append(partSaveButton,partCancelButton);partPanel.append(partPreview,partStats,partName,partActions);board.append(partPanel);
  function cancelPart(){partCursorHint=false;partMode='';partFirst=-1;partLast=-1;partValue=null;partPanel.hidden=true;notice='';state();}
  function startPartSelection(){if(destroyed||readOnly||!partHandler||!pieces.length)return false;cancelPart();partMode='select';partCursor=0;renderControls();requestDraw();root.focus({preventScroll:true});return true;}
  function selectPartIndex(index){if(partMode!=='select'||index<0||index>=pieces.length)return;partCursor=index;if(partFirst<0){partFirst=index;renderControls();requestDraw();return;}partLast=index;partValue=dnaPartRange(M,getDesign(),partFirst,partLast);if(!partValue)return;partMode='save';partName.value=names[partValue.pieces[0].gene]+' '+partValue.pieces.length;renderDnaComposition(partPreview,M,{...partValue,budget:0});const first=Math.min(partFirst,partLast),last=Math.max(partFirst,partLast),stats=M.stats(pieces),without=M.stats(pieces.filter((piece,index)=>index<first||index>last)),contribution={},base={};for(const key of Object.keys(stats)){if(typeof stats[key]!=='number'||typeof without[key]!=='number')continue;const difference=Number((stats[key]-without[key]).toFixed(3));if(!difference)continue;contribution[key]=difference;base[key]=0;}renderDnaDesignStats(partStats,contribution,base,false);partPanel.hidden=false;renderControls();requestDraw();partName.focus({preventScroll:true});}
  function savePart(){if(partMode!=='save'||!partHandler||!partValue)return;const name=partName.value.trim();if(!name){partName.focus();return;}let saved=false;try{saved=partHandler(dnaPartValidate(M,partValue),name)!==false;}catch{}if(!saved){notice='save-failed';renderControls();return;}cancelPart();root.focus({preventScroll:true});}
  function selectPart(value){if(destroyed||readOnly)return false;const part=dnaPartValidate(M,value);if(!part||part.pieces.some(piece=>M.lookup.get(piece.gene).retired))return false;cancelPart();partValue=part;partRotation=0;partMode='append';insertion=pieces.length;state();root.focus({preventScroll:true});return true;}
  function partCandidate(){const proposed=dnaPartAppend(M,getDesign(),partValue,partRotation),rotated=pieces.map(M.clonePiece).concat(partValue.pieces.map(piece=>({...M.clonePiece(piece),rotation:(piece.rotation+partRotation)%6}))),result=M.trace(rotated,level);let reason=result.reason;if(partValue.level>level)reason='level';if(!proposed&&!reason)reason='organ-limit';const start=model.nodes[model.nodes.length-1],paths=M.trace(rotated.slice(pieces.length)).paths.map(path=>({...path,points:path.points.map(point=>({q:point.q+start.q,r:point.r+start.r})),end:{q:path.end.q+start.q,r:path.end.r+start.r}}));return {pieces:proposed?.pieces||rotated,result:{...result,paths:model.paths.concat(paths)},path:paths[paths.length-1],cost:M.cost(rotated),valid:!!proposed,reason:proposed?'ready':reason};}
  function hitPart(event){
    const bounds=canvas.getBoundingClientRect(),point={x:event.clientX-bounds.left,y:event.clientY-bounds.top},padding=event.pointerType==='touch'?12:7;
    let nodeIndex=-1,nodeDistance=Infinity;
    for(let index=0;index<model.nodes.length;index++){
      const node=model.nodes[index],p=screen(node),organ=[model.paths[index-1],model.paths[index]].some(path=>path&&M.lookup.get(path.gene).category==='organ'),radius=(node.q===0&&node.r===0?25:organ?20:14)*view.scale+padding,distance=Math.hypot(point.x-p.x,point.y-p.y);
      if(distance<=radius&&distance<nodeDistance){nodeIndex=index;nodeDistance=distance;}
    }
    if(nodeIndex>=0){
      const key=M.key(model.nodes[nodeIndex]),candidates=[];
      for(let index=0;index<model.paths.length;index++){const path=model.paths[index];if(M.key(path.start)===key||M.key(path.end)===key)candidates.push(index);}
      if(partCursorHint&&candidates.includes(partCursor))return partCursor;
      for(let index=0;index<model.nodes.length;index++)if(M.key(model.nodes[index])===key){const preferred=partFirst<0?index<model.paths.length?index:index-1:index>partFirst?index-1:Math.min(index,model.paths.length-1);if(candidates.includes(preferred))return preferred;}
      return candidates[0]===undefined?-1:candidates[0];
    }
    let nearest=-1,distance=event.pointerType==='touch'?24:18;
    for(let index=0;index<model.paths.length;index++){const points=model.paths[index].points.map(screen);for(let edge=0;edge<points.length-1;edge++){const a=points[edge],b=points[edge+1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(.16,Math.min(.84,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy))),d=Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t);if(d<distance){distance=d;nearest=index;}}}
    if(nearest>=0)partCursorHint=true;
    return nearest;
  }
  function partMarker(index,label){const path=model.paths[index];if(!path)return;const points=path.points.map(screen),a=points[0],b=points[1],length=Math.hypot(b.x-a.x,b.y-a.y),offset=label==='1'?-18:18,x=(a.x+b.x)/2-(b.y-a.y)/length*offset,y=(a.y+b.y)/2+(b.x-a.x)/length*offset;context.save();context.fillStyle='#d9f4c0';context.strokeStyle='#081c20';context.lineWidth=3;context.beginPath();if(label==='1')context.rect(x-11,y-11,22,22);else context.arc(x,y,12,0,Math.PI*2);context.fill();context.stroke();context.fillStyle='#12292c';context.font='bold 14px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(label,x,y);context.restore();}
  function partOutline(path,hover){const points=path.points.map(screen),organ=M.lookup.get(path.gene).category==='organ',width=Math.max(organ?11:8,(organ?19:14)*view.scale);line(points,'#081c20',width+5,1);line(points,hover?'#fff':'#d9f4c0',width,hover?1:.8);line(points,'#12292c',Math.max(3,width-4),1);}
  function partArea(first,end){
    const cells=new Map(),edges=new Map();
    for(let index=first;index<=end;index++)for(const point of model.paths[index].points)cells.set(M.key(point),point);
    context.save();context.beginPath();
    for(const point of cells.values()){
      const center=world(point),vertices=[];
      for(let index=0;index<6;index++){const angle=(60*index-30)*Math.PI/180,x=center.x+34*Math.cos(angle),y=center.y+34*Math.sin(angle);vertices.push({x:x*view.scale+view.x,y:y*view.scale+view.y,key:Math.round(x*1000000)+','+Math.round(y*1000000)});}
      for(let index=0;index<6;index++){const a=vertices[index],b=vertices[(index+1)%6];index?context.lineTo(a.x,a.y):context.moveTo(a.x,a.y);const key=[a.key,b.key].sort().join(':');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}context.closePath();
    }
    context.fillStyle='#a9e8ce';context.globalAlpha=.18;context.fill();context.globalAlpha=.9;context.strokeStyle='#d9f4c0';context.lineWidth=2;context.lineJoin='round';context.lineCap='round';context.beginPath();
    for(const [a,b] of edges.values()){context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);}context.stroke();context.restore();
  }
  function partBoundary(point){const p=screen(point);context.save();context.strokeStyle='#081c20';context.lineWidth=7;context.beginPath();context.arc(p.x,p.y,Math.max(7,11*view.scale),0,Math.PI*2);context.stroke();context.strokeStyle='#d9f4c0';context.lineWidth=3;context.stroke();context.restore();}

  function renderOrganLimit(){const duplicate=partMode==='append'?partValue.pieces.find(piece=>M.lookup.get(piece.gene).category==='organ'&&pieces.some(existing=>existing.gene===piece.gene))?.gene:null,id=duplicate||hoveredGene||selected,gene=M.lookup.get(id),blocked=!readOnly&&!boardFull&&gene?.category==='organ'&&pieces.some(piece=>piece.gene===id)&&(!partMode||!!duplicate);organLimit.textContent=blocked?names[id]+(names[id].endsWith('기관')?'은':' 기관은')+' 하나만 배치할 수 있습니다':'';organLimit.hidden=!blocked;const status=find('.dna-status');status.hidden=blocked||!status.textContent;}
  function genePointerOver(event){const item=event.target.closest('.dna-gene');hoveredGene=item?.disabled?item.dataset.gene:null;renderOrganLimit();}
  function genePointerOut(event){if(event.target.closest('.dna-gene')===event.relatedTarget?.closest('.dna-gene'))return;hoveredGene=null;renderOrganLimit();}
  function hideGeneName(){if(geneTimer)clearTimeout(geneTimer);geneTimer=0;geneHold=null;geneName.hidden=true;geneName.textContent='';}
  function genePointerDown(event){if((event.pointerType!=='touch'&&event.pointerType!=='pen')||!mobileQuery?.matches)return;const item=event.target.closest('.dna-gene');if(!item)return;hideGeneName();geneClick=null;geneTouch={item,time:Date.now()};geneHold={item,id:event.pointerId,x:event.clientX,y:event.clientY};geneTimer=setTimeout(()=>{geneTimer=0;if(!geneHold||!item.isConnected)return;geneClick=item;geneName.textContent=names[item.dataset.gene];geneName.hidden=false;geneName.style.left='50%';},480);}
  function genePointerMove(event){if(geneHold&&event.pointerId===geneHold.id&&Math.hypot(event.clientX-geneHold.x,event.clientY-geneHold.y)>9)hideGeneName();}
  function genePointerEnd(event){if(geneHold&&event.pointerId===geneHold.id)hideGeneName();}
  function geneClickCapture(event){if(!geneClick)return;const item=event.target.closest('.dna-gene');if(item===geneClick){event.preventDefault();event.stopImmediatePropagation();}geneClick=null;}
  function geneContextMenu(event){const item=event.target.closest('.dna-gene');if(item&&(event.pointerType==='touch'||event.pointerType==='pen'||event.sourceCapabilities?.firesTouchEvents||(geneHold&&geneHold.item===item)||(geneTouch&&geneTouch.item===item&&Date.now()-geneTouch.time<1500&&event.pointerType!=='mouse'))){event.preventDefault();event.stopPropagation();}}
  catalog.addEventListener('pointerover',genePointerOver);
  catalog.addEventListener('pointerout',genePointerOut);
  catalog.addEventListener('pointerdown',genePointerDown);
  catalog.addEventListener('pointermove',genePointerMove);
  catalog.addEventListener('pointerup',genePointerEnd);
  catalog.addEventListener('pointercancel',genePointerEnd);
  catalog.addEventListener('click',geneClickCapture,true);
  catalog.addEventListener('contextmenu',geneContextMenu);
  function getDesign(){return {version:3,pieces:pieces.map(M.clonePiece),level,budget};}
  function snapshot(){return {pieces:pieces.map(M.clonePiece),insertion};}
  function checkpoint(){history.push(snapshot());if(history.length>200)history.shift();future=[];}
  function clearHistory(){history=[];future=[];renderControls();}
  function candidate(){if(partMode==='append')return partCandidate();const gene=M.lookup.get(selected),proposed=pieces.map(M.clonePiece),start=model.nodes[insertion],points=M.route(start,gene,gene.grade,rotation),path={gene:selected,points,start,end:points[points.length-1]};proposed.splice(insertion,0,{gene:selected,grade:gene.grade,rotation,shape:[...M.shape(gene,gene.grade)]});const result=M.trace(proposed,level);if(gene.category==='organ'&&pieces.some(piece=>piece.gene===selected)){result.valid=false;result.reason='organ-limit';}const cost=M.cost(proposed);return {pieces:proposed,result,path,cost,valid:result.valid,reason:result.valid?'ready':result.reason};}
  function changed(){notice='';state();if(typeof onChange==='function')onChange(getDesign());}
  function previewState(){if(partMode==='append')return candidate();const previous=rotation,initial=candidate();if(initial.result.valid)return initial;for(let step=1;step<6;step++){rotation=(previous+step)%6;const next=candidate();if(next.result.valid)return next;}rotation=previous;return initial;}
  function hasPlacement(){
    const proposed=pieces.map(M.clonePiece);proposed.splice(insertion,0,null);
    for(const gene of M.catalog){
      if(gene.grade>level||(gene.category==='organ'&&pieces.some(piece=>piece.gene===gene.id)))continue;
      for(let direction=0;direction<6;direction++){
        proposed[insertion]={gene:gene.id,grade:gene.grade,rotation:direction,shape:[...M.shape(gene,gene.grade)]};
        if(M.trace(proposed,level).valid)return true;
      }
    }
    return false;
  }
  function state(){model=M.trace(pieces,level);preview=readOnly?candidate():previewState();boardFull=!partMode&&!readOnly&&!preview.valid&&!hasPlacement();renderCatalog();renderLegend();renderControls();requestDraw();}
  function renderLegend(){
    const legend=find('.dna-legend'),counts=M.counts(pieces),stats=M.stats(pieces);
    const keys={blade:'meleePower',secretion:'rangedPower',antenna:'vision',gather:'harvest',healer:'healPower',carapace:'armor',legs:'evasion',power:'meleePower',speed:'meleeSpeed',combo:'hits',harvestSpeed:'harvestTime'};
    const units={hits:'회',meleeSpeed:'/초',rangedSpeed:'/초',capacity:'개',harvest:'개',harvestTime:'초',movement:'칸/초',vision:'칸',stunTime:'초',area:'칸',regeneration:'/초',comboSpeed:'초',focus:'초'};
    const percentages=['parry','block','evasion','comboPower','critical','criticalPower','accuracy','blockPower','counter','counterPower','tenacity','reduction','loadSpeed','healing','stun','bleed','areaPower','lifesteal','reflection'];
    const labels={meleePower:'근접 공격력',rangedPower:'원거리 공격력',meleeSpeed:'근접 공속',rangedSpeed:'원거리 공속',hits:'공격횟수',harvestTime:'채집 시간',movement:'이동',armor:'방어',evasion:'회피',healPower:'치유량'};
    const unlocks={gather:'채집 기능 해금',blade:'근접 선제 공격 기능 해금',secretion:'원거리 선제 공격 기능 해금',healer:'치유 기능 해금',antenna:'자유 이동 기능 해금'};
    legend.replaceChildren();
    for(const gene of [...M.catalog,...M.genes.filter(gene=>gene.retired)]){
      if(!counts[gene.id])continue;
      const item=document.createElement('span');item.dataset.gene=gene.id;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 44 38');
      const piece=pieces.find(piece=>piece.gene===gene.id);svg.innerHTML=shapeSvg({...gene,grade:piece.grade===undefined?gene.grade:piece.grade,steps:piece.shape||gene.steps});
      const count=document.createElement('span');count.textContent='×'+counts[gene.id];
      const key=keys[gene.id]||gene.id,without=M.stats(pieces.filter(piece=>piece.gene!==gene.id));
      const difference=Number((stats[key]-without[key]).toFixed(3)),unit=units[key]||(percentages.includes(key)?'%':'');
      const effect=unlocks[gene.id]||((labels[key]||names[gene.id])+' '+(difference>=0?'+':'')+difference+unit);
      const delta=document.createElement('span');delta.className='dna-legend-delta';delta.textContent=' ('+effect+')';
      item.append(svg,count,delta);legend.append(item);
    }
    legend.hidden=!legend.children.length;
  }
  function renderCatalog(){
    hideGeneName();geneClick=null;hoveredGene=null;renderOrganLimit();
    const filters=find('.dna-filters');filters.replaceChildren();
    for(const [type,label] of [['all','전체'],['organ','기관'],['action','기능'],['stat','스탯']]){const item=document.createElement('button');item.type='button';item.textContent=label;item.dataset.category=type;item.setAttribute('aria-pressed',String(filter===type));item.onclick=()=>{filter=type;renderCatalog();root.focus({preventScroll:true});};filters.append(item);}
    const list=find('.dna-list');list.replaceChildren();
    for(const gene of M.catalog){if(gene.grade>level||(!mobileQuery?.matches&&filter!=='all'&&gene.category!==filter))continue;const item=document.createElement('button');item.type='button';item.className='dna-gene';item.setAttribute('aria-label',names[gene.id]);item.dataset.gene=gene.id;item.dataset.category=gene.category;item.disabled=gene.grade>level||(gene.category==='organ'&&pieces.some(piece=>piece.gene===gene.id));item.setAttribute('aria-pressed',String(selected===gene.id));item.style.setProperty('--dna-gene-color',gene.color);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 44 38');svg.innerHTML=shapeSvg(gene);const name=document.createElement('strong');name.textContent=names[gene.id];const cost=document.createElement('span');cost.className='dna-gene-cost';const proposed=pieces.map(M.clonePiece);proposed.splice(insertion,0,{gene:gene.id,grade:gene.grade,rotation,shape:[...gene.steps]});cost.textContent=String(M.price(proposed)-M.price(pieces));cost.title='진화포인트';item.append(svg,name,cost);item.onclick=()=>{if(item.disabled)return;if(partMode)cancelPart();selected=gene.id;notice='';state();root.focus({preventScroll:true});};list.append(item);}
  }
  function renderControls(){const selecting=partMode==='select'||partMode==='save';partButton.disabled=readOnly||!partHandler||!pieces.length||!!partMode;partCancelButton.hidden=!partMode;partExitButton.hidden=!partMode;root.dataset.part=partMode;addButton.disabled=readOnly||selecting||!preview.valid;leftButton.disabled=readOnly||selecting;rightButton.disabled=readOnly||selecting;undoButton.disabled=readOnly||!!partMode||!history.length;redoButton.disabled=readOnly||!!partMode||!future.length;removeButton.disabled=readOnly||!!partMode||!pieces.length;clearButton.disabled=readOnly||!!partMode||!pieces.length;const reason=boardFull?'full':notice||preview.reason;const labels={'save-failed':'저장하지 못했습니다',ready:'',full:'꽉 찼습니다',collision:'경로가 겹칩니다',closed:'경로가 닫혔습니다',boundary:'판을 벗어납니다',level:'둥지 레벨이 부족합니다'};find('.dna-status').textContent=readOnly?'':notice==='save-failed'?labels[notice]:partMode==='select'?(partFirst<0?'첫 조각을 선택하세요':'마지막 조각을 선택하세요'):labels[reason]||'';find('.dna-status').dataset.kind=reason;find('.dna-cost strong').textContent=String(M.cost(pieces));root.dataset.readonly=String(readOnly);root.dataset.preview=String(preview.valid);renderOrganLimit();}
  function requestDraw(){if(!frame&&!destroyed)frame=requestAnimationFrame(()=>{frame=0;if(!destroyed)draw();});}
  function world(point){return {x:34*Math.sqrt(3)*(point.q+point.r/2),y:51*point.r};}
  function screen(point){const p=world(point);return {x:p.x*view.scale+view.x,y:p.y*view.scale+view.y};}
  function shapeSvg(gene){return dnaGeneShapeSvg(M,gene);}
  function line(points,color,width,alpha){context.save();context.strokeStyle=color;context.lineWidth=width;context.globalAlpha=alpha;context.lineCap='round';context.lineJoin='round';context.beginPath();points.forEach((p,index)=>index?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.stroke();context.restore();}
  function dnaPath(path,color,alpha){
    const organ=M.lookup.get(path.gene).category==='organ',points=path.points.map(screen),samples=[];
    for(let edge=0;edge<points.length-1;edge++){const a=points[edge],b=points[edge+1],length=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(4,Math.ceil(length/5));for(let i=0;i<steps;i++){const t=i/steps;samples.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,nx:-(b.y-a.y)/length,ny:(b.x-a.x)/length});}}
    const tail=points[points.length-1],before=points[points.length-2],length=Math.hypot(tail.x-before.x,tail.y-before.y);samples.push({x:tail.x,y:tail.y,nx:-(tail.y-before.y)/length,ny:(tail.x-before.x)/length});
    const one=[],two=[],amplitude=(organ?5:3)*view.scale;
    for(let i=0;i<samples.length;i++){const p=samples[i],wave=Math.sin(i*.58)*amplitude;one.push({x:p.x+p.nx*wave,y:p.y+p.ny*wave});two.push({x:p.x-p.nx*wave,y:p.y-p.ny*wave});if(i%3===0)line([one[i],two[i]],color,(organ?2:1)*view.scale,alpha*.45);}
    line(one,color,(organ?4:1.5)*view.scale,alpha);line(two,'#6da995',(organ?2.8:1.1)*view.scale,alpha*.65);
    context.save();context.fillStyle='#fff';context.globalAlpha=alpha;for(const point of points.slice(1,-1)){context.beginPath();context.arc(point.x,point.y,(organ?4:2.2)*view.scale,0,Math.PI*2);context.fill();}context.restore();
  }
  function drawGrid(){
    const radius=M.boardRadius(level),s=view.scale;
    for(let r=-radius;r<=radius;r++)for(let q=-radius;q<=radius;q++){
      const distance=Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));if(distance>radius)continue;
      const p=screen({q,r});if(p.x<-40*s||p.x>view.width+40*s||p.y<-40*s||p.y>view.height+40*s)continue;
      context.beginPath();for(let index=0;index<6;index++){const angle=(60*index-30)*Math.PI/180,x=p.x+34*s*Math.cos(angle),y=p.y+34*s*Math.sin(angle);index?context.lineTo(x,y):context.moveTo(x,y);}context.closePath();
      context.fillStyle='#10272a';context.globalAlpha=.68;context.fill();context.globalAlpha=.9;context.strokeStyle='#345052';context.lineWidth=.65;context.stroke();
    }
    context.globalAlpha=1;
  }
  function node(point,index,color,ghost){const organ=index<0?M.lookup.get(selected).category==='organ':[model.paths[index-1],model.paths[index]].some(path=>path&&M.lookup.get(path.gene).category==='organ'),p=screen(point),radius=(point.q===0&&point.r===0?25:organ?20:14)*view.scale;context.save();context.globalAlpha=ghost?.55:1;context.shadowColor=color;context.shadowBlur=(index===insertion?16:5)*view.scale;context.beginPath();context.arc(p.x,p.y,radius,0,Math.PI*2);context.fillStyle='#12292c';context.fill();context.strokeStyle=color;context.lineWidth=(index===insertion?organ?3.7:2.7:organ?2.7:1.5)*view.scale;context.stroke();context.shadowBlur=0;context.beginPath();context.arc(p.x,p.y,radius-5*view.scale,0,Math.PI*2);context.strokeStyle=color;context.globalAlpha*=.2;context.stroke();context.globalAlpha=ghost?.65:1;context.strokeStyle=color;context.lineWidth=1.5*view.scale;context.beginPath();const plus=index===insertion||ghost;if(plus){context.moveTo(p.x-5*view.scale,p.y);context.lineTo(p.x+5*view.scale,p.y);context.moveTo(p.x,p.y-5*view.scale);context.lineTo(p.x,p.y+5*view.scale);}else{context.arc(p.x,p.y,2.5*view.scale,0,Math.PI*2);}context.stroke();context.restore();}
  function draw(){
    context.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);context.clearRect(0,0,view.width,view.height);drawGrid();
    const selecting=partMode==='select'||partMode==='save',last=partLast<0?partCursor:partLast,first=partFirst<0?partCursor:Math.min(partFirst,last),end=partFirst<0?partCursor:Math.max(partFirst,last);
    if(selecting)partArea(first,end);
    if(selecting)for(let index=first;index<=end;index++)partOutline(model.paths[index],partMode==='select'&&index===partCursor);
    for(let index=0;index<model.paths.length;index++){const path=model.paths[index],dim=selecting&&(index<first||index>end);dnaPath(path,M.lookup.get(path.gene).color,dim?.12:1);}
    const futurePaths=readOnly||partMode==='select'||partMode==='save'||(!preview.valid&&partMode!=='append')?[]:preview.result.paths.slice(insertion);for(let index=0;index<futurePaths.length;index++)dnaPath(futurePaths[index],preview.valid?'#8be3c3':'#ed9293',partMode==='append'?.7:index===0?.6:.2);
    if(!selecting)for(let index=0;index<model.nodes.length;index++){if(model.nodes.some((other,otherIndex)=>otherIndex!==index&&M.key(other)===M.key(model.nodes[index])&&(otherIndex===insertion||(index!==insertion&&otherIndex>index))))continue;const point=model.nodes[index],color=!M.inside(point,level)?'#ed9293':index===insertion?'#d9f4c0':index===0?'#86e2c5':'#587d73';node(point,index,color,false);}
    if(selecting){partBoundary(model.paths[first].start);partBoundary(model.paths[end].end);if(partFirst>=0){partMarker(partFirst,'1');partMarker(last,'2');}else partMarker(partCursor,'1');}
    const path=readOnly||partMode==='select'||partMode==='save'||!preview.valid?null:preview.path;if(path)node(path.end,-1,preview.valid?'#9cf0ce':'#ed9293',true);
    for(const point of model.outside||[]){const p=screen(point);context.beginPath();context.arc(p.x,p.y,9*view.scale,0,Math.PI*2);context.strokeStyle='#ed9293';context.lineWidth=view.scale;context.stroke();}
  }
  function commit(){if(readOnly||partMode==='select'||partMode==='save')return;const proposed=candidate();if(!proposed.valid){notice=proposed.reason;renderControls();return;}checkpoint();pieces=proposed.pieces;if(partMode==='append')insertion=pieces.length;else insertion++;changed();}
  function cycleGene(){if(readOnly||partMode)return;const items=[...find('.dna-list').children].filter(item=>!item.disabled);if(!items.length)return;const index=items.findIndex(item=>item.dataset.gene===selected);items[(index+1)%items.length].onclick();}
  function rotate(delta){if(readOnly||partMode==='select'||partMode==='save')return;if(partMode==='append'){partRotation=(partRotation+delta+6)%6;notice='';state();return;}const previous=rotation;for(let step=0;step<6;step++){rotation=(rotation+delta+6)%6;if(candidate().result.valid){notice='';state();return;}}rotation=previous;}
  function undo(){if(readOnly||partMode||!history.length)return;future.push(snapshot());const previous=history.pop();pieces=previous.pieces;insertion=previous.insertion;changed();}
  function redo(){if(readOnly||partMode||!future.length)return;history.push(snapshot());const next=future.pop();pieces=next.pieces;insertion=next.insertion;changed();}
  function remove(){if(readOnly||partMode||!pieces.length)return;const index=Math.max(0,insertion-1),next=pieces.map(M.clonePiece);next.splice(index,1);const result=M.trace(next,level);if(!result.valid){notice=result.reason;renderControls();return;}checkpoint();pieces=next;insertion=index;changed();}
  function fit(){if(!view.width||!view.height)return;Object.assign(view,dnaEditorViewport(M,level,null,null,view.width,view.height));requestDraw();}
  function zoom(factor){if(!Number.isFinite(factor)||factor<=0||!view.width||!view.height)return;const next=Math.max(.005,Math.min(2.7,view.scale*factor)),ratio=next/view.scale,x=view.width/2,y=view.height/2;view.x=x-(x-view.x)*ratio;view.y=y-(y-view.y)*ratio;view.scale=next;requestDraw();}
  function resize(){const bounds=board.getBoundingClientRect();if(!bounds.width||!bounds.height||(view.width===bounds.width&&view.height===bounds.height))return;view.width=bounds.width;view.height=bounds.height;canvas.width=Math.ceil(bounds.width*devicePixelRatio);canvas.height=Math.ceil(bounds.height*devicePixelRatio);fit();}
  canvas.addEventListener('pointerdown',event=>{if(event.button===1){event.preventDefault();event.stopPropagation();cycleGene();return;}if(event.button!==0||pointer)return;root.focus({preventScroll:true});pointer={id:event.pointerId,x:event.clientX,y:event.clientY};moved=false;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(partMode==='select'){const index=hitPart(event);if(index>=0&&index!==partCursor){partCursor=index;requestDraw();}}if(pointer&&pointer.id===event.pointerId&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>4)moved=true;});
  canvas.addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;pointer=null;if(moved||readOnly)return;if(partMode==='select'){selectPartIndex(hitPart(event));return;}if(partMode==='save')return;commit();});
  canvas.addEventListener('pointercancel',()=>{pointer=null;});
  canvas.addEventListener('auxclick',event=>{if(event.button===1){event.preventDefault();event.stopPropagation();}});
  canvas.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();event.stopPropagation();if(event.deltaY)rotate(event.deltaY>0?1:-1);},{passive:false});
  root.addEventListener('contextmenu',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();event.stopPropagation();if(partMode){cancelPart();return;}undo();});
  root.addEventListener('pointerdown',event=>{if(event.button!==3)return;event.preventDefault();event.stopPropagation();undo();});
  root.addEventListener('auxclick',event=>{if(event.button===3){event.preventDefault();event.stopPropagation();}});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&partMode){event.preventDefault();event.stopPropagation();cancelPart();root.focus({preventScroll:true});return;}if(partMode==='select'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='Enter'||event.key===' ')selectPartIndex(partCursor);else{partCursorHint=true;partCursor=Math.max(0,Math.min(pieces.length-1,partCursor+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)));requestDraw();}return;}if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||event.target.isContentEditable)return;const key=event.key.toLowerCase();if((key==='enter'||key===' ')&&event.target.closest?.('button,summary'))return;if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();event.stopPropagation();event.shiftKey?redo():undo();}else if((event.ctrlKey||event.metaKey)&&key==='y'){event.preventDefault();event.stopPropagation();redo();}else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&['q','e','r','arrowleft','arrowright','enter',' ','delete','backspace','browserback','f'].includes(key)){event.preventDefault();event.stopPropagation();if(key==='q'||key==='arrowleft')rotate(-1);else if(key==='e'||key==='r'||key==='arrowright')rotate(1);else if(key==='enter'||key===' ')commit();else if(key==='backspace'||key==='browserback')undo();else if(key==='f')fit();else remove();}});
  function mobileChange(){renderCatalog();fit();}
  if(mobileQuery)mobileQuery.addEventListener('change',mobileChange);
  const observer=new ResizeObserver(resize);observer.observe(board);
  state();resize();
  return {
    load(design,locked){const value=M.validate(design);if(!value)return false;cancelPart();pieces=value.pieces.map(M.clonePiece);if(!contextSet){level=value.level;budget=value.budget;}readOnly=locked===true;history=pieces.map((_,index)=>({pieces:pieces.slice(0,index).map(M.clonePiece),insertion:index}));future=[];insertion=pieces.length;notice='';selected=M.catalog.find(gene=>gene.id===pieces[pieces.length-1]?.gene&&gene.grade<=level)?.id||M.catalog[0].id;state();fit();return true;},
    context(nextLevel,nextBudget,locked){const previousLevel=level,previousBudget=budget,previousReadOnly=readOnly;if(Number.isInteger(nextLevel)&&nextLevel>=1&&nextLevel<=4)level=nextLevel;if(Number.isFinite(nextBudget)&&nextBudget>=0)budget=Math.floor(nextBudget);contextSet=true;readOnly=locked===true;if(M.lookup.get(selected).grade>level)selected=M.catalog[0].id;if(previousLevel===level&&previousBudget===budget&&previousReadOnly===readOnly)return;if(partMode&&(previousLevel!==level||previousReadOnly!==readOnly))cancelPart();notice='';state();if(previousLevel!==level)fit();},
    partSave(handler){partHandler=typeof handler==='function'?handler:null;if(!partHandler&&partMode)cancelPart();renderControls();},
    selectPart,
    startPartSelection,
    getDesign,
    clearHistory,
    fit,
    zoom,
    destroy(){partHandler=null;partValue=null;partMode='';destroyed=true;if(mobileQuery)mobileQuery.removeEventListener('change',mobileChange);hideGeneName();geneClick=null;geneTouch=null;catalog.removeEventListener('pointerover',genePointerOver);catalog.removeEventListener('pointerout',genePointerOut);catalog.removeEventListener('pointerdown',genePointerDown);catalog.removeEventListener('pointermove',genePointerMove);catalog.removeEventListener('pointerup',genePointerEnd);catalog.removeEventListener('pointercancel',genePointerEnd);catalog.removeEventListener('click',geneClickCapture,true);catalog.removeEventListener('contextmenu',geneContextMenu);observer.disconnect();if(frame)cancelAnimationFrame(frame);root.remove();}
  };
}
