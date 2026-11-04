#!/usr/bin/env python3
"""Audit actual indexed harvest/carry/throw sources, without materializing images."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


tracked = subprocess.check_output(["git", "ls-files", "DesignAssets"], cwd=ROOT, text=True).splitlines()
names = [p for p in tracked if re.search(r"(harvest|carry|throw|gather|deliver)", p, re.I)]
report = {"scope": "all indexed DesignAssets paths plus 12 exact legacy tribe/resource preview descriptors and current body registry",
          "newIndependentBodyClipsFound": 0, "indexedNamedCandidates": names, "legacyResourcePreviews": []}
for tribe, folder, resource in [("bean", "sprout", "clay"), ("spore", "spore", "tree"), ("pebble", "pebble", "pebbles"), ("spring", "spring", "dew")]:
    for action in ["harvest", "carry", "throw"]:
        path = f"DesignAssets/Planning/Tribes/{folder}/Previews/Resources/{resource}/{action}.json"
        j = json.loads((ROOT / path).read_text())
        assert j["rendering"] == "runtime-composite" and j["renderer"] == "client/game.js"
        report["legacyResourcePreviews"].append({"tribe": tribe, "action": action, "metadata": path, "metadataHash": sha(path),
            "rendering": j["rendering"], "renderer": j["renderer"], "frameCount": j["frameCount"],
            "sheet": j["sheet"], "resourceImage": j["resourceImage"], "resourceImageHash": sha(j["resourceImage"]),
            "independentNativeBody": False,
            "reason": "Descriptor identifies this as a planning runtime composite with resource props, rather than a source-identical isolated tribe body strip. It cannot be promoted to a native body clip without extracting/changing original pixels."})
report["currentRegistryEvidence"] = [
    {"file": "client/unit-animation.mjs", "symbol": "unitAnimationPose", "finding": "UNIT_ANIMATIONS has no native harvest/carry/throw clip. Harvest/throw can select idle for non-bean attribute rendering; moving carrying units select walk."},
    {"file": "client/attribute-animation.mjs", "symbol": "frame", "finding": "carry uses walk tracks; harvest and throw are parameterized part motion and idle body tracks. Existing parts are source-specific legacy attributes, not independent mask00 native body clips."},
    {"file": "client/game.js", "symbol": "drawAgentCarrying", "finding": "Resource objects and delivery trajectory are drawn separately from the body. Prop/resource images are not unit body motions."}
]
(OUT / "followup-action-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"indexedNamedCandidates": len(names), "legacyRuntimeCompositesRejected": len(report["legacyResourcePreviews"]), "newIndependentBodyClipsFound": 0}))
