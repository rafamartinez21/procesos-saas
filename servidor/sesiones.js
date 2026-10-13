// SESIONES (pertenece a la capa API: es un asunto de HTTP/cookies, no de negocio)
//
// Cómo funciona la sesión:
//  1. Al iniciar sesión, el servidor genera un identificador aleatorio e impredecible
//     y guarda en memoria: identificador -> email del usuario.
//  2. Al navegador solo se le envía el identificador, en una cookie. La cookie no
//     contiene datos del usuario ni su rol.
//  3. En cada petición el navegador reenvía la cookie y el servidor busca el
//     identificador. Si existe y no ha caducado, sabe quién eres.
//  4. Cerrar sesión borra la entrada del servidor: aunque alguien conservara la
//     cookie, ya no vale.
// Como la sesión vive en el servidor, se mantiene al recargar la página (el navegador
// conserva la cookie). Esta versión guarda las sesiones en memoria (se pierden al
// reiniciar); sesiones-mongo.js tiene la MISMA interfaz y las guarda en la base de datos.
// Todos los métodos son async para que la API pueda usar cualquiera de las dos.

const crypto = require("node:crypto");

const NOMBRE_COOKIE = "sid";
const DURACION_POR_DEFECTO_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function generarId() {
  return crypto.randomBytes(32).toString("hex");
}

function Sesiones({ duracionMs = DURACION_POR_DEFECTO_MS, ahora = () => Date.now() } = {}) {
  this.duracionMs = duracionMs;
  this.ahora = ahora;
  this.sesiones = new Map(); // id -> { email, caduca }

  // Siempre se genera un identificador nuevo (evita la "fijación de sesión").
  this.crear = async function (email) {
    const id = generarId();
    this.sesiones.set(id, { email, caduca: this.ahora() + this.duracionMs });
    return id;
  };

  // Devuelve el email de la sesión, o undefined si no existe o ha caducado.
  this.obtener = async function (id) {
    const s = id ? this.sesiones.get(id) : undefined;
    if (!s) return undefined;
    if (s.caduca <= this.ahora()) {
      this.sesiones.delete(id);
      return undefined;
    }
    return s.email;
  };

  this.destruir = async function (id) {
    this.sesiones.delete(id);
  };

  // Para cuando se elimina un usuario: se cierran todas sus sesiones.
  this.destruirDeUsuario = async function (email) {
    for (const [id, s] of this.sesiones) {
      if (s.email === email) this.sesiones.delete(id);
    }
  };
}

// Extrae el valor de una cookie de la cabecera "Cookie".
function leerCookie(cabecera, nombre) {
  if (!cabecera) return undefined;
  for (const par of cabecera.split(";")) {
    const i = par.indexOf("=");
    if (i === -1) continue;
    if (par.slice(0, i).trim() === nombre) return par.slice(i + 1).trim();
  }
  return undefined;
}

// Construye la cabecera Set-Cookie.
//  HttpOnly: el JavaScript de la página no puede leerla (protege frente a XSS).
//  SameSite=Lax: el navegador no la envía en peticiones lanzadas desde otros sitios (protege frente a CSRF).
//  Secure: solo viaja por HTTPS (se activa cuando la conexión es segura).
function cookieDeSesion(id, { segura = false, duracionMs = DURACION_POR_DEFECTO_MS } = {}) {
  const partes = [`${NOMBRE_COOKIE}=${id}`, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${Math.floor(duracionMs / 1000)}`];
  if (segura) partes.push("Secure");
  return partes.join("; ");
}

// Cabecera para borrar la cookie en el navegador.
function cookieBorrada({ segura = false } = {}) {
  const partes = [`${NOMBRE_COOKIE}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (segura) partes.push("Secure");
  return partes.join("; ");
}

module.exports = { Sesiones, generarId, DURACION_POR_DEFECTO_MS, leerCookie, cookieDeSesion, cookieBorrada, NOMBRE_COOKIE };
