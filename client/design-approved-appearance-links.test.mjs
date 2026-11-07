import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const design = read('Design.html').toString();
const appearance = design.match(/<details\b[^>]*id="codex-unit-appearance"[^>]*>([^]*?)<\/details>/)[1];
function cell(marker, tribe, action) {
  const rows = [...appearance.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/g)]
    .map(match => match[0]).filter(row => row.includes(marker) && row.includes(`<th scope="row">${tribe}</th>`));
  assert.equal(rows.length, 1);
  return rows[0].match(new RegExp(`<td data-action="${action}">([^]*?)</td>`))[0];
}
function verifyLink(markup, source, preview, hasPreview = true) {
  assert.ok(markup.includes(`href="${source}"`));
  if (hasPreview) assert.ok(markup.includes(`data-preview="${preview}"`));
  assert.ok(markup.includes(`data-original-src="${preview}"`));
  assert.ok(markup.includes(`data-src="${preview}"`));
  assert.ok(!markup.includes('data-combat-clip'), 'The old combat matrix must not replace the approved clip.');
  assert.ok(existsSync(new URL(source, root)));
  assert.ok(existsSync(new URL(preview, root)));
}

test('approved bean secretion idle V4 is used in the planning table and lightbox', () => {
  const prefix = 'AnimationCandidates/bean-secretion-idle-v4/bean-secretion-idle-v4';
  verifyLink(cell('<span>분비기관</span>', '새싹콩', 'idle'), `${prefix}-sheet.png`, `${prefix}-preview.gif`, false);
  const manifest = JSON.parse(read(`${prefix}.json`));
  assert.equal(manifest.status, 'user-approved');
  assert.equal(manifest.frameCount, 64);
  assert.equal(manifest.durationMs, 3200);
});

for (const action of ['birth', 'death']) test(`approved spring antenna ${action} V3 is linked without changing game assets`, () => {
  verifyLink(cell('AnimationCandidates/spring-antenna-walk-v6/walk.webp', '샘방울', action),
    `AnimationCandidates/spring-lifecycle-faithful-v3/antenna-${action}.webp`,
    `AnimationCandidates/SheetGifHandoff-20261106/spring-antenna-${action}-preview.gif`);
  assert.match(read('AnimationCandidates/spring-lifecycle-faithful-v3/APPROVAL.md').toString(), /샘방울 합격/);
});

test('approved bean antenna hurt preview keeps the registered source and 880 ms clock', () => {
  const preview = 'DesignAssets/Planning/Animations/BeanHeldHurtV1/antenna.webp';
  const source = 'DesignAssets/Animations/BeanHeldHurtV1/antenna.webp';
  verifyLink(cell('DesignAssets/Planning/Attributes/Units/bean-antenna.png', '새싹콩', 'hurt'), source, preview);
  const manifest = JSON.parse(read(preview.replace('.webp', '.json')));
  assert.equal(manifest.source, source);
  assert.equal(manifest.sourceSHA256, createHash('sha256').update(read(source)).digest('hex'));
  assert.deepEqual(manifest.frames, Array.from({ length: 12 }, (_, index) => index));
  assert.equal(manifest.durationsMs[0], 500);
  assert.equal(manifest.durationsMs.reduce((sum, duration) => sum + duration, 0), 880);
  assert.equal(manifest.losslessVisiblePixelsVerified, true);
  const bytes = read(preview), durations = [];
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4);
    if (bytes.toString('ascii', offset, offset + 4) === 'ANMF') durations.push(bytes.readUIntLE(offset + 20, 3));
    offset += 8 + length + length % 2;
  }
  assert.equal(durations.reduce((sum, duration) => sum + duration, 0), 880);
  assert.match(read(manifest.approval).toString(), /approved visual-only reactions/);
});

for (const variant of ['blade', 'carapace']) test(`approved spring ${variant} birth is a body-only review capture`, () => {
  const prefix = `AnimationCandidates/spring-body-birth-review-20261106/${variant}/`;
  const markup = cell(`CombatAttributesV7/spring/Sheets/${variant}/idle.webp`, '샘방울', 'birth');
  verifyLink(markup, `${prefix}birth-body-sheet.png`, `${prefix}birth-body.gif`);
  assert.ok(markup.includes('탄생 몸체 검수'));
  const manifest = JSON.parse(read('AnimationCandidates/spring-body-birth-review-20261106/manifest.json'));
  const clip = manifest.find(item => item.id === `tribe/spring/${variant}/birth`);
  assert.equal(clip.status, 'user-approved');
  assert.equal(clip.bodyOnly, true);
  assert.equal(clip.durationsMs.reduce((sum, value) => sum + value, 0), 2100);
});
