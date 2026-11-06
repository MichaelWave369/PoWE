# PoWE Rung 7 / Optical control measurements

**Status: a local analysis tool and synthetic test fixtures. No physical LED/PV measurement has been performed by this development mission.**

## The question this rung can investigate

Under a fixed passive PV receiver load and controlled geometry, is the observed PV **electrical** output different when a separate visible LED is energized versus disconnected, after accounting for the ambient background signal?

This is not yet a wireless Ethernet transfer or a scheduling comparison. It is an early physical control that must come before claims about coherent energy delivery, resonant systems or network-level energy savings.

## Why three sessions rather than two

Run controls sequentially:

1. LED **OFF** with ambient light and receiver load unchanged. Capture a time-stamped source and receiver electrical baseline.
2. LED **ON** with the same geometry and load. Capture source electrical input into the LED and receiver DC power into the PV load.
3. LED **OFF** again without moving anything. Capture the background again so possible drift is visible.

This is an OFF/ON/OFF control, not an optical modulation experiment. Each control requires its own BenchLink NDJSON session, including a valid header, at least six regularly spaced samples, a complete end frame, at least five seconds of integrated observation and no gap or reported fault. All three must have matching claimed apparatus, meter identities, calibration date and provenance category, but **the labels and identities are not authenticated by PoWE**. Record actual device load, orientation, room lighting and geometry independently. A common user-entered geometry/load ID in the UI is not independent proof of physical matching.

## Data boundaries and mathematics

For each reported electrical V/I sample:

    P_LED_DC(t) = V_source(t) × I_source(t)
    P_PV_DC(t)  = V_receiver(t) × I_receiver(t)

Rung 4 BenchLink trapezoidally integrates these data when sample intervals are no longer than two seconds, yielding joules. The Rung 7 control module:

- Converts the receiver joules for each OFF run into its average PV electrical power (watts).
- Finds each session's chronological midpoint using its claimed UTC header time and elapsed-ms samples.
- Linearly interpolates the OFF background power to the LED-ON midpoint:

    baseline_W = (1 - alpha) × before_OFF_mean_W + alpha × after_OFF_mean_W

- Estimates the LED-ON interval's ambient contribution:

    predicted_ambient_J = baseline_W × ON_duration_seconds

- Reports the **signed** light-associated PV electrical difference:

    signed_delta_J = ON_PV_DC_energy_J - predicted_ambient_J

A negative result remains negative; it is **not clipped to zero**. No assumption is made that all apparent difference is genuine transfer from the LED. Room-light changes, thermal drift, PV load changes, electrical noise, spectrum, instrument offset and unverified source timing remain possible explanations.

**LED OFF gate:** each OFF source DC average must be at most 1% of the ON source DC average under the claimed measurement boundary. The proposed MK1 source meter measures *electrical DC into the LED*, not AC wall-plug or optical irradiance. This gate is a software plausibility check, not a true hardware status detector.

**Temporal gate:** the entire LED-OFF-before session must end before LED-ON starts, which must finish before the LED-OFF-after session starts. Each neighboring gap may be at most 180 seconds by default. All data quality and safety flags are checked before the calculation.

**Drift flag:** a relative difference of more than 20% of the two average OFF background powers flags the result for review. If both OFF powers are below 1 nW, relative drift is reported as not quantifiable with this simple denominator; that is *not* proof of zero offset.

## Uncertainty fields

For self-reported physical instrument records, four independent positive energy uncertainty estimates in **joules** are required:

- LED-OFF-before receiver energy uncertainty
- LED-ON receiver energy uncertainty
- LED-OFF-after receiver energy uncertainty
- LED-ON source electrical energy uncertainty

A reproducible technical experiment needs these values derived from actual meter calibration, measurement precision, sampling cadence, burdens and other error sources, NOT arbitrary guesses.

Rung 7 propagates the independent receiver energy uncertainties as a simple quadrature approximation using the interpolated weights:

    u_delta_J = sqrt(
       u_ON_receiver_J^2
       + [(1-alpha) × T_ON/T_OFF_before × u_OFF_before_receiver_J]^2
       + [alpha × T_ON/T_OFF_after × u_OFF_after_receiver_J]^2
    )

This assumes independent errors and neglects correlated calibration errors, alignment variation and all other unmodeled systematic error. It is **not** a certified uncertainty budget or statistical significance test. A result above three times the entered uncertainty is categorized as a *positive descriptive delta* only, not proof of an optical link or causality.

## Data provenance, receipts and security

- Each imported file is processed **locally** in the browser, capped at 2 MiB per transcript. No upload is performed.
- Reported-vs-synthetic provenance cannot be mixed. A NDJSON stream can falsely claim to be from calibrated meters; the application cannot detect that.
- The receipt contains the derived calculation and SHA-256 of each exact imported text. Preserve the three original NDJSON files separately. Hashes prove integrity of **those bytes**, not truth or authorship.
- The bundled examples are entirely synthetic and clearly labeled. No scientific or physical energy-transfer result is implied.
- No browser control, QR invitation or serial connection can authorize powering equipment. A physical LED/PV test requires the independent safety and metrology gates documented in [HARDWARE_MK1.md](HARDWARE_MK1.md) and [COMMISSIONING.md](COMMISSIONING.md).

## Replication and baseline limitations

One OFF/ON/OFF trio is **not** enough to establish reproducible optical transfer performance. Repeat randomized control blocks across fixed and intentionally varied distances; take matched ambient reference readings with the LED not powered; verify meter identities and raw calibration, synchronize clocks, measure sensor thermal effects, and preserve both successes and failures.

An observed positive PV DC difference does not tell us:

- how much emitted optical power reached the PV surface;
- optical conversion efficiency or end-to-end wall-plug efficiency;
- whether modulation carries useful data;
- whether PoWE's adaptive scheduling improves tasks per joule over a fixed schedule;
- whether any physics beyond conventional photovoltaic transfer occurs.

Those are independent, falsifiable questions for later experimental rungs.

## Run the synthetic checks

Use the browser's section **09 / Optical Control Experiment**, click **Load synthetic controls**, then **Analyze three sessions**. The expected demonstration has an LED-ON source DC reading of 0.7 J over seven seconds and a modeled positive PV electrical delta of 0.0084 J. These are **fabricated example values** solely for unit testing.

Alternatively run:

    npm run check
    npm test
    npm run optical:dry-run

The dry run is explicitly synthetic, not connected to external devices.
