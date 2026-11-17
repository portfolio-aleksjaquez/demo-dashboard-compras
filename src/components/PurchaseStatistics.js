// Purchase analytics and dependency-free charts. The scope comes from the
// shared period bar; the trend chart groups that scope by week, fortnight or
// month.

import {
  describeRange,
  escapeHtml,
  formatCurrency,
  formatNumber,
  getPeriodRange,
  GROUP_OPTIONS,
  nextPeriod,
  normalizeText,
  parseIsoDate,
  periodStart,
  toIsoDate,
} from "../utils/helpers.js";
import { groupTickets } from "../utils/tickets.js";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const monthDate = new Intl.DateTimeFormat("es-MX", { month: "short", year: "numeric" });

function bucketLabel(date, groupBy) {
  if (groupBy === "week") {
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6);
    return `${shortDate.format(date)}–${shortDate.format(end)}`;
  }
  if (groupBy === "fortnight") {
    return `${date.getDate() === 1 ? "1ª" : "2ª"} · ${monthDate.format(date)}`;
  }
  return monthDate.format(date);
}

function aggregate(products, field, fallback) {
  const groups = new Map();
  for (const product of products) {
    const label = String(product[field] || fallback).trim();
    const key = normalizeText(label);
    if (!groups.has(key)) groups.set(key, { label, quantity: 0, total: 0, records: 0 });
    const group = groups.get(key);
    group.quantity += number(product.cantidad);
    group.total += number(product.total);
    group.records += 1;
  }
  return [...groups.values()];
}

function buildTrend(products, groupBy, range) {
  const totals = new Map();
  const dates = [];
  for (const product of products) {
    const date = parseIsoDate(product.fecha);
    if (!date) continue;
    dates.push(date);
    const key = toIsoDate(periodStart(date, groupBy));
    const current = totals.get(key) || { total: 0, quantity: 0 };
    current.total += number(product.total);
    current.quantity += number(product.cantidad);
    totals.set(key, current);
  }
  if (dates.length === 0) return [];

  const bounds = range
    ? range.map(parseIsoDate)
    : [new Date(Math.min(...dates)), new Date(Math.max(...dates))];
  const last = periodStart(bounds[1], groupBy);
  const result = [];
  for (let cursor = periodStart(bounds[0], groupBy); cursor <= last; cursor = nextPeriod(cursor, groupBy)) {
    const value = totals.get(toIsoDate(cursor)) || { total: 0, quantity: 0 };
    result.push({ key: toIsoDate(cursor), label: bucketLabel(cursor, groupBy), ...value });
  }
  return result.slice(-12);
}

/**
 * @param {object[]} products
 * @param {{ period?: string, from?: string, to?: string, groupBy?: string, now?: Date }} options
 */
export function buildPurchaseStatistics(products, { period = "all", from = "", to = "", groupBy = "month", now = new Date() } = {}) {
  const grouping = GROUP_OPTIONS.some((option) => option.value === groupBy) ? groupBy : "month";
  const range = getPeriodRange(period, { from, to }, now);
  const scoped = range
    ? products.filter((product) => product.fecha >= range[0] && product.fecha <= range[1])
    : products;

  const productRanking = aggregate(scoped, "producto", "Sin nombre")
    .sort((a, b) => b.quantity - a.quantity || b.total - a.total);
  const spendingProducts = productRanking.slice().sort((a, b) => b.total - a.total);
  const totalSpent = scoped.reduce((sum, product) => sum + number(product.total), 0);
  const ticketCount = groupTickets(scoped).length;

  return {
    totalSpent,
    totalQuantity: scoped.reduce((sum, product) => sum + number(product.cantidad), 0),
    ticketCount,
    averageTicket: ticketCount ? totalSpent / ticketCount : 0,
    recordCount: scoped.length,
    scopeLabel: describeRange(range),
    scopeFrom: range?.[0] ?? "",
    scopeTo: range?.[1] ?? "",
    topProduct: productRanking[0] || null,
    topSpendingProduct: spendingProducts[0] || null,
    productRanking,
    spendingProducts,
    stores: aggregate(scoped, "tienda", "Sin tienda").sort((a, b) => b.total - a.total),
    categories: aggregate(scoped, "categoria", "Sin categoría").sort((a, b) => b.total - a.total),
    trend: buildTrend(scoped, grouping, range),
  };
}

function kpi(icon, label, value, detail = "") {
  return `<article class="analytics-kpi">
    <span class="analytics-kpi__icon" aria-hidden="true">${icon}</span>
    <span class="analytics-kpi__label">${label}</span>
    <strong class="analytics-kpi__value">${escapeHtml(value)}</strong>
    ${detail ? `<span class="analytics-kpi__detail">${escapeHtml(detail)}</span>` : ""}
  </article>`;
}

