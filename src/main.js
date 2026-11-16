import "./styles.css";
import { $, el } from "./dom.js";
import {
  CATEGORIAS_DIARIO,
  ESTADOS,
  FASES_IA,
  PROCESO,
  SCHEMAS,
  TIPOS_FUENTE,
  TIPOS_TAREA,
  VIEWS,
  optLabel,
  optText,
  optValue,
} from "./schemas.js";
import {
  dateLabel,
  decSinComunicar,
  decSinMotivo,
  estadoFecha,
  fmtDate,
  fmtDateShort,
  hoyISO,
  iaSinRevisar,
  matches,
  nextNumbered,
  numOf,
  rangeLabel,
  reunionPendiente,
  safeUrl,
  str,
  tareaAbierta,
  toMarkdown,
  vencimiento,
} from "./derive.js";
import { createStore, nuevoId } from "./store/store.js";
import { localBackend } from "./store/local.js";
import { remoteBackend } from "./store/remote.js";

const API = (import.meta.env.VITE_API_URL || "").trim();
const store = createStore(API ? remoteBackend(API) : localBackend());
const SEMBRADO = "bitacora-tfg:ejemplo-cargado";

const ui = {
  status: "loading", // loading | ready | error | locked
  open: new Set(),
  filtros: {},
  onSubmit: null,
};
const filtro = (key) =>
  (ui.filtros[key] ||= { q: "", sel: "", checks: new Set() });
const meta = () => store.get("meta", "tfg") || {};
const puede = () => ui.status === "ready" && store.canWrite();
/* Devuelve el nodo solo si se puede editar: en solo lectura los controles de
   edición no se muestran. */
const siEdita = (nodo) => (puede() ? nodo : null);

/* ---------- avisos y errores ---------- */
let toastTimer = 0;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 4200);
}

function errMsg(e) {
  switch (e && e.code) {
    case "auth":
      return "La clave ya no es válida. Vuelve a entrar para editar.";
    case "network":
      return "No hay conexión con el servidor. No se ha guardado.";
    case "storage":
      return "El navegador no deja guardar: almacenamiento lleno o bloqueado.";
    default:
      return "No se pudo guardar. Inténtalo de nuevo.";
  }
}

async function guardar(fn, hecho) {
  try {
    await fn();
    if (hecho) toast(hecho);
    return true;
  } catch (e) {
    toast(errMsg(e));
    if (e && e.code === "auth") renderView();
    return false;
  }
}

/* ---------- diálogo ---------- */
function abrirDialogo(titulo, cuerpo, onSubmit, etiqueta = "Guardar") {
  $("#dlg-title").textContent = titulo;
  $("#dlg-body").replaceChildren(...cuerpo);
  const save = $("#dlg-save");
  save.textContent = etiqueta;
  save.hidden = !onSubmit;
  save.disabled = false;
  ui.onSubmit = onSubmit;
  const d = $("#dlg");
  if (d.showModal) d.showModal();
  else d.setAttribute("open", "");
  const primero = $("#dlg-body").querySelector("input, textarea, select");
  if (primero) primero.focus();
}

function cerrarDialogo() {
  const d = $("#dlg");
  if (d.close) d.close();
  else d.removeAttribute("open");
  ui.onSubmit = null;
}

function campoFormulario(key, f, valor) {
  const id = `f-${key}-${f.k}`;
  let input;
  if (f.t === "area") {
    input = el("textarea", { id, rows: f.rows || 3 });
    input.value = valor || "";
  } else if (f.t === "select") {
    input = el(
      "select",
      { id },
      f.opts.map((o) => el("option", { value: optValue(o), text: optText(o) }))
    );
    input.value = valor || optValue(f.opts[0]);
  } else if (f.t === "check") {
    input = el("input", { id, type: "checkbox" });
    input.checked = !!valor;
  } else {
    const type = f.t === "date" ? "date" : f.t === "url" ? "url" : "text";
    input = el("input", { id, type });
    input.value = valor || "";
  }
  if (f.req) input.required = true;
  if (f.t === "check") {
    return el(
      "div",
      { class: "field inline" },
      input,
      el("label", { for: id, text: f.l })
    );
  }
  return el(
    "div",
    { class: "field" },
    el("label", { for: id, text: f.l }),
    input,
    f.hint && el("span", { class: "hint", text: f.hint })
  );
}

function abrirFormulario(key, item) {
  const S = SCHEMAS[key];
  const esMeta = key === "meta";
  const titulo = esMeta
    ? S.nuevo
    : item
      ? S.prefix
        ? `Editar ${item.id}`
        : "Editar"
      : S.nuevo;
  const cuerpo = S.fields.map((f) => {
    let valor = item ? item[f.k] : f.def;
    if (!item && f.k === "fecha") valor = hoyISO();
    return campoFormulario(key, f, valor);
  });

  abrirDialogo(titulo, cuerpo, async () => {
    const data = {};
    for (const f of S.fields) {
      const input = document.getElementById(`f-${key}-${f.k}`);
      data[f.k] = f.t === "check" ? input.checked : input.value.trim();
      if (f.req && !data[f.k]) {
        input.focus();
        toast(`Falta «${f.l}».`);
        return false;
      }
    }
    const ahora = new Date().toISOString();
    if (esMeta) {
      return guardar(
        () => store.set("meta", "tfg", { ...meta(), ...data }),
        "Guardado."
      );
    }
    if (item) {
      return guardar(
        () => store.update(key, item.id, { ...data, actualizado: ahora }),
        "Guardado."
      );
    }
    data.creado = ahora;
    let id = nuevoId();
    if (S.prefix) {
      const siguiente = nextNumbered(store.list(key), S.prefix);
      id = siguiente.id;
      data.num = siguiente.num;
    }
    ui.open.add(`${key}/${id}`);
    const ok = await guardar(() => store.set(key, id, data), "Guardado.");
    if (!ok) ui.open.delete(`${key}/${id}`);
    return ok;
  });
}

