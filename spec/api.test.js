// Pruebas de la CAPA API: arrancan el servidor de verdad en un puerto libre y lo
// llaman por HTTP. Comprueban sobre todo las rutas protegidas y la sesión.
// (La lógica de negocio ya se prueba en modelo.test.js; aquí se comprueba que la API
// la expone bien y exige sesión.)

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");
const { crearApp } = require("../servidor/api.js");
const { registroSilencioso } = require("../servidor/registro.js");

const CLAVE = "claveSegura1";
let servidor;
let base;

before(async () => {
  const sistema = new Sistema(new CadMemoria(), { autoConfirmar: true });
  await sistema.crearAdministradorInicial({ email: "admin@test.es", password: "claveAdmin1" });
  const app = crearApp(sistema, { registro: registroSilencioso });
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
});

// Llama a la API; "cookie" es opcional. Devuelve estado, cuerpo JSON y la cookie recibida.
async function llamar(metodo, ruta, { cuerpo, cookie } = {}) {
  const cabeceras = {};
  if (cuerpo !== undefined) cabeceras["content-type"] = "application/json";
  if (cookie) cabeceras["cookie"] = cookie;
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie()[0] : undefined;
  return {
    estado: res.status,
    cuerpo: texto ? JSON.parse(texto) : undefined,
    setCookie,
    // Valor listo para reenviar en la cabecera Cookie (solo "sid=...")
    cookie: setCookie ? setCookie.split(";")[0] : undefined,
  };
}

async function registrarYEntrar(email) {
  await llamar("POST", "/api/usuarios", { cuerpo: { email, password: CLAVE } });
  const r = await llamar("POST", "/api/sesion", { cuerpo: { email, password: CLAVE } });
  assert.equal(r.estado, 200);
  return r.cookie;
}

test("la API responde y sirve la página", async () => {
  assert.equal((await llamar("GET", "/api/salud")).estado, 200);
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
});

test("[error] las rutas protegidas rechazan peticiones sin sesión (401)", async () => {
  assert.equal((await llamar("GET", "/api/usuarios")).estado, 401);
  assert.equal((await llamar("GET", "/api/sesion")).estado, 401);
  assert.equal((await llamar("DELETE", "/api/usuarios/alguien@test.es")).estado, 401);
  assert.equal((await llamar("GET", "/api/usuarios/alguien@test.es/activo")).estado, 401);
});

test("[error] una cookie de sesión inventada no vale", async () => {
  const r = await llamar("GET", "/api/usuarios", { cookie: "sid=inventada" });
  assert.equal(r.estado, 401);
});

test("el registro devuelve 201 y no expone la contraseña ni el hash", async () => {
  const r = await llamar("POST", "/api/usuarios", { cuerpo: { email: "ana@test.es", password: CLAVE, nombre: "Ana" } });
  assert.equal(r.estado, 201);
  assert.deepEqual(r.cuerpo, { email: "ana@test.es", nombre: "Ana", rol: "usuario", estado: "activo" });
});

test("[error] registrar un email repetido devuelve 409 y una contraseña corta 400", async () => {
  await llamar("POST", "/api/usuarios", { cuerpo: { email: "rep@test.es", password: CLAVE } });
  assert.equal((await llamar("POST", "/api/usuarios", { cuerpo: { email: "rep@test.es", password: CLAVE } })).estado, 409);
  assert.equal((await llamar("POST", "/api/usuarios", { cuerpo: { email: "otro@test.es", password: "corta" } })).estado, 400);
});

test("iniciar sesión da una cookie HttpOnly y la sesión se mantiene entre peticiones", async () => {
  await llamar("POST", "/api/usuarios", { cuerpo: { email: "bea@test.es", password: CLAVE } });
  const login = await llamar("POST", "/api/sesion", { cuerpo: { email: "bea@test.es", password: CLAVE } });
  assert.equal(login.estado, 200);
  assert.match(login.setCookie, /HttpOnly/);
  // Simula recargar la página: se vuelve a preguntar quién soy con la misma cookie
  const yo = await llamar("GET", "/api/sesion", { cookie: login.cookie });
  assert.equal(yo.estado, 200);
  assert.equal(yo.cuerpo.email, "bea@test.es");
});

test("[error] credenciales incorrectas devuelven 401 y no crean cookie", async () => {
  await llamar("POST", "/api/usuarios", { cuerpo: { email: "carl@test.es", password: CLAVE } });
  const r = await llamar("POST", "/api/sesion", { cuerpo: { email: "carl@test.es", password: "equivocada1" } });
  assert.equal(r.estado, 401);
  assert.equal(r.setCookie, undefined);
});

