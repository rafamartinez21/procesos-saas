// CAPA DE LÓGICA DE NEGOCIO
// Aquí viven las reglas de gestión de usuarios. Esta capa NO sabe nada de HTTP
// (no hay request/response, ni cookies) ni de cómo se guardan los datos: recibe un
// objeto "cad" (capa de acceso a datos) con una interfaz fija y lo usa.
// Así, en el hito 3 se sustituye el CAD en memoria por uno de base de datos
// sin tocar este archivo.

const crypto = require("node:crypto");
const { hashContrasena, verificarContrasena } = require("./contrasenas.js");

const ROL_USUARIO = "usuario";
const ROL_ADMIN = "admin";
const LONGITUD_MINIMA_CONTRASENA = 8;
const DURACION_TOKEN_POR_DEFECTO_MS = 24 * 60 * 60 * 1000; // 24 horas

// El token de confirmación solo viaja en el enlace; en la base de datos se guarda su hash,
// igual que las contraseñas: quien lea la base no puede confirmar cuentas ajenas.
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// Errores de negocio: llevan un "codigo" estable que la capa API traduce a HTTP.
class ErrorNegocio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = "ErrorNegocio";
    this.codigo = codigo;
  }
}


function normalizarEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Formato válido de un email YA normalizado:
//  - exactamente una "@", con al menos un carácter antes;
//  - sin espacios;
//  - el dominio (tras la "@") contiene al menos un punto y no empieza ni termina por punto.
function emailValido(normalizado) {
  const partes = normalizado.split("@");
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  return (
    local.length > 0 &&
    !/\s/.test(normalizado) &&
    dominio.includes(".") &&
    !dominio.startsWith(".") &&
    !dominio.endsWith(".")
  );
}

