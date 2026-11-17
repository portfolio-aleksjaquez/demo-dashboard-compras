// Summary cards for the filtered purchases: spending, tickets, average per
// ticket and last purchase.

import { escapeHtml, formatCurrency, formatNumber, formatDate } from "../utils/helpers.js";

function card(icon, label, value, detail = "") {
  return `
    <article class="stat-card">
      <span class="stat-card__icon" aria-hidden="true">${icon}</span>
      <div class="stat-card__body">
        <span class="stat-card__label">${label}</span>
        <strong class="stat-card__value">${value}</strong>
        ${detail ? `<span class="stat-card__detail">${escapeHtml(detail)}</span>` : ""}
      </div>
    </article>`;
}

/**
 * @param {HTMLElement} container
 * @param {{ tickets: object[], allTicketCount: number, allSpent: number, filtered: boolean }} props
 */
export function renderDashboardSummary(container, { tickets, allTicketCount, allSpent, filtered }) {
  const spent = tickets.reduce((sum, ticket) => sum + ticket.total, 0);
  const products = tickets.reduce((sum, ticket) => sum + ticket.products.length, 0);
  const lastDate = tickets.reduce((max, ticket) => (ticket.date > max ? ticket.date : max), "");
  const average = tickets.length ? spent / tickets.length : 0;

  container.innerHTML = `
    <div class="stat-grid">
      ${card("💰", filtered ? "Gasto (filtrado)" : "Gasto total", formatCurrency(spent),
        filtered ? `de ${formatCurrency(allSpent)} en total` : "")}
      ${card("🧾", "Tickets", formatNumber(tickets.length),
        filtered ? `de ${formatNumber(allTicketCount)} · ${formatNumber(products)} productos` : `${formatNumber(products)} productos`)}
      ${card("🛒", "Promedio por ticket", formatCurrency(average))}
      ${card("🕑", "Última compra", lastDate ? formatDate(lastDate) : "—")}
    </div>`;
}
