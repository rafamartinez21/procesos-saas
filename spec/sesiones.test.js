// Pruebas del módulo de sesiones (servidor/sesiones.js). No necesitan servidor web.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Sesiones, leerCookie, cookieDeSesion, cookieBorrada } = require("../servidor/sesiones.js");

test("una sesión creada permite recuperar al usuario", () => {
  const s = new Sesiones();
  const id = s.crear("pepe@test.es");
  assert.equal(s.obtener(id), "pepe@test.es");
});

test("cada sesión tiene un identificador distinto y largo", () => {
  const s = new Sesiones();
  const a = s.crear("pepe@test.es");
  const b = s.crear("pepe@test.es");
  assert.notEqual(a, b);
  assert.ok(a.length >= 64);
});

test("[error] un identificador desconocido o vacío no da sesión", () => {
  const s = new Sesiones();
  assert.equal(s.obtener("inventado"), undefined);
  assert.equal(s.obtener(undefined), undefined);
});

test("cerrar sesión invalida el identificador", () => {
  const s = new Sesiones();
  const id = s.crear("pepe@test.es");
  s.destruir(id);
  assert.equal(s.obtener(id), undefined);
});

test("[error] una sesión caducada deja de valer", () => {
  let ahora = 1000;
  const s = new Sesiones({ duracionMs: 500, ahora: () => ahora });
  const id = s.crear("pepe@test.es");
  assert.equal(s.obtener(id), "pepe@test.es");
  ahora = 1600;
  assert.equal(s.obtener(id), undefined);
});

test("destruirDeUsuario cierra todas las sesiones de ese usuario y solo las suyas", () => {
  const s = new Sesiones();
  const a1 = s.crear("pepe@test.es");
  const a2 = s.crear("pepe@test.es");
  const b = s.crear("luis@test.es");
  s.destruirDeUsuario("pepe@test.es");
  assert.equal(s.obtener(a1), undefined);
  assert.equal(s.obtener(a2), undefined);
  assert.equal(s.obtener(b), "luis@test.es");
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
