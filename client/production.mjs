export function productionRuntime(source) {
  let stripped = false;
  for (const [name, entry] of [["client/cheats.mjs", "createCheats"], ["server/cheats.mjs", "commandCheat"]]) {
    const module = 'modules["' + name + '"] = (() => {';
    if (!source.includes(module)) continue;
    if (source.split(module).length !== 2) throw new Error("치트 모듈을 확인해 주세요.");
    const start = source.indexOf(module);
    const closing = "\n})();";
    const end = source.indexOf(closing, start);
    if (end < 0) throw new Error("치트 모듈을 확인해 주세요.");
    const stub = module + "\r\nfunction " + entry + "() { return null; }\r\nreturn { " + entry + " };\r\n})();";
    source = source.slice(0, start) + stub + source.slice(end + closing.length);
    stripped = true;
  }
  if (!stripped) throw new Error("치트 모듈을 분리한 실행 코드를 다시 빌드해 주세요.");
  return source.replace(/^const workerSource = (.+);\r?$/m,
    (line, worker) => "const workerSource = " + JSON.stringify(productionRuntime(JSON.parse(worker))) + ";");
}
