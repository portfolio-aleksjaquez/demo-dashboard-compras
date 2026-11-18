// Tutorial "¿Cómo funciona?": un modal de cinco pasos para quien nunca ha usado
// la app. Cada paso lleva una mini ilustración animada (HTML/CSS, sin imágenes)
// hecha con los mismos colores de la interfaz.
//
// Accesibilidad: <dialog> modal con role="dialog" y aria-modal, foco atrapado
// dentro, Esc cierra, el foco regresa al botón que lo abrió y las animaciones
// se apagan con prefers-reduced-motion (las escenas se ven en su estado final).

const RECEIPT_SVG = `
  <svg class="tut-receipt__svg" viewBox="0 0 48 64" aria-hidden="true">
    <path d="M4 2h40v56l-5-3.5-5 3.5-5-3.5-5 3.5-5-3.5-5 3.5-5-3.5z" class="tut-receipt__paper"/>
    <rect x="11" y="10" width="18" height="3" rx="1.5" class="tut-receipt__ink"/>
    <rect x="11" y="19" width="26" height="2.5" rx="1.25" class="tut-receipt__line"/>
    <rect x="11" y="26" width="22" height="2.5" rx="1.25" class="tut-receipt__line"/>
    <rect x="11" y="33" width="26" height="2.5" rx="1.25" class="tut-receipt__line"/>
    <rect x="11" y="40" width="16" height="2.5" rx="1.25" class="tut-receipt__line"/>
    <rect x="25" y="46" width="12" height="3" rx="1.5" class="tut-receipt__ink"/>
  </svg>`;

const SCENES = {
  prompt: `
    <div class="tut tut--prompt">
      <div class="tut-side">
        <div class="tut-mini tut-mini--ghost tut-pulse">
          <span aria-hidden="true">📋</span> Copiar prompt
          <span class="tut-check">✓</span>
        </div>
        <div class="tut-receipt">${RECEIPT_SVG}<span class="tut-caption">Foto del ticket</span></div>
      </div>
      <div class="tut-arrow" aria-hidden="true">→</div>
      <div class="tut-window">
        <div class="tut-window__head"><span class="tut-window__dot"></span>Tu IA</div>
        <div class="tut-window__body">
          <div class="tut-bubble tut-bubble--1">
            <span class="tut-skel tut-skel--w90"></span>
            <span class="tut-skel tut-skel--w60"></span>
          </div>
          <div class="tut-bubble tut-bubble--2">
            <span class="tut-thumb">${RECEIPT_SVG}</span>
            <span class="tut-bubble__label">ticket.jpg</span>
          </div>
          <div class="tut-bubble tut-bubble--ai tut-typing" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </div>
    </div>`,

  paste: `
    <div class="tut tut--paste">
      <div class="tut-window tut-window--ai">
        <div class="tut-window__head"><span class="tut-window__dot"></span>Respuesta de la IA</div>
        <pre class="tut-code"><span># Súper Central</span><span>Fecha: 2026-11-17</span><span>| Leche | 2 | 57.00 |</span><span>| Pan   | 1 | 18.00 |</span></pre>
      </div>
      <div class="tut-arrow tut-arrow--paste" aria-hidden="true">
        <span>→</span>
        <kbd>Ctrl</kbd><kbd>V</kbd>
      </div>
      <div class="tut-window tut-window--paste">
        <div class="tut-window__head">Pega aquí</div>
        <pre class="tut-code tut-code--paste"><span class="tut-line tut-line--1"># Súper Central</span><span class="tut-line tut-line--2">Fecha: 2026-11-17</span><span class="tut-line tut-line--3">| Leche | 2 | 57.00 |</span><span class="tut-line tut-line--4">| Pan   | 1 | 18.00 |</span></pre>
        <div class="tut-chip tut-chip--success"><span aria-hidden="true">✓</span> Se abre la revisión</div>
      </div>
    </div>`,

  review: `
    <div class="tut tut--review">
      <div class="tut-editor">
        <div class="tut-editor__head">
          <strong>Revisar ticket</strong>
          <span class="tut-editor__meta">Súper Central · 17 nov</span>
        </div>
        <div class="tut-editor__table">
          <div class="tut-row tut-row--head"><span>Producto</span><span>Cant.</span><span>Total</span></div>
          <div class="tut-row"><span>Leche entera 1 L</span><span>2</span><span>57.00</span></div>
          <div class="tut-row"><span>Pan dulce</span><span>1</span><span>18.00</span></div>
          <div class="tut-row tut-row--fix">
            <span>Huevo 18 piezas</span><span>1</span>
            <span class="tut-fix">
              <span class="tut-fix__old">6.20</span>
              <span class="tut-fix__new">62.00</span>
            </span>
            <span class="tut-row__note">
              <span class="tut-row__note-old">⚠ ¿Es correcto este precio?</span>
              <span class="tut-row__note-new">✓ Corregido</span>
            </span>
          </div>
        </div>
        <div class="tut-editor__foot">
          <span class="tut-editor__total">Total <strong>$137.00</strong></span>
          <span class="tut-mini tut-mini--primary tut-pulse">Guardar ticket</span>
        </div>
      </div>
    </div>`,

  history: `
    <div class="tut tut--history">
      <div class="tut-seg" aria-hidden="true">
        <span class="tut-seg__thumb"></span>
        <span class="tut-seg__opt tut-seg__opt--a">Tickets</span>
        <span class="tut-seg__opt tut-seg__opt--b">Productos</span>
      </div>
      <div class="tut-list">
        <div class="tut-list__view tut-list__view--a">
          <div class="tut-item"><span class="tut-item__main">Súper Central<small>12 nov · 9 productos</small></span><strong>$412.50</strong></div>
          <div class="tut-item"><span class="tut-item__main">Mercado La Esquina<small>9 nov · 6 productos</small></span><strong>$186.00</strong></div>
          <div class="tut-item"><span class="tut-item__main">Panadería La Espiga<small>8 nov · 3 productos</small></span><strong>$74.00</strong></div>
        </div>
        <div class="tut-list__view tut-list__view--b">
          <div class="tut-item"><span class="tut-item__main">Leche entera 1 L<small>Lácteos · 4 compras</small></span><strong>$114.00</strong></div>
          <div class="tut-item"><span class="tut-item__main">Aguacate (kg)<small>Frutas y verduras · 3 compras</small></span><strong>$216.00</strong></div>
          <div class="tut-item"><span class="tut-item__main">Pan dulce<small>Panadería · 7 compras</small></span><strong>$126.00</strong></div>
        </div>
      </div>
    </div>`,

  stats: `
    <div class="tut tut--stats">
      <div class="tut-kpis">
        <div class="tut-kpi"><small>Gasto del mes</small><strong>$3,980</strong></div>
        <div class="tut-kpi"><small>Tickets</small><strong>14</strong></div>
      </div>
      <div class="tut-bars">
        <div class="tut-bar tut-bar--1"><span>Despensa</span><i><b style="--w:100%"></b></i><em>$1,640</em></div>
        <div class="tut-bar tut-bar--2"><span>Lácteos</span><i><b style="--w:63%"></b></i><em>$1,040</em></div>
        <div class="tut-bar tut-bar--3"><span>Frutas y verduras</span><i><b style="--w:48%"></b></i><em>$780</em></div>
        <div class="tut-bar tut-bar--4"><span>Limpieza</span><i><b style="--w:32%"></b></i><em>$520</em></div>
      </div>
    </div>`,
};

