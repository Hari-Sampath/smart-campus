# Seva Energy

A smart-campus prototype that cuts electricity use in an institute by making two of its biggest loads smarter: **classroom air conditioning** and **server workloads**. Built for the SEVA hackathon.

Universities waste energy in two predictable ways. AC runs in empty rooms or at one fixed setpoint regardless of how full the room is or how hot it is outside. Compute jobs get spread across every machine, so slow, power-hungry servers stay on even when they add little. Seva Energy replaces both habits with controllers whose decisions can be explained in a sentence.

The prototype runs entirely on simulated data. Every dataset lives in a CSV file, so real timetables, weather feeds and server inventories can be dropped in later without code changes.

## What it does

| Module | Question it answers | Method |
|---|---|---|
| **Classroom AC** | Should the AC be on in this room this hour, and at what temperature? | Fuzzy logic (Sugeno-type) controller |
| **Server scheduling** | Which machine should run each job, so the batch finishes fast without wasting energy? | NSGA-II multi-objective genetic algorithm |
| **Overview** | How much are we saving? | Compares both against realistic baselines |
| **Data** | Where does the input come from? | CSV upload and regeneration through the backend |

## How it works

### Classroom AC (fuzzy controller)

Inputs for every room and hour: how full the room is (attendance ÷ capacity), the outdoor temperature, and sunshine (cloud and rain cool the building envelope). These combine into an *effective temperature* (outdoor temperature plus an adjustment from −1 to +2 °C based on solar radiation).

Occupancy is fuzzified into low, medium and high, and temperature into mild (≈24 °C), warm (≈30 °C) and hot (≈36 °C). Nine rules map each pair to a setpoint, and the output is the weighted average of the rules, rounded to 0.5 °C:

| | Low occupancy | Medium | High |
|---|---|---|---|
| **Mild** | 27 | 26 | 25 |
| **Warm** | 26 | 25 | 24 |
| **Hot** | 25 | 23.5 | 22 |

On top of the setpoint, each room-hour gets one of four decisions:

- **Cooling**: a class is running, so the AC runs at the fuzzy setpoint.
- **Pre-cool**: a class starts next hour, so the room is cooled ahead of time (half an hour of load, setpoint +1 °C).
- **Fan only**: a light class (under 30% full) when the effective temperature is below 26 °C.
- **Off**: nothing scheduled.

The load model is `kW = area × 0.0045 × (effective temp − setpoint) + people × 0.033`. The **baseline** is what many campuses do today: every room at 22 °C from 8:00 to 18:00, whether or not anyone is in it.

I chose fuzzy logic over a decision tree or evolutionary search because the controller is explainable (each row in the UI shows why a decision was made), needs no training data, and degrades smoothly when inputs are unusual.

### Server scheduling (NSGA-II)

A solution assigns each job to one server. Two objectives are minimised together:

1. **Makespan**: the time the slowest server needs to finish, where a server's busy time is the sum of `job size ÷ speed`.
2. **Energy (Wh)**: for each powered-on server, `active power × busy time + idle power × (makespan − busy time)`. Servers with no jobs are switched off and use nothing.

Faster machines cost more energy per unit of work, so the objectives genuinely conflict. NSGA-II returns a **Pareto front**, a set of plans where no plan is both faster and greener than another, and the UI lets you slide along it from fastest to greenest.

Implementation details: population 120, 250 generations, fast non-dominated sorting, crowding-distance selection, binary tournament, uniform crossover and per-gene mutation (rate 1.5/n). The initial population is **seeded** with plans that use only the *k* most energy-efficient machines, which helps the search find the green end of the front. The baseline is round-robin placement.

