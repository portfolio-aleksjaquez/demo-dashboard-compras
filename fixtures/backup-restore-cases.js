import assert from "node:assert/strict";

import { restoreJsonBackup } from "../src/utils/restoreJsonBackup.js";

const products = [{
  id: "product-1",
  tienda: "Mercado Central",
  fecha: "2026-07-18",
  producto: "Leche",
  cantidad: 2,
  precioUnitario: 28,
  total: 56,
  categoria: "Lácteos",
  fechaDeCarga: "2026-07-24T18:00:00.000Z",
}];

{
  let saved;
  const outcome = restoreJsonBackup(JSON.stringify(products), {
    saveProducts: (next) => {
      saved = next;
      return true;
    },
  });
  assert.equal(outcome.status, "restored");
  assert.deepEqual(outcome.products, products);
  assert.equal(saved, outcome.products);
}

for (const invalid of [
  "not json",
  JSON.stringify({ products }),
  JSON.stringify([{ ...products[0], fecha: "2026-02-31" }]),
  JSON.stringify([{ ...products[0], fecha: "2025-02-29" }]),
  JSON.stringify([{ ...products[0], total: -1 }]),
  JSON.stringify([products[0], products[0]]),
]) {
  let saves = 0;
  const outcome = restoreJsonBackup(invalid, { saveProducts: () => { saves += 1; return true; } });
  assert.equal(outcome.status, "invalid");
  assert.equal(saves, 0);
}

{
  const outcome = restoreJsonBackup(JSON.stringify(products), { saveProducts: () => false });
  assert.equal(outcome.status, "save_failed");
  assert.equal(outcome.products, undefined);
}

console.log("backup restore harness: 8 cases passed");
