// Search and store/category filters, with removable chips for every active
// filter (including the shared period) and a single "Limpiar filtros".
//
// Rendered ONCE by the app shell so the search input never loses focus.
// `updateFilterOptions` refreshes the select lists and chips in place.

import { describeRange, escapeHtml, getPeriodRange } from "../utils/helpers.js";

export function renderFilters(container, { filters, onChange, onClear }) {
  container.innerHTML = `
    <div class="filters">
      <div class="filters__field filters__field--grow">
        <label class="filters__label" for="filter-search">Buscar producto</label>
        <input type="search" id="filter-search" class="input" placeholder="Ej. Leche"
          value="${escapeHtml(filters.search)}" autocomplete="off" />
      </div>
      <div class="filters__field">
        <label class="filters__label" for="filter-store">Tienda</label>
        <select id="filter-store" class="select"></select>
      </div>
      <div class="filters__field">
        <label class="filters__label" for="filter-category">Categoría</label>
        <select id="filter-category" class="select"></select>
      </div>
    </div>
    <div class="chips" data-role="chips" hidden></div>`;

  const search = container.querySelector("#filter-search");
  const store = container.querySelector("#filter-store");
  const category = container.querySelector("#filter-category");

  search.addEventListener("input", () => onChange({ search: search.value }));
  store.addEventListener("change", () => onChange({ store: store.value }));
  category.addEventListener("change", () => onChange({ category: category.value }));

  container.querySelector("[data-role='chips']").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.clear === "all") return onClear();
    const patch = button.dataset.clear === "period"
      ? { period: "all", customFrom: "", customTo: "" }
      : { [button.dataset.clear]: "" };
    onChange(patch);
  });
}

function fillSelect(select, values, current, allLabel) {
  select.innerHTML = [`<option value="">${allLabel}</option>`]
    .concat(values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`))
    .join("");
  select.value = values.includes(current) ? current : "";
}

function chip(field, label) {
  return `<span class="chip">${escapeHtml(label)}
    <button type="button" class="chip__remove" data-clear="${field}" aria-label="Quitar filtro ${escapeHtml(label)}">✕</button>
  </span>`;
}

export function updateFilterOptions(container, { stores, categories, filters }) {
  const search = container.querySelector("#filter-search");
  const store = container.querySelector("#filter-store");
  const category = container.querySelector("#filter-category");
  const chips = container.querySelector("[data-role='chips']");
  if (!search) return;

  if (search.value !== filters.search) search.value = filters.search;
  fillSelect(store, stores, filters.store, "Todas");
  fillSelect(category, categories, filters.category, "Todas");

  const range = getPeriodRange(filters.period, { from: filters.customFrom, to: filters.customTo });
  const active = [
    filters.search.trim() && chip("search", `“${filters.search.trim()}”`),
    filters.store && chip("store", `Tienda: ${filters.store}`),
    filters.category && chip("category", `Categoría: ${filters.category}`),
    range && chip("period", describeRange(range)),
  ].filter(Boolean);

  chips.hidden = active.length === 0;
  chips.innerHTML = active.length
    ? `<span class="chips__label">Filtros:</span>${active.join("")}
       <button type="button" class="btn btn--link" data-clear="all">Limpiar filtros</button>`
    : "";
}
