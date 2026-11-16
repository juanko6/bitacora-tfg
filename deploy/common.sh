#!/usr/bin/env bash
# deploy/common.sh — lo cargan los demás scripts de deploy/. No se ejecuta solo.
#
# Lee deploy/deploy.env si existe. Las variables que ya vengan del entorno
# mandan sobre las del fichero, para poder apuntar a otro sitio en una sola
# orden:  DEPLOY_HOST=otro npm run deploy

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -f deploy/deploy.env ]; then
    while IFS= read -r linea || [ -n "$linea" ]; do
        case "$linea" in
            '' | \#*) continue ;;
        esac
        clave="${linea%%=*}"
        valor="${linea#*=}"
        case "$clave" in
            DEPLOY_[A-Z_]*) [ -n "${!clave+x}" ] || export "$clave=$valor" ;;
        esac
    done <deploy/deploy.env
fi

HOST="${DEPLOY_HOST:-}"
DOMAIN="${DEPLOY_DOMAIN:-}"
DEST="${DEPLOY_PATH:-/var/www/bitacora}"
API="${DEPLOY_API:-0}"
PUBLIC_READ="${DEPLOY_PUBLIC_READ:-1}"
API_PORT="${DEPLOY_API_PORT:-8787}"
EMAIL="${DEPLOY_EMAIL:-}"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fail() {
    printf '\033[31m✗ %s\033[0m\n' "$1" >&2
    exit 1
}
ok() { printf '  %s\n' "$1"; }

require_config() {
    [ -n "$HOST" ] || fail "falta DEPLOY_HOST — copia deploy/deploy.env.example a deploy/deploy.env"
    [ -n "$DOMAIN" ] || fail "falta DEPLOY_DOMAIN — copia deploy/deploy.env.example a deploy/deploy.env"
    case "$DOMAIN" in
        *[!a-zA-Z0-9.-]*) fail "DEPLOY_DOMAIN no parece un dominio: $DOMAIN" ;;
    esac
    case "$DEST" in
        /*) ;;
        *) fail "DEPLOY_PATH debe ser una ruta absoluta: $DEST" ;;
    esac
    case "$API_PORT" in
        *[!0-9]* | '') fail "DEPLOY_API_PORT debe ser un número: $API_PORT" ;;
    esac
}

remote() { ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" "$@"; }
