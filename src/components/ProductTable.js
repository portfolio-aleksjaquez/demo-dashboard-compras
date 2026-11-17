// Product table with sortable headers, incremental pagination, inline
// editing and per-row deletion.
//
// The parent owns `editingId`, sorting and the row limit, and passes
// callbacks. When a row is in edit mode it renders inputs; total is
// recalculated live from quantity × price. Enter saves, Esc cancels.

import {
  formatCurrency,
  formatNumber,
  formatDate,
  escapeHtml,
} from "../utils/helpers.js";

const COLUMNS = [
  { key: "producto", label: "Producto" },
  { key: "tienda", label: "Tienda" },
  { key: "categoria", label: "Categoría" },
  { key: "fecha", label: "Fecha" },
  { key: "cantidad", label: "Cantidad", numeric: true },
  { key: "precioUnitario", label: "Precio unit.", numeric: true },
  { key: "total", label: "Total", numeric: true },
];

function readonlyRow(p) {
  return `
    <tr data-id="${p.id}">
      <td data-label="Producto">${escapeHtml(p.producto)}</td>
      <td data-label="Tienda">${escapeHtml(p.tienda)}</td>
      <td data-label="Categoría"><span class="tag">${escapeHtml(p.categoria)}</span></td>
      <td data-label="Fecha">${formatDate(p.fecha)}</td>
      <td data-label="Cantidad" class="num">${formatNumber(p.cantidad)}</td>
      <td data-label="Precio unit." class="num">${formatCurrency(p.precioUnitario)}</td>
      <td data-label="Total" class="num">${formatCurrency(p.total)}</td>
      <td data-label="Acciones" class="actions">
        <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Editar" aria-label="Editar ${escapeHtml(p.producto)}">✏️</button>
        <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${p.id}" title="Eliminar" aria-label="Eliminar ${escapeHtml(p.producto)}">🗑️</button>
      </td>
    </tr>`;
}

function editRow(p) {
  return `
    <tr data-id="${p.id}" class="row--editing">
      <td data-label="Producto"><input class="input input--sm" data-field="producto" value="${escapeHtml(p.producto)}" aria-label="Producto" /></td>
      <td data-label="Tienda"><input class="input input--sm" data-field="tienda" value="${escapeHtml(p.tienda)}" aria-label="Tienda" /></td>
      <td data-label="Categoría"><input class="input input--sm" data-field="categoria" value="${escapeHtml(p.categoria)}" aria-label="Categoría" /></td>
      <td data-label="Fecha"><input type="date" class="input input--sm" data-field="fecha" value="${escapeHtml(p.fecha)}" aria-label="Fecha" /></td>
      <td data-label="Cantidad" class="num"><input type="number" min="0" step="any" class="input input--sm num" data-field="cantidad" value="${p.cantidad}" aria-label="Cantidad" /></td>
      <td data-label="Precio unit." class="num"><input type="number" min="0" step="any" class="input input--sm num" data-field="precioUnitario" value="${p.precioUnitario}" aria-label="Precio unitario" /></td>
      <td data-label="Total" class="num"><span data-role="total">${formatCurrency(p.total)}</span></td>
      <td data-label="Acciones" class="actions">
        <button class="icon-btn icon-btn--ok" data-action="save" data-id="${p.id}" title="Guardar" aria-label="Guardar cambios">✔️</button>
        <button class="icon-btn" data-action="cancel" data-id="${p.id}" title="Cancelar" aria-label="Cancelar edición">✖️</button>
      </td>
    </tr>`;
}

function headerCell({ key, label, numeric }, sortBy, sortDir) {
  const active = key === sortBy;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "↕";
  return `
    <th class="${numeric ? "num" : ""}" aria-sort="${ariaSort}">
      <button type="button" class="th-sort${active ? " th-sort--active" : ""}" data-sort="${key}">
        ${label} <span class="th-sort__arrow" aria-hidden="true">${arrow}</span>
      </button>
    </th>`;
}

export function renderProductTable(container, props) {
  const { products, editingId, sortBy, sortDir, limit, onSort, onShowMore, onEdit, onSave, onCancel, onDelete } = props;

  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty empty--compact">
        <p class="empty__title">No hay productos con estos filtros</p>
        <p class="empty__text">Cambia el período o limpia los filtros.</p>
      </div>`;
    return;
  }

  const visible = products.slice(0, Math.max(limit, 1));
  const remaining = products.length - visible.length;
  const rows = visible.map((p) => (p.id === editingId ? editRow(p) : readonlyRow(p))).join("");
  const total = products.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
  const count = products.length;

  container.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            ${COLUMNS.map((column) => headerCell(column, sortBy, sortDir)).join("")}
            <th class="num">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="table__total-row">
            <td colspan="6" data-label="Total">Total (${formatNumber(count)} producto${count === 1 ? "" : "s"})</td>
            <td class="num" data-label="Total">${formatCurrency(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    ${remaining > 0 ? `
      <div class="list-more">
        <button type="button" class="btn btn--ghost" data-action="more">Mostrar más (${formatNumber(remaining)} restantes)</button>
      </div>` : ""}`;

  const collect = (id) => {
    const values = {};
    container.querySelectorAll(`tr[data-id="${id}"] [data-field]`).forEach((input) => {
      values[input.dataset.field] = input.value;
    });
    return values;
  };

  container.onclick = (event) => {
    const sort = event.target.closest("[data-sort]");
    if (sort) return onSort(sort.dataset.sort);
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "more") onShowMore();
    if (action === "edit") onEdit(id);
    if (action === "cancel") onCancel();
    if (action === "delete") onDelete(id);
    if (action === "save") onSave(id, collect(id));
  };

  // Live total recalculation and keyboard shortcuts while editing.
  const editingRow = container.querySelector("tr.row--editing");
  if (editingRow) {
    const qtyInput = editingRow.querySelector('[data-field="cantidad"]');
    const priceInput = editingRow.querySelector('[data-field="precioUnitario"]');
    const totalSpan = editingRow.querySelector('[data-role="total"]');
    const recompute = () => {
      const qty = Number(qtyInput.value) || 0;
      const price = Number(priceInput.value) || 0;
      totalSpan.textContent = formatCurrency(qty * price);
    };
    qtyInput.addEventListener("input", recompute);
    priceInput.addEventListener("input", recompute);
    editingRow.addEventListener("keydown", (event) => {
      if (event.key === "Enter") onSave(editingRow.dataset.id, collect(editingRow.dataset.id));
      if (event.key === "Escape") onCancel();
    });
    const focused = document.activeElement;
    if (!focused || focused === document.body) editingRow.querySelector('[data-field="producto"]').focus();
  }
}
