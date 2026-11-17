// Generic helpers shared across the app: ids, dates, periods, formatting and
// number parsing.

/** Generate a reasonably unique id without external dependencies. */
export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Local calendar date as an ISO `YYYY-MM-DD` string. */
export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a strict ISO `YYYY-MM-DD` string into a local Date, or `null`. */
export function parseIsoDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** Today's date as an ISO `YYYY-MM-DD` string. */
export function today() {
  return toIsoDate(new Date());
}

/**
 * Parse a human-written number that may include currency symbols,
 * thousands separators or a comma as decimal separator.
 * Returns `null` when nothing numeric can be extracted.
 */
export function parseNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let text = String(raw).trim();
  if (!text) return null;

  // Drop everything that is not a digit, separator or sign.
  text = text.replace(/[^\d.,-]/g, "");
  if (!text) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    // The last separator is treated as the decimal one.
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    // A lone comma is treated as a decimal separator.
    text = text.replace(",", ".");
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Round to the two decimals used by persisted amounts. */
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  const number = typeof value === "number" ? value : parseNumber(value) ?? 0;
  return currencyFormatter.format(number);
}

const numberFormatter = new Intl.NumberFormat("es-MX");

export function formatNumber(value) {
  const number = typeof value === "number" ? value : parseNumber(value) ?? 0;
  return numberFormatter.format(number);
}

/** Format an ISO date into a readable localized date, safely. */
export function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Escape user-provided text before injecting it into innerHTML. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip diacritics, collapse whitespace and lowercase for semantic matching. */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// --- Periods -----------------------------------------------------------------
// One vocabulary for the whole app: the period bar filters purchases and
// statistics with the same ranges, and the trend chart groups with the same
// calendar buckets.

export const PERIOD_OPTIONS = [
  { value: "all", label: "Todo" },
  { value: "week", label: "Esta semana" },
  { value: "fortnight", label: "Esta quincena" },
  { value: "month", label: "Este mes" },
  { value: "custom", label: "Rango" },
];

export const GROUP_OPTIONS = [
  { value: "week", label: "Semana" },
  { value: "fortnight", label: "Quincena" },
  { value: "month", label: "Mes" },
];

const LEGACY_PERIODS = { daily: "all", weekly: "week", biweekly: "fortnight", monthly: "month" };

/** Map period values saved by earlier versions onto the current vocabulary. */
export function migratePeriod(period) {
  if (PERIOD_OPTIONS.some((option) => option.value === period)) return period;
  return LEGACY_PERIODS[period] ?? "all";
}

/** First day of the calendar bucket (`week` | `fortnight` | `month`) containing `date`. */
export function periodStart(date, period) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === "fortnight") {
    start.setDate(start.getDate() <= 15 ? 1 : 16);
  } else {
    start.setDate(1);
  }
  return start;
}

/** First day of the bucket that follows the one starting at `start`. */
export function nextPeriod(start, period) {
  if (period === "week") return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  if (period === "fortnight" && start.getDate() === 1) {
    return new Date(start.getFullYear(), start.getMonth(), 16);
  }
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

/**
 * Inclusive `[from, to]` ISO range for a period anchored to `now`. For
 * `custom`, uses `custom.from`/`custom.to` (swapped if out of order).
 * Returns `null` for "all", an incomplete custom range or unknown values.
 */
export function getPeriodRange(period, custom = {}, now = new Date()) {
  if (period === "custom") {
    if (!custom.from || !custom.to) return null;
    return custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
  }
  if (!GROUP_OPTIONS.some((option) => option.value === period)) return null;
  const start = periodStart(now, period);
  const end = nextPeriod(start, period);
  end.setDate(end.getDate() - 1);
  return [toIsoDate(start), toIsoDate(end)];
}

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });

/** Human label for an inclusive ISO range, e.g. "1 – 15 sept 2026". */
export function describeRange(range) {
  if (!range) return "Todo el historial";
  const [from, to] = range.map(parseIsoDate);
  if (!from || !to) return "Todo el historial";
  if (range[0] === range[1]) return fullDate.format(from);
  const start = from.getFullYear() === to.getFullYear() ? shortDate.format(from) : fullDate.format(from);
  return `${start} – ${fullDate.format(to)}`;
}
