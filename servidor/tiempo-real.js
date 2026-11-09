// CAPA DE TIEMPO REAL (pertenece a la capa API, como api.js, pero con Socket.IO: D-19)
// Traduce eventos del navegador a llamadas a la lógica del juego (Salas) y difunde el
// estado resultante. No contiene reglas del juego (D-20).
//
// Seguridad (RNF-09): el canal usa la MISMA cookie de sesión "sid" que la API REST. Sin
// sesión válida no se acepta la conexión, y en cada evento se vuelve a comprobar la sesión
// (si el usuario cierra sesión o se elimina su cuenta, el canal deja de servirle).
//
// Eventos que envía el cliente (todos con respuesta "ack" { ok, partida } o { ok:false, error, mensaje }):
//   partida:crear            -> RF-11
//   partida:crear-maquina    -> RF-25 (partida contra la máquina)
//   partida:unirse { id }    -> RF-13
//   partida:abandonar        -> RF-14 (durante el combate, lo pierde: RF-18)
//   combate:equipo { criaturas: [ids] }               -> RF-16
//   combate:accion { tipo: "atacar", movimiento }     -> RF-17
//   combate:accion { tipo: "cambiar", indice }        -> RF-17
//   chat:enviar { texto }                             -> RF-22
//   partida:observar { id } / partida:dejar-observar  -> RF-23 (espectador)
// Eventos que envía el servidor:
//   partidas (lista)         -> RF-12, a todos cada vez que cambia
//   partida:estado (partida) -> a los jugadores de una partida cuando cambia; al conectarse,
//                               null si ya no está en ninguna (RF-24: volvió tarde)
//   partida:rival-abandona   -> al jugador que se queda solo
//   combate:estado (vista)   -> a cada jugador, SU vista del combate (RNF-10: nunca la del rival)
//   chat:mensaje (mensaje)   -> a la sala de la partida, cada mensaje nuevo
//   chat:historial ([msj])   -> al conectarse a una partida con mensajes
//   partidas:en-curso (lista)-> a todos, partidas con combate que se pueden mirar (RF-23)
//   espectador:estado (vista)-> a los espectadores de una partida, en cada cambio
//   espectador:fin           -> a los espectadores cuando la partida desaparece

const { Server } = require("socket.io");
const { leerCookie, NOMBRE_COOKIE } = require("./sesiones.js");
const { crearRegistro } = require("./registro.js");

const salaDeUsuario = (email) => `usuario:${email}`;
const salaDePartida = (id) => `partida:${id}`;
const salaDeEspectadores = (id) => `espectadores:${id}`;

// Tiempo que se espera tras perder la última conexión de un jugador antes de sacarlo de su
// partida. Cubre recargar la página y los cortes de red o los que hace Cloud Run al llegar al
// tiempo máximo de una petición: Socket.IO se vuelve a conectar solo en ese margen.
const ESPERA_RECONEXION_MS = 30 * 1000;

// RF-32: cada cuánto se comprueban los plazos para decidir.
const INTERVALO_PLAZOS_MS = 1000;

