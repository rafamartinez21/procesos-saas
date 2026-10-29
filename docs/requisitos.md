---
type: Requisitos
title: Estado de los requisitos del Sprint 1
description: Cada requisito de la especificación con su estado y su evidencia en el repositorio.
timestamp: 2026-10-28
---

# Requisitos

Estados: **hecho** (se cumple tal como lo pide la especificación, con evidencia), **parcial** y **pendiente**. Las rutas de las pruebas están en `spec/`.

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARQ-01 | Separación cliente-servidor y mismo origen | hecho | `express.static` en [servidor/api.js](../servidor/api.js); el cliente solo habla por la API en [cliente/cliente-api.js](../cliente/cliente-api.js). Prueba "la API responde y sirve la página" en [spec/api.test.js](../spec/api.test.js). |
| ARQ-02 | Capas del backend: API, lógica y datos | hecho | [servidor/api.js](../servidor/api.js), [servidor/modelo.js](../servidor/modelo.js), [servidor/cad-memoria.js](../servidor/cad-memoria.js) y [servidor/cad-mongo.js](../servidor/cad-mongo.js). Pruebas de contrato de los dos CAD en [spec/cad.test.js](../spec/cad.test.js). Ver [arquitectura.md](arquitectura.md#backend). |
| ARQ-03 | Capas del frontend: presentación y comunicación | hecho | [cliente/interfaz.js](../cliente/interfaz.js) (presentación) y [cliente/cliente-api.js](../cliente/cliente-api.js) (único `fetch`). [PR #7](https://github.com/rafamartinez21/procesos-saas/pull/7). |
| RF-01 | Registro de usuario local | hecho | `Sistema.registrarUsuario` en [servidor/modelo.js](../servidor/modelo.js) y `POST /api/usuarios`. La cuenta queda pendiente hasta confirmarse. Pruebas en [spec/modelo.test.js](../spec/modelo.test.js) y [spec/confirmacion.test.js](../spec/confirmacion.test.js). |
| RF-02 | Confirmación de cuenta por correo | pendiente | No se envía correo: el enlace se escribe en el log del servidor y se abre a mano ([PR #13](https://github.com/rafamartinez21/procesos-saas/pull/13)). Preparación: token de un solo uso (se guarda su hash, caduca a las 24 h), `Sistema.confirmarConToken`, ruta `GET /api/confirmar` y función `enviarConfirmacion` inyectada desde [index.js](../index.js), que es lo único que habría que cambiar para usar un proveedor de correo. Pruebas en [spec/confirmacion.test.js](../spec/confirmacion.test.js). |
| RF-03 | Inicio de sesión local | hecho | `Sistema.iniciarSesion` y `POST /api/sesion`. Pruebas de credenciales incorrectas y cuenta pendiente en [spec/modelo.test.js](../spec/modelo.test.js) y [spec/api.test.js](../spec/api.test.js). |
| RF-04 | Inicio de sesión con OAuth | pendiente | No implementado. |
| RF-05 | Cierre de sesión | hecho | `DELETE /api/sesion` destruye la sesión en el servidor y borra la cookie. Prueba "cerrar sesión invalida la cookie en el servidor" en [spec/api.test.js](../spec/api.test.js). |
| RF-06 | Mantenimiento de la sesión entre recargas | hecho | Cookie `HttpOnly` y `GET /api/sesion`, que la interfaz consulta al cargar (`arrancar` en [cliente/interfaz.js](../cliente/interfaz.js)). Las sesiones se guardan en MongoDB ([servidor/sesiones-mongo.js](../servidor/sesiones-mongo.js), [PR #10](https://github.com/rafamartinez21/procesos-saas/pull/10)). Pruebas en [spec/api.test.js](../spec/api.test.js) y [spec/sesiones.test.js](../spec/sesiones.test.js). |
| RF-07 | Listar usuarios (administrador) | hecho | `Sistema.obtenerUsuarios` (devuelve email, rol y estado) y `GET /api/usuarios`. Pruebas de rechazo al usuario normal en [spec/modelo.test.js](../spec/modelo.test.js) y [spec/api.test.js](../spec/api.test.js). |
| RF-08 | Comprobar si un usuario está activo (administrador) | hecho | `Sistema.usuarioActivo` (activo = confirmado y no eliminado) y `GET /api/usuarios/:email/activo`. Pruebas en [spec/modelo.test.js](../spec/modelo.test.js). |
| RF-09 | Eliminar usuario | hecho | `Sistema.eliminarUsuario`: el administrador a cualquiera y un usuario solo a sí mismo; además se cierran sus sesiones. Pruebas "un usuario normal no puede eliminar a otro usuario" y "un usuario eliminado no puede volver a iniciar sesión" en [spec/modelo.test.js](../spec/modelo.test.js). |
| RF-10 | Creación del primer administrador | hecho | `Sistema.crearAdministradorInicial`, llamado desde [index.js](../index.js) con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Motivo en el [README](../README.md#acceso-como-administrador-para-la-revisión). |
| RNF-01 | Persistencia en una base de datos real | hecho | [servidor/cad-mongo.js](../servidor/cad-mongo.js) con MongoDB Atlas, elegido cuando existe `DATABASE_URL`. Prueba "los datos sobreviven a cerrar y volver a conectar" en [spec/cad.test.js](../spec/cad.test.js). [PR #9](https://github.com/rafamartinez21/procesos-saas/pull/9). Por verificar: que `DATABASE_URL` esté definida en el servicio de Cloud Run (configuración fuera del repositorio). |
| RNF-02 | Secretos fuera del código y .env.example | hecho | [.env.example](../.env.example) solo con nombres; `.env` en [.gitignore](../.gitignore); [index.js](../index.js) lee `process.env`. |
| RNF-03 | Hash seguro de contraseñas | hecho | scrypt con sal aleatoria en [servidor/contrasenas.js](../servidor/contrasenas.js). Pruebas en [spec/contrasenas.test.js](../spec/contrasenas.test.js). [PR #4](https://github.com/rafamartinez21/procesos-saas/pull/4). |
| RNF-04 | Rutas protegidas por sesión y rol | hecho | `exigirSesion` en [servidor/api.js](../servidor/api.js) (401) y comprobaciones de rol en [servidor/modelo.js](../servidor/modelo.js) (403). Pruebas "[error] las rutas protegidas rechazan peticiones sin sesión (401)" y de rechazo por rol en [spec/api.test.js](../spec/api.test.js). |
| RNF-05 | Despliegue en cloud con URL pública | hecho | Google Cloud Run; URL pública en el [README](../README.md). La comprobación de Google Cloud Build del último commit de `main` está en verde (`gh api …/check-runs`). |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | hecho | 34 pruebas en [spec/modelo.test.js](../spec/modelo.test.js) (`node --test spec/modelo.test.js`), con casos de error marcados como `[error]`. 107 en total con `npm test`. |
| RNF-07 | Manejo de errores con feedback al usuario | hecho | Manejador de errores en [servidor/api.js](../servidor/api.js) (`{ error, mensaje }` con un código HTTP adecuado); `ErrorApi` en [cliente/cliente-api.js](../cliente/cliente-api.js); `mostrarError` en [cliente/interfaz.js](../cliente/interfaz.js). |
| RNF-08 | Registro de actividad (log) | hecho | [servidor/registro.js](../servidor/registro.js): una línea JSON por evento, sin contraseñas, hashes ni cookies. Pruebas en [spec/registro.test.js](../spec/registro.test.js). [PR #11](https://github.com/rafamartinez21/procesos-saas/pull/11). |
| PRO-01 | Flujo de trabajo GitHub Flow | hecho | 15 pull requests integrados (`gh pr list --state all`); en `main` no hay más commits sin PR que el inicial. Ver [procesos.md](procesos.md#flujo-de-trabajo). |
| PRO-02 | Integración continua | hecho | [.github/workflows/ci.yml](../.github/workflows/ci.yml) en cada pull request y en cada push a `main`. Las 30 ejecuciones registradas están en verde (`gh run list --limit 50`). |
| PRO-03 | Despliegue continuo | hecho | Un activador de Google Cloud Build despliega en Cloud Run cada cambio de `main`; su comprobación aparece en los commits de `main`. Por verificar: la configuración del activador está en la consola de Google Cloud, no en el repositorio. |
