import {
  MAX_TRANSCRIPT_BYTES,SYNTHETIC_NDJSON,createCollector,ingestLine,parseTranscript,
  summarizeCollector,observationReceipt,buildBenchTrial,trialsToCsv
} from "./benchlink.js";
import {parseTrials} from "./benchkit.js";

const $ = id => document.getElementById(id);
let collection=createCollector(),rawTranscript="",queued=[],serialPort=null,serialReader=null;
let serialReading=false,stopRequested=false;
const show = (id,value) => $(id).textContent=String(value);
function status(message,bad=false){
  show("link-status",message);
  $("link-status").classList.toggle("link-bad",bad);
}
function fmt(value,unit){
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:7})+" "+unit;
}
function render(){
  const stats=summarizeCollector(collection);
  show("link-session",stats.sessionId||"None");
  show("link-kind",stats.kind==="reported"?"REPORTED / UNVERIFIED":stats.kind==="synthetic"?"SYNTHETIC / NOT REAL":"N/A");
  show("link-samples",stats.sampleCount);
  show("link-source",fmt(stats.sourceEnergyJ,"J"));
  show("link-receiver",fmt(stats.receiverEnergyJ,"J"));
  show("link-integrated",fmt(stats.integratedSeconds,"s"));
  show("link-gaps",stats.gapCount);
  show("link-faults",stats.faultCount);
  show("link-queue",queued.length);
  show("link-state",stats.status);
  const root=$("link-issues");
  root.replaceChildren();
  if(!stats.issues.length) root.append(document.createTextNode("No structural issues in the loaded session. This does not verify equipment or safety."));
  else for(const issue of stats.issues){
    const p=document.createElement("p");p.textContent="• "+issue;root.append(p);
  }
  $("link-receipt").disabled=!collection.header;
  $("link-queue-trial").disabled=!stats.exportEligible;
  $("link-export").disabled=queued.length===0;
  $("link-clear-queue").disabled=queued.length===0;
  $("link-connect").disabled=serialReading;
  $("link-disconnect").disabled=!serialReading;
}
function resetCollection(){
  collection=createCollector();
  rawTranscript="";
  render();
}
function load(text,label){
  try{
    const parsed=parseTranscript(text);
    collection=parsed;
    rawTranscript=text;
    const stats=summarizeCollector(collection);
    status(label+": "+stats.sampleCount+" samples, "+
      (stats.exportEligible?"complete run":"incomplete/flagged run")+
      ". Provenance is claimed, never independently authenticated.",!stats.exportEligible);
  }catch(e){
    resetCollection();
    status("IMPORT REJECTED: "+String(e.message||e),true);
  }
  render();
}
function download(name,content,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("link-file").addEventListener("change",async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  if(serialReading){
    status("Disconnect serial before importing another stream.",true);return;
  }
  if(file.size>MAX_TRANSCRIPT_BYTES){
    resetCollection();status("Import rejected: file exceeds 2 MiB.",true);return;
  }
  try{load(await file.text(),file.name);}
  catch(e){resetCollection();status("File read failed: "+String(e.message||e),true);}
});
$("link-demo").addEventListener("click",()=>{
  if(serialReading)return status("Disconnect the serial device first.",true);
  $("link-file").value="";
  load(SYNTHETIC_NDJSON,"SYNTHETIC, NOT A REAL MEASUREMENT");
});
$("link-clear").addEventListener("click",()=>{
  if(serialReading)return status("Disconnect serial before clearing.",true);
  $("link-file").value="";
  resetCollection();status("Session cleared. No data uploaded.");
});
$("link-receipt").addEventListener("click",()=>{
  if(!collection.header)return;
  download("powe-"+collection.header.session_id+"-unverified-receipt.json",
    JSON.stringify(observationReceipt(collection),null,2)+"\n","application/json");
  status("Local observation receipt saved. It is not cryptographically signed or instrument-authenticated.");
});
$("link-queue-trial").addEventListener("click",()=>{
  try{
    const getNum=id=>Number($(id).value);
    const row=buildBenchTrial(collection,{
      trial_id:$("link-trial").value.trim(),
      block_id:$("link-block").value.trim(),
      condition:$("link-condition").value,
      sequence:getNum("link-sequence"),
      geometry_id:$("link-geometry").value.trim(),
      task_set_id:$("link-tasks").value.trim(),
      separation_m:getNum("link-distance"),
      requested_tasks:getNum("link-requested"),
      completed_tasks:getNum("link-completed"),
      source_uncertainty_j:getNum("link-uncertainty-source"),
      receiver_uncertainty_j:getNum("link-uncertainty-receiver")
    });
    // Validate whole queued file through the Rung 3 schema.
    const prospective=[...queued,row];
    parseTrials(trialsToCsv(prospective));
    queued=prospective;
    status("Trial queued ("+queued.length+"). Export the BenchKit CSV when both arms are recorded.");
    render();
  }catch(e){status("Trial not queued: "+String(e.message||e),true);}
});
$("link-export").addEventListener("click",()=>{
  if(!queued.length)return;
  try{
    parseTrials(trialsToCsv(queued));
    download("powe-benchlink-reported-unverified-trials.csv",trialsToCsv(queued),"text/csv;charset=utf-8");
    status("BenchKit CSV saved with "+queued.length+" trial row(s). This is user-reported, unauthenticated data.");
  }catch(e){status("Export blocked: "+String(e.message||e),true);}
});
$("link-clear-queue").addEventListener("click",()=>{
  queued=[];render();status("Queued trials cleared from this browser tab.");
});

