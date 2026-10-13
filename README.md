# Sistema — Procesos de Ingeniería del Software (Sprint 1)

Aplicación web tipo SaaS organizada en capas, con gestión de usuarios.

**Estado:** hito 2 (frontend separado en interfaz y cliente de comunicación; registro e inicio de sesión locales con contraseña con hash; sesión que se mantiene al recargar; rutas protegidas). Los datos siguen en memoria.

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
| Google Cloud Run | Despliegue sencillo desde el repositorio, con capa gratuita y URL pública con HTTPS. |

_(Se irán añadiendo la base de datos, OAuth y el correo con su justificación.)_

## Arquitectura

```
cliente/                  Frontend (se sirve desde el mismo origen que la API)
  index.html              Página
  interfaz.js             Capa de presentación (GUI): dibuja pantallas. No hace peticiones.
  cliente-api.js          Cliente de comunicación: único sitio que habla con el servidor (fetch).
  estilos.css
servidor/
  api.js                  Capa API: HTTP <-> lógica. Cookies de sesión y rutas protegidas. Sin reglas de negocio.
  sesiones.js             Sesiones (identificador -> usuario) y cookies. Parte de la capa API.
  modelo.js               Capa de lógica de negocio: reglas de usuarios y roles. Sin HTTP ni datos.
  contrasenas.js          Hash y verificación de contraseñas (scrypt).
  cad-memoria.js          Capa de acceso a datos (en memoria). En el hito 3 se añade una versión con base de datos.
index.js                  Ensambla las capas y arranca el servidor.
spec/                     Pruebas automatizadas.
```

Flujo de una petición: `interfaz.js` → `cliente-api.js` → (HTTP) → `api.js` → `modelo.js` → `cad-*.js`. Cada capa solo conoce a la de debajo. La lógica recibe el CAD por parámetro (`new Sistema(cad)`), por eso cambiar de memoria a base de datos no obliga a tocarla.

## Ejecutar en local

Requisitos: Node.js 20 o superior.

```bash
npm install
```

Define las variables de entorno (ver más abajo) y arranca. En PowerShell:

```powershell
$env:ADMIN_EMAIL="admin@ejemplo.es"
$env:ADMIN_PASSWORD="una-clave-larga"
$env:AUTO_CONFIRMAR="true"
npm start
```

Abre http://localhost:3000.

## Ejecutar las pruebas

```bash
npm test
```

Ejecuta las pruebas de la lógica (usuarios, roles, login), del hash de contraseñas, de las sesiones y de la API (rutas protegidas).

## Variables de entorno

Solo nombres; los valores van en el entorno o en un `.env` local (no se sube al repositorio). Ver `.env.example`.

- `PORT`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: administrador inicial (se crea al arrancar si no existe).
- `AUTO_CONFIRMAR`: provisional hasta el hito 4 (confirmación por correo). Con `true`, las cuentas nuevas quedan confirmadas al registrarse.

## Acceso como administrador para la revisión

El primer administrador se crea al arrancar el servidor con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Decisión de diseño: no existe ningún endpoint para hacerse administrador, así que nadie puede autopromocionarse desde fuera; solo quien controla el entorno del servidor define quién lo es. Las credenciales de prueba se envían junto con la entrega, nunca en el repositorio.

## Seguridad (resumen)

- Las contraseñas se guardan con hash (scrypt con sal aleatoria), nunca en claro; el hash no sale del servidor.
- La cookie de sesión es `HttpOnly` (la página no puede leerla), `SameSite=Lax` y `Secure` en HTTPS.
- Las rutas protegidas devuelven 401 sin sesión válida; los permisos de rol se aplican en el servidor (403).
- Un usuario eliminado pierde sus sesiones.
- La interfaz inserta los datos de usuarios con `textContent`, no con `innerHTML`.
- El inicio de sesión devuelve el mismo error para «usuario inexistente» y «contraseña incorrecta».

## Limitaciones conocidas (hito 2)

- Con los datos y las sesiones en memoria, se pierden al reiniciar el servidor y solo funcionan con una instancia (en Cloud Run: máximo de instancias = 1). El hito 3 introduce la base de datos.
- La confirmación por correo y OAuth llegan en el hito 4.

## Flujo de trabajo

GitHub Flow: una rama por cambio, tests en local antes del pull request, integración en `main` mediante pull request con la CI en verde. Cada hito se marca con una etiqueta (`hito-1`, `hito-2`…).

Despliegue continuo: Cloud Run, mediante Cloud Build, despliega automáticamente cada cambio que llega a `main`.
