import {parseFieldLog,analyzeFieldPair,EXAMPLE_PAIR,MAX_FIELD_BYTES} from "./optical-field.js";
const $=id=>document.getElementById(id);
let sender=null,receiver=null,senderReceipt=null,receiverReceipt=null,report=null;
function status(message,error=false){
 $("field-status").textContent=message;
 $("field-status").classList.toggle("field-error",error);
}
function item(tag,content,cls){
 const el=document.createElement(tag);
 if(content!==undefined)el.textContent=String(content);
 if(cls)el.className=cls;
 return el;
}
function download(name,value){
 const blob=new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function show(){
 const root=$("field-results");root.replaceChildren();
 $("field-save").disabled=!report;
 if(!report){
  root.append(item("p","No paired field-log analysis has been performed."));
  return;
 }
 const metrics=[
  ["CLASSIFICATION",report.state.replaceAll("_"," ")],
  ["SENDER FRAMES GENERATED",report.sender.renderedFrames],
  ["UNIQUE SENDER SEQUENCES",report.sender.uniqueRenderedSequences],
  ["RECEIVER CAMERA FRAMES",report.receiver.cameraObservedFrames],
  ["MANUAL INPUT FRAMES",report.receiver.manualObservedFrames],
  ["CAMERA SEQUENCES MATCHING SENDER",report.overlap.uniqueCameraVsRendered],
  ["OBSERVED CAMERA/RENDERED COVERAGE",report.overlap.observedCameraOverRenderedPct===null?"N/A":report.overlap.observedCameraOverRenderedPct.toFixed(1)+"% (NOT frame loss)"],
  ["RECEIVER SCAN ATTEMPTS",report.receiver.cameraScanAttempts],
  ["RECEIVER REJECTED FRAMES",report.receiver.rejectedFrames],
  ["LOCAL SENDER RENDER WINDOW",report.sender.localRenderWindowMs===null?"N/A":report.sender.localRenderWindowMs+" ms"],
  ["LOCAL RECEIVER OBSERVE WINDOW",report.receiver.localObservationWindowMs===null?"N/A":report.receiver.localObservationWindowMs+" ms"],
  ["REPORTED RECONSTRUCTED FILE",report.receiver.reportedVerifiedBytes===null?"Not verified":report.receiver.reportedVerifiedBytes+" bytes"],
  ["RECEIVER HASH CLAIM",report.receiver.reportedVerifiedOriginalSha256||"None"]
 ];
 for(const [name,value] of metrics){
  const box=item("div",undefined,"field-metric");
  box.append(item("small",name),item("strong",value));
  root.append(box);
 }
 const alerts=$("field-issues");alerts.replaceChildren();
 const messages=report.issues.length?report.issues:["Log fields are consistent. The physical camera transfer is STILL not independently proven by this JSON."];
 for(const message of messages)alerts.append(item("p",message));
 const conditions=$("field-conditions");conditions.replaceChildren();
 for(const [name,value] of Object.entries(report.conditions||{})){
  if(typeof value==="string"&&value)conditions.append(item("p",name+": "+value));
 }
}
function clearReport(){
 report=null;$("field-results").replaceChildren();$("field-issues").replaceChildren();
 $("field-conditions").replaceChildren();show();
}
for(const [id,key,role] of [["field-sender","sender","sender"],["field-receiver","receiver","receiver"]]){
 $(id).addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(role==="sender")sender=null;else receiver=null;
  clearReport();
  if(file.size>MAX_FIELD_BYTES)return status("Field-log file is larger than 4 MiB.",true);
  try{
   const parsed=parseFieldLog(await file.text(),role);
   if(role==="sender")sender=parsed;else receiver=parsed;
   $(id+"-name").textContent=file.name;
   status("Local "+role+" event log imported. This file is user-editable, not signed evidence.");
  }catch(e){
   $(id+"-name").textContent="REJECTED";
   status("Field-log import rejected: "+String(e.message||e),true);
  }
 });
}
for(const [id,role] of [["field-sender-receipt","sender"],["field-receiver-receipt","receiver"]]){
 $(id).addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(role==="sender")senderReceipt=null;else receiverReceipt=null;
  clearReport();
  if(file.size>65536)return status("Receipt exceeds 64 KiB.",true);
  try{
   const obj=JSON.parse(await file.text());
   if(!obj||typeof obj!=="object"||Array.isArray(obj))throw Error("Receipt must be a JSON object");
   if(role==="sender")senderReceipt=obj;else receiverReceipt=obj;
   status("Local "+role+" receipt loaded. Receipt fields alone cannot prove a physical transfer.");
  }catch(e){status("Invalid receipt: "+String(e.message||e),true);}
 });
}
$("field-demo").addEventListener("click",()=>{
 sender=JSON.parse(JSON.stringify(EXAMPLE_PAIR.sender));
 receiver=JSON.parse(JSON.stringify(EXAMPLE_PAIR.receiver));
 senderReceipt=null;receiverReceipt=null;
 for(const id of ["field-sender","field-receiver","field-sender-receipt","field-receiver-receipt"])$(id).value="";
 $("field-sender-name").textContent="FABRICATED DEMONSTRATION";
 $("field-receiver-name").textContent="FABRICATED DEMONSTRATION";
 clearReport();
 status("Loaded FABRICATED two-device camera-path logs. No cameras, second devices or physical measurements were involved.");
});
$("field-run").addEventListener("click",()=>{
 clearReport();
 try{
  if(!sender||!receiver)throw Error("Import both role-specific LightBridge field logs.");
  report=analyzeFieldPair({sender,receiver,senderReceipt,receiverReceipt});
  show();
  status(report.state+": "+report.overlap.uniqueCameraVsRendered+" unique camera sequences match generated QR sequence records. This is NOT independently verified optical reception.",
   report.issues.length>0);
 }catch(e){status("FIELD ANALYSIS REJECTED: "+String(e.message||e),true);}
});
$("field-save").addEventListener("click",()=>{
 if(!report)return;
 download("PoWE-R10-UNVERIFIED-field-analysis.json",{
  ...report,
  serializedBy:"PoWE Rung 10 local browser",
  physicalExperimentIndependentlyReviewed:false,
  independentDeviceTimestampSync:false,
  note:"Keep original sender/receiver logs and reconstructed files. This report is derived from unsigned, user-editable local data."
 });
 status("Field-analysis JSON downloaded locally. No data uploaded.");
});
$("field-reset").addEventListener("click",()=>{
 sender=null;receiver=null;senderReceipt=null;receiverReceipt=null;
 for(const id of ["field-sender","field-receiver","field-sender-receipt","field-receiver-receipt"])$(id).value="";
 $("field-sender-name").textContent="No file selected";$("field-receiver-name").textContent="No file selected";
 clearReport();status("All local logs and reports cleared.");
});
show();
