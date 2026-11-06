export const CONQUEST_PACING = Object.freeze({ quietUntil:120, guidanceAt:160, neutralConflictAt:300, tribeContactAt:420,
  expertLevelFourAt:600, aiLevelFourAt:1200, activePopulation:36, inefficientPopulation:70,
  workerShare:Object.freeze([.8,.65,.45,.3]), nestCosts:Object.freeze([20,400,2000,null]),
  attributeCosts:Object.freeze([0,0,8,16,24]), aiUpgradeAt:Object.freeze([0,270,690,1200]),
  productionInterval:3, frontierSamples:48, preferredScouts:4 });

export const TRIBE_PACING = Object.freeze({
  bean:Object.freeze({tempo:1,population:36,native:null,army:Object.freeze(["blade","carapace","feet"])}),
  spore:Object.freeze({tempo:.95,population:40,native:"blade",army:Object.freeze(["blade","feet"])}),
  pebble:Object.freeze({tempo:1.1,population:32,native:"piercing",army:Object.freeze(["piercing","carapace","blade"])}),
  spring:Object.freeze({tempo:.9,population:36,native:null,army:Object.freeze(["blade","feet","piercing"])})
});

export function colonyWorkerShare(nestLevel,simSeconds,tribe) {
  if(Number.isFinite(simSeconds)&&simSeconds<CONQUEST_PACING.tribeContactAt*(TRIBE_PACING[tribe]?.tempo||1))return .8;
  return CONQUEST_PACING.workerShare[Math.max(0,Math.min(3,nestLevel-1))];
}

export function aiUpgradeReadyAt(nestLevel,tribe) {
  return CONQUEST_PACING.aiUpgradeAt[nestLevel] === undefined ? Infinity : CONQUEST_PACING.aiUpgradeAt[nestLevel]*(TRIBE_PACING[tribe]?.tempo||1);
}

export function conquestEncounterPlan(plan) {
  const passive=["flower-tail-bird","dew-rabbit","soil-mole","bundle-snail","cotton-sheep","rolling-acorn"].includes(plan.key);
  if(plan.unique)return {...plan,safeRadius:Math.max(24,plan.safeRadius),preferredDistance:Math.min(64,plan.preferredDistance),spawn:"≥120초 ∧ "+plan.spawn};
  if(passive)return {...plan,safeRadius:12,preferredDistance:Math.min(26,plan.preferredDistance)};
  return {...plan,spawn:plan.key==="spiny-back-beetle" ? "0초 · 습격 ≥300초" : "≥240초",safeRadius:28,preferredDistance:Math.min(48,plan.preferredDistance),radius:Math.min(10,plan.radius)};
}

export function militaryAgent(agent,tribe) {
 if(agent.productionRole==="military")return true;
 if(agent.dna)return agent.dna.pieces.some(piece=>(piece.gene==="blade"||piece.gene==="secretion"))&&!agent.dna.pieces.some(piece=>piece.gene==="gather");
 const slots=agent.slots||[],native=TRIBE_PACING[tribe||agent.tribe]?.native;
 return !slots.includes("strength")&&
  slots.some(key=>["blade","piercing","carapace"].includes(key))&&!(slots.length===1&&slots[0]===native);
}
