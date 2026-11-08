import test from 'node:test';
import assert from 'node:assert/strict';
import { basicRecoveryRate, totalRecoveryRate, UNIT_RECOVERY_RULES } from './unit-recovery.mjs';
test('기본 회복은 최대체력 비례와 상한을 적용하고 추가 재생은 가산한다',()=>{
  assert.equal(UNIT_RECOVERY_RULES.delay,5);
  for(const [hp,expected] of [[10,.1],[30,.2],[60,.35],[1000,.35]]) {
    assert.ok(Math.abs(basicRecoveryRate(hp)-expected)<1e-9);
    assert.ok(Math.abs(totalRecoveryRate(hp,.4)-expected-.4)<1e-9);
  }
  for(const hp of [0,-1,NaN,Infinity,undefined]) assert.equal(basicRecoveryRate(hp),0);
  assert.equal(totalRecoveryRate(10,-1),.1);
});
