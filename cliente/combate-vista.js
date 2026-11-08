// PRESENTACIÓN DEL COMBATE (frontend, capa de presentación)
// Dibuja la vista del combate que envía el servidor. No calcula nada del juego: el daño,
// los turnos y el ganador los decide el servidor (D-20). Solo traduce la vista a pantalla y
// los clics a acciones, que se entregan a las funciones de "acciones".

import { el } from "./dom.js";
import { retrato, iconoElemento } from "./retratos.js";
import { crearArena } from "./arena.js";

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
const STAT = { ataque: "ataque", defensa: "defensa", velocidad: "velocidad" };

// RF-31: frase de un cambio de etapa. "quien" ya viene como texto ("Tu Chispardo", "Ana"…).
function textoModifica(ev, de, afectada) {
  if (ev.cambio === 0) return `${de} usa ${ev.movimiento}, pero ${STAT[ev.stat] === "defensa" ? "la" : "el"} ${STAT[ev.stat]} de ${afectada} no puede ${ev.sobre === "propio" ? "subir" : "bajar"} más.`;
  const verbo = ev.cambio > 0 ? (ev.cambio > 1 ? "sube mucho" : "sube") : ev.cambio < -1 ? "baja mucho" : "baja";
  return `${de} usa ${ev.movimiento}: ${STAT[ev.stat] === "defensa" ? "la" : "el"} ${STAT[ev.stat]} de ${afectada} ${verbo}.`;
}

const etiquetaElemento = (e) => el("span", { class: `elemento elem-${e}` }, iconoElemento(e), ELEMENTO[e] || e);

