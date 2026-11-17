import { normalizeText } from "./helpers.js";

const PERSISTED_DECIMALS = 2;

/** Normalize text for semantic comparison without changing persisted values. */
export const canonicalText = normalizeText;

/** Normalize finite numbers to the precision used by persisted products. */
export function canonicalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  const factor = 10 ** PERSISTED_DECIMALS;
  const rounded = Math.round((number + Math.sign(number) * Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

/** Build a stable semantic key for one Ticket line or Producto persistido row. */
export function fingerprintTicketRow(row) {
  return JSON.stringify([
    canonicalText(row?.producto),
    canonicalText(row?.categoria),
    canonicalNumber(row?.cantidad),
    canonicalNumber(row?.precioUnitario),
    canonicalNumber(row?.total),
  ]);
}

/**
 * Build an order-independent Ticket key while preserving duplicate lines.
 * Ticket shape only: `{ store, date, products }`. Persisted batches must be
 * projected to that shape (or pass products that already expose line fields).
 */
export function fingerprintTicket(ticket) {
  const rows = (ticket?.products ?? []).map(fingerprintTicketRow).sort();

  return JSON.stringify([
    canonicalText(ticket?.store),
    canonicalText(ticket?.date),
    rows,
  ]);
}

export function isValidPersistedTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

/**
 * Reconstruct only reliable legacy ticket candidates. The timestamp remains an
 * exact grouping key; store and date use the same canonical form as tickets.
 */
export function groupPersistedTicketBatches(rows) {
  const groups = new Map();

  for (const row of rows ?? []) {
    const timestamp = row?.fechaDeCarga;
    if (!isValidPersistedTimestamp(timestamp)) continue;

    const store = canonicalText(row?.tienda);
    const date = canonicalText(row?.fecha);
    const key = JSON.stringify([timestamp, store, date]);
    if (!groups.has(key)) {
      groups.set(key, { fechaDeCarga: timestamp, store, date, products: [] });
    }
    groups.get(key).products.push(row);
  }

  return [...groups.values()];
}
