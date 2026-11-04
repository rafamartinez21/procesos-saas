// Pruebas unitarias del motor de combate (servidor/juego/combate.js), hito 6.
// El azar se controla con una secuencia de números: así cada prueba es determinista.
// Con 0,5 constante: todos los ataques aciertan, no se aplica ningún estado y la
// variación de daño es del 92,5 %.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Combate, calcularDanio } = require("../servidor/juego/combate.js");

const ANA = "ana@test.es";
const LUIS = "luis@test.es";

// Devuelve los valores en orden y, cuando se acaban, 0,5.
function secuencia(...valores) {
  return () => (valores.length ? valores.shift() : 0.5);
}

function combate(equipoAna, equipoLuis, aleatorio = () => 0.5) {
  const c = new Combate([ANA, LUIS], { aleatorio });
  c.elegirEquipo(ANA, equipoAna);
  c.elegirEquipo(LUIS, equipoLuis);
  return c;
}

const atacar = (movimiento) => ({ tipo: "atacar", movimiento });
const cambiar = (indice) => ({ tipo: "cambiar", indice });

function esperarError(fn, codigo) {
  assert.throws(fn, (err) => {
    assert.equal(err.name, "ErrorNegocio");
    assert.equal(err.codigo, codigo);
    return true;
  });
}

const tipos = (c, email = ANA) => c.vista(email).eventos.map((e) => e.tipo);

// ---------- fórmula de daño ----------

test("fórmula de daño: Llamarada (90) de ataque 80 contra defensa 70, mismo elemento y eficaz", () => {
  // base = 90 * 80 / 70 / 3 + 2 = 36,29 -> x1,25 x2 = 90,7 -> 90
  assert.equal(calcularDanio({ potencia: 90, ataque: 80, defensa: 70, mismoElemento: true, eficacia: 2, variacion: 1 }), 90);
  assert.equal(calcularDanio({ potencia: 90, ataque: 80, defensa: 70, mismoElemento: false, eficacia: 1, variacion: 1 }), 36);
});

test("el daño mínimo es 1 aunque el ataque sea muy poco eficaz", () => {
  assert.equal(calcularDanio({ potencia: 1, ataque: 1, defensa: 999, mismoElemento: false, eficacia: 0.5, variacion: 0.85 }), 1);
});

// ---------- RF-16 elegir equipo ----------

test("cuando los dos eligen equipo empieza el combate en el turno 1", () => {
  const c = new Combate([ANA, LUIS]);
  assert.equal(c.elegirEquipo(ANA, ["pirolince", "marejon", "musgolem"]), "seleccion");
  assert.equal(c.elegirEquipo(LUIS, ["voltarda", "rocadonte", "ciclonia"]), "combate");
  const v = c.vista(ANA);
  assert.equal(v.turno, 1);
  assert.deepEqual(v.yo.equipo.map((x) => x.id), ["pirolince", "marejon", "musgolem"]);
  assert.equal(v.yo.activa, 0);
  assert.equal(v.rival.activa.id, "voltarda");
  assert.equal(v.rival.restantes, 3);
});

test("mientras se eligen equipos no se ve el equipo del rival, solo si ya lo ha elegido", () => {
  const c = new Combate([ANA, LUIS]);
  c.elegirEquipo(LUIS, ["voltarda", "rocadonte", "ciclonia"]);
  const v = c.vista(ANA);
  assert.equal(v.fase, "seleccion");
  assert.equal(v.rival.equipoElegido, true);
  assert.equal(v.rival.activa, null);
  assert.equal(JSON.stringify(v).includes("voltarda"), false);
});

test("[error] el equipo debe tener exactamente 3 criaturas distintas que existan", () => {
  const c = new Combate([ANA, LUIS]);
  esperarError(() => c.elegirEquipo(ANA, ["pirolince", "marejon"]), "EQUIPO_INVALIDO");
  esperarError(() => c.elegirEquipo(ANA, ["pirolince", "marejon", "musgolem", "brason"]), "EQUIPO_INVALIDO");
  esperarError(() => c.elegirEquipo(ANA, ["pirolince", "pirolince", "musgolem"]), "EQUIPO_INVALIDO");
  esperarError(() => c.elegirEquipo(ANA, ["pirolince", "marejon", "dragon-falso"]), "EQUIPO_INVALIDO");
  esperarError(() => c.elegirEquipo(ANA, "pirolince"), "EQUIPO_INVALIDO");
  esperarError(() => c.elegirEquipo(ANA, [1, 2, 3]), "EQUIPO_INVALIDO");
});

