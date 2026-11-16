/* Persistencia en la API de server/api.py.

   Leer es público o no según cómo se configure el servidor
   (BITACORA_PUBLIC_READ). Escribir exige siempre la clave, que se manda en
   la cabecera Authorization y se recuerda en este navegador para no pedirla
   en cada visita. Sin clave válida la página queda en solo lectura. */

const CLAVE_TOKEN = "bitacora-tfg:clave";

function fallo(code, message) {
  return Object.assign(new Error(message), { code });
}

export function remoteBackend(
  api,
  { fetch = globalThis.fetch, storage = globalThis.localStorage } = {}
) {
  const base = api.replace(/\/+$/, "");
  let token = "";
  let sesion = false;

  try {
    token = storage.getItem(CLAVE_TOKEN) || "";
  } catch {
    token = "";
  }

  async function pedir(ruta, { method = "GET", body, clave = token } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (clave) headers.Authorization = `Bearer ${clave}`;
    let res;
    try {
      res = await fetch(base + ruta, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw fallo("network", "sin conexión con el servidor");
    }
    if (res.status === 401 || res.status === 403) {
      throw fallo("auth", "clave no válida");
    }
    if (!res.ok) throw fallo("server", `el servidor respondió ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  const escribir = async (ruta, opciones) => {
    try {
      return await pedir(ruta, opciones);
    } catch (e) {
      if (e.code === "auth") sesion = false;
      throw e;
    }
  };

  return {
    mode: "remote",
    canWrite: () => sesion,
    hasSession: () => sesion,

    async load() {
      if (token) {
        try {
          await pedir("/session");
          sesion = true;
        } catch (e) {
          sesion = false;
          if (e.code === "auth") token = "";
        }
      }
      const res = await pedir("/data");
      return res.data;
    },

    put: (col, id, doc) =>
      escribir(`/docs/${col}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: doc,
      }),

    del: (col, id) =>
      escribir(`/docs/${col}/${encodeURIComponent(id)}`, { method: "DELETE" }),

    replaceAll: (data) => escribir("/data", { method: "PUT", body: { data } }),

    async login(clave) {
      const limpia = clave.trim();
      if (!limpia) return false;
      try {
        await pedir("/session", { clave: limpia });
      } catch (e) {
        if (e.code === "auth") return false;
        throw e;
      }
      token = limpia;
      sesion = true;
      try {
        storage.setItem(CLAVE_TOKEN, token);
      } catch {
        /* sin almacenamiento la sesión dura lo que dure la pestaña */
      }
      return true;
    },

    logout() {
      token = "";
      sesion = false;
      try {
        storage.removeItem(CLAVE_TOKEN);
      } catch {
        /* nada que borrar */
      }
    },
  };
}
