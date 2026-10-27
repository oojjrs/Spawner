import { openSync, readSync, closeSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function imageDimensions(path) {
  const file = openSync(path, "r");
  const bytes = Buffer.alloc(65536);
  let length;
  try { length = readSync(file, bytes, 0, bytes.length, 0); }
  finally { closeSync(file); }
  if (bytes.toString("ascii", 1, 4) === "PNG") return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes.toString("ascii", 0, 3) === "GIF") return [bytes.readUInt16LE(6), bytes.readUInt16LE(8)];
  if (bytes.toString("ascii", 8, 12) === "WEBP") {
    const type = bytes.toString("ascii", 12, 16);
    if (type === "VP8X") return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
    if (type === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (type === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < length) {
      if (bytes[offset++] !== 0xff) continue;
      const marker = bytes[offset++];
      if (marker === 0xff || marker === 0x00 || marker === 0xd8 || marker === 0xd9) continue;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker))
        return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
      offset += bytes.readUInt16BE(offset);
    }
  }
  throw new Error("IMAGE DIMENSIONS UNAVAILABLE : " + path);
}

export function auditImages(root, paths) {
  const policy = JSON.parse(readFileSync(resolve(root, "DesignAssets/image-sizes.json"), "utf8"));
  if (policy.preferredScale !== 1) throw new Error("IMAGE SOURCE TARGET MUST BE 1");
  if (policy.maximumScale !== 1.5) throw new Error("IMAGE SIZE LIMIT MUST BE 1.5");
  const failures = [];
  let count = 0;
  for (const name of paths || Object.keys(policy.images)) {
    if (!/\.(png|webp|gif|jpe?g|avif)$/i.test(name)) continue;
    count++;
    const size = policy.images[name];
    if (!size) { failures.push(name + " : 원본 제작 기준 표시 크기 미등록 (목표 100%, 최대 150%)"); continue; }
    const dimensions = imageDimensions(resolve(root, name));
    const frame = [dimensions[0] / size.grid[0], dimensions[1] / size.grid[1]];
    if (frame.some((value, index) => !Number.isInteger(value) || value > size.display[index] * policy.maximumScale + 1e-7))
      failures.push(name + " : 원본 프레임 " + frame.join("×") +
        ", 제작 목표 " + size.display.map(value => Math.floor(value * policy.preferredScale)).join("×") +
        ", 최대 " + size.display.map(value => Math.floor(value * policy.maximumScale)).join("×"));
  }
  if (failures.length) throw new Error("IMAGE SIZE LIMIT :\n" + failures.join("\n"));
  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = auditImages(resolve(fileURLToPath(new URL("..", import.meta.url))));
  console.log(`ENV> SOURCE IMAGE SIZE : ${count} FILES PASSED (TARGET 100%, MAX 150%)`);
}
