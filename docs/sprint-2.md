---
type: Sprint
title: Sprint 2
description: Objetivo del Sprint 2 y requisitos que pasan del Sprint 1.
timestamp: 2026-10-28
---

# Sprint 2

**Objetivo:** Por definir.

## Requisitos que pasan del Sprint 1

| ID | Requisito | Estado | Qué falta |
|---|---|---|---|
| RF-02 | Confirmación de cuenta por correo | pendiente | Enviar el enlace por correo con un proveedor transaccional, cambiando la función `enviarConfirmacion` de [index.js](../index.js). La lógica, la ruta `/api/confirmar` y las pruebas ya existen. Hay que decidir el proveedor en [decisiones.md](decisiones.md) antes de programar. |
| RF-04 | Inicio de sesión con OAuth | pendiente | No implementado. Hay que decidir el proveedor y qué hacer si el correo ya tiene una cuenta local, y registrar las URL de retorno de localhost y de la URL pública. |