test("cerrar sesión invalida la cookie en el servidor", async () => {
  const cookie = await registrarYEntrar("dani@test.es");
  assert.equal((await llamar("GET", "/api/sesion", { cookie })).estado, 200);
  assert.equal((await llamar("DELETE", "/api/sesion", { cookie })).estado, 204);
  // Aunque se reutilice la cookie anterior, ya no vale
  assert.equal((await llamar("GET", "/api/sesion", { cookie })).estado, 401);
});

test("[error] un usuario normal no puede listar usuarios (403) pero el administrador sí", async () => {
  const cookieUsuario = await registrarYEntrar("eva@test.es");
  assert.equal((await llamar("GET", "/api/usuarios", { cookie: cookieUsuario })).estado, 403);

  const admin = await llamar("POST", "/api/sesion", { cuerpo: { email: "admin@test.es", password: "claveAdmin1" } });
  const lista = await llamar("GET", "/api/usuarios", { cookie: admin.cookie });
  assert.equal(lista.estado, 200);
  assert.ok(lista.cuerpo.some((u) => u.email === "eva@test.es"));
  assert.ok(lista.cuerpo.every((u) => u.hash === undefined && u.password === undefined));
});

test("[error] un usuario normal no puede eliminar a otro (403)", async () => {
  const cookie = await registrarYEntrar("fran@test.es");
  await llamar("POST", "/api/usuarios", { cuerpo: { email: "gus@test.es", password: CLAVE } });
  assert.equal((await llamar("DELETE", "/api/usuarios/gus@test.es", { cookie })).estado, 403);
});

test("un usuario que elimina su cuenta pierde la sesión y no puede volver a entrar", async () => {
  const cookie = await registrarYEntrar("hugo@test.es");
  assert.equal((await llamar("DELETE", "/api/usuarios/hugo@test.es", { cookie })).estado, 204);
  assert.equal((await llamar("GET", "/api/sesion", { cookie })).estado, 401);
  const r = await llamar("POST", "/api/sesion", { cuerpo: { email: "hugo@test.es", password: CLAVE } });
  assert.equal(r.estado, 401);
});

test("si el administrador elimina a un usuario, la sesión de ese usuario deja de valer", async () => {
  const cookieUsuario = await registrarYEntrar("ines@test.es");
  const admin = await llamar("POST", "/api/sesion", { cuerpo: { email: "admin@test.es", password: "claveAdmin1" } });
  assert.equal((await llamar("DELETE", "/api/usuarios/ines@test.es", { cookie: admin.cookie })).estado, 204);
  assert.equal((await llamar("GET", "/api/sesion", { cookie: cookieUsuario })).estado, 401);
});

test("el administrador puede consultar si un usuario está activo", async () => {
  await llamar("POST", "/api/usuarios", { cuerpo: { email: "juan@test.es", password: CLAVE } });
  const admin = await llamar("POST", "/api/sesion", { cuerpo: { email: "admin@test.es", password: "claveAdmin1" } });
  const r = await llamar("GET", "/api/usuarios/juan@test.es/activo", { cookie: admin.cookie });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.activo, true);
});

test("[error] una ruta de API desconocida devuelve 404 y un JSON mal formado 400", async () => {
  assert.equal((await llamar("GET", "/api/no-existe")).estado, 404);
  const res = await fetch(base + "/api/usuarios", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{esto no es json",
  });
  assert.equal(res.status, 400);
});

test("variante2: POST /api/prueba/email es pública y cumple el contrato", async () => {
  const ok = await llamar("POST", "/api/prueba/email", { cuerpo: { email: " Ana@X.com " } });
  assert.equal(ok.estado, 200);
  assert.deepEqual(ok.cuerpo, { email: "ana@x.com" });

  const malo = await llamar("POST", "/api/prueba/email", { cuerpo: { email: "ana@x" } });
  assert.equal(malo.estado, 400);
  assert.deepEqual(malo.cuerpo, { error: "EMAIL_INVALIDO" });

  const sinEmail = await llamar("POST", "/api/prueba/email", { cuerpo: {} });
  assert.equal(sinEmail.estado, 400);
  assert.ok(sinEmail.cuerpo.error);

  const tipoIncorrecto = await llamar("POST", "/api/prueba/email", { cuerpo: { email: 42 } });
  assert.equal(tipoIncorrecto.estado, 400);
  assert.ok(tipoIncorrecto.cuerpo.error);
});
