# PoWE / Measurement CSV v1

PoWE imports UTF-8 CSV locally; **no data is uploaded**. Limit 512 KiB and 1000 records. Header columns may appear in any order; names must match the supported vocabulary exactly. Numeric input uses decimal point notation and optional scientific exponent; never spreadsheet formulas, NaN or Infinity.

**Measured means self-reported by the file, not authenticated evidence.** The importer cannot independently verify hardware, readings, calibration, safety or source provenance.

| Column | Type and requirement |
| --- | --- |
| record_id | Required unique identifier, letters/digits/dot/underscore/hyphen, max 80 |
| timestamp_utc | Required valid UTC ISO 8601 timestamp ending in Z; no future dates |
| kind | Required: measured or simulated |
| channel | Required: rf, optical, near-field |
| apparatus_id | Identifier required for measured |
| instrument_id | Identifier required for measured; blank for simulated |
| calibration_date | YYYY-MM-DD required for measured, on or before record timestamp; blank for simulated |
| source_input_w | Optional source electrical input in watts; blank if unknown |
| eirp_w | Optional **RF-only** radiated EIRP in watts, NOT source electrical draw |
| receiver_dc_w | Required nonnegative received DC watts |
| separation_m | Required nonnegative meters (even for near-field) |
| uncertainty_w | Required strictly positive watts for measured; optional for simulated |
| safety_state | Required: measured may use ok, unknown, fault; simulated must use not_applicable |
| notes | Optional text, max 160 characters |

All numeric values are capped at 100000 for importer sanity only, **not safety approval**. Empty optional numeric fields remain null, not zero. Dates and calibration descriptions are just file metadata; verify raw logs and meter certificates separately.

## Example

The in-page "Load synthetic demo" action and the example at [examples/simulated-demo.csv](../examples/simulated-demo.csv) contain exactly three simulated rows. They are demonstration data **not** real equipment results.

## How to read the dashboard

- A group is one provenance kind plus one physical channel. The summary is the arithmetic mean of reported receiver DC watt values, not total energy.
- The dashboard never averages reported measurements and simulations together.
- Safety-fault readings remain visible and are counted, **not discarded to make performance look better**.
- No whole-system efficiency is computed because individual watt readings, unmatched conditions and unknown transmitter draw are insufficient. No claim is made that any reading is genuine.
- To compare energy per task, capture time-integrated source-wall and receiver energy with aligned instrumentation under controlled matching conditions.
- No imported value is interpreted as authority to operate equipment or as proof of regulatory compliance.
