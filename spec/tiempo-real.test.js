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

test("si un jugador abandona, el rival recibe el aviso y la partida vuelve a la lista", async () => {
  const ana = await clienteDe("ana@test.es");
  const luis = await clienteDe("luis@test.es");
  await Promise.all([listo(ana), listo(luis)]);
  const { partida } = await emitir(ana, "partida:crear");
  await emitir(luis, "partida:unirse", { id: partida.id });
  const aviso = esperar(ana, "partida:rival-abandona");
  const r = await emitir(luis, "partida:abandonar");
  assert.equal(r.ok, true);
  assert.deepEqual((await aviso).jugadores, ["Ana"]);
  assert.deepEqual(salas.listarAbiertas().map((p) => p.id), [partida.id]);
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
