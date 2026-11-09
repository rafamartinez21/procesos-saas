// Pruebas unitarias de las salas de partida (servidor/juego/salas.js), hito 5.
// Lógica pura: sin Socket.IO, sin servidor y sin base de datos.

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Salas, codigoAleatorio } = require("../servidor/juego/salas.js");

const ana = { email: "ana@test.es", nombre: "Ana" };
const luis = { email: "luis@test.es", nombre: "Luis" };
const eva = { email: "eva@test.es", nombre: "" };

let salas;

beforeEach(() => {
  let n = 0;
  let reloj = 1000;
  salas = new Salas({ generarId: () => `P${++n}`, ahora: () => reloj++ });
});

function esperarError(fn, codigo) {
  assert.throws(fn, (err) => {
    assert.equal(err.name, "ErrorNegocio");
    assert.equal(err.codigo, codigo);
    return true;
  });
}

// ---------- RF-11 crear ----------

test("crear una partida la deja abierta con el creador como único jugador", () => {
  const p = salas.crearPartida(ana);
  assert.deepEqual(p, { id: "P1", estado: "abierta", creador: "Ana", jugadores: ["Ana"], plazas: 1, creada: 1000, espectadores: 0 });
});

test("la vista de una partida nunca incluye emails", () => {
  salas.crearPartida(ana);
  salas.unirse("P1", luis);
  assert.equal(JSON.stringify(salas.obtener("P1")).includes("@"), false);
  assert.equal(JSON.stringify(salas.partidaDe("ana@test.es")).includes("@"), false);
});

test("sin nombre, se muestra la parte del email antes de la @", () => {
  assert.equal(salas.crearPartida(eva).creador, "eva");
});

test("[error] no se puede crear una partida sin jugador identificado", () => {
  esperarError(() => salas.crearPartida(undefined), "NO_AUTENTICADO");
  esperarError(() => salas.crearPartida({ nombre: "x" }), "NO_AUTENTICADO");
});

test("[error] un jugador que ya está en una partida no puede crear otra", () => {
  salas.crearPartida(ana);
  esperarError(() => salas.crearPartida(ana), "YA_EN_PARTIDA");
});

test("si el generador repite un código se pide otro", () => {
  const ids = ["AAAAA", "AAAAA", "BBBBB"];
  const s = new Salas({ generarId: () => ids.shift() });
  assert.equal(s.crearPartida(ana).id, "AAAAA");
  assert.equal(s.crearPartida(luis).id, "BBBBB");
});

test("el código por defecto tiene 5 caracteres sin letras que se confundan", () => {
  for (let i = 0; i < 50; i++) assert.match(codigoAleatorio(), /^[A-HJ-NP-Z2-9]{5}$/);
});

// ---------- RF-12 listar ----------

test("la lista muestra solo las partidas abiertas, de la más antigua a la más nueva", () => {
  salas.crearPartida(ana);
  salas.crearPartida(luis);
  salas.crearPartida(eva);
  salas.unirse("P2", { email: "otro@test.es", nombre: "Otro" });
  assert.deepEqual(salas.listarAbiertas().map((p) => p.id), ["P1", "P3"]);
});

test("sin partidas, la lista está vacía", () => {
  assert.deepEqual(salas.listarAbiertas(), []);
});

// ---------- RF-13 unirse ----------

test("unirse a una partida abierta la completa con los dos jugadores", () => {
  salas.crearPartida(ana);
  const p = salas.unirse("P1", luis);
  assert.equal(p.estado, "completa");
  assert.deepEqual(p.jugadores, ["Ana", "Luis"]);
  assert.equal(p.plazas, 0);
  assert.deepEqual(salas.emailsDe("P1"), ["ana@test.es", "luis@test.es"]);
});

test("el código de partida no distingue mayúsculas ni espacios", () => {
  salas.crearPartida(ana);
  assert.equal(salas.unirse("  p1 ", luis).estado, "completa");
});

