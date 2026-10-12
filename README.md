# Sistema — Procesos de Ingeniería del Software (Sprint 1)

Aplicación web tipo SaaS organizada en capas, con gestión de usuarios.

**Estado:** hito 1 (esqueleto, CI/CD, lógica de usuarios en memoria con tests y API).

- URL pública: _(pendiente de completar tras el despliegue)_

## Tecnologías elegidas

| Tecnología | Por qué |
|---|---|
| Node.js | Un solo lenguaje (JavaScript) en servidor y cliente, el mismo que usa el material del curso. |
| Express | Framework HTTP mínimo y muy extendido para construir la API y servir el frontend desde el mismo origen. |
| `node:test` (incluido en Node) | Framework de pruebas integrado: no añade dependencias y se ejecuta con un único comando. |
| GitHub Actions | CI integrada en el repositorio, sin servicios externos. |

_(Se irán añadiendo la base de datos, el hash de contraseñas, OAuth, correo y proveedor cloud con su justificación.)_

## Arquitectura

```
cliente/            Frontend (hoy solo una página mínima; hito 2: interfaz + cliente de comunicación)
servidor/
  api.js            Capa API: HTTP <-> lógica. Sin reglas de negocio.
  modelo.js         Capa de lógica de negocio: reglas de gestión de usuarios. Sin HTTP ni datos.
  cad-memoria.js    Capa de acceso a datos (en memoria). En el hito 3 se añade una versión con base de datos.
index.js            Ensambla las capas y arranca el servidor.
spec/               Pruebas automatizadas de la lógica.
```

Flujo de una petición: `api.js` → `modelo.js` → `cad-*.js`. Cada capa solo conoce a la de debajo, y la lógica recibe el CAD por parámetro (`new Sistema(cad)`), por eso cambiar de memoria a base de datos no obliga a tocarla.

## Ejecutar en local

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env   # opcional en el hito 1
npm start
```

Abre http://localhost:3000.

## Ejecutar las pruebas

```bash
npm test
```

## Variables de entorno

Solo nombres; los valores van en `.env` (no se sube al repositorio). Ver `.env.example`.

- `PORT`

## Acceso como administrador para la revisión

_(Pendiente: se definirá en el hito 3. Las credenciales de prueba se envían junto con la entrega, nunca en el repositorio.)_

## Flujo de trabajo

GitHub Flow: una rama por cambio, tests en local antes del pull request, integración en `main` mediante pull request con la CI en verde. Cada hito se marca con una etiqueta (`hito-1`, `hito-2`…).
