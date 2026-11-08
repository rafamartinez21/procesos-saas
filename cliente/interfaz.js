// INTERFAZ (capa de presentación del frontend)
// Dibuja pantallas y reacciona a clics. No hace peticiones por sí misma: para hablar
// con el servidor usa ClienteApi (REST) y ClienteJuego (tiempo real). No decide permisos:
// ocultar un botón es solo comodidad, quien rechaza de verdad las acciones no permitidas
// es el servidor.
//
// Los datos de los usuarios (nombre, email) se insertan siempre con textContent, nunca
// con innerHTML, para que un nombre malicioso no pueda inyectar código en la página.

import { ClienteApi } from "./cliente-api.js";
import { ClienteJuego } from "./cliente-juego.js";
import { el } from "./dom.js";
import { crearControladorCombate, crearControladorEspectador } from "./combate-vista.js";
import { panelProgreso } from "./progreso-vista.js";
import { retrato, emblema } from "./retratos.js";

const raiz = document.getElementById("app");
const zonaMensaje = document.getElementById("mensaje");
const barraUsuario = document.getElementById("barra-usuario");
document.getElementById("emblema-cabecera").append(emblema());

// ---------- mensajes ----------

let temporizadorMensaje = null;
function mostrarMensaje(texto, tipo = "info") {
  clearTimeout(temporizadorMensaje);
  zonaMensaje.hidden = !texto;
  if (!texto) return zonaMensaje.replaceChildren();
  zonaMensaje.className = `toast ${tipo}`;
  zonaMensaje.replaceChildren(
    el("span", { class: "toast-texto" }, texto),
    el("button", { type: "button", "aria-label": "Cerrar aviso", onclick: () => mostrarMensaje("") }, "×")
  );
  // Los errores se quedan hasta que se cierran; el resto desaparece solo.
  if (tipo !== "error") temporizadorMensaje = setTimeout(() => mostrarMensaje(""), 6000);
}

function mostrarError(err) {
  mostrarMensaje(err && err.message ? err.message : "Ha ocurrido un error inesperado.", "error");
}

const inicial = (texto) => (texto || "?").trim().charAt(0).toUpperCase() || "?";

// ---------- pantalla de acceso (sin sesión) ----------

// "formulario" da un prefijo único al id: los ids no pueden repetirse en la página.
function campo(formulario, etiqueta, atributos) {
  const id = `${formulario}-${atributos.name}`;
  return el("div", { class: "campo" }, el("label", { for: id }, etiqueta), el("input", { id, ...atributos }));
}

function logoGoogle() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("class", "g-logo");
  svg.setAttribute("aria-hidden", "true");
  const trazos = [
    ["#FFC107", "M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"],
    ["#FF3D00", "M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"],
    ["#4CAF50", "M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"],
    ["#1976D2", "M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"],
  ];
  for (const [color, d] of trazos) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("fill", color);
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

