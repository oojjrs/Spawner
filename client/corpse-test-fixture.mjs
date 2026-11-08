import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { presentationRenderer } from "./unit-presentation-test-harness.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

export function corpseRenderer(testContext) {
  const render = presentationRenderer(testContext);
  const scope = createContext({ unitPresentation: render.presentation, AGENT_HEIGHT: .7,
    corpsePlaybackTime: () => render.state.simSeconds, drawCreatureCorpse: () => "creature" });
  runInContext(source.match(/^    function drawAgentCorpse\([^]*?^    }/m)[0], scope);
  function draw(corpse, time, opacity) {
    render.state.simSeconds = time;
    render.draws.length = render.scales.length = render.translations.length = render.outlines.length = render.context.alphas.length = 0;
    render.context.globalAlpha = .8;
    return scope.drawAgentCorpse(render.context, corpse, 40, 80, 100, "outline", opacity);
  }
  return { ...render, draw };
}
