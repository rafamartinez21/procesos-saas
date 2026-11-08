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
| Base de datos (MongoDB Atlas) | Colecciones `usuarios`, `sesiones`, `partidas` y `jugadores` |

El servidor sirve el frontend desde el mismo origen que la API: `express.static` en [servidor/api.js](../servidor/api.js).

## Frontend

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Presentación (GUI) | [cliente/interfaz.js](../cliente/interfaz.js), [cliente/combate-vista.js](../cliente/combate-vista.js), [cliente/arena.js](../cliente/arena.js), [cliente/retratos.js](../cliente/retratos.js), [cliente/progreso-vista.js](../cliente/progreso-vista.js), [cliente/dom.js](../cliente/dom.js), [cliente/index.html](../cliente/index.html), [cliente/estilos.css](../cliente/estilos.css) | Dibuja pantallas y reacciona a clics. No hace peticiones. `combate-vista.js` convierte la vista del combate que envía el servidor en pantallas (elección de equipo, controles, resultado) sin calcular nada del juego; `arena.js` dibuja el escenario y reproduce cada turno paso a paso con los datos de los eventos (D-29); `retratos.js` dibuja las criaturas en SVG (D-27) y `progreso-vista.js`, el panel de estadísticas y ranking. |
| Comunicación | [cliente/cliente-api.js](../cliente/cliente-api.js) | Único archivo que llama a `fetch`. Expone `ClienteApi` y convierte los errores HTTP en `ErrorApi`. |
| Comunicación (tiempo real) | [cliente/cliente-juego.js](../cliente/cliente-juego.js) | Único archivo que usa Socket.IO. Expone `ClienteJuego` (conectar con avisos, `crearPartida`, `crearContraMaquina`, `unirse`, `abandonar`, `elegirEquipo`, `atacar`, `cambiar`, `enviarMensaje`, `observar`, `dejarDeObservar`) y convierte los rechazos en `ErrorJuego`. |

**Frontera:** `interfaz.js` importa `ClienteApi` y solo llama a sus funciones (`registrar`, `iniciarSesion`, `cerrarSesion`, `sesionActual`, `listarUsuarios`, `usuarioActivo`, `eliminarUsuario`). No conoce URLs, cabeceras ni cookies. Igual con `ClienteJuego`: la interfaz no conoce los nombres de los eventos.

## Backend

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Composición | [index.js](../index.js) | Lee las variables de entorno, elige el CAD (MongoDB si existe `DATABASE_URL`, memoria si no), crea `Sistema`, las sesiones y el registro, y arranca el servidor. |
| API | [servidor/api.js](../servidor/api.js) | Traduce HTTP a llamadas a la lógica y los `ErrorNegocio` a códigos HTTP. Exige sesión en las rutas protegidas. |
| API (tiempo real) | [servidor/tiempo-real.js](../servidor/tiempo-real.js) | Socket.IO sobre el mismo servidor HTTP (D-19). Autentica con la cookie `sid`, traduce eventos a llamadas a `Salas` y difunde el estado. Sin reglas del juego (D-20). |
| API (sesiones) | [servidor/sesiones.js](../servidor/sesiones.js), [servidor/sesiones-mongo.js](../servidor/sesiones-mongo.js) | Sesiones en memoria o en MongoDB, con la misma interfaz, y cookies `HttpOnly`. |
| Lógica de negocio | [servidor/modelo.js](../servidor/modelo.js) | `Sistema`: reglas de usuarios, roles, registro, inicio de sesión, confirmación y validación de email. Lanza `ErrorNegocio` con un código estable. |
| Lógica del juego | [servidor/juego/salas.js](../servidor/juego/salas.js) | `Salas`: crear, listar, unirse a y abandonar partidas (hito 5); con dos jugadores crea el `Combate` de la partida y avisa con `alTerminar` cuando acaba. Sin Socket.IO ni HTTP (D-20); las partidas viven en memoria (D-21). Las vistas públicas no incluyen emails. |
| Lógica del juego | [servidor/juego/criaturas.js](../servidor/juego/criaturas.js) | Catálogo de criaturas, movimientos, estados y tabla de eficacias (D-22). Datos fijos sin dependencias. |
| Lógica del juego | [servidor/juego/combate.js](../servidor/juego/combate.js) | `Combate`: elección de equipos, turnos simultáneos (D-23), daño, eficacias, estados alterados y ganador. Valida cada acción y da a cada jugador una vista sin la acción ni el banquillo del rival (RNF-10). El azar se inyecta. |
| Lógica del juego | [servidor/juego/progreso.js](../servidor/juego/progreso.js) | `Progreso`: guarda cada partida terminada, actualiza el ELO (D-24) y calcula historial, ranking y estadísticas. Recibe el CAD por parámetro, como `Sistema`. |
| Lógica del juego | [servidor/juego/ia.js](../servidor/juego/ia.js) | Rival máquina (RF-25): funciones puras que reciben la vista de un jugador y devuelven una acción válida (D-25). |
| Lógica (utilidad) | [servidor/contrasenas.js](../servidor/contrasenas.js) | Hash y verificación de contraseñas con scrypt. |
| Acceso a datos | [servidor/cad-memoria.js](../servidor/cad-memoria.js), [servidor/cad-mongo.js](../servidor/cad-mongo.js) | Misma interfaz: `insertarUsuario`, `buscarUsuario`, `listarUsuarios`, `actualizarUsuario`, `eliminarUsuario` y `buscarUsuarioPorToken`; y para el juego `insertarPartida`, `listarPartidasDe`, `buscarJugador`, `guardarJugador`, `listarRanking` y `eliminarJugador`. |
| Transversal | [servidor/registro.js](../servidor/registro.js) | Log de actividad en JSON por la salida estándar. |
| Servicio externo | [servidor/oauth-google.js](../servidor/oauth-google.js) | Cliente OAuth de Google: URL de autorización y cambio del código por el perfil. Se crea en `index.js` y se inyecta en la API; la lógica solo recibe el perfil. |
| Servicio externo | [servidor/correo-brevo.js](../servidor/correo-brevo.js) | Envío de correo con la API de Brevo. Se crea en `index.js` y la lógica solo recibe `enviarConfirmacion`. |

