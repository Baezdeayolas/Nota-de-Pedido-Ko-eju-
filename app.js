// ---------- Estado ----------
const STORAGE_KEY = 'pedido_actual_v1';
const ARCHIVE_KEY = 'pedidos_archivo_v1';

let state = {
  tier: 1, // 1, 2 o 3 (default para nuevas líneas)
  vendedor: '',
  cliente: '',
  lines: [], // { code, qty, tier }
  editingId: null, // si no es null, este borrador está sincronizado en vivo con un pedido del archivo
};

let archive = []; // [{ id, vendedor, cliente, lines, createdAt, updatedAt }]

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = Object.assign(state, saved);
    }
  } catch (e) { /* ignore */ }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

function loadArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    archive = raw ? JSON.parse(raw) : [];
  } catch (e) {
    archive = [];
  }
}

function saveArchive() {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  } catch (e) { /* ignore */ }
}

function generateId() {
  return 'o_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Si el borrador actual está "enganchado" a un pedido del archivo (editingId),
// cada cambio se refleja ahí mismo en vivo. Si el pedido queda sin líneas, se borra del archivo.
function syncArchiveFromDraft() {
  if (!state.editingId) return;
  const idx = archive.findIndex((o) => o.id === state.editingId);
  if (!state.lines.length) {
    if (idx !== -1) archive.splice(idx, 1);
  } else {
    const entry = {
      id: state.editingId,
      vendedor: state.vendedor,
      cliente: state.cliente,
      lines: JSON.parse(JSON.stringify(state.lines)),
      createdAt: idx !== -1 ? archive[idx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) archive[idx] = entry;
    else archive.unshift(entry);
  }
  saveArchive();
  renderArchive();
}

// ---------- Índice de búsqueda ----------
const byCode = new Map();
ITEMS.forEach((it) => byCode.set(it.c, it));

function priceOf(item, tier) {
  return tier === 1 ? item.p1 : tier === 2 ? item.p2 : item.p3;
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('es-PY', { maximumFractionDigits: 0 });
}

function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    if (
      it.c.toLowerCase().includes(q) ||
      (it.b && it.b.toLowerCase().includes(q)) ||
      it.d.toLowerCase().includes(q)
    ) {
      results.push(it);
      if (results.length >= 40) break;
    }
  }
  return results;
}

// ---------- Render: búsqueda ----------
const searchInput = document.getElementById('search-input');
const itemList = document.getElementById('item-list');
const resultCount = document.getElementById('result-count');

function renderResults() {
  const q = searchInput.value;
  if (!q.trim()) {
    itemList.innerHTML = '';
    resultCount.textContent = '';
