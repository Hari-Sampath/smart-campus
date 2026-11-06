# Seva Energy

A smart-campus prototype that cuts electricity use in an institute by making two of its biggest loads smarter: **classroom air conditioning** and **server workloads**. Built for the SEVA hackathon.

Universities waste energy in two predictable ways. AC runs at one fixed setpoint whether a room is empty or full, and nobody knows whether it is cheaper to leave it on between classes or switch it off. Compute jobs get spread across every machine, so slow, power-hungry servers stay on even when they add little. Seva Energy replaces both habits with controllers whose decisions can be explained in a sentence.

The prototype runs entirely on simulated data. Every dataset lives in a CSV file, so real timetables, weather feeds and server inventories can be dropped in later without code changes. Research, claim boundaries, deployment notes and a three-minute demo story are in [`RESEARCH_AND_DEMO.md`](RESEARCH_AND_DEMO.md).

## What it does

| Module | Question it answers | Method |
|---|---|---|
| **Classroom AC** | For each room and hour: cooling, kept on, setback, pre-cool, fans only or off, and at what temperature? | Fuzzy setpoint plus a physics-based planner |
| **Server scheduling** | Which machine should run each job so the batch finishes fast without wasting energy? | NSGA-II multi-objective genetic algorithm |
| **Overview** | How much could be saved, and what changes the estimate? | Baselines, comfort proxy, sensitivity controls, editable tariff and carbon factor |
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

**Baselines.** Overview leads with every room held at 24 °C from 8:00 to 18:00 (BEE default for covered labelled room ACs; about 14% saved on the default data) and retains 22 °C always-on as a secondary comparator (about 27%). Both are simulated projections. An Overview comfort proxy counts modeled class starts within 0.5 °C of the planned setpoint; it is not a measured comfort score or Standard 55 assessment. Three sliders stress-test assumed fan/controls power, thermal mass and COP, including a check of all eight low/high corners.

The Overview calculator translates projected AC kWh into rupees and CO₂. Tariff starts blank because electricity rates depend on state, consumer category and billing details; enter the campus effective marginal rate from its bill. The editable carbon factor starts at CEA's latest Indian-grid weighted average, 0.675 kg CO₂/kWh for FY 2025–26. Results remain projections.

### Server scheduling (NSGA-II)

A solution assigns each job to one server. Two objectives are minimised together:

1. **Makespan**: when the slowest server finishes. A machine that starts from off pays its boot time first.
2. **Energy (Wh)**: for each powered-on server, boot time at idle power, active power while working, and idle power until the batch ends. Unused servers are switched off, except **always-on** nodes (the service and storage machines), which draw idle power for the whole run. A facility figure applies a PUE of 1.6 for cooling and power conversion.

Faster machines cost more energy per unit of work, so the objectives genuinely conflict. NSGA-II returns a **Pareto front** and the UI lets you slide from fastest to greenest. Settings: population 120, 250 generations, fast non-dominated sorting, crowding distance, binary tournament, uniform crossover, per-gene mutation (rate 1.5/n), and an initial population seeded with plans that use only the *k* most efficient machines (it is not seeded with the baseline heuristics, so the benchmark stays independent).

#### Benchmark: what clusters actually do

Round-robin is how web load balancers spread requests, not how batch clusters place jobs, so it is not used as a baseline. Slurm gives each queued job to the lowest-weight node that fits, with older, slower nodes conventionally weighted lowest, and normally leaves idle nodes on. The research literature on mapping independent jobs onto mixed machines (Braun et al., 2001) uses first-free, minimum-completion-time and Min-Min. The Server scheduling page benchmarks the selected plan against four references on the same jobs and machines:

1. **Slurm-style first-free**: queue order, lowest-weight idle node, nodes always on (what most sites run today).
2. **MCT**: queue order, each job to the machine where it finishes first, always on.
3. **Min-Min**: repeatedly place the job and machine pair that finishes earliest, always on.
4. **Min-Min with idle machines switched off**: the strongest simple method, with power management.

