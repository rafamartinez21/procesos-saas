// INTERFAZ (capa de presentación del frontend)
// Dibuja pantallas y reacciona a clics. No hace peticiones por sí misma: para hablar
// con el servidor usa ClienteApi. No decide permisos: ocultar un botón es solo comodidad,
// quien rechaza de verdad las acciones no permitidas es el servidor.
//
// Los datos de los usuarios (nombre, email) se insertan siempre con textContent, nunca
// con innerHTML, para que un nombre malicioso no pueda inyectar código en la página.

import { ClienteApi } from "./cliente-api.js";
import { ClienteJuego } from "./cliente-juego.js";
import { el } from "./dom.js";
import { dibujarCombate } from "./combate-vista.js";
import { panelProgreso } from "./progreso-vista.js";

const raiz = document.getElementById("app");
const zonaMensaje = document.getElementById("mensaje");

// ---------- utilidades de dibujo ----------

function mostrarMensaje(texto, tipo = "info") {
  zonaMensaje.textContent = texto;
  zonaMensaje.className = `mensaje ${tipo}`;
  zonaMensaje.hidden = !texto;
}

function mostrarError(err) {
  mostrarMensaje(err && err.message ? err.message : "Ha ocurrido un error inesperado.", "error");
}

// ---------- pantalla de acceso (sin sesión) ----------

// "formulario" da un prefijo único al id: los ids no pueden repetirse en la página.
function campo(formulario, etiqueta, atributos) {
  const id = `${formulario}-${atributos.name}`;
  return el("div", { class: "campo" }, el("label", { for: id }, etiqueta), el("input", { id, ...atributos }));
}

function pantallaAcceso() {
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
    el("h2", {}, "Iniciar sesión"),
    campo("acceso", "Email", { name: "email", type: "email", required: "", autocomplete: "username" }),
    campo("acceso", "Contraseña", { name: "password", type: "password", required: "", autocomplete: "current-password" }),
    el("button", { type: "submit" }, "Entrar"),
    el(
      "button",
      {
        type: "button",
        class: "secundario",
        onclick: async (e) => {
          const email = e.target.form.elements.email.value;
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
    ),
    el("p", { class: "separador" }, "o"),
    el("button", { type: "button", class: "google", onclick: () => ClienteApi.iniciarSesionGoogle() }, "Entrar con Google")
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
        } catch (err) {
          mostrarError(err);
        }
      },
    },
    el("h2", {}, "Crear cuenta"),
    campo("registro", "Nombre", { name: "nombre", type: "text", autocomplete: "name" }),
    campo("registro", "Email", { name: "email", type: "email", required: "", autocomplete: "email" }),
    campo("registro", "Contraseña (mínimo 8 caracteres)", { name: "password", type: "password", required: "", minlength: "8", autocomplete: "new-password" }),
    el("button", { type: "submit" }, "Registrarme")
  );

  raiz.replaceChildren(el("div", { class: "columnas" }, formLogin, formRegistro));
}

// ---------- pantalla principal (con sesión) ----------

async function pantallaPrincipal(usuario) {
  const cabecera = el(
    "div",
    { class: "cabecera" },
    el("p", {}, `Sesión iniciada como ${usuario.email} (${usuario.rol})`),
    el(
      "button",
      {
        type: "button",
        onclick: async () => {
          try {
            ClienteJuego.desconectar();
            await ClienteApi.cerrarSesion();
            mostrarMensaje("Has cerrado la sesión.", "ok");
            await arrancar(false);
          } catch (err) {
            mostrarError(err);
          }
        },
      },
      "Cerrar sesión"
    )
  );

  const contenido = usuario.rol === "admin" ? await panelAdministrador(usuario) : panelUsuario(usuario);
  const progreso = panelProgreso({ alError: mostrarError });
  raiz.replaceChildren(cabecera, panelVestibulo({ alTerminarCombate: progreso.recargar }), progreso.nodo, contenido);
}

// ---------- vestíbulo de partidas (hito 5) ----------
// Lista en directo de partidas abiertas, crear, unirse y abandonar. Los nombres de los
// jugadores se insertan con textContent (función el), nunca con innerHTML.

