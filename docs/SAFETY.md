# Safety and operating boundaries

PoWE Rungs 1–4 are software-only and contain **no ability to transmit physical power**. BenchLink Rung 4 optionally reads local telemetry through Web Serial or an NDJSON file, but sends no electrical control commands. Opening a serial connection can toggle modem lines on some USB devices, so only use independently reviewed read-only gateways that cannot energize safety-critical outputs.

For any future physical research:
- Use low-voltage, commercially documented and compliant equipment. Do not construct high-power or unlicensed RF emitters.
- RF transmit power, frequency, duty cycle, antennas and exposure are subject to local regulations. An engineering model is not a compliance certification.
- Optical links must use appropriate eye-safe sources. Do not improvise tightly focused lasers or aim emitters at people, animals, vehicles or aircraft.
- Inductive systems need thermal monitoring, current limiting, foreign-object detection and fault shutdown, and should use approved charging modules.
- Protect batteries and capacitors against overvoltage, short circuits and heating.
- Maintain local physical kill-switches; never rely solely on a remote software instruction for electrical safety.
- Do not enable power delivery from QR data alone. User consent and independently verified authenticated identities are required.
- Label every dataset as measured or simulated, with apparatus, calibration information and uncertainty when measured.

No claim here substitutes for a qualified safety review or applicable equipment certifications.
