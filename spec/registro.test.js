// Pruebas del registro de actividad (servidor/registro.js) y de lo que la API registra.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");
const { crearApp } = require("../servidor/api.js");
const { crearRegistro } = require("../servidor/registro.js");

test("cada evento es una línea JSON con severity, message y time", () => {
  const lineas = [];
  const r = crearRegistro({ escribir: (l) => lineas.push(l), ahora: () => new Date("2026-01-02T03:04:05Z") });
  r.info("hola", { email: "a@test.es" });
  r.aviso("ojo");
  r.error("mal");
  const [a, b, c] = lineas.map((l) => JSON.parse(l));
  assert.deepEqual(a, { severity: "INFO", message: "hola", time: "2026-01-02T03:04:05.000Z", email: "a@test.es" });
  assert.equal(b.severity, "WARNING");
  assert.equal(c.severity, "ERROR");
});

test("[error] nunca se registran contraseñas, hashes ni cookies", () => {
  const lineas = [];
  const r = crearRegistro({ escribir: (l) => lineas.push(l) });
  r.info("x", { password: "secreta", hash: "abc", cookie: "sid=1", idSesion: "1", email: "a@test.es" });
  const e = JSON.parse(lineas[0]);
  assert.equal(e.email, "a@test.es");
  for (const campo of ["password", "hash", "cookie", "idSesion"]) assert.equal(campo in e, false);
});

// --- Lo que registra la API ---
const lineas = [];
let servidor;
let base;

before(async () => {
  const sistema = new Sistema(new CadMemoria(), { autoConfirmar: true });
  const app = crearApp(sistema, { registro: crearRegistro({ escribir: (l) => lineas.push(JSON.parse(l)) }) });
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

async function post(ruta, cuerpo) {
  const res = await fetch(base + ruta, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  await res.text();
  return res.status;
}

test("registro e inicio de sesión quedan en el log, sin la contraseña", async () => {
  await post("/api/usuarios", { email: "log@test.es", password: "claveSecretaLog1" });
  await post("/api/sesion", { email: "log@test.es", password: "claveSecretaLog1" });
  const mensajes = lineas.map((l) => l.message);
  assert.ok(mensajes.includes("usuario registrado"));
  assert.ok(mensajes.includes("inicio de sesion"));
  assert.equal(JSON.stringify(lineas).includes("claveSecretaLog1"), false);
});

test("[error] un login fallido se registra como WARNING con el código", async () => {
  const estado = await post("/api/sesion", { email: "log@test.es", password: "incorrecta1" });
  assert.equal(estado, 401);
  const aviso = lineas.find((l) => l.message === "peticion rechazada" && l.codigo === "CREDENCIALES_INVALIDAS");
  assert.ok(aviso);
  assert.equal(aviso.severity, "WARNING");
  assert.equal(aviso.email, "log@test.es");
});
