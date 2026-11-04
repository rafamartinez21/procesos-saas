// CAPA DE LÓGICA DEL JUEGO: progreso de los jugadores (hito 7, RF-19 a RF-21).
// Recibe el CAD por parámetro, como Sistema: no sabe si los datos están en memoria o en
// MongoDB. Guarda cada partida terminada (historial), actualiza la puntuación ELO de los
// dos jugadores (D-24) y calcula el ranking y las estadísticas de cada uno.
// Hacia fuera nunca devuelve emails de otros jugadores, solo su nombre visible.

const ELO_INICIAL = 1000;
const FACTOR_K = 32; // cuánto puede cambiar la puntuación en una sola partida

// Probabilidad de que A gane a B según su puntuación (fórmula ELO).
function esperado(eloA, eloB) {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

// Nueva puntuación de A tras una partida. resultado: 1 gana, 0.5 empate, 0 pierde.
function nuevoElo(eloA, eloB, resultado, k = FACTOR_K) {
  return Math.round(eloA + k * (resultado - esperado(eloA, eloB)));
}

function jugadorNuevo(email, nombre) {
  return { email, nombre, elo: ELO_INICIAL, ganadas: 0, perdidas: 0, empates: 0 };
}

const jugadas = (j) => j.ganadas + j.perdidas + j.empates;

function Progreso(cad, { ahora = () => Date.now() } = {}) {
  // RF-19 y RF-20: se llama al terminar un combate con
  // { id, jugadores: [{ email, nombre }, { email, nombre }], ganador: email | null, motivo, turnos }.
  this.registrarResultado = async function ({ id, jugadores, ganador, motivo, turnos }) {
    const [a, b] = jugadores;
    const ja = (await cad.buscarJugador(a.email)) || jugadorNuevo(a.email, a.nombre);
    const jb = (await cad.buscarJugador(b.email)) || jugadorNuevo(b.email, b.nombre);
    const resultadoA = ganador === a.email ? 1 : ganador === b.email ? 0 : 0.5;
    const antes = { [a.email]: ja.elo, [b.email]: jb.elo };
    const despues = {
      [a.email]: nuevoElo(ja.elo, jb.elo, resultadoA),
      [b.email]: nuevoElo(jb.elo, ja.elo, 1 - resultadoA),
    };

    const contar = (j, r) => ({
      ...j,
      nombre: j.email === a.email ? a.nombre : b.nombre, // el nombre visible más reciente
      elo: despues[j.email],
      ganadas: j.ganadas + (r === 1 ? 1 : 0),
      perdidas: j.perdidas + (r === 0 ? 1 : 0),
      empates: j.empates + (r === 0.5 ? 1 : 0),
    });
    await cad.guardarJugador(contar(ja, resultadoA));
    await cad.guardarJugador(contar(jb, 1 - resultadoA));

    const partida = {
      id,
      fecha: ahora(),
      emails: [a.email, b.email],
      nombres: { [a.email]: a.nombre, [b.email]: b.nombre },
      ganador,
      motivo,
      turnos,
      eloAntes: antes,
      eloDespues: despues,
    };
    await cad.insertarPartida(partida);
    return { eloAntes: antes, eloDespues: despues };
  };

  // RF-19: historial de un jugador, visto desde su lado.
  this.historial = async function (email, limite = 20) {
    const partidas = await cad.listarPartidasDe(email, limite);
    return partidas.map((p) => {
      const rival = p.emails.find((e) => e !== email);
      return {
        id: p.id,
        fecha: p.fecha,
        rival: p.nombres[rival],
        resultado: p.ganador === email ? "victoria" : p.ganador === null ? "empate" : "derrota",
        motivo: p.motivo,
        turnos: p.turnos,
        elo: p.eloDespues[email],
        cambioElo: p.eloDespues[email] - p.eloAntes[email],
      };
    });
  };

  // RF-20: ranking por ELO, sin emails.
  this.ranking = async function (limite = 20) {
    const lista = await cad.listarRanking(limite);
    return lista.map((j, i) => ({
      posicion: i + 1,
      nombre: j.nombre,
      elo: j.elo,
      ganadas: j.ganadas,
      perdidas: j.perdidas,
      empates: j.empates,
    }));
  };

  // RF-21: estadísticas del propio jugador. Quien aún no ha jugado tiene la puntuación inicial.
  this.estadisticas = async function (email, nombre) {
    const j = (await cad.buscarJugador(email)) || jugadorNuevo(email, nombre);
    const recientes = await this.historial(email, 5);
    let racha = 0;
    for (const p of recientes) {
      if (p.resultado !== "victoria") break;
      racha += 1;
    }
    const total = jugadas(j);
    return {
      nombre: j.nombre || nombre,
      elo: j.elo,
      jugadas: total,
      ganadas: j.ganadas,
      perdidas: j.perdidas,
      empates: j.empates,
      porcentajeVictorias: total ? Math.round((100 * j.ganadas) / total) : 0,
      rachaVictorias: racha,
      recientes,
    };
  };

  // Cuando se elimina una cuenta, desaparece del ranking. Su nombre puede seguir en el
  // historial de sus rivales, que es de ellos.
  this.olvidarJugador = async function (email) {
    await cad.eliminarJugador(email);
  };
}

module.exports = { Progreso, nuevoElo, esperado, ELO_INICIAL, FACTOR_K };
