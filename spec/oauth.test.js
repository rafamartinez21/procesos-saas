// Pruebas del inicio de sesión con Google (OAuth).
// Nunca se llama a Google: el cliente se prueba con un "fetch" falso y la API con un
// objeto oauthGoogle de mentira que devuelve un perfil fijo.

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");
const { crearApp } = require("../servidor/api.js");
const { registroSilencioso } = require("../servidor/registro.js");
const { crearOAuthGoogle, URL_TOKEN, URL_PERFIL, URL_TOKENINFO } = require("../servidor/oauth-google.js");

const CLAVE = "claveSegura1";

async function esperarError(promesa, codigo) {
  await assert.rejects(promesa, (err) => {
    assert.equal(err.name, "ErrorNegocio");
    assert.equal(err.codigo, codigo);
    return true;
  });
}

// ---------- Cliente de Google (servicio externo) ----------

test("la URL de autorización lleva el cliente, la URL de retorno, el state y los permisos", () => {
  const g = crearOAuthGoogle({ clientId: "id-prueba", clientSecret: "secreto-prueba", fetch: async () => {} });
  const url = new URL(g.urlAutorizacion({ state: "abc", redirectUri: "https://app.test/api/auth/google/callback" }));
  assert.equal(url.searchParams.get("client_id"), "id-prueba");
  assert.equal(url.searchParams.get("redirect_uri"), "https://app.test/api/auth/google/callback");
  assert.equal(url.searchParams.get("state"), "abc");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.match(url.searchParams.get("scope"), /email/);
  assert.equal(url.searchParams.get("client_secret"), null);
});

test("obtenerPerfil cambia el código por un token y devuelve email, nombre y verificación", async () => {
  const llamadas = [];
  const fetch = async (url, opciones = {}) => {
    llamadas.push({ url, opciones });
    if (url === URL_TOKEN) return { ok: true, json: async () => ({ access_token: "tok" }) };
    if (url === URL_PERFIL) return { ok: true, json: async () => ({ email: "ana@gmail.com", name: "Ana", email_verified: true }) };
    throw new Error("URL inesperada");
  };
  const g = crearOAuthGoogle({ clientId: "id", clientSecret: "sec", fetch });
  const perfil = await g.obtenerPerfil({ code: "codigo", redirectUri: "https://app.test/cb" });
  assert.deepEqual(perfil, { email: "ana@gmail.com", nombre: "Ana", emailVerificado: true });
  assert.match(llamadas[0].opciones.body, /grant_type=authorization_code/);
  assert.match(llamadas[0].opciones.body, /code=codigo/);
  assert.equal(llamadas[1].opciones.headers.authorization, "Bearer tok");
});

test("[error] si Google rechaza el código se lanza una excepción", async () => {
  const g = crearOAuthGoogle({ clientId: "id", clientSecret: "sec", fetch: async () => ({ ok: false, status: 400 }) });
  await assert.rejects(g.obtenerPerfil({ code: "malo", redirectUri: "x" }), { estado: 400 });
});

test("[error] sin credenciales no se puede crear el cliente de Google", () => {
  assert.throws(() => crearOAuthGoogle({ clientId: "id" }));
});

// ---------- Lógica ----------

let sistema;
let cad;

beforeEach(() => {
  cad = new CadMemoria();
  sistema = new Sistema(cad);
});

const perfilGoogle = (extra = {}) => ({ email: "Ana@Gmail.com", nombre: "Ana", emailVerificado: true, proveedor: "google", ...extra });

test("la primera vez con Google se crea la cuenta como usuario y ya activa", async () => {
  const u = await sistema.iniciarSesionExterna(perfilGoogle());
  assert.deepEqual(u, { email: "ana@gmail.com", nombre: "Ana", rol: "usuario", estado: "activo" });
  const guardado = await cad.buscarUsuario("ana@gmail.com");
  assert.equal(guardado.proveedor, "google");
  assert.equal(guardado.hash, undefined);
});

test("la segunda vez con Google entra en la misma cuenta", async () => {
  await sistema.iniciarSesionExterna(perfilGoogle());
  const u = await sistema.iniciarSesionExterna(perfilGoogle());
  assert.equal(u.email, "ana@gmail.com");
  assert.equal((await cad.listarUsuarios()).length, 1);
});

test("[error] si el email ya tiene cuenta local se rechaza y la cuenta no cambia (D-18)", async () => {
  await sistema.registrarUsuario({ email: "ana@gmail.com", password: CLAVE });
  await esperarError(sistema.iniciarSesionExterna(perfilGoogle()), "CUENTA_LOCAL_EXISTENTE");
  const guardado = await cad.buscarUsuario("ana@gmail.com");
  assert.equal(guardado.confirmada, false);
  assert.equal(guardado.proveedor, undefined);
});

test("[error] un email no verificado por el proveedor se rechaza", async () => {
  await esperarError(sistema.iniciarSesionExterna(perfilGoogle({ emailVerificado: false })), "EMAIL_NO_VERIFICADO");
  assert.equal((await cad.listarUsuarios()).length, 0);
});

