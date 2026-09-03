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
    return;
  }
  const results = search(q);
  resultCount.textContent = results.length
    ? `${results.length} resultado${results.length === 1 ? '' : 's'}${results.length === 40 ? ' (mostrando los primeros 40)' : ''}`
    : 'Sin resultados';

  itemList.innerHTML = results.map((it) => itemCardHtml(it)).join('');
}

function itemCardHtml(it) {
  const price = priceOf(it, state.tier);
  const lowCentral = it.sc <= 0;
  const lowCde = it.sd <= 0;
  return `
    <div class="item-card" data-code="${escapeAttr(it.c)}">
      <div class="item-top">
        <span class="item-code">${escapeHtml(it.c)}</span>
      </div>
      <div class="item-desc">${escapeHtml(it.d)}</div>
      <div class="item-stock">
        <span class="stock-badge ${lowCentral ? 'low' : ''}">CENTRAL: ${it.sc}</span>
        <span class="stock-badge ${lowCde ? 'low' : ''}">CDE: ${it.sd}</span>
      </div>
      <div class="item-bottom">
        <span class="item-price">Gs. ${fmtMoney(price)}</span>
        <div class="item-actions">
          <input type="number" min="1" value="1" class="qty-input" data-qty-for="${escapeAttr(it.c)}">
          <button class="add-btn" data-add="${escapeAttr(it.c)}">Agregar</button>
        </div>
      </div>
    </div>
  `;
}

itemList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const code = btn.getAttribute('data-add');
  const qtyInput = itemList.querySelector(`[data-qty-for="${cssEscape(code)}"]`);
  const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  addLine(code, qty);
  qtyInput.value = 1;
  btn.textContent = 'Agregado ✓';
  setTimeout(() => { btn.textContent = 'Agregar'; }, 900);
});

let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderResults, 80);
});

// ---------- Pedido ----------
function addLine(code, qty) {
  const existing = state.lines.find((l) => l.code === code && l.tier === state.tier);
  if (existing) {
    existing.qty += qty;
  } else {
    state.lines.push({ code, qty, tier: state.tier });
  }
  saveState();
  syncArchiveFromDraft();
  renderOrder();
  updateFooter();
}

function removeLine(idx) {
  state.lines.splice(idx, 1);
  saveState();
  syncArchiveFromDraft();
  renderOrder();
  updateFooter();
}

function updateLineQty(idx, qty) {
  qty = Math.max(1, parseInt(qty, 10) || 1);
  state.lines[idx].qty = qty;
  saveState();
  syncArchiveFromDraft();
  renderOrder();
  updateFooter();
}

function updateLineTier(idx, tier) {
  state.lines[idx].tier = parseInt(tier, 10);
  saveState();
  syncArchiveFromDraft();
  renderOrder();
  updateFooter();
}

const orderList = document.getElementById('order-list');
const orderEmpty = document.getElementById('order-empty');
const tabOrderCount = document.getElementById('tab-order-count');

function lineSubtotal(line) {
  const item = byCode.get(line.code);
  if (!item) return 0;
  return priceOf(item, line.tier) * line.qty;
}

