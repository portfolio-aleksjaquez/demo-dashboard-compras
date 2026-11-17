import assert from "node:assert/strict";
import {
  canonicalNumber,
  canonicalText,
  fingerprintTicket,
  groupPersistedTicketBatches,
  isValidPersistedTimestamp,
} from "../../src/utils/ticketFingerprint.js";

const milk = {
  producto: "Leche Entera",
  categoria: "Lácteos",
  cantidad: 2,
  precioUnitario: 28,
  total: 56,
};
const bread = {
  producto: "Pan",
  categoria: "Panadería",
  cantidad: 1,
  precioUnitario: 35.5,
  total: 35.5,
};
const ticket = { store: "Mercado Central", date: "2026-07-18", products: [milk, bread] };

assert.equal(canonicalText("  LÁCTEOS\t frescos  "), "lacteos frescos");
assert.equal(canonicalNumber("035.500"), "35.5");
assert.equal(canonicalNumber(35.504), "35.5");
assert.equal(canonicalNumber(Number.NaN), null);
assert.equal(isValidPersistedTimestamp("2026-07-18T12:00:00.000Z"), true);
assert.equal(isValidPersistedTimestamp("2026-02-31T12:00:00.000Z"), false);

const presentationVariant = {
  store: "  MERCADO   céntral ",
  date: "2026-07-18",
  products: [
    { ...bread, producto: " pÁn ", categoria: "PANADERIA", precioUnitario: "35.500" },
    { ...milk, producto: "LECHE   ENTERA", categoria: "lacteos", cantidad: "2.00" },
  ],
};
assert.equal(fingerprintTicket(ticket), fingerprintTicket(presentationVariant));

const oneMilk = { ...ticket, products: [milk] };
const twoMilks = { ...ticket, products: [milk, milk] };
assert.notEqual(fingerprintTicket(oneMilk), fingerprintTicket(twoMilks));
assert.notEqual(
  fingerprintTicket(ticket),
  fingerprintTicket({ ...ticket, products: [milk, { ...bread, total: 36 }] }),
);

const persisted = [
  { ...milk, tienda: "Mercado Central", fecha: "2026-07-18", fechaDeCarga: "2026-07-18T12:00:00.000Z" },
  { ...bread, tienda: " mercado céntral ", fecha: "2026-07-18", fechaDeCarga: "2026-07-18T12:00:00.000Z" },
  { ...bread, tienda: "Mercado Central", fecha: "2026-07-18" },
  { ...bread, tienda: "Mercado Central", fecha: "2026-07-18", fechaDeCarga: "not-a-date" },
];
const batches = groupPersistedTicketBatches(persisted);
assert.equal(batches.length, 1);
assert.equal(batches[0].products.length, 2);
assert.equal(
  fingerprintTicket({ store: batches[0].store, date: batches[0].date, products: batches[0].products }),
  fingerprintTicket(ticket),
);

console.log("8 fingerprint cases passed; 1 conservative persisted batch reconstructed");
