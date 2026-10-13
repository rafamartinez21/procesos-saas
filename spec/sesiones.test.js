// Pruebas del módulo de sesiones. Las mismas pruebas se ejecutan contra las sesiones
// en memoria (sesiones.js) y contra las de MongoDB (sesiones-mongo.js), esta última
// con un MongoDB temporal (mongodb-memory-server), sin conectarse a Atlas.

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { MongoClient } = require("mongodb");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { Sesiones, leerCookie, cookieDeSesion, cookieBorrada } = require("../servidor/sesiones.js");
const { SesionesMongo } = require("../servidor/sesiones-mongo.js");

// "crearSesiones(opciones)" devuelve un almacén de sesiones vacío.
function pruebasDeSesiones(crearSesiones) {
  test("una sesión creada permite recuperar al usuario", async () => {
    const s = await crearSesiones();
    const id = await s.crear("pepe@test.es");
    assert.equal(await s.obtener(id), "pepe@test.es");
  });

  test("cada sesión tiene un identificador distinto y largo", async () => {
    const s = await crearSesiones();
    const a = await s.crear("pepe@test.es");
    const b = await s.crear("pepe@test.es");
    assert.notEqual(a, b);
    assert.ok(a.length >= 64);
  });

  test("[error] un identificador desconocido o vacío no da sesión", async () => {
    const s = await crearSesiones();
    assert.equal(await s.obtener("inventado"), undefined);
    assert.equal(await s.obtener(undefined), undefined);
  });

  test("cerrar sesión invalida el identificador", async () => {
    const s = await crearSesiones();
    const id = await s.crear("pepe@test.es");
    await s.destruir(id);
    assert.equal(await s.obtener(id), undefined);
  });

  test("[error] una sesión caducada deja de valer", async () => {
    let ahora = 1000;
    const s = await crearSesiones({ duracionMs: 500, ahora: () => ahora });
    const id = await s.crear("pepe@test.es");
    assert.equal(await s.obtener(id), "pepe@test.es");
    ahora = 1600;
    assert.equal(await s.obtener(id), undefined);
  });

  test("destruirDeUsuario cierra todas las sesiones de ese usuario y solo las suyas", async () => {
    const s = await crearSesiones();
    const a1 = await s.crear("pepe@test.es");
    const a2 = await s.crear("pepe@test.es");
    const b = await s.crear("luis@test.es");
    await s.destruirDeUsuario("pepe@test.es");
    assert.equal(await s.obtener(a1), undefined);
    assert.equal(await s.obtener(a2), undefined);
    assert.equal(await s.obtener(b), "luis@test.es");
  });
}

describe("Sesiones en memoria", () => {
  pruebasDeSesiones(async (opciones) => new Sesiones(opciones));
});

describe("Sesiones en MongoDB", () => {
  let servidorMongo;
  let cliente;
  let coleccion;

  before(async () => {
    servidorMongo = await MongoMemoryServer.create();
    cliente = new MongoClient(servidorMongo.getUri());
    await cliente.connect();
    coleccion = cliente.db("pruebas").collection("sesiones");
  });

  after(async () => {
    await cliente.close();
    await servidorMongo.stop();
  });

  pruebasDeSesiones(async (opciones) => {
    await coleccion.deleteMany({});
    const s = new SesionesMongo(coleccion, opciones);
    await s.prepararIndices();
    return s;
  });

  test("una sesión sigue valiendo con otra instancia (como tras un reinicio)", async () => {
    await coleccion.deleteMany({});
    const id = await new SesionesMongo(coleccion).crear("pepe@test.es");
    assert.equal(await new SesionesMongo(coleccion).obtener(id), "pepe@test.es");
  });
});

test("leerCookie extrae el valor correcto entre varias cookies", () => {
  assert.equal(leerCookie("a=1; sid=abc123; b=2", "sid"), "abc123");
  assert.equal(leerCookie("a=1", "sid"), undefined);
  assert.equal(leerCookie(undefined, "sid"), undefined);
});

test("la cookie de sesión es HttpOnly y SameSite, y Secure solo si se pide", () => {
  const normal = cookieDeSesion("abc");
  assert.match(normal, /HttpOnly/);
  assert.match(normal, /SameSite=Lax/);
  assert.doesNotMatch(normal, /Secure/);
  assert.match(cookieDeSesion("abc", { segura: true }), /Secure/);
});

test("la cookie borrada expira de inmediato", () => {
  assert.match(cookieBorrada(), /Max-Age=0/);
});
