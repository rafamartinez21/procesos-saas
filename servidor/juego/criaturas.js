// CAPA DE LÓGICA DEL JUEGO: catálogo de criaturas, movimientos y elementos (RF-15).
// Son datos fijos del juego, no de los usuarios: viven en el código (D-22). Todo es
// original de Ecos de Aetheria.

const ELEMENTOS = ["fuego", "agua", "planta", "rayo", "tierra", "viento"];
const NEUTRO = "neutro"; // movimientos sin elemento: eficacia normal contra todo

// Cada elemento es eficaz (x2) contra dos elementos y poco eficaz (x0,5) contra los dos que
// son eficaces contra él. Así ningún elemento es mejor que otro (lo comprueban las pruebas).
const FUERTE_CONTRA = {
  fuego: ["planta", "viento"],
  agua: ["fuego", "tierra"],
  planta: ["agua", "rayo"],
  rayo: ["agua", "viento"],
  tierra: ["fuego", "rayo"],
  viento: ["planta", "tierra"],
};

// Multiplicador de daño de un ataque de elemento "ataque" contra una criatura de elemento "defensa".
function eficacia(ataque, defensa) {
  if (ataque === NEUTRO || !FUERTE_CONTRA[ataque]) return 1;
  if (FUERTE_CONTRA[ataque].includes(defensa)) return 2;
  if (FUERTE_CONTRA[defensa] && FUERTE_CONTRA[defensa].includes(ataque)) return 0.5;
  return 1;
}

// Estados alterados (RF-17):
//  quemado:    pierde 1/10 de sus PS máximos al final de cada turno.
//  congelado:  no puede actuar; cada turno tiene un 30 % de probabilidad de descongelarse.
//  paralizado: un 25 % de los turnos no puede actuar y su velocidad se reduce a la mitad.
const ESTADOS = ["quemado", "congelado", "paralizado"];

// potencia: daño base; precision: % de acierto; efecto: estado que puede causar (prob 0..1)
// o drenar: fracción del daño causado que recupera el atacante.
const MOVIMIENTOS = {
  embestida: { nombre: "Embestida", elemento: NEUTRO, potencia: 40, precision: 100 },
  ascuas: { nombre: "Ascuas", elemento: "fuego", potencia: 50, precision: 100, efecto: { estado: "quemado", prob: 0.3 } },
  llamarada: { nombre: "Llamarada", elemento: "fuego", potencia: 90, precision: 85, efecto: { estado: "quemado", prob: 0.1 } },
  "burbuja-helada": { nombre: "Burbuja helada", elemento: "agua", potencia: 50, precision: 100, efecto: { estado: "congelado", prob: 0.2 } },
  torrente: { nombre: "Torrente", elemento: "agua", potencia: 90, precision: 85 },
  "latigo-cepa": { nombre: "Látigo cepa", elemento: "planta", potencia: 55, precision: 100 },
  drenaje: { nombre: "Drenaje", elemento: "planta", potencia: 70, precision: 95, efecto: { drenar: 0.5 } },
  chispa: { nombre: "Chispa", elemento: "rayo", potencia: 50, precision: 100, efecto: { estado: "paralizado", prob: 0.3 } },
  descarga: { nombre: "Descarga", elemento: "rayo", potencia: 85, precision: 90, efecto: { estado: "paralizado", prob: 0.1 } },
  pedrada: { nombre: "Pedrada", elemento: "tierra", potencia: 55, precision: 95 },
  temblor: { nombre: "Temblor", elemento: "tierra", potencia: 95, precision: 85 },
  ventisca: { nombre: "Ventisca", elemento: "viento", potencia: 60, precision: 90, efecto: { estado: "congelado", prob: 0.2 } },
  vendaval: { nombre: "Vendaval", elemento: "viento", potencia: 85, precision: 90 },
};

