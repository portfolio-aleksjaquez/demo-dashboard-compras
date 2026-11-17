// Tickets view: one card per purchase (store · date · total), expandable to
// show its lines, with actions to edit or delete the whole Ticket. With
// search/category filters a card only lists (and sums) the matching lines;
// `fullCount` tells how many lines the Ticket really has.

import { escapeHtml, formatCurrency, formatDate, formatNumber } from "../utils/helpers.js";

function ticketCard(ticket, isOpen) {
  const count = ticket.products.length;
  const lines = ticket.products
    .map((p) => `
      <li class="ticket__line">
        <span class="ticket__line-name">${escapeHtml(p.producto)}</span>
        <span class="tag">${escapeHtml(p.categoria)}</span>
        <span class="ticket__line-meta">${formatNumber(p.cantidad)} × ${formatCurrency(p.precioUnitario)}</span>
        <span class="ticket__line-total">${formatCurrency(p.total)}</span>
      </li>`)
    .join("");
  const label = `${ticket.store}, ${formatDate(ticket.date)}`;

  return `
    <article class="ticket${isOpen ? " ticket--open" : ""}" data-key="${escapeHtml(ticket.key)}">
      <div class="ticket__head">
        <button type="button" class="ticket__toggle" data-action="toggle" aria-expanded="${isOpen}">
          <span class="ticket__chevron" aria-hidden="true">${isOpen ? "▾" : "▸"}</span>
          <span class="ticket__title">
            <span class="ticket__store">${escapeHtml(ticket.store)}</span>
            <span class="ticket__sub">${formatDate(ticket.date)} · ${ticket.fullCount > count
              ? `${formatNumber(count)} de ${formatNumber(ticket.fullCount)} productos coinciden`
              : `${formatNumber(count)} producto${count === 1 ? "" : "s"}`}</span>
          </span>
          <span class="ticket__amount">${formatCurrency(ticket.total)}</span>
        </button>
        <div class="ticket__actions">
          <button type="button" class="icon-btn" data-action="edit" aria-label="Editar ticket ${escapeHtml(label)}" title="Editar ticket">✏️</button>
          <button type="button" class="icon-btn icon-btn--danger" data-action="delete" aria-label="Eliminar ticket ${escapeHtml(label)}" title="Eliminar ticket">🗑️</button>
        </div>
      </div>
      <ul class="ticket__lines" ${isOpen ? "" : "hidden"}>${lines}</ul>
    </article>`;
}

export function renderTicketList(container, { tickets, limit, openKeys, onToggle, onEdit, onDelete, onShowMore }) {
  if (tickets.length === 0) {
    container.innerHTML = `
      <div class="empty empty--compact">
        <p class="empty__title">No hay tickets con estos filtros</p>
        <p class="empty__text">Cambia el período o limpia los filtros.</p>
      </div>`;
    return;
  }

  const visible = tickets.slice(0, limit);
  const remaining = tickets.length - visible.length;
  container.innerHTML = `
    <div class="ticket-list">${visible.map((ticket) => ticketCard(ticket, openKeys.has(ticket.key))).join("")}</div>
    ${remaining > 0 ? `
      <div class="list-more">
        <button type="button" class="btn btn--ghost" data-action="more">Mostrar más (${formatNumber(remaining)} restantes)</button>
      </div>` : ""}`;

  container.onclick = (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "more") return onShowMore();
    const key = button.closest("[data-key]")?.dataset.key;
    const ticket = tickets.find((item) => item.key === key);
    if (!ticket) return;
    if (button.dataset.action === "toggle") onToggle(key);
    if (button.dataset.action === "edit") onEdit(ticket);
    if (button.dataset.action === "delete") onDelete(ticket);
  };
}
