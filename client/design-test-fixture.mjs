import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

export function readDesignSection(name) {
  let html = "";
  runInNewContext(readFileSync(new URL("../DesignAssets/sections/" + name + ".js", import.meta.url), "utf8"),
    { document: { write: value => { html += value; } } });
  return html;
}
