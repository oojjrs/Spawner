import {generateWorld} from '../../server/world.mjs';
import {createGame} from '../../server/game.mjs';
import {ATTRIBUTE_DNA as M} from '../../server/dna.mjs';
import {birthCost} from '../../server/attributes.mjs';
import {nestUpgradeCost} from '../../server/nests.mjs';
import {writeFileSync} from 'node:fs';
function arrange(genes){let found;function dfs(p,left){if(!left.length){found=p;return true;} for(const key of new Set(left)){const gene=M.lookup.get(key);for(let rotation=0;rotation<6;rotation++){const next=[...p,{gene:key,grade:gene.grade,shape:gene.steps,rotation}];if(!M.trace(next,1).valid)continue;const rest=left.slice();rest.splice(rest.indexOf(key),1);if(dfs(next,rest))return true;}}return false;}dfs([],genes);if(!found)throw Error('no layout');return {version:3,pieces:found,budget:9999,level:1};}
const profiles={basic:arrange(['gather']),moderate:arrange(['gather','capacity','capacity','health']),high:arrange(['gather','capacity','capacity','capacity','movement','movement','harvestSpeed'])};
const soldierDna={version:3,pieces:[{"gene": "blade", "grade": 2, "shape": [0, 1, 5], "rotation": 0}, {"gene": "power", "grade": 2, "shape": [0, 0, 0], "rotation": 4}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 3}, {"gene": "health", "grade": 1, "shape": [0, 4], "rotation": 3}, {"gene": "movement", "grade": 1, "shape": [0, 5], "rotation": 2}],budget:9999,level:2};
const results=[];
for(const seed of [13,413,731047,1,42,100,2026,777,999,31415]){const world=generateWorld(seed);for(const policy of ['moderate'])for(const [order,camp] of world.camps.entries()){
 let rng=seed+order;const originalRandom=Math.random;Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/2**32;};
 const colony={id:order+1,ownerId:'player',tribe:camp.tribe==='sprout'?'bean':camp.tribe,x:camp.x-2,y:camp.y-2,occupiedCells:new Set()};
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(!([0,4].includes(x)&&[0,4].includes(y)))colony.occupiedCells.add(x+','+y);
 const food=new Map([...world.food,...world.resources].map(([x,y,amount,resourceType])=>[x+','+y,{x,y,amount,initialAmount:amount,resourceType,kind:'resource',terrain:['deep','shallow','coast','land','grassland','forest','lowMountain','highMountain','ridge','swamp'][world.terrain[y*world.size+x]]}]));
 const foodSpots=new Map();for(const cell of food.values()){const k=Math.floor(cell.x/18)+','+Math.floor(cell.y/18);if(!foodSpots.has(k))foodSpots.set(k,{cells:[]});foodSpots.get(k).cells.push(cell);}
 const environment={hostId:'player',simSeconds:0,seed,world,colonies:[colony],games:new Map(),food,foodSpots};const game=createGame(environment,colony);environment.games.set('player',game);
 const dna=profiles[policy],cost=birthCost({dna},colony.tribe),created=game.command({type:'design',templateId:null,name:'worker',dna,slots:[],birth:false});
 const result={seed,tribe:colony.tribe,policy,cost,stats:M.stats(dna.pieces),history:[],upgradeAt:null,defenseBudgetAt:null,births:0,soldiers:0,soldierBirths:[],failures:[]};
 for(let step=1;step<=1200;step++){environment.simSeconds=step/4;game.prepare(environment.simSeconds);game.tick(.25);const now=environment.simSeconds;
  if(now>=30&&now%15===0){const snap=game.snapshot();try{
   // Add one middle-efficiency worker; wait until 120 seconds to upgrade and 150 seconds to buy two modest soldiers.
   if(result.births<1&&snap.evolutionPoints>=cost){game.command({type:'birth',templateId:created.templateId});result.births++;}
   else if(now>=120&&game.nestLevel===1&&snap.evolutionPoints>=nestUpgradeCost(1,colony.tribe)){game.command({type:'upgrade'});result.upgradeAt=now;}
   if(now>=150&&game.nestLevel>=2){while(result.soldiers<2&&game.snapshot().evolutionPoints>=birthCost({dna:soldierDna},colony.tribe)){result.soldierTemplate ??= game.command({type:'design',templateId:null,name:'soldier',dna:soldierDna,slots:[],birth:false}).templateId;game.command({type:'birth',templateId:result.soldierTemplate});result.soldiers++;result.soldierBirths.push(now);}}
  }catch(e){if(result.failures.length<3)result.failures.push(String(e));}}
  const snap=now%60===0?game.snapshot():null;
  if(now%15===0&&game.nestLevel>=2&&game.snapshot().evolutionPoints>=46&&!result.defenseBudgetAt)result.defenseBudgetAt=now;
  if(snap)result.history.push({seconds:now,delivered:game.colonyFood,points:snap.evolutionPoints,alive:game.agents.length,dnaAlive:game.agents.filter(a=>a.dna).length,level:game.nestLevel});
 }
 results.push(result);console.log(seed,policy,colony.tribe,JSON.stringify(result.history.filter(x=>[180,300,420].includes(x.seconds))),result.defenseBudgetAt);Math.random=originalRandom;
}writeFileSync(new URL('./latest-results.json',import.meta.url),JSON.stringify({profiles,results},null,2));}
