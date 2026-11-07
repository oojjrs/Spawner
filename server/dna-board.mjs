export const DNA_BOARD_SHAPES = Object.freeze({"capacity":[[0,0],[1,0],[2,0]],"health":[[0,0],[1,0],[1,-1]],"movement":[[0,0],[1,0],[0,1]],"harvestSpeed":[[0,0],[1,0],[2,-1]],"gather":[[0,0],[1,0],[1,1]],"blade":[[0,0],[0,1],[1,-1],[1,0]],"power":[[0,0],[0,1],[0,2],[1,2]],"speed":[[0,0],[0,1],[0,2],[1,-1],[1,1]],"secretion":[[0,0],[0,1],[1,-2],[1,-1],[2,-3]],"rangedPower":[[0,0],[0,1],[0,2],[1,1],[1,2]],"rangedSpeed":[[0,0],[0,1],[0,2],[1,2],[1,3]],"antenna":[[0,0],[0,1],[0,2],[1,1]],"carapace":[[0,0],[0,1],[0,2],[1,-1],[2,-1]],"harvest":[[0,0],[0,1],[0,2],[1,0],[1,2]],"loadSpeed":[[0,0],[0,1],[0,3],[1,1],[1,2]],"combo":[[0,0],[0,1],[0,2],[1,-1],[1,0]],"critical":[[0,0],[0,1],[1,-2],[1,-1],[2,-2]],"counter":[[0,0],[0,1],[0,2],[0,3],[1,-1]],"stun":[[0,0],[0,1],[0,2],[0,3],[1,3]],"bleed":[[0,0],[0,1],[0,2],[0,3]],"area":[[0,0],[0,1],[0,2],[1,-1],[1,0],[2,0]],"accuracy":[[0,0],[0,1],[1,-2],[1,-1],[1,1],[2,0]],"tenacity":[[0,0],[0,1],[0,2],[1,-2],[1,-1]],"block":[[0,0],[0,1],[1,-1],[2,-3],[2,-2]],"evasion":[[0,0],[0,1],[1,1],[2,1],[2,2]],"vision":[[0,0],[0,1],[1,-1],[1,0],[1,1],[2,-1]],"legs":[[0,0],[1,-2],[1,-1],[1,0],[1,1],[2,-1]],"armor":[[0,0],[0,1],[1,-1],[1,1],[2,-1],[2,0]],"parry":[[0,0],[0,1],[0,2],[1,-2],[1,-1],[1,0]],"criticalPower":[[0,0],[0,1],[0,2],[1,-2],[1,-1],[2,-1]],"penetration":[[0,0],[0,1],[0,2],[1,-1],[1,1],[2,0]],"comboPower":[[0,0],[0,1],[1,-1],[1,0],[2,0],[2,1]],"blockPower":[[0,0],[0,1],[1,0],[1,1],[1,2],[2,-1]],"counterPower":[[0,0],[0,1],[0,2],[1,-1],[2,-1],[3,-2]],"reduction":[[0,0],[0,1],[1,-2],[1,-1],[2,-3],[2,-2]],"stunTime":[[0,0],[0,1],[0,2],[1,-1],[1,0],[2,-2]],"bleedPower":[[0,0],[0,1],[0,2],[1,-2],[1,-1],[2,-2]],"areaPower":[[0,0],[0,1],[0,2],[1,-1],[1,0],[1,2]],"lifesteal":[[0,0],[0,1],[0,2],[0,3],[1,-1],[1,0]],"reflection":[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],"regeneration":[[0,0],[0,1],[1,0],[2,-2],[2,-1],[3,-1]],"comboSpeed":[[0,0],[0,1],[0,2],[1,-1],[1,0],[2,-1]],"focus":[[0,0],[0,1],[1,-2],[1,-1],[2,-2],[2,-1]]});

export function dnaBoardCells(radius) {
  const cells = [];
  for (let r = -radius; r <= radius; r++) for (let q = -radius; q <= radius; q++) {
    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius) cells.push({ q, r });
  }
  return cells;
}

export function dnaPieceCells(piece) {
  const shape = DNA_BOARD_SHAPES[piece.gene];
  if (!shape) return [];
  return shape.map(cell => {
    let [q, r] = cell;
    for (let turn = 0; turn < piece.rotation; turn++) [q, r] = [-r, q + r];
    return { q: q + piece.q, r: r + piece.r };
  });
}

export function dnaBoardTrace(pieces, level, lookup, radius) {
  const paths = [], occupied = new Map(), outside = [], nodes = [];
  let reason = '', at = -1;
  const limit = radius(level), total = Number.isFinite(limit) ? 1 + 3 * limit * (limit + 1) : 0;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index], gene = lookup.get(piece?.gene);
    if (!gene || !Number.isInteger(piece.q) || !Number.isInteger(piece.r) || Math.abs(piece.q) > 1000 || Math.abs(piece.r) > 1000 ||
        !Number.isInteger(piece.rotation) || piece.rotation < 0 || piece.rotation > 5 || !Number.isInteger(piece.grade) || piece.grade < 1 || piece.grade > 4) {
      return { valid: false, reason: 'invalid', paths, nodes, occupied, outside, filled: occupied.size, total, complete: false, at: index };
    }
    if (Number.isInteger(level) && Math.max(piece.grade, gene.grade) > level && !reason) { reason = 'level'; at = index; }
    const points = dnaPieceCells(piece), start = { q: piece.q, r: piece.r };
    for (const point of points) {
      const key = point.q + ',' + point.r;
      if (occupied.has(key) && !reason) { reason = 'collision'; at = index; }
      if (Math.max(Math.abs(point.q), Math.abs(point.r), Math.abs(point.q + point.r)) > limit) {
        outside.push(point);
        if (!reason) { reason = 'boundary'; at = index; }
      }
      occupied.set(key, { kind: 'cell', index });
    }
    paths.push({ ...piece, start, points, end: points[points.length - 1] });
    nodes.push(start);
  }
  return { valid: !reason, reason, paths, nodes, occupied, outside, filled: occupied.size, total, complete: !reason && total > 0 && occupied.size === total, at };
}

export function dnaBoardPack(pieces, level, radius) {
  const cells = dnaBoardCells(radius(level)), positions = cells.slice().sort((a, b) =>
    Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r), Math.abs(b.q + b.r)) || a.r - b.r || a.q - b.q);
  const keys = new Set(cells.map(cell => cell.q + ',' + cell.r));
  if (pieces.reduce((sum, piece) => sum + (DNA_BOARD_SHAPES[piece.gene]?.length || cells.length + 1), 0) > cells.length) return null;
  const ordered = pieces.map((piece, index) => ({ piece, index })).sort((a, b) => DNA_BOARD_SHAPES[b.piece.gene].length - DNA_BOARD_SHAPES[a.piece.gene].length);
  const occupied = new Set(), result = new Array(pieces.length);
  let remaining = 40000;
  function place(index) {
    if (index === ordered.length) return true;
    const { piece, index: original } = ordered[index];
    for (const point of positions) for (let turn = 0; turn < 6; turn++) {
      if (--remaining < 0) return false;
      const next = { gene: piece.gene, grade: piece.grade, rotation: (piece.rotation + turn) % 6, q: point.q, r: point.r };
      const footprint = dnaPieceCells(next).map(cell => cell.q + ',' + cell.r);
      if (footprint.some(key => !keys.has(key) || occupied.has(key))) continue;
      footprint.forEach(key => occupied.add(key));
      result[original] = next;
      if (place(index + 1)) return true;
      footprint.forEach(key => occupied.delete(key));
    }
    return false;
  }
  return place(0) ? result : null;
}
