// PoWE Rung 7: LED OFF / ON / OFF optical control analysis.
// These are unverified, self-described telemetry claims, NOT authenticated measurements.
// No hardware I/O, no serial outputs, no energy generation and no physical authorization.
import {PROTOCOL,parseTranscript,summarizeCollector,MAX_TRANSCRIPT_BYTES} from "./benchlink.js";

export const CONTROL_SCHEMA="powe-optical-controls-v1";
export const DEFAULT_MAX_GAP_S=180;
export const DEFAULT_MAX_DRIFT_RATIO=0.2;
const MAX_UNCERTAINTY_J=1e7;
const asFinite=(v,min,max)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
function fail(message){throw new Error(message);}

function examineSession(text,label,nowMs) {
  if(typeof text!=="string"||!text||new TextEncoder().encode(text).length>MAX_TRANSCRIPT_BYTES){
    fail(label+": missing or oversized BenchLink transcript");
  }
  const collection=parseTranscript(text,{nowMs});
  const s=summarizeCollector(collection);
  const durationS=s.elapsedSeconds;
  // Rung 4's exportEligible criterion requires source energy > 0.
  // That is inappropriate for an LED-OFF control, so gate all other invariants.
  const issues=[];
  if(!collection.ended)issues.push("missing end frame");
  if(s.sampleCount<6)issues.push("fewer than six samples");
  if(durationS<5)issues.push("under 5 seconds");
  if(durationS>3600)issues.push("over one hour");
  if(s.gapCount)issues.push("missing data interval");
  if(s.faultCount)issues.push("reported fault");
  if(s.unknownCount)issues.push("unknown safety flag");
  if(collection.hasError)issues.push("collector integrity error");
  if(Math.abs(s.integratedSeconds-durationS)>1e-6)issues.push("unintegrated duration");
  if(collection.header?.kind==="reported"&&collection.samples.some(x=>x.safety_state!=="ok")){
    issues.push("not all samples marked ok");
  }
  if(issues.length)fail(label+": invalid control session: "+issues.join("; "));
  const startMs=Date.parse(collection.header.timestamp_utc)+collection.samples[0].elapsed_ms;
  const endMs=Date.parse(collection.header.timestamp_utc)+collection.samples.at(-1).elapsed_ms;
  return {
    collection,summary:s,startMs,endMs,midMs:(startMs+endMs)/2,
    sourceMeanW:s.sourceEnergyJ/durationS,
    receiverMeanW:s.receiverEnergyJ/durationS
  };
}
function compareIdentity(items){
  const [first,...others]=items;
  const h=first.collection.header;
  const fields=["kind","apparatus_id","source_meter_id","receiver_meter_id","calibration_date"];
  for(const entry of others){
    if(fields.some(key=>entry.collection.header[key]!==h[key])){
      fail("Control sessions have mismatched provenance, apparatus or meter metadata");
    }
  }
  const ids=items.map(x=>x.collection.header.session_id);
  if(new Set(ids).size!==ids.length)fail("Each control needs a distinct session ID");
  return h.kind;
}
function uncertaintyFor(kind,uncertainties){
  const values=["offBeforeReceiverJ","onReceiverJ","offAfterReceiverJ","onSourceJ"];
  if(kind==="reported"){
    for(const k of values){
      if(!asFinite(uncertainties?.[k],1e-12,MAX_UNCERTAINTY_J)){
        fail("Reported controls require independently justified positive energy uncertainty: "+k);
      }
    }
  }else if(uncertainties!==undefined){
    for(const k of values){
      if(!asFinite(uncertainties?.[k],1e-12,MAX_UNCERTAINTY_J)){
        fail("If supplied, synthetic uncertainty values must be positive: "+k);
      }
    }
  }
  return uncertainties||null;
}

