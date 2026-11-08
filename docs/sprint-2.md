---
type: Sprint
title: Sprint 2
description: Objetivo del Sprint 2 (el juego Ecos de Aetheria), hitos 5 a 8 con sus requisitos, lo hecho en cada hito y retrospectiva.
timestamp: 2026-11-05
---

# Sprint 2

**Objetivo:** convertir el sistema en un juego multijugador en tiempo real, **Ecos de Aetheria**: duelos por turnos entre dos jugadores, cada uno con un equipo de tres criaturas elementales. El mundo, las criaturas y sus nombres son originales.

La lógica del juego vive en la capa de lógica del servidor, que decide todo (D-20). El cliente solo envía intenciones ("ataco con X") y dibuja el estado que recibe. La comunicación en tiempo real usa Socket.IO (D-19).

## Hitos

Cada hito termina con una etiqueta en `main` (`hito-5` … `hito-8`), como en el Sprint 1.

### Hito 5: salas de partida en tiempo real

| ID | Requisito | Estado |
|---|---|---|
| RF-11 | Crear una partida (queda abierta esperando rival) | hecho |
| RF-12 | Ver en directo la lista de partidas abiertas | hecho |
| RF-13 | Unirse a una partida abierta (máximo dos jugadores) | hecho |
| RF-14 | Abandonar una partida | hecho |
| RNF-09 | El canal en tiempo real exige una sesión válida (la misma cookie `sid`) | hecho |

### Hito 6: combate

| ID | Requisito | Estado |
|---|---|---|
| RF-15 | Catálogo de criaturas con seis elementos y tabla de eficacias | hecho |
| RF-16 | Elegir un equipo de tres criaturas antes del combate | hecho |
| RF-17 | Turnos: atacar o cambiar de criatura, cálculo de daño y estados alterados | hecho |
| RF-18 | Fin de la partida y ganador (o victoria si el rival abandona) | hecho |
| RNF-10 | El servidor valida cada acción: un cliente no puede actuar fuera de turno ni inventar ataques | hecho |

### Hito 7: progreso del jugador

| ID | Requisito | Estado |
|---|---|---|
| RF-19 | Historial de partidas guardado en MongoDB | hecho |
| RF-20 | Ranking con puntuación ELO | hecho |
| RF-21 | Perfil del jugador con sus estadísticas | hecho |

### Hito 8: extras

| ID | Requisito | Estado |
|---|---|---|
| RF-22 | Chat dentro de la partida | hecho |
| RF-23 | Modo espectador | hecho |
| RF-24 | Reconexión a una partida en curso | hecho |
| RF-25 | Rival controlado por la máquina | hecho |

## Cómo se trabaja cada requisito

1. PBI en el tablero de Donetonic, en el Sprint 2.
2. Rama `feature/RF-xx-…` desde `main`. Si el requisito necesita una decisión de diseño, el primer commit la añade a [decisiones.md](decisiones.md).
3. Pruebas en `spec/` (con dobles para lo externo) y código.
4. Pull request con la CI en verde, merge y despliegue automático. El estado del requisito se actualiza aquí y en [requisitos.md](requisitos.md) en el mismo pull request.

## Qué se hizo en cada hito

### Hito 5: salas de partida en tiempo real

- **Qué se hizo:** lógica de salas (`servidor/juego/salas.js`) y capa de tiempo real con Socket.IO autenticada con la cookie de sesión (`servidor/tiempo-real.js`, D-19 a D-21). Vestíbulo en la interfaz con lista en directo.
- **PR y etiqueta:** [PR #19](https://github.com/rafamartinez21/procesos-saas/pull/19) (plan), [PR #20](https://github.com/rafamartinez21/procesos-saas/pull/20) y [PR #21](https://github.com/rafamartinez21/procesos-saas/pull/21). Etiqueta `hito-5`.

### Hito 6: combate

- **Qué se hizo:** catálogo de doce criaturas y tabla de eficacias equilibrada (D-22), motor de combate con turnos simultáneos (D-23) y pantalla de combate.
- **PR y etiqueta:** [PR #22](https://github.com/rafamartinez21/procesos-saas/pull/22) a [PR #24](https://github.com/rafamartinez21/procesos-saas/pull/24). Etiqueta `hito-6`.

### Hito 7: progreso del jugador

- **Qué se hizo:** historial en MongoDB, ranking ELO (D-24) y panel de estadísticas.
- **PR y etiqueta:** [PR #26](https://github.com/rafamartinez21/procesos-saas/pull/26). Etiqueta `hito-7`.
- **Desviaciones:** el PR #26 se integró antes de que arrancara la CI. La ejecución posterior del PR y la de `main` pasaron en verde. Desde entonces, antes de integrar se espera a que exista la comprobación.

### Hito 8: extras

- **Qué se hizo:** rival máquina que juega con la misma información que un jugador (D-25), chat, modo espectador (D-26) y reconexión.
- **PR y etiqueta:** [PR #27](https://github.com/rafamartinez21/procesos-saas/pull/27) a [PR #30](https://github.com/rafamartinez21/procesos-saas/pull/30). Etiqueta `hito-8`.

## Retrospectiva

- **Qué funcionó:**
  - separar la lógica del juego de Socket.IO (D-20) permitió probar el combate entero con pruebas unitarias deterministas (azar inyectado) antes de conectarlo;
  - las pruebas de tiempo real con el cliente oficial de Socket.IO detectaron una condición de carrera en el orden de los avisos;
  - la prueba de 40 partidas máquina contra máquina recorre 349 turnos (825 acciones) y confirma que la máquina nunca hace una acción inválida.
- **Qué mejorar:**
  - el PR #26 se integró sin esperar a la CI;
  - las partidas en curso viven en memoria (D-21), así que el servicio necesita una sola instancia y un reinicio termina las partidas.
- **Por verificar:**
  - en Cloud Run, número máximo de instancias igual a 1 (D-21);
  - en Cloud Run, tiempo máximo de petición: los WebSockets se cortan al llegar a él, aunque se recuperan con la reconexión (RF-24).

## Requisitos que pasan del Sprint 1

| ID | Requisito | Estado | Qué falta |
|---|---|---|---|
| RF-02 | Confirmación de cuenta por correo | hecho | Correo con Brevo (D-16) y reenvío del enlace. Ver [requisitos.md](requisitos.md). |
| RF-04 | Inicio de sesión con OAuth | hecho | Google (D-17); un email con cuenta local se rechaza (D-18). Por verificar: credenciales de Google en Cloud Run (etiqueta `hito-4` pendiente de esa comprobación). |
