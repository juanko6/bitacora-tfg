/* Qué se guarda y con qué campos. Los formularios, las fichas de detalle y la
   exportación a Markdown se generan a partir de estas definiciones, así que
   añadir un campo aquí basta para que aparezca en los tres sitios.

   Tipos de campo: text, area, date, url, check, select.
   `req` obliga a rellenarlo; `opt` lo muestra como «—» en vez de «Por
   completar» cuando está vacío. */

export const FASES_IA = [
  "Planteamiento",
  "Estado del arte",
  "Diseño",
  "Implementación",
  "Experimentos",
  "Memoria",
  "Defensa",
  "Gestión",
];

export const PROCESO = [
  "Idea",
  "Investigación",
  "Desarrollo",
  "Escritura",
  "Revisión",
  "Entrega y defensa",
];

export const ESTADOS = [
  { v: "pendiente", l: "Por hacer" },
  { v: "curso", l: "En curso" },
  { v: "hecho", l: "Hecho" },
];

export const TIPOS_TAREA = [
  { v: "tarea", l: "Tarea" },
  { v: "decision", l: "Decisión por tomar" },
  { v: "consulta", l: "Consulta" },
];

export const COMUNICADA = [
  { v: "no", l: "No" },
  { v: "si", l: "Sí" },
  { v: "acordada", l: "Acordada con el tutor" },
];

export const ACCIONES = [
  { v: "pendiente", l: "Acciones pendientes" },
  { v: "hecho", l: "Acciones hechas" },
  { v: "sin", l: "Sin acciones" },
];

export const CATEGORIAS_DIARIO = [
  "Avance",
  "Bloqueo",
  "Idea",
  "Lectura",
  "Experimento",
  "Otro",
];

export const TIPOS_PAPER = [
  "Paper",
  "TFG",
  "TFM",
  "Tesis",
  "Libro",
  "Informe",
  "Otro",
];

export const ESTADOS_LECTURA = [
  { v: "por-leer", l: "Por leer" },
  { v: "leyendo", l: "Leyendo" },
  { v: "leido", l: "Leído" },
  { v: "descartado", l: "Descartado" },
];

export const RELEVANCIA = [
  { v: "alta", l: "Alta" },
  { v: "media", l: "Media" },
  { v: "baja", l: "Baja" },
];

export const TIPOS_FUENTE = [
  "Documentación",
  "Web",
  "Herramienta",
  "Libro",
  "Vídeo",
  "Normativa",
  "Otro",
];

