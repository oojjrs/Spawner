import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, outOfCombatRecoveryRate } from './combat.mjs';
import { ATTRIBUTE_DNA as D } from './dna.mjs';
import { createGame } from './game.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(tribe='bean',genes=[],hp) {
 const dna=D.stats(genes.map(gene=>({gene,grade:D.lookup.get(gene).grade})),tribe);
 const maximum=hp||dna.health;
 const agent={id:'unit',ownerId:'a',tribe,x:10,y:10,health:maximum/2,stats:{health:maximum,speed:.25,vision:1,dna},attributes:{},moveDuration:0,moveStartedAt:0};
 const game={agents:[agent],receiveDamage(a,damage){a.health=Math.max(0,a.health-damage);}};
 const environment={simSeconds:0,world:{size:40,terrain:new Uint8Array(1600).fill(4)},games:new Map([['a',game]]),colonies:[]};
 return {agent,environment,combat:createCombat(environment)};
}
for(const tribe of ['bean','spore','pebble','spring'])test(tribe+': 기본 회복과 재생 조각은 가산되고 플레이어·AI에 동일하다',()=>{
 const f=fixture(tribe), g=fixture(tribe,['regeneration']);
 const base=.05+Math.min(f.agent.stats.health*.005,.3);
 close(outOfCombatRecoveryRate(f.agent),base);
 close(outOfCombatRecoveryRate(g.agent),base+g.agent.stats.dna.regeneration);
 for(const a of [f.agent,g.agent]){a.aiControlled=true;const rate=outOfCombatRecoveryRate(a);a.aiControlled=false;close(outOfCombatRecoveryRate(a),rate);}
 const initial=f.agent.health;f.combat.update(f.agent,0);f.combat.update(f.agent,5);close(f.agent.health,initial);f.combat.update(f.agent,15);close(f.agent.health,Math.min(f.agent.stats.health,initial+base*10));
});
test('높은 최대HP에도 기본 회복은 .35 상한이고 중립 고유 재생은 보존한다',()=>{
 const f=fixture('bean',['regeneration'],1000);close(outOfCombatRecoveryRate(f.agent),.85);
 delete f.agent.ownerId;close(outOfCombatRecoveryRate(f.agent),.5);
});
test('피격·공격 종료 뒤5초는 회복하지 않고 긴 틱과 분할 틱이 일치한다',()=>{
 const run=times=>{const f=fixture('bean',['regeneration'],100);f.agent.dnaLastDamageAt=7;f.agent.attack={dnaRanged:true,startedAt:8,endsAt:10};f.agent.dnaRecoveryAt=0;for(const t of times)f.combat.update(f.agent,t);return f.agent.health;};
 close(run([20]),run(Array.from({length:81},(_,i)=>i/4)));
 close(run([15]),50);close(run([20]),54.25);
});
test('탄생·사망·출혈 중에는 회복하지 않는다',()=>{
 const birth=fixture();birth.agent.birth={readyAt:20};birth.combat.update(birth.agent,0);birth.combat.update(birth.agent,19);close(birth.agent.health,5);birth.combat.update(birth.agent,21);close(birth.agent.health,5.1);
 const dead=fixture();dead.agent.health=0;dead.combat.update(dead.agent,0);dead.combat.update(dead.agent,100);close(dead.agent.health,0);
 const bleed=fixture('bean',['regeneration'],100);bleed.agent.dnaBleed={sourceId:'missing',power:1,nextAt:1,endsAt:10};bleed.combat.update(bleed.agent,0);bleed.combat.update(bleed.agent,10);close(bleed.agent.health,40);bleed.combat.update(bleed.agent,15);close(bleed.agent.health,40);bleed.combat.update(bleed.agent,16);close(bleed.agent.health,40.85);
});
test('교전 종료 뒤5초가 지나야 회복한다',()=>{
 const f=fixture('bean',['regeneration'],100);f.agent.combat={id:'c',x:10,y:10,teams:['colony:a','colony:b'],side:0};f.agent.dnaRecoveryAt=0;
 f.combat.release(f.agent,10);f.combat.update(f.agent,15);close(f.agent.health,50);f.combat.update(f.agent,16);close(f.agent.health,50.85);
});
test('실제 게임 저장·복원은 피격 회복 지연과 경과 시각을 보존한다',()=>{
 const colony={id:1,ownerId:'a',tribe:'bean',x:10,y:10,occupiedCells:new Set(['2,2'])};
 const env={hostId:'a',simSeconds:0,world:{size:40,terrain:new Uint8Array(1600).fill(4),hazards:new Uint8Array(1600)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
 const game=createGame(env,colony);env.games.set('a',game);const a=game.agents[0];a.health=5;a.dnaRecoveryAt=10;a.dnaLastDamageAt=12;
 game.restore(game.save());const restored=game.agents.find(x=>x.id===a.id),combat=createCombat(env);combat.update(restored,17);close(restored.health,5);combat.update(restored,18);close(restored.health,5.1);
});

test('새 원거리 발사는 비접촉 상태에서도 회복을 중단한다',()=>{
 const f=fixture('spore',['secretion','regeneration'],100);f.agent.stats.vision=3;f.agent.dnaRecoveryAt=0;
 const enemy={id:'enemy',ownerId:'b',tribe:'bean',x:12,y:10,health:100,stats:{health:100,speed:.25,vision:1},attributes:{},moveStartedAt:0,moveDuration:0};
 f.environment.games.set('b',{agents:[enemy],receiveDamage(a,amount){a.health-=amount;}});
 f.combat.update(f.agent,10);assert.equal(f.agent.attack?.dnaRanged,true);close(f.agent.health,50);
 const ends=f.agent.attack.endsAt;f.environment.games.delete('b');f.combat.update(f.agent,ends+5);close(f.agent.health,50);
 f.combat.update(f.agent,ends+6);close(f.agent.health,50+outOfCombatRecoveryRate(f.agent));
});
test('실제 교전에 들어간 재생 유닛은 전투 틱에서 체력을 회복하지 않는다',()=>{
 const f=fixture('bean',['blade','regeneration'],100);
 const enemy={id:'enemy',ownerId:'b',tribe:'bean',x:10,y:10,health:1000,stats:{health:1000,speed:.25,vision:1,combatStrength:10},attributes:{},moveStartedAt:0,moveDuration:0};
 f.environment.games.set('b',{agents:[enemy],receiveDamage(a,amount){a.health-=amount;}});
 f.environment.combatRandom=()=>.99;f.environment.damageRandom=()=>.5;
 assert.equal(f.combat.engage(f.agent,enemy,10),true);
 let previous=f.agent.health;
 for(let frame=0;frame<=30;frame++){f.combat.update(f.agent,10+frame/10);assert.ok(f.agent.health<=previous+1e-9);previous=f.agent.health;}
});
test('구형 군락 유닛도 같은 기본 회복을 받는다',()=>{
 const f=fixture('bean',[],100);delete f.agent.stats.dna;close(outOfCombatRecoveryRate(f.agent),.35);
 f.combat.update(f.agent,0);f.combat.update(f.agent,15);close(f.agent.health,53.5);
});
