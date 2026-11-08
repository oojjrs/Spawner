import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_ANIMATIONS, unitAnimationPose, unitMovementElapsedMs } from './unit-animation.mjs';
import { unitActionState } from './unit-appearance-state.mjs';
import { UNIT_SECRETION_WALK_ANIMATIONS, unitSecretionWalkPose } from './secretion-walk.mjs';
import { welcomeTravelMotion } from './welcome-presentation.mjs';
import { unitMovementPosition } from './unit-animation.mjs';

const agent = tribe => ({ id: tribe, tribe, health: 100, attributes: {}, mode: 'walk', moveStartedAt: 10,
  moveAnimationStartedAt: 10, moveDuration: 4, stepCount: 1, carrying: 0 });

test('slow and fast cell durations keep original 70ms and 40ms player walk frames', () => {
  for (const tribe of ['spore', 'spring', 'pebble']) for (const duration of [.2, .5, 1, 4]) {
    const unit = { ...agent(tribe), moveDuration: duration };
    assert.equal(unitAnimationPose(unit, 10.14).frame, tribe === 'pebble' ? 3 : 2);
    assert.equal(unitAnimationPose(unit, 10.14).animation, UNIT_ANIMATIONS[tribe].walk);
  }
});

test('all four movement and carrying state clocks advance one millisecond per simulation millisecond', () => {
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const duration of [.2, 1, 4]) for (const carrying of [0, 3]) {
    const unit = { ...agent(tribe), moveDuration: duration, carrying };
    assert.ok(Math.abs(unitActionState(unit, 10.14).elapsedMs - 140) < 1e-8);
    unit.moveStartedAt = 10.1;
    assert.ok(Math.abs(unitMovementElapsedMs(unit, 10.14) - 140) < 1e-8);
    unit.moveAnimationStartedAt = 10.1;
    assert.ok(Math.abs(unitMovementElapsedMs(unit, 10.14) - 40) < 1e-8);
  }
});

test('secretion walk uses its own native frames without scaling to cell duration', () => {
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const duration of [.2, 1, 4]) {
    const unit = { ...agent(tribe), moveDuration: duration };
    const animation = UNIT_SECRETION_WALK_ANIMATIONS[tribe];
    assert.equal(unitSecretionWalkPose(unit, 10.14, { walk: animation }).frame,
      tribe === 'spore' || tribe === 'spring' ? 2 : 3);
  }
});

test('welcome traversal preserves native steps continuously and rests only after traversal', () => {
  for (const speed of [.25, .5, 2]) {
    const model = { unitStats: () => ({ speed }), unitMovementPosition };
    const options = { key: 'spore', attributes: {}, width: 480, size: 100, elapsedMs: 140,
      timeline: 10.14, phase: 'enter', startedAt: 10, reducedMotion: false, id: 'welcome-test' };
    const motion = welcomeTravelMotion(model, options);
    assert.equal(motion.agent.moveDuration, Math.min(1, 1 / speed));
    assert.equal(unitAnimationPose(motion.agent, 10.14).frame, 2);
    if (speed < 1) {
      const resting = welcomeTravelMotion(model, { ...options, elapsedMs: 1500, timeline: 11.5 });
      assert.equal(unitAnimationPose(resting.agent, 11.5).action, 'walk');
      assert.equal(resting.agent.moveStartedAt, 11);
      assert.equal(resting.agent.moveAnimationStartedAt, 10);
      const settled = welcomeTravelMotion(model, { ...options, elapsedMs: motion.durationMs, timeline: 10 + motion.durationMs / 1000, phase: 'idle' });
      assert.equal(unitAnimationPose(settled.agent, 10 + motion.durationMs / 1000).action, 'idle');
    }
  }
});
