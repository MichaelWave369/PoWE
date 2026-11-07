# PoWE Rung 8 / LightBridge coordination contract

**Research software, not an optical hardware demonstration.** No real energy was transmitted or harvested and no PLB1 QR frame was sent or received by this PoWE integration.

## Repo reality check

The [LightBridge repository](https://github.com/MichaelWave369/LightBridge) currently includes a separate React and Vite PLB1 optical sender/receiver console in site/. Its protocol module, site/src/protocol.js, supports PLB1 framing, CRC32 frame checks, SHA-256 protected-payload and original-file integrity verification, optional passphrase-based AES-GCM, local receipts and a 2 MiB original-file cap. It does **not** authenticate a sender or authorize actions; camera testing and interop with archived candidates are still not certified.

The LightBridge *root README* retains recovery language about the historical archives. The newer React implementation is independent of those archives, not proof that archival source packages were released. No LightBridge source was copied into PoWE by this PR. The interface in PoWE is a **receipt/experiment boundary**, not yet a shared optical-transport runtime.

The LightBridge companion documents also explicitly require identity/signature verification, replay freshness and user consent separately from optical transport integrity.

## Part A: same-trace synthetic scheduling

The Rung 8 mock generator creates a deterministic per-second timeline of:
- **electrical DC input to an abstract LED source** (fixed in advance; not AC wall-plug energy);
- **receiver harvested electrical DC energy** into a bounded storage bucket;
- **link availability**, a shared synthetic Boolean per second, **not** captured PLB1/QR frames;
- work-unit arrivals and deadlines.

Both policies receive exactly the same source input and receiver harvest trace, task arrivals/deadlines and per-second synthetic link outcomes. The two policies follow different scheduling rules:

1. **Fixed:** attempts only in predefined periodic slots. If receiver storage is inadequate at the slot, work is deferred.
2. **Adaptive:** may attempt when storage is adequate, pending work exists and its minimum time since the prior attempt has elapsed. It does not change source power, receiver harvest, or artificial link quality.

One attempted work unit costs receiver-side stored electrical energy, including failed attempts. Idle energy is consumed every simulated second. Storage overflow is counted, brownouts are tallied, and the ledger enforces:

    initial_stored_J + harvested_receiver_J
       = final_stored_J + idle_consumed_J + attempt_consumed_J + overflow_J

Source electrical DC input joules are tracked **separately**. They cannot be replaced by receiver harvested energy, and a better task-delivery ratio alone is not proof of better light-to-electric conversion.

Report metrics include:
- successful work units / total;
- attempts, failures, energy deferrals, brownout seconds;
- source DC joules, receiver harvested/consumed/spilled joules, ledger discrepancy;
- successful tasks per **source DC joule**, with N/A if source input is zero;
- relative adaptive-vs-fixed difference where the fixed denominator is nonzero.

**Interpretation warning:** A particular synthetic result is not evidence that adaptive scheduling works better in real experiments. Fixed and adaptive differ in when attempts are allowed, and simulated task deadlines/periods/energy profiles strongly affect outcomes. The generator neither models QR frame serialization, transfer time, ARQ/fountain codes, optical conversion, heat, real camera throughput, nor cryptographic work cost. No real energy-saving or physical transfer claim is authorized.

## Part B: LightBridge receipt-field compatibility

LightBridge's local sender and receiver provide JSON receipts in its React implementation. PoWE independently checks **only the self-reported fields**:

| Field / behavior | PoWE check |
| --- | --- |
| receiptType | Matches sender/receiver PLB1 receipt types |
| protocol | Both claim PLB1 |
| sessionId | Same nonempty bounded transfer session |
| originalSha256 | Claimed 64-character SHA-256 hashes match |
| originalSize | Claimed bytes match and do not exceed 2 MiB |
| encryptionEnabled | Claimed encryption flags agree |
| integrityStatus | Receiver claims PLB1 protected/original integrity pass |

This does not recalculate the hash of transferred original bytes because PoWE is **not given those bytes**. A fabricated pair of receipts can trivially satisfy the field checks. Even real LightBridge CRC/SHA success proves byte consistency, **not** who sent the file or what operations are permitted. Likewise, optional passphrase encryption is not signed identity.

The sample receipt pair in examples/rung8-synthetic/ is deliberately fabricated and exists only as a parser fixture.

## Security boundary for future integration

**DO NOT** treat a matching receipt, QR invitation, device ID or claimed SHA-256 as an authenticated session. Rung 1's invitation builder/validator provides only schema/TTL checks.

A future actual authenticated adapter would need:
1. Defined canonical signed invitation and review of cryptographic primitives; authenticated peer identification separate from a self-declared public key.
2. Recipient challenge, replay protection with bounded nonce/ID memory, expiration enforcement and explicit user-scoped consent.
3. Permission scoping to allowed data exchange only, with documented denial/revocation. Absolutely no remote power enable from optical payloads.
4. Real LightBridge console transfer tests with separately reviewed sender/receiver software, complete files, matching receipt and independently retained originals.
5. Cross-implementation PLB1 compatibility tests and physical two-device camera tests under recorded distance/lighting conditions.
6. Physical LED/PV measurement on separately approved hardware, with Rungs 6-7 control experiments and independent safety interlocks.
7. Paired controlled scheduling tests using identical apparatus, independently logged task completions, source electrical input and receiver harvested energy, not only simulations.

No pairing authentication is implemented by this PR, and no server/account trust claims are made. Avoid putting private keys, tokens, unrestricted capability grants, or personal data into plaintext QR exchanges.

## How to reproduce

Run the static PoWE page on localhost and scroll to section 10. The simulator uses seed 369 by default. You may export the full synthetic trace/results for auditing. Import JSON sender and receiver receipts from an independently performed LightBridge transfer, or load the fabricated receipt example. A matching pair is **field consistency only**.

For the offline test gate:

    npm test
    npm run check
    npm run bridge:dry-run

GitHub Actions should run the same dry run on PRs. All hardware and actual transfer claims remain false in exported report metadata.
