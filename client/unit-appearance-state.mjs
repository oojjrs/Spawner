import { UNIT_ANIMATIONS, unitMovementElapsedMs } from './unit-animation.mjs';
import { unitAppearanceForAgent, unitAppearancePose } from './unit-appearance.mjs';

const finite = (...values) => values.find(Number.isFinite);
const durationOf = clip => clip?.durationsMs?.reduce((sum,value)=>sum+value,0);
const interpolate = (value,a,b,c,d) => a===b?d:c+(value-a)/(b-a)*(d-c);

// These clocks describe simulation time, not wall-clock render frames.
export function unitActionState(agent, time, options = {}) {
  if (!agent || !Number.isFinite(time)) return null;
  const clips=options.animations||UNIT_ANIMATIONS[agent.tribe||'bean']||{};
  const duration=action=>durationOf(clips[action])||({death:1820,birth:2500,hurt:760,attack:1010,ranged:600,throw:450,harvest:1000,walk:1120,carry:1120,jump:1120,idle:6400}[action]);
  function state(action,startedAt,segments,details={}) {
    const ms=duration(action),clock=segments||[[startedAt,0],[startedAt+ms/1000,ms]];
    let segment=clock.length-2;
    for(let i=0;i<clock.length-1;i++)if(time<=clock[i+1][0]){segment=i;break}
    const [a,b]=[clock[segment],clock[segment+1]];
    return {action,startedAt,durationMs:ms,segments:clock,elapsedMs:Math.max(0,interpolate(time,a[0],b[0],a[1],b[1])),unitId:agent.id,...details};
  }
  if(agent.health<=0||agent.mode==='death')return state('death',finite(agent.deathStartedAt,agent.diedAt,agent.animationStartedAt,agent.bornAt,0));
  if(agent.birth){const start=finite(agent.birth.startedAt,agent.bornAt,0),end=finite(agent.birth.readyAt,start+duration('birth')/1000);if(time<end)return state('birth',start,[[start,0],[end,duration('birth')]])}
  const attack=agent.attack;
  function attacking() {
    if(!attack||!Number.isFinite(attack.startedAt)||time<attack.startedAt)return null;
    const ranged=!!(attack.dnaRanged||attack.mode==='ranged'||attack.attackMode==='ranged');
    const action=ranged?'ranged':'attack',ms=duration(action),start=attack.startedAt;
    const end=finite(attack.endsAt,start+ms/1000/(attack.speed||1));if(time>=end)return null;
    // In the world hitAt is projectile arrival. The laboratory uses it for
    // the shot's launch cue; the caller selects that explicit clock contract.
    const contact=ranged?finite(attack.launchedAt,options.attackClock==='lab'?attack.hitAt:undefined):attack.hitAt;
    const cue=ranged?(clips.ranged?.launchAtMs??200):(clips.attack?.hitTimeMs??300);
    const anchored=Number.isFinite(contact)&&contact>start&&contact<end;
    return state(action,start,anchored?[[start,0],[contact,cue],[end,ms]]:[[start,0],[end,ms]],{hasLaunchAnchor:!ranged||anchored});
  }
  const activeAttack=attacking();if(agent.combat?.version===2&&activeAttack)return activeAttack;
  const hurt=agent.hurtStartedAt,hurtSeconds=agent.combat?.version === 2 ? .12 : duration('hurt')/1000;
  if(Number.isFinite(hurt)&&time>=hurt&&time<hurt+hurtSeconds)return state('hurt',hurt,[[hurt,0],[hurt+hurtSeconds,duration('hurt')]]);
  if(activeAttack)return activeAttack;
  if(agent.mode==='unload'&&agent.foodDelivery)return state('throw',finite(agent.foodDelivery.startedAt,time));
  if(agent.mode==='harvest')return state('harvest',finite(agent.harvestStarted,agent.animationStartedAt,0));
  if(options.preview?.action==='jump')return state('jump',finite(options.preview.startedAt,time));
  if(agent.moveDuration>0&&Number.isFinite(agent.moveStartedAt)&&time>=agent.moveStartedAt&&time<agent.moveStartedAt+agent.moveDuration){
    const action=agent.carrying>0?'carry':'walk',ms=duration(action),cycles=clips[action]?.cyclesPerCell||clips.walk?.cyclesPerCell||1,start=agent.moveStartedAt,step=Math.max(0,(agent.stepCount||1)-1);
    if(!agent.species){const elapsed=unitMovementElapsedMs(agent,start);return state(action,start,[[start,elapsed],[start+agent.moveDuration,elapsed+agent.moveDuration*1000]])}
    return state(action,start,[[start,step*cycles*ms],[start+agent.moveDuration,(step+1)*cycles*ms]]);
  }
  return state('idle',finite(agent.animationStartedAt,agent.bornAt,0));
}

