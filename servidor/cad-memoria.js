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
// Todos son async para que cambiar a una base de datos no obligue a tocar la lógica.

function CadMemoria() {
  this.usuarios = new Map(); // clave: email

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

module.exports = { CadMemoria };
