# Seva Energy

A smart-campus prototype that cuts electricity use in an institute by making two of its biggest loads smarter: **classroom air conditioning** and **server workloads**. Built for the SEVA hackathon.

Universities waste energy in two predictable ways. AC runs at one fixed setpoint whether a room is empty or full, and nobody knows whether it is cheaper to leave it on between classes or switch it off. Compute jobs get spread across every machine, so slow, power-hungry servers stay on even when they add little. Seva Energy replaces both habits with controllers whose decisions can be explained in a sentence.

The prototype runs entirely on simulated data. Every dataset lives in a CSV file, so real timetables, weather feeds and server inventories can be dropped in later without code changes. The reasoning behind the models, with sources, is in [`docs/Seva-Energy-Research-Brief.docx`](docs/Seva-Energy-Research-Brief.docx).

## What it does

| Module | Question it answers | Method |
|---|---|---|
| **Classroom AC** | For each room and hour: cooling, kept on, setback, pre-cool, fans only or off, and at what temperature? | Fuzzy setpoint plus a physics-based planner |
| **Server scheduling** | Which machine should run each job so the batch finishes fast without wasting energy? | NSGA-II multi-objective genetic algorithm |
| **Overview** | How much are we saving? | Compares against realistic baselines |
| **Data** | Where does the input come from? | CSV upload and regeneration through the backend |

## How it works

### Classroom AC

**Setpoint (fuzzy controller).** Occupancy (low, medium, high) and the effective outdoor temperature (outdoor temperature adjusted by −1 to +2 °C for sunshine; mild, warm, hot) feed nine rules. The output is a weighted average of the rules, rounded to 0.5 °C, and never leaves 24–28 °C. 24 °C is the Bureau of Energy Efficiency default and each degree lower costs roughly 6% more energy; values above 24 °C assume ceiling fans.

| | Low occupancy | Medium | High |
|---|---|---|---|
| **Mild** (about 24 °C) | 28 | 27 | 26 |
| **Warm** (about 30 °C) | 27 | 26 | 25 |
| **Hot** (about 36 °C) | 26 | 25 | 24 |

**Leave it on or switch it off? (planner).** Each room is a single-zone thermal model stepped every five minutes: heat leaks in through the envelope, people and equipment add heat, the AC removes it at a cooling efficiency (COP) that falls as it gets hotter outside and improves at part load (inverter behaviour). For every empty gap before a class, the planner simulates three strategies and picks the cheapest one that still brings the room within 0.5 K of the setpoint by the time the class starts:

1. **Kept on**: hold the class setpoint through the gap.
2. **Setback**: hold 28 °C, then pre-cool.
3. **Switched off**: let the room drift, then pre-cool.

Pre-cool starts as late as comfort allows, because pre-cooling shifts load rather than saving it. Guards from the research: off or setback is only chosen if it saves at least 5% versus staying on (avoids pointless cycling), the first 15 minutes after start-up run at reduced efficiency, switching off costs up to 30% more to recover when relative humidity is above 70%, and above 80% a gap longer than two hours is never fully switched off (mould and latent load). Each gap shows its reasoning in the UI, for example "120-min gap: switched off 3.6 vs 4.0 kWh kept on, pre-cool 30 min".

On the default simulated data the planner keeps the AC on for about 43% of gaps, switches it off for 37% and uses the 28 °C setback for 21%. Longer gaps favour switching off (43% of gaps of two hours or more, against 33% of one-hour gaps), but the margin is modest and depends on assumptions such as indoor-fan standby power, so calibrate before relying on it.

**Baselines.** Savings are shown against every room held at 22 °C from 8:00 to 18:00 (common practice, about 27% saved on the default data) and against 24 °C always-on (the BEE default, about 13% saved). The second is the fairer figure for a well-run campus.

### Server scheduling (NSGA-II)

A solution assigns each job to one server. Two objectives are minimised together:

1. **Makespan**: when the slowest server finishes. A machine that starts from off pays its boot time first.
2. **Energy (Wh)**: for each powered-on server, boot time at idle power, active power while working, and idle power until the batch ends. Unused servers are switched off, except **always-on** nodes (the service and storage machines), which draw idle power for the whole run. A facility figure applies a PUE of 1.6 for cooling and power conversion.

Faster machines cost more energy per unit of work, so the objectives genuinely conflict. NSGA-II returns a **Pareto front** and the UI lets you slide from fastest to greenest. Settings: population 120, 250 generations, fast non-dominated sorting, crowding distance, binary tournament, uniform crossover, per-gene mutation (rate 1.5/n), and an initial population seeded with plans that use only the *k* most efficient machines. The baseline is round-robin placement.

