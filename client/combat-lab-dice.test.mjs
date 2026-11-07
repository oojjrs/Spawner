import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { COMBAT_LAB_APPEARANCES, combatLabPlayable, combatLabAppearance } from "./combat-lab-appearances.mjs";
import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { SIMULATION_STATS, deriveSimulationStats } from "./combat-simulation.mjs";
import { dnaUnitStats } from "../server/dna-unit.mjs";
import { startingWorkerDna } from "../server/tribe-start.mjs";
import { unitCombatStats, combatProfile } from "../server/combat-stats.mjs";

for (const file of ["./combat-lab.js", "../Combat.html"]) test(file + " 주사위는 양쪽5명을 모두 바꾸고 실제 원종 프로필을 독립 선택한다", () => {
  const source = readFileSync(new URL(file, import.meta.url), "utf8").replaceAll("\r\n", "\n");
  const start = source.indexOf('elements.dice = button(stageCenter, "🎲", () => {');
  const finish = source.indexOf("\n});", start);
  const helper = source.indexOf("function selectBuild(side) {");
  const helperEnd = source.indexOf("\n}", helper);
  assert.ok(start >= 0 && finish > start && helper >= 0 && helperEnd > helper);
  const sides = ["left", "right"], rosters = {}, builds = {}, inputs = {}, selected = {};
  for (const [sideIndex, side] of sides.entries()) {
    const profile = { key: sideIndex ? "spore" : "bean", name: side,
      counts: Object.fromEntries(SIMULATION_STATS.map(stat => [stat.key, stat.key === "power" ? 4 + sideIndex : 0])),
      organs: { attack: 1, ranged: 0, heal: 0 } };
    rosters[side] = Array.from({ length: 5 }, (_, slot) => ({ ...structuredClone(profile), key: COMBAT_LAB_UNITS[slot + sideIndex].key }));
    selected[side] = 3; builds[side] = rosters[side][3];
    inputs[side] = Object.fromEntries([...SIMULATION_STATS.map(stat => stat.key), "attack", "ranged", "heal", "appearance", "dnaAppearance"].map(key => [key, { value: null }]));
  }
  let roll, changes = 0;
  const math = Object.create(Math); math.random = () => 0;
  const scope = { sides, rosters, builds, selected, inputs, COMBAT_LAB_UNITS, SIMULATION_STATS, structuredClone, combatLabPlayable, combatLabAppearance,
    Math: math, elements: {}, stageCenter: null,
    button(parent, label, action) { roll = action; }, changed() { changes++; } };
  runInNewContext(source.slice(helper, helperEnd + 2) + "\n" + source.slice(start, finish + 4), scope);
  for (let round = 0; round < 20; round++) {
    const previous = Object.fromEntries(sides.map(side => [side, rosters[side].map(build => build.key)]));
    roll();
    for (const [sideIndex, side] of sides.entries()) {
      assert.equal(rosters[side].length, 5);
      assert.equal(new Set(rosters[side].map(build => build.key)).size, 5);
      assert.equal(selected[side], 0);
      assert.equal(inputs[side].appearance.value, rosters[side][0].key);
      for (const [slot, build] of rosters[side].entries()) {
        assert.notEqual(build.key, previous[side][slot], side + " " + slot);
        assert.ok(COMBAT_LAB_UNITS.some(unit => unit.key === build.key));
        assert.deepEqual(Object.keys(build), ["key"]);
        const stats = deriveSimulationStats({ ...build });
        const expected = ["bean", "spore", "pebble", "spring"].includes(build.key)
          ? dnaUnitStats(startingWorkerDna(build.key)) : { ...unitCombatStats(build.key), ...combatProfile({ species: build.key, stats: unitCombatStats(build.key), attributes: {} }) };
        assert.equal(stats.health, expected.health);
        assert.equal(stats.attackPower, expected.attackPower);
      }
      const second = rosters[side][1], secondKey = second.key;
      assert.equal(new Set([...rosters.left, ...rosters.right]).size, 10);
      rosters[side][0].name = "독립 편집";
      assert.equal(second.key, secondKey);
      assert.equal(second.name, undefined);
      selected[side] = 1; scope.selectBuild(side);
    }
  }
  assert.equal(changes, 20);
});

test("공개 실험실 번들은 의존 모듈을 먼저 정의한다", () => {
  const html = readFileSync(new URL("../Combat.html", import.meta.url), "utf8");
  const headers = [...html.matchAll(/^modules\["([^"]+)"\] = \(\(\) => \{/gm)];
  const names = headers.map(header => header[1]);
  for (const [index, header] of headers.entries()) {
    const source = html.slice(header.index, headers[index + 1]?.index || html.indexOf("</script>", header.index));
    for (const match of source.matchAll(/^const\s+\{[^}]+\}\s*=\s*modules\["([^"]+)"\];/gm))
      assert.ok(names.indexOf(match[1]) >= 0 && names.indexOf(match[1]) < index, names[index] + " → " + match[1]);
  }
});
