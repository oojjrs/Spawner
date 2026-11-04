import { UNIT_APPEARANCE_PIXEL_BUDGETS } from "./unit-appearance.mjs";
import { createUnitAppearanceSource, UNIT_APPEARANCE_BYTE_BUDGETS } from "./unit-appearance-source.mjs";
import { createUnitAppearanceRenderer } from "./unit-appearance-renderer.mjs";
import { unitAppearanceStatePose } from "./unit-appearance-state.mjs";

// The same adapter is used by the world and combat views. Loading only prepares
// the next frame; it cannot paint asynchronously into either scene.
export function createUnitAppearanceWorld(options = {}) {
  const scope = options.scope || globalThis, mobile = options.mobile ?? !!scope.matchMedia?.("(max-width: 900px)").matches;
  const source = createUnitAppearanceSource({ scope, sourceUrl: options.sourceUrl || (path => scope.SpawnerAssets?.source(path) || path),
    byteBudget: UNIT_APPEARANCE_BYTE_BUDGETS[mobile ? "mobile" : "desktop"], ...options.sourceOptions });
  const renderer = createUnitAppearanceRenderer(path => source.acquire(path), options.makeBitmap || ((blob, settings) => scope.createImageBitmap(blob, settings)),
    UNIT_APPEARANCE_PIXEL_BUDGETS[mobile ? "mobile" : "desktop"]);
  function prepare(context, agents, time, worldPixels, pixelRatio, stateOptions) {
    const requests = agents.map(agent => ({ agent, pose: unitAppearanceStatePose(agent, time, stateOptions), worldPixels }))
      // Existing birth scenes own seeds, nest outlets and their placement.
      // They stay active until a separate body-only scene adapter is registered.
      .filter(request => request.pose && request.pose.action !== "birth");
    renderer.prepareFrame(context, requests, pixelRatio);
    return new Map(requests.filter(request => renderer.isReady(context, request.agent, request.pose, worldPixels, pixelRatio))
      .map(request => [String(request.agent.id), request.pose]));
  }
  return { prepare, draw: renderer.drawReady,
    clear() { renderer.clear(); source.clear(); },
    stats: () => ({ encoded: source.stats(), decoded: renderer.stats() }) };
}
