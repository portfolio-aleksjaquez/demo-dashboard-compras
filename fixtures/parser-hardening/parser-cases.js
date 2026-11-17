import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseMarkdownTickets } from "../../src/utils/parseMarkdownTickets.js";

const fixture = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");
const fixedToday = () => "2026-07-19";

const table = parseMarkdownTickets(await fixture("table.md"), { today: fixedToday });
assert.deepEqual(table, {
  ticket: {
    store: "Mercado Central",
    date: "2026-07-18",
    products: [{
      producto: "Leche",
      cantidad: 2,
      precioUnitario: 28,
      total: 56,
      categoria: "Lácteos",
    }],
  },
  warnings: [],
  errors: [],
});

const keyValue = parseMarkdownTickets(await fixture("key-value.md"), { today: fixedToday });
assert.deepEqual(keyValue, table);

const normalizedTableName = parseMarkdownTickets(`Tienda: Mercado Central
Fecha: 2026-07-18

| Producto | Nombre normalizado | Total |
|---|---|---:|
| LECHE ENT 1L MARCA X | Leche entera | 28 |
`, { today: fixedToday });
assert.equal(normalizedTableName.ticket.products[0].producto, "Leche entera");

const normalizedKeyValueName = parseMarkdownTickets(`Tienda: Mercado Central
Fecha: 2026-07-18

- Producto: LECHE ENT 1L MARCA X
  Nombre normalizado: Leche entera
  Total: 28
`, { today: fixedToday });
assert.equal(normalizedKeyValueName.ticket.products[0].producto, "Leche entera");

const invalidDate = parseMarkdownTickets(await fixture("invalid-date.md"), { today: fixedToday });
assert.equal(invalidDate.ticket.date, "2026-07-19");
assert.deepEqual(invalidDate.warnings, [{
  code: "DATE_INVALID",
  message: 'Fecha inválida "31/02/2026"; se usó la fecha actual.',
  field: "date",
  value: "31/02/2026",
}]);

const missingDate = parseMarkdownTickets(
  await fixture("benign-headings-missing-date.md"),
  { today: fixedToday },
);
assert.equal(missingDate.ticket.store, "Almacén Norte");
assert.equal(missingDate.ticket.date, "2026-07-19");
assert.equal(missingDate.warnings[0].code, "DATE_MISSING");

const mixedRows = parseMarkdownTickets(await fixture("mixed-rows.md"), { today: fixedToday });
assert.deepEqual(mixedRows.ticket.products.map(({ producto }) => producto), ["Café", "Té"]);
assert.deepEqual(mixedRows.warnings.map(({ code }) => code), [
  "ROW_OMITTED",
  "ROW_OMITTED",
  "ROW_OMITTED",
  "ROW_OMITTED",
  "ROW_OMITTED",
]);

const multipleTickets = parseMarkdownTickets(await fixture("multi-ticket.md"), { today: fixedToday });
assert.equal(multipleTickets.ticket, null);
assert.deepEqual(multipleTickets.errors, [{
  code: "MULTIPLE_TICKETS",
  message: "Se detectaron varios tickets; solo se admite un ticket por archivo.",
}]);

const empty = parseMarkdownTickets("", { today: fixedToday });
assert.equal(empty.ticket, null);
assert.equal(empty.errors[0].code, "NO_PRODUCTS");

const missingStore = parseMarkdownTickets("Fecha: 2026-07-18\n\nProducto: Pan\nTotal: 35", {
  today: fixedToday,
});
assert.equal(missingStore.ticket.store, null);
assert.equal(missingStore.ticket.products[0].producto, "Pan");

console.log("10 parser cases passed");
