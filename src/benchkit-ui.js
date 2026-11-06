import {makePlan,csvTemplate,parseTrials,analyzeTrials,DEMO_CSV,MAX_BYTES} from "./benchkit.js";
const $=id=>document.getElementById(id);
let plan=null, trials=[];
function item(tag,value,css){
 const el=document.createElement(tag);
 if(value!==undefined)el.textContent=String(value);
 if(css)el.className=css;
 return el;
}
function status(message,isError=false){
 $("bench-status").textContent=message;
 $("bench-status").classList.toggle("bench-error",isError);
}
function download(name,text,mime){
 const blob=new Blob([text],{type:mime});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("bench-create").addEventListener("click",()=>{
 try{
  plan=makePlan({
   projectId:$("bench-project").value.trim(),
   seed:Number($("bench-seed").value),
   blocks:Number($("bench-blocks").value),
   separationM:Number($("bench-distance").value),
   durationS:Number($("bench-duration").value)
  });
  $("bench-plan").textContent=JSON.stringify(plan,null,2);
  $("bench-json").disabled=false;
  $("bench-template").disabled=false;
  status("Reproducible random-order plan created: "+plan.trials.length+
   " trials in "+plan.blocks+" pairs. All are PLANNED, not performed.");
 }catch(e){
  plan=null;$("bench-plan").textContent="";
  $("bench-json").disabled=true;$("bench-template").disabled=true;
  status("Invalid plan: "+String(e.message||e),true);
 }
});
$("bench-json").addEventListener("click",()=>{
 if(plan)download(plan.projectId+"-bench-plan.json",JSON.stringify(plan,null,2)+"\n","application/json");
});
$("bench-template").addEventListener("click",()=>{
 if(plan)download(plan.projectId+"-bench-empty-results.csv",csvTemplate(plan),"text/csv;charset=utf-8");
});
function wattJ(v){return Number(v).toLocaleString(undefined,{maximumFractionDigits:4})+" J";}
function displayAnalysis(){
 const analysis=analyzeTrials(trials);
 $("bench-count").textContent=String(analysis.totalRows);
 $("bench-measured-count").textContent=String(trials.filter(x=>x.kind==="measured").length);
 $("bench-synthetic-count").textContent=String(trials.filter(x=>x.kind==="simulated").length);
 $("bench-exclusions").textContent=String(analysis.excluded.length);
 const root=$("bench-results");root.replaceChildren();
 for(const [kind,summary] of [
  ["Reported measured (not independently verified)",analysis.reportedMeasuredSummary],
  ["Simulated (synthetic)",analysis.simulatedSummary]
 ]){
  const group=item("article",undefined,"bench-result");
  group.append(item("small",kind.toUpperCase()),item("h3",summary.pairs+" included paired block(s)"));
  if(!summary.pairs){
   group.append(item("p","No complete, matching, eligible pairs in this provenance category."));
  }else{
   const fields=[
    ["Fixed completed",summary.fixed.completed+" / "+summary.fixed.requested],
    ["Adaptive completed",summary.adaptive.completed+" / "+summary.adaptive.requested],
    ["Fixed source energy",wattJ(summary.fixed.sourceJ)],
    ["Adaptive source energy",wattJ(summary.adaptive.sourceJ)],
    ["Fixed tasks/source joule",summary.fixed.tasksPerSourceJ.toFixed(5)],
    ["Adaptive tasks/source joule",summary.adaptive.tasksPerSourceJ.toFixed(5)],
    ["Relative difference",summary.changePct===null?"N/A (zero baseline)":summary.changePct.toFixed(2)+"%"]
   ];
   const details=item("dl",undefined,"bench-results-list");
   for(const [k,v] of fields)details.append(item("dt",k),item("dd",v));
   group.append(details);
  }
  root.append(group);
 }
 const excluded=$("bench-excluded");excluded.replaceChildren();
 if(analysis.excluded.length){
  excluded.append(item("h4","Excluded pairs (not hidden)"));
  for(const entry of analysis.excluded.slice(0,30)){
   excluded.append(item("p",entry.kind+" / "+entry.blockId+": "+entry.reason));
  }
 }else excluded.append(item("p",trials.length?"No incomplete or mismatched pairs.":"No imported trial data."));
}
function load(raw,label){
 try{
  trials=parseTrials(raw);
  status(label+": "+trials.length+
   " reported trial rows accepted. Imported measured labels are self-reported, NEVER authenticated.");
 }catch(e){
  trials=[];status("Import rejected: "+String(e.message||e)+". Previous imported data cleared.",true);
 }
 displayAnalysis();
}
$("bench-demo").addEventListener("click",()=>{
 $("bench-csv").value="";
 load(DEMO_CSV,"SYNTHETIC DEMONSTRATION ONLY");
});
$("bench-csv").addEventListener("change",async event=>{
 const f=event.target.files?.[0];if(!f)return;
 if(f.size>MAX_BYTES){trials=[];displayAnalysis();status("File exceeds 512 KiB.",true);return;}
 try{load(await f.text(),f.name);}
 catch(e){trials=[];displayAnalysis();status("Could not read file: "+String(e.message||e),true);}
});
$("bench-clear").addEventListener("click",()=>{
 trials=[];$("bench-csv").value="";
 status("Imported data cleared. No results are retained or uploaded.");
 displayAnalysis();
});
displayAnalysis();
