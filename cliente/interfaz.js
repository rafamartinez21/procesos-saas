// INTERFAZ (capa de presentación del frontend)
// Dibuja pantallas y reacciona a clics. No hace peticiones por sí misma: para hablar
// con el servidor usa ClienteApi. No decide permisos: ocultar un botón es solo comodidad,
// quien rechaza de verdad las acciones no permitidas es el servidor.
//
// Los datos de los usuarios (nombre, email) se insertan siempre con textContent, nunca
// con innerHTML, para que un nombre malicioso no pueda inyectar código en la página.

import { ClienteApi } from "./cliente-api.js";

const raiz = document.getElementById("app");
const zonaMensaje = document.getElementById("mensaje");

// ---------- utilidades de dibujo ----------

function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (clave === "onclick" || clave === "onsubmit") nodo[clave] = valor;
    else nodo.setAttribute(clave, valor);
  }
  for (const hijo of hijos) nodo.append(hijo);
  return nodo;
}

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
  raiz.replaceChildren(cabecera, contenido);
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
// Si se llega desde el enlace de confirmación, el servidor redirige a /?confirmada=ok|error.
function mensajeDeConfirmacion() {
  const resultado = new URLSearchParams(window.location.search).get("confirmada");
  if (!resultado) return;
  if (resultado === "ok") mostrarMensaje("Cuenta confirmada. Ya puedes iniciar sesión.", "ok");
  else mostrarMensaje("El enlace de confirmación no es válido, ha caducado o ya se usó.", "error");
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
