// PRESENTACIÓN DEL PROGRESO (frontend, hito 7; aspecto de RF-26)
// Panel con el ELO del jugador, sus estadísticas, el ranking y sus últimas partidas.
// Pide los datos con ClienteApi y los dibuja; todos los textos van con textContent (dom.js).

import { ClienteApi } from "./cliente-api.js";
import { el } from "./dom.js";
import { emblema } from "./retratos.js";

const RESULTADO = { victoria: "Victoria", derrota: "Derrota", empate: "Empate" };

const fecha = (ms) => new Date(ms).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const conSigno = (n) => (n > 0 ? `+${n}` : String(n));

// Rango decorativo según el ELO (solo es un nombre: la puntuación la calcula el servidor).
const RANGOS = [
  [1300, "Leyenda de Aetheria"],
  [1150, "Maestro del éter"],
  [1050, "Adepto"],
  [950, "Iniciado"],
  [0, "Aprendiz"],
];
export const rangoDe = (elo) => RANGOS.find(([minimo]) => elo >= minimo)[1];

function dato(valor, etiqueta) {
  return el("div", { class: "dato" }, el("span", { class: "dato-valor" }, String(valor)), el("span", { class: "dato-etiqueta" }, etiqueta));
}

function listaHistorial(partidas) {
  if (!partidas.length) return el("p", { class: "vacio" }, "Aún no has jugado contra nadie. ¡Tu primera victoria te espera!");
  return el(
    "ul",
    { class: "lista-historial" },
    ...partidas.map((p) =>
      el(
        "li",
        { class: `res-${p.resultado}` },
        el("span", { class: "marca-res", "aria-hidden": "true" }),
        el("span", {}, `${RESULTADO[p.resultado]} contra ${p.rival}`, el("small", {}, `${fecha(p.fecha)} · ${p.turnos} turnos${p.motivo === "abandono" ? " · abandono" : ""}`)),
        el("span", { class: `cambio-elo ${p.cambioElo > 0 ? "sube" : p.cambioElo < 0 ? "baja" : ""}`, title: `ELO tras la partida: ${p.elo}` }, conSigno(p.cambioElo))
      )
    )
  );
}

function listaRanking(ranking, miNombre) {
  if (!ranking.length) return el("p", { class: "vacio" }, "Todavía no hay nadie en el ranking. ¡Sé el primero!");
  const medalla = ["oro", "plata", "bronce"];
  return el(
    "ol",
    { class: "lista-ranking" },
    ...ranking.slice(0, 10).map((j) =>
      el(
        "li",
        { class: j.nombre === miNombre ? "mia" : "" },
        el("span", { class: `pos ${medalla[j.posicion - 1] || ""}` }, j.posicion <= 3 ? ["①", "②", "③"][j.posicion - 1] : String(j.posicion)),
        el("span", { class: "quien" }, j.nombre, el("small", {}, `${j.ganadas} G · ${j.perdidas} P · ${j.empates} E`)),
        el("span", { class: "elo" }, String(j.elo))
      )
    )
  );
}

// Devuelve { nodo, recargar }. alCargar(yo) recibe las estadísticas (la barra superior
// muestra el ELO). El vestíbulo llama a recargar al terminar un combate.
export function panelProgreso({ alError, alCargar = () => {} }) {
  const nodo = el("aside", { class: "columna-lateral", "aria-label": "Tu progreso" }, el("div", { class: "panel" }, el("p", { class: "suave" }, "Cargando tu progreso…")));

  async function recargar() {
    try {
      const [yo, historial, ranking] = await Promise.all([ClienteApi.estadisticas(), ClienteApi.historial(), ClienteApi.ranking()]);
      alCargar(yo);
      nodo.replaceChildren(
        el(
          "section",
          { class: "panel" },
          el("span", { class: "etiqueta-seccion" }, "Tu progreso"),
          el(
            "div",
            { class: "elo-tarjeta", style: "margin-top:10px" },
            emblema(),
            el("div", {}, el("div", { class: "elo-valor" }, String(yo.elo)), el("div", { class: "elo-rango" }, `ELO · ${rangoDe(yo.elo)}`))
          ),
          el("div", { class: "datos" }, dato(yo.jugadas, "Partidas"), dato(`${yo.porcentajeVictorias}%`, "Victorias"), dato(yo.rachaVictorias, "Racha"))
        ),
        el("section", { class: "panel" }, el("h2", {}, "Ranking"), listaRanking(ranking, yo.nombre)),
        el("section", { class: "panel" }, el("h2", {}, "Últimos duelos"), listaHistorial(historial.slice(0, 6)))
      );
    } catch (err) {
      alError(err);
    }
  }

  recargar();
  return { nodo, recargar };
}