test("[error] no se puede unir a una partida que no existe", () => {
  esperarError(() => salas.unirse("NOEXISTE", luis), "PARTIDA_NO_ENCONTRADA");
  esperarError(() => salas.unirse(undefined, luis), "PARTIDA_NO_ENCONTRADA");
});

test("[error] un tercer jugador no puede entrar en una partida completa", () => {
  salas.crearPartida(ana);
  salas.unirse("P1", luis);
  esperarError(() => salas.unirse("P1", eva), "PARTIDA_LLENA");
});

test("[error] el creador no puede unirse a su propia partida", () => {
  salas.crearPartida(ana);
  esperarError(() => salas.unirse("P1", ana), "YA_EN_PARTIDA");
});

test("[error] quien ya está en otra partida no puede unirse a una nueva", () => {
  salas.crearPartida(ana);
  salas.crearPartida(luis);
  esperarError(() => salas.unirse("P2", ana), "YA_EN_PARTIDA");
});

// ---------- RF-14 abandonar ----------

test("si el único jugador abandona, la partida desaparece", () => {
  salas.crearPartida(ana);
  assert.deepEqual(salas.abandonar("ana@test.es"), { id: "P1", partida: null, restantes: [], espectadores: [] });
  assert.deepEqual(salas.listarAbiertas(), []);
  assert.equal(salas.partidaDe("ana@test.es"), null);
  esperarError(() => salas.obtener("P1"), "PARTIDA_NO_ENCONTRADA");
});

test("si abandona uno de dos durante el combate, gana el otro y la partida no vuelve a la lista (RF-18)", () => {
  salas.crearPartida(ana);
  salas.unirse("P1", luis);
  const r = salas.abandonar("ana@test.es");
  assert.deepEqual(r.restantes, ["luis@test.es"]);
  assert.equal(r.partida.estado, "terminada");
  assert.deepEqual(salas.listarAbiertas(), []);
  const v = salas.vistaCombate("luis@test.es");
  assert.deepEqual([v.ganador, v.motivo], ["yo", "abandono"]);
  // Cuando el que queda también sale, la partida desaparece.
  assert.equal(salas.abandonar("luis@test.es").partida, null);
  esperarError(() => salas.obtener("P1"), "PARTIDA_NO_ENCONTRADA");
});

test("tras abandonar, el jugador puede crear otra partida", () => {
  salas.crearPartida(ana);
  salas.abandonar("ana@test.es");
  assert.equal(salas.crearPartida(ana).id, "P2");
});

test("[error] no se puede abandonar si no se está en ninguna partida", () => {
  esperarError(() => salas.abandonar("ana@test.es"), "NO_EN_PARTIDA");
});

// ---------- combate dentro de la partida (hito 6) ----------

function partidaCompleta(opciones = {}) {
  let n = 0;
  const terminadas = [];
  const s = new Salas({ generarId: () => `P${++n}`, aleatorio: () => 0.5, alTerminar: (r) => terminadas.push(r), ...opciones });
  s.crearPartida(ana);
  s.unirse("P1", luis);
  return { s, terminadas };
}

test("con dos jugadores empieza el combate en la fase de elegir equipo", () => {
  const { s } = partidaCompleta();
  assert.equal(s.vistaCombate("ana@test.es").fase, "seleccion");
  assert.equal(s.vistaCombate("otro@test.es"), null);
  assert.deepEqual(s.participantesDe("P1"), ["ana@test.es", "luis@test.es"]);
});

test("una partida abierta aún no tiene combate", () => {
  salas.crearPartida(ana);
  assert.equal(salas.vistaCombate("ana@test.es"), null);
  esperarError(() => salas.elegirEquipo("ana@test.es", ["pirolince", "brason", "voltarda"]), "NO_EN_COMBATE");
  esperarError(() => salas.elegirAccion("luis@test.es", { tipo: "atacar", movimiento: "embestida" }), "NO_EN_COMBATE");
});

