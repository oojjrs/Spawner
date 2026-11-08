import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
import { createUnitActionArt, unitActionArtPose } from './unit-action-art.mjs';
import { unitFrameMirror } from './unit-size.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = 'tools/spring-native-facing-20261108/';
const catalog = JSON.parse(readFileSync(new URL('../' + dir + 'spring-throw-left-catalog.json', import.meta.url)));
const journal = JSON.parse(readFileSync(new URL('../' + dir + 'spring-throw-left-integration-changes.json', import.meta.url)));
const approvedSHA = '5dedec26a3c2f6ac5f31db25abbc0ad675bd3cf499ce9751940897168918eeaf';
const baselineCommit = '3d4b2214c2be9e69e002fd99704026b8b568fcb2';
const sha = path => createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');

test('승인된 샘방울 투척은 새 원본 바이트와 고정 격자·피벗·540ms 방출을 사용한다', () => {
  const clip = UNIT_ACTION_ART['spring/gather'].actions.throw;
  assert.equal(sha(clip.image), approvedSHA);
  assert.equal(sha(catalog.sourceAliases[0]), approvedSHA);
  assert.equal(clip.sourceFacing, 'left');
  assert.deepEqual(clip, { ...catalog.originalClip, sourceFacing: 'left' });
  for (const action of ['harvest', 'carry']) {
    assert.deepEqual(UNIT_ACTION_ART['spring/gather'].actions[action], {
      ...catalog.protectedWorkClips[action], sourceFacing: 'left',
    }, action + ' preserves every authored field except the corrected source label');
  }
  for (const field of ['image', 'frameSize', 'columns', 'frameCount', 'durationsMs', 'pivotX', 'pivotY', 'referenceLength', 'releaseAtMs', 'loop', 'embeddedCargo']) {
    assert.deepEqual(clip[field], catalog[field], field);
  }
  assert.equal(clip.frameHeight ?? clip.frameSize, 256);
  assert.equal(clip.durationsMs.reduce((a, b) => a + b, 0), 1200);
  assert.equal(clip.releaseAtMs, 540);
  assert.equal(unitFrameMirror(clip.sourceFacing, -1), false);
  assert.equal(unitFrameMirror(clip.sourceFacing, 1), true);
  assert.equal(journal.status, 'applied');
  for (const [path, change] of Object.entries(journal.changes)) assert.equal(sha(path), change.afterSha256, path);
  for (const [path, hash] of Object.entries(journal.protectedUnchanged)) assert.equal(sha(path), hash, path);
});

