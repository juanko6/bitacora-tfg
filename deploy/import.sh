#!/usr/bin/env bash
#
# deploy/import.sh — sube una copia JSON a la API y SUSTITUYE todo lo que hay.
#
#   ./deploy/import.sh copia.json
#   ./deploy/import.sh copia.json --yes     # sin pedir confirmación
#
# Acepta el fichero de «Exportar copia» o de deploy/backup.sh. Antes de
# sustituir nada guarda una copia de lo que había en copias/.

set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(dirname "$0")/common.sh"
require_config
[ "$API" = "1" ] || fail "con DEPLOY_API=0 no hay API: usa «Importar copia» en la página"

origen="${1:-}"
[ -n "$origen" ] && [ -s "$origen" ] || fail "indica el fichero JSON a importar"

cuerpo="$(python3 - "$origen" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
data = d["data"] if isinstance(d, dict) and d.get("formato") == "bitacora-tfg" else d
if not isinstance(data, dict):
    sys.exit("el fichero no tiene el formato de una bitácora")
sys.stderr.write("  %d documentos en %d colecciones\n" % (sum(len(v) for v in data.values()), len(data)))
print(json.dumps({"data": data}, ensure_ascii=False))
PY
)"

if [ "${2:-}" != "--yes" ]; then
    printf 'Esto sustituye TODOS los datos de %s. ¿Seguir? [s/N] ' "$DOMAIN"
    read -r respuesta
    case "$respuesta" in s | S | si | sí) ;; *) echo "Cancelado."; exit 0 ;; esac
fi

step "Copia de lo que hay ahora"
bash deploy/backup.sh "copias/antes-de-importar-$(date +%Y-%m-%d-%H%M%S).json"

step "Importando"
# shellcheck disable=SC2016
printf '%s' "$cuerpo" | remote 'set -e
    . <(sudo cat /etc/bitacora/env)
    curl -fsS -m 60 -X PUT -H "Authorization: Bearer $BITACORA_TOKEN" -H "Content-Type: application/json" \
        --data-binary @- "http://127.0.0.1:'"$API_PORT"'/api/data"'
printf '\n\033[32m✓ Importado.\033[0m\n'
