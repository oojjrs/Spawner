export const UNIT_DISPLAY_SIZES = Object.freeze({
  bean: .40, spore: .38, pebble: .42, spring: .39,
  "flower-tail-bird": .26, "dew-rabbit": .29, "cotton-sheep": .32,
  "soil-mole": .35, "bundle-snail": .38, "rolling-acorn": .38,
  "bubble-toad": .52, "vine-turtle": .52, "spiny-back-beetle": .58,
  "snare-vine": .62, "soil-boar": .66, "shadow-weasel": .72, "talon-owl": .78,
  "spring-keeper": .88, "lantern-keeper": .92, "old-garden-snail": 1.00, "walking-forest": 1.12,
  "spiny-back-leader": 1.24, "white-paw": 1.44
});

export function unitDisplaySize(unit) {
  const count = Array.isArray(unit.dna?.pieces) ? unit.dna.pieces.length :
    Number.isFinite(unit.stats?.pieceCount) ? Math.max(0, unit.stats.pieceCount) : 0;
  const scale = 1 + .01 * count;
  const size = (UNIT_DISPLAY_SIZES[unit.species || unit.tribe || "bean"] || UNIT_DISPLAY_SIZES.bean) * scale;
  return UNIT_DISPLAY_SIZES.bean + (size - UNIT_DISPLAY_SIZES.bean) * .5;
}

export function combatViewCell(width, height) {
  return Math.min(width * .18, height * .2) / UNIT_DISPLAY_SIZES.bean;
}

function combatViewAxis(spans) {
  const intervals = [];
  for (const span of spans.sort((a, b) => a[0] - b[0])) {
    const last = intervals.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else intervals.push([...span]);
  }
  const occupied = (from, to) => intervals.reduce((length, span) => length + Math.max(0, Math.min(to, span[1]) - Math.max(from, span[0])), 0);
  const project = (value, gap) => value * gap + (value >= 0 ? occupied(0, value) : -occupied(value, 0)) * (1 - gap);
  const unproject = (value, gap) => {
    for (const span of intervals) {
      const start = project(span[0], gap), end = start + span[1] - span[0];
      if (value < start) return gap ? span[0] + (value - start) / gap : span[0];
      if (value <= end) return span[0] + value - start;
    }
    const end = intervals.at(-1)[1];
    return end + (value - project(end, gap)) / (gap || 1);
  };
  return { low: intervals[0][0], high: intervals.at(-1)[1], occupied, project, unproject };
}

export function combatViewLayout(width, height, units, camera) {
  if (!camera) return combatViewFormation(width, height, units);
  if (!camera.layout) {
    camera.layout = combatViewFormation(width, height, units);
    camera.width = width; camera.height = height;
  }
  const initial = camera.layout, ratio = Math.min(width / camera.width, height / camera.height);
  const offsetX = (width - camera.width * ratio) / 2, offsetY = (height - camera.height * ratio) / 2;
  const resize = point => ({ x: point.x * ratio + offsetX, y: point.y * ratio + offsetY });
  const project = initial.project && (point => resize(initial.project(point)));
  const unproject = initial.unproject && (point => initial.unproject({ x: (point.x - offsetX) / ratio, y: (point.y - offsetY) / ratio }));
  const cell = initial.cell * ratio;
  const positions = new Map(units.map(unit => {
    const point = unit.combat?.position || unit.combatPosition;
    const origin = initial.positions.get(String(unit.id)) || { x: camera.width * ((unit.combat?.side ?? unit.side) ? .75 : .25), y: camera.height * .68 };
    const { x, y } = project && Number.isFinite(point?.x) && Number.isFinite(point?.y) ? project(point) : resize(origin);
    const size = unitDisplaySize(unit);
    return [String(unit.id), { x, y, bounds: { left: x - size * cell * .65, right: x + size * cell * .65,
      top: y - size * cell * 1.2, bottom: y + size * cell * .18 } }];
  }));
  return { cell, positions, project, unproject };
}

