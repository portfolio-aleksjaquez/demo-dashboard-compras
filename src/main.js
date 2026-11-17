// Application entry point: owns the state, wires the components together and
// persists everything to localStorage.

import {
  hasStoredProducts, loadDemoMeta, loadFilters, loadProducts, saveDemoMeta, saveFilters, saveProducts,
} from "./utils/storage.js";
import { buildDemoProducts, signature } from "./utils/demoSeed.js";
import { restoreJsonBackup } from "./utils/restoreJsonBackup.js";
import { blankDraft, commitTicket, draftFromTicket, draftsFromMarkdown } from "./utils/ticketDraft.js";
import { buildCategoryMemory, distinctLabels, groupTickets, labelResolver, ticketKey } from "./utils/tickets.js";
import { buildAiPrompt } from "./utils/aiPrompt.js";
import { escapeHtml, getPeriodRange, migratePeriod, normalizeText, round2, today, uid } from "./utils/helpers.js";

import { renderDemoNotice } from "./components/DemoNotice.js";
import { renderHeaderActions } from "./components/HeaderActions.js";
import { renderImporter } from "./components/Importer.js";
import { renderPeriodBar } from "./components/PeriodBar.js";
import { renderDashboardSummary } from "./components/DashboardSummary.js";
import { renderFilters, updateFilterOptions } from "./components/Filters.js";
import { renderTicketList } from "./components/TicketList.js";
import { renderProductTable } from "./components/ProductTable.js";
import { renderPurchaseStatistics } from "./components/PurchaseStatistics.js";
import { openTicketEditor } from "./components/TicketEditor.js";
import { confirmDialog, openDialog } from "./components/Dialog.js";
import { showToast } from "./components/Toast.js";

// --- State -----------------------------------------------------------------

const PAGE_SIZE = { tickets: 10, products: 50 };
const NUMERIC_SORTS = new Set(["cantidad", "precioUnitario", "total"]);

const DEFAULT_FILTERS = {
  search: "",
  store: "",
  category: "",
  period: "all",
  customFrom: "",
  customTo: "",
  sortBy: "fecha",
  sortDir: "desc",
  view: "tickets",
  groupBy: "week",
};

function initialFilters() {
  const filters = { ...DEFAULT_FILTERS, ...loadFilters() };
  filters.period = migratePeriod(filters.period);
  if (!["tickets", "products"].includes(filters.view)) filters.view = "tickets";
  return filters;
}

// Demo: con localStorage vacío se carga la semilla. Si el historial sigue
// siendo exactamente la semilla de un día anterior, se regenera para que las
// fechas relativas se vean recientes.
function initialProducts() {
  const stored = loadProducts();
  const meta = loadDemoMeta();
  const first = !hasStoredProducts();
  const stale = meta && meta.seededOn !== today() && meta.signature === signature(stored);
  if (!first && !stale) return stored;
  const seed = buildDemoProducts({ uid });
  if (saveProducts(seed)) saveDemoMeta({ seededOn: today(), signature: signature(seed) });
  return seed;
}

const state = {
  products: initialProducts(),
  filters: initialFilters(),
  editingId: null,
  openTickets: new Set(),
  limits: { ...PAGE_SIZE },
  editorOpen: false,
};

const els = {
  headerActions: document.getElementById("header-actions"),
  demoNotice: document.getElementById("demo-notice"),
  importer: document.getElementById("importer"),
  periodBar: document.getElementById("period-bar"),
  summary: document.getElementById("summary"),
  filters: document.getElementById("filters"),
  list: document.getElementById("list"),
  listCaption: document.getElementById("list-caption"),
  purchasesPanel: document.getElementById("purchases-panel"),
  statisticsPanel: document.getElementById("statistics-panel"),
  statistics: document.getElementById("statistics"),
};

function persistFilters() {
  saveFilters(state.filters);
}

// --- Derived data ----------------------------------------------------------

function isFiltered() {
  const { search, store, category, period, customFrom, customTo } = state.filters;
  return Boolean(search.trim() || store || category || getPeriodRange(period, { from: customFrom, to: customTo }));
}

function getVisibleProducts() {
  const { search, store, category, period, customFrom, customTo, sortBy, sortDir } = state.filters;
  const term = normalizeText(search);
  const storeKey = normalizeText(store);
  const categoryKey = normalizeText(category);
  const range = getPeriodRange(period, { from: customFrom, to: customTo });

  const list = state.products.filter((p) => {
    if (term && !normalizeText(p.producto).includes(term)) return false;
    if (storeKey && normalizeText(p.tienda) !== storeKey) return false;
    if (categoryKey && normalizeText(p.categoria) !== categoryKey) return false;
    if (range && (!p.fecha || p.fecha < range[0] || p.fecha > range[1])) return false;
    return true;
  });

  const dir = sortDir === "asc" ? 1 : -1;
  return list.sort((a, b) => {
    const result = NUMERIC_SORTS.has(sortBy)
      ? (Number(a[sortBy]) || 0) - (Number(b[sortBy]) || 0)
      : String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""), "es", { numeric: true });
    return result * dir;
  });
}

