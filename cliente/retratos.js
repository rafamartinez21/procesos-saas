// RETRATOS DE LAS CRIATURAS (frontend, RF-27)
// Las doce criaturas de Aetheria dibujadas con SVG a partir de figuras simples. Son diseños
// originales del proyecto y viven en el código, igual que el catálogo (D-22): no hay
// imágenes que descargar ni derechos de terceros. Todo se crea con createElementNS, sin
// innerHTML.
//
// Cada criatura mira hacia la derecha. En la arena, la del rival se dibuja en espejo.

const SVG = "http://www.w3.org/2000/svg";

// Paleta de cada elemento: base, oscuro, claro y acento.
export const PALETA = {
  fuego: { base: "#ff7a2f", oscuro: "#b8360f", claro: "#ffc069", acento: "#ffe066" },
  agua: { base: "#3aa0ff", oscuro: "#1b5fae", claro: "#a5d8ff", acento: "#e7f5ff" },
  planta: { base: "#4cc26a", oscuro: "#237a3b", claro: "#b2f2bb", acento: "#ffd43b" },
  rayo: { base: "#ffd43b", oscuro: "#c99400", claro: "#fff3bf", acento: "#5c7cfa" },
  tierra: { base: "#c08a4f", oscuro: "#6e4a26", claro: "#e8c59a", acento: "#9aa0a6" },
  viento: { base: "#38d9a9", oscuro: "#0f8a6a", claro: "#c3fae8", acento: "#e6fcf5" },
  neutro: { base: "#adb5bd", oscuro: "#495057", claro: "#e9ecef", acento: "#f8f9fa" },
};

let contador = 0;

// Crea un nodo SVG: s("circle", { cx: 1 }, hijo1, hijo2…).
function s(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElementNS(SVG, etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor !== undefined && valor !== null && valor !== false) nodo.setAttribute(clave, String(valor));
  }
  for (const hijo of hijos.flat()) if (hijo) nodo.append(hijo);
  return nodo;
}

const OSCURO = "#1b1b2f";

// Ojo con brillo. r: radio; mira: desplazamiento de la pupila hacia delante.
function ojo(x, y, r = 3.5, mira = 0.8) {
  return s(
    "g",
    {},
    s("ellipse", { cx: x, cy: y, rx: r, ry: r * 1.12, fill: "#fff" }),
    s("circle", { cx: x + mira, cy: y + 0.3, r: r * 0.62, fill: OSCURO }),
    s("circle", { cx: x + mira + r * 0.25, cy: y - r * 0.3, r: r * 0.24, fill: "#fff" })
  );
}

const linea = (d, color, ancho, extra = {}) => s("path", { d, fill: "none", stroke: color, "stroke-width": ancho, "stroke-linecap": "round", "stroke-linejoin": "round", ...extra });
const forma = (d, color, extra = {}) => s("path", { d, fill: color, ...extra });
const sombra = (rx = 34) => s("ellipse", { cx: 60, cy: 103, rx, ry: 5.5, fill: "rgba(0,0,0,0.28)" });

// ---------- las doce criaturas ----------