test("[error] no se puede cambiar de equipo una vez elegido", () => {
  const c = new Combate([ANA, LUIS]);
  c.elegirEquipo(ANA, ["pirolince", "marejon", "musgolem"]);
  esperarError(() => c.elegirEquipo(ANA, ["brason", "nautilia", "espinara"]), "EQUIPO_YA_ELEGIDO");
});

test("[error] quien no juega en el combate no puede elegir equipo ni ver la partida", () => {
  const c = new Combate([ANA, LUIS]);
  esperarError(() => c.elegirEquipo("eva@test.es", ["pirolince", "marejon", "musgolem"]), "NO_EN_PARTIDA");
  esperarError(() => c.vista("eva@test.es"), "NO_EN_PARTIDA");
});

test("[error] un combate necesita dos jugadores distintos", () => {
  assert.throws(() => new Combate([ANA]));
  assert.throws(() => new Combate([ANA, ANA]));
});

// ---------- RF-17 turnos ----------

test("el turno se resuelve solo cuando los dos jugadores han elegido", () => {
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  assert.equal(c.elegirAccion(ANA, atacar("embestida")), false);
  assert.equal(c.vista(LUIS).rival.eleccionHecha, true);
  assert.equal(c.elegirAccion(LUIS, atacar("embestida")), true);
  assert.equal(c.vista(ANA).turno, 2);
  assert.deepEqual(tipos(c), ["ataque", "ataque"]);
});

test("ataca primero la criatura más rápida", () => {
  // Pirolince (velocidad 80) contra Marejón (40).
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  c.elegirAccion(LUIS, atacar("embestida"));
  c.elegirAccion(ANA, atacar("embestida"));
  const [primero, segundo] = c.vista(ANA).eventos;
  assert.equal(primero.quien, "yo");
  assert.equal(primero.criatura, "Pirolince");
  assert.equal(segundo.quien, "rival");
});

test("la eficacia multiplica el daño y queda en el registro del turno", () => {
  // Llamarada (fuego) contra Musgolem (planta): eficaz x2.
  const c = combate(["pirolince", "brason", "voltarda"], ["musgolem", "marejon", "rocadonte"]);
  c.elegirAccion(ANA, atacar("llamarada"));
  c.elegirAccion(LUIS, atacar("embestida"));
  const ataque = c.vista(ANA).eventos.find((e) => e.quien === "yo");
  // base = 90 * 80 / 80 / 3 + 2 = 32 -> x1,25 x2 x0,925 = 74
  assert.deepEqual([ataque.eficacia, ataque.danio], [2, 74]);
  assert.equal(c.vista(ANA).rival.activa.ps, 100 - 74);
});

test("un ataque puede fallar según su precisión", () => {
  // desempate, y luego 0,99 * 100 = 99 >= 85 de precisión de Llamarada: falla.
  const c = combate(["pirolince", "brason", "voltarda"], ["musgolem", "marejon", "rocadonte"], secuencia(0.5, 0.99));
  c.elegirAccion(ANA, atacar("llamarada"));
  c.elegirAccion(LUIS, atacar("embestida"));
  assert.equal(c.vista(ANA).eventos[0].tipo, "falla");
  assert.equal(c.vista(ANA).rival.activa.ps, 100);
});

test("quemado: el ataque puede quemar y la quemadura quita 1/10 de los PS al final del turno", () => {
  // desempate, precisión, variación y 0,1 < 30 % de Ascuas: Marejón queda quemado.
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"], secuencia(0.5, 0.5, 0.5, 0.1));
  c.elegirAccion(ANA, atacar("ascuas"));
  c.elegirAccion(LUIS, atacar("embestida"));
  const v = c.vista(LUIS);
  assert.deepEqual(tipos(c, LUIS), ["ataque", "estado", "ataque", "quemadura"]);
  assert.equal(v.yo.equipo[0].estado, "quemado");
  assert.equal(v.eventos.find((e) => e.tipo === "quemadura").danio, 10);
});

