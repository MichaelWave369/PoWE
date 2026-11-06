// Rung 3: optical trial planning and claimed-measurement analysis; no hardware control.
export const COLUMNS=["trial_id","block_id","timestamp_utc","sequence","condition","kind","channel","apparatus_id","geometry_id","task_set_id","source_meter_id","receiver_meter_id","calibration_date","separation_m","duration_s","source_energy_j","receiver_energy_j","source_uncertainty_j","receiver_uncertainty_j","requested_tasks","completed_tasks","safety_state","notes"];
export const MAX_BYTES=524288,MAX_ROWS=1000;
const IDENT=/^[A-Za-z0-9._-]{1,64}$/;
const DEC=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DT=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/;
const DAY=/^(\d{4})-(\d{2})-(\d{2})$/;
function fail(message){throw new Error(message);}
function numeric(text,key,required=true,min=0,max=1e8){
 if(!text){if(required)fail(key+" required");return null;}
 if(!DEC.test(text))fail(key+" invalid decimal");
 const n=Number(text);
 if(!Number.isFinite(n)||n<min||n>max)fail(key+" out of bounds");
 return n;
}
function integer(text,key,min,max){
 const x=numeric(text,key,true,min,max);
 if(!Number.isSafeInteger(x))fail(key+" must be an integer");
 return x;
}
function validUtc(text){
 const m=DT.exec(text);
 if(!m)fail("timestamp_utc must end Z");
 const t=Date.parse(text),d=new Date(t);
 if(!Number.isFinite(t)||d.getUTCFullYear()!==+m[1]||d.getUTCMonth()+1!==+m[2]||d.getUTCDate()!==+m[3]||d.getUTCHours()!==+m[4]||d.getUTCMinutes()!==+m[5]||d.getUTCSeconds()!==+m[6])fail("impossible timestamp_utc");
 return t;
}
function validDay(text){
 const m=DAY.exec(text);
 if(!m)fail("calibration_date needs YYYY-MM-DD");
 const t=Date.parse(text+"T00:00:00Z"),d=new Date(t);
 if(!Number.isFinite(t)||d.getUTCFullYear()!==+m[1]||d.getUTCMonth()+1!==+m[2]||d.getUTCDate()!==+m[3])fail("invalid calibration_date");
 return t;
}
function csvRows(raw){
 if(typeof raw!=="string"||!raw||new TextEncoder().encode(raw).length>MAX_BYTES)fail("CSV empty or exceeds 512 KiB");
 const s=raw.charCodeAt(0)===0xfeff?raw.slice(1):raw;
 const rows=[];let row=[],cell="",state="start";
 function closeCell(){row.push(cell);cell="";state="start";if(row.length>COLUMNS.length)fail("Too many CSV columns");}
 function closeRow(){closeCell();if(!(row.length===1&&row[0]===""))rows.push(row);row=[];if(rows.length>MAX_ROWS+1)fail("CSV exceeds 1000 rows");}
 for(let i=0;i<s.length;i++){
  const ch=s[i];
  if(state==="quoted"){
   if(ch==='"'){if(s[i+1]==='"'){cell+='"';i++;}else state="afterQuote";}else cell+=ch;
  }else if(state==="afterQuote"){
   if(ch===",")closeCell();
   else if(ch==="\n"||ch==="\r"){closeRow();if(ch==="\r"&&s[i+1]==="\n")i++;}
   else if(ch!==" "&&ch!=="\t")fail("Characters after quoted CSV cell");
  }else if(ch===",")closeCell();
  else if(ch==="\n"||ch==="\r"){closeRow();if(ch==="\r"&&s[i+1]==="\n")i++;}
  else if(ch==='"'&&state==="start")state="quoted";
  else if(ch==='"')fail("Quote inside unquoted cell");
  else{cell+=ch;state="plain";}
  if(cell.length>512)fail("CSV cell too long");
 }
 if(state==="quoted")fail("Unclosed quoted CSV cell");
 if(row.length||cell.length||state!=="start")closeRow();
 return rows;
}
export function makePlan({projectId="powe-optical",seed=369,blocks=6,separationM=1,durationS=30}={}){
 if(!IDENT.test(projectId))fail("Invalid projectId");
 if(!Number.isSafeInteger(seed)||seed<1||seed>4294967295)fail("Seed must be positive uint32");
 if(!Number.isInteger(blocks)||blocks<1||blocks>40)fail("blocks must be 1-40");
 if(!Number.isFinite(separationM)||separationM<0.05||separationM>5)fail("separationM must be 0.05-5");
 if(!Number.isInteger(durationS)||durationS<5||durationS>3600)fail("durationS must be 5-3600 seconds");
 let x=seed>>>0; const next=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 const trials=[];
 for(let i=1;i<=blocks;i++){
  const blockId=projectId+"-b"+String(i).padStart(2,"0");
  const arms=next()<0.5?["fixed","adaptive"]:["adaptive","fixed"];
  for(let j=0;j<2;j++)trials.push({trial_id:blockId+"-"+arms[j],block_id:blockId,
   sequence:j+1,condition:arms[j],kind:"measured",channel:"optical",
   separation_m:separationM,duration_s:durationS,status:"PLANNED_NOT_RUN"});
 }
 return {schema:"powe-optical-plan-v1",projectId,seed,blocks,separationM,durationS,
  status:"PLANNED_NOT_RUN",trials};
}
export function csvTemplate(plan){
 if(!plan||plan.schema!=="powe-optical-plan-v1")fail("Invalid plan");
 const head=COLUMNS.join(",");const rows=[head];
 for(const trial of plan.trials){
  const fields={...trial,safety_state:"unknown"};
  rows.push(COLUMNS.map(key=>String(fields[key]??"")).join(","));
 }
 return rows.join("\r\n")+"\r\n";
}
export function parseTrials(csv,{nowMs=Date.now()}={}){
 if(!Number.isFinite(nowMs))fail("Invalid clock");
 const rows=csvRows(csv);
 if(rows.length<2)fail("CSV requires header and data");
 const keys=rows[0].map(s=>s.trim());
 if(new Set(keys).size!==keys.length)fail("Duplicate header");
 if(keys.length!==COLUMNS.length||keys.some(k=>!COLUMNS.includes(k)))fail("Missing or unknown CSV columns");
 const ids=new Set(),pairs=new Set(),results=[];
 for(let i=1;i<rows.length;i++){
  if(rows[i].length!==keys.length)fail("Row "+(i+1)+": column count mismatch");
  const r=Object.fromEntries(keys.map((key,j)=>[key,rows[i][j].trim()]));
  for(const key of ["trial_id","block_id","apparatus_id","geometry_id","task_set_id"]){
   if(!IDENT.test(r[key]))fail("Row "+(i+1)+": invalid "+key);
  }
  if(ids.has(r.trial_id))fail("Duplicate trial_id");
  ids.add(r.trial_id);
  if(!["fixed","adaptive"].includes(r.condition))fail("Invalid condition");
  if(!["measured","simulated"].includes(r.kind))fail("Invalid kind");
  if(r.channel!=="optical")fail("Optical channel only");
  const pairKey=r.kind+"|"+r.block_id+"|"+r.condition;
  if(pairs.has(pairKey))fail("Duplicate block/condition");pairs.add(pairKey);
  const t=validUtc(r.timestamp_utc);
  if(t>nowMs+60000)fail("Future timestamp");
  const values={
   sequence:integer(r.sequence,"sequence",1,2),
   separation_m:numeric(r.separation_m,"separation_m",true,0.05,5),
   duration_s:numeric(r.duration_s,"duration_s",true,5,3600),
   source_energy_j:numeric(r.source_energy_j,"source_energy_j",true,1e-9),
   receiver_energy_j:numeric(r.receiver_energy_j,"receiver_energy_j"),
   source_uncertainty_j:numeric(r.source_uncertainty_j,"source_uncertainty_j",r.kind==="measured",r.kind==="measured"?1e-12:0),
   receiver_uncertainty_j:numeric(r.receiver_uncertainty_j,"receiver_uncertainty_j",r.kind==="measured",r.kind==="measured"?1e-12:0),
   requested_tasks:integer(r.requested_tasks,"requested_tasks",1,100000),
   completed_tasks:integer(r.completed_tasks,"completed_tasks",0,100000)
  };
  if(values.completed_tasks>values.requested_tasks)fail("Completed tasks exceed requested tasks");
  if(!["ok","unknown","fault","not_applicable"].includes(r.safety_state))fail("Invalid safety_state");
  if(r.notes.length>160)fail("Notes too long");
  if(r.kind==="measured"){
   if(!IDENT.test(r.source_meter_id)||!IDENT.test(r.receiver_meter_id))fail("Reported measurement requires two instrument IDs");
   if(r.safety_state==="not_applicable")fail("Reported measurement needs a safety flag");
   if(validDay(r.calibration_date)>t)fail("Calibration date after observation");
  }else if(r.source_meter_id||r.receiver_meter_id||r.calibration_date||r.safety_state!=="not_applicable"){
   fail("Simulated row cannot claim instrument provenance or hardware safety");
  }
  results.push(Object.freeze({...r,...values}));
 }
 return Object.freeze(results);
}
export function analyzeTrials(rows){
 if(!Array.isArray(rows))throw new TypeError("Expected row array");
 const result={reportedMeasured:[],simulated:[],excluded:[],totalRows:rows.length};
 for(const kind of ["measured","simulated"]){
  const buckets=new Map();
  for(const row of rows.filter(r=>r.kind===kind)){
   if(!buckets.has(row.block_id))buckets.set(row.block_id,[]);
   buckets.get(row.block_id).push(row);
  }
  for(const [blockId,items] of buckets){
   if(items.length!==2||new Set(items.map(r=>r.condition)).size!==2){
    result.excluded.push({kind,blockId,reason:"Incomplete pair"});continue;
   }
   const fixed=items.find(r=>r.condition==="fixed"),adaptive=items.find(r=>r.condition==="adaptive");
   const fields=["kind","channel","apparatus_id","geometry_id","task_set_id","separation_m",
     "duration_s","requested_tasks","source_meter_id","receiver_meter_id","calibration_date"];
   if(!fields.every(k=>fixed[k]===adaptive[k])||fixed.sequence===adaptive.sequence){
    result.excluded.push({kind,blockId,reason:"Setup, meter, requested work or sequence mismatch"});continue;
   }
   if(kind==="measured"&&[fixed,adaptive].some(r=>r.safety_state!=="ok")){
    result.excluded.push({kind,blockId,reason:"Reported safety fault or unconfirmed state"});continue;
   }
   result[kind==="measured"?"reportedMeasured":"simulated"].push({blockId,fixed,adaptive});
  }
 }
 const aggregate=pairs=>{
  const fixed={sourceJ:0,receiverJ:0,completed:0,requested:0};
  const adaptive={sourceJ:0,receiverJ:0,completed:0,requested:0};
  for(const pair of pairs)for(const label of ["fixed","adaptive"]){
   const r=pair[label],a=label==="fixed"?fixed:adaptive;
   a.sourceJ+=r.source_energy_j;a.receiverJ+=r.receiver_energy_j;
   a.completed+=r.completed_tasks;a.requested+=r.requested_tasks;
  }
  for(const a of [fixed,adaptive]){
   a.tasksPerSourceJ=a.sourceJ? a.completed/a.sourceJ:null;
   a.sourceJPerTask=a.completed?a.sourceJ/a.completed:null;
   a.deliveryFraction=a.requested?a.completed/a.requested:null;
  }
  return {pairs:pairs.length,fixed,adaptive,
   changePct:fixed.tasksPerSourceJ?100*(adaptive.tasksPerSourceJ/fixed.tasksPerSourceJ-1):null};
 };
 return {...result,reportedMeasuredSummary:aggregate(result.reportedMeasured),
  simulatedSummary:aggregate(result.simulated)};
}
export const DEMO_CSV=[
 COLUMNS.join(","),
 "s1,b1,2026-10-10T12:00:00Z,1,fixed,simulated,optical,demo,geometry,tasks,,,,1,30,8,0.02,,,12,7,not_applicable,Synthetic only",
 "s2,b1,2026-10-10T12:01:00Z,2,adaptive,simulated,optical,demo,geometry,tasks,,,,1,30,8,0.02,,,12,9,not_applicable,Synthetic only",
 "s3,b2,2026-10-10T12:05:00Z,1,adaptive,simulated,optical,demo,geometry,tasks,,,,1,30,8,0.02,,,12,8,not_applicable,Synthetic only",
 "s4,b2,2026-10-10T12:06:00Z,2,fixed,simulated,optical,demo,geometry,tasks,,,,1,30,8,0.02,,,12,6,not_applicable,Synthetic only"
].join("\n");