export function analyzeOpticalControls({
  beforeTranscript,onTranscript,afterTranscript,
  geometryId,loadId,separationM,uncertainties
}, {nowMs=Date.now(),maxGapS=DEFAULT_MAX_GAP_S,maxDriftRatio=DEFAULT_MAX_DRIFT_RATIO}={}){
  if(!asFinite(nowMs,0,Number.MAX_SAFE_INTEGER))fail("Invalid current timestamp");
  if(!/^[A-Za-z0-9._-]{1,64}$/.test(geometryId||""))fail("geometryId required");
  if(!/^[A-Za-z0-9._-]{1,64}$/.test(loadId||""))fail("loadId required");
  if(!asFinite(separationM,0.05,5))fail("separationM must be between 0.05 and 5 m");
  if(!asFinite(maxGapS,0,3600))fail("Invalid maximum temporal gap");
  if(!asFinite(maxDriftRatio,0,2))fail("Invalid maximum baseline drift threshold");
  const before=examineSession(beforeTranscript,"LED OFF before",nowMs);
  const on=examineSession(onTranscript,"LED ON",nowMs);
  const after=examineSession(afterTranscript,"LED OFF after",nowMs);
  const kind=compareIdentity([before,on,after]);
  if(before.endMs>on.startMs || on.endMs>after.startMs){
    fail("Trials must occur sequentially as LED OFF, ON, OFF with no overlap");
  }
  const gap1=(on.startMs-before.endMs)/1000, gap2=(after.startMs-on.endMs)/1000;
  if(gap1>maxGapS||gap2>maxGapS){
    fail("LED OFF/ON control gaps exceed allowed time window");
  }
  if(on.summary.sourceEnergyJ<=0)fail("LED ON session has no input-source DC energy");
  // LED OFF source path should be nearly unpowered relative to LED ON input.
  const offLeakThresholdW=on.sourceMeanW*0.01;
  if(before.sourceMeanW>offLeakThresholdW || after.sourceMeanW>offLeakThresholdW){
    fail("LED OFF source power exceeds 1% of LED ON source power; verify source boundary");
  }
  const alpha=(on.midMs-before.midMs)/(after.midMs-before.midMs);
  if(!(alpha>=0&&alpha<=1))fail("ON midpoint is not bracketed by LED OFF controls");
  const backgroundW=(1-alpha)*before.receiverMeanW+alpha*after.receiverMeanW;
  const expectedBackgroundJ=backgroundW*on.summary.elapsedSeconds;
  const signedDeltaJ=on.summary.receiverEnergyJ-expectedBackgroundJ;
  const meanOffW=(before.receiverMeanW+after.receiverMeanW)/2;
  // Tiny dark signals are dominated by unknown instrument offset;
  // never interpret the relative ratio as precision at zero.
  const driftRatio=meanOffW>1e-9
    ?Math.abs(after.receiverMeanW-before.receiverMeanW)/meanOffW
    :null;
  const baselineDriftFlag=driftRatio!==null && driftRatio>maxDriftRatio;
  const u=uncertaintyFor(kind,uncertainties);
  const sourceDurationRatio1=(1-alpha)*on.summary.elapsedSeconds/before.summary.elapsedSeconds;
  const sourceDurationRatio2=alpha*on.summary.elapsedSeconds/after.summary.elapsedSeconds;
  const combinedReceiverUncertaintyJ=u ? Math.hypot(
    u.onReceiverJ,
    sourceDurationRatio1*u.offBeforeReceiverJ,
    sourceDurationRatio2*u.offAfterReceiverJ
  ):null;
  let signalStatus;
  if(baselineDriftFlag)signalStatus="BASELINE_DRIFT_REVIEW";
  else if(signedDeltaJ<=0)signalStatus="NO_POSITIVE_DELTA";
  else if(combinedReceiverUncertaintyJ===null)signalStatus="UNCERTAINTY_NOT_SUPPLIED";
  else if(signedDeltaJ<=3*combinedReceiverUncertaintyJ)signalStatus="DELTA_BELOW_3X_REPORTED_UNCERTAINTY";
  else signalStatus="POSITIVE_DESCRIPTIVE_DELTA";
  return Object.freeze({
    schema:CONTROL_SCHEMA,
    provenance:kind==="reported"?"SELF_REPORTED_UNVERIFIED":"SYNTHETIC_DEMONSTRATION",
    kind,geometryId,loadId,separationM,
    sessionIds:[before.collection.header.session_id,on.collection.header.session_id,after.collection.header.session_id],
    apparatusId:before.collection.header.apparatus_id,
    sourceMeterId:before.collection.header.source_meter_id||null,
    receiverMeterId:before.collection.header.receiver_meter_id||null,
    calibrationDate:before.collection.header.calibration_date||null,
    sourceBoundary:"ELECTRICAL_DC_INPUT_TO_LED_NOT_WALL_PLUG",
    receiverBoundary:"ELECTRICAL_DC_PV_LOAD",
    elapsedSeconds:{before:before.summary.elapsedSeconds,on:on.summary.elapsedSeconds,after:after.summary.elapsedSeconds},
    sourceEnergyJ:{before:before.summary.sourceEnergyJ,on:on.summary.sourceEnergyJ,after:after.summary.sourceEnergyJ},
    receiverEnergyJ:{before:before.summary.receiverEnergyJ,on:on.summary.receiverEnergyJ,after:after.summary.receiverEnergyJ},
    backgroundInterpolatedW:backgroundW,
    expectedAmbientContributionJ:expectedBackgroundJ,
    signedLightAssociatedReceiverDeltaJ:signedDeltaJ,
    combinedReportedReceiverUncertaintyJ:combinedReceiverUncertaintyJ,
    sourceOnReportedUncertaintyJ:u?.onSourceJ??null,
    estimatedDeltaToReportedUncertainty:combinedReceiverUncertaintyJ? signedDeltaJ/combinedReceiverUncertaintyJ:null,
    driftRatio,baselineDriftFlag,bracketingWeightAfter:alpha,
    timeGapsSeconds:{beforeToOn:gap1,onToAfter:gap2},
    signalStatus,
    hardwareValidated:false,physicalLedStateVerified:false,calibrationVerified:false,
    opticalPowerMeasured:false,efficiencyProven:false,wirelessPowerClaimVerified:false,
    caution:"LED states, ambient stability, meter calibration, sample synchronization and physical provenance are NOT verified. Delta is an electrical PV-load difference, not optical power or system efficiency."
  });
}
export async function sha256Text(text){
  if(typeof text!=="string")throw new TypeError("Hash needs text");
  if(!globalThis.crypto?.subtle)throw new Error("SHA-256 requires WebCrypto");
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function opticalControlsReceipt(inputs,opts){
  const result=analyzeOpticalControls(inputs,opts);
  return {
    receiptSchema:"powe-optical-controls-receipt-v1",
    result,
    inputsSha256:{
      ledOffBefore:await sha256Text(inputs.beforeTranscript),
      ledOn:await sha256Text(inputs.onTranscript),
      ledOffAfter:await sha256Text(inputs.afterTranscript)
    },
    controlsGeneratedBy:"PoWE browser / self-reported input",
    verifiedByIndependentInstrument:false,
    hardwareValidated:false,
    note:"Hashes bind exact input text bytes for later comparison, not the truth of measurements. Save original three NDJSON files separately."
  };
}
function fixture(sessionId,timeUtc,sourceCurrentA,receiverCurrentA){
  return [
    {protocol:PROTOCOL,type:"header",session_id:sessionId,kind:"synthetic",
     apparatus_id:"demo-mk1",timestamp_utc:timeUtc},
    ...Array.from({length:8},(_,i)=>({
      protocol:PROTOCOL,type:"sample",session_id:sessionId,sequence:i,elapsed_ms:i*1000,
      source_v:5,source_a:sourceCurrentA,receiver_v:1.2,receiver_a:receiverCurrentA,
      safety_state:"not_applicable"
    })),
    {protocol:PROTOCOL,type:"end",session_id:sessionId,samples:8}
  ].map(x=>JSON.stringify(x)).join("\n")+"\n";
}
export const SYNTHETIC_OFF_BEFORE=fixture("demo-off-before","2026-10-10T12:00:00Z",0,0.001);
export const SYNTHETIC_LED_ON=fixture("demo-led-on","2026-10-10T12:00:20Z",0.02,0.002);
export const SYNTHETIC_OFF_AFTER=fixture("demo-off-after","2026-10-10T12:00:40Z",0,0.001);
export const SYNTHETIC_INPUTS=Object.freeze({
  beforeTranscript:SYNTHETIC_OFF_BEFORE,
  onTranscript:SYNTHETIC_LED_ON,
  afterTranscript:SYNTHETIC_OFF_AFTER,
  geometryId:"demo-geometry",loadId:"demo-load",separationM:0.5,
  uncertainties:{offBeforeReceiverJ:0.0002,onReceiverJ:0.0002,offAfterReceiverJ:0.0002,onSourceJ:0.01}
});
