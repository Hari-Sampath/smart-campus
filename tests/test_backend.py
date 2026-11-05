"""Backend tests. Run from the project root:  python -m unittest discover -s tests"""
import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server

SERVERS_OK = "server,speed,idle_w,active_w\nEdge-1,1,20,45\n"

class Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        server.DATA = cls.tmp.name
        server.generate(seed=1, days=14)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def setUp(self):
        self.c = server.app.test_client()

    def test_index_served(self):
        self.assertEqual(self.c.get("/").status_code, 200)

    def test_data_shape(self):
        d = self.c.get("/api/data").get_json()
        self.assertEqual(len(d["classrooms"]), 10)
        self.assertEqual(len(d["servers"]), 6)
        self.assertEqual(len(d["weather"]), 14 * 24)
        self.assertEqual(d["meta"]["rows"]["tasks"], 200)

    def test_data_is_typed(self):
        r = self.c.get("/api/data").get_json()["classrooms"][0]
        self.assertIsInstance(r["capacity"], int)
        self.assertIsInstance(r["area_m2"], float)

    def test_timetable_within_working_hours(self):
        for t in self.c.get("/api/data").get_json()["timetable"]:
            self.assertTrue(0 <= t["weekday"] <= 4 and 8 <= t["hour"] <= 17)

    def test_upload_valid(self):
        self.assertTrue(self.c.post("/api/upload/servers", data=SERVERS_OK).get_json()["ok"])
        self.assertEqual(len(self.c.get("/api/data").get_json()["servers"]), 1)
        server.generate(seed=1, days=14)  # restore

    def test_upload_missing_columns(self):
        r = self.c.post("/api/upload/servers", data="a,b\n1,2\n")
        self.assertEqual(r.status_code, 400)
        self.assertIn("missing columns", r.get_json()["error"])

    def test_upload_bad_value(self):
        r = self.c.post("/api/upload/servers", data="server,speed,idle_w,active_w\nx,fast,1,2\n")
        self.assertEqual(r.status_code, 400)
        self.assertIn("line 2", r.get_json()["error"])

    def test_upload_empty_and_unknown(self):
        self.assertEqual(self.c.post("/api/upload/servers", data="server,speed,idle_w,active_w\n").status_code, 400)
        self.assertEqual(self.c.post("/api/upload/nope", data="x").status_code, 404)

    def test_regenerate_clamps_days(self):
        self.c.post("/api/regenerate", json={"seed": 2, "days": 1000})
        self.assertEqual(len(self.c.get("/api/data").get_json()["weather"]), 90 * 24)
        server.generate(seed=1, days=14)

    def test_generator_is_deterministic(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            for d in (a, b):
                server.DATA = d
                server.generate(seed=5, days=7)
            server.DATA = self.tmp.name
            for f in os.listdir(a):
                same = open(os.path.join(a, f)).read() == open(os.path.join(b, f)).read()
                self.assertTrue(same or f == "weather.csv", f)  # weather dates depend on today, content is seeded

if __name__ == "__main__":
    unittest.main()
