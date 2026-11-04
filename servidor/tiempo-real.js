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
// Eventos que envía el servidor:
//   partidas (lista)         -> RF-12, a todos cada vez que cambia
//   partida:estado (partida) -> a los jugadores de una partida cuando cambia
//   partida:rival-abandona   -> al jugador que se queda solo
//   combate:estado (vista)   -> a cada jugador, SU vista del combate (RNF-10: nunca la del rival)

const { Server } = require("socket.io");
const { leerCookie, NOMBRE_COOKIE } = require("./sesiones.js");
const { crearRegistro } = require("./registro.js");

const salaDeUsuario = (email) => `usuario:${email}`;
const salaDePartida = (id) => `partida:${id}`;

// Tiempo que se espera tras perder la última conexión de un jugador antes de sacarlo de su
// partida. Cubre recargar la página y los cortes de red o los que hace Cloud Run al llegar al
// tiempo máximo de una petición: Socket.IO se vuelve a conectar solo en ese margen.
const ESPERA_RECONEXION_MS = 30 * 1000;

function conectarTiempoReal(servidorHttp, { sistema, salas, sesiones, registro = crearRegistro(), esperaReconexionMs = ESPERA_RECONEXION_MS }) {
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

  const difundirLista = () => io.emit("partidas", salas.listarAbiertas());

  // Cada jugador recibe su propia vista del combate: la del rival nunca sale del servidor.
  const avisarCombate = (emails) => {
    for (const e of emails) {
      const vista = salas.vistaCombate(e);
      if (vista) io.to(salaDeUsuario(e)).emit("combate:estado", vista);
    }
  };

  io.on("connection", (socket) => {
    const { email } = socket.data.jugador;
    socket.join(salaDeUsuario(email));
    registro.info("conexion en tiempo real", { usuario: email });

    // Al conectar: la lista de partidas y, si ya estaba en una (otra pestaña), su estado.
    socket.emit("partidas", salas.listarAbiertas());
    const actual = salas.partidaDe(email);
    if (actual) {
      socket.join(salaDePartida(actual.id));
      socket.emit("partida:estado", actual);
      const vista = salas.vistaCombate(email);
      if (vista) socket.emit("combate:estado", vista);
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
      avisarCombate(salas.participantesDe(partida.id));
      difundirLista();
      return partida;
    });

    manejar("partida:abandonar", async () => abandonar());

    // RF-16 y RF-17: la lógica valida y resuelve; aquí solo se avisa a los dos jugadores.
    manejar("combate:equipo", async ({ criaturas }) => {
      const id = salas.elegirEquipo(email, criaturas);
      avisarCombate(salas.participantesDe(id));
      return null;
    });

    manejar("combate:accion", async (accion) => {
      const id = salas.elegirAccion(email, accion);
      avisarCombate(salas.participantesDe(id));
      return null;
    });

    // Si el jugador pierde su última conexión y no vuelve en el margen, sale de la partida.
    socket.on("disconnect", () => {
      const temporizador = setTimeout(async () => {
        const quedan = await io.in(salaDeUsuario(email)).fetchSockets();
        if (quedan.length === 0 && salas.partidaDe(email)) abandonar();
      }, esperaReconexionMs);
      temporizador.unref();
    });
  });

  return io;
}

module.exports = { conectarTiempoReal };
