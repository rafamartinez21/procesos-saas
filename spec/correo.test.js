// Pruebas del envío de correo con Brevo (servidor/correo-brevo.js).
// Se usa un "fetch" falso: las pruebas nunca llaman a Brevo ni necesitan una clave real.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { crearCorreoBrevo, correoDeConfirmacion, URL_API_BREVO } = require("../servidor/correo-brevo.js");

function fetchFalso(respuesta = { ok: true, status: 201, text: async () => "" }) {
  const llamadas = [];
  const fetch = async (url, opciones) => {
    llamadas.push({ url, opciones, cuerpo: JSON.parse(opciones.body) });
    return respuesta;
  };
  return { fetch, llamadas };
}

test("envía el correo a la API de Brevo con la clave en la cabecera y el destinatario", async () => {
  const { fetch, llamadas } = fetchFalso();
  const correo = crearCorreoBrevo({ apiKey: "clave-de-prueba", remitente: "remitente@test.es", fetch });
  await correo.enviar({ para: "ana@test.es", asunto: "Hola", texto: "t", html: "<p>h</p>" });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, URL_API_BREVO);
  assert.equal(llamadas[0].opciones.method, "POST");
  assert.equal(llamadas[0].opciones.headers["api-key"], "clave-de-prueba");
  assert.deepEqual(llamadas[0].cuerpo.to, [{ email: "ana@test.es" }]);
  assert.equal(llamadas[0].cuerpo.sender.email, "remitente@test.es");
  assert.equal(llamadas[0].cuerpo.subject, "Hola");
});

test("[error] si Brevo responde con error, se lanza una excepción con el estado", async () => {
  const { fetch } = fetchFalso({ ok: false, status: 401, text: async () => "unauthorized" });
  const correo = crearCorreoBrevo({ apiKey: "mala", remitente: "r@test.es", fetch });
  await assert.rejects(correo.enviar({ para: "a@test.es", asunto: "x", texto: "x", html: "x" }), { estado: 401 });
});

test("[error] sin clave o sin remitente no se puede crear el servicio", () => {
  assert.throws(() => crearCorreoBrevo({ remitente: "r@test.es" }));
  assert.throws(() => crearCorreoBrevo({ apiKey: "k" }));
});

test("el correo de confirmación incluye el enlace en texto y en HTML", () => {
  const c = correoDeConfirmacion("https://app.test/api/confirmar?token=abc");
  assert.match(c.texto, /https:\/\/app\.test\/api\/confirmar\?token=abc/);
  assert.match(c.html, /href="https:\/\/app\.test\/api\/confirmar\?token=abc"/);
  assert.ok(c.asunto);
});