function botonBorrar(key, item, clase = "btn danger") {
  let armado = false;
  let timer = 0;
  const b = el("button", { type: "button", class: clase, text: "Borrar" });
  b.addEventListener("click", async () => {
    if (!armado) {
      armado = true;
      b.textContent = "Confirmar borrado";
      b.classList.add("armed");
      timer = setTimeout(() => {
        armado = false;
        b.textContent = "Borrar";
        b.classList.remove("armed");
      }, 4000);
      return;
    }
    clearTimeout(timer);
    b.disabled = true;
    const ok = await guardar(() => store.remove(key, item.id), "Borrado.");
    if (!ok) b.disabled = false;
  });
  return b;
}

/* ---------- piezas comunes ---------- */
const vacio = (texto, ...extra) =>
  el("div", { class: "list" }, el("div", { class: "empty" }, texto, extra));

function cargando(construir) {
  if (ui.status === "loading") return vacio("Cargando…");
  if (ui.status === "error") {
    return vacio(
      "No se han podido cargar los datos. Comprueba la conexión y recarga la página."
    );
  }
  if (ui.status === "locked") {
    return vacio(
      "Esta bitácora es privada. ",
      el("button", {
        type: "button",
        class: "btn primary",
        text: "Entrar con la clave",
        onclick: abrirEntrada,
      })
    );
  }
  return construir();
}

function fichaCampos(key, item, claves) {
  const S = SCHEMAS[key];
  const dl = el("dl", { class: "fields" });
  for (const k of claves) {
    const f = S.fields.find((x) => x.k === k);
    let v = item[k];
    if (f.t === "select") v = optLabel(f.opts, v);
    else if (f.t === "date") v = fmtDate(v);
    else if (f.t === "check") v = v ? "Sí" : "No";
    const falta = !str(v);
    let dd;
    if (f.t === "url" && safeUrl(v)) {
      dd = el(
        "dd",
        null,
        el("a", {
          href: safeUrl(v),
          target: "_blank",
          rel: "noopener noreferrer",
          text: v,
        })
      );
    } else {
      dd = el("dd", {
        class: falta && !f.opt ? "todo" : null,
        text: falta ? (f.opt ? "—" : "Por completar") : v,
      });
    }
    dl.append(el("dt", { text: f.l }), dd);
  }
  return dl;
}

const seccion = (titulo, derecha, ...hijos) =>
  el(
    "section",
    { class: "sec" },
    el("div", { class: "sec-head" }, el("h2", { text: titulo }), derecha),
    hijos
  );

function casilla(id, etiqueta, marcada, onchange) {
  const input = el("input", { id, type: "checkbox" });
  input.checked = marcada;
  input.addEventListener("change", () => onchange(input.checked));
  return el("label", { class: "check", for: id }, input, etiqueta);
}

function copiar(texto) {
  const aMano = () => {
    const ta = el("textarea", { id: "copy-area", rows: 16, readonly: true });
    ta.value = texto;
    abrirDialogo(
      "Copia el texto",
      [
        el("p", {
          class: "note",
          text: "El portapapeles no está disponible. Selecciona y copia a mano.",
        }),
        ta,
      ],
      null
    );
    ta.focus();
    ta.select();
  };
  if (!navigator.clipboard) return aMano();
  navigator.clipboard
    .writeText(texto)
    .then(() => toast("Copiado en formato Markdown."), aMano);
}

/* ---------- listas de entradas (decisiones, IA, reuniones, diario, fuentes) ---------- */
const porFecha = (a, b) =>
  str(b.fecha).localeCompare(str(a.fecha)) ||
  str(b.creado).localeCompare(str(a.creado));
const porNumero = (a, b) => numOf(b) - numOf(a);

const chip = (texto, clase = "") =>
  el("span", { class: `chip ${clase}`.trim(), text: texto });

