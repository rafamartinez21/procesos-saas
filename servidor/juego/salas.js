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

// RF-32: tiempo para decidir. Si se acaba, el servidor elige por el jugador (con la misma
// lógica que el Autómata) y, a la tercera vez seguida, el jugador pierde por inactividad.
const PLAZO_EQUIPO_MS = 60 * 1000;
const PLAZO_TURNO_MS = 45 * 1000;
const AUSENCIAS_PARA_PERDER = 3;

// RF-33: emparejamiento rápido. Dos jugadores se emparejan si la diferencia de ELO no pasa
// del margen de los dos. El margen empieza en 100 y crece 50 cada 10 s de espera, hasta 400:
// primero se busca alguien parecido y, si no hay, poco a poco se acepta a cualquiera.
const MARGEN_ELO_INICIAL = 100;
const MARGEN_ELO_PASO = 50;
const MARGEN_ELO_CADA_MS = 10 * 1000;
const MARGEN_ELO_MAXIMO = 400;
function margenElo(esperaMs) {
  return Math.min(MARGEN_ELO_MAXIMO, MARGEN_ELO_INICIAL + MARGEN_ELO_PASO * Math.floor(Math.max(0, esperaMs) / MARGEN_ELO_CADA_MS));
}
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
    espectadores: partida.espectadores ? partida.espectadores.size : 0,
  };
}

