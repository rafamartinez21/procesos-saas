---
type: Decisiones
title: Decisiones de diseño
description: Qué se decidió, por qué y si sigue vigente.
timestamp: 2026-10-28
---

# Decisiones

## D-01 Node.js y Express

- **Qué se decidió:** el backend usa Node.js con Express.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), es un solo lenguaje en el servidor y en el cliente, el mismo que usa el material del curso, y Express es un framework mínimo y muy extendido para construir la API y servir el frontend desde el mismo origen.
- **Estado:** vigente.

## D-02 JavaScript nativo en el cliente, en dos módulos

- **Qué se decidió:** el cliente usa módulos ES sin framework, separados en interfaz y cliente de comunicación.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), así la interfaz y el cliente de comunicación son dos módulos separados sin necesidad de un framework.
- **Estado:** vigente. Introducida en el [PR #7](https://github.com/rafamartinez21/procesos-saas/pull/7).

## D-03 scrypt para las contraseñas

- **Qué se decidió:** las contraseñas se guardan con un hash scrypt (del módulo `crypto` de Node) y una sal aleatoria.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), es una función de hash pensada para contraseñas, lenta y con sal aleatoria, incluida en Node, así que no añade dependencias.
- **Estado:** vigente.

## D-04 Sesión en el servidor con una cookie `HttpOnly`

- **Qué se decidió:** el navegador solo guarda un identificador aleatorio en una cookie `HttpOnly`, `SameSite=Lax` y `Secure` en HTTPS; los datos de la sesión viven en el servidor.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), cerrar sesión la invalida de verdad. Según el [README](../README.md#seguridad-resumen), la página no puede leer la cookie.
- **Estado:** vigente.

## D-05 Sesiones en memoria

- **Qué se decidió:** en el hito 2, las sesiones se guardaban en un `Map` en memoria ([PR #6](https://github.com/rafamartinez21/procesos-saas/pull/6)).
- **Por qué:** el apartado 10 de la especificación pide para el hito 2 que "los datos siguen en memoria" y deja la base de datos para el hito 3. Empecé por lo más simple para tener el inicio de sesión funcionando y probado, y diseñé `Sesiones` con una interfaz que luego pude reimplementar sobre MongoDB sin tocar la API.
- **Estado:** sustituida por D-06 en producción. La versión en memoria se sigue usando en desarrollo y en las pruebas.

## D-06 Sesiones en MongoDB

- **Qué se decidió:** las sesiones se guardan en la colección `sesiones`, con un índice TTL que borra las caducadas ([PR #10](https://github.com/rafamartinez21/procesos-saas/pull/10)).
- **Por qué:** según el commit `a3e8495`, para que sobrevivan a reinicios. Según el comentario de [servidor/sesiones-mongo.js](../servidor/sesiones-mongo.js), también para que funcionen aunque Cloud Run arranque varias instancias.
- **Estado:** vigente.

## D-07 El CAD se inyecta en la lógica

- **Qué se decidió:** `Sistema` recibe la capa de acceso a datos por parámetro (`new Sistema(cad)`), y los dos CAD tienen la misma interfaz.
- **Por qué:** según el [README](../README.md#arquitectura), así pasar de memoria a base de datos no obliga a tocar la lógica. En el hito 3, `modelo.js` no cambió al añadir MongoDB ([PR #9](https://github.com/rafamartinez21/procesos-saas/pull/9)).
- **Estado:** vigente.

## D-08 MongoDB Atlas como base de datos

- **Qué se decidió:** se usa MongoDB Atlas (cluster gratuito M0 en Google Cloud) con el driver `mongodb` y un índice único sobre `email`.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), es una base de datos real con capa gratuita en la misma región que Cloud Run; el modelo de documentos encaja con un usuario por documento, y los índices únicos evitan emails duplicados.
- **Estado:** vigente.

## D-09 Primer administrador desde variables de entorno

- **Qué se decidió:** al arrancar, el servidor crea el administrador con `ADMIN_EMAIL` y `ADMIN_PASSWORD` si no existe.
- **Por qué:** según el [README](../README.md#acceso-como-administrador-para-la-revisión), no existe ningún endpoint para hacerse administrador, así que nadie puede autopromocionarse desde fuera.
- **Estado:** vigente.

## D-10 Confirmación automática provisional (`AUTO_CONFIRMAR`)

- **Qué se decidió:** en los hitos 2 y 3, con `AUTO_CONFIRMAR=true` las cuentas nuevas quedaban confirmadas al registrarse.
- **Por qué:** el README del hito 2 la describía como provisional hasta la confirmación por correo, y el comentario de `Sistema` en `modelo.js` de entonces, como una forma de poder probar el inicio de sesión mientras tanto ([PR #5](https://github.com/rafamartinez21/procesos-saas/pull/5)).
- **Estado:** sustituida por D-11.

## D-11 Confirmación de cuenta con un enlace escrito en el log

- **Qué se decidió:** el registro deja la cuenta pendiente y genera un token de un solo uso (se guarda su hash y caduca a las 24 h). El enlace `/api/confirmar` se escribe en el log en lugar de enviarse por correo. La lógica recibe `enviarConfirmacion` desde `index.js` ([PR #13](https://github.com/rafamartinez21/procesos-saas/pull/13)).
- **Por qué:** según el commit `142225c`, la lógica no sabe cómo se entrega el enlace. La confirmación por correo corresponde al hito 4, que no entraba en este sprint; escribir el enlace en el log me permitió implementar y probar todo el flujo (cuenta pendiente, token de un solo uso, caducidad y activación) sin depender todavía de un servicio externo. Pasar a correo real solo exige cambiar `enviarConfirmacion`.
- **Estado:** vigente, como solución provisional (RF-02 sigue pendiente).

## D-12 Pruebas con `node:test` y `mongodb-memory-server`

- **Qué se decidió:** las pruebas usan el framework integrado en Node. MongoDB se prueba con un servidor temporal en local.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), `node:test` no añade dependencias y se ejecuta con un único comando, y `mongodb-memory-server` permite probar con una base de datos de verdad sin tocar Atlas ni necesitar secretos.
- **Estado:** vigente.

## D-13 GitHub Actions para la CI y Cloud Run para el despliegue

- **Qué se decidió:** la CI se hace con GitHub Actions. El despliegue va a Google Cloud Run mediante un activador de Cloud Build.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), GitHub Actions es CI integrada en el repositorio sin servicios externos, y Cloud Run permite un despliegue sencillo desde el repositorio, con capa gratuita y URL pública con HTTPS.
- **Estado:** vigente.

## D-14 Registro de actividad en JSON por la salida estándar

- **Qué se decidió:** el log escribe una línea JSON por evento, con el campo `severity`. Nunca incluye contraseñas, hashes ni cookies.
- **Por qué:** según el [README](../README.md#tecnologías-elegidas), Cloud Run lo envía a Cloud Logging, que puede filtrar por nivel sin añadir librerías.
- **Estado:** vigente.

## D-15 Mismo error para usuario inexistente y contraseña incorrecta

- **Qué se decidió:** el inicio de sesión devuelve `CREDENCIALES_INVALIDAS` en los dos casos. Si el usuario no existe, verifica contra un hash falso.
- **Por qué:** según el comentario de `iniciarSesion` en [servidor/modelo.js](../servidor/modelo.js), para no revelar qué emails están registrados.
- **Estado:** vigente.
