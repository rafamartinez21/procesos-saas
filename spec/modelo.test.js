// Pruebas unitarias de la CAPA DE LÓGICA (servidor/modelo.js).
// Usan el CAD en memoria, así que no necesitan base de datos ni servidor web.
// Se ejecutan con: npm test

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");

const CLAVE = "claveSegura1";
let sistema;
let cad;

beforeEach(async () => {
  cad = new CadMemoria();
  sistema = new Sistema(cad); // por defecto, las cuentas nuevas quedan pendientes
  await sistema.crearAdministradorInicial({ email: "admin@test.es", password: "claveAdmin1" });
});

// Atajo: registra un usuario con una contraseña válida.
function registrar(email, extra = {}) {
  return sistema.registrarUsuario({ email, password: CLAVE, ...extra });
}

// Comprueba que una promesa se rechaza con un ErrorNegocio con ese código.
async function esperarError(promesa, codigo) {
  await assert.rejects(promesa, (err) => {
    assert.equal(err.name, "ErrorNegocio");
    assert.equal(err.codigo, codigo);
    return true;
  });
}

// ---------- Registro ----------

test("registrar un usuario nuevo lo deja pendiente y con rol usuario", async () => {
  const u = await registrar("Pepe@Test.es ", { nombre: "Pepe" });
  assert.deepEqual(u, { email: "pepe@test.es", nombre: "Pepe", rol: "usuario", estado: "pendiente" });
});

test("la contraseña se guarda con hash, nunca en claro, y no se devuelve", async () => {
  const u = await registrar("pepe@test.es");
  assert.equal(u.hash, undefined);
  const guardado = await cad.buscarUsuario("pepe@test.es");
  assert.ok(guardado.hash);
  assert.ok(!guardado.hash.includes(CLAVE));
});

test("[error] registrar un email que ya existe se rechaza (sin distinguir mayúsculas)", async () => {
  await registrar("pepe@test.es");
  await esperarError(registrar("PEPE@test.es"), "EMAIL_EN_USO");
});

test("[error] registrar un email con formato inválido se rechaza", async () => {
  await esperarError(registrar("esto-no-es-un-email"), "EMAIL_INVALIDO");
  await esperarError(sistema.registrarUsuario({}), "EMAIL_INVALIDO");
});

test("[error] registrar con una contraseña demasiado corta se rechaza", async () => {
  await esperarError(sistema.registrarUsuario({ email: "pepe@test.es", password: "corta" }), "CONTRASENA_DEBIL");
  await esperarError(sistema.registrarUsuario({ email: "pepe@test.es" }), "CONTRASENA_DEBIL");
});

