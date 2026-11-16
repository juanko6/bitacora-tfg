#!/usr/bin/env bash
#
# deploy/setup-server.sh — prepara el servidor. Se ejecuta una vez, y otra
# cuando el dominio ya resuelve, para pedir el certificado.
#
#   ./deploy/setup-server.sh            # instala lo que falte
#   ./deploy/setup-server.sh --check    # solo dice qué hay y qué falta
#
# Es idempotente: se puede repetir sin miedo. Hace, por este orden:
#   1. la carpeta del sitio, propiedad de quien publica
#   2. la API como servicio de systemd, con su clave (si DEPLOY_API=1)
#   3. el sitio de nginx por HTTP, para comprobar que el dominio llega
#   4. el certificado de Let's Encrypt y el sitio definitivo por HTTPS
#
# Antes de recargar nginx valida la configuración. Si no es válida, deja la
# que había y se detiene: un sitio nuevo no puede tumbar los que ya están.
#
# Necesita: Ubuntu/Debian con nginx, certbot (plugin de nginx), python3 y un
# usuario con sudo sin contraseña. Configuración en deploy/deploy.env.

set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(dirname "$0")/common.sh"

CHECK=0
case "${1:-}" in
    --check) CHECK=1 ;;
    -h | --help)
        awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "$0"
        exit 0
        ;;
    '') ;;
    *) fail "opción desconocida: $1 (usa --help)" ;;
esac

require_config

SITE="/etc/nginx/sites-available/$DOMAIN"
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

step "Servidor $HOST"
remote 'true' || fail "no puedo entrar por SSH en $HOST"
remote 'sudo -n true' 2>/dev/null || fail "el usuario de $HOST necesita sudo sin contraseña para la instalación"
for bin in nginx python3 rsync curl; do
    remote "command -v $bin >/dev/null" || fail "falta $bin en el servidor (sudo apt-get install -y $bin)"
done
ok "acceso, sudo y programas necesarios: correcto"

IP_SERVIDOR="$(remote 'curl -fsS -m 10 https://api.ipify.org || true')"
IP_DOMINIO="$(dig +short "$DOMAIN" A 2>/dev/null | tail -1 || true)"
DNS_OK=0
if [ -n "$IP_DOMINIO" ] && [ "$IP_DOMINIO" = "$IP_SERVIDOR" ]; then DNS_OK=1; fi
HAY_CERT=0
if remote "sudo test -s '$CERT'"; then HAY_CERT=1; fi

if [ "$CHECK" -eq 1 ]; then
    step "Estado"
    ok "IP del servidor:   ${IP_SERVIDOR:-desconocida}"
    ok "DNS de $DOMAIN: ${IP_DOMINIO:-sin registro A}  $([ "$DNS_OK" -eq 1 ] && echo '(correcto)' || echo '(no apunta al servidor)')"
    ok "carpeta $DEST: $(remote "[ -d '$DEST' ] && echo existe || echo falta")"
    ok "sitio de nginx:    $(remote "[ -f '$SITE' ] && echo instalado || echo falta")"
    ok "certificado:       $([ "$HAY_CERT" -eq 1 ] && echo emitido || echo falta)"
    if [ "$API" = "1" ]; then
        ok "servicio de la API: $(remote 'systemctl is-active bitacora-api 2>/dev/null || true')"
    fi
    exit 0
fi

# ---------------------------------------------------------------------------
# 1. Carpeta del sitio. Propiedad de quien publica, para no necesitar sudo en
#    cada envío.
# ---------------------------------------------------------------------------
step "Carpeta del sitio"
remote "sudo mkdir -p '$DEST' && sudo chown \"\$(id -un)\":www-data '$DEST' && sudo chmod 755 '$DEST'"
ok "$DEST lista"

