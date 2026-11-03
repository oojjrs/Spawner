export function productionRuntime(source) {
  let stripped = false;
  for (const [name, entries] of [["client/cheats.mjs", ["createCheats"]], ["server/cheats.mjs", ["commandCheat", "commandRoomCheat"]]]) {
    const module = 'modules["' + name + '"] = (() => {';
    if (!source.includes(module)) continue;
    if (source.split(module).length !== 2) throw new Error("치트 모듈을 확인해 주세요.");
    const start = source.indexOf(module);
    const closing = "\n})();";
    const end = source.indexOf(closing, start);
    if (end < 0) throw new Error("치트 모듈을 확인해 주세요.");
    const stub = module + "\r\n" + entries.map(entry => "function " + entry + "() { return null; }").join("\r\n") +
      "\r\nreturn { " + entries.join(", ") + " };\r\n})();";
    source = source.slice(0, start) + stub + source.slice(end + closing.length);
    stripped = true;
    if (name === "client/cheats.mjs" && !source.includes("globalThis.SpawnerProduction = true;")) {
      source = "globalThis.SpawnerProduction = true;\r\n" + source;
    }
  }
  if (!stripped) throw new Error("치트 모듈을 분리한 실행 코드를 다시 빌드해 주세요.");
  return source.replace(/^const workerSource = (.+);\r?$/m,
    (line, worker) => "const workerSource = " + JSON.stringify(productionRuntime(JSON.parse(worker))) + ";")
    .replace(/^globalThis\.SpawnerDecisionWorkerSource = (.+);\r?$/m,
      (line, worker) => "globalThis.SpawnerDecisionWorkerSource = " + JSON.stringify(productionRuntime(JSON.parse(worker))) + ";");
}
