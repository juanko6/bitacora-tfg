// @vitest-environment jsdom
/* Prueba de humo de la interfaz completa sobre un DOM simulado: arranca la
   página como en `npm run dev` (con los datos de ejemplo) y recorre lo que
   haría una persona. */

import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";

/* Un localStorage en memoria. Node trae desde la versión 22 un `localStorage`
   global propio que tapa al del DOM simulado y que, sin fichero configurado,
   no guarda nada; con este la prueba se comporta igual en cualquier versión. */
function almacenEnMemoria() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const boton = (texto, raiz = document) =>
  [...raiz.querySelectorAll("button, a")].find(
    (b) => b.textContent.trim() === texto
  );
const ir = async (hash) => {
  location.hash = hash;
  window.dispatchEvent(new Event("hashchange"));
  await espera();
};
const enviar = async () => {
  $("#dlg-form").dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true })
  );
  await espera(60);
};
const guardado = () => JSON.parse(localStorage.getItem("bitacora-tfg:v1"));

beforeAll(async () => {
  vi.stubGlobal("localStorage", almacenEnMemoria());
  const html = readFileSync("index.html", "utf8");
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
  await import("../src/main.js");
  await espera(80);
});

describe("interfaz", () => {
  it("en desarrollo arranca con los datos de ejemplo", () => {
    expect($("#h-title").textContent).toContain("plagas en cítricos");
    expect($$(".tab").map((t) => t.firstChild.textContent)).toEqual([
      "Resumen",
      "Tareas",
      "Papers",
      "Decisiones",
      "Uso de IA",
      "Reuniones",
      "Diario",
      "Recursos",
      "Calendario",
    ]);
    expect($$(".tile")).toHaveLength(5);
    expect($$(".step.current .step-l")[0].textContent).toBe("Desarrollo");
  });

  it("el resumen cuenta lo que queda por completar", () => {
    const cifras = Object.fromEntries(
      $$(".tile").map((t) => [
        t.querySelector(".tile-l").textContent,
        Number(t.querySelector(".tile-n").textContent),
      ])
    );
    expect(cifras["tareas abiertas"]).toBe(4);
    expect(cifras["reuniones con acciones pendientes"]).toBe(1);
    expect(cifras["decisiones sin comunicar al tutor"]).toBe(1);
    expect(cifras["usos de IA con la revisión sin cerrar"]).toBe(1);
    expect(cifras["papers por leer"]).toBe(2);
  });

  it("ordena los papers por estado y relevancia y señala los que no dicen por qué interesan", async () => {
    await ir("papers");
    expect(
      $$(".row .row-title").map((t) => t.textContent.slice(0, 12))
    ).toEqual(["Aplicación m", "Aumento de d", "Una revisión", "Detección de"]);
    const sinPorque = $$(".row").filter((r) =>
      r.querySelector(".chips").textContent.includes("Falta el porqué")
    );
    expect(sinPorque).toHaveLength(1);
    expect($$(".tab")[2].querySelector(".badge").textContent).toBe("1");

    $("#chk-papers-alta").click();
    await espera();
    expect($$(".row")).toHaveLength(2);
    $("#chk-papers-alta").click();
    await espera();
  });

  it("guarda un paper con su porqué y lo hace avanzar de estado", async () => {
    boton("Nuevo paper").click();
    await espera();
    expect($("#dlg").hasAttribute("open")).toBe(true);
    $("#f-papers-titulo").value = "Paper de prueba";
    $("#f-papers-autores").value = "A. Prueba";
    $("#f-papers-interes").value = "Responde a la pregunta principal.";
    await enviar();
    const [id, doc] = Object.entries(guardado().papers).find(
      ([, p]) => p.titulo === "Paper de prueba"
    );
    expect(doc).toMatchObject({
      tipo: "Paper",
      estado: "por-leer",
      relevancia: "media",
      interes: "Responde a la pregunta principal.",
    });

    boton("Empezar a leer").click();
    await espera(60);
    expect(guardado().papers[id].estado).toBe("leyendo");
    boton("Marcar como leído").click();
    await espera(60);
    expect(guardado().papers[id].estado).toBe("leido");
  });

  it("el panel se cierra con animación y se puede reabrir mientras tanto", async () => {
    await espera(260);
    expect($("#dlg").hasAttribute("open")).toBe(false);
    boton("Nuevo paper").click();
    await espera();
    $("#dlg-close").click();
    expect($("#dlg").classList.contains("closing")).toBe(true);
    expect($("#dlg").hasAttribute("open")).toBe(true);
    boton("Nuevo paper").click();
    await espera(260);
    expect($("#dlg").hasAttribute("open")).toBe(true);
    expect($("#dlg").classList.contains("closing")).toBe(false);
    boton("Cancelar").click();
    await espera(260);
    expect($("#dlg").hasAttribute("open")).toBe(false);
  });

  it("crea una decisión numerada, la edita y la quita en dos pasos", async () => {
    await ir("decisiones");
    expect($$(".row")).toHaveLength(3);

    boton("Nueva decisión").click();
    await espera();
    $("#f-decisiones-titulo").value = "Decisión de prueba";
    await enviar();
    expect(guardado().decisiones["D-04"]).toMatchObject({
      num: 4,
      titulo: "Decisión de prueba",
      comunicada: "no",
    });
    expect($$(".row .mark")[0].textContent).toBe("D-04");
    expect($(".row .chips").textContent).toContain("Motivo por completar");

    boton("Editar", $(".row")).click();
    await espera();
    $("#f-decisiones-motivo").value = "Por un buen motivo";
    await enviar();
    expect(guardado().decisiones["D-04"].motivo).toBe("Por un buen motivo");
    expect(guardado().decisiones["D-04"].titulo).toBe("Decisión de prueba");

    const quitar = boton("Borrar", $(".row"));
    quitar.click();
    await espera();
    expect(guardado().decisiones["D-04"]).toBeDefined();
    expect(quitar.textContent).toBe("Confirmar borrado");
    quitar.click();
    await espera(60);
    expect(guardado().decisiones["D-04"]).toBeUndefined();
    expect($$(".row")).toHaveLength(3);
  });

  it("no guarda una entrada sin título", async () => {
    boton("Nueva decisión").click();
    await espera();
    await enviar();
    expect(Object.keys(guardado().decisiones)).toHaveLength(3);
    boton("Cancelar").click();
  });

  it("filtra y busca", async () => {
    $("#chk-decisiones-sinComunicar").click();
    await espera();
    expect($$(".row .mark").map((m) => m.textContent)).toEqual(["D-03"]);
    $("#chk-decisiones-sinComunicar").click();
    const q = $("#q-decisiones");
    q.value = "plaga";
    q.dispatchEvent(new Event("input"));
    await espera();
    expect($$(".row .mark").map((m) => m.textContent)).toEqual(["D-01"]);
  });

  it("mueve una tarea de columna desde el tablero", async () => {
    await ir("tareas");
    const cuenta = () => $$(".col .count").map((c) => Number(c.textContent));
    expect(cuenta()).toEqual([3, 1, 2]);
    const selector = $(".col .card select");
    selector.value = "hecho";
    selector.dispatchEvent(new Event("change"));
    await espera(60);
    expect(cuenta()).toEqual([2, 1, 3]);
  });

  it("marca como revisado un uso de IA solo si se escribió la revisión", async () => {
    await ir("uso-ia");
    const fila = $$(".row").find((r) => r.textContent.includes("IA-02"));
    fila.querySelector(".row-head").click();
    await espera();
    expect(boton("Marcar como revisada").disabled).toBe(true);
    boton("Editar").click();
    await espera();
    $("#f-ia-revision").value = "Probé el script con tres carpetas.";
    await enviar();
    boton("Marcar como revisada").click();
    await espera(60);
    expect(guardado().ia["IA-02"].revisado).toBe(true);
  });

  it("enlaza solo direcciones web en las fuentes", async () => {
    await ir("fuentes");
    $$(".row-head")[0].click();
    await espera();
    const enlace = $(".row-body a");
    expect(enlace.getAttribute("href")).toMatch(/^https:\/\//);
    expect(enlace.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("no interpreta como HTML lo que escribe el usuario", async () => {
    await ir("diario");
    boton("Nueva entrada").click();
    await espera();
    $("#f-diario-titulo").value = '<img src=x onerror="window.pwn=1">';
    await enviar();
    expect($(".row-title").textContent).toBe(
      '<img src=x onerror="window.pwn=1">'
    );
    expect($(".row-title img")).toBeNull();
    expect(window.pwn).toBeUndefined();
  });

  it("agrupa el calendario y señala la convocatoria objetivo", async () => {
    await ir("calendario");
    expect($$("#view h2").map((h) => h.textContent)).toEqual([
      "Junio · objetivo",
      "Julio · reserva",
    ]);
    expect($$("tbody tr")).toHaveLength(6);
    expect($("tbody tr td:last-child").textContent).toContain("Editar");
  });

  it("al vaciar queda en blanco, como una instalación nueva", async () => {
    await ir("resumen");
    const vaciar = boton("Vaciar todo");
    vaciar.click();
    await espera();
    vaciar.click();
    await espera(60);
    expect($(".welcome h2").textContent).toBe("Tu bitácora está vacía");
    expect($("#h-title").textContent).toBe("Bitácora de TFG");
    expect(boton("Ver con datos de ejemplo")).toBeDefined();
    expect(Object.values(guardado()).every((c) => !Object.keys(c).length)).toBe(
      true
    );
  });

  it("guarda la ficha y la refleja en la cabecera", async () => {
    boton("Rellenar la ficha").click();
    await espera();
    $("#f-meta-titulo").value = "Mi trabajo";
    $("#f-meta-autor").value = "Yo";
    await enviar();
    expect($("#h-title").textContent).toBe("Mi trabajo");
    expect($("#h-meta").textContent).toContain("Yo");
    expect(document.title).toBe("Mi trabajo · Bitácora");
  });
});
