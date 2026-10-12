// CAPA DE LÓGICA DE NEGOCIO
// Aquí viven las reglas de gestión de usuarios. Esta capa NO sabe nada de HTTP
// (no hay request/response) ni de cómo se guardan los datos: recibe un objeto
// "cad" (capa de acceso a datos) con una interfaz fija y lo usa.
// Así, en el hito 3 se sustituye el CAD en memoria por uno de base de datos
// sin tocar este archivo.

const ROL_USUARIO = "usuario";
const ROL_ADMIN = "admin";

// Errores de negocio: llevan un "codigo" estable que la capa API traduce a HTTP.
class ErrorNegocio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = "ErrorNegocio";
    this.codigo = codigo;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Lo que se devuelve hacia fuera de cada usuario (nunca se filtra nada interno).
function vistaUsuario(u) {
  return {
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    estado: u.confirmada ? "activo" : "pendiente",
  };
}

function Sistema(cad) {
  this.cad = cad;

  // Resuelve quién hace la petición a partir de su email.
  // El ROL se lee siempre de los datos guardados, nunca de lo que diga el cliente.
  this._resolverActor = async function (emailActor) {
    const email = normalizarEmail(emailActor);
    const actor = email ? await this.cad.buscarUsuario(email) : undefined;
    if (!actor) {
      throw new ErrorNegocio("NO_AUTENTICADO", "Debes identificarte con un usuario válido");
    }
    return actor;
  };

  // Alta de usuario. Queda en estado pendiente hasta que se confirme la cuenta.
  this.registrarUsuario = async function ({ email, nombre } = {}) {
    const emailNorm = normalizarEmail(email);
    if (!EMAIL_REGEX.test(emailNorm)) {
      throw new ErrorNegocio("EMAIL_INVALIDO", "El email no tiene un formato válido");
    }
    if (await this.cad.buscarUsuario(emailNorm)) {
      throw new ErrorNegocio("EMAIL_EN_USO", "Ya existe un usuario con ese email");
    }
    const nuevo = {
      email: emailNorm,
      nombre: typeof nombre === "string" ? nombre.trim() : "",
      rol: ROL_USUARIO,
      confirmada: false,
    };
    await this.cad.insertarUsuario(nuevo);
    return vistaUsuario(nuevo);
  };

  // Marca la cuenta como confirmada (en el hito 4 se llamará al pulsar el enlace del correo).
  this.confirmarUsuario = async function (email) {
    const emailNorm = normalizarEmail(email);
    const usuario = await this.cad.buscarUsuario(emailNorm);
    if (!usuario) {
      throw new ErrorNegocio("NO_ENCONTRADO", "No existe ese usuario");
    }
    await this.cad.actualizarUsuario(emailNorm, { confirmada: true });
    return vistaUsuario({ ...usuario, confirmada: true });
  };

  // Listar usuarios: solo administrador.
  this.obtenerUsuarios = async function (emailActor) {
    const actor = await this._resolverActor(emailActor);
    if (actor.rol !== ROL_ADMIN) {
      throw new ErrorNegocio("NO_AUTORIZADO", "Solo el administrador puede listar usuarios");
    }
    const todos = await this.cad.listarUsuarios();
    return todos.map(vistaUsuario);
  };

  // ¿Está activo? Activo = cuenta confirmada y no eliminada. Solo administrador.
  // No significa "conectado ahora mismo".
  this.usuarioActivo = async function (emailActor, email) {
    const actor = await this._resolverActor(emailActor);
    if (actor.rol !== ROL_ADMIN) {
      throw new ErrorNegocio("NO_AUTORIZADO", "Solo el administrador puede consultar si un usuario está activo");
    }
    const usuario = await this.cad.buscarUsuario(normalizarEmail(email));
    return Boolean(usuario && usuario.confirmada);
  };

  // Eliminar: el administrador a cualquiera; un usuario normal solo a sí mismo.
  this.eliminarUsuario = async function (emailActor, email) {
    const actor = await this._resolverActor(emailActor);
    const objetivo = normalizarEmail(email);
    if (actor.rol !== ROL_ADMIN && actor.email !== objetivo) {
      throw new ErrorNegocio("NO_AUTORIZADO", "Solo puedes eliminar tu propia cuenta");
    }
    const eliminado = await this.cad.eliminarUsuario(objetivo);
    if (!eliminado) {
      throw new ErrorNegocio("NO_ENCONTRADO", "No existe ese usuario");
    }
  };
}

module.exports = { Sistema, ErrorNegocio, ROL_USUARIO, ROL_ADMIN };
