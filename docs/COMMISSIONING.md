# PoWE Rung 5 / Hardware Commissioning Readiness

Status: SYNTHETIC CONFORMANCE + PLANNING ONLY. No physical hardware, optical power link, meters, or electrical installation has been connected or validated.

## What the harness proves

The local browser and Node test harness feed 18 deterministic synthetic cases into the existing BenchLink parser. These exercise accepted records, truncated data, invalid framing, calibration claims, time gaps, reported faults, and serial protocol errors. A green report means only these synthetic parser expectations passed.

The deliberately fabricated reported-measured fixture shows that a perfectly valid-looking claimed calibration is NOT evidence that a real meter exists. Therefore the source of any real experimental observation requires independent verification.

To run: use the Commissioning Gate inside the PoWE web page, or from Node use npm test, npm run check, and npm run qualify. Download the audit JSON for a fixture SHA-256 manifest and test results. Hashes prove equality of fixture bytes only. They are not instrument signatures or certification.

## Real-world bench requirements (future)

- Independently reviewed low-voltage, enclosed, diffuse commercial LED and suitable photovoltaic receiver. No focused lasers, improvised mains, or unlicensed RF transmitters.
- Two separately calibrated electrical instruments measuring source electrical input and receiver DC output, with documented units, timebase and uncertainties.
- Read-only USB telemetry gateway; verify serial-port opening, modem-line changes and resets cannot energize any device.
- Independently tested physical disconnect, overcurrent protection, thermally safe enclosure, adequate isolation and qualified human safety review.
- Fixed optical geometry and controlled ambient light, with adequate sampling to capture transient and steady-state input/output.
- Independent requested/completed task logs, consistent deadlines, and preregistered fixed-versus-adaptive scheduling policy.
- Preservation of actual source records, calibration details, failures, aborted runs, and reproducible trial assignments.

The browser checklist is merely a human self-attestation. Checking all boxes is NOT a legal or engineering authorization to power a test rig.

## Required stages before physical claims

1. Software conformance against known synthetic failures and success cases.
2. Independent documented physical electrical/optical safety inspection.
3. Two-channel metrology qualification and recorded uncertainty budget.
4. Read-only gateway and device timing/serial reliability tests with independently reviewed low-voltage apparatus.
5. Real recorded optical energy transfer and then a properly controlled fixed/adaptive scheduling comparison, including failed sessions.

## Limitations

BenchLink's voltage/current samples are assumed synchronized across two instruments, although this is not yet proven for any hardware. Trapezoidal power integration skips intervals beyond two seconds and does not resolve fast transients. SHA-256 cannot authenticate meter identity. A file claiming kind=reported is still unverified. A browser message cannot physically stop a dangerous circuit.

Rung 5 remains a tool for designing and auditing tests, not evidence that PoWE transfers usable power over wireless Ethernet.
