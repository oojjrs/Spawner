import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
import { auditImages } from './image-audit.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const review = JSON.parse(readFileSync(new URL('../tools/fertile-soil-cargo-review.json', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('새싹콩 비옥토의 채집·운반·투척 시트는 검수한 흙 소품과 기존 8프레임 계약을 사용한다', () => {
  assert.equal(review.files.length, 3);
  assert.equal(review.files.reduce((sum, file) => sum + file.boxes.length, 0), 20);
  assert.equal(sha(readFileSync(root + review.sourcePath)), review.sourceSHA256);
  for (const file of review.files) {
    assert.equal(sha(readFileSync(root + file.image)), file.sha256, file.image);
    const clip = UNIT_ACTION_ART['bean/gather'].actions[file.action];
    assert.equal(clip.image, file.image);
    assert.equal(clip.frameSize, 256);
    assert.equal(clip.columns, 4);
    assert.equal(clip.frameCount, 8);
    assert.equal(clip.pivotX, 130.5);
    assert.equal(clip.pivotY, 233);
    assert.equal(clip.referenceLength, 187);
    assert.equal(clip.embeddedCargo, true);
    assert.equal(clip.sourceFacing, 'left');
    assert.deepEqual(clip.durationsMs, file.action === 'throw' ? [180,140,120,100,80,120,140,320] : [180,140,140,140,140,140,140,180]);
    assert.equal(clip.loop, file.action !== 'throw');
    if (file.action === 'throw') assert.equal(clip.releaseAtMs, 540);
  }
  assert.equal(auditImages(root, review.files.map(file => file.image)), 3);
});

test('흙 소품 20곳 밖의 캐릭터·투명도 픽셀은 그대로이고 노란 콩 색상이 남지 않는다', () => {
  const check = String.raw`
import sys,json,subprocess,hashlib,io
import numpy as np
from PIL import Image
review=json.load(sys.stdin)
for f in review['files']:
 raw=subprocess.check_output(['git','show',review['baselineCommit']+':'+f['image']])
 assert hashlib.sha256(raw).hexdigest()==f['baselineSHA256']
 a=np.array(Image.open(io.BytesIO(raw)).convert('RGBA'));b=np.array(Image.open(f['image']).convert('RGBA'))
 assert a.shape==b.shape==(512,1024,4)
 a[a[:,:,3]==0,:3]=0;b[b[:,:,3]==0,:3]=0
 mask=np.zeros((512,1024),dtype=bool)
 for x,y,w,h in f['boxes']:
  mask[y:y+h,x:x+w]=True
  old=a[y:y+h,x:x+w].astype(float);new=b[y:y+h,x:x+w].astype(float)
  yellow=lambda p: (p[:,:,0]>p[:,:,1]*1.03)&(p[:,:,1]>135)&(p[:,:,1]>p[:,:,0]*.78)&(p[:,:,1]>p[:,:,2]*1.5)&(p[:,:,3]>120)
  assert np.count_nonzero(yellow(old))>20,(f['image'],'baseline seed missing')
  assert np.count_nonzero(yellow(new))==0,(f['image'],'yellow seed remains')
  brown=(new[:,:,0]>new[:,:,1]*1.12)&(new[:,:,1]>new[:,:,2]*1.1)&(new[:,:,3]>120)
  assert np.count_nonzero(brown)>60,(f['image'],'soil texture missing')
 changed=np.any(a!=b,axis=2)
 assert not np.any(changed&~mask),(f['image'],'protected body/background changed')
 assert np.count_nonzero(changed)==f['changedVisiblePixels']
 assert np.array_equal(a[~mask],b[~mask])
 print(f['action'],int(np.count_nonzero(changed)),'prop pixels; body and background unchanged')
`;
  const result = execFileSync('python', ['-c', check], { cwd: root, input: JSON.stringify(review), timeout: 30000 }).toString();
  assert.match(result, /harvest/);
  assert.match(result, /carry/);
  assert.match(result, /throw/);
  console.log(result.trim());
});
