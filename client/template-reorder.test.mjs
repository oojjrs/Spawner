import test from 'node:test';
import assert from 'node:assert/strict';
import { templateDropIndex, moveTemplateId } from './template-reorder.mjs';
const rect = (left, top) => ({ left, top, bottom: top + 100, width: 100 });

test('그리드 줄바꿈과 카드 사이 간격에서도 앞·뒤 위치를 계산한다', () => {
  const rects = [rect(0, 0), rect(110, 0), rect(220, 0), rect(0, 110), rect(110, 110)];
  for (const [x, y, expected] of [[0, 20, 0], [60, 20, 1], [105, 20, 1], [250, 20, 2], [310, 20, 3], [0, 130, 3], [160, 130, 5], [310, 230, 5]])
    assert.equal(templateDropIndex(rects, x, y), expected, `${x},${y}`);
  assert.equal(templateDropIndex([], 0, 0), 0);
});

test('선택 ID만 앞·뒤·경계로 옮기며 원본 배열과 다른 카드 상대 순서를 보존한다', () => {
  const ids = [1, 2, 3, 4];
  assert.deepEqual(moveTemplateId(ids, 1, 3), [2, 3, 4, 1]);
  assert.deepEqual(moveTemplateId(ids, 4, 0), [4, 1, 2, 3]);
  assert.deepEqual(moveTemplateId(ids, 2, 2), [1, 3, 2, 4]);
  assert.deepEqual(moveTemplateId(ids, 2, -5), [2, 1, 3, 4]);
  assert.deepEqual(moveTemplateId(ids, 2, 100), [1, 3, 4, 2]);
  assert.deepEqual(moveTemplateId(ids, 99, 0), ids);
  assert.deepEqual(ids, [1, 2, 3, 4]);
});

