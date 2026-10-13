// Pruebas de la confirmación de cuenta por enlace.
// El registro deja la cuenta pendiente y genera un token; el enlace que lo contiene se
// entrega con "enviarConfirmacion" (en producción, una línea en el log). Estas pruebas
// capturan ese token como lo haría quien abre el enlace.

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");
const { crearApp } = require("../servidor/api.js");
const { registroSilencioso } = require("../servidor/registro.js");

const CLAVE = "claveSegura1";

async function esperarError(promesa, codigo) {
  await assert.rejects(promesa, (err) => {
    assert.equal(err.name, "ErrorNegocio");
    assert.equal(err.codigo, codigo);
    return true;
  });
}

// ---------- Lógica ----------

let sistema;
let cad;
let enviados; // [{ email, token, contexto }]
let reloj;

beforeEach(() => {
  cad = new CadMemoria();
  enviados = [];
  reloj = 1_000_000;
  sistema = new Sistema(cad, {
    enviarConfirmacion: async (email, token, contexto) => enviados.push({ email, token, contexto }),
    ahora: () => reloj,
    duracionTokenMs: 1000,
  });
});

test("registrar deja la cuenta pendiente y entrega un token de confirmación", async () => {
  const u = await sistema.registrarUsuario({ email: "pepe@test.es", password: CLAVE }, { urlBase: "https://x.es" });
  assert.equal(u.estado, "pendiente");
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].email, "pepe@test.es");
  assert.equal(enviados[0].contexto.urlBase, "https://x.es");
  assert.ok(enviados[0].token.length >= 64);
});

test("el token no se guarda en claro ni sale en la vista del usuario", async () => {
  const u = await sistema.registrarUsuario({ email: "pepe@test.es", password: CLAVE });
  const guardado = await cad.buscarUsuario("pepe@test.es");
  assert.notEqual(guardado.tokenConfirmacion, enviados[0].token);
  assert.equal(u.tokenConfirmacion, undefined);
  assert.equal(JSON.stringify(u).includes(enviados[0].token), false);
});

test("[error] hasta confirmar, la cuenta no puede iniciar sesión", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es", password: CLAVE });
  await esperarError(sistema.iniciarSesion({ email: "pepe@test.es", password: CLAVE }), "CUENTA_PENDIENTE");
});

test("con el token correcto la cuenta se activa y ya puede iniciar sesión", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es", password: CLAVE });
  const u = await sistema.confirmarConToken(enviados[0].token);
  assert.equal(u.estado, "activo");
  const sesion = await sistema.iniciarSesion({ email: "pepe@test.es", password: CLAVE });
  assert.equal(sesion.email, "pepe@test.es");
});

test("[error] un token inventado o vacío se rechaza", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es", password: CLAVE });
  await esperarError(sistema.confirmarConToken("inventado"), "TOKEN_INVALIDO");
  await esperarError(sistema.confirmarConToken(""), "TOKEN_INVALIDO");
  await esperarError(sistema.confirmarConToken(undefined), "TOKEN_INVALIDO");
});

test("[error] el token es de un solo uso", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es", password: CLAVE });
  await sistema.confirmarConToken(enviados[0].token);
  await esperarError(sistema.confirmarConToken(enviados[0].token), "TOKEN_INVALIDO");
});

test("[error] un token caducado se rechaza y la cuenta sigue pendiente", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es", password: CLAVE });
  reloj += 1001;
  await esperarError(sistema.confirmarConToken(enviados[0].token), "TOKEN_INVALIDO");
  await esperarError(sistema.iniciarSesion({ email: "pepe@test.es", password: CLAVE }), "CUENTA_PENDIENTE");
});

test("cada usuario tiene su propio token", async () => {
  await sistema.registrarUsuario({ email: "a@test.es", password: CLAVE });
  await sistema.registrarUsuario({ email: "b@test.es", password: CLAVE });
  assert.notEqual(enviados[0].token, enviados[1].token);
  await sistema.confirmarConToken(enviados[1].token);
  assert.equal((await cad.buscarUsuario("a@test.es")).confirmada, false);
  assert.equal((await cad.buscarUsuario("b@test.es")).confirmada, true);
});

// ---------- API: el enlace que se pega en el navegador ----------

let servidor;
let base;
let tokens; // email -> token

before(async () => {
  tokens = {};
  const s = new Sistema(new CadMemoria(), {
    enviarConfirmacion: async (email, token) => {
      tokens[email] = token;
    },
  });
  const app = crearApp(s, { registro: registroSilencioso });
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

async function post(ruta, cuerpo) {
  return fetch(base + ruta, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
}

test("flujo completo: registro -> login rechazado -> enlace -> login correcto", async () => {
  const email = "ana@test.es";
  const alta = await post("/api/usuarios", { email, password: CLAVE });
  assert.equal(alta.status, 201);
  assert.equal((await alta.json()).estado, "pendiente");

  const antes = await post("/api/sesion", { email, password: CLAVE });
  assert.equal(antes.status, 403);
  assert.equal((await antes.json()).error, "CUENTA_PENDIENTE");

  // Es lo que hace el usuario: copiar el enlace del log y pegarlo en el navegador
  const enlace = await fetch(`${base}/api/confirmar?token=${tokens[email]}`, { redirect: "manual" });
  assert.equal(enlace.status, 302);
  assert.equal(enlace.headers.get("location"), "/?confirmada=ok");

  const despues = await post("/api/sesion", { email, password: CLAVE });
  assert.equal(despues.status, 200);
});

test("[error] un enlace inventado o ya usado redirige con error y no activa nada", async () => {
  const falso = await fetch(`${base}/api/confirmar?token=inventado`, { redirect: "manual" });
  assert.equal(falso.status, 302);
  assert.equal(falso.headers.get("location"), "/?confirmada=error");

  const sinToken = await fetch(`${base}/api/confirmar`, { redirect: "manual" });
  assert.equal(sinToken.headers.get("location"), "/?confirmada=error");

  const email = "luis@test.es";
  await post("/api/usuarios", { email, password: CLAVE });
  await fetch(`${base}/api/confirmar?token=${tokens[email]}`, { redirect: "manual" });
  const repetido = await fetch(`${base}/api/confirmar?token=${tokens[email]}`, { redirect: "manual" });
  assert.equal(repetido.headers.get("location"), "/?confirmada=error");
});
