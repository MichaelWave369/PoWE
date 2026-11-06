import {
  MAX_TRANSCRIPT_BYTES
} from "./benchlink.js";
import {
  SYNTHETIC_INPUTS,analyzeOpticalControls,opticalControlsReceipt
} from "./optical-controls.js";

const $=id=>document.getElementById(id);
const inputs={beforeTranscript:"",onTranscript:"",afterTranscript:""};
let lastReport=null;
const files=[
  ["controls-before","beforeTranscript","LED OFF (before)"],
  ["controls-on","onTranscript","LED ON"],
  ["controls-after","afterTranscript","LED OFF (after)"]
];
function message(text,error=false){
  $("controls-status").textContent=text;
  $("controls-status").classList.toggle("controls-error",error);
}
function span(tag,text,cls){
  const n=document.createElement(tag);
  if(text!==undefined)n.textContent=String(text);
  if(cls)n.className=cls;
  return n;
}
function fmtJ(j){
  if(typeof j!=="number")return "N/A";
  if(Math.abs(j)<0.001)return (j*1e6).toFixed(3)+" µJ";
  if(Math.abs(j)<1)return (j*1e3).toFixed(3)+" mJ";
  return j.toFixed(6)+" J";
}
function setResult(report){
  lastReport=report;
  $("controls-receipt").disabled=!report;
  const results=$("controls-metrics");
  results.replaceChildren();
  if(!report){
    results.append(span("p","No control analysis has been run.","controls-empty"));
    $("controls-signal").textContent="NOT ANALYZED";
    $("controls-provenance").textContent="NO INPUT";
    $("controls-warnings").textContent="No observations analyzed. This section does not control hardware.";
    return;
  }
  $("controls-signal").textContent=report.signalStatus.replaceAll("_"," ");
  $("controls-provenance").textContent=report.provenance.replaceAll("_"," ");
  const pairs=[
    ["LED ON SOURCE DC ENERGY",fmtJ(report.sourceEnergyJ.on)],
    ["LED ON PV ELECTRICAL ENERGY",fmtJ(report.receiverEnergyJ.on)],
    ["ESTIMATED BACKGROUND PV ENERGY",fmtJ(report.expectedAmbientContributionJ)],
    ["SIGNED LIGHT-ASSOCIATED PV DELTA",fmtJ(report.signedLightAssociatedReceiverDeltaJ)],
    ["COMBINED REPORTED UNCERTAINTY",fmtJ(report.combinedReportedReceiverUncertaintyJ)],
    ["LED OFF BACKGROUND DRIFT",report.driftRatio===null?"TOO CLOSE TO ZERO":(100*report.driftRatio).toFixed(2)+"%"]
  ];
  for(const [label,value] of pairs){
    const div=span("div",undefined,"controls-metric");
    div.append(span("small",label),span("strong",value));
    results.append(div);
  }
  $("controls-warnings").textContent=report.baselineDriftFlag
    ?"BASELINE DRIFT FLAGGED. The two LED-OFF control readings do not agree within the default threshold; review ambient conditions and repeat the experiment."
    :"Descriptive analysis only. LED state labels and instrument claims are unverified. The corrected electrical PV delta is NOT optical power, IEEE PoE delivery or measured full-system efficiency.";
}
function readForm(){
  const optId=id=>$(id).value.trim();
  function numericOptional(id){
    const v=optId(id);
    return v===""?null:Number(v);
  }
  const u={
    offBeforeReceiverJ:numericOptional("controls-u-before"),
    onReceiverJ:numericOptional("controls-u-on"),
    offAfterReceiverJ:numericOptional("controls-u-after"),
    onSourceJ:numericOptional("controls-u-source")
  };
  const present=Object.values(u).some(v=>v!==null);
  const uncertainties=present?u:undefined;
  return {
    ...inputs,geometryId:optId("controls-geometry"),loadId:optId("controls-load"),
    separationM:Number(optId("controls-distance")),uncertainties
  };
}
function resetAnalysis(){
  setResult(null);
  message("Inputs changed. Rerun analysis. Imported data stay in this browser tab only.");
}
for(const [inputId,key,label] of files){
  $(inputId).addEventListener("change",async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    inputs[key]="";
    resetAnalysis();
    if(file.size>MAX_TRANSCRIPT_BYTES){
      message(label+" rejected: NDJSON file exceeds 2 MiB.",true);
      return;
    }
    try{
      inputs[key]=await file.text();
      $(inputId+"-name").textContent=file.name+" ("+file.size+" bytes)";
      message(label+" loaded as an unverified local telemetry claim. Rerun analysis once all three are selected.");
    }catch(err){
      message("Unable to read "+label+": "+String(err.message||err),true);
    }
  });
}
$("controls-demo").addEventListener("click",()=>{
  for(const [id,key] of files){
    inputs[key]=SYNTHETIC_INPUTS[key];
    $(id).value="";
    $(id+"-name").textContent="SYNTHETIC DEMONSTRATION (NOT MEASURED)";
  }
  $("controls-geometry").value=SYNTHETIC_INPUTS.geometryId;
  $("controls-load").value=SYNTHETIC_INPUTS.loadId;
  $("controls-distance").value=String(SYNTHETIC_INPUTS.separationM);
  const u=SYNTHETIC_INPUTS.uncertainties;
  $("controls-u-before").value=u.offBeforeReceiverJ;
  $("controls-u-on").value=u.onReceiverJ;
  $("controls-u-after").value=u.offAfterReceiverJ;
  $("controls-u-source").value=u.onSourceJ;
  setResult(null);
  message("Loaded three SYNTHETIC FIXTURES. These voltages/currents are invented test inputs, not instrument observations.");
});
for(const id of [
  "controls-geometry","controls-load","controls-distance",
  "controls-u-before","controls-u-on","controls-u-after","controls-u-source"
]){
  $(id).addEventListener("input",resetAnalysis);
}
$("controls-run").addEventListener("click",()=>{
  try{
    if(files.some(([,key])=>!inputs[key]))throw Error("Import all three controls or load the synthetic demo.");
    const result=analyzeOpticalControls(readForm());
    setResult(result);
    message(result.provenance+": "+result.signalStatus.replaceAll("_"," ")+"; this is not independently verified hardware evidence.",
      result.baselineDriftFlag);
  }catch(err){
    setResult(null);
    message("ANALYSIS REJECTED: "+String(err.message||err),true);
  }
});
$("controls-receipt").addEventListener("click",async()=>{
  if(!lastReport)return;
  $("controls-receipt").disabled=true;
  try{
    const data=await opticalControlsReceipt(readForm());
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="PoWE-Optical-Controls-UNVERIFIED-Receipt.json";
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    message("Local control receipt saved with three SHA-256 hashes. Keep the original NDJSON files; hashes do not authenticate meters.");
  }catch(err){
    message("Receipt blocked: "+String(err.message||err),true);
  }finally{
    $("controls-receipt").disabled=!lastReport;
  }
});
$("controls-clear").addEventListener("click",()=>{
  for(const [id,key] of files){
    inputs[key]="";
    $(id).value="";
    $(id+"-name").textContent="No file selected";
  }
  for(const id of ["controls-u-before","controls-u-on","controls-u-after","controls-u-source"])$(id).value="";
  setResult(null);
  message("All local control files cleared. No observations have been uploaded.");
});
setResult(null);
