import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";
import { auditImages, imageDimensions } from "./image-audit.mjs";
import { UNIT_SPRITE_REGISTRATION } from "./unit-sprite-registration.mjs";
import { UNIT_COMBAT_DEATH_ANIMATIONS } from "./combat-death.mjs";

function png(width, height, red = 0) {
  function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const header = Buffer.alloc(4), footer = Buffer.alloc(4);
    header.writeUInt32BE(data.length); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([header, body, footer]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    pixels[offset] = red; pixels[offset + 3] = 255;
  }
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

function fixture(t, native = false) {
  const root = mkdtempSync(join(tmpdir(), "spawner-image-audit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "DesignAssets"));
  const name = "DesignAssets/sprite.png";
  const bytes = native ? png(200, 120) : png(150, 150);
  writeFileSync(join(root, name), bytes);
  const size = native ? { display: [50, 50], grid: [2, 1], nativeSource: {
    sha256: createHash("sha256").update(bytes).digest("hex"), dimensions: [200, 120], frame: [100, 120]
  } } : { display: [100, 100], grid: [1, 1] };
  const policy = { preferredScale: 1, maximumScale: 1.5, images: { [name]: size } };
  function save() { writeFileSync(join(root, "DesignAssets/image-sizes.json"), JSON.stringify(policy)); }
  save();
  return { root, name, size, policy, save, image: bytes => writeFileSync(join(root, name), bytes) };
}

test("ordinary images keep the 150% ceiling and require a registration", t => {
  const f = fixture(t);
  assert.equal(auditImages(f.root), 1);
  f.image(png(151, 150));
  assert.throws(() => auditImages(f.root), /원본 프레임 151×150/);
  assert.throws(() => auditImages(f.root, ["DesignAssets/unregistered.png"]), /미등록/);
  f.policy.maximumScale = 2; f.save();
  assert.throws(() => auditImages(f.root), /IMAGE SIZE LIMIT MUST BE 1.5/);
  f.policy.maximumScale = 1.5; f.policy.preferredScale = .5; f.save();
  assert.throws(() => auditImages(f.root), /IMAGE SOURCE TARGET MUST BE 1/);
});

test("a native camera allowance accepts only its exact atlas bytes and dimensions", t => {
  const f = fixture(t, true);
  assert.equal(auditImages(f.root), 1);
  f.image(png(200, 120, 128));
  assert.throws(() => auditImages(f.root), /SHA-256 불일치/, "same-size replacement must be reviewed");
  for (const width of [198, 202]) {
    f.image(png(width, 120));
    assert.throws(() => auditImages(f.root), /치수·프레임 등록 불일치/, "both shrinking and growing change the registered source");
  }
});

test("native allowances cannot hide an incorrect grid or a malformed camera contract", t => {
  const f = fixture(t, true), original = structuredClone(f.size);
  for (const change of [
    size => { size.grid = [1, 1]; },
    size => { size.grid = [2.5, 1]; },
    size => { size.display = [0, 50]; },
    size => { size.nativeSource.frame = [101, 120]; },
    size => { delete size.nativeSource.sha256; },
    size => { size.nativeSource.dimensions = [0, 120]; },
    size => { size.nativeSource = null; },
    size => { size.sourceMaximum = [200, 200]; }
  ]) {
    f.policy.images[f.name] = structuredClone(original);
    change(f.policy.images[f.name]); f.save();
    assert.throws(() => auditImages(f.root), /등록/, "invalid registration must fail closed");
  }
});

function assertCombatDeathEvidence(rows) {
  const combat = rows.filter(row => row.category === "combat-death");
  const deaths = Object.values(UNIT_COMBAT_DEATH_ANIMATIONS);
  assert.deepEqual(combat.map(row => row.image).sort(), deaths.map(animation => animation.image).sort(),
    "combat evidence must cover exactly the current approved death images");
  for (const row of combat) {
    const animation = deaths.find(value => value.image === row.image);
    assert.equal(row.frameCount, animation.frameCount, "approved death frame count: " + row.image);
    assert.deepEqual(row.grid, [animation.columns, Math.ceil(animation.frameCount / animation.columns)],
      "approved death grid: " + row.image);
    assert.deepEqual(row.frame, [animation.frameSize, animation.frameSize],
      "approved death camera: " + row.image);
  }
}

test("combat evidence rejects stale images and changed frame counts, grids or cameras", () => {
  const rows = JSON.parse(readFileSync(new URL("../tools/image-audit-registration-20261104/evidence.json", import.meta.url))).rows;
  assertCombatDeathEvidence(rows);
  for (const [field, value, message] of [
    ["image", "DesignAssets/Animations/CombatDeathV1/sprout/blade/death.webp", /current approved death images/],
    ["frameCount", 8, /approved death frame count/],
    ["grid", [4, 2], /approved death grid/],
    ["frame", [512, 512], /approved death camera/]
  ]) {
    const changed = structuredClone(rows);
    const row = changed.find(value => value.image === "DesignAssets/Animations/SproutDeathV2/blade/death.webp");
    assert.ok(row, "the approved sprout blade V2 must remain in the evidence");
    row[field] = value;
    assert.throws(() => assertCombatDeathEvidence(changed), message);
  }
});

test("the 36 current runtime assets match their approved bytes, cameras and display targets", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const evidence = JSON.parse(readFileSync(new URL("../tools/image-audit-registration-20261104/evidence.json", import.meta.url)));
  const policy = JSON.parse(readFileSync(new URL("../DesignAssets/image-sizes.json", import.meta.url)));
  assert.equal(evidence.rows.length, 36);
  assert.equal(auditImages(root, evidence.rows.map(row => row.image)), 36);
  assertCombatDeathEvidence(evidence.rows);
  const deaths = Object.values(UNIT_COMBAT_DEATH_ANIMATIONS);
  for (const row of evidence.rows) {
    const size = policy.images[row.image];
    const image = new URL("../" + row.image, import.meta.url);
    const dimensions = imageDimensions(image);
    assert.deepEqual(dimensions, row.dimensions, row.image);
    assert.deepEqual(dimensions.map((value, axis) => value / size.grid[axis]), row.frame, row.image);
    if (row.sha256 !== null) {
      assert.equal(createHash("sha256").update(readFileSync(image)).digest("hex"), row.sha256, row.image);
    }
    assert.deepEqual(size.grid, row.grid);
    assert.deepEqual(size.display, row.display);
    if (row.category === "neutral-registered-camera") {
      assert.deepEqual(size.display, row.previousDisplay, "retaining source detail must not enlarge units");
      assert.deepEqual(size.nativeSource.frame, Array(2).fill(UNIT_SPRITE_REGISTRATION[row.image].frameSize));
    } else if (row.category === "combat-death") {
      const animation = deaths.find(value => value.image === row.image);
      assert.deepEqual(size.grid, [animation.columns, Math.ceil(animation.frameCount / animation.columns)]);
      if (size.nativeSource) {
        assert.deepEqual(size.nativeSource.frame, [animation.frameSize, animation.frameSize]);
      } else {
        assert.ok(row.frame.every((value, axis) => value <= size.display[axis] * policy.maximumScale),
          "approved death camera must fit the ordinary display budget: " + row.image);
      }
      assert.deepEqual(size.display, [256, 256]);
    } else {
      assert.deepEqual(size.display, policy.viewport);
      assert.equal(size.nativeSource, undefined, "backgrounds fit the ordinary viewport budget");
    }
  }
});
