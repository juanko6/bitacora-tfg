#!/usr/bin/env bash
#
# deploy/backup.sh — baja una copia de los datos de la API a un fichero JSON.
#
#   ./deploy/backup.sh               # → copias/bitacora-AAAA-MM-DD-HHMM.json
#   ./deploy/backup.sh ruta/mi.json
#
# La copia se pide desde dentro del servidor, así que funciona igual con la
# lectura pública o privada y la clave no sale de él. El fichero tiene el
# mismo formato que «Exportar copia» de la página y se restaura con
# deploy/import.sh o con «Importar copia».

set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(dirname "$0")/common.sh"
require_config
[ "$API" = "1" ] || fail "con DEPLOY_API=0 no hay datos en el servidor: usa «Exportar copia» en la página"

salida="${1:-copias/bitacora-$(date +%Y-%m-%d-%H%M).json}"
mkdir -p "$(dirname "$salida")"

# shellcheck disable=SC2016
remote 'set -e
    . <(sudo cat /etc/bitacora/env)
    curl -fsS -m 30 -H "Authorization: Bearer $BITACORA_TOKEN" "http://127.0.0.1:'"$API_PORT"'/api/data"' \
    | python3 -c 'import json, sys, datetime
d = json.load(sys.stdin)
json.dump({"formato": "bitacora-tfg", "version": 1,
           "exportado": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
           "data": d["data"]}, sys.stdout, ensure_ascii=False, indent=2)' >"$salida"

docs=$(python3 -c 'import json, sys; print(sum(len(v) for v in json.load(open(sys.argv[1]))["data"].values()))' "$salida")
printf '\033[32m✓\033[0m %s documentos guardados en %s\n' "$docs" "$salida"
