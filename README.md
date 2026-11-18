# Dashboard de compras (demo)

Dashboard personal para registrar tickets de compra, consultar el historial y analizar gastos por tienda, categoría y período.

**Demo en vivo:** https://portfolio-aleksjaquez.github.io/demo-dashboard-compras/

La demo arranca con unos tres meses de tickets ficticios (tiendas y montos inventados, en MXN). Todo se guarda únicamente en el `localStorage` de tu navegador; no hay servidor ni cuentas. El botón **Reiniciar datos de demo** restaura los datos de ejemplo. Que el tutorial ya se mostró se guarda aparte (`compras-dashboard:tutorial-seen`): reiniciar la demo o borrar el historial **no** lo vuelve a abrir solo; para verlo otra vez está el botón **¿Cómo funciona?**.

## Qué incluye

- Tutorial **¿Cómo funciona?**: un modal de cinco pasos con ilustraciones animadas (copiar el prompt, pegar la respuesta, revisar, historial y estadísticas). Se abre solo la primera vez que alguien entra y luego desde el botón de la franja de demo. En el último paso, **Probar con un ticket de ejemplo** abre la revisión con un ticket de muestra; no se guarda hasta que el usuario lo confirma. Es accesible (foco atrapado, Esc, `prefers-reduced-motion`) y funciona en móvil.
- Importación de tickets en Markdown con revisión antes de guardar. El flujo pensado es foto → IA → pegar: **Copiar prompt para la IA** genera el formato que entiende la app.
- Historial por tickets o por productos, con filtros, búsqueda y edición en línea.
- Estadísticas con gráficas por período (semana, quincena, mes o rango).
- Detección de tickets duplicados, deshacer el último cambio, respaldo y restauración en JSON, y reporte en Markdown.

## Stack

JavaScript vanilla (módulos ES) + Vite, CSS propio sin frameworks, pruebas con scripts de Node.

## Desarrollo

```bash
pnpm install --frozen-lockfile
pnpm dev      # http://127.0.0.1:5173/demo-dashboard-compras/
pnpm test
pnpm build
```

El despliegue a GitHub Pages se hace con `.github/workflows/deploy.yml` al subir cambios a `main`.
