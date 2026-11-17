// Datos de demostración: unos tres meses de tickets ficticios con fechas
// relativas a hoy. En lugar de inventar un formato paralelo, se generan como
// Markdown (el mismo que pide el prompt de la IA) y se pasan por el mismo
// camino que cualquier ticket real: draftsFromMarkdown → commitTicket.

import { commitTicket, draftsFromMarkdown } from "./ticketDraft.js";
import { round2, toIsoDate } from "./helpers.js";

const DAYS_BACK = 92;

// Catálogo ficticio por tienda: [producto, categoría, precio unitario, cantidad mín., cantidad máx.]
const STORES = {
  "Súper Central": {
    every: [6, 8],
    items: [6, 11],
    catalog: [
      ["Leche entera 1 L", "Lácteos", 27.5, 2, 6],
      ["Yogur natural 900 g", "Lácteos", 42, 1, 2],
      ["Queso panela 400 g", "Lácteos", 68, 1, 1],
      ["Huevo 18 piezas", "Despensa", 62, 1, 1],
      ["Arroz 1 kg", "Despensa", 29, 1, 2],
      ["Frijol negro 900 g", "Despensa", 38, 1, 1],
      ["Aceite vegetal 1 L", "Despensa", 46, 1, 1],
      ["Pasta spaghetti 200 g", "Despensa", 12.5, 2, 4],
      ["Café soluble 200 g", "Despensa", 118, 1, 1],
      ["Atún en agua 140 g", "Despensa", 19, 2, 5],
      ["Jugo de naranja 1 L", "Bebidas", 34, 1, 2],
      ["Agua purificada 8 L", "Bebidas", 36, 1, 2],
      ["Refresco de cola 2 L", "Bebidas", 33, 1, 2],
      ["Papas fritas 170 g", "Botanas", 39, 1, 2],
      ["Galletas de avena", "Botanas", 24, 1, 3],
      ["Papel higiénico 12 rollos", "Limpieza", 89, 1, 1],
      ["Detergente líquido 3 L", "Limpieza", 118, 1, 1],
      ["Limpiador multiusos 1 L", "Limpieza", 32, 1, 1],
      ["Jabón de tocador 3 piezas", "Higiene personal", 41, 1, 1],
      ["Pasta dental", "Higiene personal", 34, 1, 2],
      ["Pechuga de pollo (kg)", "Carnes", 105, 1, 2],
    ],
  },
  "Mercado La Esquina": {
    every: [4, 6],
    items: [4, 8],
    catalog: [
      ["Jitomate (kg)", "Frutas y verduras", 28, 1, 2],
      ["Cebolla blanca (kg)", "Frutas y verduras", 24, 1, 1],
      ["Aguacate (kg)", "Frutas y verduras", 72, 1, 2],
      ["Limón (kg)", "Frutas y verduras", 26, 1, 1],
      ["Plátano (kg)", "Frutas y verduras", 22, 1, 2],
      ["Manzana roja (kg)", "Frutas y verduras", 48, 1, 2],
      ["Papa (kg)", "Frutas y verduras", 30, 1, 2],
      ["Zanahoria (kg)", "Frutas y verduras", 20, 1, 1],
      ["Cilantro (manojo)", "Frutas y verduras", 8, 1, 2],
      ["Chile serrano (100 g)", "Frutas y verduras", 9, 1, 2],
      ["Tortillas de maíz (kg)", "Despensa", 27, 1, 2],
      ["Fresas (charola)", "Frutas y verduras", 45, 1, 1],
    ],
  },
  "Panadería La Espiga": {
    every: [8, 12],
    items: [2, 4],
    catalog: [
      ["Pan dulce (pieza)", "Panadería", 12, 3, 6],
      ["Bolillo (pieza)", "Panadería", 4.5, 4, 8],
      ["Pan de caja integral", "Panadería", 52, 1, 1],
      ["Concha de vainilla", "Panadería", 14, 2, 4],
      ["Pastel de tres leches (rebanada)", "Panadería", 48, 1, 2],
    ],
  },
  "Farmacia del Barrio": {
    every: [18, 28],
    items: [2, 4],
    catalog: [
      ["Paracetamol 500 mg", "Salud", 38, 1, 1],
      ["Vitamina C efervescente", "Salud", 89, 1, 1],
      ["Suero oral", "Salud", 28, 1, 2],
      ["Crema hidratante", "Higiene personal", 96, 1, 1],
      ["Shampoo 400 ml", "Higiene personal", 79, 1, 1],
      ["Cepillo dental", "Higiene personal", 35, 1, 2],
      ["Curitas (caja)", "Salud", 32, 1, 1],
    ],
  },
  "Ferretería El Tornillo": {
    every: [26, 40],
    items: [2, 4],
    catalog: [
      ["Foco LED 9 W", "Hogar", 42, 2, 4],
      ["Cinta de aislar", "Hogar", 24, 1, 2],
      ["Tornillos para madera (bolsa)", "Hogar", 36, 1, 2],
      ["Pintura blanca 1 L", "Hogar", 135, 1, 1],
      ["Brocha 3 pulgadas", "Hogar", 48, 1, 1],
      ["Extensión eléctrica 3 m", "Hogar", 119, 1, 1],
      ["Cinta métrica", "Hogar", 69, 1, 1],
    ],
  },
  "Carnicería El Corte": {
    every: [12, 17],
    items: [2, 3],
    catalog: [
      ["Bistec de res (kg)", "Carnes", 189, 1, 2],
      ["Carne molida de res (kg)", "Carnes", 148, 1, 1],
      ["Chuleta de cerdo (kg)", "Carnes", 129, 1, 2],
      ["Longaniza (kg)", "Carnes", 118, 1, 1],
      ["Muslo de pollo (kg)", "Carnes", 78, 1, 2],
    ],
  },
  "Veterinaria Patitas": {
    every: [30, 38],
    items: [1, 2],
    catalog: [
      ["Croquetas para perro 4 kg", "Mascotas", 235, 1, 1],
      ["Arena para gato 5 kg", "Mascotas", 128, 1, 1],
      ["Premios para mascota", "Mascotas", 59, 1, 2],
    ],
  },
};