const DIBUJOS = {
  pirolince: (p) => [
    sombra(36),
    linea("M36 72 C20 66 15 50 22 38", p.base, 7),
    forma("M22 40 C15 32 20 22 23 14 C27 23 33 27 29 39 Z", p.acento),
    forma("M23 36 C20 31 22 26 24 22 C26 27 28 30 26 36 Z", p.base),
    s("rect", { x: 36, y: 78, width: 8, height: 21, rx: 4, fill: p.oscuro }),
    s("rect", { x: 47, y: 80, width: 8, height: 19, rx: 4, fill: p.oscuro }),
    s("rect", { x: 64, y: 80, width: 8, height: 19, rx: 4, fill: p.oscuro }),
    s("rect", { x: 74, y: 78, width: 8, height: 21, rx: 4, fill: p.oscuro }),
    s("ellipse", { cx: 57, cy: 74, rx: 27, ry: 14, fill: p.base }),
    s("ellipse", { cx: 60, cy: 81, rx: 17, ry: 5.5, fill: p.claro, opacity: 0.75 }),
    linea("M44 66 L48 72 M52 64 L55 71", p.oscuro, 2.4, { opacity: 0.7 }),
    forma("M70 54 L63 40 L74 44 L75 28 L82 41 L91 30 L91 45 L102 41 L95 54 L104 60 L91 63 Z", p.acento),
    forma("M74 54 L70 45 L77 47 L79 37 L83 46 L89 39 L89 49 L96 47 L92 56 Z", p.claro),
    s("circle", { cx: 84, cy: 57, r: 13, fill: p.base }),
    forma("M75 49 L77 33 L86 45 Z", p.base),
    forma("M77.5 46 L78.5 38 L83 45 Z", p.claro),
    forma("M86 45 L94 33 L95 50 Z", p.base),
    forma("M88 45 L93 38 L93.5 47 Z", p.claro),
    s("ellipse", { cx: 93, cy: 62, rx: 7.5, ry: 5.2, fill: p.claro }),
    s("ellipse", { cx: 99.5, cy: 59.6, rx: 2.3, ry: 1.7, fill: "#3b1a10" }),
    linea("M94 65 Q97 67 100 65", "#3b1a10", 1.2),
    linea("M73 59 L79 60 M74 63 L79 63", p.oscuro, 1.6),
    ojo(87, 54, 3.4, 1),
  ],

  brason: (p) => [
    sombra(40),
    s("ellipse", { cx: 36, cy: 94, rx: 8, ry: 6, fill: "#7a2b10" }),
    s("ellipse", { cx: 82, cy: 94, rx: 8, ry: 6, fill: "#7a2b10" }),
    s("rect", { x: 84, y: 70, width: 12, height: 12, rx: 5, fill: "#d9653b" }),
    s("ellipse", { cx: 97, cy: 72, rx: 12, ry: 10, fill: "#d9653b" }),
    forma("M86 72 Q97 66 108 72", "#b8491f", { opacity: 0.6 }),
    ojo(100, 69, 3, 1),
    forma("M96.5 66 Q100 63 103.5 66 L103.5 68 Q100 66 96.5 68 Z", "#d9653b"),
    linea("M102 77 Q105 78 107 76", "#5a1d0b", 1.3),
    forma("M22 86 C22 58 42 44 60 44 C78 44 98 58 98 86 Z", "#5a2412"),
    forma("M28 84 C28 62 44 50 60 50 C76 50 92 62 92 84 Z", p.oscuro),
    s("rect", { x: 18, y: 82, width: 84, height: 9, rx: 4.5, fill: "#4a1e0e" }),
    linea("M36 82 L43 68 L58 62 L72 67 L80 82 M58 62 L58 52 M43 68 L32 72 M72 67 L88 72", p.acento, 3.2),
    linea("M36 82 L43 68 L58 62 L72 67 L80 82 M58 62 L58 52 M43 68 L32 72 M72 67 L88 72", "#fff", 1, { opacity: 0.55 }),
    forma("M53 47 L56 38 L64 38 L67 47 Z", "#4a1e0e"),
    s("circle", { cx: 60, cy: 35, r: 2.6, fill: p.acento }),
    s("circle", { cx: 55, cy: 29, r: 1.8, fill: p.claro }),
    s("circle", { cx: 64, cy: 25, r: 1.4, fill: p.acento, opacity: 0.8 }),
  ],

  marejon: (p) => [
    sombra(42),
    forma("M18 100 C12 70 30 44 62 44 C90 44 104 64 102 84 C101 96 92 100 82 100 Z", p.base),
    s("ellipse", { cx: 56, cy: 88, rx: 28, ry: 11, fill: p.claro, opacity: 0.45 }),
    forma("M46 47 C50 36 62 33 70 41 C63 39 57 42 55 49 Z", p.claro),
    forma("M58 46 C62 38 70 37 75 43 C70 42 66 44 64 48 Z", p.acento, { opacity: 0.8 }),
    forma("M32 92 C28 101 19 105 14 101 C19 96 24 92 32 87 Z", p.oscuro),
    ojo(76, 58, 3.1, 1),
    ojo(91, 58, 3.1, 1),
    s("ellipse", { cx: 80, cy: 70, rx: 9, ry: 7, fill: p.claro }),
    s("ellipse", { cx: 93, cy: 70, rx: 9, ry: 7, fill: p.claro }),
    s("ellipse", { cx: 86.5, cy: 64.5, rx: 4, ry: 2.6, fill: "#123a66" }),
    forma("M80 75 L82.5 96 L86.5 76 Z", "#fffdf2"),
    forma("M90 75 L92.5 96 L96.5 76 Z", "#fffdf2"),
    s("g", { fill: p.oscuro, opacity: 0.6 }, s("circle", { cx: 77, cy: 70, r: 0.9 }), s("circle", { cx: 81, cy: 72, r: 0.9 }), s("circle", { cx: 93, cy: 72, r: 0.9 }), s("circle", { cx: 97, cy: 70, r: 0.9 })),
  ],

  nautilia: (p) => [
    sombra(34),
    linea("M76 86 C76 94 72 98 68 100", p.claro, 4),
    linea("M84 87 C86 95 84 99 80 102", p.claro, 4),
    linea("M92 86 C96 92 96 98 93 101", p.claro, 4),
    forma("M68 74 C82 66 98 70 104 82 C94 88 80 90 68 86 Z", "#ffc9de"),
    linea("M90 72 L92 56", "#ffc9de", 3),
    linea("M97 74 L102 60", "#ffc9de", 3),
    ojo(92, 55, 3.2, 0.6),
    ojo(102, 59, 3.2, 0.6),
    s("circle", { cx: 50, cy: 64, r: 30, fill: p.base }),
    s("circle", { cx: 50, cy: 64, r: 30, fill: "none", stroke: p.oscuro, "stroke-width": 2.5 }),
    linea("M50 64 m0 -5 a5 5 0 1 1 -5 5 a10 10 0 1 1 10 10 a15 15 0 1 1 -15 -15 a20 20 0 1 1 20 20 a25 25 0 0 1 -26 -22", p.oscuro, 2.6),
    linea("M30 46 Q40 40 52 39", p.claro, 3, { opacity: 0.8 }),
    s("path", { d: "M84 40 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z", fill: p.acento }),
    s("path", { d: "M22 30 l1.4 3.5 l3.5 1.4 l-3.5 1.4 l-1.4 3.5 l-1.4 -3.5 l-3.5 -1.4 l3.5 -1.4 Z", fill: p.claro }),
  ],

  musgolem: (p) => [
    sombra(42),
    s("rect", { x: 33, y: 84, width: 17, height: 16, rx: 5, fill: "#5f645a" }),
    s("rect", { x: 70, y: 84, width: 17, height: 16, rx: 5, fill: "#5f645a" }),
    s("rect", { x: 11, y: 52, width: 15, height: 36, rx: 7, fill: "#7d8277" }),
    s("rect", { x: 94, y: 52, width: 15, height: 36, rx: 7, fill: "#7d8277" }),
    s("rect", { x: 24, y: 40, width: 72, height: 50, rx: 15, fill: "#8d9187" }),
    linea("M34 76 L40 70 L38 62 M80 80 L76 72 L82 66", "#5f645a", 2),
    s("circle", { cx: 36, cy: 43, r: 10, fill: p.base }),
    s("circle", { cx: 50, cy: 36, r: 11.5, fill: p.base }),
    s("circle", { cx: 66, cy: 37, r: 11, fill: p.base }),
    s("circle", { cx: 82, cy: 44, r: 10, fill: p.base }),
    s("rect", { x: 26, y: 40, width: 68, height: 10, fill: p.base }),
    forma("M30 50 Q32 58 35 50 M58 50 Q60 60 63 50 M84 50 Q86 56 88 50", p.oscuro),
    s("circle", { cx: 12, cy: 54, r: 6, fill: p.base }),
    s("circle", { cx: 106, cy: 56, r: 5, fill: p.base }),
    s("circle", { cx: 44, cy: 32, r: 2.6, fill: p.acento }),
    s("circle", { cx: 72, cy: 31, r: 2.2, fill: "#fff" }),
    s("circle", { cx: 84, cy: 38, r: 2, fill: p.acento }),
    s("ellipse", { cx: 49, cy: 63, rx: 5.5, ry: 4, fill: p.acento }),
    s("ellipse", { cx: 71, cy: 63, rx: 5.5, ry: 4, fill: p.acento }),
    s("ellipse", { cx: 50.5, cy: 62, rx: 2, ry: 1.5, fill: "#fff", opacity: 0.85 }),
    s("ellipse", { cx: 72.5, cy: 62, rx: 2, ry: 1.5, fill: "#fff", opacity: 0.85 }),
    linea("M52 75 Q60 79 68 75", "#4a4e45", 2.4),
  ],

  espinara: (p) => [
    sombra(36),
    forma("M40 76 C16 76 6 56 14 38 C22 52 32 60 44 66 Z", p.base),
    forma("M14 38 C12 46 14 52 18 56 C18 48 16 42 14 38 Z", p.claro),
    forma("M22 58 l-6 -2 l5 -3 Z M30 66 l-5 2 l2 -6 Z M18 46 l-6 0 l4 -4 Z", p.oscuro),
    s("rect", { x: 40, y: 80, width: 7, height: 19, rx: 3.5, fill: p.oscuro }),
    s("rect", { x: 50, y: 81, width: 7, height: 18, rx: 3.5, fill: p.oscuro }),
    s("rect", { x: 64, y: 81, width: 7, height: 18, rx: 3.5, fill: p.oscuro }),
    s("rect", { x: 73, y: 80, width: 7, height: 19, rx: 3.5, fill: p.oscuro }),
    s("ellipse", { cx: 58, cy: 76, rx: 24, ry: 12, fill: p.base }),
    s("ellipse", { cx: 70, cy: 80, rx: 11, ry: 6, fill: p.claro }),
    forma("M66 62 C70 54 78 52 84 56 C80 60 74 64 66 66 Z", p.oscuro),
    forma("M60 66 C62 58 68 56 72 58 C70 62 66 66 60 68 Z", "#2f9e44"),
    s("circle", { cx: 84, cy: 58, r: 12, fill: p.base }),
    forma("M88 54 L108 62 L89 68 Z", p.claro),
    s("circle", { cx: 107, cy: 62, r: 2.4, fill: OSCURO }),
    forma("M75 52 L76 30 L86 47 Z", p.base),
    forma("M77.5 48 L78 37 L83 47 Z", p.claro),
    forma("M86 47 L95 30 L94 52 Z", p.base),
    forma("M88.5 47 L93 38 L92.5 49 Z", p.claro),
    s("circle", { cx: 80, cy: 46, r: 3, fill: p.acento }),
    s("circle", { cx: 80, cy: 46, r: 1.2, fill: "#e8590c" }),
    ojo(87, 55, 3.2, 1),
  ],

  voltarda: (p) => [
    sombra(30),
    linea("M52 86 L48 101 M48 101 L43 102 M48 101 L52 103", "#c46a00", 3),
    linea("M62 86 L64 101 M64 101 L59 103 M64 101 L69 102", "#c46a00", 3),
    forma("M32 66 L10 56 L18 69 L6 76 L32 80 Z", p.oscuro),
    s("ellipse", { cx: 56, cy: 72, rx: 27, ry: 16, fill: p.base }),
    s("ellipse", { cx: 60, cy: 80, rx: 16, ry: 6, fill: p.claro }),
    forma("M38 64 C50 52 72 54 82 66 C68 72 52 74 38 75 Z", p.oscuro),
    linea("M46 67 L55 61 L53 68 L65 62", p.acento, 2.4),
    linea("M74 64 C80 52 80 44 84 37", p.base, 10),
    s("circle", { cx: 86, cy: 34, r: 10, fill: p.base }),
    forma("M95 31 L108 36 L95 39 Z", "#f08c00"),
    forma("M81 27 L85 12 L84 21 L93 9 L89 26 Z", p.acento),
    linea("M78 44 Q82 46 86 44", p.oscuro, 1.6, { opacity: 0.6 }),
    ojo(88, 32, 2.8, 1),
  ],

  chispardo: (p) => [
    sombra(42),
    linea("M32 82 C18 86 9 78 6 66", p.base, 9),
    forma("M6 66 L1 60 L9 62 Z", p.acento),
    linea("M38 84 L32 98 L26 99 M70 86 L74 99 L80 99", p.oscuro, 5),
    linea("M50 86 L48 99 M82 84 L88 96", p.oscuro, 5),
    s("ellipse", { cx: 57, cy: 78, rx: 30, ry: 13, fill: p.base }),
    s("ellipse", { cx: 60, cy: 85, rx: 22, ry: 5, fill: p.claro }),
    forma("M32 72 L37 59 L42 70 Z M42 69 L48 55 L53 67 Z M53 66 L59 53 L64 66 Z M64 66 L70 55 L74 68 Z M74 69 L79 59 L82 72 Z", p.oscuro),
    linea("M44 79 L51 75 L49 81 L58 77", p.acento, 2.2),
    linea("M64 81 L70 77 L68 83 L76 79", p.acento, 2.2),
    s("ellipse", { cx: 91, cy: 73, rx: 15, ry: 9.5, fill: p.base }),
    forma("M86 66 L90 58 L94 66 Z", p.oscuro),
    linea("M90 78 L105 76", p.oscuro, 1.6),
    s("circle", { cx: 103, cy: 70, r: 1.2, fill: OSCURO }),
    ojo(93, 70, 3, 1.2),
  ],

  rocadonte: (p) => [
    sombra(44),
    s("rect", { x: 28, y: 80, width: 13, height: 20, rx: 3, fill: p.oscuro }),
    s("rect", { x: 44, y: 82, width: 13, height: 18, rx: 3, fill: p.oscuro }),
    s("rect", { x: 66, y: 82, width: 13, height: 18, rx: 3, fill: p.oscuro }),
    s("rect", { x: 81, y: 80, width: 13, height: 20, rx: 3, fill: p.oscuro }),
    forma("M18 86 C16 56 38 40 62 41 C84 42 98 56 98 74 L98 86 Z", p.base),
    forma("M30 54 L38 42 L50 46 L46 56 Z", p.acento),
    forma("M50 45 L60 37 L72 41 L66 52 L52 52 Z", "#b7bcc1"),
    forma("M70 44 L82 46 L84 56 L72 54 Z", p.acento),
    linea("M34 70 L40 64 M58 66 L62 74 M76 66 L74 74", p.oscuro, 2, { opacity: 0.6 }),
    s("circle", { cx: 92, cy: 64, r: 14, fill: p.base }),
    s("ellipse", { cx: 83, cy: 64, rx: 8, ry: 12, fill: p.oscuro }),
    linea("M103 68 C111 78 109 91 101 97", p.base, 8.5),
    linea("M96 77 C104 88 113 88 117 81", "#fff7e6", 5),
    ojo(96, 60, 2.8, 1),
  ],

  terrabu: (p) => [
    s("ellipse", { cx: 58, cy: 100, rx: 44, ry: 8, fill: "#4e3418" }),
    s("circle", { cx: 30, cy: 96, r: 3, fill: "#6e4a26" }),
    s("circle", { cx: 88, cy: 98, r: 2.4, fill: "#6e4a26" }),
    s("ellipse", { cx: 56, cy: 70, rx: 31, ry: 27, fill: p.base }),
    s("ellipse", { cx: 64, cy: 79, rx: 17, ry: 14, fill: p.claro }),
    s("circle", { cx: 40, cy: 48, r: 4, fill: p.acento }),
    s("circle", { cx: 50, cy: 44, r: 3, fill: "#c8ccd0" }),
    s("ellipse", { cx: 90, cy: 69, rx: 11, ry: 7.5, fill: "#f4a6b0" }),
    s("circle", { cx: 100, cy: 67, r: 3.6, fill: "#d6336c" }),
    linea("M86 74 L98 77 M86 76 L96 81", p.oscuro, 0.9, { opacity: 0.7 }),
    linea("M74 58 Q78 54 82 58", OSCURO, 2.2),
    s("ellipse", { cx: 72, cy: 92, rx: 11, ry: 6, fill: "#f4a6b0" }),
    linea("M64 94 L60 103 M70 96 L68 105 M77 96 L78 105 M82 94 L86 102", "#fff7e6", 3),
    s("ellipse", { cx: 40, cy: 92, rx: 10, ry: 5.5, fill: "#f4a6b0" }),
    linea("M33 95 L30 103 M39 97 L38 105 M45 97 L47 104", "#fff7e6", 3),
  ],

  ciclonia: (p) => [
    sombra(30),
    s("ellipse", { cx: 46, cy: 52, rx: 30, ry: 10, transform: "rotate(-28 46 52)", fill: p.claro, opacity: 0.5, stroke: p.base, "stroke-width": 1.5 }),
    s("ellipse", { cx: 40, cy: 60, rx: 26, ry: 8, transform: "rotate(-12 40 60)", fill: p.acento, opacity: 0.45, stroke: p.base, "stroke-width": 1.5 }),
    linea("M58 76 L50 100 M64 76 L68 100 M54 78 L40 98", p.oscuro, 2.2),
    s("ellipse", { cx: 38, cy: 78, rx: 22, ry: 8.5, transform: "rotate(-10 38 78)", fill: p.base }),
    linea("M28 74 L30 84 M36 72 L38 83 M44 71 L46 82", p.oscuro, 1.6, { opacity: 0.7 }),
    linea("M56 74 L74 50", p.base, 7.5),
    forma("M70 42 L94 44 L80 59 Z", p.base),
    s("ellipse", { cx: 75, cy: 46, rx: 5, ry: 4.5, fill: p.oscuro }),
    s("ellipse", { cx: 88, cy: 46.5, rx: 5, ry: 4.5, fill: p.oscuro }),
    s("circle", { cx: 76.5, cy: 44.6, r: 1.5, fill: "#fff" }),
    s("circle", { cx: 89.5, cy: 45, r: 1.5, fill: "#fff" }),
    linea("M76 42 C74 32 70 26 64 22 M86 42 C90 32 94 28 100 26", p.oscuro, 1.4),
    linea("M70 60 L88 70 L83 57", p.oscuro, 4),
    linea("M88 70 C97 63 100 52 93 45", p.claro, 3.4),
    linea("M88 70 C97 63 100 52 93 45", "#fff", 1, { opacity: 0.8 }),
  ],

  plumazul: (p) => [
    linea("M14 46 C24 40 34 44 40 38", p.claro, 2.4, { opacity: 0.7 }),
    linea("M96 92 C104 88 110 92 116 86", p.claro, 2.4, { opacity: 0.7 }),
    sombra(32),
    linea("M52 88 L50 101 M50 101 L45 103 M50 101 L54 103", "#f08c00", 3),
    linea("M64 88 L66 101 M66 101 L61 103 M66 101 L71 103", "#f08c00", 3),
    forma("M36 76 L12 92 L20 80 L8 82 L30 68 Z", "#2a5d9f"),
    s("ellipse", { cx: 58, cy: 70, rx: 27, ry: 22, fill: "#4c9be8" }),
    s("ellipse", { cx: 66, cy: 78, rx: 15, ry: 13, fill: "#d0ebff" }),
    forma("M36 62 C46 50 64 54 70 66 C62 80 46 86 34 82 Z", "#2a5d9f"),
    linea("M42 70 Q50 68 58 72 M40 76 Q48 75 56 78", "#74c0fc", 1.6),
    s("circle", { cx: 78, cy: 45, r: 14, fill: "#4c9be8" }),
    linea("M72 32 C68 22 72 16 78 14 M77 31 C76 22 80 17 86 17 M82 33 C84 26 90 23 95 24", p.base, 2.6),
    forma("M90 42 C98 42 102 46 100 52 L95 48 Z", "#ffd43b"),
    forma("M90 46 L100 52 L91 50 Z", "#e8a800"),
    ojo(82, 42, 3.2, 1),
    forma("M78.5 37.5 L86 38.5 L85.5 39.5 L78.5 39 Z", "#2a5d9f"),
  ],
};