const LISTAS = {
  decisiones: {
    key: "decisiones",
    titulo: "Bitácora de decisiones",
    boton: "Nueva decisión",
    buscar: "Buscar en las decisiones",
    intro:
      "Cada decisión con su porqué y sus alternativas. Si una cambia, no la borres: añade otra que la sustituya.",
    vacia:
      "Aún no hay decisiones. Registra la primera con su motivo y las alternativas que descartaste.",
    checks: [
      { id: "sinMotivo", l: "Motivo por completar", test: decSinMotivo },
      {
        id: "sinComunicar",
        l: "Sin comunicar al tutor",
        test: decSinComunicar,
      },
    ],
    orden: porNumero,
    marca: (it) => it.id,
    meta: (it) => dateLabel(it),
    chips: (it) => [
      decSinMotivo(it) && chip("Motivo por completar", "warn"),
      decSinComunicar(it)
        ? chip("Sin comunicar al tutor", "warn")
        : chip(
            it.comunicada === "acordada"
              ? "Acordada con el tutor"
              : "Comunicada",
            "ok"
          ),
    ],
    claves: (it) =>
      [
        "decision",
        "motivo",
        "alternativas",
        "consecuencias",
        "comunicada",
      ].concat(str(it.comunicadaNota) ? ["comunicadaNota"] : []),
  },
  "uso-ia": {
    key: "ia",
    titulo: "Registro de uso de herramientas de IA",
    boton: "Nueva entrada",
    buscar: "Buscar en las entradas",
    vacia:
      "Aún no hay entradas. Anota cada uso de IA cuando ocurra: reconstruirlo al final es difícil y poco fiable.",
    select: { campo: "fase", todas: "Todas las fases", opts: FASES_IA },
    checks: [{ id: "sinRevisar", l: "Solo sin revisar", test: iaSinRevisar }],
    orden: porNumero,
    marca: (it) => it.id,
    meta: (it) =>
      [dateLabel(it), it.fase, str(it.herramienta)].filter(Boolean).join(" · "),
    chips: (it) => [
      iaSinRevisar(it)
        ? chip("Revisión sin cerrar", "warn")
        : chip("Revisada", "ok"),
    ],
    claves: () => [
      "herramienta",
      "fase",
      "tareas",
      "destino",
      "revision",
      "limitaciones",
    ],
    extra: (it) =>
      iaSinRevisar(it) &&
      el("button", {
        type: "button",
        class: "btn",
        text: "Marcar como revisada",
        disabled: !str(it.revision),
        title: str(it.revision) ? null : "Escribe antes qué revisaste",
        onclick: () =>
          guardar(
            () => store.update("ia", it.id, { revisado: true }),
            "Marcada como revisada."
          ),
      }),
    antes: () =>
      el(
        "details",
        { class: "norma" },
        el("summary", { text: "Qué suele pedir una declaración de uso de IA" }),
        el(
          "ul",
          null,
          el("li", { text: "Las herramientas de IA utilizadas." }),
          el("li", {
            text: "Las fases del trabajo en las que se han empleado.",
          }),
          el("li", {
            text: "La finalidad de su uso y las tareas realizadas con su apoyo.",
          }),
          el("li", {
            text: "Lo que hizo el autor para revisar, validar o adaptar los resultados.",
          }),
          el("li", {
            text: "Una reflexión breve sobre su contribución, sus limitaciones y las medidas para garantizar la integridad académica.",
          })
        ),
        el("p", {
          class: "note",
          text: "Comprueba la normativa de tu centro: cada vez más reglamentos de TFG exigen esta declaración como anexo. Aquí van las herramientas usadas para hacer el trabajo, no los modelos que formen parte de lo que construyes.",
        })
      ),
  },
  reuniones: {
    key: "reuniones",
    titulo: "Reuniones",
    boton: "Nueva reunión",
    buscar: "Buscar en las reuniones",
    intro:
      "Lo que se habló en cada reunión con el tutor y lo que quedó por hacer.",
    vacia:
      "Aún no hay reuniones. Apunta cada una al salir: qué te dijeron y qué acciones quedaron.",
    checks: [
      {
        id: "pendientes",
        l: "Con acciones pendientes",
        test: reunionPendiente,
      },
    ],
    orden: porFecha,
    marca: (it) => fmtDateShort(it.fecha) || "—",
    meta: (it) =>
      [fmtDate(it.fecha), str(it.asistentes)].filter(Boolean).join(" · ") ||
      "Sin fecha",
    chips: (it) => [
      reunionPendiente(it)
        ? chip("Acciones pendientes", "warn")
        : it.estado === "hecho"
          ? chip("Acciones hechas", "ok")
          : null,
    ],
    claves: () => ["asistentes", "resumen", "acciones", "estado"],
    extra: (it) =>
      reunionPendiente(it) &&
      el("button", {
        type: "button",
        class: "btn",
        text: "Marcar acciones como hechas",
        onclick: () =>
          guardar(
            () => store.update("reuniones", it.id, { estado: "hecho" }),
            "Acciones marcadas como hechas."
          ),
      }),
  },
  diario: {
    key: "diario",
    titulo: "Diario",
    boton: "Nueva entrada",
    buscar: "Buscar en el diario",
    intro:
      "Notas de trabajo del día a día: avances, bloqueos e ideas. Es la materia prima de la memoria.",
    vacia:
      "El diario está vacío. Una nota corta al terminar cada sesión de trabajo es suficiente.",
    select: {
      campo: "categoria",
      todas: "Todas las categorías",
      opts: CATEGORIAS_DIARIO,
    },
    orden: porFecha,
    marca: (it) => fmtDateShort(it.fecha) || "—",
    meta: (it) => fmtDate(it.fecha) || "Sin fecha",
    chips: (it) => [
      chip(it.categoria || "Otro", it.categoria === "Bloqueo" ? "warn" : ""),
    ],
    claves: () => ["categoria", "texto"],
  },
  fuentes: {
    key: "fuentes",
    titulo: "Fuentes",
    boton: "Nueva fuente",
    buscar: "Buscar en las fuentes",
    intro:
      "Artículos, libros, documentación y herramientas, con la parte de la memoria donde se usan.",
    vacia:
      "Aún no hay fuentes. Guarda cada una con su referencia completa: te ahorra rehacer la bibliografía al final.",
    select: { campo: "tipo", todas: "Todos los tipos", opts: TIPOS_FUENTE },
    checks: [{ id: "porLeer", l: "Solo por leer", test: (it) => !it.leida }],
    orden: (a, b) => str(a.titulo).localeCompare(str(b.titulo), "es"),
    marca: (it) => it.tipo || "Otro",
    meta: (it) => str(it.seccion) || "Sin apartado asignado",
    chips: (it) => [it.leida ? chip("Leída", "ok") : chip("Por leer")],
    claves: () => ["tipo", "url", "seccion", "cita", "notas"],
    extra: (it) =>
      !it.leida &&
      el("button", {
        type: "button",
        class: "btn",
        text: "Marcar como leída",
        onclick: () =>
          guardar(
            () => store.update("fuentes", it.id, { leida: true }),
            "Marcada como leída."
          ),
      }),
  },
};

