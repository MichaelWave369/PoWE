# PoWE MK1 / Physical optical bench design (Rung 6)

**Design status: NOT BUILT.** Nothing in Rung 6, its manifest, its browser dashboard or previous commissioning checks is evidence that an actual LED/PV apparatus has been assembled, electrically reviewed or operated.

## Question

Can an optical energy receiver support useful tasks more efficiently when its transmissions are energy-aware versus fixed-window scheduled, holding physical conditions and requested workload comparable?

This document specifies a conservative **first bench measurement apparatus**. It does not yet specify a production optical power transport system or make a physical-performance claim. Rung 3 provides the randomized experiment plan, Rung 4 provides self-reported read-only telemetry, and Rung 5 checks synthetic protocol behavior.

## Proposed physical architecture (functional, NOT wiring instructions)

    [commercial regulated low-voltage DC supply]
                        |
          [independent fuse + physical disconnect]
                        |
             [DC SOURCE POWER METER]
                        |
             [commercial diffuse LED]
                        |
                  visible light
                        |
           [mounted commercial PV panel]
                        |
           [RECEIVER DC POWER METER]
                        |
                 [passive load]

    SOURCE METER -> (separate read-only acquisition) --+
                                                      +--> isolated USB
    RECEIVER METER -> (separate read-only acquisition) -+    telemetry gateway
                                                               |
                                                      [BenchLink / browser]
                                                               |
                                                      [Rung 3 BenchKit]

The diagram depicts energy and observation boundaries, NOT pin-by-pin electrical wiring. An experienced reviewer must choose actual wiring, fusing, meter measurement topology and isolation. **Never assume it is safe to tie together two circuits' measurement grounds.** PV open-circuit voltage, overcurrent protection and instrument common-mode limits must be verified before a connection. The USB gateway must be physically incapable of turning on the power source, including via serial modem lines and unexpected resets.

## Defined measurement boundary

MK1 observes **electrical USB/DC input immediately upstream of the LED** and **receiver DC output into a defined PV load**. It does **not** observe optical incident power, emitted optical radiant flux, AC wall-plug electricity, or RF energy. If AC-side energy is later measured separately, the measurement boundary and protocol must be versioned.

- The proposed maximum supply is 5 V DC and current setting no more than 0.5 A. Default operating limit is 0.4 A, giving a theoretical DC supply envelope of 2 W. This is an upper-budget planning value, **not delivered optical or electrical receiver power**.
- An independent overcurrent protective element and physical disconnect are required in addition to source current limiting; values are design constraints, not an approved fuse specification.
- Use a commercial enclosed diffuse visible LED. **No laser, focused high-irradiance source, improvised mains apparatus, or open energized assembly.**
- The PV candidate may have a sunlight-rated open-circuit voltage near 6 V and maximum rated power near 0.6 W. Those ratings refer to manufacturer test illumination and do **not** establish an indoor LED output. Expect far smaller signals until measured.
- First geometry range is 0.1–1 m. Record LED/PV orientation, ambient illuminance, enclosed fixture conditions, loaded PV voltage, and dark-current baseline at each geometry.
- Both sides should be measured with independent calibrated instruments. **Do not assume a generic ADC, an INA228 breakout, or a 20-bit specification implies sufficient resolution at dim PV currents.** For the tentative 10 µA lower-signal selection target, the manifest requests <=1 µA instrument current resolution, but actual noise, offset and accuracy must be validated with calibrated references.
- The manifest target is one sample per 500 ms with <=50 ms relative timestamp skew. These are design targets; actual gateway jitter and independent meter timing must be measured. The existing BenchLink energy integrator skips intervals >2 seconds and does not resolve every transient.

## Hardware selection gates, not purchase endorsements

1. **LED source:** documented DC supply and visible light spectrum, enclosed diffuse output, confirmed electrical load at 5 V/0.4 A planned maximum. Prefer commercial modules and certified power supplies; verify actual label ratings before purchase.
2. **PV panel:** documented manufacturer rating conditions, open-circuit voltage and maximum current. Include a passive, specified load, and avoid using peak sunlight ratings as a prediction of indoor operation.
3. **Metrology:** two independent suitable DC power measurement channels, at least one sensitive enough for low-current PV output under lamp illumination. Require calibrated low-current references, input-burden voltage analysis, sample timing error, and independently measured uncertainties before interpreting data.
4. **Gateway:** receive-only data transport. Physically verify that USB serial connection/open/close, DTR/RTS or firmware resets cannot control or switch electrical output. USB isolation may be necessary to prevent unsafe or corrupting ground paths.
5. **Mechanical fixture:** enclosed adjustable mount and repeatable markings for LED/PV separation and alignment with physical access to a cutoff.

## Sequence of planned validation, none performed

- **G0:** Build independent electrical safety review, meter range/metrology plan, and documented component identities before powering anything.
- **G1:** With independently approved components and procedures, verify physical power cutoff and no live output as serial connects/disconnects. Record signed inspection evidence outside the application.
- **G2:** Validate two meter channels against known low-voltage electrical references and check low-current offset, dynamic range, calibration and clock skew.
- **G3:** Dark run with the physical LED off, then illuminated static runs with the same load across planned distances. Record actual V, I and timestamped source/receiver electrical energy, independent ambient-light references and failed runs. Keep original logs.
- **G4:** Only after verified data acquisition, conduct Rung 3's preregistered fixed vs adaptive trials and independently measured task completion, equal workloads and matching fixtures.
- **G5:** External review of raw data and uncertainty. The PoWE browser itself is never an authority for approving a physical experiment.

See the generated **MK1 unperformed test plan** and **BOM categories** in the Rung 6 dashboard. A green *structural* validation means the entered planning limits meet the program's configured thresholds, not that the apparatus exists or that its energy transfer is safe.

## Integration with LightBridge

The screen-camera LightBridge QR transport is for information and pairing. Its camera is **not** the PV power receiver. An eventual joint optical information/power channel needs separate optical modulation, photodetection and PV-response experiments. Only after separate power and data hardware performance is verified should PoWE negotiate how they share a link. QR identity alone never authorizes energizing the hardware.

## Evidence and falsifiability

Claiming the adaptive schedule completes more tasks per joule requires directly integrated source input energy, measured receiver energy, signed/provenanced independent task logs, randomized matched trials, uncertainty propagation, transparent exclusions and negative controls. A passive LED-to-PV power measurement by itself does not demonstrate wireless Ethernet power transfer or data-plane benefit.

## Safety and regulations

All new physical work requires suitable professional review, local electrical/safety compliance, mechanical enclosures, protection against shorts, eye safety and independent hardware shutdown. Rung 6 contains no wiring-ready schematic, laser-control design, power switching or transmitter firmware. It is a specification and checklist for a future apparatus.
