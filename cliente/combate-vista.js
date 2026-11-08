// PRESENTACIÓN DEL COMBATE (frontend, capa de presentación)
// Dibuja la vista del combate que envía el servidor. No calcula nada del juego: el daño,
// los turnos y el ganador los decide el servidor (D-20). Solo traduce la vista a pantalla y
// los clics a acciones, que se entregan a las funciones de "acciones".

import { el } from "./dom.js";
import { retrato } from "./retratos.js";

const ELEMENTO = {
  fuego: "Fuego",
  agua: "Agua",
  planta: "Planta",
  rayo: "Rayo",
  tierra: "Tierra",
  viento: "Viento",
  neutro: "Neutro",
};

const ESTADO = { quemado: "Quemado", congelado: "Congelado", paralizado: "Paralizado" };

const etiquetaElemento = (e) => el("span", { class: `elemento elem-${e}` }, ELEMENTO[e] || e);

function barraPs(c) {
  const pct = Math.round((100 * c.ps) / c.psMax);
  const nivel = pct > 50 ? "alta" : pct > 20 ? "media" : "baja";
  return el(
    "div",
    { class: "ps", role: "meter", "aria-valuemin": "0", "aria-valuemax": String(c.psMax), "aria-valuenow": String(c.ps), "aria-label": `PS de ${c.nombre}` },
    el("div", { class: `ps-relleno ps-${nivel}`, style: `width:${pct}%` }),
    el("span", { class: "ps-texto" }, `${c.ps} / ${c.psMax} PS`)
  );
}

// espejo: la criatura del rival mira hacia la izquierda, de cara a la tuya.
function fichaCriatura(c, titulo, { espejo = false } = {}) {
  return el(
    "div",
    { class: `ficha elem-borde-${c.elemento}${c.ps === 0 ? " debilitada" : ""}` },
    retrato(c.id, { elemento: c.elemento, espejo, titulo: c.nombre, clase: "retrato retrato-ficha" }),
    el("p", { class: "ficha-titulo" }, titulo),
    el("p", { class: "ficha-nombre" }, c.nombre, " ", etiquetaElemento(c.elemento), c.estado ? el("span", { class: `estado estado-${c.estado}` }, ESTADO[c.estado]) : null),
    barraPs(c)
  );
}

// Texto de un evento del turno, desde el punto de vista del jugador.
function textoEvento(ev) {
  const de = (quien, criatura) => (quien === "yo" ? `Tu ${criatura}` : `${criatura} (rival)`);
  const delOtro = (quien, criatura) => (quien === "yo" ? `${criatura} (rival)` : `tu ${criatura}`);
  switch (ev.tipo) {
    case "cambio":
      return `${ev.quien === "yo" ? "Sacas" : "Tu rival saca"} a ${ev.criatura}.`;
    case "ataque": {
      const ef = ev.eficacia === 2 ? " ¡Es muy eficaz!" : ev.eficacia === 0.5 ? " No es muy eficaz…" : "";
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento} contra ${delOtro(ev.quien, ev.objetivo)}: ${ev.danio} de daño.${ef}`;
    }
    case "falla":
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento}, pero falla.`;
    case "estado":
      return `${de(ev.quien, ev.criatura)} queda ${ESTADO[ev.estado].toLowerCase()}.`;
    case "no-actua":
      return `${de(ev.quien, ev.criatura)} está ${ESTADO[ev.estado].toLowerCase()} y no puede moverse.`;
    case "descongela":
      return `${de(ev.quien, ev.criatura)} se descongela.`;
    case "quemadura":
      return `${de(ev.quien, ev.criatura)} sufre ${ev.danio} de daño por la quemadura.`;
    case "drena":
      return `${de(ev.quien, ev.criatura)} recupera ${ev.cura} PS.`;
    case "debilitada":
      return `${de(ev.quien, ev.criatura)} se ha debilitado.`;
    case "fin":
      if (ev.motivo === "empate") return "¡Empate! Las dos últimas criaturas caen a la vez.";
      if (ev.motivo === "abandono") return ev.ganador === "yo" ? "Tu rival ha abandonado." : "Has abandonado el combate.";
      return ev.ganador === "yo" ? "¡Has ganado el combate!" : "Has perdido el combate.";
    default:
      return "";
  }
}

// ---------- elección de equipo (RF-16) ----------

