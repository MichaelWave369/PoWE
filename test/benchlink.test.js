import test from "node:test";
import assert from "node:assert/strict";
import {
 PROTOCOL,createCollector,ingestRecord,ingestLine,parseTranscript,summarizeCollector,
 observationReceipt,buildBenchTrial,trialsToCsv,SYNTHETIC_NDJSON,MAX_TRANSCRIPT_BYTES
} from "../src/benchlink.js";
import {parseTrials} from "../src/benchkit.js";
const now=Date.parse("2026-11-06T23:00:00Z");
const opts={nowMs:now};
const header=(kind="reported")=>({
 protocol:PROTOCOL,type:"header",session_id:"run1",kind,
 apparatus_id:"optical-rig",source_meter_id:kind==="reported"?"meter-src":undefined,
 receiver_meter_id:kind==="reported"?"meter-dc":undefined,
 calibration_date:kind==="reported"?"2026-10-01":undefined,
 timestamp_utc:"2026-10-10T12:00:00Z"
});
const sample=(sequence,extra={})=>({
 protocol:PROTOCOL,type:"sample",session_id:"run1",
 sequence,elapsed_ms:sequence*1000,source_v:5,source_a:0.1,
 receiver_v:2,receiver_a:0.02,safety_state:"ok",...extra
});
const finish=count=>({protocol:PROTOCOL,type:"end",session_id:"run1",samples:count});
const good=()=>{const s=createCollector();ingestRecord(s,header(),opts);
 for(let i=0;i<7;i++)ingestRecord(s,sample(i),opts);
 ingestRecord(s,finish(7),opts);return s;};
test("trapezoid integrates independent reported source and receiver electrical energy",()=>{
 const s=good(),summary=summarizeCollector(s);
 assert.equal(summary.exportEligible,true);
 assert.equal(summary.elapsedSeconds,6);
 assert.ok(Math.abs(summary.sourceEnergyJ-3)<1e-10);
 assert.ok(Math.abs(summary.receiverEnergyJ-0.24)<1e-10);
 assert.equal(summary.sampleCount,7);
 assert.equal(summary.integratedSeconds,6);
});
test("synthetic demonstration is explicitly unauthenticated and produces valid trial CSV",()=>{
 const s=parseTranscript(SYNTHETIC_NDJSON,opts);
 assert.equal(s.header.kind,"synthetic");
 assert.equal(summarizeCollector(s).exportEligible,true);
 const row=buildBenchTrial(s,{
  trial_id:"demo1",block_id:"demo-b1",sequence:1,condition:"fixed",
  geometry_id:"geom",task_set_id:"tasks",separation_m:1,
  requested_tasks:10,completed_tasks:7
 });
 assert.equal(row.kind,"simulated");
 assert.equal(row.source_meter_id,"");
 const imported=parseTrials(trialsToCsv([row]),opts);
 assert.equal(imported.length,1);
 assert.equal(imported[0].kind,"simulated");
});
test("reported trial requires independent explicit uncertainty and round-trips BenchKit",()=>{
 const s=good();
 assert.throws(()=>buildBenchTrial(s,{
  trial_id:"m1",block_id:"b1",sequence:1,condition:"fixed",
  geometry_id:"geom",task_set_id:"tasks",separation_m:1,
  requested_tasks:10,completed_tasks:7
 }),/uncertainty/);
 const args={trial_id:"m1",block_id:"b1",sequence:1,condition:"fixed",
  geometry_id:"geom",task_set_id:"tasks",separation_m:1,
  requested_tasks:10,completed_tasks:7,source_uncertainty_j:0.03,receiver_uncertainty_j:0.005};
 const trial=buildBenchTrial(s,args);
 assert.equal(trial.kind,"measured");
 assert.equal(parseTrials(trialsToCsv([trial]),opts).length,1);
});
test("gaps are never back-filled and block trial export",()=>{
 const s=createCollector();ingestRecord(s,header(),opts);
 ingestRecord(s,sample(0),opts);
 ingestRecord(s,sample(1,{elapsed_ms:6000}),opts);
 ingestRecord(s,finish(2),opts);
 assert.equal(s.sourceEnergyJ,0);
 assert.equal(s.gapCount,1);
 assert.equal(summarizeCollector(s).exportEligible,false);
});
test("reported unknown or fault state interrupts integration and blocks export",()=>{
 for(const flag of ["unknown","fault"]){
  const s=createCollector();ingestRecord(s,header(),opts);
  ingestRecord(s,sample(0),opts);
  ingestRecord(s,sample(1,{safety_state:flag}),opts);
  ingestRecord(s,sample(2),opts);
  ingestRecord(s,finish(3),opts);
  assert.equal(s.sourceEnergyJ,0);
  assert.equal(summarizeCollector(s).exportEligible,false);
  assert.equal(s.alerts.length,1);
 }
});
test("wrong session, sequence, timestamp, units, and end counts are rejected",()=>{
 for(const value of [
  sample(0,{session_id:"elsewhere"}),sample(1),sample(0,{elapsed_ms:-1}),
  sample(0,{source_a:"0.1"}),sample(0,{receiver_v:999}),
  sample(0,{source_v:NaN}),finish(2)
 ]){
  const s=createCollector();ingestRecord(s,header(),opts);
  assert.throws(()=>ingestRecord(s,value,opts));
 }
});
test("header cannot claim bogus calibration or simulated meter identity",()=>{
 for(const h of [
  header("synthetic"),{...header(),source_meter_id:"meter-dc"},
  {...header(),calibration_date:"2026-02-30"},
  {...header(),timestamp_utc:"2026-02-30T12:00:00Z"},
  {...header(),timestamp_utc:"2027-01-10T12:00:00Z"}
 ]){
  if(h.kind==="synthetic") h.source_meter_id="meter"; // illegal synthetic provenance
  const s=createCollector();
  assert.throws(()=>ingestRecord(s,h,opts));
 }
});
test("malformed/oversized transcript frames rejected, no data promoted into measurements",()=>{
 assert.throws(()=>parseTranscript("x".repeat(MAX_TRANSCRIPT_BYTES+1),opts),/2 MiB/);
 assert.throws(()=>ingestLine(createCollector(),"{",opts),/JSON/);
 assert.throws(()=>ingestLine(createCollector(),"x".repeat(4097),opts),/Line/);
 const partial=parseTranscript(JSON.stringify(header())+"\n"+JSON.stringify(sample(0)),opts);
 assert.equal(summarizeCollector(partial).exportEligible,false);
 const receipt=observationReceipt(partial);
 assert.match(receipt.summary.provenance,/unauthenticated/);
 assert.equal(receipt.summary.status,"INCOMPLETE_OR_UNSAFE");
});
