# Dashboard de compras (demo)

Dashboard personal para registrar tickets de compra, consultar el historial y analizar gastos por tienda, categoría y período.

**Demo en vivo:** https://portfolio-aleksjaquez.github.io/demo-dashboard-compras/

La demo arranca con unos tres meses de tickets ficticios (tiendas y montos inventados, en MXN). Todo se guarda únicamente en el `localStorage` de tu navegador; no hay servidor ni cuentas. El botón **Reiniciar datos de demo** restaura los datos de ejemplo.

## Qué incluye

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
