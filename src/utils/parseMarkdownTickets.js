// Markdown ticket parser.
//
// Supports one ticket in any of these shapes:
//   1) A store heading (`# Súper Central` or `Tienda: Súper Central`) + a Markdown table.
//   2) A store heading + a key/value list (`- Producto: ...`).
//   3) Fallback when neither is present: plain lines (`Leche 2 28`,
//      `Pan $35`) or tab-separated columns pasted from a spreadsheet.
//
// Returns a rich result object so callers can react to missing store/date
// and surface warnings, instead of silently dropping data:
//
//   { ticket: { store, date, products } | null, warnings, errors }
//
// Warnings and errors are structured diagnostics with stable codes and
// Spanish messages. Errors are blocking and always produce a null ticket.
// Omitted rows carry their `raw` fields so a reviewer can fix them.
//
// `splitMarkdownTickets` cuts a text holding several tickets into one
// segment per ticket, to be parsed individually.

import { parseNumber, normalizeText, today, round2 } from "./helpers.js";

const DEFAULT_CATEGORY = "Sin categoría";
const LINE_FIELDS = ["producto", "cantidad", "precioUnitario", "total", "categoria"];
const NUMBER_LABELS = { cantidad: "cantidad", precioUnitario: "precio unitario", total: "total" };

/** Map a normalized column/field label to a canonical product field. */
function resolveField(label) {
  const key = normalizeText(label);
  if (!key) return null;
  if (/^(nombre|producto)\s*normalizado$/.test(key)) return "productoNormalizado";
  if (/(producto|descripcion|articulo|item)/.test(key)) return "producto";
  if (/(cantidad|cant|qty|unidades)/.test(key)) return "cantidad";
  if (/(precio\s*unitario|preciounitario|p\.?\s*u|unitario|precio)/.test(key))
    return "precioUnitario";
  if (/(total|importe|subtotal)/.test(key)) return "total";
  if (/(categoria|rubro|tipo)/.test(key)) return "categoria";
  return null;
}

/** Try to normalize a free-form date into ISO `YYYY-MM-DD`. */
export function parseDateValue(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return validDate(Number(y), Number(m), Number(d));
  }

  const dmy = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return validDate(Number(y), Number(m), Number(d));
  }

  return null;
}

function validDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Split a Markdown table row into trimmed cells. */
function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);
}

function isTableRow(line) {
  return /\|/.test(line) && line.trim().startsWith("|");
}

const HEADING = /^#{1,6}\s+(.+?)\s*$/;
const STORE_LINE = /^(?:tienda|store|comercio)\s*:\s*(.+)$/i;
const DATE_LINE = /^(?:fecha|date)\s*:\s*(.+)$/i;
const RULE_LINE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const NON_PRODUCT_NAME = /^(sub\s*total|total|iva|impuesto|cambio|efectivo|tarjeta|pago|su pago|ahorro)/;
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const QTY_PRICE_LINE = new RegExp(String.raw`^(.*?\S)\s+${NUMBER}(?:\s*[x×*]\s*|\s+)\$?\s*${NUMBER}$`, "i");
const PRICE_LINE = new RegExp(String.raw`^(.*?\S)\s+\$?\s*${NUMBER}$`);

/** Parse `Leche 2 28`, `Leche 2 x 28` or `Pan $35` into raw line fields. */
function parsePlainLine(text) {
  const line = text.replace(/^[-*•]\s*/, "").trim();
  const withQty = line.match(QTY_PRICE_LINE);
  const match = withQty ?? line.match(PRICE_LINE);
  if (!match) return null;
  const name = match[1].replace(/\s*\$$/, "").trim();
  if (!/\p{L}/u.test(name) || NON_PRODUCT_NAME.test(normalizeText(name))) return null;
  return withQty
    ? { producto: name, cantidad: match[2], precioUnitario: match[3] }
    : { producto: name, precioUnitario: match[2] };
}

function isProductLine(line) {
  const trimmed = line.trim();
  if (isTableRow(trimmed)) return !isTableSeparator(trimmed);
  if (/^-?\s*(producto|descripci[oó]n|art[ií]culo)\s*:/i.test(trimmed)) return true;
  return line.includes("\t") || Boolean(parsePlainLine(trimmed));
}

/**
 * Normalize raw field strings into a validated product, applying the
 * business rules for missing total / price / quantity / category.
 * Returns `{ product }` or `{ skipped: true }` after pushing a warning.
 * Without a `row`, messages are phrased for an inline editor.
 */
