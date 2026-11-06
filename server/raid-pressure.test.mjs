import test from "node:test";
import assert from "node:assert/strict";
import { colonyRaidPressure } from "./raid-pressure.mjs";

test("같은 접근로에서는 수급이 느릴수록 첫 도착이 늦고 출정 간격이 길어진다", () => {
  const slow = colonyRaidPressure(10, 120, [20,40], 120);
  const fast = colonyRaidPressure(40, 120, [20,40], 120);
  assert.ok(slow.arrivalAt > fast.arrivalAt);
  assert.ok(slow.interval > fast.interval);
  assert.equal(fast.interval, 60);
  assert.equal(slow.interval, 120);
});

test("같은 수급에서도 가까운 큰 굴이 적으면 습격 압박이 낮아진다", () => {
  const isolated = colonyRaidPressure(40, 120, [90,120], 120);
  const exposed = colonyRaidPressure(40, 120, [20,40,50], 120);
  assert.ok(isolated.arrivalAt > exposed.arrivalAt);
  assert.ok(isolated.interval > exposed.interval);
});

test("생산이 매우 빠르거나 멈춰도 출정 간격과 첫 도착 유예는 범위를 넘지 않는다", () => {
  for (const food of [0,1,20,33,10000]) {
    const result = colonyRaidPressure(food, 120, [10,20,30], 120);
    assert.ok(result.interval >= 60 && result.interval <= 120);
    assert.ok(result.arrivalAt >= 120 && result.arrivalAt <= 300);
  }
});

// Defense is affordable within five minutes; the old 105-second grace made real
// first waves wait until almost seven minutes despite their 300-second schedule.
test("current opening funding grace stays within 5:00–5:30 before actual path travel",()=>{
 for(const tribe of ["bean","spore","pebble","spring"])for(const food of [0,1,10,20,40,10000]){
  const result=colonyRaidPressure(food,120,[15,30],300,tribe);
  assert.ok(result.arrivalAt>=300 && result.arrivalAt<=330);
 }
});