function filaEntrada(cfg, item) {
  const clave = `${cfg.key}/${item.id}`;
  const abierta = ui.open.has(clave);
  const cabecera = el(
    "button",
    { type: "button", class: "row-head", "aria-expanded": String(abierta) },
    el("span", { class: "mark", text: cfg.marca(item) }),
    el(
      "span",
      { class: "row-main" },
      el("span", {
        class: "row-title",
        text: str(item.titulo) || "Sin título",
      }),
      el("span", { class: "row-meta", text: cfg.meta(item) })
    ),
    el("span", { class: "chips" }, cfg.chips(item))
  );
  cabecera.addEventListener("click", () => {
    if (ui.open.has(clave)) ui.open.delete(clave);
    else ui.open.add(clave);
    renderLista();
  });
  const fila = el("article", { class: "row" }, cabecera);
  if (abierta) {
    fila.append(
      el(
        "div",
        { class: "row-body" },
        fichaCampos(cfg.key, item, cfg.claves(item)),
        siEdita(
          el(
            "div",
            { class: "row-actions" },
            el("button", {
              type: "button",
              class: "btn",
              text: "Editar",
              onclick: () => abrirFormulario(cfg.key, item),
            }),
            cfg.extra && cfg.extra(item),
            botonBorrar(cfg.key, item)
          )
        )
      )
    );
  }
  return fila;
}

function vistaLista(id) {
  const cfg = LISTAS[id];
  const f = filtro(cfg.key);
  const q = el("input", {
    id: `q-${cfg.key}`,
    type: "search",
    placeholder: cfg.buscar,
    "aria-label": "Buscar",
    value: f.q,
  });
  q.addEventListener("input", () => {
    f.q = q.value;
    renderLista();
  });

  let selector = null;
  if (cfg.select) {
    selector = el(
      "select",
      { id: `sel-${cfg.key}`, "aria-label": cfg.select.todas },
      el("option", { value: "", text: cfg.select.todas }),
      cfg.select.opts.map((o) =>
        el("option", { value: optValue(o), text: optText(o) })
      )
    );
    selector.value = f.sel;
    selector.addEventListener("change", () => {
      f.sel = selector.value;
      renderLista();
    });
  }

  listaHost = el("div");
  listaBuilder = () =>
    cargando(() => {
      const todas = store.list(cfg.key);
      if (!todas.length) return vacio(cfg.vacia);
      const ql = f.q.trim().toLowerCase();
      const visibles = todas
        .filter(
          (it) =>
            matches(it, ql) &&
            (!f.sel || it[cfg.select.campo] === f.sel) &&
            (cfg.checks || []).every((c) => !f.checks.has(c.id) || c.test(it))
        )
        .sort(cfg.orden);
      if (!visibles.length) return vacio("Nada coincide con los filtros.");
      return el(
        "div",
        { class: "list" },
        visibles.map((it) => filaEntrada(cfg, it))
      );
    });

  return [
    cfg.antes && cfg.antes(),
    cfg.intro && el("p", { class: "note", text: cfg.intro }),
    el(
      "div",
      { class: "toolbar" },
      el("div", { class: "grow" }, q),
      selector && el("div", { class: "narrow" }, selector),
      (cfg.checks || []).map((c) =>
        casilla(`chk-${cfg.key}-${c.id}`, c.l, f.checks.has(c.id), (v) => {
          if (v) f.checks.add(c.id);
          else f.checks.delete(c.id);
          renderLista();
        })
      ),
      el("span", { class: "spacer" }),
      el("button", {
        type: "button",
        class: "btn quiet",
        text: "Copiar Markdown",
        onclick: () =>
          copiar(
            toMarkdown(
              cfg.key,
              store.list(cfg.key).sort(cfg.orden).reverse(),
              cfg.titulo
            )
          ),
      }),
      siEdita(
        el("button", {
          type: "button",
          class: "btn primary",
          text: cfg.boton,
          onclick: () => abrirFormulario(cfg.key, null),
        })
      )
    ),
    listaHost,
  ];
}

