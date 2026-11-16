import { describe, expect, it, vi } from "vitest";
import { createStore, limpiar } from "../src/store/store.js";
import { CLAVE, localBackend } from "../src/store/local.js";
import { remoteBackend } from "../src/store/remote.js";
import { DEMO } from "../src/demo.js";
import { COLLECTIONS } from "../src/schemas.js";

function memoria(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe("almacén en el navegador", () => {
  it("arranca vacío: una instalación nueva no trae datos", async () => {
    const store = createStore(localBackend(memoria()));
    await store.load();
    expect(store.isEmpty()).toBe(true);
    expect(store.list("decisiones")).toEqual([]);
  });

  it("guarda, actualiza y borra, y lo conserva entre cargas", async () => {
    const storage = memoria();
    const store = createStore(localBackend(storage));
    await store.load();
    await store.set("decisiones", "D-01", { titulo: "Una", motivo: "" });
    await store.update("decisiones", "D-01", { motivo: "Porque sí" });

    const otra = createStore(localBackend(storage));
    await otra.load();
    expect(otra.get("decisiones", "D-01")).toEqual({
      id: "D-01",
      titulo: "Una",
      motivo: "Porque sí",
    });

    await otra.remove("decisiones", "D-01");
    expect(JSON.parse(storage.getItem(CLAVE)).decisiones).toEqual({});
  });

  it("avisa a quien escucha después de cada cambio", async () => {
    const store = createStore(localBackend(memoria()));
    await store.load();
    const escucha = vi.fn();
    store.subscribe(escucha);
    await store.set("diario", "a", { titulo: "x" });
    expect(escucha).toHaveBeenCalledTimes(1);
  });

  it("sobrevive a datos corruptos en el navegador", async () => {
    const store = createStore(
      localBackend(memoria({ [CLAVE]: "{no es json" }))
    );
    await store.load();
    expect(store.isEmpty()).toBe(true);
  });

  it("no guarda el identificador dentro del documento", async () => {
    const storage = memoria();
    const store = createStore(localBackend(storage));
    await store.load();
    await store.set("tareas", "t1", { id: "t1", titulo: "x" });
    expect(JSON.parse(storage.getItem(CLAVE)).tareas.t1).toEqual({
      titulo: "x",
    });
  });
});

describe("limpiar", () => {
  it("descarta colecciones desconocidas y documentos que no son objetos", () => {
    const out = limpiar({
      tareas: { a: { titulo: "x" }, b: "texto", c: [1] },
      inventada: { z: {} },
    });
    expect(Object.keys(out)).toEqual(COLLECTIONS);
    expect(out.tareas).toEqual({ a: { titulo: "x" } });
  });
});

describe("datos de ejemplo", () => {
  it("solo usan colecciones y campos que existen", () => {
    const demo = DEMO(new Date(2026, 10, 16));
    expect(limpiar(demo)).toEqual(demo);
    expect(demo.meta.tfg.autor).toBe("Ana Ejemplo García");
  });
});

describe("almacén en el servidor", () => {
  function servidor({ clave = "secreta" } = {}) {
    const docs = { tareas: { t1: { titulo: "x" } } };
    const llamadas = [];
    const fetch = async (url, opts = {}) => {
      const auth = (opts.headers || {}).Authorization;
      llamadas.push({ url, method: opts.method || "GET", auth });
      const ok = auth === `Bearer ${clave}`;
      const json = (status, body) => ({
        ok: status < 400,
        status,
        json: async () => body,
      });
      if (url.endsWith("/data") && (opts.method || "GET") === "GET") {
        return json(200, { data: docs });
      }
      if (!ok) return json(401, { error: "auth" });
      if (url.endsWith("/session")) return json(200, { write: true });
      return json(200, { ok: true });
    };
    return { fetch, llamadas };
  }

  it("sin clave se puede leer pero no escribir", async () => {
    const { fetch } = servidor();
    const store = createStore(
      remoteBackend("/api", { fetch, storage: memoria() })
    );
    await store.load();
    expect(store.list("tareas")).toHaveLength(1);
    expect(store.canWrite()).toBe(false);
    await expect(store.set("tareas", "t2", {})).rejects.toMatchObject({
      code: "auth",
    });
    expect(store.list("tareas")).toHaveLength(1);
  });

  it("con la clave correcta entra y manda la cabecera", async () => {
    const { fetch, llamadas } = servidor();
    const storage = memoria();
    const store = createStore(remoteBackend("/api/", { fetch, storage }));
    await store.load();
    expect(await store.login("mala")).toBe(false);
    expect(await store.login(" secreta ")).toBe(true);
    expect(store.canWrite()).toBe(true);
    await store.set("tareas", "t2", { titulo: "y" });
    const put = llamadas.at(-1);
    expect(put).toMatchObject({
      url: "/api/docs/tareas/t2",
      method: "PUT",
      auth: "Bearer secreta",
    });
    store.logout();
    expect(store.canWrite()).toBe(false);
  });
});
