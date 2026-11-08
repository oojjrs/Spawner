import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as animation from './unit-animation.mjs';
import * as geometry from './image-geometry.mjs';
import * as facing from './unit-size.mjs';
import { creaturePresentationPose } from './creature-presentation.mjs';
import { TALON_OWL_IDLE } from './talon-owl-idle.mjs';

const model = { ...animation, ...geometry, ...facing, TALON_OWL_IDLE };
const registry = entries => new Map(Object.entries(entries).map(([species, clip]) =>
  [species, { animation: clip, scale: 1, sprite: { complete: true, naturalWidth: 8192, src: clip.image } }]));
const resources = { walk: registry(animation.CREATURE_WALK_ANIMATIONS), idle: registry(animation.CREATURE_IDLE_ANIMATIONS) };
const moving = species => ({ species, health: 10, mode: 'fight', facing: -1, moveStartedAt: 0, moveDuration: 0,
  flightStartedAt: -100, combat: { version: 2, position: { moving: true, moveStartedAt: 5 } } });

test('모든 중립 이동 시트는 전투 이동 시계에서 프레임이 진행한다', () => {
  for (const species of Object.keys(animation.CREATURE_WALK_ANIMATIONS)) {
    const agent = moving(species), frames = new Set();
    assert.equal(animation.creatureWalkPose(agent, 4.9), null, species + ': before movement');
    for (let i = 0; i < 60; i++) {
      const pose = animation.creatureWalkPose(agent, 5 + i / 60);
      assert.ok(pose, species); frames.add(pose.frame);
    }
    assert.ok(frames.size >= 3, species + ': live frames');
    agent.combat.position.moving = false;
    assert.equal(animation.creatureWalkPose(agent, 6), null, species + ': stopped');
    agent.combat.position.moving = true; agent.health = 0;
    assert.equal(animation.creatureWalkPose(agent, 6), null, species + ': dead');
  }
});

test('봄지기는 전투 중에도 실제 이륙 뒤 비행 프레임을 반복하고 정지하면 걷지 않는다', () => {
  const agent = moving('spring-keeper');
  for (const [time, stage] of [[5, 'takeoff'], [5.32, 'flight'], [6.8, 'flight']]) {
    const pose = creaturePresentationPose(model, agent, time, false, resources, 'walk');
    assert.ok(pose, 'field renderer must not fall back to idle during combat');
    assert.equal(animation.creatureWalkPose(agent, time).stage, stage);
    if (stage === 'flight') assert.ok(pose.frame >= 4 && pose.frame < 12);
  }
  agent.combat.position.moving = false;
  assert.equal(creaturePresentationPose(model, agent, 6.8, false, resources, 'walk'), null);
});
