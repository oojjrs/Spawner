(() => {
  'use strict';
  const M=globalThis.SpawnerNeutralCurves,storageKey='spawner-neutral-curves-v1';
  let curves=M.initial(),selected=0,drag=null,mode='draft';
  const $=id=>document.getElementById(id),message=text=>{$('message').textContent=text};
  const format=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:d}).format(n):'처치 불가';
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(M.valid(saved)){curves=saved;if(localStorage.getItem(storageKey+'-mode')==='runtime-proposal')mode='runtime-proposal'}}catch{}
  function calculationOptions(){return mode==='runtime-proposal'?{reference:{power:6,speed:.5,defense:0},regenInCombat:false}:{}}
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
  function chartMax(axis){return drag?.key===axis.key?drag.max:Math.max((mode==='runtime-proposal'?M.runtimeScalePreset():M.initial())[axis.key][18]*1.2,curves[axis.key][18]*1.12)}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(curves));localStorage.setItem(storageKey+'-mode',mode)}catch{message('이 브라우저에서는 저장할 수 없습니다. JSON으로 내보낼 수 있습니다.')}}
  function renderBalance(){
    const balance=globalThis.SpawnerNeutralBalance;if(!balance||!$('balance-summary'))return;
    const review=M.diagnose(curves,balance,calculationOptions()),blocked=review.bounds.filter(bound=>bound.status==='blocked');
    const boundSummary=blocked.length?`현재 초안은 DNA 상한 조건 ${blocked.length}축을 넘습니다.`:review.bounds.every(bound=>bound.status==='within-witness')?'현재 초안 5축 모두 확인한 DNA 배치보다 낮습니다.':'증명 상한을 넘는 축은 없으며 최대 배치 확인이 남은 축이 있습니다.';
    $('balance-summary').textContent=`실제 중립 19종은 모두 HP 100 · 기본 공속 0.8회/초 · 자기 재생 0입니다. 설계표의 ${balance.design.axes}축 · ${balance.design.lineageComparisons}개 계보 비교 중 서열 역전 ${balance.design.lineageViolations.length}개. 실제 게임은 설계표 5축의 종간 비교 ${balance.design.runtimeRankMismatches.length}쌍이 동률이거나 순서가 다릅니다. ${boundSummary}`;
    $('dna-bounds').innerHTML=review.bounds.map(b=>`<article class="bound ${b.status}"><h3>${b.name}</h3><dl><div><dt>중립 초안 최고</dt><dd>${format(b.maximum,3)}</dd></div><div><dt>DNA 보수적 상한</dt><dd>${format(b.upper,3)}</dd></div><div><dt>확인한 DNA 배치</dt><dd>${format(b.witness,3)}</dd></div></dl><p>${b.status==='blocked'?'조건 미충족':b.status==='within-witness'?'확인한 배치보다 낮음':'최대 배치 추가 조사 필요'}</p></article>`).join('');
    const engine=new Map((mode==='runtime-proposal'?balance.proposal.arena.map(result=>({key:result.key,draft:result,actual:balance.proposal.actualArena.find(actual=>actual.key===result.key)})):balance.arena.results).map(result=>[result.key,result]));
    const resultText=result=>result.result==='reference-win'?format(result.seconds)+'초':result.result==='timeout'?'120초 초과':'기준 유닛 패배';
    $('runtime-units').innerHTML=review.units.map(unit=>{
      const current=unit.current,result=engine.get(unit.key);if(!current)return '';
      return `<article class="unit runtime-unit"><h3>${unit.name}${unit.unique?' ★':''}<small>${unit.tier}티어 · ${unit.party}명</small></h3><p class="comparison-key">실제 게임 → 현재 초안</p><dl>${M.axes.map(a=>`<div><dt>${a.name}</dt><dd>${format(current[a.key],3)} <span>→ ${format(unit[a.key],3)}</span></dd></div>`).join('')}<div><dt>정적 처치</dt><dd>${format(current.seconds)}초 <span>→ ${format(unit.seconds)}${Number.isFinite(unit.seconds)?'초':''}</span></dd></div></dl><p class="engine-time">서버 엔진 · 게임값 ${resultText(result.actual)} / ${mode==='runtime-proposal'?'초기 실게임 규모안':'초기 초안'} ${resultText(result.draft)}</p></article>`;
    }).join('');
  }
  function render(){
    $('tier').value=String(selected);
    $('reference').innerHTML=mode==='runtime-proposal'?'<strong>실제 레벨4 배치 기준</strong><span>HP 500</span><span>공격 6 × 초당 0.5회</span><span>방어 0</span><span>전투 중 재생 0</span><span>칼날1 · 강화1 · 체력49 / 262P</span>':'<strong>가상 기준 유닛</strong><span>HP 1,200</span><span>공격 75 × 초당 1회</span><span>방어 50</span><span>재생 10 HP/초</span><span>동형 1:1 · 30초</span>';
    $('mode-note').textContent=mode==='runtime-proposal'?'실게임 규모 제안 · 아직 게임에 적용되지 않았습니다. 전투 중 재생은 0으로 계산하고 재생 곡선은 전투 종료 5초 뒤 회복값입니다. 고정 인원·실제 배치 기준으로 검토합니다.':'기존 초안 · 가상 HP 1,200 기준은 현 DNA 보수적 상한 910보다 높습니다. 전투 중 재생을 차감한 정적 비교이며 실제 엔진과 차이가 있습니다.';
    for(const {axis,card,svg,input}of cards){
      const values=curves[axis.key],max=chartMax(axis),x=i=>40+i*23,y=v=>200-v/max*175;
      const grid=[0,.25,.5,.75,1].map(t=>`<line x1="40" x2="454" y1="${y(max*t)}" y2="${y(max*t)}" stroke="#30493a"/><text x="31" y="${y(max*t)+4}" text-anchor="end" fill="#8ca492" font-size="10">${format(max*t,axis.key==='speed'?2:0)}</text>`).join('');
      svg.innerHTML=grid+`<line x1="${x(selected)}" x2="${x(selected)}" y1="20" y2="200" stroke="${axis.color}" opacity=".25"/><path d="${values.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${axis.color}" stroke-width="2.5"/>`+values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="${i===selected?6:3.5}" fill="${i===selected?axis.color:'#172822'}" stroke="${axis.color}" stroke-width="2"/><text x="${x(i)}" y="220" fill="${i===selected?'#eff9ef':'#91a694'}" text-anchor="middle" font-size="10">${i+1}</text>`).join('');
      svg.setAttribute('aria-label',`${axis.name} 곡선. ${selected+1}티어 ${format(values[selected],3)} ${axis.unit}. 좌우 화살표로 티어, 위아래 화살표로 값 조절.`);
      card.querySelector('.chosen').textContent=`${selected+1}티어`;
      if(document.activeElement!==input)input.value=values[selected];
      input.min=selected?values[selected-1]+axis.step:axis.min;input.max=selected<18?values[selected+1]-axis.step:axis.max;
    }
    const {units,inversions}=M.calculate(curves,calculationOptions()),finite=units.filter(u=>Number.isFinite(u.seconds));
    $('range').textContent=finite.length?`${format(Math.min(...finite.map(u=>u.seconds)))}~${format(Math.max(...finite.map(u=>u.seconds)))}초 · 목표 밖 ${units.filter(u=>u.outside).length}종`:'모든 비교에서 처치 불가';
    const max=Math.max(60,...finite.map(u=>u.seconds));
    $('times').innerHTML=units.map(u=>`<div class="time ${u.outside?'outside':''}" data-species="${u.key}"><span>${u.name}${u.unique?' ★':''}<small>${u.party}명 · ${u.tier}티어</small></span><div class="track"><div class="bar" style="width:${Number.isFinite(u.seconds)?100*u.seconds/max:100}%"></div></div><span class="time-value">${format(u.seconds)}${Number.isFinite(u.seconds)?'초':''}</span></div>`).join('');
    $('warnings').textContent=inversions.length?`파생 DPS 서열 주의 ${inversions.length}쌍: ${inversions.map(v=>`${v.original.join(' / ')} → ${v.unique.join(' / ')}`).join(' · ')}. 공격력과 공속의 개별 서열은 유지되지만 곱의 서열은 달라질 수 있습니다.`:'원종·유니크 계보의 파생 DPS 서열 역전이 없습니다.';
    $('units').innerHTML=units.map(u=>`<article class="unit" data-species="${u.key}"><h3>${u.name}${u.unique?' ★':''}<small>${u.tier}티어</small></h3><dl>${M.axes.map(a=>`<div><dt>${a.name}</dt><dd>${format(u[a.key],3)}</dd></div>`).join('')}<div><dt>DPS</dt><dd>${format(u.dps)}</dd></div><div><dt>HPS</dt><dd>${format(u.hps)}</dd></div><div><dt>${u.party}명 처치</dt><dd>${format(u.seconds)}${Number.isFinite(u.seconds)?'초':''}</dd></div></dl></article>`).join('');
    renderBalance();
  }
  $('tier').addEventListener('change',e=>{selected=Number(e.target.value);render()});
  $('reset').addEventListener('click',()=>{curves=M.initial();mode='draft';save();render();message('초기 곡선으로 복원했습니다.')});
  $('runtime-preset').addEventListener('click',()=>{curves=M.runtimeScalePreset();mode='runtime-proposal';save();render();message('실게임 규모 제안을 불러왔습니다. 실제 게임 값은 변경되지 않았습니다.')});
  $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,curves,mode},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='spawner-neutral-curves.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0)});
  $('import').addEventListener('change',async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(data.version!==1||!M.valid(data.curves)||data.mode!==undefined&&!['draft','runtime-proposal'].includes(data.mode))throw new Error();curves=data.curves;mode=data.mode||'draft';save();render();message('설정을 불러왔습니다.')}catch{message('유효한 설정 JSON이 아닙니다. 현재 값은 유지합니다.')}finally{e.target.value=''}});
  $('export-analysis')?.addEventListener('click',()=>{
    const balance=globalThis.SpawnerNeutralBalance;if(!balance)return;
    const analysis={version:1,kind:'neutral-balance-review',mode,curves,review:M.diagnose(curves,balance,calculationOptions()),snapshot:balance,appliedToGame:false};
    const url=URL.createObjectURL(new Blob([JSON.stringify(analysis,(_,value)=>value===Infinity?'Infinity':value,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='spawner-neutral-balance-review.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  });
  render();
})();