/* ---------- tareas: tablero de tres columnas ---------- */
function tarjetaTarea(t) {
  const v = vencimiento(t.limite);
  const estado = el(
    "select",
    { id: `est-${t.id}`, "aria-label": `Estado de «${str(t.titulo)}»` },
    ESTADOS.map((o) => el("option", { value: o.v, text: o.l }))
  );
  estado.value = t.estado || "pendiente";
  estado.addEventListener("change", async () => {
    estado.disabled = true;
    const ok = await guardar(() =>
      store.update("tareas", t.id, {
        estado: estado.value,
        actualizado: new Date().toISOString(),
      })
    );
    if (!ok) estado.disabled = false;
  });
  return el(
    "article",
    { class: "card" },
    el(
      "div",
      { class: "chips left" },
      (t.tipo || "tarea") !== "tarea" && chip(optLabel(TIPOS_TAREA, t.tipo)),
      v && tareaAbierta(t) && chip(v.txt, v.clase)
    ),
    el("h3", { class: "card-title", text: str(t.titulo) || "Sin título" }),
    str(t.detalle) && el("p", { class: "card-text", text: t.detalle }),
    str(t.depende) &&
      el("span", { class: "task-dep", text: `Depende de: ${t.depende}` }),
    siEdita(
      el(
        "div",
        { class: "card-actions" },
        estado,
        el("button", {
          type: "button",
          class: "btn quiet",
          text: "Editar",
          onclick: () => abrirFormulario("tareas", t),
        }),
        botonBorrar("tareas", t, "btn quiet danger")
      )
    )
  );
}

function vistaTareas() {
  const f = filtro("tareas");
  const q = el("input", {
    id: "q-tareas",
    type: "search",
    placeholder: "Buscar en las tareas",
    "aria-label": "Buscar",
    value: f.q,
  });
  q.addEventListener("input", () => {
    f.q = q.value;
    renderLista();
  });
  const tipo = el(
    "select",
    { id: "sel-tareas", "aria-label": "Tipo" },
    el("option", { value: "", text: "Todos los tipos" }),
    TIPOS_TAREA.map((o) => el("option", { value: o.v, text: o.l }))
  );
  tipo.value = f.sel;
  tipo.addEventListener("change", () => {
    f.sel = tipo.value;
    renderLista();
  });

  listaHost = el("div");
  listaBuilder = () =>
    cargando(() => {
      const todas = store.list("tareas");
      if (!todas.length) {
        return vacio(
          "No hay tareas. Añade lo que tengas que hacer, decidir o consultar."
        );
      }
      const ql = f.q.trim().toLowerCase();
      const visibles = todas.filter(
        (t) => matches(t, ql) && (!f.sel || (t.tipo || "tarea") === f.sel)
      );
      const orden = (a, b) =>
        (str(a.limite) || "9999").localeCompare(str(b.limite) || "9999") ||
        str(a.titulo).localeCompare(str(b.titulo), "es");
      return el(
        "div",
        { class: "board" },
        ESTADOS.map((e) => {
          const items = visibles
            .filter((t) => (t.estado || "pendiente") === e.v)
            .sort(orden);
          return el(
            "section",
            { class: "col", "aria-label": e.l },
            el(
              "div",
              { class: "col-head" },
              el("h2", { text: e.l }),
              el("span", { class: "count", text: String(items.length) })
            ),
            items.length
              ? items.map(tarjetaTarea)
              : el("p", { class: "col-empty", text: "Nada aquí." })
          );
        })
      );
    });

  return [
    el(
      "div",
      { class: "toolbar" },
      el("div", { class: "grow" }, q),
      el("div", { class: "narrow" }, tipo),
      el("span", { class: "spacer" }),
      siEdita(
        el("button", {
          type: "button",
          class: "btn primary",
          text: "Nueva tarea",
          onclick: () => abrirFormulario("tareas", null),
        })
      )
    ),
    listaHost,
  ];
}

/* ---------- calendario ---------- */
const CLASE_FECHA = {
  past: "chip",
  future: "chip",
  soon: "chip warn",
  now: "chip now",
};

