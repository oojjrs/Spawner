import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { nestDefenderDesign, isNestDefender } from './nest-defender.mjs';
import { ATTRIBUTE_DNA } from './dna.mjs';
import { validateDna } from './dna-unit.mjs';
import { birthCost } from './attributes.mjs';
import { nestUpgradeCost } from './nests.mjs';
import { combatDisposition, createCombat } from './combat.mjs';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beginnerHelpOffer } from '../client/beginner-help.mjs';
import { DNA_STARTER_DESIGNS } from '../client/dna-starter-designs.mjs';

const tribes = ['bean', 'spore', 'pebble', 'spring'];
function fixture(tribe = 'bean', ai = false, api = { createGame }) {
  const colony = { id: 1, ownerId: 'defender-test', tribe, x: 11, y: 10, occupiedCells: new Set(['2,2']) };
  const environment = { simSeconds: 0, hostId: ai ? 'other-player' : colony.ownerId,
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map(),
    world: { size: 40, seed: 13, generationVersion: 37,
      terrain: new Uint8Array(1600).fill(4), hazards: new Uint8Array(1600) } };
  const game = api.createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  return { game, environment, colony };
}
function state(game, update) {
  const saved = JSON.parse(game.save());
  update(saved.state);
  game.restore(JSON.stringify(saved));
}
function clearBirthSites(game) {
  game.agents.forEach((agent, i) => Object.assign(agent, { x: 20 + i, y: 20, birth: null, moveDuration: 0 }));
}
function upgrade(f) {
  state(f.game, s => { s.evolutionPoints = 200; });
  f.game.command({ type: 'upgrade' });
  clearBirthSites(f.game);
  return f.game.snapshot().templates.find(isNestDefender);
}
function guardFixture(tribe = 'bean', api) {
  const f = fixture(tribe, false, api), template = upgrade(f);
  const { agentId } = f.game.command({ type: 'birth', templateId: template.id });
  const guard = f.game.agents.find(agent => agent.id === agentId);
  f.game.agents.splice(0, f.game.agents.length, guard);
  Object.assign(guard, { x: 18, y: 12, renderFromX: 18, renderFromY: 12, birth: null,
    health: guard.stats.health, bornAt: 0, lifespan: 360, utility: null, mode: 'search',
    decisionPending: null, nextDecisionAt: 1000, knownEnemyIds: new Set(), survivalState: 'stable',
    moveStartedAt: 0, moveDuration: 0, moveBudget: 0 });
  const enemy = { id: 'mole', species: 'soil-mole', x: 14, y: 12, homeX: 14, homeY: 12,
    health: 100, stats: { health: 100, combatStrength: 10, speed: .2, attack: 1, vision: 4 },
    attributes: {}, carrying: 0, cost: 0, moveStartedAt: 0, moveDuration: 0,
    attack: { targetId: f.game.nest.id, targetKind: 'nest', startedAt: 0, hitAt: .5, endsAt: 1 } };
  f.environment.creatureSystem = { agents: [enemy], burrows: [], receiveDamage(target, amount) { target.health -= amount; } };
  f.game.prepare(0);
  return { ...f, guard, enemy, template };
}
const plan = f => f.game.planDecisions([{ id: f.guard.id, reason: 'periodic' }])[0][0];

for (const tribe of tribes) {
  test(tribe + ': 새 게임은 채집 설계와 네 일꾼, 2레벨에는 방어 설계 하나만 추가한다', () => {
    const f = fixture(tribe), start = f.game.snapshot();
    assert.equal(start.templates.length, 1);
    assert.equal(start.agents.length, 4);
    const template = upgrade(f), after = f.game.snapshot();
    assert.equal(after.templates.length, 2);
    assert.equal(after.agents.length, 4);
    assert.deepEqual(after.templates[0], start.templates[0]);
    assert.equal(template.name, '둥지 수비대');
    assert.deepEqual(template.dna.pieces, nestDefenderDesign(tribe).design.pieces);
    assert.equal(after.evolutionPoints, 200 - nestUpgradeCost(1, tribe));
    assert.ok(validateDna(template.dna, 2, 999999999));
    assert.equal(template.dna.pieces.some(p => p.gene === 'antenna'), false);
    assert.equal(template.dna.pieces.filter(p => p.gene === 'regeneration').length, 1);
    assert.equal(template.dna.pieces.some(p => p.gene === 'carapace'), true);
    assert.equal(template.dna.pieces.some(p => p.gene === (tribe === 'spore' ? 'secretion' : 'blade')), true);
  });
  test(tribe + ': 방어 설계는 정상 가격으로 생산하며 부족한 포인트를 보조하지 않는다', () => {
    const f = fixture(tribe), template = upgrade(f), cost = birthCost(template, tribe);
    state(f.game, s => { s.evolutionPoints = cost - 1; });
    assert.throws(() => f.game.command({ type: 'birth', templateId: template.id }), /진화 포인트/);
    assert.equal(f.game.snapshot().agents.length, 4);
    state(f.game, s => { s.evolutionPoints = cost; });
    const out = f.game.command({ type: 'birth', templateId: template.id });
    assert.equal(f.game.snapshot().evolutionPoints, 0);
    assert.equal(isNestDefender(f.game.agents.find(agent => agent.id === out.agentId)), true);
  });
  test(tribe + ': 수비대는 둥지 반대편 공유 시야의 공격에 출동한다', () => {
    const f = guardFixture(tribe);
    assert.equal(combatDisposition(f.guard), 'passive');
    assert.equal(f.guard.stats.vision, 1);
    assert.equal(plan(f)?.action, 'fight');
    assert.equal(plan(f)?.defending, true);
    assert.equal(plan(f)?.target.id, f.enemy.id);
    f.environment.simSeconds = .25;
    f.game.prepare(.25); f.game.tick(.25);
    assert.equal(f.guard.utility?.action, 'fight');
    assert.equal(f.guard.utility?.target.id, f.enemy.id);
  });
}

