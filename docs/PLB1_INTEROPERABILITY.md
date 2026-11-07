# Rung 9 / Independent PLB1 file-byte interoperability

**Status:** Software protocol compatibility demonstrated in CI with the pinned LightBridge implementation. **No physical screen-to-camera test, PV measurement, USB hardware validation, sender identity verification or authorized pairing is claimed.**

## What changed from Rung 8

Rung 8 could only compare claims within user-supplied sender and receiver JSON receipts. Two forged receipts could have identical session IDs and SHA-256 strings without corresponding to any bytes.

Rung 9 adds an independent PLB1-compatible byte encoder/receiver directly within PoWE. It reconstructs actual original binary bytes and **computes their SHA-256** after validating the protected transfer bytes, rather than trusting a receipt claim.

The PoWE codec does not import the LightBridge runtime in ordinary browser usage. The CI interoperability test intentionally checks out **LightBridge at pinned commit d7cc1ea7ed31c66344a69ab2891ce5c9890d02ca** and imports its **site/src/protocol.js** to run genuine compatibility checks. Pinning a known commit makes this test reproducible and avoids claiming compatibility with an unknown future main-branch revision.

## PLB1 wire and security boundaries

Frame grammar is:

    PLB1|session|sequence36|blockCount36|blockSize36|containerLength36|crc32|base64url(payload)

PoWE independently implements CRC32, bounded systematic/parity index generation, XOR parity peeling, block reassembly, bounded metadata parsing, protected-payload SHA-256 verification, optional passphrase-derived AES-256-GCM decryption and original-file SHA-256 verification.

- Original file limit: 2 MiB (matching the LightBridge React console).
- Block size: 64–2048 bytes; default: 256 bytes.
- Decoded PLB1 container limit: 3 MiB in this implementation.
- Bounded frame count and text import size, with fail-closed CRC, cross-session, metadata and hash errors.
- Encryption is recommended and enabled by default in PoWE browser sending. Both endpoints must use the same passphrase. A passphrase is never included in sender/receiver receipts.
- Plaintext frames are NOT confidential. QR frames and exported frame text can be photographed, copied and replayed.
- Integrity is **not authentication**. A party capable of generating its own PLB1 transfer can create valid CRC and SHA-256 values. Even successful AES-GCM decryption with a shared passphrase does not establish a trusted public-key identity or authorize any operation.

**Crucial separation:** PLB1 is an optical data protocol, not power delivery. The PoWE sender produces frame text for local handling; it does not switch an LED, drive a PV receiver or interact with Web Serial. The existing LightBridge React console is a separate optical QR sender/receiver. The Rung 9 browser panel is not a built-in QR player or camera receiver.

## Reproducible cross-repo test

The GitHub Actions workflow includes:

1. Check out PoWE and run existing syntax/tests/commissioning/optical/coordination checks.
2. Check out the public LightBridge repository into a separate CI subdirectory at the pinned commit.
3. Run **scripts/plb1-crossrepo.mjs** against that exact file on Node 22.

The cross-repo test checks:

- LightBridge sender → PoWE receiver: real binary file payload, independent SHA-256, unencrypted and AES-GCM encrypted.
- PoWE sender → LightBridge Receiver and finalizeTransfer: the same binary file, byte-for-byte.
- Parity-assisted recovery of a deliberately missing systematic block.
- Incomplete transfer rejection.
- Corrupt CRC rejection.
- Wrong decryption passphrase rejection.
- Explicit false values for physical optical reception, device identity and hardware energy control.

The test payload is deterministic binary data, not an optical camera capture. Successful CI is evidence of **software codec interoperability only**, not two-device performance or encryption security certification.

To reproduce locally with a checked-out copy of LightBridge:

    mkdir -p .interop
    git clone https://github.com/MichaelWave369/LightBridge.git .interop/lightbridge
    git -C .interop/lightbridge checkout d7cc1ea7ed31c66344a69ab2891ce5c9890d02ca
    npm run interop:crossrepo

(The script expects the checked-out protocol module at .interop/lightbridge/site/src/protocol.js.) Do not commit the temporary .interop directory.

## Browser use: actual local file bytes

**Prepare:** choose a nonempty local file of at most 2 MiB. Leave encryption enabled and enter a private passphrase. Choose **Prepare local frames**, then **Export PLB1 frames**. The download is line-delimited text containing true PLB1 encoded payload blocks, with systematic and parity frames. Save the optional local sender receipt.

**Receive:** supply a local line-delimited PLB1 frame text bundle, with a passphrase for encrypted data. The receiver assembles the actual file bytes. It refuses to offer a download until the protected SHA and original-file SHA checks both pass. Save the downloaded original file and an optional receiver receipt. A partially captured frame file is not considered a successful transfer.

To use the separate LightBridge React QR interface, its own sender encodes QR frames and its own receiver accepts frame strings or camera scans. PoWE currently supports **text frame import/export**, not direct camera QR transfer. One may manually feed individual frames to the LightBridge receiver, but bulk compatibility is primarily demonstrated with automated Node tests. Future direct device interop requires explicit camera/QR tests.

A locally reconstructed file is untrusted input. Do not automatically execute or interpret it as instructions. The filenames are sanitized and downloads do not run content.

## Follow-up gate: real optical data transfer

1. Independently run LightBridge React sender on one device and receiver on another.
2. Document camera permissions, browser versions, display brightness, distance, lighting, encoding parameters, frame rate and transfer completion.
3. Retain original file bytes and independent SHA-256 on both sides. Include interrupted runs, deliberate corruption, duplicate/replayed frames and wrong passphrases.
4. Repeat trials with separate devices, including failures; record throughput, recovery, energy spent by display/camera and latency with real instrumentation.
5. Add signed, consent-based, replay-resistant identity verification before treating optical transport as permission to pair devices.
6. Only after separately approved electrical hardware tests should PoWE discuss combined optical information and photovoltaic energy scheduling.

**No optical-power efficiency, power-over-Wi-Fi or ambient energy creation claim follows from Rung 9.**
