#!/usr/bin/env python3
"""API de la Bitácora de TFG: documentos JSON guardados en SQLite.

Solo usa la biblioteca estándar de Python 3.8+, para que desplegarla sea
copiar este fichero: sin entorno virtual, sin dependencias, sin contenedor.

Rutas (todas bajo /api):

    GET    /api/health                 comprobación de vida, sin datos
    GET    /api/data                   todas las colecciones
    GET    /api/session                200 si la clave es válida, 401 si no
    PUT    /api/docs/<coleccion>/<id>  crea o sustituye un documento
    DELETE /api/docs/<coleccion>/<id>  borra un documento
    PUT    /api/data                   sustituye TODO (importar una copia)

Leer es público salvo que BITACORA_PUBLIC_READ=0. Escribir exige siempre la
cabecera `Authorization: Bearer <clave>`.

Configuración por variables de entorno:

    BITACORA_TOKEN        clave de edición. Vacía = nadie puede escribir.
    BITACORA_DB           ruta del fichero SQLite (por defecto ./bitacora.db)
    BITACORA_PUBLIC_READ  1 (por defecto) lectura pública, 0 lectura con clave
    BITACORA_HOST         por defecto 127.0.0.1: se publica detrás de nginx
    BITACORA_PORT         por defecto 8787
"""

import hmac
import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Las mismas colecciones que src/schemas.js. Una colección que no esté aquí
# se rechaza: la API no es un almacén genérico.
COLLECTIONS = (
    "tareas",
    "decisiones",
    "ia",
    "reuniones",
    "diario",
    "fuentes",
    "fechas",
    "meta",
)
ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
MAX_DOC = 256 * 1024
MAX_IMPORT = 4 * 1024 * 1024
MAX_DOCS_PER_COLLECTION = 5000


def config(env=os.environ):
    return {
        "token": env.get("BITACORA_TOKEN", ""),
        "db": env.get("BITACORA_DB", "bitacora.db"),
        "public_read": env.get("BITACORA_PUBLIC_READ", "1") != "0",
        "host": env.get("BITACORA_HOST", "127.0.0.1"),
        "port": int(env.get("BITACORA_PORT", "8787")),
    }


def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute(
        """CREATE TABLE IF NOT EXISTS docs (
               col TEXT NOT NULL,
               id TEXT NOT NULL,
               body TEXT NOT NULL,
               updated TEXT NOT NULL,
               PRIMARY KEY (col, id)
           )"""
    )
    return db


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_all(db):
    data = {c: {} for c in COLLECTIONS}
    for col, doc_id, body in db.execute("SELECT col, id, body FROM docs"):
        if col in data:
            data[col][doc_id] = json.loads(body)
    return data


def validate_import(data):
    """Devuelve la lista de filas a insertar o lanza ValueError."""
    if not isinstance(data, dict):
        raise ValueError("`data` debe ser un objeto")
    rows = []
    for col, docs in data.items():
        if col not in COLLECTIONS:
            raise ValueError(f"colección desconocida: {col}")
        if not isinstance(docs, dict):
            raise ValueError(f"la colección {col} debe ser un objeto")
        if len(docs) > MAX_DOCS_PER_COLLECTION:
            raise ValueError(f"demasiados documentos en {col}")
        for doc_id, doc in docs.items():
            if not ID_RE.match(doc_id):
                raise ValueError(f"identificador no válido en {col}: {doc_id}")
            if not isinstance(doc, dict):
                raise ValueError(f"{col}/{doc_id} no es un objeto")
            rows.append((col, doc_id, json.dumps(doc, ensure_ascii=False)))
    return rows


