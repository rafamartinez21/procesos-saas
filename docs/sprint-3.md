---
type: Sprint
title: Sprint 3
description: Objetivo del Sprint 3 (nueva interfaz y más profundidad para Ecos de Aetheria), hitos 9 a 12 con sus requisitos y estimaciones, lo hecho en cada hito y retrospectiva.
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

Cada hito termina con una etiqueta en `main` (`hito-9` … `hito-12`).

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
| RF-31 | Movimientos de apoyo que suben o bajan estadísticas | 5 h | hecho |
| RF-32 | Tiempo límite por turno: si no se elige, el servidor elige; tres turnos seguidos sin elegir pierden el combate | 5 h | hecho |

### Hito 11: encontrar partida

| ID | Requisito | Estimación | Estado |
|---|---|---|---|
| RF-33 | Emparejamiento rápido con un rival de ELO parecido | 5 h | hecho |
| RF-34 | Revancha al terminar un combate | 3 h | hecho |

### Hito 12: un combate que se vea bien

Añadido el 15/11 al probar el hito 11: las criaturas seguían viéndose planas, el fondo de la arena era el mismo en todos los combates y en un portátil había que bajar para elegir el movimiento, así que no se veía el combate mientras se jugaba.

| ID | Requisito | Estimación | Estado |
|---|---|---|---|
| RF-35 | Criaturas con volumen y aspectos a elegir (normal, astral y sombra) que ven el rival y el público | 6 h | hecho |
| RF-36 | Arena viva: un paraje por elemento con su ambiente, proyectiles y partículas de cada elemento, rótulos de turno y modo cine; la arena y los controles se ven a la vez en portátil y en móvil | 8 h | hecho |
| RF-37 | Los jugadores ven cuánta gente mira su combate en directo | 2 h | hecho |

Total estimado: 59 h (43 h de los hitos 9 a 11 y 16 h del hito 12).

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

### Hito 10: más estrategia

- **Qué se hizo:**
  - golpes críticos (1/16, daño x1,5);
  - seis movimientos de apoyo y etapas de estadísticas de -2 a +2 que se pierden al cambiar (D-30); el Autómata los usa cuando le convienen;
  - tiempo límite para decidir, con elección automática del servidor y derrota por inactividad a la tercera vez seguida (D-31).
- **PR y etiqueta:** [PR #39](https://github.com/rafamartinez21/procesos-saas/pull/39) a [PR #41](https://github.com/rafamartinez21/procesos-saas/pull/41). Etiqueta `hito-10`.
- **Desviaciones:** la tirada de crítico se añadió después de la variación de daño, así que hubo que ajustar las secuencias de azar de cuatro pruebas de estados del Sprint 2. No cambió lo que comprueban.

### Hito 11: encontrar partida

- **Qué se hizo:** duelo rápido con emparejamiento por ELO y margen creciente, y revancha en la misma partida.
- **PR y etiqueta:** [PR #42](https://github.com/rafamartinez21/procesos-saas/pull/42) (RF-33 y RF-34 juntos, porque los dos cambian cómo empieza un combate en `Salas`). Etiqueta `hito-11`.

### Hito 12: un combate que se vea bien

- **Qué se hizo:**
  - las doce criaturas tienen volumen (contorno, sombra propia y luz de borde con un filtro SVG), parpadean y pueden llevar tres aspectos: normal, astral y sombra (D-32). El aspecto se elige debajo de cada criatura de la bandeja, el navegador recuerda el preferido y el servidor lo valida y lo manda al rival y al público;
  - seis parajes dibujados en SVG, uno por elemento (Caldera de Ígnea, Lago de la Marea Quieta, Bosque de los Susurros, Cumbre de la Tormenta, Cañón de los Gigantes e Islas del Cielo Abierto), con su ambiente animado (brasas, lluvia, hojas, relámpagos, polvo o rachas de viento). El servidor elige el paraje al empezar el combate (D-33);
  - cada ataque lanza un proyectil del elemento del movimiento (bola de fuego, chorro de agua, hojas, rayo, rocas o cortes de viento) que estalla en partículas; los críticos destellan, las criaturas que caen se deshacen en polvo de éter, las que entran lo hacen sobre un círculo de invocación y los estados alterados se ven sobre la criatura (brasas, escarcha o chispas). Cada turno empieza con su rótulo y la barra de PS deja marcado un momento el trozo perdido;
  - en pantallas anchas la arena y los controles van uno al lado del otro, y en el móvil la arena es cuadrada: en los dos casos se ven el combate y los cuatro movimientos sin bajar. Botón de modo cine (pantalla completa);
  - la bandeja del equipo se queda fija abajo de la pantalla mientras se eligen criaturas. Desde el hito 9 se quedaba al final de la página, porque el desenfoque del panel hacía de bloque contenedor de un elemento `position: fixed`;
  - los jugadores ven en la arena cuánta gente mira el combate, y el número cambia en cuanto alguien entra o sale.
- **PR y etiqueta:** [PR #43](https://github.com/rafamartinez21/procesos-saas/pull/43). Etiqueta `hito-12`.
- **Cómo se comprobó:** pruebas "RF-35", "RF-36" y "RF-37" en `spec/` (322 en total). En el navegador, con dos cuentas locales: elección de aspectos, duelo rápido contra un segundo jugador, un espectador entrando a mirar, recarga en mitad del combate (mismo paraje), revancha y modo espectador, en escritorio y a 375 px. El modo cine no se pudo comprobar: el navegador de pruebas no permite la pantalla completa.
- **Desviaciones:** los tres requisitos van en un solo pull request porque comparten la arena y la vista del combate; separarlos habría obligado a deshacer y rehacer los mismos archivos. Es el mismo caso que el hito 11.

## Retrospectiva

Se completa al cerrar el sprint.