function pantallaAcceso() {
  barraUsuario.replaceChildren();
  let pestana = "entrar";

  const formLogin = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const datos = new FormData(e.target);
        try {
          await ClienteApi.iniciarSesion(datos.get("email"), datos.get("password"));
          mostrarMensaje("");
          await arrancar();
        } catch (err) {
          mostrarError(err);
        }
      },
    },
    campo("acceso", "Email", { name: "email", type: "email", required: "", autocomplete: "username", placeholder: "tu@correo.com" }),
    campo("acceso", "Contraseña", { name: "password", type: "password", required: "", autocomplete: "current-password" }),
    el("button", { type: "submit", class: "ancho" }, "Entrar en Aetheria"),
    el("p", { class: "separador" }, "o"),
    el("button", { type: "button", class: "google", onclick: () => ClienteApi.iniciarSesionGoogle() }, logoGoogle(), "Entrar con Google"),
    el(
      "p",
      { class: "pie-form" },
      "¿No te llegó el correo de confirmación? ",
      el(
        "button",
        {
          type: "button",
          class: "enlace",
          onclick: async () => {
            const email = formLogin.elements.email.value;
            if (!email) return mostrarMensaje("Escribe tu email para reenviarte el correo de confirmación.", "error");
            try {
              const r = await ClienteApi.reenviarConfirmacion(email);
              mostrarMensaje(r.mensaje, "ok");
            } catch (err) {
              mostrarError(err);
            }
          },
        },
        "Reenviar correo de confirmación"
      )
    )
  );

  const formRegistro = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = new FormData(form);
        try {
          const usuario = await ClienteApi.registrar(datos.get("email"), datos.get("password"), datos.get("nombre"));
          form.reset();
          mostrarMensaje(
            usuario.estado === "activo"
              ? "Cuenta creada. Ya puedes iniciar sesión."
              : "Cuenta creada. Te hemos enviado un correo con el enlace de confirmación (revisa también la carpeta de spam). Después podrás iniciar sesión.",
            "ok"
          );
          pestana = "entrar";
          pintarAcceso();
        } catch (err) {
          mostrarError(err);
        }
      },
    },
    campo("registro", "Nombre de invocador", { name: "nombre", type: "text", autocomplete: "nickname", placeholder: "Así te verán tus rivales" }),
    campo("registro", "Email", { name: "email", type: "email", required: "", autocomplete: "email", placeholder: "tu@correo.com" }),
    campo("registro", "Contraseña (mínimo 8 caracteres)", { name: "password", type: "password", required: "", minlength: "8", autocomplete: "new-password" }),
    el("button", { type: "submit", class: "ancho" }, "Crear mi cuenta")
  );

  const contenedor = el("div", {});
  const tarjeta = el("section", { class: "panel acceso", "aria-label": "Acceso" });

  function pintarAcceso() {
    const pestanaBoton = (id, texto) =>
      el("button", { type: "button", role: "tab", "aria-selected": pestana === id ? "true" : "false", onclick: () => ((pestana = id), pintarAcceso()) }, texto);
    contenedor.replaceChildren(pestana === "entrar" ? formLogin : formRegistro);
    tarjeta.replaceChildren(el("div", { class: "pestanas", role: "tablist" }, pestanaBoton("entrar", "Entrar"), pestanaBoton("registro", "Crear cuenta")), contenedor);
  }
  pintarAcceso();

  const hero = el(
    "div",
    { class: "hero" },
    el("span", { class: "etiqueta-seccion" }, "Duelos de criaturas elementales"),
    el("h1", {}, "Despierta el eco de tus criaturas"),
    el("p", { class: "hero-sub" }, "Forma un equipo de tres criaturas de Aetheria y enfréntate en tiempo real a otros invocadores o al Autómata. Fuego, agua, planta, rayo, tierra y viento: cada elemento vence a dos y cae ante otros dos."),
    el(
      "ul",
      { class: "hero-puntos" },
      el("li", {}, "Doce criaturas originales, cada una con su estilo de combate"),
      el("li", {}, "Turnos simultáneos: los dos eligen en secreto"),
      el("li", {}, "Ranking ELO, chat y modo espectador")
    ),
    el(
      "div",
      { class: "vitrina", "aria-hidden": "true" },
      retrato("pirolince", { elemento: "fuego", fondo: true }),
      retrato("plumazul", { elemento: "viento", fondo: true }),
      retrato("marejon", { elemento: "agua", fondo: true, espejo: true })
    )
  );

  raiz.replaceChildren(el("div", { class: "portada" }, hero, tarjeta));
}

// ---------- pantalla principal (con sesión) ----------

function dialogoCuenta(usuario) {
  const dialogo = el("dialog", { "aria-labelledby": "titulo-cuenta" });
  const cerrar = () => dialogo.close();
  dialogo.append(
    el("div", { class: "dialogo-cabecera" }, el("h2", { id: "titulo-cuenta" }, "Mi cuenta"), el("button", { type: "button", class: "fantasma pequeno", onclick: cerrar }, "Cerrar")),
    el(
      "dl",
      { class: "datos-cuenta" },
      el("dt", {}, "Nombre"),
      el("dd", {}, usuario.nombre || "(sin nombre)"),
      el("dt", {}, "Email"),
      el("dd", {}, usuario.email),
      el("dt", {}, "Rol"),
      el("dd", {}, usuario.rol === "admin" ? "Administrador" : "Jugador"),
      el("dt", {}, "Estado"),
      el("dd", {}, usuario.estado)
    ),
    el(
      "div",
      { class: "zona-peligro" },
      el("h3", { style: "margin-top:0;color:#ffa8a8" }, "Eliminar la cuenta"),
      el("p", {}, "Se borran tu cuenta y tu puesto en el ranking. No se puede deshacer."),
      el(
        "button",
        {
          type: "button",
          class: "peligro",
          onclick: async () => {
            if (!confirm("¿Seguro que quieres eliminar tu cuenta? No se puede deshacer.")) return;
            try {
              await ClienteApi.eliminarUsuario(usuario.email);
              dialogo.close();
              ClienteJuego.desconectar();
              mostrarMensaje("Tu cuenta ha sido eliminada.", "ok");
              await arrancar(false);
            } catch (err) {
              mostrarError(err);
            }
          },
        },
        "Eliminar mi cuenta"
      )
    )
  );
  return dialogo;
}

