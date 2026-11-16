import { describe, expect, it } from "vitest";
import {
  decSinComunicar,
  estadoFecha,
  nextNumbered,
  numOf,
  reunionPendiente,
  safeUrl,
  toMarkdown,
  vencimiento,
} from "../src/derive.js";

const HOY = new Date(2026, 10, 16); // 16 de noviembre de 2026

describe("estadoFecha", () => {
  it("marca como cerrado un plazo que ya terminó", () => {
    const e = estadoFecha({ inicio: "2026-10-01", fin: "2026-10-31" }, HOY);
    expect(e.k).toBe("past");
    expect(e.key).toBeNull();
  });

  it("cuenta los días que faltan para que empiece", () => {
    const e = estadoFecha({ inicio: "2027-04-07", fin: "2027-04-21" }, HOY);
    expect(e.txt).toBe("Empieza en 142 días");
    expect(e.k).toBe("future");
  });

  it("avisa cuando empieza en 30 días o menos", () => {
    expect(estadoFecha({ inicio: "2026-12-01" }, HOY).k).toBe("soon");
    expect(estadoFecha({ inicio: "2026-11-17" }, HOY).txt).toBe(
      "Empieza mañana"
    );
  });

  it("cuenta los días que quedan de un plazo en curso", () => {
    const e = estadoFecha({ inicio: "2026-11-10", fin: "2026-11-20" }, HOY);
    expect(e).toMatchObject({ k: "now", txt: "En curso, quedan 4 días" });
  });

  it("incluye el último día del plazo", () => {
    const e = estadoFecha({ inicio: "2026-11-10", fin: "2026-11-16" }, HOY);
    expect(e.txt).toBe("Termina hoy");
  });

  it("trata una fecha suelta como un solo día", () => {
    expect(estadoFecha({ inicio: "2026-11-16" }, HOY).txt).toBe("Es hoy");
    expect(estadoFecha({ inicio: "2026-11-15" }, HOY).k).toBe("past");
  });
});

describe("vencimiento", () => {
  it("no dice nada sin fecha límite", () => {
    expect(vencimiento("", HOY)).toBeNull();
  });
  it("distingue vencida, hoy, esta semana y más adelante", () => {
    expect(vencimiento("2026-11-10", HOY).clase).toBe("crit");
    expect(vencimiento("2026-11-16", HOY).txt).toBe("Vence hoy");
    expect(vencimiento("2026-11-17", HOY).txt).toBe("Vence en 1 día");
    expect(vencimiento("2026-11-20", HOY).txt).toBe("Vence en 4 días");
    expect(vencimiento("2027-01-20", HOY).clase).toBe("");
  });
});

describe("numeración", () => {
  it("saca el número del campo o del identificador", () => {
    expect(numOf({ id: "D-07" })).toBe(7);
    expect(numOf({ id: "D-07", num: 12 })).toBe(12);
  });

  it("da el siguiente al mayor, no al recuento", () => {
    const items = [{ id: "D-01" }, { id: "D-04" }];
    expect(nextNumbered(items, "D-")).toEqual({ num: 5, id: "D-05" });
  });

  it("empieza en 01", () => {
    expect(nextNumbered([], "IA-").id).toBe("IA-01");
  });
});

describe("pendientes", () => {
  it("una decisión sin el campo cuenta como no comunicada", () => {
    expect(decSinComunicar({})).toBe(true);
    expect(decSinComunicar({ comunicada: "acordada" })).toBe(false);
  });

  it("una reunión sin acciones escritas no está pendiente", () => {
    expect(reunionPendiente({ estado: "pendiente", acciones: "" })).toBe(false);
    expect(reunionPendiente({ estado: "pendiente", acciones: "x" })).toBe(true);
    expect(reunionPendiente({ estado: "hecho", acciones: "x" })).toBe(false);
  });
});

describe("toMarkdown", () => {
  it("escribe una entrada por decisión y señala lo que falta", () => {
    const md = toMarkdown(
      "decisiones",
      [
        {
          id: "D-01",
          titulo: "Una sola plaga",
          fecha: "2026-11-16",
          decision: "Solo el minador.",
          motivo: "",
          comunicada: "acordada",
        },
      ],
      "Bitácora de decisiones"
    );
    expect(md).toContain("# Bitácora de decisiones");
    expect(md).toContain("### D-01 · Una sola plaga");
    expect(md).toContain("- **Fecha:** 16 nov 2026");
    expect(md).toContain("- **Motivo:** _por completar._");
    expect(md).toContain("- **Comunicada al tutor:** Acordada con el tutor");
  });
});

describe("safeUrl", () => {
  it("solo deja pasar direcciones web", () => {
    expect(safeUrl("https://example.org/a")).toBe("https://example.org/a");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("")).toBe("");
  });
});
