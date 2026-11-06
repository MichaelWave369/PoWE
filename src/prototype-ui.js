import {createPrototype,evaluatePrototype,commissioningTemplate,billOfMaterialsTemplate} from "./prototype.js";
const $=id=>document.getElementById(id);
let design=createPrototype();
function numberField(id){return Number($(id).value);}
function labelNode(tag,text,cls){
 const n=document.createElement(tag);
 if(text!==undefined)n.textContent=String(text);
 if(cls)n.className=cls;
 return n;
}
function download(name,object){
 const data=JSON.stringify(object,null,2)+"\n";
 const url=URL.createObjectURL(new Blob([data],{type:"application/json;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download=name;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function pullControls(){
 design=createPrototype({
  source:{supplyVoltageV:numberField("mk1-v"),supplyCurrentLimitA:numberField("mk1-a")},
  receiver:{candidateVocV:numberField("mk1-pv-voc")},
  metrology:{
   targetReceiverCurrentUa:numberField("mk1-target"),
   requiredReceiverCurrentResolutionUa:numberField("mk1-resolution"),
   samplePeriodMs:numberField("mk1-sample"),
   maxClockSkewMs:numberField("mk1-skew"),
   sourceInstrument:$("mk1-source-meter").value.trim(),
   receiverInstrument:$("mk1-receiver-meter").value.trim()
  },
  geometry:{minimumDistanceM:numberField("mk1-min-distance"),
    maximumDistanceM:numberField("mk1-max-distance")}
 });
}
function listItems(root,values,css){
 root.replaceChildren();
 if(values.length===0){
  root.append(labelNode("p","No structural problems detected. THIS IS NOT HARDWARE APPROVAL."));
 } else for(const issue of values){
  const p=labelNode("p",typeof issue==="string"?issue:issue.code+": "+issue.message,css);
  root.append(p);
 }
}
function render(){
 const report=evaluatePrototype(design);
 $("mk1-design-status").textContent=report.structuralStatus.replaceAll("_"," ");
 $("mk1-source-power").textContent=report.theoreticalInputCeilingW===null?"N/A":report.theoreticalInputCeilingW.toFixed(2)+" W";
 $("mk1-hardware-status").textContent="NOT VALIDATED";
 $("mk1-authorization").textContent="NOT AUTHORIZED";
 $("mk1-error-count").textContent=String(report.errors.length);
 $("mk1-pending-count").textContent=String(report.pending.length);
 listItems($("mk1-errors"),report.errors,"mk1-issue");
 listItems($("mk1-pending"),report.pending,"mk1-pending");
 $("mk1-explain").textContent=report.structuralStatus==="DESIGN_CONSTRAINTS_PASSED"
   ?"All coded planning constraints satisfied. Actual components, isolation, meter calibration, optical output and safety are UNVERIFIED."
   :"One or more planning constraints failed. Fix the design before reviewing physical hardware.";
 $("mk1-design-status").classList.toggle("mk1-bad",report.errors.length>0);
}
for(const id of [
 "mk1-v","mk1-a","mk1-pv-voc","mk1-target","mk1-resolution",
 "mk1-sample","mk1-skew","mk1-source-meter","mk1-receiver-meter",
 "mk1-min-distance","mk1-max-distance"
]){
 $(id).addEventListener("input",()=>{pullControls();render();});
}
$("mk1-reset").addEventListener("click",()=>{
 design=createPrototype();
 const values={
  "mk1-v":design.source.supplyVoltageV,"mk1-a":design.source.supplyCurrentLimitA,
  "mk1-pv-voc":design.receiver.candidateVocV,
  "mk1-target":design.metrology.targetReceiverCurrentUa,
  "mk1-resolution":design.metrology.requiredReceiverCurrentResolutionUa,
  "mk1-sample":design.metrology.samplePeriodMs,
  "mk1-skew":design.metrology.maxClockSkewMs,
  "mk1-source-meter":design.metrology.sourceInstrument,
  "mk1-receiver-meter":design.metrology.receiverInstrument,
  "mk1-min-distance":design.geometry.minimumDistanceM,
  "mk1-max-distance":design.geometry.maximumDistanceM
 };
 for(const [id,val] of Object.entries(values)) $(id).value=String(val);
 render();
});
$("mk1-manifest").addEventListener("click",()=>{
 download("PoWE-MK1-DESIGN-ONLY.json",{
  ...design,evaluation:evaluatePrototype(design),
  notice:"DRAFT DESIGN ONLY; NOT AN ASSEMBLY CERTIFICATION, SAFETY APPROVAL OR MEASUREMENT"
 });
});
$("mk1-bom").addEventListener("click",()=>{
 download("PoWE-MK1-BOM-CANDIDATES.json",billOfMaterialsTemplate(design));
});
$("mk1-acceptance").addEventListener("click",()=>{
 download("PoWE-MK1-TESTS-NOT-PERFORMED.json",commissioningTemplate(design));
});
render();