function normalizeProduct(fields, warnings, row = null) {
  const raw = Object.fromEntries(LINE_FIELDS.map((field) => [field, String(fields[field] ?? "").trim()]));
  const producto = String(fields.productoNormalizado ?? fields.producto ?? "").trim();
  if (!producto) {
    warnings.push({
      code: "ROW_OMITTED",
      message: row === null
        ? "Falta el nombre del producto."
        : `Se omitió la fila ${row}: falta el nombre del producto; complétalo e inténtalo de nuevo.`,
      row,
      field: "producto",
      raw,
    });
    return { skipped: true };
  }
  raw.producto = producto;

  for (const field of ["cantidad", "precioUnitario", "total"]) {
    if (!Object.hasOwn(fields, field) || String(fields[field]).trim() === "") continue;
    const value = parseNumber(fields[field]);
    if (value === null || value < 0) {
      const detail = `${NUMBER_LABELS[field]} "${fields[field]}" debe ser un número igual o mayor que cero.`;
      warnings.push({
        code: "ROW_OMITTED",
        message: row === null
          ? detail.charAt(0).toUpperCase() + detail.slice(1)
          : `Se omitió "${producto}" (fila ${row}): ${detail}`,
        row,
        field,
        value: fields[field],
        raw,
      });
      return { skipped: true };
    }
  }

  let cantidad = parseNumber(fields.cantidad);
  let precioUnitario = parseNumber(fields.precioUnitario);
  let total = parseNumber(fields.total);

  if (cantidad === null && total !== null && precioUnitario) {
    cantidad = total / precioUnitario;
  }
  if (cantidad === null) cantidad = 1;

  if (precioUnitario === null && total !== null && cantidad) {
    precioUnitario = total / cantidad;
  }
  if (precioUnitario === null) precioUnitario = 0;

  if (total === null) {
    total = cantidad * precioUnitario;
  }

  if (precioUnitario === 0 && total === 0) {
    warnings.push({
      code: "VALUE_DEFAULTED",
      message: `"${producto}" no tenía precio ni total; se registró en 0.`,
      row,
      producto,
    });
  }

  const categoriaRaw = String(fields.categoria ?? "").trim();

  return {
    product: {
      producto,
      cantidad: round2(cantidad),
      precioUnitario: round2(precioUnitario),
      total: round2(total),
      categoria: categoriaRaw || DEFAULT_CATEGORY,
    },
  };
}

/**
 * Validate one editable line (`producto`, `cantidad`, `precioUnitario`,
 * `total`, `categoria`) with the same rules used for Markdown rows.
 * Returns `{ product }` or `{ issue }`.
 */
export function normalizeLine(fields) {
  const warnings = [];
  const { product } = normalizeProduct(fields, warnings);
  return product ? { product } : { issue: warnings[0].message };
}

/** Cut a text holding several tickets into one Markdown segment per ticket. */
export function splitMarkdownTickets(markdownText) {
  const lines = String(markdownText ?? "").replace(/\r\n?/g, "\n").split("\n");
  const segments = [];
  let current = { lines: [], hasProducts: false };
  const flush = () => {
    if (current.lines.some((line) => line.trim())) segments.push(current);
    current = { lines: [], hasProducts: false };
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (RULE_LINE.test(trimmed)) {
      flush();
      continue;
    }
    const isAnchor = HEADING.test(trimmed) || STORE_LINE.test(trimmed) || DATE_LINE.test(trimmed);
    if (isAnchor && current.hasProducts) flush();
    current.lines.push(line);
    if (trimmed && isProductLine(line)) current.hasProducts = true;
  }
  flush();

  // Segments without products are notes that belong to a neighbour ticket.
  const merged = [];
  let pending = [];
  for (const segment of segments) {
    if (segment.hasProducts) {
      merged.push([...pending, ...segment.lines]);
      pending = [];
    } else if (merged.length) {
      merged.at(-1).push(...segment.lines);
    } else {
      pending.push(...segment.lines);
    }
  }
  if (pending.length) merged.push(pending);
  return merged.map((segment) => segment.join("\n").trim());
}