import { createTemplateReorder } from './template-reorder.mjs';
class Node {
  constructor(name = '') {
    this.className = name; this.style = {}; this.attrs = {}; this.listeners = new Map(); this.children = []; this.isConnected = true; this.dataset = {};
    this.classList = { add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
      contains: name => this.className.split(' ').includes(name) };
  }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
  fire(type, props = {}) { const event = { target: this, pointerId: 1, button: 0, isPrimary: true, clientX: 0, clientY: 0, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...props }; for (const listener of this.listeners.get(type) || []) listener(event); return event; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  closest(selector) { return this.classList.contains(selector.slice(1)) ? this : this.parent?.closest(selector) || null; }
  querySelector(selector) { return this.children.find(node => node.classList.contains(selector.slice(1))); }
  append(node) { node.parent = this; this.children.push(node); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.isConnected = false; }
  cloneNode() { return new Node(this.className); }
  focus() { this.ownerDocument.activeElement = this; }
  setPointerCapture(id) { this.capture = id; }
  hasPointerCapture(id) { return this.capture === id; }
  releasePointerCapture() { this.capture = null; }
  after(node) { this.afterNode = node; }
}
function fixture({ result = {} } = {}) {
  const window = new Node(), document = new Node(); document.body = new Node(); document.defaultView = window;
  document.createElement = () => new Node();
  let frame; window.requestAnimationFrame = callback => { frame = callback; return 1; }; window.cancelAnimationFrame = () => { frame = null; };
  const list = new Node(), scroller = new Node(); list.ownerDocument = document; list.visible = true; scroller.scrollTop = 0;
  scroller.getBoundingClientRect = () => ({ top: 0, bottom: 240, left: 0, right: 320, height: 240 });
  list.getBoundingClientRect = () => ({ top: -scroller.scrollTop, bottom: 320 - scroller.scrollTop, left: 0, right: 320 });
  list.getClientRects = () => list.visible ? [list.getBoundingClientRect()] : [];
  for (let id = 1; id <= 6; id++) {
    const card = new Node('template-card'), handle = new Node('template-reorder'), spawn = new Node('template-spawn');
    card.dataset.templateId = String(id); card.ownerDocument = handle.ownerDocument = spawn.ownerDocument = document; card.append(handle); card.append(spawn); list.append(card);
    card.getBoundingClientRect = () => { const index = list.children.indexOf(card), top = Math.floor(index / 3) * 110 - scroller.scrollTop; return { left: index % 3 * 110, top, bottom: top + 100, width: 100, height: 100 }; };
  }
  list.querySelectorAll = selector => selector === '.template-reorder' ? list.children.map(card => card.children[0]) : list.children;
  const value = { list, scroller, window, document, allowed: true, calls: [], ids: () => list.children.map(card => +card.dataset.templateId),
    handle: id => list.children.find(card => +card.dataset.templateId === id).children[0], tick: () => frame?.() };
  value.controller = createTemplateReorder(list, { canReorder: () => value.allowed, scrollContainer: scroller, commit: async next => {
    value.calls.push(next); if (result) list.children = next.map(id => list.children.find(card => +card.dataset.templateId === id)); return result;
  } });
  value.drag = (id, x, y, props = {}) => {
    const handle = value.handle(id); list.fire('pointerdown', { target: handle, clientX: 10, clientY: 80, ...props });
    list.fire('pointermove', { target: handle, clientX: x, clientY: y, ...props });
  };
  return value;
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('마우스·터치 포인터 드래그는 탄생 버튼 대신 손잡이에서만 작동한다', async () => {
  for (const pointerType of ['mouse', 'touch', 'pen']) {
    const value = fixture(), { list } = value;
    const spawn = list.children[0].children[1];
    assert.equal(list.fire('pointerdown', { target: spawn }).prevented, undefined);
    value.drag(1, 310, 150, { pointerType });
    assert.ok(list.children[0].classList.contains('template-dragging'));
    assert.ok(list.children[5].classList.contains('template-drop-after'));
    list.fire('pointerup', { target: value.handle(1), clientX: 310, clientY: 150, pointerType });
    await settle();
    assert.deepEqual(value.ids(), [2, 3, 4, 5, 6, 1]);
    assert.equal(value.calls.length, 1);
    assert.equal(value.document.body.children.length, 0);
    assert.equal(value.document.activeElement, value.handle(1));
    const click = list.fire('click', { target: value.handle(1) }); assert.ok(click.prevented && click.stopped);
    assert.equal(list.fire('click', { target: spawn }).prevented, undefined);
  }
});

test('짧은 탭·다른 포인터·오른쪽 버튼·영역 밖 드롭은 저장하지 않는다', async () => {
  const value = fixture(), { list } = value, handle = value.handle(1);
  for (const props of [{}, { button: 2 }, { isPrimary: false }]) {
    list.fire('pointerdown', { target: handle, clientX: 10, clientY: 80, ...props });
    list.fire('pointermove', { target: handle, clientX: 12, clientY: 81, ...props });
    list.fire('pointerup', { target: handle, clientX: 12, clientY: 81, ...props });
  }
  value.drag(1, 310, 150);
  list.fire('pointerup', { pointerId: 2, target: handle, clientX: 310, clientY: 150 });
  assert.equal(value.calls.length, 0);
  list.fire('pointerup', { target: handle, clientX: 800, clientY: 150 }); await settle();
  assert.deepEqual(value.ids(), [1, 2, 3, 4, 5, 6]); assert.equal(value.calls.length, 0);
});

test('Escape·취소·포인터 손실·화면 전환은 드래그 흔적과 캡처를 정리한다', () => {
  for (const event of ['Escape', 'pointercancel', 'lostpointercapture', 'blur', 'resize', 'hidden', 'detached', 'invisible', 'busy']) {
    const value = fixture(); value.drag(1, 310, 150);
    if (event === 'Escape') assert.ok(value.document.fire('keydown', { key: 'Escape' }).prevented);
    else if (['pointercancel', 'lostpointercapture'].includes(event)) value.list.fire(event);
    else if (['blur', 'resize'].includes(event)) value.window.fire(event);
    else if (event === 'hidden') { value.document.hidden = true; value.document.fire('visibilitychange'); }
    else { if (event === 'detached') value.list.children[0].isConnected = false; if (event === 'invisible') value.list.visible = false; if (event === 'busy') value.allowed = false; value.controller.refresh(); }
    assert.equal(value.document.body.children.length, 0, event);
    assert.equal(value.handle(1).capture, null, event);
    assert.ok(!value.list.children.some(card => /template-dragging|template-drop/.test(card.className)), event);
    assert.equal(value.calls.length, 0, event);
  }
});

test('키보드 이동·저장 실패·처리 중 비활성·가장자리 스크롤', async () => {
  const value = fixture(), handle = value.handle(1);
  value.list.fire('keydown', { target: handle, key: 'End' });
  assert.ok(handle.disabled); await settle(); assert.deepEqual(value.ids(), [2, 3, 4, 5, 6, 1]); assert.equal(handle.disabled, false);
  value.list.fire('keydown', { target: handle, key: 'ArrowLeft' }); await settle(); assert.deepEqual(value.ids(), [2, 3, 4, 5, 1, 6]);
  value.list.fire('keydown', { target: handle, key: 'Home' }); await settle(); assert.deepEqual(value.ids(), [1, 2, 3, 4, 5, 6]);
  const rejected = fixture({ result: null }); rejected.list.fire('keydown', { target: rejected.handle(1), key: 'End' }); await settle(); assert.deepEqual(rejected.ids(), [1, 2, 3, 4, 5, 6]);
  value.drag(1, 150, 235); value.tick(); assert.ok(value.scroller.scrollTop > 0); value.controller.cancel();
  value.allowed = false; value.controller.refresh(); assert.ok(handle.disabled); value.drag(1, 310, 150); assert.equal(value.document.body.children.length, 0);
});
