// Borradores de ticket: every way of adding or changing a Ticket (Markdown
// from an AI, manual capture, editing a saved Ticket) produces a draft that
// the user reviews before anything is persisted. `commitTicket` is the only
// write path: validate → align labels → detect duplicate → map → save once.
// See docs/adr/0002-ticket-drafts.md.

import {
  normalizeLine,
  parseDateValue,
  parseMarkdownTickets,
  splitMarkdownTickets,
} from "./parseMarkdownTickets.js";
import {
  fingerprintTicket,
  groupPersistedTicketBatches,
  isValidPersistedTimestamp,
} from "./ticketFingerprint.js";
import { buildCategoryMemory, distinctLabels, labelResolver, ticketKey } from "./tickets.js";
import { today as localToday } from "./helpers.js";

const DEFAULT_CATEGORY = "Sin categoría";
const LINE_FIELDS = ["producto", "cantidad", "precioUnitario", "total", "categoria"];

/** An empty editable line. Values are strings, as typed in inputs. */
export function emptyLine() {
  return { producto: "", cantidad: "1", precioUnitario: "", total: "", categoria: "" };
}

function toLine(fields) {
  const line = Object.fromEntries(LINE_FIELDS.map((field) => [field, String(fields?.[field] ?? "").trim()]));
  if (line.categoria === DEFAULT_CATEGORY) line.categoria = "";
  return line;
}

export function isBlankLine(line) {
  return ["producto", "precioUnitario", "total", "categoria"].every((field) => !String(line[field] ?? "").trim());
}

/** Draft for a manual capture. */
export function blankDraft({ date = localToday() } = {}) {
  return { mode: "new", source: "Captura manual", store: "", date, lines: [emptyLine()], warnings: [] };
}

/** Draft to edit a saved Ticket (see `groupTickets`). Saving replaces its rows. */
export function draftFromTicket(ticket) {
  return {
    mode: "edit",
    source: "",
    replaceKey: ticket.key,
    store: ticket.store,
    date: ticket.date,
    lines: ticket.products.map(toLine),
    warnings: [],
  };
}

/**
 * Turn Markdown (one or several tickets) into drafts ready for review.
 * Omitted rows come back as lines flagged with a blocking `issue` so they can
 * be fixed instead of lost; suspicious but valid lines get a `hint`. Labels
 * are aligned with the existing history and missing categories are
 * prefilled from previous purchases.
 *
 * @returns {{ drafts: object[], errors: string[] }}
 */
export function draftsFromMarkdown(markdownText, { sourceLabel = "Contenido pegado", existingProducts = [], today } = {}) {
  const segments = splitMarkdownTickets(markdownText);
  if (!segments.length) return { drafts: [], errors: [`${sourceLabel}: el contenido está vacío.`] };

  const resolveStore = labelResolver(distinctLabels(existingProducts, "tienda"));
  const resolveCategory = labelResolver(distinctLabels(existingProducts, "categoria"));
  const rememberedCategory = buildCategoryMemory(existingProducts);
  const drafts = [];
  const errors = [];

  segments.forEach((segment, index) => {
    const label = segments.length > 1 ? `${sourceLabel} · ticket ${index + 1}` : sourceLabel;
    const result = parseMarkdownTickets(segment, today ? { today } : undefined);
    const ticket = result.ticket ?? result.recovered;
    if (!ticket) {
      errors.push(`${label}: ${result.errors[0]?.message ?? "no se pudo leer el ticket."}`);
      return;
    }

    const lines = [];
    const warnings = [];
    for (const warning of result.warnings) {
      if (warning.code === "ROW_OMITTED") {
        lines.push({ ...toLine(warning.raw), issue: normalizeLine(warning.raw).issue ?? warning.message });
      } else if (warning.code !== "VALUE_DEFAULTED") {
        warnings.push(warning.message);
      }
    }
    for (const product of ticket.products) {
      const line = toLine(product);
      line.categoria = line.categoria ? resolveCategory(line.categoria) : rememberedCategory(product.producto);
      if (product.precioUnitario === 0 && product.total === 0) line.hint = "Sin precio ni total: revisa el importe.";
      lines.push(line);
    }
    if (!ticket.store) warnings.unshift("No se detectó la tienda: escríbela antes de guardar.");

    drafts.push({
      mode: "import",
      source: label,
      store: ticket.store ? resolveStore(ticket.store) : "",
      date: ticket.date,
      lines,
      warnings,
    });
  });

  return { drafts, errors };
}

