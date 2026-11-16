import { defineConfig } from "vite";

/* `base: "./"` deja las rutas relativas en el build, así el mismo `dist/`
   funciona en la raíz de un dominio, en un subdirectorio o en GitHub Pages
   sin recompilar.

   En desarrollo, `/api` se reenvía a la API local (`npm run api`) para poder
   probar el modo servidor con `VITE_API_URL=/api`. */
export default defineConfig({
  base: "./",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  test: {
    environment: "node",
  },
});