function conectarTiempoReal(servidorHttp, { sistema, salas, sesiones, registro = crearRegistro(), esperaReconexionMs = ESPERA_RECONEXION_MS, intervaloPlazosMs = INTERVALO_PLAZOS_MS }) {
  const io = new Server(servidorHttp, {
    // Mismo origen que la página: no se abre CORS a otros sitios.
    cors: { origin: false },
  });

  // Devuelve el jugador { email, nombre } de una sesión, o null si no es válida.
  async function jugadorDeSesion(sid) {
    const email = await sesiones.obtener(sid);
    if (!email) return null;
    try {
      const perfil = await sistema.perfil(email);
      return { email: perfil.email, nombre: perfil.nombre };
    } catch {
      return null; // la cuenta ya no existe o no está activa
    }
  }

  // RNF-09: autenticación del canal con la cookie de sesión.
  io.use(async (socket, next) => {
    try {
      const sid = leerCookie(socket.handshake.headers.cookie, NOMBRE_COOKIE);
      const jugador = await jugadorDeSesion(sid);
      if (!jugador) {
        registro.aviso("conexion en tiempo real sin sesion");
        return next(new Error("NO_AUTENTICADO"));
      }
      socket.data.sid = sid;
      socket.data.jugador = jugador;
      next();
    } catch (err) {
      next(err);
    }
  });

  const difundirLista = () => {
    io.emit("partidas", salas.listarAbiertas());
    io.emit("partidas:en-curso", salas.listarEnCurso());
  };

  // Cada jugador recibe su propia vista del combate: la del rival nunca sale del servidor.
  const avisarCombate = (emails) => {
    for (const e of emails) {
      const vista = salas.vistaCombate(e);
      if (vista) io.to(salaDeUsuario(e)).emit("combate:estado", vista);
    }
  };

  // Jugadores (cada uno su vista) y espectadores (la vista neutral) de una partida.
  const avisarPartida = (id) => {
    avisarCombate(salas.participantesDe(id));
    const vista = salas.vistaEspectador(id);
    if (vista) io.to(salaDeEspectadores(id)).emit("espectador:estado", vista);
  };

  // RF-32: si a alguien se le acaba el tiempo, el servidor decide por él y avisa a todos.
  const revisarPlazos = setInterval(() => {
    try {
      const cambiadas = salas.vencerPlazos();
      for (const id of cambiadas) {
        registro.info("plazo vencido", { partida: id });
        avisarPartida(id);
      }
      if (cambiadas.length) difundirLista();
    } catch (err) {
      registro.error("error al revisar plazos", { error: String((err && err.stack) || err) });
    }
  }, intervaloPlazosMs);
  revisarPlazos.unref();
  servidorHttp.on("close", () => clearInterval(revisarPlazos));

  io.on("connection", (socket) => {
    const { email } = socket.data.jugador;
    socket.join(salaDeUsuario(email));
    registro.info("conexion en tiempo real", { usuario: email });

    // Al conectar: la lista de partidas y, si ya estaba en una (otra pestaña), su estado.
    socket.emit("partidas", salas.listarAbiertas());
    socket.emit("partidas:en-curso", salas.listarEnCurso());
    // RF-24: al (re)conectarse se envía el estado completo, también cuando ya no hay nada
    // (null), para que el cliente no siga mostrando una partida que ya no existe.
    const mirando = salas.observandoDe(email);
    if (mirando) {
      socket.join(salaDeEspectadores(mirando));
      socket.emit("espectador:estado", salas.vistaEspectador(mirando));
      const chat = salas.chatDe(email);
      if (chat.length) socket.emit("chat:historial", chat);
    } else {
      socket.emit("espectador:estado", null);
    }
    const actual = salas.partidaDe(email);
    if (!actual) socket.emit("partida:estado", null);
    if (actual) {
      socket.join(salaDePartida(actual.id));
      socket.emit("partida:estado", actual);
      const vista = salas.vistaCombate(email);
      if (vista) socket.emit("combate:estado", vista);
      const chat = salas.chatDe(email);
      if (chat.length) socket.emit("chat:historial", chat);
    }

    // Envuelve cada evento: comprueba la sesión, ejecuta la acción y responde por el ack.
    // Los ErrorNegocio llegan al cliente con su código; cualquier otro error, genérico.
    function manejar(evento, accion) {
      socket.on(evento, async (datos, ack) => {
        if (typeof datos === "function") {
          ack = datos;
          datos = undefined;
        }
        const responder = typeof ack === "function" ? ack : () => {};
        try {
          const jugador = await jugadorDeSesion(socket.data.sid);
          if (!jugador || jugador.email !== email) {
            responder({ ok: false, error: "NO_AUTENTICADO", mensaje: "Tu sesión ha terminado" });
            return socket.disconnect(true);
          }
          const partida = await accion(datos || {}, jugador);
          responder({ ok: true, partida });
        } catch (err) {
          if (err && err.name === "ErrorNegocio") {
            registro.aviso("accion de juego rechazada", { evento, usuario: email, codigo: err.codigo });
            return responder({ ok: false, error: err.codigo, mensaje: err.message });
          }
          registro.error("error en tiempo real", { evento, error: String(err && err.stack || err) });
          responder({ ok: false, error: "ERROR", mensaje: "Ha ocurrido un error inesperado." });
        }
      });
    }

    async function entrarEnSala(partida) {
      await io.in(salaDeUsuario(email)).socketsJoin(salaDePartida(partida.id));
    }

    function abandonar() {
      const r = salas.abandonar(email);
      io.in(salaDeUsuario(email)).socketsLeave(salaDePartida(r.id));
      if (r.partida) {
        io.to(salaDePartida(r.id)).emit("partida:rival-abandona", r.partida);
        io.to(salaDePartida(r.id)).emit("partida:estado", r.partida);
        avisarCombate(r.restantes); // si había combate, el que queda ve que ha ganado
        const vista = salas.vistaEspectador(r.id);
        if (vista) io.to(salaDeEspectadores(r.id)).emit("espectador:estado", vista);
      } else if (r.espectadores && r.espectadores.length) {
        io.to(salaDeEspectadores(r.id)).emit("espectador:fin");
        io.in(salaDeEspectadores(r.id)).socketsLeave(salaDeEspectadores(r.id));
      }
      registro.info("partida abandonada", { usuario: email, partida: r.id, eliminada: !r.partida });
      difundirLista();
      return null;
    }

    manejar("partida:crear", async (_datos, jugador) => {
      const partida = salas.crearPartida(jugador);
      await entrarEnSala(partida);
      registro.info("partida creada", { usuario: email, partida: partida.id });
      io.to(salaDeUsuario(email)).emit("partida:estado", partida);
      difundirLista();
      return partida;
    });

    manejar("partida:crear-maquina", async (_datos, jugador) => {
      const partida = salas.crearPartidaContraMaquina(jugador);
      await entrarEnSala(partida);
      registro.info("partida contra la maquina creada", { usuario: email, partida: partida.id });
      io.to(salaDeUsuario(email)).emit("partida:estado", partida);
      avisarCombate([email]);
      return partida;
    });

    manejar("partida:unirse", async ({ id }, jugador) => {
      const partida = salas.unirse(id, jugador);
      await entrarEnSala(partida);
      registro.info("jugador unido a partida", { usuario: email, partida: partida.id });
      io.to(salaDePartida(partida.id)).emit("partida:estado", partida);
      avisarPartida(partida.id);
      difundirLista();
      return partida;
    });

    manejar("partida:abandonar", async () => abandonar());

    // RF-16 y RF-17: la lógica valida y resuelve; aquí solo se avisa a los dos jugadores.
    manejar("combate:equipo", async ({ criaturas }) => {
      const id = salas.elegirEquipo(email, criaturas);
      avisarPartida(id);
      return null;
    });

    manejar("chat:enviar", async ({ texto }) => {
      const { id, mensaje } = salas.enviarMensaje(email, texto);
      io.to(salaDePartida(id)).to(salaDeEspectadores(id)).emit("chat:mensaje", mensaje);
      return null;
    });

    // RF-23: mirar una partida en curso. El espectador entra en una sala aparte, así no
    // recibe los avisos de los jugadores (su vista ni sus avisos de partida).
    manejar("partida:observar", async ({ id }, jugador) => {
      const anterior = salas.observandoDe(email);
      const r = salas.observar(id, jugador);
      if (anterior) io.in(salaDeUsuario(email)).socketsLeave(salaDeEspectadores(anterior));
      await io.in(salaDeUsuario(email)).socketsJoin(salaDeEspectadores(r.id));
      registro.info("espectador entra", { usuario: email, partida: r.id });
      io.to(salaDeUsuario(email)).emit("espectador:estado", r.vista);
      const chat = salas.chatDe(email);
      io.to(salaDeUsuario(email)).emit("chat:historial", chat);
      difundirLista(); // cambia el número de espectadores
      return null;
    });

    manejar("partida:dejar-observar", async () => {
      const id = salas.dejarDeObservar(email);
      io.in(salaDeUsuario(email)).socketsLeave(salaDeEspectadores(id));
      difundirLista();
      return null;
    });

    manejar("combate:accion", async (accion) => {
      const id = salas.elegirAccion(email, accion);
      avisarPartida(id);
      if (salas.obtener(id).estado === "terminada") difundirLista(); // ya no está en curso
      return null;
    });

    // Si el jugador pierde su última conexión y no vuelve en el margen, sale de la partida.
    socket.on("disconnect", () => {
      const temporizador = setTimeout(async () => {
        const quedan = await io.in(salaDeUsuario(email)).fetchSockets();
        if (quedan.length > 0) return;
        if (salas.partidaDe(email)) abandonar();
        else if (salas.observandoDe(email)) {
          salas.dejarDeObservar(email);
          difundirLista();
        }
      }, esperaReconexionMs);
      temporizador.unref();
    });
  });

  return io;
}

module.exports = { conectarTiempoReal };
