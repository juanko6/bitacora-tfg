/* Datos de ejemplo. Todo es inventado: la autora, el tutor y el trabajo no
   existen. Sirven para ver la bitácora llena antes de empezar la propia.

   Las fechas se calculan respecto al día en que se cargan, para que el
   ejemplo tenga siempre plazos pasados, en curso y futuros. */

import { hoyISO } from "./derive.js";

function dia(desplazamiento, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + desplazamiento);
  return hoyISO(d);
}

export function DEMO(base = new Date()) {
  const d = (n) => dia(n, base);
  const creado = base.toISOString();

  return {
    meta: {
      tfg: {
        titulo:
          "Detección temprana de plagas en cítricos con visión por computador",
        autor: "Ana Ejemplo García",
        tutor: "Luis Muestra Pérez",
        titulacion: "Grado en Ingeniería Informática",
        universidad: "Universidad de Ejemplo",
        curso: "2026-27",
        propuesta: "Visión por computador aplicada a la agricultura",
        fase: "Desarrollo",
        objetivo: "Junio",
        reserva: "Julio",
        fechasComprobadas: d(-12),
      },
    },

    tareas: {
      t1: {
        titulo: "Etiquetar las 400 fotos que faltan del conjunto de datos",
        estado: "curso",
        tipo: "tarea",
        detalle:
          "Quedan las de la segunda visita al huerto. Usar las mismas cuatro clases.",
        depende: "",
        limite: d(5),
        creado,
      },
      t2: {
        titulo: "Elegir la métrica principal de evaluación",
        estado: "pendiente",
        tipo: "decision",
        detalle:
          "F1 por clase o mAP. Condiciona cómo se presentan los resultados.",
        depende: "Lectura de los dos artículos de referencia",
        limite: d(12),
        creado,
      },
      t3: {
        titulo: "Preguntar al tutor si la memoria puede ir en inglés",
        estado: "pendiente",
        tipo: "consulta",
        detalle: "",
        depende: "Próxima reunión",
        limite: "",
        creado,
      },
      t4: {
        titulo: "Escribir el capítulo de metodología",
        estado: "pendiente",
        tipo: "tarea",
        detalle:
          "Con el diagrama del flujo de datos y la justificación del modelo elegido.",
        depende: "D-02",
        limite: d(30),
        creado,
      },
      t5: {
        titulo: "Montar el repositorio y la integración continua",
        estado: "hecho",
        tipo: "tarea",
        detalle: "",
        depende: "",
        limite: d(-40),
        creado,
      },
      t6: {
        titulo: "Delimitar el tema y los objetivos",
        estado: "hecho",
        tipo: "tarea",
        detalle:
          "Objetivo general y cuatro específicos, acordados con el tutor.",
        depende: "",
        limite: d(-60),
        creado,
      },
    },

    decisiones: {
      "D-01": {
        num: 1,
        titulo: "El trabajo se centra en una sola plaga",
        fecha: d(-58),
        fechaNota: "",
        decision:
          "El sistema detecta solo el minador de los cítricos, no un catálogo de plagas.",
        motivo:
          "Con un curso de plazo no hay tiempo para reunir datos fiables de varias plagas, y una sola permite evaluar con rigor.",
        alternativas:
          "Clasificar cinco plagas con un conjunto de datos público; se descartó porque las imágenes no son de campo.",
        consecuencias:
          "El conjunto de datos es propio y hay que etiquetarlo a mano. La memoria debe declarar el alcance como limitación.",
        comunicada: "acordada",
        comunicadaNota: "En la primera reunión",
        creado,
      },
      "D-02": {
        num: 2,
        titulo: "Modelo de detección ligero en vez de uno grande",
        fecha: d(-31),
        fechaNota: "",
        decision:
          "Se entrena un detector ligero que pueda ejecutarse en un móvil de gama media.",
        motivo:
          "El uso previsto es en el huerto, sin cobertura. Un modelo que solo funcione en servidor no resuelve el problema.",
        alternativas:
          "Un modelo grande ejecutado en la nube; mejor precisión esperada, pero depende de la conexión.",
        consecuencias:
          "Hay que medir tiempo de inferencia y tamaño además de la precisión.",
        comunicada: "si",
        comunicadaNota: "Por correo",
        creado,
      },
      "D-03": {
        num: 3,
        titulo: "Aumento de datos con cambios de iluminación",
        fecha: d(-9),
        fechaNota: "",
        decision:
          "Se añade aumento de datos de brillo y contraste durante el entrenamiento.",
        motivo: "",
        alternativas: "Hacer más fotos a distintas horas del día.",
        consecuencias:
          "Hay que comparar resultados con y sin aumento para justificarlo.",
        comunicada: "no",
        comunicadaNota: "",
        creado,
      },
    },

    ia: {
      "IA-01": {
        num: 1,
        titulo: "Resumen de artículos para el estado del arte",
        fecha: d(-45),
        fechaNota: "",
        herramienta: "Asistente conversacional (anotar aquí nombre y versión)",
        fase: "Estado del arte",
        tareas:
          "Pedí un resumen de seis artículos sobre detección de plagas y una tabla comparando sus métodos.",
        destino: "Notas del capítulo 2. La tabla se rehízo a mano.",
        revision:
          "Leí los seis artículos completos. Dos cifras de la tabla estaban mal y las corregí con los valores de los originales.",
        revisado: true,
        limitaciones: "Atribuyó a un artículo un resultado que era de otro.",
        creado,
      },
      "IA-02": {
        num: 2,
        titulo: "Script de carga del conjunto de datos",
        fecha: d(-20),
        fechaNota: "",
        herramienta: "Asistente de programación (anotar aquí nombre y versión)",
        fase: "Implementación",
        tareas:
          "Generar el script que lee las anotaciones y las divide en entrenamiento, validación y prueba.",
        destino: "src/datos/cargar.py",
        revision: "",
        revisado: false,
        limitaciones: "",
        creado,
      },
    },

    reuniones: {
      r1: {
        titulo: "Primera reunión: alcance del trabajo",
        fecha: d(-58),
        asistentes: "Tutor",
        resumen:
          "Le parece bien centrarlo en una sola plaga. Insiste en que el conjunto de datos sea propio y esté bien documentado.",
        acciones: "Enviar los objetivos por escrito antes del viernes.",
        estado: "hecho",
        creado,
      },
      r2: {
        titulo: "Seguimiento: primeros resultados",
        fecha: d(-7),
        asistentes: "Tutor",
        resumen:
          "Los resultados son prometedores pero hay pocas imágenes con poca luz. Pide comparar con una línea base sencilla.",
        acciones:
          "Añadir una línea base con un clasificador clásico. Hacer fotos al atardecer.",
        estado: "pendiente",
        creado,
      },
    },

    diario: {
      j1: {
        titulo: "El entrenamiento converge por fin",
        fecha: d(-3),
        categoria: "Avance",
        texto:
          "Bajando la tasa de aprendizaje el modelo deja de oscilar. F1 de 0,81 en validación. Falta probar con las fotos nuevas.",
        creado,
      },
      j2: {
        titulo: "Las etiquetas de la primera tanda tienen errores",
        fecha: d(-11),
        categoria: "Bloqueo",
        texto:
          "Revisando a mano encuentro cajas mal ajustadas en una de cada diez fotos. Hay que repasarlas antes de seguir entrenando.",
        creado,
      },
      j3: {
        titulo: "Idea: mostrar un mapa de calor al usuario",
        fecha: d(-16),
        categoria: "Idea",
        texto:
          "En vez de solo la caja, enseñar qué zona de la hoja ha pesado más en la decisión. Ayudaría a justificar el resultado ante el tribunal.",
        creado,
      },
    },

    // Referencias inventadas: ni los títulos ni los autores existen.
    papers: {
      p1: {
        titulo:
          "Detección de plagas en hojas con redes convolucionales ligeras",
        tipo: "Paper",
        autores: "N. Apellido, M. Otro",
        anio: "2024",
        publicacion: "Revista de Ejemplo de Visión Artificial",
        url: "https://example.org/paper-de-ejemplo",
        estado: "leido",
        relevancia: "alta",
        interes:
          "Es el trabajo más cercano al nuestro: detecta plagas en hojas con un modelo pensado para móvil. Sirve para saber qué precisión es razonable esperar.",
        aporta:
          "Propone podar el detector hasta un tercio de su tamaño perdiendo dos puntos de precisión, y publica su conjunto de datos.",
        metodo:
          "Detector de una etapa, podado y cuantizado. 3.000 imágenes de laboratorio, cuatro clases. Evalúa con mAP y tiempo de inferencia en dos móviles.",
        resultados:
          "mAP de 0,84 con 38 ms por imagen en un móvil de gama media.",
        limitaciones:
          "Las fotos son de laboratorio, con fondo uniforme. No prueba en campo ni con poca luz, que es justo nuestro caso.",
        uso: "Su modelo podado como línea base, y la misma pareja de métricas (mAP y tiempo de inferencia) para poder compararnos.",
        seccion: "Capítulo 2 · Estado del arte; capítulo 5 · Resultados",
        cita: "APELLIDO, N. y OTRO, M., 2024. Título del artículo de ejemplo. Revista de Ejemplo, 12(3), 45-67.",
        notas:
          "La tabla 3 compara seis detectores: útil para situar el nuestro.",
        creado,
      },
      p2: {
        titulo:
          "Aplicación móvil para el diagnóstico de enfermedades del olivo",
        tipo: "TFG",
        autores: "C. Estudiante Ficticia",
        anio: "2025",
        publicacion: "Universidad de Ejemplo",
        url: "https://example.org/tfg-de-ejemplo",
        estado: "leyendo",
        relevancia: "media",
        interes:
          "Un TFG reciente de la misma titulación sobre un problema parecido: enseña qué estructura de memoria y qué nivel de detalle se espera.",
        aporta: "",
        metodo:
          "Clasificador de imágenes servido desde una API, con aplicación móvil como cliente.",
        resultados: "",
        limitaciones: "",
        uso: "La estructura del capítulo de evaluación y la forma de presentar el análisis de costes.",
        seccion: "Capítulo 2 · Estado del arte",
        cita: "",
        notas: "",
        creado,
      },
      p3: {
        titulo: "Aumento de datos para imágenes agrícolas tomadas en campo",
        tipo: "Paper",
        autores: "R. Inventado, S. Supuesta, T. Ejemplar",
        anio: "2023",
        publicacion: "Congreso de Ejemplo sobre Agricultura de Precisión",
        url: "https://example.org/otro-paper",
        estado: "por-leer",
        relevancia: "alta",
        interes:
          "Puede justificar la decisión D-03 (aumento de datos con cambios de iluminación), que ahora no tiene motivo escrito.",
        aporta: "",
        metodo: "",
        resultados: "",
        limitaciones: "",
        uso: "",
        seccion: "",
        cita: "",
        notas: "",
        creado,
      },
      p4: {
        titulo: "Una revisión de la detección de objetos en tiempo real",
        tipo: "Paper",
        autores: "V. Imaginaria",
        anio: "2022",
        publicacion: "",
        url: "",
        estado: "por-leer",
        relevancia: "media",
        interes: "",
        aporta: "",
        metodo: "",
        resultados: "",
        limitaciones: "",
        uso: "",
        seccion: "",
        cita: "",
        notas: "Recomendado por el tutor en la última reunión.",
        creado,
      },
    },

    fuentes: {
      f2: {
        titulo: "Documentación de la biblioteca de detección",
        tipo: "Documentación",
        url: "https://example.org/docs",
        seccion: "Capítulo 4 · Implementación",
        cita: "",
        notas: "",
        leida: false,
        creado,
      },
      f3: {
        titulo: "Reglamento del TFG de la titulación",
        tipo: "Normativa",
        url: "",
        seccion: "Formato y entrega",
        cita: "",
        notas:
          "Márgenes, interlineado y qué se entrega. Releer antes de maquetar.",
        leida: true,
        creado,
      },
    },

    fechas: {
      a1: {
        tramite: "Solicitud de defensa",
        grupo: "Junio",
        quien: "Estudiante",
        inicio: d(-4),
        fin: d(10),
        clave: true,
      },
      a2: {
        tramite: "Entrega de la memoria",
        grupo: "Junio",
        quien: "Estudiante",
        inicio: d(8),
        fin: d(45),
        clave: true,
      },
      a3: {
        tramite: "Defensa ante el tribunal",
        grupo: "Junio",
        quien: "Tribunal",
        inicio: d(56),
        fin: d(68),
        clave: true,
      },
      b1: {
        tramite: "Solicitud de defensa",
        grupo: "Julio",
        quien: "Estudiante",
        inicio: d(53),
        fin: d(80),
        clave: true,
      },
      b2: {
        tramite: "Entrega de la memoria",
        grupo: "Julio",
        quien: "Estudiante",
        inicio: d(72),
        fin: d(90),
        clave: true,
      },
      b3: {
        tramite: "Defensa ante el tribunal",
        grupo: "Julio",
        quien: "Tribunal",
        inicio: d(100),
        fin: d(111),
        clave: true,
      },
    },
  };
}
