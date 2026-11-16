/* El almacén que usa la interfaz. Guarda una copia en memoria de todos los
   documentos y delega la persistencia en un "backend" intercambiable:

     local.js   → el navegador (localStorage). Modo por defecto.
     remote.js  → la API de server/api.py.

   Un backend expone: mode, load(), put(col, id, doc), del(col, id),
   replaceAll(data), canWrite() y, si procede, login(clave) / logout().

   Forma de los datos: { coleccion: { id: documento } }. */

import { COLLECTIONS } from "../schemas.js";

export function limpiar(data) {
  const out = {};
  for (const col of COLLECTIONS) {
    const docs = data && typeof data === "object" ? data[col] : null;
    out[col] = {};
    if (!docs || typeof docs !== "object") continue;
    for (const [id, doc] of Object.entries(docs)) {
      if (doc && typeof doc === "object" && !Array.isArray(doc)) {
        out[col][id] = doc;
      }
    }
  }
  return out;
}

export function createStore(backend) {
  let data = limpiar({});
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn());

  return {
    mode: backend.mode,
    canWrite: () => backend.canWrite(),
    canLogin: () => typeof backend.login === "function",
    hasSession: () => (backend.hasSession ? backend.hasSession() : false),

    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },

    list: (col) =>
      Object.entries(data[col] || {}).map(([id, doc]) => ({ ...doc, id })),
    get: (col, id) =>
      data[col] && data[col][id] ? { ...data[col][id], id } : null,
    isEmpty: () => COLLECTIONS.every((c) => !Object.keys(data[c]).length),
    snapshot: () => JSON.parse(JSON.stringify(data)),

    async load() {
      data = limpiar(await backend.load());
      emit();
    },

    async set(col, id, doc) {
      const limpio = { ...doc };
      delete limpio.id;
      await backend.put(col, id, limpio);
      data[col][id] = limpio;
      emit();
    },

    async update(col, id, patch) {
      const actual = data[col][id];
      if (!actual)
        throw Object.assign(new Error("no existe"), { code: "missing" });
      await this.set(col, id, { ...actual, ...patch });
    },

    async remove(col, id) {
      await backend.del(col, id);
      delete data[col][id];
      emit();
    },

    async replaceAll(next) {
      const limpio = limpiar(next);
      await backend.replaceAll(limpio);
      data = limpio;
      emit();
    },

    async login(clave) {
      const ok = await backend.login(clave);
      emit();
      return ok;
    },

    logout() {
      backend.logout();
      emit();
    },
  };
}

export const nuevoId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
