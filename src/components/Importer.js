// "Agregar ticket" card, built around the photo → AI → paste workflow:
// copy the prompt, give it to the AI with the receipt photo and paste the
// answer here. Pasting opens the review editor right away. Files and manual
// capture are secondary entry points.

export function renderImporter(container, { onText, onFiles, onCopyPrompt, onManual }) {
  container.innerHTML = `
    <div class="card importer">
      <div class="importer__intro">
        <h2 class="section__title">Agregar ticket</h2>
        <ol class="importer__steps">
          <li>
            <button type="button" class="btn btn--ghost btn--sm" data-action="copy-prompt">📋 Copiar prompt para la IA</button>
          </li>
          <li>Dáselo a tu IA junto con la foto del ticket.</li>
          <li>Pega aquí su respuesta y revisa antes de guardar.</li>
        </ol>
      </div>
      <div class="importer__paste">
        <label class="sr-only" for="paste-area">Respuesta de la IA</label>
        <textarea id="paste-area" class="textarea" rows="3"
          placeholder="Pega aquí la respuesta de la IA (Markdown). La revisión se abre sola."></textarea>
        <div class="importer__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="upload">Subir archivos .md</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="manual">Capturar a mano</button>
          <button type="button" class="btn btn--primary btn--sm" data-action="review">Revisar ticket</button>
        </div>
        <p class="importer__hint">También puedes arrastrar archivos <code>.md</code> a la página o pegar con <kbd>Ctrl</kbd>+<kbd>V</kbd> en cualquier parte.</p>
      </div>
      <input type="file" id="file-input" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden />
    </div>`;

  const pasteArea = container.querySelector("#paste-area");
  const fileInput = container.querySelector("#file-input");

  const submit = () => {
    const text = pasteArea.value.trim();
    if (!text) {
      pasteArea.focus();
      return;
    }
    pasteArea.value = "";
    onText(text, "Contenido pegado");
  };

  // Pasting a whole answer opens the review immediately.
  pasteArea.addEventListener("paste", () => setTimeout(submit, 0));
  pasteArea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  });

  container.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "copy-prompt") onCopyPrompt();
    if (action === "upload") fileInput.click();
    if (action === "manual") onManual();
    if (action === "review") submit();
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) onFiles([...fileInput.files]);
    fileInput.value = "";
  });
}