test("elegir equipo y acciones se delega en el combate de la partida", () => {
  const { s } = partidaCompleta();
  assert.equal(s.elegirEquipo("ana@test.es", ["pirolince", "brason", "voltarda"]), "P1");
  s.elegirEquipo("luis@test.es", ["marejon", "musgolem", "rocadonte"]);
  assert.equal(s.vistaCombate("luis@test.es").fase, "combate");
  s.elegirAccion("ana@test.es", { tipo: "atacar", movimiento: "embestida" });
  s.elegirAccion("luis@test.es", { tipo: "atacar", movimiento: "embestida" });
  assert.equal(s.vistaCombate("ana@test.es").turno, 2);
});

test("al terminar el combate la partida queda terminada y se avisa una sola vez con el resultado", () => {
  const { s, terminadas } = partidaCompleta();
  s.elegirEquipo("ana@test.es", ["pirolince", "brason", "voltarda"]);
  s.elegirEquipo("luis@test.es", ["marejon", "musgolem", "rocadonte"]);
  s.abandonar("luis@test.es");
  assert.equal(s.obtener("P1").estado, "terminada");
  s.abandonar("ana@test.es");
  assert.equal(terminadas.length, 1);
  assert.deepEqual(terminadas[0], {
    id: "P1",
    jugadores: [{ email: "ana@test.es", nombre: "Ana" }, { email: "luis@test.es", nombre: "Luis" }],
    ganador: "ana@test.es",
    motivo: "abandono",
    turnos: 1,
  });
});

// ---------- RF-25 contra la máquina ----------

test("contra la máquina la partida empieza completa, la máquina ya ha elegido equipo y no sale en la lista", () => {
  const p = salas.crearPartidaContraMaquina(ana);
  assert.equal(p.estado, "completa");
  assert.deepEqual(p.jugadores, ["Ana", "Autómata de Aetheria"]);
  assert.deepEqual(salas.listarAbiertas(), []);
  const v = salas.vistaCombate("ana@test.es");
  assert.equal(v.fase, "seleccion");
  assert.equal(v.rival.equipoElegido, true);
});

test("contra la máquina, cada acción del jugador recibe respuesta inmediata", () => {
  const { s } = partidaCompleta();
  s.abandonar("ana@test.es");
  s.abandonar("luis@test.es");
  s.crearPartidaContraMaquina(ana);
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "voltarda"]);
  assert.equal(s.vistaCombate("ana@test.es").fase, "combate");
  s.elegirAccion("ana@test.es", { tipo: "atacar", movimiento: "embestida" });
  const v = s.vistaCombate("ana@test.es");
  assert.equal(v.turno, 2, "el turno se ha resuelto sin esperar");
  assert.ok(v.eventos.some((e) => e.quien === "rival"));
});

test("una partida contra la máquina se puede jugar hasta el final y no cuenta para el ranking (D-25)", () => {
  const { s, terminadas } = partidaCompleta();
  s.abandonar("ana@test.es");
  s.abandonar("luis@test.es");
  terminadas.length = 0;
  s.crearPartidaContraMaquina(ana);
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "voltarda"]);
  for (let i = 0; i < 300; i++) {
    const v = s.vistaCombate("ana@test.es");
    if (v.fase === "terminada") break;
    if (v.yo.debeCambiar) s.elegirAccion("ana@test.es", { tipo: "cambiar", indice: v.yo.equipo.findIndex((c) => c.ps > 0) });
    else if (!v.yo.eleccionHecha && !v.rival.debeCambiar) s.elegirAccion("ana@test.es", { tipo: "atacar", movimiento: v.yo.equipo[v.yo.activa].movimientos[0].id });
  }
  assert.equal(s.vistaCombate("ana@test.es").fase, "terminada");
  assert.equal(s.obtener("P2").estado, "terminada");
  assert.equal(terminadas.length, 0);
});

