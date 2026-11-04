// Pruebas del progreso de los jugadores (servidor/juego/progreso.js), hito 7.
// Usan el CAD en memoria (las pruebas de contrato ya comprueban que el de MongoDB se
// comporta igual).

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Progreso, nuevoElo, esperado } = require("../servidor/juego/progreso.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");

const ana = { email: "ana@test.es", nombre: "Ana" };
const luis = { email: "luis@test.es", nombre: "Luis" };
const eva = { email: "eva@test.es", nombre: "Eva" };

let cad;
let progreso;
let reloj;

beforeEach(() => {
  cad = new CadMemoria();
  reloj = 1000;
  progreso = new Progreso(cad, { ahora: () => reloj++ });
});

let n = 0;
const resultado = (a, b, ganador, motivo = "sin-criaturas") =>
  progreso.registrarResultado({ id: `P${++n}`, jugadores: [a, b], ganador: ganador && ganador.email, motivo, turnos: 7 });

// ---------- fórmula ELO (D-24) ----------

test("ELO: entre iguales, ganar suma 16 y perder resta 16", () => {
  assert.equal(esperado(1000, 1000), 0.5);
  assert.equal(nuevoElo(1000, 1000, 1), 1016);
  assert.equal(nuevoElo(1000, 1000, 0), 984);
  assert.equal(nuevoElo(1000, 1000, 0.5), 1000);
});

test("ELO: ganar a alguien mucho mejor da más puntos que ganar a alguien peor", () => {
  const sorpresa = nuevoElo(1000, 1400, 1) - 1000;
  const previsto = nuevoElo(1400, 1000, 1) - 1400;
  assert.ok(sorpresa > 25, `sorpresa ${sorpresa}`);
  assert.ok(previsto < 5, `previsto ${previsto}`);
});

// ---------- RF-19 historial ----------

test("cada partida terminada se guarda y aparece en el historial de los dos, desde su lado", async () => {
  await resultado(ana, luis, ana);
  const deAna = await progreso.historial(ana.email);
  const deLuis = await progreso.historial(luis.email);
  assert.deepEqual(deAna, [{ id: deAna[0].id, fecha: 1000, rival: "Luis", resultado: "victoria", motivo: "sin-criaturas", turnos: 7, elo: 1016, cambioElo: 16 }]);
  assert.equal(deLuis[0].resultado, "derrota");
  assert.equal(deLuis[0].rival, "Ana");
  assert.equal(deLuis[0].cambioElo, -16);
});

test("el historial va de la partida más reciente a la más antigua y no incluye emails", async () => {
  await resultado(ana, luis, ana);
  await resultado(eva, ana, eva, "abandono");
  await resultado(ana, luis, null, "empate");
  const h = await progreso.historial(ana.email);
  assert.deepEqual(h.map((p) => [p.rival, p.resultado]), [["Luis", "empate"], ["Eva", "derrota"], ["Luis", "victoria"]]);
  assert.equal(JSON.stringify(h).includes("@"), false);
});

test("quien no ha jugado tiene el historial vacío", async () => {
  assert.deepEqual(await progreso.historial("nadie@test.es"), []);
});

// ---------- RF-20 ranking ----------

test("el ranking ordena por ELO, numera las posiciones y no incluye emails", async () => {
  await resultado(ana, luis, ana);
  await resultado(ana, eva, ana);
  await resultado(luis, eva, luis);
  const r = await progreso.ranking();
  assert.deepEqual(r.map((j) => [j.posicion, j.nombre]), [[1, "Ana"], [2, "Luis"], [3, "Eva"]]);
  assert.deepEqual(Object.keys(r[0]).sort(), ["elo", "empates", "ganadas", "nombre", "perdidas", "posicion"]);
  assert.equal(r[0].ganadas, 2);
  assert.equal(r[2].perdidas, 2);
});

test("un empate cuenta para los dos y entre iguales no cambia el ELO", async () => {
  await resultado(ana, luis, null, "empate");
  const r = await progreso.ranking();
  assert.deepEqual(r.map((j) => [j.elo, j.empates]), [[1000, 1], [1000, 1]]);
});

test("el ranking usa el nombre visible más reciente del jugador", async () => {
  await resultado(ana, luis, ana);
  await resultado({ ...ana, nombre: "Ana la Grande" }, luis, ana);
  assert.equal((await progreso.ranking())[0].nombre, "Ana la Grande");
});

test("una cuenta eliminada desaparece del ranking", async () => {
  await resultado(ana, luis, ana);
  await progreso.olvidarJugador(ana.email);
  assert.deepEqual((await progreso.ranking()).map((j) => j.nombre), ["Luis"]);
});

// ---------- RF-21 estadísticas ----------

test("las estadísticas cuentan partidas, porcentaje de victorias y racha actual", async () => {
  await resultado(ana, luis, luis);
  await resultado(ana, luis, ana);
  await resultado(eva, ana, ana);
  const e = await progreso.estadisticas(ana.email, "Ana");
  assert.equal(e.jugadas, 3);
  assert.equal(e.ganadas, 2);
  assert.equal(e.perdidas, 1);
  assert.equal(e.porcentajeVictorias, 67);
  assert.equal(e.rachaVictorias, 2);
  assert.equal(e.recientes.length, 3);
  assert.equal(e.elo, (await cad.buscarJugador(ana.email)).elo);
});

test("quien aún no ha jugado empieza con 1000 de ELO y sin partidas", async () => {
  const e = await progreso.estadisticas("nuevo@test.es", "Nuevo");
  assert.deepEqual(
    { nombre: e.nombre, elo: e.elo, jugadas: e.jugadas, porcentaje: e.porcentajeVictorias, racha: e.rachaVictorias, recientes: e.recientes },
    { nombre: "Nuevo", elo: 1000, jugadas: 0, porcentaje: 0, racha: 0, recientes: [] }
  );
});
