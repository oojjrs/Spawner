import { readFileSync } from "node:fs";
import { createContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const zoomLayers = JSON.parse(source.match(/const ZOOM_LAYERS = (\[[^\]]+\]);/)[1]);

export function createGameTestContext(bindings) {
  return createContext({ combatPanel: { open: false }, ZOOM_LAYERS: zoomLayers, ...bindings });
}