function pantallaSeleccion(vista, catalogo, acciones, seleccion) {
  if (vista.yo.eleccionHecha) {
    return el(
      "div",
      { class: "combate" },
      el("p", { class: "aviso-ok" }, "Equipo elegido: ", vista.yo.equipo.map((c) => c.nombre).join(", "), "."),
      el("p", { class: "suave" }, vista.rival.equipoElegido ? "Empezando…" : "Esperando a que tu rival elija su equipo…")
    );
  }
  const tarjetas = catalogo.map((c) => {
    const marcada = seleccion.includes(c.id);
    return el(
      "button",
      {
        type: "button",
        class: `tarjeta-criatura elem-borde-${c.elemento}${marcada ? " marcada" : ""}`,
        "aria-pressed": marcada ? "true" : "false",
        onclick: () => acciones.alternarSeleccion(c.id),
      },
      retrato(c.id, { elemento: c.elemento, fondo: true, titulo: c.nombre, clase: "retrato retrato-tarjeta" }),
      el("span", { class: "ficha-nombre" }, c.nombre, " ", etiquetaElemento(c.elemento)),
      el("span", { class: "stats" }, `PS ${c.ps} · Atq ${c.ataque} · Def ${c.defensa} · Vel ${c.velocidad}`),
      el("span", { class: "suave descripcion" }, c.descripcion),
      el("span", { class: "movs" }, c.movimientos.map((m) => m.nombre).join(" · "))
    );
  });
  return el(
    "div",
    { class: "combate" },
    el("h3", {}, `Elige tu equipo (${seleccion.length}/3)`),
    el("p", { class: "suave" }, "La primera que elijas sale a combatir. ", vista.rival.equipoElegido ? "Tu rival ya ha elegido." : ""),
    el("div", { class: "rejilla-criaturas" }, ...tarjetas),
    el("button", { type: "button", disabled: seleccion.length !== 3, onclick: () => acciones.confirmarEquipo() }, "Confirmar equipo")
  );
}

// ---------- combate (RF-17) y final (RF-18) ----------

function pantallaCombate(vista, acciones) {
  const mia = vista.yo.equipo[vista.yo.activa];
  const registro = vista.eventos.length
    ? el("ol", { class: "registro", "aria-live": "polite" }, ...vista.eventos.map((ev) => el("li", {}, textoEvento(ev))))
    : el("p", { class: "suave" }, "¡Que empiece el combate!");

  const campo = el(
    "div",
    { class: "campo-batalla" },
    vista.rival.activa ? fichaCriatura(vista.rival.activa, `Rival · le quedan ${vista.rival.restantes}`, { espejo: true }) : null,
    fichaCriatura(mia, "Tu criatura")
  );

  let controles;
  if (vista.fase === "terminada") {
    controles = resultado(vista, acciones);
  } else if (vista.yo.debeCambiar) {
    controles = el("div", {}, el("p", { class: "aviso-error" }, "Tu criatura ha caído: elige quién sale ahora."), banquillo(vista, acciones));
  } else if (vista.rival.debeCambiar) {
    controles = el("p", { class: "suave" }, "Tu rival está eligiendo otra criatura…");
  } else if (vista.yo.eleccionHecha) {
    controles = el("p", { class: "suave" }, vista.rival.eleccionHecha ? "Resolviendo el turno…" : "Esperando la acción de tu rival…");
  } else {
    controles = el(
      "div",
      {},
      el("p", {}, `Turno ${vista.turno}: ¿qué hace ${mia.nombre}?`),
      el(
        "div",
        { class: "movimientos" },
        ...mia.movimientos.map((m) =>
          el(
            "button",
            { type: "button", class: `mov elem-fondo-${m.elemento}`, onclick: () => acciones.atacar(m.id) },
            el("span", {}, m.nombre),
            el("span", { class: "mov-detalle" }, `${ELEMENTO[m.elemento]} · Pot ${m.potencia} · Prec ${m.precision}%`)
          )
        )
      ),
      banquillo(vista, acciones)
    );
  }

  return el("div", { class: "combate" }, campo, controles, el("h3", {}, "Último turno"), registro);
}

function resultado(vista, acciones) {
  const texto = vista.ganador === "yo" ? "¡Victoria!" : vista.ganador === "rival" ? "Derrota" : "Empate";
  const fin = vista.eventos.find((e) => e.tipo === "fin");
  return el(
    "div",
    { class: `resultado resultado-${vista.ganador || "empate"}` },
    el("p", { class: "resultado-titulo" }, texto),
    fin ? el("p", {}, textoEvento(fin)) : null,
    el("button", { type: "button", onclick: () => acciones.salir() }, "Volver al vestíbulo")
  );
}

