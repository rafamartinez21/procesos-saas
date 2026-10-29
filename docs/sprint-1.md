---
type: Sprint
title: Sprint 1
description: Qué se hizo en cada hito del Sprint 1 y retrospectiva.
timestamp: 2026-10-28
---

# Sprint 1

Objetivos de cada hito según el apartado 10 de la especificación. Las tareas están en el [tablero de Donetonic](https://app.donetonic.com/workspaces/1/projects/1/backlog) (un PBI por requisito; requiere iniciar sesión).

## Hito 1 (semana 1). Esqueleto y backend

- **Objetivo:** repositorio con flujo de ramas y pull requests; CI y despliegue continuo desde el primer día; lógica de usuarios en memoria con pruebas unitarias, y API que la expone.
- **Qué se hizo:**
  - CI con GitHub Actions;
  - capa de lógica (`Sistema`) con el CAD en memoria y sus pruebas;
  - API REST de gestión de usuarios y página mínima servida por el backend.
- **PR y etiqueta:** [PR #1](https://github.com/rafamartinez21/procesos-saas/pull/1), [PR #2](https://github.com/rafamartinez21/procesos-saas/pull/2) y [PR #3](https://github.com/rafamartinez21/procesos-saas/pull/3). Etiqueta `hito-1` sobre el merge del PR #3.
- **Desviaciones:**
  - el commit inicial `583a961` está en `main` sin pull request;
  - Por verificar: desde qué commit está activo el despliegue continuo (historial de Cloud Build en la consola de Google Cloud).

## Hito 2 (semana 2). Frontend y sesión

- **Objetivo:** interfaz y cliente de comunicación separados; registro e inicio de sesión locales con hash; cierre de sesión y sesión entre recargas; rutas protegidas. Los datos siguen en memoria.
- **Qué se hizo:**
  - hash con scrypt;
  - registro con contraseña, inicio de sesión y administrador inicial;
  - sesiones con cookie `HttpOnly` y rutas protegidas;
  - cliente separado en `interfaz.js` y `cliente-api.js`;
  - README actualizado.
- **PR y etiqueta:** [PR #4](https://github.com/rafamartinez21/procesos-saas/pull/4) a [PR #8](https://github.com/rafamartinez21/procesos-saas/pull/8). Etiqueta `hito-2`.
- **Desviaciones:** ninguna detectada. Todo entró por pull request.

## Hito 3 (semana 3). Persistencia y roles

- **Objetivo:** capa de acceso a datos contra una base de datos real sin modificar la lógica; secretos en variables de entorno; roles con las restricciones del apartado 4.2 en el servidor; registro de actividad.
- **Qué se hizo:**
  - CAD de MongoDB con la misma interfaz que el de memoria, sin tocar `modelo.js`;
  - sesiones en MongoDB;
  - registro de actividad en JSON;
  - README del hito 3.

  Los roles ya se comprobaban en la lógica desde el hito 2.
- **PR y etiqueta:** [PR #9](https://github.com/rafamartinez21/procesos-saas/pull/9) a [PR #12](https://github.com/rafamartinez21/procesos-saas/pull/12). Etiqueta `hito-3`.
- **Desviaciones:** las ramas de los PR #9 a #12 se crearon una encima de otra y se integraron en orden. Todo entró por pull request.

## Hito 4 (semana 4). Servicios externos y cierre

- **Objetivo:** inicio de sesión con OAuth; confirmación de cuenta por correo; manejo de errores, README completo y revisión final.
- **Qué se hizo:**
  - confirmación de cuenta con un enlace de un solo uso, escrito en el log en lugar de enviado por correo ([PR #13](https://github.com/rafamartinez21/procesos-saas/pull/13));
  - CI con `npm ci` ([PR #14](https://github.com/rafamartinez21/procesos-saas/pull/14));
  - en la prueba individual, normalización y validación de email ([PR #15](https://github.com/rafamartinez21/procesos-saas/pull/15)).
- **Pendiente:** OAuth (RF-04) y envío real del correo (RF-02). Ver [sprint-2.md](sprint-2.md).
- **PR y etiqueta:** sin etiqueta de hito 4, porque el hito no está terminado.

## Retrospectiva

### Hechos

- 15 pull requests integrados (`gh pr list --state all`).
- 30 ejecuciones de la CI, todas en verde (`gh run list --limit 50`).
- 107 pruebas automatizadas, 34 de ellas de la capa de lógica (`npm test` y `node --test spec/modelo.test.js`).
- El paso de memoria a MongoDB no modificó la lógica: el [PR #9](https://github.com/rafamartinez21/procesos-saas/pull/9) no toca `servidor/modelo.js` (`gh pr view 9 --json files`).
- 22 de los 24 requisitos están hechos; RF-02 y RF-04 están pendientes (recuento de la columna Estado de [requisitos.md](requisitos.md)).

### Qué funcionó

TODO(alumno): ¿qué te funcionó bien en el Sprint 1 (por ejemplo, ramas pequeñas, pruebas antes del PR o el CAD inyectado)?

### Qué cambiaría

TODO(alumno): ¿qué harías distinto en el Sprint 2 (por ejemplo, empezar antes con los servicios externos o repartir más los commits en el tiempo)?
