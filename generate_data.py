"""Dummy data for the SEVA campus-energy prototype.
Usage: python generate_data.py [--days 30] [--seed 7] [--out data]
Writes classrooms, timetable, weather, servers and tasks as CSV."""
import argparse, csv, math, os, random, datetime as dt

ap = argparse.ArgumentParser()
ap.add_argument("--days", type=int, default=30)
ap.add_argument("--seed", type=int, default=7)
ap.add_argument("--out", default="data")
a = ap.parse_args()
random.seed(a.seed)
os.makedirs(a.out, exist_ok=True)

def write(name, header, rows):
    with open(f"{a.out}/{name}.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(header); w.writerows(rows)

# Classrooms: area drives capacity (~1.5 m2 per seat); enrolled is a share of it
rooms = []
for i, b in enumerate("AABBCCDDDD"):
    area = random.randint(40, 170) if i < 9 else 220
    cap = round(area / 1.5)
    rooms.append((f"{b}-{100 + i}", b, area, cap, round(cap * random.uniform(.6, 1))))
write("classrooms", ["room", "building", "area_m2", "capacity", "enrolled"], rooms)

# Weekly timetable, hourly slots 08:00-17:00, ~62% slot utilisation, 60-95% attendance
tt = [(r[0], d, h, f"CS{random.randint(100, 499)}", round(r[4] * random.uniform(.6, .95)))
      for r in rooms for d in range(5) for h in range(8, 18) if random.random() < .62]
write("timetable", ["room", "weekday", "hour", "course", "attendance"], tt)

# Hourly weather: daily base temp, diurnal sine curve, cloud and rain effects
wx, day0 = [], dt.date.today() - dt.timedelta(days=a.days)
for d in range(a.days):
    base, k = random.uniform(29, 37), random.random()
    cond = "Clear" if k < .6 else "Cloudy" if k < .85 else "Rain"
    cloud = {"Clear": 1, "Cloudy": .55, "Rain": .25}[cond]
    for h in range(24):
        t = base - 4 + 4 * math.sin((h - 8) / 12 * math.pi) if 6 <= h <= 20 else base - 7
        t += random.gauss(0, .4) - (4 if cond == "Rain" else 1.5 if cond == "Cloudy" else 0)
        sun = max(0, math.sin((h - 6) / 12 * math.pi)) * 900 * cloud
        wx.append(((day0 + dt.timedelta(days=d)).isoformat(), h, round(t, 1),
                   round(random.uniform(45, 90 if cond == "Rain" else 65)), cond, round(sun)))
write("weather", ["date", "hour", "temp_c", "humidity_pct", "condition", "solar_wm2"], wx)

# Servers: speed (work units/min), idle and active power in watts; faster machines cost more energy per unit of work
servers = [("Edge-1", 1, 20, 45), ("Edge-2", 1, 20, 45), ("Std-1", 2, 50, 120),
           ("Std-2", 2, 50, 120), ("Perf-1", 3, 90, 240), ("GPU-1", 5, 200, 600)]
write("servers", ["server", "speed", "idle_w", "active_w"], servers)

# Jobs: log-normal sizes (many small, a few heavy), arrivals over a working day
tasks = [(i, random.randint(0, 600), round(math.exp(random.uniform(2.8, 5.2))), random.choice([1, 1, 2, 3]))
         for i in range(200)]
write("tasks", ["task_id", "arrival_min", "size_units", "priority"], sorted(tasks, key=lambda t: t[1]))
print(f"Wrote 5 CSV files to ./{a.out}")
