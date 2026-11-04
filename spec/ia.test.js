// Pruebas del rival controlado por la máquina (servidor/juego/ia.js), RF-25.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { elegirEquipoIA, elegirAccionIA } = require("../servidor/juego/ia.js");
const { Combate } = require("../servidor/juego/combate.js");
const { obtenerCriatura } = require("../servidor/juego/criaturas.js");

// Generador pseudoaleatorio con semilla: partidas distintas pero repetibles.
function semilla(n) {
  let x = n;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

test("el equipo de la máquina tiene 3 criaturas que existen y de elementos distintos", () => {
  for (let s = 1; s <= 30; s++) {
    const equipo = elegirEquipoIA(semilla(s));
    assert.equal(equipo.length, 3);
    assert.equal(new Set(equipo).size, 3);
    const elementos = equipo.map((id) => obtenerCriatura(id).elemento);
    assert.equal(new Set(elementos).size, 3, `semilla ${s}`);
  }
});

test("elige el movimiento más eficaz contra la criatura rival", () => {
  // Pirolince contra Musgolem (planta): Llamarada (fuego, x2) es lo mejor.
  const c = new Combate(["ia", "humano"], { aleatorio: () => 0.5 });
  c.elegirEquipo("ia", ["pirolince", "marejon", "voltarda"]);
  c.elegirEquipo("humano", ["musgolem", "brason", "ciclonia"]);
  assert.deepEqual(elegirAccionIA(c.vista("ia"), () => 0.9), { tipo: "atacar", movimiento: "llamarada" });
});

test("cambia de criatura si está en clara desventaja y otra del equipo lo haría mucho mejor", () => {
  // Pirolince (fuego) contra Marejón (agua): Voltarda (rayo, x2 contra agua) es mucho mejor.
  const c = new Combate(["ia", "humano"], { aleatorio: () => 0.5 });
  c.elegirEquipo("ia", ["pirolince", "brason", "voltarda"]);
  c.elegirEquipo("humano", ["marejon", "musgolem", "ciclonia"]);
  assert.deepEqual(elegirAccionIA(c.vista("ia"), () => 0.1), { tipo: "cambiar", indice: 2 });
});

test("si su criatura cae, saca la que mejor combate contra el rival", () => {
  // Ciclonia debilita a Espinara; contra Ciclonia (viento) la mejor es Voltarda (rayo, x2).
  const c = new Combate(["humano", "ia"], { aleatorio: () => 0.5 });
  c.elegirEquipo("humano", ["ciclonia", "pirolince", "brason"]);
  c.elegirEquipo("ia", ["espinara", "musgolem", "voltarda"]);
  c.elegirAccion("humano", { tipo: "atacar", movimiento: "vendaval" });
  c.elegirAccion("ia", { tipo: "atacar", movimiento: "embestida" });
  assert.equal(c.vista("ia").yo.debeCambiar, true);
  assert.deepEqual(elegirAccionIA(c.vista("ia")), { tipo: "cambiar", indice: 2 });
});

test("no actúa cuando no le toca: ya ha elegido, el rival está cambiando o no hay combate", () => {
  const c = new Combate(["ia", "humano"], { aleatorio: () => 0.5 });
  assert.equal(elegirAccionIA(c.vista("ia")), null, "fase de selección");
  c.elegirEquipo("ia", ["pirolince", "brason", "voltarda"]);
  c.elegirEquipo("humano", ["marejon", "musgolem", "ciclonia"]);
  c.elegirAccion("ia", { tipo: "atacar", movimiento: "embestida" });
  assert.equal(elegirAccionIA(c.vista("ia")), null, "ya ha elegido");
});

test("dos máquinas juegan 40 partidas completas sin hacer nunca una acción inválida", () => {
  for (let s = 1; s <= 40; s++) {
    const azar = semilla(s);
    const c = new Combate(["ia1", "ia2"], { aleatorio: azar });
    c.elegirEquipo("ia1", elegirEquipoIA(azar));
    c.elegirEquipo("ia2", elegirEquipoIA(azar));
    let pasos = 0;
    while (c.fase !== "terminada") {
      assert.ok(++pasos < 500, `la partida ${s} no termina`);
      let alguien = false;
      for (const e of ["ia1", "ia2"]) {
        const accion = elegirAccionIA(c.vista(e), azar);
        if (accion) {
          c.elegirAccion(e, accion); // lanzaría ErrorNegocio si fuera inválida
          alguien = true;
        }
        if (c.fase === "terminada") break;
      }
      assert.ok(alguien || c.fase === "terminada", `nadie puede actuar en la partida ${s}`);
    }
    assert.ok(["sin-criaturas", "empate"].includes(c.motivo));
  }
});
