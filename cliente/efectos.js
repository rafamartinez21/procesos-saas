// EFECTOS DE PARTÍCULAS DE LA ARENA (frontend, RF-36)
// Un lienzo (canvas) encima del escenario donde se dibujan las partículas: el ambiente de
// cada escenario (brasas, lluvia, hojas…), los proyectiles de cada elemento, los impactos,
// el aura de los estados alterados y el polvo de éter de una criatura que cae.
//
// Solo es decoración: no decide nada del combate. Si el sistema pide reducir el movimiento,
// no se dibuja nada y los proyectiles "llegan" al momento.

const sinMovimiento = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Colores de las partículas de cada elemento: [principal, secundario, brillo].
export const COLOR = {
  fuego: ["#ff7a2f", "#ffd43b", "#fff1d6"],
  agua: ["#3aa0ff", "#a5d8ff", "#e7f5ff"],
  planta: ["#51cf66", "#b2f2bb", "#fff9db"],
  rayo: ["#ffe066", "#fff9db", "#ffffff"],
  tierra: ["#c08a4f", "#e8c59a", "#fff4e6"],
  viento: ["#38d9a9", "#c3fae8", "#ffffff"],
  neutro: ["#d0bfff", "#e5dbff", "#ffffff"],
  sombra: ["#7048e8", "#9775fa", "#e5dbff"],
};
const MAX_PARTICULAS = 700;