test("si el jugador sale de una partida contra la máquina, la partida desaparece", () => {
  salas.crearPartidaContraMaquina(ana);
  assert.equal(salas.abandonar("ana@test.es").partida, null);
  assert.equal(salas.partidaDe("ana@test.es"), null);
});

test("[error] quien ya está en una partida no puede empezar otra contra la máquina", () => {
  salas.crearPartida(ana);
  esperarError(() => salas.crearPartidaContraMaquina(ana), "YA_EN_PARTIDA");
});

// ---------- RF-22 chat ----------

test("un mensaje del chat lleva el nombre del autor, nunca su email, y se guarda para quien se reconecta", () => {
  salas.crearPartida(ana);
  salas.unirse("P1", luis);
  const r = salas.enviarMensaje("ana@test.es", "¡Suerte!");
  assert.equal(r.id, "P1");
  assert.deepEqual({ autor: r.mensaje.autor, texto: r.mensaje.texto }, { autor: "Ana", texto: "¡Suerte!" });
  assert.equal(JSON.stringify(r).includes("@"), false);
  assert.deepEqual(salas.chatDe("luis@test.es").map((m) => m.texto), ["¡Suerte!"]);
});

test("el texto se limpia: sin saltos de línea, caracteres de control ni espacios de sobra", () => {
  salas.crearPartida(ana);
  assert.equal(salas.enviarMensaje("ana@test.es", "  hola\n\n  qué\ttal\u0007 ").mensaje.texto, "hola qué tal");
});

test("el HTML no se interpreta: se guarda tal cual como texto", () => {
  salas.crearPartida(ana);
  assert.equal(salas.enviarMensaje("ana@test.es", "<img src=x onerror=alert(1)>").mensaje.texto, "<img src=x onerror=alert(1)>");
});

test("[error] mensajes vacíos, no textuales o de más de 200 caracteres se rechazan", () => {
  salas.crearPartida(ana);
  esperarError(() => salas.enviarMensaje("ana@test.es", "   \n "), "MENSAJE_INVALIDO");
  esperarError(() => salas.enviarMensaje("ana@test.es", 42), "MENSAJE_INVALIDO");
  esperarError(() => salas.enviarMensaje("ana@test.es", "a".repeat(201)), "MENSAJE_INVALIDO");
  assert.equal(salas.enviarMensaje("ana@test.es", "a".repeat(200)).mensaje.texto.length, 200);
});

test("[error] quien no está en una partida no puede escribir en ningún chat", () => {
  esperarError(() => salas.enviarMensaje("ana@test.es", "hola"), "NO_EN_PARTIDA");
  assert.deepEqual(salas.chatDe("ana@test.es"), []);
});

test("[error] como mucho 5 mensajes cada 10 segundos por jugador", () => {
  let t = 0;
  const s = new Salas({ generarId: () => "P1", ahora: () => t });
  s.crearPartida(ana);
  for (let i = 0; i < 5; i++) s.enviarMensaje("ana@test.es", `m${i}`);
  esperarError(() => s.enviarMensaje("ana@test.es", "uno más"), "DEMASIADOS_MENSAJES");
  t = 10 * 1000;
  assert.equal(s.enviarMensaje("ana@test.es", "ya puedo").mensaje.texto, "ya puedo");
});

test("solo se guardan los últimos 50 mensajes", () => {
  let t = 0;
  const s = new Salas({ generarId: () => "P1", ahora: () => (t += 3000) });
  s.crearPartida(ana);
  for (let i = 0; i < 60; i++) s.enviarMensaje("ana@test.es", `m${i}`);
  const chat = s.chatDe("ana@test.es");
  assert.equal(chat.length, 50);
  assert.equal(chat[0].texto, "m10");
});

// ---------- RF-23 espectadores ----------

function conCombate() {
  const s = new Salas({ generarId: () => "P1", aleatorio: () => 0.5 });
  s.crearPartida(ana);
  s.unirse("P1", luis);
  s.elegirEquipo("ana@test.es", ["pirolince", "brason", "voltarda"]);
  s.elegirEquipo("luis@test.es", ["marejon", "musgolem", "rocadonte"]);
  return s;
}

