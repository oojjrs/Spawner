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
  return (UNIT_DISPLAY_SIZES[unit.species || unit.tribe || "bean"] || UNIT_DISPLAY_SIZES.bean)*scale;
}

export function combatViewCell(width, height, units) {
  const largest = units.reduce((size, unit) => Math.max(size, unitDisplaySize(unit)), 0) || UNIT_DISPLAY_SIZES.bean;
  return Math.min(width * .24, height * .5) / largest;
}

export function combatViewLayout(width, height, units) {
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