Results on the default simulated data (batch of 20, 40, 60 and 80 jobs): the NSGA-II front always contains a plan that is no slower and no more energy-hungry than all four references. At the same finish time the extra saving over Slurm-style placement is small, 0.3% to 6%, because these heuristics are already close to optimal for makespan. The large saving, about 38–42% less energy, comes from accepting a finish time roughly three times longer, so it only suits deferrable batch work. The Overview card reports the same-finish figure first for that reason. The batch is treated as static (arrival times are ignored); replay real job logs before quoting numbers.

**Where this applies.** Scheduling suits batch, HPC and research nodes. It does not apply to web, database, storage or network servers, which must stay on, and server-room AC must never be switched off or set back. The Overview includes an offline mock adapter that validates and logs dry-run commands but never connects to equipment. A BACnet point map and a Slurm power-save integration are plausible deployment paths where controllers, permissions and operational safeguards exist; measure, shadow, pilot and review before any actuation. More detail and sources are in [`RESEARCH_AND_DEMO.md`](RESEARCH_AND_DEMO.md).

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3, [Flask](https://flask.palletsprojects.com) (REST API and static hosting), standard-library `csv` and `json` |
| Data generation | Python standard library only, seeded for reproducibility |
| Frontend | Vanilla JavaScript (no framework, no build step), HTML, CSS custom properties with automatic dark mode, hand-written SVG charts |
| Models | Fuzzy controller, room thermal simulation and NSGA-II implemented from scratch in JavaScript, running in the browser |
| Typography | [DM Sans](https://fonts.google.com/specimen/DM+Sans) with a system fallback |
| Tests | Python `unittest` with Flask's test client; Node for front-end checks |
| Docs | Research references and demo story in Markdown |

## Project structure

```
seva-energy/
├── server.py            Flask app: schema validation, /api endpoints, serves the UI
├── generate_data.py     Simulated data generator (CLI), writes data/*.csv
├── requirements.txt
├── data/                Generated CSVs (git-ignored, created on first run)
├── RESEARCH_AND_DEMO.md Research references and demo story
├── static/
│   ├── index.html       Page shell and collapsible sidebar
│   ├── css/style.css    Theme tokens (light and dark) and components
│   └── js/
│       ├── sample.js    Built-in demo data, used when the backend is unreachable
│       ├── data.js      Helpers, seeded RNG, loading data (API, else demo data)
│       ├── ac.js        Fuzzy setpoints, room model and leave-on-or-off planner
│       ├── scheduler.js NSGA-II, baseline and Pareto-front selection
│       ├── adapter.js   Offline dry-run command validation and log
│       ├── views.js     Overview, Classroom AC, Server scheduling and Data pages
│       └── main.js      Router, sidebar toggle, start-up
└── tests/
    ├── test_backend.py  API and generator tests
    ├── smoke.test.js    Router, controller, optimiser and benchmark checks (Node)
    └── e2e_browser.py   Optional real-browser check (Playwright)
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
node tests/smoke.test.js                 # router, controller, optimiser, benchmarks (needs Node)
python tests/e2e_browser.py [url]        # optional: real Chromium via Playwright; defaults to opening index.html from disk
```

The Node test checks that a fresh page load (no URL hash) shows the overview rather than an error, that setpoints stay within 24–28 °C, that the optimised AC beats both baselines, that the Pareto front is a real trade-off, that every baseline is beaten by some front plan, and that every page renders. The browser test opens the app the way you would, clicks each menu item and collapses the sidebar.

## Assumptions and limitations

- All model constants (heat transfer, thermal mass, COP, cooling capacity, server power) are plausible but invented; they are listed in `AC` in `ac.js` and `RESEARCH_AND_DEMO.md`. Calibrate them with sub-metered data before quoting savings as real. Reported savings are projections from the simulation.
- The room model has one temperature node. The thermal-mass slider is a sensitivity multiplier, not a calibrated wall model; it does not resolve multiple surfaces or radiant comfort.
- The timetable repeats weekly and attendance is a single value per class, not a live count.
- Humidity affects the decision through a penalty and a mould guard, not a full moisture model.
- The scheduler assumes jobs in a batch are known up front and run independently; it ignores arrival times and priorities. The Slurm-style baseline approximates a real queue.
- No authentication: run it on a trusted network only. The new adapter is a mock dry-run only and cannot actuate hardware.

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
