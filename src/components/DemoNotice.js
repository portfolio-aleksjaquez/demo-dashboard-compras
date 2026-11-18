// Franja discreta de la demo: avisa que los datos son ficticios, abre el
// tutorial "¿Cómo funciona?" y ofrece restaurar la semilla.

export function renderDemoNotice(container, { onReset, onHelp }) {
  container.innerHTML = `
    <p class="demo-notice__text">
      <span class="demo-notice__badge">Demo</span>
      <span>Demo con datos ficticios · se guardan solo en tu navegador</span>
    </p>
    <div class="demo-notice__actions">
      <button type="button" class="btn btn--sm demo-notice__help" data-action="help" aria-haspopup="dialog">
        <span aria-hidden="true">💡</span> ¿Cómo funciona?
      </button>
      <button type="button" class="btn btn--ghost btn--sm demo-notice__reset" data-action="reset-demo">↺ Reiniciar datos de demo</button>
    </div>`;
  const helpButton = container.querySelector("[data-action='help']");
  helpButton.addEventListener("click", () => onHelp(helpButton));
  container.querySelector("[data-action='reset-demo']").addEventListener("click", onReset);
  return { helpButton };
}
