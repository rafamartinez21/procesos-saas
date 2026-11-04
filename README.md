# Ecos de Aetheria — Procesos de Ingeniería del Software

Aplicación web tipo SaaS organizada en capas: gestión de usuarios (Sprint 1) y el juego multijugador en tiempo real **Ecos de Aetheria** (Sprint 2), duelos por turnos entre criaturas elementales originales.

**Estado:** Sprint 1 completo (hitos 1 a 4): arquitectura en capas, registro e inicio de sesión locales con hash, confirmación de cuenta por correo (Brevo), inicio de sesión con Google (OAuth), sesión persistente en MongoDB, roles usuario/administrador aplicados en el servidor, registro de actividad, CI y despliegue continuo. Sprint 2 en curso: hitos 5 (salas de partida en tiempo real), 6 (combate por turnos) y 7 (historial, ranking ELO y estadísticas) completos. Plan y requisitos en [docs/sprint-2.md](docs/sprint-2.md). Documentación del proyecto en [docs/](docs/index.md).

- URL pública: https://procesos-saas-580225401181.europe-west1.run.app

## Tecnologías elegidas

| Tecnología | Por qué |
|---|---|
| Node.js | Un solo lenguaje (JavaScript) en servidor y cliente, el mismo que usa el material del curso. |
| Express | Framework HTTP mínimo y muy extendido para construir la API y servir el frontend desde el mismo origen. |
| `scrypt` (módulo `crypto` de Node) | Función de hash pensada para contraseñas (lenta y con sal aleatoria), incluida en Node: no añade dependencias. |
| Sesión en cookie `HttpOnly` | El navegador solo guarda un identificador aleatorio; los datos de la sesión viven en el servidor, y cerrar sesión la invalida de verdad. |
| JavaScript nativo (módulos ES) en el cliente | Interfaz y cliente de comunicación son dos módulos separados sin necesidad de un framework. |
| `node:test` (incluido en Node) | Framework de pruebas integrado: no añade dependencias y se ejecuta con un único comando. |
| GitHub Actions | CI integrada en el repositorio, sin servicios externos. |
| MongoDB Atlas (driver `mongodb`) | Base de datos real con capa gratuita (M0) en Google Cloud, en la misma región que Cloud Run; el modelo de documentos encaja con un usuario por documento y los índices únicos evitan emails duplicados. |
| Registro JSON por la salida estándar | Cloud Run lo envía a Cloud Logging, que filtra por nivel (`severity`) sin añadir librerías. |
| Google OAuth 2.0 (sin librerías) | Inicio de sesión externo con el proveedor del material del curso; el flujo de código de autorización se implementa con `fetch` en un módulo propio, sin añadir dependencias. |
| Brevo (API transaccional) | Envía el correo de confirmación con capa gratuita y por HTTPS, porque los proveedores cloud suelen bloquear el SMTP directo; no necesita dominio propio. |
| `mongodb-memory-server` (solo pruebas) | MongoDB temporal en local: las pruebas del CAD y de las sesiones usan una base de datos de verdad sin tocar Atlas ni necesitar secretos. |
| Socket.IO | Comunicación en tiempo real para las partidas (D-19), la misma librería que el material del curso; funciona sobre el servidor de Express y reconecta sola. |
| Google Cloud Run | Despliegue sencillo desde el repositorio, con capa gratuita y URL pública con HTTPS. |

## Arquitectura

```
cliente/                  Frontend (se sirve desde el mismo origen que la API)
  index.html              Página
  interfaz.js             Capa de presentación (GUI): dibuja pantallas. No hace peticiones.
  cliente-api.js          Cliente de comunicación: único sitio que habla con la API REST (fetch).
  cliente-juego.js        Cliente de tiempo real: único sitio que usa Socket.IO.
  combate-vista.js        Presentación del combate: dibuja la vista que envía el servidor.
  progreso-vista.js       Presentación del progreso: estadísticas, últimas partidas y ranking.
  dom.js                  Utilidad de dibujo (crea elementos con textContent).
  estilos.css
servidor/
  tiempo-real.js          Capa API en tiempo real (Socket.IO): eventos <-> lógica del juego. Exige la cookie de sesión.
  juego/salas.js          Lógica del juego: salas de partida (crear, listar, unirse, abandonar). Sin Socket.IO.
  juego/criaturas.js      Lógica del juego: catálogo de criaturas, movimientos y tabla de eficacias.
  juego/combate.js        Lógica del juego: motor de combate por turnos (equipos, daño, estados, ganador).
  juego/progreso.js       Lógica del juego: historial, ranking ELO y estadísticas (usa el CAD).
  juego/ia.js             Lógica del juego: rival controlado por la máquina.
  api.js                  Capa API: HTTP <-> lógica. Cookies de sesión y rutas protegidas. Sin reglas de negocio.
  sesiones.js             Sesiones (identificador -> usuario) en memoria, y cookies. Parte de la capa API.
  sesiones-mongo.js       Mismas sesiones, guardadas en MongoDB (caducan solas con un índice TTL).
  registro.js             Log de actividad en JSON (sin contraseñas, hashes ni cookies).
  modelo.js               Capa de lógica de negocio: reglas de usuarios y roles. Sin HTTP ni datos.
  contrasenas.js          Hash y verificación de contraseñas (scrypt).
  cad-memoria.js          Capa de acceso a datos en memoria (desarrollo y pruebas).
  cad-mongo.js            Capa de acceso a datos en MongoDB. Misma interfaz que cad-memoria.js.
index.js                  Ensambla las capas y arranca el servidor.
spec/                     Pruebas automatizadas.
```

