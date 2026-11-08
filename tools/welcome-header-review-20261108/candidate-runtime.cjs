// Read-only QA overlay: keep the last integrated runtime and replace only the
// two modules owned by the welcome gait change. Never write client/runtime.js.
const fs = require('fs'), path = require('path');
module.exports = function candidateRuntime(root) {
  let runtime = fs.readFileSync(path.join(root, 'client/runtime.js'), 'utf8');
  if (process.env.QA_USE_INTEGRATED_RUNTIME === '1') return runtime;
  for (const name of ['client/creature-approved-animations.mjs', 'client/welcome-presentation.mjs']) {
    let source = fs.readFileSync(path.join(root, name), 'utf8');
    const exported = [...source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(match => match[1]);
    source = source.replace(/^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?\r?$/gm, (_, names, from) => {
      const dependency = path.relative(root, path.resolve(root, path.dirname(name), from)).replaceAll('\\', '/');
      return `const {${names}} = modules[${JSON.stringify(dependency)}];`;
    }).replace(/^export\s+/gm, '');
    const start = runtime.indexOf(`modules[${JSON.stringify(name)}] = (() => {`);
    const end = runtime.indexOf('\nmodules[', start + 1);
    if (start < 0 || end < 0) throw Error('Missing QA replacement boundary: ' + name);
    runtime = runtime.slice(0, start) + `modules[${JSON.stringify(name)}] = (() => {\n${source}\nreturn { ${exported.join(', ')} };\n})();` + runtime.slice(end);
  }
  return runtime;
};