test("[error] una cuenta creada con Google no puede entrar con contraseña", async () => {
  await sistema.iniciarSesionExterna(perfilGoogle());
  await esperarError(sistema.iniciarSesion({ email: "ana@gmail.com", password: CLAVE }), "CREDENCIALES_INVALIDAS");
});

test("una cuenta creada con Google cuenta como activa para el administrador", async () => {
  await sistema.crearAdministradorInicial({ email: "admin@test.es", password: "claveAdmin1" });
  await sistema.iniciarSesionExterna(perfilGoogle());
  assert.equal(await sistema.usuarioActivo("admin@test.es", "ana@gmail.com"), true);
});

// ---------- API: el flujo completo con un Google simulado ----------

let servidor;
let base;
let perfilDevuelto;

before(async () => {
  const oauthGoogle = {
    urlAutorizacion: ({ state, redirectUri }) => `https://google.test/auth?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    obtenerPerfil: async ({ code }) => {
      if (code !== "codigo-bueno") throw new Error("código no válido");
      return perfilDevuelto;
    },
    clientId: "id-prueba.apps.googleusercontent.com",
    verificarCredencial: async (credencial) => {
      if (credencial !== "credencial-buena-de-google") throw new Error("credencial no válida");
      return perfilDevuelto;
    },
  };
  const s = new Sistema(new CadMemoria(), { autoConfirmar: true });
  await s.registrarUsuario({ email: "local@test.es", password: CLAVE });
  const app = crearApp(s, { registro: registroSilencioso, oauthGoogle });
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

// Empieza el flujo y devuelve el state y la cookie que el navegador guardaría.
async function empezar() {
  const res = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
  assert.equal(res.status, 302);
  const destino = new URL(res.headers.get("location"));
  const cookie = res.headers.getSetCookie()[0].split(";")[0];
  return { state: destino.searchParams.get("state"), cookie, destino };
}

async function volver({ state, code, cookie }) {
  return fetch(`${base}/api/auth/google/callback?state=${state}&code=${code}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
}

test("GET /api/auth/google redirige a Google con un state guardado en una cookie HttpOnly", async () => {
  const res = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
  const setCookie = res.headers.getSetCookie()[0];
  assert.match(setCookie, /^oauth_estado=[0-9a-f]{32};/);
  assert.match(setCookie, /HttpOnly/);
  const destino = new URL(res.headers.get("location"));
  assert.equal(destino.origin, "https://google.test");
  assert.match(destino.searchParams.get("redirect_uri"), /\/api\/auth\/google\/callback$/);
});

test("flujo completo: vuelta de Google con state correcto -> sesión iniciada", async () => {
  perfilDevuelto = { email: "nuevo@gmail.com", nombre: "Nuevo", emailVerificado: true };
  const { state, cookie } = await empezar();
  const res = await volver({ state, code: "codigo-bueno", cookie });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/");
  const sid = res.headers.getSetCookie().find((c) => c.startsWith("sid="));
  assert.ok(sid, "debe crear la cookie de sesión");
  const yo = await fetch(`${base}/api/sesion`, { headers: { cookie: sid.split(";")[0] } });
  assert.equal(yo.status, 200);
  assert.equal((await yo.json()).email, "nuevo@gmail.com");
});

test("[error] un state que no coincide con la cookie se rechaza sin crear sesión", async () => {
  perfilDevuelto = { email: "otro@gmail.com", nombre: "", emailVerificado: true };
  const { cookie } = await empezar();
  const res = await volver({ state: "inventado", code: "codigo-bueno", cookie });
  assert.equal(res.headers.get("location"), "/?oauth=error");
  assert.equal(res.headers.getSetCookie().some((c) => c.startsWith("sid=")), false);
});

test("[error] sin la cookie del state (petición falsificada) se rechaza", async () => {
  const { state } = await empezar();
  const res = await volver({ state, code: "codigo-bueno" });
  assert.equal(res.headers.get("location"), "/?oauth=error");
});

test("[error] si el email ya tiene cuenta local se vuelve con un aviso claro (D-18)", async () => {
  perfilDevuelto = { email: "local@test.es", nombre: "", emailVerificado: true };
  const { state, cookie } = await empezar();
  const res = await volver({ state, code: "codigo-bueno", cookie });
  assert.equal(res.headers.get("location"), "/?oauth=cuenta-local");
});

test("[error] si Google falla al dar el perfil se vuelve con error y sin sesión", async () => {
  const { state, cookie } = await empezar();
  const res = await volver({ state, code: "codigo-malo", cookie });
  assert.equal(res.headers.get("location"), "/?oauth=error");
  assert.equal(res.headers.getSetCookie().some((c) => c.startsWith("sid=")), false);
});

test("sin Google configurado, /api/auth/google avisa de que no está disponible", async () => {
  const app = crearApp(new Sistema(new CadMemoria()), { registro: registroSilencioso });
  const srv = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/api/auth/google`, { redirect: "manual" });
    assert.equal(res.headers.get("location"), "/?oauth=no-disponible");
  } finally {
    srv.close();
  }
});

// ---------- Google One Tap (apartado 2.4 del tutorial) ----------

const AHORA = Date.UTC(2026, 10, 17, 12, 0, 0);
const CREDENCIAL = "eyJhbGciOiJSUzI1NiJ9.cuerpo-de-prueba.firma-de-prueba";
function googleFalso(respuesta, { ok = true, estado = 200 } = {}) {
  const llamadas = [];
  const fetch = async (url) => {
    llamadas.push(url);
    return { ok, status: estado, json: async () => respuesta };
  };
  return { llamadas, g: crearOAuthGoogle({ clientId: "id-prueba", clientSecret: "secreto", fetch, ahora: () => AHORA }) };
}
const tokenValido = (extra = {}) => ({ aud: "id-prueba", iss: "https://accounts.google.com", exp: String(AHORA / 1000 + 600), email: "ana@gmail.com", email_verified: "true", name: "Ana", ...extra });

test("One Tap: una credencial válida de Google da el perfil, y se comprueba con tokeninfo", async () => {
  const { g, llamadas } = googleFalso(tokenValido());
  assert.deepEqual(await g.verificarCredencial(CREDENCIAL), { email: "ana@gmail.com", nombre: "Ana", emailVerificado: true });
  const url = new URL(llamadas[0]);
  assert.equal(`${url.origin}${url.pathname}`, URL_TOKENINFO);
  assert.equal(url.searchParams.get("id_token"), CREDENCIAL);
  assert.equal(g.clientId, "id-prueba");
});

test("[error] One Tap: se rechaza una credencial para otra aplicación, de otro emisor, caducada o que Google no acepta", async () => {
  const casos = [
    googleFalso(tokenValido({ aud: "otra-app" })).g,
    googleFalso(tokenValido({ iss: "https://malo.test" })).g,
    googleFalso(tokenValido({ exp: String(AHORA / 1000 - 1) })).g,
    googleFalso({ error: "invalid_token" }, { ok: false, estado: 400 }).g,
  ];
  for (const g of casos) await assert.rejects(g.verificarCredencial(CREDENCIAL), (err) => err.credencialInvalida === true);
  const { g, llamadas } = googleFalso(tokenValido());
  await assert.rejects(g.verificarCredencial(123), (err) => err.credencialInvalida === true);
  await assert.rejects(g.verificarCredencial(""), (err) => err.credencialInvalida === true);
  assert.equal(llamadas.length, 0, "sin una credencial con forma de token no se llama a Google");
});

test("One Tap: un email que Google no ha verificado llega como no verificado (la lógica lo rechaza)", async () => {
  const { g } = googleFalso(tokenValido({ email_verified: "false" }));
  assert.equal((await g.verificarCredencial(CREDENCIAL)).emailVerificado, false);
});

test("GET /api/auth/google/one-tap da el id de cliente que necesita la página", async () => {
  const res = await fetch(`${base}/api/auth/google/one-tap`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { clientId: "id-prueba.apps.googleusercontent.com" });
});

test("One Tap por la API: con una credencial buena se crea la sesión con la cookie HttpOnly", async () => {
  perfilDevuelto = { email: "onetap@gmail.com", nombre: "Uno", emailVerificado: true };
  const res = await fetch(`${base}/api/auth/google/one-tap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential: "credencial-buena-de-google" }) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).email, "onetap@gmail.com");
  const sid = res.headers.getSetCookie().find((c) => c.startsWith("sid="));
  assert.match(sid, /HttpOnly/);
  const yo = await fetch(`${base}/api/sesion`, { headers: { cookie: sid.split(";")[0] } });
  assert.equal((await yo.json()).email, "onetap@gmail.com");
});

test("[error] One Tap por la API: credencial inventada (401), email con cuenta local (409) y email sin verificar (403), sin sesión", async () => {
  const enviar = (credential) => fetch(`${base}/api/auth/google/one-tap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }) });
  let res = await enviar("inventada");
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, "CREDENCIAL_INVALIDA");
  assert.equal(res.headers.getSetCookie().some((c) => c.startsWith("sid=")), false);
  perfilDevuelto = { email: "local@test.es", nombre: "", emailVerificado: true };
  res = await enviar("credencial-buena-de-google");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "CUENTA_LOCAL_EXISTENTE");
  perfilDevuelto = { email: "sinverificar@gmail.com", nombre: "", emailVerificado: false };
  res = await enviar("credencial-buena-de-google");
  assert.equal(res.status, 403);
  assert.equal(res.headers.getSetCookie().some((c) => c.startsWith("sid=")), false);
});

test("sin Google configurado, One Tap responde 404 y la página no lo muestra", async () => {
  const app = crearApp(new Sistema(new CadMemoria()), { registro: registroSilencioso });
  const srv = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const url = `http://127.0.0.1:${srv.address().port}/api/auth/google/one-tap`;
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 404);
  } finally {
    srv.close();
  }
});