// Colores propios de criaturas que no usan la paleta de su elemento tal cual.
const PALETA_CRIATURA = {
  plumazul: { base: "#38d9a9", oscuro: "#2a5d9f", claro: "#a5d8ff", acento: "#e6fcf5" },
};

// Las pruebas comprueban con esto que cada criatura del catálogo tiene su dibujo.
export const tieneDibujo = (id) => Object.hasOwn(DIBUJOS, id);

// Silueta genérica para una criatura que no tuviera dibujo (no debería pasar).
const generico = (p) => [sombra(30), s("ellipse", { cx: 60, cy: 70, rx: 28, ry: 24, fill: p.base }), ojo(68, 62, 4), ojo(52, 62, 4)];

// Retrato de una criatura. Opciones:
//   elemento: para elegir la paleta; espejo: mirar a la izquierda (rival);
//   fondo: disco de color detrás (tarjetas); titulo: texto accesible.
export function retrato(id, { elemento = "neutro", espejo = false, fondo = false, titulo, clase = "retrato" } = {}) {
  const p = PALETA_CRIATURA[id] || PALETA[elemento] || PALETA.neutro;
  const n = ++contador;
  const hijos = [];
  if (fondo) {
    hijos.push(
      s(
        "defs",
        {},
        s(
          "radialGradient",
          { id: `fondo-${n}`, cx: "50%", cy: "38%", r: "65%" },
          s("stop", { offset: "0%", "stop-color": p.claro, "stop-opacity": 0.55 }),
          s("stop", { offset: "70%", "stop-color": p.base, "stop-opacity": 0.22 }),
          s("stop", { offset: "100%", "stop-color": p.oscuro, "stop-opacity": 0.05 })
        )
      ),
      s("circle", { cx: 60, cy: 60, r: 58, fill: `url(#fondo-${n})` })
    );
  }
  const dibujo = (DIBUJOS[id] || generico)(p);
  hijos.push(s("g", espejo ? { transform: "translate(120 0) scale(-1 1)" } : {}, ...dibujo));
  const atributos = { viewBox: "0 0 120 120", class: clase, role: "img", "aria-label": titulo || id };
  return s("svg", atributos, titulo ? s("title", {}, titulo) : null, ...hijos);
}

