import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const imports = /^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?\r?$/gm;
const exports = /^export\s+(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const completed = new Set(), chunks = ["const modules = Object.create(null);"];
function bundle(name) {
  if (completed.has(name)) return;
  const path = resolve(root, name), source = readFileSync(path, "utf8");
  const dependencies = [...source.matchAll(imports)].map(match => ({ text: match[0], names: match[1],
    name: relative(root, resolve(dirname(path), match[2])).replaceAll("\\", "/") }));
  for (const dependency of dependencies) bundle(dependency.name);
  let transformed = source;
  for (const dependency of dependencies) transformed = transformed.replace(dependency.text, `const {${dependency.names}} = modules[${JSON.stringify(dependency.name)}];`);
  const names = [...source.matchAll(exports)].map(match => match[1]);
  transformed = transformed.replace(/^export\s+/gm, "");
  if (/^(import|export)\s/m.test(transformed)) throw new Error("지원하지 않는 모듈: " + name);
  chunks.push(`modules[${JSON.stringify(name)}] = (() => {\n${transformed}\nreturn { ${names.join(", ")} };\n})();`);
  completed.add(name);
}
bundle("client/combat-lab.js");
const fighter = (side, label) => `<section class="fighter ${side}" id="${side}Card" aria-label="${label}">
  <select id="${side}Unit" aria-label="${label} 유닛"></select><canvas id="${side}Art" width="260" height="200" aria-label="${label} 유닛 모습"></canvas>
  <div class="hp"><span>현재 체력</span><strong id="${side}Hp">100 / 100</strong></div><div class="bar"><i id="${side}Bar"></i></div>
  <div class="stats"><label>기본 전투력<input id="${side}Strength" type="number" min="0" max="100" step="1"></label><label>시작 체력<input id="${side}Health" type="number" min="1" max="100" step="1"></label></div>
  <div class="effective"><span>현재 전투력 <strong id="${side}Effective"></strong></span><small>부상 −<b id="${side}Penalty"></b></small></div>
  <div class="estimate"><span><span id="${side}DamageLabel">현재 체력 기준 피해</span> <b id="${side}Damage"></b></span><small>평균 <b id="${side}Expected"></b></small></div>
</section>`;
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spawner · 전투 실험실</title><style>${readFileSync(resolve(root, "client/combat-lab.css"), "utf8")}</style></head>
<body><main><header><div><div class="eyebrow">SPAWNER / COMBAT LAB</div><h1>전투 실험실</h1><p>교전 시작 체력으로 피해 확정 · 각 명중 시 체력 차감</p></div><output id="status" class="status" aria-live="polite">대결 준비</output></header>
<nav class="presets" aria-label="빠른 대결"><button data-pair="bean,talon-owl">새싹콩 ↔ 갈퀴부엉이</button><button data-pair="bean,bean">새싹콩 ↔ 새싹콩</button><button data-pair="shadow-weasel,vine-turtle">그림자족제비 ↔ 넝쿨거북</button><button data-pair="white-paw,walking-forest">흰발 ↔ 걸어가는 산</button></nav>
<div class="arena">${fighter("left", "왼쪽")}<div class="versus">VS</div>${fighter("right", "오른쪽")}</div>
<div class="controls"><label>첫 공격<select id="first"><option value="left">왼쪽부터</option><option value="right">오른쪽부터</option></select></label><label>피해 계산<select id="damage"><option value="mean">평균 피해 고정</option><option value="random">난수 80–120%</option></select></label><label>난수 시드<input id="seed" type="number" value="1" min="0" max="4294967295"></label><label>재생 배속<select id="playback"><option value="1" selected>1배</option><option value="4">4배</option><option value=".5">0.5배</option></select></label></div>
<div class="actions"><button class="primary" id="step">1회 타격</button><button id="run">자동 전투</button><button id="finish">끝까지</button><button id="reset">초기화</button><button id="repeat">100판 비교</button></div>
<div class="summary"><span><strong id="hits">0</strong>회 타격 · <span id="clock">0.00초</span> · <span id="phase">대결 준비</span></span><output id="batch" aria-live="polite"></output></div>
<section class="ledger" aria-label="타격 기록"><div class="ledger-head"><strong>타격 기록</strong><span>받은 피해 → 남은 체력</span></div><div class="scroll"><table><thead><tr><th>타격</th><th>구분</th><th>공격자</th><th>교전 시작 전투력</th><th>왼쪽</th><th>오른쪽</th><th>시각</th></tr></thead><tbody id="history"></tbody></table></div></section>
<footer><span>게임 전투 모듈 직접 사용 · 전체 23종</span><span>조절한 수치는 이 대결에만 적용</span></footer></main><script>(() => {\n${chunks.join("\n")}\n})();</script></body></html>`;
writeFileSync(resolve(root, "Combat.html"), html.replace(/\r?\n/g, "\r\n"), "utf8");
