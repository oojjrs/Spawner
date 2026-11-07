// Proposed replacement for the historical age<=120ms choice policy.
// Invoke ONLY at an actual body draw, not snapshot arrival or preparation.
export function createFirstDrawChoices(){const choices=new Map();const key=a=>JSON.stringify([a.id,a.birth?.colonyId,a.birth?.startedAt]);return {
 peek(agent,time){if(!agent.birth||agent.health<=0||time<agent.birth.startedAt||time>=agent.birth.startedAt+2.62)return null;return choices.get(key(agent))||null;},
 select(agent,time,{scopeVerified=false,presentationVerified=false,handle=null}={}){if(!agent.birth||agent.health<=0||time<agent.birth.startedAt||time>=agent.birth.startedAt+2.62)return null;const k=key(agent);if(choices.has(k))return choices.get(k);const restored=scopeVerified&&presentationVerified&&!!handle;const choice=Object.freeze({source:restored?'restored':'original',handle:restored?handle:null});choices.set(k,choice);return choice;},
 pruneDisplayed(agents,time){const alive=new Set(agents.filter(a=>a.health>0&&a.birth&&time>=a.birth.startedAt&&time<a.birth.startedAt+2.62).map(key));for(const k of choices.keys())if(!alive.has(k))choices.delete(k);},reset(){choices.clear();}
};}