// ---------- iconos de elemento ----------

const ICONOS = {
  fuego: (c) => [forma("M12 2 C14 7 19 9 19 15 A7 7 0 0 1 5 15 C5 11 8 9 9 6 C10 9 11 10 12 10 C12 7 11 5 12 2 Z", c)],
  agua: (c) => [forma("M12 2 C16 8 19 11 19 15 A7 7 0 0 1 5 15 C5 11 8 8 12 2 Z", c)],
  planta: (c) => [forma("M20 4 C20 14 15 20 8 20 C6 20 5 19 4 18 C4 10 10 4 20 4 Z", c), linea("M4 20 L13 11", "rgba(0,0,0,0.35)", 1.6)],
  rayo: (c) => [forma("M13 2 L5 14 L11 14 L9 22 L19 9 L13 9 Z", c)],
  tierra: (c) => [forma("M2 20 L9 8 L13 14 L16 10 L22 20 Z", c)],
  viento: (c) => [linea("M3 9 H14 A3 3 0 1 0 11 6 M3 14 H18 A3 3 0 1 1 15 17 M3 19 H10", c, 2.2)],
  neutro: (c) => [s("circle", { cx: 12, cy: 12, r: 6, fill: "none", stroke: c, "stroke-width": 2.4 })],
};

export function iconoElemento(elemento, { color = "currentColor", clase = "icono" } = {}) {
  const dibujo = (ICONOS[elemento] || ICONOS.neutro)(color);
  return s("svg", { viewBox: "0 0 24 24", class: clase, "aria-hidden": "true" }, ...dibujo);
}

