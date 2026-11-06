import { DEFAULT_CONTROLS, createNetwork, advanceNetwork, powerForChannel } from "./model.js";
import { buildInvitation, parseInvitation } from "./invitation.js";

const $ = id => document.getElementById(id);
const controls = { ...DEFAULT_CONTROLS };
let network = createNetwork();
let history = [];
let liveTimer = null;
let cameraStream = null;
let cameraActive = false;
let cameraFrameId = null;

function scaled(value, units) {
  const abs = Math.abs(value);
  if (abs >= 1) return value.toFixed(2) + " " + units;
  if (abs >= 1e-3) return (value * 1e3).toFixed(2) + " m" + units;
  if (abs >= 1e-6) return (value * 1e6).toFixed(2) + " µ" + units;
  return (value * 1e9).toFixed(2) + " n" + units;
}
const energy = j => scaled(j, "J");
const power = w => scaled(w, "W");

function make(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = String(content);
  return element;
}
function receiverView(node) {
  const card = make("article", "receiver");
  card.append(make("div", "channel", node.channel.toUpperCase() + " / MODEL"));
  card.append(make("h3", "", node.label));
  card.append(make("div", "power", power(powerForChannel(node.channel, controls))));
  card.append(make("div", "unit", "estimated available receiver DC"));
  const meter = make("div", "bar");
  const fill = make("span");
  fill.style.width = (Math.min(100, Math.max(0, 100 * node.energyJ / node.capacityJ))).toFixed(1) + "%";
  meter.append(fill);
  card.append(meter);
  const details = make("dl");
  const fields = [
    ["Stored energy", energy(node.energyJ)],
    ["Capacity", energy(node.capacityJ)],
    ["Successful pulses", node.pulses],
    ["Deferred pulses", node.deferred],
    ["Brownout", node.brownoutSeconds.toFixed(0) + " s"]
  ];
  for (const [label, value] of fields) {
    details.append(make("dt", "", label), make("dd", "", value));
  }
  card.append(details, make("p", "event", node.lastEvent));
  return card;
}
function render() {
  $("nodes").replaceChildren(...network.nodes.map(receiverView));
  const sum = key => network.nodes.reduce((total, n) => total + n[key], 0);
  $("elapsed").textContent = network.tSeconds + " s";
  $("harvested").textContent = energy(sum("harvestedJ"));
  $("consumed").textContent = energy(sum("consumedJ"));
  $("spilled").textContent = energy(sum("spilledJ"));
  $("pulses").textContent = sum("pulses") + " pulses";
  $("deferred").textContent = String(sum("deferred"));
}
function tick() {
  network = advanceNetwork(network, controls);
  for (const n of network.nodes) {
    history.push([network.tSeconds, n.id, n.channel, n.lastPowerW, n.energyJ,
      n.harvestedJ, n.consumedJ, n.spilledJ, n.pulses, n.deferred, n.brownoutSeconds].join(","));
  }
  render();
}
function stopLive() {
  if (liveTimer !== null) clearInterval(liveTimer);
  liveTimer = null;
  $("live").textContent = "START LIVE";
}
const sliderDefs = [
  ["rf-distance", "rfDistanceM", "m"],
  ["optical-distance", "opticalDistanceM", "m"],
  ["near-distance", "nearFieldDistanceCm", "cm"]
];
for (const [id, key, unit] of sliderDefs) {
  $(id).addEventListener("input", e => {
    controls[key] = Number(e.target.value);
    $(id + "-value").textContent = controls[key].toFixed(1) + " " + unit;
    render();
  });
}
$("run-60").addEventListener("click", () => {
  stopLive();
  for (let i = 0; i < 60; i++) tick();
});
$("live").addEventListener("click", () => {
  if (liveTimer !== null) return stopLive();
  liveTimer = setInterval(tick, 1000);
  $("live").textContent = "PAUSE LIVE";
});
$("reset").addEventListener("click", () => {
  stopLive();
  network = createNetwork();
  history = [];
  render();
});
$("csv").addEventListener("click", () => {
  const header = "# SIMULATED DATA ONLY: not measured transfer or transmitter efficiency\n" +
    "t_seconds,node_id,channel,received_power_w,stored_j,harvested_j,consumed_j,spilled_j,pulses,deferred,brownout_seconds\n";
  const blob = new Blob([header + history.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "powe-simulated-energy-ledger.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("generate").addEventListener("click", () => {
  try {
    if (!globalThis.crypto || typeof crypto.randomUUID !== "function") {
      throw new Error("Secure browser context required for random invitation nonce");
    }
    $("out-invite").value = buildInvitation({
      deviceId: "powe-lab", capabilities: ["rf", "optical", "near-field"],
      nonce: crypto.randomUUID()
    });
    $("pair-status").textContent = "Invitation generated locally. QR encoder and identity authentication are not included in Rung 1.";
  } catch (e) {
    $("pair-status").textContent = e.message;
  }
});
$("copy").addEventListener("click", async () => {
  if (!$("out-invite").value) return;
  try {
    await navigator.clipboard.writeText($("out-invite").value);
    $("pair-status").textContent = "Invitation payload copied. It does not authorize access.";
  } catch {
    $("pair-status").textContent = "Clipboard unavailable. Select and copy the payload manually.";
  }
});
function verify() {
  const result = parseInvitation($("in-invite").value);
  if (result.ok) {
    $("pair-status").textContent = "STRUCTURE VALID: " + result.invitation.deviceId +
      " / " + result.invitation.capabilities.join(", ") +
      ". Identity and consent NOT verified. Do not authorize devices from this alone.";
  } else {
    $("pair-status").textContent = "REJECTED: " + result.reason;
  }
}
$("verify").addEventListener("click", verify);

function stopCamera() {
  cameraActive = false;
  if (cameraFrameId !== null) cancelAnimationFrame(cameraFrameId);
  cameraFrameId = null;
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  $("camera").srcObject = null;
  $("camera").hidden = true;
}
$("stop-scan").addEventListener("click", () => {
  stopCamera();
  $("pair-status").textContent = "Camera stopped.";
});
$("scan").addEventListener("click", async () => {
  stopCamera();
  if (!("BarcodeDetector" in globalThis) || !navigator.mediaDevices?.getUserMedia) {
    $("pair-status").textContent = "This browser lacks the QR camera API. Paste the payload instead.";
    return;
  }
  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    const video = $("camera");
    video.srcObject = cameraStream;
    video.hidden = false;
    await video.play();
    cameraActive = true;
    $("pair-status").textContent = "Scanning locally. Nothing is uploaded.";
    const scanFrame = async () => {
      if (!cameraActive) return;
      try {
        const codes = await detector.detect(video);
        const found = codes.find(code => typeof code.rawValue === "string" && code.rawValue.length <= 2048);
        if (found) {
          $("in-invite").value = found.rawValue;
          stopCamera();
          verify();
          return;
        }
      } catch (e) {
        stopCamera();
        $("pair-status").textContent = "QR scan stopped: " + String(e.message || e);
        return;
      }
      if (cameraActive) cameraFrameId = requestAnimationFrame(scanFrame);
    };
    cameraFrameId = requestAnimationFrame(scanFrame);
  } catch (e) {
    stopCamera();
    $("pair-status").textContent = "Camera unavailable or permission denied: " + String(e.message || e);
  }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) stopCamera(); });
window.addEventListener("pagehide", stopCamera);
render();