function findTicket(key) {
  return groupTickets(state.products).find((ticket) => ticket.key === key);
}

// --- Rendering -------------------------------------------------------------

function render() {
  const hasData = state.products.length > 0;
  document.querySelectorAll("[data-requires-data]").forEach((el) => { el.hidden = !hasData; });
  document.querySelectorAll("[data-when-empty]").forEach((el) => { el.hidden = hasData; });

  const { filters } = state;
  renderPeriodBar(els.periodBar, { ...filters, onChange: handleFilterChange });

  const visible = getVisibleProducts();
  const allTickets = groupTickets(state.products);
  const fullCounts = new Map(allTickets.map((ticket) => [ticket.key, ticket.products.length]));
  const visibleTickets = groupTickets(visible).map((ticket) => ({ ...ticket, fullCount: fullCounts.get(ticket.key) }));

  renderDashboardSummary(els.summary, {
    tickets: visibleTickets,
    allTicketCount: allTickets.length,
    allSpent: allTickets.reduce((sum, ticket) => sum + ticket.total, 0),
    filtered: isFiltered(),
  });

  updateFilterOptions(els.filters, {
    stores: distinctLabels(state.products, "tienda"),
    categories: distinctLabels(state.products, "categoria"),
    filters,
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.view === filters.view));
  });
  const ticketWord = visibleTickets.length === 1 ? "ticket" : "tickets";
  const productWord = visible.length === 1 ? "producto" : "productos";
  els.listCaption.textContent = `${visibleTickets.length} ${ticketWord} · ${visible.length} ${productWord}`;

  if (filters.view === "tickets") {
    renderTicketList(els.list, {
      tickets: visibleTickets,
      limit: state.limits.tickets,
      openKeys: state.openTickets,
      onToggle: handleToggleTicket,
      onEdit: (ticket) => handleEditTicket(ticket.key),
      onDelete: (ticket) => handleDeleteTicket(ticket.key),
      onShowMore: () => showMore("tickets"),
    });
  } else {
    renderProductTable(els.list, {
      products: visible,
      editingId: state.editingId,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      limit: state.limits.products,
      onSort: handleSort,
      onShowMore: () => showMore("products"),
      onEdit: handleEdit,
      onSave: handleSave,
      onCancel: handleCancel,
      onDelete: handleDelete,
    });
  }

  renderPurchaseStatistics(els.statistics, {
    products: state.products,
    period: filters.period,
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    groupBy: filters.groupBy,
    onGroupByChange: (groupBy) => handleFilterChange({ groupBy }),
  });
}

function renderShell() {
  renderHeaderActions(els.headerActions, {
    onNewTicket: () => openEditor([blankDraft()]),
    onBackup: exportJson,
    onRestore: handleRestoreJson,
    onReport: exportMarkdown,
    onClearAll: handleClearAll,
  });
  renderDemoNotice(els.demoNotice, { onReset: handleResetDemo });
  renderImporter(els.importer, {
    onText: handleImportText,
    onFiles: handleFiles,
    onCopyPrompt: handleCopyPrompt,
    onManual: () => openEditor([blankDraft()]),
  });
  renderFilters(els.filters, { filters: state.filters, onChange: handleFilterChange, onClear: handleClearFilters });

  document.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => handleTabChange(tab.dataset.tab));
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => handleFilterChange({ view: button.dataset.view }));
  });

  document.addEventListener("paste", handleGlobalPaste);
  setupFileDrop();
}