export function unitAppearanceStatePose(agent,time,options={}) {
  const appearance=unitAppearanceForAgent(agent);
  if(!appearance)return null;
  const state=unitActionState(agent,time,{...options,animations:appearance.definition.actions});
  // Missing actions remain unavailable; they never silently become idle clips.
  const pose=state&&unitAppearancePose(appearance.tribe,appearance.mask,state.action,state.elapsedMs);
  return pose?{...pose,state}:null;
}

function absoluteEventTime(state,atMs) {
  const segments=state.segments;
  for(let i=0;i<segments.length-1;i++){
    const [a,b]=[segments[i],segments[i+1]];
    if(atMs>=a[1]-1e-7&&atMs<=b[1]+1e-7)return interpolate(atMs,a[1],b[1],a[0],b[0]);
  }
  // Non-looping actions may continue to hold their final pose.
  if(atMs<segments[0][1])return null;
  const a=segments.at(-2),b=segments.at(-1);
  return interpolate(atMs,a[1],b[1],a[0],b[0]);
}

export function createUnitAppearanceEventPlayback({maxGap=.5}={}) {
  const cursors=new Map(),seen=new Map();
  function update(state,animation,time) {
    if(!state||!animation||!Number.isFinite(time))return [];
    const previous=cursors.get(state.unitId);
    // Refresh recency and bound every observation, including first sightings,
    // rewinds and long gaps which return before event traversal.
    cursors.delete(state.unitId);cursors.set(state.unitId,time);
    while(cursors.size>512)cursors.delete(cursors.keys().next().value);
    if(previous===undefined||time<previous||time-previous>maxGap)return [];
    const events=[],ms=durationOf(animation),loop=animation.loop===true;
    if(!(ms>0))return [];
    const segment=state.segments.find((value,index,all)=>index<all.length-1&&previous<=all[index+1][0])||state.segments.at(-2);
    const end=state.segments[state.segments.indexOf(segment)+1];
    const earlier=interpolate(previous,segment[0],end[0],segment[1],end[1]);
    const first=loop?Math.max(0,Math.floor(earlier/ms)-1):0;
    const last=loop?Math.max(first,Math.floor(state.elapsedMs/ms)):0;
    for(let cycle=first;cycle<=last;cycle++)for(const [index,event]of(animation.events||[]).entries()){
      if(event.type==='launch'&&state.hasLaunchAnchor===false)continue;
      const atMs=cycle*ms+event.atMs;if(!Number.isFinite(atMs)||event.atMs<0||event.atMs>ms)continue;
      const at=absoluteEventTime(state,atMs);
      if(at===null||at<=previous+1e-9||at>time+1e-9)continue;
      const id=[state.unitId,animation.sourceId,state.action,index,cycle,at.toFixed(6)].join(':');
      if(seen.has(id))continue;
      seen.set(id,true);events.push({...event,at,cycle,dedupeId:id,unitId:state.unitId,action:state.action});
    }
    while(seen.size>2048)seen.delete(seen.keys().next().value);
    return events;
  }
  return {update,reset(){cursors.clear();seen.clear()}};
}
