import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  blankDraft,
  commitTicket,
  draftFromTicket,
  draftsFromMarkdown,
  validateDraft,
} from "../../src/utils/ticketDraft.js";
import { groupTickets } from "../../src/utils/tickets.js";

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, name), "utf8");
const today = () => "2026-07-19";

let idSeq = 0;
const uid = () => `id-${++idSeq}`;
const now = () => "2026-07-24T18:00:00.000Z";
let cases = 0;

function draftsOf(markdown, existingProducts = []) {
  return draftsFromMarkdown(markdown, { sourceLabel: "fixture.md", existingProducts, today });
}

function commit(draft, existing, deps = {}) {
  const saved = [];
  const outcome = commitTicket(draft, existing, {
    uid,
    now,
    saveProducts: (products) => {
      saved.push(products);
      return true;
    },
    ...deps,
  });
  return { outcome, saved };
}

function importOne(markdown, existing = [], deps = {}) {
  const { drafts } = draftsOf(markdown, existing);
  assert.equal(drafts.length, 1);
  return commit(drafts[0], existing, deps);
}

// Empty → error, no drafts
{
  const { drafts, errors } = draftsOf("   ");
  assert.equal(drafts.length, 0);
  assert.match(errors[0], /vacío/);
  cases += 1;
}

// Several tickets in one text → one draft each
{
  const { drafts, errors } = draftsOf(read("multi-ticket.md"));
  assert.deepEqual(errors, []);
  assert.deepEqual(drafts.map((d) => [d.store, d.date, d.lines.map((l) => l.producto)]), [
    ["Mercado Central", "2026-07-18", ["Café"]],
    ["Almacén Norte", "2026-07-19", ["Pan"]],
  ]);
  assert.match(drafts[1].source, /ticket 2/);
  cases += 1;
}

// Markdown report blocks separated by --- are importable again
{
  const report = "# Súper Central\nFecha: 2026-07-08\n\n| Producto | Cantidad | Precio unitario | Total | Categoría |\n|---|---:|---:|---:|---|\n| Leche | 2 | 28 | 56 | Lácteos |\n\n---\n\n# Almacén Mayorista\nFecha: 2026-07-09\n\n| Producto | Cantidad | Precio unitario | Total | Categoría |\n|---|---:|---:|---:|---|\n| Café | 1 | 120 | 120 | Despensa |\n";
  assert.deepEqual(draftsOf(report).drafts.map((d) => d.store), ["Súper Central", "Almacén Mayorista"]);
  cases += 1;
}

// Missing store → draft asks for it; saving requires it
{
  idSeq = 0;
  const { drafts } = draftsOf(`Fecha: 2026-07-18

| Producto | Cantidad | Precio unitario | Total | Categoría |
|---|---:|---:|---:|---|
| Leche | 2 | 28 | 56 | Lácteos |
`);
  assert.equal(drafts[0].store, "");
  assert.match(drafts[0].warnings[0], /tienda/);
  const blocked = commit(drafts[0], []);
  assert.equal(blocked.outcome.status, "invalid");
  assert.equal(blocked.saved.length, 0);

  const { outcome, saved } = commit({ ...drafts[0], store: "  Mercado Central  " }, []);
  assert.equal(outcome.status, "committed");
  assert.equal(outcome.store, "Mercado Central");
  assert.equal(outcome.products[0].fechaDeCarga, "2026-07-24T18:00:00.000Z");
  assert.deepEqual(Object.keys(outcome.products[0]).sort(), [
    "cantidad", "categoria", "fecha", "fechaDeCarga", "id", "precioUnitario", "producto", "tienda", "total",
  ]);
  assert.deepEqual(outcome.ids, ["id-1"]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0], outcome.products);
  cases += 1;
}

// Duplicate exact ticket → skip
{
  idSeq = 0;
  const first = importOne(read("table.md"));
  assert.equal(first.outcome.status, "committed");
  const second = importOne(read("table.md"), first.outcome.products);
  assert.equal(second.outcome.status, "duplicate");
  assert.match(second.outcome.message, /duplicado/i);
  assert.equal(second.saved.length, 0);
  cases += 1;
}

// One row differs → import whole ticket again
{
  idSeq = 0;
  const first = importOne(read("table.md"));
  const second = importOne(read("table.md").replace("| 56 |", "| 57 |"), first.outcome.products);
  assert.equal(second.outcome.status, "committed");
  assert.equal(second.outcome.products.length, 2);
  cases += 1;
}

