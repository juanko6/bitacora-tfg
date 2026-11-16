/* Persistencia en el navegador. Todo va en una sola clave de localStorage:
   una bitácora ocupa decenas de kilobytes, muy por debajo del límite, y una
   sola clave hace que guardar sea atómico.

   Los datos viven en este navegador y en este dispositivo. No se sincronizan:
   la copia de seguridad es «Exportar» en la pestaña Resumen. */

export const CLAVE = "bitacora-tfg:v1";

export function localBackend(storage = globalThis.localStorage) {
  let data = {};

  const guardar = () => {
    try {
      storage.setItem(CLAVE, JSON.stringify(data));
    } catch {
      throw Object.assign(new Error("almacenamiento lleno o bloqueado"), {
        code: "storage",
      });
    }
  };

  return {
    mode: "local",
    canWrite: () => true,

    async load() {
      try {
        const raw = storage.getItem(CLAVE);
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      return data;
    },

    async put(col, id, doc) {
      data[col] = { ...(data[col] || {}), [id]: doc };
      guardar();
    },

    async del(col, id) {
      if (data[col]) delete data[col][id];
      guardar();
    },

    async replaceAll(next) {
      data = next;
      guardar();
    },
  };
}
