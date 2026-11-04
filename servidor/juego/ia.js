// CAPA DE LÓGICA DEL JUEGO: rival controlado por la máquina (RF-25).
// La máquina juega LIMPIO: decide solo con la vista que tendría un jugador humano
// (Combate.vista), así que no conoce la acción ni el banquillo de su rival (D-25).
// Son funciones puras: reciben la vista y devuelven una acción válida.

const { CATALOGO, eficacia } = require("./criaturas.js");
const { TAMANO_EQUIPO } = require("./combate.js");

// Lo bueno que es un movimiento contra una criatura de un elemento: daño esperado relativo.
function valorMovimiento(mov, elementoPropio, elementoRival) {
  const mismo = mov.elemento === elementoPropio ? 1.25 : 1;
  return mov.potencia * mismo * eficacia(mov.elemento, elementoRival) * (mov.precision / 100);
}

// Mejor movimiento de una criatura contra un elemento: { mov, valor }.
function mejorMovimiento(criatura, elementoRival) {
  let mejor = null;
  for (const mov of criatura.movimientos) {
    const valor = valorMovimiento(mov, criatura.elemento, elementoRival);
    if (!mejor || valor > mejor.valor) mejor = { mov, valor };
  }
  return mejor;
}

// Equipo de tres criaturas de elementos distintos, al azar.
function elegirEquipoIA(aleatorio = Math.random) {
  const disponibles = [...CATALOGO];
  const equipo = [];
  const elementos = new Set();
  while (equipo.length < TAMANO_EQUIPO) {
    const c = disponibles.splice(Math.floor(aleatorio() * disponibles.length), 1)[0];
    if (elementos.has(c.elemento)) continue;
    elementos.add(c.elemento);
    equipo.push(c.id);
  }
  return equipo;
}

// Índice de la criatura viva (distinta de la activa) que mejor combate contra el elemento rival.
function mejorCambio(yo, elementoRival) {
  let mejor = null;
  yo.equipo.forEach((c, i) => {
    if (i === yo.activa || c.ps <= 0) return;
    const valor = mejorMovimiento(c, elementoRival).valor * (c.ps / c.psMax);
    if (!mejor || valor > mejor.valor) mejor = { indice: i, valor };
  });
  return mejor;
}

// Acción de combate a partir de la vista. Devuelve null si ahora no le toca actuar.
function elegirAccionIA(vista, aleatorio = Math.random) {
  if (vista.fase !== "combate") return null;
  const { yo, rival } = vista;
  if (yo.debeCambiar) {
    return { tipo: "cambiar", indice: mejorCambio(yo, rival.activa.elemento).indice };
  }
  if (yo.eleccionHecha || rival.debeCambiar) return null;

  const activa = yo.equipo[yo.activa];
  const elementoRival = rival.activa.elemento;
  const propio = mejorMovimiento(activa, elementoRival);

  // Si su criatura está en clara desventaja y otra del equipo lo haría mucho mejor, cambia
  // (no siempre, para no ser previsible).
  const cambio = mejorCambio(yo, elementoRival);
  if (cambio && cambio.valor > propio.valor * 1.8 && aleatorio() < 0.7) {
    return { tipo: "cambiar", indice: cambio.indice };
  }

  // Casi siempre el mejor movimiento; a veces, otro que no sea inútil.
  if (aleatorio() < 0.15) {
    const otros = activa.movimientos.filter((m) => m.id !== propio.mov.id && eficacia(m.elemento, elementoRival) >= 1);
    if (otros.length) return { tipo: "atacar", movimiento: otros[Math.floor(aleatorio() * otros.length)].id };
  }
  return { tipo: "atacar", movimiento: propio.mov.id };
}

module.exports = { elegirEquipoIA, elegirAccionIA, mejorMovimiento, valorMovimiento };