function pintarBarra(usuario, elo) {
  const nombre = usuario.nombre || usuario.email.split("@")[0];
  const dialogo = dialogoCuenta(usuario);
  barraUsuario.replaceChildren(
    el(
      "span",
      { class: "chip-jugador", title: usuario.email },
      el("span", { class: "avatar", "aria-hidden": "true" }, inicial(nombre)),
      el("span", { class: "nombre" }, nombre),
      elo !== null ? el("span", { class: "insignia-elo", title: "Tu ELO" }, `${elo} ELO`) : null
    ),
    el("button", { type: "button", class: "fantasma pequeno", onclick: () => dialogo.showModal() }, "Cuenta"),
    el(
      "button",
      {
        type: "button",
        class: "fantasma pequeno",
        onclick: async () => {
          try {
            ClienteJuego.desconectar();
            await ClienteApi.cerrarSesion();
            mostrarMensaje("Has cerrado la sesión. ¡Hasta pronto, invocador!", "ok");
            await arrancar(false);
          } catch (err) {
            mostrarError(err);
          }
        },
      },
      "Salir"
    ),
    dialogo
  );
}

async function pantallaPrincipal(usuario) {
  pintarBarra(usuario, null);
  const progreso = panelProgreso({ alError: mostrarError, alCargar: (yo) => pintarBarra(usuario, yo.elo) });
  const tablero = el("div", { class: "tablero" });
  const vestibulo = panelVestibulo(usuario, {
    alTerminarCombate: progreso.recargar,
    alCambiarModo: (enCombate) => tablero.classList.toggle("en-combate", enCombate),
  });
  const principal = el("div", { class: "columna-principal" }, vestibulo);
  if (usuario.rol === "admin") principal.append(await panelAdministrador());
  tablero.append(principal, progreso.nodo);
  raiz.replaceChildren(tablero);
}

// ---------- vestíbulo de partidas (hito 5) ----------
// Lista en directo de partidas abiertas, crear, unirse y abandonar. Los nombres de los
// jugadores se insertan con textContent (función el), nunca con innerHTML.

