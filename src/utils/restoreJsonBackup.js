const REQUIRED_TEXT_FIELDS = ["id", "tienda", "fecha", "producto", "categoria"];
const REQUIRED_NUMBER_FIELDS = ["cantidad", "precioUnitario", "total"];

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/** Validate and atomically replace the persisted history from a JSON export. */
export function restoreJsonBackup(text, { saveProducts }) {
  let products;
  try {
    products = JSON.parse(text);
  } catch {
    return { status: "invalid", message: "El respaldo no contiene JSON válido." };
  }

  if (!Array.isArray(products)) {
    return { status: "invalid", message: "El respaldo debe contener una lista de productos." };
  }

  const ids = new Set();
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const row = index + 1;
    if (!product || typeof product !== "object" || Array.isArray(product)) {
      return { status: "invalid", message: `El producto ${row} no tiene una estructura válida.` };
    }
    if (REQUIRED_TEXT_FIELDS.some((field) => typeof product[field] !== "string" || !product[field].trim())) {
      return { status: "invalid", message: `El producto ${row} tiene campos de texto incompletos.` };
    }
    if (!isIsoDate(product.fecha)) {
      return { status: "invalid", message: `El producto ${row} tiene una fecha inválida.` };
    }
    if (REQUIRED_NUMBER_FIELDS.some((field) => !Number.isFinite(product[field]) || product[field] < 0)) {
      return { status: "invalid", message: `El producto ${row} tiene valores numéricos inválidos.` };
    }
    if (product.fechaDeCarga !== undefined) {
      const loadedAt = new Date(product.fechaDeCarga);
      if (typeof product.fechaDeCarga !== "string" || Number.isNaN(loadedAt.getTime())) {
        return { status: "invalid", message: `El producto ${row} tiene una fecha de carga inválida.` };
      }
    }
    if (ids.has(product.id)) {
      return { status: "invalid", message: `El respaldo contiene el ID duplicado "${product.id}".` };
    }
    ids.add(product.id);
  }

  if (!saveProducts(products)) {
    return { status: "save_failed", message: "No se pudo guardar el respaldo. Inténtalo de nuevo." };
  }

  return {
    status: "restored",
    message: `Se restauraron ${products.length} producto(s).`,
    products,
  };
}
