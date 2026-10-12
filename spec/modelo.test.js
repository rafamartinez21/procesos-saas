// Pruebas unitarias de la CAPA DE LÓGICA (servidor/modelo.js).
// Usan el CAD en memoria, así que no necesitan base de datos ni servidor web.
// Se ejecutan con: npm test

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Sistema, ROL_ADMIN } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");

let sistema;
let cad;

beforeEach(async () => {
  cad = new CadMemoria();
  sistema = new Sistema(cad);
  // El administrador se crea directamente en el CAD (decisión de diseño provisional
  // hasta el hito 3, donde se decidirá cómo se crea el primer administrador real).
  await cad.insertarUsuario({ email: "admin@test.es", nombre: "Admin", rol: ROL_ADMIN, confirmada: true });
});

// Comprueba que una promesa se rechaza con un ErrorNegocio con ese código.
async function esperarError(promesa, codigo) {
  await assert.rejects(promesa, (err) => {
    assert.equal(err.name, "ErrorNegocio");
    assert.equal(err.codigo, codigo);
    return true;
  });
}

test("registrar un usuario nuevo lo deja pendiente y con rol usuario", async () => {
  const u = await sistema.registrarUsuario({ email: "Pepe@Test.es ", nombre: "Pepe" });
  assert.deepEqual(u, { email: "pepe@test.es", nombre: "Pepe", rol: "usuario", estado: "pendiente" });
});

test("[error] registrar un email que ya existe se rechaza (sin distinguir mayúsculas)", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  await esperarError(sistema.registrarUsuario({ email: "PEPE@test.es" }), "EMAIL_EN_USO");
});

test("[error] registrar un email con formato inválido se rechaza", async () => {
  await esperarError(sistema.registrarUsuario({ email: "esto-no-es-un-email" }), "EMAIL_INVALIDO");
  await esperarError(sistema.registrarUsuario({}), "EMAIL_INVALIDO");
});

test("un usuario está activo solo cuando ha confirmado su cuenta", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  assert.equal(await sistema.usuarioActivo("admin@test.es", "pepe@test.es"), false);
  await sistema.confirmarUsuario("pepe@test.es");
  assert.equal(await sistema.usuarioActivo("admin@test.es", "pepe@test.es"), true);
});

test("un usuario que no existe no está activo", async () => {
  assert.equal(await sistema.usuarioActivo("admin@test.es", "nadie@test.es"), false);
});

test("el administrador lista usuarios con email, rol y estado", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  const lista = await sistema.obtenerUsuarios("admin@test.es");
  assert.equal(lista.length, 2);
  const pepe = lista.find((u) => u.email === "pepe@test.es");
  assert.equal(pepe.rol, "usuario");
  assert.equal(pepe.estado, "pendiente");
  assert.equal(lista.find((u) => u.email === "admin@test.es").estado, "activo");
});

test("[error] un usuario normal no puede listar usuarios", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  await esperarError(sistema.obtenerUsuarios("pepe@test.es"), "NO_AUTORIZADO");
});

test("[error] un usuario normal no puede consultar si otro está activo", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  await esperarError(sistema.usuarioActivo("pepe@test.es", "admin@test.es"), "NO_AUTORIZADO");
});

test("[error] un usuario normal no puede eliminar a otro usuario", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  await sistema.registrarUsuario({ email: "luis@test.es" });
  await esperarError(sistema.eliminarUsuario("pepe@test.es", "luis@test.es"), "NO_AUTORIZADO");
  assert.ok(await cad.buscarUsuario("luis@test.es"), "luis debe seguir existiendo");
});

test("un usuario normal puede eliminar su propia cuenta", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  await sistema.eliminarUsuario("pepe@test.es", "pepe@test.es");
  assert.equal(await cad.buscarUsuario("pepe@test.es"), undefined);
});

test("el administrador puede eliminar a cualquier usuario y deja de estar activo", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
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
});

test("[error] un usuario eliminado ya no puede actuar", async () => {
  await sistema.registrarUsuario({ email: "pepe@test.es" });
  await sistema.eliminarUsuario("pepe@test.es", "pepe@test.es");
  await esperarError(sistema.eliminarUsuario("pepe@test.es", "pepe@test.es"), "NO_AUTENTICADO");
});
