import {
  createScenario,comparePolicies,checkLightBridgeReceipts,SYNTHETIC_RECEIPTS
} from "./bridge-lab.js";

const $=id=>document.getElementById(id);
let comparison=null,scenario=null,sender=null,receiver=null,receiptResult=null;
const rawStatus=(id,message,bad=false)=>{
  $(id).textContent=message;
  $(id).classList.toggle("bridge-bad",bad);
};
function create(tag,content,cls){
  const element=document.createElement(tag);
  if(content!==undefined)element.textContent=String(content);
  if(cls)element.className=cls;
  return element;
}
function download(fileName,data){
  const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=fileName;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function metric(parent,label,value){
  const block=create("div",undefined,"bridge-metric");
  block.append(create("small",label),create("strong",value));
  parent.append(block);
}
function displayComparison(){
  const root=$("bridge-comparison");
  root.replaceChildren();
  if(!comparison){
    root.append(create("p","Run the shared-trace simulation to compare scheduling policies. The result is not measured throughput or hardware efficiency.","bridge-placeholder"));
    $("bridge-download").disabled=true;
    return;
  }
  for(const r of [comparison.fixed,comparison.adaptive]){
    const card=create("article",undefined,"bridge-policy");
    card.append(create("small",r.policy.toUpperCase()+" / SYNTHETIC"));
    card.append(create("h3",r.successful+" of "+r.taskCount+" work units delivered"));
    const bar=create("div",undefined,"bridge-bar");
    const filled=create("span");
    filled.style.width=(r.deliveryFraction*100).toFixed(1)+"%";
    bar.append(filled);
    card.append(bar);
    const grid=create("div",undefined,"bridge-policy-stats");
    metric(grid,"SOURCE DC ELECTRICAL INPUT",r.sourceDcJ.toFixed(3)+" J");
    metric(grid,"RECEIVER HARVESTED DC",r.harvestedReceiverJ.toFixed(3)+" J");
    metric(grid,"RECEIVER SEND ATTEMPTS",r.attempts);
    metric(grid,"TASKS / SOURCE DC JOULE",r.tasksPerSourceDcJ===null?"N/A":r.tasksPerSourceDcJ.toFixed(3));
    metric(grid,"SPILLED RECEIVER ENERGY",r.spilledJ.toFixed(4)+" J");
    metric(grid,"ENERGY LEDGER ERROR",r.conservationErrorJ.toExponential(2)+" J");
    card.append(grid);
    root.append(card);
  }
  $("bridge-download").disabled=false;
  const diff=comparison.relativeChangePct;
  const change=diff===null?"N/A (zero fixed baseline)":diff.toFixed(2)+"%";
  rawStatus("bridge-run-status",
    "SYNTHETIC comparison completed. Adaptive versus fixed change: "+change+
    ". Both use the same source DC input, receiver energy trace and link-quality trace. No real LightBridge transfer or energy savings verified.");
}
$("bridge-run").addEventListener("click",()=>{
  try{
    scenario=createScenario({
      seed:Number($("bridge-seed").value),
      durationS:Number($("bridge-horizon").value),
      taskIntervalS:Number($("bridge-interval").value),
      taskTtlS:Number($("bridge-deadline").value),
      sourceDcW:Number($("bridge-source").value),
      receiverIdleW:Number($("bridge-idle").value),
      frameCostJ:Number($("bridge-cost").value),
      minimumAttemptSpacingS:Number($("bridge-spacing").value)
    });
    comparison=comparePolicies(scenario);
    displayComparison();
  }catch(e){
    comparison=null;scenario=null;
    displayComparison();
    rawStatus("bridge-run-status","Simulation blocked: "+String(e.message||e),true);
  }
});
$("bridge-download").addEventListener("click",()=>{
  if(!comparison||!scenario)return;
  download("PoWE-R8-SYNTHETIC-comparison.json",{
    schema:"powe-rung8-synthetic-comparison-receipt-v1",
    ...comparison,scenario,
    physicalMeasurementsPresent:false,
    identityAndConsentVerified:false,
    trustBoundary:"No actual optical PLB1 transfer performed or verified"
  });
  rawStatus("bridge-run-status","Synthetic scenario and paired results exported locally. No optical hardware or original PLB1 bytes were involved.");
});
function displayReceipts(){
  const root=$("bridge-receipt-issues");root.replaceChildren();
  if(!receiptResult){
    root.append(create("p","Select two local receipts or load the deliberately fabricated example."));
    $("bridge-receipt-result").textContent="NOT CHECKED";
    return;
  }
  $("bridge-receipt-result").textContent=receiptResult.fieldsConsistent
    ?"FIELDS CONSISTENT / UNVERIFIED":"MISMATCH / REJECTED";
  const explanations=receiptResult.issues.length
    ?receiptResult.issues
    :["These two self-reported receipt files have consistent fields. No sender signature, real optical capture, recipient consent or transferred file bytes were verified."];
  for(const issue of explanations)root.append(create("p",issue));
}
for(const [id,side] of [["bridge-sender","sender"],["bridge-receiver","receiver"]]){
  $(id).addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    if(side==="sender")sender=null;else receiver=null;
    receiptResult=null;displayReceipts();
    $(id+"-name").textContent="No receipt loaded";
    if(file.size>65536){
      rawStatus("bridge-receipt-status","Receipt rejected: maximum file size is 64 KiB.",true);return;
    }
    try{
      const value=JSON.parse(await file.text());
      if(!value||typeof value!=="object"||Array.isArray(value))throw Error("JSON object required");
      if(side==="sender")sender=value;else receiver=value;
      $(id+"-name").textContent=file.name;
      rawStatus("bridge-receipt-status",
        "Local "+side+" receipt imported. Receipt contents remain unverified until paired and checked.");
    }catch(e){
      rawStatus("bridge-receipt-status","Receipt import rejected: "+String(e.message||e),true);
    }
  });
}
$("bridge-receipt-demo").addEventListener("click",()=>{
  sender={...SYNTHETIC_RECEIPTS.sender};
  receiver={...SYNTHETIC_RECEIPTS.receiver};
  for(const id of ["bridge-sender","bridge-receiver"]){
    $(id).value="";
    $(id+"-name").textContent="FABRICATED SYNTHETIC EXAMPLE";
  }
  receiptResult=null;displayReceipts();
  rawStatus("bridge-receipt-status","Loaded deliberately FABRICATED sender and receiver receipts. No optical transfer occurred.");
});
$("bridge-receipt-check").addEventListener("click",()=>{
  receiptResult=checkLightBridgeReceipts(sender,receiver);
  displayReceipts();
  rawStatus("bridge-receipt-status",receiptResult.fieldsConsistent
    ?"Receipt FIELDS MATCH. Identity, transfer, confidentiality and consent remain unverified."
    :"Receipt mismatch: "+receiptResult.issues.join("; "),!receiptResult.fieldsConsistent);
});
$("bridge-receipt-clear").addEventListener("click",()=>{
  sender=null;receiver=null;receiptResult=null;
  for(const id of ["bridge-sender","bridge-receiver"]){
    $(id).value="";$(id+"-name").textContent="No receipt selected";
  }
  displayReceipts();
  rawStatus("bridge-receipt-status","Receipt files cleared from this tab.");
});
displayComparison();displayReceipts();
