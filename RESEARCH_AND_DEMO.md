# Seva Energy: evidence, limits and demo notes

## Claims to make

- **Classroom AC:** report the simulated projection against the 24°C always-on baseline first. Keep the 22°C comparison as context only. The prototype does not have meter readings or calibrated room parameters.
- **Server scheduling:** lead with the same-finish comparison, which is modest. The larger saving accepts a much later batch completion and applies only to deferrable work.
- **Comfort:** the Overview reports the share of modeled class starts within ±0.5°C of the controller's planned setpoint. This is a project-defined model check, not a measured comfort score or a claim of ASHRAE Standard 55 compliance. Standard 55 considers air and radiant temperature, humidity, air speed, clothing and activity, among other local discomfort factors.
- **Money:** users must enter the campus effective marginal rate from their bill. There is no defensible universal campus tariff: CEA's tariff book lists different rates by state, supply voltage, consumer category and billing structure. The calculator deliberately has no rupee default.
- **Carbon:** the initial editable factor is **0.675 kg CO₂/kWh**, the CEA FY 2025–26 Indian-grid weighted-average factor (0.675 tCO₂/MWh), including renewable generation and captive injection. This is a national annual average, not a campus-specific or real-time marginal factor.

## What-if controls

The fan/controls power, room thermal mass multiplier and COP sliders exercise three assumed inputs in the room energy/temperature model. The displayed ranges (30–150 W, 0.5–2× and COP 2–5) are sensitivity bounds for this prototype, not standards or claims about particular equipment. The “8 corners” action evaluates every low/high combination and reports whether projected savings stay positive against 24°C always-on in each combination. It tests the model's sensitivity; it does not validate the model. Room sub-metering, temperature/humidity sensors and equipment specifications are needed to calibrate it.

The comfort proxy compares modeled room air temperature at the start of each scheduled class with that class's planned setpoint. The 0.5°C tolerance comes from the planner's own arrival constraint. It does not imply that students will feel comfortable. A real pilot should collect occupied-zone air and radiant temperature, relative humidity, air speed where practical, attendance, and occupant feedback, then review results with facilities staff against the applicable comfort method.

## Deployment adapter

The new browser adapter is intentionally a **mock dry-run boundary**. It logs what it would request and blocks out-of-range setpoints, occupied-room shutoff, pinned-on servers and servers with assigned work. It does not connect to BACnet, a building-management system, Slurm, IPMI, or physical equipment.

The deployment path is feasible where compatible control points and operational authority exist:

1. Inventory thermostats/controllers, room sensors, schedules, server roles and machine power controls; map and allowlist points with facilities and IT.
2. Read telemetry and produce plans in shadow mode. Compare predicted loads and class-start temperatures with meters and sensors; tune the room constants.
3. Pilot a small number of classrooms with hard setpoint bounds, occupied-room lockout, operator override, command acknowledgement/readback, audit logs and an automatic fallback to the existing controller.
4. For compute, use a Slurm power-save integration only for eligible idle, deferrable compute nodes. Keep service/storage nodes excluded; respect suspend/resume timeouts and rate limits, and verify node registration before scheduling work.
5. Expand only after facilities and cluster operators review comfort, energy, availability and override records.

ASHRAE Standard 135 (BACnet) defines communications for monitoring and control of HVAC and other building systems. A building-specific gateway and point mapping are still required; the protocol itself does not make every AC unit controllable. Slurm documents `SuspendProgram`/`ResumeProgram`, timeouts, rates and failure behavior for node power saving. Neither adapter is implemented against real hardware here.

## Three-minute talk track

1. **0:00–0:25 — Problem.** “Campuses cool empty rooms and leave batch clusters fully powered. Seva focuses on these two loads with decisions a facilities or cluster team can inspect. Today this is a simulation.”
2. **0:25–1:15 — Classroom decision.** Open Classroom AC, point to the “Why” column and compare a long empty gap that switches off and pre-cools with a short gap that stays on. Explain the planner's modeled arrival-temperature guard.
3. **1:15–1:45 — Evidence and uncertainty.** Return to Overview, lead with savings versus 24°C always-on and call it a projection. Show the comfort proxy and move the three assumption sliders. Run all eight endpoint combinations. State that actual comfort and savings require sensor and meter calibration.
4. **1:45–2:20 — Server trade-off.** Open Server scheduling and move the fastest-to-greenest slider. Show same-finish energy savings first; explain that the larger reduction trades away roughly three times the completion time and suits only deferrable batches.
5. **2:20–2:45 — Benchmark.** Compare the same jobs and machines against Slurm-style first-free, MCT and Min-Min. Explain why round-robin is not a representative batch-cluster baseline.
6. **2:45–3:00 — Deployment.** Run the dry-run log. Show valid requests and blocked unsafe examples. Describe point mapping, shadow mode, a small operator-approved pilot and meter/sensor verification.

## Sources

- Bureau of Energy Efficiency, [FAQ on optimum AC temperature settings](https://beeindia.gov.in/sites/default/files/press_releases/FAQ.pdf) and [Light Commercial AC Schedule 24](https://beeindia.gov.in/sites/default/files/Schedule_24_LCAC.pdf). The FAQ says comfort depends on humidity and air movement as well as temperature; the schedule specifies a 24°C default for covered labelled light-commercial units. It is not a claim that all campus equipment is covered.
- ASHRAE, [Standard 55 overview](https://www.ashrae.org/technical-resources/bookstore/standard-55-thermal-environmental-conditions-for-human-occupancy) and [Handbook chapter on supervisory controls and thermal storage](https://handbook.ashrae.org/Handbooks/A15/SI/A15_CH42/a15_ch42_si.aspx). Comfort depends on multiple environmental and personal factors; savings from pre-cooling depend on control strategy and building thermal response.
- Central Electricity Authority, [CO₂ Baseline Database, Version 22.0 (August 2026)](https://cea.nic.in/cdm-co2-baseline-view?lang=en&mappingId=234) and its linked [user guide](https://cea.nic.in/api/cdm-report-version/view-pdf/en/82). The summary reports a FY 2025–26 weighted average of 0.675 tCO₂/MWh including renewables and captive injection.
- CEA, [Electricity Tariff & Duty and Average Rates, 2025–26](https://cea.nic.in/reports/dashboardView?headingId=107&lang=en&subHeadingId=1001&subSubHeadingId=10008&title=Tariff+%26+Duty+of+electricity+supply+in+India). It compiles notified tariffs by state and consumer category; use the campus bill for its actual effective rate.
- ASHRAE, [Standard 135 resource files](https://data.ashrae.org/BACnet/index.html). BACnet covers building automation communications including HVAC monitoring and control.
- SchedMD, [Slurm power-saving guide](https://slurm.schedmd.com/power_save.html). Documents power-save integration, suspend/resume programs, timeouts, rates, node states and failure handling.
