import {createRoom,tickRoom} from '../../client/room.mjs';
import {ATTRIBUTE_DNA as M} from '../../server/dna.mjs';
import {birthCost} from '../../server/attributes.mjs';
import {nestUpgradeCost} from '../../server/nests.mjs';
import {writeFileSync} from 'node:fs';
function arrange(genes,level=1){let found;function dfs(p,left){if(!left.length){found=p;return true;} for(const key of new Set(left)){const gene=M.lookup.get(key);for(let rotation=0;rotation<6;rotation++){const next=[...p,{gene:key,grade:gene.grade,shape:gene.steps,rotation}];if(!M.trace(next,level).valid)continue;const rest=left.slice();rest.splice(rest.indexOf(key),1);if(dfs(next,rest))return true;}}return false;}dfs([],genes);if(!found)throw Error('no layout');return {version:3,pieces:found,budget:9999,level};}
const profiles={basic:arrange(['gather']),moderate:arrange(['gather','capacity','capacity','health']),high:arrange(['gather','capacity','capacity','capacity','movement','movement','harvestSpeed'])};
const soldierDna={version:3,pieces:[{"gene": "blade", "grade": 2, "shape": [0, 1, 5], "rotation": 0}, {"gene": "power", "grade": 2, "shape": [0, 0, 0], "rotation": 4}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 3}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 3}, {"gene": "movement", "grade": 1, "shape": [0, 5], "rotation": 2}],budget:9999,level:2};

