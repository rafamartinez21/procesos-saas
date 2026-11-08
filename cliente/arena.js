// ARENA DE COMBATE (frontend, RF-28)
// Escenario con las dos criaturas frente a frente y el turno reproducido paso a paso:
// embestida, impacto con el color del elemento, daño flotante, barra de PS que baja,
// cambios de criatura y criaturas que caen. Solo dibuja: los datos de cada paso (daño,
// PS que quedan, criatura que entra…) vienen en los eventos que calcula el servidor (D-20).
//
// Hay dos lados: "abajo" (tu criatura, o el primer jugador para un espectador) y
// "arriba" (el rival). Si el sistema pide reducir el movimiento, no hay animaciones: cada
// paso se aplica al momento y solo se ve la narración.

import { el } from "./dom.js";
import { retrato, iconoElemento } from "./retratos.js";

const ELEMENTO = { fuego: "Fuego", agua: "Agua", planta: "Planta", rayo: "Rayo", tierra: "Tierra", viento: "Viento", neutro: "Neutro" };
const ESTADO = { quemado: "Quemado", congelado: "Congelado", paralizado: "Paralizado" };

const sinMovimiento = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const esperar = (ms) => new Promise((r) => setTimeout(r, sinMovimiento() ? 0 : ms));

// Ejecuta una animación y espera a que termine (o al momento si no hay movimiento).
function animar(nodo, fotogramas, opciones) {
  if (sinMovimiento() || !nodo.animate) return Promise.resolve();
  return nodo.animate(fotogramas, { fill: "none", ...opciones }).finished.catch(() => {});
}

const nivelPs = (pct) => (pct > 50 ? "alta" : pct > 20 ? "media" : "baja");

function crearLado(posicion) {
  const nombre = el("strong", { class: "hud-nombre" });
  const etiquetas = el("span", { class: "hud-etiquetas" });
  const relleno = el("div", { class: "ps-relleno ps-alta" });
  const texto = el("span", { class: "ps-texto" });
  const barra = el("div", { class: "ps", role: "meter", "aria-valuemin": "0" }, relleno, texto);
  const pips = el("span", { class: "pips", "aria-hidden": "true" });
  const dueno = el("span", { class: "hud-dueno" });
  const hud = el("div", { class: "hud" }, el("div", { class: "hud-fila" }, nombre, etiquetas), barra, el("div", { class: "hud-fila hud-pie" }, dueno, pips));
  const cuerpo = el("div", { class: "cuerpo" });
  const destello = el("div", { class: "destello" });
  const sprite = el("div", { class: "sprite" }, el("div", { class: "plataforma" }), cuerpo, destello);
  const nodo = el("div", { class: `lado lado-${posicion}` }, hud, sprite);
  return { posicion, nodo, hud, nombre, etiquetas, relleno, texto, barra, pips, dueno, cuerpo, destello, sprite, criatura: null, psMostrado: 0 };
}

