import assert from "node:assert/strict";
import { buildPurchaseStatistics } from "../src/components/PurchaseStatistics.js";
import { getPeriodRange, migratePeriod } from "../src/utils/helpers.js";

const products = [
  { producto: "Leche", tienda: "Mercado", categoria: "Lácteos", fecha: "2026-01-03", cantidad: 2, total: 60 },
  { producto: "leche", tienda: "Mercado", categoria: "Lácteos", fecha: "2026-01-17", cantidad: 3, total: 90 },
  { producto: "Pan", tienda: "Panadería", categoria: "Panadería", fecha: "2026-02-02", cantidad: 4, total: 80 },
  { producto: "Arroz", tienda: "Mercado", categoria: "Despensa", fecha: "2026-02-17", cantidad: 3, total: 90 },
  { producto: "Café", tienda: "Abarrotes", categoria: "Despensa", fecha: "2026-02-26", cantidad: 10, total: 40 },
];
const now = new Date(2026, 1, 27);
let cases = 0;

// Whole history, grouped by month
{
  const all = buildPurchaseStatistics(products, { period: "all", groupBy: "month", now });
  assert.equal(all.totalSpent, 360);
  assert.equal(all.ticketCount, 5);
  assert.equal(all.averageTicket, 72);
  assert.equal(all.topProduct.label, "Café");
  assert.equal(all.productRanking.find((row) => row.label === "Leche").quantity, 5);
  assert.deepEqual(all.trend.map(({ key, total }) => [key, total]), [
    ["2026-01-01", 150],
    ["2026-02-01", 210],
  ]);
  const fortnights = buildPurchaseStatistics(products, { period: "all", groupBy: "fortnight", now });
  assert.deepEqual(fortnights.trend.map(({ key, total }) => [key, total]), [
    ["2026-01-01", 60],
    ["2026-01-16", 90],
    ["2026-02-01", 80],
    ["2026-02-16", 130],
  ]);
  cases += 1;
}

// Current month / fortnight / week are anchored to today, like the purchases view
{
  const month = buildPurchaseStatistics(products, { period: "month", now });
  assert.equal(month.totalSpent, 210);
  assert.equal(month.recordCount, 3);
  assert.equal(month.scopeFrom, "2026-02-01");
  assert.equal(month.scopeTo, "2026-02-28");

  const fortnight = buildPurchaseStatistics(products, { period: "fortnight", groupBy: "fortnight", now });
  assert.equal(fortnight.totalSpent, 130);
  assert.deepEqual(fortnight.trend.map(({ key, total }) => [key, total]), [["2026-02-16", 130]]);

  const week = buildPurchaseStatistics(products, { period: "week", now });
  assert.equal(week.totalSpent, 40);
  assert.equal(week.topProduct.label, "Café");
  cases += 1;
}

// Custom range
{
  const custom = buildPurchaseStatistics(products, { period: "custom", from: "2026-01-31", to: "2026-01-01", now });
  assert.equal(custom.totalSpent, 150);
  assert.equal(custom.scopeFrom, "2026-01-01");
  assert.equal(custom.scopeTo, "2026-01-31");
  assert.deepEqual(custom.trend.map(({ key, total }) => [key, total]), [["2026-01-01", 150]]);
  cases += 1;
}

// Empty history and legacy period values
{
  const empty = buildPurchaseStatistics([], { period: "week", now });
  assert.equal(empty.topProduct, null);
  assert.equal(empty.averageTicket, 0);
  assert.deepEqual(empty.trend, []);
  assert.deepEqual(["daily", "weekly", "biweekly", "monthly", "custom", "bogus"].map(migratePeriod),
    ["all", "week", "fortnight", "month", "custom", "all"]);
  assert.deepEqual(getPeriodRange("fortnight", {}, new Date(2026, 1, 3)), ["2026-02-01", "2026-02-15"]);
  cases += 1;
}

console.log(`statistics harness: ${cases} cases passed`);
