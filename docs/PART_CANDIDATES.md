# PoWE MK1 / Candidate component notes

**Examples researched November 6, 2026. Not ordered, not electrically validated, not a prescribed wiring kit.** Check manufacturer documentation, current availability, actual data sheets and product ratings before choosing parts.

## Light emitter and DC supply

- An enclosed **commercial 5 V USB-powered diffuse LED lamp**, ideally with a fixed on/off control and easily documented input path. For initial design bounds assume a maximum 5 V/0.4 A operating limit and independent protection selected through hardware review. Many USB desk lights exceed that or cannot be opened to insert test meters safely; do not modify sealed mains-powered units to instrument them.
- Use an independently rated, current-limited low-voltage supply and manual disconnect. A physical cutoff and fault protection cannot depend on PoWE's browser or USB serial commands.

## Optical energy receiver

- **Example candidate:** Voltaic P123 small solar panel, sold through Adafruit as a "5V 0.6W Mini Solar Panel - ETFE." The product page describes a roughly **6.1 V maximum-power-point voltage and 120 mA peak current** under its rated illumination; it is **not** an LED indoor measurement. The physical panel also has solder pads and needs proper reviewed mechanical/electrical termination. Reference: https://www.adafruit.com/product/5856
- The mini solar panel is suitable as a candidate PV transducer, not a guarantee that a desk lamp can supply its advertised 0.6 W. Ambient light, spectral mismatch, distance, PV loading and angle may reduce usable output by orders of magnitude.

## DC current monitoring

- **Example candidate for early exploration:** Adafruit INA228 breakout. Its manufacturer guide describes a 20-bit ADC, I2C, 0.015 ohm shunt and approximately 2.5 µA current LSB in its low-current setting. Reference: https://learn.adafruit.com/adafruit-ina228-i2c-power-monitor
- That resolution figure is a *digital scaling specification*, not guaranteed measurement accuracy, noise floor or calibration. It does **not** satisfy MK1's provisional <=1 µA resolution design target with its stock shunt arrangement. It may be a useful coarse secondary monitor for stronger PV currents, but not an independently calibrated low-light reference by itself.
- Independent externally calibrated meters or suitable higher-sensitivity current instrumentation should be selected after measuring real signal range and burden voltage. Source and PV circuits may require electrical isolation; do not assume connecting two sensor boards to the same I2C ground preserves independent measurement.

## Serial interface and data

- USB telemetry must be **receive-only in physical design**, not just browser JavaScript. Web Serial provides bidirectional capabilities and permits modem-line changes in its API; port opening and cable connection require independent verification as incapable of energizing attached electronics.
- MDN API documentation: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API and https://developer.mozilla.org/en-US/docs/Web/API/SerialPort/setSignals
- PoWE Rung 4 expects line-delimited JSON at 115200 baud if using its optional browser serial reader, or a local NDJSON file with identical schema. A dedicated read-only gateway and correct meter synchronization have **not** been implemented or verified.

## Purchase decision checkpoints

Do not automatically purchase a microcontroller, optical panel, lamp, current sensor or power supply based solely on a tutorial or the above candidate examples. Before purchase, document the exact source voltage/current rating, enclosure, PV anticipated current signal, calibrated meter range/resolution, independent shutdown method, anticipated electrical isolation, timebase and local compliance review.

The software exports generic BOM categories and unperformed acceptance tests. No parts are represented as purchased, stocked, reviewed or assembled.
