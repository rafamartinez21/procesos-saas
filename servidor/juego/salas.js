// CAPA DE LÓGICA DEL JUEGO: salas de partida (hito 5, RF-11 a RF-14) y su combate (hito 6).
// Igual que modelo.js, no sabe nada de Socket.IO ni de HTTP (D-20): recibe jugadores
// ({ email, nombre }) y devuelve el estado. La capa de tiempo real decide a quién avisar.
// Las partidas viven en memoria mientras se juegan (D-21).

const crypto = require("node:crypto");
const { ErrorNegocio } = require("../modelo.js");
const { Combate, FASE_TERMINADA } = require("./combate.js");
const { elegirEquipoIA, elegirAccionIA } = require("./ia.js");

// Identificador del rival máquina (RF-25). No tiene "@", así que nunca coincide con el email
// de una cuenta (todos los emails válidos lo llevan).
const PREFIJO_MAQUINA = "maquina:";
const NOMBRE_MAQUINA = "Autómata de Aetheria";
const esMaquina = (email) => typeof email === "string" && email.startsWith(PREFIJO_MAQUINA);

// Chat de la partida (RF-22).
const LONGITUD_MAXIMA_MENSAJE = 200;
const MENSAJES_GUARDADOS = 50; // los últimos, para quien entra o se reconecta
const LIMITE_MENSAJES = 5; // como mucho 5 mensajes...
const VENTANA_LIMITE_MS = 10 * 1000; // ...cada 10 segundos por jugador

// Quita caracteres de control (saltos de línea incluidos) y espacios repetidos.
function limpiarTexto(texto) {
  return texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

const JUGADORES_POR_PARTIDA = 2;
const ESTADO_ABIERTA = "abierta"; // esperando rival
const ESTADO_COMPLETA = "completa"; // ya hay dos jugadores: se está combatiendo
const ESTADO_TERMINADA = "terminada"; // el combate ha acabado; los jugadores aún no han salido

// Código corto y legible para compartirlo de palabra, sin caracteres que se confunden
// (0 y O, 1 e I).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function codigoAleatorio(longitud = 5) {
  const bytes = crypto.randomBytes(longitud);
  let codigo = "";
  for (const b of bytes) codigo += ALFABETO[b % ALFABETO.length];
  return codigo;
}

function validarJugador(jugador) {
  if (!jugador || typeof jugador.email !== "string" || !jugador.email) {
    throw new ErrorNegocio("NO_AUTENTICADO", "Debes iniciar sesión para jugar");
  }
  // Nombre visible: si la cuenta no tiene nombre, la parte del email antes de la "@".
  // Los emails nunca se muestran a otros jugadores.
  const nombre = (typeof jugador.nombre === "string" && jugador.nombre.trim()) || jugador.email.split("@")[0];
  return { email: jugador.email, nombre };
}

// Lo que ven los demás de una partida: sin emails.
function vistaPublica(partida) {
  return {
    id: partida.id,
    estado: partida.estado,
    creador: partida.jugadores[0] ? partida.jugadores[0].nombre : null,
    jugadores: partida.jugadores.map((j) => j.nombre),
    plazas: JUGADORES_POR_PARTIDA - partida.jugadores.length,
    creada: partida.creada,
  };
}

