// Vanilla date-range popover calendar.
//
// Renders its own trigger + popover markup inside `root` and manages its
// open/closed and displayed-month state via closures over its DOM nodes.

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIso(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

function formatShort(iso) {
  const parsed = parseIso(iso);
  return parsed ? `${pad(parsed.d)}/${pad(parsed.m + 1)}/${parsed.y}` : "";
}

function buildMonthWeeks(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const cells = new Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toIso(year, month, day), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Mounts a date-range picker inside `root` (its content is replaced).
 * `onApply(from, to)` fires with two ISO dates once a full range is picked,
 * or `(null, null)` when the user clears the selection.
 * Returns a cleanup function that removes document listeners.
 */
export function mountDateRangePicker(
  root,
  { from, to, onApply, placeholder = "Elegir fechas", clearLabel = "Limpiar", triggerClass = "btn btn--ghost" },
) {
  root.classList.add("daterange");
  root.innerHTML = `
    <button type="button" class="${triggerClass} daterange-trigger" data-role="daterange-trigger"
      aria-haspopup="true" aria-expanded="false">
      <span aria-hidden="true">📅</span> <span data-role="daterange-label">${placeholder}</span>
    </button>
    <div class="daterange-popover" data-role="daterange-popover" hidden>
      <div class="daterange-nav">
        <button type="button" class="daterange-nav-btn" data-role="daterange-prev" aria-label="Mes anterior">‹</button>
        <span class="daterange-month" data-role="daterange-month"></span>
        <button type="button" class="daterange-nav-btn" data-role="daterange-next" aria-label="Mes siguiente">›</button>
      </div>
      <div data-role="daterange-body"></div>
      <div class="daterange-footer">
        <button type="button" class="btn btn--ghost" data-role="daterange-clear">${clearLabel}</button>
      </div>
    </div>`;

  const trigger = root.querySelector("[data-role='daterange-trigger']");
  const label = root.querySelector("[data-role='daterange-label']");
  const popover = root.querySelector("[data-role='daterange-popover']");
  const body = root.querySelector("[data-role='daterange-body']");
  const monthLabel = root.querySelector("[data-role='daterange-month']");
  const prevBtn = root.querySelector("[data-role='daterange-prev']");
  const nextBtn = root.querySelector("[data-role='daterange-next']");
  const clearBtn = root.querySelector("[data-role='daterange-clear']");

  let selStart = from || null;
  let selEnd = to || null;

  const anchor = parseIso(selStart) ?? { y: new Date().getFullYear(), m: new Date().getMonth() };
  let viewYear = anchor.y;
  let viewMonth = anchor.m;

  function updateLabel() {
    label.textContent =
      selStart && selEnd ? `${formatShort(selStart)} – ${formatShort(selEnd)}` : placeholder;
  }

  function renderCalendar() {
    monthLabel.textContent = `${MONTH_LABELS[viewMonth]} ${viewYear}`;

    const min = selStart && selEnd ? (selStart < selEnd ? selStart : selEnd) : selStart;
    const max = selStart && selEnd ? (selStart < selEnd ? selEnd : selStart) : selStart;

    const weeks = buildMonthWeeks(viewYear, viewMonth)
      .map(
        (week) => `
        <div class="daterange-week">
          ${week
            .map((cell) => {
              if (!cell) return `<span class="daterange-day daterange-day--empty"></span>`;
              const inRange = Boolean(min && max && cell.iso >= min && cell.iso <= max);
              const isEdge = cell.iso === min || cell.iso === max;
              const classes = ["daterange-day"];
              if (inRange) classes.push("daterange-day--in-range");
              if (isEdge) classes.push("daterange-day--edge");
              return `<button type="button" class="${classes.join(" ")}" data-iso="${cell.iso}">${cell.day}</button>`;
            })
            .join("")}
        </div>`,
      )
      .join("");

    body.innerHTML = `
      <div class="daterange-weekdays">${WEEKDAY_LABELS.map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="daterange-weeks">${weeks}</div>`;

    body.querySelectorAll("[data-iso]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        handlePick(btn.dataset.iso);
      });
    });
  }

  function handlePick(iso) {
    if (!selStart || selEnd) {
      selStart = iso;
      selEnd = null;
    } else if (iso < selStart) {
      selEnd = selStart;
      selStart = iso;
    } else {
      selEnd = iso;
    }

    updateLabel();
    renderCalendar();

    if (selStart && selEnd) {
      onApply(selStart, selEnd);
      close();
    }
  }

  function open() {
    popover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    renderCalendar();
  }

  function close() {
    popover.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    popover.hidden ? open() : close();
  });

  prevBtn.addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });

  nextBtn.addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });

  clearBtn.addEventListener("click", () => {
    selStart = null;
    selEnd = null;
    updateLabel();
    renderCalendar();
    onApply(null, null);
    close();
  });

  const handleDocumentClick = (event) => {
    if (!popover.hidden && !root.contains(event.target)) close();
  };

  const handleDocumentKeydown = (event) => {
    if (event.key === "Escape" && !popover.hidden) close();
  };

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);

  updateLabel();

  return () => {
    document.removeEventListener("click", handleDocumentClick);
    document.removeEventListener("keydown", handleDocumentKeydown);
  };
}
