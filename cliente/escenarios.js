// ESCENARIOS DE LA ARENA (frontend, RF-36)
// Seis parajes de Aetheria, uno por elemento, dibujados en SVG por capas: cielo, astro,
// montañas lejanas, capa media con detalles propios y suelo. Se combate en el paraje del
// elemento de la primera criatura del rival ("en su terreno"). Son diseños originales del
// proyecto, sin imágenes externas (D-27).

const SVG = "http://www.w3.org/2000/svg";
let contador = 0;

function s(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElementNS(SVG, etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor !== undefined && valor !== null && valor !== false) nodo.setAttribute(clave, String(valor));
  }
  for (const hijo of hijos.flat()) if (hijo) nodo.append(hijo);
  return nodo;
}

// Silueta de montañas: alturas pseudoaleatorias pero fijas (misma semilla, mismo dibujo).
function cordillera(semilla, base, minimo, maximo, picos, { suave = false } = {}) {
  let x = semilla * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const puntos = [];
  for (let i = 0; i <= picos; i++) puntos.push([(160 * i) / picos, minimo + rnd() * (maximo - minimo)]);
  let d = `M0 ${base} L0 ${puntos[0][1]}`;
  for (let i = 1; i < puntos.length; i++) {
    const [px, py] = puntos[i - 1];
    const [cx, cy] = puntos[i];
    if (suave) d += ` Q${(px + cx) / 2} ${Math.min(py, cy) - 4} ${cx} ${cy}`;
    else d += ` L${(px + cx) / 2} ${Math.min(py, cy) - (maximo - minimo) * 0.5 * rnd()} L${cx} ${cy}`;
  }
  return `${d} L160 ${base} Z`;
}

const degradado = (id, colores, { vertical = true } = {}) =>
  s("linearGradient", { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 }, ...colores.map((c, i) => s("stop", { offset: `${(100 * i) / (colores.length - 1)}%`, "stop-color": c })));

