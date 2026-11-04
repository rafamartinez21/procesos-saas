// CAPA DE LÓGICA DEL JUEGO: motor de combate (hito 6, RF-16 a RF-18 y RNF-10).
// Sin Socket.IO ni HTTP (D-20). El servidor es la única autoridad: el cliente solo dice
// qué quiere hacer ("ataco con Llamarada", "cambio a la criatura 2") y aquí se valida y se
// resuelve todo. El azar se inyecta (aleatorio) para que las pruebas sean deterministas.
//
// Desarrollo de una partida:
//  1. seleccion: cada jugador elige un equipo de 3 criaturas distintas (RF-16).
//  2. combate: cada turno los dos jugadores eligen una acción en secreto; cuando los dos han
//     elegido, el turno se resuelve (RF-17). Primero los cambios de criatura y después los
//     ataques, en orden de velocidad.
//     Si una criatura cae, su dueño debe sacar otra antes del siguiente turno.
//  3. terminada: gana quien deja al rival sin criaturas, o quien se queda si el otro abandona (RF-18).

const { ErrorNegocio } = require("../modelo.js");
const { obtenerCriatura, obtenerMovimiento, eficacia } = require("./criaturas.js");

const TAMANO_EQUIPO = 3;
const BONO_MISMO_ELEMENTO = 1.25; // un movimiento del elemento de la criatura pega más
const PROB_DESCONGELAR = 0.3;
const PROB_PARALISIS = 0.25;
const FASE_SELECCION = "seleccion";
const FASE_COMBATE = "combate";
const FASE_TERMINADA = "terminada";

// Fórmula de daño. Se exporta para probarla aparte.
//   base = potencia * ataque / defensa / 3 + 2
//   daño = base * bono por mismo elemento * eficacia * variación (85 %..100 %), mínimo 1
function calcularDanio({ potencia, ataque, defensa, mismoElemento, eficacia: ef, variacion }) {
  const base = (potencia * ataque) / defensa / 3 + 2;
  return Math.max(1, Math.floor(base * (mismoElemento ? BONO_MISMO_ELEMENTO : 1) * ef * variacion));
}

function nuevaInstancia(datos) {
  return {
    id: datos.id,
    nombre: datos.nombre,
    elemento: datos.elemento,
    psMax: datos.ps,
    ps: datos.ps,
    ataque: datos.ataque,
    defensa: datos.defensa,
    velocidad: datos.velocidad,
    movimientos: [...datos.movimientos],
    estado: null,
  };
}

