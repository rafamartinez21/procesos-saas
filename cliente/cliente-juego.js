// CLIENTE DE COMUNICACIÓN EN TIEMPO REAL (frontend)
// Igual que cliente-api.js para la API REST, es la ÚNICA parte del frontend que usa
// Socket.IO. La interfaz se suscribe a avisos y llama a estas funciones; no conoce los
// nombres de los eventos ni cómo viajan.
//
// La conexión usa la cookie de sesión que el navegador ya tiene (mismo origen), así que
// solo funciona con la sesión iniciada (RNF-09).

import { io } from "/socket.io/socket.io.esm.min.js";

export class ErrorJuego extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = "ErrorJuego";
    this.codigo = codigo;
  }
}

let socket = null;

// Envía una acción y espera la respuesta del servidor (ack). Rechaza con ErrorJuego.
function accion(evento, datos) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new ErrorJuego("SIN_CONEXION", "No hay conexión con el servidor de partidas."));
    }
    const responder = (r) => (r && r.ok ? resolve(r.partida) : reject(new ErrorJuego(r && r.error, (r && r.mensaje) || "Error inesperado.")));
    if (datos === undefined) socket.timeout(8000).emit(evento, (err, r) => (err ? reject(new ErrorJuego("SIN_RESPUESTA", "El servidor no responde.")) : responder(r)));
    else socket.timeout(8000).emit(evento, datos, (err, r) => (err ? reject(new ErrorJuego("SIN_RESPUESTA", "El servidor no responde.")) : responder(r)));
  });
}

export const ClienteJuego = {
  // avisos: { alCambiarLista(partidas), alCambiarPartida(partida), alAbandonarRival(partida),
  //           alCambiarCombate(vista), alRecibirMensaje(m), alRecibirHistorialChat(lista),
//           alCambiarEnCurso(lista), alCambiarEspectador(vista), alTerminarEspectador(), alDesconectar(motivo) }
  conectar(avisos = {}) {
    this.desconectar();
    socket = io({ transports: ["websocket", "polling"] });
    socket.on("partidas", (lista) => avisos.alCambiarLista && avisos.alCambiarLista(lista));
    socket.on("partida:estado", (p) => avisos.alCambiarPartida && avisos.alCambiarPartida(p));
    socket.on("partida:rival-abandona", (p) => avisos.alAbandonarRival && avisos.alAbandonarRival(p));
    socket.on("combate:estado", (v) => avisos.alCambiarCombate && avisos.alCambiarCombate(v));
    socket.on("chat:mensaje", (m) => avisos.alRecibirMensaje && avisos.alRecibirMensaje(m));
    socket.on("partidas:en-curso", (l) => avisos.alCambiarEnCurso && avisos.alCambiarEnCurso(l));
    socket.on("espectador:estado", (v) => avisos.alCambiarEspectador && avisos.alCambiarEspectador(v));
    socket.on("espectador:fin", () => avisos.alTerminarEspectador && avisos.alTerminarEspectador());
    socket.on("chat:historial", (lista) => avisos.alRecibirHistorialChat && avisos.alRecibirHistorialChat(lista));
    socket.on("connect", () => avisos.alConectar && avisos.alConectar());
    socket.on("connect_error", (err) => avisos.alDesconectar && avisos.alDesconectar(err.message));
    socket.on("disconnect", (motivo) => avisos.alDesconectar && avisos.alDesconectar(motivo));
  },
  desconectar() {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  },
  crearPartida: () => accion("partida:crear"),
  crearContraMaquina: () => accion("partida:crear-maquina"),
  unirse: (id) => accion("partida:unirse", { id }),
  abandonar: () => accion("partida:abandonar"),
  elegirEquipo: (criaturas) => accion("combate:equipo", { criaturas }),
  atacar: (movimiento) => accion("combate:accion", { tipo: "atacar", movimiento }),
  cambiar: (indice) => accion("combate:accion", { tipo: "cambiar", indice }),
  enviarMensaje: (texto) => accion("chat:enviar", { texto }),
  observar: (id) => accion("partida:observar", { id }),
  dejarDeObservar: () => accion("partida:dejar-observar"),
};
