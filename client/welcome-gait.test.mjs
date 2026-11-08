import test from 'node:test';
import assert from 'node:assert/strict';
import { welcomeStridePixels, welcomeTravelMotion, WELCOME_IDLE_DURATION_MS } from './welcome-presentation.mjs';
import { CREATURE_WALK_ANIMATIONS, creatureWalkPose, creatureAnimationSpeed, unitMovementPosition } from './unit-animation.mjs';

const model = { CREATURE_WALK_ANIMATIONS, creatureAnimationSpeed, unitMovementPosition };
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} vs ${expected}`);

test('authored weasel strides follow body rendering scale rather than battlefield cell size', () => {
  for (const key of ['white-paw', 'shadow-weasel']) {
    const animation = CREATURE_WALK_ANIMATIONS[key];
    const sourceScale = key === 'white-paw' ? .315 : .268;
    assert.equal(animation.frameSize, key === 'white-paw' ? 248 : 229);
    assert.equal(animation.frameCount, 64);
    assert.equal(animation.durationMs, 500);
    near(animation.strideFrameRatio * animation.frameSize, 187.5 * sourceScale, 'packed source stride');
    assert.equal(animation.sourceFacing, 'left');
    for (const cell of [60, 120, 240]) for (const displayScale of [.3, .6, 1.2]) {
      const entry = { scale: .8 };
      const stride = welcomeStridePixels(animation, entry, cell, displayScale);
      const renderedSourcePixel = 1.4 * entry.scale * cell * displayScale / animation.viewSize;
      near(stride, 187.5 * sourceScale * renderedSourcePixel, key + ' stance distance');
    }
  }
  assert.equal(welcomeStridePixels(CREATURE_WALK_ANIMATIONS['bundle-snail'], { scale: 1 }, 120, 1), null);
  assert.equal(welcomeStridePixels(CREATURE_WALK_ANIMATIONS['white-paw'], null, 120, 1), null);
});

test('welcome forward travel cancels planted-foot motion at the authored half-second cadence', () => {
  for (const key of ['white-paw', 'shadow-weasel']) for (const phase of ['enter', 'exit']) {
    for (const width of [320, 480, 720]) {
      const cell = width / 4, animation = CREATURE_WALK_ANIMATIONS[key];
      const stride = welcomeStridePixels(animation, { scale: .8 }, cell, .6);
      const request = { key, width, size: width / 6, worldPixels: cell, stridePixelsPerCycle: stride,
        phase, startedAt: 11, timeline: 11, elapsedMs: 0 };
      const first = welcomeTravelMotion(model, request);
      const at = elapsedMs => welcomeTravelMotion(model, { ...request, timeline: 11 + elapsedMs / 1000, elapsedMs });
      near(first.x - at(500).x, stride, key + ' one complete gait');
      near(first.cell, cell, 'drawing size stays unchanged');
      for (const ms of [1, 50, 125, 200, 310, 313, 499, 501, 751, 1001]) {
        const motion = at(ms), pose = creatureWalkPose(motion.agent, 11 + ms / 1000);
        assert.ok(pose, key + '/' + ms + ' retains moving pose');
        assert.equal(pose.frame, Math.floor(ms % 500 / 500 * 64));
        near(first.x - motion.x, stride * ms / 500, key + ' continuous travel');
      }
      // A planted paw moves right through 120 source px over .64 of a cycle.
      const sourcePixel = stride / 187.5;
      for (const ms of [0, 50, 125, 200, 300])
        near(at(ms).x + 120 * (ms / 500) / .64 * sourcePixel, first.x, 'stationary planted paw');
      const end = at(first.durationMs);
      if (phase === 'enter') near(end.x, width / 2, 'exact center landing');
      else assert.ok(end.x + request.size / 2 <= 0, 'exit clears viewport');
    }
  }
  assert.equal(WELCOME_IDLE_DURATION_MS, 1500);
});

test('reduced motion stays centered and legacy species retain native travel timing', () => {
  const request = { key: 'white-paw', width: 480, size: 90, worldPixels: 100,
    stridePixelsPerCycle: 28, elapsedMs: 400, timeline: 2.4, startedAt: 2, phase: 'enter' };
  const reduced = welcomeTravelMotion(model, { ...request, reducedMotion: true });
  assert.equal(reduced.x, 240); assert.equal(reduced.agent.mode, 'idle');
  const legacy = welcomeTravelMotion(model, { ...request, key: 'soil-mole', stridePixelsPerCycle: null });
  assert.equal(legacy.cell, 100); assert.equal(legacy.travelCell, 100);
  near(legacy.agent.moveDuration, 1 / creatureAnimationSpeed('soil-mole'), 'legacy speed');
});
