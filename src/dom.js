/* Creación de nodos sin plantillas de texto: todo el contenido entra como
   texto o como nodo, nunca como HTML, así que lo que escriba el usuario no
   puede inyectar marcado. */

const PROPIEDADES = new Set(["value", "checked", "disabled", "required"]);

export function el(tag, props, ...hijos) {
  const n = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (PROPIEDADES.has(k)) n[k] = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) continue;
    n.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }
  return n;
}

export const $ = (selector) => document.querySelector(selector);