function renderOrder() {
  tabOrderCount.textContent = state.lines.length;
  if (!state.lines.length) {
    orderList.innerHTML = '';
    orderEmpty.style.display = 'block';
    return;
  }
  orderEmpty.style.display = 'none';
  orderList.innerHTML = state.lines
    .map((line, idx) => {
      const item = byCode.get(line.code);
      if (!item) return '';
      const subtotal = lineSubtotal(line);
      return `
        <div class="order-card">
          <div class="order-top">
            <div class="order-code-desc">
              <span class="item-code">${escapeHtml(item.c)}</span>
              <div class="item-desc">${escapeHtml(item.d)}</div>
            </div>
            <button class="order-remove" data-remove="${idx}" aria-label="Quitar">✕</button>
          </div>
          <div class="order-bottom">
            <select class="order-tier-select" data-tier-idx="${idx}">
              <option value="1" ${line.tier === 1 ? 'selected' : ''}>Precio 1: Gs. ${fmtMoney(item.p1)}</option>
              <option value="2" ${line.tier === 2 ? 'selected' : ''}>Precio 2: Gs. ${fmtMoney(item.p2)}</option>
              <option value="3" ${line.tier === 3 ? 'selected' : ''}>Precio 3: Gs. ${fmtMoney(item.p3)}</option>
            </select>
            <input type="number" min="1" value="${line.qty}" class="qty-input" data-qty-idx="${idx}">
            <span class="line-subtotal">Gs. ${fmtMoney(subtotal)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

orderList.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove]');
  if (rm) removeLine(parseInt(rm.getAttribute('data-remove'), 10));
});

orderList.addEventListener('change', (e) => {
  const qtyEl = e.target.closest('[data-qty-idx]');
  if (qtyEl) updateLineQty(parseInt(qtyEl.getAttribute('data-qty-idx'), 10), qtyEl.value);
  const tierEl = e.target.closest('[data-tier-idx]');
  if (tierEl) updateLineTier(parseInt(tierEl.getAttribute('data-tier-idx'), 10), tierEl.value);
});

// ---------- Footer / total ----------
const totalValueEl = document.getElementById('total-value');

function grandTotal() {
  return state.lines.reduce((sum, l) => sum + lineSubtotal(l), 0);
}

function updateFooter() {
  totalValueEl.textContent = `Gs. ${fmtMoney(grandTotal())}`;
}

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.panel');
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    panels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.getAttribute('data-panel')).classList.add('active');
  });
});

// ---------- Selector de precio (global) ----------
const tierButtons = document.querySelectorAll('.tier-btn');
tierButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tierButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.tier = parseInt(btn.getAttribute('data-tier'), 10);
    saveState();
    renderResults();
  });
});

// ---------- Campos de encabezado ----------
const vendedorInput = document.getElementById('vendedor-input');
const clienteInput = document.getElementById('cliente-input');
vendedorInput.addEventListener('input', () => { state.vendedor = vendedorInput.value; saveState(); syncArchiveFromDraft(); });
clienteInput.addEventListener('input', () => { state.cliente = clienteInput.value; saveState(); syncArchiveFromDraft(); });

// ---------- Nuevo pedido (archiva el actual en vez de borrarlo) ----------
document.getElementById('btn-clear').addEventListener('click', () => {
  if (!state.editingId && state.lines.length > 0) {
    // Pedido nuevo (no enganchado a uno del archivo) con contenido -> se archiva
    const entry = {
      id: generateId(),
      vendedor: state.vendedor,
      cliente: state.cliente,
      lines: JSON.parse(JSON.stringify(state.lines)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    archive.unshift(entry);
    saveArchive();
    showToast('Pedido archivado ✓');
  } else if (state.editingId) {
    const stillExists = archive.some((o) => o.id === state.editingId);
    showToast(stillExists ? 'Cambios guardados en el archivo ✓' : 'El pedido quedó vacío y se eliminó del archivo');
  }

  const keepVendedor = state.vendedor;
  state = { tier: 1, vendedor: keepVendedor, cliente: '', lines: [], editingId: null };
  saveState();
  vendedorInput.value = state.vendedor || '';
  clienteInput.value = '';
  tierButtons.forEach((b) => b.classList.toggle('active', parseInt(b.getAttribute('data-tier'), 10) === state.tier));
  renderOrder();
  updateFooter();
  renderArchive();
  renderEditingBanner();
});

// ---------- Archivo de pedidos ----------
const archiveList = document.getElementById('archive-list');
const archiveEmpty = document.getElementById('archive-empty');
const tabArchiveCount = document.getElementById('tab-archive-count');

function archiveOrderTotal(entry) {
  return entry.lines.reduce((sum, line) => {
    const item = byCode.get(line.code);
    if (!item) return sum;
    return sum + priceOf(item, line.tier) * line.qty;
  }, 0);
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-PY')} ${d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}`;
}

function renderArchive() {
  tabArchiveCount.textContent = archive.length;
  if (!archive.length) {
    archiveList.innerHTML = '';
    archiveEmpty.style.display = 'block';
    return;
  }
  archiveEmpty.style.display = 'none';
  archiveList.innerHTML = archive
    .map((entry) => {
      const total = archiveOrderTotal(entry);
      const isEditing = state.editingId === entry.id;
      return `
        <div class="archive-card ${isEditing ? 'editing' : ''}">
          <div class="archive-top">
            <div>
              <div class="archive-client">${escapeHtml(entry.cliente || 'Sin cliente')}</div>
              <div class="archive-meta">${escapeHtml(entry.vendedor || '-')} · ${fmtDateTime(entry.updatedAt)}</div>
            </div>
            <div class="archive-total">Gs. ${fmtMoney(total)}</div>
          </div>
          <div class="archive-sub">${entry.lines.length} artículo${entry.lines.length === 1 ? '' : 's'}${isEditing ? ' · Editando ahora' : ''}</div>
          <div class="archive-actions">
            <button class="btn-outline btn-sm" data-edit="${escapeAttr(entry.id)}">Editar</button>
            <button class="btn-outline btn-sm" data-reuse="${escapeAttr(entry.id)}">Reutilizar</button>
            <button class="btn-outline btn-sm danger" data-delete="${escapeAttr(entry.id)}">Eliminar</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function switchToTab(panelId) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-panel') === panelId));
  panels.forEach((p) => p.classList.toggle('active', p.id === panelId));
}

function loadArchivedForEdit(id) {
  const entry = archive.find((o) => o.id === id);
  if (!entry) return;
  state = {
    tier: state.tier,
    vendedor: entry.vendedor,
    cliente: entry.cliente,
    lines: JSON.parse(JSON.stringify(entry.lines)),
    editingId: entry.id,
  };
  saveState();
  vendedorInput.value = state.vendedor || '';
  clienteInput.value = state.cliente || '';
  renderOrder();
  updateFooter();
  renderArchive();
  renderEditingBanner();
  switchToTab('panel-order');
  showToast(`Editando pedido de ${entry.cliente || 'cliente'}`);
}

function reuseArchived(id) {
  const entry = archive.find((o) => o.id === id);
  if (!entry) return;
  state = {
    tier: state.tier,
    vendedor: entry.vendedor,
    cliente: entry.cliente,
    lines: JSON.parse(JSON.stringify(entry.lines)),
    editingId: null,
  };
  saveState();
  vendedorInput.value = state.vendedor || '';
  clienteInput.value = state.cliente || '';
  renderOrder();
  updateFooter();
  renderArchive();
  renderEditingBanner();
  switchToTab('panel-order');
  showToast('Pedido cargado como pedido nuevo');
}

function confirmDeleteArchived(id) {
  const entry = archive.find((o) => o.id === id);
  if (!entry) return;
  openModal(
    'Eliminar pedido archivado',
    `Se va a borrar definitivamente el pedido de "${entry.cliente || 'sin cliente'}". Esta acción no se puede deshacer.`,
    [
      { label: 'Cancelar', variant: 'outline', action: closeModal },
      {
        label: 'Eliminar',
        variant: 'primary',
        action: () => {
          archive = archive.filter((o) => o.id !== id);
          saveArchive();
          if (state.editingId === id) {
            state.editingId = null;
            saveState();
          }
          renderArchive();
          renderEditingBanner();
          closeModal();
        },
      },
    ]
  );
}

archiveList.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit]');
  const reuseBtn = e.target.closest('[data-reuse]');
  const delBtn = e.target.closest('[data-delete]');
  if (editBtn) loadArchivedForEdit(editBtn.getAttribute('data-edit'));
  if (reuseBtn) reuseArchived(reuseBtn.getAttribute('data-reuse'));
  if (delBtn) confirmDeleteArchived(delBtn.getAttribute('data-delete'));
});

// ---------- Banner "editando pedido archivado" ----------
const editingBanner = document.getElementById('editing-banner');
const editingBannerText = document.getElementById('editing-banner-text');

function renderEditingBanner() {
  if (state.editingId) {
    const entry = archive.find((o) => o.id === state.editingId);
    editingBannerText.textContent = `Editando pedido guardado${entry && entry.cliente ? ' de ' + entry.cliente : ''}`;
    editingBanner.style.display = 'flex';
  } else {
    editingBanner.style.display = 'none';
  }
}

document.getElementById('editing-banner-exit').addEventListener('click', () => {
  state.editingId = null;
  saveState();
  renderEditingBanner();
  renderArchive();
});

// ---------- Toast ----------
const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ---------- Generar y compartir PDF (sin pasar por "guardar" primero) ----------
document.getElementById('btn-pdf').addEventListener('click', async () => {
  if (!state.lines.length) {
    openModal('El pedido está vacío', 'Agregá al menos un artículo antes de generar el comprobante.', [
      { label: 'Entendido', variant: 'primary', action: closeModal },
    ]);
    return;
  }

  const btn = document.getElementById('btn-pdf');
  const originalLabel = btn.textContent;
  btn.textContent = 'Generando...';
  btn.disabled = true;

  try {
    const bytes = generatePdfBytes(state);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const fecha = new Date().toISOString().slice(0, 10);
    const clienteSlug = (state.cliente || 'pedido').trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    const fileName = `pedido_${clienteSlug || 'sin_cliente'}_${fecha}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Pedido',
          text: `Pedido${state.cliente ? ' - ' + state.cliente : ''}`,
        });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // el usuario cerró el panel de compartir
        // si falla el share por otro motivo, seguimos con la descarga directa
      }
    }

    // Fallback: navegadores sin Web Share API con archivos (ej. desktop) -> se descarga directo
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } finally {
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
});