function vistaCalendario() {
  listaHost = el("div", { class: "sec gap-lg" });
  listaBuilder = () =>
    cargando(() => {
      const todas = store.list("fechas");
      if (!todas.length) {
        return vacio(
          "No hay fechas. Copia aquí los plazos oficiales de tu centro: solicitud de defensa, entrega y tribunal."
        );
      }
      const m = meta();
      const frag = document.createDocumentFragment();
      if (m.fechasComprobadas) {
        frag.append(
          el("p", {
            class: "note",
            text: `Fechas oficiales comprobadas el ${fmtDate(m.fechasComprobadas)}. Los centros las mueven durante el curso: vuelve a comprobarlas antes de cada plazo.`,
          })
        );
      }
      /* La convocatoria objetivo va primero y la de reserva después; el
         resto, por orden de su primera fecha. Alfabéticamente «Julio» iría
         antes que «Junio». */
      const peso = (g) =>
        g && g === str(m.objetivo) ? 0 : g && g === str(m.reserva) ? 1 : 2;
      const primera = (g) =>
        todas
          .filter((x) => str(x.grupo) === g)
          .map((x) => str(x.inicio) || "9999")
          .sort()[0];
      const grupos = [...new Set(todas.map((x) => str(x.grupo)))].sort(
        (a, b) =>
          peso(a) - peso(b) ||
          primera(a).localeCompare(primera(b)) ||
          a.localeCompare(b, "es")
      );
      for (const g of grupos) {
        const filas = todas
          .filter((x) => str(x.grupo) === g)
          .sort(
            (a, b) =>
              str(a.inicio).localeCompare(str(b.inicio)) ||
              str(a.fin).localeCompare(str(b.fin))
          );
        let titulo = g || "Sin grupo";
        if (g && g === str(m.objetivo)) titulo += " · objetivo";
        else if (g && g === str(m.reserva)) titulo += " · reserva";
        frag.append(
          seccion(
            titulo,
            null,
            el(
              "div",
              { class: "table-wrap" },
              el(
                "table",
                null,
                el(
                  "thead",
                  null,
                  el(
                    "tr",
                    null,
                    ["Trámite", "Quién", "Desde", "Hasta", "Estado"].map((h) =>
                      el("th", { text: h, scope: "col" })
                    ),
                    siEdita(
                      el(
                        "th",
                        { scope: "col" },
                        el("span", { class: "sr", text: "Acciones" })
                      )
                    )
                  )
                ),
                el(
                  "tbody",
                  null,
                  filas.map((r) => {
                    const e = estadoFecha(r);
                    return el(
                      "tr",
                      {
                        class:
                          [e.k === "past" && "past", r.clave && "key"]
                            .filter(Boolean)
                            .join(" ") || null,
                      },
                      el("td", { text: r.tramite }),
                      el("td", { text: r.quien || "" }),
                      el("td", { class: "d", text: fmtDate(r.inicio) || "—" }),
                      el("td", { class: "d", text: fmtDate(r.fin) || "—" }),
                      el(
                        "td",
                        null,
                        el("span", { class: CLASE_FECHA[e.k], text: e.txt })
                      ),
                      siEdita(
                        el(
                          "td",
                          { class: "acts" },
                          el("button", {
                            type: "button",
                            class: "btn quiet",
                            text: "Editar",
                            onclick: () => abrirFormulario("fechas", r),
                          }),
                          botonBorrar("fechas", r, "btn quiet danger")
                        )
                      )
                    );
                  })
                )
              )
            )
          )
        );
      }
      return frag;
    });

  return [
    el(
      "div",
      { class: "toolbar" },
      el("p", {
        class: "note",
        text: "En negrita, los plazos que dependen de ti.",
      }),
      el("span", { class: "spacer" }),
      siEdita(
        el("button", {
          type: "button",
          class: "btn primary",
          text: "Nueva fecha",
          onclick: () => abrirFormulario("fechas", null),
        })
      )
    ),
    listaHost,
  ];
}

/* ---------- resumen ---------- */
function pasosProceso(m) {
  const actual = Math.max(0, PROCESO.indexOf(m.fase || PROCESO[0]));
  return el(
    "ol",
    { class: "steps" },
    PROCESO.map((p, i) => {
      const estado = i < actual ? "done" : i === actual ? "current" : "todo";
      const contenido = [
        el("span", { class: "step-n", text: String(i + 1) }),
        el("span", { class: "step-l", text: p }),
      ];
      return el(
        "li",
        {
          class: `step ${estado}`,
          "aria-current": i === actual ? "step" : null,
        },
        puede()
          ? el(
              "button",
              {
                type: "button",
                class: "step-btn",
                title: `Marcar «${p}» como fase actual`,
                onclick: () =>
                  i !== actual &&
                  guardar(() =>
                    store.set("meta", "tfg", { ...meta(), fase: p })
                  ),
              },
              contenido
            )
          : el("span", { class: "step-btn" }, contenido)
      );
    })
  );
}