const STEPS = [
  {
    key: "prompt",
    title: "Copia el prompt y dáselo a tu IA",
    text: "Toca «Copiar prompt para la IA». Luego abre tu asistente de IA favorito, pega el texto y súbele la foto de tu ticket.",
  },
  {
    key: "paste",
    title: "Pega la respuesta de la IA",
    text: "La IA te responde con el ticket ya ordenado. Cópialo y pégalo en el cuadro «Agregar ticket»: la revisión se abre sola.",
  },
  {
    key: "review",
    title: "Revisa y corrige antes de guardar",
    text: "Lee los productos y los precios. Si algo no cuadra, cámbialo ahí mismo. Nada se guarda hasta que pulses «Guardar ticket».",
  },
  {
    key: "history",
    title: "Consulta tu historial",
    text: "En «Compras» ves todo lo que has registrado. Cámbialo entre Tickets (una compra completa) y Productos (cada artículo), y usa los filtros para buscar.",
  },
  {
    key: "stats",
    title: "Mira en qué se va tu dinero",
    text: "La pestaña «Estadísticas» muestra cuánto gastas por categoría, por tienda y por semana, para que veas a dónde se va cada peso.",
  },
];

let active = null;

/**
 * Open the tutorial. Resolves when it closes with the reason: "example" (the
 * user asked to try the sample ticket), "done" (finished) or "closed"
 * (skipped, ✕, Esc or click outside).
 * @param {{ opener?: HTMLElement | null }} [options]
 * @returns {Promise<"example" | "done" | "closed">}
 */