// ---------- Generador de PDF (sin librerías externas, 100% offline) ----------
function generatePdfBytes(orderState) {
  const marginLeft = 40;
  const marginTop = 800;
  const marginBottom = 50;
  const rowHeight = 18;

  const pages = [];
  let currentLines = [];
  let y = marginTop;

  function pushPage() {
    if (currentLines.length) pages.push(currentLines);
    currentLines = [];
  }

  function drawTableHeader() {
    currentLines.push({ x: marginLeft, y, size: 11, bold: true, font: 'mono', text: padCol('CÓDIGO', 10) });
    currentLines.push({ x: marginLeft + 68, y, size: 11, bold: true, font: 'sans', text: 'DESCRIPCIÓN' });
    currentLines.push({ x: 335, y, size: 11, bold: true, font: 'mono', text: padCol('CANT.', 5, true) });
    currentLines.push({ x: 375, y, size: 11, bold: true, font: 'mono', text: padCol('PRECIO', 12, true) });
    currentLines.push({ x: 462, y, size: 11, bold: true, font: 'mono', text: padCol('SUBTOTAL', 13, true) });
    y -= 12;
    currentLines.push({ x: marginLeft, y, size: 9, bold: false, font: 'mono', text: '-'.repeat(80) });
    y -= 18;
  }

  function ensureSpace() {
    if (y - rowHeight < marginBottom) {
      pushPage();
      y = marginTop;
      drawTableHeader();
    }
  }

  currentLines.push({ x: marginLeft, y, size: 19, bold: true, font: 'sans', text: 'PEDIDO' });
  y -= 26;
  currentLines.push({ x: marginLeft, y, size: 12, bold: false, font: 'sans', text: `Vendedor: ${orderState.vendedor || '-'}` });
  y -= 17;
  currentLines.push({ x: marginLeft, y, size: 12, bold: false, font: 'sans', text: `Cliente: ${orderState.cliente || '-'}` });
  y -= 17;
  currentLines.push({ x: marginLeft, y, size: 12, bold: false, font: 'sans', text: `Fecha: ${new Date().toLocaleDateString('es-PY')}` });
  y -= 26;
  drawTableHeader();

  orderState.lines.forEach((line) => {
    const item = byCode.get(line.code);
    if (!item) return;
    const price = priceOf(item, line.tier);
    const subtotal = price * line.qty;
    ensureSpace();
    currentLines.push({ x: marginLeft, y, size: 10.5, bold: false, font: 'mono', text: padCol(item.c, 10) });
    currentLines.push({ x: marginLeft + 68, y, size: 10.5, bold: false, font: 'sans', text: truncate(item.d, 33) });
    currentLines.push({ x: 335, y, size: 10.5, bold: false, font: 'mono', text: padCol(String(line.qty), 5, true) });
    currentLines.push({ x: 375, y, size: 10.5, bold: false, font: 'mono', text: padCol(fmtMoney(price), 12, true) });
    currentLines.push({ x: 462, y, size: 10.5, bold: false, font: 'mono', text: padCol(fmtMoney(subtotal), 13, true) });
    y -= rowHeight;
  });

  if (y - 40 < marginBottom) {
    pushPage();
    y = marginTop;
  }
  y -= 22;
  currentLines.push({ x: 375, y, size: 14, bold: true, font: 'sans', text: 'TOTAL' });
  currentLines.push({ x: 462, y, size: 14, bold: true, font: 'mono', text: padCol('Gs. ' + fmtMoney(grandTotal()), 16, true) });

  pushPage();
  return buildPdfFromPages(pages);
}

