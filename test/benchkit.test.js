import test from "node:test";
import assert from "node:assert/strict";
import { COLUMNS,makePlan,csvTemplate,parseTrials,analyzeTrials,DEMO_CSV,MAX_BYTES } from "../src/benchkit.js";
const NOW=Date.parse("2026-11-06T23:00:00Z");
const parse=t=>parseTrials(t,{nowMs:NOW});
const base={
 trial_id:"m1",block_id:"b1",timestamp_utc:"2026-10-10T12:00:00Z",
 sequence:1,condition:"fixed",kind:"measured",channel:"optical",
 apparatus_id:"bench",geometry_id:"geo",task_set_id:"tasks",
 source_meter_id:"meterA",receiver_meter_id:"meterB",calibration_date:"2026-10-01",
 separation_m:1,duration_s:30,source_energy_j:8,receiver_energy_j:0.02,
 source_uncertainty_j:0.1,receiver_uncertainty_j:0.001,requested_tasks:12,completed_tasks:7,
 safety_state:"ok",notes:"fixture"
};
const csv=rows=>COLUMNS.join(",")+"\n"+rows.map(r=>COLUMNS.map(k=>String(r[k]??"")).join(",")).join("\n");
const pair=()=>[base,{...base,trial_id:"m2",timestamp_utc:"2026-10-10T12:01:00Z",sequence:2,condition:"adaptive",completed_tasks:9}];
test("planner reproducible and makes balanced paired order",()=>{
 const a=makePlan({projectId:"test",seed:369,blocks:8});
 assert.deepEqual(a,makePlan({projectId:"test",seed:369,blocks:8}));
 assert.equal(a.trials.length,16);
 for(let i=0;i<16;i+=2)assert.deepEqual(
  new Set([a.trials[i].condition,a.trials[i+1].condition]),new Set(["fixed","adaptive"]));
 assert.match(csvTemplate(a),/source_energy_j/);
});
test("plan validates inputs",()=>{
 assert.throws(()=>makePlan({projectId:"../../"}));
 assert.throws(()=>makePlan({seed:0}));
 assert.throws(()=>makePlan({blocks:41}));
 assert.throws(()=>makePlan({durationS:3}));
});
test("synthetic sample does not pretend measured data",()=>{
 const rows=parse(DEMO_CSV);
 assert.equal(rows.length,4);
 assert.ok(rows.every(x=>x.kind==="simulated"));
 const result=analyzeTrials(rows);
 assert.equal(result.simulated.length,2);
 assert.equal(result.reportedMeasured.length,0);
 assert.equal(result.simulatedSummary.fixed.completed,13);
 assert.equal(result.simulatedSummary.adaptive.completed,17);
});
test("reported data remain unverified even when parsed",()=>{
 const result=analyzeTrials(parse(csv(pair())));
 assert.equal(result.reportedMeasured.length,1);
 assert.ok(result.reportedMeasuredSummary.changePct>0);
});
test("excludes mismatched and faulted pairs without altering source rows",()=>{
 const mismatched=pair();mismatched[1].geometry_id="changed";
 assert.equal(analyzeTrials(parse(csv(mismatched))).excluded.length,1);
 const faulted=pair();faulted[1].safety_state="fault";
 assert.match(analyzeTrials(parse(csv(faulted))).excluded[0].reason,/safety/);
 assert.equal(analyzeTrials(parse(csv([base]))).excluded.length,1);
});
test("rejects bogus measurements",()=>{
 for(const patch of [
  {source_energy_j:"=1+1"},{source_energy_j:0},{source_energy_j:"Infinity"},
  {receiver_uncertainty_j:0},{source_uncertainty_j:""},
  {requested_tasks:4,completed_tasks:5},{timestamp_utc:"2026-02-30T12:00:00Z"},
  {timestamp_utc:"2027-01-01T12:00:00Z"},{calibration_date:"2026-02-31"},
  {source_meter_id:""},{receiver_meter_id:""},{safety_state:"not_applicable"},{channel:"rf"}
 ])assert.throws(()=>parse(csv([{...base,...patch}])));
});
test("simulated rows may not assert calibrated hardware",()=>{
 const sim={...base,kind:"simulated",source_meter_id:"",receiver_meter_id:"",
  calibration_date:"",source_uncertainty_j:"",receiver_uncertainty_j:"",
  safety_state:"not_applicable"};
 assert.equal(parse(csv([sim])).length,1);
 assert.throws(()=>parse(csv([{...sim,source_meter_id:"meter"}])));
});
test("rejects duplicate IDs, invalid header, file limits and malformed quotes",()=>{
 assert.throws(()=>parse(csv([base,base])),/Duplicate trial_id/);
 assert.throws(()=>parse(csv([base]).replace("trial_id,block_id","trial_id,trial_id")),/Duplicate header/);
 assert.throws(()=>parse("x".repeat(MAX_BYTES+1)),/512/);
 assert.throws(()=>parse(csv([{...base,notes:'"unclosed'}])),/Unclosed/);
});
