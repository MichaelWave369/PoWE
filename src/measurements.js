// PoWE Rung 2: local provenance-aware CSV import. "Measured" = user-reported, not independently verified.
export const MAX_CSV_BYTES = 512 * 1024;
export const MAX_RECORDS = 1000;
export const CSV_COLUMNS = Object.freeze([
  "record_id","timestamp_utc","kind","channel","apparatus_id","instrument_id",
  "calibration_date","source_input_w","eirp_w","receiver_dc_w",
  "separation_m","uncertainty_w","safety_state","notes"
]);
const REQUIRED = ["record_id","timestamp_utc","kind","channel","receiver_dc_w","separation_m","safety_state"];
const CHANNELS = new Set(["rf","optical","near-field"]);
const IDENTIFIER = /^[a-zA-Z0-9._-]{1,80}$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const err = (row, reason) => { throw new Error("CSV row " + row + ": " + reason); };

function csvCells(raw) {
  if (typeof raw !== "string" || !raw ||
      new TextEncoder().encode(raw).length > MAX_CSV_BYTES) {
    throw new Error("CSV is empty or exceeds 512 KiB");
  }
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const rows = [];
  let current = [], cell = "", state = "start";
  function endCell() {
    current.push(cell);
    cell = "";
    state = "start";
    if (current.length > CSV_COLUMNS.length) throw new Error("Too many CSV columns");
  }
  function endRow() {
    endCell();
    if (!(current.length === 1 && current[0] === "")) rows.push(current);
    current = [];
    if (rows.length > MAX_RECORDS + 1) throw new Error("CSV exceeds 1000 records");
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === "quoted") {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else state = "afterQuote";
      } else cell += c;
    } else if (state === "afterQuote") {
      if (c === ",") endCell();
      else if (c === "\n" || c === "\r") {
        endRow();
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else if (c !== " " && c !== "\t") {
        throw new Error("Unexpected text after quoted cell");
      }
    } else if (c === ",") endCell();
    else if (c === "\n" || c === "\r") {
      endRow();
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else if (c === '"' && state === "start") state = "quoted";
    else if (c === '"') throw new Error("Unexpected quote in CSV cell");
    else { cell += c; state = "unquoted"; }
    if (cell.length > 512) throw new Error("CSV cell exceeds 512 characters");
  }
  if (state === "quoted") throw new Error("Unclosed CSV quoted cell");
  if (current.length || cell.length || state !== "start") endRow();
  return rows;
}

