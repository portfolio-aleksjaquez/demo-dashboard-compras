// Franja discreta de la demo: avisa que los datos son ficticios y ofrece
// restaurar la semilla.

export function renderDemoNotice(container, { onReset }) {
  container.innerHTML = `
    <p class="demo-notice__text">
      <span class="demo-notice__badge">Demo</span>
      <span>Demo con datos ficticios · se guardan solo en tu navegador</span>
    </p>
    <button type="button" class="btn btn--ghost btn--sm demo-notice__reset" data-action="reset-demo">↺ Reiniciar datos de demo</button>`;
  container.querySelector("[data-action='reset-demo']").addEventListener("click", onReset);
}
