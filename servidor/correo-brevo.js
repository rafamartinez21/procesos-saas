// SERVICIO EXTERNO: envío de correo con la API transaccional de Brevo (D-16).
// No forma parte de la lógica: index.js lo crea con la clave (variable de entorno) y la
// lógica solo recibe la función enviarConfirmacion. Se usa la API HTTPS y no SMTP porque
// los proveedores cloud suelen bloquear el envío directo por SMTP.
// En las pruebas se pasa un "fetch" falso: nunca se llama a Brevo de verdad.

const URL_API_BREVO = "https://api.brevo.com/v3/smtp/email";

function crearCorreoBrevo({ apiKey, remitente, nombreRemitente = "Sistema", fetch = globalThis.fetch } = {}) {
  if (!apiKey || !remitente) {
    throw new Error("Faltan BREVO_API_KEY o CORREO_REMITENTE para enviar correo");
  }

  return {
    async enviar({ para, asunto, texto, html }) {
      const res = await fetch(URL_API_BREVO, {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: remitente, name: nombreRemitente },
          to: [{ email: para }],
          subject: asunto,
          textContent: texto,
          htmlContent: html,
        }),
      });
      if (!res.ok) {
        // El cuerpo de error de Brevo no contiene la clave; se guarda para el log.
        const detalle = await res.text().catch(() => "");
        throw Object.assign(new Error(`Brevo respondió ${res.status}`), { estado: res.status, detalle });
      }
    },
  };
}

// Contenido del correo de confirmación.
function correoDeConfirmacion(enlace) {
  return {
    asunto: "Confirma tu cuenta",
    texto: `Para activar tu cuenta abre este enlace (caduca en 24 horas): ${enlace}`,
    html: `<p>Para activar tu cuenta pulsa en el enlace (caduca en 24 horas):</p><p><a href="${enlace}">Confirmar mi cuenta</a></p><p>Si no has creado una cuenta, ignora este correo.</p>`,
  };
}

module.exports = { crearCorreoBrevo, correoDeConfirmacion, URL_API_BREVO };