// save_failed → no products in outcome
{
  const { drafts } = draftsOf(read("table.md"));
  const { outcome, saved } = commit(drafts[0], [], { saveProducts: () => false });
  assert.equal(outcome.status, "save_failed");
  assert.equal(outcome.products, undefined);
  assert.equal(saved.length, 0);
  cases += 1;
}

// Omitted rows come back as fixable lines; saving waits until they are fixed
{
  idSeq = 0;
  const { drafts } = draftsOf(read("mixed-rows.md"));
  const draft = drafts[0];
  const flagged = draft.lines.filter((line) => line.issue);
  assert.equal(flagged.length, 5);
  assert.deepEqual(flagged.map((line) => line.producto), ["Yerba", "Azúcar", "", "Sal", "Aceite"]);
  assert.equal(commit(draft, []).outcome.status, "invalid");

  const fixed = {
    ...draft,
    lines: draft.lines.map((line) => (line.producto === "Yerba" ? { ...line, cantidad: "1" } : line))
      .filter((line) => !line.issue || line.producto === "Yerba"),
  };
  assert.deepEqual(validateDraft(fixed).errors, []);
  const { outcome } = commit(fixed, []);
  assert.equal(outcome.status, "committed");
  assert.deepEqual(outcome.products.map((p) => p.producto).sort(), ["Café", "Té", "Yerba"]);
  cases += 1;
}

// Labels align with history and categories are remembered per product
{
  idSeq = 0;
  const existing = [{
    id: "old", tienda: "Súper Central", fecha: "2026-07-01", producto: "Leche", cantidad: 1,
    precioUnitario: 28, total: 28, categoria: "Lácteos", fechaDeCarga: "2026-07-01T10:00:00.000Z",
  }];
  const { drafts } = draftsOf("# súper central \nFecha: 2026-07-18\n\n| Producto | Precio |\n|---|---:|\n| leche | 30 |\n| Pan | 35 |", existing);
  assert.equal(drafts[0].store, "Súper Central");
  assert.deepEqual(drafts[0].lines.map((l) => l.categoria), ["Lácteos", ""]);
  const { outcome } = commit({ ...drafts[0], lines: drafts[0].lines.map((l) => ({ ...l, categoria: l.categoria || "lacteos" })) }, existing);
  assert.deepEqual(outcome.products.slice(1).map((p) => [p.tienda, p.categoria]), [
    ["Súper Central", "Lácteos"],
    ["Súper Central", "Lácteos"],
  ]);
  cases += 1;
}

// Editing a saved ticket replaces its rows and keeps its load timestamp
{
  idSeq = 0;
  const first = importOne(read("table.md"));
  const other = importOne(read("key-value.md").replace("Leche", "Queso"), first.outcome.products, {
    now: () => "2026-07-24T18:05:00.000Z",
  });
  const [ticket] = groupTickets(other.outcome.products).filter((t) => t.products[0].producto === "Leche");
  const draft = draftFromTicket(ticket);
  const unchanged = commit(draft, other.outcome.products);
  assert.equal(unchanged.outcome.status, "committed");

  const edited = commit({ ...draft, date: "2026-07-20", lines: [{ ...draft.lines[0], cantidad: "3", total: "84" }] }, other.outcome.products);
  assert.equal(edited.outcome.status, "committed");
  assert.equal(edited.outcome.products.length, 2);
  const row = edited.outcome.products.find((p) => p.producto === "Leche");
  assert.deepEqual([row.fecha, row.cantidad, row.total, row.fechaDeCarga], ["2026-07-20", 3, 84, ticket.fechaDeCarga]);
  cases += 1;
}

// Manual capture, plain lines and spreadsheet columns
{
  assert.equal(validateDraft(blankDraft({ date: "2026-07-18" })).errors.some((e) => e.field === "lines"), true);

  const plain = draftsOf("# Tienda Express\nFecha: 2026-07-18\nRefresco de cola 600 ml 2 18.50\nPan $35\nTotal 72").drafts[0];
  assert.deepEqual(plain.lines.map((l) => [l.producto, l.cantidad, l.precioUnitario]), [
    ["Refresco de cola 600 ml", "2", "18.5"],
    ["Pan", "1", "35"],
  ]);

  const tsv = draftsOf("Tienda: Súper del Sur\nFecha: 2026-07-18\nProducto\tCantidad\tPrecio\nLeche\t2\t28\nHuevo\t1\t60").drafts[0];
  assert.deepEqual(tsv.lines.map((l) => [l.producto, l.total]), [["Leche", "56"], ["Huevo", "60"]]);
  cases += 1;
}

console.log(`ticket draft harness: ${cases} cases passed`);