// aleatorio: se pasa a cada combate (las pruebas lo fijan).
// alTerminar(resultado): se llama una vez por combate terminado con
//   { id, jugadores: [{email, nombre}] , ganador: email|null, motivo, turnos }.
function Salas({ generarId = codigoAleatorio, ahora = () => Date.now(), aleatorio = Math.random, alTerminar = () => {} } = {}) {
  const partidas = new Map(); // id -> { id, estado, jugadores: [{email, nombre}], creada, combate, participantes }

  // Partida interna (con emails) en la que está un jugador, o undefined.
  const buscarDe = (email) => {
    for (const p of partidas.values()) {
      if (p.jugadores.some((j) => j.email === email)) return p;
    }
    return undefined;
  };

  const buscar = (id) => {
    const p = typeof id === "string" ? partidas.get(id.trim().toUpperCase()) : undefined;
    if (!p) throw new ErrorNegocio("PARTIDA_NO_ENCONTRADA", "La partida no existe");
    return p;
  };

  const exigirLibre = (email) => {
    if (buscarDe(email)) {
      throw new ErrorNegocio("YA_EN_PARTIDA", "Ya estás en una partida; abandónala antes de entrar en otra");
    }
  };

  // Vista pública de la partida del jugador, o null.
  this.partidaDe = function (email) {
    const p = buscarDe(email);
    return p ? vistaPublica(p) : null;
  };

  // RF-11: el creador queda como primer jugador y la partida espera a un rival.
  this.crearPartida = function (jugador) {
    const j = validarJugador(jugador);
    exigirLibre(j.email);
    let id = generarId();
    while (partidas.has(id)) id = generarId();
    const partida = { id, estado: ESTADO_ABIERTA, jugadores: [j], creada: ahora() };
    partidas.set(id, partida);
    return vistaPublica(partida);
  };

  // RF-12: solo las que aún admiten jugadores, de la más antigua a la más nueva.
  this.listarAbiertas = function () {
    return [...partidas.values()]
      .filter((p) => p.estado === ESTADO_ABIERTA)
      .sort((a, b) => a.creada - b.creada)
      .map(vistaPublica);
  };

  this.obtener = function (id) {
    return vistaPublica(buscar(id));
  };

  // RF-13: máximo dos jugadores; con el segundo la partida queda completa.
  this.unirse = function (id, jugador) {
    const j = validarJugador(jugador);
    const partida = buscar(id);
    if (partida.jugadores.some((x) => x.email === j.email)) {
      throw new ErrorNegocio("YA_EN_PARTIDA", "Ya estás en esta partida");
    }
    exigirLibre(j.email);
    if (partida.estado !== ESTADO_ABIERTA || partida.jugadores.length >= JUGADORES_POR_PARTIDA) {
      throw new ErrorNegocio("PARTIDA_LLENA", "La partida ya tiene dos jugadores");
    }
    partida.jugadores.push(j);
    if (partida.jugadores.length === JUGADORES_POR_PARTIDA) {
      // Con dos jugadores empieza el combate (hito 6): primero, elegir equipos.
      partida.estado = ESTADO_COMPLETA;
      partida.participantes = partida.jugadores.map((x) => ({ ...x }));
      partida.combate = new Combate(partida.participantes.map((x) => x.email), { aleatorio });
    }
    return vistaPublica(partida);
  };

  // Si el combate acaba de terminar, la partida pasa a terminada y se avisa una sola vez.
  // Las partidas contra la máquina no cuentan para el historial ni el ranking (D-25).
  const comprobarFinal = (partida) => {
    if (partida.estado === ESTADO_COMPLETA && partida.combate.fase === FASE_TERMINADA) {
      partida.estado = ESTADO_TERMINADA;
      if (partida.contraMaquina) return;
      alTerminar({
        id: partida.id,
        jugadores: partida.participantes,
        ganador: partida.combate.ganador,
        motivo: partida.combate.motivo,
        turnos: partida.combate.turno,
      });
    }
  };

  // La máquina actúa en cuanto le toca, con la misma vista que tendría un jugador (D-25).
  const jugarMaquina = (partida) => {
    if (!partida.contraMaquina) return;
    const id = partida.participantes[1].email;
    const c = partida.combate;
    if (c.fase === "seleccion" && !c.vista(id).yo.equipo) c.elegirEquipo(id, elegirEquipoIA(aleatorio));
    const accion = elegirAccionIA(c.vista(id), aleatorio);
    if (accion) {
      c.elegirAccion(id, accion);
      comprobarFinal(partida);
      // Tras un cambio obligado propio puede volver a tocarle (nuevo turno).
      if (c.fase !== FASE_TERMINADA) jugarMaquina(partida);
    }
  };

  // RF-25: partida contra la máquina. Empieza ya completa y no aparece en la lista.
  this.crearPartidaContraMaquina = function (jugador) {
    const j = validarJugador(jugador);
    exigirLibre(j.email);
    let id = generarId();
    while (partidas.has(id)) id = generarId();
    const maquina = { email: `${PREFIJO_MAQUINA}${id}`, nombre: NOMBRE_MAQUINA };
    const partida = { id, estado: ESTADO_COMPLETA, jugadores: [j, maquina], creada: ahora(), contraMaquina: true };
    partida.participantes = partida.jugadores.map((x) => ({ ...x }));
    partida.combate = new Combate([j.email, maquina.email], { aleatorio });
    partidas.set(id, partida);
    jugarMaquina(partida);
    return vistaPublica(partida);
  };

  const combateDe = (email) => {
    const partida = buscarDe(email);
    if (!partida || !partida.combate) throw new ErrorNegocio("NO_EN_COMBATE", "No estás en ningún combate");
    return partida;
  };

  // RF-16 y RF-17: se delega en el combate de la partida del jugador.
  // Devuelven el id de la partida para que la capa de tiempo real avise a los dos jugadores.
  this.elegirEquipo = function (email, ids) {
    const partida = combateDe(email);
    partida.combate.elegirEquipo(email, ids);
    jugarMaquina(partida);
    return partida.id;
  };

  this.elegirAccion = function (email, accion) {
    const partida = combateDe(email);
    partida.combate.elegirAccion(email, accion);
    comprobarFinal(partida);
    if (partida.combate.fase !== FASE_TERMINADA) jugarMaquina(partida);
    return partida.id;
  };

  // Lo que ve un jugador de su combate, o null si su partida aún no tiene combate.
  this.vistaCombate = function (email) {
    const partida = buscarDe(email);
    return partida && partida.combate ? partida.combate.vista(email) : null;
  };

  // RF-22: mensaje en el chat de la partida del jugador. Devuelve { id, mensaje } para que
  // la capa de tiempo real lo difunda. El texto se limpia y se limita; el cliente lo pinta
  // siempre como texto, nunca como HTML.
  this.enviarMensaje = function (email, texto) {
    const partida = buscarDe(email);
    if (!partida) throw new ErrorNegocio("NO_EN_PARTIDA", "No estás en ninguna partida");
    const limpio = typeof texto === "string" ? limpiarTexto(texto) : "";
    if (!limpio) throw new ErrorNegocio("MENSAJE_INVALIDO", "El mensaje está vacío");
    if (limpio.length > LONGITUD_MAXIMA_MENSAJE) {
      throw new ErrorNegocio("MENSAJE_INVALIDO", `El mensaje no puede tener más de ${LONGITUD_MAXIMA_MENSAJE} caracteres`);
    }
    const t = ahora();
    partida.envios = (partida.envios || []).filter((e) => e.email !== email || t - e.t < VENTANA_LIMITE_MS);
    if (partida.envios.filter((e) => e.email === email).length >= LIMITE_MENSAJES) {
      throw new ErrorNegocio("DEMASIADOS_MENSAJES", "Estás enviando mensajes muy deprisa; espera unos segundos");
    }
    partida.envios.push({ email, t });
    const autor = partida.jugadores.find((j) => j.email === email).nombre;
    const mensaje = { autor, texto: limpio, fecha: t };
    partida.chat = [...(partida.chat || []), mensaje].slice(-MENSAJES_GUARDADOS);
    return { id: partida.id, mensaje };
  };

  // Últimos mensajes del chat de la partida del jugador (para quien se reconecta).
  this.chatDe = function (email) {
    const partida = buscarDe(email);
    return partida && partida.chat ? partida.chat.map((m) => ({ ...m })) : [];
  };

  // Emails de los dos participantes del combate (incluido quien ya ha salido), para avisarles.
  this.participantesDe = function (id) {
    const p = buscar(id);
    return (p.participantes || p.jugadores).map((j) => j.email);
  };

  // RF-14 y RF-18: quien abandona sale de la partida.
  //  - Si el combate está en curso, lo pierde: gana el rival (RF-18).
  //  - Cuando no queda nadie, la partida desaparece.
  // Devuelve { id, partida (vista pública, o null si se eliminó), restantes: [emails] }
  // para que la capa de tiempo real avise a quien queda.
  this.abandonar = function (email) {
    const partida = buscarDe(email);
    if (!partida) throw new ErrorNegocio("NO_EN_PARTIDA", "No estás en ninguna partida");
    if (partida.estado === ESTADO_COMPLETA) {
      partida.combate.abandonar(email);
      comprobarFinal(partida);
    }
    // La máquina no se queda sola en una partida: si sale el humano, la partida desaparece.
    partida.jugadores = partida.jugadores.filter((j) => j.email !== email && !esMaquina(j.email));
    if (partida.jugadores.length === 0) {
      partidas.delete(partida.id);
      return { id: partida.id, partida: null, restantes: [] };
    }
    return { id: partida.id, partida: vistaPublica(partida), restantes: partida.jugadores.map((j) => j.email) };
  };

  // Emails de los jugadores (solo para la capa de tiempo real, que avisa a cada uno).
  this.emailsDe = function (id) {
    return buscar(id).jugadores.map((j) => j.email);
  };
}

module.exports = { Salas, esMaquina, NOMBRE_MAQUINA, vistaPublica, codigoAleatorio, JUGADORES_POR_PARTIDA, ESTADO_ABIERTA, ESTADO_COMPLETA, ESTADO_TERMINADA };
