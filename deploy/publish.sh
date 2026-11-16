#!/usr/bin/env bash
#
# deploy/publish.sh — publica la bitácora en el servidor.
#
#   ./deploy/publish.sh              # comprueba, construye y publica
#   ./deploy/publish.sh --dry-run    # igual, pero rsync solo enseña qué haría
#   ./deploy/publish.sh --skip-checks
#   ./deploy/publish.sh --api        # además actualiza la API y la reinicia
#
# El build se hace SIEMPRE en local: el servidor no necesita Node. Solo se
# suben ficheros estáticos; los datos de la API viven fuera de la carpeta del
# sitio y un despliegue no los toca.
#
# Configuración en deploy/deploy.env (ver deploy/deploy.env.example).

set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(dirname "$0")/common.sh"

DRY_RUN=0
SKIP_CHECKS=0
CON_API=0

while [ $# -gt 0 ]; do
    case "$1" in
        -n | --dry-run) DRY_RUN=1 ;;
        --skip-checks) SKIP_CHECKS=1 ;;
        --api) CON_API=1 ;;
        -h | --help)
            awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "$0"
            exit 0
            ;;
        *) fail "opción desconocida: $1 (usa --help)" ;;
    esac
    shift
done

require_config
URL="https://$DOMAIN"

# ---------------------------------------------------------------------------
# 1. Calidad: lo mismo que exige el CI.
# ---------------------------------------------------------------------------
if [ "$SKIP_CHECKS" -eq 0 ]; then
    step "Lint"
    npm run lint
    step "Tests"
    npm test
    if [ "$API" = "1" ]; then
        step "Tests de la API"
        npm run test:api
    fi
else
    echo "⚠ comprobaciones saltadas (--skip-checks)"
fi

# ---------------------------------------------------------------------------
# 2. Build. El modo de datos se decide aquí: con DEPLOY_API=1 la página habla
#    con /api; con 0 guarda en el navegador de cada visitante.
# ---------------------------------------------------------------------------
step "Build"
if [ "$API" = "1" ]; then
    VITE_API_URL=/api npm run build
    ok "modo servidor: los datos van a $URL/api"
else
    VITE_API_URL='' npm run build
    ok "modo navegador: cada visitante guarda sus datos en su equipo"
fi

# ---------------------------------------------------------------------------
# 3. Red de seguridad. rsync va con --delete: un dist/ vacío o a medias
#    vaciaría el sitio.
# ---------------------------------------------------------------------------
step "Comprobando el build"
[ -s dist/index.html ] || fail "falta dist/index.html — el build no está completo, no publico"
[ -d dist/assets ] || fail "falta dist/assets — el build no está completo, no publico"
grep -q 'id="view"' dist/index.html || fail "dist/index.html no es la bitácora, no publico"
ok "index.html y assets/ están donde deben"

step "Comprobando el acceso a $HOST"
remote "[ -d '$DEST' ] && [ -w '$DEST' ]" \
    || fail "no puedo escribir en $HOST:$DEST — ejecuta antes deploy/setup-server.sh"
ok "$HOST:$DEST accesible y escribible"

# ---------------------------------------------------------------------------
# 4. Publicación
# ---------------------------------------------------------------------------
RSYNC_FLAGS=(-az --delete --exclude=".DS_Store" --itemize-changes)
if [ "$DRY_RUN" -eq 1 ]; then
    RSYNC_FLAGS+=(--dry-run)
    step "rsync (EN SECO — no se cambia nada)"
else
    step "rsync → $HOST:$DEST"
fi
rsync "${RSYNC_FLAGS[@]}" dist/ "$HOST:$DEST/"

if [ "$DRY_RUN" -eq 1 ]; then
    printf '\n\033[1mEnsayo terminado.\033[0m Quita --dry-run para publicar de verdad.\n'
    exit 0
fi

if [ "$CON_API" -eq 1 ]; then
    [ "$API" = "1" ] || fail "--api no tiene sentido con DEPLOY_API=0"
    step "Actualizando la API"
    remote 'cat > /tmp/bitacora-api.py' <server/api.py
    remote 'sudo install -m 644 /tmp/bitacora-api.py /opt/bitacora/api.py && rm -f /tmp/bitacora-api.py && sudo systemctl restart bitacora-api'
    ok "servicio reiniciado"
fi

# ---------------------------------------------------------------------------
# 5. Comprobación posterior. No hace falta recargar nginx: son ficheros
#    estáticos.
# ---------------------------------------------------------------------------
step "Comprobando $URL"
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$URL/" || echo "000")
if [ "$code" != "200" ]; then
    echo "⚠ $URL/ responde $code — ¿está el DNS y el certificado? Mira deploy/setup-server.sh --check"
elif curl -s -m 15 "$URL/" | grep -q 'id="view"'; then
    ok "$URL/ sirve la bitácora (200)"
else
    echo "⚠ $URL/ responde 200 pero no parece la bitácora."
fi
if [ "$API" = "1" ]; then
    code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$URL/api/health" || echo "000")
    if [ "$code" = "200" ]; then ok "$URL/api responde (200)"; else echo "⚠ $URL/api/health responde $code"; fi
fi

printf '\n\033[32m✓ Publicado.\033[0m\n'
