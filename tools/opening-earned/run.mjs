import {createRoom,tickRoom} from '../../client/room.mjs';
import {ATTRIBUTE_DNA as D} from '../../server/dna.mjs';
import {birthCost} from '../../server/attributes.mjs';
import {nestUpgradeCost} from '../../server/nests.mjs';
import {writeFileSync} from 'node:fs';
function arrange(genes,level){let found;function dfs(p,left){if(!left.length){found=p;return true}for(const key of new Set(left)){const g=D.lookup.get(key);for(let rotation=0;rotation<6;rotation++){const n=[...p,{gene:key,grade:g.grade,shape:g.steps,rotation}];if(!D.trace(n,level).valid)continue;const r=left.slice();r.splice(r.indexOf(key),1);if(dfs(n,r))return true}}return false}dfs([],genes);if(!found)throw Error('layout');return {version:3,level,budget:9999,pieces:found}}
const worker=arrange(['gather','capacity','capacity','health'],1),cheap=arrange(['gather'],1),soldier=arrange(process.env.ARMY==='17'?['blade','power','health']:['blade','health','health','movement'],2);
const rows=[];
for(const seed of (process.env.SEEDS||'13,413,731047').split(',').map(Number))for(const tribe of (process.env.TRIBES||'bean,spore,pebble,spring').split(','))for(const policy of (process.env.POLICIES||'save,worker,cheap').split(','))for(const delay of (process.env.DELAYS||'0,30').split(',').map(Number)){
 let rng=seed+['bean','spore','pebble','spring'].indexOf(tribe);Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/2**32};
 const room=createRoom('Earned opening',seed,tribe),g=room.games.get(room.hostId);let extra=policy==='save',workerId,soldierId,nextAction=delay,firstAffordable=null;
 const r={seed,tribe,policy,delay,armyCost:birthCost({dna:soldier},tribe),start:g.snapshot().evolutionPoints,cost:nestUpgradeCost(1,tribe),upgrade:null,births:[],ready:[],snapshots:[],errors:[]};
 try{g.command({type:'upgrade'});r.instantUpgrade=true}catch{r.instantUpgrade=false}
 for(let i=1;i<=Number(process.env.SECONDS||480)*4;i++){
  tickRoom(room,.25);const now=room.simSeconds,p=g.snapshot().evolutionPoints;
  const colony=room.colonies.find(c=>c.ownerId===room.hostId);
  for(const a of room.creatureSystem.agents)if(a.raid?.colonyId===colony.id){r.firstRaidDeparture??=a.raid.departedAt;if(a.raid.phase==='active')r.firstRaidArrival??=now;}
  if(g.nestLevel===1&&p>=r.cost&&firstAffordable===null)firstAffordable=now;
  if(now>=nextAction&&now%5===0)try{
   nextAction=now+Math.max(5,delay);
   if(!extra){const dna=policy==='cheap'?cheap:worker;if(p>=birthCost({dna},tribe)){workerId??=g.command({type:'design',name:'extra worker',templateId:null,dna,slots:[],birth:false}).templateId;g.command({type:'birth',templateId:workerId});extra=true;r.workerAt=now;nextAction=now+delay;}}
   else if(g.nestLevel===1&&p>=r.cost){g.command({type:'upgrade'});r.upgrade=now;nextAction=now+delay;}
   else if(g.nestLevel>=2&&r.births.length<2&&p>=birthCost({dna:soldier},tribe)){soldierId??=g.command({type:'design',name:'basic soldier',templateId:null,dna:soldier,slots:[],birth:false}).templateId;g.command({type:'birth',templateId:soldierId});r.births.push(now);nextAction=now+delay;}
  }catch(e){r.errors.push(String(e))}
  for(const a of g.agents)if(a.dna?.pieces.some(p=>p.gene==='blade')&&!r.ready.some(v=>v.id===a.id)&&!(a.birth?.readyAt>now))r.ready.push({id:a.id,time:now});
  if(now%60===0)r.snapshots.push({time:now,food:g.colonyFood,points:g.snapshot().evolutionPoints,level:g.nestLevel,hp:g.nest.health,units:g.agents.filter(a=>a.health>0).length});
  if(g.ending||g.nest.health<=0){r.ending=g.ending;r.nestDestroyed=g.nest.health<=0;break}
 }
 r.firstAffordable=firstAffordable;rows.push(r);writeFileSync(new URL('./'+(process.env.LABEL||'run')+'.json',import.meta.url),JSON.stringify(rows,null,2));console.log(JSON.stringify({seed,tribe,policy,delay,upgrade:r.upgrade,ready:r.ready.map(a=>a.time),food300:r.snapshots.find(s=>s.time===300)?.food,final:r.snapshots.at(-1)}));
}
