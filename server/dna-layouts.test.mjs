import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { DNA_LAYOUTS, DNA_SHAPE_PAIRS } from "./dna-layouts.mjs";
import { validateDna } from "./dna-unit.mjs";

test("25개 역할별 완성형은 정해진 유효 조각만으로 레벨별 최대 면적을 채운다", () => {
  assert.equal(DNA_LAYOUTS.length, 25);
  const keys = new Set();
  for (const layout of DNA_LAYOUTS) {
    const id = layout.role + ':' + layout.level;
    assert.ok(!keys.has(id), id);
    keys.add(id);
    const dna = { version: 6, level: layout.level, budget: 999999, pieces: layout.pieces };
    assert.ok(validateDna(dna, layout.level, dna.budget), id);
    assert.deepEqual(M.counts(layout.pieces), layout.counts, id);
    const trace = M.trace(layout.pieces, layout.level);
    const total = 1 + 3 * (layout.level + 2) * (layout.level + 3);
    const expected = layout.role === 'worker' ? total - total % 4 : layout.role === 'melee' && layout.level === 2 ? 60 : total;
    assert.equal(trace.filled, expected, id);
    assert.equal(layout.filled, expected, id);
    assert.equal(trace.total, total, id);
    assert.equal(trace.outside.length, 0, id);
    assert.ok(layout.pieces.every(piece => !M.lookup.get(piece.gene).retired), id);
    if (layout.role === 'worker') assert.ok(layout.pieces.every(piece => ['gather', 'capacity', 'harvestSpeed', 'movement'].includes(piece.gene)), id);
    for (const [effect, required] of [['criticalPower', 'critical'], ['comboPower', 'combo'], ['comboSpeed', 'combo'], ['counterPower', 'counter'], ['blockPower', 'block'], ['stunTime', 'stun'], ['bleedPower', 'bleed'], ['areaPower', 'area']]) {
      if (layout.counts[effect]) assert.ok(layout.counts[required], id + ':' + effect);
    }
    assert.deepEqual(M.pack(layout.pieces.map(piece => ({ gene: piece.gene, grade: piece.grade, rotation: 0 })), layout.level).map(piece => piece.gene), layout.pieces.map(piece => piece.gene));
  }
  for (const role of ['melee', 'ranged', 'defense', 'hybrid', 'meleeArmor', 'rangedArmor', 'all']) {
    for (const level of [2, 3, 4]) assert.ok(keys.has(role + ':' + level));
  }
});

test("독립 수명 조각을 제외한 상위 32종은 16개 짝에서 깊게 맞물리고 겹치지 않는다", () => {
  const seen = new Set(), directions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  assert.equal(DNA_SHAPE_PAIRS.length, 16);
  for (const pair of DNA_SHAPE_PAIRS) {
    const [first, second] = pair.pieces.map(piece => M.pieceCells(piece));
    const left = new Set(first.map(M.key)), right = new Set(second.map(M.key));
    assert.ok([...left].every(key => !right.has(key)), pair.genes.join('/'));
    const contacts = first.reduce((sum, point) => sum + directions.filter(([q, r]) => right.has(M.key({ q: point.q + q, r: point.r + r }))).length, 0);
    assert.equal(contacts, pair.contacts, pair.genes.join('/'));
    assert.ok(contacts >= 4, pair.genes.join('/'));
    for (const gene of pair.genes) {
      assert.ok(!seen.has(gene), gene);
      seen.add(gene);
    }
  }
  assert.deepEqual([...seen, "lifespan"].sort(), M.catalog.filter(gene => gene.grade > 1).map(gene => gene.id).sort());
  assert.deepEqual(M.lookup.get("lifespan").cells, [[0,0], [0,1], [0,2], [0,3], [0,4], [0,5]]);
});

test("근접 완성형은 체력을 배분하고 단계별 화력을 높인다", () => {
  let previous = 0;
  for (const level of [2, 3, 4]) {
    const layout = DNA_LAYOUTS.find(layout => layout.role === 'melee' && layout.level === level);
    const stats = M.stats(layout.pieces, 'bean');
    assert.ok(layout.counts.health > 0, 'Lv.' + level);
    assert.ok(layout.counts.power > 0 && layout.counts.blade === 1, 'Lv.' + level);
    const damage = stats.meleePower * (1 + (stats.hits - 1) * stats.comboPower / 100) * (1 + stats.critical / 100 * (stats.criticalPower / 100 - 1));
    const cycle = stats.focus + .7 + (stats.hits - 1) * stats.comboSpeed + 1 / stats.meleeSpeed;
    assert.ok(damage / cycle > previous, 'Lv.' + level);
    previous = damage / cycle;
  }
});
