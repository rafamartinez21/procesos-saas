---
type: Sprint
title: Sprint 3
description: Objetivo del Sprint 3 (nueva interfaz y más profundidad para Ecos de Aetheria), hitos 9 a 11 con sus requisitos y estimaciones, lo hecho en cada hito y retrospectiva.
timestamp: 2026-11-09
---

# Sprint 3

**Objetivo:** convertir **Ecos de Aetheria** en un juego con una interfaz a la altura y más profundidad. Al probar el juego del Sprint 2 salieron tres problemas:

- la interfaz es la de una aplicación de gestión: formularios, listas y un combate que se lee como una lista de textos, sin imágenes de las criaturas ni animación;
- la estrategia se reduce a elegir el movimiento más eficaz;
- encontrar rival depende de que alguien cree una partida y otro la vea, y un jugador puede dejar el combate parado sin elegir nunca.

Las reglas siguen en la capa de lógica del servidor (D-20). El cliente solo dibuja y anima lo que recibe.

**Fechas:** del 09/11/2026 al 07/12/2026. El Sprint 2 terminó sus 19 PBI el 09/11, antes del final previsto (13/11), así que el Sprint 3 empieza ese día.

**Acciones de la retrospectiva del Sprint 2 que se aplican:**

- cada PBI lleva horas estimadas (tablas de abajo y Donetonic);
- no se integra ningún pull request sin ver la comprobación de la CI en verde.

## Hitos

Cada hito termina con una etiqueta en `main` (`hito-9` … `hito-11`).

### Hito 9: nueva interfaz del juego

| ID | Requisito | Estimación | Estado |
|---|---|---|---|
| RF-26 | Identidad visual propia de Aetheria en todo el juego: portada, vestíbulo, elección de equipo y resultado, adaptada a móvil | 8 h | hecho |
| RF-27 | Retratos originales de las doce criaturas | 6 h | hecho |
| RF-28 | Arena de combate con el turno animado paso a paso (ataque, impacto, daño y PS); sin animaciones si el sistema pide reducir el movimiento | 8 h | hecho |
| RF-29 | Crónica completa del combate, turno a turno, también tras reconectarse | 2 h | hecho |

### Hito 10: más estrategia

| ID | Requisito | Estimación | Estado |
|---|---|---|---|
| RF-30 | Golpes críticos | 1 h | hecho |
| RF-31 | Movimientos de apoyo que suben o bajan estadísticas | 5 h | pendiente |
| RF-32 | Tiempo límite por turno: si no se elige, el servidor elige; tres turnos seguidos sin elegir pierden el combate | 5 h | pendiente |

### Hito 11: encontrar partida

| ID | Requisito | Estimación | Estado |
|---|---|---|---|
| RF-33 | Emparejamiento rápido con un rival de ELO parecido | 5 h | pendiente |
| RF-34 | Revancha al terminar un combate | 3 h | pendiente |

Total estimado: 43 h.

## Cómo se trabaja cada requisito

Igual que en el Sprint 2:

1. PBI en el tablero de Donetonic, en el Sprint 3, con su estimación.
2. Rama `feature/RF-xx-…` desde `main`. Si el requisito necesita una decisión de diseño, se añade a [decisiones.md](decisiones.md).
3. Pruebas en `spec/` y código.
4. Pull request con la CI en verde, merge y despliegue automático. El estado del requisito se actualiza aquí y en [requisitos.md](requisitos.md) en el mismo pull request.

## Qué se hizo en cada hito

### Hito 9: nueva interfaz del juego

- **Qué se hizo:**
  - retratos SVG originales de las doce criaturas, iconos de elemento y emblema (D-27);
  - identidad visual propia en todo el juego: portada, vestíbulo con modos de juego, sala de espera, elección de equipo con cartas y bandeja, progreso con rango y ranking con medallas, adaptado a móvil (D-28);
  - arena de combate con cada turno animado paso a paso; el servidor manda en los eventos los datos para animarlos y la eficacia de cada movimiento (D-29);
  - crónica completa del combate.
- **PR y etiqueta:** [PR #34](https://github.com/rafamartinez21/procesos-saas/pull/34) (plan), [PR #35](https://github.com/rafamartinez21/procesos-saas/pull/35) a [PR #38](https://github.com/rafamartinez21/procesos-saas/pull/38). Etiqueta `hito-9`.
- **Cómo se comprobó:** además de las pruebas automáticas, cada pantalla se revisó en el navegador con dos cuentas locales, en escritorio y a 375 px de ancho, jugando contra el Autómata y recargando en mitad del combate.

## Retrospectiva

Se completa al cerrar el sprint.
