"""SEVA energy backend.  Run:  pip install flask && python server.py  ->  http://localhost:5000"""
import csv, io, json, os, subprocess, sys
from flask import Flask, jsonify, request

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
SCHEMA = {  # column -> type; extra columns in uploads are ignored
    "classrooms": {"room": str, "building": str, "area_m2": float, "capacity": int, "enrolled": int},
    "timetable": {"room": str, "weekday": int, "hour": int, "course": str, "attendance": int},
    "weather": {"date": str, "hour": int, "temp_c": float, "humidity_pct": float, "condition": str, "solar_wm2": float},
    "servers": {"server": str, "speed": float, "idle_w": float, "active_w": float, "boot_min": float, "always_on": int},
    "tasks": {"task_id": int, "arrival_min": int, "size_units": float, "priority": int},
}
OPTIONAL = {"servers": {"boot_min": 3.0, "always_on": 0}}  # columns that may be missing from uploads
app = Flask(__name__, static_folder="static", static_url_path="")

def generate(seed=7, days=30):
    subprocess.run([sys.executable, os.path.join(ROOT, "generate_data.py"), "--out", DATA,
                    "--seed", str(seed), "--days", str(days)], check=True)

def parse(name, text):
    """Type-check CSV text against the schema; raises ValueError with a readable message."""
    rd = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    opt, cols = OPTIONAL.get(name, {}), rd.fieldnames or []
    missing = [c for c in SCHEMA[name] if c not in cols and c not in opt]
    if missing:
        raise ValueError(f"{name}: missing columns {', '.join(missing)}")
    rows = []
    for i, r in enumerate(rd, 2):
        try:
            rows.append({c: opt[c] if c in opt and (c not in cols or r[c] in (None, "")) else
                         str(r[c]) if t is str else t(float(r[c])) for c, t in SCHEMA[name].items()})
        except (ValueError, TypeError):
            raise ValueError(f"{name}: bad value on line {i}")
    if not rows:
        raise ValueError(f"{name}: file is empty")
    return rows

def read(name):
    with open(os.path.join(DATA, name + ".csv"), encoding="utf-8") as f:
        return parse(name, f.read())

@app.get("/")
def index():
    return app.send_static_file("index.html")

def bundle():
    d = {k: read(k) for k in SCHEMA}
    d["meta"] = {"rows": {k: len(v) for k, v in d.items()}}
    return d

def write_sample(path=None):
    """Bundle the current data as static/js/sample.js, the offline demo shown when the backend is unreachable."""
    path = path or os.path.join(ROOT, "static", "js", "sample.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write("/* Offline demo data. Rebuild with: python server.py --sample */\nwindow.SEVA_SAMPLE=" + json.dumps(bundle(), separators=(",", ":")) + ";\n")

@app.get("/api/data")
def data():
    return jsonify(bundle())

@app.post("/api/upload/<name>")
def upload(name):
    if name not in SCHEMA:
        return jsonify(error="Unknown dataset"), 404
    text = request.get_data(as_text=True)
    try:
        parse(name, text)
    except ValueError as e:
        return jsonify(error=str(e)), 400
    with open(os.path.join(DATA, name + ".csv"), "w", encoding="utf-8", newline="") as f:
        f.write(text)
    return jsonify(ok=True)

@app.post("/api/regenerate")
def regenerate():
    b = request.get_json(silent=True) or {}
    generate(int(b.get("seed", 7)), max(7, min(90, int(b.get("days", 30)))))
    return jsonify(ok=True)

if __name__ == "__main__":
    fresh = not os.path.exists(os.path.join(DATA, "tasks.csv"))
    if fresh:
        generate()
    if fresh or "--sample" in sys.argv:
        write_sample()
    if "--sample" in sys.argv:
        print("Wrote static/js/sample.js"); sys.exit(0)
    app.run(port=int(os.environ.get("PORT", 5000)))
