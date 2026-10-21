export function createRoadOptimizer(context) {
  const pending = new Map();
  let completed = new WeakMap();
  let timer = null;

  function* findRoute(road) {
    const knownCount = road.knownCells.size;
    if (completed.get(road) === knownCount) return null;
    const goal = road.route.at(-1);
    const boundary = context.boundary();
    const minimum = Math.min(...boundary.map(cell => Math.abs(goal.x - cell.x) + Math.abs(goal.y - cell.y)));
    if (road.route.length > minimum + 1) {
      const queue = boundary.map(cell => ({ ...cell, parent: null, depth: 0 }));
      const visited = new Set(queue.map(cell => cell.y * context.size + cell.x));
      for (let head = 0; head < queue.length; head++) {
        if (head % 32 === 0) yield;
        const cell = queue[head];
        if (cell.x === goal.x && cell.y === goal.y) {
          const route = [];
          for (let current = cell; current; current = current.parent) {
            route.push({ x: current.x, y: current.y });
            if (route.length % 32 === 0) yield;
          }
          completed.set(road, knownCount);
          return route.reverse();
        }
        if (cell.depth + 2 >= road.route.length) continue;
        for (const next of context.neighbors(cell.x, cell.y)) {
          const index = next.y * context.size + next.x;
          if (visited.has(index) || !context.explored(index) ||
              !road.knownCells.has(next.x + "," + next.y) && (next.x !== goal.x || next.y !== goal.y)) continue;
          visited.add(index);
          queue.push({ x: next.x, y: next.y, parent: cell, depth: cell.depth + 1 });
        }
      }
    }
    completed.set(road, knownCount);
    return null;
  }

  function process() {
    timer = null;
    const deadline = performance.now() + 1;
    do {
      const [road, job] = pending.entries().next().value;
      const result = job.search.next();
      pending.delete(road);
      if (!result.done) pending.set(road, job);
      else {
        if (result.value && result.value.length < road.route.length) context.apply(road, result.value);
        if (job.changed) pending.set(road, { search: findRoute(road), changed: false });
      }
    } while (pending.size && performance.now() < deadline);
    if (pending.size) timer = setTimeout(process, 0);
  }

  return {
    enqueue(road) {
      const job = pending.get(road);
      if (job) job.changed = true;
      else pending.set(road, { search: findRoute(road), changed: false });
      if (timer === null) timer = setTimeout(process, 0);
    },
    clear() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending.clear();
      completed = new WeakMap();
    }
  };
}