test("congelado: la criatura no actúa hasta que se descongela", () => {
  // Nautilia (80) congela a Marejón (40) con 0,1 < 20 %; después 0,5 >= 30 %: sigue congelado.
  const c = combate(["nautilia", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"], secuencia(0.5, 0.5, 0.5, 0.1));
  c.elegirAccion(ANA, atacar("burbuja-helada"));
  c.elegirAccion(LUIS, atacar("embestida"));
  const noActua = c.vista(LUIS).eventos.find((e) => e.tipo === "no-actua");
  assert.deepEqual([noActua.quien, noActua.estado], ["yo", "congelado"]);
});

test("congelado: con suerte se descongela y ataca en el mismo turno", () => {
  // Turno 1: se congela (y no se descongela con 0,5). Turno 2: desempate, precisión y variación
  // de Nautilia, y 0,1 < 30 %: Marejón se descongela.
  const c = combate(["nautilia", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"], secuencia(0.5, 0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.5, 0.1));
  c.elegirAccion(ANA, atacar("burbuja-helada"));
  c.elegirAccion(LUIS, atacar("embestida"));
  c.elegirAccion(ANA, atacar("embestida"));
  c.elegirAccion(LUIS, atacar("embestida"));
  assert.deepEqual(tipos(c, LUIS).slice(-2), ["descongela", "ataque"]);
  assert.equal(c.vista(LUIS).yo.equipo[0].estado, null);
});

test("paralizado: reduce la velocidad a la mitad y a veces impide actuar", () => {
  // Turno 1: Plumazul (55) ataca antes que Chispardo (50), que usa Chispa y lo paraliza (0,1 < 30 %).
  // Turno 2: Plumazul (55 -> 27) ya es más lento que Chispardo, y 0,1 < 25 %: no actúa.
  const c = combate(["chispardo", "brason", "marejon"], ["plumazul", "musgolem", "rocadonte"], secuencia(0.5, 0.5, 0.5, 0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.1));
  c.elegirAccion(ANA, atacar("chispa"));
  c.elegirAccion(LUIS, atacar("embestida"));
  assert.equal(c.vista(LUIS).yo.equipo[0].estado, "paralizado");
  c.elegirAccion(ANA, atacar("embestida"));
  c.elegirAccion(LUIS, atacar("embestida"));
  const ev = c.vista(LUIS).eventos;
  assert.equal(ev[0].quien, "rival", "Chispardo ataca primero");
  assert.deepEqual([ev[1].tipo, ev[1].estado], ["no-actua", "paralizado"]);
});

test("Drenaje cura al atacante la mitad del daño que hace", () => {
  // Pirolince (rápido) golpea primero a Musgolem, que después usa Drenaje.
  const c = combate(["musgolem", "brason", "voltarda"], ["pirolince", "marejon", "rocadonte"]);
  c.elegirAccion(ANA, atacar("drenaje"));
  c.elegirAccion(LUIS, atacar("embestida"));
  const ev = c.vista(ANA).eventos;
  const golpe = ev.find((e) => e.quien === "rival" && e.tipo === "ataque");
  const mio = ev.find((e) => e.quien === "yo" && e.tipo === "ataque");
  const drena = ev.find((e) => e.tipo === "drena");
  assert.equal(drena.cura, Math.min(golpe.danio, Math.floor(mio.danio / 2)));
  assert.equal(c.vista(ANA).yo.equipo[0].ps, 100 - golpe.danio + drena.cura);
});

test("el cambio de criatura va antes que los ataques y recibe el golpe la nueva", () => {
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  c.elegirAccion(ANA, cambiar(1));
  c.elegirAccion(LUIS, atacar("embestida"));
  const ev = c.vista(ANA).eventos;
  assert.deepEqual([ev[0].tipo, ev[0].criatura], ["cambio", "Brasón"]);
  assert.equal(ev[1].objetivo, "Brasón");
  assert.equal(c.vista(ANA).yo.activa, 1);
  assert.equal(c.vista(LUIS).rival.activa.nombre, "Brasón");
});

test("si cae una criatura, su dueño debe sacar otra antes de seguir", () => {
  // Ciclonia (90) usa Vendaval contra Espinara (planta, 70 PS): la debilita de un golpe.
  const c = combate(["ciclonia", "pirolince", "voltarda"], ["espinara", "musgolem", "plumazul"]);
  c.elegirAccion(ANA, atacar("vendaval"));
  c.elegirAccion(LUIS, atacar("embestida"));
  assert.deepEqual(tipos(c), ["ataque", "debilitada"], "Espinara cae antes de actuar");
  assert.equal(c.vista(LUIS).yo.debeCambiar, true);
  assert.equal(c.vista(ANA).rival.restantes, 2);
  esperarError(() => c.elegirAccion(ANA, atacar("vendaval")), "ESPERA_RIVAL");
  esperarError(() => c.elegirAccion(LUIS, atacar("embestida")), "ACCION_INVALIDA");
  esperarError(() => c.elegirAccion(LUIS, cambiar(0)), "CAMBIO_INVALIDO");
  assert.equal(c.elegirAccion(LUIS, cambiar(2)), true);
  assert.equal(c.vista(ANA).rival.activa.nombre, "Plumazul");
  assert.equal(c.vista(LUIS).yo.debeCambiar, false);
  // Y el combate sigue con normalidad.
  c.elegirAccion(ANA, atacar("embestida"));
  assert.equal(c.elegirAccion(LUIS, atacar("embestida")), true);
});

// ---------- RNF-10 el servidor valida cada acción ----------

test("[error] no se puede actuar dos veces en el mismo turno", () => {
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  c.elegirAccion(ANA, atacar("embestida"));
  esperarError(() => c.elegirAccion(ANA, atacar("llamarada")), "ACCION_YA_ELEGIDA");
});

test("[error] no se puede usar un movimiento que la criatura no conoce", () => {
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  esperarError(() => c.elegirAccion(ANA, atacar("torrente")), "MOVIMIENTO_INVALIDO");
  esperarError(() => c.elegirAccion(ANA, atacar("golpe-mortal")), "MOVIMIENTO_INVALIDO");
  esperarError(() => c.elegirAccion(ANA, atacar(undefined)), "MOVIMIENTO_INVALIDO");
});

test("[error] acciones mal formadas o cambios imposibles se rechazan", () => {
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  esperarError(() => c.elegirAccion(ANA, { tipo: "ganar" }), "ACCION_INVALIDA");
  esperarError(() => c.elegirAccion(ANA, undefined), "ACCION_INVALIDA");
  esperarError(() => c.elegirAccion(ANA, cambiar(0)), "CAMBIO_INVALIDO");
  esperarError(() => c.elegirAccion(ANA, cambiar(7)), "CAMBIO_INVALIDO");
  esperarError(() => c.elegirAccion(ANA, cambiar("1")), "CAMBIO_INVALIDO");
});

test("[error] no se puede atacar mientras se eligen los equipos", () => {
  const c = new Combate([ANA, LUIS]);
  c.elegirEquipo(ANA, ["pirolince", "brason", "voltarda"]);
  esperarError(() => c.elegirAccion(ANA, atacar("embestida")), "FASE_INCORRECTA");
});

test("la vista nunca revela la acción elegida ni el banquillo del rival", () => {
  const c = combate(["ciclonia", "pirolince", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  c.elegirAccion(ANA, atacar("vendaval"));
  const v = c.vista(LUIS);
  assert.deepEqual(Object.keys(v.rival).sort(), ["activa", "debeCambiar", "eleccionHecha", "equipoElegido", "restantes"]);
  assert.deepEqual(Object.keys(v.rival.activa).sort(), ["elemento", "estado", "id", "nombre", "ps", "psMax"]);
  assert.equal(JSON.stringify(v).includes("pirolince"), false);
  assert.equal(JSON.stringify(v).includes("@"), false);
});

// ---------- RF-18 fin de la partida ----------

test("gana quien deja al rival sin criaturas", () => {
  const c = combate(["ciclonia", "pirolince", "voltarda"], ["espinara", "musgolem", "plumazul"]);
  for (let i = 0; i < 200 && c.fase !== "terminada"; i++) {
    for (const e of [ANA, LUIS]) {
      const v = c.vista(e);
      if (c.fase === "terminada") break;
      if (v.yo.debeCambiar) {
        c.elegirAccion(e, cambiar(v.yo.equipo.findIndex((x) => x.ps > 0)));
      } else if (!v.rival.debeCambiar && !v.yo.eleccionHecha) {
        c.elegirAccion(e, atacar(v.yo.equipo[v.yo.activa].movimientos[0].id));
      }
    }
  }
  assert.equal(c.fase, "terminada");
  const vAna = c.vista(ANA);
  const vLuis = c.vista(LUIS);
  assert.equal(vAna.motivo, "sin-criaturas");
  assert.ok(["yo", "rival"].includes(vAna.ganador));
  assert.notEqual(vAna.ganador, vLuis.ganador, "cada uno ve el resultado desde su lado");
  const perdedor = vAna.ganador === "yo" ? vLuis : vAna;
  assert.equal(perdedor.yo.equipo.every((x) => x.ps === 0), true);
  assert.equal(vAna.eventos.at(-1).tipo, "fin");
  esperarError(() => c.elegirAccion(ANA, atacar("embestida")), "FASE_INCORRECTA");
});

test("si un jugador abandona, gana el otro", () => {
  const c = combate(["pirolince", "brason", "voltarda"], ["marejon", "musgolem", "rocadonte"]);
  c.abandonar(LUIS);
  assert.deepEqual([c.vista(ANA).ganador, c.vista(ANA).motivo], ["yo", "abandono"]);
  assert.equal(c.vista(LUIS).ganador, "rival");
  c.abandonar(ANA); // ya terminado: no cambia el resultado
  assert.equal(c.vista(ANA).ganador, "yo");
});

test("abandonar durante la elección de equipos también da la victoria al rival", () => {
  const c = new Combate([ANA, LUIS]);
  c.abandonar(ANA);
  assert.equal(c.vista(LUIS).ganador, "yo");
});