# ---------------------------------------------------------------------------
# 2. La API
# ---------------------------------------------------------------------------
if [ "$API" = "1" ]; then
    step "API de datos"
    if remote "sudo ss -ltnH 'sport = :$API_PORT' | grep -q ." \
        && ! remote 'systemctl is-active --quiet bitacora-api'; then
        fail "el puerto $API_PORT ya lo usa otro programa — cambia DEPLOY_API_PORT"
    fi
    sed -e "s/__PORT__/$API_PORT/" -e "s/__PUBLIC_READ__/$PUBLIC_READ/" \
        deploy/bitacora-api.service | remote 'cat > /tmp/bitacora-api.service'
    remote 'cat > /tmp/bitacora-api.py' <server/api.py
    # La clave se genera en el servidor y no sale de él: ni pasa por esta
    # máquina ni se imprime. Si ya existe, se conserva.
    remote 'set -e
        sudo install -d -m 755 /opt/bitacora
        sudo install -m 644 /tmp/bitacora-api.py /opt/bitacora/api.py
        sudo install -d -m 700 /etc/bitacora
        if ! sudo test -s /etc/bitacora/env; then
            printf "BITACORA_TOKEN=%s\n" "$(openssl rand -hex 32)" | sudo tee /etc/bitacora/env >/dev/null
        fi
        sudo chmod 600 /etc/bitacora/env
        sudo install -m 644 /tmp/bitacora-api.service /etc/systemd/system/bitacora-api.service
        rm -f /tmp/bitacora-api.py /tmp/bitacora-api.service
        sudo systemctl daemon-reload
        sudo systemctl enable --quiet bitacora-api
        sudo systemctl restart bitacora-api'
    sano=0
    for _ in 1 2 3 4 5 6 7 8; do
        if remote "curl -fsS -m 3 http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1; then
            sano=1
            break
        fi
        remote 'sleep 1'
    done
    [ "$sano" -eq 1 ] || fail "la API no responde — mira: ssh $HOST 'sudo journalctl -u bitacora-api -n 30'"
    ok "servicio bitacora-api en marcha en 127.0.0.1:$API_PORT"
fi

# ---------------------------------------------------------------------------
# 3 y 4. nginx. Instala un fichero de sitio, valida y recarga; si la
#        validación falla, restaura lo que había.
# ---------------------------------------------------------------------------
instalar_sitio() {
    local plantilla="$1"
    local filtro='cat'
    if [ "$API" != "1" ]; then filtro="sed /API-BEGIN/,/API-END/d"; fi
    sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__ROOT__|$DEST|g" -e "s|__PORT__|$API_PORT|g" \
        "$plantilla" | $filtro | remote 'cat > /tmp/bitacora-site.conf'
    remote "set -e
        if [ -f '$SITE' ]; then sudo cp -p '$SITE' '$SITE.anterior'; fi
        sudo install -m 644 /tmp/bitacora-site.conf '$SITE'
        rm -f /tmp/bitacora-site.conf
        sudo ln -sf '$SITE' '/etc/nginx/sites-enabled/$DOMAIN'
        if sudo nginx -t 2>/tmp/bitacora-nginx-test.log; then
            sudo systemctl reload nginx
            sudo rm -f '$SITE.anterior' /tmp/bitacora-nginx-test.log
        else
            cat /tmp/bitacora-nginx-test.log >&2
            if [ -f '$SITE.anterior' ]; then
                sudo mv '$SITE.anterior' '$SITE'
            else
                sudo rm -f '$SITE' '/etc/nginx/sites-enabled/$DOMAIN'
            fi
            rm -f /tmp/bitacora-nginx-test.log
            exit 1
        fi" || fail "nginx rechazó la configuración; he dejado la anterior y no he recargado"
}

if [ "$HAY_CERT" -eq 0 ]; then
    step "nginx por HTTP (aún sin certificado)"
    instalar_sitio deploy/nginx.bootstrap.conf
    ok "sitio $DOMAIN activo por HTTP, sin la API"

    if [ "$DNS_OK" -eq 0 ]; then
        printf '\n\033[33mFalta el DNS.\033[0m %s debe tener un registro A apuntando a %s.\n' "$DOMAIN" "${IP_SERVIDOR:-la IP del servidor}"
        echo "Ahora mismo resuelve a: ${IP_DOMINIO:-nada}"
        echo "Créalo en el panel de tu proveedor de DNS y vuelve a ejecutar este script:"
        echo "pedirá el certificado y activará HTTPS y la API."
        exit 0
    fi

    step "Certificado de Let's Encrypt"
    remote 'command -v certbot >/dev/null' || fail "falta certbot (sudo apt-get install -y certbot python3-certbot-nginx)"
    if [ -n "$EMAIL" ]; then
        registro="-m $EMAIL"
    else
        registro="--register-unsafely-without-email"
    fi
    # shellcheck disable=SC2029
    remote "sudo certbot certonly --nginx -d '$DOMAIN' --non-interactive --agree-tos $registro" \
        || fail "certbot no pudo emitir el certificado"
    ok "certificado emitido"
fi

step "nginx por HTTPS"
instalar_sitio deploy/nginx.conf
ok "sitio $DOMAIN activo por HTTPS"

printf '\n\033[32m✓ Servidor listo.\033[0m\n'
echo "Publica el sitio con:  npm run deploy"
if [ "$API" = "1" ]; then
    echo "Tu clave de edición está en el servidor. Para verla:"
    echo "  ssh $HOST 'sudo cat /etc/bitacora/env'"
fi
