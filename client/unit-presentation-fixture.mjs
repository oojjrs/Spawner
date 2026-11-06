import { readFileSync } from "node:fs";

const unitSource = readFileSync(new URL("./unit-presentation.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const assetsSource = readFileSync(new URL("./unit-presentation-assets.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const healthSource = readFileSync(new URL("./unit-health-ring.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function sharedFunction(source, name, indent) {
  return source.match(new RegExp("^" + " ".repeat(indent) + "(?:export )?function " + name + "\\([^]*?^" + " ".repeat(indent) + "}", "m"))?.[0];
}

export function unitPresentationTestSource(gameSource) {
  let source = gameSource.replace(/\r\n/g, "\n");
  for (const match of unitSource.matchAll(/^  function (\w+)\([^]*?^  }/gm)) {
    const name = match[1], wrapper = sharedFunction(source, name, 4);
    if (!wrapper || !wrapper.includes("return unitPresentation." + name + "(")) continue;
    let body = match[0].replace(/^  /gm, "    ");
    if (body.includes("createSurface(")) body = body.replace(/(function \w+\([^]*?\) {\n)/, "$1" +
      '      const createSurface = (width, height) => { const surface = document.createElement("canvas"); surface.width = width; surface.height = height; return surface; };\n');
    if (body.includes("options.")) body = body.replace(/(function \w+\([^]*?\) {\n)/, "$1" +
      '      const options = { maxZoom: () => ZOOM_LAYERS[0], pixelRatio: () => window.devicePixelRatio || 1, selectionShape: () => foodSelectionShape };\n');
    source = source.replace(wrapper, body);
  }
  const wrapper = sharedFunction(source, "drawAgentAppearance", 4);
  if (wrapper?.includes("unitPresentation.drawRootMotion")) {
    const root = sharedFunction(unitSource, "drawRootMotion", 2).replace(/^  /gm, "      ");
    source = source.replace(wrapper, wrapper.replace("{\n", "{\n" + root + "\n").replace("unitPresentation.drawRootMotion", "drawRootMotion"));
  }
  const helpers = ["unitTribeReference", "unitAnimationSheetScale", "creatureIdleSheetScale", "unitDisplayMetrics", "unitAttributeDisplayScale", "unitPresentationBodySize", "drawUnitHealthRing"];
  for (const match of [...source.matchAll(/^    (?:async )?function (\w+)\([^]*?^    }/gm)]) {
    let body = match[0], bindings = "";
    for (const name of helpers) if (body.includes("Spawner." + name + "(")) {
      const helper = sharedFunction(name === "drawUnitHealthRing" ? healthSource : assetsSource, name, 0).replace(/^export /, "");
      bindings += "      if (!Spawner." + name + ") Spawner." + name + " = (" + helper + ");\n";
    }
    if (bindings) source = source.replace(body, body.replace("{\n", "{\n" + bindings));
  }
  return source;
}
