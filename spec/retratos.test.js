// Pruebas de los retratos de las criaturas (RF-27).
// Los retratos son código del navegador (módulo ES de cliente/). Aquí se cargan en Node
// con un "document" mínimo que solo sabe crear nodos SVG, suficiente para comprobar que
// cada criatura del catálogo tiene su dibujo y que el retrato se construye bien.

const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { CATALOGO, ELEMENTOS } = require("../servidor/juego/criaturas.js");

// Nodo falso: guarda atributos e hijos.
function nodoFalso(etiqueta) {
  return {
    etiqueta,
    atributos: {},
    hijos: [],
    setAttribute(k, v) {
      this.atributos[k] = v;
    },
    append(...h) {
      this.hijos.push(...h);
    },
  };
}

// Cuenta los nodos de un árbol.
const contar = (n) => 1 + (n.hijos || []).reduce((t, h) => t + (typeof h === "object" ? contar(h) : 0), 0);

// Primer nodo del árbol que cumple la condición.
function buscar(n, cumple) {
  if (cumple(n)) return n;
  for (const h of n.hijos || []) {
    const r = typeof h === "object" ? buscar(h, cumple) : null;
    if (r) return r;
  }
  return null;
}

let retratos;
before(async () => {
  globalThis.document = { createElementNS: (_ns, etiqueta) => nodoFalso(etiqueta) };
  retratos = await import(pathToFileURL(path.join(__dirname, "..", "cliente", "retratos.js")).href);
});

test("cada criatura del catálogo tiene su propio dibujo", () => {
  for (const c of CATALOGO) assert.ok(retratos.tieneDibujo(c.id), `${c.id} no tiene retrato`);
});

test("cada elemento tiene paleta e icono", () => {
  for (const e of [...ELEMENTOS, "neutro"]) {
    const p = retratos.PALETA[e];
    assert.ok(p && p.base && p.oscuro && p.claro && p.acento, `${e} sin paleta completa`);
    const icono = retratos.iconoElemento(e);
    assert.equal(icono.etiqueta, "svg");
    assert.ok(icono.hijos.length > 0, `${e} sin icono`);
  }
});

test("el retrato es un SVG accesible con su nombre", () => {
  const svg = retratos.retrato("pirolince", { elemento: "fuego", titulo: "Pirolince" });
  assert.equal(svg.etiqueta, "svg");
  assert.equal(svg.atributos.viewBox, "0 0 120 120");
  assert.equal(svg.atributos.role, "img");
  assert.equal(svg.atributos["aria-label"], "Pirolince");
  assert.equal(svg.hijos[0].etiqueta, "title");
  assert.deepEqual(svg.hijos[0].hijos, ["Pirolince"]);
});

test("el retrato del rival se dibuja en espejo y con fondo si se pide", () => {
  const normal = retratos.retrato("voltarda", { elemento: "rayo" });
  const espejo = retratos.retrato("voltarda", { elemento: "rayo", espejo: true, fondo: true });
  const grupo = (svg) => svg.hijos.find((h) => h.etiqueta === "g");
  assert.equal(grupo(normal).atributos.transform, undefined);
  assert.match(grupo(espejo).atributos.transform, /scale\(-1 1\)/);
  assert.ok(espejo.hijos.some((h) => h.etiqueta === "defs"), "con fondo lleva su degradado");
});

test("los dibujos de las criaturas son distintos entre sí", () => {
  const tamanos = CATALOGO.map((c) => contar(retratos.retrato(c.id, { elemento: c.elemento })));
  const generico = contar(retratos.retrato("no-existe"));
  for (const t of tamanos) assert.ok(t > generico, "un retrato es tan simple como la silueta genérica");
  // Dos ids distintos nunca comparten el mismo dibujo por error (mismo número de nodos y mismo primer trazo).
  const firmas = CATALOGO.map((c) => JSON.stringify(buscar(retratos.retrato(c.id, { elemento: c.elemento }), (n) => n.atributos && n.atributos.class === "cuerpo-dibujo").hijos.slice(0, 3).map((h) => h.atributos)));
  assert.equal(new Set(firmas).size, CATALOGO.length);
});

// ---------- RF-35: volumen y aspectos ----------

test("RF-35: el cuerpo lleva el filtro de volumen y la sombra del suelo queda fuera de él", () => {
  const svg = retratos.retrato("pirolince", { elemento: "fuego" });
  const cuerpo = buscar(svg, (n) => n.atributos && n.atributos.class === "cuerpo-dibujo");
  assert.match(cuerpo.atributos.filter, /^url\(#volumen-\d+\)$/);
  assert.ok(buscar(svg, (n) => n.etiqueta === "filter" && n.atributos.id === cuerpo.atributos.filter.slice(5, -1)), "el filtro está definido en el propio SVG");
  assert.equal(buscar(cuerpo, (n) => n.atributos && n.atributos.class === "suelo"), null);
  assert.ok(buscar(svg, (n) => n.atributos && n.atributos.class === "suelo"));
  assert.ok(buscar(cuerpo, (n) => n.atributos && n.atributos.class === "ojo"), "los ojos se marcan para parpadear");
});

test("RF-35: hay tres aspectos y cada uno cambia el dibujo; uno desconocido se dibuja normal", () => {
  assert.deepEqual(retratos.ASPECTOS.map((a) => a.id), ["normal", "astral", "sombra"]);
  for (const a of retratos.ASPECTOS) assert.ok(a.nombre && a.descripcion);
  const de = (aspecto) => retratos.retrato("marejon", { elemento: "agua", aspecto });
  assert.match(de("astral").atributos.class, /aspecto-astral/);
  assert.ok(buscar(de("astral"), (n) => n.atributos && n.atributos.class === "brillo"), "el astral lleva estrellas");
  assert.ok(buscar(de("sombra"), (n) => n.atributos && n.atributos.class === "humo"), "el de sombra lleva humo");
  assert.ok(buscar(de("sombra"), (n) => n.atributos && /^url\(#aspecto-/.test(n.atributos.filter || "")));
  assert.equal(buscar(de("normal"), (n) => n.atributos && /^url\(#aspecto-/.test(n.atributos.filter || "")), null);
  assert.match(de("dorado").atributos.class, /aspecto-normal/);
});

test("RF-35: los aspectos del cliente son los mismos que acepta el servidor", () => {
  const { ASPECTOS } = require("../servidor/juego/criaturas.js");
  assert.deepEqual(retratos.ASPECTOS.map((a) => a.id), ASPECTOS);
});
