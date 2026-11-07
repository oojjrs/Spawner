import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";

// These clips start with a neutral body. Do not apply this invariant to impact,
// squash, melt, or birth frames, and never resize individual animated frames.
const cases = [["bean/base", "attack"], ["bean/base", "death"], ["spring/secretion", "death"],
  ["spore/secretion", "ranged"], ["spore/secretion", "harvest"], ["spore/secretion", "throw"], ["pebble/secretion", "death"], ["bean/secretion", "death"], ["spore/carapace", "attack"]];
const root = fileURLToPath(new URL("../", import.meta.url));
const records = cases.map(([key, action]) => ({ key, action,
  reference: UNIT_ACTION_ART[key].reference,
  idle: UNIT_ACTION_ART[key].actions.idle,
  clip: UNIT_ACTION_ART[key].actions[action] }));

// Pillow is also used by the repository's sprite registration scripts. Read
// source pixels instead of hard-coding a width that could silently go stale.
const measurements = JSON.parse(execFileSync("python3", ["-c", `
import json, sys
from PIL import Image
rows = json.load(sys.stdin)
cache = {}
def measure(c):
    w = c['frameSize']; h = c.get('frameHeight', w)
    f = c.get('frames', [0])[0]; cols = c['columns']
    key = (c['image'], w, h, f, cols)
    if key in cache: return cache[key]
    with Image.open(c['image']) as image:
        tile = image.crop((f % cols*w, f//cols*h, (f % cols+1)*w, (f//cols+1)*h))
        box = tile.getchannel('A').point(lambda a: 255 if a >= 16 else 0).getbbox()
    if not box: raise ValueError('Empty neutral frame: ' + c['image'])
    cache[key] = {'length': max(box[2]-box[0], box[3]-box[1]), 'bottom': box[3], 'aspect': (box[3]-box[1])/(box[2]-box[0])}
    return cache[key]
print(json.dumps([{name: measure(row[name]) for name in ['reference', 'idle', 'clip']} for row in rows]))
`], { cwd: root, input: JSON.stringify(records), encoding: "utf8", maxBuffer: 1024 * 1024 }));

function sourceScale(reference, clip, referenceLength) {
  // Same source-pixel scale as createUnitActionArt.draw, with cell*size=1.
  const cameraScale = (reference.viewSize || reference.frameSize) / (clip.viewSize || clip.frameSize);
  return 1 / (clip.referenceLength || referenceLength) * (clip.referenceLength ? 1 : cameraScale);
}

for (const [index, record] of records.entries()) test(`${record.key} ${record.action} keeps neutral entry size and floor`, () => {
  const pixels = measurements[index];
  const idleScale = sourceScale(record.reference, record.idle, pixels.reference.length);
  const clipScale = sourceScale(record.reference, record.clip, pixels.reference.length);
  const ratio = pixels.clip.length * clipScale / (pixels.idle.length * idleScale);
  assert.ok(Math.abs(ratio - 1) <= .05, `neutral size ratio ${ratio}`);
  if (record.key === "spore/carapace") assert.ok(Math.abs(pixels.clip.aspect / pixels.idle.aspect - 1) <= .05, "cap/body proportions remain within 5% at entry");
  const idleFloor = (pixels.idle.bottom - record.idle.pivotY) * idleScale;
  const clipFloor = (pixels.clip.bottom - record.clip.pivotY) * clipScale;
  assert.ok(Math.abs(clipFloor - idleFloor) <= .03, `neutral floor shift ${clipFloor - idleFloor}`);
});

// The corrected attacks must enter and leave on the actual runtime idle pixels,
// rather than a similarly named concept-art reference with a different body.
test("corrected bean defensive attacks retain exact idle endpoints", () => {
  const inputs = ["antenna", "carapace"].map(form => ({ key: "bean/" + form,
    idle: UNIT_ACTION_ART["bean/" + form].actions.idle,
    attack: UNIT_ACTION_ART["bean/" + form].actions.attack }));
  const results = JSON.parse(execFileSync("python3", ["-c", `
import json, sys
from PIL import Image
rows = json.load(sys.stdin)
def frame(c, f):
    w=c['frameSize']; h=c.get('frameHeight',w); cols=c['columns']
    with Image.open(c['image']) as image:
        return image.crop((f%cols*w,f//cols*h,(f%cols+1)*w,(f//cols+1)*h)).convert('RGBA')
results=[]
for row in rows:
    idle=frame(row['idle'],row['idle'].get('frames',[0])[0])
    first=frame(row['attack'],0); last=frame(row['attack'],row['attack']['frameCount']-1)
    results.append({'key':row['key'],'sameSize':idle.size==first.size==last.size,'first':idle.tobytes()==first.tobytes(),'last':idle.tobytes()==last.tobytes()})
print(json.dumps(results))
`], { cwd: root, input: JSON.stringify(inputs), encoding: "utf8" }));
  for (const row of results) assert.deepEqual(row, { key: row.key, sameSize: true, first: true, last: true });
  for (const { attack } of inputs) {
    assert.equal(attack.durationMs, 1000);
    assert.equal(attack.hitTimeMs, 300);
  }
});