**Where this applies.** Scheduling suits batch, HPC and research nodes. It does not apply to web, database, storage or network servers, which must stay on, and server-room AC must never be switched off or set back; the research brief explains why and describes a safe adoption path (measure, shadow mode, pilot, review).

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3, [Flask](https://flask.palletsprojects.com) (REST API and static hosting), standard-library `csv` and `json` |
| Data generation | Python standard library only, seeded for reproducibility |
| Frontend | Vanilla JavaScript (no framework, no build step), HTML, CSS custom properties with automatic dark mode, hand-written SVG charts |
| Models | Fuzzy controller, room thermal simulation and NSGA-II implemented from scratch in JavaScript, running in the browser |
| Typography | [DM Sans](https://fonts.google.com/specimen/DM+Sans) with a system fallback |
| Tests | Python `unittest` with Flask's test client; Node for front-end checks |
| Docs | Research brief as Word document |

## Project structure

```
seva-energy/
├── server.py            Flask app: schema validation, /api endpoints, serves the UI
├── generate_data.py     Simulated data generator (CLI), writes data/*.csv
├── requirements.txt
├── data/                Generated CSVs (git-ignored, created on first run)
├── docs/                Research brief (.docx)
├── static/
│   ├── index.html       Page shell and collapsible sidebar
│   ├── css/style.css    Theme tokens (light and dark) and components
│   └── js/
│       ├── sample.js    Built-in demo data, used when the backend is unreachable
│       ├── data.js      Helpers, seeded RNG, loading data (API, else demo data)
│       ├── ac.js        Fuzzy setpoints, room model and leave-on-or-off planner
│       ├── scheduler.js NSGA-II, baseline and Pareto-front selection
│       ├── views.js     Overview, Classroom AC, Server scheduling and Data pages
│       └── main.js      Router, sidebar toggle, start-up
└── tests/
    ├── test_backend.py  API and generator tests
    └── smoke.test.js    Controller and optimiser checks
```

Scripts are plain classic scripts that share globals and load in the order above.

## Getting started

```bash
pip install -r requirements.txt
python server.py            # first run generates ./data, then serves http://localhost:5000
```

Set `PORT` to use another port. If you open `static/index.html` directly, or the backend is not running, the app shows built-in demo data with a short notice instead of failing; uploads and regeneration need the backend. Rebuild the demo data from the current CSVs with `python server.py --sample`. To regenerate CSVs from the command line:

```bash
python generate_data.py --seed 3 --days 45 --out data
```

## Data

All input is CSV in `data/`. Extra columns are ignored; the columns below are required unless marked optional.

| File | Columns | Meaning |
|---|---|---|
| `classrooms.csv` | room, building, area_m2, capacity, enrolled | Room size and seating |
| `timetable.csv` | room, weekday (0 = Mon … 4 = Fri), hour (8–17), course, attendance | Weekly repeating classes |
| `weather.csv` | date, hour, temp_c, humidity_pct, condition, solar_wm2 | Hourly outdoor conditions, 24 rows per day |
| `servers.csv` | server, speed, idle_w, active_w, boot_min (optional, default 3), always_on (optional, default 0) | Work units per minute, power in watts, boot time, pinned-on flag |
| `tasks.csv` | task_id, arrival_min, size_units, priority | Jobs to schedule |

The generator produces 10 rooms, a timetable at about 62% slot utilisation with 60–95% attendance, hourly weather (clear, cloudy and rainy days, with humidity that follows the weather), six heterogeneous servers with one always-on node, and 200 jobs with log-normal sizes.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/data` | All five datasets as typed JSON, plus row counts |
| POST | `/api/upload/<name>` | Replace one dataset with the CSV in the request body. Validated first; returns `{"error": "..."}` with status 400 on bad columns, values or empty files |
| POST | `/api/regenerate` | Body `{"seed": 7, "days": 30}` regenerates the simulated set (days clamped to 7–90) |

## Tests

```bash
python -m unittest discover -s tests     # backend, uploads, generator (14 tests)
node tests/smoke.test.js                 # controller and optimiser (needs Node)
```

The Node test checks that setpoints stay within 24–28 °C, that the optimised AC beats both baselines, that the Pareto front is a real trade-off, and that every page renders.

## Assumptions and limitations

- All model constants (heat transfer, thermal mass, COP, cooling capacity, server power) are plausible but invented; they are listed in the research brief and in `AC` in `ac.js`. Calibrate them with sub-metered data before quoting savings as real. Reported savings are projections from the simulation.
- The room model has one temperature node. It does not capture wall heat storage, so it understates what pre-cooling can do for peak load.
- The timetable repeats weekly and attendance is a single value per class, not a live count.
- Humidity affects the decision through a penalty and a mould guard, not a full moisture model.
- The scheduler assumes jobs in a batch are known up front and run independently; it ignores arrival times and priorities.
- No authentication: run it on a trusted network only.

## Roadmap

- Lighting module (occupancy and daylight driven) and other areas such as labs and water pumps. The sidebar already has a placeholder.
- Switch AC off a few minutes before class ends, using the room's stored cool.
- Per-room equipment type (fixed-speed or inverter) and ceiling-fan availability from the inventory.
- Online scheduling with arrival times, priorities and a limit on power cycles per machine.
- Shadow mode against a real cluster (Slurm suspend and resume programs) and live sensor integration through the same CSV or API shape.
- Calibrate the room model from real meter data.

### Adding a module

1. Add its CSV schema to `SCHEMA` in `server.py` and to `generate_data.py`.
2. Add a logic file in `static/js/` and include it in `index.html`.
3. Register a page in `views.js` (`V.yourmodule = { html(), init() }`) and a sidebar link with `data-v="yourmodule"`.
