// Ticket editor: one modal for every way of adding or changing a Ticket.
//
//  - Review drafts parsed from Markdown (one or several, shown in sequence).
//  - Manual capture from scratch.
//  - Editing a saved Ticket.
//
// Nothing is persisted here: `onSave(draft)` must return a `commitTicket`
// outcome. Problems are shown inline (store, date or the affected line) so
// they can be fixed before saving.
//
// Keyboard: Enter moves to the next line (creating one at the end),
// Ctrl/⌘+Enter saves, Esc closes.

import { escapeHtml, formatCurrency, formatNumber, parseNumber, round2 } from "../utils/helpers.js";
import { emptyLine, isBlankLine } from "../utils/ticketDraft.js";
import { confirmDialog } from "./Dialog.js";

const TITLES = { new: "Nuevo ticket", import: "Revisar ticket", edit: "Editar ticket" };
const LINE_INPUTS = [
  { field: "producto", label: "Producto", placeholder: "Producto", list: "editor-products" },
  { field: "cantidad", label: "Cantidad", placeholder: "1", numeric: true },
  { field: "precioUnitario", label: "Precio unitario", short: "Precio unit.", placeholder: "0", numeric: true },
  { field: "total", label: "Total", placeholder: "0", numeric: true },
  { field: "categoria", label: "Categoría", placeholder: "Sin categoría", list: "editor-categories" },
];

const options = (values) => values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");

function cloneDraft(draft) {
  return { ...draft, lines: draft.lines.map((line) => ({ ...line })), warnings: [...(draft.warnings ?? [])] };
}

function lineTotal(line) {
  const total = parseNumber(line.total);
  if (total !== null) return total;
  return (parseNumber(line.cantidad) ?? 1) * (parseNumber(line.precioUnitario) ?? 0);
}

/**
 * @param {object} props
 * @param {object[]} props.drafts
 * @param {string[]} props.stores
 * @param {string[]} props.categories
 * @param {string[]} props.productNames
 * @param {(name: string) => string} props.rememberCategory
 * @param {(draft: object) => { status: string, message: string, errors?: object[] }} props.onSave
 * @param {(summary: { saved: number }) => void} [props.onDone]
 */
