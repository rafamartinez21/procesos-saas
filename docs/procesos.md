---
type: Proceso
title: Flujo de trabajo, CI y despliegue continuo
description: Cómo llega un cambio desde una rama hasta producción.
timestamp: 2026-10-28
---

# Procesos

## Flujo de trabajo

Se sigue GitHub Flow ([README](../README.md#flujo-de-trabajo)):

1. Una rama por cambio desde `main`, con un prefijo según el tipo: `feat/`, `ci/` o `docs/`.
2. Pruebas en local con `npm test` antes de abrir el pull request.
3. Pull request contra `main`, que se integra con un commit de merge cuando la CI está en verde.
4. Al terminar cada hito se pone una etiqueta en `main`: de `hito-1` a `hito-8`. La de `hito-4` se puso al cerrar RF-04 en el Sprint 2 (ver [sprint-1.md](sprint-1.md)).

**Evidencia:**
- 33 pull requests, todos integrados (`gh pr list --state all`). El PR #26 se integró antes de que arrancara su CI, que después pasó en verde ([log](log.md)).
- En `git log --first-parent main`, todos los commits son merges de pull requests, salvo el commit inicial `583a961`.

Por verificar: si la protección de la rama `main` está activada (Settings → Branches en GitHub).

## Integración continua

[.github/workflows/ci.yml](../.github/workflows/ci.yml):

- **Cuándo se ejecuta:** en cada pull request y en cada push a `main`.
- **Qué hace:**
  1. descarga el repositorio;
  2. instala Node 22;
  3. instala las dependencias con `npm ci`, que respeta las versiones exactas de `package-lock.json`;
  4. ejecuta `npm test`.
- **Pruebas:** `npm test` ejecuta 267. Las de MongoDB usan `mongodb-memory-server` y las de tiempo real arrancan el servidor en un puerto libre con el cliente oficial de Socket.IO, así que la CI no necesita secretos ni acceso a Atlas.
- **Resultados:** las 63 ejecuciones registradas están en verde (`gh run list --limit 200`).

## Despliegue continuo

- **Mecanismo:** un activador de Google Cloud Build conectado al repositorio. Construye y despliega en Google Cloud Run cada cambio que llega a `main`, sin pasos manuales. En GitHub aparece como una comprobación más en los commits de `main`.
- **Independencia del CI:** el despliegue no espera al resultado del CI; los dos funcionan por separado, como permite la especificación.
- **Configuración del servicio:** se hace con variables de entorno de Cloud Run. Los nombres están en el [README](../README.md#variables-de-entorno) y en [.env.example](../.env.example).
- **Por verificar:** la definición del activador (rama, región y servicio) no está en el repositorio; está en la consola de Google Cloud (Cloud Build → Activadores).
