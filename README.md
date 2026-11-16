# Bitácora de TFG

Una página para llevar un TFG, un TFM o una tesis de principio a fin: qué hay que hacer, qué se decidió y por qué, qué se habló con el tutor, qué se leyó y cuándo vence cada plazo.

Se puede usar tal cual, sin instalar nada en ningún servidor: los datos se guardan en tu navegador. Si tienes un servidor propio, incluye una API mínima para tenerlos en todos tus dispositivos.

**Stack:** JavaScript sin framework + [Vite](https://vite.dev). Sin dependencias en el navegador. La API opcional es un único fichero de Python que solo usa la biblioteca estándar.

## Qué lleva

| Pestaña | Para qué |
|---|---|
| **Resumen** | Fase del trabajo, lo que requiere tu atención, próximos plazos y la ficha del trabajo. |
| **Tareas** | Tablero de tres columnas (por hacer, en curso, hecho) para tareas, decisiones por tomar y consultas. |
| **Papers** | Los papers, TFG y tesis que se estudian: por qué interesa cada uno, qué aporta, método, resultados, limitaciones, qué se va a usar de él y dónde se cita. Con estado de lectura y relevancia. Es la base del estado del arte. |
| **Decisiones** | Cada decisión con su motivo, las alternativas descartadas, sus consecuencias y si ya se la comunicaste al tutor. Es el "estudio de alternativas" que suelen valorar los tribunales. |
| **Uso de IA** | Registro de cada uso de herramientas de IA: para qué, dónde quedó el resultado y qué revisaste tú. Es la materia prima de la declaración de uso de IA que cada vez más reglamentos exigen como anexo. |
| **Reuniones** | Lo que se habló con el tutor y las acciones que quedaron. |
| **Diario** | Notas de trabajo: avances, bloqueos e ideas. |
| **Recursos** | Documentación, herramientas y normativa: lo que no es un paper, con el apartado de la memoria donde se usa. |
| **Calendario** | Los plazos oficiales de tu centro, con cuenta atrás. |

Papers, decisiones, uso de IA, reuniones, diario y recursos se copian a Markdown con un botón, para pegarlos en la memoria o enviárselos al tutor.

Los formularios se abren en un panel que entra desde la derecha, y el tema es oscuro siempre.

La estructura combina dos ideas: la bitácora de decisiones y de uso de IA que pide la normativa de algunos centros, y las secciones de la [plantilla de tesis para Notion](https://santiagofs.com/plantilla-tesis) de Santiago Fernández Scagliusi (proceso, tareas, artículos, diario, recursos y reuniones).

## Empezar

Hace falta [Node](https://nodejs.org) 22 o posterior.

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173. **En desarrollo la bitácora arranca con datos de ejemplo** (un TFG inventado), para ver cómo queda llena. Están en [`src/demo.js`](src/demo.js).

**El build de producción arranca en blanco.** Quien abra la página desplegada ve una bitácora vacía y un botón para rellenar su ficha. Si quiere, puede cargar el ejemplo con «Ver con datos de ejemplo» y vaciarlo después.

| Orden | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Genera `dist/`, que es lo que se publica |
| `npm run preview` | Sirve `dist/` en local para revisar el build |
| `npm run lint` | ESLint y Prettier |
| `npm test` | Pruebas de la página (Vitest) |
| `npm run test:api` | Pruebas de la API (unittest de Python) |
| `npm run api` | Arranca la API en local, en el puerto 8787 |
| `npm run deploy` | Publica en tu servidor (ver [Publicarla](#publicarla)) |

## Dónde se guardan los datos

Hay dos modos y se elige al construir, con la variable `VITE_API_URL`.

**En el navegador (por defecto).** Sin `VITE_API_URL`, todo se guarda en el `localStorage` del navegador de quien usa la página. No se envía nada a ningún sitio. A cambio, los datos no se sincronizan entre dispositivos y se pierden si se borran los datos del navegador: en Resumen hay un botón «Exportar copia» que baja un fichero JSON, y otro para importarlo.

**En tu servidor.** Con `VITE_API_URL=/api`, la página lee y escribe en la API de [`server/api.py`](server/api.py), que guarda documentos JSON en un fichero SQLite. Leer puede ser público o privado; escribir exige siempre una clave, que se introduce una vez con «Entrar para editar» y se recuerda en ese navegador.

Para probar el modo servidor en local:

```bash
BITACORA_TOKEN=prueba npm run api
```

```bash
VITE_API_URL=/api npm run dev
```

La clave de edición es entonces `prueba`. Vite reenvía `/api` a la API local.

## Publicarla

`dist/` son ficheros estáticos: sirven en cualquier alojamiento (GitHub Pages, Netlify, un bucket, tu propio nginx). Las rutas son relativas, así que funciona igual en la raíz de un dominio que en un subdirectorio.

Si tienes un servidor con nginx, el directorio [`deploy/`](deploy/) trae el flujo completo desde tu máquina: instalación del servidor, certificado, publicación con `rsync`, copias de seguridad y restauración. Está explicado en [`deploy/README.md`](deploy/README.md). En corto:

```bash
cp deploy/deploy.env.example deploy/deploy.env
```

Edita `deploy/deploy.env` con tu servidor y tu dominio, y después:

```bash
./deploy/setup-server.sh
```

```bash
npm run deploy
```

## Adaptarla

- **Colores.** La banda de cabecera y el color de acento son dos variables al principio de [`src/styles.css`](src/styles.css): `--band` y `--accent`. Cámbialas por los de tu centro. El tema es oscuro siempre; si prefieres uno claro, cambia el resto de variables de ese mismo bloque y `color-scheme`.
- **Campos y secciones.** Todo lo que se guarda está descrito en [`src/schemas.js`](src/schemas.js). Añadir un campo ahí basta para que aparezca en el formulario, en la ficha y en la exportación a Markdown. Si añades una colección nueva, añádela también a `COLLECTIONS` en `server/api.py`.
- **Fases del trabajo, categorías, tipos.** Son listas en el mismo fichero.
- **Datos de ejemplo.** [`src/demo.js`](src/demo.js).

## Estructura

```
.
├── index.html
├── src/
│   ├── main.js            # la interfaz: vistas, formularios, navegación
│   ├── schemas.js         # qué se guarda y con qué campos
│   ├── derive.js          # fechas, estados, exportación a Markdown (sin DOM)
│   ├── dom.js             # creación de nodos
│   ├── demo.js            # datos de ejemplo
│   ├── styles.css
│   └── store/
│       ├── store.js       # almacén en memoria + avisos de cambio
│       ├── local.js       # persistencia en el navegador
│       └── remote.js      # persistencia en la API
├── server/
│   ├── api.py             # la API: Python estándar + SQLite
│   └── test_api.py
├── tests/                 # pruebas de la página
└── deploy/                # instalación y publicación en un servidor propio
```

## Privacidad y seguridad

- En modo navegador no hay servidor que reciba nada: los datos no salen del equipo.
- En modo servidor, **la lectura es pública por defecto**. Una bitácora contiene nombres, decisiones a medias y asuntos académicos: si no quieres que se lea, pon `DEPLOY_PUBLIC_READ=0`.
- La clave de edición se genera en el servidor, se guarda en un fichero que solo lee root y viaja únicamente por HTTPS. La instalación no publica la API hasta que hay certificado.
- La página nunca inserta como HTML lo que escribe el usuario, y la configuración de nginx incluida añade una política de seguridad de contenido que solo deja ejecutar código del propio sitio.
- Las tipografías se cargan de Google Fonts. Si no quieres esa petición a un tercero, quita el `<link>` de `index.html`: la página usa entonces las fuentes del sistema.

## Licencia

[MIT](LICENSE). Úsala, cámbiala y compártela.