// PRNG determinista (mulberry32): la semilla se ve igual en cada visita.
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const money = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

function buildMarkdown(store, date, lines) {
  const rows = lines.map(([name, category, qty, price]) =>
    `| ${name} | ${qty} | ${money(price)} | ${money(round2(qty * price))} | ${category} |`);
  return `# ${store}\nFecha: ${date}\n\n| Producto | Cantidad | Precio unitario | Total | Categoría |\n|---|---:|---:|---:|---|\n${rows.join("\n")}`;
}

/** Tickets ficticios en Markdown, ordenados del más antiguo al más reciente. */
export function buildDemoMarkdowns(now = new Date()) {
  const random = makeRandom(20260);
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  const tickets = [];

  Object.entries(STORES).forEach(([store, config], storeIndex) => {
    // Se camina hacia atrás desde hoy; el primer ticket cae en los últimos días.
    let offset = int(0, Math.min(2 + storeIndex, config.every[0]));
    while (offset <= DAYS_BACK) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const pool = [...config.catalog];
      const count = Math.min(int(...config.items), pool.length);
      const lines = [];
      for (let i = 0; i < count; i += 1) {
        const [name, category, price, minQty, maxQty] = pool.splice(int(0, pool.length - 1), 1)[0];
        const unit = round2(price * (0.94 + random() * 0.12));
        lines.push([name, category, int(minQty, maxQty), unit]);
      }
      tickets.push({ date: toIsoDate(day), markdown: buildMarkdown(store, toIsoDate(day), lines) });
      offset += int(...config.every);
    }
  });

  return tickets.sort((a, b) => a.date.localeCompare(b.date)).map((ticket) => ticket.markdown);
}

/** Productos persistidos de demostración, creados con el mismo flujo que un ticket real. */
export function buildDemoProducts({ uid, now = new Date() } = {}) {
  let products = [];
  const noopSave = () => true;
  const markdowns = buildDemoMarkdowns(now);

  markdowns.forEach((markdown, index) => {
    const { drafts } = draftsFromMarkdown(markdown, { sourceLabel: "Demo", existingProducts: products });
    const draft = drafts[0];
    if (!draft) return;
    // La fecha de carga imita un registro hecho la tarde de la compra.
    const loadedAt = new Date(`${draft.date}T18:${String(index % 60).padStart(2, "0")}:00`).toISOString();
    const outcome = commitTicket(draft, products, { saveProducts: noopSave, uid, now: () => loadedAt });
    if (outcome.status === "committed") products = outcome.products;
  });

  return products;
}

/** Huella barata para saber si el historial sigue siendo el de la demo, sin cambios. */
export function signature(products) {
  const text = JSON.stringify(products);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${products.length}:${hash}`;
}
