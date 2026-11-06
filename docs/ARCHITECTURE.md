# PoWE architecture: Rung 1

## Separation of concerns

1. **Physical channel model** (src/model.js): calculates *illustrative available receiver DC* per second; no physical I/O.
2. **Storage and duty-cycle model** (src/model.js): conserves receiver-side energy, runs local scheduling, counts telemetry, missed pulses and brownouts.
3. **Local browser control surface** (index.html, src/app.js): distance controls, cards, simulated ledger, CSV; no server.
4. **Invitation protocol** (src/invitation.js): short-lived JSON suitable for QR transport, schema/TTL checks, explicitly unauthenticated.
5. **Future transport adapters:** LightBridge screen-camera links, optical-power experiments, RFC-compliant Wi-Fi as a data path, approved inductive power systems, and NBG PocketMesh resource tracking. None is integrated here.

## Units and boundaries

All internal energy is joules, power watts, time seconds, distance meters except inductive separation (centimeters), frequency hertz.

RF: P_receiver_DC = EIRP × [c / (4πfd)]² × receive_gain × rectifier_efficiency. Default 0.1 W EIRP, 2.4 GHz, 3 m, 0 dBi receive gain and 35% rectification. Far-field free-space assumption only; no multipath, walls, ambient noise, active radio processing load, or transmitter power draw modeled.

Optical: P_receiver_DC = electrical_input × wall_plug_efficiency × min(1, PV_area / cone_area) × PV_efficiency. Default electrical input 1 W; 20% light conversion; 30-degree half angle; PV area 0.01 m²; PV efficiency 25%. Uniform spot is a simplification; beam shape, orientation, spectrum, eye safety, ambient lighting and data modulation unmodeled.

Near field: P_receiver_DC = input × reference_efficiency / (1+(distance_cm/scale_cm)^6). Default 0.5 W, 55%, 4 cm scale. **Phenomenological toy proxy only.** Not a circuit-level model of a resonant coil or an achievable device specification.

Per time step: previous_stored + harvested = next_stored + idle_consumed + pulse_consumed + spilled. Capacitor storage is modeled as an *energy bucket*; no charging curves, voltage, ESR, capacity degradation or losses. Overflow is counted before load processing during each step.

## Pairing and trust

A v1 invitation is a short-lived, unencrypted JSON structure:
- protocol: powe-invitation
- version: 1
- deviceId: alphanumeric identifier
- capabilities: subset of rf / optical / near-field
- nonce: locally random unique value
- issuedAtMs, expiresAtMs: UTC epoch milliseconds

**Checks do not imply authentication.** Never use the invitation alone to provision devices or authorize energy transmission. For a real adapter, add signatures, authenticated key exchange, nonce replay storage, user-visible consent, capability negotiation, scoped permissions and rate limits. Video scanning is optional and processed in-browser; it must be stopped when done.

## Next modular interface

A future hardware adapter should report timestamp, channel, instrument ID, calibrated power/voltage/current observations with units and uncertainties, measurement conditions, safety state, source attestations and data provenance. It should never silently populate simulated metrics as measured values.