test('기존 저장 설계와 이름·순서를 보존하고 불러오기나 3레벨에서 강제로 추가하지 않는다', () => {
  const f = fixture();
  for (const starter of DNA_STARTER_DESIGNS.filter(t => t.design.level === 2)) {
    state(f.game, s => { s.nestLevel = 2; });
    f.game.command({ type: 'design', templateId: null, name: starter.name, dna: starter.design, birth: false });
  }
  const custom = { ...nestDefenderDesign('bean'), name: '둥지 수비대' };
  f.game.command({ type: 'design', templateId: null, name: custom.name, dna: custom.design, birth: false });
  const old = f.game.snapshot().templates;
  f.game.restore(f.game.save());
  assert.deepEqual(f.game.snapshot().templates, old);
  state(f.game, s => { s.nestLevel = 1; s.evolutionPoints = 200; });
  f.game.command({ type: 'upgrade' });
  assert.deepEqual(f.game.snapshot().templates.slice(0, old.length), old);
  assert.equal(f.game.snapshot().templates.at(-1).name, '둥지 수비대 2');
  const upgraded = f.game.snapshot().templates;
  state(f.game, s => { s.evolutionPoints = 200; });
  f.game.command({ type: 'upgrade' });
  assert.deepEqual(f.game.snapshot().templates, upgraded);
});

test('100개 설계 한도는 삭제 없이 유지하며 AI 둥지에는 초보 설계를 주지 않는다', () => {
  const f = fixture();
  state(f.game, s => {
    s.templates = Array.from({ length: 100 }, (_, i) => ({ ...s.templates[0], id: i + 1, name: '보관 ' + i }));
    s.nextTemplateId = 101;
  });
  const before = f.game.snapshot().templates;
  upgrade(f);
  assert.deepEqual(f.game.snapshot().templates, before);
  const ai = fixture('bean', true);
  assert.equal(upgrade(ai), undefined);
});

test('기존 수비 설계를 편집해도 재추가하지 않고 개체 복제로 수비 역할이 유지된다', () => {
  const f = fixture(), template = upgrade(f);
  f.game.command({ type: 'design', templateId: template.id, name: '내 방어병', dna: template.dna, birth: false });
  const { agentId } = f.game.command({ type: 'birth', templateId: template.id });
  state(f.game, s => { s.nestLevel = 1; s.evolutionPoints = 200; });
  f.game.command({ type: 'upgrade' });
  assert.equal(f.game.snapshot().templates.length, 2);
  f.game.command({ type: 'delete-design', templateId: template.id });
  const out = f.game.command({ type: 'birth', agentId });
  assert.equal(isNestDefender(f.game.agents.find(a => a.id === out.agentId)), true);
  f.game.restore(f.game.save());
  assert.equal(isNestDefender(f.game.agents.find(a => a.id === out.agentId)), true);
});

test('위협이 없으면 귀환해 대기하고 현재 보이지 않는 공격자를 따라가지 않는다', () => {
  const f = guardFixture();
  f.enemy.attack = null;
  assert.equal(plan(f)?.target.key, 'guard-home');
  Object.assign(f.enemy, { x: 35, y: 35, attack: { targetId: f.game.nest.id } });
  f.game.prepare(0);
  assert.notEqual(plan(f)?.action, 'fight');
  Object.assign(f.guard, { x: 13, y: 11, renderFromX: 13, renderFromY: 11 });
  f.game.prepare(0);
  assert.equal(plan(f), undefined);
});

test('더듬이를 추가하면 정상 사냥 행동으로 돌아가며 일반 사용자 전사는 영향받지 않는다', () => {
  const f = guardFixture();
  const antenna = { gene: 'antenna', grade: 2, rotation: 0, q: 0, r: 0 };
  f.guard.dna.pieces.push(antenna);
  assert.equal(isNestDefender(f.guard), false);
  assert.equal(combatDisposition(f.guard), 'aggressive');
  f.guard.dna.pieces.pop();
  delete f.guard.defenseMode;
  assert.equal(isNestDefender(f.guard), false);
  assert.equal(combatDisposition(f.guard), 'aggressive');
});

