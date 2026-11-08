// Pruebas del catálogo de criaturas y de la tabla de eficacias (RF-15).
// Comprueban que los datos del juego son coherentes: si alguien añade una criatura mal
// definida o rompe el equilibrio de elementos, la CI falla.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ELEMENTOS,
  ESTADOS,
  MOVIMIENTOS,
  CATALOGO,
  eficacia,
  obtenerCriatura,
  catalogoPublico,
} = require("../servidor/juego/criaturas.js");

test("hay seis elementos y dos criaturas de cada uno", () => {
  assert.equal(ELEMENTOS.length, 6);
  for (const e of ELEMENTOS) {
    assert.equal(CATALOGO.filter((c) => c.elemento === e).length, 2, e);
  }
});

test("cada elemento es eficaz contra dos y débil contra otros dos (ninguno es mejor)", () => {
  for (const a of ELEMENTOS) {
    const valores = ELEMENTOS.map((d) => eficacia(a, d));
    assert.equal(valores.filter((v) => v === 2).length, 2, `${a} eficaz`);
    assert.equal(valores.filter((v) => v === 0.5).length, 2, `${a} poco eficaz`);
  }
});

test("la tabla es coherente: si A es eficaz contra B, B es poco eficaz contra A", () => {
  for (const a of ELEMENTOS) {
    for (const d of ELEMENTOS) {
      if (eficacia(a, d) === 2) assert.equal(eficacia(d, a), 0.5, `${a} -> ${d}`);
    }
  }
});

test("ejemplos de eficacia: el agua apaga el fuego y el fuego quema la planta", () => {
  assert.equal(eficacia("agua", "fuego"), 2);
  assert.equal(eficacia("fuego", "agua"), 0.5);
  assert.equal(eficacia("fuego", "planta"), 2);
  assert.equal(eficacia("fuego", "fuego"), 1);
  assert.equal(eficacia("neutro", "tierra"), 1);
});

test("todas las criaturas tienen id único, estadísticas válidas que suman 280 y movimientos que existen", () => {
  const ids = new Set();
  for (const c of CATALOGO) {
    assert.equal(ids.has(c.id), false, `id repetido ${c.id}`);
    ids.add(c.id);
    assert.ok(ELEMENTOS.includes(c.elemento), c.id);
    for (const s of ["ps", "ataque", "defensa", "velocidad"]) assert.ok(Number.isInteger(c[s]) && c[s] > 0, `${c.id}.${s}`);
    assert.equal(c.ps + c.ataque + c.defensa + c.velocidad, 280, `${c.id} suma`);
    assert.ok(c.movimientos.length >= 3 && c.movimientos.length <= 4, c.id);
    for (const m of c.movimientos) assert.ok(MOVIMIENTOS[m], `${c.id} -> ${m}`);
    assert.ok(c.movimientos.some((m) => MOVIMIENTOS[m].elemento === c.elemento), `${c.id} sin movimiento de su elemento`);
  }
});

test("los movimientos tienen potencia y precisión válidas y sus efectos son estados conocidos", () => {
  for (const [id, m] of Object.entries(MOVIMIENTOS)) {
    // Los de apoyo (RF-31) no hacen daño; el resto, sí.
    assert.ok((m.apoyo ? m.potencia === 0 : m.potencia > 0) && m.precision > 0 && m.precision <= 100, id);
    if (m.apoyo) {
      const a = m.apoyo;
      assert.ok(a.cura ? a.cura > 0 && a.cura <= 1 : ["propio", "rival"].includes(a.sobre) && ["ataque", "defensa", "velocidad"].includes(a.stat) && a.etapas !== 0, id);
      // Los de subir son para uno mismo y los de bajar, para el rival.
      if (!a.cura) assert.equal(a.sobre === "propio", a.etapas > 0, id);
    }
    if (m.efecto && m.efecto.estado) {
      assert.ok(ESTADOS.includes(m.efecto.estado), id);
      assert.ok(m.efecto.prob > 0 && m.efecto.prob <= 1, id);
    }
  }
});

test("obtenerCriatura devuelve la criatura o undefined", () => {
  assert.equal(obtenerCriatura("pirolince").nombre, "Pirolince");
  assert.equal(obtenerCriatura("no-existe"), undefined);
});

test("el catálogo público incluye los datos de cada movimiento", () => {
  const p = catalogoPublico().find((c) => c.id === "marejon");
  assert.deepEqual(p.movimientos[0], { id: "torrente", ...MOVIMIENTOS.torrente });
  // No modifica el catálogo original.
  assert.equal(typeof CATALOGO.find((c) => c.id === "marejon").movimientos[0], "string");
});

test("RF-31: cada criatura lenta tiene un movimiento de apoyo y conserva uno de daño de su elemento", () => {
  const conApoyo = CATALOGO.filter((c) => c.movimientos.some((m) => MOVIMIENTOS[m].apoyo)).map((c) => c.id).sort();
  assert.deepEqual(conApoyo, ["brason", "chispardo", "marejon", "musgolem", "plumazul", "rocadonte"]);
  for (const c of CATALOGO) {
    assert.ok(c.movimientos.some((m) => MOVIMIENTOS[m].elemento === c.elemento && !MOVIMIENTOS[m].apoyo), `${c.id} sin ataque de su elemento`);
  }
});