test("las partidas en curso se listan para mirarlas, con el número de espectadores", () => {
  const s = conCombate();
  assert.deepEqual(s.listarEnCurso().map((p) => [p.id, p.espectadores]), [["P1", 0]]);
  s.observar("P1", eva);
  assert.equal(s.listarEnCurso()[0].espectadores, 1);
});

test("el espectador ve a los dos jugadores por igual, sin banquillos, acciones ni emails", () => {
  const s = conCombate();
  s.elegirAccion("ana@test.es", { tipo: "atacar", movimiento: "llamarada" });
  const { vista } = s.observar("P1", eva);
  assert.deepEqual(vista.jugadores.map((j) => [j.nombre, j.activa.nombre, j.restantes, j.eleccionHecha]), [
    ["Ana", "Pirolince", 3, true],
    ["Luis", "Marejón", 3, false],
  ]);
  const texto = JSON.stringify(vista);
  assert.equal(texto.includes("@"), false);
  assert.equal(texto.includes("llamarada"), false, "no revela la acción elegida");
  assert.equal(texto.includes("brason"), false, "no revela el banquillo");
});

test("los eventos del turno llegan al espectador con el nombre de cada jugador", () => {
  const s = conCombate();
  s.observar("P1", eva);
  s.elegirAccion("ana@test.es", { tipo: "atacar", movimiento: "embestida" });
  s.elegirAccion("luis@test.es", { tipo: "atacar", movimiento: "embestida" });
  const v = s.vistaEspectador("P1");
  assert.deepEqual(v.eventos.map((e) => e.quien), ["Ana", "Luis"]);
  assert.equal(v.turno, 2);
});

test("[error] no se puede mirar una partida propia, una que no ha empezado o una que no existe", () => {
  const s = conCombate();
  esperarError(() => s.observar("P1", ana), "YA_EN_PARTIDA");
  esperarError(() => s.observar("NOEXI", eva), "PARTIDA_NO_ENCONTRADA");
  salas.crearPartida(ana);
  esperarError(() => salas.observar("P1", luis), "PARTIDA_SIN_COMBATE");
});

test("[error] mientras se mira una partida no se puede crear ni unirse a otra", () => {
  const s = conCombate();
  s.observar("P1", eva);
  esperarError(() => s.crearPartida(eva), "YA_EN_PARTIDA");
  assert.equal(s.dejarDeObservar("eva@test.es"), "P1");
  assert.equal(s.listarEnCurso()[0].espectadores, 0);
  esperarError(() => s.dejarDeObservar("eva@test.es"), "NO_OBSERVANDO");
});

test("el espectador lee el chat de la partida", () => {
  const s = conCombate();
  s.enviarMensaje("ana@test.es", "hola");
  s.observar("P1", eva);
  assert.deepEqual(s.chatDe("eva@test.es").map((m) => m.texto), ["hola"]);
  esperarError(() => s.enviarMensaje("eva@test.es", "yo también"), "NO_EN_PARTIDA");
});

test("cuando la partida desaparece, sus espectadores quedan libres", () => {
  const s = conCombate();
  s.observar("P1", eva);
  s.abandonar("ana@test.es");
  const r = s.abandonar("luis@test.es");
  assert.deepEqual(r.espectadores, ["eva@test.es"]);
  assert.equal(s.observandoDe("eva@test.es"), null);
  assert.equal(s.crearPartida(eva).id, "P1");
});

// ---------- RF-32: tiempo límite para decidir ----------

// Salas con un reloj que la prueba adelanta a mano.
function salasConReloj() {
  const reloj = { t: 0 };
  let n = 0;
  const s = new Salas({ generarId: () => `R${++n}`, ahora: () => reloj.t, aleatorio: () => 0.5, plazoEquipoMs: 60000, plazoTurnoMs: 45000 });
  return { s, reloj };
}

