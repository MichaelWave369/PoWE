# Rung 10: LightBridge two-device optical field analysis

Status: test instrumentation, not a completed independently observed optical experiment. LightBridge and PoWE can produce and analyze local unsigned field logs, but no device, camera, photovoltaic receiver or power source was operated by this software mission.

## Field test workflow

1. Open LightBridge React on a sender device and a physically separate camera-capable receiver over HTTPS. On the sender select a small file, enable encryption if suitable, and start animated PLB1 QR frames. Suggested starting point: 1-2 frames per second.
2. On the receiving device open LightBridge Receive, enter optional device/lighting/distance notes, and start the camera. Do not paste frames manually during a camera-only trial.
3. If the transfer reconstructs, select Verify & recover file. Export actual recovered bytes, sender and receiver PLB1 receipts, sender field log and receiver field log. Export field logs from unsuccessful sessions too.
4. Use PoWE section 12 to import both logs, optionally with both receipts. Preserve originals and explicitly record environmental conditions, screen brightness, actual distance, browser versions and interventions outside the logs.
5. Repeat a meaningful series of successful, incomplete and interrupted trials across controlled distances and lighting conditions. This software has not done those real-world trials.

## Data processing and limits

The input is the local LightBridge field-log-v1 JSON schema. The analyzer checks session IDs, chronological event order, role, counters, observed sequence duplication and final hash metadata. Sender events mean QR data was generated for display; they do not establish photons reached the receiving camera.

Receiver observations are tagged camera or manual. The tool reports both independently, flags mixed sessions and compares unique camera sequence IDs against unique generated sender sequence IDs. The resulting percentage is a descriptive sequence-overlap metric, NOT measured optical frame loss. A camera may skip QR updates, scan at different speed, repeat identical frames, or reconstruct with parity despite missing systematic frames.

Each local event time is monotonic relative to that device's own session start; clocks are not synchronized. Local sender and receiver time windows may be described separately, but one-way transfer latency cannot be calculated by subtracting the two clock values. File and receipt claims are unsigned and editable, and cannot independently prove device identity or physical camera reception.

When receiver logs claim a verified original SHA-256 and matching byte length, PoWE compares those claims to the optional sender/receiver receipts. It does not receive original file bytes in this analysis, so it does not independently rehash them. Rung 9's independent binary byte-interoperability tests are a distinct software result.

No electrical or optical power consumption is captured, and there is no hardware-output control. Rung 10 is about recording real PLB1 optical DATA experiments if a user performs them, not about wireless energy delivery.

## Cross-repository contract test

Continuous integration checks out a pinned LightBridge commit containing the field recorder. A software test generates actual field-log JSON using LightBridge's source code and validates it through PoWE's field analyzer. This guards format compatibility but deliberately invokes no real camera and makes no physical-test claim.

## Future acceptance

Before publishing a reliable two-device performance claim, repeat controlled physical experiments with independent observation and preserve both failures and successes, original files, verified hashes, measured device/browser configurations, known camera permissions, and time/energy instrumentation appropriate to the claimed metric. Authenticated sender identification and explicit user consent remain separate requirements.
