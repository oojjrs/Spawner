import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
import { unitFrameMirror } from './unit-size.mjs';
import { imageDimensions, auditImages } from './image-audit.mjs';
const evidence = new URL('../tools/source-facing-normalization-20261108/', import.meta.url);
const pixels = JSON.parse(readFileSync(new URL('pixel-changes.json', evidence)));
const previews = JSON.parse(readFileSync(new URL('preview-changes.json', evidence)));
const before = JSON.parse(readFileSync(new URL('catalog-before.json', evidence)));
const forms = ['pebble/blade-carapace', 'pebble/blade-carapace-antenna'];
const sha = path => createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');

test('좌향 몽돌 원본과 공개 미리보기는 검증된 새 픽셀 파일을 그대로 사용한다', () => {
  assert.equal(pixels.status, 'completed'); assert.equal(previews.status, 'completed');
  assert.equal(Object.keys(pixels.changes).length, 27);
  assert.equal(Object.keys(previews.changes).length, 23);
  for (const change of Object.values(pixels.changes)) {
    assert.notEqual(change.beforeSha256, change.afterSha256, change.oldImage);
    assert.equal(sha(change.newImage), change.afterSha256, change.newImage);
    assert.deepEqual(imageDimensions(new URL('../' + change.newImage, import.meta.url)), [change.width, change.height]);
    assert.equal(change.verification.exactRgbaPerCellMirror, true);
    assert.equal(change.verification.frameOrderUnchanged, true);
    assert.equal(change.verification.originalSymlinkTargetUnchanged, true);
  }
  for (const change of Object.values(previews.changes)) assert.equal(sha(change.newImage), change.afterSha256, change.newImage);
});

test('원본 좌향 기준은 추가 반전 없이 왼쪽을 보고 게임의 실제 우향 반전은 유지한다', () => {
  const paths=[];
  for (const key of forms) for (const [action, clip] of Object.entries(UNIT_ACTION_ART[key].actions)) {
    const original=before.find(row=>row.key===key && row.action===action);
    assert.equal(clip.sourceFacing, 'left', key+'/'+action);
    assert.equal(unitFrameMirror(clip.sourceFacing,-1),false);
    assert.equal(unitFrameMirror(clip.sourceFacing,1),true);
    assert.equal(clip.pivotX,original.frameSize-original.pivotX);
    for(const field of ['pivotY','frameSize','frameHeight','columns','frameCount','durationMs','referenceLength','viewSize','loop'])
      assert.equal(clip[field],original[field],key+'/'+action+'/'+field);
    assert.deepEqual(clip.durationsMs,original.durationsMs,key+'/'+action+'/clock');
    paths.push(clip.image);
  }
  assert.equal(auditImages(new URL('..',import.meta.url).pathname,paths),12);
});
