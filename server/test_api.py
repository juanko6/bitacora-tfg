"""Pruebas de la API contra un servidor real en un puerto libre.

    python3 -m unittest discover -s server -p 'test_*.py'
"""

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import api  # noqa: E402

TOKEN = "clave-de-prueba"


class ApiTest(unittest.TestCase):
    public_read = True

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        cfg = {
            "token": TOKEN,
            "db": os.path.join(self.tmp.name, "test.db"),
            "public_read": self.public_read,
            "host": "127.0.0.1",
            "port": 0,
        }
        self.server = api.serve(cfg)
        self.base = "http://127.0.0.1:%d" % self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.daemon = True
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        self.tmp.cleanup()

    def call(self, method, path, body=None, token=None, raw=None):
        data = raw if raw is not None else (
            None if body is None else json.dumps(body).encode()
        )
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                return res.status, json.loads(res.read() or b"null")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"null")


class PublicReadTest(ApiTest):
    def test_arranca_vacia_con_todas_las_colecciones(self):
        status, body = self.call("GET", "/api/data")
        self.assertEqual(status, 200)
        self.assertEqual(set(body["data"]), set(api.COLLECTIONS))
        self.assertTrue(all(v == {} for v in body["data"].values()))

    def test_health(self):
        self.assertEqual(self.call("GET", "/api/health"), (200, {"ok": True}))

    def test_escribir_sin_clave_se_rechaza_y_no_guarda(self):
        for token in (None, "otra-clave", ""):
            status, _ = self.call(
                "PUT", "/api/docs/tareas/t1", {"titulo": "x"}, token=token
            )
            self.assertEqual(status, 401)
        status, _ = self.call("DELETE", "/api/docs/tareas/t1")
        self.assertEqual(status, 401)
        status, _ = self.call("PUT", "/api/data", {"data": {}})
        self.assertEqual(status, 401)
        self.assertEqual(self.call("GET", "/api/data")[1]["data"]["tareas"], {})

    def test_sesion(self):
        self.assertEqual(self.call("GET", "/api/session")[0], 401)
        self.assertEqual(
            self.call("GET", "/api/session", token=TOKEN), (200, {"write": True})
        )

    def test_crear_sustituir_y_borrar(self):
        doc = {"titulo": "Elegir métrica", "estado": "pendiente", "ñ": "áé"}
        self.assertEqual(
            self.call("PUT", "/api/docs/tareas/t1", doc, token=TOKEN)[0], 200
        )
        self.assertEqual(self.call("GET", "/api/data")[1]["data"]["tareas"], {"t1": doc})

        self.call("PUT", "/api/docs/tareas/t1", {"titulo": "Otra"}, token=TOKEN)
        self.assertEqual(
            self.call("GET", "/api/data")[1]["data"]["tareas"]["t1"],
            {"titulo": "Otra"},
        )

        self.assertEqual(
            self.call("DELETE", "/api/docs/tareas/t1", token=TOKEN)[0], 200
        )
        self.assertEqual(self.call("GET", "/api/data")[1]["data"]["tareas"], {})

    def test_rechaza_colecciones_e_identificadores_no_validos(self):
        for path in (
            "/api/docs/inventada/x",
            "/api/docs/tareas/con%20espacio",
            "/api/docs/tareas/" + "a" * 65,
            "/api/docs/tareas",
            "/api/docs/tareas/a/b",
        ):
            status, _ = self.call("PUT", path, {"a": 1}, token=TOKEN)
            self.assertEqual(status, 404, path)

    def test_rechaza_cuerpos_que_no_son_un_objeto_json(self):
        self.assertEqual(
            self.call("PUT", "/api/docs/tareas/t1", [1, 2], token=TOKEN)[0], 400
        )
        self.assertEqual(
            self.call("PUT", "/api/docs/tareas/t1", raw=b"{no", token=TOKEN)[0], 400
        )

    def test_rechaza_documentos_demasiado_grandes(self):
        grande = {"texto": "x" * (api.MAX_DOC + 10)}
        self.assertEqual(
            self.call("PUT", "/api/docs/diario/d1", grande, token=TOKEN)[0], 413
        )

    def test_importar_sustituye_todo(self):
        self.call("PUT", "/api/docs/tareas/vieja", {"titulo": "v"}, token=TOKEN)
        nuevo = {
            "decisiones": {"D-01": {"titulo": "Una"}},
            "meta": {"tfg": {"autor": "Ana"}},
        }
        status, body = self.call("PUT", "/api/data", {"data": nuevo}, token=TOKEN)
        self.assertEqual((status, body["docs"]), (200, 2))
        data = self.call("GET", "/api/data")[1]["data"]
        self.assertEqual(data["tareas"], {})
        self.assertEqual(data["decisiones"], nuevo["decisiones"])
        self.assertEqual(data["meta"], nuevo["meta"])

    def test_importar_no_borra_nada_si_los_datos_son_invalidos(self):
        self.call("PUT", "/api/docs/tareas/t1", {"titulo": "x"}, token=TOKEN)
        for malo in (
            {"data": {"inventada": {}}},
            {"data": {"tareas": {"id malo": {}}}},
            {"data": {"tareas": {"t": "texto"}}},
            {"data": []},
            {},
        ):
            self.assertEqual(self.call("PUT", "/api/data", malo, token=TOKEN)[0], 400)
        self.assertEqual(
            self.call("GET", "/api/data")[1]["data"]["tareas"], {"t1": {"titulo": "x"}}
        )

    def test_los_datos_sobreviven_a_un_reinicio(self):
        self.call("PUT", "/api/docs/diario/d1", {"titulo": "hoy"}, token=TOKEN)
        # Mismo fichero, conexión nueva: lo guardado está en disco.
        conn = api.connect(os.path.join(self.tmp.name, "test.db"))
        try:
            self.assertEqual(api.read_all(conn)["diario"], {"d1": {"titulo": "hoy"}})
        finally:
            conn.close()

    def test_rutas_desconocidas(self):
        self.assertEqual(self.call("GET", "/api/nada")[0], 404)
        self.assertEqual(self.call("GET", "/")[0], 404)


class PrivateReadTest(ApiTest):
    public_read = False

    def test_leer_exige_clave(self):
        self.assertEqual(self.call("GET", "/api/data")[0], 401)
        self.assertEqual(self.call("GET", "/api/data", token=TOKEN)[0], 200)
        self.assertEqual(self.call("GET", "/api/health")[0], 200)


class NoTokenTest(unittest.TestCase):
    def test_sin_clave_configurada_nadie_escribe(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = {
                "token": "",
                "db": os.path.join(tmp, "t.db"),
                "public_read": True,
                "host": "127.0.0.1",
                "port": 0,
            }
            server = api.serve(cfg)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                url = "http://127.0.0.1:%d/api/docs/tareas/t1" % server.server_address[1]
                req = urllib.request.Request(url, data=b"{}", method="PUT")
                req.add_header("Authorization", "Bearer ")
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    urllib.request.urlopen(req, timeout=5)
                self.assertEqual(ctx.exception.code, 401)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