function duelo() {
  const { s, reloj } = salasConReloj();
  s.crearPartida(ana);
  s.unirse("R1", luis);
  return { s, reloj };
}

test("RF-32: la vista dice cuánto tiempo queda para decidir, solo a quien le toca", () => {
  const { s, reloj } = duelo();
  assert.equal(s.vistaCombate("ana@test.es").plazoMs, 60000);
  reloj.t = 15000;
  assert.equal(s.vistaCombate("ana@test.es").plazoMs, 45000);
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  assert.equal(s.vistaCombate("ana@test.es").plazoMs, null, "ya ha elegido");
  assert.equal(s.vistaCombate("luis@test.es").plazoMs, 45000);
});

test("RF-32: antes del plazo no pasa nada", () => {
  const { s, reloj } = duelo();
  reloj.t = 59999;
  assert.deepEqual(s.vencerPlazos(), []);
  assert.equal(s.vistaCombate("ana@test.es").fase, "seleccion");
});

test("RF-32: si se acaba el tiempo de elegir equipo, el servidor elige uno válido por quien falta", () => {
  const { s, reloj } = duelo();
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  reloj.t = 60000;
  assert.deepEqual(s.vencerPlazos(), ["R1"]);
  const v = s.vistaCombate("luis@test.es");
  assert.equal(v.fase, "combate");
  assert.equal(v.yo.equipo.length, 3);
  assert.equal(v.ausencias, 1);
  assert.equal(s.vistaCombate("ana@test.es").ausencias, 0);
});

test("RF-32: si se acaba el tiempo del turno, el servidor actúa por quien falta y el turno se resuelve", () => {
  const { s, reloj } = duelo();
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  s.elegirEquipo("luis@test.es", ["voltarda", "rocadonte", "ciclonia"]);
  s.elegirAccion("ana@test.es", { tipo: "atacar", movimiento: "llamarada" });
  reloj.t = 45000;
  s.vencerPlazos();
  const v = s.vistaCombate("ana@test.es");
  assert.equal(v.turno, 2, "el turno se ha resuelto");
  assert.ok(v.eventos.some((e) => e.quien === "rival"), "el rival ha actuado");
  // Empieza un plazo nuevo para el turno 2.
  assert.equal(v.plazoMs, 45000);
});

test("RF-32: quien deja pasar tres plazos seguidos pierde por inactividad", () => {
  const terminadas = [];
  const reloj = { t: 0 };
  const s = new Salas({ generarId: () => "R1", ahora: () => reloj.t, aleatorio: () => 0.5, alTerminar: (r) => terminadas.push(r) });
  s.crearPartida(ana);
  s.unirse("R1", luis);
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  reloj.t += 60000;
  s.vencerPlazos(); // 1: equipo de Luis
  for (let i = 0; i < 2; i++) {
    s.elegirAccion("ana@test.es", { tipo: "cambiar", indice: s.vistaCombate("ana@test.es").yo.activa === 0 ? 1 : 0 });
    reloj.t += 45000;
    s.vencerPlazos(); // 2 y 3
  }
  const v = s.vistaCombate("ana@test.es");
  assert.equal(v.fase, "terminada");
  assert.equal(v.ganador, "yo");
  assert.equal(v.motivo, "inactividad");
  assert.equal(terminadas[0].motivo, "inactividad");
});

test("RF-32: decidir a tiempo vuelve a poner a cero las ausencias", () => {
  const { s, reloj } = duelo();
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  reloj.t = 60000;
  s.vencerPlazos();
  assert.equal(s.vistaCombate("luis@test.es").ausencias, 1);
  s.elegirAccion("luis@test.es", { tipo: "atacar", movimiento: s.vistaCombate("luis@test.es").yo.equipo[0].movimientos[0].id });
  assert.equal(s.vistaCombate("luis@test.es").ausencias, 0);
});

