(() => {
  'use strict';
  const M=globalThis.SpawnerNeutralCurves,storageKey='spawner-neutral-curves-v1';
  let curves=M.initial(),selected=0,drag=null;
  const $=id=>document.getElementById(id),message=text=>{$('message').textContent=text};
  const format=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:d}).format(n):'처치 불가';
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(M.valid(saved))curves=saved}catch{}
  $('tier').innerHTML=Array.from({length:19},(_,i)=>`<option value="${i}">${i+1}티어</option>`).join('');
  const cards=M.axes.map(axis=>{
    const card=document.createElement('article');card.className='curve';
    card.innerHTML=`<div class="curve-top"><h2 style="color:${axis.color}">${axis.name}</h2><label><span class="chosen">1티어</span><input type="number" step="${axis.step}" aria-label="${axis.name} 선택 티어 값"><span>${axis.unit}</span></label></div><svg viewBox="0 0 480 230" role="img" tabindex="0" aria-label="${axis.name} 곡선. 점을 드래그하거나 오른쪽 값을 입력하세요."></svg><p class="hint">점 선택 · 위아래 드래그 · 이웃 티어를 넘어갈 수 없습니다.</p>`;
    $('curves').append(card);const svg=card.querySelector('svg'),input=card.querySelector('input');
    input.addEventListener('input',()=>{if(input.value===''||!Number.isFinite(input.valueAsNumber))return;M.edit(curves,axis.key,selected,input.valueAsNumber);render();save()});
    input.addEventListener('change',()=>{input.value=curves[axis.key][selected];render()});
    const position=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return p};
    svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const p=position(e);selected=Math.max(0,Math.min(18,Math.round((p.x-40)/23)));drag={svg,key:axis.key,max:chartMax(axis),pointer:e.pointerId};svg.setPointerCapture(e.pointerId);render();move(e)});
    function move(e){if(!drag||drag.svg!==svg||drag.pointer!==e.pointerId)return;const p=position(e),value=(200-p.y)/175*drag.max;M.edit(curves,axis.key,selected,value);render();save()}
    svg.addEventListener('pointermove',move);
    function end(e){if(drag?.svg===svg&&drag.pointer===e.pointerId){drag=null;render();message('곡선과 19종 스탯·전투 시간을 갱신했습니다.')}}
    svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);
    svg.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')selected=Math.max(0,selected-1);if(e.key==='ArrowRight')selected=Math.min(18,selected+1);if(e.key==='ArrowUp'||e.key==='ArrowDown')M.edit(curves,axis.key,selected,curves[axis.key][selected]+axis.step*(e.shiftKey?10:1)*(e.key==='ArrowUp'?1:-1));render();save()}});
    return {axis,card,svg,input};
  });
  function chartMax(axis){return drag?.key===axis.key?drag.max:Math.max(M.initial()[axis.key][18]*1.2,curves[axis.key][18]*1.12)}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(curves))}catch{message('이 브라우저에서는 저장할 수 없습니다. JSON으로 내보낼 수 있습니다.')}}
  function render(){
    $('tier').value=String(selected);
    for(const {axis,card,svg,input}of cards){
      const values=curves[axis.key],max=chartMax(axis),x=i=>40+i*23,y=v=>200-v/max*175;
      const grid=[0,.25,.5,.75,1].map(t=>`<line x1="40" x2="454" y1="${y(max*t)}" y2="${y(max*t)}" stroke="#30493a"/><text x="31" y="${y(max*t)+4}" text-anchor="end" fill="#8ca492" font-size="10">${format(max*t,axis.key==='speed'?2:0)}</text>`).join('');
      svg.innerHTML=grid+`<line x1="${x(selected)}" x2="${x(selected)}" y1="20" y2="200" stroke="${axis.color}" opacity=".25"/><path d="${values.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${axis.color}" stroke-width="2.5"/>`+values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="${i===selected?6:3.5}" fill="${i===selected?axis.color:'#172822'}" stroke="${axis.color}" stroke-width="2"/><text x="${x(i)}" y="220" fill="${i===selected?'#eff9ef':'#91a694'}" text-anchor="middle" font-size="10">${i+1}</text>`).join('');
      svg.setAttribute('aria-label',`${axis.name} 곡선. ${selected+1}티어 ${format(values[selected],3)} ${axis.unit}. 좌우 화살표로 티어, 위아래 화살표로 값 조절.`);
      card.querySelector('.chosen').textContent=`${selected+1}티어`;
      if(document.activeElement!==input)input.value=values[selected];
      input.min=selected?values[selected-1]+axis.step:axis.min;input.max=selected<18?values[selected+1]-axis.step:axis.max;
    }
    const {units,inversions}=M.calculate(curves),finite=units.filter(u=>Number.isFinite(u.seconds));
    $('range').textContent=finite.length?`${format(Math.min(...finite.map(u=>u.seconds)))}~${format(Math.max(...finite.map(u=>u.seconds)))}초 · 목표 밖 ${units.filter(u=>u.outside).length}종`:'모든 비교에서 처치 불가';
    const max=Math.max(60,...finite.map(u=>u.seconds));
    $('times').innerHTML=units.map(u=>`<div class="time ${u.outside?'outside':''}" data-species="${u.key}"><span>${u.name}${u.unique?' ★':''}<small>${u.party}명 · ${u.tier}티어</small></span><div class="track"><div class="bar" style="width:${Number.isFinite(u.seconds)?100*u.seconds/max:100}%"></div></div><span class="time-value">${format(u.seconds)}${Number.isFinite(u.seconds)?'초':''}</span></div>`).join('');
    $('warnings').textContent=inversions.length?`파생 DPS 서열 주의 ${inversions.length}쌍: ${inversions.map(v=>`${v.original.join(' / ')} → ${v.unique.join(' / ')}`).join(' · ')}. 공격력과 공속의 개별 서열은 유지되지만 곱의 서열은 달라질 수 있습니다.`:'원종·유니크 계보의 파생 DPS 서열 역전이 없습니다.';
    $('units').innerHTML=units.map(u=>`<article class="unit" data-species="${u.key}"><h3>${u.name}${u.unique?' ★':''}<small>${u.tier}티어</small></h3><dl>${M.axes.map(a=>`<div><dt>${a.name}</dt><dd>${format(u[a.key],3)}</dd></div>`).join('')}<div><dt>DPS</dt><dd>${format(u.dps)}</dd></div><div><dt>HPS</dt><dd>${format(u.hps)}</dd></div><div><dt>${u.party}명 처치</dt><dd>${format(u.seconds)}${Number.isFinite(u.seconds)?'초':''}</dd></div></dl></article>`).join('');
  }
  $('tier').addEventListener('change',e=>{selected=Number(e.target.value);render()});
  $('reset').addEventListener('click',()=>{curves=M.initial();save();render();message('초기 곡선으로 복원했습니다.')});
  $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,curves},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='spawner-neutral-curves.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0)});
  $('import').addEventListener('change',async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(data.version!==1||!M.valid(data.curves))throw new Error();curves=data.curves;save();render();message('설정을 불러왔습니다.')}catch{message('유효한 설정 JSON이 아닙니다. 현재 값은 유지합니다.')}finally{e.target.value=''}});
  render();
})();
