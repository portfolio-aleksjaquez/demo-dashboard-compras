// Prompt to paste into an AI assistant together with a receipt photo. It asks
// for exactly the Markdown the importer understands and reuses the stores and
// categories already in the history so labels stay consistent.

const DEFAULT_CATEGORIES = [
  "Lácteos", "Panadería", "Frutas y verduras", "Carnes", "Despensa", "Bebidas",
  "Congelados", "Botanas", "Limpieza", "Higiene personal", "Hogar", "Mascotas", "Otros",
];

export function buildAiPrompt({ stores = [], categories = [] } = {}) {
  const categoryList = (categories.length ? categories : DEFAULT_CATEGORIES).join(", ");
  const storeRule = stores.length
    ? `\n- Tienda: si coincide con alguna de estas, escríbela igual: ${stores.join(", ")}.`
    : "";

  return `Te voy a pasar la foto de uno o varios tickets de compra. Extrae los datos y responde ÚNICAMENTE con Markdown en este formato, sin texto adicional y sin bloques de código:

# Nombre de la tienda
Fecha: AAAA-MM-DD

| Producto | Cantidad | Precio unitario | Total | Categoría |
|---|---:|---:|---:|---|
| Leche entera 1 L | 2 | 28.50 | 57.00 | Lácteos |

Reglas:
- Una fila por producto. Escribe el nombre completo y legible (expande abreviaturas, p. ej. "LCH ENT 1L" → "Leche entera 1 L").
- Números sin símbolo de moneda ni separador de miles; usa punto decimal.
- Cantidad: unidades o kilos tal como aparecen. Si no aparece, usa 1.
- Total: lo que se pagó por esa línea. Si un producto tiene descuento, réstalo de su total.
- No incluyas filas de subtotal, IVA, total general, forma de pago ni cambio.
- Fecha en formato AAAA-MM-DD. Si no se ve, omite la línea "Fecha:".
- Categoría: usa preferentemente una de estas: ${categoryList}.${storeRule}
- Si hay varios tickets, repite el bloque completo por cada uno y sepáralos con una línea que contenga solo ---`;
}