test("RF-32: contra el Autómata el plazo solo corre para la persona", () => {
  const { s, reloj } = salasConReloj();
  s.crearPartidaContraMaquina(ana);
  reloj.t = 60000;
  s.vencerPlazos();
  const v = s.vistaCombate("ana@test.es");
  assert.equal(v.fase, "combate");
  assert.equal(v.ausencias, 1);
});

// ---------- RF-33: emparejamiento rápido ----------

const { margenElo } = require("../servidor/juego/salas.js");

test("RF-33: el margen de ELO empieza en 100 y crece con la espera hasta 400", () => {
  assert.equal(margenElo(0), 100);
  assert.equal(margenElo(9999), 100);
  assert.equal(margenElo(10000), 150);
  assert.equal(margenElo(30000), 250);
  assert.equal(margenElo(10 * 60 * 1000), 400);
});

test("RF-33: si nadie busca, el jugador queda en la cola", () => {
  const { s } = salasConReloj();
  const r = s.buscarRival(ana, 1000);
  assert.deepEqual(r, { buscando: { elo: 1000, esperaMs: 0, margen: 100 } });
  assert.equal(s.enCola(), 1);
  assert.equal(s.partidaDe("ana@test.es"), null);
});

test("RF-33: dos jugadores de ELO parecido se emparejan al momento y empieza la elección de equipo", () => {
  const { s } = salasConReloj();
  s.buscarRival(ana, 1000);
  const { partida } = s.buscarRival(luis, 1080);
  assert.equal(partida.estado, "completa");
  assert.deepEqual(partida.jugadores, ["Ana", "Luis"]);
  assert.equal(s.enCola(), 0);
  assert.equal(s.vistaCombate("ana@test.es").fase, "seleccion");
  assert.equal(s.listarAbiertas().length, 0, "no aparece como sala abierta");
});

test("RF-33: con mucha diferencia de ELO esperan hasta que el margen crece lo bastante", () => {
  const { s, reloj } = salasConReloj();
  s.buscarRival(ana, 1000);
  assert.ok(s.buscarRival(luis, 1220).buscando, "220 > 100: no se emparejan aún");
  reloj.t = 20000; // margen 200: todavía no
  assert.deepEqual(s.emparejarCola(), []);
  reloj.t = 30000; // margen 250 para los dos
  const creadas = s.emparejarCola();
  assert.equal(creadas.length, 1);
  assert.deepEqual(creadas[0].jugadores, ["Ana", "Luis"]);
});

test("RF-33: se empareja con el más cercano en ELO de los que encajan", () => {
  const { s } = salasConReloj();
  // Luis (1090) y Eva (940) no encajan entre sí (150 > 100); Ana (1000) encaja con los dos.
  s.buscarRival(luis, 1090);
  assert.ok(s.buscarRival(eva, 940).buscando);
  const { partida } = s.buscarRival(ana, 1000);
  assert.deepEqual(partida.jugadores, ["eva", "Ana"], "Eva está a 60 y Luis a 90");
  assert.ok(s.busquedaDe("luis@test.es"), "Luis sigue buscando");
});

test("RF-33: [error] no se puede buscar dos veces ni crear partidas mientras se busca; se puede cancelar", () => {
  const { s } = salasConReloj();
  s.buscarRival(ana, 1000);
  esperarError(() => s.buscarRival(ana, 1000), "BUSCANDO_RIVAL");
  esperarError(() => s.crearPartida(ana), "BUSCANDO_RIVAL");
  s.cancelarBusqueda("ana@test.es");
  assert.equal(s.busquedaDe("ana@test.es"), null);
  esperarError(() => s.cancelarBusqueda("ana@test.es"), "NO_BUSCANDO");
  assert.ok(s.crearPartida(ana));
});

// ---------- RF-34: revancha ----------

