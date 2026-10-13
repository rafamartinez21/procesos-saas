// Pruebas de la CAPA DE ACCESO A DATOS.
// Las MISMAS pruebas se ejecutan contra los dos CAD (memoria y MongoDB): así se
// comprueba que cumplen la misma interfaz y que la lógica puede usar cualquiera.
// MongoDB se prueba con mongodb-memory-server, un MongoDB temporal que se arranca
// en local durante la prueba: las pruebas no se conectan nunca a la base de datos
// de producción (Atlas) ni necesitan secretos.

const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { CadMemoria } = require("../servidor/cad-memoria.js");
const { CadMongo } = require("../servidor/cad-mongo.js");
const { Sistema } = require("../servidor/modelo.js");

const usuario = (email, extra = {}) => ({
  email,
  nombre: "Pepe",
  rol: "usuario",
  confirmada: false,
  hash: "hash-de-prueba",
  ...extra,
});

// Define las pruebas comunes. "crearCad" devuelve un CAD vacío listo para usar.
function pruebasDeContrato(crearCad) {
  let cad;
  beforeEach(async () => {
    cad = await crearCad();
  });

  test("insertar y buscar devuelve el mismo usuario", async () => {
    await cad.insertarUsuario(usuario("pepe@test.es"));
    assert.deepEqual(await cad.buscarUsuario("pepe@test.es"), usuario("pepe@test.es"));
  });

  test("[error] insertar un email repetido lanza DUPLICADO", async () => {
    await cad.insertarUsuario(usuario("pepe@test.es"));
    await assert.rejects(cad.insertarUsuario(usuario("pepe@test.es")), { codigo: "DUPLICADO" });
  });

  test("buscar un email que no existe devuelve undefined", async () => {
    assert.equal(await cad.buscarUsuario("nadie@test.es"), undefined);
  });

  test("listar devuelve todos los usuarios", async () => {
    await cad.insertarUsuario(usuario("a@test.es"));
    await cad.insertarUsuario(usuario("b@test.es"));
    const emails = (await cad.listarUsuarios()).map((u) => u.email).sort();
    assert.deepEqual(emails, ["a@test.es", "b@test.es"]);
  });

  test("actualizar cambia los campos pero nunca el email", async () => {
    await cad.insertarUsuario(usuario("pepe@test.es"));
    const r = await cad.actualizarUsuario("pepe@test.es", { confirmada: true, email: "otro@test.es" });
    assert.equal(r.email, "pepe@test.es");
    assert.equal(r.confirmada, true);
    assert.equal((await cad.buscarUsuario("pepe@test.es")).confirmada, true);
    assert.equal(await cad.buscarUsuario("otro@test.es"), undefined);
  });

  test("actualizar un usuario que no existe devuelve undefined", async () => {
    assert.equal(await cad.actualizarUsuario("nadie@test.es", { confirmada: true }), undefined);
  });

  test("eliminar devuelve true si existía y false si no", async () => {
    await cad.insertarUsuario(usuario("pepe@test.es"));
    assert.equal(await cad.eliminarUsuario("pepe@test.es"), true);
    assert.equal(await cad.buscarUsuario("pepe@test.es"), undefined);
    assert.equal(await cad.eliminarUsuario("pepe@test.es"), false);
  });

  test("buscarUsuarioPorToken encuentra al usuario por el hash de su token", async () => {
    await cad.insertarUsuario(usuario("pepe@test.es", { tokenConfirmacion: "hash-token-1", tokenCaduca: 123 }));
    await cad.insertarUsuario(usuario("otro@test.es", { tokenConfirmacion: "hash-token-2", tokenCaduca: 123 }));
    assert.equal((await cad.buscarUsuarioPorToken("hash-token-1")).email, "pepe@test.es");
    assert.equal(await cad.buscarUsuarioPorToken("no-existe"), undefined);
    assert.equal(await cad.buscarUsuarioPorToken(null), undefined);
  });

  test("al borrar el token con actualizarUsuario deja de encontrarse", async () => {
    await cad.insertarUsuario(usuario("pepe@test.es", { tokenConfirmacion: "hash-token-1", tokenCaduca: 123 }));
    await cad.actualizarUsuario("pepe@test.es", { confirmada: true, tokenConfirmacion: null, tokenCaduca: null });
    assert.equal(await cad.buscarUsuarioPorToken("hash-token-1"), undefined);
  });

  test("modificar el objeto devuelto no cambia lo guardado", async () => {
    await cad.insertarUsuario(usuario("pepe@test.es"));
    const u = await cad.buscarUsuario("pepe@test.es");
    u.rol = "admin";
    assert.equal((await cad.buscarUsuario("pepe@test.es")).rol, "usuario");
  });

  test("la lógica funciona sin cambios sobre este CAD", async () => {
    const sistema = new Sistema(cad, { autoConfirmar: true });
    await sistema.registrarUsuario({ email: "pepe@test.es", password: "claveSegura1" });
    const u = await sistema.iniciarSesion({ email: "pepe@test.es", password: "claveSegura1" });
    assert.equal(u.estado, "activo");
  });
}

describe("CAD en memoria", () => {
  pruebasDeContrato(async () => new CadMemoria());
});

describe("CAD MongoDB", () => {
  let servidorMongo;
  let cad;

  before(async () => {
    servidorMongo = await MongoMemoryServer.create();
    cad = new CadMongo(servidorMongo.getUri(), { nombreBD: "pruebas" });
    await cad.conectar();
  });

  after(async () => {
    await cad.cerrar();
    await servidorMongo.stop();
  });

  // Antes de cada prueba se vacía la colección (el índice único se mantiene).
  pruebasDeContrato(async () => {
    await cad.usuarios.deleteMany({});
    return cad;
  });

  test("los datos sobreviven a cerrar y volver a conectar (como un reinicio)", async () => {
    await cad.usuarios.deleteMany({});
    await cad.insertarUsuario(usuario("pepe@test.es"));
    const otro = new CadMongo(servidorMongo.getUri(), { nombreBD: "pruebas" });
    await otro.conectar();
    try {
      assert.equal((await otro.buscarUsuario("pepe@test.es")).email, "pepe@test.es");
    } finally {
      await otro.cerrar();
    }
  });
});
