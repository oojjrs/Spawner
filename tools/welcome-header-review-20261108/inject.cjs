const inject=`
 globalThis.__qa = {
 roster: [...tribes.flatMap(key=>appearances.map((_,variant)=>({key,variant}))),...neutralSpecies.map(key=>({key,variant:0}))],
 async prepare(choice) { current=choice; await prepareInitialAssets(); await prepareChoice(choice); width=480;height=280;canvas.width=480;canvas.height=280; context=canvas.getContext('2d');started=true; },
 sample(action,t) { phase=action==='idle'?'rest':action;phaseStartedAt=0;elapsed=t;timeline=t/1000;current={...current}; const m=travelMotion();const originalX=m.x; m.x=240; context.clearRect(0,0,480,280);drawPreparedUnit(m,true);const data=context.getImageData(0,0,480,280).data;let l=480,r=-1,top=280,b=-1,count=0;for(let y=0;y<280;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>16){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);b=Math.max(b,y);count++;} const pose=m.agent.species?model.creaturePresentationPose(model,m.agent,timeline,false,creatureResources,null):null;return {t,action,x:originalX,cell:m.cell,durationMs:m.durationMs,frame:pose?.frame,poseAction:pose?.action,mirror:pose?.mirrorX,agentMode:m.agent.mode,moveDuration:m.agent.moveDuration,bounds:count?{x:l,y:top,width:r-l+1,height:b-top+1,pixels:count}:null,png:canvas.toDataURL()}; }
 };
`;
module.exports=inject;