function combateTerminado() {
  const terminadas = [];
  const reloj = { t: 0 };
  const s = new Salas({ generarId: () => "V1", ahora: () => reloj.t, aleatorio: () => 0.5, alTerminar: (r) => terminadas.push(r) });
  s.crearPartida(ana);
  s.unirse("V1", luis);
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  s.elegirEquipo("luis@test.es", ["voltarda", "rocadonte", "ciclonia"]);
  s.abandonar("luis@test.es"); // Luis se rinde... y sale
  return { s, terminadas };
}

test("RF-34: [error] no hay revancha si el combate sigue o si el rival ya se fue", () => {
  const { s } = duelo();
  esperarError(() => s.pedirRevancha("ana@test.es"), "COMBATE_EN_CURSO");
  const fuera = combateTerminado();
  esperarError(() => fuera.s.pedirRevancha("ana@test.es"), "RIVAL_SE_FUE");
});

test("RF-34: cuando los dos piden la revancha empieza otro combate en la misma partida", () => {
  const terminadas = [];
  const reloj = { t: 0 };
  const s = new Salas({ generarId: () => "V1", ahora: () => reloj.t, aleatorio: () => 0.5, alTerminar: (r) => terminadas.push(r) });
  s.crearPartida(ana);
  s.unirse("V1", luis);
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  s.elegirEquipo("luis@test.es", ["voltarda", "rocadonte", "ciclonia"]);
  // Luis deja pasar tres plazos: pierde por inactividad, pero sigue en la partida.
  for (let i = 0; i < 3; i++) {
    s.elegirAccion("ana@test.es", { tipo: "cambiar", indice: s.vistaCombate("ana@test.es").yo.activa === 0 ? 1 : 0 });
    reloj.t += 45000;
    s.vencerPlazos();
  }
  assert.equal(s.vistaCombate("ana@test.es").fase, "terminada");
  assert.deepEqual(s.vistaCombate("ana@test.es").revancha, { yo: false, rival: false, rivalPresente: true });
  assert.deepEqual(s.pedirRevancha("ana@test.es"), { id: "V1", empieza: false });
  assert.deepEqual(s.vistaCombate("luis@test.es").revancha, { yo: false, rival: true, rivalPresente: true });
  assert.deepEqual(s.pedirRevancha("luis@test.es"), { id: "V1", empieza: true });
  const v = s.vistaCombate("ana@test.es");
  assert.equal(v.fase, "seleccion");
  assert.equal(v.revancha, undefined);
  assert.equal(s.obtener("V1").estado, "completa");
  // Cada combate se registra con su propio id.
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  s.elegirEquipo("luis@test.es", ["voltarda", "rocadonte", "ciclonia"]);
  s.abandonar("luis@test.es");
  assert.deepEqual(terminadas.map((t) => t.id), ["V1", "V1-2"]);
});

test("RF-34: contra el Autómata la revancha empieza en cuanto la pides", () => {
  const { s } = salasConReloj();
  s.crearPartidaContraMaquina(ana);
  s.elegirEquipo("ana@test.es", ["pirolince", "marejon", "musgolem"]);
  // Ana se rinde sin salir: se simula terminando el combate a mano.
  const id = s.partidaDe("ana@test.es").id;
  for (let i = 0; i < 300 && s.vistaCombate("ana@test.es").fase !== "terminada"; i++) {
    const v = s.vistaCombate("ana@test.es");
    if (v.yo.debeCambiar) s.elegirAccion("ana@test.es", { tipo: "cambiar", indice: v.yo.equipo.findIndex((c, j) => c.ps > 0 && j !== v.yo.activa) });
    else if (!v.yo.eleccionHecha && !v.rival.debeCambiar) s.elegirAccion("ana@test.es", { tipo: "atacar", movimiento: "embestida" });
  }
  assert.equal(s.vistaCombate("ana@test.es").fase, "terminada");
  assert.deepEqual(s.pedirRevancha("ana@test.es"), { id, empieza: true });
  assert.equal(s.vistaCombate("ana@test.es").fase, "seleccion");
});