def make_handler(cfg):
    class Handler(BaseHTTPRequestHandler):
        server_version = "bitacora-tfg"
        sys_version = ""

        # ---- utilidades ----
        def log_message(self, fmt, *args):
            # Sin la cabecera Authorization ni el cuerpo: solo método, ruta y
            # código, a la salida de errores (journald en producción).
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

        def send_json(self, status, body=None):
            payload = b"" if body is None else json.dumps(
                body, ensure_ascii=False
            ).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(payload)

        def fail(self, status, message):
            self.send_json(status, {"error": message})

        def authorized(self):
            token = cfg["token"]
            header = self.headers.get("Authorization", "")
            if not token or not header.startswith("Bearer "):
                return False
            given = header[len("Bearer "):].strip()
            return hmac.compare_digest(given.encode(), token.encode())

        def require_auth(self):
            if self.authorized():
                return True
            # Un pequeño retardo quita sentido a probar claves en bucle.
            time.sleep(0.4)
            self.fail(401, "clave no válida")
            return False

        def read_body(self, limit):
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = -1
            if length < 0 or length > limit:
                # Se lee y se descarta lo que venga (con tope) antes de
                # responder: cortar a media subida deja al cliente con un
                # error de conexión en vez de con el 413.
                pending = min(max(length, 0), 2 * MAX_IMPORT)
                while pending > 0:
                    chunk = self.rfile.read(min(pending, 65536))
                    if not chunk:
                        break
                    pending -= len(chunk)
                self.fail(413, "cuerpo demasiado grande")
                return None
            try:
                return json.loads(self.rfile.read(length).decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                self.fail(400, "el cuerpo no es JSON válido")
                return None

        def doc_path(self):
            """(coleccion, id) si la ruta es /api/docs/<col>/<id>; si no, None."""
            parts = self.path.split("?", 1)[0].strip("/").split("/")
            if len(parts) != 4 or parts[:2] != ["api", "docs"]:
                return None
            col, doc_id = parts[2], parts[3]
            if col not in COLLECTIONS or not ID_RE.match(doc_id):
                return None
            return col, doc_id

        def route(self):
            return self.path.split("?", 1)[0].rstrip("/")

        # ---- verbos ----
        def do_GET(self):
            route = self.route()
            if route == "/api/health":
                return self.send_json(200, {"ok": True})
            if route == "/api/session":
                if self.require_auth():
                    self.send_json(200, {"write": True})
                return None
            if route == "/api/data":
                if not cfg["public_read"] and not self.require_auth():
                    return None
                db = connect(cfg["db"])
                try:
                    return self.send_json(200, {"data": read_all(db)})
                finally:
                    db.close()
            return self.fail(404, "no existe")

        def do_PUT(self):
            route = self.route()
            if route == "/api/data":
                if not self.require_auth():
                    return None
                body = self.read_body(MAX_IMPORT)
                if body is None:
                    return None
                try:
                    rows = validate_import(
                        body.get("data") if isinstance(body, dict) else None
                    )
                except ValueError as e:
                    return self.fail(400, str(e))
                stamp = now()
                db = connect(cfg["db"])
                try:
                    with db:
                        db.execute("DELETE FROM docs")
                        db.executemany(
                            "INSERT INTO docs VALUES (?, ?, ?, ?)",
                            [(c, i, b, stamp) for c, i, b in rows],
                        )
                finally:
                    db.close()
                return self.send_json(200, {"ok": True, "docs": len(rows)})

            target = self.doc_path()
            if target is None:
                return self.fail(404, "no existe")
            if not self.require_auth():
                return None
            doc = self.read_body(MAX_DOC)
            if doc is None:
                return None
            if not isinstance(doc, dict):
                return self.fail(400, "el documento debe ser un objeto")
            col, doc_id = target
            db = connect(cfg["db"])
            try:
                with db:
                    count = db.execute(
                        "SELECT COUNT(*) FROM docs WHERE col = ?", (col,)
                    ).fetchone()[0]
                    exists = db.execute(
                        "SELECT 1 FROM docs WHERE col = ? AND id = ?",
                        (col, doc_id),
                    ).fetchone()
                    if not exists and count >= MAX_DOCS_PER_COLLECTION:
                        return self.fail(409, "la colección está llena")
                    db.execute(
                        "INSERT INTO docs VALUES (?, ?, ?, ?) "
                        "ON CONFLICT (col, id) DO UPDATE SET "
                        "body = excluded.body, updated = excluded.updated",
                        (col, doc_id, json.dumps(doc, ensure_ascii=False), now()),
                    )
            finally:
                db.close()
            return self.send_json(200, {"ok": True})

        def do_DELETE(self):
            target = self.doc_path()
            if target is None:
                return self.fail(404, "no existe")
            if not self.require_auth():
                return None
            db = connect(cfg["db"])
            try:
                with db:
                    db.execute(
                        "DELETE FROM docs WHERE col = ? AND id = ?", target
                    )
            finally:
                db.close()
            return self.send_json(200, {"ok": True})

    return Handler


def serve(cfg):
    connect(cfg["db"]).close()  # crea el fichero y la tabla al arrancar
    server = ThreadingHTTPServer((cfg["host"], cfg["port"]), make_handler(cfg))
    server.daemon_threads = True
    return server


def main():
    cfg = config()
    if not cfg["token"]:
        sys.stderr.write(
            "aviso: BITACORA_TOKEN está vacío, así que nadie puede escribir.\n"
        )
    server = serve(cfg)
    sys.stderr.write(
        "bitacora-tfg escuchando en http://%s:%d (lectura %s)\n"
        % (cfg["host"], cfg["port"], "pública" if cfg["public_read"] else "con clave")
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
