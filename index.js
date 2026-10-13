// PUNTO DE ENTRADA: ensambla las capas y arranca el servidor.
//   CAD (datos)  ->  Sistema (lógica)  ->  API (HTTP)
// Es el único sitio donde se decide qué implementación de CAD se usa y se leen
// las variables de entorno.

const { CadMemoria } = require("./servidor/cad-memoria.js");
const { Sistema } = require("./servidor/modelo.js");
const { crearApp } = require("./servidor/api.js");

const PORT = process.env.PORT || 3000;

async function main() {
  const cad = new CadMemoria();
  // AUTO_CONFIRMAR=true: PROVISIONAL hasta el hito 4 (confirmación por correo).
  const sistema = new Sistema(cad, { autoConfirmar: process.env.AUTO_CONFIRMAR === "true" });

  // Primer administrador, a partir de variables de entorno (nunca en el código).
  // Con datos en memoria hay que recrearlo en cada arranque.
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await sistema.crearAdministradorInicial({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log("Administrador inicial preparado");
  } else {
    console.warn("ADMIN_EMAIL y ADMIN_PASSWORD no definidas: no hay administrador");
  }

  const app = crearApp(sistema);
  app.listen(PORT, () => {
    console.log(`App escuchando en el puerto ${PORT}`);
  });
}

main().catch((err) => {
  console.error("No se pudo arrancar:", err);
  process.exit(1);
});
