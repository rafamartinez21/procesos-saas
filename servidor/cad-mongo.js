// CAPA DE ACCESO A DATOS (implementación con MongoDB, hito 3)
// Cumple EXACTAMENTE la misma interfaz que cad-memoria.js, por eso la lógica
// (modelo.js) no cambia al pasar de memoria a base de datos:
//   insertarUsuario(usuario)            -> usuario. Lanza un error con codigo "DUPLICADO"
//                                          si ya existe ese email (índice único).
//   buscarUsuario(email)                -> usuario | undefined
//   listarUsuarios()                    -> [usuario]
//   actualizarUsuario(email, cambios)   -> usuario | undefined
//   eliminarUsuario(email)              -> true si existía, false si no
//
// Además tiene conectar() y cerrar(), que solo usa quien ensambla las capas (index.js).
// La cadena de conexión llega por parámetro: este archivo no lee variables de entorno
// ni contiene secretos.

const { MongoClient } = require("mongodb");

const CODIGO_CLAVE_DUPLICADA = 11000; // error de MongoDB al violar un índice único

// Mongo añade su propio _id; hacia fuera se devuelven los mismos objetos que el CAD en memoria.
const SIN_ID = { projection: { _id: 0 } };

function CadMongo(url, { nombreBD = "sistema" } = {}) {
  this.url = url;
  this.nombreBD = nombreBD;
  this.cliente = null;
  this.usuarios = null;

  this.conectar = async function () {
    this.cliente = new MongoClient(this.url);
    await this.cliente.connect();
    this.bd = this.cliente.db(this.nombreBD);
    this.usuarios = this.bd.collection("usuarios");
    // El índice único es el que garantiza que no haya dos usuarios con el mismo email,
    // incluso si llegan dos registros a la vez.
    await this.usuarios.createIndex({ email: 1 }, { unique: true });
  };

  this.cerrar = async function () {
    if (this.cliente) await this.cliente.close();
  };

  this.insertarUsuario = async function (usuario) {
    try {
      // Se inserta una copia: insertOne añadiría _id al objeto recibido.
      await this.usuarios.insertOne({ ...usuario });
    } catch (err) {
      if (err && err.code === CODIGO_CLAVE_DUPLICADA) {
        throw Object.assign(new Error("Ya existe un usuario con ese email"), { codigo: "DUPLICADO" });
      }
      throw err;
    }
    return { ...usuario };
  };

  this.buscarUsuario = async function (email) {
    const u = await this.usuarios.findOne({ email }, SIN_ID);
    return u || undefined;
  };

  this.listarUsuarios = async function () {
    return this.usuarios.find({}, SIN_ID).toArray();
  };

  this.actualizarUsuario = async function (email, cambios) {
    // El email es la clave: no se permite cambiarlo (igual que en el CAD en memoria).
    const { email: _ignorado, ...resto } = cambios;
    const u = await this.usuarios.findOneAndUpdate(
      { email },
      { $set: resto },
      { returnDocument: "after", ...SIN_ID }
    );
    return u || undefined;
  };

  this.eliminarUsuario = async function (email) {
    const r = await this.usuarios.deleteOne({ email });
    return r.deletedCount === 1;
  };
}

module.exports = { CadMongo };