test('초보 도움말은 싼 옛 전사가 아니라 종족별 수비대를 생산한다', () => {
  for (const tribe of tribes) {
    const f = fixture(tribe), template = upgrade(f), snapshot = f.game.snapshot();
    snapshot.templates.push({ id: 99, name: '옛 전사', dna: DNA_STARTER_DESIGNS[1].design });
    const offer = beginnerHelpOffer(snapshot, { enabled: true, completed: [], dismissed: [] }, {});
    assert.equal(offer.key, 'military');
    assert.equal(offer.action.command.templateId, template.id);
    snapshot.templates = snapshot.templates.filter(t => t.id !== template.id);
    const fallback = beginnerHelpOffer(snapshot, { enabled: true, completed: [], dismissed: [] }, {});
    assert.equal(fallback.action.command.type, 'design');
    assert.equal(fallback.action.command.defenseMode, 'nest');
    assert.deepEqual(fallback.action.command.dna.pieces, nestDefenderDesign(tribe).design.pieces);
  }
});

test('기본 설계 반환값을 편집해도 다른 게임의 원본을 바꾸지 않는다', () => {
  const a = nestDefenderDesign('bean'), b = nestDefenderDesign('bean');
  a.design.pieces[0].q += 20;
  assert.notDeepEqual(a.design, b.design);
  assert.deepEqual(b.design, nestDefenderDesign('bean').design);
});

test('동일 DNA의 일반 설계와 수비 설계를 개체 복제 때 섞지 않는다', () => {
  for (const defender of [true, false]) {
    const f = fixture(), template = upgrade(f);
    const { templateId: ordinaryId } = f.game.command({ type: 'design', templateId: null,
      name: '같은 DNA 일반병', dna: template.dna, birth: false });
    const sourceId = defender ? template.id : ordinaryId;
    const { agentId } = f.game.command({ type: 'birth', templateId: sourceId });
    f.game.command({ type: 'delete-design', templateId: sourceId });
    clearBirthSites(f.game);
    state(f.game, s => { s.evolutionPoints = 200; });
    const out = f.game.command({ type: 'birth', agentId });
    assert.equal(isNestDefender(f.game.agents.find(a => a.id === out.agentId)), defender);
  }
});

test('채집 겸용이나 갑각만 남긴 편집은 수비 역할을 해제한다', async () => {
  const { nestDefenseHint } = await import('../client/beginner-help.mjs');
  const template = { defenseMode: 'nest', dna: nestDefenderDesign('bean').design };
  assert.equal(isNestDefender(template), true);
  assert.match(nestDefenseHint(template), /둥지 수비:/);
  for (const genes of [['gather', 'blade'], ['carapace']]) {
    const edited = { ...template, dna: { pieces: genes.map(gene => ({ gene })) } };
    assert.equal(isNestDefender(edited), false);
    assert.match(nestDefenseHint(edited), /수비 역할 해제됨/);
  }
});

const runtime = readFileSync(new URL('../client/runtime.js', import.meta.url), 'utf8');
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decision = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
for (const [surface, source, entry] of [['게임 워커', worker, 'client/worker.mjs'], ['판단 워커', decision, 'client/decision-worker.mjs']]) {
  const scope = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.api = { ...modules["server/game.mjs"], ...modules["server/combat.mjs"] }; })();', scope);
  for (const tribe of tribes) test(surface + ': ' + tribe + ' 수비 역할은 저장·복원과 실제 판단에도 유지된다', () => {
    const f = guardFixture(tribe, scope.api);
    f.game.restore(f.game.save());
    f.game.prepare(0);
    assert.equal(isNestDefender(f.game.agents[0]), true);
    assert.equal(plan(f)?.action, 'fight');
    assert.equal(plan(f)?.defending, true);
  });
}

test('수비대는 개인 시야 밖 현재 공유 시야의 아군 공격에도 출동한다', () => {
  const f = guardFixture();
  const ally = { ...f.guard, id: 'ally', x: 13, y: 13, defenseMode: null, health: 10, combat: null };
  f.game.agents.push(ally);
  f.enemy.attack.targetId = ally.id;
  f.enemy.attack.targetKind = 'agent';
  f.game.prepare(0);
  assert.equal(plan(f)?.action, 'fight');
  assert.equal(plan(f)?.defending, true);
});

test('포자 수비대는 공유 시야 공격자에게만 원거리 방어 사격한다', () => {
  const f = guardFixture('spore');
  f.guard.x = 17; f.guard.renderFromX = 17;
  const combat = createCombat(f.environment);
  combat.update(f.guard, 0);
  assert.equal(f.guard.attack?.dnaRanged, true);
  const quiet = guardFixture('spore');
  quiet.guard.x = 17; quiet.guard.renderFromX = 17;
  quiet.enemy.attack = null;
  createCombat(quiet.environment).update(quiet.guard, 0);
  assert.notEqual(quiet.guard.attack?.dnaRanged, true);
});
