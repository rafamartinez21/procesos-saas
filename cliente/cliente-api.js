// CLIENTE DE COMUNICACIÓN (frontend)
// Es la ÚNICA parte del frontend que habla con el servidor (usa fetch).
// La interfaz (interfaz.js) llama a estas funciones y no sabe nada de URLs,
// cabeceras ni cookies. Si mañana cambia la API, solo se toca este archivo.
//
// La cookie de sesión la gestiona el navegador solo (es HttpOnly: este código
// ni siquiera puede leerla), por eso aquí no hay ningún token.

// Error con estado HTTP y código estable, para que la interfaz decida qué mostrar.
export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
  }
}

async function peticion(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : {},
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    // fetch solo falla así cuando no hay conexión con el servidor
    throw new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor. Inténtalo de nuevo.");
  }

  const texto = await respuesta.text();
  let datos;
  try {
    datos = texto ? JSON.parse(texto) : undefined;
  } catch {
    datos = undefined;
  }

  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      (datos && datos.error) || "ERROR",
      (datos && datos.mensaje) || "Ha ocurrido un error inesperado."
    );
  }
  return datos;
}

export const ClienteApi = {
  registrar: (email, password, nombre) => peticion("POST", "/api/usuarios", { email, password, nombre }),
  iniciarSesion: (email, password) => peticion("POST", "/api/sesion", { email, password }),
  cerrarSesion: () => peticion("DELETE", "/api/sesion"),
  // Devuelve el usuario con sesión, o null si no hay sesión (no es un error: es el estado normal al entrar).
  sesionActual: async () => {
    try {
      return await peticion("GET", "/api/sesion");
    } catch (err) {
      if (err instanceof ErrorApi && err.estado === 401) return null;
      throw err;
    }
  },
  listarUsuarios: () => peticion("GET", "/api/usuarios"),
  usuarioActivo: async (email) => (await peticion("GET", `/api/usuarios/${encodeURIComponent(email)}/activo`)).activo,
  eliminarUsuario: (email) => peticion("DELETE", `/api/usuarios/${encodeURIComponent(email)}`),
};
