import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const require = createRequire(process.env.USERPROFILE + "/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json");
const sharp = require("sharp");
const output = fileURLToPath(new URL("./", import.meta.url));
const root = resolve(output, "../../../..");
const work = resolve(root, "$Trash/spring-building-flow-20261030");
const manifest = JSON.parse(readFileSync(resolve(work, "manifest.json"), "utf8"));
for (const sequence of Object.values(manifest.sequences)) {
  const kind = sequence.image.split("/").at(-2);
  await sharp(resolve(work, kind, "sheet.png")).webp({ lossless: true, effort: 4 }).toFile(resolve(root, sequence.image));
  const { data, info } = await sharp(resolve(work, kind, "preview.png")).raw().toBuffer({ resolveWithObject: true });
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels, pageHeight: 192 } })
    .webp({ lossless: true, effort: 4, loop: 0, delay: Array(48).fill(100) }).toFile(resolve(root, sequence.preview));
}
const frames = await Promise.all(Array.from({ length: 48 }, (_, index) =>
  sharp(resolve(work, "gallery-" + String(index).padStart(2, "0") + ".png")).raw().toBuffer()));
await sharp(Buffer.concat(frames), { raw: { width: 768, height: 224 * 48, channels: 3, pageHeight: 224 } })
  .webp({ lossless: true, effort: 4, loop: 0, delay: Array(48).fill(100) }).toFile(resolve(output, "overview.webp"));
writeFileSync(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2).replace(/\n/g, "\r\n") + "\r\n");
