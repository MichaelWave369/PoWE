import {CHECKLIST_ITEMS,getFixtures,runConformance,assessOperatorChecklist,createConformanceReceipt} from "./commissioning.js";

const $=id=>document.getElementById(id);
const selectedIds=new Set();
const downloadable=getFixtures().filter(f=>f.downloadable);
let lastReport=null;
function node(tag,text,className){
  const el=document.createElement(tag);
  if(text!==undefined)el.textContent=String(text);
  if(className)el.className=className;
  return el;
}
function message(text,error=false){
  $("commission-status").textContent=text;
  $("commission-status").classList.toggle("commission-error",error);
}
function download(name,text,type){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function updateChecklist(){
  const result=assessOperatorChecklist([...selectedIds]);
  $("commission-marked").textContent=result.marked+" / "+result.total;
  $("commission-checklist-state").textContent=result.selfAttestedComplete
    ?"SELF-ATTESTED ONLY / NOT INSPECTED"
    :"NOT COMPLETE / "+result.missing.length+" MISSING";
}
for(const criterion of CHECKLIST_ITEMS){
  const label=node("label",undefined,"commission-check");
  const check=document.createElement("input");check.type="checkbox";
  check.addEventListener("change",()=>{
    if(check.checked)selectedIds.add(criterion.id);
    else selectedIds.delete(criterion.id);
    updateChecklist();
  });
  label.append(check,node("span",criterion.label));
  $("commission-checklist").append(label);
}
updateChecklist();
for(const fixture of downloadable){
  const option=node("option",fixture.name);
  option.value=fixture.id;
  $("commission-fixture").append(option);
}
function render(report){
  $("commission-passed").textContent=report.passed+" / "+report.total;
  $("commission-hardware").textContent="NOT VALIDATED";
  const body=$("commission-rows");body.replaceChildren();
  for(const caseResult of report.results){
    const row=node("tr");
    row.append(node("td",caseResult.name),node("td",caseResult.expected),
      node("td",caseResult.actual),
      node("td",caseResult.passed?"PASS":"FAIL",caseResult.passed?"commission-pass":"commission-fail"));
    body.append(row);
  }
  $("commission-receipt").disabled=!report.allPassed;
  message(report.allPassed
    ?"All synthetic parser checks passed. No actual devices, meters, calibration, electrical safety or physical power transfer were tested."
    :"Synthetic conformance failed. Do not rely on this ingestion pipeline for research claims.",!report.allPassed);
}
$("commission-run").addEventListener("click",()=>{
  try{lastReport=runConformance();render(lastReport);}
  catch(e){lastReport=null;$("commission-receipt").disabled=true;message("Harness error: "+String(e.message||e),true);}
});
$("commission-download").addEventListener("click",()=>{
  const f=downloadable.find(f=>f.id===$("commission-fixture").value);
  if(!f)return message("Choose a synthetic fixture.",true);
  download("PoWE-SYNTHETIC-"+f.id+".ndjson",f.ndjson,"application/x-ndjson;charset=utf-8");
  message("Synthetic fixture downloaded. It is NOT a physical instrument recording.");
});
$("commission-receipt").addEventListener("click",async()=>{
  if(!lastReport?.allPassed)return;
  $("commission-receipt").disabled=true;
  try{
    const receipt=await createConformanceReceipt({checklistIds:[...selectedIds]});
    if(!receipt.report.allPassed)throw Error("Conformance checks no longer pass");
    download("PoWE-SYNTHETIC-commissioning-receipt.json",
      JSON.stringify(receipt,null,2)+"\n","application/json;charset=utf-8");
    message("Local SHA-256 audit saved. Hashes check fixture bytes, not physical instruments or permission to energize.");
  }catch(e){message("Receipt error: "+String(e.message||e),true);}
  finally{$("commission-receipt").disabled=false;}
});
$("commission-clear").addEventListener("click",()=>{
  lastReport=null;$("commission-passed").textContent="Not run";
  $("commission-rows").replaceChildren();
  $("commission-receipt").disabled=true;
  message("Synthetic conformance results cleared from this page.");
});
