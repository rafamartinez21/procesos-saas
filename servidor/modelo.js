// CAPA DE LÓGICA DE NEGOCIO
// Aquí viven las reglas de gestión de usuarios. Esta capa NO sabe nada de HTTP
// (no hay request/response, ni cookies) ni de cómo se guardan los datos: recibe un
// objeto "cad" (capa de acceso a datos) con una interfaz fija y lo usa.
// Así, en el hito 3 se sustituye el CAD en memoria por uno de base de datos
// sin tocar este archivo.

const { hashContrasena, verificarContrasena } = require("./contrasenas.js");

const ROL_USUARIO = "usuario";
const ROL_ADMIN = "admin";
const LONGITUD_MINIMA_CONTRASENA = 8;

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

// Lo que se devuelve hacia fuera de cada usuario. NUNCA incluye el hash de la contraseña.
function vistaUsuario(u) {
  return {
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    estado: u.confirmada ? "activo" : "pendiente",
  };
}

// opciones.autoConfirmar: SOLO PROVISIONAL (hitos 2 y 3). Mientras no exista la
// confirmación por correo (hito 4), permite que los usuarios nuevos queden confirmados
// al registrarse para poder probar el inicio de sesión. Se elimina en el hito 4.
function Sistema(cad, opciones = {}) {
  this.cad = cad;
  this.autoConfirmar = Boolean(opciones.autoConfirmar);
  this._hashFalso = null;

  // Resuelve quién hace la petición a partir de su email.
  // El ROL se lee siempre de los datos guardados, nunca de lo que diga el cliente.
  // Si el usuario fue eliminado, deja de existir aquí y cualquier sesión suya deja de servir.
  this._resolverActor = async function (emailActor) {
    const email = normalizarEmail(emailActor);
    const actor = email ? await this.cad.buscarUsuario(email) : undefined;
    if (!actor) {
      throw new ErrorNegocio("NO_AUTENTICADO", "Debes iniciar sesión");
    }
    return actor;
  };

  // Alta de usuario local. Queda pendiente hasta confirmar la cuenta.
  this.registrarUsuario = async function ({ email, nombre, password } = {}) {
    const emailNorm = normalizarEmail(email);
    if (!EMAIL_REGEX.test(emailNorm)) {
      throw new ErrorNegocio("EMAIL_INVALIDO", "El email no tiene un formato válido");
    }
    if (typeof password !== "string" || password.length < LONGITUD_MINIMA_CONTRASENA) {
      throw new ErrorNegocio(
        "CONTRASENA_DEBIL",
        `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`
      );
    }
    if (await this.cad.buscarUsuario(emailNorm)) {
      throw new ErrorNegocio("EMAIL_EN_USO", "Ya existe un usuario con ese email");
    }
    const nuevo = {
      email: emailNorm,
      nombre: typeof nombre === "string" ? nombre.trim() : "",
      rol: ROL_USUARIO,
      confirmada: this.autoConfirmar,
      hash: await hashContrasena(password),
    };
    // Entre la comprobación de arriba y esta inserción pueden entrar otras peticiones
    // (el hash tarda). Por eso el CAD también protege contra duplicados y aquí se traduce.
    try {
      await this.cad.insertarUsuario(nuevo);
    } catch (err) {
      if (err && err.codigo === "DUPLICADO") {
        throw new ErrorNegocio("EMAIL_EN_USO", "Ya existe un usuario con ese email");
      }
      throw err;
    }
    return vistaUsuario(nuevo);
  };

  // Primer administrador: lo crea el arranque del servidor a partir de variables de
  // entorno (decisión de diseño: no hay endpoint para hacerse admin, así que nadie
  // puede autopromocionarse desde fuera). Es idempotente: si ya existe, no hace nada.
  this.crearAdministradorInicial = async function ({ email, password } = {}) {
    const emailNorm = normalizarEmail(email);
    if (!EMAIL_REGEX.test(emailNorm) || typeof password !== "string" || password.length < LONGITUD_MINIMA_CONTRASENA) {
      throw new ErrorNegocio("ADMIN_INVALIDO", "Email o contraseña del administrador inicial no válidos");
    }
    if (await this.cad.buscarUsuario(emailNorm)) {
      return false;
    }
    try {
      await this.cad.insertarUsuario({
        email: emailNorm,
        nombre: "Administrador",
        rol: ROL_ADMIN,
        confirmada: true,
        hash: await hashContrasena(password),
      });
    } catch (err) {
      if (err && err.codigo === "DUPLICADO") return false;
      throw err;
    }
    return true;
  };

  // Inicio de sesión local. Devuelve el usuario si las credenciales son correctas.
  // Mensaje deliberadamente igual para "no existe" y "contraseña incorrecta", para no
  // revelar qué emails están registrados. La cuenta pendiente solo se revela cuando la
  // contraseña es correcta.
  this.iniciarSesion = async function ({ email, password } = {}) {
    const usuario = await this.cad.buscarUsuario(normalizarEmail(email));
    // Si no existe se verifica contra un hash falso para que tarde lo mismo.
    if (!usuario && !this._hashFalso) {
      this._hashFalso = await hashContrasena("hash-falso-para-igualar-tiempos");
    }
    const correcta = await verificarContrasena(password, usuario ? usuario.hash : this._hashFalso);
    if (!usuario || !correcta) {
      throw new ErrorNegocio("CREDENCIALES_INVALIDAS", "Email o contraseña incorrectos");
    }
    if (!usuario.confirmada) {
      throw new ErrorNegocio("CUENTA_PENDIENTE", "Tu cuenta está pendiente de confirmar");
    }
    return vistaUsuario(usuario);
  };

  // Datos del usuario que hace la petición (para "mantener la sesión entre recargas").
  this.perfil = async function (emailActor) {
    return vistaUsuario(await this._resolverActor(emailActor));
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