function panelVestibulo(usuario, { alTerminarCombate = () => {}, alCambiarModo = () => {} } = {}) {
  const estado = { lista: [], enCurso: [], partida: null, combate: null, mirando: null, conectado: false, catalogo: [], seleccion: [], filtro: null, chat: [] };
  const zona = el("div", { class: "vestibulo" });
  // Controladores de la arena (RF-28): viven mientras dura el combate o mientras se mira
  // una partida, para que redibujar el vestíbulo no corte las animaciones.
  let controlador = null;
  let espectador = null;
  const contextoSeleccion = () => ({ catalogo: estado.catalogo, seleccion: estado.seleccion, filtro: estado.filtro });
  const nombre = usuario.nombre || usuario.email.split("@")[0];

  // El catálogo de criaturas solo hace falta para elegir equipo; se pide una vez.
  ClienteApi.criaturas().then((c) => {
    estado.catalogo = c;
    dibujar();
  }, mostrarError);

  // Acciones del combate: el servidor responde con el nuevo estado por "combate:estado".
  const enCombate = async (fn) => {
    try {
      await fn();
    } catch (err) {
      mostrarError(err);
    }
  };
  const accionesCombate = {
    alternarSeleccion: (id) => {
      const i = estado.seleccion.indexOf(id);
      if (i >= 0) estado.seleccion.splice(i, 1);
      else if (estado.seleccion.length < 3) estado.seleccion.push(id);
      dibujar();
    },
    filtrar: (elemento) => {
      estado.filtro = elemento;
      dibujar();
    },
    confirmarEquipo: () => enCombate(() => ClienteJuego.elegirEquipo(estado.seleccion)),
    atacar: (movimiento) => enCombate(() => ClienteJuego.atacar(movimiento)),
    cambiar: (indice) => enCombate(() => ClienteJuego.cambiar(indice)),
    salir: () => ejecutar(() => ClienteJuego.abandonar()),
  };

  const ejecutar = async (fn) => {
    try {
      const partida = await fn();
      estado.partida = partida;
      if (!partida) {
        estado.combate = null;
        controlador = null;
        estado.seleccion = [];
        estado.chat = [];
      }
      dibujar();
    } catch (err) {
      mostrarError(err);
    }
  };

  function tarjetaPartida(p) {
    const yaEnUna = Boolean(estado.partida);
    return el(
      "li",
      { class: "sala" },
      el("span", { class: "avatar", "aria-hidden": "true" }, inicial(p.creador)),
      el("span", { class: "info" }, el("strong", {}, p.creador), el("span", {}, "Busca rival")),
      el("span", { class: "codigo chip-codigo" }, p.id),
      el("button", { type: "button", class: "pequeno", onclick: () => ejecutar(() => ClienteJuego.unirse(p.id)), disabled: yaEnUna }, "Aceptar duelo")
    );
  }

  function tarjetaEnCurso(p) {
    return el(
      "li",
      { class: "sala" },
      el("span", { class: "en-vivo" }, "En vivo"),
      el("span", { class: "info" }, el("strong", {}, p.jugadores.join(" contra ")), el("span", {}, p.espectadores ? `${p.espectadores} mirando` : "Sin público todavía")),
      el(
        "button",
        {
          type: "button",
          class: "secundario pequeno",
          onclick: async () => {
            try {
              await ClienteJuego.observar(p.id);
            } catch (err) {
              mostrarError(err);
            }
          },
        },
        "Mirar"
      )
    );
  }

  function botonCopiar(codigo) {
    return el(
      "button",
      {
        type: "button",
        class: "secundario",
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(codigo);
            mostrarMensaje("Código copiado. Compártelo con tu rival.", "ok");
          } catch {
            mostrarMensaje(`El código de tu sala es ${codigo}.`, "info");
          }
        },
      },
      "Copiar código"
    );
  }

  function salaDeEspera(p) {
    return el(
      "section",
      { class: "panel espera" },
      el("div", { class: "anillo" }, emblema()),
      el("span", { class: "etiqueta-seccion" }, "Sala creada"),
      el("h2", { style: "margin:6px 0 2px" }, "Esperando a un rival…"),
      el("p", { class: "suave" }, "Comparte este código o espera a que alguien acepte tu duelo desde el vestíbulo."),
      el("div", { class: "codigo-grande", "aria-label": `Código ${p.id.split("").join(" ")}` }, p.id),
      el(
        "div",
        { class: "botones", style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap" },
        botonCopiar(p.id),
        el("button", { type: "button", class: "peligro", onclick: () => ejecutar(() => ClienteJuego.abandonar()) }, "Cancelar sala")
      )
    );
  }

  function panelPartida(p) {
    const enCurso = estado.combate && estado.combate.fase !== "terminada";
    const rival = p.jugadores.find((n) => n !== nombre) || p.jugadores[1] || "tu rival";
    return el(
      "section",
      { class: "panel partida-actual" },
      el(
        "div",
        { class: "partida-cabecera" },
        el("div", {}, el("span", { class: "etiqueta-seccion" }, "Duelo"), el("h2", {}, p.jugadores[0], el("span", { class: "contra" }, " contra "), p.jugadores[1] || "…")),
        el("span", { class: "codigo chip-codigo", title: "Código de la sala" }, p.id),
        estado.combate && estado.combate.fase === "terminada"
          ? null
          : el(
              "div",
              { class: "acciones" },
              el(
                "button",
                {
                  type: "button",
                  class: "peligro pequeno",
                  onclick: () => {
                    if (enCurso && !confirm(`Si te rindes, ${rival} gana el combate. ¿Seguro?`)) return;
                    ejecutar(() => ClienteJuego.abandonar());
                  },
                },
                enCurso ? "Rendirse" : "Abandonar"
              )
            )
      ),
      controlador ? controlador.nodo : null,
      // Contra la máquina no hay nadie con quien hablar.
      p.jugadores.length === 2 && p.jugadores[1] !== "Autómata de Aetheria" ? panelChat : null
    );
  }

  // RF-22: chat de la partida. Los mensajes se pintan con textContent (función el).
  const listaChat = el("ol", { class: "chat-mensajes", "aria-live": "polite", "aria-label": "Mensajes del chat" });
  function dibujarChat() {
    listaChat.replaceChildren(
      ...(estado.chat.length ? estado.chat.map((m) => el("li", {}, el("strong", {}, `${m.autor}: `), m.texto)) : [el("li", { class: "tenue" }, "Aún no hay mensajes.")])
    );
    listaChat.scrollTop = listaChat.scrollHeight;
  }
  const formChat = el(
    "form",
    {
      class: "chat-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const campoTexto = e.target.elements.texto;
        if (!campoTexto.value.trim()) return;
        try {
          await ClienteJuego.enviarMensaje(campoTexto.value);
          campoTexto.value = "";
        } catch (err) {
          mostrarError(err);
        }
      },
    },
    el("label", { for: "chat-texto", class: "solo-lectores" }, "Mensaje"),
    el("input", { id: "chat-texto", name: "texto", maxlength: "200", autocomplete: "off", placeholder: "Escribe a tu rival…" }),
    el("button", { type: "submit", class: "secundario" }, "Enviar")
  );
  const panelChat = el("div", { class: "chat" }, el("h3", {}, "Chat del duelo"), listaChat, formChat);
  dibujarChat();

  const dejarDeMirar = async () => {
    try {
      await ClienteJuego.dejarDeObservar();
    } catch (err) {
      mostrarError(err);
    }
    estado.mirando = null;
    espectador = null;
    estado.chat = [];
    dibujarChat();
    dibujar();
  };

  function formUnirse() {
    return el(
      "form",
      {
        onsubmit: (e) => {
          e.preventDefault();
          const id = new FormData(e.target).get("codigo");
          ejecutar(() => ClienteJuego.unirse(id));
        },
      },
      el("label", { for: "codigo-partida", class: "solo-lectores" }, "Código de la sala"),
      el("input", { id: "codigo-partida", name: "codigo", required: "", maxlength: "8", autocomplete: "off", placeholder: "CÓDIGO" }),
      el("button", { type: "submit", class: "secundario pequeno" }, "Entrar")
    );
  }

  function iconoModo(texto) {
    return el("span", { class: "modo-icono", "aria-hidden": "true" }, texto);
  }

  function vestibuloLibre() {
    const conexion = !estado.conectado
      ? el("span", { class: `estado-conexion ${estado.desconectado ? "caida" : "conectando"}` }, estado.desconectado ? "Reconectando…" : "Conectando…")
      : el("span", { class: "estado-conexion" }, "Conectado");
    const libres = estado.lista.filter((p) => !estado.partida || p.id !== estado.partida.id);
    return [
      el(
        "div",
        { class: "bienvenida panel-titulo" },
        el("div", {}, el("span", { class: "etiqueta-seccion" }, "Vestíbulo"), el("h2", {}, `¿Listo para el duelo, ${nombre}?`)),
        conexion
      ),
      el(
        "div",
        { class: "modos" },
        el(
          "div",
          { class: "modo" },
          iconoModo("⚔"),
          el("h3", {}, "Crear sala"),
          el("p", {}, "Abre un duelo y espera a que otro invocador lo acepte. Cuenta para el ranking."),
          el("button", { type: "button", onclick: () => ejecutar(() => ClienteJuego.crearPartida()) }, "Crear sala")
        ),
        el(
          "div",
          { class: "modo maquina" },
          el("span", { class: "modo-icono", "aria-hidden": "true" }, emblema()),
          el("h3", {}, "Desafiar al Autómata"),
          el("p", {}, "Practica contra la máquina de Aetheria. No cambia tu ELO."),
          el("button", { type: "button", class: "eter", onclick: () => ejecutar(() => ClienteJuego.crearContraMaquina()) }, "Desafiar")
        ),
        el("div", { class: "modo amigo" }, iconoModo("✉"), el("h3", {}, "Unirse con código"), el("p", {}, "¿Un amigo te ha pasado el código de su sala?"), formUnirse())
      ),
      el(
        "section",
        { class: "panel", style: "margin-top:20px" },
        el("div", { class: "panel-titulo" }, el("h2", {}, "Salas abiertas"), el("span", { class: "suave" }, `${libres.length} esperando`)),
        libres.length ? el("ul", { class: "lista-salas" }, ...libres.map(tarjetaPartida)) : el("p", { class: "vacio" }, "No hay salas abiertas ahora mismo. ¡Crea una y que vengan a por ti!")
      ),
      estado.enCurso.length
        ? el("section", { class: "panel", style: "margin-top:20px" }, el("div", { class: "panel-titulo" }, el("h2", {}, "Combates en directo")), el("ul", { class: "lista-salas" }, ...estado.enCurso.map(tarjetaEnCurso)))
        : null,
    ];
  }

  function dibujar() {
    // Redibujar mueve el campo del chat: si se estaba escribiendo, se le devuelve el foco.
    const escribiendo = document.activeElement === formChat.elements.texto;
    pintar();
    if (escribiendo) formChat.elements.texto.focus();
  }

  function pintar() {
    if (controlador) controlador.refrescar();
    const enDuelo = Boolean((estado.partida && estado.combate) || (estado.mirando && !estado.partida));
    alCambiarModo(enDuelo);
    // RF-23: mirando una partida ajena (solo lectura del combate y del chat).
    if (estado.mirando && !estado.partida) {
      if (!espectador) {
        espectador = crearControladorEspectador({ salir: dejarDeMirar });
        espectador.actualizar(estado.mirando);
      }
      zona.replaceChildren(el("section", { class: "panel" }, espectador.nodo, el("div", { class: "chat", style: "margin-top:16px" }, el("h3", {}, "Chat del duelo"), listaChat)));
      return;
    }
    if (estado.partida && estado.combate) return zona.replaceChildren(panelPartida(estado.partida));
    if (estado.partida) return zona.replaceChildren(salaDeEspera(estado.partida));
    zona.replaceChildren(...vestibuloLibre().filter(Boolean));
  }

  ClienteJuego.conectar({
    alCambiarLista: (lista) => {
      estado.lista = lista;
      estado.conectado = true;
      dibujar();
    },
    alCambiarPartida: (p) => {
      // null: al reconectarse, el servidor dice que ya no estás en ninguna partida (RF-24).
      if (!p && estado.partida && estado.combate && estado.combate.fase !== "terminada") {
        mostrarMensaje("Has tardado demasiado en volver y has salido de la partida.", "error");
      }
      estado.partida = p;
      if (!p) {
        estado.combate = null;
        controlador = null;
        estado.seleccion = [];
        estado.filtro = null;
        if (!estado.mirando) estado.chat = [];
        dibujarChat();
      }
      dibujar();
    },
    alCambiarCombate: (v) => {
      // Al terminar, el servidor guarda el resultado y actualiza el ELO: se recarga el progreso.
      if (v.fase === "terminada" && (!estado.combate || estado.combate.fase !== "terminada")) setTimeout(alTerminarCombate, 800);
      estado.combate = v;
      if (v.fase !== "seleccion") estado.seleccion = [];
      if (!controlador) controlador = crearControladorCombate({ acciones: accionesCombate, contexto: contextoSeleccion });
      controlador.actualizar(v);
      dibujar();
    },
    alCambiarEnCurso: (lista) => {
      estado.enCurso = lista;
      dibujar();
    },
    alCambiarEspectador: (v) => {
      estado.mirando = v;
      if (!v) espectador = null;
      else if (espectador) espectador.actualizar(v);
      dibujar();
    },
    alConectar: () => {
      if (estado.desconectado) mostrarMensaje("Conexión recuperada.", "ok");
      estado.desconectado = false;
    },
    alTerminarEspectador: () => {
      mostrarMensaje("La partida que mirabas ha terminado y los jugadores se han ido.", "info");
      estado.mirando = null;
      espectador = null;
      estado.chat = [];
      dibujarChat();
      dibujar();
    },
    alRecibirMensaje: (m) => {
      estado.chat = [...estado.chat, m].slice(-50);
      dibujarChat();
    },
    alRecibirHistorialChat: (lista) => {
      estado.chat = lista;
      dibujarChat();
    },
    alAbandonarRival: () => mostrarMensaje("Tu rival ha abandonado la partida.", "info"),
    alDesconectar: () => {
      // Socket.IO se vuelve a conectar solo; al volver, el servidor reenvía partida, combate y
      // chat (RF-24). Hay 30 segundos de margen antes de perder la partida.
      if (estado.partida && !estado.desconectado) mostrarMensaje("Se ha perdido la conexión. Reconectando… tienes 30 segundos para volver.", "error");
      estado.desconectado = true;
      estado.conectado = false;
      dibujar();
    },
  });
  dibujar();
  return zona;
}

