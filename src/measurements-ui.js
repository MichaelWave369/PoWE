import { MAX_CSV_BYTES, parseMeasurementCsv, summarizeMeasurements, SIMULATED_DEMO_CSV } from "./measurements.js";

const $ = id => document.getElementById(id);
let records = [];
function powerLabel(w) {
  if (w >= 1) return w.toFixed(3) + " W";
  if (w >= 1e-3) return (w * 1e3).toFixed(3) + " mW";
  if (w >= 1e-6) return (w * 1e6).toFixed(3) + " µW";
  if (w >= 1e-9) return (w * 1e9).toFixed(3) + " nW";
  return w.toExponential(2) + " W";
}
function el(tag, text, cssClass) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = String(text);
  if (cssClass) result.className = cssClass;
  return result;
}
function setStatus(message, error = false) {
  $("measure-status").textContent = message;
  $("measure-status").classList.toggle("measure-error", error);
}
function render() {
  const nMeasured = records.filter(r => r.kind === "measured").length;
  $("measure-total").textContent = String(records.length);
  $("measure-reported").textContent = String(nMeasured);
  $("measure-simulated").textContent = String(records.length - nMeasured);

  const summaryRoot = $("measure-summary");
  const summaries = summarizeMeasurements(records);
  summaryRoot.replaceChildren();
  if (!summaries.length) {
    summaryRoot.append(el("p", "No records loaded yet. Try the clearly labeled synthetic demonstration.", "measure-placeholder"));
  } else for (const s of summaries) {
    const card = el("article", undefined, "measure-group");
    card.append(
      el("small", s.kind === "measured" ? "REPORTED MEASURED · NOT VERIFIED" : "SIMULATED"),
      el("h3", s.channel.toUpperCase() + " / " + s.count + " readings"),
      el("strong", powerLabel(s.meanReceiverW)),
      el("p", "Arithmetic mean receiver-side DC power")
    );
    if (s.faultCount) card.append(el("p", s.faultCount + " fault-flagged record(s) included; not proof of safe operation.", "measure-fault"));
    summaryRoot.append(card);
  }
  const filter = $("measure-filter").value;
  const shown = records.filter(r => filter === "all" || r.kind === filter);
  const tbody = $("measure-rows");
  tbody.replaceChildren();
  for (const r of shown.slice(0, 100)) {
    const tr = el("tr");
    const values = [
      r.record_id, r.kind === "measured" ? "Reported measured" : "Simulated",
      r.channel, powerLabel(r.receiver_dc_w), r.separation_m + " m",
      r.uncertainty_w === null ? "Unspecified" : "± " + powerLabel(r.uncertainty_w),
      r.safety_state
    ];
    for (const value of values) tr.append(el("td", value));
    tbody.append(tr);
  }
  $("measure-row-count").textContent = "Showing " + Math.min(shown.length, 100) +
    " of " + shown.length + " filtered readings. Input is held in this browser tab only.";
}
function load(raw, label) {
  try {
    records = parseMeasurementCsv(raw);
    setStatus(label + ": " + records.length +
      " records accepted. The 'measured' label is self-reported by the CSV; instrument evidence is NOT authenticated.");
  } catch (e) {
    records = [];
    setStatus("Import rejected: " + String(e.message || e) + ". Previous data cleared.", true);
  }
  render();
}
$("measure-file").addEventListener("change", async e => {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > MAX_CSV_BYTES) {
    records = [];
    render();
    setStatus("Import rejected: file exceeds 512 KiB. Previous data cleared.", true);
    return;
  }
  try { load(await f.text(), f.name); }
  catch (e) {
    records = [];
    render();
    setStatus("Could not read file: " + String(e.message || e), true);
  }
});
$("measure-demo").addEventListener("click", () => {
  $("measure-file").value = "";
  load(SIMULATED_DEMO_CSV, "Synthetic demonstration (not lab data)");
});
$("measure-clear").addEventListener("click", () => {
  $("measure-file").value = "";
  records = [];
  setStatus("Imported data cleared from this browser tab.");
  render();
});
$("measure-filter").addEventListener("change", render);
render();