function horizontalChart(title, hint, rows, value, formattedValue, limit = 8) {
  const visible = rows.slice(0, limit);
  const max = Math.max(...visible.map(value), 1);
  const bars = visible.length ? visible.map((row, index) => `
    <div class="analytics-bar__row">
      <span class="analytics-bar__rank">${index + 1}</span>
      <span class="analytics-bar__label" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
      <div class="analytics-bar__track" aria-hidden="true">
        <div class="analytics-bar__fill" style="width:${Math.max((value(row) / max) * 100, 2)}%"></div>
      </div>
      <strong class="analytics-bar__value">${formattedValue(row)}</strong>
    </div>`).join("") : `<p class="analytics-empty">No hay compras en este período.</p>`;

  return `<article class="card analytics-card">
    <div class="section__head">
      <div><h2 class="section__title">${title}</h2><p class="section__hint">${hint}</p></div>
    </div>
    <div class="analytics-bars">${bars}</div>
  </article>`;
}

function trendChart(data) {
  if (data.length === 0) {
    return `<p class="analytics-empty analytics-empty--trend">No hay compras en este período.</p>`;
  }
  const max = Math.max(...data.map((point) => point.total), 1);
  return `<div class="trend-chart" role="img" aria-label="Tendencia del gasto por período">
    ${data.map((point) => `
      <div class="trend-chart__column" title="${escapeHtml(point.label)}: ${formatCurrency(point.total)}; ${formatNumber(point.quantity)} unidades">
        <span class="trend-chart__value">${formatCurrency(point.total)}</span>
        <div class="trend-chart__track">
          <div class="trend-chart__bar" style="height:${point.total ? Math.max((point.total / max) * 100, 4) : 0}%"></div>
        </div>
        <span class="trend-chart__label">${escapeHtml(point.label)}</span>
      </div>`).join("")}
  </div>`;
}

export function renderPurchaseStatistics(container, { products, period, customFrom, customTo, groupBy, onGroupByChange }) {
  if (products.length === 0) {
    container.innerHTML = `<div class="empty">
      <span class="empty__icon" aria-hidden="true">📊</span>
      <p class="empty__title">Todavía no hay estadísticas</p>
      <p class="empty__text">Agrega tickets para descubrir tendencias, productos y tiendas destacadas.</p>
    </div>`;
    return;
  }

  const stats = buildPurchaseStatistics(products, { period, from: customFrom, to: customTo, groupBy });
  const scope = escapeHtml(stats.scopeLabel);
  const groupButtons = GROUP_OPTIONS.map(({ value, label }) => `
    <button type="button" class="segmented__button" data-group="${value}" aria-pressed="${groupBy === value}">${label}</button>`).join("");

  container.innerHTML = `
    <div class="analytics-heading">
      <h1 class="analytics-heading__title">Estadísticas de compras</h1>
      <p class="analytics-heading__subtitle">Resultados de <strong>${scope}</strong>. El período es el mismo que en Compras.</p>
    </div>
    <div class="analytics-kpis">
      ${kpi("💰", "Gasto total", formatCurrency(stats.totalSpent), `${formatNumber(stats.ticketCount)} ticket${stats.ticketCount === 1 ? "" : "s"}`)}
      ${kpi("🧾", "Promedio por ticket", formatCurrency(stats.averageTicket), `${formatNumber(stats.recordCount)} productos · ${formatNumber(stats.totalQuantity)} unidades`)}
      ${kpi("🏆", "Producto más comprado", stats.topProduct?.label || "Sin compras", stats.topProduct ? `${formatNumber(stats.topProduct.quantity)} unidades` : "En este período")}
      ${kpi("💳", "Mayor gasto en producto", stats.topSpendingProduct?.label || "Sin compras", stats.topSpendingProduct ? formatCurrency(stats.topSpendingProduct.total) : "En este período")}
    </div>
    <article class="card analytics-card analytics-card--wide">
      <div class="section__head">
        <div><h2 class="section__title">Tendencia de gasto</h2><p class="section__hint">Se muestran hasta 12 períodos.</p></div>
        <div class="segmented" role="group" aria-label="Agrupar tendencia por">${groupButtons}</div>
      </div>
      ${trendChart(stats.trend)}
    </article>
    <div class="analytics-grid">
      ${horizontalChart("Gasto por categoría", `Categorías con mayor gasto en ${scope}.`, stats.categories, (row) => row.total, (row) => formatCurrency(row.total))}
      ${horizontalChart("Gasto por tienda", `Total por establecimiento en ${scope}.`, stats.stores, (row) => row.total, (row) => formatCurrency(row.total))}
      ${horizontalChart("Productos más comprados", `Unidades acumuladas en ${scope}.`, stats.productRanking, (row) => row.quantity, (row) => `${formatNumber(row.quantity)} u.`)}
      ${horizontalChart("Productos con más gasto", `Importe acumulado en ${scope}.`, stats.spendingProducts, (row) => row.total, (row) => formatCurrency(row.total))}
    </div>`;

  container.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => onGroupByChange(button.dataset.group));
  });
}
