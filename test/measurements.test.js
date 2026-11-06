import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CSV_BYTES, parseMeasurementCsv, summarizeMeasurements, SIMULATED_DEMO_CSV } from "../src/measurements.js";
const HEADER = "record_id,timestamp_utc,kind,channel,apparatus_id,instrument_id,calibration_date,source_input_w,eirp_w,receiver_dc_w,separation_m,uncertainty_w,safety_state,notes";
const NOW = Date.parse("2026-11-06T23:00:00Z");
const fields = {
  record_id:"m-1",timestamp_utc:"2026-10-10T12:00:00Z",kind:"measured",channel:"optical",
  apparatus_id:"bench-1",instrument_id:"meter-42",calibration_date:"2026-09-20",
  source_input_w:"1",eirp_w:"",receiver_dc_w:"0.001",separation_m:"1.5",
  uncertainty_w:"0.00005",safety_state:"ok",notes:"fixture"
};
const line = (patch = {}) => HEADER.split(",").map(k => patch[k] ?? fields[k]).join(",");
const csv = (...lines) => HEADER + "\n" + lines.join("\n");
const parse = content => parseMeasurementCsv(content, { nowMs: NOW });

test("demo remains explicitly simulated and separated into three channels", () => {
  const data = parse(SIMULATED_DEMO_CSV);
  assert.equal(data.length, 3);
  assert.ok(data.every(x => x.kind === "simulated" && x.instrument_id === null));
  assert.equal(summarizeMeasurements(data).length, 3);
});
test("import measured record only as a file-reported claim", () => {
  const [item] = parse(csv(line()));
  assert.equal(item.kind, "measured");
  assert.equal(item.receiver_dc_w, 0.001);
  assert.equal(item.uncertainty_w, 0.00005);
});
test("quoted CSV commas and escaped quotes are parsed", () => {
  const notes = '"Power 1, ""bench"""';
  assert.equal(parse(csv(line({notes})))[0].notes, 'Power 1, "bench"');
});
test("unsafe numeric values and impossible timestamps rejected", () => {
  for (const patch of [
    {receiver_dc_w:"=1+1"}, {receiver_dc_w:"NaN"}, {receiver_dc_w:"-1"},
    {separation_m:"1e999"}, {uncertainty_w:"0"}, {timestamp_utc:"2026-02-30T12:00:00Z"},
    {timestamp_utc:"2027-01-01T12:00:00Z"}, {calibration_date:"2026-02-30"},
    {calibration_date:"2026-11-01"}
  ]) assert.throws(() => parse(csv(line(patch))));
});
test("instrument provenance and positive uncertainty required for measured", () => {
  for (const patch of [
    {apparatus_id:""}, {instrument_id:""}, {calibration_date:""},
    {uncertainty_w:""}, {safety_state:"not_applicable"}
  ]) assert.throws(() => parse(csv(line(patch))));
});
test("simulated data cannot claim real instrument or hardware safety", () => {
  assert.throws(() => parse(csv(line({kind:"simulated", safety_state:"not_applicable",
    instrument_id:"meter-42",calibration_date:"",uncertainty_w:""}))));
});
test("duplicates, headers, limits and malformed CSV fail closed", () => {
  assert.throws(() => parse(csv(line(),line())), /Duplicate record_id/);
  assert.throws(() => parse(csv(line()).replace("record_id,timestamp_utc", "record_id,record_id")), /Duplicate CSV header/);
  assert.throws(() => parse("garbage"), /header/);
  assert.throws(() => parse("x".repeat(MAX_CSV_BYTES + 1)), /512/);
  assert.throws(() => parse(csv(line({notes:'"unfinished'}))), /Unclosed/);
  assert.throws(() => parse(csv(line({notes:'"end"junk'}))), /Unexpected text/);
});
test("RF EIRP is not an optical source input", () => {
  assert.throws(() => parse(csv(line({eirp_w:"0.1"}))), /eirp_w/);
});
test("reported readings and simulations never aggregate together", () => {
  const data = parse(csv(
    line(),
    line({record_id:"m-2",receiver_dc_w:"0.002",safety_state:"fault"}),
    line({record_id:"s-3",kind:"simulated",apparatus_id:"",instrument_id:"",
      calibration_date:"",uncertainty_w:"",safety_state:"not_applicable",receiver_dc_w:"0.025"})
  ));
  const summary = summarizeMeasurements(data);
  assert.equal(summary.length, 2);
  assert.equal(summary[0].kind, "measured");
  assert.equal(summary[0].faultCount, 1);
  assert.equal(summary[0].meanReceiverW, 0.0015);
  assert.equal(summary[1].kind, "simulated");
});
