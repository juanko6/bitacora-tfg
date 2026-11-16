# Publicar en un servidor propio

Runbook del flujo de despliegue. Todo se lanza desde tu máquina: en el servidor no hay build, ni Node, ni contenedores. Lo único que corre allí es nginx y, si la activas, la API (un proceso de Python).

## Requisitos

En el servidor: Ubuntu o Debian con `nginx`, `certbot` con el plugin de nginx, `python3`, `rsync` y `curl`, y un usuario con `sudo` sin contraseña.

En tu máquina: acceso por SSH con clave pública y `dig` (viene con macOS y con el paquete `dnsutils`).

Un dominio o subdominio cuyo registro A puedas apuntar al servidor.

## Configuración

```bash
cp deploy/deploy.env.example deploy/deploy.env
```

| Variable | Qué es |
|---|---|
| `DEPLOY_HOST` | Alias de `~/.ssh/config` o `usuario@ip` |
| `DEPLOY_DOMAIN` | Dominio en el que se publica |
| `DEPLOY_PATH` | Carpeta del sitio en el servidor (por defecto `/var/www/bitacora`) |
| `DEPLOY_API` | `1` instala la API y los datos van al servidor; `0` sitio solo estático |
| `DEPLOY_PUBLIC_READ` | `1` cualquiera lee y solo tú editas; `0` también hace falta la clave para leer |
| `DEPLOY_API_PORT` | Puerto local de la API (por defecto `8787`) |
| `DEPLOY_EMAIL` | Correo para Let's Encrypt; vacío si certbot ya tiene cuenta |

`deploy/deploy.env` no se versiona. Cualquier variable se puede dar también por entorno para una sola orden: `DEPLOY_HOST=otro npm run deploy`.

## Instalación inicial

```bash
./deploy/setup-server.sh
```

Hace, por este orden:

1. Crea la carpeta del sitio, propiedad del usuario que publica.
2. Con `DEPLOY_API=1`, instala la API como servicio de systemd (`bitacora-api`) y genera la clave de edición.
3. Activa el sitio en nginx por HTTP, sin la API.
4. Pide el certificado a Let's Encrypt y activa el sitio definitivo por HTTPS, ya con la API.

Si el dominio todavía no apunta al servidor se detiene después del paso 3 y dice qué registro falta. Crea el registro A, espera a que propague y **vuelve a ejecutarlo**: es idempotente y retoma donde lo dejó.

Para ver en qué punto está sin cambiar nada:

```bash
./deploy/setup-server.sh --check
```

Antes de recargar nginx valida la configuración completa. Si no es válida, restaura la que había y no recarga: instalar este sitio no puede tumbar los demás.

### La clave de edición

Se genera en el servidor con `openssl rand` y se guarda en `/etc/bitacora/env`, propiedad de root y con permisos 600. No pasa por tu máquina ni se imprime. Para verla:

```bash
ssh mi-servidor 'sudo cat /etc/bitacora/env'
```

Es lo que pide la página en «Entrar para editar». Para cambiarla, edita ese fichero y reinicia el servicio:

```bash
ssh mi-servidor 'sudo systemctl restart bitacora-api'
```

## Publicar

```bash
npm run deploy
```

Encadena lint → tests → build → `rsync --delete` → comprobación de la URL. No hace falta recargar nginx: son ficheros estáticos.

| Opción | Efecto |
|---|---|
| `npm run deploy -- --dry-run` | Ensayo: `rsync` solo enseña qué cambiaría |
| `npm run deploy -- --skip-checks` | Salta lint y tests |
| `npm run deploy -- --api` | Además sube `server/api.py` y reinicia el servicio |

El script se niega a publicar si el build está incompleto o el destino no es escribible. `rsync --delete` deja el servidor idéntico a `dist/`, así que un build a medias vaciaría el sitio.

**Publicar no toca los datos.** Con la API, viven en `/var/lib/bitacora/bitacora.db`, fuera de la carpeta del sitio.

## Copias de seguridad

```bash
./deploy/backup.sh
```

Baja todos los datos a `copias/bitacora-AAAA-MM-DD-HHMM.json`, con el mismo formato que «Exportar copia» de la página. La carpeta `copias/` no se versiona.

Para restaurar una copia, o para subir los datos que tenías en el navegador:

```bash
./deploy/import.sh copias/bitacora-2027-01-15-1030.json
```

**Sustituye todo lo que hay.** Pide confirmación y antes guarda una copia de lo que había.

## Anotar desde la terminal

Para crear o sustituir un documento sin abrir la página, por ejemplo desde un script o un asistente:

```bash
echo '{"titulo": "Probar el modelo", "estado": "pendiente", "tipo": "tarea"}' | ./deploy/put.sh tareas probar-modelo -
```

```bash
./deploy/put.sh --delete tareas probar-modelo
```

Los campos de cada colección están en [`src/schemas.js`](../src/schemas.js). El documento sustituye entero al que hubiera con ese identificador.

## Dónde está cada cosa en el servidor

```
/var/www/bitacora                          el sitio (o lo que diga DEPLOY_PATH)
/opt/bitacora/api.py                       la API
/etc/bitacora/env                          la clave de edición (root, 600)
/var/lib/bitacora/bitacora.db              los datos (SQLite)
/etc/systemd/system/bitacora-api.service   el servicio
/etc/nginx/sites-available/<dominio>       el sitio de nginx
/etc/letsencrypt/live/<dominio>/           el certificado
/var/log/nginx/bitacora.{access,error}.log
```

## Si algo falla

| Síntoma | Dónde mirar |
|---|---|
| La página carga pero dice que no puede cargar los datos | `ssh mi-servidor 'sudo journalctl -u bitacora-api -n 50'` y `systemctl status bitacora-api` |
| «Clave incorrecta» con la clave buena | Que la página se sirva por HTTPS y que la clave no lleve espacios; compárala con `/etc/bitacora/env` |
| 502 en `/api/` | El servicio está parado o `DEPLOY_API_PORT` no coincide con el de la configuración de nginx: vuelve a ejecutar `setup-server.sh` |
| certbot no emite el certificado | El registro A no apunta al servidor o el puerto 80 está cerrado en el cortafuegos |
| `duplicate listen options` al validar nginx | Otro sitio del servidor ya declara `http2` en el `listen`; no lo añadas en este (ver el comentario de `nginx.conf`) |

## Quitarlo todo

```bash
ssh mi-servidor 'sudo systemctl disable --now bitacora-api; sudo rm -f /etc/systemd/system/bitacora-api.service /etc/nginx/sites-enabled/<dominio> /etc/nginx/sites-available/<dominio>; sudo nginx -t && sudo systemctl reload nginx'
```

Eso deja los datos (`/var/lib/bitacora`), la clave (`/etc/bitacora`) y el sitio (`/var/www/bitacora`) por si quieres conservarlos. Bórralos a mano cuando estés seguro.
