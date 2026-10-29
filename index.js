// PUNTO DE ENTRADA: ensambla las capas y arranca el servidor.
//   CAD (datos)  ->  Sistema (lógica)  ->  API (HTTP)
// Es el único sitio donde se decide qué implementación de CAD se usa y se leen
// las variables de entorno.

const { CadMemoria } = require("./servidor/cad-memoria.js");
const { CadMongo } = require("./servidor/cad-mongo.js");
const { Sistema } = require("./servidor/modelo.js");
const { crearApp } = require("./servidor/api.js");
const { Sesiones } = require("./servidor/sesiones.js");
const { SesionesMongo } = require("./servidor/sesiones-mongo.js");
const { crearRegistro } = require("./servidor/registro.js");
const { crearCorreoBrevo, correoDeConfirmacion } = require("./servidor/correo-brevo.js");

const PORT = process.env.PORT || 3000;

const registro = crearRegistro();

async function main() {
  // Con DATABASE_URL se usa MongoDB (los datos sobreviven a reinicios). Sin ella, memoria
  // (solo para desarrollo local rápido). La cadena de conexión NUNCA va en el código.
  // Las sesiones van a la misma base de datos, así sobreviven a reinicios y despliegues.
  let cad;
  let sesiones;
  if (process.env.DATABASE_URL) {
    cad = new CadMongo(process.env.DATABASE_URL);
    await cad.conectar();
    sesiones = new SesionesMongo(cad.bd.collection("sesiones"));
    await sesiones.prepararIndices();
    registro.info("conectado a la base de datos");
  } else {
    cad = new CadMemoria();
    sesiones = new Sesiones();
    registro.aviso("DATABASE_URL no definida: los datos se guardan en memoria y se pierden al reiniciar");
  }
  // Confirmación de cuenta: con BREVO_API_KEY y CORREO_REMITENTE el enlace se envía por
  // correo (D-16). Sin ellas (desarrollo local) se escribe en el log para poder probarlo.
  // La lógica solo recibe esta función: no sabe qué servicio se usa.
  const correo = process.env.BREVO_API_KEY && process.env.CORREO_REMITENTE
    ? crearCorreoBrevo({ apiKey: process.env.BREVO_API_KEY, remitente: process.env.CORREO_REMITENTE })
    : null;
  if (!correo) registro.aviso("BREVO_API_KEY o CORREO_REMITENTE no definidas: el enlace de confirmación se escribirá en el log");
  const enviarConfirmacion = async (email, token, contexto = {}) => {
    const base = process.env.URL_PUBLICA || contexto.urlBase || `http://localhost:${PORT}`;
    const enlace = `${base}/api/confirmar?token=${token}`;
    if (!correo) {
      registro.info("enlace de confirmacion", { email, enlace });
      return;
    }
    try {
      await correo.enviar({ para: email, ...correoDeConfirmacion(enlace) });
      registro.info("correo de confirmacion enviado", { email });
    } catch (err) {
      // El registro no falla por esto: el usuario puede pedir que se reenvíe el correo.
      registro.error("no se pudo enviar el correo de confirmacion", { email, error: err.message, detalle: err.detalle });
    }
  };
  const sistema = new Sistema(cad, { enviarConfirmacion });

  // Primer administrador, a partir de variables de entorno (nunca en el código).
  // Si ya existe en la base de datos, no se toca.
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await sistema.crearAdministradorInicial({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    registro.info("administrador inicial preparado", { email: process.env.ADMIN_EMAIL });
  } else {
    registro.aviso("ADMIN_EMAIL y ADMIN_PASSWORD no definidas: no hay administrador");
  }

  const app = crearApp(sistema, { sesiones, registro, urlPublica: process.env.URL_PUBLICA });
  app.listen(PORT, () => {
    registro.info("servidor arrancado", { puerto: Number(PORT) });
  });
}

main().catch((err) => {
  registro.error("no se pudo arrancar", { error: String(err && err.stack || err) });
  process.exit(1);
});
