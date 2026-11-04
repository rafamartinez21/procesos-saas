// Pruebas unitarias de las salas de partida (servidor/juego/salas.js), hito 5.
// Lógica pura: sin Socket.IO, sin servidor y sin base de datos.

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Salas, codigoAleatorio } = require("../servidor/juego/salas.js");

const ana = { email: "ana@test.es", nombre: "Ana" };
const luis = { email: "luis@test.es", nombre: "Luis" };
const eva = { email: "eva@test.es", nombre: "" };

let salas;

beforeEach(() => {
  let n = 0;
  let reloj = 1000;
  salas = new Salas({ generarId: () => `P${++n}`, ahora: () => reloj++ });
});

function esperarError(fn, codigo) {
  assert.throws(fn, (err) => {
    assert.equal(err.name, "ErrorNegocio");
    assert.equal(err.codigo, codigo);
    return true;
  });
}

// ---------- RF-11 crear ----------

test("crear una partida la deja abierta con el creador como único jugador", () => {
  const p = salas.crearPartida(ana);
  assert.deepEqual(p, { id: "P1", estado: "abierta", creador: "Ana", jugadores: ["Ana"], plazas: 1, creada: 1000 });
});

test("la vista de una partida nunca incluye emails", () => {
  salas.crearPartida(ana);
  salas.unirse("P1", luis);
  assert.equal(JSON.stringify(salas.obtener("P1")).includes("@"), false);
  assert.equal(JSON.stringify(salas.partidaDe("ana@test.es")).includes("@"), false);
});

test("sin nombre, se muestra la parte del email antes de la @", () => {
  assert.equal(salas.crearPartida(eva).creador, "eva");
});

test("[error] no se puede crear una partida sin jugador identificado", () => {
  esperarError(() => salas.crearPartida(undefined), "NO_AUTENTICADO");
  esperarError(() => salas.crearPartida({ nombre: "x" }), "NO_AUTENTICADO");
});

test("[error] un jugador que ya está en una partida no puede crear otra", () => {
  salas.crearPartida(ana);
  esperarError(() => salas.crearPartida(ana), "YA_EN_PARTIDA");
});

test("si el generador repite un código se pide otro", () => {
  const ids = ["AAAAA", "AAAAA", "BBBBB"];
  const s = new Salas({ generarId: () => ids.shift() });
  assert.equal(s.crearPartida(ana).id, "AAAAA");
  assert.equal(s.crearPartida(luis).id, "BBBBB");
});

test("el código por defecto tiene 5 caracteres sin letras que se confundan", () => {
  for (let i = 0; i < 50; i++) assert.match(codigoAleatorio(), /^[A-HJ-NP-Z2-9]{5}$/);
});

// ---------- RF-12 listar ----------

test("la lista muestra solo las partidas abiertas, de la más antigua a la más nueva", () => {
  salas.crearPartida(ana);
  salas.crearPartida(luis);
  salas.crearPartida(eva);
  salas.unirse("P2", { email: "otro@test.es", nombre: "Otro" });
  assert.deepEqual(salas.listarAbiertas().map((p) => p.id), ["P1", "P3"]);
});

test("sin partidas, la lista está vacía", () => {
  assert.deepEqual(salas.listarAbiertas(), []);
});

// ---------- RF-13 unirse ----------

test("unirse a una partida abierta la completa con los dos jugadores", () => {
  salas.crearPartida(ana);
  const p = salas.unirse("P1", luis);
  assert.equal(p.estado, "completa");
  assert.deepEqual(p.jugadores, ["Ana", "Luis"]);
  assert.equal(p.plazas, 0);
  assert.deepEqual(salas.emailsDe("P1"), ["ana@test.es", "luis@test.es"]);
});

test("el código de partida no distingue mayúsculas ni espacios", () => {
  salas.crearPartida(ana);
  assert.equal(salas.unirse("  p1 ", luis).estado, "completa");
});

test("[error] no se puede unir a una partida que no existe", () => {
  esperarError(() => salas.unirse("NOEXISTE", luis), "PARTIDA_NO_ENCONTRADA");
  esperarError(() => salas.unirse(undefined, luis), "PARTIDA_NO_ENCONTRADA");
});

test("[error] un tercer jugador no puede entrar en una partida completa", () => {
  salas.crearPartida(ana);
  salas.unirse("P1", luis);
  esperarError(() => salas.unirse("P1", eva), "PARTIDA_LLENA");
});

test("[error] el creador no puede unirse a su propia partida", () => {
  salas.crearPartida(ana);
  esperarError(() => salas.unirse("P1", ana), "YA_EN_PARTIDA");
});

test("[error] quien ya está en otra partida no puede unirse a una nueva", () => {
  salas.crearPartida(ana);
  salas.crearPartida(luis);
  esperarError(() => salas.unirse("P2", ana), "YA_EN_PARTIDA");
});

// ---------- RF-14 abandonar ----------

test("si el único jugador abandona, la partida desaparece", () => {
  salas.crearPartida(ana);
  assert.deepEqual(salas.abandonar("ana@test.es"), { id: "P1", partida: null, restantes: [] });
  assert.deepEqual(salas.listarAbiertas(), []);
  assert.equal(salas.partidaDe("ana@test.es"), null);
  esperarError(() => salas.obtener("P1"), "PARTIDA_NO_ENCONTRADA");
});

test("si abandona uno de dos, la partida vuelve a estar abierta para el que queda", () => {
  salas.crearPartida(ana);
  salas.unirse("P1", luis);
  const r = salas.abandonar("ana@test.es");
  assert.deepEqual(r.restantes, ["luis@test.es"]);
  assert.equal(r.partida.estado, "abierta");
  assert.equal(r.partida.creador, "Luis");
  assert.deepEqual(salas.listarAbiertas().map((p) => p.id), ["P1"]);
});

test("tras abandonar, el jugador puede crear otra partida", () => {
  salas.crearPartida(ana);
  salas.abandonar("ana@test.es");
  assert.equal(salas.crearPartida(ana).id, "P2");
});

test("[error] no se puede abandonar si no se está en ninguna partida", () => {
  esperarError(() => salas.abandonar("ana@test.es"), "NO_EN_PARTIDA");
});