function combatViewFormation(width, height, units) {
  const located = units.map(unit => ({ unit, point: unit.combat?.position || unit.combatPosition }))
    .filter(entry => Number.isFinite(entry.point?.x) && Number.isFinite(entry.point?.y));
  if (located.length) {
    const axes = home => {
      const bodies = located.map(({ unit, point }) => {
        const size = unitDisplaySize(unit);
        const x = home && Number.isFinite(point.homeX) ? point.homeX : point.x;
        const y = (home && Number.isFinite(point.homeY) ? point.homeY : point.y) * .5;
        return { left: x - size * .65, right: x + size * .65, top: y - size * 1.2, bottom: y + size * .18 };
      });
      return { x: combatViewAxis(bodies.map(body => [body.left, body.right])),
        y: combatViewAxis(bodies.map(body => [body.top, body.bottom])) };
    };
    const home = axes(true), current = axes(false);
    const leftBody = home.x.occupied(home.x.low, 0), rightBody = home.x.occupied(0, home.x.high);
    const verticalBody = home.y.occupied(home.y.low, home.y.high);
    let cell = Math.min(combatViewCell(width, height, located.map(entry => entry.unit)),
      width * .44 / leftBody, width * .44 / rightBody, height * .72 / verticalBody);
    const gap = (span, body, available) => span > body ? Math.max(0, Math.min(1, (available - body) / (span - body))) : 1;
    const gapX = Math.min(gap(Math.max(0, -home.x.low), leftBody, width * .44 / cell),
      gap(Math.max(0, home.x.high), rightBody, width * .44 / cell));
    const gapY = gap(home.y.high - home.y.low, verticalBody, height * .72 / cell);
    const extentX = Math.max(Math.abs(current.x.project(current.x.low, gapX)), Math.abs(current.x.project(current.x.high, gapX)));
    const lowY = current.y.project(current.y.low, gapY), highY = current.y.project(current.y.high, gapY);
    cell = Math.min(cell, width * .44 / extentX, height * .72 / (highY - lowY));
    const project = point => ({ x: width * .5 + current.x.project(point.x, gapX) * cell,
      y: height * .55 + (current.y.project(point.y * .5, gapY) - (lowY + highY) / 2) * cell });
    const unproject = point => ({ x: current.x.unproject((point.x - width * .5) / cell, gapX),
      y: current.y.unproject((point.y - height * .55) / cell + (lowY + highY) / 2, gapY) * 2 });
    const positions = new Map(located.map(({ unit, point }) => {
      const { x, y } = project(point), size = unitDisplaySize(unit);
      return [String(unit.id), { x, y, bounds: { left: x - size * cell * .65, right: x + size * cell * .65,
        top: y - size * cell * 1.2, bottom: y + size * cell * .18 } }];
    }));
    return { cell, positions, project, unproject };
  }
  const teams = [0, 1].map(side => units.filter(unit => (unit.combat?.side ?? unit.side) === side));
  const count = Math.max(...teams.map(team => team.length));
  const positions = new Map();
  if (!count) return { cell: combatViewCell(width, height, units), positions };
  const columnCount = Math.min(count, Math.ceil(Math.sqrt(count * 1.5))), rowCount = Math.ceil(count / columnCount);
  const columns = Array(columnCount).fill(0), rows = Array(rowCount).fill(0);
  teams.forEach(team => team.forEach((unit, index) => {
    const size = unitDisplaySize(unit);
    columns[index % columnCount] = Math.max(columns[index % columnCount], size * 1.3);
    rows[Math.floor(index / columnCount)] = Math.max(rows[Math.floor(index / columnCount)], size);
  }));
  const gapX = Math.min(width * .035, width * .42 / (columnCount * 4));
  const gapY = Math.min(height * .035, height * .36 / (rowCount * 4));
  const totalWidth = columns.reduce((sum, value) => sum + value, 0);
  const rowSpans = rows.slice(1).map((size, index) => rows[index] * .18 + size * 1.2);
  const groundSpan = rowSpans.reduce((sum, value) => sum + value, 0);
  const cell = Math.min(combatViewCell(width, height, units),
    (width * .42 - gapX * (columnCount - 1)) / totalWidth,
    height * .44 / (rows[0] * 1.2), height * .08 / (rows[rowCount - 1] * .18),
    rowCount > 1 ? (height * .36 - gapY * (rowCount - 1)) / groundSpan : Infinity);
  const gridWidth = totalWidth * cell + gapX * (columnCount - 1);
  const gridHeight = groundSpan * cell + gapY * (rowCount - 1);
  const firstFoot = height * .5 + (height * .36 - gridHeight) / 2;
  teams.forEach((team, side) => team.forEach((unit, index) => {
    const column = index % columnCount, row = Math.floor(index / columnCount), size = unitDisplaySize(unit);
    const offsetX = columns.slice(0, column).reduce((sum, value) => sum + value, 0) * cell + gapX * column;
    const offsetY = rowSpans.slice(0, row).reduce((sum, value) => sum + value, 0) * cell + gapY * row;
    const x = width * (side ? .75 : .25) + (side ? -1 : 1) * (gridWidth / 2 - offsetX - columns[column] * cell / 2);
    const y = firstFoot + offsetY;
    positions.set(String(unit.id), { x, y, bounds: { left: x - size * cell * .65, right: x + size * cell * .65,
      top: y - size * cell * 1.2, bottom: y + size * cell * .18 } });
  }));
  return { cell, positions };
}

export function unitFacing(unit) {
  return (unit.attack?.directionX || unit.facing || 1) < 0 ? -1 : 1;
}

export function unitFrameMirror(sourceFacing, facing) {
  return (facing < 0) !== (sourceFacing === "left");
}
