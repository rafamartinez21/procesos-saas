// CAPA API (presentación del backend)
// Traduce HTTP <-> llamadas a la lógica. No contiene reglas de negocio:
// lee la petición (cuerpo, cookie de sesión), llama a "sistema" y devuelve la respuesta.
// Las reglas de quién puede qué (roles) las aplica la lógica; aquí solo se exige que
// haya una sesión válida antes de llegar a ella.

const express = require("express");
const path = require("path");
const { crearRegistro } = require("./registro.js");
const { Sesiones, leerCookie, cookieDeSesion, cookieBorrada, NOMBRE_COOKIE } = require("./sesiones.js");

// Cada código de error de negocio se traduce a un estado HTTP.
const ESTADO_HTTP = {
  EMAIL_INVALIDO: 400,
  CONTRASENA_DEBIL: 400,
  NO_AUTENTICADO: 401,
  CREDENCIALES_INVALIDAS: 401,
  NO_AUTORIZADO: 403,
  CUENTA_PENDIENTE: 403,
  NO_ENCONTRADO: 404,
  TOKEN_INVALIDO: 400,
  EMAIL_EN_USO: 409,
};

// urlPublica: URL base del sitio para construir el enlace de confirmación. Si no se da, se
// deduce de la petición (suficiente en local; en producción conviene fijarla).
function crearApp(sistema, { sesiones = new Sesiones(), registro = crearRegistro(), urlPublica } = {}) {
  const app = express();

  // Cloud Run está detrás de un proxy que termina el HTTPS. Con esto, req.secure es
  // true en producción y la cookie se marca como Secure.
  app.set("trust proxy", 1);
  app.use(express.json());

  // El backend sirve el frontend (mismo origen).
  app.use(express.static(path.join(__dirname, "..", "cliente")));

  // Lee la cookie de sesión y deja en req.idSesion / req.emailSesion quién es (si hay sesión válida).
  app.use((req, res, next) => {
    req.idSesion = leerCookie(req.get("cookie"), NOMBRE_COOKIE);
    sesiones.obtener(req.idSesion).then((email) => {
      req.emailSesion = email;
      next();
    }, next);
  });

  // Log de cada petición a la API cuando termina: método, ruta, estado HTTP, duración y
  // quién la hizo (si había sesión). Los ficheros estáticos no se registran.
  app.use("/api", (req, res, next) => {
    const inicio = Date.now();
    res.on("finish", () => {
      registro.info("peticion", {
        metodo: req.method,
        ruta: req.originalUrl,
        estado: res.statusCode,
        ms: Date.now() - inicio,
        usuario: req.emailSesion,
      });
    });
    next();
  });

  // Protege una ruta: rechaza con 401 las peticiones sin sesión válida.
  function exigirSesion(req, res, next) {
    if (!req.emailSesion) {
      registro.aviso("peticion sin sesion", { metodo: req.method, ruta: req.originalUrl });
      return res.status(401).json({ error: "NO_AUTENTICADO", mensaje: "Debes iniciar sesión" });
    }
    next();
  }

  // Envuelve un manejador async para que cualquier error llegue al manejador de errores.
  const asincrono = (fn) => (req, res, next) => fn(req, res).catch(next);

  app.get("/api/salud", (req, res) => {
    res.json({ ok: true });
  });

  // Normalización y validación de email. Pública (no requiere sesión).
  // Solo lee la petición, llama a la lógica y devuelve la respuesta.
  app.post("/api/prueba/email", (req, res) => {
    try {
      res.json({ email: sistema.validarEmail(req.body && req.body.email) });
    } catch (err) {
      if (err && err.codigo === "EMAIL_INVALIDO") {
        return res.status(400).json({ error: "EMAIL_INVALIDO" });
      }
      throw err;
    }
  });

  // ---------- Públicas ----------

  // Registro de usuario
  app.post("/api/usuarios", asincrono(async (req, res) => {
    const urlBase = urlPublica || `${req.protocol}://${req.get("host")}`;
    const usuario = await sistema.registrarUsuario(req.body, { urlBase });
    registro.info("usuario registrado", { email: usuario.email, estado: usuario.estado });
    res.status(201).json(usuario);
  }));

  // Confirmar cuenta: es el enlace que recibe el usuario, se abre desde el navegador (GET).
  // Siempre redirige a la aplicación con el resultado, para que la interfaz lo muestre.
  app.get("/api/confirmar", asincrono(async (req, res) => {
    try {
      const usuario = await sistema.confirmarConToken(req.query.token);
      registro.info("cuenta confirmada", { email: usuario.email });
      res.redirect(302, "/?confirmada=ok");
    } catch (err) {
      if (err && err.name === "ErrorNegocio") {
        registro.aviso("confirmacion rechazada", { codigo: err.codigo });
        return res.redirect(302, "/?confirmada=error");
      }
      throw err;
    }
  }));

  // Reenviar el correo de confirmación. Responde igual exista o no la cuenta, para no
  // revelar qué emails están registrados.
  app.post("/api/confirmacion", asincrono(async (req, res) => {
    const urlBase = urlPublica || `${req.protocol}://${req.get("host")}`;
    await sistema.reenviarConfirmacion(req.body && req.body.email, { urlBase });
    res.status(202).json({ mensaje: "Si la cuenta existe y está pendiente, te hemos enviado un nuevo enlace de confirmación." });
  }));

  // Iniciar sesión
  app.post("/api/sesion", asincrono(async (req, res) => {
    const usuario = await sistema.iniciarSesion(req.body);
    // Se cierra cualquier sesión anterior de este navegador y se crea una nueva.
    await sesiones.destruir(req.idSesion);
    const id = await sesiones.crear(usuario.email);
    registro.info("inicio de sesion", { email: usuario.email, rol: usuario.rol });
    res.setHeader("Set-Cookie", cookieDeSesion(id, { segura: req.secure, duracionMs: sesiones.duracionMs }));
    res.json(usuario);
  }));

  // ---------- Protegidas (requieren sesión) ----------

  // ¿Quién soy? El cliente lo consulta al cargar la página: así la sesión se mantiene al recargar.
  app.get("/api/sesion", exigirSesion, asincrono(async (req, res) => {
    try {
      res.json(await sistema.perfil(req.emailSesion));
    } catch (err) {
      // La sesión existía pero el usuario ya no (fue eliminado): se limpia.
      if (err && err.codigo === "NO_AUTENTICADO") {
        await sesiones.destruir(req.idSesion);
        res.setHeader("Set-Cookie", cookieBorrada({ segura: req.secure }));
      }
      throw err;
    }
  }));

  // Cerrar sesión: se invalida en el servidor y se borra la cookie.
  app.delete("/api/sesion", exigirSesion, asincrono(async (req, res) => {
    await sesiones.destruir(req.idSesion);
    registro.info("cierre de sesion", { email: req.emailSesion });
    res.setHeader("Set-Cookie", cookieBorrada({ segura: req.secure }));
    res.status(204).end();
  }));

  app.get("/api/usuarios", exigirSesion, asincrono(async (req, res) => {
    res.json(await sistema.obtenerUsuarios(req.emailSesion));
  }));

  app.get("/api/usuarios/:email/activo", exigirSesion, asincrono(async (req, res) => {
    const activo = await sistema.usuarioActivo(req.emailSesion, req.params.email);
    res.json({ email: req.params.email, activo });
  }));

  app.delete("/api/usuarios/:email", exigirSesion, asincrono(async (req, res) => {
    await sistema.eliminarUsuario(req.emailSesion, req.params.email);
    registro.info("usuario eliminado", { email: req.params.email.trim().toLowerCase(), por: req.emailSesion });
    // Un usuario eliminado no puede seguir usando sus sesiones.
    await sesiones.destruirDeUsuario(req.params.email.trim().toLowerCase());
    if (req.emailSesion === req.params.email.trim().toLowerCase()) {
      res.setHeader("Set-Cookie", cookieBorrada({ segura: req.secure }));
    }
    res.status(204).end();
  }));

  // Ruta de API desconocida
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "RUTA_NO_ENCONTRADA", mensaje: "Esa ruta no existe" });
  });

  // Manejador de errores: errores de negocio -> HTTP con mensaje claro; el resto -> 500.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.name === "ErrorNegocio") {
      // Rechazos esperados (login fallido, acceso denegado...): aviso, con quién y dónde.
      registro.aviso("peticion rechazada", {
        codigo: err.codigo,
        metodo: req.method,
        ruta: req.originalUrl,
        usuario: req.emailSesion,
        email: req.body && typeof req.body.email === "string" ? req.body.email : undefined,
      });
      return res.status(ESTADO_HTTP[err.codigo] || 400).json({ error: err.codigo, mensaje: err.message });
    }
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "JSON_INVALIDO", mensaje: "El cuerpo de la petición no es JSON válido" });
    }
    registro.error("error inesperado", { metodo: req.method, ruta: req.originalUrl, error: String(err && err.stack || err) });
    res.status(500).json({ error: "ERROR_INTERNO", mensaje: "Ha ocurrido un error inesperado" });
  });

  return app;
}

module.exports = { crearApp };
