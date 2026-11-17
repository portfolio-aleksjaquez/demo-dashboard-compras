// Native <dialog> helpers that replace window.confirm / window.prompt.

import { escapeHtml } from "../utils/helpers.js";

/**
 * Open a modal dialog and resolve with the `value` of the pressed action, or
 * `null` when dismissed (Esc / close button).
 * @param {{ title: string, body?: string, actions?: { label: string, value: string, variant?: string }[], className?: string }} options
 */
export function openDialog({ title, body = "", actions = [], className = "" }) {
  const dialog = document.createElement("dialog");
  dialog.className = `dialog ${className}`.trim();
  dialog.innerHTML = `
    <form method="dialog" class="dialog__form">
      <header class="dialog__head">
        <h2 class="dialog__title">${escapeHtml(title)}</h2>
        <button class="icon-btn dialog__close" value="" aria-label="Cerrar">✕</button>
      </header>
      <div class="dialog__body">${body}</div>
      <footer class="dialog__actions">
        ${actions.map((action) => `
          <button class="btn btn--${action.variant ?? "ghost"}" value="${escapeHtml(action.value)}">${escapeHtml(action.label)}</button>`).join("")}
      </footer>
    </form>`;
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue || null);
      dialog.remove();
    }, { once: true });
    dialog.showModal();
    dialog.querySelector(".dialog__actions .btn:last-child")?.focus();
  });
}

/** Ask for confirmation. Resolves `true` only when the user confirms. */
export async function confirmDialog({ title, message, confirmLabel = "Confirmar", danger = false }) {
  const result = await openDialog({
    title,
    body: `<p class="dialog__text">${escapeHtml(message)}</p>`,
    actions: [
      { label: "Cancelar", value: "cancel" },
      { label: confirmLabel, value: "confirm", variant: danger ? "danger-solid" : "primary" },
    ],
  });
  return result === "confirm";
}