function banquillo(vista, acciones) {
  const opciones = vista.yo.equipo
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => i !== vista.yo.activa);
  return el(
    "div",
    { class: "banquillo" },
    el("span", { class: "suave" }, "Cambiar a: "),
    ...opciones.map(({ c, i }) =>
      el(
        "button",
        { type: "button", class: "secundario", disabled: c.ps === 0, onclick: () => acciones.cambiar(i) },
        `${c.nombre} (${c.ps}/${c.psMax})`
      )
    )
  );
}

// vista: la del servidor. catalogo: GET /api/criaturas. seleccion: ids marcados (estado local).
export function dibujarCombate(vista, { catalogo, seleccion, acciones }) {
  if (vista.fase === "seleccion") return pantallaSeleccion(vista, catalogo, acciones, seleccion);
  // Si alguien abandonó antes de elegir equipos, solo hay resultado.
  if (!vista.yo.equipo) return el("div", { class: "combate" }, resultado(vista, acciones));
  return pantallaCombate(vista, acciones);
}

// ---------- espectador (RF-23) ----------

// Texto de un evento para quien mira: "quien" es el nombre del jugador.
function textoEventoEspectador(ev) {
  const de = (quien, criatura) => `${criatura} de ${quien}`;
  switch (ev.tipo) {
    case "cambio":
      return `${ev.quien} saca a ${ev.criatura}.`;
    case "ataque": {
      const ef = ev.eficacia === 2 ? " ¡Es muy eficaz!" : ev.eficacia === 0.5 ? " No es muy eficaz…" : "";
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento} contra ${ev.objetivo}: ${ev.danio} de daño.${ef}`;
    }
    case "falla":
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento}, pero falla.`;
    case "estado":
      return `${de(ev.quien, ev.criatura)} queda ${ESTADO[ev.estado].toLowerCase()}.`;
    case "no-actua":
      return `${de(ev.quien, ev.criatura)} está ${ESTADO[ev.estado].toLowerCase()} y no puede moverse.`;
    case "descongela":
      return `${de(ev.quien, ev.criatura)} se descongela.`;
    case "quemadura":
      return `${de(ev.quien, ev.criatura)} sufre ${ev.danio} de daño por la quemadura.`;
    case "drena":
      return `${de(ev.quien, ev.criatura)} recupera ${ev.cura} PS.`;
    case "debilitada":
      return `${de(ev.quien, ev.criatura)} se ha debilitado.`;
    case "fin":
      if (ev.motivo === "empate") return "¡Empate!";
      if (ev.motivo === "abandono") return `${ev.ganador} gana porque su rival ha abandonado.`;
      return `¡${ev.ganador} gana el combate!`;
    default:
      return "";
  }
}

export function dibujarEspectador(vista, { salir }) {
  const fichas = vista.jugadores.map((j, i) =>
    j.activa
      ? fichaCriatura(j.activa, `${j.nombre} · le quedan ${j.restantes}${vista.fase === "combate" && j.eleccionHecha ? " · ya ha elegido" : ""}`, { espejo: i === 1 })
      : el("div", { class: "ficha" }, el("p", { class: "ficha-titulo" }, j.nombre), el("p", { class: "suave" }, j.eleccionHecha ? "Equipo elegido" : "Eligiendo equipo…"))
  );
  const estado =
    vista.fase === "terminada"
      ? el("p", { class: "aviso-ok" }, vista.ganador ? `Ganador: ${vista.ganador}` : "Empate")
      : el("p", { class: "suave" }, vista.fase === "seleccion" ? "Los jugadores están eligiendo equipo…" : `Turno ${vista.turno}`);
  return el(
    "div",
    { class: "partida-actual espectador" },
    el(
      "div",
      { class: "partida-cabecera" },
      el("h3", {}, "Mirando: ", vista.jugadores.map((j) => j.nombre).join(" contra ")),
      el("button", { type: "button", class: "secundario", onclick: salir }, "Dejar de mirar")
    ),
    estado,
    el("div", { class: "campo-batalla" }, ...fichas),
    el("h3", {}, "Último turno"),
    vista.eventos.length
      ? el("ol", { class: "registro", "aria-live": "polite" }, ...vista.eventos.map((ev) => el("li", {}, textoEventoEspectador(ev))))
      : el("p", { class: "suave" }, "Aún no ha pasado nada.")
  );
}

export { textoEvento, textoEventoEspectador };
