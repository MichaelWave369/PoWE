// PoWE Rung 4: READ-ONLY BenchLink telemetry protocol v1.
// "reported" is self-described provenance, never authenticated instrument evidence.
import { COLUMNS, parseTrials } from "./benchkit.js";

export const PROTOCOL = "powe.benchlink.v1";
export const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024;
export const MAX_SAMPLES = 10000;
const IDENT = /^[A-Za-z0-9._-]{1,64}$/;
const UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const finite = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
function fail(reason) { throw new Error(reason); }
function validId(value, field) {
  if (typeof value !== "string" || !IDENT.test(value)) fail("Invalid " + field);
  return value;
}
function validUtc(value, nowMs) {
  if (typeof value !== "string") fail("timestamp_utc must be a string");
  const m = UTC.exec(value);
  if (!m) fail("timestamp_utc must be ISO UTC ending Z");
  const n = Date.parse(value), d = new Date(n);
  if (!Number.isFinite(n) ||
      d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth()+1 !== Number(m[2]) ||
      d.getUTCDate() !== Number(m[3]) || d.getUTCHours() !== Number(m[4]) ||
      d.getUTCMinutes() !== Number(m[5]) || d.getUTCSeconds() !== Number(m[6])) {
    fail("Invalid timestamp_utc calendar instant");
  }
  if (n > nowMs + 60000) fail("Timestamp is in the future");
  return n;
}
function validDay(value) {
  if (typeof value !== "string") fail("calibration_date must be a string");
  const m = DAY.exec(value);
  if (!m) fail("calibration_date must be YYYY-MM-DD");
  const n = Date.parse(value + "T00:00:00Z"), d = new Date(n);
  if (!Number.isFinite(n) || d.getUTCFullYear() !== Number(m[1]) ||
      d.getUTCMonth()+1 !== Number(m[2]) || d.getUTCDate() !== Number(m[3])) {
    fail("Invalid calibration_date");
  }
  return n;
}
export function createCollector() {
  return {
    header: null, samples: [], ended: false, endedAt: null,
    sourceEnergyJ: 0, receiverEnergyJ: 0, integratedSeconds: 0,
    gapCount: 0, faultCount: 0, unknownCount: 0,
    lineCount: 0, hasError: false, alerts: []
  };
}
function checkHeader(h, nowMs) {
  validId(h.session_id, "session_id");
  validId(h.apparatus_id, "apparatus_id");
  if (h.kind !== "reported" && h.kind !== "synthetic") fail("Header kind must be reported or synthetic");
  const t = validUtc(h.timestamp_utc, nowMs);
  if (h.kind === "reported") {
    validId(h.source_meter_id, "source_meter_id");
    validId(h.receiver_meter_id, "receiver_meter_id");
    if (h.source_meter_id === h.receiver_meter_id) fail("Independent source and receiver meter IDs required");
    if (validDay(h.calibration_date) > t) fail("Calibration date follows session start");
  } else if (h.source_meter_id || h.receiver_meter_id || h.calibration_date) {
    fail("Synthetic header cannot claim real meters or calibration");
  }
  return Object.freeze({
    session_id: h.session_id, kind: h.kind, apparatus_id: h.apparatus_id,
    source_meter_id: h.kind === "reported" ? h.source_meter_id : "",
    receiver_meter_id: h.kind === "reported" ? h.receiver_meter_id : "",
    calibration_date: h.kind === "reported" ? h.calibration_date : "",
    timestamp_utc: h.timestamp_utc
  });
}
export function ingestRecord(state, record, { nowMs = Date.now() } = {}) {
  if (!state || !Array.isArray(state.samples)) fail("Invalid collector");
  if (state.ended || state.hasError) fail("Collector is closed");
  if (!record || typeof record !== "object" || Array.isArray(record)) fail("Frame must be an object");
  if (record.protocol !== PROTOCOL) fail("Unsupported BenchLink protocol");
  if (!Number.isFinite(nowMs)) fail("Invalid local clock");
  state.lineCount++;
  if (state.lineCount > MAX_SAMPLES + 2) { state.hasError = true; fail("Too many frames"); }
  if (record.type === "header") {
    if (state.header || state.samples.length) fail("Duplicate or late header");
    state.header = checkHeader(record, nowMs);
    return state;
  }
  if (!state.header) fail("First frame must be a header");
  if (record.session_id !== state.header.session_id) fail("Session ID mismatch");
  if (record.type === "end") {
    if (!Number.isSafeInteger(record.samples) || record.samples !== state.samples.length) {
      fail("End frame sample count mismatch");
    }
    state.ended = true;
    state.endedAt = state.samples.length ? state.samples[state.samples.length-1].elapsed_ms : null;
    return state;
  }
  if (record.type !== "sample") fail("Unsupported frame type");
  if (state.samples.length >= MAX_SAMPLES) { state.hasError = true; fail("Sample limit exceeded"); }
  const sequence = record.sequence, elapsed = record.elapsed_ms;
  if (!Number.isSafeInteger(sequence) || sequence !== state.samples.length) fail("Missing/duplicate sample sequence");
  if (!Number.isSafeInteger(elapsed) || elapsed < 0 || elapsed > 3600000) fail("elapsed_ms out of bounds");
  for (const key of ["source_v", "source_a", "receiver_v", "receiver_a"]) {
    const max = key.endsWith("_v") ? 30 : 5;
    if (!finite(record[key], 0, max)) fail("Invalid " + key + " (BenchLink 0-30 V / 0-5 A bounds)");
  }
  const kind = state.header.kind;
  if (kind === "reported" && !["ok","unknown","fault"].includes(record.safety_state)) {
    fail("Reported samples require ok/unknown/fault");
  }
  if (kind === "synthetic" && record.safety_state !== "not_applicable") {
    fail("Synthetic samples cannot claim hardware safety");
  }
  const prev = state.samples.at(-1);
  if (prev && elapsed <= prev.elapsed_ms) fail("Elapsed time must strictly increase");
  const sample = Object.freeze({
    sequence, elapsed_ms: elapsed, source_v: record.source_v, source_a: record.source_a,
    receiver_v: record.receiver_v, receiver_a: record.receiver_a,
    source_w: record.source_v * record.source_a,
    receiver_w: record.receiver_v * record.receiver_a,
    safety_state: record.safety_state
  });
  if (prev) {
    const intervalMs = elapsed - prev.elapsed_ms;
    if (intervalMs > 2000) {
      state.gapCount++;
      state.alerts.push("Missing measurement interval " + prev.elapsed_ms + "-" + elapsed + " ms (no energy extrapolated)");
    } else if ((kind === "synthetic") ||
      (prev.safety_state === "ok" && sample.safety_state === "ok")) {
      const dt = intervalMs / 1000;
      state.sourceEnergyJ += (prev.source_w + sample.source_w) * dt / 2;
      state.receiverEnergyJ += (prev.receiver_w + sample.receiver_w) * dt / 2;
      state.integratedSeconds += dt;
    }
  }
  if (sample.safety_state === "fault") {
    state.faultCount++;
    state.alerts.push("Hardware-reported fault at " + elapsed + " ms: stop the experiment using its physical switch");
  } else if (sample.safety_state === "unknown") {
    state.unknownCount++;
    state.alerts.push("Unknown reported safety state at " + elapsed + " ms");
  }
  state.samples.push(sample);
  return state;
}
export function ingestLine(state, line, options) {
  if (typeof line !== "string" || new TextEncoder().encode(line).length > 4096) fail("Line too long or invalid");
  const trimmed = line.trim();
  if (!trimmed) return state;
  let record;
  try { record = JSON.parse(trimmed); } catch { fail("Invalid JSON frame"); }
  return ingestRecord(state, record, options);
}
export function parseTranscript(text, options) {
  if (typeof text !== "string" || !text ||
      new TextEncoder().encode(text).length > MAX_TRANSCRIPT_BYTES) fail("NDJSON empty or exceeds 2 MiB");
  const state = createCollector();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const line of lines) ingestLine(state, line, options);
  if (!state.header) fail("No valid header found");
  return state;
}
export function summarizeCollector(state) {
  if (!state || !Array.isArray(state.samples)) fail("Invalid collector");
  const durationS = state.samples.length > 1
    ? (state.samples.at(-1).elapsed_ms - state.samples[0].elapsed_ms) / 1000 : 0;
  const invalid = [];
  if (!state.header) invalid.push("Missing session header");
  if (!state.ended) invalid.push("Missing end frame");
  if (state.samples.length < 2) invalid.push("Fewer than two samples");
  if (durationS < 5) invalid.push("Duration below five seconds");
  if (state.gapCount) invalid.push(state.gapCount + " time gap(s)");
  if (state.faultCount) invalid.push(state.faultCount + " reported fault(s)");
  if (state.unknownCount) invalid.push(state.unknownCount + " unknown safety state(s)");
  if (state.hasError) invalid.push("Collector integrity error");
  if (state.sourceEnergyJ <= 0) invalid.push("No integrated source energy");
  if (state.header?.kind === "reported" && state.samples.some(s => s.safety_state !== "ok")) {
    invalid.push("Not all reported samples marked ok");
  }
  return Object.freeze({
    status: invalid.length ? "INCOMPLETE_OR_UNSAFE" : "COMPLETE_REPORTED",
    exportEligible: invalid.length === 0, issues: invalid,
    sessionId: state.header?.session_id || null,
    kind: state.header?.kind || null, sampleCount: state.samples.length,
    elapsedSeconds: durationS, integratedSeconds: state.integratedSeconds,
    sourceEnergyJ: state.sourceEnergyJ, receiverEnergyJ: state.receiverEnergyJ,
    gapCount: state.gapCount, faultCount: state.faultCount, unknownCount: state.unknownCount,
    sourceMeterId: state.header?.source_meter_id || null,
    receiverMeterId: state.header?.receiver_meter_id || null,
    timestampUtc: state.header?.timestamp_utc || null,
    provenance: "self-reported, unauthenticated NDJSON; no independent hardware verification"
  });
}
function validScalar(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
export function buildBenchTrial(state, data) {
  const summary = summarizeCollector(state);
  if (!summary.exportEligible) fail("Not eligible for BenchKit export: " + summary.issues.join("; "));
  const header = state.header;
  const {
    trial_id, block_id, condition, sequence, geometry_id, task_set_id,
    separation_m, requested_tasks, completed_tasks,
    source_uncertainty_j, receiver_uncertainty_j
  } = data || {};
  for (const [name,value] of Object.entries({trial_id,block_id,geometry_id,task_set_id})) validId(value,name);
  if (!["fixed","adaptive"].includes(condition)) fail("Invalid schedule condition");
  if (!Number.isSafeInteger(sequence) || ![1,2].includes(sequence)) fail("Invalid sequence");
  if (!validScalar(separation_m,0.05,5)) fail("Invalid separation_m");
  if (!Number.isSafeInteger(requested_tasks) || requested_tasks<1 || requested_tasks>100000) fail("Invalid requested_tasks");
  if (!Number.isSafeInteger(completed_tasks) || completed_tasks<0 || completed_tasks>requested_tasks) fail("Invalid completed_tasks");
  if (header.kind === "reported" &&
      (!validScalar(source_uncertainty_j,1e-12,1e8) || !validScalar(receiver_uncertainty_j,1e-12,1e8))) {
    fail("Reported trial requires independently estimated positive source and receiver energy uncertainty (joules)");
  }
  const row = {
    trial_id,block_id,timestamp_utc:header.timestamp_utc,sequence,condition,
    kind:header.kind === "reported" ? "measured":"simulated",channel:"optical",
    apparatus_id:header.apparatus_id,geometry_id,task_set_id,
    source_meter_id:header.source_meter_id,receiver_meter_id:header.receiver_meter_id,
    calibration_date:header.calibration_date,separation_m,duration_s:summary.elapsedSeconds,
    source_energy_j:summary.sourceEnergyJ,receiver_energy_j:summary.receiverEnergyJ,
    source_uncertainty_j:header.kind === "reported"?source_uncertainty_j:"",
    receiver_uncertainty_j:header.kind === "reported"?receiver_uncertainty_j:"",
    requested_tasks,completed_tasks,
    safety_state:header.kind === "reported"?"ok":"not_applicable",
    notes:header.kind === "reported"?"BenchLink self-reported unverified":"BenchLink synthetic fixture"
  };
  // Validate against exactly the same schema used by Rung 3 before export.
  parseTrials(trialsToCsv([row]),{nowMs:Date.now()});
  return Object.freeze(row);
}
function escapeCsv(value) {
  const s=String(value??"");
  return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}
export function trialsToCsv(rows) {
  if (!Array.isArray(rows)) fail("Expected array of trials");
  return [COLUMNS.join(","),...rows.map(row=>COLUMNS.map(c=>escapeCsv(row[c])).join(","))].join("\r\n")+"\r\n";
}
export function observationReceipt(state) {
  const summary = summarizeCollector(state);
  return {
    schema:"powe-benchlink-receipt-v1",
    recordedBy:"PoWE browser / unverified file or read-only serial source",
    header:state.header,
    summary,
    alerts:state.alerts.slice(),
    samples:state.samples.map(x=>({...x}))
  };
}
export const SYNTHETIC_NDJSON = [
  {protocol:PROTOCOL,type:"header",session_id:"synthetic-demo-01",kind:"synthetic",
   apparatus_id:"demo-led",timestamp_utc:"2026-10-10T12:00:00Z"},
  ...Array.from({length:8},(_,i)=>({protocol:PROTOCOL,type:"sample",session_id:"synthetic-demo-01",
   sequence:i,elapsed_ms:i*1000,source_v:5,source_a:0.02,
   receiver_v:1.2,receiver_a:0.001,safety_state:"not_applicable"})),
  {protocol:PROTOCOL,type:"end",session_id:"synthetic-demo-01",samples:8}
].map(x=>JSON.stringify(x)).join("\n")+"\n";
