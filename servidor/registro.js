// REGISTRO (LOG) DE ACTIVIDAD
// Escribe una línea JSON por evento en la salida estándar. Cloud Run envía esa salida
// a Cloud Logging, que entiende los campos "severity" y "message": así cada evento se
// puede filtrar por nivel (INFO, WARNING, ERROR) y por sus datos (email, ruta...).
//
// Qué se registra: arranque, peticiones a la API, altas, inicios de sesión (correctos y
// fallidos), cierres de sesión, eliminaciones, accesos denegados y errores inesperados.
// Qué NO se registra nunca: contraseñas, hashes, cookies ni identificadores de sesión.

const CAMPOS_PROHIBIDOS = ["password", "hash", "cookie", "idSesion", "sid"];

function crearRegistro({ escribir = (linea) => console.log(linea), ahora = () => new Date() } = {}) {
  function registrar(severity, mensaje, datos = {}) {
    const limpio = {};
    for (const [clave, valor] of Object.entries(datos)) {
      if (!CAMPOS_PROHIBIDOS.includes(clave)) limpio[clave] = valor;
    }
    escribir(JSON.stringify({ severity, message: mensaje, time: ahora().toISOString(), ...limpio }));
  }
  return {
    info: (mensaje, datos) => registrar("INFO", mensaje, datos),
    aviso: (mensaje, datos) => registrar("WARNING", mensaje, datos),
    error: (mensaje, datos) => registrar("ERROR", mensaje, datos),
  };
}

// Para las pruebas: no escribe nada.
const registroSilencioso = crearRegistro({ escribir: () => {} });

module.exports = { crearRegistro, registroSilencioso };
