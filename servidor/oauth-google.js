// SERVICIO EXTERNO: inicio de sesión con Google (OAuth 2.0 / OpenID Connect), D-17.
// Flujo de código de autorización:
//  1. urlAutorizacion(): a dónde se redirige el navegador para que el usuario acepte en Google.
//  2. Google vuelve a nuestra URL de retorno con un "code".
//  3. obtenerPerfil(): cambia ese code por un token (con el secreto, desde el servidor) y
//     pide a Google el email y el nombre del usuario.
// No forma parte de la lógica: index.js lo crea con las credenciales (variables de entorno)
// y la API lo usa. En las pruebas se pasa un "fetch" falso: nunca se llama a Google.

const URL_AUTORIZACION = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_PERFIL = "https://openidconnect.googleapis.com/v1/userinfo";

function crearOAuthGoogle({ clientId, clientSecret, fetch = globalThis.fetch } = {}) {
  if (!clientId || !clientSecret) {
    throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET");
  }

  return {
    // "state" es un valor aleatorio que se guarda en una cookie y Google devuelve tal cual:
    // así se comprueba que la vuelta corresponde a un inicio de sesión que empezó aquí (CSRF).
    urlAutorizacion({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      });
      return `${URL_AUTORIZACION}?${params}`;
    },

    async obtenerPerfil({ code, redirectUri }) {
      const resToken = await fetch(URL_TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!resToken.ok) {
        throw Object.assign(new Error(`Google rechazó el código (${resToken.status})`), { estado: resToken.status });
      }
      const { access_token: accessToken } = await resToken.json();

      const resPerfil = await fetch(URL_PERFIL, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!resPerfil.ok) {
        throw Object.assign(new Error(`Google no devolvió el perfil (${resPerfil.status})`), { estado: resPerfil.status });
      }
      const perfil = await resPerfil.json();
      return {
        email: perfil.email,
        nombre: perfil.name || "",
        emailVerificado: perfil.email_verified === true,
      };
    },
  };
}

module.exports = { crearOAuthGoogle, URL_AUTORIZACION, URL_TOKEN, URL_PERFIL };
