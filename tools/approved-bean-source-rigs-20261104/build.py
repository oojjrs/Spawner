#!/usr/bin/env python3
"""Build additive, source-preserving bind surfaces for the approved bean family.

No action clips, segmentation guesses, painted pixels, texture atlases, or changes
to source/motions metadata are made here. A bound surface is intentionally one
rigid integrated drawing until its visible parts can be annotated honestly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FAMILY = ROOT / "DesignAssets/Animations/UnitAppearanceV1/bean"
REQUIRED_ACTIONS = ["idle", "walk", "hurt", "birth", "death", "harvest", "carry", "throw", "attack", "ranged"]
SCHEMA = "spawner.source-surface-bind.v1"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value) -> str:
    return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def spans_for(mask: np.ndarray) -> list[list[int]]:
    """Half-open runs of *all* nonzero RGBA pixels, including hidden RGB if any."""
    result = []
    for y, row in enumerate(mask):
        edges = np.diff(np.pad(row.astype(np.int8), (1, 1)))
        result.extend([y, int(a), int(b)] for a, b in zip(np.where(edges == 1)[0], np.where(edges == -1)[0]))
    return result


def mesh_for(rgba: np.ndarray, landmarks: dict) -> dict:
    """Source-specific triangle coverage; UVs are source-pixel positions / 512.

    The mesh is a bind resource, not permission to bend hard source details.
    Every vertex belongs to the same rigid integrated source; semantic feature
    separation remains explicitly unresolved. Registered anchors are exact
    vertices rather than rounded grid approximations.
    """
    visible = rgba[:, :, 3] > 0
    yy, xx = np.where(visible)
    x0, x1, y0, y1 = int(xx.min()), int(xx.max()) + 1, int(yy.min()), int(yy.max()) + 1
    anchor_points = {key: list(landmarks[key]) for key in ("leftEye", "rightEye", "faceMidpoint", "supportPoint")}
    sx, sy, sw, sh = landmarks["supportPixelBounds"]
    xs = {float(x0), float(x1), *map(float, range(((x0 // 16) + 1) * 16, x1, 16))}
    ys = {float(y0), float(y1), *map(float, range(((y0 // 16) + 1) * 16, y1, 16))}
    for x, y in anchor_points.values():
        xs.add(float(x)); ys.add(float(y))
    xs.update([float(sx), float(sx + sw)])
    ys.update([float(sy), float(sy + sh)])
    xs, ys = sorted(xs), sorted(ys)
    vertices, lookup, triangles = [], {}, []

    def vertex(x, y):
        point = (x, y)
        if point not in lookup:
            lookup[point] = len(vertices)
            vertices.append([x, y])
        return lookup[point]

    for ya, yb in zip(ys, ys[1:]):
        for xa, xb in zip(xs, xs[1:]):
            # A visible source pixel has extent [x,x+1) x [y,y+1).
            if not visible[max(0, int(np.floor(ya))):min(512, int(np.ceil(yb))),
                           max(0, int(np.floor(xa))):min(512, int(np.ceil(xb)))].any():
                continue
            a, b, c, d = [vertex(x, y) for x, y in [(xa, ya), (xb, ya), (xb, yb), (xa, yb)]]
            triangles.extend([[a, b, c], [a, c, d]])
    anchors = {name: vertex(*point) for name, point in anchor_points.items()}
    return {
        "kind": "visible-source-surface",
        "positions": vertices,
        "uvRule": "[position.x/frameWidth,position.y/frameHeight]",
        "triangles": triangles,
        "anchorVertexIndices": anchors,
        "bindTransform": [1, 0, 0, 1, 0, 0],
        "vertexBinding": {"bone": "integrated-source", "weight": 1},
        "deformationEnabled": False,
        "sampling": "source-pixel-centers; pixel runs are authoritative for lossless neutral reconstruction",
    }


def build_rig(mask: int) -> tuple[dict, dict]:
    name = f"{mask:02x}"
    metadata_path = FAMILY / name / "source.json"
    metadata_bytes = metadata_path.read_bytes()
    source = json.loads(metadata_bytes)
    image_path = ROOT / source["image"]
    image_bytes = image_path.read_bytes()
    image = Image.open(image_path).convert("RGBA")
    rgba = np.array(image)
    assert source["approvalState"] == "approved", f"{name}: not approved"
    assert source.get("cameraVerified") and source["coreReference"]["verified"], f"{name}: unverified camera"
    assert source["sourceHash"] == sha(image_bytes), f"{name}: stale source hash"
    assert image.size == (512, 512) and source["camera"] == {"pixelsPerWorld": 512}
    assert source["pivot"] == {"x": 256, "y": 448}
    landmarks = source["coreReference"]["landmarks"]
    runs = spans_for(np.any(rgba != 0, axis=2))
    mesh = mesh_for(rgba, landmarks)
    rig = {
        "schema": SCHEMA,
        "tribe": "bean", "mask": mask,
        "sourceId": source["sourceId"], "sourceHash": source["sourceHash"],
        "sourceImage": source["image"],
        "sourceMetadata": relative(metadata_path), "sourceMetadataSha256": sha(metadata_bytes),
        "sourceRgbaSha256": sha(rgba.tobytes()),
        "approvalState": source["approvalState"], "approvalRef": source["approvalRef"],
        "provenance": source["provenance"],
        "frameSize": [512, 512], "camera": source["camera"], "pivot": source["pivot"],
        "landmarks": landmarks,
        "bones": [
            {"id": "support", "parent": None, "position": landmarks["supportPoint"], "pinned": True,
             "scope": "recorded support landmark; contact footprint is not independently segmented"},
            {"id": "integrated-source", "parent": "support", "position": landmarks["faceMidpoint"],
             "transformPolicy": "rigid-only", "independentParts": False},
        ],
        "attachments": [
            {"id": name_, "bone": "integrated-source", "position": landmarks[name_], "kind": "recorded-visible-landmark"}
            for name_ in ["leftEye", "rightEye", "faceMidpoint"]
        ],
        "featureBindings": [
            {"id": feature, "bone": "integrated-source", "sourceImage": source["image"],
             "segmentation": "unsegmented-integrated-source", "transformPolicy": "rigid-only",
             "independentMotion": False, "hiddenSurfaceInvented": False}
            for feature in ["innate-leaves", "eyes", *source["visualBits"]]
        ],
        "surface": {"texture": source["image"], "coverageEncoding": "row-runs-y-xStart-xEndExclusive",
                    "coverageRuns": runs, "pixelOwnership": "exactly-once", "hiddenSurfacePixels": 0},
        "mesh": mesh,
        "bind": {"reconstruct": "copy each owned RGBA source pixel to its unchanged source coordinate",
                 "resampling": False, "cameraTransform": "identity", "rootTransform": "identity"},
        "readiness": {"bindReady": True, "actionClipsAdded": [], "worldReady": False,
                      "unsupportedActions": REQUIRED_ACTIONS,
                      "note": "Source-surface preparation only. No action readiness is inferred from a bind rig."},
        "limitations": [
            "One exact whole-body source; no other mask body or texture is referenced.",
            "No missing body surface, isolated limb or occluded joint has been painted or inferred.",
            "The support anchor is fixed; individual foot contacts need source-specific part annotation before walking.",
            "Hard elements and eyes remain attached to one rigid integrated surface; mesh deformation is disabled.",
        ],
    }
    evidence = validate_rig(rig, source, rgba, metadata_bytes, image_bytes)
    return rig, evidence


def validate_rig(rig: dict, source: dict, rgba: np.ndarray, metadata_bytes: bytes, image_bytes: bytes) -> dict:
    """Independent decoder, coverage, landmark and topology checks."""
    reconstructed = np.zeros_like(rgba)
    ownership = np.zeros(rgba.shape[:2], dtype=np.uint16)
    for y, x0, x1 in rig["surface"]["coverageRuns"]:
        assert 0 <= y < 512 and 0 <= x0 < x1 <= 512
        ownership[y, x0:x1] += 1
        reconstructed[y, x0:x1] = rgba[y, x0:x1]
    needed = np.any(rgba != 0, axis=2)
    assert np.all(ownership[needed] == 1), "missing or overlapping source pixels"
    assert np.all(ownership[~needed] == 0), "unexpected source pixel ownership"
    delta = np.abs(reconstructed.astype(np.int16) - rgba.astype(np.int16))
    assert not delta.any(), "nonzero neutral reconstruction error"
    vertices = np.asarray(rig["mesh"]["positions"])
    triangles = np.asarray(rig["mesh"]["triangles"])
    assert triangles.min() >= 0 and triangles.max() < len(vertices)
    a, b, c = (vertices[triangles[:, i]] for i in range(3))
    cross = (b[:, 0]-a[:, 0])*(c[:, 1]-a[:, 1])-(b[:, 1]-a[:, 1])*(c[:, 0]-a[:, 0])
    assert np.all(cross > 0), "degenerate or reversed triangle"
    # All source pixel centers must fall inside at least one triangle. This
    # verifies actual geometry, not just the authoritative row-run decoder.
    covered = np.zeros((512, 512), dtype=bool)
    for triangle in vertices[triangles]:
        left, top = np.floor(triangle.min(axis=0)).astype(int)
        right, bottom = np.ceil(triangle.max(axis=0)).astype(int)
        left, top, right, bottom = max(0, left), max(0, top), min(512, right), min(512, bottom)
        yy, xx = np.mgrid[top:bottom, left:right]
        px, py = xx + .5, yy + .5
        inside = np.ones(xx.shape, dtype=bool)
        for start, end in zip(triangle, np.roll(triangle, -1, axis=0)):
            inside &= (end[0]-start[0])*(py-start[1])-(end[1]-start[1])*(px-start[0]) >= -1e-8
        covered[top:bottom, left:right] |= inside
    assert np.all(covered[rgba[:, :, 3] > 0]), "mesh misses visible source pixel centers"
    anchors = rig["mesh"]["anchorVertexIndices"]
    for key, index in anchors.items():
        assert list(vertices[index]) == source["coreReference"]["landmarks"][key]
    assert rig["approvalRef"] == source["approvalRef"] and rig["provenance"] == source["provenance"]
    assert rig["camera"] == source["camera"] and rig["pivot"] == source["pivot"]
    assert rig["sourceHash"] == sha(image_bytes) and rig["sourceMetadataSha256"] == sha(metadata_bytes)
    return {
        "sourceId": rig["sourceId"], "mask": rig["mask"],
        "sourceHash": sha(image_bytes), "sourceMetadataSha256": sha(metadata_bytes),
        "sourceRgbaSha256": sha(rgba.tobytes()),
        "reconstructionRgbaSha256": sha(reconstructed.tobytes()),
        "neutralRgbaMaxError": int(delta.max()), "differentRgbaValues": int(np.count_nonzero(delta)),
        "visiblePixels": int(np.count_nonzero(rgba[:, :, 3])),
        "hiddenRgbPixels": int(np.count_nonzero(np.any(rgba[:, :, :3] != 0, axis=2) & (rgba[:, :, 3] == 0))),
        "ownedPixels": int(np.count_nonzero(ownership)), "overlapPixels": int(np.count_nonzero(ownership > 1)),
        "missingVisiblePixels": int(np.count_nonzero((rgba[:, :, 3] > 0) & ~covered)),
        "coverageRuns": len(rig["surface"]["coverageRuns"]),
        "meshVertices": len(vertices), "meshTriangles": len(triangles),
        "anchorErrorPixels": 0, "cameraPreserved": True, "approvalAndProvenancePreserved": True,
    }


def contact_sheet(entries: list[dict]) -> None:
    # A review artifact only: each complete 512 camera is shown at half size.
    # No cropped/enlarged unit textures are added.
    sheet = Image.new("RGB", (8*256, 4*286), "#19251e")
    draw = ImageDraw.Draw(sheet)
    for entry in entries:
        mask = entry["mask"]
        x, y = (mask % 8)*256, (mask // 8)*286
        source = json.loads((FAMILY/f"{mask:02x}"/"source.json").read_text())
        image = Image.open(ROOT/source["image"]).convert("RGBA")
        image = image.resize((256, 256), Image.Resampling.LANCZOS)
        sheet.paste(image, (x,y), image)
        sx, sy = source["coreReference"]["landmarks"]["supportPoint"]
        draw.line((x, y+224, x+255, y+224), fill="#49634e")
        draw.ellipse((x+sx/2-2,y+sy/2-2,x+sx/2+2,y+sy/2+2),fill="#ff8d68")
        for point in ["leftEye", "rightEye"]:
            ex,ey=source["coreReference"]["landmarks"][point]
            draw.ellipse((x+ex/2-1.5,y+ey/2-1.5,x+ex/2+1.5,y+ey/2+1.5),fill="#83d6ff")
        draw.text((x+8,y+260),f"bean {mask:02x} | bind error 0 | source-specific",fill="#e4eddd")
    sheet.save(HERE/"bind-contact-32.png", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate checked-in rigs/reports without writing")
    args = parser.parse_args()
    preserved = FAMILY/"1f/Rig/rig.json"
    preserved_hash = sha(preserved.read_bytes())
    entries, results = [], []
    for mask in range(32):
        rig, evidence = build_rig(mask)
        # Keep the previously verified representative and all its parts intact.
        path = (FAMILY/f"{mask:02x}"/"Rig/source-bind.json") if mask != 31 else HERE/"representative-1f-source-bind.json"
        if args.check:
            existing = json.loads(path.read_text())
            assert existing == rig, f"{relative(path)} differs; rebuild explicitly"
        else:
            write_json(path, rig)
        entry = {"mask": mask, "sourceId": rig["sourceId"], "sourceHash": rig["sourceHash"],
                 "sourceMetadataSha256": rig["sourceMetadataSha256"], "rig": relative(path),
                 "role": "additive-source-bind" if mask != 31 else "validation-companion-preserves-existing-rig"}
        entries.append(entry); results.append(evidence)
    assert sha(preserved.read_bytes()) == preserved_hash, "existing representative was modified"
    for entry in entries:
        metadata_path = FAMILY/f"{entry['mask']:02x}"/"source.json"
        assert sha(metadata_path.read_bytes()) == entry["sourceMetadataSha256"], "source metadata was modified"
        source = json.loads(metadata_path.read_bytes())
        assert sha((ROOT/source["image"]).read_bytes()) == entry["sourceHash"], "source texture was modified"
    report = {
        "schema": "spawner.approved-bean-bind-report.v1", "sourceCount": 32,
        "approvedSourceCount": 32, "newPerMaskRigCount": 31,
        "representative1f": {"path": relative(preserved), "sha256": preserved_hash, "modified": False,
                             "companionPurpose": "lossless source-surface validation; does not replace the existing segmented action rig"},
        "allSourceHashesUnique": len({entry["sourceHash"] for entry in entries}) == 32,
        "familySourceDigest": canonical([[e["mask"], e["sourceId"], e["sourceHash"]] for e in entries]),
        "familyMetadataDigest": canonical([[e["mask"], e["sourceMetadataSha256"]] for e in entries]),
        "neutralReconstruction": {"method": "independent row-run decoder copying exact RGBA bytes from each own original",
                                  "sourceCount": 32, "maxRgbaError": max(r["neutralRgbaMaxError"] for r in results),
                                  "differentRgbaValues": sum(r["differentRgbaValues"] for r in results)},
        "bindAnchorsExact": True, "cameraAndProvenancePreserved": True,
        "newTextureOrAtlasCount": 0, "actionClipsAdded": 0, "newWorldReadyEntries": 0,
        "diagnosticOnly": "Preview can rigidly lean the complete source about its registered support point. It is not an idle/hurt clip or validated foot contact motion.",
        "remaining": ["source-specific visible part/joint annotation", "hidden-surface review where separation reveals missing art",
                      "idle/hurt and remaining required action production", "contact and silhouette review at game scale", "world registration after required action set passes"],
        "sources": results,
    }
    manifest = {"schema": SCHEMA, "entries": entries, "report": relative(HERE/"report.json")}
    if args.check:
        assert json.loads((HERE/"report.json").read_text()) == report, "report is stale"
        assert json.loads((HERE/"manifest.json").read_text()) == manifest, "manifest is stale"
    else:
        write_json(HERE/"report.json", report); write_json(HERE/"manifest.json", manifest)
        contact_sheet(entries)
    print(json.dumps({"mode": "check" if args.check else "build", "sources": 32,
                      "newRigs": 31, "neutralMaxError": 0, "sourceDigest": report["familySourceDigest"],
                      "preserved1fRigSha256": preserved_hash}))


if __name__ == "__main__":
    main()
