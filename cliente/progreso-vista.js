// PRESENTACIÓN DEL PROGRESO (frontend, hito 7)
// Panel con las estadísticas del jugador, sus últimas partidas y el ranking ELO.
// Pide los datos con ClienteApi y los dibuja; todos los textos van con textContent (dom.js).

import { ClienteApi } from "./cliente-api.js";
import { el } from "./dom.js";

const RESULTADO = { victoria: "Victoria", derrota: "Derrota", empate: "Empate" };

const fecha = (ms) => new Date(ms).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
const conSigno = (n) => (n > 0 ? `+${n}` : String(n));

function dato(valor, etiqueta) {
  return el("div", { class: "dato" }, el("span", { class: "dato-valor" }, String(valor)), el("span", { class: "dato-etiqueta" }, etiqueta));
}

function tablaHistorial(partidas) {
  if (!partidas.length) return el("p", { class: "suave" }, "Aún no has jugado ninguna partida.");
  return el(
    "div",
    { class: "tabla-contenedor" },
    el(
      "table",
      {},
      el("thead", {}, el("tr", {}, ...["Fecha", "Rival", "Resultado", "Turnos", "ELO"].map((t) => el("th", {}, t)))),
      el(
        "tbody",
        {},
        ...partidas.map((p) =>
          el(
            "tr",
            {},
            el("td", {}, fecha(p.fecha)),
            el("td", {}, p.rival),
            el("td", { class: `res-${p.resultado}` }, RESULTADO[p.resultado] + (p.motivo === "abandono" ? " (abandono)" : "")),
            el("td", {}, String(p.turnos)),
            el("td", {}, `${p.elo} (${conSigno(p.cambioElo)})`)
          )
        )
      )
    )
  );
}

function tablaRanking(ranking, miNombre) {
  if (!ranking.length) return el("p", { class: "suave" }, "Todavía no hay nadie en el ranking. ¡Juega la primera partida!");
  return el(
    "div",
    { class: "tabla-contenedor" },
    el(
      "table",
      {},
      el("thead", {}, el("tr", {}, ...["#", "Jugador", "ELO", "G", "P", "E"].map((t) => el("th", {}, t)))),
      el(
        "tbody",
        {},
        ...ranking.map((j) =>
          el(
            "tr",
            { class: j.nombre === miNombre ? "fila-mia" : "" },
            el("td", {}, String(j.posicion)),
            el("td", {}, j.nombre),
            el("td", {}, String(j.elo)),
            el("td", {}, String(j.ganadas)),
            el("td", {}, String(j.perdidas)),
            el("td", {}, String(j.empates))
          )
        )
      )
    )
  );
}

// Devuelve { nodo, recargar }: el vestíbulo llama a recargar al terminar un combate.
export function panelProgreso({ alError }) {
  const nodo = el("section", { class: "progreso" }, el("p", { class: "suave" }, "Cargando tu progreso…"));

  async function recargar() {
    try {
      const [yo, historial, ranking] = await Promise.all([ClienteApi.estadisticas(), ClienteApi.historial(), ClienteApi.ranking()]);
      nodo.replaceChildren(
        el("h2", {}, "Tu progreso"),
        el(
          "div",
          { class: "datos" },
          dato(yo.elo, "ELO"),
          dato(yo.jugadas, "Partidas"),
          dato(`${yo.porcentajeVictorias}%`, "Victorias"),
          dato(yo.rachaVictorias, "Racha")
        ),
        el("div", { class: "columnas" }, el("div", {}, el("h3", {}, "Últimas partidas"), tablaHistorial(historial.slice(0, 10))), el("div", {}, el("h3", {}, "Ranking"), tablaRanking(ranking, yo.nombre)))
      );
    } catch (err) {
      alError(err);
    }
  }

  recargar();
  return { nodo, recargar };
}