export const SCHEMAS = {
  tareas: {
    nuevo: "Nueva tarea",
    fields: [
      { k: "titulo", l: "Título", t: "text", req: true },
      {
        k: "estado",
        l: "Estado",
        t: "select",
        opts: ESTADOS,
        def: "pendiente",
      },
      { k: "tipo", l: "Tipo", t: "select", opts: TIPOS_TAREA, def: "tarea" },
      {
        k: "detalle",
        l: "Qué hay que hacer o decidir",
        t: "area",
        rows: 3,
        opt: true,
      },
      { k: "depende", l: "De qué depende", t: "text", opt: true },
      { k: "limite", l: "Fecha límite", t: "date", opt: true },
    ],
  },
  decisiones: {
    nuevo: "Nueva decisión",
    prefix: "D-",
    fields: [
      { k: "titulo", l: "Título corto", t: "text", req: true },
      { k: "fecha", l: "Fecha", t: "date" },
      {
        k: "fechaNota",
        l: "Nota sobre la fecha",
        t: "text",
        opt: true,
        hint: "Solo si no sabes el día exacto.",
      },
      {
        k: "decision",
        l: "Decisión",
        t: "area",
        rows: 3,
        hint: "Qué se decide, en una o dos frases.",
      },
      { k: "motivo", l: "Motivo", t: "area", rows: 3 },
      {
        k: "alternativas",
        l: "Alternativas consideradas",
        t: "area",
        rows: 3,
        hint: "Qué otras opciones había y por qué no. Los tribunales suelen valorarlo.",
      },
      {
        k: "consecuencias",
        l: "Consecuencias",
        t: "area",
        rows: 3,
        hint: "Qué obliga a hacer o qué descarta.",
      },
      {
        k: "comunicada",
        l: "Comunicada al tutor",
        t: "select",
        opts: COMUNICADA,
        def: "no",
      },
      {
        k: "comunicadaNota",
        l: "Cuándo y por qué medio",
        t: "text",
        opt: true,
      },
    ],
  },
  ia: {
    nuevo: "Nueva entrada de uso de IA",
    prefix: "IA-",
    fields: [
      { k: "titulo", l: "Título corto", t: "text", req: true },
      { k: "fecha", l: "Fecha", t: "date" },
      {
        k: "fechaNota",
        l: "Nota sobre la fecha",
        t: "text",
        opt: true,
        hint: "Solo si no sabes el día exacto.",
      },
      {
        k: "herramienta",
        l: "Herramienta y modelo",
        t: "text",
        hint: "Nombre, modelo y versión si se conoce.",
      },
      {
        k: "fase",
        l: "Fase del trabajo",
        t: "select",
        opts: FASES_IA,
        def: "Implementación",
      },
      {
        k: "tareas",
        l: "Finalidad y tareas",
        t: "area",
        rows: 4,
        hint: "Qué se le pidió y qué produjo.",
      },
      {
        k: "destino",
        l: "Dónde quedó el resultado",
        t: "area",
        rows: 2,
        hint: "Archivo, commit o apartado de la memoria. Escribe «descartado» si no se usó.",
      },
      {
        k: "revision",
        l: "Revisión por el autor",
        t: "area",
        rows: 3,
        hint: "Qué comprobaste, corregiste o rehiciste, y cómo.",
      },
      { k: "revisado", l: "Revisión completada", t: "check" },
      {
        k: "limitaciones",
        l: "Limitaciones observadas",
        t: "area",
        rows: 2,
        opt: true,
        hint: "Errores, invenciones o resultados inservibles.",
      },
    ],
  },
  reuniones: {
    nuevo: "Nueva reunión",
    fields: [
      { k: "titulo", l: "Título", t: "text", req: true },
      { k: "fecha", l: "Fecha", t: "date" },
      { k: "asistentes", l: "Con quién", t: "text", opt: true },
      {
        k: "resumen",
        l: "Resumen de lo hablado",
        t: "area",
        rows: 4,
        hint: "Las observaciones y el feedback recibido.",
      },
      {
        k: "acciones",
        l: "Acciones acordadas",
        t: "area",
        rows: 3,
        opt: true,
      },
      {
        k: "estado",
        l: "Estado de las acciones",
        t: "select",
        opts: ACCIONES,
        def: "pendiente",
      },
    ],
  },
  diario: {
    nuevo: "Nueva entrada del diario",
    fields: [
      { k: "titulo", l: "Título", t: "text", req: true },
      { k: "fecha", l: "Fecha", t: "date" },
      {
        k: "categoria",
        l: "Categoría",
        t: "select",
        opts: CATEGORIAS_DIARIO,
        def: "Avance",
      },
      { k: "texto", l: "Qué pasó", t: "area", rows: 6 },
    ],
  },
  /* Papers, TFG y tesis que se estudian para el trabajo. Los campos siguen el
     orden en que uno se hace las preguntas: primero por qué merece la pena
     leerlo, después qué dice, y al final qué se va a hacer con él. */
  papers: {
    nuevo: "Nuevo paper",
    fields: [
      { k: "titulo", l: "Título", t: "text", req: true },
      { k: "tipo", l: "Tipo", t: "select", opts: TIPOS_PAPER, def: "Paper" },
      { k: "autores", l: "Autores", t: "text" },
      { k: "anio", l: "Año", t: "text", opt: true },
      {
        k: "publicacion",
        l: "Dónde se publicó",
        t: "text",
        opt: true,
        hint: "Revista, congreso o universidad.",
      },
      { k: "url", l: "Enlace", t: "url", opt: true },
      {
        k: "estado",
        l: "Estado de lectura",
        t: "select",
        opts: ESTADOS_LECTURA,
        def: "por-leer",
      },
      {
        k: "relevancia",
        l: "Relevancia para el trabajo",
        t: "select",
        opts: RELEVANCIA,
        def: "media",
      },
      {
        k: "interes",
        l: "Por qué nos interesa",
        t: "area",
        rows: 3,
        hint: "Qué pregunta del trabajo ayuda a responder. Escríbelo antes de leerlo: es lo que justifica dedicarle tiempo.",
      },
      {
        k: "aporta",
        l: "Qué aporta",
        t: "area",
        rows: 4,
        opt: true,
        hint: "La idea central y las contribuciones, con tus palabras.",
      },
      {
        k: "metodo",
        l: "Método y datos",
        t: "area",
        rows: 3,
        opt: true,
        hint: "Cómo lo hacen: técnica, modelo, conjunto de datos, evaluación.",
      },
      { k: "resultados", l: "Resultados", t: "area", rows: 3, opt: true },
      {
        k: "limitaciones",
        l: "Limitaciones y críticas",
        t: "area",
        rows: 3,
        opt: true,
        hint: "Lo que no resuelve o lo que no te convence. Suele ser el hueco donde encaja tu trabajo.",
      },
      {
        k: "uso",
        l: "Qué vamos a usar de él",
        t: "area",
        rows: 3,
        opt: true,
        hint: "Una técnica que reutilizar, una línea base con la que compararse, una métrica, una idea que descartar.",
      },
      {
        k: "seccion",
        l: "Dónde se cita en la memoria",
        t: "text",
        opt: true,
        hint: "Capítulo o apartado.",
      },
      {
        k: "cita",
        l: "Referencia bibliográfica",
        t: "area",
        rows: 2,
        opt: true,
        hint: "Tal como irá en la bibliografía.",
      },
      {
        k: "notas",
        l: "Notas y citas literales",
        t: "area",
        rows: 4,
        opt: true,
      },
    ],
  },
  fuentes: {
    nuevo: "Nuevo recurso",
    fields: [
      { k: "titulo", l: "Título", t: "text", req: true },
      {
        k: "tipo",
        l: "Tipo",
        t: "select",
        opts: TIPOS_FUENTE,
        def: "Documentación",
      },
      { k: "url", l: "Enlace", t: "url", opt: true },
      {
        k: "seccion",
        l: "Dónde se usa",
        t: "text",
        opt: true,
        hint: "Capítulo o apartado de la memoria.",
      },
      {
        k: "cita",
        l: "Referencia bibliográfica",
        t: "area",
        rows: 2,
        opt: true,
        hint: "Tal como irá en la bibliografía.",
      },
      { k: "notas", l: "Notas", t: "area", rows: 4, opt: true },
      { k: "leida", l: "Leída", t: "check" },
    ],
  },
  fechas: {
    nuevo: "Nueva fecha",
    fields: [
      { k: "tramite", l: "Trámite o hito", t: "text", req: true },
      {
        k: "grupo",
        l: "Convocatoria o grupo",
        t: "text",
        opt: true,
        hint: "Por ejemplo «Junio» o «C3». Agrupa las fechas en el calendario.",
      },
      { k: "quien", l: "Quién lo hace", t: "text", opt: true },
      { k: "inicio", l: "Desde", t: "date" },
      {
        k: "fin",
        l: "Hasta",
        t: "date",
        opt: true,
        hint: "Déjalo vacío si es un solo día o una publicación.",
      },
      { k: "clave", l: "Depende de mí", t: "check" },
    ],
  },
  meta: {
    nuevo: "Ficha del trabajo",
    fields: [
      {
        k: "titulo",
        l: "Título del trabajo",
        t: "text",
        hint: "Déjalo vacío mientras no esté decidido.",
      },
      { k: "autor", l: "Autor", t: "text" },
      { k: "tutor", l: "Tutor", t: "text" },
      { k: "titulacion", l: "Titulación", t: "text" },
      { k: "universidad", l: "Universidad", t: "text" },
      { k: "curso", l: "Curso", t: "text" },
      { k: "propuesta", l: "Propuesta o línea", t: "text", opt: true },
      { k: "fase", l: "Fase actual", t: "select", opts: PROCESO, def: "Idea" },
      {
        k: "objetivo",
        l: "Convocatoria objetivo",
        t: "text",
        opt: true,
        hint: "Debe coincidir con el grupo de las fechas, por ejemplo «C3».",
      },
      { k: "reserva", l: "Convocatoria de reserva", t: "text", opt: true },
      {
        k: "fechasComprobadas",
        l: "Fechas oficiales comprobadas el",
        t: "date",
        opt: true,
      },
    ],
  },
};

export const COLLECTIONS = Object.keys(SCHEMAS);

export const VIEWS = [
  { id: "resumen", l: "Resumen" },
  { id: "tareas", l: "Tareas" },
  { id: "papers", l: "Papers" },
  { id: "decisiones", l: "Decisiones" },
  { id: "uso-ia", l: "Uso de IA" },
  { id: "reuniones", l: "Reuniones" },
  { id: "diario", l: "Diario" },
  { id: "fuentes", l: "Recursos" },
  { id: "calendario", l: "Calendario" },
];

export const optValue = (o) => (typeof o === "string" ? o : o.v);
export const optText = (o) => (typeof o === "string" ? o : o.l);
export const optLabel = (opts, v) => {
  const o = opts.find((x) => optValue(x) === v);
  return o ? optText(o) : v || "";
};
