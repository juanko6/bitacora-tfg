/* Funciones puras: fechas, estados y exportación. No tocan el DOM ni el
   almacén, así que se prueban sin navegador (tests/derive.test.js). */

import { SCHEMAS, optLabel } from "./schemas.js";

export const str = (v) => (typeof v === "string" ? v.trim() : "");

export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

const formato = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const formatoCorto = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

export const fmtDate = (s) => {
  const d = parseISO(s);
  return d ? formato.format(d) : "";
};
export const fmtDateShort = (s) => {
  const d = parseISO(s);
  return d ? formatoCorto.format(d) : "";
};

export function hoy(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const hoyISO = (now = new Date()) =>
  [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

export const diasEntre = (a, b) => Math.round((b - a) / 864e5);

export const dateLabel = (it) =>
  [fmtDate(it.fecha), str(it.fechaNota)].filter(Boolean).join(" · ") ||
  "Sin fecha";

/* El número de una entrada numerada: su campo `num` o, si falta, los dígitos
   de su identificador («D-07» → 7). */
export function numOf(it) {
  if (typeof it.num === "number") return it.num;
  return parseInt(String(it.id).replace(/\D+/g, ""), 10) || 0;
}

export function nextNumbered(items, prefix) {
  const num = items.reduce((m, it) => Math.max(m, numOf(it)), 0) + 1;
  return { num, id: prefix + String(num).padStart(2, "0") };
}

/* Estado de un plazo respecto a hoy.
   k: past | now | soon (empieza en 30 días o menos) | future
   key: la fecha que ordena los plazos vivos (cuándo empieza o cuándo vence);
        null en los cerrados. */
export function estadoFecha(f, now = new Date()) {
  const t = hoy(now);
  const i = parseISO(f.inicio);
  const e = parseISO(f.fin);
  if (e && t > e) return { k: "past", txt: "Cerrado", key: null };
  if (i && t < i) {
    const n = diasEntre(t, i);
    return {
      k: n <= 30 ? "soon" : "future",
      txt: n === 1 ? "Empieza mañana" : `Empieza en ${n} días`,
      key: i,
    };
  }
  if (e) {
    const n = diasEntre(t, e);
    return {
      k: "now",
      txt: n === 0 ? "Termina hoy" : `En curso, quedan ${n} días`,
      key: e,
    };
  }
  if (i) {
    return diasEntre(i, t) === 0
      ? { k: "now", txt: "Es hoy", key: i }
      : { k: "past", txt: "Pasado", key: null };
  }
  return { k: "future", txt: "Sin fecha", key: null };
}

/* Aviso de vencimiento de una tarea. null si no tiene fecha límite. */
export function vencimiento(limite, now = new Date()) {
  const d = parseISO(limite);
  if (!d) return null;
  const n = diasEntre(hoy(now), d);
  if (n < 0) return { txt: `Venció el ${fmtDateShort(limite)}`, clase: "crit" };
  if (n === 0) return { txt: "Vence hoy", clase: "warn" };
  if (n <= 7) {
    return { txt: `Vence en ${n} día${n === 1 ? "" : "s"}`, clase: "warn" };
  }
  return { txt: `Vence el ${fmtDateShort(limite)}`, clase: "" };
}

export const rangeLabel = (f) =>
  f.fin && f.fin !== f.inicio
    ? `${fmtDate(f.inicio)} → ${fmtDate(f.fin)}`
    : fmtDate(f.inicio) || "Sin fecha";

export const matches = (it, q) =>
  !q ||
  Object.values(it).some(
    (v) => typeof v === "string" && v.toLowerCase().includes(q)
  );

/* Lo que queda por completar en cada tipo de entrada. */
export const iaSinRevisar = (it) => !it.revisado;
export const decSinMotivo = (it) => !str(it.motivo);
export const decSinComunicar = (it) => (it.comunicada || "no") === "no";
export const tareaAbierta = (it) => (it.estado || "pendiente") !== "hecho";
export const reunionPendiente = (it) =>
  (it.estado || "pendiente") === "pendiente" && !!str(it.acciones);
export const estadoPaper = (it) => it.estado || "por-leer";
export const paperPorLeer = (it) => estadoPaper(it) === "por-leer";
/* Un paper sin su porqué es una lectura sin justificar. A los descartados no
   se les pide: ya se decidió no dedicarles tiempo. */
export const paperSinInteres = (it) =>
  !str(it.interes) && estadoPaper(it) !== "descartado";

const ORDEN_LECTURA = ["leyendo", "por-leer", "leido", "descartado"];
const ORDEN_RELEVANCIA = ["alta", "media", "baja"];
const posicion = (lista, v) => {
  const i = lista.indexOf(v);
  return i < 0 ? lista.length : i;
};
/* Primero lo que se está leyendo, luego lo pendiente, y dentro de cada grupo
   lo más relevante. */
export const ordenPapers = (a, b) =>
  posicion(ORDEN_LECTURA, estadoPaper(a)) -
    posicion(ORDEN_LECTURA, estadoPaper(b)) ||
  posicion(ORDEN_RELEVANCIA, a.relevancia) -
    posicion(ORDEN_RELEVANCIA, b.relevancia) ||
  str(a.titulo).localeCompare(str(b.titulo), "es");

/* Markdown de una colección, con el mismo aspecto que una bitácora escrita a
   mano: un título por entrada y una línea por campo. */
export function toMarkdown(key, items, titulo) {
  const S = SCHEMAS[key];
  const campos = S.fields.filter(
    (f) => f.k !== "titulo" && f.k !== "tramite" && f.k !== "fechaNota"
  );
  const bloques = items.map((it) => {
    const cabecera = S.prefix
      ? `### ${it.id} · ${str(it.titulo)}`
      : `### ${str(it.titulo) || str(it.tramite)}`;
    const lineas = campos.map((f) => {
      let v;
      if (f.t === "check") v = it[f.k] ? "sí" : "no";
      else if (f.t === "select") v = optLabel(f.opts, it[f.k]);
      else if (f.k === "fecha") v = dateLabel(it);
      else if (f.t === "date") v = fmtDate(it[f.k]);
      else v = str(it[f.k]);
      if (!v) v = f.opt ? "—" : "_por completar._";
      return `- **${f.l}:** ${v}`;
    });
    return [cabecera, ...lineas].join("\n");
  });
  return `# ${titulo}\n\n${bloques.join("\n\n")}\n`;
}

/* Solo se enlazan direcciones web: un `javascript:` guardado como enlace no
   debe poder ejecutarse al pulsarlo. */
export const safeUrl = (u) => (/^https?:\/\//i.test(str(u)) ? str(u) : "");
