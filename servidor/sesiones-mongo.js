// SESIONES EN MONGODB (capa API, hito 3)
// Misma interfaz que Sesiones (sesiones.js), pero guardadas en la base de datos:
// así sobreviven a un reinicio o a un nuevo despliegue, y funcionan aunque Cloud Run
// arranque varias instancias del servidor a la vez.
//
// Cada sesión es un documento { id, email, caduca } en la colección que se recibe.
// Un índice TTL sobre "caduca" hace que MongoDB borre solo las sesiones caducadas;
// como ese borrado no es instantáneo, obtener() también comprueba la fecha.

const { generarId, DURACION_POR_DEFECTO_MS } = require("./sesiones.js");

function SesionesMongo(coleccion, { duracionMs = DURACION_POR_DEFECTO_MS, ahora = () => Date.now() } = {}) {
  this.coleccion = coleccion;
  this.duracionMs = duracionMs;
  this.ahora = ahora;

  this.prepararIndices = async function () {
    await this.coleccion.createIndex({ id: 1 }, { unique: true });
    await this.coleccion.createIndex({ email: 1 });
    await this.coleccion.createIndex({ caduca: 1 }, { expireAfterSeconds: 0 });
  };

  this.crear = async function (email) {
    const id = generarId();
    await this.coleccion.insertOne({ id, email, caduca: new Date(this.ahora() + this.duracionMs) });
    return id;
  };

  this.obtener = async function (id) {
    if (!id) return undefined;
    const s = await this.coleccion.findOne({ id });
    if (!s) return undefined;
    if (s.caduca.getTime() <= this.ahora()) {
      await this.coleccion.deleteOne({ id });
      return undefined;
    }
    return s.email;
  };

  this.destruir = async function (id) {
    if (id) await this.coleccion.deleteOne({ id });
  };

  this.destruirDeUsuario = async function (email) {
    await this.coleccion.deleteMany({ email });
  };
}

module.exports = { SesionesMongo };
