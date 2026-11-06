import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTROL_SCHEMA,SYNTHETIC_INPUTS,analyzeOpticalControls,
  opticalControlsReceipt,sha256Text
} from "../src/optical-controls.js";

const now=Date.parse("2026-11-06T23:45:00Z");
const opts={nowMs:now};
const fixture=()=>JSON.parse(JSON.stringify(SYNTHETIC_INPUTS));
function edit(source,role,mutate){
  const data=source[role].trim().split("\n").map(x=>JSON.parse(x));
  mutate(data);
  source[role]=data.map(x=>JSON.stringify(x)).join("\n")+"\n";
  return source;
}
const approx=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,a+" != "+b);

test("three-way synthetic control reports electrical PV delta, not optical efficiency",()=>{
  const r=analyzeOpticalControls(SYNTHETIC_INPUTS,opts);
  assert.equal(r.schema,CONTROL_SCHEMA);
  assert.equal(r.provenance,"SYNTHETIC_DEMONSTRATION");
  approx(r.sourceEnergyJ.on,.7);
  approx(r.receiverEnergyJ.before,.0084);
  approx(r.receiverEnergyJ.on,.0168);
  approx(r.receiverEnergyJ.after,.0084);
  approx(r.expectedAmbientContributionJ,.0084);
  approx(r.signedLightAssociatedReceiverDeltaJ,.0084);
  assert.equal(r.baselineDriftFlag,false);
  assert.equal(r.signalStatus,"POSITIVE_DESCRIPTIVE_DELTA");
  assert.equal(r.hardwareValidated,false);
  assert.equal(r.efficiencyProven,false);
  assert.equal(r.opticalPowerMeasured,false);
});
test("an LED OFF control with no source power is valid independently of Rung 4 export eligibility",()=>{
  assert.equal(analyzeOpticalControls(SYNTHETIC_INPUTS,opts).sourceEnergyJ.before,0);
});
test("missing end, gaps, and reported faults cannot be accepted",()=>{
  const a=fixture();
  a.afterTranscript=a.afterTranscript.trim().split("\n").slice(0,-1).join("\n");
  assert.throws(()=>analyzeOpticalControls(a,opts),/end frame/);
  const b=edit(fixture(),"onTranscript",items=>{
    for(let i=4;i<=8;i++)items[i].elapsed_ms+=3000;
  });
  assert.throws(()=>analyzeOpticalControls(b,opts),/missing data interval/);
  const c=edit(fixture(),"beforeTranscript",items=>{items[3].safety_state="fault";});
  assert.throws(()=>analyzeOpticalControls(c,opts),/Synthetic samples/);
});
test("different hardware, provenance or repeated session IDs fail pairing",()=>{
  const a=edit(fixture(),"afterTranscript",items=>{items[0].apparatus_id="other";});
  assert.throws(()=>analyzeOpticalControls(a,opts),/mismatched provenance/);
  const b=edit(fixture(),"afterTranscript",items=>{
    for(const item of items)item.session_id="demo-off-before";
  });
  assert.throws(()=>analyzeOpticalControls(b,opts),/distinct session/);
  const c=edit(fixture(),"onTranscript",items=>{items[0].kind="reported";});
  assert.throws(()=>analyzeOpticalControls(c,opts),/source_meter_id/);
});
test("incorrect ordering, stale control and nonzero LED OFF source prevent analysis",()=>{
  const a=edit(fixture(),"afterTranscript",items=>{items[0].timestamp_utc="2026-10-10T11:59:00Z";});
  assert.throws(()=>analyzeOpticalControls(a,opts),/sequentially/);
  const b=edit(fixture(),"afterTranscript",items=>{items[0].timestamp_utc="2026-10-10T12:25:00Z";});
  assert.throws(()=>analyzeOpticalControls(b,opts),/gaps exceed/);
  const c=edit(fixture(),"beforeTranscript",items=>{
    items.filter(x=>x.type==="sample").forEach(x=>x.source_a=.001);
  });
  assert.throws(()=>analyzeOpticalControls(c,opts),/LED OFF source power/);
});
test("subtle or absent receiver improvement is described without positive conclusion",()=>{
  const a=edit(fixture(),"onTranscript",items=>{
    items.filter(x=>x.type==="sample").forEach(x=>x.receiver_a=.001);
  });
  assert.equal(analyzeOpticalControls(a,opts).signalStatus,"NO_POSITIVE_DELTA");
  const b=edit(fixture(),"onTranscript",items=>{
    items.filter(x=>x.type==="sample").forEach(x=>x.receiver_a=.00101);
  });
  assert.equal(analyzeOpticalControls(b,opts).signalStatus,"DELTA_BELOW_3X_REPORTED_UNCERTAINTY");
});
test("baseline drift is flagged even when LED ON exceeds both controls",()=>{
  const a=edit(fixture(),"afterTranscript",items=>{
    items.filter(x=>x.type==="sample").forEach(x=>x.receiver_a=.0016);
  });
  const r=analyzeOpticalControls(a,opts);
  assert.equal(r.baselineDriftFlag,true);
  assert.equal(r.signalStatus,"BASELINE_DRIFT_REVIEW");
});
test("missing uncertainty for reported streams is never guessed",()=>{
  const a=fixture();
  const fields={source_meter_id:"meterA",receiver_meter_id:"meterB",calibration_date:"2026-10-01"};
  for(const role of ["beforeTranscript","onTranscript","afterTranscript"]){
    edit(a,role,items=>{
      items[0].kind="reported";
      Object.assign(items[0],fields);
      items.filter(x=>x.type==="sample").forEach(x=>x.safety_state="ok");
    });
  }
  delete a.uncertainties;
  assert.throws(()=>analyzeOpticalControls(a,opts),/positive energy uncertainty/);
  a.uncertainties=SYNTHETIC_INPUTS.uncertainties;
  const r=analyzeOpticalControls(a,opts);
  assert.equal(r.provenance,"SELF_REPORTED_UNVERIFIED");
  assert.equal(r.calibrationVerified,false);
});
test("invalid geometry, times, uncertainty values are rejected",()=>{
  assert.throws(()=>analyzeOpticalControls({...fixture(),geometryId:"../../"},opts));
  assert.throws(()=>analyzeOpticalControls({...fixture(),separationM:0},opts));
  assert.throws(()=>analyzeOpticalControls(SYNTHETIC_INPUTS,{maxGapS:-1,nowMs:now}));
  assert.throws(()=>analyzeOpticalControls({...fixture(),uncertainties:{...SYNTHETIC_INPUTS.uncertainties,onReceiverJ:0}},opts));
});
test("receipt hashes original synthetic bytes but never claims independent verification",async()=>{
  const receipt=await opticalControlsReceipt(SYNTHETIC_INPUTS,opts);
  assert.equal(receipt.verifiedByIndependentInstrument,false);
  assert.equal(receipt.hardwareValidated,false);
  assert.equal(receipt.inputsSha256.ledOn,await sha256Text(SYNTHETIC_INPUTS.onTranscript));
  assert.match(receipt.inputsSha256.ledOn,/^[a-f0-9]{64}$/);
  assert.notEqual(receipt.inputsSha256.ledOn,await sha256Text(SYNTHETIC_INPUTS.onTranscript+" "));
});
