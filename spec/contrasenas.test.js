// Pruebas del hash de contraseñas (servidor/contrasenas.js)

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashContrasena, verificarContrasena } = require("../servidor/contrasenas.js");

test("el hash no contiene la contraseña en claro", async () => {
  const hash = await hashContrasena("MiClaveSecreta1");
  assert.ok(!hash.includes("MiClaveSecreta1"));
  assert.ok(hash.startsWith("scrypt$"));
});

test("la contraseña correcta se verifica", async () => {
  const hash = await hashContrasena("MiClaveSecreta1");
  assert.equal(await verificarContrasena("MiClaveSecreta1", hash), true);
});

test("[error] una contraseña incorrecta no se verifica", async () => {
  const hash = await hashContrasena("MiClaveSecreta1");
  assert.equal(await verificarContrasena("otraClave", hash), false);
});

test("la misma contraseña genera hashes distintos (sal aleatoria)", async () => {
  const a = await hashContrasena("MiClaveSecreta1");
  const b = await hashContrasena("MiClaveSecreta1");
  assert.notEqual(a, b);
});

test("[error] un hash mal formado o valores inválidos no se verifican", async () => {
  assert.equal(await verificarContrasena("x", "esto-no-es-un-hash"), false);
  assert.equal(await verificarContrasena("x", undefined), false);
  assert.equal(await verificarContrasena(undefined, "scrypt$aa$bb"), false);
});