function handleTabChange(tabName) {
  if (!["purchases", "statistics"].includes(tabName)) return;
  els.purchasesPanel.hidden = tabName !== "purchases";
  els.statisticsPanel.hidden = tabName !== "statistics";
  // The period applies to both tabs, so its bar follows the active one.
  if (tabName === "purchases") els.summary.before(els.periodBar);
  else els.statistics.before(els.periodBar);
  document.querySelectorAll("[data-tab]").forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("app-tab--active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

// --- Changes with undo -----------------------------------------------------

let undoVersion = 0;

/** Undo for the latest change only: older snapshots would discard newer work. */
function undoAction(previous) {
  const version = ++undoVersion;
  return {
    actionLabel: "Deshacer",
    onAction: () => {
      if (version !== undoVersion) {
        showToast("Solo se puede deshacer el último cambio.", "info");
        return;
      }
      undoVersion += 1;
      if (!saveProducts(previous)) {
        showToast("No se pudo deshacer el cambio.", "error");
        return;
      }
      state.products = previous;
      state.editingId = null;
      render();
      showToast("Cambio deshecho.", "info");
    },
  };
}

/** Save a new product list, re-render and offer to undo. */
function applyChange(next, message) {
  const previous = state.products;
  if (!saveProducts(next)) {
    showToast("No se pudo guardar el historial. Inténtalo de nuevo.", "error");
    return false;
  }
  state.products = next;
  state.editingId = null;
  render();
  showToast(message, "success", 8000, undoAction(previous));
  return true;
}

// --- Adding and editing tickets --------------------------------------------

function openEditor(drafts) {
  if (state.editorOpen || drafts.length === 0) return;
  state.editorOpen = true;
  openTicketEditor({
    drafts,
    stores: distinctLabels(state.products, "tienda"),
    categories: distinctLabels(state.products, "categoria"),
    productNames: distinctLabels(state.products, "producto"),
    rememberCategory: buildCategoryMemory(state.products),
    onSave: saveDraft,
    onDone: () => {
      state.editorOpen = false;
    },
  });
}

function saveDraft(draft) {
  const previous = state.products;
  const outcome = commitTicket(draft, state.products, { saveProducts, uid });
  if (outcome.status === "committed") {
    state.products = outcome.products;
    render();
    showToast(outcome.message, "success", 8000, undoAction(previous));
  }
  return outcome;
}

function handleImportText(text, source) {
  const { drafts, errors } = draftsFromMarkdown(text, { sourceLabel: source, existingProducts: state.products });
  errors.forEach((error) => showToast(error, "error", 7000));
  openEditor(drafts);
}

async function handleFiles(files) {
  const texts = await Promise.all(files.map(async (file) => {
    try {
      return { name: file.name, text: await file.text() };
    } catch {
      return { name: file.name, text: "" };
    }
  }));
  const drafts = [];
  for (const { name, text } of texts) {
    const result = draftsFromMarkdown(text, { sourceLabel: name, existingProducts: state.products });
    drafts.push(...result.drafts);
    result.errors.forEach((error) => showToast(error, "error", 7000));
  }
  openEditor(drafts);
}

function handleGlobalPaste(event) {
  if (state.editorOpen || document.querySelector("dialog[open]")) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (!text.trim()) return;
  event.preventDefault();
  handleImportText(text, "Contenido pegado");
}

function setupFileDrop() {
  let depth = 0;
  const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes("Files");
  const stop = () => {
    depth = 0;
    document.body.classList.remove("is-dragging");
  };
  window.addEventListener("dragenter", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth += 1;
    document.body.classList.add("is-dragging");
  });
  window.addEventListener("dragover", (event) => {
    if (hasFiles(event)) event.preventDefault();
  });
  window.addEventListener("dragleave", (event) => {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) stop();
  });
  window.addEventListener("drop", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    stop();
    handleFiles([...event.dataTransfer.files]);
  });
}

async function handleCopyPrompt() {
  const prompt = buildAiPrompt({
    stores: distinctLabels(state.products, "tienda"),
    categories: distinctLabels(state.products, "categoria").filter((c) => c !== "Sin categoría"),
  });
  try {
    await navigator.clipboard.writeText(prompt);
    showToast("Prompt copiado. Pégalo en tu IA junto con la foto del ticket.", "success", 5000);
  } catch {
    const closed = openDialog({
      title: "Prompt para la IA",
      body: `<p class="dialog__text">Cópialo y pégalo en tu IA junto con la foto del ticket:</p>
        <textarea class="textarea dialog__prompt" rows="14" readonly>${escapeHtml(prompt)}</textarea>`,
      actions: [{ label: "Listo", value: "ok", variant: "primary" }],
    });
    document.querySelector("dialog[open] .dialog__prompt")?.select();
    await closed;
  }
}

function handleEditTicket(key) {
  const ticket = findTicket(key);
  if (ticket) openEditor([draftFromTicket(ticket)]);
}

function handleDeleteTicket(key) {
  const ticket = findTicket(key);
  if (!ticket) return;
  state.openTickets.delete(key);
  applyChange(state.products.filter((p) => ticketKey(p) !== key), `Ticket de ${ticket.store} eliminado.`);
}

function handleToggleTicket(key) {
  if (state.openTickets.has(key)) state.openTickets.delete(key);
  else state.openTickets.add(key);
  render();
}

// --- Filters, sorting and pagination ---------------------------------------

function handleFilterChange(patch) {
  Object.assign(state.filters, patch);
  state.limits = { ...PAGE_SIZE };
  persistFilters();
  render();
}

function handleClearFilters() {
  handleFilterChange({ search: "", store: "", category: "", period: "all", customFrom: "", customTo: "" });
}

