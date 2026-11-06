# Reproducible measurement plan (not yet performed)

## Primary hypothesis

Under identical hardware, physical placement, payload load and environmental conditions, coordinated scheduling reduces **total wall-plug joules per successfully completed useful task** compared with a fixed schedule.

This is a hypothesis to test, not an established result.

## Phases

1. **Software baseline:** run simulations with known units and conservation invariants; report modeled assumptions and parameter sensitivity.
2. **Bench preparation:** choose commercially certified low-power devices, a calibrated power meter, logging clock, current/voltage instrumentation, and a safe optical PV link. Follow component documentation and applicable regulations.
3. **Measure independently:** characterize power supply draw, transmitter electrical draw, receiver DC output, storage behavior, temperature, and packet success. Keep timestamps synchronized.
4. **Control experiments:** randomized or alternating coordinated-vs-uncoordinated scheduler runs over matching environments. Repeat at multiple separations and angular alignments.
5. **Report honestly:** output delivered receiver joules, source wall-plug joules, successful messages/tasks, latency, energy per task, uncertainty bars, test conditions, failures, and adverse events.

## Never conflate

- RF EIRP with electrical source power
- Incident RF/optical energy with usable receiver DC
- Receiver harvested energy with end-to-end system efficiency
- A valid QR code with an authenticated pairing
- A simulator result with an experimental observation
- Synchronization with energy generation
- Short-range inductive charging with normal Wi-Fi power delivery

## Suggested Rung 2 dataset fields

record_id, timestamp_utc, kind(simulated|measured), channel, apparatus_id, instrument_id, calibration_date, source_input_w, radiated_eirp_w_if_applicable, incident_power_w_if_measured, receiver_dc_w, separation_m, alignment_degrees, ambient_conditions, energy_in_j, energy_out_j, successful_tasks, uncertainty, notes.

Do not invent missing measurements; encode absent fields as null, not zero.