// Web Serial reads telemetry only. No port.writable calls and no control bytes.
// Opening a port can toggle USB serial modem lines on some devices: use only
// a separately reviewed, read-only telemetry gateway.
async function serialRead(port){
  let reader=null,buffer="";
  try{
    if(!port.readable)throw new Error("Port does not expose a readable stream");
    reader=port.readable.getReader();
    serialReader=reader;
    const decoder=new TextDecoder("utf-8",{fatal:true});
    while(!stopRequested){
      const {value,done}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      if(buffer.length>16384)throw new Error("Serial input buffer too large");
      let split;
      while((split=buffer.indexOf("\n"))!==-1){
        const line=buffer.slice(0,split).replace(/\r$/,"");
        buffer=buffer.slice(split+1);
        if(!line.trim())continue;
        if(new TextEncoder().encode(line).length>4096)throw new Error("Serial NDJSON frame too large");
        if(rawTranscript.length+line.length+1>MAX_TRANSCRIPT_BYTES)throw new Error("Serial session exceeds 2 MiB");
        ingestLine(collection,line);
        rawTranscript+=line+"\n";
        if(collection.faultCount>0){
          status("FAULT REPORTED. Telemetry reading stopped. Use the PHYSICAL kill switch; software cannot switch off electrical power.",true);
          stopRequested=true;break;
        }
        if(collection.ended){
          status("Serial end frame received. Session captured; readings are self-reported, not authenticated.");
          stopRequested=true;break;
        }
      }
      render();
    }
    if(!stopRequested&&buffer.trim())status("Serial connection closed with an incomplete last frame.",true);
  }catch(e){
    status("Serial read stopped: "+String(e.message||e)+". Check the physical apparatus independently.",true);
  }finally{
    try{reader?.releaseLock();}catch{}
    serialReader=null;
    try{await port.close();}catch{}
    if(serialPort===port)serialPort=null;
    serialReading=false;stopRequested=false;
    render();
  }
}
$("link-connect").addEventListener("click",async()=>{
  if(serialReading)return;
  if(!navigator.serial||!globalThis.isSecureContext){
    status("Web Serial requires a compatible browser on HTTPS or localhost. Import NDJSON instead.",true);
    return;
  }
  try{
    const port=await navigator.serial.requestPort();
    // Uses default 115200 for a read-only USB telemetry adapter only.
    await port.open({baudRate:115200});
    resetCollection();
    serialPort=port;serialReading=true;stopRequested=false;
    status("Listening to read-only serial telemetry at 115200 baud. This does not control or disable hardware.");
    render();
    void serialRead(port);
  }catch(e){
    status("Serial access unavailable/denied: "+String(e.message||e),true);
  }
});
$("link-disconnect").addEventListener("click",async()=>{
  if(!serialReading)return;
  stopRequested=true;
  try{await serialReader?.cancel();}catch{}
  status("Serial receiver disconnected. Incomplete sessions cannot be exported as completed trials. Hardware remains independently powered.");
});
window.addEventListener("pagehide",()=>{
  stopRequested=true;
  try{void serialReader?.cancel();}catch{}
});
render();