// Texto de un evento del turno, desde el punto de vista del jugador.
function textoEvento(ev) {
  const de = (quien, criatura) => (quien === "yo" ? `Tu ${criatura}` : `${criatura} (rival)`);
  const delOtro = (quien, criatura) => (quien === "yo" ? `${criatura} (rival)` : `tu ${criatura}`);
  switch (ev.tipo) {
    case "cambio":
      return `${ev.quien === "yo" ? "Sacas" : "Tu rival saca"} a ${ev.criatura}.`;
    case "ataque": {
      const ef = ev.eficacia === 2 ? " ¡Es muy eficaz!" : ev.eficacia === 0.5 ? " No es muy eficaz…" : "";
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento} contra ${delOtro(ev.quien, ev.objetivo)}: ${ev.danio} de daño.${ev.critico ? " ¡Golpe crítico!" : ""}${ef}`;
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
    case "cura":
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento} y recupera ${ev.cura} PS.`;
    case "modifica":
      return textoModifica(ev, de(ev.quien, ev.criatura), ev.sobre === "propio" ? (ev.quien === "yo" ? `tu ${ev.objetivo}` : `${ev.objetivo} (rival)`) : delOtro(ev.quien, ev.objetivo));
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

const STATS = [
  ["ps", "PS"],
  ["ataque", "Atq"],
  ["defensa", "Def"],
  ["velocidad", "Vel"],
];

function barrasStats(c, maximos) {
  return el(
    "div",
    { class: "stats" },
    ...STATS.map(([clave, texto]) =>
      el(
        "div",
        { class: "stat" },
        el("span", {}, texto),
        el("span", { class: "stat-barra" }, el("span", { style: `width:${Math.round((100 * c[clave]) / maximos[clave])}%` })),
        el("b", {}, String(c[clave]))
      )
    )
  );
}

function cartaCriatura(c, { orden, maximos, alPulsar, bloqueada }) {
  return el(
    "button",
    {
      type: "button",
      class: `carta${orden ? " marcada" : ""}`,
      "aria-pressed": orden ? "true" : "false",
      "aria-label": `${c.nombre}, ${ELEMENTO[c.elemento]}${orden ? `, elegida en el puesto ${orden}` : ""}`,
      disabled: bloqueada && !orden,
      onclick: alPulsar,
    },
    orden ? el("span", { class: "orden", "aria-hidden": "true" }, String(orden)) : null,
    retrato(c.id, { elemento: c.elemento, fondo: true, titulo: c.nombre, clase: "retrato retrato-carta" }),
    el("span", { class: "carta-nombre" }, el("strong", {}, c.nombre), etiquetaElemento(c.elemento)),
    el("p", { class: "descripcion" }, c.descripcion),
    barrasStats(c, maximos),
    el("span", { class: "movs-mini" }, ...c.movimientos.map((m) => el("span", { class: `elem-fondo-${m.elemento}` }, m.nombre)))
  );
}

function pantallaSeleccion(vista, catalogo, acciones, seleccion, filtro) {
  const porId = new Map(catalogo.map((c) => [c.id, c]));
  if (vista.yo.eleccionHecha) {
    return el(
      "div",
      { class: "combate espera" },
      el("div", { class: "ranuras", style: "justify-content:center" }, ...vista.yo.equipo.map((c, i) => el("div", { class: "ranura llena", style: "width:96px;height:96px" }, el("span", { class: "num" }, String(i + 1)), retrato(c.id, { elemento: c.elemento, titulo: c.nombre, clase: "retrato", espejo: false })))),
      el("h2", { style: "margin-top:16px" }, "Equipo listo"),
      el("p", { class: "suave" }, vista.rival.equipoElegido ? "Abriendo la arena…" : "Esperando a que tu rival elija a sus campeones…")
    );
  }
  const maximos = Object.fromEntries(STATS.map(([k]) => [k, Math.max(...catalogo.map((c) => c[k]))]));
  const elementos = [...new Set(catalogo.map((c) => c.elemento))];
  const visibles = filtro ? catalogo.filter((c) => c.elemento === filtro) : catalogo;
  const lleno = seleccion.length === 3;

  const ranuras = [0, 1, 2].map((i) => {
    const c = porId.get(seleccion[i]);
    return c
      ? el(
          "button",
          { type: "button", class: "ranura llena", style: "padding:0;background:none;box-shadow:none", title: `Quitar a ${c.nombre}`, "aria-label": `Quitar a ${c.nombre}`, onclick: () => acciones.alternarSeleccion(c.id) },
          el("span", { class: "num" }, String(i + 1)),
          retrato(c.id, { elemento: c.elemento, titulo: c.nombre })
        )
      : el("div", { class: "ranura", "aria-hidden": "true" }, String(i + 1));
  });

  return el(
    "div",
    { class: "combate" },
    el(
      "div",
      { class: "seleccion-cabecera" },
      el("div", {}, el("span", { class: "etiqueta-seccion" }, "Antes del duelo"), el("h2", {}, "Elige a tus tres campeones")),
      el("p", { class: "suave", style: "margin:0" }, vista.rival.equipoElegido ? "Tu rival ya ha elegido." : "Tu rival también está eligiendo.")
    ),
    el(
      "div",
      { class: "filtros", role: "group", "aria-label": "Filtrar por elemento" },
      el("button", { type: "button", "aria-pressed": filtro ? "false" : "true", onclick: () => acciones.filtrar(null) }, "Todas"),
      ...elementos.map((e) => el("button", { type: "button", "aria-pressed": filtro === e ? "true" : "false", onclick: () => acciones.filtrar(e) }, iconoElemento(e), ELEMENTO[e]))
    ),
    el(
      "div",
      { class: "rejilla-criaturas" },
      ...visibles.map((c) => {
        const i = seleccion.indexOf(c.id);
        return cartaCriatura(c, { orden: i >= 0 ? i + 1 : 0, maximos, bloqueada: lleno, alPulsar: () => acciones.alternarSeleccion(c.id) });
      })
    ),
    el(
      "div",
      { class: "bandeja" },
      el("div", { class: "ranuras" }, ...ranuras),
      el("span", { class: "texto-bandeja" }, lleno ? "La número 1 sale a combatir." : `Elige ${3 - seleccion.length} más.`),
      el("button", { type: "button", disabled: !lleno, onclick: () => acciones.confirmarEquipo() }, "¡Al combate!")
    )
  );
}

// ---------- combate (RF-17, RF-18) en la arena animada (RF-28) ----------

const TEXTO_EFICACIA = { 2: ["Muy eficaz", "eficaz"], 0.5: ["Poco eficaz", "flojo"] };

function resultado(vista, acciones) {
  const texto = vista.ganador === "yo" ? "¡Victoria!" : vista.ganador === "rival" ? "Derrota" : "Empate";
  const fin = vista.eventos.find((e) => e.tipo === "fin");
  return el(
    "div",
    { class: `resultado resultado-${vista.ganador || "empate"}` },
    el("p", { class: "resultado-titulo" }, texto),
    fin ? el("p", {}, textoEvento(fin)) : null,
    el("div", { class: "botones" }, el("button", { type: "button", onclick: () => acciones.salir() }, "Volver al vestíbulo"))
  );
}

// Criaturas del banquillo como botones con su retrato y sus PS.
function banquillo(vista, acciones, { titulo = "Cambiar a" } = {}) {
  const opciones = vista.yo.equipo.map((c, i) => ({ c, i })).filter(({ i }) => i !== vista.yo.activa);
  return el(
    "div",
    { class: "banquillo" },
    el("span", { class: "etiqueta-seccion" }, titulo),
    el(
      "div",
      { class: "banquillo-lista" },
      ...opciones.map(({ c, i }) => {
        const pct = Math.round((100 * c.ps) / c.psMax);
        return el(
          "button",
          { type: "button", class: "suplente", disabled: c.ps === 0, onclick: () => acciones.cambiar(i), "aria-label": `Cambiar a ${c.nombre}, ${c.ps} de ${c.psMax} PS` },
          retrato(c.id, { elemento: c.elemento, clase: "retrato" }),
          el(
            "span",
            { class: "suplente-datos" },
            el("strong", {}, c.nombre),
            el("span", { class: "mini-ps" }, el("span", { class: `ps-${pct > 50 ? "alta" : pct > 20 ? "media" : "baja"}`, style: `width:${pct}%` })),
            el("small", {}, c.ps === 0 ? "Debilitada" : `${c.ps}/${c.psMax} PS`)
          )
        );
      })
    )
  );
}

// Detalle de un movimiento: daño o, si es de apoyo (RF-31), lo que hace.
function detalleMovimiento(m) {
  if (!m.apoyo) return `${ELEMENTO[m.elemento]} · Pot ${m.potencia} · Prec ${m.precision}%`;
  if (m.apoyo.cura) return `Apoyo · Cura ${Math.round(m.apoyo.cura * 100)} % de PS`;
  const signo = m.apoyo.etapas > 0 ? "+" : "";
  return `Apoyo · ${m.apoyo.sobre === "propio" ? "Tu" : "Rival"} ${STAT[m.apoyo.stat]} ${signo}${m.apoyo.etapas}${m.precision < 100 ? ` · Prec ${m.precision}%` : ""}`;
}

function botonesMovimientos(vista, acciones) {
  const mia = vista.yo.equipo[vista.yo.activa];
  const eficacias = vista.yo.eficacias || {};
  return el(
    "div",
    { class: "movimientos" },
    ...mia.movimientos.map((m) => {
      const [aviso, clase] = TEXTO_EFICACIA[eficacias[m.id]] || [];
      return el(
        "button",
        { type: "button", class: `mov elem-fondo-${m.elemento}`, onclick: () => acciones.atacar(m.id) },
        el("span", { class: "mov-nombre" }, iconoElemento(m.elemento), m.nombre),
        el("span", { class: "mov-detalle" }, detalleMovimiento(m)),
        aviso ? el("span", { class: `mov-eficacia ${clase}` }, aviso) : null
      );
    })
  );
}

const esperaTurno = (texto) => el("div", { class: "controles espera-turno" }, el("span", { class: "puntos", "aria-hidden": "true" }), texto);

function controlesJugador(vista, acciones) {
  if (vista.fase === "terminada") return resultado(vista, acciones);
  const mia = vista.yo.equipo[vista.yo.activa];
  if (vista.yo.debeCambiar) {
    return el("div", { class: "controles" }, el("p", { class: "aviso-error" }, `${mia.nombre} no puede seguir. ¿Quién sale ahora?`), banquillo(vista, acciones, { titulo: "Elige quién sale" }));
  }
  if (vista.rival.debeCambiar) return esperaTurno("Tu rival está eligiendo otra criatura…");
  if (vista.yo.eleccionHecha) return esperaTurno(vista.rival.eleccionHecha ? "Resolviendo el turno…" : "Acción elegida. Esperando a tu rival…");
  return el(
    "div",
    { class: "controles" },
    el("p", { class: "pregunta" }, el("span", { class: "etiqueta-seccion" }, `Turno ${vista.turno}`), " ", `¿Qué hará ${mia.nombre}?`),
    botonesMovimientos(vista, acciones),
    banquillo(vista, acciones)
  );
}

// RF-29: crónica de todo el combate. El <details> se crea una vez, así se queda abierto o
// cerrado entre redibujados; solo cambia la lista. Se actualiza al acabar de reproducir
// cada turno, para no adelantar lo que aún se está animando.
function crearCronica(texto) {
  const lista = el("ol", { class: "cronica-lista" });
  const resumen = el("summary", {}, "Crónica del combate");
  const nodo = el("details", { class: "cronica" }, resumen, lista);
  function actualizar(cronica = []) {
    resumen.textContent = cronica.length ? `Crónica del combate · ${cronica.length} ${cronica.length === 1 ? "turno" : "turnos"}` : "Crónica del combate";
    lista.replaceChildren(
      ...(cronica.length
        ? cronica.map((t) => el("li", {}, el("span", { class: "cronica-turno" }, `Turno ${t.turno}`), el("ul", {}, ...t.eventos.map((ev) => el("li", { class: `ev-${ev.tipo}` }, texto(ev))))))
        : [el("li", { class: "tenue" }, "Aún no ha pasado nada.")])
    );
    lista.scrollTop = lista.scrollHeight;
  }
  return { nodo, actualizar };
}

const firmaDe = (v) => `${v.fase}|${v.turno}|${JSON.stringify(v.eventos)}`;

// Controlador del combate de un jugador: mantiene la arena entre redibujados para que
// las animaciones no se corten, y reproduce cada turno nuevo antes de mostrar los botones.
//   contexto(): { catalogo, seleccion, filtro } para la elección de equipo.
export function crearControladorCombate({ acciones, contexto }) {
  const nodo = el("div", { class: "combate" });
  const zonaControles = el("div", { class: "zona-controles" });
  const cronica = crearCronica(textoEvento);
  let arena = null;
  let ultima = null; // última vista recibida
  let firmaMostrada = null; // turno y eventos que ya se han reproducido
  let reproduciendo = false;
  let cola = Promise.resolve();

  const ladoDe = (ev) => (ev.quien === "yo" ? "abajo" : "arriba");
  const dueno = (posicion) => (posicion === "abajo" ? "Tú" : "Rival");

  // Coloca las dos criaturas tal como dice la vista, sin animar.
  function sincronizar(v) {
    const mia = v.yo.equipo[v.yo.activa];
    arena.colocar("abajo", mia, { dueno: "Tú", restantes: v.yo.equipo.filter((c) => c.ps > 0).length, total: v.yo.equipo.length });
    if (v.rival.activa) arena.colocar("arriba", v.rival.activa, { dueno: "Rival", restantes: v.rival.restantes, total: 3 });
    else arena.vaciar("arriba");
  }

  function pintarControles() {
    if (!ultima || ultima.fase === "seleccion" || !arena) return;
    if (reproduciendo) return zonaControles.replaceChildren(esperaTurno("Resolviendo el turno…"));
    cronica.actualizar(ultima.cronica);
    if (ultima.yo.debeCambiar) arena.narrar("¡Tu criatura ha caído!");
    zonaControles.replaceChildren(controlesJugador(ultima, acciones));
  }

  function actualizar(v) {
    ultima = v;
    if (v.fase === "seleccion") {
      arena = null;
      firmaMostrada = null;
      const { catalogo, seleccion, filtro } = contexto();
      nodo.replaceChildren(pantallaSeleccion(v, catalogo, acciones, seleccion, filtro));
      return;
    }
    // Si alguien abandonó antes de elegir equipos, solo hay resultado.
    if (!v.yo.equipo) {
      arena = null;
      nodo.replaceChildren(resultado(v, acciones));
      return;
    }
    if (!arena) {
      arena = crearArena();
      nodo.replaceChildren(arena.nodo, zonaControles, cronica.nodo);
      sincronizar(v);
      firmaMostrada = firmaDe(v);
      arena.narrar(v.eventos.length ? textoEvento(v.eventos[v.eventos.length - 1]) : "¡Que empiece el combate!");
      pintarControles();
      return;
    }
    const f = firmaDe(v);
    if (f === firmaMostrada || !v.eventos.length) {
      if (!reproduciendo) sincronizar(v);
      pintarControles();
      return;
    }
    firmaMostrada = f;
    cola = cola.then(async () => {
      reproduciendo = true;
      pintarControles();
      const miArena = arena;
      try {
        await miArena.reproducir(v.eventos, { ladoDe, texto: textoEvento, duenoDe: dueno });
      } finally {
        reproduciendo = false;
        if (arena === miArena && ultima.yo.equipo && ultima.fase !== "seleccion") {
          sincronizar(ultima);
          pintarControles();
        }
      }
    });
  }

  // Vuelve a dibujar lo que no anima (la elección de equipo cambia con cada clic).
  function refrescar() {
    if (ultima && ultima.fase === "seleccion") actualizar(ultima);
  }

  return { nodo, actualizar, refrescar };
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
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento} contra ${ev.objetivo}: ${ev.danio} de daño.${ev.critico ? " ¡Golpe crítico!" : ""}${ef}`;
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
    case "cura":
      return `${de(ev.quien, ev.criatura)} usa ${ev.movimiento} y recupera ${ev.cura} PS.`;
    case "modifica":
      return textoModifica(ev, de(ev.quien, ev.criatura), ev.objetivo);
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

// Controlador del modo espectador: la misma arena, con el primer jugador abajo y el
// segundo arriba. Los eventos traen "lado" (0 o 1), así que dos jugadores con el mismo
// nombre no se confunden.
export function crearControladorEspectador({ salir }) {
  const nodo = el("div", { class: "partida-actual espectador" });
  const cabecera = el("div", { class: "partida-cabecera" });
  const estado = el("div", { class: "controles espera-turno" });
  const cronica = crearCronica(textoEventoEspectador);
  let arena = null;
  let ultima = null;
  let firmaMostrada = null;
  let reproduciendo = false;
  let cola = Promise.resolve();
  const posicion = (i) => (i === 0 ? "abajo" : "arriba");

  function sincronizar(v) {
    v.jugadores.forEach((j, i) => {
      if (j.activa) arena.colocar(posicion(i), j.activa, { dueno: j.nombre, restantes: j.restantes, total: 3 });
      else arena.vaciar(posicion(i));
    });
  }

  function pintarEstado() {
    const v = ultima;
    if (!reproduciendo) cronica.actualizar(v.cronica);
    if (v.fase === "terminada") return estado.replaceChildren(el("strong", {}, v.ganador ? `¡${v.ganador} gana el combate!` : "¡Empate!"));
    if (v.fase === "seleccion") return estado.replaceChildren(el("span", { class: "puntos", "aria-hidden": "true" }), "Los jugadores están eligiendo a sus campeones…");
    const listos = v.jugadores.filter((j) => j.eleccionHecha).map((j) => j.nombre);
    estado.replaceChildren(
      el("span", { class: "puntos", "aria-hidden": "true" }),
      reproduciendo ? "Resolviendo el turno…" : `Turno ${v.turno}${listos.length ? ` · ya ha elegido: ${listos.join(", ")}` : ""}`
    );
  }

  function actualizar(v) {
    ultima = v;
    cabecera.replaceChildren(
      el("div", {}, el("span", { class: "en-vivo" }, "En vivo"), el("h2", {}, v.jugadores[0].nombre, el("span", { class: "contra" }, " contra "), v.jugadores[1].nombre)),
      el("div", { class: "acciones" }, el("button", { type: "button", class: "secundario pequeno", onclick: salir }, "Dejar de mirar"))
    );
    if (!arena) {
      arena = crearArena();
      nodo.replaceChildren(cabecera, arena.nodo, estado, cronica.nodo);
      sincronizar(v);
      firmaMostrada = firmaDe(v);
      arena.narrar(v.eventos.length ? textoEventoEspectador(v.eventos[v.eventos.length - 1]) : "");
      return pintarEstado();
    }
    const f = firmaDe(v);
    if (f === firmaMostrada || !v.eventos.length) {
      if (!reproduciendo) sincronizar(v);
      return pintarEstado();
    }
    firmaMostrada = f;
    cola = cola.then(async () => {
      reproduciendo = true;
      pintarEstado();
      try {
        await arena.reproducir(v.eventos, {
          ladoDe: (ev) => posicion(ev.lado),
          texto: textoEventoEspectador,
          duenoDe: (p) => ultima.jugadores[p === "abajo" ? 0 : 1].nombre,
        });
      } finally {
        reproduciendo = false;
        sincronizar(ultima);
        pintarEstado();
      }
    });
  }

  return { nodo, actualizar };
}

export { textoEvento, textoEventoEspectador };
