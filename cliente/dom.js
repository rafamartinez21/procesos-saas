// Utilidad de dibujo compartida por la capa de presentación.
// Crea un elemento con atributos e hijos. Los textos se añaden como nodos de texto
// (append de un string), nunca como HTML: un nombre malicioso no puede inyectar código.

export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (clave === "onclick" || clave === "onsubmit") nodo[clave] = valor;
    else if (valor !== false && valor !== undefined && valor !== null) nodo.setAttribute(clave, valor === true ? "" : valor);
  }
  for (const hijo of hijos) {
    if (hijo !== null && hijo !== undefined && hijo !== false) nodo.append(hijo);
  }
  return nodo;
}
