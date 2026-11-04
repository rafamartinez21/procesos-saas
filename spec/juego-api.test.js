// Pruebas de las rutas del progreso del juego (hito 7): exigen sesión, devuelven los datos
// del jugador con sesión y nunca emails de otros jugadores.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");
const { crearApp } = require("../servidor/api.js");
const { Progreso } = require("../servidor/juego/progreso.js");
const { registroSilencioso } = require("../servidor/registro.js");

const CLAVE = "claveSegura1";
let servidor;
let base;
let progreso;

before(async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad, { autoConfirmar: true });
  await sistema.registrarUsuario({ email: "ana@test.es", nombre: "Ana", password: CLAVE });
  await sistema.registrarUsuario({ email: "luis@test.es", nombre: "Luis", password: CLAVE });
  progreso = new Progreso(cad);
  await progreso.registrarResultado({
    id: "P1",
    jugadores: [{ email: "ana@test.es", nombre: "Ana" }, { email: "luis@test.es", nombre: "Luis" }],
    ganador: "ana@test.es",
    motivo: "sin-criaturas",
    turnos: 6,
  });
  const app = crearApp(sistema, { registro: registroSilencioso, progreso });
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

async function cookieDe(email) {
  const r = await fetch(`${base}/api/sesion`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: CLAVE }),
  });
  return r.headers.getSetCookie()[0].split(";")[0];
}

const obtener = async (ruta, cookie) => {
  const r = await fetch(base + ruta, { headers: cookie ? { cookie } : {} });
  return { estado: r.status, cuerpo: await r.json() };
};

test("[error] las rutas del juego exigen sesión (401)", async () => {
  for (const ruta of ["/api/juego/ranking", "/api/juego/historial", "/api/juego/estadisticas"]) {
    assert.equal((await obtener(ruta)).estado, 401, ruta);
  }
});

test("GET /api/juego/ranking devuelve el ranking sin emails (RF-20)", async () => {
  const r = await obtener("/api/juego/ranking", await cookieDe("luis@test.es"));
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.map((j) => [j.posicion, j.nombre, j.elo]), [[1, "Ana", 1016], [2, "Luis", 984]]);
  assert.equal(JSON.stringify(r.cuerpo).includes("@"), false);
});

test("GET /api/juego/historial devuelve las partidas del jugador con sesión (RF-19)", async () => {
  const r = await obtener("/api/juego/historial", await cookieDe("luis@test.es"));
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.map((p) => [p.rival, p.resultado, p.cambioElo]), [["Ana", "derrota", -16]]);
});

test("GET /api/juego/estadisticas devuelve las del jugador con sesión (RF-21)", async () => {
  const r = await obtener("/api/juego/estadisticas", await cookieDe("ana@test.es"));
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.nombre, "Ana");
  assert.equal(r.cuerpo.ganadas, 1);
  assert.equal(r.cuerpo.porcentajeVictorias, 100);
});

test("al eliminar la cuenta, el jugador desaparece del ranking", async () => {
  const cookie = await cookieDe("ana@test.es");
  const r = await fetch(`${base}/api/usuarios/ana@test.es`, { method: "DELETE", headers: { cookie } });
  assert.equal(r.status, 204);
  const ranking = await obtener("/api/juego/ranking", await cookieDe("luis@test.es"));
  assert.deepEqual(ranking.cuerpo.map((j) => j.nombre), ["Luis"]);
});

test("[error] sin el progreso configurado, las rutas responden 503", async () => {
  const sistema = new Sistema(new CadMemoria(), { autoConfirmar: true });
  await sistema.registrarUsuario({ email: "eva@test.es", password: CLAVE });
  const app = crearApp(sistema, { registro: registroSilencioso });
  const srv = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const b = `http://127.0.0.1:${srv.address().port}`;
    const login = await fetch(`${b}/api/sesion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "eva@test.es", password: CLAVE }) });
    const cookie = login.headers.getSetCookie()[0].split(";")[0];
    const r = await fetch(`${b}/api/juego/ranking`, { headers: { cookie } });
    assert.equal(r.status, 503);
  } finally {
    srv.close();
  }
});
