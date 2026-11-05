(() => {
  'use strict';
  const data=globalThis.SpawnerVfxHitPreviewData;
  const duration=clip=>clip.durationsMs.reduce((sum,value)=>sum+value,0);
  function frameAt(clip,elapsed) {
    const total=duration(clip);let remaining=clip.loop?Math.max(0,elapsed)%total:Math.max(0,Math.min(elapsed,total-1e-7)),frame=0;
    while(frame<clip.durationsMs.length-1&&remaining>=clip.durationsMs[frame])remaining-=clip.durationsMs[frame++];
    return clip.frames?.[frame]??frame;
  }
  function effectFrameTimes(offsetMs=0) {
    let at=300+data.hitAtMs+offsetMs;
    return data.effect.durationsMs.map(ms=>{const start=at;at+=ms;return start});
  }
  function nextEffectFrame(time,offsetMs=0) {
    return effectFrameTimes(offsetMs).find(at=>at>time+1e-7)??effectFrameTimes(offsetMs)[0];
  }
  function bodyScale(action,worldPixels) {
    const idle=data.clips.idle,clip=data.clips[action],reference=data.bounds[idle.image],bounds=data.bounds[clip.image];
    const idleRatio=idle.frameSize/reference.frameSize,actionRatio=clip.frameSize/bounds.frameSize;
    const idleFit=Math.min(reference.bodyWidth/(reference.width*idleRatio),reference.bodyHeight/(reference.height*idleRatio));
    const fit=Math.min(reference.bodyWidth/(bounds.width*actionRatio),reference.bodyHeight/(bounds.height*actionRatio));
    return worldPixels*data.displaySize*fit/(idleFit*Math.max(reference.width,reference.height)*idleRatio);
  }
  function sceneAt(time,offsetMs=0) {
    const attackStart=300,hitAt=attackStart+data.hitAtMs;
    const attackerAction=time>=attackStart&&time<attackStart+duration(data.clips.attack)?'attack':'idle';
    const targetAction=time>=hitAt&&time<hitAt+duration(data.clips.hurt)?'hurt':'idle';
    const effectAge=time-hitAt-offsetMs;
    return {attackerAction,targetAction,attackerFrame:frameAt(data.clips[attackerAction],attackerAction==='attack'?time-attackStart:time),
      targetFrame:frameAt(data.clips[targetAction],targetAction==='hurt'?time-hitAt:time),hitAt,
      effectFrame:data.effect&&effectAge>=0&&effectAge<duration(data.effect)?frameAt(data.effect,effectAge):null};
  }
  globalThis.SpawnerVfxHitPreview=Object.freeze({frameAt,bodyScale,sceneAt,duration,effectFrameTimes,nextEffectFrame});
  if(!globalThis.document)return;
  const $=id=>document.getElementById(id),canvases=[$('vfx-baseline'),$('vfx-effect')],images=new Map();
  let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,previous=null,effectScale=1,offsetMs=0,ready=false;
  function load(source) {
    if(!images.has(source))images.set(source,(async()=>{const image=new Image();image.src=globalThis.SpawnerAssets?.source(source)||source;await image.decode();return image})());
    return images.get(source);
  }
  const loaded=new Map();
  const paths=[data.background,...Object.values(data.clips).map(clip=>clip.image),data.effect?.image].filter(Boolean);
  Promise.all([...new Set(paths)].map(async source=>loaded.set(source,await load(source)))).then(()=>{ready=true;createFrames();$('vfx-status').textContent='같은 원본 장면을 비교하고 있습니다. 피격 효과는 타격 순간부터 한 번 재생됩니다.';render()}).catch(()=>{
    playing=false;syncPlay();$('vfx-status').textContent='미리보기를 불러오지 못했습니다. 페이지를 새로 고쳐 다시 시도해 주세요.';
  });
  function drawBody(context,action,frame,x,floor,worldPixels,mirror) {
    const clip=data.clips[action],source=loaded.get(clip.image),geometry={...clip,...clip.frameGeometry?.[frame]},scale=bodyScale(action,worldPixels);
    context.save();context.translate(x,floor);context.scale(mirror?-1:1,1);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(source,frame%clip.columns*clip.frameSize,Math.floor(frame/clip.columns)*clip.frameSize,clip.frameSize,clip.frameSize,
      -geometry.pivotX*scale,-geometry.pivotY*scale,clip.frameSize*scale,clip.frameSize*scale);context.restore();
  }
  function drawScene(canvas,effect) {
    const context=canvas.getContext('2d'),box=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),width=box.width,height=box.height;
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio)}
    context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
    const background=loaded.get(data.background),bgScale=Math.max(width/background.naturalWidth,height/background.naturalHeight);
    context.drawImage(background,(width-background.naturalWidth*bgScale)/2,(height-background.naturalHeight*bgScale)/2,background.naturalWidth*bgScale,background.naturalHeight*bgScale);
    const world=Math.min(width*.72,height*1.45),floor=height*.82,sourceX=width*.34,targetX=width*.66,scene=sceneAt(time,offsetMs);
    drawBody(context,scene.attackerAction,scene.attackerFrame,sourceX,floor,world,false);
    drawBody(context,scene.targetAction,scene.targetFrame,targetX,floor,world,true);
    if(effect&&scene.effectFrame!==null){
      const clip=data.effect,frame=scene.effectFrame,size=world*.32*effectScale,x=targetX-world*.10,y=floor-world*.16;
      context.drawImage(loaded.get(clip.image),frame%clip.columns*clip.frameSize,Math.floor(frame/clip.columns)*clip.frameSize,clip.frameSize,clip.frameSize,x-size*.5,y-size*.5,size,size);
    }
  }
  function createFrames(){
    const names=['발생','타격','분해','확산','잔여','미세 조각','소멸','빈 프레임'];
    for(let i=0;i<data.effect.frameCount;i++){
      const item=document.createElement('button');item.type='button';item.className='frame';item.setAttribute('aria-label',names[i]+' 프레임으로 이동');item.addEventListener('click',()=>{time=effectFrameTimes(offsetMs)[i];playing=false;previous=null;syncPlay();render()});item.innerHTML='<canvas width="160" height="160"></canvas><span>'+String(i+1)+' · '+names[i]+'<br>'+data.effect.durationsMs[i]+'ms</span>';
      const context=item.querySelector('canvas').getContext('2d'),source=loaded.get(data.effect.image),f=data.effect.frameSize;
      context.drawImage(source,i%data.effect.columns*f,Math.floor(i/data.effect.columns)*f,f,f,0,0,160,160);$('vfx-frames').append(item);
    }
  }
  function render(){
    if(!ready)return;canvases.forEach((canvas,index)=>drawScene(canvas,index===1));
    $('vfx-time').value=String(Math.round(time));$('vfx-time-value').textContent=Math.round(time)+'ms';
    const frame=sceneAt(time,offsetMs).effectFrame;[...$('vfx-frames').children].forEach((item,i)=>item.classList.toggle('active',i===frame));
  }
  function syncPlay(){$('vfx-play').textContent=playing?'일시정지':'재생';$('vfx-play').setAttribute('aria-pressed',String(!playing))}
  $('vfx-play').addEventListener('click',()=>{playing=!playing;previous=null;syncPlay()});
  $('vfx-replay').addEventListener('click',()=>{time=Math.max(0,300+data.hitAtMs-100);playing=true;previous=null;syncPlay();render()});
  $('vfx-step').addEventListener('click',()=>{playing=false;previous=null;time=nextEffectFrame(time,offsetMs);syncPlay();render()});
  $('vfx-time').addEventListener('input',event=>{playing=false;time=Number(event.target.value);previous=null;syncPlay();render()});
  $('vfx-scale').addEventListener('input',event=>{effectScale=Number(event.target.value);$('vfx-scale-value').textContent=effectScale+'배';render()});
  $('vfx-offset').addEventListener('input',event=>{offsetMs=Number(event.target.value);$('vfx-offset-value').textContent=(offsetMs>0?'+':'')+offsetMs+'ms';render()});
  new ResizeObserver(render).observe(canvases[0]);
  document.addEventListener('visibilitychange',()=>{previous=null});
  function tick(now){if(playing&&ready&&!document.hidden&&previous!==null){time=(time+Math.min(100,now-previous)*Number($('vfx-speed').value))%1800;render()}previous=now;requestAnimationFrame(tick)}
  syncPlay();requestAnimationFrame(tick);
})();