function Combate(emails, { aleatorio = Math.random } = {}) {
  if (!Array.isArray(emails) || emails.length !== 2 || emails[0] === emails[1]) {
    throw new Error("Un combate necesita dos jugadores distintos");
  }
  this.fase = FASE_SELECCION;
  this.turno = 0;
  this.ganador = null;
  this.motivo = null;
  this.eventos = []; // lo ocurrido en el último turno resuelto
  const jugadores = new Map(emails.map((e) => [e, { equipo: null, activa: 0, accion: null, debeCambiar: false }]));
  const rivalDe = (email) => emails.find((e) => e !== email);

  const exigirJugador = (email) => {
    const j = jugadores.get(email);
    if (!j) throw new ErrorNegocio("NO_EN_PARTIDA", "No juegas en este combate");
    return j;
  };
  const TEXTO_FASE = {
    [FASE_SELECCION]: "Todavía se están eligiendo los equipos",
    [FASE_COMBATE]: "El combate ya ha empezado",
    [FASE_TERMINADA]: "El combate ha terminado",
  };
  const exigirFase = (fase) => {
    if (this.fase !== fase) throw new ErrorNegocio("FASE_INCORRECTA", TEXTO_FASE[this.fase]);
  };
  const activa = (j) => j.equipo[j.activa];
  const vivas = (j) => j.equipo.filter((c) => c.ps > 0).length;

  // ---------- RF-16: elegir equipo ----------
  this.elegirEquipo = function (email, ids) {
    const j = exigirJugador(email);
    exigirFase(FASE_SELECCION);
    if (j.equipo) throw new ErrorNegocio("EQUIPO_YA_ELEGIDO", "Ya has elegido tu equipo");
    if (!Array.isArray(ids) || ids.length !== TAMANO_EQUIPO) {
      throw new ErrorNegocio("EQUIPO_INVALIDO", `Elige exactamente ${TAMANO_EQUIPO} criaturas`);
    }
    if (new Set(ids).size !== ids.length) throw new ErrorNegocio("EQUIPO_INVALIDO", "No puedes repetir criaturas");
    const datos = ids.map((id) => (typeof id === "string" ? obtenerCriatura(id) : undefined));
    if (datos.some((d) => !d)) throw new ErrorNegocio("EQUIPO_INVALIDO", "Alguna criatura no existe");
    j.equipo = datos.map(nuevaInstancia);
    if ([...jugadores.values()].every((x) => x.equipo)) {
      this.fase = FASE_COMBATE;
      this.turno = 1;
    }
    return this.fase;
  };

  // ---------- RF-17: acciones ----------
  // accion: { tipo: "atacar", movimiento: "llamarada" } o { tipo: "cambiar", indice: 1 }
  // Devuelve true si con esta acción se ha resuelto un turno o un cambio obligado.
  this.elegirAccion = function (email, accion) {
    const j = exigirJugador(email);
    exigirFase(FASE_COMBATE);
    const tipo = accion && accion.tipo;
    const alguienDebeCambiar = [...jugadores.values()].some((x) => x.debeCambiar);

    // Cambio obligado tras caer una criatura: solo puede actuar quien debe cambiar.
    if (alguienDebeCambiar) {
      if (!j.debeCambiar) throw new ErrorNegocio("ESPERA_RIVAL", "Espera a que tu rival saque otra criatura");
      if (tipo !== "cambiar") throw new ErrorNegocio("ACCION_INVALIDA", "Tu criatura ha caído: elige otra");
      validarCambio(j, accion.indice);
      j.activa = accion.indice;
      j.debeCambiar = false;
      this.eventos = [{ tipo: "cambio", quien: email, criatura: activa(j).nombre }];
      return true;
    }

    if (j.accion) throw new ErrorNegocio("ACCION_YA_ELEGIDA", "Ya has elegido tu acción en este turno");
    if (tipo === "atacar") {
      if (typeof accion.movimiento !== "string" || !activa(j).movimientos.includes(accion.movimiento)) {
        throw new ErrorNegocio("MOVIMIENTO_INVALIDO", "Tu criatura no conoce ese movimiento");
      }
      j.accion = { tipo, movimiento: accion.movimiento };
    } else if (tipo === "cambiar") {
      validarCambio(j, accion.indice);
      j.accion = { tipo, indice: accion.indice };
    } else {
      throw new ErrorNegocio("ACCION_INVALIDA", "Acción desconocida");
    }

    if ([...jugadores.values()].every((x) => x.accion)) {
      resolverTurno();
      return true;
    }
    return false;
  };

  function validarCambio(j, indice) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= j.equipo.length) {
      throw new ErrorNegocio("CAMBIO_INVALIDO", "Esa criatura no está en tu equipo");
    }
    if (indice === j.activa) throw new ErrorNegocio("CAMBIO_INVALIDO", "Esa criatura ya está combatiendo");
    if (j.equipo[indice].ps <= 0) throw new ErrorNegocio("CAMBIO_INVALIDO", "Esa criatura está debilitada");
  }

  const velocidadEfectiva = (c) => (c.estado === "paralizado" ? Math.floor(c.velocidad / 2) : c.velocidad);

  // Marca el final si alguien se ha quedado sin criaturas. Si los dos a la vez, empate.
  const comprobarFin = (eventos) => {
    const sin = emails.filter((e) => vivas(jugadores.get(e)) === 0);
    if (sin.length === 0) return false;
    this.fase = FASE_TERMINADA;
    this.ganador = sin.length === 2 ? null : rivalDe(sin[0]);
    this.motivo = sin.length === 2 ? "empate" : "sin-criaturas";
    eventos.push({ tipo: "fin", ganador: this.ganador, motivo: this.motivo });
    return true;
  };

  const debilitar = (email, c, eventos) => {
    eventos.push({ tipo: "debilitada", quien: email, criatura: c.nombre });
    const j = jugadores.get(email);
    if (vivas(j) > 0) j.debeCambiar = true;
  };

  const resolverTurno = () => {
    const eventos = [];

    // 1. Cambios de criatura: siempre antes que los ataques.
    for (const e of emails) {
      const j = jugadores.get(e);
      if (j.accion.tipo === "cambiar") {
        j.activa = j.accion.indice;
        eventos.push({ tipo: "cambio", quien: e, criatura: activa(j).nombre });
      }
    }

    // 2. Ataques, de la criatura más rápida a la más lenta (empate: al azar).
    const atacantes = emails.filter((e) => jugadores.get(e).accion.tipo === "atacar");
    const desempate = aleatorio() < 0.5 ? 1 : -1;
    atacantes.sort((a, b) => {
      const va = velocidadEfectiva(activa(jugadores.get(a)));
      const vb = velocidadEfectiva(activa(jugadores.get(b)));
      return vb - va || desempate;
    });

    for (const e of atacantes) {
      if (this.fase === FASE_TERMINADA) break;
      const j = jugadores.get(e);
      const r = jugadores.get(rivalDe(e));
      const a = activa(j);
      const d = activa(r);
      if (a.ps <= 0 || d.ps <= 0) continue; // cayó antes de actuar, o no hay a quién atacar
      const mov = obtenerMovimiento(j.accion.movimiento);

      if (a.estado === "congelado") {
        if (aleatorio() < PROB_DESCONGELAR) {
          a.estado = null;
          eventos.push({ tipo: "descongela", quien: e, criatura: a.nombre });
        } else {
          eventos.push({ tipo: "no-actua", quien: e, criatura: a.nombre, estado: "congelado" });
          continue;
        }
      } else if (a.estado === "paralizado" && aleatorio() < PROB_PARALISIS) {
        eventos.push({ tipo: "no-actua", quien: e, criatura: a.nombre, estado: "paralizado" });
        continue;
      }

      if (aleatorio() * 100 >= mov.precision) {
        eventos.push({ tipo: "falla", quien: e, criatura: a.nombre, movimiento: mov.nombre });
        continue;
      }

      const ef = eficacia(mov.elemento, d.elemento);
      const danio = Math.min(
        d.ps,
        calcularDanio({
          potencia: mov.potencia,
          ataque: a.ataque,
          defensa: d.defensa,
          mismoElemento: mov.elemento === a.elemento,
          eficacia: ef,
          variacion: 0.85 + aleatorio() * 0.15,
        })
      );
      d.ps -= danio;
      eventos.push({ tipo: "ataque", quien: e, criatura: a.nombre, movimiento: mov.nombre, objetivo: d.nombre, danio, eficacia: ef });

      if (mov.efecto && mov.efecto.drenar && a.ps < a.psMax) {
        const cura = Math.min(a.psMax - a.ps, Math.floor(danio * mov.efecto.drenar));
        if (cura > 0) {
          a.ps += cura;
          eventos.push({ tipo: "drena", quien: e, criatura: a.nombre, cura });
        }
      }
      if (d.ps > 0 && mov.efecto && mov.efecto.estado && !d.estado && aleatorio() < mov.efecto.prob) {
        d.estado = mov.efecto.estado;
        eventos.push({ tipo: "estado", quien: rivalDe(e), criatura: d.nombre, estado: d.estado });
      }
      if (d.ps <= 0) {
        debilitar(rivalDe(e), d, eventos);
        comprobarFin(eventos);
      }
    }

    // 3. Final del turno: las quemaduras hacen daño.
    if (this.fase !== FASE_TERMINADA) {
      for (const e of emails) {
        const c = activa(jugadores.get(e));
        if (c.ps > 0 && c.estado === "quemado") {
          const danio = Math.min(c.ps, Math.max(1, Math.floor(c.psMax / 10)));
          c.ps -= danio;
          eventos.push({ tipo: "quemadura", quien: e, criatura: c.nombre, danio });
          if (c.ps <= 0) debilitar(e, c, eventos);
        }
      }
      comprobarFin(eventos);
    }

    for (const j of jugadores.values()) j.accion = null;
    if (this.fase !== FASE_TERMINADA) this.turno += 1;
    this.eventos = eventos;
  };

  // ---------- RF-18: abandono ----------
  this.abandonar = function (email) {
    exigirJugador(email);
    if (this.fase === FASE_TERMINADA) return;
    this.fase = FASE_TERMINADA;
    this.ganador = rivalDe(email);
    this.motivo = "abandono";
    this.eventos = [{ tipo: "fin", ganador: this.ganador, motivo: this.motivo }];
  };

  // ---------- Vista de un jugador (RNF-10) ----------
  // Cada jugador ve su equipo completo, pero del rival solo la criatura en combate y cuántas
  // le quedan, y nunca la acción que ha elegido (solo si ya ha elegido). Los emails se
  // sustituyen por "yo" y "rival".
  this.vista = function (email) {
    const j = exigirJugador(email);
    const r = jugadores.get(rivalDe(email));
    const quien = (e) => (e === email ? "yo" : e ? "rival" : null);
    const criatura = (c) => ({ id: c.id, nombre: c.nombre, elemento: c.elemento, ps: c.ps, psMax: c.psMax, estado: c.estado });
    return {
      fase: this.fase,
      turno: this.turno,
      yo: {
        equipo: j.equipo
          ? j.equipo.map((c) => ({ ...criatura(c), movimientos: c.movimientos.map((m) => ({ id: m, ...obtenerMovimiento(m) })) }))
          : null,
        activa: j.equipo ? j.activa : null,
        eleccionHecha: Boolean(j.equipo) && (this.fase === FASE_SELECCION || Boolean(j.accion)),
        debeCambiar: j.debeCambiar,
      },
      rival: {
        equipoElegido: Boolean(r.equipo),
        activa: r.equipo && this.fase !== FASE_SELECCION ? criatura(activa(r)) : null,
        restantes: r.equipo ? vivas(r) : null,
        eleccionHecha: this.fase === FASE_SELECCION ? Boolean(r.equipo) : Boolean(r.accion),
        debeCambiar: r.debeCambiar,
      },
      eventos: this.eventos.map((ev) => {
        const copia = { ...ev };
        if ("quien" in copia) copia.quien = quien(copia.quien);
        if ("ganador" in copia) copia.ganador = quien(copia.ganador);
        return copia;
      }),
      ganador: this.fase === FASE_TERMINADA ? quien(this.ganador) : null,
      motivo: this.motivo,
    };
  };
}

module.exports = { Combate, calcularDanio, TAMANO_EQUIPO, FASE_SELECCION, FASE_COMBATE, FASE_TERMINADA };
