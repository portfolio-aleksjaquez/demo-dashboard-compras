// Thin wrapper over localStorage so the rest of the app never touches
// the storage API or JSON (de)serialization directly.

const STORAGE_KEY = "compras-dashboard:products";
const FILTERS_STORAGE_KEY = "compras-dashboard:filters";
const DEMO_META_KEY = "compras-dashboard:demo-seed";
const TUTORIAL_SEEN_KEY = "compras-dashboard:tutorial-seen";

/** Load the persisted product list. Returns `[]` on any failure. */
export function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("No se pudo leer el historial de localStorage:", error);
    return [];
  }
}

/** Persist the full product list. Returns `true` on success. */
export function saveProducts(products) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return true;
  } catch (error) {
    console.error("No se pudo guardar el historial en localStorage:", error);
    return false;
  }
}

/** Load the persisted filters. Returns `null` when nothing is stored or parsing fails. */
export function loadFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("No se pudieron leer los filtros de localStorage:", error);
    return null;
  }
}

/** Persist the current filters. Returns `true` on success. */
export function saveFilters(filters) {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los filtros en localStorage:", error);
    return false;
  }
}

/** `true` when the browser has never stored a history (not even an empty one). */
export function hasStoredProducts() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Demo only: when the seed was generated and its signature. `null` if unknown. */
export function loadDemoMeta() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_META_KEY) ?? "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDemoMeta(meta) {
  try {
    localStorage.setItem(DEMO_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.error("No se pudo guardar el estado de la demo:", error);
  }
}

/**
 * Tutorial "¿Cómo funciona?": `true` once it has been shown in this browser.
 * It is deliberately separate from the history and the demo seed, so neither
 * "Reiniciar datos de demo" nor "Borrar todo" bring the tutorial back.
 */
export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, new Date().toISOString());
  } catch (error) {
    console.error("No se pudo guardar que el tutorial ya se mostró:", error);
  }
}