export const BIOMAS = {
  fuego: {
    nombre: "Caldera de Ígnea",
    cielo: ["#1a0710", "#4a1218", "#a8361a", "#e8762d"],
    astro: { x: 124, y: 22, r: 8, color: "#ffd8a8", halo: "#ff922b" },
    lejos: "#3d1018",
    medio: "#240a12",
    suelo: ["#3a1610", "#1c0a08"],
    detalles: () => [
      // Volcán con cráter encendido y humo.
      s("path", { d: "M36 52 C50 44 60 32 68 22 L84 22 C92 32 102 44 118 52 Z", fill: "#5a1d22" }),
      s("path", { d: "M76 22 L84 22 C92 32 102 44 118 52 L92 52 C88 40 82 30 76 22 Z", fill: "#3a1016", opacity: 0.8 }),
      s("ellipse", { class: "lava-brillo", cx: 76, cy: 22.5, rx: 8, ry: 2, fill: "#ffb347" }),
      s("path", { d: "M73 23 C72 31 68 40 62 52 L67 52 C72 41 75 32 78 23 Z", fill: "#ff6b1a", opacity: 0.85, class: "lava-brillo" }),
      s("ellipse", { class: "humo-fondo", cx: 78, cy: 16, rx: 10, ry: 5, fill: "#5c2a2a", opacity: 0.55 }),
      s("ellipse", { class: "humo-fondo", cx: 84, cy: 9, rx: 13, ry: 5, fill: "#4a2025", opacity: 0.4, style: "animation-delay:-3s" }),
    ],
    sueloDetalles: () => [
      s("path", { class: "lava-brillo", d: "M0 74 C30 70 50 80 80 76 C110 72 130 82 160 78", fill: "none", stroke: "#ff6b1a", "stroke-width": 1.4, opacity: 0.7 }),
      s("path", { class: "lava-brillo", d: "M10 86 C40 82 70 90 100 86 C120 84 140 88 160 86", fill: "none", stroke: "#ffa94d", "stroke-width": 0.9, opacity: 0.5, style: "animation-delay:-1.4s" }),
    ],
  },
  agua: {
    nombre: "Lago de la Marea Quieta",
    cielo: ["#06122e", "#0f2a5c", "#1f5c8f", "#62a8c9"],
    astro: { x: 122, y: 20, r: 7, color: "#f1f3f5", halo: "#a5d8ff" },
    lejos: "#163a63",
    medio: "#0d2847",
    suelo: ["#0f3d63", "#061a33"],
    detalles: () => [
      s("path", { d: "M18 52 L26 40 L30 52 Z M132 52 L140 38 L146 52 Z", fill: "#0a2240" }),
    ],
    sueloDetalles: () => [
      ...[60, 66, 72, 79, 86].map((y, i) => s("path", { class: "ola", style: `animation-delay:${-i * 0.7}s`, d: `M${8 + i * 9} ${y} h${30 - i * 2} M${70 + i * 5} ${y + 1.5} h${24} M${120 - i * 6} ${y - 1} h${18}`, stroke: "#a5d8ff", "stroke-width": 0.5, opacity: 0.45, "stroke-linecap": "round" })),
      s("ellipse", { cx: 122, cy: 60, rx: 4, ry: 10, fill: "#e7f5ff", opacity: 0.18, class: "ola" }),
    ],
  },
  planta: {
    nombre: "Bosque de los Susurros",
    cielo: ["#071a14", "#0f3324", "#2b6b45", "#a9d18e"],
    astro: { x: 30, y: 18, r: 7, color: "#fff3bf", halo: "#d8f5a2" },
    lejos: "#1d4a35",
    medio: "#0f2d20",
    suelo: ["#1f4d2b", "#0c2414"],
    detalles: () => {
      const arbol = (x, h, c) => [s("rect", { x: x - 0.8, y: 52 - h * 0.35, width: 1.6, height: h * 0.35, fill: "#0a1f15" }), s("path", { d: `M${x} ${52 - h} L${x + h * 0.28} ${52 - h * 0.3} L${x - h * 0.28} ${52 - h * 0.3} Z`, fill: c })];
      return [...[8, 20, 30, 128, 140, 152].flatMap((x, i) => arbol(x, 18 + (i % 3) * 6, i % 2 ? "#0b2a1b" : "#12382a")), ...[44, 116].flatMap((x) => [s("circle", { cx: x, cy: 40, r: 9, fill: "#123d2a" }), s("rect", { x: x - 1, y: 44, width: 2, height: 8, fill: "#0a1f15" })])];
    },
    sueloDetalles: () => [
      ...[12, 34, 58, 96, 120, 146].map((x, i) => s("path", { d: `M${x} ${70 + (i % 3) * 6} q2 -5 4 0 q2 -4 4 0`, fill: "none", stroke: "#51cf66", "stroke-width": 0.7, opacity: 0.6 })),
      s("circle", { cx: 24, cy: 80, r: 1.6, fill: "#ff8787" }),
      s("circle", { cx: 138, cy: 74, r: 1.4, fill: "#ffd43b" }),
    ],
  },
  rayo: {
    nombre: "Cumbre de la Tormenta",
    cielo: ["#0b0b1f", "#1c1c3f", "#363566", "#59578a"],
    astro: null,
    lejos: "#26254a",
    medio: "#171633",
    suelo: ["#2b2a4a", "#121126"],
    detalles: () => [
      ...[[30, 10, 26], [80, 6, 34], [130, 12, 28]].map(([x, y, r], i) => s("ellipse", { class: "nube", style: `animation-delay:${-i * 4}s`, cx: x, cy: y, rx: r, ry: 7, fill: "#2c2b52", opacity: 0.85 })),
      // Agujas de cristal cargadas.
      ...[[36, 30], [124, 26], [112, 36]].map(([x, h]) => s("path", { class: "cristal-brillo", d: `M${x} ${52 - h} L${x + 4} ${52} L${x - 4} ${52} Z`, fill: "#5c7cfa", opacity: 0.7 })),
    ],
    sueloDetalles: () => [s("path", { d: "M20 78 L30 74 L28 80 L40 76 M110 84 L120 79 L118 85 L132 80", fill: "none", stroke: "#ffe066", "stroke-width": 0.6, opacity: 0.45, class: "cristal-brillo" })],
  },
  tierra: {
    nombre: "Cañón de los Gigantes",
    cielo: ["#1f1022", "#5b2a2e", "#b4643a", "#e8b067"],
    astro: { x: 36, y: 30, r: 10, color: "#ffe8cc", halo: "#ffa94d" },
    lejos: "#6e3a2a",
    medio: "#4a2618",
    suelo: ["#7a4a2a", "#3a2110"],
    detalles: () => [
      // Mesetas de roca con vetas.
      s("path", { d: "M4 52 L8 30 L34 30 L38 52 Z", fill: "#55301e" }),
      s("path", { d: "M8 36 H34 M7 42 H35", stroke: "#3d2214", "stroke-width": 0.7 }),
      s("path", { d: "M112 52 L118 24 L150 24 L156 52 Z", fill: "#55301e" }),
      s("path", { d: "M117 31 H151 M115 39 H153", stroke: "#3d2214", "stroke-width": 0.7 }),
    ],
    sueloDetalles: () => [s("path", { d: "M30 70 l6 4 l-2 5 l7 3 M100 80 l5 -3 l4 4 l6 -2 M130 66 l4 4 l-3 4", fill: "none", stroke: "#2b170b", "stroke-width": 0.7, opacity: 0.8 })],
  },
  viento: {
    nombre: "Islas del Cielo Abierto",
    cielo: ["#0c2340", "#1e5a8a", "#58a6c9", "#c5ecf2"],
    astro: { x: 128, y: 18, r: 8, color: "#fff9db", halo: "#fff3bf" },
    lejos: "#6fa3bd",
    medio: "#3d7896",
    suelo: ["#6cb4a4", "#2f6f6a"],
    suave: true,
    detalles: () => [
      ...[[24, 22, 12], [100, 14, 16], [62, 34, 10]].map(([x, y, r], i) =>
        s("g", { class: "isla", style: `animation-delay:${-i * 2}s` }, s("ellipse", { cx: x, cy: y, rx: r, ry: 2.6, fill: "#5d9c7f" }), s("path", { d: `M${x - r} ${y} Q${x} ${y + r * 0.9} ${x + r} ${y} Z`, fill: "#4a6b74" }))
      ),
      ...[[40, 8, 18], [140, 30, 14]].map(([x, y, r], i) => s("ellipse", { class: "nube", style: `animation-delay:${-i * 5}s`, cx: x, cy: y, rx: r, ry: 4, fill: "#fff", opacity: 0.55 })),
    ],
    sueloDetalles: () => [...[20, 70, 130].map((x) => s("path", { d: `M${x} 76 q3 -6 6 0 q3 -5 6 0`, fill: "none", stroke: "#c3fae8", "stroke-width": 0.7, opacity: 0.7 }))],
  },
};
BIOMAS.neutro = { ...BIOMAS.rayo, nombre: "Santuario del Éter", cielo: ["#0b0d1f", "#23285f", "#5a3f7c", "#8f6bb8"], astro: { x: 128, y: 18, r: 8, color: "#fff4d6", halo: "#ffe8a8" }, detalles: () => [] };

