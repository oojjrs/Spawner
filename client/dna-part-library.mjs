import { dnaPartValidate } from './dna-parts.mjs';
import { renderDnaComposition } from './dna-editor.mjs';

export const DNA_PART_STORAGE_KEY = 'spawner.dna.parts.v1';

export function createDnaPartStore(M, storage) {
  let entries = [];
  function load() {
    try {
      const source = storage.getItem(DNA_PART_STORAGE_KEY);
      if (source === null) { entries = []; return entries; }
      if (source.length > 2000000) return entries;
      const values = JSON.parse(source);
      if (!Array.isArray(values) || values.length > 256) return entries;
      const ids = new Set();
      entries = values.flatMap(value => {
        if (!value || typeof value.id !== 'string' || !value.id || ids.has(value.id) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 32) return [];
        const part = dnaPartValidate(M, value.part);
        if (!part) return [];
        ids.add(value.id);
        return [{ id: value.id, name: value.name, part }];
      });
    } catch {}
    return entries;
  }
  function persist(next) {
    try {
      const value = JSON.stringify(next);
      if (value.length > 2000000 || next.length > 256) return false;
      storage.setItem(DNA_PART_STORAGE_KEY, value);
      entries = next;
      return true;
    } catch { return false; }
  }
  function save(value, name) {
    load();
    const part = dnaPartValidate(M, value), label = String(name || '').trim();
    if (!part || !label || label.length > 32) return false;
    let id;
    do { id = globalThis.crypto.randomUUID(); } while (entries.some(entry => entry.id === id));
    return persist([...entries, { id, name: label, part }]);
  }
  function remove(id) { load(); return persist(entries.filter(entry => entry.id !== id)); }
  return { load, save, remove };
}

export function createDnaPartLibrary(container, M, editor) {
  let storage;
  try { storage = globalThis.localStorage; } catch { storage = { getItem() { return null; }, setItem() { throw new Error(); } }; }
  const store = createDnaPartStore(M, storage);
  let selected = null, destroyed = false;
  const list = document.createElement('div'), status = document.createElement('output');
  list.className = 'dna-part-list';
  status.className = 'dna-part-library-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  container.append(list, status);
  function measure() {
    if (destroyed || container.hidden) return;
    const rows = [...list.children], count = Math.max(1, Number(container.dataset.visibleParts) || 3), last = rows[Math.min(count, rows.length) - 1];
    if (!last || !last.offsetHeight) return;
    const height = last.offsetTop + last.offsetHeight - rows[0].offsetTop, value = height + 'px';
    if (list.style.maxHeight !== value) list.style.maxHeight = value;
  }
  const observer = new ResizeObserver(measure);
  observer.observe(container);
  observer.observe(list);
  if (container.parentElement) observer.observe(container.parentElement);
  function render() {
    if (destroyed) return;
    const fragment = document.createDocumentFragment();
    for (const entry of store.load()) {
      const row = document.createElement('div'), preview = document.createElement('div'), name = document.createElement('strong'), actions = document.createElement('div');
      row.className = 'dna-part-row';
      row.dataset.id = entry.id;
      row.dataset.selected = String(selected === entry.id);
      preview.className = 'dna-part-miniature';
      renderDnaComposition(preview, M, entry.part);
      name.textContent = entry.name;
      actions.className = 'dna-part-row-actions';
      const load = document.createElement('button'), remove = document.createElement('button');
      load.type = remove.type = 'button';
      load.textContent = '불러오기';
      remove.textContent = '삭제';
      load.disabled = entry.part.pieces.some(piece => M.lookup.get(piece.gene)?.retired);
      load.setAttribute('aria-pressed', String(selected === entry.id));
      load.onclick = () => { if (!editor.selectPart(entry.part)) return; selected = entry.id; status.hidden = true; render(); };
      remove.onclick = () => {
        if (!store.remove(entry.id)) { status.textContent = '저장하지 못했습니다'; status.hidden = false; return; }
        if (selected === entry.id) selected = null;
        status.hidden = true;
        render();
      };
      actions.append(load, remove);
      row.append(preview, name, actions);
      fragment.append(row);
    }
    list.replaceChildren(fragment);
    container.hidden = !list.children.length;
    measure();
  }
  editor.partSave((part, name) => {
    if (!store.save(part, name)) return false;
    status.hidden = true;
    selected = store.load().at(-1)?.id || selected;
    render();
    const savedRow = list.lastElementChild;
    if (savedRow) list.scrollTop = Math.max(0, savedRow.offsetTop - list.offsetTop + savedRow.offsetHeight - list.clientHeight);
    container.dispatchEvent(new CustomEvent('dna-part-saved'));
    return true;
  });
  function synchronize(event) { if (event.key === DNA_PART_STORAGE_KEY || event.key === null) render(); }
  globalThis.addEventListener('storage', synchronize);
  render();
  return { render, destroy() { destroyed = true; observer.disconnect(); globalThis.removeEventListener('storage', synchronize); editor.partSave(null); container.replaceChildren(); } };
}