const azar = (a, b) => a + Math.random() * (b - a);
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function crearEfectos(lienzo) {
  const ctx = lienzo.getContext && lienzo.getContext("2d");
  const particulas = [];
  const vuelos = []; // proyectiles en camino
  const rayos = []; // relámpagos visibles unos fotogramas
  const emisores = new Map(); // clave -> { cada, acum, emitir }
  let ambiente = null;
  let ancho = 0;
  let alto = 0;
  let anterior = 0;
  let activo = false;

  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = lienzo.clientWidth;
    const h = lienzo.clientHeight;
    if (w !== ancho || h !== alto) {
      ancho = w;
      alto = h;
      lienzo.width = Math.round(w * dpr);
      lienzo.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  const anadir = (p) => {
    if (particulas.length < MAX_PARTICULAS) particulas.push({ vida: 0, rot: 0, vr: 0, g: 0, arrastre: 1, opacidad: 1, crece: 0, ...p });
  };

  // ---------- dibujo de cada tipo de partícula ----------
  function pintar(p) {
    const t = p.vida / p.max;
    const alfa = p.opacidad * (p.desvanece === "entrada" ? Math.sin(Math.PI * t) : 1 - t);
    if (alfa <= 0) return;
    ctx.globalAlpha = Math.min(1, alfa);
    const tam = p.tam * (1 + p.crece * t);
    switch (p.tipo) {
      case "luz": {
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, tam);
        g.addColorStop(0, p.color2 || "#fff");
        g.addColorStop(0.35, p.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, tam, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "chispa": {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = p.color;
        ctx.lineWidth = tam;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
        break;
      }
      case "hoja": {
        ctx.globalCompositeOperation = "source-over";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, tam, tam * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-tam, 0);
        ctx.lineTo(tam, 0);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "roca": {
        ctx.globalCompositeOperation = "source-over";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = "rgba(20,10,5,0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-tam, -tam * 0.4);
        ctx.lineTo(-tam * 0.2, -tam);
        ctx.lineTo(tam, -tam * 0.5);
        ctx.lineTo(tam * 0.8, tam * 0.7);
        ctx.lineTo(-tam * 0.6, tam * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "gota": {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = p.color;
        ctx.lineWidth = tam;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        break;
      }
      case "racha": {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = p.color;
        ctx.lineWidth = tam;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(p.x - p.largo * 0.5, p.y - 6, p.x - p.largo, p.y);
        ctx.stroke();
        break;
      }
      case "corte": {
        ctx.globalCompositeOperation = "lighter";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, tam, -1.1, 1.1);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "anillo": {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, 4 * (1 - t));
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, tam, tam * (p.aplastado || 1), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "copo": {
        ctx.globalCompositeOperation = "lighter";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          ctx.moveTo(Math.cos(a) * tam, Math.sin(a) * tam);
          ctx.lineTo(-Math.cos(a) * tam, -Math.sin(a) * tam);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }

  function pintarRayo(r) {
    ctx.globalCompositeOperation = "lighter";
    for (const [ancho2, color, alfa] of [[9, r.color, 0.25], [4, r.color, 0.7], [1.6, "#fff", 1]]) {
      ctx.globalAlpha = alfa * (1 - r.vida / r.max);
      ctx.strokeStyle = color;
      ctx.lineWidth = ancho2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      r.puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  }

  // ---------- bucle ----------
  function paso(t) {
    if (!lienzo.isConnected) {
      activo = false;
      return;
    }
    const dt = Math.min(0.05, (t - (anterior || t)) / 1000);
    anterior = t;
    medir();
    ctx.clearRect(0, 0, ancho, alto);
    if (ambiente) ambiente(dt);
    for (const e of emisores.values()) {
      e.acum += dt;
      while (e.acum >= e.cada) {
        e.acum -= e.cada;
        e.emitir();
      }
    }
    for (let i = vuelos.length - 1; i >= 0; i--) {
      const v = vuelos[i];
      v.vida += dt * 1000;
      const k = Math.min(1, v.vida / v.dur);
      const e = v.facil ? 1 - (1 - k) * (1 - k) : k;
      const x = (1 - e) * (1 - e) * v.a[0] + 2 * (1 - e) * e * v.c[0] + e * e * v.b[0];
      const y = (1 - e) * (1 - e) * v.a[1] + 2 * (1 - e) * e * v.c[1] + e * e * v.b[1];
      v.estela(x, y, v);
      if (k >= 1) {
        vuelos.splice(i, 1);
        v.listo();
      }
    }
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida += dt;
      if (p.vida >= p.max) {
        particulas.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= p.arrastre;
      p.vy *= p.arrastre;
      if (p.oscila) p.x += Math.sin((p.vida + p.fase) * p.oscila) * 0.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      pintar(p);
    }
    for (let i = rayos.length - 1; i >= 0; i--) {
      const r = rayos[i];
      r.vida += dt;
      if (r.vida >= r.max) rayos.splice(i, 1);
      else pintarRayo(r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(paso);
  }

  function iniciar() {
    if (activo || !ctx || sinMovimiento()) return;
    activo = true;
    anterior = 0;
    requestAnimationFrame(paso);
  }

  // ---------- piezas sueltas ----------

  // Estallido de partículas en un punto (impactos, entradas…).
  function rafaga(x, y, elemento = "neutro", { cantidad = 26, fuerza = 1 } = {}) {
    if (!activo) return;
    const [c1, c2, c3] = COLOR[elemento] || COLOR.neutro;
    anadir({ tipo: "luz", x, y, vx: 0, vy: 0, tam: 46 * fuerza, crece: 0.4, max: 0.35, color: c1, color2: c3 });
    anadir({ tipo: "anillo", x, y, vx: 0, vy: 0, tam: 14, crece: 4 * fuerza, max: 0.45, color: c2, aplastado: 0.6 });
    for (let i = 0; i < cantidad * fuerza; i++) {
      const a = azar(0, Math.PI * 2);
      const v = azar(80, 320) * fuerza;
      const base = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, max: azar(0.35, 0.8), arrastre: 0.93 };
      if (elemento === "planta") anadir({ ...base, tipo: "hoja", tam: azar(3, 6), color: elegir([c1, c2, "#2f9e44"]), vr: azar(-8, 8), g: 220 });
      else if (elemento === "tierra") anadir({ ...base, tipo: "roca", tam: azar(2.5, 5.5), color: elegir([c1, c2, "#8d6e4f"]), vr: azar(-6, 6), g: 600 });
      else if (elemento === "agua") anadir({ ...base, tipo: "gota", tam: azar(2, 3.5), color: elegir([c1, c2, c3]), g: 520 });
      else if (elemento === "viento") anadir({ ...base, tipo: "corte", tam: azar(6, 14), color: elegir([c1, c2]), rot: a, vr: azar(-4, 4) });
      else anadir({ ...base, tipo: "chispa", tam: azar(1.5, 3), color: elegir([c1, c2, c3]), g: elemento === "fuego" ? -60 : 120 });
    }
  }

  // Proyectil del atacante al objetivo; la promesa se cumple cuando llega.
  function proyectil(a, b, elemento = "neutro") {
    if (!activo) return Promise.resolve();
    const [c1, c2, c3] = COLOR[elemento] || COLOR.neutro;
    if (elemento === "rayo") return relampago(b, { desde: [b[0] + azar(-30, 30), -10] });
    return new Promise((listo) => {
      const alto2 = elemento === "tierra" ? 160 : 60;
      const c = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - alto2];
      const estela = {
        fuego: (x, y) => {
          anadir({ tipo: "luz", x, y, vx: 0, vy: 0, tam: 22, max: 0.12, color: c1, color2: c3 });
          for (let i = 0; i < 3; i++) anadir({ tipo: "luz", x: x + azar(-5, 5), y: y + azar(-5, 5), vx: azar(-30, 30), vy: azar(-70, -20), tam: azar(5, 10), max: azar(0.25, 0.5), color: elegir([c1, c2]), color2: c2 });
        },
        agua: (x, y) => {
          anadir({ tipo: "luz", x, y, vx: 0, vy: 0, tam: 18, max: 0.1, color: c1, color2: c3 });
          for (let i = 0; i < 2; i++) anadir({ tipo: "gota", x, y, vx: azar(-60, 60), vy: azar(-40, 40), tam: azar(1.5, 3), max: 0.4, color: elegir([c2, c3]), g: 400 });
        },
        planta: (x, y) => anadir({ tipo: "hoja", x: x + azar(-14, 14), y: y + azar(-14, 14), vx: azar(-20, 20), vy: azar(-20, 20), tam: azar(4, 7), max: 0.3, color: elegir([c1, c2, "#2f9e44"]), rot: azar(0, 6), vr: 10 }),
        tierra: (x, y) => {
          anadir({ tipo: "roca", x, y, vx: 0, vy: 0, tam: 9, max: 0.05, color: c1, rot: x / 9 });
          anadir({ tipo: "luz", x, y, vx: azar(-20, 20), vy: azar(-10, 10), tam: 8, max: 0.4, color: "rgba(160,120,80,0.6)", color2: "rgba(200,160,120,0.6)", crece: 1.5 });
        },
        viento: (x, y, v) => anadir({ tipo: "corte", x, y, vx: 0, vy: 0, tam: 16, max: 0.14, color: elegir([c1, c2, c3]), rot: Math.atan2(v.b[1] - v.a[1], v.b[0] - v.a[0]) }),
        neutro: (x, y) => {
          anadir({ tipo: "luz", x, y, vx: 0, vy: 0, tam: 16, max: 0.12, color: c1, color2: c3 });
          anadir({ tipo: "chispa", x, y, vx: azar(-80, 80), vy: azar(-80, 80), tam: 1.5, max: 0.3, color: c2 });
        },
      }[elemento] || ((x, y) => anadir({ tipo: "luz", x, y, vx: 0, vy: 0, tam: 16, max: 0.12, color: c1, color2: c3 }));
      const dur = elemento === "tierra" ? 520 : 400;
      // Si el lienzo deja de pintarse (pestaña en segundo plano, arena cambiada), el proyectil
      // llega igualmente: el turno nunca se queda esperando a una animación.
      let hecho = false;
      const fin = () => {
        if (!hecho) {
          hecho = true;
          listo();
        }
      };
      setTimeout(fin, dur + 250);
      vuelos.push({ a, b, c, vida: 0, dur, facil: elemento !== "tierra", estela, listo: fin });
    });
  }

  // Relámpago en zigzag hasta un punto.
  function relampago(b, { desde = [b[0], -10], color = COLOR.rayo[0] } = {}) {
    if (!activo) return Promise.resolve();
    const puntos = [desde];
    const tramos = 9;
    for (let i = 1; i < tramos; i++) {
      const k = i / tramos;
      puntos.push([desde[0] + (b[0] - desde[0]) * k + azar(-18, 18), desde[1] + (b[1] - desde[1]) * k]);
    }
    puntos.push(b);
    rayos.push({ puntos, vida: 0, max: 0.28, color });
    return new Promise((r) => setTimeout(r, 90));
  }

  // Polvo de éter que sube de una criatura que cae.
  function disolver(x, y, ancho2, alto3, elemento = "neutro") {
    if (!activo) return;
    const [c1, c2, c3] = COLOR[elemento] || COLOR.neutro;
    for (let i = 0; i < 70; i++) {
      anadir({ tipo: "luz", x: x + azar(-ancho2 / 2, ancho2 / 2), y: y + azar(-alto3 / 2, alto3 / 2), vx: azar(-20, 20), vy: azar(-110, -30), tam: azar(3, 7), max: azar(0.7, 1.4), color: elegir([c1, c2]), color2: c3, desvanece: "entrada", oscila: azar(2, 5), fase: azar(0, 6) });
    }
  }

  // Chispas que suben (mejoras, curas) o caen (bajadas de estadística).
  function aura(x, y, elemento = "neutro", { sube = true, ancho2 = 80 } = {}) {
    if (!activo) return;
    const [c1, c2, c3] = COLOR[elemento] || COLOR.neutro;
    anadir({ tipo: "anillo", x, y: y + 40, vx: 0, vy: 0, tam: ancho2 * 0.4, crece: 0.8, max: 0.6, color: c2, aplastado: 0.3 });
    for (let i = 0; i < 28; i++) {
      anadir({ tipo: "luz", x: x + azar(-ancho2 / 2, ancho2 / 2), y: y + (sube ? azar(10, 50) : azar(-50, -10)), vx: 0, vy: sube ? azar(-140, -60) : azar(60, 140), tam: azar(3, 6), max: azar(0.5, 0.9), color: elegir([c1, c2]), color2: c3, desvanece: "entrada" });
    }
  }

  // Emisores continuos (estados alterados): posicion() da el centro y el tamaño actuales.
  function emisor(clave, tipo, posicion) {
    if (!tipo) return emisores.delete(clave);
    const crear = {
      quemado: () => {
        const { x, y, w, h } = posicion();
        anadir({ tipo: "luz", x: x + azar(-w * 0.35, w * 0.35), y: y + azar(-h * 0.1, h * 0.35), vx: azar(-10, 10), vy: azar(-70, -40), tam: azar(3, 6), max: azar(0.5, 0.9), color: elegir(COLOR.fuego.slice(0, 2)), color2: COLOR.fuego[2] });
      },
      congelado: () => {
        const { x, y, w, h } = posicion();
        anadir({ tipo: "copo", x: x + azar(-w * 0.4, w * 0.4), y: y + azar(-h * 0.4, h * 0.2), vx: 0, vy: azar(10, 30), tam: azar(2.5, 4.5), max: azar(0.8, 1.4), color: elegir(["#d0ebff", "#ffffff", "#a5d8ff"]), vr: azar(-2, 2), desvanece: "entrada" });
      },
      paralizado: () => {
        const { x, y, w, h } = posicion();
        if (Math.random() < 0.35) relampagoCorto(x + azar(-w * 0.35, w * 0.35), y + azar(-h * 0.3, h * 0.3));
      },
    }[tipo];
    if (!crear) return emisores.delete(clave);
    emisores.set(clave, { cada: tipo === "paralizado" ? 0.25 : 0.08, acum: 0, emitir: crear });
  }

  function relampagoCorto(x, y) {
    const puntos = [[x, y]];
    for (let i = 0; i < 4; i++) puntos.push([puntos[i][0] + azar(-10, 10), puntos[i][1] + azar(-12, 4)]);
    rayos.push({ puntos, vida: 0, max: 0.12, color: COLOR.rayo[0] });
  }

  // ---------- ambiente de cada escenario ----------
  function ponerAmbiente(bioma) {
    let reloj = 0;
    let siguienteRayo = 3;
    const genera = {
      fuego: () => anadir({ tipo: "luz", x: azar(0, ancho), y: alto + 5, vx: azar(-15, 15), vy: azar(-60, -25), tam: azar(1.5, 3.5), max: azar(3, 6), color: elegir(["#ff7a2f", "#ffa94d", "#ffd43b"]), color2: "#fff1d6", desvanece: "entrada", oscila: azar(1, 3), fase: azar(0, 6), opacidad: 0.9 }),
      agua: () => {
        anadir({ tipo: "gota", x: azar(-40, ancho), y: -10, vx: 60, vy: azar(380, 520), tam: 1, max: alto / 400, color: "rgba(165,216,255,0.45)" });
        if (Math.random() < 0.15) anadir({ tipo: "luz", x: azar(0, ancho), y: azar(alto * 0.55, alto), vx: azar(-6, 6), vy: azar(-12, -4), tam: azar(2, 4), max: azar(2, 4), color: "#74c0fc", color2: "#e7f5ff", desvanece: "entrada" });
      },
      planta: () => {
        if (Math.random() < 0.4) anadir({ tipo: "hoja", x: azar(0, ancho), y: -10, vx: azar(10, 40), vy: azar(25, 50), tam: azar(3, 5), max: azar(5, 9), color: elegir(["#40c057", "#82c91e", "#fab005", "#2f9e44"]), vr: azar(-3, 3), oscila: azar(1, 2), fase: azar(0, 6), opacidad: 0.85 });
        else anadir({ tipo: "luz", x: azar(0, ancho), y: azar(alto * 0.3, alto * 0.9), vx: azar(-10, 10), vy: azar(-10, 10), tam: azar(2, 3.5), max: azar(2, 4), color: "#d8f5a2", color2: "#fff", desvanece: "entrada", oscila: 2, fase: azar(0, 6) });
      },
      rayo: () => anadir({ tipo: "gota", x: azar(-80, ancho), y: -10, vx: 120, vy: azar(600, 800), tam: 1.1, max: alto / 600, color: "rgba(200,210,255,0.5)" }),
      tierra: () => anadir({ tipo: "luz", x: -10, y: azar(alto * 0.3, alto), vx: azar(30, 70), vy: azar(-8, 8), tam: azar(1.5, 3), max: azar(4, 8), color: "rgba(232,197,154,0.7)", color2: "rgba(255,244,230,0.8)", desvanece: "entrada", oscila: 1.5, fase: azar(0, 6) }),
      viento: () => {
        if (Math.random() < 0.5) anadir({ tipo: "racha", x: -20, y: azar(alto * 0.1, alto * 0.8), vx: azar(260, 420), vy: 0, tam: 1.2, largo: azar(40, 110), max: (ancho + 140) / 300, color: "rgba(230,252,245,0.35)", desvanece: "entrada" });
        else anadir({ tipo: "hoja", x: -10, y: azar(0, alto * 0.8), vx: azar(120, 200), vy: azar(-10, 30), tam: azar(2, 3), max: azar(3, 5), color: elegir(["#ffdeeb", "#fcc2d7", "#fff"]), vr: azar(-6, 6), opacidad: 0.8 });
      },
    }[bioma] || (() => anadir({ tipo: "luz", x: azar(0, ancho), y: azar(0, alto), vx: azar(-6, 6), vy: azar(-14, -4), tam: azar(1.5, 3), max: azar(3, 6), color: "#9775fa", color2: "#e5dbff", desvanece: "entrada" }));
    const ritmo = { fuego: 0.06, agua: 0.02, planta: 0.25, rayo: 0.015, tierra: 0.12, viento: 0.12 }[bioma] || 0.2;
    ambiente = (dt) => {
      reloj += dt;
      while (reloj >= ritmo) {
        reloj -= ritmo;
        genera();
      }
      // Tormenta: de vez en cuando cae un relámpago al fondo y el escenario se ilumina.
      if (bioma === "rayo") {
        siguienteRayo -= dt;
        if (siguienteRayo <= 0) {
          siguienteRayo = azar(4, 9);
          const x = azar(ancho * 0.1, ancho * 0.9);
          relampago([x + azar(-40, 40), alto * azar(0.25, 0.4)], { desde: [x, -10], color: "#bac8ff" });
          lienzo.dispatchEvent(new CustomEvent("trueno"));
        }
      }
    };
  }

  return { iniciar, rafaga, proyectil, relampago, disolver, aura, emisor, ambiente: ponerAmbiente, activo: () => activo };
}
