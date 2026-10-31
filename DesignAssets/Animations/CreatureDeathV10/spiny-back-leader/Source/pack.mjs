import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire("C:/Users/oojjr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json");
const sharp = require("sharp");
const folder = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keys = ["key-00-neutral.png", "key-01-buckle.png", "key-02-collapse.png"].map(name => resolve(folder, "Source/Keys", name));
const durations = [80, 120, 520];
const prefix = "DesignAssets/Animations/CreatureDeathV10/spiny-back-leader/";

function encode(name, frames, timing, size, repeat) {
  const argumentsList = [];
  for (let index = 0; index < frames.length; index++) argumentsList.push("-delay", timing[index] + "x1000", frames[index]);
  argumentsList.push("-resize", size + "x" + size, "-loop", String(repeat), "-define", "webp:lossless=true", resolve(folder, name));
  const result = spawnSync("magick", argumentsList, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}

if (process.argv.includes("--sample")) {
  encode("representative.webp", keys.slice(1), durations.slice(1), 512, 0);
} else {
  for (const path of keys) {
    const size = await sharp(path).metadata();
    if (size.width !== 512 || size.height !== 512 || !size.hasAlpha) throw new Error("SOURCE CANVAS MISMATCH");
  }
  for (const size of [512, 256]) {
    const images = await Promise.all(keys.map(input => sharp(input).resize(size, size).png().toBuffer()));
    await sharp({ create: { width: size * 3, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(images.map((input, index) => ({ input, left: index * size, top: 0 })))
      .webp({ lossless: true, effort: 4 }).toFile(resolve(folder, size === 512 ? "death.webp" : "runtime.webp"));
  }
  encode("playback.webp", keys, durations, 512, 1);
  encode("preview.webp", keys, [480, 120, 1920], 512, 0);
  encode("thumbnail.webp", keys, durations, 64, 0);
  await sharp(keys[2]).webp({ lossless: true }).toFile(resolve(folder, "dead.webp"));
  copyFileSync(keys[2], resolve(folder, "final.png"));
  const review = await Promise.all(keys.map(input => sharp(input).flatten({ background: "#25332f" }).png().toBuffer()));
  await sharp({ create: { width: 1536, height: 512, channels: 3, background: "#25332f" } })
    .composite(review.map((input, index) => ({ input, left: index * 512, top: 0 })))
    .png().toFile(resolve(folder, "contact.png"));
  const metadata = {
    name: "spiny-back-leader", action: "death",
    sourceImage: "DesignAssets/CreatureConcepts/v3/spiny-back-leader.png",
    image: prefix + "death.webp", frameSize: 512, columns: 3, frameCount: 3,
    durationsMs: durations, durationMs: 720, pivotX: 256, pivotY: 448,
    loop: false, stopOnLastFrame: true, rootMotion: false,
    preview: prefix + "preview.webp", previewDurationsMs: [480, 120, 1920], previewLoop: true,
    playback: prefix + "playback.webp", thumbnail: prefix + "thumbnail.webp",
    runtime: { image: prefix + "runtime.webp", frameSize: 256, viewSize: 256, pivotX: 128, pivotY: 224, columns: 3, durationsMs: durations, loop: false },
    terminalPose: prefix + "dead.webp",
    construction: "Three approved drawn cels, neutral to buckling to forward collapse; no rig, warp, pose blend or opacity transition",
    sourceFrames: keys.map(path => "Source/Keys/" + path.replaceAll("\\", "/").split("/").at(-1)),
    sourceArtwork: "Source/death-keyposes-generated.png",
    sourceAuthoring: "Source/generation.json", renderer: "Source/pack.mjs",
    approvedKeyFrames: [0, 1, 2]
  };
  writeFileSync(resolve(folder, "death.json"), (JSON.stringify(metadata, null, 2) + "\n").replace(/\n/g, "\r\n"), "utf8");
}