// aleatorio: se pasa a cada combate (las pruebas lo fijan).
// alTerminar(resultado): se llama una vez por combate terminado con
//   { id, jugadores: [{email, nombre}] , ganador: email|null, motivo, turnos }.
function Salas({
  generarId = codigoAleatorio,
  ahora = () => Date.now(),
  aleatorio = Math.random,
  alTerminar = () => {},
  plazoEquipoMs = PLAZO_EQUIPO_MS,
  plazoTurnoMs = PLAZO_TURNO_MS,
} = {}) {
  const partidas = new Map(); // id -> { id, estado, jugadores: [{email, nombre}], creada, combate, participantes, espectadores }
  const observando = new Map(); // email del espectador -> id de la partida (RF-23)
  const cola = new Map(); // RF-33: email -> { jugador, elo, desde }

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
    if (buscarDe(email) || observando.has(email)) {
      throw new ErrorNegocio("YA_EN_PARTIDA", "Ya estás en una partida; abandónala antes de entrar en otra");
    }
    if (cola.has(email)) throw new ErrorNegocio("BUSCANDO_RIVAL", "Estás buscando rival; cancela la búsqueda antes");
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
      empezarCombate(partida);
    }
    return vistaPublica(partida);
  };

  // Empieza un combate (el primero o una revancha) entre los dos jugadores de la partida.
  function empezarCombate(partida) {
    partida.estado = ESTADO_COMPLETA;
    partida.participantes = partida.jugadores.map((x) => ({ ...x }));
    partida.combate = new Combate(partida.participantes.map((x) => x.email), { aleatorio });
    partida.ronda = (partida.ronda || 0) + 1;
    partida.revancha = new Set();
    partida.ausencias = {};
    partida.firmaPlazo = null;
    jugarMaquina(partida);
    actualizarPlazo(partida);
  }

  // Si el combate acaba de terminar, la partida pasa a terminada y se avisa una sola vez.
  // Las partidas contra la máquina no cuentan para el historial ni el ranking (D-25).
  const comprobarFinal = (partida) => {
    if (partida.estado === ESTADO_COMPLETA && partida.combate.fase === FASE_TERMINADA) {
      partida.estado = ESTADO_TERMINADA;
      if (partida.contraMaquina) return;
      alTerminar({
        // Cada combate de la partida (RF-34: revanchas) tiene su propio id de resultado.
        id: partida.ronda > 1 ? `${partida.id}-${partida.ronda}` : partida.id,
        jugadores: partida.participantes,
        ganador: partida.combate.ganador,
        motivo: partida.combate.motivo,
        turnos: partida.combate.turno,
      });
    }
  };

  // ---------- RF-32: plazos para decidir ----------

  // Quién debe decidir ahora en un combate (emails humanos): en la elección de equipo, quien
  // aún no lo tiene; en el combate, quien debe sacar otra criatura o, si nadie, quien aún no
  // ha elegido acción.
  const pendientesDe = (partida) => {
    const c = partida.combate;
    if (!c || c.fase === FASE_TERMINADA) return [];
    const humanos = partida.participantes.map((j) => j.email).filter((e) => !esMaquina(e));
    const vistas = humanos.map((e) => [e, c.vista(e)]);
    if (c.fase === "seleccion") return vistas.filter(([, v]) => !v.yo.equipo).map(([e]) => e);
    if (vistas.some(([, v]) => v.yo.debeCambiar || v.rival.debeCambiar)) return vistas.filter(([, v]) => v.yo.debeCambiar).map(([e]) => e);
    return vistas.filter(([, v]) => !v.yo.eleccionHecha).map(([e]) => e);
  };

  // Cada vez que se abre una decisión nueva (empieza la elección, se resuelve un turno o un
  // cambio obligado), el plazo vuelve a empezar.
  const actualizarPlazo = (partida) => {
    const c = partida.combate;
    if (!c || c.fase === FASE_TERMINADA) {
      partida.plazo = null;
      return;
    }
    const firma = `${c.fase}|${c.turno}|${c.cronica.length}`;
    if (firma !== partida.firmaPlazo) {
      partida.firmaPlazo = firma;
      partida.plazo = ahora() + (c.fase === "seleccion" ? plazoEquipoMs : plazoTurnoMs);
    }
  };

  // Quien decide por sí mismo vuelve a contar desde cero.
  const presente = (partida, email) => {
    if (partida.ausencias) partida.ausencias[email] = 0;
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
    partidas.set(id, partida);
    empezarCombate(partida);
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
    presente(partida, email);
    jugarMaquina(partida);
    actualizarPlazo(partida);
    return partida.id;
  };

  this.elegirAccion = function (email, accion) {
    const partida = combateDe(email);
    partida.combate.elegirAccion(email, accion);
    presente(partida, email);
    comprobarFinal(partida);
    if (partida.combate.fase !== FASE_TERMINADA) jugarMaquina(partida);
    actualizarPlazo(partida);
    return partida.id;
  };

  // RF-32: decide por quien se ha quedado sin tiempo. La capa de tiempo real lo llama cada
  // segundo. Devuelve los ids de las partidas que han cambiado, para avisar a sus jugadores.
  this.vencerPlazos = function () {
    const cambiadas = [];
    for (const partida of partidas.values()) {
      if (partida.estado !== ESTADO_COMPLETA || !partida.plazo || ahora() < partida.plazo) continue;
      const c = partida.combate;
      partida.ausencias = partida.ausencias || {};
      for (const email of pendientesDe(partida)) {
        if (c.fase === FASE_TERMINADA) break;
        partida.ausencias[email] = (partida.ausencias[email] || 0) + 1;
        if (partida.ausencias[email] >= AUSENCIAS_PARA_PERDER) {
          c.abandonar(email, "inactividad");
          break;
        }
        if (c.fase === "seleccion") c.elegirEquipo(email, elegirEquipoIA(aleatorio));
        else {
          const accion = elegirAccionIA(c.vista(email), aleatorio);
          if (accion) c.elegirAccion(email, accion);
        }
      }
      comprobarFinal(partida);
      if (c.fase !== FASE_TERMINADA) jugarMaquina(partida);
      // Si nada ha cambiado el estado (no debería), el plazo vuelve a empezar igualmente.
      partida.firmaPlazo = null;
      actualizarPlazo(partida);
      cambiadas.push(partida.id);
    }
    return cambiadas;
  };

  // Lo que ve un jugador de su combate, o null si su partida aún no tiene combate.
  // plazoMs (RF-32): tiempo que le queda para decidir, o null si ahora no le toca.
  this.vistaCombate = function (email) {
    const partida = buscarDe(email);
    if (!partida || !partida.combate) return null;
    const vista = partida.combate.vista(email);
    const leToca = partida.plazo && partida.estado === ESTADO_COMPLETA && pendientesDe(partida).includes(email);
    vista.plazoMs = leToca ? Math.max(0, partida.plazo - ahora()) : null;
    vista.ausencias = (partida.ausencias && partida.ausencias[email]) || 0;
    if (partida.estado === ESTADO_TERMINADA) {
      const rival = partida.participantes.find((j) => j.email !== email);
      vista.revancha = {
        yo: partida.revancha.has(email),
        rival: Boolean(rival && partida.revancha.has(rival.email)),
        rivalPresente: partida.jugadores.length === JUGADORES_POR_PARTIDA,
      };
    }
    return vista;
  };

  // ---------- RF-34: revancha ----------

  // Pide la revancha tras un combate terminado. Cuando los dos la han pedido (la máquina la
  // acepta siempre), empieza otro combate en la misma partida. Devuelve { id, empieza }.
  this.pedirRevancha = function (email) {
    const partida = buscarDe(email);
    if (!partida || !partida.combate) throw new ErrorNegocio("NO_EN_COMBATE", "No estás en ningún combate");
    if (partida.estado !== ESTADO_TERMINADA) throw new ErrorNegocio("COMBATE_EN_CURSO", "El combate aún no ha terminado");
    if (partida.jugadores.length < JUGADORES_POR_PARTIDA) throw new ErrorNegocio("RIVAL_SE_FUE", "Tu rival ya ha salido de la partida");
    partida.revancha.add(email);
    if (partida.contraMaquina) partida.revancha.add(partida.jugadores[1].email);
    const empieza = partida.jugadores.every((j) => partida.revancha.has(j.email));
    if (empieza) empezarCombate(partida);
    return { id: partida.id, empieza };
  };

  // ---------- RF-33: emparejamiento rápido ----------

  // Busca rival con un ELO parecido. Si hay alguien compatible en la cola, crea la partida
  // con los dos (ya completa) y devuelve { partida }; si no, entra en la cola y devuelve
  // { buscando }.
  this.buscarRival = function (jugador, elo) {
    const j = validarJugador(jugador);
    exigirLibre(j.email);
    const t = ahora();
    const entrada = { jugador: j, elo: Number.isFinite(elo) ? elo : 1000, desde: t };
    const rival = mejorRival(entrada, t);
    if (rival) return { partida: emparejar(rival, entrada) };
    cola.set(j.email, entrada);
    return { buscando: this.busquedaDe(j.email) };
  };

  this.cancelarBusqueda = function (email) {
    if (!cola.delete(email)) throw new ErrorNegocio("NO_BUSCANDO", "No estás buscando rival");
  };

  // Estado de la búsqueda de un jugador, o null: { elo, esperaMs, margen }.
  this.busquedaDe = function (email) {
    const e = cola.get(email);
    if (!e) return null;
    const espera = ahora() - e.desde;
    return { elo: e.elo, esperaMs: espera, margen: margenElo(espera) };
  };

  this.enCola = () => cola.size;
  this.buscando = () => [...cola.keys()]; // emails en la cola

  // Rival compatible más cercano en ELO (los dos márgenes deben cubrir la diferencia).
  function mejorRival(entrada, t) {
    let mejor = null;
    for (const otra of cola.values()) {
      if (otra.jugador.email === entrada.jugador.email) continue;
      const diferencia = Math.abs(otra.elo - entrada.elo);
      if (diferencia > margenElo(t - otra.desde) || diferencia > margenElo(t - entrada.desde)) continue;
      if (!mejor || diferencia < Math.abs(mejor.elo - entrada.elo)) mejor = otra;
    }
    return mejor;
  }

  // Crea la partida de dos jugadores de la cola (el que llevaba más esperando es el primero).
  function emparejar(a, b) {
    cola.delete(a.jugador.email);
    cola.delete(b.jugador.email);
    let id = generarId();
    while (partidas.has(id)) id = generarId();
    const [primero, segundo] = a.desde <= b.desde ? [a, b] : [b, a];
    const partida = { id, estado: ESTADO_ABIERTA, jugadores: [primero.jugador, segundo.jugador], creada: ahora(), emparejada: true };
    partidas.set(id, partida);
    empezarCombate(partida);
    return vistaPublica(partida);
  }

  // Con el tiempo los márgenes crecen: la capa de tiempo real llama a esto cada segundo.
  // Devuelve las partidas creadas.
  this.emparejarCola = function () {
    const creadas = [];
    const t = ahora();
    const esperando = [...cola.values()].sort((x, y) => x.desde - y.desde);
    for (const entrada of esperando) {
      if (!cola.has(entrada.jugador.email)) continue; // ya emparejado en esta vuelta
      const rival = mejorRival(entrada, t);
      if (rival) creadas.push(emparejar(entrada, rival));
    }
    return creadas;
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
    const partida = buscarDe(email) || partidas.get(observando.get(email));
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
      // Los espectadores se quedan sin partida que mirar.
      const espectadores = partida.espectadores ? [...partida.espectadores.keys()] : [];
      for (const e of espectadores) observando.delete(e);
      partidas.delete(partida.id);
      return { id: partida.id, partida: null, restantes: [], espectadores };
    }
    return { id: partida.id, partida: vistaPublica(partida), restantes: partida.jugadores.map((j) => j.email), espectadores: [] };
  };

  // ---------- RF-23: espectadores ----------

  // Partidas con combate (en curso o recién terminadas) que se pueden mirar.
  this.listarEnCurso = function () {
    return [...partidas.values()]
      .filter((p) => p.estado === ESTADO_COMPLETA)
      .sort((a, b) => a.creada - b.creada)
      .map(vistaPublica);
  };

  const nombresDe = (partida) => Object.fromEntries(partida.participantes.map((j) => [j.email, j.nombre]));

  this.observar = function (id, espectador) {
    const j = validarJugador(espectador);
    const partida = buscar(id);
    if (partida.participantes && partida.participantes.some((x) => x.email === j.email)) {
      throw new ErrorNegocio("YA_EN_PARTIDA", "Juegas en esta partida");
    }
    if (buscarDe(j.email)) throw new ErrorNegocio("YA_EN_PARTIDA", "Sal de tu partida antes de mirar otra");
    if (!partida.combate) throw new ErrorNegocio("PARTIDA_SIN_COMBATE", "Esa partida aún no ha empezado");
    if (observando.has(j.email)) this.dejarDeObservar(j.email);
    partida.espectadores = partida.espectadores || new Map();
    partida.espectadores.set(j.email, j);
    observando.set(j.email, partida.id);
    return { id: partida.id, vista: partida.combate.vistaEspectador(nombresDe(partida)) };
  };

  this.dejarDeObservar = function (email) {
    const id = observando.get(email);
    if (!id) throw new ErrorNegocio("NO_OBSERVANDO", "No estás mirando ninguna partida");
    observando.delete(email);
    const partida = partidas.get(id);
    if (partida && partida.espectadores) partida.espectadores.delete(email);
    return id;
  };

  this.observandoDe = function (email) {
    return observando.get(email) || null;
  };

  // Vista para espectadores de una partida, o null si ya no existe o no tiene combate.
  this.vistaEspectador = function (id) {
    const partida = partidas.get(id);
    return partida && partida.combate ? partida.combate.vistaEspectador(nombresDe(partida)) : null;
  };

  // Emails de los jugadores (solo para la capa de tiempo real, que avisa a cada uno).
  this.emailsDe = function (id) {
    return buscar(id).jugadores.map((j) => j.email);
  };
}

module.exports = { Salas, PLAZO_EQUIPO_MS, PLAZO_TURNO_MS, AUSENCIAS_PARA_PERDER, margenElo, esMaquina, NOMBRE_MAQUINA, vistaPublica, codigoAleatorio, JUGADORES_POR_PARTIDA, ESTADO_ABIERTA, ESTADO_COMPLETA, ESTADO_TERMINADA };