Because the best plans correspond to "use the *k* most efficient machines", the front is a staircase: moving the slider toward *Greenest* switches machines off one by one.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3, [Flask](https://flask.palletsprojects.com) (REST API and static hosting), standard-library `csv` for parsing and validation |
| Data generation | Python standard library only (`random`, `math`, `csv`), seeded for reproducibility |
| Frontend | Vanilla JavaScript (no framework, no build step), HTML, CSS custom properties with automatic dark mode, hand-written SVG charts |
| Optimisation | Fuzzy controller and NSGA-II implemented from scratch in JavaScript, running in the browser |
| Typography | [DM Sans](https://fonts.google.com/specimen/DM+Sans) via Google Fonts, with a system fallback |
| Tests | Python `unittest` and Flask's test client |

## Project structure

```
seva-energy/
├── server.py            Flask app: schema validation, /api endpoints, serves the UI
├── generate_data.py     Simulated data generator (CLI), writes data/*.csv
├── requirements.txt
├── data/                Generated CSVs (git-ignored, created on first run)
├── static/
│   ├── index.html       Page shell and collapsible sidebar
│   ├── css/style.css    Theme tokens (light and dark) and components
│   └── js/
│       ├── data.js      Helpers, seeded RNG, loading data from the API
│       ├── ac.js        Fuzzy controller and load model
│       ├── scheduler.js NSGA-II, baseline and Pareto-front selection
│       ├── views.js     Overview, Classroom AC, Server scheduling and Data pages
│       └── main.js      Router, sidebar toggle, start-up
└── tests/test_backend.py
```

Scripts are plain classic scripts that share globals and load in the order above.

## Getting started

```bash
pip install -r requirements.txt
python server.py            # first run generates ./data, then serves http://localhost:5000
```

Set `PORT` to use another port. To regenerate data from the command line:

```bash
python generate_data.py --seed 3 --days 45 --out data
```

## Data

All input is CSV in `data/`. Extra columns are ignored; the columns below are required.

| File | Columns | Meaning |
|---|---|---|
| `classrooms.csv` | room, building, area_m2, capacity, enrolled | Room size and seating |
| `timetable.csv` | room, weekday (0 = Mon … 4 = Fri), hour (8–17), course, attendance | Weekly repeating classes |
| `weather.csv` | date, hour, temp_c, humidity_pct, condition, solar_wm2 | Hourly outdoor conditions |
| `servers.csv` | server, speed, idle_w, active_w | Work units per minute and power draw in watts |
| `tasks.csv` | task_id, arrival_min, size_units, priority | Jobs to schedule |

The generator produces 10 rooms, a timetable at about 62% slot utilisation with 60–95% attendance, hourly weather with a daily sine curve plus clear, cloudy and rainy days, six heterogeneous servers, and 200 jobs with log-normal sizes (many small, a few large).

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/data` | All five datasets as typed JSON, plus row counts |
| POST | `/api/upload/<name>` | Replace one dataset with the CSV in the request body. Validated first; returns `{"error": "..."}` with status 400 on bad columns, values or empty files |
| POST | `/api/regenerate` | Body `{"seed": 7, "days": 30}` regenerates the simulated set (days clamped to 7–90) |

## Tests

```bash
python -m unittest discover -s tests
```

The suite covers the data endpoint, typing, upload validation (valid, missing columns, bad values, empty, unknown dataset), regeneration limits and generator determinism. The fuzzy controller and NSGA-II live in the browser and are not yet covered by automated tests.

## Assumptions and limitations

- Cooling load, power figures and server speeds are plausible but invented. Calibrate `kw()` in `ac.js` and the server data before quoting savings as real numbers.
- The timetable repeats weekly and attendance is one value per class, not a live count.
- The AC model is hourly and ignores humidity, thermal mass and equipment other than the AC.
- The scheduler assumes all jobs in a batch are known up front and run independently, and does not use arrival times or priorities yet.
- There is no authentication, so run it on a trusted network only.

## Roadmap

- Lighting module (occupancy and daylight driven) and other areas such as labs and water pumps. The sidebar already has a placeholder.
- Online scheduling that uses job arrival times and priorities.
- Live sensor and BMS integration through the same CSV or API shape.
- Compare the fuzzy controller with a learned model once real data exists.
- Automated tests for the controller and optimiser.

### Adding a module

1. Add its CSV schema to `SCHEMA` in `server.py` and to `generate_data.py`.
2. Add a logic file in `static/js/` and include it in `index.html`.
3. Register a page in `views.js` (`V.yourmodule = { html(), init() }`) and a sidebar link with `data-v="yourmodule"`.
