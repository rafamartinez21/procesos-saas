// CAPA DE ACCESO A DATOS (implementación EN MEMORIA, hitos 1 y 2)
// Los datos se pierden al reiniciar el servidor. En el hito 3 se crea otro CAD
// con la MISMA interfaz (mismos métodos) contra una base de datos real.
//
// Interfaz que debe cumplir cualquier CAD:
//   insertarUsuario(usuario)            -> usuario. Lanza un error con codigo "DUPLICADO"
//                                          si ya existe ese email (como haría un índice único).
//   buscarUsuario(email)                -> usuario | undefined
//   listarUsuarios()                    -> [usuario]
//   actualizarUsuario(email, cambios)   -> usuario | undefined
//   eliminarUsuario(email)              -> true si existía, false si no
//   buscarUsuarioPorToken(hash)         -> usuario | undefined (por tokenConfirmacion)
// Juego (hito 7):
//   insertarPartida(partida)            -> partida terminada { id, emails: [a, b], fecha, ... }
//   listarPartidasDe(email, limite)     -> [partida] en las que jugó, de la más reciente a la más antigua
//   buscarJugador(email)                -> { email, nombre, elo, ganadas, perdidas, empates } | undefined
//   guardarJugador(jugador)             -> jugador (lo crea o lo sustituye)
//   listarRanking(limite)               -> [jugador] por elo de mayor a menor (empate: más ganadas)
//   eliminarJugador(email)              -> true si existía, false si no
// Todos son async para que cambiar a una base de datos no obligue a tocar la lógica.

function CadMemoria() {
  this.usuarios = new Map(); // clave: email
  this.partidas = []; // partidas terminadas
  this.jugadores = new Map(); // clave: email

  // Se guardan y devuelven copias para que la lógica no pueda modificar el almacén
  // sin pasar por estos métodos (igual que pasaría con una base de datos).
  this.insertarUsuario = async function (usuario) {
    if (this.usuarios.has(usuario.email)) {
      throw Object.assign(new Error("Ya existe un usuario con ese email"), { codigo: "DUPLICADO" });
    }
    this.usuarios.set(usuario.email, { ...usuario });
    return { ...usuario };
  };

  this.buscarUsuario = async function (email) {
    const u = this.usuarios.get(email);
    return u ? { ...u } : undefined;
  };

  this.listarUsuarios = async function () {
    return [...this.usuarios.values()].map((u) => ({ ...u }));
  };

  this.actualizarUsuario = async function (email, cambios) {
    const u = this.usuarios.get(email);
    if (!u) return undefined;
    const actualizado = { ...u, ...cambios, email: u.email };
    this.usuarios.set(email, actualizado);
    return { ...actualizado };
  };

  this.eliminarUsuario = async function (email) {
    return this.usuarios.delete(email);
  };

  this.buscarUsuarioPorToken = async function (hash) {
    for (const u of this.usuarios.values()) {
      if (u.tokenConfirmacion && u.tokenConfirmacion === hash) return { ...u };
    }
    return undefined;
  };
}

// Orden del ranking: más elo primero; a igual elo, más victorias; después, por email
// para que el orden sea estable.
function ordenRanking(a, b) {
  return b.elo - a.elo || b.ganadas - a.ganadas || (a.email < b.email ? -1 : 1);
}

CadMemoria.prototype.insertarPartida = async function (partida) {
  this.partidas.push(structuredClone(partida));
  return structuredClone(partida);
};

CadMemoria.prototype.listarPartidasDe = async function (email, limite = 20) {
  return this.partidas
    .filter((p) => p.emails.includes(email))
    .sort((a, b) => b.fecha - a.fecha)
    .slice(0, limite)
    .map((p) => structuredClone(p));
};

CadMemoria.prototype.buscarJugador = async function (email) {
  const j = this.jugadores.get(email);
  return j ? { ...j } : undefined;
};

CadMemoria.prototype.guardarJugador = async function (jugador) {
  this.jugadores.set(jugador.email, { ...jugador });
  return { ...jugador };
};

CadMemoria.prototype.listarRanking = async function (limite = 20) {
  return [...this.jugadores.values()].sort(ordenRanking).slice(0, limite).map((j) => ({ ...j }));
};

CadMemoria.prototype.eliminarJugador = async function (email) {
  return this.jugadores.delete(email);
};

module.exports = { CadMemoria };
