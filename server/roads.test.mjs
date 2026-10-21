import test from "node:test";
import assert from "node:assert/strict";
import { createRoadOptimizer } from "./roads.mjs";

function fixture(size, boundary, known, explored) {
  let visits = 0;
  let applications = 0;
  let finish;
  const result = new Promise(resolve => { finish = resolve; });
  const optimizer = createRoadOptimizer({ size, boundary: () => boundary,
    explored: index => explored.has(index),
    neighbors(x, y) {
      visits++;
      return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size)
        .map(([nx, ny]) => ({ x: nx, y: ny }));
    },
    apply(road, route) { road.route = route; applications++; finish(route); }
  });
  const road = { knownCells: new Set(known.map(cell => cell.x + "," + cell.y)),
    route: [{ x: 0, y: 0 }, ...Array.from({ length: size * 4 }, () => ({ x: 0, y: 0 })), { x: size - 1, y: size - 1 }] };
  return { optimizer, road, result, get visits() { return visits; }, get applications() { return applications; } };
}

test("경로 요청은 즉시 반환하고 별도 작업에서 최단 경로를 구한다", async t => {
  const size = 80;
  const cells = Array.from({ length: size * size }, (_, index) => ({ x: index % size, y: Math.floor(index / size) }));
  const f = fixture(size, [{ x: 0, y: 0 }], cells, new Set(cells.map(cell => cell.y * size + cell.x)));
  t.after(() => f.optimizer.clear());
  f.optimizer.enqueue(f.road);
  assert.equal(f.visits, 0);
  const progress = await new Promise(resolve => setTimeout(() => resolve(f.visits), 0));
  assert.ok(progress > 0 && progress < size * size);
  const route = await f.result;
  assert.equal(route.length, 159);
  assert.deepEqual(route[0], { x: 0, y: 0 });
  assert.deepEqual(route.at(-1), { x: 79, y: 79 });
  for (let index = 1; index < route.length; index++) {
    assert.equal(Math.abs(route[index].x - route[index - 1].x) + Math.abs(route[index].y - route[index - 1].y), 1);
  }
});

test("같은 길의 요청은 합치고 새 지식이 없으면 다시 탐색하지 않는다", async t => {
  const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const f = fixture(2, [cells[0]], cells, new Set([0, 1, 3]));
  t.after(() => f.optimizer.clear());
  for (let index = 0; index < 20; index++) f.optimizer.enqueue(f.road);
  await f.result;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(f.applications, 1);
  const visits = f.visits;
  f.optimizer.enqueue(f.road);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(f.visits, visits);
});

test("미탐색 칸을 통과하지 않고 기존 길은 계산 중에도 보존한다", async t => {
  const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const f = fixture(2, [cells[0]], cells, new Set([0, 3]));
  t.after(() => f.optimizer.clear());
  const previous = f.road.route;
  f.optimizer.enqueue(f.road);
  assert.equal(f.road.route, previous);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(f.applications, 0);
  assert.equal(f.road.route, previous);
});

test("복원으로 취소된 계산은 이전 길에 결과를 적용하지 않는다", async () => {
  const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const f = fixture(2, [cells[0]], cells, new Set([0, 1, 3]));
  f.optimizer.enqueue(f.road);
  f.optimizer.clear();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(f.visits, 0);
  assert.equal(f.applications, 0);
});