Flujo de una petición: `interfaz.js` → `cliente-api.js` → (HTTP) → `api.js` → `modelo.js` → `cad-*.js`. Cada capa solo conoce a la de debajo. La lógica recibe el CAD por parámetro (`new Sistema(cad)`), por eso pasar de memoria a base de datos en el hito 3 no ha tocado `modelo.js`: `index.js` elige `CadMongo` si existe `DATABASE_URL` y `CadMemoria` si no.

## Ejecutar en local

Requisitos: Node.js 20 o superior.

```bash
npm install
```

Define las variables de entorno (ver más abajo) y arranca. En PowerShell:

```powershell
$env:ADMIN_EMAIL="admin@ejemplo.es"
$env:ADMIN_PASSWORD="una-clave-larga"
npm start
```

Sin `DATABASE_URL`, los datos se guardan en memoria (se pierden al reiniciar). Para usar MongoDB en local, añade `DATABASE_URL` en un `.env` y arranca con `node --env-file=.env index.js`.

Abre http://localhost:3000.

## Ejecutar las pruebas

```bash
npm test
```

Ejecuta las pruebas de la lógica (usuarios, roles, login), del hash de contraseñas, de la capa de acceso a datos y de las sesiones (en memoria y en MongoDB con una base de datos temporal), de la confirmación de cuenta (token válido, inventado, caducado y reutilizado), de la API (rutas protegidas) y del registro de actividad. No necesitan red ni secretos.

## Variables de entorno

Solo nombres; los valores van en el entorno o en un `.env` local (no se sube al repositorio). Ver `.env.example`.

- `PORT`
- `DATABASE_URL`: cadena de conexión de MongoDB Atlas. Es un secreto: en Cloud Run va como variable de entorno del servicio, nunca en el repositorio.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: administrador inicial (se crea al arrancar si no existe).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: cliente OAuth de Google para «Entrar con Google». La URL de retorno registrada en Google debe ser `<URL_PUBLICA>/api/auth/google/callback`.
- `BREVO_API_KEY`, `CORREO_REMITENTE`: clave de la API de Brevo y remitente verificado para el correo de confirmación. Sin ellas, el enlace se escribe en el log.
- `URL_PUBLICA`: URL pública de la aplicación, para construir el enlace de confirmación. Opcional: si falta, se deduce de la petición.

## Acceso como administrador para la revisión

El primer administrador se crea al arrancar el servidor con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Decisión de diseño: no existe ningún endpoint para hacerse administrador, así que nadie puede autopromocionarse desde fuera; solo quien controla el entorno del servidor define quién lo es. Las credenciales de prueba se envían junto con la entrega, nunca en el repositorio.

## Seguridad (resumen)

- Las contraseñas se guardan con hash (scrypt con sal aleatoria), nunca en claro; el hash no sale del servidor.
- La cookie de sesión es `HttpOnly` (la página no puede leerla), `SameSite=Lax` y `Secure` en HTTPS.
- Las rutas protegidas devuelven 401 sin sesión válida; los permisos de rol se aplican en el servidor (403).
- Un usuario eliminado pierde sus sesiones.
- La interfaz inserta los datos de usuarios con `textContent`, no con `innerHTML`.
- El inicio de sesión devuelve el mismo error para «usuario inexistente» y «contraseña incorrecta».

## Confirmación de cuenta

1. Al registrarse, la cuenta queda **pendiente** y no puede iniciar sesión (403 `CUENTA_PENDIENTE`).
2. El servidor genera un token aleatorio de un solo uso (caduca a las 24 h) y guarda solo su hash.
3. Envía un correo con el enlace `.../api/confirmar?token=...` usando Brevo. Si `BREVO_API_KEY` o `CORREO_REMITENTE` no están definidas (desarrollo local), escribe el enlace en el log. Si el correo no llega, el botón «Reenviar correo de confirmación» genera un enlace nuevo (`POST /api/confirmacion`).
4. Al abrir ese enlace en el navegador la cuenta pasa a activa y se redirige a la aplicación con el resultado.

