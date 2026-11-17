// Header actions: the primary "Nuevo ticket" button and a "Datos" menu that
// groups backup, restore, report and the destructive "borrar todo".

export function renderHeaderActions(container, { onNewTicket, onBackup, onRestore, onReport, onClearAll }) {
  container.innerHTML = `
    <button type="button" class="btn btn--primary" data-action="new-ticket">+ Nuevo ticket</button>
    <div class="menu">
      <button type="button" class="btn btn--ghost" id="data-menu-button" aria-haspopup="menu" aria-expanded="false" aria-controls="data-menu">
        Datos <span aria-hidden="true">▾</span>
      </button>
      <div class="menu__list" id="data-menu" role="menu" aria-labelledby="data-menu-button" hidden>
        <button type="button" class="menu__item" role="menuitem" data-action="backup">
          <span aria-hidden="true">💾</span> Descargar respaldo (JSON)
        </button>
        <button type="button" class="menu__item" role="menuitem" data-action="restore">
          <span aria-hidden="true">♻️</span> Restaurar respaldo…
        </button>
        <button type="button" class="menu__item" role="menuitem" data-action="report">
          <span aria-hidden="true">📝</span> Exportar reporte (Markdown)
        </button>
        <hr class="menu__separator" />
        <button type="button" class="menu__item menu__item--danger" role="menuitem" data-action="clear">
          <span aria-hidden="true">🗑️</span> Borrar todo el historial…
        </button>
      </div>
      <input type="file" id="restore-json-file" accept="application/json,.json" hidden />
    </div>`;

  const trigger = container.querySelector("#data-menu-button");
  const list = container.querySelector("#data-menu");
  const fileInput = container.querySelector("#restore-json-file");
  const items = () => [...list.querySelectorAll("[role='menuitem']")];

  const setOpen = (open, { focusFirst = false } = {}) => {
    list.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    if (open && focusFirst) items()[0].focus();
  };

  trigger.addEventListener("click", () => setOpen(list.hidden, { focusFirst: true }));
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true, { focusFirst: true });
    }
  });

  list.addEventListener("keydown", (event) => {
    const all = items();
    const current = all.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      all[(current + step + all.length) % all.length].focus();
    } else if (event.key === "Escape") {
      setOpen(false);
      trigger.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!list.hidden && !container.querySelector(".menu").contains(event.target)) setOpen(false);
  });

  const actions = {
    backup: onBackup,
    restore: () => fileInput.click(),
    report: onReport,
    clear: onClearAll,
  };

  container.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "new-ticket") return onNewTicket();
    if (!actions[action]) return;
    setOpen(false);
    actions[action]();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) onRestore(file);
  });
}