export const biomaDe = (elemento) => (BIOMAS[elemento] ? elemento : "neutro");

// SVG del escenario completo, a pantalla de la arena (recorta los lados si hace falta).
export function escenario(bioma) {
  const b = BIOMAS[biomaDe(bioma)];
  const n = ++contador;
  const defs = s(
    "defs",
    {},
    degradado(`cielo-${n}`, b.cielo),
    degradado(`suelo-${n}`, b.suelo),
    s("radialGradient", { id: `halo-${n}` }, s("stop", { offset: "0%", "stop-color": b.astro ? b.astro.halo : "#fff", "stop-opacity": 0.55 }), s("stop", { offset: "100%", "stop-color": b.astro ? b.astro.halo : "#fff", "stop-opacity": 0 })),
    s("linearGradient", { id: `bruma-${n}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s("stop", { offset: "0%", "stop-color": b.cielo[3], "stop-opacity": 0 }), s("stop", { offset: "100%", "stop-color": b.cielo[3], "stop-opacity": 0.35 }))
  );
  const estrellas = [];
  for (let i = 0; i < 26; i++) {
    const x = (i * 61.7) % 160;
    const y = (i * 23.3) % 34;
    estrellas.push(s("circle", { class: "estrella-fondo", style: `animation-delay:${-(i % 7) * 0.6}s`, cx: x.toFixed(1), cy: y.toFixed(1), r: i % 5 === 0 ? 0.55 : 0.3, fill: "#fff", opacity: 0.7 }));
  }
  const capas = [
    s("rect", { x: 0, y: 0, width: 160, height: 90, fill: `url(#cielo-${n})` }),
    s("g", { opacity: 0.8 }, ...estrellas),
    b.astro ? [s("circle", { cx: b.astro.x, cy: b.astro.y, r: b.astro.r * 3.2, fill: `url(#halo-${n})` }), s("circle", { cx: b.astro.x, cy: b.astro.y, r: b.astro.r, fill: b.astro.color })] : null,
    s("path", { d: cordillera(n % 7 + 3, 56, 24, 40, 9, { suave: b.suave }), fill: b.lejos, opacity: 0.85 }),
    s("rect", { x: 0, y: 30, width: 160, height: 26, fill: `url(#bruma-${n})` }),
    s("path", { d: cordillera(n % 5 + 11, 56, 38, 48, 7, { suave: true }), fill: b.medio }),
    ...b.detalles(),
    s("rect", { x: 0, y: 52, width: 160, height: 38, fill: `url(#suelo-${n})` }),
    // Líneas de perspectiva del suelo.
    s("g", { stroke: "#fff", "stroke-width": 0.25, opacity: 0.07 }, ...[-80, -40, 0, 40, 80, 120, 160, 200, 240].map((x) => s("line", { x1: 80, y1: 52, x2: x, y2: 90 })), ...[58, 66, 78].map((y) => s("line", { x1: 0, y1: y, x2: 160, y2: y }))),
    s("rect", { x: 0, y: 51.5, width: 160, height: 1.2, fill: b.cielo[3], opacity: 0.35 }),
    ...b.sueloDetalles(),
  ];
  return s("svg", { class: `escenario bioma-${biomaDe(bioma)}`, viewBox: "0 0 160 90", preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true" }, defs, ...capas.flat());
}