// Normaliza (quita los espacios del principio y del final y pasa a minúsculas) y valida el
// formato. Es lógica pura: no accede a la base de datos. Devuelve el email normalizado o
// lanza ErrorNegocio EMAIL_INVALIDO (también si no es un string).
function validarEmail(email) {
  const normalizado = typeof email === "string" ? normalizarEmail(email) : "";
  if (!emailValido(normalizado)) {
    throw new ErrorNegocio("EMAIL_INVALIDO", "El email no tiene un formato válido");
  }
  return normalizado;
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

// Opciones:
//  - enviarConfirmacion(email, token, contexto): cómo se hace llegar al usuario el token de
//    confirmación. La lógica no sabe si es un correo o una línea en el log: lo decide quien
//    ensambla las capas (index.js). Si no se da, no se envía nada.
//  - autoConfirmar: deja las cuentas nuevas ya confirmadas (útil en pruebas). En producción
//    no se usa: la cuenta queda pendiente hasta abrir el enlace de confirmación.
//  - ahora / duracionTokenMs: para poder probar la caducidad del enlace.
function Sistema(cad, opciones = {}) {
  this.cad = cad;
  this.autoConfirmar = Boolean(opciones.autoConfirmar);
  this.enviarConfirmacion = opciones.enviarConfirmacion || (async () => {});
  this.ahora = opciones.ahora || (() => Date.now());
  this.duracionTokenMs = opciones.duracionTokenMs || DURACION_TOKEN_POR_DEFECTO_MS;
  this._hashFalso = null;

  // Regla de normalización y validación de email (función de lógica, sin base de datos).
  this.validarEmail = validarEmail;

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
  // "contexto" (opcional) se pasa tal cual a enviarConfirmacion, p. ej. la URL base del sitio.
  this.registrarUsuario = async function ({ email, nombre, password } = {}, contexto = {}) {
    const emailNorm = validarEmail(email);
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
    let token;
    if (!nuevo.confirmada) {
      token = crypto.randomBytes(32).toString("hex");
      Object.assign(nuevo, this._datosToken(token));
    }
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
    if (token) await this.enviarConfirmacion(nuevo.email, token, contexto);
    return vistaUsuario(nuevo);
  };

  this._datosToken = function (token) {
    return { tokenConfirmacion: hashToken(token), tokenCaduca: this.ahora() + this.duracionTokenMs };
  };

  // Reenvía el enlace de confirmación con un token nuevo (el anterior deja de valer).
  // No revela si el email existe: si no hay una cuenta local pendiente, no hace nada.
  this.reenviarConfirmacion = async function (email, contexto = {}) {
    const emailNorm = normalizarEmail(email);
    const usuario = emailNorm ? await this.cad.buscarUsuario(emailNorm) : undefined;
    if (!usuario || usuario.confirmada || !usuario.hash) return;
    const token = crypto.randomBytes(32).toString("hex");
    await this.cad.actualizarUsuario(emailNorm, this._datosToken(token));
    await this.enviarConfirmacion(emailNorm, token, contexto);
  };

  // Confirma la cuenta a partir del token del enlace. El token es de un solo uso: al
  // confirmar se borra, y un enlace caducado o inventado se rechaza igual que uno ya usado.
  this.confirmarConToken = async function (token) {
    const usuario = typeof token === "string" && token ? await this.cad.buscarUsuarioPorToken(hashToken(token)) : undefined;
    if (!usuario || !usuario.tokenCaduca || usuario.tokenCaduca <= this.ahora()) {
      throw new ErrorNegocio("TOKEN_INVALIDO", "El enlace de confirmación no es válido, ha caducado o ya se usó");
    }
    await this.cad.actualizarUsuario(usuario.email, { confirmada: true, tokenConfirmacion: null, tokenCaduca: null });
    return vistaUsuario({ ...usuario, confirmada: true });
  };

  // Primer administrador: lo crea el arranque del servidor a partir de variables de
  // entorno (decisión de diseño: no hay endpoint para hacerse admin, así que nadie
  // puede autopromocionarse desde fuera). Es idempotente: si ya existe, no hace nada.
  this.crearAdministradorInicial = async function ({ email, password } = {}) {
    const emailNorm = normalizarEmail(email);
    if (!emailValido(emailNorm) || typeof password !== "string" || password.length < LONGITUD_MINIMA_CONTRASENA) {
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

  // Inicio de sesión con un proveedor externo (OAuth), D-17 y D-18. Recibe el perfil ya
  // obtenido del proveedor: la lógica no sabe nada de Google ni de HTTP.
  //  - Si no existe, crea la cuenta como "usuario" y ya confirmada (el proveedor verificó el email).
  //  - Si existe y se creó con ese proveedor, entra.
  //  - Si existe como cuenta local (con contraseña), se rechaza (D-18).
  this.iniciarSesionExterna = async function ({ email, nombre, proveedor, emailVerificado } = {}) {
    if (!emailVerificado) {
      throw new ErrorNegocio("EMAIL_NO_VERIFICADO", "El proveedor no ha verificado tu email");
    }
    const emailNorm = validarEmail(email);
    const existente = await this.cad.buscarUsuario(emailNorm);
    if (existente) {
      if (existente.proveedor === proveedor) return vistaUsuario(existente);
      throw new ErrorNegocio("CUENTA_LOCAL_EXISTENTE", "Ya existe una cuenta con ese email. Inicia sesión con tu contraseña.");
    }
    const nuevo = {
      email: emailNorm,
      nombre: typeof nombre === "string" ? nombre.trim() : "",
      rol: ROL_USUARIO,
      confirmada: true,
      proveedor,
    };
    try {
      await this.cad.insertarUsuario(nuevo);
    } catch (err) {
      // Si otra petición la creó a la vez, se vuelve a decidir con la cuenta ya guardada.
      if (err && err.codigo === "DUPLICADO") return this.iniciarSesionExterna({ email, nombre, proveedor, emailVerificado });
      throw err;
    }
    return vistaUsuario(nuevo);
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

module.exports = { Sistema, ErrorNegocio, validarEmail, ROL_USUARIO, ROL_ADMIN };