**Fronteras exactas:**

- **API → lógica:** `crearApp(sistema, …)` recibe el objeto `Sistema` y solo llama a sus métodos. La API no decide permisos: la lógica lanza `NO_AUTORIZADO` y la API lo traduce a 403 con la tabla `ESTADO_HTTP`.
- **Lógica → datos:** `new Sistema(cad, opciones)` recibe el CAD por parámetro. La lógica solo usa los métodos de la interfaz del CAD y no conoce MongoDB ni HTTP. Las pruebas de contrato ([spec/cad.test.js](../spec/cad.test.js)) ejecutan las mismas pruebas contra los dos CAD.
- **Servicios externos:** la lógica recibe `enviarConfirmacion` como opción desde `index.js`, que envía el enlace por correo con Brevo (o lo escribe en el log si no hay clave configurada). La lógica no conoce Brevo ni HTTP.

## Endpoints

Definidos en [servidor/api.js](../servidor/api.js). "Sesión" significa que sin cookie válida responde 401. Los permisos de rol los comprueba la lógica, que responde 403 si no se cumplen.

| Método | Ruta | Quién puede |
|---|---|---|
| GET | `/api/salud` | Cualquiera |
| GET | `/api/criaturas` | Cualquiera (catálogo del juego) |
| POST | `/api/prueba/email` | Cualquiera |
| POST | `/api/usuarios` | Cualquiera (registro) |
| GET | `/api/confirmar` | Cualquiera con el enlace de confirmación |
| POST | `/api/confirmacion` | Cualquiera (reenvía el enlace; responde igual exista o no la cuenta) |
| POST | `/api/sesion` | Cualquiera (inicio de sesión) |
| GET | `/api/auth/google` | Cualquiera (redirige a Google) |
| GET | `/api/auth/google/callback` | Vuelta de Google con un `state` que coincide con la cookie |
| GET | `/api/sesion` | Sesión |
| DELETE | `/api/sesion` | Sesión |
| GET | `/api/usuarios` | Sesión y rol administrador |
| GET | `/api/usuarios/:email/activo` | Sesión y rol administrador |
| DELETE | `/api/usuarios/:email` | Sesión: el administrador elimina a cualquiera; un usuario, solo su propia cuenta |
| GET | `/api/juego/ranking` | Sesión (RF-20) |
| GET | `/api/juego/historial` | Sesión: el historial del propio jugador (RF-19) |
| GET | `/api/juego/estadisticas` | Sesión: las estadísticas del propio jugador (RF-21) |

## Eventos en tiempo real

Definidos en [servidor/tiempo-real.js](../servidor/tiempo-real.js). La conexión exige sesión válida; cada acción responde por el ack con `{ ok: true, partida }` o `{ ok: false, error, mensaje }`.

| Sentido | Evento | Qué hace |
|---|---|---|
| Cliente → servidor | `partida:crear` | Crea una partida abierta (RF-11) |
| Cliente → servidor | `partida:crear-maquina` | Crea una partida contra la máquina (RF-25) |
| Cliente → servidor | `partida:unirse` `{ id }` | Se une a una partida (RF-13) |
| Cliente → servidor | `partida:abandonar` | Sale de su partida (RF-14); durante el combate, lo pierde (RF-18) |
| Cliente → servidor | `combate:equipo` `{ criaturas }` | Elige su equipo de tres (RF-16) |
| Cliente → servidor | `combate:accion` `{ tipo, movimiento \| indice }` | Ataca o cambia de criatura (RF-17) |
| Cliente → servidor | `chat:enviar` `{ texto }` | Escribe en el chat de su partida (RF-22) |
| Cliente → servidor | `partida:observar` `{ id }` / `partida:dejar-observar` | Empieza o deja de mirar una partida (RF-23) |
| Servidor → todos | `partidas` | Lista de partidas abiertas, en cada cambio (RF-12) |
| Servidor → todos | `partidas:en-curso` | Combates que se pueden mirar, con el número de espectadores (RF-23) |
| Servidor → espectadores | `espectador:estado` / `espectador:fin` | Vista neutral del combate en cada cambio; aviso cuando la partida desaparece (D-26) |
| Servidor → jugadores | `partida:estado` | Estado de su partida cuando cambia |
| Servidor → jugador | `partida:rival-abandona` | Su rival ha salido |
| Servidor → jugadores | `chat:mensaje` | Mensaje nuevo del chat, con el nombre del autor |
| Servidor → jugador | `chat:historial` | Últimos mensajes, al conectarse a una partida |
| Servidor → jugador | `combate:estado` | Su propia vista del combate, en cada cambio (RNF-10: la del rival nunca sale del servidor) |