// Emblema del juego: un cristal de éter dentro de un anillo.
export function emblema({ clase = "emblema" } = {}) {
  const n = ++contador;
  return s(
    "svg",
    { viewBox: "0 0 64 64", class: clase, "aria-hidden": "true" },
    s(
      "defs",
      {},
      s(
        "linearGradient",
        { id: `cristal-${n}`, x1: "0", y1: "0", x2: "1", y2: "1" },
        s("stop", { offset: "0%", "stop-color": "#c3fae8" }),
        s("stop", { offset: "50%", "stop-color": "#748ffc" }),
        s("stop", { offset: "100%", "stop-color": "#9c36b5" })
      )
    ),
    s("circle", { cx: 32, cy: 32, r: 28, fill: "none", stroke: "#f2c96d", "stroke-width": 2.5 }),
    s("circle", { cx: 32, cy: 32, r: 23, fill: "none", stroke: "#f2c96d", "stroke-width": 1, opacity: 0.5 }),
    forma("M32 8 L44 30 L32 56 L20 30 Z", `url(#cristal-${n})`),
    forma("M32 8 L44 30 L32 34 Z", "#fff", { opacity: 0.35 }),
    s("circle", { cx: 32, cy: 4, r: 2, fill: "#f2c96d" }),
    s("circle", { cx: 32, cy: 60, r: 2, fill: "#f2c96d" }),
    s("circle", { cx: 4, cy: 32, r: 2, fill: "#f2c96d" }),
    s("circle", { cx: 60, cy: 32, r: 2, fill: "#f2c96d" })
  );
}
