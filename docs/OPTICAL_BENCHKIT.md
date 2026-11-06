# Optical BenchKit / Rung 3

**Status: plan and offline analysis software, not a completed experiment.**

PoWE BenchKit helps structure a future low-voltage, enclosed, diffuse LED-to-photovoltaic (PV) optical bench experiment. It does not energize hardware, control a transmitter, certify equipment, or verify instrument readings.

## Research hypothesis

Does a power-aware transmission schedule deliver more successfully completed tasks per **source electrical joule** than a fixed transmission schedule, under otherwise matched optical hardware and workload conditions?

This is a **hypothesis**, not an outcome. The synthetic example contains invented numbers used solely to verify importer and dashboard behavior. Rung 3 does not implement a real-time adaptive controller or instrument data acquisition.

## Experimental conditions

- **Fixed:** task transmission attempts are permitted only at predefined time slots, with an explicit queue and expiration policy.
- **Adaptive:** task transmission attempts are permitted when a separately implemented controller estimates adequate buffered receiver energy, using the **same task requests and expiration rules**.
- Both arms must have the same device hardware, optical geometry, source type, ambient conditions, requested tasks, task deadlines and observation duration. Instrument IDs and calibration dates must be recorded.
- **A plan alone cannot enforce matching conditions.** Any real controller and meter acquisition chain must be independently developed, reviewed and tested.

## Bench setup, future physical phase

1. Use a commercially documented, low-voltage, diffuse visible LED and a matched commercial PV receiver in a secure, enclosed mounting arrangement. Do **not** use lasers, focused beams, exposed mains wiring or homemade high-power RF equipment.
2. Independently instrument electrical draw on the **source side** and harvested DC on the **receiver side**. Select measurement ranges and calibration suitable for the devices. Consider transient storage, dark-current offset, PV angle and ambient lighting as potential confounds.
3. Record synchronized current and voltage measurements and integrate each power trace over the same trial interval to determine joules. Do not sum individual watts as though they are energy.
4. Generate a randomized, two-arm order per block with the browser **CREATE PLAN** control. Export JSON and an **empty** CSV result sheet. A seeded PRNG supplies repeatable within-block order, not secure random identity or power control.
5. Implement and independently validate actual fixed/adaptive task scheduler behavior and packet/task logging before performing a comparison. Without working hardware and task logs, mark runs **not performed**; do not fabricate results.
6. Capture actual timestamp, source electrical energy, receiver DC energy, task counts, meter identifiers, calibration date, measurement uncertainty, distance, geometry and safety state for each trial.
7. Stop the experiment when a hardware fault is observed. Preserve original logs, failed runs and exclusion reasons. Use only appropriate certified low-power components and a physical kill switch.
8. Import the completed CSV locally. The UI will explicitly label measured data **reported, not independently verified** and keep it separate from simulated data.

## CSV schema

Required columns are:

    trial_id,block_id,timestamp_utc,sequence,condition,kind,channel,apparatus_id,geometry_id,task_set_id,source_meter_id,receiver_meter_id,calibration_date,separation_m,duration_s,source_energy_j,receiver_energy_j,source_uncertainty_j,receiver_uncertainty_j,requested_tasks,completed_tasks,safety_state,notes

- Channel must be optical for Rung 3.
- Condition must be fixed or adaptive, one of each within a trial block.
- Sequence must be 1 or 2. Paired trials must use opposite sequence positions.
- Kind must be measured (a **user-reported, unverified** file claim) or simulated. These categories are never mixed in comparisons.
- Timestamp must be an existing UTC calendar instant ending Z, not a future timestamp.
- Apparatus, geometry and task-set IDs are required in both categories. Source and receiver meter IDs plus a valid calibration date are required for measured rows, and must be empty for simulated rows.
- Separation is meters, duration seconds, source and receiver energy joules. Both energy uncertainty fields use joules and must be positive for measured rows.
- Requested and completed task counts are nonnegative integers, with requested at least one and completed no greater than requested.
- A measured safety_state is one of ok, unknown, fault. A simulated safety_state must be not_applicable.
- Empty cells for planned observations in a generated template are intentional. Fill from real logs before import. A template will fail validation until completed.
- CSV is handled locally, with a 512 KiB/1000-record cap. The interface never uploads the file to a service.

## Paired analysis and exclusions

BenchKit includes a pair only if exactly two records (fixed and adaptive) of the same provenance claim share the following fields: block ID, kind, channel, apparatus, geometry, task set, separation, duration, requested tasks, source meter, receiver meter and calibration date. Sequence positions must be different.

For **reported measured** pairs, both rows must have safety_state=ok. If either is unknown or fault, the entire pair is **listed as excluded**. This is an analysis filter, **not** a safety certification. If sample collection is incomplete, that pair is also excluded and listed. Exclusion can bias results; all reported comparisons require a transparent count of excluded trials and reasons.

Within each separate provenance category, for each schedule:
- tasks per source joule = sum(completed tasks) / sum(source energy joules)
- source joules per completed task = sum(source energy joules) / sum(completed tasks) if any tasks completed
- delivered fraction = sum(completed tasks) / sum(requested tasks)

The relative percentage difference is computed against the fixed schedule if its tasks-per-joule ratio is nonzero. This is a **descriptive quantity**, not proof of causation, optical transfer efficiency, or statistical significance. Receiver-side energy is shown in the underlying imported data but is not equivalent to total system efficiency.

## Provenance and next work

A user-editable CSV cannot authenticate a physical experiment. A malicious or accidental label of measured can be internally consistent while entirely fictitious. Before publication, preserve acquisition-chain raw logs, calibrated source and receiver instruments, clock synchronization, error budgets, signatures/checksums, protocol preregistration and independent review.

The recommended next task is an independent low-voltage sensing/logger prototype with explicit controller logs and strict hardware safety interlocks. This page must **never** make real electrical control decisions solely from an imported QR invite, a CSV field or a network message.