test('독립 RGBA 검사는 첫·끝 원본과 채집·운반을 보존하고 자원의 왼쪽 방출을 확인한다', () => {
  const python = String.raw`
import sys,json,hashlib,subprocess,io
from PIL import Image
import numpy as np
x=json.load(sys.stdin);a=x['catalog'];source=a['image']
raw=subprocess.check_output(['git','show',x['commit']+':'+source]);assert hashlib.sha256(raw).hexdigest()==a['sourceSHA256']
before=Image.open(io.BytesIO(raw)).convert('RGBA');after=Image.open(source).convert('RGBA');assert before.size==after.size==(1024,512)
def equal(u,v):return np.array_equal(u[:,:,3],v[:,:,3]) and np.array_equal(u[u[:,:,3]>0],v[u[:,:,3]>0])
gold=[];crests=[]
for i in range(8):
 px,py=(i%4)*256,(i//4)*256;box=(px,py,px+256,py+256);old=np.asarray(before.crop(box));now=np.asarray(after.crop(box))
 if i in [0,7]:assert equal(old,now),('endpoint changed',i)
 rgb=now[:,:,:3].astype(int);mask=(now[:,:,3]>128)&(rgb[:,:,0]>145)&(rgb[:,:,1]>80)&(rgb[:,:,2]<115)&(rgb[:,:,0]-rgb[:,:,2]>70)
 yy,xx=np.where(mask);gold.append(float(xx.mean()) if len(xx) else None)
 alpha=now[:,:,3]>128;body_y,body_x=np.where(alpha);top=int(body_y.min());cy,cx=np.where(alpha[top:top+25]);crests.append(float(cx.mean()));assert crests[-1]>128,('crest reflected',i,crests[-1])
 edge=max(now[0,:,3].max(),now[-1,:,3].max(),now[:,0,3].max(),now[:,-1,3].max());assert edge<=24,('clipped',i)
assert all(gold[i]>gold[i+1] for i in range(4)),gold
assert gold[4]<64 and all(v is None for v in gold[5:]),gold
preview=a['linkedPreview'];oldbytes=subprocess.check_output(['git','show',x['commit']+':'+preview]);assert hashlib.sha256(oldbytes).hexdigest()==a['baselineHashes'][preview]
with Image.open(io.BytesIO(oldbytes)) as old,Image.open(preview) as new:
 assert old.n_frames==new.n_frames==24 and old.size==new.size==(256,256)
 assert old.info.get('loop')==new.info.get('loop')
 for i in range(24):
  old.seek(i);new.seek(i);u=np.asarray(old.convert('RGBA'));v=np.asarray(new.convert('RGBA'))
  assert old.info.get('duration')==new.info.get('duration'),('preview timing',i)
  if i<16:assert equal(u,v),('harvest/carry preview changed',i)
for path,h in x['protected'].items():assert hashlib.sha256(open(path,'rb').read()).hexdigest()==h,path
print(json.dumps({'cells':8,'goldCentersX':gold,'crestCentersX':crests,'protectedFiles':len(x['protected']),'originalPreviewFrames':16}))
`;
  const result = JSON.parse(execFileSync('python', ['-c', python], {
    cwd: root, input: JSON.stringify({ commit: baselineCommit, catalog, protected: journal.protectedUnchanged }),
    encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 60000,
  }));
  assert.equal(result.cells, 8);
  assert.equal(result.originalPreviewFrames, 16);
  assert.equal(result.protectedFiles, 5);
});

test('승인된 투척 여덟 셀은 양방향 실제 전신 draw에서 올바른 crop과 방향을 사용한다', async () => {
  const clip = UNIT_ACTION_ART['spring/gather'].actions.throw;
  const art = createUnitActionArt(path => path, (w, h) => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }),
  }) }), async image => ({ image }));
  const agent = { tribe: 'spring', attributes: { strength: 1 }, health: 10, mode: 'unload', carrying: 1,
    foodDelivery: { startedAt: 0, arrivesAt: 1, resourceType: 'dew', amount: 1 } };
  let elapsed = 0, draws = 0;
  for (let frame = 0; frame < 8; frame++) {
    const ms = elapsed + clip.durationsMs[frame] / 2;
    const time = ms < 540 ? ms / 540 * .24 : .24 + (ms - 540) / 660 * .76;
    const pose = unitActionArtPose(agent, time);
    assert.equal(pose.action, 'throw'); assert.equal(pose.animation.image, clip.image); assert.equal(pose.frame, frame);
    await art.prepare(agent, time);
    for (const facing of [-1, 1]) {
      const calls = [], scales = [];
      const context = { save() {}, restore() {}, translate() {}, scale: (...v) => scales.push(v), drawImage: (...v) => calls.push(v) };
      assert.equal(art.draw(context, agent, time, 200, 400, 100, facing === -1), true);
      assert.equal(calls.length, 1); assert.equal(calls[0][0].image, clip.image);
      assert.deepEqual(scales, [[facing === -1 ? 1 : -1, 1]]);
      assert.deepEqual(calls[0].slice(1, 5), [frame % 4 * 256, Math.floor(frame / 4) * 256, 256, 256]);
      draws++;
    }
    elapsed += clip.durationsMs[frame];
  }
  assert.equal(draws, 16);
  assert.equal(unitActionArtPose(agent, .24 - 1e-5).frame, 3);
  assert.equal(unitActionArtPose(agent, .24).frame, 4);
});
