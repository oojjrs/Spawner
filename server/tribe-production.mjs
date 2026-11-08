import { AGENT_DEATH_WARNING, agentRemainingLifespan } from "./lifespan.mjs";
import { birthCost, isAttributeUnlocked } from "./attributes.mjs";
import { suggestTemplateName } from "./unit-template-names.mjs";
import { colonySupply } from "./colony-supply.mjs";
import { NEST_LEVELS } from "./nests.mjs";
import { TRIBE_STARTING_UNITS } from "./tribe-start.mjs";
import { CONQUEST_PACING, TRIBE_PACING, colonyWorkerShare, militaryAgent } from "./conquest-pacing.mjs";

function productionTemplate(slots,role,state) {
 const previous=state.templates.find(template=>!template.dna&&template.productionRole===role&&template.slots.length===slots.length&&slots.every(key=>template.slots.includes(key)));
 if(previous)return previous;
 return {id:null,name:suggestTemplateName(slots,state.templates),slots:[...slots],attributeLevels:Object.fromEntries(slots.map(key=>[key,1])),revision:1,productionRole:role};
}

export function tribeProductionTemplate(state,tribe) {
 const profile=TRIBE_PACING[tribe],initial=TRIBE_STARTING_UNITS[tribe];if(!profile||!initial)return null;
 if(state.agents.filter(agent=>agent.health>0).length>=NEST_LEVELS[state.nestLevel-1].unitCapacity)return null;
 const living=state.agents.filter(agent=>agent.health>0);
 if(!living.length){const worker=productionTemplate([profile.native].filter(Boolean),"worker",state);if(state.evolutionPoints>=birthCost(worker,tribe))return worker;
  const basic=productionTemplate([],"worker",state);return state.evolutionPoints>=birthCost(basic,tribe)?basic:null;}
 const young=living.filter(agent=>agentRemainingLifespan(agent,state.simSeconds)>AGENT_DEATH_WARNING);
 const target=NEST_LEVELS[state.nestLevel-1].unitCapacity;
 const militaryAllowed=state.simSeconds>=CONQUEST_PACING.neutralConflictAt*profile.tempo;
 const workerTarget=militaryAllowed?Math.floor(target*colonyWorkerShare(state.nestLevel,state.simSeconds,tribe)):target;
 const workers=young.filter(agent=>!militaryAgent(agent,tribe)),soldiers=young.filter(agent=>militaryAgent(agent,tribe));
 let role=null;
 if(workers.length<workerTarget)role="worker";
 else if(militaryAllowed&&soldiers.length<target-workerTarget)role="military";
 if(!role)return null;
 const supply=colonySupply(state,tribe),replacing=young.length<initial.length;
 if(!replacing&&young.length>=initial.length&&(!supply.incomeObserved||supply.rateDeficit>0))return null;
 const armies=[profile.army,["piercing","blade","feet","carapace"],["feet",profile.army[0]],
  ["carapace",profile.army[0]]].map(slots=>[...new Set(slots.filter(key=>isAttributeUnlocked(key,state.nestLevel,tribe)))].slice(0,state.nestLevel));
 const count=slots=>soldiers.filter(agent=>slots.every(key=>agent.slots.includes(key))).length;
 const army=armies.filter(slots=>slots.length).sort((first,second)=>count(first)-count(second))[0];
 const slots=role==="worker"?[profile.native,"strength","feet"]:army;
 const allowed=[...new Set(slots.filter(key=>isAttributeUnlocked(key,state.nestLevel,tribe)))].slice(0,state.nestLevel);
 const template=productionTemplate(allowed,role,state);
 const reserve=replacing?0:supply.reserve;
 return state.evolutionPoints+1e-8>=birthCost(template,tribe)+reserve?template:null;
}
