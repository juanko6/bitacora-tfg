#!/usr/bin/env bash
#
# deploy/put.sh — crea o sustituye UN documento de la API desde la terminal.
#
#   ./deploy/put.sh diario d-2027-01-15 entrada.json
#   echo '{"titulo": "Probar el modelo", "estado": "pendiente"}' | ./deploy/put.sh tareas probar-modelo -
#   ./deploy/put.sh --delete tareas probar-modelo
#
# Sirve para anotar entradas sin abrir la página: desde un script, desde un
# gancho de git o desde un asistente. La petición se hace desde dentro del
# servidor, así que la clave no sale de él.
#
# El documento sustituye al que hubiera con ese identificador: para cambiar un
# solo campo hay que mandar el documento entero.

set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(dirname "$0")/common.sh"
require_config
[ "$API" = "1" ] || fail "con DEPLOY_API=0 no hay API"

METODO=PUT
if [ "${1:-}" = "--delete" ]; then
    METODO=DELETE
    shift
fi

COL="${1:-}"
ID="${2:-}"
ORIGEN="${3:--}"
case "$COL" in '' | *[!a-z]*) fail "indica la colección (tareas, decisiones, ia, reuniones, diario, fuentes, fechas, meta)" ;; esac
case "$ID" in '' | *[!A-Za-z0-9_.-]*) fail "el identificador solo admite letras, números, punto, guion y guion bajo" ;; esac

RUTA="http://127.0.0.1:$API_PORT/api/docs/$COL/$ID"

if [ "$METODO" = "DELETE" ]; then
    # shellcheck disable=SC2016
    remote 'set -e
        . <(sudo cat /etc/bitacora/env)
        curl -fsS -m 30 -X DELETE -H "Authorization: Bearer $BITACORA_TOKEN" "'"$RUTA"'"'
    printf '\n\033[32m✓\033[0m borrado %s/%s\n' "$COL" "$ID"
    exit 0
fi

if [ "$ORIGEN" = "-" ]; then
    cuerpo="$(cat)"
else
    [ -s "$ORIGEN" ] || fail "no encuentro $ORIGEN"
    cuerpo="$(cat "$ORIGEN")"
fi
printf '%s' "$cuerpo" | python3 -c 'import json, sys
d = json.load(sys.stdin)
sys.exit(0 if isinstance(d, dict) else "el documento debe ser un objeto JSON")' \
    || fail "el documento no es un objeto JSON válido"

# shellcheck disable=SC2016
printf '%s' "$cuerpo" | remote 'set -e
    . <(sudo cat /etc/bitacora/env)
    curl -fsS -m 30 -X PUT -H "Authorization: Bearer $BITACORA_TOKEN" -H "Content-Type: application/json" \
        --data-binary @- "'"$RUTA"'"'
printf '\n\033[32m✓\033[0m guardado %s/%s\n' "$COL" "$ID"
