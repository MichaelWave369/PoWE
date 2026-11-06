# PoWE — Power over Wireless Exchange

**Coherent coordination of wireless energy and information.**

[Launch the Energy Lab locally](#run-the-energy-lab) · [Architecture](docs/ARCHITECTURE.md) · [Measurement plan](docs/MEASUREMENT_PLAN.md) · [Safety](docs/SAFETY.md) · [LightBridge](https://github.com/MichaelWave369/LightBridge)

> **Status: Rung 1, experimental software.** Everything in the Energy Lab is a **simulation**. No real RF transmitter, optical power link, inductive charger, or physical measurement is connected. The model does not demonstrate standard PoE over air.

## What PoWE means

PoWE is a modular investigation of *energy-aware networking*. It grew from the question, “Could power follow wireless Ethernet?” Rather than claim unlimited wireless power, we want to coordinate **energy availability, information exchange, timing, and verified measurements**.

PoWE explores three different physical channels:

- **RF harvesting:** a Friis free-space model for a far-field 2.4 GHz receiver followed by an assumed rectifier efficiency.
- **Optical harvesting:** a simple LED electrical-input → optical-output → photovoltaic receiver budget. An ordinary QR camera does **not** power the receiver.
- **Near-field transfer:** an explicitly illustrative short-range coupling proxy, **not** a validated resonant coil model.

Separately, **LightBridge** is the proposed offline data / pairing transport. QR payloads can *describe* a link, but scanning a QR symbol does not deliver useful electrical power.

## Rung 1: browser Energy Lab

- Run or pause a deterministic three-node simulator.
- Adjust separation of each modeled channel and examine estimated receiver DC power.
- Follow stored energy, energy consumed by idle and telemetry loads, storage overflow, skipped transmissions and brownout time.
- Export a CSV with an explicit simulated-data marker.
- Generate short-lived QR-ready pairing invitation **JSON** and validate its structure / expiration.
- Optionally scan an existing QR invitation using a browser with BarcodeDetector support. The software does **not** render its own QR code yet.
- No accounts, tracking, network calls, build toolchain or external runtime dependencies.

### Run the Energy Lab

Because this page uses ES modules, serve it over localhost rather than opening the HTML with a file URL:

~~~sh
python -m http.server 8000
# Open http://localhost:8000/
~~~

To run tests, install Node.js 20+:

~~~sh
npm test
npm run check
~~~

There are no third-party npm dependencies. You can also host the static files on GitHub Pages after enabling Pages for this repository.

## Why coherence matters

PoWE treats coherence as an engineering coordination principle: aligned interfaces, negotiated schedules, resonance *when physically supported*, and transparent energy accounting. **Coherence cannot create energy or bypass conservation laws.** Neither data-link synchronization nor QR scanning changes Friis loss or inductive coupling.

A useful future research question is: **does a coordinated heterogeneous energy-and-data network achieve more useful tasks per joule than a comparable uncoordinated system under the same hardware and conditions?** That requires real hardware measurements and control groups.

## Project boundaries

- **Not a substitute for IEEE 802.3 PoE.** The name references the original idea, not compliance or watts delivered through Wi-Fi.
- **No production pairing security.** Valid JSON and TTL do not authenticate a device. Before integration, require cryptographic identity checks, user approval, replay protection and real-world transport validation.
- **No regulatory or exposure approval.** Do not treat simulation wattages as permission to transmit.
- **No performance claim for LightBridge.** Its recovery prototypes are not validated for this application.
- **No hardware-control code in Rung 1.**


## Rung 2: local Measurement Lab

The browser page now has a separate **Measurement Lab** panel for importing CSV readings, grouped by channel and provenance. It validates instrument identifiers, timestamps, reported calibration dates, uncertainty and safety flags for rows labeled "measured", but does **not authenticate** any claim made by a file. Rows labeled "simulated" may not claim hardware calibration or safety status.

- Local-only CSV import: 512 KiB maximum, 1000 data rows maximum, no server upload.
- Independent views for **reported measured** and **simulated** values; no misleading combined power totals.
- CSV syntax, date, numeric, duplicate-ID and provenance validation.
- Synthetic demo with no alleged experimental measurements.
- [CSV schema and interpretation guide](docs/MEASUREMENT_SCHEMA.md) and [explicit synthetic sample](examples/simulated-demo.csv).

The output is arithmetic mean receiver DC watts, not joules or whole-system efficiency. Calibrated device data and cryptographic provenance are future work.

## Rung 3: Optical BenchKit

- Plan and download randomized within-block fixed/adaptive experimental sequences; get an empty result CSV template.
- Import self-reported optical trial data, with explicit distinction between reported measurements and simulated fixtures.
- Only compare properly paired, matching setups; list unsafe, incomplete or mismatched trial pairs as exclusions.
- Report completed tasks per input-source joule, rather than confusing receiver watts with system energy efficiency.
- No transmitter, laser, camera or charging hardware is controlled. No laboratory experiment has yet been performed by PoWE.
- [Optical BenchKit schema, test protocol and cautions](docs/OPTICAL_BENCHKIT.md).

## Rung 4: BenchLink read-only telemetry

BenchLink can ingest a local NDJSON transcript or read it with a user-approved Web Serial session (supported secure-context browsers only). It uses **two independent electrical reading channels**, reports separate source and receiver joules with bounded trapezoidal integration, flags gaps/faults/unknown safety, and rejects incomplete sessions from BenchKit export.

- Save a local **unverified observation receipt** as JSON with all normalized samples and exclusion reasons.
- Enter task counts, trial identity and independently estimated measurement uncertainties and queue eligible records to export in the existing Rung 3 Optical BenchKit CSV format.
- Load a clearly labeled synthetic fixture; no real instrument output has been tested or authenticated.
- Web Serial is strictly **read-only** from the browser; no device commands, physical shutoff or energy output are included.
- [BenchLink protocol and hardware-safety boundaries](docs/BENCHLINK_PROTOCOL.md).

## Rung 5: Commissioning Gate

- Deterministic synthetic protocol conformance: run the same fixtures through the actual BenchLink parser, with required eligible, ineligible and rejected outcomes.
- Browser conformance dashboard and local synthetic NDJSON downloads.
- SHA-256 fixture byte-integrity manifest and local audit receipt, **not a cryptographic hardware authentication**.
- Operator checklist for real-world electrical, optical, metrology and workflow readiness, explicitly **self-attestation only**.
- Repeat checks in Node using npm run qualify. CI also runs this command.
- [Commissioning limitations and real-world qualification guide](docs/COMMISSIONING.md).

**No physical device, transmitter, meter, optical-power link or safety interlock was operated or verified.** The synthetic harness cannot establish real wireless energy-transfer performance.

## Roadmap

1. **Rung 1 (this branch):** simulator, explicit assumptions, browser dashboard, pairing invitation schema, tests.
2. **Rung 2 (this branch):** local CSV measurement importer with units, calibration metadata and measured/simulated separation.
3. **Rung 3:** optical trial planner, strictly paired analysis and dry-run protocols. Real hardware measurements remain future work.
4. **Rung 4:** read-only instrument telemetry adapter and BenchKit trial export. Actual device and LightBridge adapter validation remain future work.
5. **Rung 5 (this branch):** synthetic commissioning, conformance harness and operator readiness guidance. Real controlled comparisons are still future work.

Original PoWE code is released under the [MIT license](LICENSE). Hardware safety and legal compliance remain the responsibility of anyone performing physical experiments.
