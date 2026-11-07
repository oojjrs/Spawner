import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { createCombat } from "../server/combat.mjs";
import { createSimulationTrial, deriveSimulationStats } from "./combat-simulation.mjs";

const build = counts => ({ key: "bean", counts });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " != " + b);

function actualTrial(input, change) {
  const trial = createSimulationTrial(input);
  if (change) change(trial.agents);
  const agents = structuredClone(trial.agents), events = [];
  const environment = { world: { size: 320, terrain: new Uint8Array(320 * 320) }, games: new Map(), colonies: [],
    simSeconds: 0, damageRandom: () => .5, combatRandom: () => .99,
    onCombatEvent(event) { events.push({ kind: event.kind, time: event.at, source: event.sourceId, target: event.targetId, damage: event.amount,
      health: agents.map(agent => agent.health) }); } };
  for (const side of ["left", "right"]) environment.games.set(side, { agents: agents.filter(agent => agent.ownerId === side),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const engine = createCombat(environment);
  for (let tick = 0; tick <= 60 * 120; tick++) {
    environment.simSeconds = tick / 60;
    for (const agent of agents) engine.update(agent, environment.simSeconds);
    if (!["left", "right"].every(side => agents.some(agent => agent.ownerId === side && agent.health > 0))) break;
  }
  trial.finish();
  assert.deepEqual(trial.history.map(event => ({kind:event.kind,time:event.time,source:event.attackerId,target:event.targetId,damage:event.damage})),
    events.map(({health,...event})=>event));
  assert.deepEqual(trial.agents.map(agent=>agent.health), agents.map(agent=>agent.health));
  return trial;
}

test("실험실 기본 수치는 실제 DNA의 같은 투자량과 일치한다", () => {
  const map = {power:"power",rangedPower:"rangedPower",vitality:"health",armor:"armor",flatPen:"penetration",haste:"speed",rangedHaste:"rangedSpeed",
    focus:"focus",multiHit:"combo",hitSpeed:"comboSpeed",combo:"comboPower",crit:"critical",critPower:"criticalPower",accuracy:"accuracy",evasion:"evasion",
    parry:"parry",block:"block",blockPower:"blockPower",counter:"counter",counterPower:"counterPower",tenacity:"tenacity",stun:"stun",stunDuration:"stunTime",drain:"lifesteal"};
  for (const count of [0,1,5,20,80]) {
    const counts = Object.fromEntries(Object.keys(map).map(key=>[key,count]));
    const pieces=[{gene:"blade",grade:1},{gene:"secretion",grade:1},
      ...Object.values(map).flatMap(gene=>Array.from({length:count},()=>({gene,grade:1})))];
    const expected=ATTRIBUTE_DNA.stats(pieces), actual=deriveSimulationStats({key:"bean",counts,organs:{attack:1,ranged:1}}).dna;
    for(const key of ["health","power","speed","hits","focus","comboSpeed","armor","critical","criticalPower","accuracy","evasion","parry","block","blockPower","counter","counterPower","tenacity","stun","stunTime","lifesteal","meleePower","rangedPower","meleeSpeed","rangedSpeed"])
      close(actual[key],expected[key]);
  }
});

test("4:4 자동 전투의 타격·타깃·사망·최종 HP는 실전 엔진 직접 실행과 같다", () => {
  const b=build({power:4,vitality:5,armor:2,multiHit:1});
  const trial=actualTrial({left:[b,b,b,b],right:[b,b,b,b],random:false}, agents => { agents.find(agent => agent.id === "right").health = 1; });
  const larger=actualTrial({left:Array(8).fill(b),right:Array(8).fill(b),random:false});
  assert.equal(larger.reason,"death");
  assert.equal(trial.reason,"death");
  const targets=new Map();
  for(const event of trial.history.filter(event=>event.kind==="attack")) {
    if(!targets.has(event.attackerId))targets.set(event.attackerId,new Set());
    targets.get(event.attackerId).add(event.targetId);
  }
  assert.ok([...targets.values()].some(values=>values.size>1));
});

test("N:N의 광역·출혈·흡혈·반사도 실전 경로의 사건과 HP를 그대로 따른다", () => {
  const b=build({power:4,vitality:6});
  const trial=actualTrial({left:[b,b,b],right:[b,b,b],random:false}, agents=>{
    for(const agent of agents)Object.assign(agent.stats.dna,{bleed:100,bleedPower:1,area:2,areaPower:35,lifesteal:20,reflection:10});
  });
  for(const kind of ["area","bleed","drain","reflect"])assert.ok(trial.history.some(event=>event.kind===kind),kind);
});

test("막기·반격·기절·연타는 같은 실전 판정을 사용한다", () => {
  const b=build({power:3,vitality:8,multiHit:2});
  const trial=actualTrial({left:[b,b],right:[b,b],random:false},agents=>{
    for(const agent of agents)Object.assign(agent.stats.dna,{block:100,counter:100,stun:100,stunTime:.25});
  });
  for(const kind of ["block","counter","stun"])assert.ok(trial.history.some(event=>event.kind===kind),kind);
});

test("동시 치명타는 실전의 사건 순서대로 적용되며 사후 타격하지 않는다", () => {
  const b=build({});
  const trial=actualTrial({left:b,right:b,random:false,rules:{healthBase:2}});
  assert.equal(trial.result().winner,"left");
  assert.equal(trial.history.filter(row=>row.kind==="hit").length,1);
  assert.equal(trial.agents[1].attack,null);
});

test("같은 시드는 자동·단계·잘게 나눈 재생에서 같은 결과를 낸다", () => {
  const b=build({power:2,vitality:3,crit:3,block:2,stun:1});
  const settings={left:[b,b,b],right:[b,b,b],seed:"replay",random:true};
  const first=createSimulationTrial(settings),stepped=createSimulationTrial(settings),chunked=createSimulationTrial(settings);
  first.finish();while(!stepped.reason)stepped.step();while(!chunked.reason)chunked.advance(.037);
  assert.deepEqual(first.history,stepped.history);assert.deepEqual(first.history,chunked.history);
  assert.deepEqual(first.result(),stepped.result());assert.deepEqual(first.result(),chunked.result());
});

test("원거리 N:N은 실제 투사체 발사·도착·대상 사망 취소를 사용한다", () => {
  const b={key:"bean",counts:{rangedPower:8,vitality:1,multiHit:2},organs:{attack:0,ranged:1}};
  const trial=createSimulationTrial({left:[b,b,b],right:[b,b,b],distance:3,random:false});trial.finish();
  assert.equal(trial.reason,"death");
  for(const kind of ["shoot","hit","projectile-cancel"])assert.ok(trial.history.some(event=>event.kind===kind),kind);
  const launch=trial.history.find(event=>event.kind==="shoot"),hit=trial.history.find(event=>event.kind==="hit");
  assert.ok(hit.time > launch.time && hit.time - launch.time < 1, "actual battlefield distance produces a positive flight");
});

test("시작 거리 편집과 근접 접근은 N:N 교전으로 이어진다", () => {
  const b=build({power:8,vitality:1});
  const trial=createSimulationTrial({left:[b,b,b],right:[b,b,b],distance:4,random:false});trial.finish();
  assert.equal(trial.reason,"death");assert.ok(trial.history.find(event=>event.kind==="hit").time>4);
});

test("기관·수치·규칙·예산 편집은 유지되고 잘못된 입력은 거절한다", () => {
  close(deriveSimulationStats(build({power:2}),{powerCurve:"log"}).attackPower,2+2*Math.log(2)/Math.log(1.5));
  close(deriveSimulationStats(build({vitality:3}),{healthPerPoint:20}).health,70);
  assert.equal(deriveSimulationStats({key:"bean",organs:{attack:1,ranged:1}}).pieceCount,2);
  for(const key of ["attack","ranged"])assert.throws(()=>deriveSimulationStats({key:"bean",organs:{[key]:2}}),/Organ count/);
  for(const count of [-1,.5,NaN,Infinity,"1"])assert.throws(()=>deriveSimulationStats(build({power:count})),/count/);
  assert.throws(()=>deriveSimulationStats(build({unknown:1})),/Unknown count/);
  assert.throws(()=>deriveSimulationStats(build({}),{dodgeCap:1.1}),/between/);
  assert.throws(()=>createSimulationTrial({left:[],right:build({})}),/team/);
  assert.throws(()=>createSimulationTrial({left:build({}),right:build({}),distance:21}),/distance/);
  assert.throws(()=>createSimulationTrial({left:build({}),right:build({})}).advance(-1),/nonnegative/);
});

test("무공격·시간·사건 한도에서 편집 실험이 멈춘다", () => {
  const b={key:"bean",organs:{attack:0},counts:{vitality:5}};
  assert.equal(createSimulationTrial({left:[b,b],right:[b,b]}).reason,"no-offense");
  const slow=build({vitality:80});
  assert.equal(createSimulationTrial({left:slow,right:slow,rules:{maxSeconds:.1}}).finish().reason,"time-limit");
  assert.equal(createSimulationTrial({left:slow,right:slow,rules:{maxEvents:1}}).finish().reason,"event-limit");
});

test("기존 방어 준비·재준비·반격 재준비·후딜 편집도 공통 엔진 입력으로 작동한다", () => {
  const trial=createSimulationTrial({left:build({vitality:5}),right:build({vitality:5,parry:1,counter:1}),random:false,
    rules:{defensePreparation:1,reactionCooldown:3,counterCooldown:5,recovery:3,parryCap:1,parryKnee:1,counterCap:1,counterKnee:1,maxSeconds:12}});
  trial.agents.forEach(agent => Object.assign(agent.combat.position, { x: agent.side ? .4 : -.4, y: 0, fromX: agent.side ? .4 : -.4, fromY: 0 }));
  trial.advance(.1);assert.ok(trial.agents.every(agent=>agent.attack.endsAt-agent.attack.startedAt>=3));
  trial.finish();const first=trial.history.find(event=>event.kind==="hit"&&event.attackerId==="left");
  close(first.time,.3);const parries=trial.history.filter(event=>event.kind==="parry");assert.ok(parries.length>0);
  for(let i=1;i<parries.length;i++)assert.ok(parries[i].time-parries[i-1].time>=3);
  const counters=trial.history.filter(event=>event.kind==="counter");assert.ok(counters.length>0);
  for(let i=1;i<counters.length;i++)assert.ok(counters[i].time-counters[i-1].time>=5);
});

test("중립종 외형도 편집한 DNA 원거리 능력으로 N:N 전투하고 외형은 규칙을 바꾸지 않는다",()=>{
  const b={key:"bean",organs:{attack:0,ranged:1},counts:{rangedPower:8,vitality:1}};
  const input={left:[b,b,b],right:[b,b,b],distance:3,random:false};
  const players=createSimulationTrial(input);players.finish();
  const neutral={...b,key:"dew-rabbit"};const creatures=createSimulationTrial({...input,left:[neutral,neutral,neutral],right:[neutral,neutral,neutral]});creatures.finish();
  assert.equal(creatures.reason,"death");assert.deepEqual(creatures.history,players.history);assert.deepEqual(creatures.result(),players.result());
});


test("실제 생물 프로필과 시작 DNA를 외형용 공통 수치로 덮지 않는다", async () => {
  const { unitCombatStats, combatProfile } = await import("../server/combat-stats.mjs");
  const { startingWorkerDna } = await import("../server/tribe-start.mjs");
  const { dnaUnitStats } = await import("../server/dna-unit.mjs");
  const trial = createSimulationTrial({left:[{key:"white-paw"},{key:"dew-rabbit"}],right:{key:"pebble"},random:false});
  const [paw, worker, rabbit] = trial.agents;
  for (const agent of [paw,rabbit]) {
    assert.equal(agent.species,agent.key);
    assert.equal(agent.stats.dna,undefined);
    assert.equal(agent.stats.combatStrength,unitCombatStats(agent.key).combatStrength);
    assert.equal(agent.stats.attackPower,combatProfile({species:agent.key,stats:unitCombatStats(agent.key),attributes:{}}).attackPower);
  }
  assert.notEqual(paw.stats.attackPower,rabbit.stats.attackPower);
  assert.deepEqual(worker.dna,startingWorkerDna("pebble"));
  assert.deepEqual(worker.stats.dna,dnaUnitStats(worker.dna).dna);
  assert.equal(worker.stats.canAttack,false);
});

test("실제 설계 DNA와 기존 수치 편집은 서로의 입력을 덮지 않는다", async () => {
  const { validateDna, dnaUnitStats } = await import("../server/dna-unit.mjs");
  const gene = ATTRIBUTE_DNA.lookup.get("blade");
  const dna = validateDna({version:4,level:2,budget:999,pieces:[{gene:gene.id,grade:gene.grade,rotation:0,q:0,r:0}]},2,999);
  assert.ok(dna);
  const trial = createSimulationTrial({left:{key:"spore",dna},right:{key:"white-paw",counts:{power:2,haste:4}},random:false});
  assert.deepEqual(trial.agents[0].stats.dna,dnaUnitStats(dna).dna);
  assert.equal(trial.agents[0].stats.canAttack,true);
  assert.equal(trial.agents[1].species,undefined);
  assert.ok(trial.agents[1].stats.dna);
  assert.equal(trial.agents[1].stats.attackSpeed,deriveSimulationStats({key:"bean",counts:{power:2,haste:4}}).attackSpeed);
});