const growthWorker=arrange(['gather','capacity','capacity','health','health','movement','harvestSpeed','antenna'],2);
const strongerSoldier={version:3,level:2,budget:9999,pieces:[{"gene": "blade", "grade": 2, "shape": [0, 1, 5], "rotation": 0}, {"gene": "power", "grade": 2, "shape": [0, 0, 0], "rotation": 4}, {"gene": "power", "grade": 2, "shape": [0, 0, 0], "rotation": 2}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 3}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 2}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 2}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 5}, {"gene": "movement", "grade": 1, "shape": [0, 5], "rotation": 5}, {"gene": "carapace", "grade": 2, "shape": [0, 1, 0], "rotation": 4}]};
const results=[];
const seeds=(process.env.SEEDS||'13,413').split(',').map(Number);
const tribes=(process.env.TRIBES||'bean,spore,pebble,spring').split(',');
for(const seed of seeds)for(const [order,tribe] of tribes.entries()){
 let rng=seed+['bean','spore','pebble','spring'].indexOf(tribe);Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/2**32;};
 const room=createRoom('Opening test',seed,tribe);const game=room.games.get(room.hostId),colony=room.colonies.find(c=>c.ownerId===room.hostId);
 const worker=game.command({type:'design',templateId:null,name:'worker',dna:profiles.moderate,slots:[],birth:false});
 const result={seed,tribe,history:[],soldierBirths:[],raidEvents:[],deaths:[],failures:[],damageSources:{},upgradeAt:null,upgrades:[],workerBirths:[]};let workerAdded=false,soldierTemplate,growthTemplate,strongerTemplate,seen=new Map(),raids=new Map(),combatSteps=0;
 room.onCombatEvent=event=>{if(event.amount<=0||!String(event.targetId).startsWith(colony.id+':'))return;const source=[...room.games.values()].flatMap(g=>g.agents).find(a=>a.id===event.sourceId)||room.creatureSystem.agents.find(a=>a.id===event.sourceId);const key=source?.raid?'raid':source?.species||source?.tribe||'unknown';result.damageSources[key]??={damage:0,hits:0};result.damageSources[key].damage+=event.amount;result.damageSources[key].hits++;};
 const record=()=>{const agents=game.agents;for(const a of agents)seen.set(a.id,{id:a.id,soldier:!!a.dna?.pieces.some(p=>p.gene==='blade'),health:a.health});for(const [id,a]of seen)if((!agents.some(x=>x.id===id)||agents.find(x=>x.id===id)?.health<=0)&&!result.deaths.some(x=>x.id===id))result.deaths.push({...a,time:room.simSeconds});
 for(const a of room.creatureSystem.agents){if(a.raid?.colonyId!==colony.id)continue;const old=raids.get(a.id);const phase=a.health<=0?'dead':a.raid.phase;if(old!==phase){result.raidEvents.push({time:room.simSeconds,id:a.id,phase,health:a.health,x:a.x,y:a.y,departed:a.raid.departedAt});raids.set(a.id,phase);}}if(agents.some(a=>a.combat))combatSteps++;};
 for(let step=1;step<=Number(process.env.SECONDS||1500)*4;step++){
 tickRoom(room,.25);const now=room.simSeconds;record();if(now>=30&&now%15===0)try{
 if(!workerAdded&&game.snapshot().evolutionPoints>=birthCost({dna:profiles.moderate},tribe)){game.command({type:'birth',templateId:worker.templateId});workerAdded=true;}
 else if(now>=120&&game.nestLevel===1&&game.snapshot().evolutionPoints>=nestUpgradeCost(1,tribe)){game.command({type:'upgrade'});result.upgradeAt=now;result.upgrades.push({time:now,level:game.nestLevel});}
 if(now>=150&&game.nestLevel>=2){const desired=now<360?2:Math.min(10,2+Math.floor((now-300)/60));const dna=now>=600?strongerSoldier:soldierDna;let living=game.agents.filter(a=>a.health>0&&a.dna?.pieces.some(p=>p.gene==='blade')).length;while(living<desired&&game.snapshot().evolutionPoints>=birthCost({dna},tribe)&&game.agents.length<20){let templateId;if(now>=600){strongerTemplate??=game.command({type:'design',templateId:null,name:'reinforced',dna,slots:[],birth:false}).templateId;templateId=strongerTemplate;}else{soldierTemplate??=game.command({type:'design',templateId:null,name:'soldier',dna,slots:[],birth:false}).templateId;templateId=soldierTemplate;}game.command({type:'birth',templateId});result.soldierBirths.push(now);living++;}
if(now>=360&&now%90===0&&game.agents.filter(a=>a.health>0&&a.dna?.pieces.some(p=>p.gene==='gather')).length<10&&game.agents.length<20&&game.snapshot().evolutionPoints>=birthCost({dna:growthWorker},tribe)){growthTemplate??=game.command({type:'design',templateId:null,name:'growth worker',dna:growthWorker,slots:[],birth:false}).templateId;game.command({type:'birth',templateId:growthTemplate});result.workerBirths.push(now);}
if(now>=600&&game.nestLevel<4&&game.snapshot().evolutionPoints>=nestUpgradeCost(game.nestLevel,tribe)+46){game.command({type:'upgrade'});result.upgrades.push({time:now,level:game.nestLevel});}
}
 }catch(e){if(result.failures.length<10)result.failures.push({time:now,error:String(e)});}
 if(now%60===0){const h={time:now,points:game.snapshot().evolutionPoints,food:game.colonyFood,nest:game.nest.health,level:game.nestLevel,agents:game.agents.filter(a=>a.health>0).length,soldiers:game.agents.filter(a=>a.health>0&&a.dna?.pieces.some(p=>p.gene==='blade')).length,combatSeconds:combatSteps/4};result.history.push(h);console.log(seed,tribe,JSON.stringify(h));writeFileSync(new URL('./'+(process.env.LABEL||'run')+'-in-progress.json',import.meta.url),JSON.stringify(result,null,2));}
 if(game.ending){result.ending=game.ending;break;}
 }
 result.combatSeconds=combatSteps/4;results.push(result);writeFileSync(new URL('./'+(process.env.LABEL||'run')+'-results.json',import.meta.url),JSON.stringify(results,null,2));
}
