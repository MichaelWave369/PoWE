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

## Rung 6: MK1 bench design and structural preflight

Rung 6 proposes a **5 V DC, <=0.5 A commercial diffuse LED source**, an independently loaded commercial photovoltaic receiver, two independently calibrated electrical measurement channels, and an isolated read-only BenchLink telemetry adapter. It adds an interactive design checker in the browser with downloadable versioned manifest, candidate BOM category template, and **unperformed** verification matrix.

- Conservatively bound the hypothetical DC source supply and current limits (default design 5 V × 0.4 A = **2 W supply-side ceiling**, not measured wattage).
- Check plan constraints for geometry, sensor resolution target, timestamp synchronization, enclosure, independent overcurrent protection, optical boundaries and fail-safe data collection.
- Require separate source and receiver electrical instrument selection and subsequent independent calibration.
- Preserve unresolved hardware and electrical-inspection blockers even when all *software design constraints* pass.
- See [the MK1 source/receiver architecture and metrology notes](docs/HARDWARE_MK1.md) and [candidate components and source references](docs/PART_CANDIDATES.md).

**No parts have been purchased or assembled, no electrical apparatus verified, no real optical link measured.** These outputs are planning artifacts, not instructions to energize equipment.

## Rung 7: Optical controls and baseline subtraction

Rung 7 adds a local **LED OFF-before → LED ON → LED OFF-after** analysis tool. It pairs three separate BenchLink NDJSON sessions, requires matching self-declared apparatus/metrology metadata, checks sequence/timing/gaps/faults, and estimates the background PV electrical load by interpolation between the two LED-off controls.

- Display signed **light-associated PV DC electrical energy difference**, source DC input and reported uncertainty, with a baseline drift warning.
- Keep imported sessions **self-reported and not independently verified**. An entirely invented fixture is provided solely to demonstrate the calculations.
- Explicitly distinguish DC electrical input to the LED from AC wall-plug energy or physical optical energy delivered.
- Download a local JSON receipt with SHA-256 hashes of the three exact input files and unverified derived observations.
- [Read the LED-off/on/off control protocol and its limits](docs/OPTICAL_CONTROLS.md).

**No real hardware observations have yet been taken or proven.** A positive computed delta does not prove transfer efficiency, authenticated instrument provenance or a PoWE networking benefit.

## Rung 8: LightBridge coordination lab

The LightBridge repository now contains a separate functional React-based **PLB1 QR sender/receiver console** under its site directory. Its screen-to-camera transport is not yet embedded in PoWE, and neither project currently provides reviewed signed peer identity and permission grants.

Rung 8 adds two independent software-only capabilities:

- **Same-trace synthetic scheduling:** compare fixed and adaptive receiver task scheduling under identical generated source electrical DC consumption, receiver harvested DC, arrivals, and link availability. Both policies preserve an explicit receiver joule conservation ledger; an improved result is *not* a physical performance claim.
- **LightBridge PLB1 receipt field compatibility:** import the two JSON receipts independently generated by LightBridge, and check claimed session, SHA-256, size, encryption flag and completion status. A matching pair is still user-supplied data, not independently authenticated identity, consent, PLB1 bytes or optical transfer.

There is no runtime import of LightBridge into PoWE. Rung 8 **does not transmit PLB1 payloads**, control electrical hardware or grant pairing access. Read [the boundary and future interop gates](docs/LIGHTBRIDGE_COORDINATION.md).

## Rung 9: Genuine PLB1 software file-byte interoperability

Rung 9 adds an original, independent PLB1 file encoder/receiver in PoWE and **automated bidirectional binary interoperation against LightBridge's actual React console protocol source at pinned commit `d7cc1ea7ed31c66344a69ab2891ce5c9890d02ca`**.

- **LightBridge → PoWE:** LightBridge generates frame payloads from real binary bytes, PoWE independently reassembles, optionally decrypts, and verifies protected and original-file SHA-256 hashes.
- **PoWE → LightBridge:** PoWE prepares PLB1 frames that LightBridge's own Receiver and finalizeTransfer reconstruct and verify byte-for-byte.
- Cross-repo CI tests encrypted and unencrypted inputs, incomplete transfer rejection, frame CRC errors, wrong passphrases and parity-assisted recovery.
- New browser panel supports local file-to-PLB1 frame text export and local frame text-to-verified-file import with both sender and receiver receipts.
- **No physical optical transfer was performed.** The software test passes bytes in memory, not through a camera, screen, receiver panel or optical-power circuit.
- See [Rung 9 interoperability, security boundaries, and reproducibility](docs/PLB1_INTEROPERABILITY.md).

Sender/receiver CRC and SHA success confirm reconstructed bytes, not who sent them or whether the peer has granted access. No QR invitation is promoted to authenticated identity, and PoWE never enables hardware power from a PLB1 payload.

## Roadmap

1. **Rung 1:** simulator, explicit assumptions, browser dashboard, pairing invitation schema, tests.
2. **Rung 2:** local CSV measurement importer with units, calibration metadata and measured/simulated separation.
3. **Rung 3:** optical trial planner, strictly paired analysis and dry-run protocols. Real hardware measurements remain future work.
4. **Rung 4:** read-only instrument telemetry adapter and BenchKit trial export. Actual device and LightBridge adapter validation remain future work.
5. **Rung 5:** synthetic commissioning, conformance harness and operator readiness guidance. Real controlled comparisons are still future work.

6. **Rung 6:** physical prototype design, structural limits and evidence-gated readiness planning. Physical qualification is still unperformed.

7. **Rung 7:** LED off/on/off local analysis and signed receiver energy delta with baseline-drift flag. Actual meter acquisition and optical experiments remain unperformed.

8. **Rung 8:** mock fixed/adaptive energy-workload scheduling, plus untrusted LightBridge PLB1 receipt compatibility checks. Physical and identity/authentication validation remain future milestones.

9. **Rung 9 (this branch):** independent PLB1 file encoding/decoding and cross-repository verified binary-byte software interoperability. Physical camera tests, authenticated pairing and hardware energy delivery remain future work.

Original PoWE code is released under the [MIT license](LICENSE). Hardware safety and legal compliance remain the responsibility of anyone performing physical experiments.
