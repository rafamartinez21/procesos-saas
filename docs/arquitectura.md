---
type: Arquitectura
title: Arquitectura en capas
description: Capas del frontend y del backend, frontera exacta entre ellas y endpoints de la API.
timestamp: 2026-10-28
---

# Arquitectura en capas

Resumen de carpetas en el [README](../README.md#arquitectura).

## Nodos

| Nodo | Qué se ejecuta |
|---|---|
| Navegador | `cliente/` (HTML, CSS y módulos ES) |
| Servidor (Google Cloud Run) | `index.js` y `servidor/` (Node.js y Express) |
| Base de datos (MongoDB Atlas) | Colecciones `usuarios` y `sesiones` |

El servidor sirve el frontend desde el mismo origen que la API: `express.static` en [servidor/api.js](../servidor/api.js).

## Frontend

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Presentación (GUI) | [cliente/interfaz.js](../cliente/interfaz.js), [cliente/index.html](../cliente/index.html), [cliente/estilos.css](../cliente/estilos.css) | Dibuja pantallas y reacciona a clics. No hace peticiones. |
| Comunicación | [cliente/cliente-api.js](../cliente/cliente-api.js) | Único archivo que llama a `fetch`. Expone `ClienteApi` y convierte los errores HTTP en `ErrorApi`. |

**Frontera:** `interfaz.js` importa `ClienteApi` y solo llama a sus funciones (`registrar`, `iniciarSesion`, `cerrarSesion`, `sesionActual`, `listarUsuarios`, `usuarioActivo`, `eliminarUsuario`). No conoce URLs, cabeceras ni cookies.

## Backend

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Composición | [index.js](../index.js) | Lee las variables de entorno, elige el CAD (MongoDB si existe `DATABASE_URL`, memoria si no), crea `Sistema`, las sesiones y el registro, y arranca el servidor. |
| API | [servidor/api.js](../servidor/api.js) | Traduce HTTP a llamadas a la lógica y los `ErrorNegocio` a códigos HTTP. Exige sesión en las rutas protegidas. |
| API (sesiones) | [servidor/sesiones.js](../servidor/sesiones.js), [servidor/sesiones-mongo.js](../servidor/sesiones-mongo.js) | Sesiones en memoria o en MongoDB, con la misma interfaz, y cookies `HttpOnly`. |
| Lógica de negocio | [servidor/modelo.js](../servidor/modelo.js) | `Sistema`: reglas de usuarios, roles, registro, inicio de sesión, confirmación y validación de email. Lanza `ErrorNegocio` con un código estable. |
| Lógica (utilidad) | [servidor/contrasenas.js](../servidor/contrasenas.js) | Hash y verificación de contraseñas con scrypt. |
| Acceso a datos | [servidor/cad-memoria.js](../servidor/cad-memoria.js), [servidor/cad-mongo.js](../servidor/cad-mongo.js) | Misma interfaz: `insertarUsuario`, `buscarUsuario`, `listarUsuarios`, `actualizarUsuario`, `eliminarUsuario` y `buscarUsuarioPorToken`. |
| Transversal | [servidor/registro.js](../servidor/registro.js) | Log de actividad en JSON por la salida estándar. |

**Fronteras exactas:**

- **API → lógica:** `crearApp(sistema, …)` recibe el objeto `Sistema` y solo llama a sus métodos. La API no decide permisos: la lógica lanza `NO_AUTORIZADO` y la API lo traduce a 403 con la tabla `ESTADO_HTTP`.
- **Lógica → datos:** `new Sistema(cad, opciones)` recibe el CAD por parámetro. La lógica solo usa los métodos de la interfaz del CAD y no conoce MongoDB ni HTTP. Las pruebas de contrato ([spec/cad.test.js](../spec/cad.test.js)) ejecutan las mismas pruebas contra los dos CAD.
- **Servicios externos:** la lógica recibe `enviarConfirmacion` como opción desde `index.js`. Ahora escribe el enlace de confirmación en el log, y para usar correo solo habría que cambiar esa función.

## Endpoints

Definidos en [servidor/api.js](../servidor/api.js). "Sesión" significa que sin cookie válida responde 401. Los permisos de rol los comprueba la lógica, que responde 403 si no se cumplen.

| Método | Ruta | Quién puede |
|---|---|---|
| GET | `/api/salud` | Cualquiera |
| POST | `/api/prueba/email` | Cualquiera |
| POST | `/api/usuarios` | Cualquiera (registro) |
| GET | `/api/confirmar` | Cualquiera con el enlace de confirmación |
| POST | `/api/sesion` | Cualquiera (inicio de sesión) |
| GET | `/api/sesion` | Sesión |
| DELETE | `/api/sesion` | Sesión |
| GET | `/api/usuarios` | Sesión y rol administrador |
| GET | `/api/usuarios/:email/activo` | Sesión y rol administrador |
| DELETE | `/api/usuarios/:email` | Sesión: el administrador elimina a cualquiera; un usuario, solo su propia cuenta |
