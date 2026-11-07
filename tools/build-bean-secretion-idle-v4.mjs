import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = process.cwd(), source = "AnimationCandidates/bean-secretion-idle-v4/";
const metadata = source + "bean-secretion-idle-v4.json", sheet = source + "bean-secretion-idle-v4-sheet.png";
const previewSource = source + "bean-secretion-idle-v4-preview.gif";
const base = resolve(root, "$Trash/assets-three-v43-20261107/bean");
const output = "DesignAssets/Animations/BeanSecretionIdleV4/";
const image = output + "idle.webp", preview = "DesignAssets/Planning/ApprovedAnimations96/bean-secretion-idle-v4.webp";
const approved = JSON.parse(readFileSync(resolve(root, metadata), "utf8"));
const size = 128, ratio = size / approved.frameSize;
const crlf = value => value.replace(/\r?\n/g, "\r\n");
const hash = file => createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex");
if (approved.status !== "user-approved" || approved.candidate || approved.frameCount !== 64 ||
    approved.durationsMs.length !== approved.frameCount || approved.durationsMs.reduce((a, b) => a + b, 0) !== approved.durationMs)
  throw new Error("Invalid approved bean secretion idle metadata");
mkdirSync(resolve(base, "frames"), { recursive: true });
mkdirSync(resolve(root, output), { recursive: true });
mkdirSync(dirname(resolve(root, preview)), { recursive: true });
execFileSync("magick", [resolve(root, sheet), "-crop", `${approved.frameSize}x${approved.frameSize}`, "+repage",
  "-filter", "Lanczos", "-resize", `${size}x${size}!`, resolve(base, "frames/frame-%02d.png")]);
const frames = Array.from({ length: approved.frameCount }, (_, index) => resolve(base, `frames/frame-${String(index).padStart(2, "0")}.png`));
execFileSync("magick", ["montage", ...frames, "-tile", `${approved.columns}x${Math.ceil(approved.frameCount / approved.columns)}`,
  "-geometry", `${size}x${size}+0+0`, "-background", "none", "-define", "webp:lossless=true", resolve(root, image)]);
execFileSync("magick", [resolve(root, previewSource), "-coalesce", "-filter", "Lanczos", "-resize", "96x96",
  "-define", "webp:lossless=true", "-loop", "0", resolve(root, preview)]);
const clip = { image, frameSize: size, viewSize: size, columns: approved.columns, frameCount: approved.frameCount,
  pivotX: approved.pivotX * ratio, pivotY: approved.pivotY * ratio, durationsMs: approved.durationsMs,
  durationMs: approved.durationMs, loop: approved.loop, rangedBody: true, secretionIdle: true, nativeSecretionIdle: true };
const manifest = { source: sheet, sourceSha256: hash(sheet), metadata, metadataSha256: hash(metadata),
  previewSource, previewSourceSha256: hash(previewSource), clip, runtimeSha256: hash(image), preview, previewSha256: hash(preview),
  camera: { uniformScale: ratio, translation: [0, 0], sourceFrameSize: approved.frameSize,
    sourcePivot: [approved.pivotX, approved.pivotY], preservesNeutralCamera: true } };
writeFileSync(resolve(root, "client/bean-secretion-idle-assets.mjs"), crlf("export const BEAN_SECRETION_IDLE_ANIMATION = Object.freeze(" + JSON.stringify(clip, null, 2) + ");\n"));
writeFileSync(resolve(root, output + "manifest.json"), crlf(JSON.stringify(manifest, null, 2) + "\n"));
writeFileSync(resolve(base, "generated.json"), crlf(JSON.stringify(manifest, null, 2) + "\n"));
console.log(JSON.stringify({ image, preview, frameCount: clip.frameCount, durationMs: clip.durationMs }));
