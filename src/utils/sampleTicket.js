// Ticket de ejemplo para el tutorial: es la respuesta que daría una IA con el
// prompt de "Copiar prompt para la IA" (mismo formato que entiende el
// importador). Se abre en la revisión; nunca se guarda solo.

import { today } from "./helpers.js";

export function buildSampleTicketMarkdown(date = today()) {
  return `# Súper Central
Fecha: ${date}

| Producto | Cantidad | Precio unitario | Total | Categoría |
|---|---:|---:|---:|---|
| Leche entera 1 L | 2 | 28.50 | 57.00 | Lácteos |
| Pan dulce | 1 | 18.00 | 18.00 | Panadería |
| Huevo 18 piezas | 1 | 62.00 | 62.00 | Despensa |
`;
}