// Doce criaturas, dos por elemento: una rápida y frágil y otra lenta y resistente.
// Estadísticas: ps (puntos de salud), ataque, defensa, velocidad. Todas suman 280.
const CATALOGO = [
  { id: "pirolince", nombre: "Pirolince", elemento: "fuego", ps: 70, ataque: 80, defensa: 50, velocidad: 80, movimientos: ["llamarada", "ascuas", "embestida", "vendaval"], descripcion: "Felino veloz cuya melena arde cuando caza." },
  { id: "brason", nombre: "Brasón", elemento: "fuego", ps: 95, ataque: 70, defensa: 75, velocidad: 40, movimientos: ["llamarada", "ascuas", "pedrada", "embestida"], descripcion: "Tortuga de lava que dormita en los volcanes." },
  { id: "marejon", nombre: "Marejón", elemento: "agua", ps: 100, ataque: 70, defensa: 70, velocidad: 40, movimientos: ["torrente", "burbuja-helada", "temblor", "embestida"], descripcion: "Morsa colosal que provoca mareas al rugir." },
  { id: "nautilia", nombre: "Nautilia", elemento: "agua", ps: 70, ataque: 75, defensa: 55, velocidad: 80, movimientos: ["torrente", "burbuja-helada", "ventisca", "embestida"], descripcion: "Caracola danzante de los arrecifes de cristal." },
  { id: "musgolem", nombre: "Musgolem", elemento: "planta", ps: 100, ataque: 65, defensa: 80, velocidad: 35, movimientos: ["drenaje", "latigo-cepa", "pedrada", "embestida"], descripcion: "Gigante de piedra cubierto de musgo milenario." },
  { id: "espinara", nombre: "Espinara", elemento: "planta", ps: 70, ataque: 80, defensa: 50, velocidad: 80, movimientos: ["drenaje", "latigo-cepa", "chispa", "embestida"], descripcion: "Zorra de zarzas que se camufla en los bosques." },
  { id: "voltarda", nombre: "Voltarda", elemento: "rayo", ps: 65, ataque: 85, defensa: 45, velocidad: 85, movimientos: ["descarga", "chispa", "vendaval", "embestida"], descripcion: "Avutarda que planea entre nubes de tormenta." },
  { id: "chispardo", nombre: "Chispardo", elemento: "rayo", ps: 90, ataque: 70, defensa: 70, velocidad: 50, movimientos: ["descarga", "chispa", "torrente", "embestida"], descripcion: "Lagarto acorazado que almacena relámpagos." },
  { id: "rocadonte", nombre: "Rocadonte", elemento: "tierra", ps: 100, ataque: 80, defensa: 70, velocidad: 30, movimientos: ["temblor", "pedrada", "ascuas", "embestida"], descripcion: "Mastodonte de roca cuyos pasos abren grietas." },
  { id: "terrabu", nombre: "Terrabú", elemento: "tierra", ps: 75, ataque: 75, defensa: 60, velocidad: 70, movimientos: ["temblor", "pedrada", "latigo-cepa", "embestida"], descripcion: "Topo excavador que oye a sus presas bajo tierra." },
  { id: "ciclonia", nombre: "Ciclonia", elemento: "viento", ps: 65, ataque: 80, defensa: 45, velocidad: 90, movimientos: ["vendaval", "ventisca", "descarga", "embestida"], descripcion: "Mantis que corta el aire con alas de cristal." },
  { id: "plumazul", nombre: "Plumazul", elemento: "viento", ps: 90, ataque: 65, defensa: 70, velocidad: 55, movimientos: ["vendaval", "ventisca", "drenaje", "embestida"], descripcion: "Gran ave azul que guía a los viajeros perdidos." },
];

const POR_ID = new Map(CATALOGO.map((c) => [c.id, c]));

function obtenerCriatura(id) {
  return POR_ID.get(id);
}

function obtenerMovimiento(id) {
  return MOVIMIENTOS[id];
}

// Catálogo para el cliente: cada criatura con sus movimientos ya resueltos.
function catalogoPublico() {
  return CATALOGO.map((c) => ({
    ...c,
    movimientos: c.movimientos.map((m) => ({ id: m, ...MOVIMIENTOS[m] })),
  }));
}

module.exports = {
  ELEMENTOS,
  NEUTRO,
  FUERTE_CONTRA,
  ESTADOS,
  MOVIMIENTOS,
  CATALOGO,
  eficacia,
  obtenerCriatura,
  obtenerMovimiento,
  catalogoPublico,
};
