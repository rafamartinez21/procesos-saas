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
  // AUTO_CONFIRMAR=true: PROVISIONAL hasta el hito 4 (confirmación por correo).
  const sistema = new Sistema(cad, { autoConfirmar: process.env.AUTO_CONFIRMAR === "true" });

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

  const app = crearApp(sistema, { sesiones, registro });
  app.listen(PORT, () => {
    registro.info("servidor arrancado", { puerto: Number(PORT) });
  });
}

main().catch((err) => {
  registro.error("no se pudo arrancar", { error: String(err && err.stack || err) });
  process.exit(1);
});