La lógica (`modelo.js`) no sabe cómo se entrega el enlace: recibe una función `enviarConfirmacion` desde `index.js`, que es donde se crea el cliente de Brevo.

## Inicio de sesión con Google

1. «Entrar con Google» lleva a `GET /api/auth/google`, que guarda un `state` aleatorio en una cookie `HttpOnly` y redirige a Google.
2. Google vuelve a `GET /api/auth/google/callback` con un código. Si el `state` no coincide con la cookie, se rechaza (protección CSRF).
3. El servidor cambia el código por el perfil (email verificado y nombre) y la lógica decide: si el email es nuevo, crea la cuenta como usuario y ya activa; si se creó con Google, entra; si es una cuenta local, se rechaza y se pide entrar con contraseña (D-18).
4. La sesión se crea igual que en el inicio de sesión local (cookie `HttpOnly`).

## Roles y registro de actividad

- Dos roles: `usuario` y `admin`. Listar usuarios y comprobar si uno está activo es solo del administrador; eliminar: el administrador a cualquiera y un usuario solo a sí mismo. Se comprueba en el servidor (`modelo.js`) y el rol se lee siempre de la base de datos, nunca de lo que envíe el cliente.
- El log escribe una línea JSON por evento (arranque, peticiones, altas, inicios y cierres de sesión, eliminaciones, rechazos y errores inesperados). Se consulta en Cloud Logging, en los registros del servicio de Cloud Run.

## Partidas en tiempo real (hito 5)

- Con la sesión iniciada, la página se conecta por Socket.IO usando la misma cookie de sesión; sin sesión válida el servidor rechaza la conexión, y comprueba la sesión de nuevo en cada acción.
- «Crear partida» genera un código corto (por ejemplo `K7Q2X`); la lista de partidas abiertas se actualiza en directo en todas las pantallas; se entra con «Unirse» o escribiendo el código.
- Si un jugador abandona, el otro recibe un aviso y la partida vuelve a estar abierta. Si se pierde la conexión (recargar, corte de red), hay 30 segundos para volver antes de salir de la partida.
- A los demás jugadores solo se les muestra el nombre, nunca el email.

## Cómo se juega (hito 6)

1. Cuando hay dos jugadores en la partida, cada uno elige un equipo de tres criaturas entre doce (dos por elemento: fuego, agua, planta, rayo, tierra y viento). La primera sale a combatir.
2. En cada turno los dos eligen a la vez y en secreto: atacar con uno de los movimientos de su criatura o cambiarla por otra del equipo. Los cambios van primero y los ataques, de la criatura más rápida a la más lenta.
3. El daño depende de la potencia del movimiento, del ataque y la defensa, de si el movimiento es del elemento de la criatura (x1,25) y de la eficacia: cada elemento es muy eficaz (x2) contra dos y poco eficaz (x0,5) contra otros dos. Algunos movimientos queman, congelan o paralizan, y Drenaje cura al atacante.
4. Si cae una criatura, su dueño saca otra. Gana quien deja al rival sin criaturas; rendirse o abandonar da la victoria al rival.
5. Para jugar solo, «Jugar contra la máquina» empieza una partida contra el Autómata de Aetheria. Elige el movimiento más eficaz y cambia de criatura cuando le conviene, pero solo con la información que tendría un jugador (D-25). Estas partidas no cuentan para el ranking.

Todo se calcula en el servidor; el navegador solo envía la acción elegida y nunca recibe la del rival antes de resolver el turno.

## Progreso y ranking (hito 7)

- Cada combate terminado se guarda en MongoDB (colección `partidas`) con los dos jugadores, el ganador, el motivo, los turnos y la puntuación de antes y de después.
- Ranking ELO (D-24): todos empiezan con 1000; ganar a alguien mejor da más puntos. Abandonar cuenta como derrota.
- El panel «Tu progreso» muestra tu ELO, partidas, porcentaje de victorias, racha, tus últimas partidas y el ranking, y se actualiza solo al terminar cada combate. A otros jugadores solo se les muestra tu nombre.

## Limitaciones conocidas

- Cada petición a la API busca la sesión en la base de datos; es suficiente para este proyecto.
- Las partidas en curso viven en memoria (D-21): el servicio debe ejecutarse con una sola instancia y un reinicio del servidor termina las partidas abiertas.

## Flujo de trabajo

GitHub Flow: una rama por cambio, tests en local antes del pull request, integración en `main` mediante pull request con la CI en verde. Cada hito se marca con una etiqueta (`hito-1`, `hito-2`…).

Despliegue continuo: Cloud Run, mediante Cloud Build, despliega automáticamente cada cambio que llega a `main`.
