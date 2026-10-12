// PUNTO DE ENTRADA: ensambla las capas y arranca el servidor.
//   CAD (datos)  ->  Sistema (lógica)  ->  API (HTTP)
// Es el único sitio donde se decide qué implementación de CAD se usa.

const { CadMemoria } = require("./servidor/cad-memoria.js");
const { Sistema } = require("./servidor/modelo.js");
const { crearApp } = require("./servidor/api.js");

const PORT = process.env.PORT || 3000;

const cad = new CadMemoria();
const sistema = new Sistema(cad);
const app = crearApp(sistema);

app.listen(PORT, () => {
  console.log(`App escuchando en el puerto ${PORT}`);
});