function validTimestamp(value, row) {
  const m = TIMESTAMP.exec(value);
  if (!m) err(row, "timestamp_utc must be UTC ISO format ending in Z");
  const ms = Date.parse(value);
  const d = new Date(ms);
  if (!Number.isFinite(ms) || d.getUTCFullYear() !== +m[1] ||
      d.getUTCMonth() + 1 !== +m[2] || d.getUTCDate() !== +m[3] ||
      d.getUTCHours() !== +m[4] || d.getUTCMinutes() !== +m[5] ||
      d.getUTCSeconds() !== +m[6]) err(row, "Invalid calendar timestamp");
  return ms;
}
function validDate(value, row) {
  const m = DATE.exec(value);
  if (!m) err(row, "calibration_date must be YYYY-MM-DD");
  const ms = Date.parse(value + "T00:00:00Z");
  const d = new Date(ms);
  if (!Number.isFinite(ms) || d.getUTCFullYear() !== +m[1] ||
      d.getUTCMonth() + 1 !== +m[2] || d.getUTCDate() !== +m[3]) {
    err(row, "Invalid calibration calendar date");
  }
  return ms;
}
function numeric(value, key, row, mandatory = false, strictlyPositive = false) {
  if (!value) {
    if (mandatory) err(row, key + " is required");
    return null;
  }
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
    err(row, key + " must be a non-negative decimal number");
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100000 || (strictlyPositive && n === 0)) {
    err(row, key + " outside permitted range");
  }
  return n;
}
export function parseMeasurementCsv(raw, { nowMs = Date.now() } = {}) {
  if (!Number.isFinite(nowMs)) throw new Error("Invalid current clock");
  const rows = csvCells(raw);
  if (rows.length < 2) throw new Error("CSV requires header and one record");
  const header = rows[0].map(x => x.trim());
  if (new Set(header).size !== header.length) throw new Error("Duplicate CSV header");
  if (header.some(h => !CSV_COLUMNS.includes(h))) throw new Error("Unknown CSV header");
  const missing = REQUIRED.filter(c => !header.includes(c));
  if (missing.length) throw new Error("Missing columns: " + missing.join(", "));
  const ids = new Set(), records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = i + 1;
    if (rows[i].length !== header.length) err(row, "Column count mismatch");
    const r = Object.fromEntries(CSV_COLUMNS.map(c => [c, ""]));
    header.forEach((key, index) => r[key] = rows[i][index].trim());
    if (!IDENTIFIER.test(r.record_id)) err(row, "Invalid record_id");
    if (ids.has(r.record_id)) err(row, "Duplicate record_id");
    ids.add(r.record_id);
    const time = validTimestamp(r.timestamp_utc, row);
    if (time > nowMs + 60000) err(row, "Timestamp in the future");
    if (r.kind !== "measured" && r.kind !== "simulated") err(row, "Invalid kind");
    if (!CHANNELS.has(r.channel)) err(row, "Invalid channel");
    if (!["ok","unknown","fault","not_applicable"].includes(r.safety_state)) err(row, "Invalid safety_state");
    if (r.apparatus_id && !IDENTIFIER.test(r.apparatus_id)) err(row, "Invalid apparatus_id");
    if (r.instrument_id && !IDENTIFIER.test(r.instrument_id)) err(row, "Invalid instrument_id");
    if (r.notes.length > 160) err(row, "Notes exceed 160 characters");
    const numbers = {
      source_input_w: numeric(r.source_input_w, "source_input_w", row),
      eirp_w: numeric(r.eirp_w, "eirp_w", row),
      receiver_dc_w: numeric(r.receiver_dc_w, "receiver_dc_w", row, true),
      separation_m: numeric(r.separation_m, "separation_m", row, true),
      uncertainty_w: numeric(r.uncertainty_w, "uncertainty_w", row, r.kind === "measured", true)
    };
    if (r.channel !== "rf" && numbers.eirp_w !== null) err(row, "eirp_w only applies to RF");
    if (r.kind === "measured") {
      if (!r.apparatus_id || !r.instrument_id || !r.calibration_date) {
        err(row, "Reported measurements require apparatus, instrument, and calibration date");
      }
      if (r.safety_state === "not_applicable") err(row, "Measured safety_state cannot be not_applicable");
      if (validDate(r.calibration_date, row) > time) err(row, "Calibration follows reading");
    } else if (r.instrument_id || r.calibration_date || r.safety_state !== "not_applicable") {
      err(row, "Simulated records cannot claim instrument calibration or hardware safety");
    }
    records.push(Object.freeze({
      ...r, ...numbers,
      apparatus_id: r.apparatus_id || null,
      instrument_id: r.instrument_id || null,
      calibration_date: r.calibration_date || null
    }));
  }
  return Object.freeze(records);
}
export function summarizeMeasurements(records) {
  if (!Array.isArray(records)) throw new TypeError("Expected array");
  const groups = [];
  for (const kind of ["measured","simulated"]) for (const channel of ["rf","optical","near-field"]) {
    const subset = records.filter(r => r.kind === kind && r.channel === channel);
    if (!subset.length) continue;
    const watts = subset.map(r => r.receiver_dc_w);
    groups.push({
      kind, channel, count: subset.length,
      meanReceiverW: watts.reduce((a,b) => a + b, 0) / watts.length,
      minReceiverW: Math.min(...watts), maxReceiverW: Math.max(...watts),
      faultCount: subset.filter(r => r.safety_state === "fault").length
    });
  }
  return groups;
}
export const SIMULATED_DEMO_CSV = [
  CSV_COLUMNS.join(","),
  "sim-rf-001,2026-10-10T12:00:00Z,simulated,rf,,,,,0.1,0.00000038,3,,not_applicable,Demo only",
  "sim-light-001,2026-10-10T12:00:00Z,simulated,optical,,,,1,,0.0002,1.5,,not_applicable,Demo only",
  "sim-near-001,2026-10-10T12:00:00Z,simulated,near-field,,,,0.5,,0.27,0.02,,not_applicable,Demo only"
].join("\n");
