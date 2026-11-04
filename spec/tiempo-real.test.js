// Pruebas de la capa de tiempo real (servidor/tiempo-real.js), hito 5.
// Arrancan el servidor de verdad en un puerto libre y se conectan con el cliente oficial
// de Socket.IO, enviando la cookie de sesión como haría el navegador.

const { test, before, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { io: conectar } = require("socket.io-client");
const { Sistema } = require("../servidor/modelo.js");
const { CadMemoria } = require("../servidor/cad-memoria.js");
const { crearApp } = require("../servidor/api.js");
const { Sesiones } = require("../servidor/sesiones.js");
const { Salas } = require("../servidor/juego/salas.js");
const { conectarTiempoReal } = require("../servidor/tiempo-real.js");
const { registroSilencioso } = require("../servidor/registro.js");

const CLAVE = "claveSegura1";
let servidor;
let io;
let base;
let sistema;
let sesiones;
let salas;
let clientes = [];

before(async () => {
  sistema = new Sistema(new CadMemoria(), { autoConfirmar: true });
  sesiones = new Sesiones();
  await sistema.registrarUsuario({ email: "ana@test.es", nombre: "Ana", password: CLAVE });
  await sistema.registrarUsuario({ email: "luis@test.es", nombre: "Luis", password: CLAVE });
  await sistema.registrarUsuario({ email: "eva@test.es", nombre: "Eva", password: CLAVE });
});

// Cada prueba arranca su propio servidor, sin partidas.
beforeEach(async () => {
  salas = new Salas();
  servidor = http.createServer(crearApp(sistema, { sesiones, registro: registroSilencioso }));
  io = conectarTiempoReal(servidor, { sistema, salas, sesiones, registro: registroSilencioso, esperaReconexionMs: 50 });
  await new Promise((resolve) => servidor.listen(0, resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

afterEach(async () => {
  for (const c of clientes) c.disconnect();
  clientes = [];
  await new Promise((resolve) => io.close(resolve)); // cierra también el servidor HTTP
});

// Cliente conectado con la cookie de una sesión nueva del usuario.
async function clienteDe(email) {
  const sid = await sesiones.crear(email);
  return clienteConCookie(`sid=${sid}`);
}

function clienteConCookie(cookie) {
  const c = conectar(base, {
    transports: ["websocket"],
    extraHeaders: cookie ? { cookie } : {},
    reconnection: false,
    forceNew: true,
  });
  clientes.push(c);
  return c;
}

const esperar = (cliente, evento) => new Promise((resolve) => cliente.once(evento, resolve));

// Espera al primer evento cuyo contenido cumpla la condición (los avisos pueden llegar en
// cualquier orden respecto a las respuestas).
const esperarQue = (cliente, evento, condicion) =>
  new Promise((resolve) => {
    const oyente = (datos) => {
      if (!condicion(datos)) return;
      cliente.off(evento, oyente);
      resolve(datos);
    };
    cliente.on(evento, oyente);
  });

const emitir = (cliente, evento, datos) =>
  new Promise((resolve) => (datos === undefined ? cliente.emit(evento, resolve) : cliente.emit(evento, datos, resolve)));

// Espera a estar conectado y a recibir la primera lista de partidas.
async function listo(cliente) {
  const lista = await esperar(cliente, "partidas");
  assert.equal(cliente.connected, true);
  return lista;
}

// ---------- RNF-09 ----------

test("[error] sin cookie de sesión la conexión se rechaza", async () => {
  const c = clienteConCookie(null);
  const err = await esperar(c, "connect_error");
  assert.equal(err.message, "NO_AUTENTICADO");
});

test("[error] con una cookie inventada la conexión se rechaza", async () => {
  const c = clienteConCookie("sid=inventada");
  const err = await esperar(c, "connect_error");
  assert.equal(err.message, "NO_AUTENTICADO");
});

test("[error] tras cerrar sesión, el canal deja de aceptar acciones", async () => {
  const sid = await sesiones.crear("ana@test.es");
  const c = clienteConCookie(`sid=${sid}`);
  await listo(c);
  await sesiones.destruir(sid);
  const r = await emitir(c, "partida:crear");
  assert.equal(r.ok, false);
  assert.equal(r.error, "NO_AUTENTICADO");
});

// ---------- RF-11 y RF-12 ----------

test("al conectar se recibe la lista de partidas abiertas", async () => {
  const c = await clienteDe("ana@test.es");
  assert.deepEqual(await listo(c), []);
});

test("crear una partida responde con ella y avisa en directo a los demás jugadores", async () => {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  await Promise.all([listo(ana), listo(luis)]);
  const aviso = esperarQue(luis, "partidas", (lista) => lista.length === 1);
  const r = await emitir(ana, "partida:crear");
  assert.equal(r.ok, true);
  assert.equal(r.partida.creador, "Ana");
  const lista = await aviso;
  assert.deepEqual(lista.map((p) => p.id), [r.partida.id]);
  assert.equal(JSON.stringify(lista).includes("@"), false, "la lista no debe incluir emails");
});

test("[error] crear dos partidas seguidas devuelve YA_EN_PARTIDA", async () => {
  const ana = await clienteDe("ana@test.es");
  await listo(ana);
  await emitir(ana, "partida:crear");
  const r = await emitir(ana, "partida:crear");
  assert.deepEqual([r.ok, r.error], [false, "YA_EN_PARTIDA"]);
});

// ---------- RF-13 ----------

test("unirse completa la partida y los dos jugadores reciben su estado", async () => {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  await Promise.all([listo(ana), listo(luis)]);
  const { partida } = await emitir(ana, "partida:crear");
  const estadoAna = esperar(ana, "partida:estado");
  const r = await emitir(luis, "partida:unirse", { id: partida.id });
  assert.equal(r.ok, true);
  assert.equal(r.partida.estado, "completa");
  assert.deepEqual((await estadoAna).jugadores, ["Ana", "Luis"]);
});

test("[error] un tercer jugador recibe PARTIDA_LLENA y una partida inexistente PARTIDA_NO_ENCONTRADA", async () => {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  const eva = await clienteDe("eva@test.es");
  await Promise.all([listo(ana), listo(luis), listo(eva)]);
  const { partida } = await emitir(ana, "partida:crear");
  await emitir(luis, "partida:unirse", { id: partida.id });
  assert.equal((await emitir(eva, "partida:unirse", { id: partida.id })).error, "PARTIDA_LLENA");
  assert.equal((await emitir(eva, "partida:unirse", { id: "NOEXI" })).error, "PARTIDA_NO_ENCONTRADA");
  assert.equal((await emitir(eva, "partida:unirse")).error, "PARTIDA_NO_ENCONTRADA");
});

// ---------- RF-14 ----------

test("si un jugador abandona, el rival recibe el aviso y gana el combate (RF-18)", async () => {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  await Promise.all([listo(ana), listo(luis)]);
  const { partida } = await emitir(ana, "partida:crear");
  await emitir(luis, "partida:unirse", { id: partida.id });
  const aviso = esperar(ana, "partida:rival-abandona");
  const victoria = esperarQue(ana, "combate:estado", (v) => v.fase === "terminada");
  const r = await emitir(luis, "partida:abandonar");
  assert.equal(r.ok, true);
  assert.deepEqual((await aviso).jugadores, ["Ana"]);
  const v = await victoria;
  assert.deepEqual([v.ganador, v.motivo], ["yo", "abandono"]);
  assert.deepEqual(salas.listarAbiertas(), []);
});

test("[error] abandonar sin estar en una partida devuelve NO_EN_PARTIDA", async () => {
  const ana = await clienteDe("ana@test.es");
  await listo(ana);
  assert.equal((await emitir(ana, "partida:abandonar")).error, "NO_EN_PARTIDA");
});

test("al desconectarse y no volver en el margen, el jugador sale de su partida", async () => {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  await Promise.all([listo(ana), listo(luis)]);
  await emitir(ana, "partida:crear");
  await esperarQue(luis, "partidas", (lista) => lista.length === 1);
  const aviso = esperarQue(luis, "partidas", (lista) => lista.length === 0);
  ana.disconnect();
  await aviso;
  assert.equal(salas.partidaDe("ana@test.es"), null);
});

test("con dos pestañas abiertas, cerrar una no saca al jugador de la partida", async () => {
  const pestana1 = await clienteDe("ana@test.es");
  const pestana2 = await clienteDe("ana@test.es");
  await Promise.all([listo(pestana1), listo(pestana2)]);
  const estado2 = esperar(pestana2, "partida:estado");
  await emitir(pestana1, "partida:crear");
  await estado2; // la otra pestaña también recibe la partida
  pestana1.disconnect();
  await new Promise((r) => setTimeout(r, 100));
  assert.notEqual(salas.partidaDe("ana@test.es"), null);
});

test("si se vuelve a conectar dentro del margen (recargar la página), sigue en su partida", async () => {
  const sid = await sesiones.crear("ana@test.es");
  const antes = clienteConCookie(`sid=${sid}`);
  await listo(antes);
  const { partida } = await emitir(antes, "partida:crear");
  antes.disconnect();
  const despues = clienteConCookie(`sid=${sid}`);
  const estado = await esperar(despues, "partida:estado");
  assert.equal(estado.id, partida.id);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(salas.partidaDe("ana@test.es").id, partida.id);
});

// ---------- combate en tiempo real (hito 6) ----------

// Dos jugadores en una partida completa, cada uno con su última vista del combate.
async function enCombate() {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  await Promise.all([listo(ana), listo(luis)]);
  const { partida } = await emitir(ana, "partida:crear");
  const seleccionAna = esperarQue(ana, "combate:estado", (v) => v.fase === "seleccion");
  const seleccionLuis = esperarQue(luis, "combate:estado", (v) => v.fase === "seleccion");
  await emitir(luis, "partida:unirse", { id: partida.id });
  await Promise.all([seleccionAna, seleccionLuis]);
  return { ana, luis, partida };
}

test("al completarse la partida, los dos reciben la fase de elegir equipo", async () => {
  await enCombate();
});

test("elegir equipos y atacar: cada jugador recibe su propia vista del turno resuelto", async () => {
  const { ana, luis } = await enCombate();
  const empiezaAna = esperarQue(ana, "combate:estado", (v) => v.fase === "combate");
  assert.equal((await emitir(ana, "combate:equipo", { criaturas: ["pirolince", "brason", "voltarda"] })).ok, true);
  assert.equal((await emitir(luis, "combate:equipo", { criaturas: ["marejon", "musgolem", "rocadonte"] })).ok, true);
  const v1 = await empiezaAna;
  assert.equal(v1.rival.activa.nombre, "Marejón");

  const turnoAna = esperarQue(ana, "combate:estado", (v) => v.turno === 2);
  const turnoLuis = esperarQue(luis, "combate:estado", (v) => v.turno === 2);
  await emitir(ana, "combate:accion", { tipo: "atacar", movimiento: "embestida" });
  await emitir(luis, "combate:accion", { tipo: "atacar", movimiento: "embestida" });
  const [vAna, vLuis] = await Promise.all([turnoAna, turnoLuis]);
  assert.equal(vAna.eventos.length, 2);
  assert.equal(vAna.eventos[0].quien, "yo", "Pirolince es más rápido");
  assert.equal(vLuis.eventos[0].quien, "rival");
  assert.equal(vAna.yo.equipo[0].id, "pirolince");
  assert.equal(vLuis.yo.equipo[0].id, "marejon");
});

test("[error] RNF-10: un movimiento que la criatura no conoce se rechaza y el rival no recibe nada", async () => {
  const { ana, luis } = await enCombate();
  await emitir(ana, "combate:equipo", { criaturas: ["pirolince", "brason", "voltarda"] });
  await emitir(luis, "combate:equipo", { criaturas: ["marejon", "musgolem", "rocadonte"] });
  const r = await emitir(ana, "combate:accion", { tipo: "atacar", movimiento: "golpe-final" });
  assert.deepEqual([r.ok, r.error], [false, "MOVIMIENTO_INVALIDO"]);
  assert.equal(salas.vistaCombate("luis@test.es").rival.eleccionHecha, false);
});

test("[error] sin estar en un combate, las acciones de combate se rechazan", async () => {
  const eva = await clienteDe("eva@test.es");
  await listo(eva);
  assert.equal((await emitir(eva, "combate:equipo", { criaturas: ["pirolince", "brason", "voltarda"] })).error, "NO_EN_COMBATE");
  assert.equal((await emitir(eva, "combate:accion", { tipo: "atacar", movimiento: "embestida" })).error, "NO_EN_COMBATE");
});

test("al volver a conectarse en mitad del combate se recibe la vista del combate", async () => {
  const { ana, luis } = await enCombate();
  await emitir(ana, "combate:equipo", { criaturas: ["pirolince", "brason", "voltarda"] });
  await emitir(luis, "combate:equipo", { criaturas: ["marejon", "musgolem", "rocadonte"] });
  const otraPestana = await clienteDe("ana@test.es");
  const v = await esperar(otraPestana, "combate:estado");
  assert.equal(v.fase, "combate");
  assert.equal(v.yo.equipo.length, 3);
});

// ---------- RF-25 ----------

test("partida contra la máquina: se crea, se elige equipo y cada ataque recibe respuesta", async () => {
  const ana = await clienteDe("ana@test.es");
  await listo(ana);
  const seleccion = esperarQue(ana, "combate:estado", (v) => v.fase === "seleccion");
  const r = await emitir(ana, "partida:crear-maquina");
  assert.equal(r.ok, true);
  assert.deepEqual(r.partida.jugadores, ["Ana", "Autómata de Aetheria"]);
  await seleccion;
  const empieza = esperarQue(ana, "combate:estado", (v) => v.fase === "combate");
  await emitir(ana, "combate:equipo", { criaturas: ["pirolince", "marejon", "voltarda"] });
  await empieza;
  const turno = esperarQue(ana, "combate:estado", (v) => v.turno === 2 || v.fase === "terminada");
  await emitir(ana, "combate:accion", { tipo: "atacar", movimiento: "embestida" });
  const v = await turno;
  assert.ok(v.eventos.some((e) => e.quien === "rival"), "la máquina también ha actuado");
});

// ---------- RF-22 ----------

test("chat: el mensaje llega a los dos jugadores con el nombre del autor y se reenvía al reconectarse", async () => {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  await Promise.all([listo(ana), listo(luis)]);
  const { partida } = await emitir(ana, "partida:crear");
  await emitir(luis, "partida:unirse", { id: partida.id });
  const llegaAna = esperar(ana, "chat:mensaje");
  const llegaLuis = esperar(luis, "chat:mensaje");
  assert.equal((await emitir(luis, "chat:enviar", { texto: "¡Buena suerte!" })).ok, true);
  const [mA, mL] = await Promise.all([llegaAna, llegaLuis]);
  assert.deepEqual([mA.autor, mA.texto], ["Luis", "¡Buena suerte!"]);
  assert.equal(mL.texto, "¡Buena suerte!");
  const otra = await clienteDe("ana@test.es");
  const historial = await esperar(otra, "chat:historial");
  assert.deepEqual(historial.map((m) => m.texto), ["¡Buena suerte!"]);
});

test("[error] chat: sin partida o con un mensaje vacío, se rechaza", async () => {
  const eva = await clienteDe("eva@test.es");
  await listo(eva);
  assert.equal((await emitir(eva, "chat:enviar", { texto: "hola" })).error, "NO_EN_PARTIDA");
  await emitir(eva, "partida:crear");
  assert.equal((await emitir(eva, "chat:enviar", { texto: "  " })).error, "MENSAJE_INVALIDO");
});

// ---------- RF-23 ----------

test("espectador: ve la partida en la lista de en curso, la mira y recibe cada turno sin la vista de los jugadores", async () => {
  const { ana, luis, partida } = await enCombate();
  const eva = await clienteDe("eva@test.es");
  const enCurso = await esperarQue(eva, "partidas:en-curso", (l) => l.length === 1);
  assert.equal(enCurso[0].id, partida.id);
  await emitir(ana, "combate:equipo", { criaturas: ["pirolince", "brason", "voltarda"] });
  await emitir(luis, "combate:equipo", { criaturas: ["marejon", "musgolem", "rocadonte"] });

  let recibioVistaDeJugador = false;
  eva.on("combate:estado", () => (recibioVistaDeJugador = true));
  const primera = esperar(eva, "espectador:estado");
  assert.equal((await emitir(eva, "partida:observar", { id: partida.id })).ok, true);
  assert.deepEqual((await primera).jugadores.map((j) => j.nombre), ["Ana", "Luis"]);

  const turno = esperarQue(eva, "espectador:estado", (v) => v.turno === 2);
  await emitir(ana, "combate:accion", { tipo: "atacar", movimiento: "embestida" });
  await emitir(luis, "combate:accion", { tipo: "atacar", movimiento: "embestida" });
  const v = await turno;
  assert.deepEqual(v.eventos.map((e) => e.quien), ["Ana", "Luis"]);
  assert.equal(JSON.stringify(v).includes("@"), false);
  assert.equal(recibioVistaDeJugador, false);
});

test("espectador: lee el chat de la partida", async () => {
  const { ana, partida } = await enCombate();
  const eva = await clienteDe("eva@test.es");
  await listo(eva);
  await emitir(eva, "partida:observar", { id: partida.id });
  const llega = esperar(eva, "chat:mensaje");
  await emitir(ana, "chat:enviar", { texto: "¡Hola, público!" });
  assert.equal((await llega).texto, "¡Hola, público!");
});

test("[error] espectador: un jugador no puede mirar su propia partida", async () => {
  const { ana, partida } = await enCombate();
  assert.equal((await emitir(ana, "partida:observar", { id: partida.id })).error, "YA_EN_PARTIDA");
});

test("espectador: cuando los dos jugadores salen, recibe el aviso de fin", async () => {
  const { ana, luis, partida } = await enCombate();
  const eva = await clienteDe("eva@test.es");
  await listo(eva);
  await emitir(eva, "partida:observar", { id: partida.id });
  const fin = esperar(eva, "espectador:fin");
  await emitir(ana, "partida:abandonar");
  await emitir(luis, "partida:abandonar");
  await fin;
  assert.equal(salas.observandoDe("eva@test.es"), null);
});
