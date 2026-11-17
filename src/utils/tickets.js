// Ticket identity over Productos persistidos and label consistency helpers.
//
// A Ticket is not stored as its own record: its rows share `fechaDeCarga`,
// `tienda` and `fecha`. Legacy rows without a valid load timestamp are grouped
// by store and date only.

import { normalizeText } from "./helpers.js";
import { isValidPersistedTimestamp } from "./ticketFingerprint.js";

/** Stable key of the Ticket a Producto persistido belongs to. */
export function ticketKey(row) {
  const loadedAt = isValidPersistedTimestamp(row?.fechaDeCarga) ? row.fechaDeCarga : "legacy";
  return JSON.stringify([loadedAt, normalizeText(row?.tienda), String(row?.fecha ?? "")]);
}

/** Group persisted rows into Tickets, newest purchase first. */
export function groupTickets(products) {
  const groups = new Map();
  for (const row of products ?? []) {
    const key = ticketKey(row);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        store: row.tienda || "Sin tienda",
        date: row.fecha || "",
        fechaDeCarga: isValidPersistedTimestamp(row.fechaDeCarga) ? row.fechaDeCarga : "",
        products: [],
        total: 0,
      });
    }
    const ticket = groups.get(key);
    ticket.products.push(row);
    ticket.total += Number(row.total) || 0;
  }
  return [...groups.values()].sort((a, b) =>
    b.date.localeCompare(a.date) || b.fechaDeCarga.localeCompare(a.fechaDeCarga),
  );
}

/** Distinct labels for a field, one spelling per normalized value, sorted. */
export function distinctLabels(products, field) {
  const labels = new Map();
  for (const row of products ?? []) {
    const label = String(row?.[field] ?? "").trim();
    const key = normalizeText(label);
    if (key && !labels.has(key)) labels.set(key, label);
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Returns a function that maps a label onto the spelling already used in the
 * history (e.g. "súper central " → "Súper Central"), or the trimmed input when new.
 */
export function labelResolver(existingLabels) {
  const known = new Map();
  for (const label of existingLabels ?? []) {
    const key = normalizeText(label);
    if (key && !known.has(key)) known.set(key, label);
  }
  return (value) => {
    const label = String(value ?? "").trim().replace(/\s+/g, " ");
    return known.get(normalizeText(label)) ?? label;
  };
}

/** Last category used for each product name, to prefill new lines. */
export function buildCategoryMemory(products) {
  const memory = new Map();
  const ordered = (products ?? []).slice().sort((a, b) =>
    String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")) ||
    String(a.fechaDeCarga ?? "").localeCompare(String(b.fechaDeCarga ?? "")),
  );
  for (const row of ordered) {
    const category = String(row.categoria ?? "").trim();
    if (!category || category === "Sin categoría") continue;
    memory.set(normalizeText(row.producto), category);
  }
  return (productName) => memory.get(normalizeText(productName)) ?? "";
}
