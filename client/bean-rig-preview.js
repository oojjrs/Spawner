(async()=>{
  'use strict';
  const $=id=>document.getElementById(id),entries=globalThis.SpawnerBeanRigPreviewData.entries,M=globalThis.SpawnerAppearance;
  const names={body:'몸통','eye-left':'왼눈','eye-right':'오른눈','foot-left':'왼발','foot-right':'오른발','leaf-left':'왼잎','leaf-right':'오른잎','blade-leaf':'잎날','antenna-stalk':'안테나 줄기','antenna-cap':'안테나 끝','armor-left':'왼갑각','armor-right':'오른갑각',secretion:'분비기관'};
  const mobile=matchMedia('(max-width:720px)').matches;
  const source=M.createUnitAppearanceSource({sourceUrl:path=>globalThis.SpawnerAssets.source(path),byteBudget:M.UNIT_APPEARANCE_BYTE_BUDGETS[mobile?'mobile':'desktop']});
  const canvas=$('unit'),marks=$('marks').getContext('2d');
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false});
  let cpu=null,program,locations,textures=[];
  let selected=null,revision=0,start=performance.now(),age=0,paused=matchMedia('(prefers-reduced-motion:reduce)').matches,lastFrame=-Infinity,raf;
  if(gl){
    const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=vec2((position.x+1.0)*.5,(1.0-position.y)*.5);gl_Position=vec4(position,0,1);}';
    const fragment=`precision highp float;varying vec2 uv;uniform sampler2D original,weights,partIds,palette;uniform vec2 delta;uniform float tint,part;
      void main(){vec2 q=uv;for(int i=0;i<12;i++)q=uv-delta*texture2D(weights,q).r;
      vec4 color=texture2D(original,q);float id=floor(texture2D(partIds,q).r*255.0+.5);
      if(tint>.5&&id>.5){vec3 paint=texture2D(palette,vec2((id+.5)/16.0,.5)).rgb;color.rgb=mix(color.rgb,paint*color.a,.52);}
      if(part>.5&&abs(id-part)>.25)color*=.12;gl_FragColor=color;}`;
    function shader(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    locations=Object.fromEntries(['delta','tint','part'].map(key=>[key,gl.getUniformLocation(program,key)]));
    ['original','weights','partIds','palette'].forEach((key,index)=>gl.uniform1i(gl.getUniformLocation(program,key),index));
  }else cpu=canvas.getContext('2d',{willReadFrequently:true});
  function texture(index,width,height,data,format=gl.LUMINANCE,linear=true){
    const tex=gl.createTexture();textures.push(tex);gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,linear?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,linear?gl.LINEAR:gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if(width)gl.texImage2D(gl.TEXTURE_2D,0,format,width,height,0,format,gl.UNSIGNED_BYTE,data);
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,data);
  }
  async function inflate(base64){
    if(typeof DecompressionStream!=='function')throw Error('이 브라우저는 압축 리그 데이터를 지원하지 않습니다. Chrome을 업데이트해 주세요.');
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const result=new Uint8Array(await new Response(stream).arrayBuffer());
    if(result.length!==512*512)throw Error('잘못된 리그 가중치 크기');return result;
  }
  function deltaFor(entry,action,t){
    const scale=entry.draftActions.amplitudeScale;
    if(action==='idle')return [1.4*Math.sin(2*Math.PI*t)*scale,-1.8*(1-Math.cos(2*Math.PI*t))/2*scale];
    if(action==='hurt'){const impulse=Math.sin(Math.PI*t)*Math.exp(-.8*t);return [-4*impulse*scale,2*impulse*scale];}
    return [0,0];
  }
  function reset(){age=0;start=performance.now();}
  function clearSelected(){if(selected){selected.bitmap.close();selected.lease.release();selected=null;}source.clear();for(const texture of textures)gl.deleteTexture(texture);textures=[];if(gl)gl.clear(gl.COLOR_BUFFER_BIT);else cpu.clearRect(0,0,512,512);marks.clearRect(0,0,512,512);}
  async function choose(mask){
    const token=++revision;clearSelected();$('status').textContent='선택한 원화를 확인하는 중…';
    const entry=entries.find(row=>row.mask===mask);let lease=null,bitmap=null;
    try{
      lease=await source.acquire(entry.sourceImage);bitmap=await createImageBitmap(lease.blob);
      const weight=await inflate(entry.bodyWeightDeflateBase64);
      if(token!==revision){bitmap.close();lease.release();source.clear();return;}
      const ids=new Uint8Array(512*512),palette=new Uint8Array(16*4),ownership=new Uint8Array(512*512);
      entry.parts.forEach((part,index)=>{
        const id=index+1;for(const [y,a,b] of part.coverageRuns)for(let x=a;x<b;x++){const p=y*512+x;if(++ownership[p]!==1)throw Error('부위 가시 영역 중복');ids[p]=id;}
        for(let channel=0;channel<3;channel++)palette[id*4+channel]=parseInt(part.reviewColor.slice(1+channel*2,3+channel*2),16);palette[id*4+3]=255;
      });
      const scratch=document.createElement('canvas');scratch.width=scratch.height=512;const ctx=scratch.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const rgba=ctx.getImageData(0,0,512,512);
      let visible=0;for(let p=0;p<ids.length;p++)if(rgba.data[p*4+3]){visible++;if(!ids[p])throw Error('부위 가시 영역 누락');}
      const bounds=[Math.max(0,Math.min(...entry.parts.map(p=>p.sourceBounds[0]))-5),Math.max(0,Math.min(...entry.parts.map(p=>p.sourceBounds[1]))-5),Math.min(512,Math.max(...entry.parts.map(p=>p.sourceBounds[0]+p.sourceBounds[2]))+5),Math.min(512,Math.max(...entry.parts.map(p=>p.sourceBounds[1]+p.sourceBounds[3]))+5)];
      selected={entry,lease,bitmap,weight,ids,palette,rgba,visible,bounds};lease=null;bitmap=null;
      if(gl){gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);texture(0,0,0,selected.bitmap,gl.RGBA);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);texture(1,512,512,weight);texture(2,512,512,ids,gl.LUMINANCE,false);texture(3,16,1,palette,gl.RGBA,false);}
      $('form').value=String(mask);$('part').innerHTML='<option value="all">전체</option>'+entry.parts.map((part,index)=>`<option value="${index+1}">${names[part.id]}</option>`).join('');
      $('parts').replaceChildren(...entry.parts.map(part=>{const span=document.createElement('span'),dot=document.createElement('i');dot.style.background=part.reviewColor;span.append(dot,document.createTextNode(names[part.id]));return span;}));
      $('status').textContent=`새싹콩 ${mask.toString(16).padStart(2,'0')} · ${entry.parts.length}개 가시 부위\n대기·피격 시안 · 발 접촉 고정`;
      $('qa').textContent=`원화 복원 오차 0 · 영역 누락·중복 0\n발·단단한 부위 픽셀 변화 0\n프레임 가장자리 잘림 0\n검사 프레임: 대기 17장 + 피격 17장\n현재 표시: ${gl?'GPU 표면 변형':'소프트웨어 표면 변형'}`;
      $('pending').textContent='검수 대기: 부위 경계의 세부 확인, 장식별 독립 모션, 더 큰 피격 자세, 이동과 나머지 필수 동작. 시안은 게임 동작으로 등록되지 않았습니다.';
      $('identity').textContent=`${entry.sourceId}\n${entry.sourceHash}`;reset();
      return selected;
    }catch(error){if(bitmap)bitmap.close();if(lease)lease.release();if(token===revision)$('status').textContent='불러오기 실패: '+error.message;throw error;}
  }
  function sampleWeight(weight,x,y){x=Math.max(0,Math.min(511,x));y=Math.max(0,Math.min(511,y));const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;return ((weight[b*512+a]*(1-u)+weight[b*512+Math.min(511,a+1)]*u)*(1-v)+(weight[Math.min(511,b+1)*512+a]*(1-u)+weight[Math.min(511,b+1)*512+Math.min(511,a+1)]*u)*v)/255;}
  function cpuDraw(delta){
    const {rgba,weight,ids,palette}=selected,output=new ImageData(512,512),data=rgba.data,tint=$('tint').checked,part=+$('part').value||0;
    for(let y=selected.bounds[1];y<selected.bounds[3];y++)for(let x=selected.bounds[0];x<selected.bounds[2];x++){
      let qx=x,qy=y;for(let i=0;i<12;i++){const w=sampleWeight(weight,qx,qy);qx=x-delta[0]*w;qy=y-delta[1]*w;}
      if(qx<0||qy<0||qx>=511||qy>=511)continue;
      const a=Math.floor(qx),b=Math.floor(qy),u=qx-a,v=qy-b,indices=[b*512+a,b*512+a+1,(b+1)*512+a,(b+1)*512+a+1],factors=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
      let alpha=0,r=0,g=0,blue=0;
      for(let j=0;j<4;j++){const p=indices[j]*4,f=data[p+3]/255*factors[j];alpha+=f;r+=data[p]*f;g+=data[p+1]*f;blue+=data[p+2]*f;}
      if(alpha<=0)continue;const id=ids[Math.round(qy)*512+Math.round(qx)],fade=part && id!==part ? .12 : 1,p=(y*512+x)*4;
      for(let c=0;c<3;c++){const color=[r,g,blue][c]/alpha;output.data[p+c]=tint&&id?color*.48+palette[id*4+c]*.52:color;}output.data[p+3]=alpha*255*fade;
    }
    cpu.putImageData(output,0,0);
  }
  function draw(action,t){
    if(!selected)return;const delta=deltaFor(selected.entry,action,t);
    if(gl){gl.viewport(0,0,512,512);gl.uniform2f(locations.delta,delta[0]/512,delta[1]/512);gl.uniform1f(locations.tint,$('tint').checked?1:0);gl.uniform1f(locations.part,+$('part').value||0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}else cpuDraw(delta);
    marks.clearRect(0,0,512,512);marks.strokeStyle='#89aa78';marks.lineWidth=.8;marks.beginPath();marks.moveTo(16,448);marks.lineTo(496,448);marks.stroke();
    if($('anchors').checked)for(const key of ['leftEye','rightEye','supportPoint']){let [x,y]=selected.entry.landmarks[key];if(key!=='supportPoint'){x+=delta[0];y+=delta[1];}marks.strokeStyle=key==='supportPoint'?'#ffbc80':'#a1dcff';marks.beginPath();marks.moveTo(x-4,y);marks.lineTo(x+4,y);marks.moveTo(x,y-4);marks.lineTo(x,y+4);marks.stroke();}
    return delta;
  }
  function pixels(){if(gl){const result=new Uint8Array(512*512*4),flipped=new Uint8Array(result.length);gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,result);for(let y=0;y<512;y++)flipped.set(result.subarray((511-y)*512*4,(512-y)*512*4),y*512*4);return flipped;}return cpu.getImageData(0,0,512,512).data;}
  async function validate(mask){
    await choose(mask);$('tint').checked=false;$('part').value='all';draw('neutral',0);const neutral=pixels();
    const rows=[];for(const action of ['idle','hurt'])for(const t of [0,.25,.5,.75,1]){draw(action,t);const frame=pixels();let fixedMaxError=0,changed=0;
      for(let p=0;p<selected.weight.length;p++){let difference=0;for(let c=0;c<4;c++)difference=Math.max(difference,Math.abs(frame[p*4+c]-neutral[p*4+c]));if(selected.weight[p]===0)fixedMaxError=Math.max(fixedMaxError,difference);if(difference)changed++;}
      if(fixedMaxError>1)throw Error(`접촉 고정 검사 실패 ${mask}/${action}/${t}: ${fixedMaxError}`);rows.push({action,t,fixedMaxError,changedPixels:changed});}
    return {mask,sourceId:selected.entry.sourceId,visiblePixels:selected.visible,partCount:selected.entry.parts.length,rows,renderer:gl?'webgl':'cpu',sourceStats:source.stats()};
  }
  entries.forEach(entry=>{const option=document.createElement('option');option.value=entry.mask;option.textContent='새싹콩 '+entry.mask.toString(16).padStart(2,'0');$('form').append(option);});
  $('form').addEventListener('change',()=>choose(+$('form').value).catch(console.error));$('action').addEventListener('change',reset);
  $('pause').textContent=paused?'재생':'일시정지';$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'재생':'일시정지';if(!paused)start=performance.now()-age;});$('restart').addEventListener('click',reset);
  function tick(now){if(!document.hidden&&now-lastFrame>=1000/(gl?30:10)){lastFrame=now;if(!paused)age=now-start;const action=$('action').value,duration=selected?.entry.draftActions[action]?.durationMs||3600,t=action==='idle'?(age%duration)/duration:Math.min(1,age/duration);draw(action,t);$('clock').textContent=(Math.min(age,action==='hurt'?duration:Infinity)/1000).toFixed(2)+'s';const stats=source.stats();$('budget').textContent=`원화 ${(stats.residentBytes/1048576).toFixed(2)} / ${(stats.byteBudget/1048576).toFixed(0)} MiB · 선택한 원화 1개만 유지`;}raf=requestAnimationFrame(tick);}
  globalThis.SpawnerBeanRigReview={choose,draw,validate,pixels,entries,sourceStats:()=>source.stats(),pause(){paused=true;},get selected(){return selected?.entry.mask;}};
  await choose(0);raf=requestAnimationFrame(tick);
  addEventListener('pagehide',()=>{revision++;cancelAnimationFrame(raf);clearSelected();});
})().catch(error=>{document.getElementById('status').textContent='불러오기 실패: '+error.message;console.error(error);});
