export const UNIT_APPEARANCE_BYTE_BUDGETS = Object.freeze({ mobile: 8 * 1024 * 1024, desktop: 32 * 1024 * 1024 });

export function createUnitAppearanceSource(options = {}) {
  const scope = options.scope || globalThis;
  const files = options.files || scope.SpawnerUnitAppearanceFiles || {};
  const data = scope.SpawnerUnitAppearanceData ||= Object.create(null);
  const protocol = options.protocol || scope.location?.protocol || 'https:';
  const byteBudget = options.byteBudget ?? UNIT_APPEARANCE_BYTE_BUDGETS.desktop;
  if (!Number.isSafeInteger(byteBudget) || byteBudget <= 0) throw new RangeError('INVALID APPEARANCE SOURCE BUDGET');
  const fetchSource = options.fetch || ((...args) => scope.fetch(...args));
  const sourceUrl = options.sourceUrl || (path => path);
  const makeUrl = options.createObjectURL || (blob => scope.URL.createObjectURL(blob));
  const revokeUrl = options.revokeObjectURL || (url => scope.URL.revokeObjectURL(url));
  const loadScript = options.loadScript || (path => new Promise((resolve, reject) => {
    const script = scope.document.createElement('script'); script.src = path; script.async = true;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => { script.remove(); reject(new Error('APPEARANCE FILE SOURCE UNAVAILABLE: ' + path)); };
    scope.document.head.append(script);
  }));
  const decode = options.decode || (async uri => {
    const response = await fetchSource(uri);
    if (!response.ok) throw new Error('APPEARANCE DATA URI DECODE FAILED');
    return response.blob();
  });
  const verify = options.verify || (async (blob, expected) => {
    if (!expected || !scope.crypto?.subtle) return;
    const hash = await scope.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const actual = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw new Error('APPEARANCE SOURCE HASH MISMATCH');
  });
  const entries = new Map();
  let queue = Promise.resolve(), residentBytes = 0, reservedBytes = 0, peakBytes = 0, loads = 0;
  const account = () => { peakBytes = Math.max(peakBytes, residentBytes + reservedBytes); };
  function remove(path, entry) {
    if (entry.url) { revokeUrl(entry.url); entry.url = null; }
    if (entry.blob) { residentBytes -= entry.blob.size; entry.blob = null; }
    if (entries.get(path) === entry) entries.delete(path);
  }
  function reserve(bytes) {
    for (const [path, entry] of entries) {
      if (residentBytes + reservedBytes + bytes <= byteBudget) break;
      if (!entry.refs && entry.blob) remove(path, entry);
    }
    if (residentBytes + reservedBytes + bytes > byteBudget) throw new RangeError('APPEARANCE SOURCE BUDGET EXCEEDED');
    reservedBytes += bytes; account();
  }
  async function acquire(path) {
    const file = files[path];
    if (!file || !Number.isSafeInteger(file.bytes) || file.bytes <= 0) throw new Error('UNKNOWN APPEARANCE SOURCE: ' + path);
    let entry = entries.get(path);
    if (entry) { entries.delete(path); entries.set(path, entry); entry.refs++; }
    else {
      entry = { refs: 1, blob: null, url: null, discard: false };
      entries.set(path, entry);
      const current = entry;
      current.pending = queue.then(async () => {
        // Include transient base64 plus compressed bytes, or hashing's byte copy.
        const reservation = protocol === 'file:' ? Math.ceil(file.bytes / 3) * 4 + file.bytes + 128 : file.bytes * 2;
        reserve(reservation);
        try {
          let blob;
          if (protocol === 'file:') {
            delete data[path];
            try {
              await loadScript(file.script);
              let uri = data[path]; delete data[path];
              if (typeof uri !== 'string' || !uri.startsWith('data:' + file.mime + ';base64,') || uri.length > Math.ceil(file.bytes / 3) * 4 + 128)
                throw new Error('APPEARANCE ENCODED SOURCE MISMATCH: ' + path);
              blob = await decode(uri); uri = null;
            } finally { delete data[path]; }
          } else {
            const response = await fetchSource(sourceUrl(path));
            if (!response.ok) throw new Error('APPEARANCE SOURCE UNAVAILABLE: ' + path);
            blob = await response.blob();
          }
          if (blob.size !== file.bytes || blob.type !== file.mime) throw new Error('APPEARANCE SOURCE SIZE/TYPE MISMATCH: ' + path);
          await verify(blob, file.hash);
          current.blob = blob; residentBytes += blob.size; loads++;
          return current;
        } finally { reservedBytes -= reservation; account(); }
      });
      queue = current.pending.then(() => undefined, () => undefined);
    }
    try { await entry.pending; }
    catch (error) { entry.refs--; if (!entry.refs) remove(path, entry); throw error; }
    let released = false;
    return { blob: entry.blob,
      get url() {
        if (released) throw new Error('APPEARANCE SOURCE LEASE RELEASED');
        return entry.url ||= makeUrl(entry.blob);
      },
      release() {
        if (released) return;
        released = true; entry.refs--;
        if (!entry.refs && entry.discard) remove(path, entry);
      }
    };
  }
  function clear() {
    for (const [path, entry] of entries) {
      if (entry.refs) entry.discard = true;
      else remove(path, entry);
    }
  }
  return { acquire, clear, stats: () => ({ entries: entries.size, residentBytes, reservedBytes, byteBudget, peakBytes, loads,
    leases: [...entries.values()].reduce((sum, entry) => sum + entry.refs, 0) }) };
}