function descargar(nombre, texto) {
  const url = URL.createObjectURL(
    new Blob([texto], { type: "application/json" })
  );
  const a = el("a", { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportar() {
  const copia = {
    formato: "bitacora-tfg",
    version: 1,
    exportado: new Date().toISOString(),
    data: store.snapshot(),
  };
  descargar(`bitacora-tfg-${hoyISO()}.json`, JSON.stringify(copia, null, 2));
}

function importar() {
  const entrada = el("input", {
    id: "imp-file",
    type: "file",
    accept: "application/json,.json",
  });
  abrirDialogo(
    "Importar una copia",
    [
      el("p", {
        class: "note",
        text: "Sustituye TODO lo que hay ahora por el contenido del fichero. Exporta antes si quieres conservar lo actual.",
      }),
      el(
        "div",
        { class: "field" },
        el("label", { for: "imp-file", text: "Fichero exportado (.json)" }),
        entrada
      ),
    ],
    async () => {
      const fichero = entrada.files && entrada.files[0];
      if (!fichero) {
        toast("Elige un fichero.");
        return false;
      }
      let contenido;
      try {
        contenido = JSON.parse(await fichero.text());
      } catch {
        toast("El fichero no es un JSON válido.");
        return false;
      }
      const data =
        contenido && contenido.formato === "bitacora-tfg"
          ? contenido.data
          : contenido;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        toast("El fichero no tiene el formato de una bitácora.");
        return false;
      }
      return guardar(() => store.replaceAll(data), "Copia importada.");
    },
    "Importar y sustituir"
  );
}

async function cargarEjemplo() {
  const { DEMO } = await import("./demo.js");
  return guardar(() => store.replaceAll(DEMO()), "Datos de ejemplo cargados.");
}

function botonVaciar() {
  let armado = false;
  let timer = 0;
  const b = el("button", {
    type: "button",
    class: "btn danger",
    text: "Vaciar todo",
  });
  b.addEventListener("click", async () => {
    if (!armado) {
      armado = true;
      b.textContent = "Confirmar: borrar todos los datos";
      b.classList.add("armed");
      timer = setTimeout(() => {
        armado = false;
        b.textContent = "Vaciar todo";
        b.classList.remove("armed");
      }, 5000);
      return;
    }
    clearTimeout(timer);
    await guardar(() => store.replaceAll({}), "Bitácora vaciada.");
  });
  return b;
}

function abrirEntrada() {
  const clave = el("input", {
    id: "login-clave",
    type: "password",
    autocomplete: "current-password",
  });
  abrirDialogo(
    "Entrar para editar",
    [
      el(
        "div",
        { class: "field" },
        el("label", { for: "login-clave", text: "Clave de edición" }),
        clave,
        el("span", {
          class: "hint",
          text: "Es la que se generó al instalar el servidor. Se recuerda en este navegador.",
        })
      ),
    ],
    async () => {
      try {
        if (!(await store.login(clave.value))) {
          toast("Clave incorrecta.");
          clave.select();
          return false;
        }
      } catch {
        toast("No hay conexión con el servidor.");
        return false;
      }
      if (ui.status === "locked") await arrancar();
      else renderView();
      toast("Ya puedes editar.");
      return true;
    },
    "Entrar"
  );
}

function panelDatos() {
  const remoto = store.mode === "remote";
  const texto = remoto
    ? puede()
      ? "Los datos se guardan en el servidor. Has entrado con la clave de edición."
      : "Los datos se guardan en el servidor. Estás viendo la bitácora en solo lectura."
    : "Los datos se guardan solo en este navegador. No se envían a ningún sitio ni se sincronizan con otros dispositivos: exporta una copia de vez en cuando.";
  return seccion(
    "Tus datos",
    null,
    el("p", { class: "note", text: texto }),
    el(
      "div",
      { class: "toolbar" },
      el("button", {
        type: "button",
        class: "btn",
        text: "Exportar copia (.json)",
        onclick: exportar,
      }),
      siEdita(
        el("button", {
          type: "button",
          class: "btn",
          text: "Importar copia",
          onclick: importar,
        })
      ),
      !remoto &&
        store.isEmpty() &&
        el("button", {
          type: "button",
          class: "btn",
          text: "Ver con datos de ejemplo",
          onclick: cargarEjemplo,
        }),
      siEdita(!store.isEmpty() && botonVaciar()),
      remoto &&
        (store.hasSession()
          ? el("button", {
              type: "button",
              class: "btn",
              text: "Salir del modo edición",
              onclick: () => {
                store.logout();
                renderView();
              },
            })
          : el("button", {
              type: "button",
              class: "btn primary",
              text: "Entrar para editar",
              onclick: abrirEntrada,
            }))
    )
  );
}

function vistaResumen() {
  listaHost = el("div", { class: "sec gap-lg" });
  listaBuilder = () =>
    cargando(() => {
      const m = meta();
      const frag = document.createDocumentFragment();

      if (store.isEmpty()) {
        frag.append(
          el(
            "section",
            { class: "welcome" },
            el("h2", { text: "Tu bitácora está vacía" }),
            el("p", {
              class: "note",
              text: "Aquí llevas el trabajo de principio a fin: tareas, decisiones con su porqué, uso de IA, reuniones con el tutor, diario, fuentes y plazos. Empieza por la ficha del trabajo.",
            }),
            el(
              "div",
              { class: "toolbar" },
              siEdita(
                el("button", {
                  type: "button",
                  class: "btn primary",
                  text: "Rellenar la ficha",
                  onclick: () => abrirFormulario("meta", null),
                })
              ),
              store.mode === "local" &&
                el("button", {
                  type: "button",
                  class: "btn",
                  text: "Ver con datos de ejemplo",
                  onclick: cargarEjemplo,
                })
            )
          ),
          panelDatos()
        );
        return frag;
      }

      const cifras = [
        {
          n: store.list("tareas").filter(tareaAbierta).length,
          l: "tareas abiertas",
          href: "#tareas",
        },
        {
          n: store.list("reuniones").filter(reunionPendiente).length,
          l: "reuniones con acciones pendientes",
          href: "#reuniones",
          go: () => filtro("reuniones").checks.add("pendientes"),
        },
        {
          n: store.list("decisiones").filter(decSinComunicar).length,
          l: "decisiones sin comunicar al tutor",
          href: "#decisiones",
          go: () => {
            const f = filtro("decisiones");
            f.checks.clear();
            f.checks.add("sinComunicar");
          },
        },
        {
          n: store.list("ia").filter(iaSinRevisar).length,
          l: "usos de IA con la revisión sin cerrar",
          href: "#uso-ia",
          go: () => filtro("ia").checks.add("sinRevisar"),
        },
      ];
      const proximas = store
        .list("fechas")
        .map((f) => ({ f, e: estadoFecha(f) }))
        .filter((x) => x.e.key)
        .sort((a, b) => a.e.key - b.e.key)
        .slice(0, 5);

      frag.append(
        seccion("Fase del trabajo", null, pasosProceso(m)),
        seccion(
          "Requiere tu atención",
          null,
          el(
            "div",
            { class: "tiles" },
            cifras.map((t) =>
              el(
                "a",
                { class: "tile", href: t.href, onclick: t.go },
                el("span", {
                  class: `tile-n${t.n ? "" : " zero"}`,
                  text: String(t.n),
                }),
                el("span", { class: "tile-l", text: t.l })
              )
            )
          )
        ),
        seccion(
          "Próximas fechas",
          el("a", { href: "#calendario", text: "Ver calendario" }),
          proximas.length
            ? el(
                "div",
                { class: "list" },
                proximas.map(({ f, e }) =>
                  el(
                    "div",
                    { class: "row date-row" },
                    el("span", { class: "mark", text: str(f.grupo) || "—" }),
                    el(
                      "div",
                      { class: "row-main" },
                      el("span", { class: "row-title", text: f.tramite }),
                      el("span", {
                        class: "row-meta",
                        text: [rangeLabel(f), str(f.quien)]
                          .filter(Boolean)
                          .join(" · "),
                      })
                    ),
                    el("span", { class: CLASE_FECHA[e.k], text: e.txt })
                  )
                )
              )
            : vacio("No hay fechas futuras. Añádelas en Calendario.")
        ),
        seccion(
          "Ficha del trabajo",
          siEdita(
            el("button", {
              type: "button",
              class: "btn",
              text: "Editar ficha",
              onclick: () => abrirFormulario("meta", m.id ? m : null),
            })
          ),
          el(
            "div",
            { class: "list" },
            el(
              "div",
              { class: "row-body pad" },
              fichaCampos("meta", m, [
                "titulo",
                "autor",
                "tutor",
                "titulacion",
                "universidad",
                "curso",
                "propuesta",
                "objetivo",
                "reserva",
              ])
            )
          )
        ),
        panelDatos()
      );
      return frag;
    });
  return [listaHost];
}

/* ---------- navegación y arranque ---------- */
let listaHost = null;
let listaBuilder = null;
function renderLista() {
  if (listaHost && listaBuilder) listaHost.replaceChildren(listaBuilder());
}

const CONSTRUIR = {
  resumen: vistaResumen,
  tareas: vistaTareas,
  calendario: vistaCalendario,
};
for (const id of Object.keys(LISTAS)) CONSTRUIR[id] = () => vistaLista(id);

const vistaActual = () => {
  const h = location.hash.slice(1);
  return CONSTRUIR[h] ? h : "resumen";
};

function renderTabs() {
  const actual = vistaActual();
  const avisos =
    ui.status === "ready"
      ? {
          decisiones: store
            .list("decisiones")
            .filter((x) => decSinMotivo(x) || decSinComunicar(x)).length,
          "uso-ia": store.list("ia").filter(iaSinRevisar).length,
          reuniones: store.list("reuniones").filter(reunionPendiente).length,
        }
      : {};
  $("#tabs").replaceChildren(
    ...VIEWS.map((v) =>
      el(
        "a",
        {
          class: "tab",
          href: `#${v.id}`,
          "aria-current": v.id === actual ? "page" : null,
        },
        v.l,
        avisos[v.id]
          ? el("span", {
              class: "badge",
              text: String(avisos[v.id]),
              title: "Con algo por completar",
            })
          : null
      )
    )
  );
}

function renderCabecera() {
  const m = meta();
  const titulo = str(m.titulo);
  $("#h-title").textContent = titulo || "Bitácora de TFG";
  $("#h-eyebrow").textContent =
    [str(m.titulacion), str(m.universidad)].filter(Boolean).join(" · ") ||
    "Bitácora de trabajo académico";
  const datos = [
    !titulo && (str(m.autor) || str(m.tutor)) && "Título por definir",
    str(m.autor),
    str(m.tutor) && `Tutor: ${m.tutor}`,
    str(m.curso) && `Curso ${m.curso}`,
  ].filter(Boolean);
  $("#h-meta").replaceChildren(...datos.map((d) => el("span", { text: d })));
  document.title = titulo ? `${titulo} · Bitácora` : "Bitácora de TFG";
}

function renderView() {
  renderTabs();
  renderCabecera();
  $("#view").replaceChildren(
    ...CONSTRUIR[vistaActual()]().flat().filter(Boolean)
  );
  renderLista();
}

/* Los datos de ejemplo se siembran una sola vez: si después se vacía la
   bitácora, recargar no los vuelve a traer. */
function primeraVezEnDesarrollo() {
  try {
    if (localStorage.getItem(SEMBRADO) === "1") return false;
    localStorage.setItem(SEMBRADO, "1");
    return true;
  } catch {
    return false;
  }
}

async function arrancar() {
  ui.status = "loading";
  renderView();
  try {
    await store.load();
    ui.status = "ready";
  } catch (e) {
    ui.status = e && e.code === "auth" ? "locked" : "error";
  }
  /* En desarrollo la bitácora arranca con los datos de ejemplo, para tener
     algo que mirar. En el build de producción arranca en blanco. */
  if (
    import.meta.env.DEV &&
    ui.status === "ready" &&
    store.mode === "local" &&
    store.isEmpty()
  ) {
    if (primeraVezEnDesarrollo()) await cargarEjemplo();
  }
  renderView();
}

$("#dlg-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!ui.onSubmit) return cerrarDialogo();
  const save = $("#dlg-save");
  save.disabled = true;
  const ok = await ui.onSubmit();
  save.disabled = false;
  if (ok) cerrarDialogo();
});
$("#dlg-cancel").addEventListener("click", cerrarDialogo);
window.addEventListener("hashchange", renderView);
store.subscribe(() => {
  renderTabs();
  renderCabecera();
  renderLista();
});

arrancar();