export function openTutorial({ opener = null } = {}) {
  if (active) return active.promise;

  const returnFocusTo = opener ?? document.activeElement;
  let current = 0;
  let reason = "closed";

  const dialog = document.createElement("dialog");
  dialog.className = "tutorial";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "tutorial-title");
  dialog.setAttribute("aria-describedby", "tutorial-copy");
  dialog.innerHTML = `
    <div class="tutorial__form">
      <header class="tutorial__head">
        <h2 class="tutorial__heading" id="tutorial-title"><span aria-hidden="true">💡</span> ¿Cómo funciona?</h2>
        <button type="button" class="icon-btn dialog__close" data-action="close" aria-label="Cerrar tutorial">✕</button>
      </header>
      <div class="tutorial__body">
        <div class="tutorial__stage" data-role="stage" aria-hidden="true"></div>
        <div class="tutorial__copy" id="tutorial-copy" data-role="copy" aria-live="polite" aria-atomic="true"></div>
        <div class="tutorial__extra" data-role="extra" hidden>
          <button type="button" class="btn btn--ghost" data-action="example"><span aria-hidden="true">🧾</span> Probar con un ticket de ejemplo</button>
          <p class="tutorial__extra-note">Abre la revisión con un ticket de muestra. No se guarda nada hasta que tú lo confirmes.</p>
        </div>
      </div>
      <footer class="tutorial__foot">
        <button type="button" class="btn btn--link tutorial__skip" data-action="skip">Saltar</button>
        <ol class="tutorial__dots" data-role="dots" aria-label="Pasos del tutorial">
          ${STEPS.map((step, i) => `
            <li><button type="button" class="tutorial__dot" data-step="${i}" aria-label="Paso ${i + 1}: ${step.title}"></button></li>`).join("")}
        </ol>
        <div class="tutorial__nav">
          <button type="button" class="btn btn--ghost" data-action="prev">Anterior</button>
          <button type="button" class="btn btn--primary" data-action="next">Siguiente</button>
        </div>
      </footer>
    </div>`;
  document.body.append(dialog);

  const $ = (selector) => dialog.querySelector(selector);
  const stage = $("[data-role='stage']");
  const copy = $("[data-role='copy']");
  const extra = $("[data-role='extra']");
  const prev = $("[data-action='prev']");
  const next = $("[data-action='next']");
  const skip = $("[data-action='skip']");
  const dots = [...dialog.querySelectorAll(".tutorial__dot")];
  const last = STEPS.length - 1;

  function show(index) {
    current = Math.min(Math.max(index, 0), last);
    const step = STEPS[current];
    stage.innerHTML = SCENES[step.key];
    stage.dataset.scene = step.key;
    copy.innerHTML = `
      <p class="tutorial__count">Paso ${current + 1} de ${STEPS.length}</p>
      <h3 class="tutorial__title">${step.title}</h3>
      <p class="tutorial__text">${step.text}</p>`;
    extra.hidden = current !== last;
    prev.disabled = current === 0;
    skip.classList.toggle("is-invisible", current === last);
    next.textContent = current === last ? "Listo" : "Siguiente";
    dots.forEach((dot, i) => {
      dot.classList.toggle("tutorial__dot--done", i < current);
      if (i === current) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
    // A disabled button cannot keep focus: hand it to "Siguiente".
    if (document.activeElement === prev && prev.disabled) next.focus();
    if (document.activeElement === skip && current === last) next.focus();
  }

  function finish(why) {
    reason = why;
    dialog.close();
  }

  dialog.addEventListener("click", (event) => {
    // Click on the backdrop (the dialog element itself): dismiss.
    if (event.target === dialog) return finish("closed");
    const dot = event.target.closest("[data-step]");
    if (dot) return show(Number(dot.dataset.step));
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "close" || action === "skip") finish("closed");
    else if (action === "prev") show(current - 1);
    else if (action === "next") (current === last ? finish("done") : show(current + 1));
    else if (action === "example") finish("example");
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      // Trap focus: Tab cycles only through the dialog's own controls.
      const focusable = [...dialog.querySelectorAll("button:not([disabled])")].filter((el) => !el.closest("[hidden]") && getComputedStyle(el).visibility !== "hidden");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && (document.activeElement === lastEl || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const promise = new Promise((resolve) => {
    // Esc fires "cancel" and then "close": every way out ends here.
    dialog.addEventListener("close", () => {
      dialog.remove();
      active = null;
      if (returnFocusTo?.isConnected && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
      resolve(reason);
    }, { once: true });
  });

  active = { promise };
  show(0);
  dialog.showModal();
  next.focus();
  return promise;
}