export function crearArena() {
  const abajo = crearLado("abajo");
  const arriba = crearLado("arriba");
  const narrador = el("p", { class: "narrador", "aria-live": "polite" });
  const capa = el("div", { class: "arena-capa" });
  const nodo = el("div", { class: "arena" }, el("div", { class: "arena-fondo", "aria-hidden": "true" }), arriba.nodo, abajo.nodo, capa, el("div", { class: "narrador-caja" }, narrador));
  const lados = { abajo, arriba };
  const otro = (posicion) => (posicion === "abajo" ? "arriba" : "abajo");

  function pintarPs(l, ps) {
    const c = l.criatura;
    if (!c) return;
    const pct = Math.max(0, Math.round((100 * ps) / c.psMax));
    l.relleno.style.width = `${pct}%`;
    l.relleno.className = `ps-relleno ps-${nivelPs(pct)}`;
    l.texto.textContent = `${ps} / ${c.psMax}`;
    l.barra.setAttribute("aria-valuemax", String(c.psMax));
    l.barra.setAttribute("aria-valuenow", String(ps));
    l.barra.setAttribute("aria-label", `PS de ${c.nombre}`);
    l.psMostrado = ps;
  }

  function pintarEtiquetas(l) {
    const c = l.criatura;
    const hijos = [el("span", { class: `elemento elem-${c.elemento}` }, iconoElemento(c.elemento), ELEMENTO[c.elemento] || c.elemento)];
    if (c.estado) hijos.push(el("span", { class: `estado estado-${c.estado}` }, ESTADO[c.estado]));
    l.etiquetas.replaceChildren(...hijos);
  }

  // Coloca una criatura en un lado sin animación.
  // criatura: { id, nombre, elemento, ps, psMax, estado }.
  function colocar(posicion, criatura, { dueno = "", restantes = null, total = 3 } = {}) {
    const l = lados[posicion];
    const misma = l.criatura && l.criatura.id === criatura.id;
    l.criatura = { ...criatura };
    if (!misma) l.cuerpo.replaceChildren(retrato(criatura.id, { elemento: criatura.elemento, espejo: posicion === "arriba", titulo: criatura.nombre }));
    l.nombre.textContent = criatura.nombre;
    l.dueno.textContent = dueno;
    pintarEtiquetas(l);
    pintarPs(l, criatura.ps);
    l.sprite.classList.toggle("caida", criatura.ps <= 0);
    l.cuerpo.style.opacity = "";
    if (restantes !== null) {
      l.pips.replaceChildren(...Array.from({ length: total }, (_, i) => el("span", { class: i < restantes ? "pip viva" : "pip" })));
      l.pips.setAttribute("title", `Le quedan ${restantes} de ${total}`);
    }
    l.nodo.hidden = false;
  }

  function vaciar(posicion) {
    lados[posicion].criatura = null;
    lados[posicion].nodo.hidden = true;
  }

  function narrar(texto) {
    narrador.textContent = texto || "";
  }

  // Barra de PS que baja (o sube) poco a poco hasta el valor nuevo.
  async function animarPs(posicion, destino) {
    const l = lados[posicion];
    if (!l.criatura) return;
    const desde = l.psMostrado;
    if (sinMovimiento() || desde === destino) return pintarPs(l, destino);
    const pasos = 18;
    for (let i = 1; i <= pasos; i++) {
      pintarPs(l, Math.round(desde + ((destino - desde) * i) / pasos));
      await new Promise((r) => setTimeout(r, 22));
    }
    l.criatura.ps = destino;
  }

  function flotante(posicion, texto, clase = "") {
    const l = lados[posicion];
    const n = el("span", { class: `flotante ${clase}` }, texto);
    l.sprite.append(n);
    const fin = () => n.remove();
    if (sinMovimiento()) return setTimeout(fin, 900);
    animar(n, [
      { transform: "translate(-50%, 0) scale(0.6)", opacity: 0 },
      { transform: "translate(-50%, -18px) scale(1.15)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%, -56px) scale(1)", opacity: 0 },
    ], { duration: 1100, easing: "ease-out" }).then(fin);
  }

  const direccion = (posicion) => (posicion === "abajo" ? 1 : -1);

  async function embestir(posicion, { corto = false } = {}) {
    const l = lados[posicion];
    const d = direccion(posicion);
    const dx = (corto ? 14 : 38) * d;
    const dy = (corto ? -6 : -22) * d;
    await animar(l.cuerpo, [
      { transform: "translate(0, 0)" },
      { transform: `translate(${-dx * 0.25}px, ${-dy * 0.25}px)`, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.06)`, offset: 0.55 },
      { transform: "translate(0, 0)" },
    ], { duration: 460, easing: "ease-in-out" });
  }

  async function impacto(posicion, elemento = "neutro", { fuerte = false } = {}) {
    const l = lados[posicion];
    l.destello.className = `destello destello-${elemento}`;
    const temblor = animar(l.cuerpo, [
      { transform: "translateX(0)" },
      { transform: "translateX(-9px)" },
      { transform: "translateX(8px)" },
      { transform: "translateX(-5px)" },
      { transform: "translateX(3px)" },
      { transform: "translateX(0)" },
    ], { duration: 380 });
    const luz = animar(l.destello, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: fuerte ? 1 : 0.8, transform: "scale(1.1)", offset: 0.3 }, { opacity: 0, transform: "scale(1.3)" }], { duration: 520 });
    const parpadeo = animar(l.cuerpo, [{ filter: "brightness(1)" }, { filter: "brightness(2.2)" }, { filter: "brightness(1)" }, { filter: "brightness(1.8)" }, { filter: "brightness(1)" }], { duration: 380 });
    if (fuerte) animar(nodo, [{ transform: "translate(0,0)" }, { transform: "translate(-4px, 3px)" }, { transform: "translate(4px, -2px)" }, { transform: "translate(0,0)" }], { duration: 260 });
    await Promise.all([temblor, luz, parpadeo]);
  }

  async function aura(posicion, elemento) {
    const l = lados[posicion];
    l.destello.className = `destello destello-${elemento}`;
    await animar(l.destello, [{ opacity: 0, transform: "scale(0.8)" }, { opacity: 0.85, transform: "scale(1.15)" }, { opacity: 0, transform: "scale(1.25)" }], { duration: 700 });
  }

  async function caer(posicion) {
    const l = lados[posicion];
    await animar(l.cuerpo, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(36px) scale(0.9)", opacity: 0 }], { duration: 650, easing: "ease-in" });
    l.sprite.classList.add("caida");
  }

  async function salir(posicion) {
    const l = lados[posicion];
    if (!l.criatura || l.sprite.classList.contains("caida")) return;
    await animar(l.cuerpo, [{ transform: "scale(1)", opacity: 1, filter: "brightness(1)" }, { transform: "scale(0.2)", opacity: 0, filter: "brightness(3)" }], { duration: 360, easing: "ease-in" });
    l.cuerpo.style.opacity = "0"; // hasta que entre la siguiente
  }

  async function entrar(posicion) {
    const l = lados[posicion];
    l.sprite.classList.remove("caida");
    const entrada = animar(l.cuerpo, [{ transform: "scale(0.2)", opacity: 0, filter: "brightness(3)" }, { transform: "scale(1.08)", opacity: 1, filter: "brightness(1.4)", offset: 0.7 }, { transform: "scale(1)", opacity: 1, filter: "brightness(1)" }], { duration: 480, easing: "ease-out" });
    l.cuerpo.style.opacity = "";
    await entrada;
  }

  function ponerEstado(posicion, estado) {
    const l = lados[posicion];
    if (!l.criatura) return;
    l.criatura.estado = estado;
    pintarEtiquetas(l);
  }

  // Reproduce los eventos de un turno.
  //   ladoDe(ev): "abajo" o "arriba", el lado de quien protagoniza el evento.
  //   texto(ev): la frase del narrador.
  async function reproducir(eventos, { ladoDe, texto, duenoDe = () => "" }) {
    for (const ev of eventos) {
      const l = ladoDe(ev);
      narrar(texto(ev));
      switch (ev.tipo) {
        case "cambio":
          await salir(l);
          colocar(l, { id: ev.id, nombre: ev.criatura, elemento: ev.elemento, ps: ev.ps, psMax: ev.psMax, estado: ev.estado || null }, { dueno: duenoDe(l) });
          await entrar(l);
          break;
        case "ataque": {
          const objetivo = otro(l);
          await embestir(l);
          const fuerte = ev.eficacia > 1 || ev.critico;
          const golpe = impacto(objetivo, ev.elemento, { fuerte });
          flotante(objetivo, `-${ev.danio}`, ev.eficacia > 1 ? "eficaz" : ev.eficacia < 1 ? "flojo" : "");
          if (ev.critico) flotante(objetivo, "¡Crítico!", "critico");
          await Promise.all([golpe, animarPs(objetivo, ev.psObjetivo)]);
          break;
        }
        case "falla":
          await embestir(l, { corto: true });
          flotante(otro(l), "¡Falla!", "falla");
          break;
        case "estado":
          ponerEstado(l, ev.estado);
          await aura(l, { quemado: "fuego", congelado: "agua", paralizado: "rayo" }[ev.estado] || "neutro");
          break;
        case "no-actua":
          flotante(l, ESTADO[ev.estado] || "…", "falla");
          await animar(lados[l].cuerpo, [{ transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(0)" }], { duration: 420 });
          break;
        case "descongela":
          ponerEstado(l, null);
          await aura(l, "fuego");
          break;
        case "quemadura":
          flotante(l, `-${ev.danio}`, "flojo");
          await Promise.all([impacto(l, "fuego"), animarPs(l, ev.ps)]);
          break;
        case "drena":
          flotante(l, `+${ev.cura}`, "cura");
          await Promise.all([aura(l, "planta"), animarPs(l, ev.ps)]);
          break;
        case "debilitada":
          await animarPs(l, 0);
          await caer(l);
          break;
        default:
          break;
      }
      await esperar(ev.tipo === "fin" ? 200 : 650);
    }
  }

  return { nodo, colocar, vaciar, narrar, reproducir, capa };
}
