// CAPA API (presentación del backend)
// Traduce HTTP <-> llamadas a la lógica. No contiene reglas de negocio:
// lee la petición (cuerpo, cookie de sesión), llama a "sistema" y devuelve la respuesta.
// Las reglas de quién puede qué (roles) las aplica la lógica; aquí solo se exige que
// haya una sesión válida antes de llegar a ella.

const express = require("express");
const path = require("path");
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
  EMAIL_EN_USO: 409,
};

function crearApp(sistema, { sesiones = new Sesiones() } = {}) {
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
    req.emailSesion = sesiones.obtener(req.idSesion);
    next();
  });

  // Protege una ruta: rechaza con 401 las peticiones sin sesión válida.
  function exigirSesion(req, res, next) {
    if (!req.emailSesion) {
      return res.status(401).json({ error: "NO_AUTENTICADO", mensaje: "Debes iniciar sesión" });
    }
    next();
  }

  // Envuelve un manejador async para que cualquier error llegue al manejador de errores.
  const asincrono = (fn) => (req, res, next) => fn(req, res).catch(next);

  app.get("/api/salud", (req, res) => {
    res.json({ ok: true });
  });

  // ---------- Públicas ----------

  // Registro de usuario
  app.post("/api/usuarios", asincrono(async (req, res) => {
    const usuario = await sistema.registrarUsuario(req.body);
    res.status(201).json(usuario);
  }));

  // Iniciar sesión
  app.post("/api/sesion", asincrono(async (req, res) => {
    const usuario = await sistema.iniciarSesion(req.body);
    // Se cierra cualquier sesión anterior de este navegador y se crea una nueva.
    sesiones.destruir(req.idSesion);
    const id = sesiones.crear(usuario.email);
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
        sesiones.destruir(req.idSesion);
        res.setHeader("Set-Cookie", cookieBorrada({ segura: req.secure }));
      }
      throw err;
    }
  }));

  // Cerrar sesión: se invalida en el servidor y se borra la cookie.
  app.delete("/api/sesion", exigirSesion, (req, res) => {
    sesiones.destruir(req.idSesion);
    res.setHeader("Set-Cookie", cookieBorrada({ segura: req.secure }));
    res.status(204).end();
  });

  app.get("/api/usuarios", exigirSesion, asincrono(async (req, res) => {
    res.json(await sistema.obtenerUsuarios(req.emailSesion));
  }));

  app.get("/api/usuarios/:email/activo", exigirSesion, asincrono(async (req, res) => {
    const activo = await sistema.usuarioActivo(req.emailSesion, req.params.email);
    res.json({ email: req.params.email, activo });
  }));

  app.delete("/api/usuarios/:email", exigirSesion, asincrono(async (req, res) => {
    await sistema.eliminarUsuario(req.emailSesion, req.params.email);
    // Un usuario eliminado no puede seguir usando sus sesiones.
    sesiones.destruirDeUsuario(req.params.email.trim().toLowerCase());
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
      return res.status(ESTADO_HTTP[err.codigo] || 400).json({ error: err.codigo, mensaje: err.message });
    }
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "JSON_INVALIDO", mensaje: "El cuerpo de la petición no es JSON válido" });
    }
    console.error("Error inesperado:", err);
    res.status(500).json({ error: "ERROR_INTERNO", mensaje: "Ha ocurrido un error inesperado" });
  });

  return app;
}

module.exports = { crearApp };