function padCol(str, width, right) {
  str = String(str);
  if (str.length > width) str = str.slice(0, width);
  return right ? str.padStart(width, ' ') : str.padEnd(width, ' ');
}

function truncate(str, max) {
  str = String(str);
  return str.length > max ? str.slice(0, max - 1) + '...' : str;
}

function buildPdfFromPages(pages) {
  const objects = [];
  objects[0] = null; // 1: Catalog
  objects[1] = null; // 2: Pages
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'; // 3: F1
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'; // 4: F2
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'; // 5: F3
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'; // 6: F4

  const kids = [];
  pages.forEach((lines) => {
    const content = buildContentStream(lines);
    const contentObjNum = objects.length + 1;
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageObjNum = objects.length + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${contentObjNum} 0 R >>`
    );
    kids.push(pageObjNum);
  });

  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';

  return assemblePdf(objects);
}

function buildContentStream(lines) {
  let out = 'BT\n';
  lines.forEach((l) => {
    const fontTag = l.font === 'mono' ? (l.bold ? '/F4' : '/F3') : l.bold ? '/F2' : '/F1';
    out += `${fontTag} ${l.size} Tf\n`;
    out += `1 0 0 1 ${l.x} ${l.y} Tm\n`;
    out += `(${pdfEscapeText(l.text)}) Tj\n`;
  });
  out += 'ET';
  return out;
}

function assemblePdf(objects) {
  const objStrs = objects.map((body, idx) => `${idx + 1} 0 obj\n${body}\nendobj\n`);
  let out = '%PDF-1.4\n';
  const offsets = [];
  objStrs.forEach((s) => {
    offsets.push(out.length);
    out += s;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objStrs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    out += String(off).padStart(10, '0') + ' 00000 n \n';
  });
  out += `trailer\n<< /Size ${objStrs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return strToBytes(out);
}

function strToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
}

function pdfEscapeText(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code > 0xff) code = 0x3f; // caracteres fuera de Latin-1 -> '?'
    const c = String.fromCharCode(code);
    if (c === '(' || c === ')' || c === '\\') out += '\\' + c;
    else out += c;
  }
  return out;
}

// ---------- Modal genérico ----------
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalActions = document.getElementById('modal-actions');

function openModal(title, text, actions) {
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalActions.innerHTML = '';
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.className = `btn ${a.variant === 'primary' ? 'btn-primary' : 'btn-outline'}`;
    btn.textContent = a.label;
    btn.addEventListener('click', a.action);
    modalActions.appendChild(btn);
  });
  modalBackdrop.classList.add('open');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
}

modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

// ---------- Utilidades ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }
function cssEscape(str) {
  return String(str).replace(/["\\]/g, '\\$&');
}

// ---------- Init ----------
loadArchive();
loadState();
vendedorInput.value = state.vendedor || '';
clienteInput.value = state.cliente || '';
tierButtons.forEach((b) => b.classList.toggle('active', parseInt(b.getAttribute('data-tier'), 10) === state.tier));
renderOrder();
updateFooter();
renderArchive();
renderEditingBanner();

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