function handleSort(key) {
  const { sortBy, sortDir } = state.filters;
  const defaultDir = NUMERIC_SORTS.has(key) || key === "fecha" ? "desc" : "asc";
  const nextDir = key === sortBy ? (sortDir === "asc" ? "desc" : "asc") : defaultDir;
  handleFilterChange({ sortBy: key, sortDir: nextDir });
}

function showMore(kind) {
  state.limits[kind] += PAGE_SIZE[kind];
  render();
}

// --- Single product edits --------------------------------------------------

function handleEdit(id) {
  state.editingId = id;
  render();
}

function handleCancel() {
  state.editingId = null;
  render();
}

function handleSave(id, values) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;

  const producto = String(values.producto ?? "").trim();
  if (!producto) {
    showToast("El nombre del producto no puede estar vacío.", "error");
    return;
  }

  const others = state.products.filter((p) => p.id !== id);
  const cantidad = Math.max(Number(values.cantidad) || 0, 0);
  const precioUnitario = Math.max(Number(values.precioUnitario) || 0, 0);
  const updated = {
    ...product,
    producto,
    tienda: labelResolver(distinctLabels(others, "tienda"))(values.tienda) || product.tienda,
    categoria: labelResolver(distinctLabels(others, "categoria"))(values.categoria) || "Sin categoría",
    fecha: values.fecha || product.fecha,
    cantidad,
    precioUnitario,
    total: round2(cantidad * precioUnitario),
  };

  applyChange(state.products.map((p) => (p.id === id ? updated : p)), "Producto actualizado.");
}

function handleDelete(id) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  applyChange(state.products.filter((p) => p.id !== id), `"${product.producto}" eliminado.`);
}

// --- Data menu -------------------------------------------------------------

async function handleRestoreJson(file) {
  let text;
  try {
    text = await file.text();
  } catch {
    showToast("No se pudo leer el archivo de respaldo.", "error");
    return;
  }
  const confirmed = await confirmDialog({
    title: "Restaurar respaldo",
    message: `Se reemplazará todo el historial actual por el contenido de "${file.name}". Podrás deshacerlo justo después.`,
    confirmLabel: "Restaurar",
    danger: true,
  });
  if (!confirmed) return;

  const previous = state.products;
  const outcome = restoreJsonBackup(text, { saveProducts });
  if (outcome.status !== "restored") {
    showToast(outcome.message, "error", 7000);
    return;
  }
  state.products = outcome.products;
  state.editingId = null;
  state.openTickets.clear();
  render();
  showToast(outcome.message, "success", 8000, undoAction(previous));
}

async function handleResetDemo() {
  const confirmed = await confirmDialog({
    title: "Reiniciar datos de demo",
    message: "Se reemplazará el historial actual por los tickets de ejemplo (con fechas recientes). Podrás deshacerlo justo después.",
    confirmLabel: "Reiniciar",
    danger: true,
  });
  if (!confirmed) return;
  const seed = buildDemoProducts({ uid });
  state.openTickets.clear();
  state.limits = { ...PAGE_SIZE };
  if (applyChange(seed, "Datos de demo restaurados.")) {
    saveDemoMeta({ seededOn: today(), signature: signature(seed) });
  }
}

async function handleClearAll() {
  if (state.products.length === 0) {
    showToast("No hay nada que borrar.", "info");
    return;
  }
  const confirmed = await confirmDialog({
    title: "Borrar todo el historial",
    message: `Se eliminarán ${state.products.length} productos de ${groupTickets(state.products).length} tickets. Te recomendamos descargar un respaldo antes.`,
    confirmLabel: "Borrar todo",
    danger: true,
  });
  if (!confirmed) return;
  state.openTickets.clear();
  applyChange([], "Historial borrado.");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (state.products.length === 0) {
    showToast("No hay datos para exportar.", "info");
    return;
  }
  download(
    `compras-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(state.products, null, 2),
    "application/json",
  );
  showToast("Respaldo descargado.", "success");
}

function exportMarkdown() {
  if (state.products.length === 0) {
    showToast("No hay datos para exportar.", "info");
    return;
  }

  // Readable report, one block per Ticket. It can be imported again, but the
  // JSON backup is the complete, restorable copy.
  const blocks = groupTickets(state.products).map((ticket) => {
    const rows = ticket.products
      .map((p) => `| ${p.producto} | ${p.cantidad} | ${p.precioUnitario} | ${p.total} | ${p.categoria} |`)
      .join("\n");
    return `# ${ticket.store}\nFecha: ${ticket.date}\n\n` +
      `| Producto | Cantidad | Precio unitario | Total | Categoría |\n` +
      `|---|---:|---:|---:|---|\n${rows}`;
  });

  download(
    `compras-${new Date().toISOString().slice(0, 10)}.md`,
    blocks.join("\n\n---\n\n") + "\n",
    "text/markdown",
  );
  showToast("Reporte Markdown descargado.", "success");
}

// --- Boot ------------------------------------------------------------------

renderShell();
render();
