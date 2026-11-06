import fs from 'node:fs';
const root=new URL('../../server/',import.meta.url).href;
const {ATTRIBUTE_DNA:D}=await import(root+'dna.mjs');
const {dnaUnitStats}=await import(root+'dna-unit.mjs');
const {combatProfile,combatDamage,unitCombatStats}=await import(root+'combat-stats.mjs');
const {createCombat}=await import(root+'combat.mjs');
let state=123456789;const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
const creature=species=>({id:'enemy',species,tribe:species,x:100,y:100,health:100,attributes:{},combatDisposition:'aggressive',stats:{...unitCombatStats(species),speed:1,vision:4},moveDuration:0,moveStartedAt:0});
function unit(pieces,id='unit'){const stats=dnaUnitStats({pieces});return {id,ownerId:'player',tribe:'bean',dna:{pieces},stats,health:stats.health,x:100,y:100,attributes:{},combatDisposition:'aggressive',moveDuration:0,moveStartedAt:0};}
function duel(row,species,count,seed,hpScale=1,damageScale=1){
 let rng=seed;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
 const allies=Array.from({length:count},(_,i)=>unit(row.pieces,'unit'+i)),enemy=creature(species),units=[...allies,enemy];
 const env={games:new Map([['player',{agents:allies,receiveDamage(a,n){a.health=Math.max(0,a.health-n)}}]]),creatureSystem:{agents:[enemy],receiveDamage(a,n){a.health=Math.max(0,a.health-n)}},colonies:[],world:{terrain:new Uint8Array(320*320).fill(4)},combatRandom:random,damageRandom:random};
 enemy.health*=hpScale;enemy.stats.health*=hpScale;enemy.stats.attackPower=combatProfile(enemy).attackPower*damageScale;const c=createCombat(env);c.engage(allies[0],enemy,0);for(let i=1;i<allies.length;i++)c.engage(allies[i],enemy,0);
 let t=0;for(;t<180&&enemy.health>0&&allies.some(a=>a.health>0);t+=.1){env.simSeconds=t;for(const a of units)c.update(a,t);}
 return {win:enemy.health<=0,alive:allies.filter(a=>a.health>0).length,time:t,enemyHealth:enemy.health,allyHp:allies.reduce((s,a)=>s+a.health,0)};
}

const profiles=JSON.parse(fs.readFileSync(new URL('./profiles.json',import.meta.url)));const rows=[profiles.basicDuel.dna,null,null,profiles.guardDuel.dna],adv=profiles.advancedSoldier.dna;const out=[];for(const [name,row]of [['basic',rows[0]],['guard',rows[3]],['advanced',adv]])for(const [hp,damage]of [[.4,.2],[.5,.2],[.65,.25]])for(const count of [1,2]){const r=Array.from({length:30},(_,i)=>duel(row,'spiny-back-beetle',count,800+i,hp,damage));out.push({name,hp,damage,count,kills:r.filter(x=>x.win).length,survivors:r.reduce((s,x)=>s+x.alive,0)/30});}fs.writeFileSync(new URL('./duel-results.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out));