test("[error] dos registros simultáneos del mismo email: solo se crea uno", async () => {
  const resultados = await Promise.allSettled([registrar("pepe@test.es"), registrar("pepe@test.es")]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  const rechazado = resultados.find((r) => r.status === "rejected");
  assert.equal(rechazado.reason.codigo, "EMAIL_EN_USO");
});

test("con autoConfirmar (provisional) el usuario nuevo queda activo", async () => {
  const auto = new Sistema(new CadMemoria(), { autoConfirmar: true });
  const u = await auto.registrarUsuario({ email: "pepe@test.es", password: CLAVE });
  assert.equal(u.estado, "activo");
});

// ---------- Inicio de sesión ----------

test("un usuario confirmado inicia sesión con sus credenciales", async () => {
  await registrar("pepe@test.es");
  await sistema.confirmarUsuario("pepe@test.es");
  const u = await sistema.iniciarSesion({ email: "PEPE@test.es", password: CLAVE });
  assert.equal(u.email, "pepe@test.es");
  assert.equal(u.estado, "activo");
  assert.equal(u.hash, undefined);
});

test("[error] una cuenta pendiente de confirmar no puede iniciar sesión", async () => {
  await registrar("pepe@test.es");
  await esperarError(sistema.iniciarSesion({ email: "pepe@test.es", password: CLAVE }), "CUENTA_PENDIENTE");
});

test("[error] contraseña incorrecta y usuario inexistente dan el mismo error", async () => {
  await registrar("pepe@test.es");
  await sistema.confirmarUsuario("pepe@test.es");
  await esperarError(sistema.iniciarSesion({ email: "pepe@test.es", password: "otraClave99" }), "CREDENCIALES_INVALIDAS");
  await esperarError(sistema.iniciarSesion({ email: "nadie@test.es", password: CLAVE }), "CREDENCIALES_INVALIDAS");
});

test("[error] una cuenta pendiente con contraseña incorrecta no revela que está pendiente", async () => {
  await registrar("pepe@test.es");
  await esperarError(sistema.iniciarSesion({ email: "pepe@test.es", password: "otraClave99" }), "CREDENCIALES_INVALIDAS");
});

test("[error] un usuario eliminado no puede volver a iniciar sesión", async () => {
  await registrar("pepe@test.es");
  await sistema.confirmarUsuario("pepe@test.es");
  await sistema.eliminarUsuario("pepe@test.es", "pepe@test.es");
  await esperarError(sistema.iniciarSesion({ email: "pepe@test.es", password: CLAVE }), "CREDENCIALES_INVALIDAS");
});

test("[error] un usuario sin contraseña (por ejemplo, de OAuth) no entra por el login local", async () => {
  await cad.insertarUsuario({ email: "google@test.es", nombre: "G", rol: "usuario", confirmada: true });
  await esperarError(sistema.iniciarSesion({ email: "google@test.es", password: CLAVE }), "CREDENCIALES_INVALIDAS");
});

test("el perfil devuelve los datos del usuario que hace la petición", async () => {
  const p = await sistema.perfil("admin@test.es");
  assert.deepEqual(p, { email: "admin@test.es", nombre: "Administrador", rol: "admin", estado: "activo" });
});

// ---------- Administrador inicial ----------

test("el administrador inicial puede iniciar sesión y tiene rol admin", async () => {
  const u = await sistema.iniciarSesion({ email: "admin@test.es", password: "claveAdmin1" });
  assert.equal(u.rol, "admin");
});

test("crear el administrador inicial es idempotente y no pisa al existente", async () => {
  const creado = await sistema.crearAdministradorInicial({ email: "admin@test.es", password: "otraClaveDistinta" });
  assert.equal(creado, false);
  const u = await sistema.iniciarSesion({ email: "admin@test.es", password: "claveAdmin1" });
  assert.equal(u.rol, "admin");
});

// ---------- Consultas y permisos ----------

test("un usuario está activo solo cuando ha confirmado su cuenta", async () => {
  await registrar("pepe@test.es");
  assert.equal(await sistema.usuarioActivo("admin@test.es", "pepe@test.es"), false);
  await sistema.confirmarUsuario("pepe@test.es");
  assert.equal(await sistema.usuarioActivo("admin@test.es", "pepe@test.es"), true);
});

test("un usuario que no existe no está activo", async () => {
  assert.equal(await sistema.usuarioActivo("admin@test.es", "nadie@test.es"), false);
});

test("el administrador lista usuarios con email, rol y estado (sin hash)", async () => {
  await registrar("pepe@test.es");
  const lista = await sistema.obtenerUsuarios("admin@test.es");
  assert.equal(lista.length, 2);
  const pepe = lista.find((u) => u.email === "pepe@test.es");
  assert.equal(pepe.rol, "usuario");
  assert.equal(pepe.estado, "pendiente");
  assert.equal(lista.find((u) => u.email === "admin@test.es").estado, "activo");
  assert.ok(lista.every((u) => u.hash === undefined));
});

test("[error] un usuario normal no puede listar usuarios", async () => {
  await registrar("pepe@test.es");
  await esperarError(sistema.obtenerUsuarios("pepe@test.es"), "NO_AUTORIZADO");
});

test("[error] un usuario normal no puede consultar si otro está activo", async () => {
  await registrar("pepe@test.es");
  await esperarError(sistema.usuarioActivo("pepe@test.es", "admin@test.es"), "NO_AUTORIZADO");
});

test("[error] un usuario normal no puede eliminar a otro usuario", async () => {
  await registrar("pepe@test.es");
  await registrar("luis@test.es");
  await esperarError(sistema.eliminarUsuario("pepe@test.es", "luis@test.es"), "NO_AUTORIZADO");
  assert.ok(await cad.buscarUsuario("luis@test.es"), "luis debe seguir existiendo");
});

test("un usuario normal puede eliminar su propia cuenta", async () => {
  await registrar("pepe@test.es");
  await sistema.eliminarUsuario("pepe@test.es", "pepe@test.es");
  assert.equal(await cad.buscarUsuario("pepe@test.es"), undefined);
});

test("el administrador puede eliminar a cualquier usuario y deja de estar activo", async () => {
  await registrar("pepe@test.es");
  await sistema.confirmarUsuario("pepe@test.es");
  await sistema.eliminarUsuario("admin@test.es", "pepe@test.es");
  assert.equal(await sistema.usuarioActivo("admin@test.es", "pepe@test.es"), false);
});

test("[error] eliminar un usuario que no existe se rechaza", async () => {
  await esperarError(sistema.eliminarUsuario("admin@test.es", "nadie@test.es"), "NO_ENCONTRADO");
});

test("[error] un solicitante desconocido no puede hacer nada", async () => {
  await esperarError(sistema.obtenerUsuarios("fantasma@test.es"), "NO_AUTENTICADO");
  await esperarError(sistema.eliminarUsuario(undefined, "admin@test.es"), "NO_AUTENTICADO");
  await esperarError(sistema.perfil("fantasma@test.es"), "NO_AUTENTICADO");
});

test("[error] un usuario eliminado ya no puede actuar (su sesión dejaría de servir)", async () => {
  await registrar("pepe@test.es");
  await sistema.eliminarUsuario("pepe@test.es", "pepe@test.es");
  await esperarError(sistema.perfil("pepe@test.es"), "NO_AUTENTICADO");
  await esperarError(sistema.eliminarUsuario("pepe@test.es", "pepe@test.es"), "NO_AUTENTICADO");
});
