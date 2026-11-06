// Rung 5 / offline PoWE BenchLink commissioning harness.
// These are SYNTHETIC protocol fixtures, not measured experimental evidence.
import { PROTOCOL, parseTranscript, summarizeCollector, SYNTHETIC_NDJSON } from "./benchlink.js";

export const FIXTURE_CLOCK_UTC = "2026-11-06T23:00:00Z";
export const FIXTURE_VERSION = "powe-commissioning-v1";
export const CHECKLIST_ITEMS = Object.freeze([
  {id:"read-only-gateway",label:"USB telemetry gateway is physically receive-only, separately reviewed, and cannot energize outputs."},
  {id:"serial-lines",label:"Opening/closing the serial port cannot energize a device through DTR/RTS or reset behavior."},
  {id:"low-voltage",label:"Diffused low-voltage commercial LED and PV receiver are securely enclosed; no lasers or exposed mains."},
  {id:"hardware-cutoff",label:"A working physical disconnect, fuses, current limits, and temperature protection are independently verified."},
  {id:"meter-calibration",label:"Source and receiver electrical measurements use two suitable, independently calibrated instruments."},
  {id:"common-timebase",label:"Source and receiver readings have documented acquisition timing and synchronization error."},
  {id:"geometry-control",label:"Optical alignment, separation, illumination and ambient conditions are documented and repeatable."},
  {id:"task-logging",label:"Task completion and queue/deadline behavior are independently logged for both schedule arms."},
  {id:"uncertainty",label:"Power and time uncertainties, dark/ambient-light contribution, and integration method are documented."},
  {id:"human-review",label:"A qualified human has reviewed wiring, operating limits, local rules, and the planned test."}
]);
const HEADER_TIME = "2026-10-10T12:00:00Z";
const header=(kind="synthetic")=>({
  protocol:PROTOCOL,type:"header",session_id:"commissioning-fixture-01",
  kind,apparatus_id:"fixture-optical",timestamp_utc:HEADER_TIME,
  ...(kind==="reported"?{
    source_meter_id:"source-claimed",receiver_meter_id:"receiver-claimed",
    calibration_date:"2026-10-01"
  }:{})
});
const sample=(i,kind="synthetic")=>({
  protocol:PROTOCOL,type:"sample",session_id:"commissioning-fixture-01",
  sequence:i,elapsed_ms:i*1000,source_v:5,source_a:0.02,
  receiver_v:1.2,receiver_a:0.001,
  safety_state:kind==="reported"?"ok":"not_applicable"
});
const end=(n=8)=>({
  protocol:PROTOCOL,type:"end",session_id:"commissioning-fixture-01",samples:n
});
function lines(items){return items.map(item=>JSON.stringify(item)).join("\n")+"\n";}
function frames(kind="synthetic",n=8){
  return [header(kind),...Array.from({length:n},(_,i)=>sample(i,kind)),end(n)];
}
function altered(kind,modification){
  const records=frames(kind);
  modification(records);
  return lines(records);
}
export function getFixtures(){
  // Some "reported" fixtures impersonate a meter on purpose to demonstrate
  // that schema validation does NOT authenticate the acquisition source.
  return [
    {id:"synthetic-good",name:"Nominal synthetic",expected:"eligible",downloadable:true,
      reason:"Valid 8-sample, 7-second synthetic telemetry",ndjson:SYNTHETIC_NDJSON,
      expectSourceJ:0.7,expectReceiverJ:0.0084},
    {id:"claimed-measured-good",name:"Self-claimed instrument feed",expected:"eligible",downloadable:false,
      reason:"Valid-looking reported stream demonstrates lack of authentication",
      ndjson:lines(frames("reported")),expectSourceJ:0.7,expectReceiverJ:0.0084},
    {id:"missing-end",name:"Missing end marker",expected:"ineligible",downloadable:true,
      reason:"A partial session must not be exported",ndjson:lines(frames().slice(0,-1))},
    {id:"short-run",name:"Too-short observation",expected:"ineligible",downloadable:true,
      reason:"Less than five seconds of samples",ndjson:lines(frames("synthetic",4))},
    {id:"timing-gap",name:"Missing time interval",expected:"ineligible",downloadable:true,
      reason:"Missing >2s interval is excluded rather than extrapolated",
      ndjson:altered("synthetic",v=>{for(let i=3;i<9;i++)v[i].elapsed_ms+=3000;})},
    {id:"no-source-energy",name:"Zero source power",expected:"ineligible",downloadable:true,
      reason:"No source joules available to normalize useful work",
      ndjson:altered("synthetic",v=>v.filter(x=>x.type==="sample").forEach(s=>{s.source_a=0;}))},
    {id:"reported-fault",name:"Reported physical fault",expected:"ineligible",downloadable:false,
      reason:"Reported faults disqualify the entire session",
      ndjson:altered("reported",v=>{v[4].safety_state="fault";})},
    {id:"reported-unknown",name:"Unconfirmed reported safety",expected:"ineligible",downloadable:false,
      reason:"Unknown safety state disqualifies reported sessions",
      ndjson:altered("reported",v=>{v[5].safety_state="unknown";})},
    {id:"duplicate-sequence",name:"Duplicate sample sequence",expected:"reject",downloadable:true,
      reason:"Duplicate sequence indicates a malformed stream",
      ndjson:altered("synthetic",v=>{v[4].sequence=2;})},
    {id:"wrong-session",name:"Foreign session frame",expected:"reject",downloadable:true,
      reason:"A sample must belong to the active session",
      ndjson:altered("synthetic",v=>{v[5].session_id="foreign-session";})},
    {id:"out-of-range",name:"Out-of-range voltage",expected:"reject",downloadable:true,
      reason:"Reject out-of-range input rather than silently saturating",
      ndjson:altered("synthetic",v=>{v[2].source_v=31;})},
    {id:"invalid-protocol",name:"Unknown protocol version",expected:"reject",downloadable:true,
      reason:"Unknown schemas may not be silently interpreted",
      ndjson:altered("synthetic",v=>{v[0].protocol="powe.benchlink.v99";})},
    {id:"bad-end-count",name:"Incorrect sample count",expected:"reject",downloadable:true,
      reason:"End record must count captured samples exactly",
      ndjson:altered("synthetic",v=>{v.at(-1).samples=9;})},
    {id:"extra-after-end",name:"Unexpected trailing frame",expected:"reject",downloadable:true,
      reason:"Any data after a completed session is invalid",
      ndjson:lines([...frames(),sample(8)])},
    {id:"fake-synthetic-meter",name:"Synthetic claiming calibrated meter",expected:"reject",downloadable:true,
      reason:"Synthetic sources must not claim physical calibration",
      ndjson:altered("synthetic",v=>{v[0].source_meter_id="unverified-meter";})},
    {id:"future-timestamp",name:"Future UTC timestamp",expected:"reject",downloadable:true,
      reason:"Reject a timestamp later than the fixed verification clock",
      ndjson:altered("synthetic",v=>{v[0].timestamp_utc="2031-01-01T00:00:00Z";})},
    {id:"invalid-calendar",name:"Impossible calendar timestamp",expected:"reject",downloadable:true,
      reason:"Invalid calendar dates must not normalize silently",
      ndjson:altered("synthetic",v=>{v[0].timestamp_utc="2026-02-30T12:00:00Z";})},
    {id:"malformed-json",name:"Broken NDJSON",expected:"reject",downloadable:true,
      reason:"Invalid JSON cannot become a measurement",
      ndjson:lines(frames()).replace('{"protocol":','{INVALID_JSON,"protocol":')}
  ];
}
export function auditFixture(fixture,{nowMs=Date.parse(FIXTURE_CLOCK_UTC)}={}){
  if(!fixture||typeof fixture.ndjson!=="string"||!["eligible","ineligible","reject"].includes(fixture.expected)){
    throw new TypeError("Invalid test fixture");
  }
  let actual="reject",issues=[],summary=null,error=null,energyAccurate=true;
  try{
    const collection=parseTranscript(fixture.ndjson,{nowMs});
    summary=summarizeCollector(collection);
    actual=summary.exportEligible?"eligible":"ineligible";
    issues=summary.issues;
    if(fixture.expectSourceJ!==undefined){
      energyAccurate=Math.abs(summary.sourceEnergyJ-fixture.expectSourceJ)<=1e-10 &&
        Math.abs(summary.receiverEnergyJ-fixture.expectReceiverJ)<=1e-10;
    }
  }catch(e){error=String(e.message||e);}
  return {
    id:fixture.id,name:fixture.name,expected:fixture.expected,actual,
    passed:actual===fixture.expected&&energyAccurate,
    energyAccurate,
    reason:fixture.reason,
    issueCount:issues.length,issues,error,
    sourceEnergyJ:summary?.sourceEnergyJ??null,
    receiverEnergyJ:summary?.receiverEnergyJ??null,
    provenance:"entirely synthetic test fixture"
  };
}
export function runConformance(){
  const results=getFixtures().map(f=>auditFixture(f));
  return Object.freeze({
    schema:FIXTURE_VERSION,fixtureClockUtc:FIXTURE_CLOCK_UTC,
    purpose:"offline synthetic data protocol conformance",
    hardwareValidated:false,deviceConnected:false,
    passed:results.filter(r=>r.passed).length,total:results.length,
    allPassed:results.every(r=>r.passed),results
  });
}
export function assessOperatorChecklist(selectedIds){
  const ids=new Set(Array.isArray(selectedIds)?selectedIds:[]);
  const known=new Set(CHECKLIST_ITEMS.map(item=>item.id));
  if([...ids].some(id=>!known.has(id)))throw new Error("Unknown checklist item");
  const missing=CHECKLIST_ITEMS.filter(x=>!ids.has(x.id)).map(x=>x.id);
  return {
    total:CHECKLIST_ITEMS.length,marked:ids.size,missing,
    selfAttestedComplete:missing.length===0,
    disclaimer:"Self-attestation only; NOT an approval, inspection, or permission to energize hardware."
  };
}
export async function sha256Hex(data){
  if(typeof data!=="string")throw new TypeError("Expected text");
  if(!globalThis.crypto?.subtle)throw new Error("SHA-256 unavailable in this secure runtime");
  const bytes=new TextEncoder().encode(data);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function createConformanceReceipt({checklistIds=[]}={}){
  const report=runConformance();
  const fixtures=getFixtures();
  const manifest=[];
  for(const f of fixtures){
    manifest.push({id:f.id,sha256:await sha256Hex(f.ndjson),bytes:new TextEncoder().encode(f.ndjson).length});
  }
  const checklist=assessOperatorChecklist(checklistIds);
  return {
    schema:"powe-rung5-commissioning-receipt-v1",
    status:report.allPassed?"SYNTHETIC_CHECKS_PASSED":"SYNTHETIC_CHECKS_FAILED",
    hardwareValidated:false,calibrationVerified:false,physicalSafetyVerified:false,
    report,fixtureManifest:manifest,checklist,
    note:"SHA-256 checks fixture file integrity only; hashes do not authenticate instruments, hardware, calibration, or safety."
  };
}