/**
 * Validate a draft. Blank lines are ignored.
 * @returns {{ ticket: { store, date, products } | null, errors: { field?: string, line?: number, message: string }[] }}
 */
export function validateDraft(draft) {
  const errors = [];
  const store = String(draft.store ?? "").trim();
  if (!store) errors.push({ field: "store", message: "Escribe el nombre de la tienda." });
  const date = parseDateValue(draft.date);
  if (!date) errors.push({ field: "date", message: "Elige una fecha válida." });

  const products = [];
  (draft.lines ?? []).forEach((line, index) => {
    if (isBlankLine(line)) return;
    const { product, issue } = normalizeLine(line);
    if (issue) errors.push({ line: index, message: issue });
    else products.push(product);
  });
  if (!products.length && !errors.some((error) => error.line !== undefined)) {
    errors.push({ field: "lines", message: "Agrega al menos un producto." });
  }

  return errors.length ? { ticket: null, errors } : { ticket: { store, date, products }, errors };
}

/**
 * Persist a reviewed draft against existing Productos persistidos.
 *
 * @param {object} draft
 * @param {object[]} existingProducts
 * @param {{ saveProducts: (products: object[]) => boolean, uid: () => string, now?: () => string }} deps
 * @returns {{
 *   status: 'invalid' | 'duplicate' | 'committed' | 'save_failed',
 *   message: string,
 *   errors?: object[],
 *   products?: object[],
 *   ids?: string[],
 *   store?: string,
 * }}
 */
export function commitTicket(draft, existingProducts, deps) {
  const { saveProducts, uid, now = () => new Date().toISOString() } = deps;
  const { ticket, errors } = validateDraft(draft);
  if (!ticket) return { status: "invalid", message: errors[0].message, errors };

  const replacing = Boolean(draft.replaceKey);
  const replaced = replacing ? existingProducts.filter((row) => ticketKey(row) === draft.replaceKey) : [];
  const remaining = replacing
    ? existingProducts.filter((row) => ticketKey(row) !== draft.replaceKey)
    : existingProducts;

  const resolveStore = labelResolver(distinctLabels(remaining, "tienda"));
  const resolveCategory = labelResolver(distinctLabels(remaining, "categoria"));
  const resolved = {
    store: resolveStore(ticket.store),
    date: ticket.date,
    products: ticket.products.map((line) => ({ ...line, categoria: resolveCategory(line.categoria) })),
  };

  const incoming = fingerprintTicket(resolved);
  const duplicate = groupPersistedTicketBatches(remaining).some((batch) => fingerprintTicket(batch) === incoming);
  if (duplicate) {
    return { status: "duplicate", message: "Ticket duplicado: ya existe una compra idéntica en el historial." };
  }

  const fechaDeCarga = replaced.find((row) => isValidPersistedTimestamp(row.fechaDeCarga))?.fechaDeCarga ?? now();
  const rows = resolved.products.map((line) => ({
    id: uid(),
    tienda: resolved.store,
    fecha: resolved.date,
    producto: line.producto,
    cantidad: line.cantidad,
    precioUnitario: line.precioUnitario,
    total: line.total,
    categoria: line.categoria,
    fechaDeCarga,
  }));
  const products = remaining.concat(rows);

  if (!saveProducts(products)) {
    return { status: "save_failed", message: "No se pudo guardar el historial. Inténtalo de nuevo." };
  }

  return {
    status: "committed",
    message: replacing
      ? `Ticket de ${resolved.store} actualizado.`
      : `Se guardó el ticket de ${resolved.store} con ${rows.length} producto(s).`,
    products,
    ids: rows.map((row) => row.id),
    store: resolved.store,
  };
}