export function parseMarkdownTickets(markdownText, { today: localToday = today } = {}) {
  const warnings = [];
  const errors = [];
  const ticket = { store: null, date: null, products: [] };

  if (typeof markdownText !== "string" || !markdownText.trim()) {
    errors.push({ code: "NO_PRODUCTS", message: "El contenido está vacío." });
    return { ticket: null, warnings, errors };
  }

  const lines = markdownText.replace(/\r\n?/g, "\n").split("\n");
  const consumed = new Array(lines.length).fill(false);

  const metadataLines = [];
  let rawDate = null;
  // --- Pass 1: explicit metadata --------------------------------------------
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const storeMatch = trimmed.match(STORE_LINE);
    if (storeMatch) {
      metadataLines.push(i);
      if (!ticket.store) ticket.store = storeMatch[1].trim();
      consumed[i] = true;
      continue;
    }

    const dateMatch = trimmed.match(DATE_LINE);
    if (dateMatch) {
      metadataLines.push(i);
      if (rawDate === null) rawDate = dateMatch[1].trim();
      consumed[i] = true;
    }
  }

  // --- Pass 2: Markdown tables ----------------------------------------------
  const productSections = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (consumed[i]) continue;
    if (!isTableRow(lines[i])) continue;
    if (i + 1 >= lines.length || !isTableSeparator(lines[i + 1])) continue;

    const headers = splitRow(lines[i]).map(resolveField);
    if (!headers.includes("producto")) continue;

    consumed[i] = true;
    consumed[i + 1] = true;
    const sectionStart = i;

    let row = i + 2;
    while (row < lines.length && isTableRow(lines[row])) {
      const cells = splitRow(lines[row]);
      const fields = {};
      headers.forEach((field, index) => {
        if (field && cells[index] !== undefined) fields[field] = cells[index];
      });
      const { product, skipped } = normalizeProduct(fields, warnings, row + 1);
      if (!skipped) ticket.products.push(product);
      consumed[row] = true;
      row += 1;
    }
    productSections.push({ start: sectionStart, end: row - 1 });
    i = row - 1;
  }

  // --- Pass 3: key/value lists ----------------------------------------------
  let current = null;
  let currentStart = null;
  const flush = () => {
    if (!current) return;
    const { product, skipped } = normalizeProduct(current, warnings, currentStart + 1);
    if (!skipped) ticket.products.push(product);
    productSections.push({ start: currentStart, end: current.end });
    current = null;
    currentStart = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    if (consumed[i]) continue;
    const trimmed = lines[i].trim().replace(/^-\s*/, "");
    if (!trimmed) {
      flush();
      continue;
    }

    const kv = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!kv) continue;

    const field = resolveField(kv[1]);
    if (!field) continue;

    if (!current) {
      current = { end: i };
      currentStart = i;
    } else if (
      (field === "producto" && Object.hasOwn(current, "producto")) ||
      (field === "productoNormalizado" && Object.hasOwn(current, "productoNormalizado"))
    ) {
      flush();
      current = { end: i };
      currentStart = i;
    }
    current[field] = kv[2];
    current.end = i;
    consumed[i] = true;
  }
  flush();

  // --- Pass 4: plain lines / tab-separated columns (fallback) ----------------
  if (ticket.products.length === 0 && productSections.length === 0) {
    let block = null;
    let tsvHeaders = null;
    const closeBlock = () => {
      if (block) productSections.push(block);
      block = null;
      tsvHeaders = null;
    };

    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (consumed[i] || !trimmed || HEADING.test(trimmed) || trimmed.startsWith("|")) {
        closeBlock();
        continue;
      }

      let fields;
      if (raw.includes("\t")) {
        const cells = raw.split("\t").map((cell) => cell.trim());
        if (!tsvHeaders) {
          const resolved = cells.map(resolveField);
          if (resolved.includes("producto")) {
            tsvHeaders = resolved;
            consumed[i] = true;
            block ??= { start: i, end: i };
            continue;
          }
          tsvHeaders = LINE_FIELDS;
        }
        fields = {};
        tsvHeaders.forEach((field, index) => {
          if (field && cells[index]) fields[field] = cells[index];
        });
      } else {
        fields = parsePlainLine(trimmed);
      }
      if (!fields) continue;

      block ??= { start: i, end: i };
      block.end = i;
      consumed[i] = true;
      const { product, skipped } = normalizeProduct(fields, warnings, i + 1);
      if (!skipped) ticket.products.push(product);
    }
    closeBlock();
  }

  // --- Final validations -----------------------------------------------------
  productSections.sort((a, b) => a.start - b.start);
  productSections.forEach((section, index) => {
    const previousEnd = productSections[index - 1]?.end ?? -1;
    section.heading = lines.slice(previousEnd + 1, section.start)
      .some((line) => HEADING.test(line.trim()));
  });
  const hasSeparateAnchor = productSections.slice(1).some((section, index) =>
    metadataLines.some((line) => line > productSections[index].end && line < section.start) ||
    (productSections[index].heading && section.heading)
  );
  if (hasSeparateAnchor) {
    errors.push({
      code: "MULTIPLE_TICKETS",
      message: "Se detectaron varios tickets; solo se admite un ticket por archivo.",
    });
    return { ticket: null, warnings: [], errors };
  }

  if (ticket.products.length === 0) {
    const recoverable = warnings.some((warning) => warning.code === "ROW_OMITTED");
    errors.push({ code: "NO_PRODUCTS", message: "No se detectó ningún producto en el archivo." });
    if (!recoverable) return { ticket: null, warnings, errors };
  }

  ticket.date = parseDateValue(rawDate);
  if (!ticket.date) {
    ticket.date = localToday();
    warnings.push(rawDate === null
      ? { code: "DATE_MISSING", message: "No se detectó una fecha; se usó la fecha actual.", field: "date" }
      : { code: "DATE_INVALID", message: `Fecha inválida "${rawDate}"; se usó la fecha actual.`, field: "date", value: rawDate });
  }

  if (!ticket.store && productSections.length) {
    const firstSection = productSections[0];
    for (let i = firstSection.start - 1; i >= 0; i -= 1) {
      const heading = lines[i].trim().match(HEADING);
      if (heading) {
        ticket.store = heading[1].trim();
        break;
      }
    }
  }

  if (errors.length) return { ticket: null, warnings, errors, recovered: ticket };
  return { ticket, warnings, errors };
}
