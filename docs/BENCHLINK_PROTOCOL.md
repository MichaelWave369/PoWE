# Rung 4 / BenchLink read-only instrument interface

**Software integration only.** PoWE has not connected to or tested any physical instruments. BenchLink accepts a narrowly defined, user-provided NDJSON (newline-delimited JSON) telemetry stream by local file or browser Web Serial (when supported). It never sends bytes to a serial device. The browser does not drive a lamp, charger, RF transmitter, laser or relay.

Opening a serial connection can affect USB serial DTR/RTS on some adapters. Do not attach BenchLink directly to safety-critical hardware or any device where opening a serial session can energize an output. Use an independently designed, read-only USB telemetry gateway with hardware-enforced safety, manual cutoff and isolated low-voltage measurement inputs.

## Frame protocol: powe.benchlink.v1

Each line is one JSON object, maximum 4096 UTF-8 bytes.

First line: header (required before any sample)

    {"protocol":"powe.benchlink.v1","type":"header","session_id":"run-1","kind":"reported","apparatus_id":"rig-a","source_meter_id":"dmm-source","receiver_meter_id":"dmm-receiver","calibration_date":"2026-10-01","timestamp_utc":"2026-11-06T20:00:00Z"}

For offline synthetic simulation set kind to synthetic and omit the two meter IDs and calibration_date. **Reported** means a claim made by the stream, not independent evidence of real equipment or calibration.

Sample lines, at monotonically increasing elapsed_ms; sequence starts at 0 and increases by one:

    {"protocol":"powe.benchlink.v1","type":"sample","session_id":"run-1","sequence":0,"elapsed_ms":0,"source_v":5.0,"source_a":0.1,"receiver_v":2.0,"receiver_a":0.02,"safety_state":"ok"}

A real sample's safety_state must be ok, unknown or fault. A synthetic sample must use not_applicable. Voltage is **volts**, current **amperes**. Source and receiver energy are integrated separately. BenchLink enforces defensive *software input bounds* 0–30 V and 0–5 A per side, but these are NOT safe-operating ratings or regulatory permission.

Final line, required for a complete record:

    {"protocol":"powe.benchlink.v1","type":"end","session_id":"run-1","samples":7}

The number must equal sample count. No data can follow a valid end frame. Maximum 10,000 samples, one hour elapsed time, 2 MiB per imported transcript. A serial stream is received in-browser, bounded by the same record limits.

## Energy calculation and fail-closed rules

P_source = V_source * I_source. P_receiver = V_receiver * I_receiver.

For each pair of consecutive samples with interval dt <= 2 seconds and acceptable safety state, approximate energy by trapezoidal integration:

    E += (P_previous + P_current) * dt / 2

Data gaps > 2 seconds are not extrapolated. Unknown or faulted real safety-state intervals are not integrated. Both are counted and disqualify a run for BenchKit trial export. Only an ended run with 2+ samples, at least five seconds duration, nonzero integrated source energy, no missing intervals and no safety/collector integrity issues is eligible for **metadata-claimed** BenchKit trial conversion.

Failure/unknown sample reports are audit information, NOT a physical shutdown. Stop the test using the hardware switch; BenchLink may stop reading serial, but it cannot de-energize any apparatus.

## BenchKit integration

BenchLink exports:
- a local JSON observation receipt with header metadata, per-sample data, computed energies, issue lists, and explicit self-reported provenance;
- optionally a row suitable for the Rung 3 Optical BenchKit CSV schema, once all fields are supplied.

A compatible trial row requires manually entered trial/block ID, within-pair sequence (1 or 2), fixed/adaptive condition, geometry and task set, separation, requested and actually completed tasks. **Reported** runs additionally require independently determined, positive joule uncertainty for source and receiver. These values are not guessed from reported power.

BenchLink does not authenticate the NDJSON source, verify real hardware state, validate whether the provided meter was calibrated, prove optical transfer efficiency, measure latency or implement the adaptive scheduler. A valid CSV row is still only a reported claim. Rung 3 analysis is descriptive and separately excludes mismatched or unsafe pairs.

To compare arms in Rung 3, capture two separate sessions with the same block ID, matching rig/geometry/task set/meters/calibration and requested work, but opposite schedule conditions and sequence. Add both completed rows to a single BenchKit CSV (the dashboard can queue records locally), then import that file into Rung 3.

## Privacy and browser compatibility

No source readings or files are uploaded. Web Serial requires a compatible desktop browser, user interaction, explicit port permission and a secure origin (HTTPS or localhost); a normal file-import path works even when Web Serial is unavailable. Browser memory is transient: save the observation receipt and original raw logs manually.

The supplied synthetic fixture exists only to test functionality. It is **not** a physical laboratory result.

## Next hardware-specific development

Choose a documented read-only telemetry adapter and two independent certified sensors/meters suitable for low-voltage LED and PV DC outputs. Implement and bench-test its protocol firmware independently, with proper grounding, isolation, fusing, thermal monitoring and manual shutdown. Only then run a real experiment; record calibration/uncertainty and independent task outcome logs.
