(() => {
  'use strict';
  const data=globalThis.SpawnerDnaLayoutData;
  const directions=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  const colors={A:'#e8b475',B:'#78c7b9',C:'#baa3e4'};
  const names={A:'직선',B:'완만한 꺾임',C:'급한 꺾임'};
  function transformPoint(point,rotation=0,mirror=false){let {q,r}=point;if(mirror)[q,r]=[r,q];for(let i=0;i<(rotation%6+6)%6;i++)[q,r]=[-r,q+r];return{q,r}}
  function transformed(candidate,rotation=0,mirror=false){return candidate.paths.map(path=>({...path,points:path.points.map(p=>transformPoint(p,rotation,mirror))}))}
  function piecesForTrace(paths){return paths.map(path=>{const[a,b,c]=path.points,d0=directions.findIndex(([q,r])=>a.q+q===b.q&&a.r+r===b.r),d1=directions.findIndex(([q,r])=>b.q+q===c.q&&b.r+r===c.r);return{gene:'gather',grade:1,rotation:d0,shape:[0,(d1-d0+6)%6]}})}
  function exportSelection(candidate,rotation,mirror){return{format:'spawner-anonymous-dna-layout',version:1,boardLevel:1,boardPoints:19,attributesAssigned:false,gameBlueprint:false,candidateId:candidate.id,title:candidate.title,rotation:(rotation%6+6)%6,mirror,counts:candidate.counts,paths:transformed(candidate,rotation,mirror).map((p,i)=>({number:i+1,outline:p.type,points:p.points})),source:{path:candidate.source,sha256:candidate.sourceSha256}}}
  globalThis.SpawnerDnaLayoutReview=Object.freeze({transformPoint,transformed,piecesForTrace,exportSelection});
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id),storageKey='spawner-dna-layout-review-v1';
  let selectedId=data.candidates[0].id,rotation=0,mirrored=false,selectedStrand=null,showNumbers=true;
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(data.candidates.some(c=>c.id===saved?.candidateId)){selectedId=saved.candidateId;rotation=Number.isInteger(saved.rotation)?(saved.rotation%6+6)%6:0;mirrored=saved.mirror===true}}catch{}
  const chosen=()=>data.candidates.find(c=>c.id===selectedId);
  const project=p=>[220+(p.q+p.r/2)*78,208+p.r*67.55];
  const pathD=path=>path.points.map((p,i)=>`${i?'L':'M'}${project(p).join(',')}`).join(' ');
  function boardSvg(candidate,rotationValue,mirrorValue,interactive=false){
    const paths=transformed(candidate,rotationValue,mirrorValue),points=data.boardPoints.map(p=>({p,xy:project(p)}));
    const grid=points.flatMap(({p,xy})=>directions.slice(0,3).flatMap(([q,r])=>{const other=points.find(v=>v.p.q===p.q+q&&v.p.r===p.r+r);return other?[`<path d="M${xy}L${other.xy}" stroke="#314d3c" stroke-width="1.1"/>`]:[]})).join('');
    const strands=paths.map((path,i)=>{const active=!interactive||selectedStrand===null||selectedStrand===i,points=path.points.map(project);return`<path d="${pathD(path)}" stroke="${colors[path.type]}" stroke-opacity="${active?1:.18}" stroke-width="${interactive&&selectedStrand===i?9:6}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${interactive&&showNumbers?`<text x="${points[1][0]}" y="${points[1][1]-13}" text-anchor="middle" font-size="12" font-weight="600" fill="${active?'#f0f6ef':'#718778'}" stroke="#172820" stroke-width="3" paint-order="stroke">${i+1}</text>`:''}`}).join('');
    const dots=points.map(({p,xy})=>{const center=p.q===0&&p.r===0;return`<circle class="point" cx="${xy[0]}" cy="${xy[1]}" r="${center?8:5}" fill="${center?'#d6e7cf':'#172820'}" stroke="${center?'#f0f7ec':'#adc3ac'}" stroke-width="${center?2:1.6}"/>`}).join('');
    const hits=interactive?paths.map((path,i)=>`<path class="strand-hit" data-strand="${i}" d="${pathD(path)}" tabindex="0" role="button" aria-label="${i+1}번 가닥 ${path.type} ${names[path.type]}"/>`).join(''):'';
    return grid+strands+dots+hits;
  }
  const cards=data.candidates.map(candidate=>{const button=document.createElement('button');button.className='candidate';button.type='button';button.setAttribute('role','radio');button.dataset.id=candidate.id;button.setAttribute('aria-label',`${candidate.title}, ${candidate.paths.length}가닥, A ${candidate.counts.A} B ${candidate.counts.B} C ${candidate.counts.C}`);button.addEventListener('click',()=>{selectedId=candidate.id;rotation=0;mirrored=false;selectedStrand=null;render();save();$('status').textContent=`${candidate.title}을 선택했습니다.`});$('candidates').append(button);return{candidate,button}});
  function save(){try{localStorage.setItem(storageKey,JSON.stringify({candidateId:selectedId,rotation,mirror:mirrored}))}catch{$('status').textContent='이 브라우저에서는 선택을 저장할 수 없습니다. JSON으로 내보낼 수 있습니다.'}}
  function render(){
    const candidate=chosen();$('layout-title').textContent=candidate.title;$('symmetry').textContent=`${candidate.symmetry} · 19칸 완전 점유`;$('layout-note').textContent=candidate.note;
    const paths=transformed(candidate,rotation,mirrored);$('board').innerHTML=boardSvg(candidate,rotation,mirrored,true);$('board').setAttribute('aria-label',`${candidate.title}. 1레벨 19칸, ${paths.length}가닥. A ${candidate.counts.A}, B ${candidate.counts.B}, C ${candidate.counts.C}.`);
    $('strand-list').innerHTML=`<button type="button" data-strand="all" aria-pressed="${selectedStrand===null}">전체</button>`+paths.map((path,i)=>`<button type="button" data-strand="${i}" aria-pressed="${selectedStrand===i}" style="color:${colors[path.type]}">${i+1} · ${path.type}</button>`).join('');
    if(selectedStrand===null)$('selection').textContent=`전체 ${paths.length}가닥 · A ${candidate.counts.A} / B ${candidate.counts.B} / C ${candidate.counts.C}`;
    else{const path=paths[selectedStrand];$('selection').textContent=`${selectedStrand+1}번 · ${path.type} ${names[path.type]} · ${path.points.map(p=>`(${p.q}, ${p.r})`).join(' → ')}`}
    for(const{candidate:c,button}of cards){const selected=c.id===selectedId;button.setAttribute('aria-checked',String(selected));button.innerHTML=`<span class="choose">${selected?'선택됨':''}</span><svg viewBox="0 0 440 420" aria-hidden="true">${boardSvg(c,0,false)}</svg><strong>${c.title}</strong><small>${c.symmetry}</small><span class="counts"><span class="a">A ${c.counts.A}</span><span class="b">B ${c.counts.B}</span><span class="c">C ${c.counts.C}</span></span>`}
  }
  function inspect(value){
    const fromBoard=document.activeElement?.classList.contains('strand-hit'),fromList=document.activeElement?.closest('#strand-list');
    selectedStrand=value==='all'?null:Number(value);render();
    if(fromBoard)$('board').querySelector(`[data-strand="${value}"]`)?.focus();
    else if(fromList)$('strand-list').querySelector(`[data-strand="${value}"]`)?.focus();
  }
  $('candidates').addEventListener('keydown',event=>{
    const keys=['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Home','End'];if(!keys.includes(event.key))return;
    const index=cards.findIndex(item=>item.button===document.activeElement);if(index<0)return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?cards.length-1:(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+cards.length)%cards.length;
    cards[next].button.click();cards[next].button.focus();
  });
  $('board').addEventListener('click',event=>{const target=event.target.closest('[data-strand]');if(target)inspect(target.dataset.strand)});
  $('board').addEventListener('keydown',event=>{const target=event.target.closest('[data-strand]');if(target&&['Enter',' '].includes(event.key)){event.preventDefault();inspect(target.dataset.strand)}});
  $('strand-list').addEventListener('click',event=>{const target=event.target.closest('[data-strand]');if(target)inspect(target.dataset.strand)});
  $('rotate-left').addEventListener('click',()=>{rotation=(rotation+5)%6;render();save()});$('rotate-right').addEventListener('click',()=>{rotation=(rotation+1)%6;render();save()});$('mirror').addEventListener('click',()=>{mirrored=!mirrored;render();save();$('status').textContent=mirrored?'반전한 방향입니다.':'원래 방향입니다.'});
  $('numbers').addEventListener('change',event=>{showNumbers=event.target.checked;render()});
  $('export').addEventListener('click',()=>{const candidate=chosen(),value=exportSelection(candidate,rotation,mirrored),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`spawner-dna-layout-${candidate.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);$('status').textContent='속성이 배정되지 않은 기하 선택 기록을 내보냈습니다.'});
  render();
})();
