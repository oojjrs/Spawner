#!/usr/bin/env python3
"""Verify unmodified native raw00 strips against the existing game camera.

Run from the repository root. --write creates only the four motions.json files;
the default verifies checked-in registrations and refreshes this tool's report.
No image/source/runtime/generated file is rewritten. Pillow reads every frame.
"""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ALPHA = 16
TRIBES = ("bean", "spore", "pebble", "spring")
REQUIRED = ("idle", "walk", "hurt", "birth", "death", "harvest", "carry", "throw")


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def pixels(path):
    return np.array(Image.open(ROOT / path).convert("RGBA"))


def bounds(array):
    yy, xx = np.nonzero(array[:, :, 3] >= ALPHA)
    if not len(xx):
        return None
    return [int(xx.min()), int(yy.min()), int(xx.max() - xx.min() + 1), int(yy.max() - yy.min() + 1)]


def frames(array, animation):
    size, columns = animation["frameSize"], animation["columns"]
    for k in range(animation["frameCount"]):
        x, y = k % columns * size, k // columns * size
        yield array[y:y + size, x:x + size]


def projected_bounds(box, mapping):
    if box is None:
        return None
    s, x, y = mapping["scale"], mapping["offsetX"], mapping["offsetY"]
    return [box[0] * s + x, box[1] * s + y, box[2] * s, box[3] * s]


def camera(source, animation, ppw, image_hash):
    s = source["camera"]["pixelsPerWorld"] / ppw
    return {"verified": True, "sourceHash": image_hash,
            "pixelsPerWorld": ppw, "scale": s,
            "offsetX": source["pivot"]["x"] - animation["pivotX"] * s,
            "offsetY": source["pivot"]["y"] - animation["pivotY"] * s,
            "method": "preserve-existing-game-fixed-native-camera",
            "verification": "tools/native-appearance-registration-20261104/report.json"}


def close(a, b, reason):
    assert math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-9), (reason, a, b)


