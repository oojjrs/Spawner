(async()=>{
  'use strict';
  const M=globalThis.SpawnerAppearance,$=id=>document.getElementById(id),canvas=$('unit'),context=canvas.getContext('2d');
  const mobile=matchMedia('(max-width:660px)').matches,source=M.createUnitAppearanceSource({sourceUrl:path=>globalThis.SpawnerAssets.source(path),byteBudget:M.UNIT_APPEARANCE_BYTE_BUDGETS[mobile?'mobile':'desktop']});
  const renderer=M.createUnitAppearanceRenderer(path=>source.acquire(path),(blob,options)=>createImageBitmap(blob,options),M.UNIT_APPEARANCE_PIXEL_BUDGETS[mobile?'mobile':'desktop']);
  const inventory=M.unitAppearanceInventory(),available=inventory.filter(v=>v.sourceApproved&&v.cameraVerified),all=M.unitAppearanceInventory();
  $('inventory').textContent=`원화 등록 ${all.filter(v=>v.sourceId).length}/${all.length} · 원화 확인 ${available.length} · 전체 행동 준비 ${all.filter(v=>v.ready).length}/${all.length}`;
  const names={bean:'새싹콩',spore:'포자버섯',pebble:'몽돌',spring:'샘방울'},actions={neutral:'원화',idle:'대기',walk:'이동',hurt:'피격',birth:'탄생',death:'사망',harvest:'채집',carry:'운반',throw:'납품',attack:'근접 공격',ranged:'원거리 공격',jump:'미리보기 점프'};
  $('form').innerHTML=available.map(v=>`<option value="${v.key}">${names[v.tribe]} ${v.mask.toString(16).padStart(2,'0')}</option>`).join('');
  let selected,action='neutral',start=performance.now(),paused=false,age=0,revision=0,frame=0,busy=false;
  function choose(){const row=available.find(v=>v.key===$('form').value);selected={...row,definition:M.unitAppearanceDefinition(row.tribe,row.mask)};action='neutral';$('action').innerHTML=['neutral',...Object.keys(actions).filter(a=>a!=='neutral'&&M.unitAppearanceAnimation(row.tribe,row.mask,a))].map(a=>`<option value="${a}">${actions[a]}</option>`).join('');$('status').textContent=`${names[row.tribe]} ${row.mask.toString(16).padStart(2,'0')} · ${row.ready?'전체 행동 준비 완료':'제작 중'}\n제작된 동작 ${Object.keys(selected.definition.actions).length}개`;$('missing').textContent='미완료: '+row.missingActions.map(a=>actions[a]).join(' · ');restart()}
  function restart(){age=0;start=performance.now();revision++;renderer.clear();source.clear();$('event').textContent=''}
  $('form').addEventListener('change',choose);$('action').addEventListener('change',()=>{action=$('action').value;restart()});$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'재생':'일시정지';if(!paused)start=performance.now()-age});$('replay').addEventListener('click',restart);
  function resize(){const width=canvas.getBoundingClientRect().width,ratio=Math.min(devicePixelRatio||1,3);canvas.width=canvas.height=Math.round(width*ratio);context.setTransform(ratio,0,0,ratio,0,0);revision++;}
  new ResizeObserver(resize).observe(canvas);
  async function tick(time){
    if(!paused)age=time-start;
    if(!busy&&selected&&canvas.width){busy=true;const token=revision;const width=canvas.getBoundingClientRect().width;
      try{
        context.clearRect(0,0,width,width);context.strokeStyle='#66826b';context.beginPath();context.moveTo(16,width*.84);context.lineTo(width-16,width*.84);context.stroke();
        const agent={id:'preview',tribe:selected.tribe,attributes:{},stats:{pieceCount:0}},pose=action==='neutral'?{action:'neutral',source:selected.definition.source,animation:{sourceId:selected.sourceId,image:selected.definition.source.image,frameSize:512,columns:1,frameCount:1,pivotX:256,pivotY:448},frame:0,geometry:{pivotX:256,pivotY:448}}:M.unitAppearancePose(selected.tribe,selected.mask,action,age);
        if(pose){renderer.beginFrame(context,[{agent,pose,worldPixels:width*.9}],devicePixelRatio||1);await renderer.draw(context,agent,pose,{x:width/2,y:width*.84},width*.9,true,devicePixelRatio||1,()=>revision===token)}
        const encoded=source.stats(),decoded=renderer.stats();$('budget').textContent=`원본 ${(encoded.residentBytes/1048576).toFixed(2)} / ${(encoded.byteBudget/1048576).toFixed(0)} MiB · 디코딩 ${(decoded.residentPixels/1048576).toFixed(2)} / ${(decoded.pixelBudget/1048576).toFixed(0)} Mpx · 디코딩 ${decoded.decodes}회`;
      }catch(error){$('status').textContent='불러오기 실패: '+error.message;console.error(error)}finally{busy=false}
    }
    frame=requestAnimationFrame(tick);
  }
  choose();frame=requestAnimationFrame(tick);addEventListener('pagehide',()=>{cancelAnimationFrame(frame);renderer.clear();source.clear()});
})();
