import { CONQUEST_PACING, TRIBE_PACING, colonyWorkerShare, aiUpgradeReadyAt } from "./conquest-pacing.mjs";
import { NEST_LEVELS, nestUpgradeCost } from "./nests.mjs";
import { birthCost, attributeUpgradeCost, attributeLevelLimit } from "./attributes.mjs";
import { TRIBE_STARTING_UNITS } from "./tribe-start.mjs";
import { growthThreshold } from "./growth.mjs";
import { attributeCounts, unitStats, unitCarryCapacity, unitTravelSpeed } from "./attributes.mjs";
import { RESOURCE_ECONOMY } from "./economy.mjs";
import { resourceHarvestMultiplier } from "./resources.mjs";
import { AGENT_GROWTH_BONUSES } from "./growth.mjs";

export function colonyWorkerRate(tribe,slots,levels,distance,unitLevel) {
 const resource=RESOURCE_ECONOMY.find(entry=>entry.tribe===tribe),attributes=attributeCounts(slots,levels),stats=unitStats(attributes,tribe);
 const bonus=AGENT_GROWTH_BONUSES[unitLevel-1];
 stats.movementMultiplier=(stats.movementMultiplier??1)*bonus.movementMultiplier;
 const agent={tribe,attributes,stats,carryingType:resource.key};
 const capacity=unitCarryCapacity(agent,resource.key),outward=distance/unitTravelSpeed(agent,0,resource.key),inward=distance/unitTravelSpeed(agent,capacity,resource.key);
 const harvest=capacity*resource.harvestSeconds*resourceHarvestMultiplier(resource.key,attributes,tribe)/bonus.harvestSpeedMultiplier;
 return {capacity,seconds:outward+inward+harvest+2,perSecond:capacity/(outward+inward+harvest+2)};
}

export function simulateConquestBuild(tribe,policy,distance) {
 const profile=TRIBE_PACING[tribe],expert=policy==="expert",basic=policy==="basic",tempo=profile.tempo;
 const units=[],milestones=[{level:1,seconds:0}],history=[],purchases=new Set();let points=0,level=1,spent=0,delivered=0,nextBirth=0;
 const make=(slots,attributeLevels,role,now)=>{
  const stats=unitStats(attributeCounts(slots,attributeLevels),tribe),unit={slots,attributeLevels,role,bornAt:now,growthActivity:0};
  const rate=colonyWorkerRate(tribe,slots,attributeLevels,distance,1);unit.nextDeliveryAt=now+rate.seconds;units.push(unit);
 };
 for(const slots of TRIBE_STARTING_UNITS[tribe])make(slots,{},"worker",0);
 for(let now=1;now<=2400;now++){
  const carryDistance=distance*(level>=3?(expert?.55:.7):1);
  for(const unit of units){if(unit.role!=="worker"||now<unit.nextDeliveryAt)continue;
   let unitLevel=1;while(unitLevel<10&&unit.growthActivity>=growthThreshold(unitLevel+1))unitLevel++;
   const rate=colonyWorkerRate(tribe,unit.slots,unit.attributeLevels,carryDistance,unitLevel);
   points=Math.min(NEST_LEVELS[level-1].pointCapacity,points+rate.capacity);delivered+=rate.capacity;unit.growthActivity+=rate.capacity*5;
   unit.nextDeliveryAt=now+rate.seconds/(basic?.45:expert?.9:.75);
  }
  const young=units,workers=young.filter(unit=>unit.role==="worker");
  const goal=NEST_LEVELS[level-1].unitCapacity,share=now<CONQUEST_PACING.neutralConflictAt*tempo?1:colonyWorkerShare(level,now,tribe),workerGoal=Math.floor(goal*share);
  const reserve=birthCost({slots:[profile.native].filter(Boolean)},tribe)*2,cost=nestUpgradeCost(level,tribe),gate=policy==="ai"?aiUpgradeReadyAt(level,tribe):0;
  if(cost!==null&&now>=gate&&workers.length>=4&&points>=cost+reserve){points-=cost;spent+=cost;level++;milestones.push({level,seconds:now});}
  let researchSaving=false;
  if(level>=2){const target=attributeLevelLimit(level);
   for(const key of (expert?[profile.native,"feet","strength"].filter(Boolean).slice(0,level):[profile.native].filter(Boolean))){for(let rank=2;rank<=target;rank++){
    const token=(expert?"worker":level)+":"+key+":"+rank,upgrade=attributeUpgradeCost(key,rank).evolutionPoints;
    if(expert&&!purchases.has(token)&&workers.length>=4)researchSaving=true;
    if(!purchases.has(token)&&points>=upgrade+reserve+(expert?0:12)){points-=upgrade;spent+=upgrade;purchases.add(token);}
   }}
  }
  if(now>=nextBirth&&units.length<NEST_LEVELS[level-1].unitCapacity&&(!researchSaving||workers.length<4)){
   const army=now>=CONQUEST_PACING.neutralConflictAt*tempo&&workers.length>=workerGoal;
   const count=army?young.length-workers.length:workers.length,target=army?goal-workerGoal:workerGoal;
   if(count<target){const slots=(army?profile.army:expert?[profile.native,"feet","strength"]:[profile.native,"strength","feet"]).filter(Boolean).filter(key=>key!=="carapace"||level>=3).slice(0,level);
    const levels=Object.fromEntries(slots.map(key=>[key,[...purchases].filter(token=>token.startsWith((expert?"worker":level)+":"+key+":")).length+1]));
    const charge=birthCost({slots,attributeLevels:levels},tribe);
    if(points>=charge&&(workers.length<4||points>=charge+reserve)){points-=charge;spent+=charge;make(slots,levels,army?"military":"worker",now);nextBirth=now+(expert?2:basic?6:CONQUEST_PACING.productionInterval);}
   }
  }
  if(now%60===0)history.push({seconds:now,level,points:Math.round(points),workers:units.filter(unit=>unit.role==="worker").length,military:units.filter(unit=>unit.role==="military").length});
  if(level===4&&now>=CONQUEST_PACING.aiLevelFourAt&&!basic)break;
 }
 return {tribe,policy,distance,milestones,history,delivered,spent,points,workers:units.filter(unit=>unit.role==="worker").length,military:units.filter(unit=>unit.role==="military").length,
  conditions:{materialAccess:1,lateDistanceMultiplier:expert?.55:.7}};
}