// ---------- administración ----------

async function panelAdministrador() {
  const usuarios = await ClienteApi.listarUsuarios();

  const filas = usuarios.map((u) =>
    el(
      "tr",
      {},
      el("td", {}, u.email),
      el("td", {}, u.nombre || "—"),
      el("td", {}, u.rol),
      el("td", {}, u.estado),
      el(
        "td",
        { class: "acciones" },
        el(
          "button",
          {
            type: "button",
            class: "secundario pequeno",
            onclick: async () => {
              try {
                const activo = await ClienteApi.usuarioActivo(u.email);
                mostrarMensaje(`${u.email}: ${activo ? "activo" : "no activo"}`, "info");
              } catch (err) {
                mostrarError(err);
              }
            },
          },
          "¿Activo?"
        ),
        el(
          "button",
          {
            type: "button",
            class: "peligro pequeno",
            onclick: async () => {
              if (!confirm(`¿Eliminar a ${u.email}?`)) return;
              try {
                await ClienteApi.eliminarUsuario(u.email);
                mostrarMensaje(`${u.email} eliminado.`, "ok");
                await arrancar(false);
              } catch (err) {
                mostrarError(err);
              }
            },
          },
          "Eliminar"
        )
      )
    )
  );

  return el(
    "section",
    { class: "panel admin" },
    el("div", { class: "panel-titulo" }, el("div", {}, el("span", { class: "etiqueta-seccion" }, "Administración"), el("h2", {}, "Usuarios")), el("span", { class: "suave" }, `${usuarios.length} cuentas`)),
    el(
      "div",
      { class: "tabla-contenedor" },
      el(
        "table",
        {},
        el("thead", {}, el("tr", {}, ...["Email", "Nombre", "Rol", "Estado", "Acciones"].map((t) => el("th", {}, t)))),
        el("tbody", {}, ...filas)
      )
    )
  );
}

