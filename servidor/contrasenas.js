// HASH DE CONTRASEÑAS
// Usa scrypt, que viene incluido en Node (módulo "crypto"): es una función de hash
// pensada para contraseñas (lenta y con "sal" aleatoria a propósito), no un cifrado
// reversible. Nunca se guarda la contraseña, solo este resumen.
//
// Formato guardado: "scrypt$<sal en hex>$<hash en hex>". Guardar la sal junto al hash
// permite verificar más tarde, y cada usuario tiene una sal distinta: dos usuarios con
// la misma contraseña acaban con hashes distintos.

const crypto = require("node:crypto");

const LONGITUD_CLAVE = 64;
const LONGITUD_SAL = 16;

function derivar(contrasena, sal) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(contrasena, sal, LONGITUD_CLAVE, (err, clave) => {
      if (err) reject(err);
      else resolve(clave);
    });
  });
}

async function hashContrasena(contrasena) {
  const sal = crypto.randomBytes(LONGITUD_SAL);
  const clave = await derivar(contrasena, sal);
  return `scrypt$${sal.toString("hex")}$${clave.toString("hex")}`;
}

async function verificarContrasena(contrasena, guardado) {
  if (typeof contrasena !== "string" || typeof guardado !== "string") return false;
  const partes = guardado.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const sal = Buffer.from(partes[1], "hex");
  const esperado = Buffer.from(partes[2], "hex");
  const obtenido = await derivar(contrasena, sal);
  // timingSafeEqual compara en tiempo constante (evita filtrar información por el tiempo de respuesta)
  return esperado.length === obtenido.length && crypto.timingSafeEqual(esperado, obtenido);
}

module.exports = { hashContrasena, verificarContrasena };
