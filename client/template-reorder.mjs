// Pointer events support mouse, pen and touch without making the birth button draggable.
export function templateDropIndex(rects, x, y) {
  if (!rects.length) return 0;
  const row = rects.reduce((best, rect) => {
    const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return distance < best.distance ? { top: rect.top, distance } : best;
  }, { top: 0, distance: Infinity }).top;
  const indices = rects.map((rect, index) => ({ rect, index })).filter(({ rect }) => Math.abs(rect.top - row) < 2);
  return indices.find(({ rect }) => x < rect.left + rect.width / 2)?.index ?? indices.at(-1).index + 1;
}

export function moveTemplateId(ids, id, index) {
  const next = ids.filter(value => value !== id);
  if (next.length === ids.length) return [...ids];
  next.splice(Math.max(0, Math.min(next.length, index)), 0, id);
  return next;
}

export function createTemplateReorder(list, { canReorder, commit, scrollContainer = list }) {
  const document = list.ownerDocument, window = document.defaultView;
  let drag = null, pending = false, frame = 0;
  const cards = () => [...list.querySelectorAll('.template-card[data-template-id]')];
  const ids = () => cards().map(card => Number(card.dataset.templateId));
  const enabled = () => !pending && canReorder() && cards().length > 1;
  const live = document.createElement('span');
  live.className = 'template-order-status';
  live.setAttribute('role', 'status');
  list.after(live);

  function clearMarkers() {
    for (const card of cards()) card.classList.remove('template-drop-before', 'template-drop-after');
  }
  function cancel() {
    if (!drag) return;
    const previous = drag;
    drag = null;
    window.cancelAnimationFrame(frame);
    frame = 0;
    previous.ghost?.remove();
    previous.card.classList.remove('template-dragging');
    previous.handle.setAttribute('aria-pressed', 'false');
    if (previous.handle.hasPointerCapture?.(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId);
    clearMarkers();
  }
  function position() {
    if (!drag?.started) return;
    const bounds = list.getBoundingClientRect(), viewport = scrollContainer.getBoundingClientRect();
    const { x, y, card, ghost } = drag;
    ghost.style.transform = `translate(${x - drag.offsetX}px, ${y - drag.offsetY}px)`;
    clearMarkers();
    drag.index = null;
    if (!enabled() || x < bounds.left || x > bounds.right || y < Math.max(bounds.top, viewport.top) || y > Math.min(bounds.bottom, viewport.bottom)) return;
    const others = cards().filter(item => item !== card);
    drag.index = templateDropIndex(others.map(item => item.getBoundingClientRect()), x, y);
    if (others[drag.index]) others[drag.index].classList.add('template-drop-before');
    else others.at(-1)?.classList.add('template-drop-after');
  }
  function autoScroll() {
    if (!drag?.started) return;
    const bounds = scrollContainer.getBoundingClientRect();
    if (drag.x >= bounds.left && drag.x <= bounds.right && drag.y >= bounds.top && drag.y <= bounds.bottom) {
      const edge = Math.min(48, bounds.height / 4);
      const speed = drag.y < bounds.top + edge ? -Math.ceil((bounds.top + edge - drag.y) / 4) :
        drag.y > bounds.bottom - edge ? Math.ceil((drag.y - bounds.bottom + edge) / 4) : 0;
      if (speed) { scrollContainer.scrollTop += speed; position(); }
    }
    frame = window.requestAnimationFrame(autoScroll);
  }
  function start() {
    const { card, handle } = drag, rect = card.getBoundingClientRect();
    drag.started = true;
    const ghost = card.cloneNode(true);
    ghost.classList.add('template-drag-ghost');
    ghost.removeAttribute('data-template-id');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    Object.assign(ghost.style, { width: rect.width + 'px', height: rect.height + 'px' });
    document.body.append(ghost);
    drag.ghost = ghost;
    card.classList.add('template-dragging');
    handle.setAttribute('aria-pressed', 'true');
    autoScroll();
  }
  async function save(id, index) {
    if (!enabled()) return;
    const before = ids(), next = moveTemplateId(before, id, index);
    if (next.every((value, i) => value === before[i])) return;
    pending = true;
    refresh();
    try {
      const result = await commit(next);
      if (result) live.textContent = `설계 순서를 ${index + 1}번째로 변경했습니다.`;
    } finally {
      pending = false;
      refresh();
      cards().find(card => Number(card.dataset.templateId) === id)?.querySelector('.template-reorder')?.focus({ preventScroll: true });
    }
  }
  function refresh() {
    const allowed = enabled();
    for (const handle of list.querySelectorAll('.template-reorder')) handle.disabled = !allowed;
    if (drag && (!allowed || !drag.card.isConnected || list.getClientRects().length === 0)) cancel();
  }
  list.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.template-reorder');
    if (!handle || !enabled() || drag || event.button !== 0 || event.isPrimary === false) return;
    const card = handle.closest('.template-card'), rect = card.getBoundingClientRect();
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { pointerId: event.pointerId, handle, card, id: Number(card.dataset.templateId), x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, started: false, index: null };
    handle.setPointerCapture(event.pointerId);
  });
  list.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY;
    if (!drag.started && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return;
    event.preventDefault();
    if (!drag.started) start();
    position();
  });
  list.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY;
    position();
    const { id, index, started } = drag;
    event.preventDefault();
    cancel();
    if (started && index !== null) void save(id, index);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) list.addEventListener(type, event => {
    if (event.pointerId === drag?.pointerId) cancel();
  });
  list.addEventListener('click', event => {
    if (event.target.closest('.template-reorder')) { event.preventDefault(); event.stopPropagation(); }
  });
  list.addEventListener('keydown', event => {
    const handle = event.target.closest('.template-reorder');
    if (!handle || !enabled()) return;
    const card = handle.closest('.template-card'), id = Number(card.dataset.templateId), order = ids(), current = order.indexOf(id);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 :
      ['ArrowLeft', 'ArrowUp'].includes(event.key) ? current - 1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? current + 1 : null;
    if (index === null) return;
    event.preventDefault();
    cancel();
    void save(id, Math.max(0, Math.min(order.length - 1, index)));
  });
  document.addEventListener('keydown', event => { if (drag && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  window.addEventListener('blur', cancel);
  window.addEventListener('resize', cancel);
  return { cancel, refresh };
}
