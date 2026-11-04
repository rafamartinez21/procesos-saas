---
type: Sprint
title: Sprint 2
description: Objetivo del Sprint 2 (el juego Ecos de Aetheria), sus hitos y requisitos, y los requisitos que pasan del Sprint 1.
timestamp: 2026-11-04
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
| RF-22 | Chat dentro de la partida | pendiente |
| RF-23 | Modo espectador | pendiente |
| RF-24 | Reconexión a una partida en curso | pendiente |
| RF-25 | Rival controlado por la máquina | hecho |

## Cómo se trabaja cada requisito

1. PBI en el tablero de Donetonic, en el Sprint 2.
2. Rama `feature/RF-xx-…` desde `main`. Si el requisito necesita una decisión de diseño, el primer commit la añade a [decisiones.md](decisiones.md).
3. Pruebas en `spec/` (con dobles para lo externo) y código.
4. Pull request con la CI en verde, merge y despliegue automático. El estado del requisito se actualiza aquí y en [requisitos.md](requisitos.md) en el mismo pull request.

## Requisitos que pasan del Sprint 1

| ID | Requisito | Estado | Qué falta |
|---|---|---|---|
| RF-02 | Confirmación de cuenta por correo | hecho | Correo con Brevo (D-16) y reenvío del enlace. Ver [requisitos.md](requisitos.md). |
| RF-04 | Inicio de sesión con OAuth | hecho | Google (D-17); un email con cuenta local se rechaza (D-18). Por verificar: credenciales de Google en Cloud Run (etiqueta `hito-4` pendiente de esa comprobación). |
