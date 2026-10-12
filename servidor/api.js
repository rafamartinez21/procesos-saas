// CAPA API (presentación del backend)
// Traduce HTTP <-> llamadas a la lógica. No contiene reglas de negocio:
// solo lee la petición, llama a "sistema" y devuelve la respuesta.

const express = require("express");
const path = require("path");

// Cada código de error de negocio se traduce a un estado HTTP.
const ESTADO_HTTP = {
  EMAIL_INVALIDO: 400,
  NO_AUTENTICADO: 401,
  NO_AUTORIZADO: 403,
  NO_ENCONTRADO: 404,
  EMAIL_EN_USO: 409,
};

function crearApp(sistema) {
  const app = express();
  app.use(express.json());

  // El backend sirve el frontend (mismo origen).
  app.use(express.static(path.join(__dirname, "..", "cliente")));

  // PROVISIONAL (hito 1): todavía no hay sesiones, así que quién hace la petición
  // se indica en la cabecera X-Actor-Email. Es solo andamiaje: cualquiera podría
  // escribir el email de un administrador. En el hito 2 se sustituye por la
  // identidad de la sesión (y esta función es el ÚNICO sitio que hay que cambiar).
  function actorDeLaPeticion(req) {
    return req.get("x-actor-email");
  }

  // Envuelve un manejador async para que cualquier error llegue al manejador de errores.
  const asincrono = (fn) => (req, res, next) => fn(req, res).catch(next);

  app.get("/api/salud", (req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/usuarios", asincrono(async (req, res) => {
    const usuario = await sistema.registrarUsuario(req.body);
    res.status(201).json(usuario);
  }));

  app.get("/api/usuarios", asincrono(async (req, res) => {
    res.json(await sistema.obtenerUsuarios(actorDeLaPeticion(req)));
  }));

  app.get("/api/usuarios/:email/activo", asincrono(async (req, res) => {
    const activo = await sistema.usuarioActivo(actorDeLaPeticion(req), req.params.email);
    res.json({ email: req.params.email, activo });
  }));

  app.delete("/api/usuarios/:email", asincrono(async (req, res) => {
    await sistema.eliminarUsuario(actorDeLaPeticion(req), req.params.email);
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