// ---------- arranque ----------

// Al cargar la página (y tras cada cambio de sesión) se pregunta al servidor si hay
// sesión: así, recargar no obliga a volver a iniciar sesión.
// Mensajes cuando el servidor redirige a la página con un resultado:
//  /?confirmada=ok|error (enlace de confirmación) y /?oauth=... (vuelta de Google).
const MENSAJES_OAUTH = {
  "cuenta-local": "Ya existe una cuenta con ese email. Inicia sesión con tu contraseña.",
  "no-disponible": "El inicio de sesión con Google no está disponible en este momento.",
  error: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
};

function mensajeDeConfirmacion() {
  const params = new URLSearchParams(window.location.search);
  const confirmada = params.get("confirmada");
  const oauth = params.get("oauth");
  if (!confirmada && !oauth) return;
  if (confirmada === "ok") mostrarMensaje("Cuenta confirmada. Ya puedes iniciar sesión.", "ok");
  else if (confirmada) mostrarMensaje("El enlace de confirmación no es válido, ha caducado o ya se usó.", "error");
  else mostrarMensaje(MENSAJES_OAUTH[oauth] || MENSAJES_OAUTH.error, "error");
  window.history.replaceState({}, "", window.location.pathname);
}

async function arrancar(limpiarMensaje = true) {
  if (limpiarMensaje) mostrarMensaje("");
  try {
    const usuario = await ClienteApi.sesionActual();
    if (usuario) await pantallaPrincipal(usuario);
    else pantallaAcceso();
  } catch (err) {
    pantallaAcceso();
    mostrarError(err);
  }
}

mensajeDeConfirmacion();
arrancar(false);