function panelVestibulo({ alTerminarCombate = () => {} } = {}) {
  const estado = { lista: [], partida: null, combate: null, conectado: false, catalogo: [], seleccion: [] };
  const zona = el("section", { class: "vestibulo" });

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
        estado.seleccion = [];
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
      { class: "partida" },
      el("span", { class: "codigo" }, p.id),
      el("span", {}, `Creada por ${p.creador}`),
      el(
        "button",
        { type: "button", onclick: () => ejecutar(() => ClienteJuego.unirse(p.id)), ...(yaEnUna ? { disabled: "" } : {}) },
        "Unirse"
      )
    );
  }

  function panelPartida(p) {
    const rival = p.jugadores.length < 2 ? "Esperando rival…" : `${p.jugadores.join(" contra ")}`;
    const enCurso = estado.combate && estado.combate.fase !== "terminada";
    return el(
      "div",
      { class: "partida-actual" },
      el(
        "div",
        { class: "partida-cabecera" },
        el("h3", {}, "Partida ", el("span", { class: "codigo" }, p.id)),
        el("span", { class: "suave" }, rival),
        estado.combate && estado.combate.fase === "terminada"
          ? null
          : el(
              "button",
              {
                type: "button",
                class: "peligro",
                onclick: () => {
                  if (enCurso && !confirm("Si abandonas, pierdes el combate. ¿Seguro?")) return;
                  ejecutar(() => ClienteJuego.abandonar());
                },
              },
              enCurso ? "Rendirse" : "Abandonar partida"
            )
      ),
      p.jugadores.length < 2 ? el("p", {}, "Comparte el código ", el("strong", { class: "codigo" }, p.id), " con tu rival o espera a que alguien se una.") : null,
      estado.combate ? dibujarCombate(estado.combate, { catalogo: estado.catalogo, seleccion: estado.seleccion, acciones: accionesCombate }) : null
    );
  }

  function formUnirse() {
    return el(
      "form",
      {
        class: "en-linea",
        onsubmit: (e) => {
          e.preventDefault();
          const id = new FormData(e.target).get("codigo");
          ejecutar(() => ClienteJuego.unirse(id));
        },
      },
      el("label", { for: "codigo-partida" }, "Código"),
      el("input", { id: "codigo-partida", name: "codigo", required: "", maxlength: "8", autocomplete: "off" }),
      el("button", { type: "submit", class: "secundario" }, "Unirse con código")
    );
  }

  function dibujar() {
    const hijos = [el("h2", {}, "Ecos de Aetheria: partidas")];
    if (!estado.conectado) hijos.push(el("p", { class: "suave" }, "Conectando con el servidor de partidas…"));
    if (estado.partida) {
      hijos.push(panelPartida(estado.partida));
    } else {
      hijos.push(
        el(
          "div",
          { class: "botones-vestibulo" },
          el("button", { type: "button", onclick: () => ejecutar(() => ClienteJuego.crearPartida()) }, "Crear partida"),
          el("button", { type: "button", class: "secundario", onclick: () => ejecutar(() => ClienteJuego.crearContraMaquina()) }, "Jugar contra la máquina")
        ),
        formUnirse()
      );
    }
    if (estado.partida && estado.combate) {
      zona.replaceChildren(...hijos);
      return; // durante el combate no se muestra la lista de partidas
    }
    hijos.push(el("h3", {}, "Partidas abiertas"));
    const ajenas = estado.lista.filter((p) => !estado.partida || p.id !== estado.partida.id);
    hijos.push(ajenas.length ? el("ul", { class: "lista-partidas" }, ...ajenas.map(tarjetaPartida)) : el("p", { class: "suave" }, "No hay partidas abiertas. ¡Crea una!"));
    zona.replaceChildren(...hijos);
  }

  ClienteJuego.conectar({
    alCambiarLista: (lista) => {
      estado.lista = lista;
      estado.conectado = true;
      dibujar();
    },
    alCambiarPartida: (p) => {
      estado.partida = p;
      dibujar();
    },
    alCambiarCombate: (v) => {
      // Al terminar, el servidor guarda el resultado y actualiza el ELO: se recarga el progreso.
      if (v.fase === "terminada" && (!estado.combate || estado.combate.fase !== "terminada")) setTimeout(alTerminarCombate, 800);
      estado.combate = v;
      if (v.fase !== "seleccion") estado.seleccion = [];
      dibujar();
    },
    alAbandonarRival: () => mostrarMensaje("Tu rival ha abandonado la partida.", "info"),
    alDesconectar: () => {
      // Socket.IO se vuelve a conectar solo; al volver, el servidor reenvía partida y combate.
      estado.conectado = false;
      dibujar();
    },
  });
  dibujar();
  return zona;
}

function panelUsuario(usuario) {
  return el(
    "section",
    {},
    el("h2", {}, "Mi cuenta"),
    el("p", {}, `Nombre: ${usuario.nombre || "(sin nombre)"}. Estado: ${usuario.estado}.`),
    el(
      "button",
      {
        type: "button",
        class: "peligro",
        onclick: async () => {
          if (!confirm("¿Seguro que quieres eliminar tu cuenta? No se puede deshacer.")) return;
          try {
            await ClienteApi.eliminarUsuario(usuario.email);
            mostrarMensaje("Tu cuenta ha sido eliminada.", "ok");
            await arrancar(false);
          } catch (err) {
            mostrarError(err);
          }
        },
      },
      "Eliminar mi cuenta"
    )
  );
}

async function panelAdministrador(admin) {
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
            class: "peligro",
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
    {},
    el("h2", {}, "Usuarios"),
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