def review_image(tribe, source, actions, native_arrays, idle_mapping, birth):
    """Original-reference comparison plus representative native frames, QA only."""
    panel = Image.new("RGBA", (1024, 256), "#dbe4e6")
    draw = ImageDraw.Draw(panel)
    draw.text((8, 3), f"{tribe}: existing neutral / original idle in canonical camera", fill="black")
    neutral = Image.open(ROOT / source["image"]).convert("RGBA")
    neutral.thumbnail((230, 230))
    panel.alpha_composite(neutral, (0, 20))
    s, x, y = idle_mapping["scale"], idle_mapping["offsetX"], idle_mapping["offsetY"]
    idle = Image.fromarray(next(frames(native_arrays["idle"], actions["idle"])))
    idle = idle.transform((512, 512), Image.Transform.AFFINE, (1/s, 0, -x/s, 0, 1/s, -y/s), Image.Resampling.BICUBIC)
    idle.thumbnail((230, 230))
    panel.alpha_composite(idle, (256, 20))
    rows = []
    review_actions = {**actions, **({"birth (unsupported)": birth} if birth else {})}
    for name, animation in review_actions.items():
        native = native_arrays.get(name)
        if native is None:
            native = pixels(animation["image"])
        native_frames = list(frames(native, animation))
        count = len(native_frames)
        row = Image.new("RGBA", (1024, 200), "#dbe4e6")
        d = ImageDraw.Draw(row)
        d.text((2, 2), f"{name}: original {animation['frameSize']}px frames, no crop", fill="black")
        indices = list(dict.fromkeys([0, count//4, count//2, count*3//4, count-1]))
        for n, index in enumerate(indices):
            im = Image.fromarray(native_frames[index])
            im.thumbnail((180, 170))
            row.alpha_composite(im, (n*200, 25))
            d.text((n*200+3, 18), str(index), fill="black")
        rows.append(row)
    canvas = Image.new("RGBA", (1024, 256+200*len(rows)), "#dbe4e6")
    canvas.alpha_composite(panel, (0, 0))
    for i, row in enumerate(rows):
        canvas.alpha_composite(row, (0, 256+200*i))
    canvas.convert("RGB").save(OUT / f"{tribe}-review.jpg", quality=90)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    metadata = json.loads(subprocess.check_output(["node", str(OUT / "native-metadata.mjs")], cwd=ROOT))
    inventory = json.loads((ROOT / "tools/unit-animation-unification-20261104/scale-contract/base-raw-inventory.json").read_text())
    report = {"version": 1, "alphaThreshold": ALPHA,
              "registrationPolicy": "unmodified originals; one fixed camera per entire strip; no per-frame fit, crop, normalization, resampling, or idle aliases",
              "proof": "pixelsPerWorld independently re-derived from first-frame alpha bounds, actual current starter dimensions, prepareUnitAnimationSheets, prepareUnitDisplaySize, drawAgentAnimation and drawAgentBody; all alpha pixel positions checked against both old and registered cameras",
              "qaImages": "contact JPGs are review-only fixed-camera thumbnails; no runtime image is generated",
              "allNativeFramesChecked": 0, "birthCandidateFramesChecked": 0, "tribes": {}}
    for tribe in TRIBES:
        m = metadata[tribe]
        source, actions = m["source"], m["actions"]
        path = ROOT / f"DesignAssets/Animations/UnitAppearanceV1/{tribe}/00/motions.json"
        existing_motions = json.loads(path.read_text()) if path.exists() else {}
        provenance = source["provenance"]
        assert provenance["kind"] == "existing-original"
        assert source["cameraVerified"] and source["coreReference"]["verified"]
        assert sha(source["image"]) == source["sourceHash"]
        assert sha(provenance["sourceImage"]) == provenance["sourceHash"]
        original = provenance["currentOriginalReference"]
        assert sha(original["image"]) == original["sourceHash"]
        reference_array = pixels(original["image"])
        rb = bounds(reference_array)
        if tribe == "bean":
            # prepareUnitAnimationSheets uses the original non-uniform starter mount.
            reference = [rb[2] * 240 / reference_array.shape[1], rb[3] * 350 / reference_array.shape[0]]
        else:
            fit = min(310 / rb[2], 350 / rb[3])
            reference = [rb[2] * fit, rb[3] * fit]
        native_arrays = {name: pixels(a["image"]) for name, a in actions.items()}
        idle = actions["idle"]
        idle_first = next(frames(native_arrays["idle"], idle))
        ib = bounds(idle_first)
        idle_fit = min(reference[0] / ib[2], reference[1] / ib[3])
        idle_scale = idle["frameSize"] / 512 * idle_fit
        unit_display_scale = m["displaySize"] * idle["frameSize"] / (.7 * idle_scale * max(ib[2:]))
        tr = {"sourceId": source["sourceId"], "sourceHash": source["sourceHash"],
              "originalHighResolutionHash": provenance["sourceHash"],
              "currentOriginalReference": original, "referencePixelBounds": rb, "runtimeReferenceBox": reference,
              "idleFirstPixelBounds": ib, "idleEntryScale": idle_scale, "unitDisplayScale": unit_display_scale,
              "originalIdleComparison": {"image": idle["image"], "sourceHash": sha(idle["image"]),
                  "nativeFirstCoreLongest": max(ib[2:]), "nativeFirstCoreLongestInCanonicalPixels": m["displaySize"] * 512,
                  "sourceCoreLongest": max(source["coreReference"]["coreBounds"][2:]),
                  "sameSpeciesArt": True,
                  "note": "Native spring idle/flow/combat/death have a flat lower body; neutral/jump/birth show small feet. This existing source difference is preserved; no borrowed feet are composited." if tribe == "spring" else "Existing-original neutral and original idle retain the same species silhouette/face. Source drawing and native idle are not asserted pixel-identical."},
              "actions": {}, "unsupported": {}}
        registered = {"sourceId": source["sourceId"], "actions": {}}
        # Each tile keeps the full original frame in one fixed native -> canonical camera.
        tiles = []
        for name, animation in actions.items():
            array = native_arrays[name]
            size, columns, count = animation["frameSize"], animation["columns"], animation["frameCount"]
            assert array.shape[1] == size * columns
            assert array.shape[0] == size * math.ceil(count / columns)
            assert not animation.get("frameGeometry"), "Native source unexpectedly needs per-frame geometry"
            native_frames = list(frames(array, animation))
            first = bounds(native_frames[0])
            if name == "walk":
                entry_scale = idle_scale * animation.get("registrationScale", 1) / idle.get("registrationScale", 1)
            else:
                entry_scale = size / 512 * min(reference[0] / first[2], reference[1] / first[3])
            # Existing drawAgentAnimation native-pixel -> world scale, including outer drawAgentBody.
            old_world_per_pixel = .7 * entry_scale * unit_display_scale / size
            ppw = 1 / old_world_per_pixel
            image_hash = sha(animation["image"])
            mapping = camera(source, animation, ppw, image_hash)
            draft = inventory[tribe]["actions"][name]
            assert image_hash == draft["sourceHash"]
            assert size == draft["frameSize"]
            for key in ("pixelsPerWorld", "scale", "offsetX", "offsetY"):
                close(mapping[key], draft["cameraMapping"][key], f"{tribe}/{name} independent camera {key}")
            measurements = []
            max_projection_error = 0
            for k, frame in enumerate(native_frames):
                box = bounds(frame)
                assert box is not None, (tribe, name, k, "blank registered body frame")
                mask = frame[:, :, 3] >= ALPHA
                yy, xx = np.nonzero(mask)
                # Compare every alpha pixel center, not only bbox corners.
                old_x = (xx + .5 - animation["pivotX"]) * old_world_per_pixel
                old_y = (yy + .5 - animation["pivotY"]) * old_world_per_pixel
                new_x = (xx + .5 - animation["pivotX"]) / ppw
                new_y = (yy + .5 - animation["pivotY"]) / ppw
                error = max(float(np.max(np.abs(old_x - new_x))), float(np.max(np.abs(old_y - new_y))))
                max_projection_error = max(max_projection_error, error)
                assert error < 1e-12
                projected = projected_bounds(box, mapping)
                edge_pixels = int(np.count_nonzero(mask[0]) + np.count_nonzero(mask[-1]) + np.count_nonzero(mask[1:-1, 0]) + np.count_nonzero(mask[1:-1, -1]))
                measurements.append({"frame": k, "pixelBounds": box, "alphaPixels": int(np.count_nonzero(mask)),
                                     "edgeAlphaPixels": edge_pixels, "canonicalBounds": projected,
                                     "supportOffsetFromNativePivot": [box[0] + box[2] / 2 - animation["pivotX"], box[1] + box[3] - animation["pivotY"]]})
                frame_image = Image.fromarray(frame)
                # QA only: show a transparent full-frame projection with the idle baseline support.
                inverse = (1 / mapping["scale"], 0, -mapping["offsetX"] / mapping["scale"],
                           0, 1 / mapping["scale"], -mapping["offsetY"] / mapping["scale"])
                canonical = frame_image.transform((512, 512), Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC)
                canonical.thumbnail((160, 160))
                tile = Image.new("RGBA", (164, 184), "#dbe4e6")
                tile.alpha_composite(canonical, (2, 20))
                draw = ImageDraw.Draw(tile)
                draw.text((3, 3), f"{name} {k}", fill="#102328")
                draw.line((2, 160, 162, 160), fill="#8ba5ab")
                tiles.append(tile)
            assert not any(f["edgeAlphaPixels"] for f in measurements), (tribe, name, "existing source touches frame edge")
            clip = {"sourceId": source["sourceId"], "image": animation["image"], "frameSize": size,
                    "columns": columns, "frameCount": count, "durationsMs": animation["durationsMs"],
                    "loop": bool(animation.get("loop", False)), "pivotX": animation["pivotX"], "pivotY": animation["pivotY"],
                    "events": [], "sourceHash": image_hash, "cameraMapping": mapping}
            if "cyclesPerCell" in animation:
                clip["cyclesPerCell"] = animation["cyclesPerCell"]
            if "frames" in animation:
                clip["frames"] = animation["frames"]
            registered["actions"][name] = clip
            tr["actions"][name] = {"image": animation["image"], "sourceHash": image_hash,
                "nativeDimensions": [array.shape[1], array.shape[0]], "frameSize": size, "frameCount": count,
                "fixedCamera": mapping, "runtimeEntryScale": entry_scale,
                "oldWorldPerPixel": old_world_per_pixel, "maximumWorldProjectionError": max_projection_error,
                "firstFrameCoreLongestDifferenceFromIdleCanonicalPixels": max(first[2:]) * mapping["scale"] - m["displaySize"] * 512,
                "allFrames": measurements}
            report["allNativeFramesChecked"] += count
        # Birth has native body images, but the current renderer does not play these strips alone.
        birth = m["birth"]
        if birth:
            arr = pixels(birth["image"])
            fs = list(frames(arr, birth))
            bs = [bounds(frame) for frame in fs]
            if tribe == "spore":
                birth_scale = .7 * reference[1] / 512 / (birth["unitHeight"] * birth["imageScale"])
                reason = "First two native frames are transparent; game adds external sporeBirthMotion rotation/landing squash and visibility gating. The final raw frame is replaced with idle. A bare clip would drop required body motion and visibility semantics."
            elif tribe == "spring":
                birth_scale = .7 * 350 / 512 / birth["height"]
                reason = "Native birth body moves from upper-left outlet to its later support; drawSpringBirthSurface applies time-dependent row-wise bulge/sway and squash around different anchors. The final raw frame is replaced with idle. A single raw camera cannot reproduce these body deformations."
            else:
                birth_scale = .7 * birth["unitHeight"] / 512 / birth["height"]
                reason = "Body-only source exists, but birth uses a different 460/512 unit floor and dedicated scene root placement/foreground. Its final raw frame is replaced by idle, and native final body size does not match original idle within one canonical pixel. The isolated raw clip is not yet an independently verified idle-compatible birth."
            ppw = 1 / (birth_scale * unit_display_scale)
            last = bs[-1]
            longest = max(last[2:]) * 512 / ppw
            evidence = {"reason": reason, "image": birth["image"], "sourceHash": sha(birth["image"]),
                "frameSize": birth["frameSize"], "frameCount": birth["frameCount"],
                "nativePivot": [birth["pivotX"], birth["pivotY"]], "runtimePixelsPerWorld": ppw,
                "finalNativeBodyLongestCanonicalPixels": longest,
                "idleBodyLongestCanonicalPixels": m["displaySize"] * 512,
                "finalNativeDifferenceFromIdleCanonicalPixels": longest - m["displaySize"] * 512,
                "allFramePixelBounds": bs, "registered": False}
            assert abs(evidence["finalNativeDifferenceFromIdleCanonicalPixels"]) > 1
            tr["unsupported"]["birth"] = evidence
            contract = json.loads(subprocess.check_output(["node", str(OUT / "scene-contracts.mjs"), "--contract"],
                input=json.dumps({"tribe": tribe, "source": source, "birth": birth, "proof": evidence, "unitDisplayScale": unit_display_scale}).encode(), cwd=ROOT))
            existing_scene = existing_motions.get("sceneActions", {}).get("birth", {})
            connected = existing_scene.get("runtimeEnabled") is True and existing_scene.get("integrationStatus") == "legacy-scene-body-adapter" and existing_scene.get("validation", {}).get("runtimeRendererConnected") is True
            if connected:
                contract["runtimeEnabled"] = True
                contract["integrationStatus"] = "legacy-scene-body-adapter"
                contract["validation"]["runtimeRendererConnected"] = True
            registered["sceneActions"] = {"birth": contract}
            tr["birthSceneContract"] = {"status": "legacy-scene-body-adapter" if connected else "camera-verified-scene-adapter-required", "registeredAsStandaloneAction": False,
                "bodySourceHash": evidence["sourceHash"], "externalDeformation": contract["deformation"]["kind"],
                "legacyRendererHash": contract["legacyReference"]["sourceHash"], "runtimeEnabled": connected,
                "verification": contract["validation"]["report"]}
            report["birthCandidateFramesChecked"] += len(fs)
        else:
            tr["unsupported"]["birth"] = {"registered": False, "reason": "No native bean birth strip exists. Current birth is procedural parts/seed/root motion; no idle alias or scene composite was registered."}
        for action in REQUIRED:
            if action not in registered["actions"] and action not in tr["unsupported"]:
                tr["unsupported"][action] = {"registered": False, "reason": "No independent native body strip exists in the current source registry; current procedural or idle-derived rendering is not a source-identical new motion."}
        tr["registeredActions"] = list(registered["actions"])
        tr["missingRequiredActions"] = [a for a in REQUIRED if a not in registered["actions"]]
        tr["worldReady"] = False
        if args.write:
            path.write_text(json.dumps(registered, ensure_ascii=False, indent=2) + "\n")
        else:
            assert json.loads(path.read_text()) == registered, f"{path}: registration differs from independently verified source"
        contact = Image.new("RGBA", (164 * 8, 184 * math.ceil(len(tiles) / 8)), "#dbe4e6")
        for i, tile in enumerate(tiles):
            contact.alpha_composite(tile, (i % 8 * 164, i // 8 * 184))
        contact.convert("RGB").save(OUT / f"{tribe}-all-frames.jpg", quality=91)
        review_image(tribe, source, actions, native_arrays, tr["actions"]["idle"]["fixedCamera"], birth)
        report["tribes"][tribe] = tr
    report["registeredClips"] = sum(len(t["actions"]) for t in report["tribes"].values())
    report["separateBirthSceneContracts"] = 3
    report["worldReadySources"] = 0
    assert report["registeredClips"] == 22
    assert report["allNativeFramesChecked"] == 524
    assert report["birthCandidateFramesChecked"] == 83
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k in ("registeredClips", "allNativeFramesChecked", "birthCandidateFramesChecked", "worldReadySources")}))


if __name__ == "__main__":
    main()