export function openTicketEditor({ drafts, stores, categories, productNames, rememberCategory, onSave, onDone }) {
  const queue = drafts.map(cloneDraft);
  let index = 0;
  let saved = 0;
  let failure = null;
  let finished = false;

  const dialog = document.createElement("dialog");
  dialog.className = "dialog editor";
  dialog.setAttribute("aria-labelledby", "editor-title");
  document.body.append(dialog);

  const draft = () => queue[index];

  function renderLine(line, lineIndex) {
    const cells = LINE_INPUTS.map(({ field, label, short, placeholder, list, numeric }) => `
      <td data-label="${short ?? label}" class="${numeric ? "num" : ""}">
        <input class="input input--sm${numeric ? " num" : ""}" data-field="${field}" value="${escapeHtml(line[field])}"
          placeholder="${placeholder}" aria-label="${label} (línea ${lineIndex + 1})" autocomplete="off"
          ${list ? `list="${list}"` : ""} ${numeric ? 'inputmode="decimal"' : ""} />
      </td>`).join("");
    const name = line.producto ? `"${line.producto}"` : `línea ${lineIndex + 1}`;
    return `
      <tr class="editor-row${line.issue ? " editor-row--issue" : ""}" data-index="${lineIndex}">
        ${cells}
        <td class="editor-row__remove">
          <button type="button" class="icon-btn icon-btn--danger" data-action="remove" aria-label="Quitar ${escapeHtml(name)}" title="Quitar">✕</button>
        </td>
      </tr>
      ${line.issue || line.hint ? `
        <tr class="editor-issue${line.issue ? "" : " editor-issue--hint"}" data-issue="${lineIndex}">
          <td colspan="6">${line.issue ? "⚠" : "ℹ"} ${escapeHtml(line.issue ?? line.hint)}</td>
        </tr>` : ""}`;
  }

  function failureBox() {
    if (!failure) return "";
    const brokenLines = draft().lines.filter((line) => line.issue && !isBlankLine(line)).length;
    const removable = failure.status === "invalid" && brokenLines > 0 && draft().lines.length > brokenLines;
    return `
      <div class="notice notice--error" role="alert">
        <p>${escapeHtml(failure.message)}${brokenLines > 1 ? ` (${brokenLines} líneas por revisar)` : ""}</p>
        ${removable ? `<button type="button" class="btn btn--ghost btn--sm" data-action="drop-broken">Quitar líneas con error</button>` : ""}
      </div>`;
  }

  function render() {
    const current = draft();
    const errorFields = new Set((failure?.errors ?? []).map((error) => error.field).filter(Boolean));
    const multiple = queue.length > 1;
    const meta = [multiple ? `Ticket ${index + 1} de ${queue.length}` : "", current.source].filter(Boolean).join(" · ");
    const discardLabel = current.mode === "edit" ? "Cancelar" : multiple ? "Descartar este" : "Descartar";
    const saveLabel = current.mode === "edit" ? "Guardar cambios" : index < queue.length - 1 ? "Guardar y seguir" : "Guardar ticket";

    dialog.innerHTML = `
      <form class="dialog__form editor__form" novalidate>
        <header class="dialog__head">
          <div>
            <h2 class="dialog__title" id="editor-title">${TITLES[current.mode] ?? TITLES.import}</h2>
            ${meta ? `<p class="editor__meta">${escapeHtml(meta)}</p>` : ""}
          </div>
          <button type="button" class="icon-btn dialog__close" data-action="close" aria-label="Cerrar">✕</button>
        </header>
        <div class="dialog__body editor__body">
          ${failureBox()}
          ${current.warnings.length ? `
            <div class="notice notice--warning">
              <ul>${current.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
            </div>` : ""}
          <div class="editor__fields">
            <label class="field">
              <span class="field__label">Tienda</span>
              <input class="input${errorFields.has("store") ? " input--invalid" : ""}" name="store" list="editor-stores"
                value="${escapeHtml(current.store)}" placeholder="Ej. Súper Central" autocomplete="off" required />
            </label>
            <label class="field">
              <span class="field__label">Fecha</span>
              <input class="input${errorFields.has("date") ? " input--invalid" : ""}" type="date" name="date"
                value="${escapeHtml(current.date)}" required />
            </label>
          </div>
          <div class="editor__table-wrap">
            <table class="editor-table">
              <thead>
                <tr>
                  ${LINE_INPUTS.map(({ label, short, numeric }) => `<th class="${numeric ? "num" : ""}">${short ?? label}</th>`).join("")}
                  <th><span class="sr-only">Quitar</span></th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="editor__below">
            <button type="button" class="btn btn--ghost btn--sm" data-action="add">+ Agregar producto</button>
            <span class="editor__tip"><kbd>Enter</kbd> siguiente línea · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> guardar</span>
          </div>
          <datalist id="editor-stores">${options(stores)}</datalist>
          <datalist id="editor-categories">${options(categories)}</datalist>
          <datalist id="editor-products">${options(productNames)}</datalist>
        </div>
        <footer class="dialog__actions editor__footer">
          <p class="editor__summary"><strong data-role="total"></strong> <span data-role="count"></span></p>
          <button type="button" class="btn btn--ghost" data-action="discard">${discardLabel}</button>
          <button type="submit" class="btn btn--primary">${saveLabel}</button>
        </footer>
      </form>`;
    renderLines();
  }

  function renderLines() {
    dialog.querySelector("tbody").innerHTML = draft().lines.map(renderLine).join("");
    updateSummary();
  }

  function updateSummary() {
    const lines = draft().lines.filter((line) => !isBlankLine(line));
    const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
    dialog.querySelector("[data-role='total']").textContent = formatCurrency(total);
    dialog.querySelector("[data-role='count']").textContent =
      `· ${formatNumber(lines.length)} producto${lines.length === 1 ? "" : "s"}`;
  }

  function focusCell(lineIndex, field = "producto") {
    dialog.querySelector(`tr[data-index="${lineIndex}"] [data-field="${field}"]`)?.focus();
  }

  function focusInitial() {
    const current = draft();
    const firstError = failure?.errors?.[0];
    if (firstError?.field === "store" || !current.store.trim()) return dialog.querySelector("[name='store']").focus();
    if (firstError?.field === "date") return dialog.querySelector("[name='date']").focus();
    const issueIndex = firstError?.line ?? current.lines.findIndex((line) => line.issue);
    if (issueIndex >= 0) return focusCell(issueIndex);
    if (current.mode === "new") return focusCell(0);
    dialog.querySelector("button[type='submit']").focus();
  }

  function addLine() {
    draft().lines.push(emptyLine());
    renderLines();
    focusCell(draft().lines.length - 1);
  }

  function clearIssue(row, line) {
    if (!line.issue && !line.hint) return;
    delete line.issue;
    delete line.hint;
    row.classList.remove("editor-row--issue");
    dialog.querySelector(`[data-issue="${row.dataset.index}"]`)?.remove();
  }

  function handleLineInput(input) {
    const row = input.closest("tr[data-index]");
    const line = draft().lines[Number(row.dataset.index)];
    const field = input.dataset.field;
    line[field] = input.value;
    clearIssue(row, line);

    const quantity = parseNumber(line.cantidad);
    if (field === "cantidad" || field === "precioUnitario") {
      const price = parseNumber(line.precioUnitario);
      if (quantity !== null && price !== null) {
        line.total = String(round2(quantity * price));
        row.querySelector("[data-field='total']").value = line.total;
      }
    } else if (field === "total") {
      const total = parseNumber(line.total);
      if (quantity && total !== null) {
        line.precioUnitario = String(round2(total / quantity));
        row.querySelector("[data-field='precioUnitario']").value = line.precioUnitario;
      }
    }
    updateSummary();
  }

  function fillRememberedCategory(input) {
    const row = input.closest("tr[data-index]");
    const line = draft().lines[Number(row.dataset.index)];
    if (line.categoria.trim()) return;
    const category = rememberCategory(line.producto);
    if (!category) return;
    line.categoria = category;
    row.querySelector("[data-field='categoria']").value = category;
  }

  function next() {
    index += 1;
    failure = null;
    if (index >= queue.length) return finish();
    render();
    focusInitial();
  }

  function finish() {
    finished = true;
    dialog.close();
    dialog.remove();
    onDone?.({ saved });
  }

  function save() {
    const outcome = onSave(draft());
    if (outcome.status === "committed") {
      saved += 1;
      return next();
    }
    failure = outcome;
    for (const error of outcome.errors ?? []) {
      if (error.line !== undefined) draft().lines[error.line].issue = error.message;
    }
    render();
    focusInitial();
  }

  async function requestClose() {
    const pending = queue.slice(index).filter((item) => item.lines.some((line) => !isBlankLine(line)) || item.store.trim());
    const onlyEdit = draft().mode === "edit";
    if (pending.length && !onlyEdit) {
      const message = pending.length > 1
        ? `Hay ${pending.length} tickets sin guardar. ¿Descartarlos?`
        : "El ticket no se ha guardado. ¿Descartarlo?";
      if (!(await confirmDialog({ title: "Descartar cambios", message, confirmLabel: "Descartar", danger: true }))) return;
    }
    finish();
  }

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (event.cancelable) requestClose();
  });
  // Browsers may close the dialog on Esc without a cancelable event (no
  // recent user activation): reopen it and ask before discarding anything.
  dialog.addEventListener("close", () => {
    if (finished) return;
    dialog.showModal();
    requestClose();
  });

  dialog.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset.field) return handleLineInput(input);
    if (input.name === "store" || input.name === "date") {
      draft()[input.name] = input.value;
      input.classList.remove("input--invalid");
    }
  });

  dialog.addEventListener("change", (event) => {
    if (event.target.dataset.field === "producto") fillRememberedCategory(event.target);
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) return save();
    const row = event.target.closest("tr[data-index]");
    if (!row) return focusCell(0);
    if (event.target.dataset.field === "producto") fillRememberedCategory(event.target);
    const lineIndex = Number(row.dataset.index);
    if (lineIndex + 1 >= draft().lines.length) return addLine();
    focusCell(lineIndex + 1, event.target.dataset.field);
  });

  dialog.addEventListener("submit", (event) => {
    event.preventDefault();
    save();
  });

  dialog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close") requestClose();
    if (action === "discard") draft().mode === "edit" ? finish() : next();
    if (action === "add") addLine();
    if (action === "remove") {
      const lineIndex = Number(button.closest("tr").dataset.index);
      draft().lines.splice(lineIndex, 1);
      if (!draft().lines.length) draft().lines.push(emptyLine());
      renderLines();
      focusCell(Math.min(lineIndex, draft().lines.length - 1));
    }
    if (action === "drop-broken") {
      draft().lines = draft().lines.filter((line) => !line.issue || isBlankLine(line));
      failure = null;
      render();
      dialog.querySelector("button[type='submit']").focus();
    }
  });

  render();
  dialog.showModal();
  focusInitial();
}
