// PoWE Rung 10 / paired LightBridge local field log analyzer.
// Analyzes self-reported receiver/sender browser event claims, NOT proof
// of physical camera transport, sender identity, or any power transmission.
import {checkLightBridgeReceipts} from "./bridge-lab.js";
export const FIELD_SCHEMA="lightbridge-field-log-v1";
export const ANALYSIS_SCHEMA="powe-optical-field-analysis-v1";
export const MAX_FIELD_BYTES=4*1024*1024;
export const MAX_EVENTS=20000;
const SESSION=/^[A-Za-z0-9_-]{6,40}$/;
const SHA=/^[a-f0-9]{64}$/;
const INT=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function fail(message){throw new Error(message);}
function recordCount(log,key){const value=log.counters?.[key];if(!INT(value,0,10000000))fail("Invalid "+key+" counter");return value;}
function validate(log,role){
  if(!log||typeof log!=="object"||Array.isArray(log)||
    log.schema!==FIELD_SCHEMA||log.role!==role)fail("Expected "+role+" LightBridge field log v1");
  if(!SESSION.test(log.sessionId||""))fail("Missing or invalid "+role+" sessionId");
  if(!Array.isArray(log.events)||log.events.length>MAX_EVENTS)fail("Invalid "+role+" events");
  if(!INT(log.droppedEvents,0,10000000))fail("Invalid dropped event counter");
  const required=role==="sender"?["displayed"]:["observed","observedCamera","observedManual",
    "duplicate","rejected","scanAttempts","scanQrDecoded","cameraStarts","verificationSucceeded","verificationFailed"];
  for(const k of required)recordCount(log,k);
  let last=-1;
  const sequences=new Set();
  let generated=0,observed=0,camera=0,manual=0,duplicates=0,rejected=0,success=0,failure=0;
  const events=[];
  for(const event of log.events){
    if(!event||typeof event!=="object"||Array.isArray(event)||
      !INT(event.elapsedMs,0,86400000)||event.elapsedMs<last)fail("Non-monotonic or invalid "+role+" event time");
    last=event.elapsedMs;
    if(role==="sender"){
      if(event.type==="qr_generated_for_display"){
        if(!INT(event.sequence,0,1000000))fail("Invalid sender frame sequence");
        generated++;sequences.add(event.sequence);
        events.push({t:event.elapsedMs,sequence:event.sequence,source:"sender_render"});
      }
    }else{
      if(event.type==="frame_observed"){
        if(!INT(event.sequence,0,1000000)||
          !["camera","manual"].includes(event.method)||
          typeof event.duplicate!=="boolean")fail("Invalid observed frame");
        observed++;if(event.method==="camera")camera++;else manual++;
        if(event.duplicate)duplicates++;
        if(event.duplicate!==sequences.has(event.sequence))fail("Duplicate flag differs from sequence log");
        sequences.add(event.sequence);
        events.push({t:event.elapsedMs,sequence:event.sequence,source:event.method});
      }else if(event.type==="frame_rejected"){
        if(!["camera","manual"].includes(event.method))fail("Invalid rejection method");
        rejected++;
      }else if(event.type==="verification_success"){
        success++;
        if(!SHA.test(event.sha256||"")||!INT(event.bytes,1,2097152))
          fail("Invalid verified receiver byte hash");
        if(log.verified?.sha256!==event.sha256||log.verified?.bytes!==event.bytes)
          fail("Verified receiver data disagrees with event");
      }else if(event.type==="verification_failure")failure++;
    }
  }
  // A bounded recorder may drop *trailing* events while retaining aggregate
  // totals. Allow that mismatch only if an explicit droppedEvents count explains it.
  const countMatches=(counter,observedCount)=>{
    const total=recordCount(log,counter);
    return total===observedCount||(log.droppedEvents>0 &&
      total>=observedCount&&total-observedCount<=log.droppedEvents);
  };
  if(role==="sender"&&!countMatches("displayed",generated))
    fail("Sender frame counter mismatch");
  if(role==="receiver"){
    if(!countMatches("observed",observed)||
      !countMatches("observedCamera",camera)||
      !countMatches("observedManual",manual)||
      !countMatches("duplicate",duplicates)||
      !countMatches("rejected",rejected)||
      !countMatches("verificationSucceeded",success)||
      !countMatches("verificationFailed",failure)){
      fail("Receiver event counters mismatch");
    }
    if(recordCount(log,"scanQrDecoded")>recordCount(log,"scanAttempts"))
      fail("QR decodes exceed scans");
    if(success>0&&!log.verified)fail("Missing verified receiver file metadata");
    if(log.verified&&(!SHA.test(log.verified.sha256||"")||
      !INT(log.verified.bytes,1,2097152)||success<1))fail("Invalid receiver verified claim");
  }
  return {log,events,sequences,generated,observed,camera,manual,duplicates,rejected,
    lastEventMs:last,firstFrameMs:events.length?events[0].t:null,
    lastFrameMs:events.length?events.at(-1).t:null};
}
export function parseFieldLog(text,role){
  if(typeof text!=="string"||!text||new TextEncoder().encode(text).length>MAX_FIELD_BYTES)
    fail("Field log is empty or larger than 4 MiB");
  let data;
  try{data=JSON.parse(text);}catch{fail("Invalid field log JSON");}
  validate(data,role);
  return data;
}
export function analyzeFieldPair({sender,receiver,senderReceipt=null,receiverReceipt=null}={}){
  const a=validate(sender,"sender"),b=validate(receiver,"receiver");
  if(sender.sessionId!==receiver.sessionId)fail("Session mismatch between sender and receiver field logs");
  const issues=[];
  if(!a.generated)issues.push("No sender frames were generated for display");
  if(!b.observed)issues.push("No receiver frames observed");
  if(sender.droppedEvents||receiver.droppedEvents)
    issues.push("Event log was truncated; coverage is not complete");
  const sent=a.sequences,cameraSeq=new Set(b.events.filter(e=>e.source==="camera").map(e=>e.sequence)),
    manualSeq=new Set(b.events.filter(e=>e.source==="manual").map(e=>e.sequence));
  const cameraOverlap=[...cameraSeq].filter(s=>sent.has(s)).length;
  const manualOverlap=[...manualSeq].filter(s=>sent.has(s)).length;
  const allOverlap=[...b.sequences].filter(s=>sent.has(s)).length;
  if(b.manual)issues.push("Some frames were manually pasted; not a camera-only trial");
  if(!cameraOverlap)issues.push("No matching sender-rendered/receiver-camera frame sequences");
  if(!receiver.verified)issues.push("No reported completed SHA-256 file verification");
  let receiptChecks=null;
  if(senderReceipt!==null||receiverReceipt!==null){
    if(senderReceipt===null||receiverReceipt===null){
      issues.push("Both receipts are required for receipt comparison");
    }else{
      receiptChecks=checkLightBridgeReceipts(senderReceipt,receiverReceipt);
      if(!receiptChecks.fieldsConsistent)issues.push("Sender/receiver receipt fields disagree");
      if(receiver.verified?.sha256!==senderReceipt.originalSha256||
        receiver.verified?.sha256!==receiverReceipt.originalSha256||
        receiver.verified?.bytes!==senderReceipt.originalSize||
        receiver.verified?.bytes!==receiverReceipt.originalSize){
        issues.push("Reported reconstructed hash or bytes differ from receipt claims");
      }
    }
  }
  const senderWindowMs=a.firstFrameMs===null?null:a.lastFrameMs-a.firstFrameMs;
  const receiverWindowMs=b.firstFrameMs===null?null:b.lastFrameMs-b.firstFrameMs;
  const flags={
    selfReportedCameraPathPresent:cameraSeq.size>0,
    selfReportedCameraOnly:b.camera>0&&b.manual===0,
    reconstructedFileHashClaimPresent:Boolean(receiver.verified),
    receiptFieldsConsistent:receiptChecks?.fieldsConsistent??null,
    originalFileBytesIndependentlyCheckedByPoWE:false,
    senderDeviceAuthenticated:false,
    physicalCameraTransferIndependentlyVerified:false,
    physicalPowerTransferVerified:false
  };
  const descriptiveState=issues.length?"INCOMPLETE_OR_MIXED_SELF_REPORTED":
    "CONSISTENT_SELF_REPORTED_CAMERA_TRANSFER";
  return {
    schema:ANALYSIS_SCHEMA,sessionId:sender.sessionId,
    state:descriptiveState,
    source:"Local sender/receiver LightBridge field log JSON, not signed evidence",
    sender:{renderedFrames:a.generated,uniqueRenderedSequences:sent.size,
      localRenderWindowMs:senderWindowMs,droppedEvents:sender.droppedEvents},
    receiver:{observedFrames:b.observed,cameraObservedFrames:b.camera,manualObservedFrames:b.manual,
      uniqueObservedSequences:b.sequences.size,uniqueCameraSequences:cameraSeq.size,
      duplicateSequenceObservations:b.duplicates,rejectedFrames:b.rejected,
      cameraScanAttempts:recordCount(receiver,"scanAttempts"),
      cameraQrDecodes:recordCount(receiver,"scanQrDecoded"),
      localObservationWindowMs:receiverWindowMs,
      reportedVerifiedOriginalSha256:receiver.verified?.sha256||null,
      reportedVerifiedBytes:receiver.verified?.bytes??null,
      droppedEvents:receiver.droppedEvents},
    overlap:{uniqueObservedVsRendered:allOverlap,
      uniqueCameraVsRendered:cameraOverlap,uniqueManualVsRendered:manualOverlap,
      observedCameraOverRenderedPct:sent.size?100*cameraOverlap/sent.size:null},
    conditions:{...receiver.conditions},
    flags,issues,receiptChecks,
    caveats:[
      "The matched-sequence ratio is NOT optical frame loss: generated QR frames might not be displayed long enough, and camera sampling is opportunistic.",
      "Sender and receiver timebases are independently monotonic, but not synchronized; their local windows cannot give one-way latency.",
      "JSON field logs are editable and are not physical camera, user consent or device identity attestations.",
      "No LED/PV harvested power or end-to-end electrical energy was measured by this software."
    ]
  };
}
export const EXAMPLE_PAIR=Object.freeze({
  sender:{
    schema:FIELD_SCHEMA,role:"sender",sessionId:"demoSession_01",
    startedAtUtc:"2026-11-06T10:00:00Z",
    counters:{displayed:3},droppedEvents:0,
    events:[
      {elapsedMs:0,type:"qr_generated_for_display",sequence:0},
      {elapsedMs:500,type:"qr_generated_for_display",sequence:1},
      {elapsedMs:1000,type:"qr_generated_for_display",sequence:2}
    ],verified:null
  },
  receiver:{
    schema:FIELD_SCHEMA,role:"receiver",sessionId:"demoSession_01",
    startedAtUtc:"2026-11-06T10:00:05Z",
    conditions:{distanceCm:"30",lighting:"SYNTHETIC",deviceLabel:"demo-phone",notes:"synthetic only"},
    counters:{observed:3,observedCamera:3,observedManual:0,duplicate:1,rejected:0,
      scanAttempts:15,scanQrDecoded:3,cameraStarts:1,verificationSucceeded:1,verificationFailed:0},
    droppedEvents:0,
    events:[
      {elapsedMs:100,type:"camera-start"},
      {elapsedMs:450,type:"frame_observed",sequence:0,method:"camera",duplicate:false,blocksSolved:1},
      {elapsedMs:920,type:"frame_observed",sequence:1,method:"camera",duplicate:false,blocksSolved:2},
      {elapsedMs:1100,type:"frame_observed",sequence:1,method:"camera",duplicate:true,blocksSolved:2},
      {elapsedMs:1800,type:"verification_success",sha256:"a".repeat(64),bytes:64}
    ],verified:{sha256:"a".repeat(64),bytes:64}
  }
});
