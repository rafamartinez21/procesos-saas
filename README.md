# Sistema — Procesos de Ingeniería del Software (Sprint 1)

Aplicación web tipo SaaS organizada en capas, con gestión de usuarios.

**Estado:** hito 3 más confirmación de cuenta por enlace (persistencia en MongoDB Atlas para usuarios y sesiones; secretos en variables de entorno; roles usuario/administrador aplicados en el servidor; registro de actividad). Incluye lo de los hitos 1 y 2: frontend separado en interfaz y cliente de comunicación, registro e inicio de sesión locales con contraseña con hash, sesión que se mantiene al recargar y rutas protegidas.

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
| `mongodb-memory-server` (solo pruebas) | MongoDB temporal en local: las pruebas del CAD y de las sesiones usan una base de datos de verdad sin tocar Atlas ni necesitar secretos. |
| Google Cloud Run | Despliegue sencillo desde el repositorio, con capa gratuita y URL pública con HTTPS. |

_(Se irán añadiendo OAuth y el correo con su justificación.)_

## Arquitectura

```
cliente/                  Frontend (se sirve desde el mismo origen que la API)
  index.html              Página
  interfaz.js             Capa de presentación (GUI): dibuja pantallas. No hace peticiones.
  cliente-api.js          Cliente de comunicación: único sitio que habla con el servidor (fetch).
  estilos.css
servidor/
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

Ejecuta las pruebas de la lógica (usuarios, roles, login), del hash de contraseñas, de la capa de acceso a datos y de las sesiones (en memoria y en MongoDB con una base de datos temporal), de la API (rutas protegidas) y del registro. No necesitan red ni secretos.

## Variables de entorno

Solo nombres; los valores van en el entorno o en un `.env` local (no se sube al repositorio). Ver `.env.example`.

- `PORT`
- `DATABASE_URL`: cadena de conexión de MongoDB Atlas. Es un secreto: en Cloud Run va como variable de entorno del servicio, nunca en el repositorio.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: administrador inicial (se crea al arrancar si no existe).
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
3. En lugar de enviar un correo, escribe en el log una línea `enlace de confirmacion` con la URL `.../api/confirmar?token=...`. En Cloud Run se lee en *Registros* del servicio.
4. Al abrir ese enlace en el navegador la cuenta pasa a activa y se redirige a la aplicación con el resultado.

La lógica (`modelo.js`) no sabe cómo se entrega el enlace: recibe una función `enviarConfirmacion` desde `index.js`, así que pasar a correo real solo cambia esa función.

## Roles y registro de actividad

- Dos roles: `usuario` y `admin`. Listar usuarios y comprobar si uno está activo es solo del administrador; eliminar: el administrador a cualquiera y un usuario solo a sí mismo. Se comprueba en el servidor (`modelo.js`) y el rol se lee siempre de la base de datos, nunca de lo que envíe el cliente.
- El log escribe una línea JSON por evento (arranque, peticiones, altas, inicios y cierres de sesión, eliminaciones, rechazos y errores inesperados). Se consulta en Cloud Logging, en los registros del servicio de Cloud Run.

## Limitaciones conocidas (hito 3)

- Cada petición a la API busca la sesión en la base de datos; es suficiente para este proyecto.
- La confirmación de cuenta no envía correo: el enlace se escribe en el log del servidor y se abre a mano. OAuth no está implementado.

## Flujo de trabajo

GitHub Flow: una rama por cambio, tests en local antes del pull request, integración en `main` mediante pull request con la CI en verde. Cada hito se marca con una etiqueta (`hito-1`, `hito-2`…).

Despliegue continuo: Cloud Run, mediante Cloud Build, despliega automáticamente cada cambio que llega a `main`.
