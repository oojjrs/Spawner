"""Verify the current built runtime on mobile and desktop Chromium.

Controls roster, animation clock and fault injection only. Does not replace
runtime helpers. Browser execution has NOT completed in the restricted runner.
"""
import functools
import http.server
import json
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).with_name("report.json")
PORT = 14219


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            self.path = "/Spawner.html"
        data = None
        if path == "/client/welcome-header.js":
            text = (ROOT / "client/welcome-header.js").read_text()
            text = text.replace(
                "  const nextChoice = globalThis.Spawner.createWelcomeRoster(tribes, neutralSpecies, appearances.length);",
                """  const originalNextChoice = globalThis.Spawner.createWelcomeRoster(tribes, neutralSpecies, appearances.length);
  let qaIndex = 0;
  const qaChoices = [...tribes.map(key => ({key, variant:0})), {key:'pebble',variant:2},
    ...tribes.flatMap(key => [0,1,2,3].map(variant => ({key,variant}))), ...neutralSpecies.map(key => ({key,variant:0}))];
  const nextChoice = () => qaChoices[qaIndex++] || originalNextChoice();""",
            )
            text = text.replace("  function draw(motion) {", """  function draw(motion) {
    window.__welcomeState = { key:current.key, variant:current.variant, phase, elapsed, number:appearanceNumber, ready:upcoming?.ready };
    if (phase === 'rest' || phase === 'perform') {
      window.__welcomeSeen ||= [];
      const identity = current.key+':'+current.variant;
      if (__welcomeSeen.at(-1) !== identity) __welcomeSeen.push(identity);
    }"""
            )
            text = text.replace("    context.drawImage(customized || source,", """    if (window.__qaFault === 'rig' && current.key === 'pebble' && current.variant === 2 && !window.__faultRaised) {
      window.__faultRaised = true; throw new Error('QA first rig draw failure');
    }
    context.drawImage(customized || source,"""
            )
            text = text.replace("    context.drawImage(source, frame % animation.columns", """    if (window.__qaFault === 'neutral' && current.key === 'spring-keeper' && !window.__faultRaised) {
      window.__faultRaised = true; throw new Error('QA neutral draw failure');
    }
    context.drawImage(source, frame % animation.columns"""
            )
            text = text.replace("  prepareUpcoming();\n  synchronize();", """  window.__welcomeCache = tribeArt.animationCacheStats;
  window.__welcomeLoaded = true;
  prepareUpcoming();
  synchronize();"""
            )
            data = text.encode()
        if data is not None:
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()


def run(browser, scenario, viewport):
    page = browser.new_page(viewport=viewport, is_mobile=viewport["width"] < 600, has_touch=viewport["width"] < 600)
    errors, warnings = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: warnings.append(message.text) if message.type == "warning" else None)
    page.add_init_script("""window.__frames=new Map();let id=0;
      window.requestAnimationFrame=f=>{__frames.set(++id,f);return id};
      window.cancelAnimationFrame=i=>__frames.delete(i);
      window.__clock=0;
      window.__step=dt=>{__clock+=dt;let fs=[...__frames.values()];__frames.clear();for(let f of fs)f(__clock);return window.__welcomeState};
    """ + "window.__qaFault=" + json.dumps(scenario) + ";")
    page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
    page.locator("#entry-button").click()
    for _ in range(1200):
        page.evaluate("__step(16)")
        if page.evaluate("Boolean(window.__welcomeLoaded)") and page.locator("#welcome").get_attribute("aria-busy") == "false":
            break
        page.wait_for_timeout(100)
    else:
        raise RuntimeError("Welcome boot timed out: " + str(errors))
    for index in range(5000):
        state = page.evaluate("__step(1000)")
        seen = page.evaluate("window.__welcomeSeen || []")
        if scenario == "normal" and len(set(seen)) == 35 and len(seen) >= 40:
            break
        if scenario == "rig" and page.evaluate("Boolean(window.__faultRaised)") and state["number"] >= 7:
            break
        if scenario == "neutral" and page.evaluate("Boolean(window.__faultRaised)") and state["key"] == "lantern-keeper" and state["phase"] == "rest":
            break
        if index % 10 == 0:
            page.wait_for_timeout(5)
    else:
        raise RuntimeError(f"Scenario stalled: {scenario} {state}")
    assert not errors, errors
    assert seen[:4] == ["bean:0","spore:0","pebble:0","spring:0"], seen[:4]
    if scenario == "normal":
        assert seen[4] == "pebble:2", seen[:5]
        assert len(set(seen)) == 35, seen
    else:
        assert page.evaluate("Boolean(window.__faultRaised)")
        assert any("Welcome pose unavailable:" in warning for warning in warnings), warnings
    if scenario == "rig":
        assert "pebble:0" in seen[4:6], seen[:7]
    cache = page.evaluate("__welcomeCache()")
    assert cache["pixels"] <= cache["pixelBudget"], cache
    page.screenshot(path=str(OUT.parent / f"{viewport['width']}-{scenario}.png"))
    result = {"viewport": viewport, "scenario":scenario, "state":state, "seen":seen, "uniqueAppearances":len(set(seen)), "errors":errors,
              "expectedDrawWarnings":[value for value in warnings if "Welcome pose unavailable:" in value], "cache":cache}
    print(json.dumps(result, ensure_ascii=False), flush=True)
    page.close()
    return result


server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                             args=["--no-sandbox","--disable-dev-shm-usage"])
        result = {"normalRoster":"first four then antenna-pebble then all 35 exact identities",
                  "runtimeSourceHelperInjected":False, "scenarios":[run(browser, name, viewport) for viewport in [{"width":390,"height":844},{"width":1440,"height":1000}] for name in ["normal","rig","neutral"]]}
        OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n")
        browser.close()
finally:
    server.shutdown()
