#!/usr/bin/env python3
"""Pixel-compare the proposed scene contract with current game birth body renderers."""
import functools
import base64
import http.server
import json
import subprocess
import threading
import hashlib
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SCRATCH = Path('/tmp/spawner-native-registration-debug')


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


subprocess.run(["node", str(OUT / "scene-contracts.mjs")], cwd=ROOT, check=True)
subprocess.run(["node", str(OUT / "scene-contracts.mjs"), "--capture-current-adapter"], cwd=ROOT, check=True)
(OUT / "qa-native-metadata.json").write_bytes(subprocess.check_output(["node", str(OUT / "native-metadata.mjs")], cwd=ROOT))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1050, "height": 540})
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(f"http://127.0.0.1:{server.server_port}/tools/native-appearance-registration-20261104/scene-render-qa.html", wait_until="networkidle")
        page.wait_for_function("window.qaReady === true", timeout=30000)
        report = page.evaluate("window.runNativeBirthSceneQA()")
        if report["failures"]:
            captures = page.evaluate("window.firstFailureFrames")
            SCRATCH.mkdir(exist_ok=True)
            for name, data in captures.items():
                (SCRATCH / f"scene-failure-{name}.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
        report["pageErrors"] = page_errors
        report["runtimeHelper"] = "client/unit-appearance-birth-scene.mjs"
        report["runtimeHelperHash"] = hashlib.sha256((ROOT / report["runtimeHelper"]).read_bytes()).hexdigest()
        report["outerDisplayScaleProfiles"] = ["helper-applies-existing-outer-scale", "caller-already-applied-outer-scale"]
        report["compiledAppearanceRuntimeHash"] = hashlib.sha256((ROOT / "client/unit-appearance-preview-runtime.js").read_bytes()).hexdigest()
        current_functions = json.loads((OUT / "current-body-adapter.json").read_text())
        for tribe, entry in report["tribes"].items():
            motion_path = f"DesignAssets/Animations/UnitAppearanceV1/{tribe}/00/motions.json"
            contract = json.loads((ROOT / motion_path).read_text())["sceneActions"]["birth"]
            entry["motionsFileHash"] = hashlib.sha256((ROOT / motion_path).read_bytes()).hexdigest()
            entry["bodySourceHash"] = contract["body"]["sourceHash"]
            entry["legacyRendererHash"] = contract["legacyReference"]["sourceHash"]
            function_name = f"draw{tribe.title()}Birth"
            entry["currentIntegrationFunctionHash"] = hashlib.sha256(current_functions[function_name].encode()).hexdigest()
        (OUT / "scene-render-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        browser.close()
    assert not report["pageErrors"], report["pageErrors"]
    assert not report["failures"], report["failures"][:10]
    assert not report["currentIntegration"]["failures"], report["currentIntegration"]["failures"][:10]
    print(json.dumps({k: report[k] for k in ["samples", "changedPixels", "maxChannelError", "handoffs", "hiddenFrames"]}))
finally:
    server.shutdown()
