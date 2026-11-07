// PoWE Rung 8 / LightBridge coordination laboratory.
// All sources, receiver energy and transport outcomes are SYNTHETIC.
// No real optical power, PLB1 payload transfer, identity trust or electrical control.
export const LAB_SCHEMA = "powe-bridge-coordination-v1";
export const MAX_SECONDS = 600;
const safeNumber=(v,min,max)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
const safeInteger=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const idOk=x=>typeof x==="string"&&/^[A-Za-z0-9._-]{1,64}$/.test(x);
function fail(message){throw new Error(message);}

export function createScenario({
  seed=369, durationS=120, taskIntervalS=6, taskTtlS=18,
  sourceDcW=0.12, receiverIdleW=0.0004, frameCostJ=0.02,
  storageCapacityJ=0.065, initialStorageJ=0.025,
  minimumAttemptSpacingS=7, fixedSlotPhaseS=0
}={}){
  if(!safeInteger(seed,1,4294967295))fail("seed must be a positive uint32");
  if(!safeInteger(durationS,15,MAX_SECONDS))fail("durationS must be 15-600");
  if(!safeInteger(taskIntervalS,1,60))fail("taskIntervalS must be 1-60");
  if(!safeInteger(taskTtlS,1,120))fail("taskTtlS must be 1-120");
  if(!safeNumber(sourceDcW,0,2.5))fail("sourceDcW must be 0-2.5");
  if(!safeNumber(receiverIdleW,0,1))fail("receiverIdleW must be 0-1");
  if(!safeNumber(frameCostJ,0.000001,1))fail("frameCostJ must be positive");
  if(!safeNumber(storageCapacityJ,0.000001,10))fail("storageCapacityJ must be positive");
  if(!safeNumber(initialStorageJ,0,storageCapacityJ))fail("initialStorageJ outside capacity");
  if(!safeInteger(minimumAttemptSpacingS,1,60))fail("minimumAttemptSpacingS must be 1-60");
  if(!safeInteger(fixedSlotPhaseS,0,minimumAttemptSpacingS-1))fail("fixedSlotPhaseS outside period");

  let x=seed>>>0;
  const next=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
  const trace=[];
  for(let second=0;second<durationS;second++){
    // Synthetic illumination periods, NOT real meter records.
    const burst=(second%14)<5;
    const ambientReceiverJ=0.0002;
    // Hypothetical fraction of this tick's source electrical DC input.
    // Never larger than the source input; no real light conversion claim.
    const sourceLinkedReceiverJ=sourceDcW*(burst?0.08:0.004);
    trace.push(Object.freeze({
      second,
      sourceDcJ:sourceDcW,
      ambientReceiverJ,sourceLinkedReceiverJ,
      harvestedReceiverJ:ambientReceiverJ+sourceLinkedReceiverJ,
      // Link-quality draws are shared across both policies at the same second.
      // Not PLB1 packet reception and not a physical camera observation.
      linkOk:next()>=0.12
    }));
  }
  const tasks=[];
  for(let time=0;time<durationS;time+=taskIntervalS){
    tasks.push(Object.freeze({
      id:"unit-"+String(tasks.length+1).padStart(3,"0"),
      arrivalS:time,deadlineS:time+taskTtlS,
      // Synthetic unit of work, not a real QR-encoded byte sequence.
      claimedTransport:"mock-plb1-work-unit"
    }));
  }
  return Object.freeze({
    schema:LAB_SCHEMA,seed,durationS,minimumAttemptSpacingS,fixedSlotPhaseS,
    initialStorageJ,storageCapacityJ,receiverIdleW,frameCostJ,
    sourceBoundary:"SIMULATED_LED_DC_ELECTRICAL_INPUT_NOT_WALL_PLUG",
    receiverBoundary:"SIMULATED_RECEIVER_HARVESTED_DC",
    transport:"MOCK_ONLY_NOT_LIGHTBRIDGE_RUNTIME",
    tasks:Object.freeze(tasks),trace:Object.freeze(trace)
  });
}
export function validateScenario(x){
  if(!x||x.schema!==LAB_SCHEMA||x.transport!=="MOCK_ONLY_NOT_LIGHTBRIDGE_RUNTIME")fail("Invalid or non-synthetic scenario");
  if(!safeInteger(x.durationS,15,MAX_SECONDS)||
     !safeInteger(x.minimumAttemptSpacingS,1,60)||
     !safeInteger(x.fixedSlotPhaseS,0,x.minimumAttemptSpacingS-1))fail("Invalid scheduling window");
  if(!safeNumber(x.initialStorageJ,0,10)||
     !safeNumber(x.storageCapacityJ,0.000001,10)||
     x.initialStorageJ>x.storageCapacityJ||
     !safeNumber(x.receiverIdleW,0,1)||
     !safeNumber(x.frameCostJ,0.000001,1))fail("Invalid receiver energy budget");
  if(!Array.isArray(x.trace)||x.trace.length!==x.durationS)fail("Trace must have one second per step");
  for(let t=0;t<x.trace.length;t++){
    const record=x.trace[t];
    if(!record||record.second!==t||!safeNumber(record.sourceDcJ,0,2.5)||
       !safeNumber(record.harvestedReceiverJ,0,1)||
       !safeNumber(record.ambientReceiverJ,0,1)||
       !safeNumber(record.sourceLinkedReceiverJ,0,1)||
       record.sourceLinkedReceiverJ>record.sourceDcJ+1e-12||
       Math.abs(record.ambientReceiverJ+record.sourceLinkedReceiverJ-record.harvestedReceiverJ)>1e-10||
       typeof record.linkOk!=="boolean"){
      fail("Invalid synthetic trace at second "+t);
    }
  }
  if(!Array.isArray(x.tasks)||x.tasks.length<1||x.tasks.length>MAX_SECONDS)fail("Invalid task count");
  const ids=new Set();
  for(const task of x.tasks){
    if(!idOk(task?.id)||ids.has(task.id))fail("Duplicate/invalid task id");
    ids.add(task.id);
    if(!safeInteger(task.arrivalS,0,x.durationS-1)||
       !safeInteger(task.deadlineS,task.arrivalS+1,x.durationS+120)||
       task.claimedTransport!=="mock-plb1-work-unit")fail("Invalid synthetic task");
  }
  return x;
}
function num(n){return Math.abs(n)<1e-12?0:n;}
export function simulatePolicy(scenario,policy){
  const x=validateScenario(scenario);
  if(policy!=="fixed"&&policy!=="adaptive")fail("Unknown policy");
  let stored=x.initialStorageJ;
  let harvested=0,sourceLinkedHarvestJ=0,ambientHarvestJ=0;
  let idleSpent=0,attemptSpent=0,spilled=0,sourceDcJ=0;
  let attempts=0,successful=0,failed=0,deferred=0,brownouts=0;
  let lastAttemptS=-x.minimumAttemptSpacingS;
  const tasks=x.tasks.map(t=>({...t,state:"pending",attempts:0,deliveredAt:null}));
  const events=[];
  for(let second=0;second<x.durationS;second++){
    const tick=x.trace[second];
    sourceDcJ+=tick.sourceDcJ;
    harvested+=tick.harvestedReceiverJ;
    sourceLinkedHarvestJ+=tick.sourceLinkedReceiverJ;
    ambientHarvestJ+=tick.ambientReceiverJ;
    const total=stored+tick.harvestedReceiverJ;
    spilled+=Math.max(0,total-x.storageCapacityJ);
    stored=Math.min(total,x.storageCapacityJ);
    const usedIdle=Math.min(stored,x.receiverIdleW);
    stored-=usedIdle;idleSpent+=usedIdle;
    if(usedIdle+1e-12<x.receiverIdleW)brownouts++;
    for(const task of tasks){
      if(task.state==="pending"&&second>=task.deadlineS){
        task.state="expired";events.push({second,type:"expired",taskId:task.id});
      }
    }
    const target=tasks.find(t=>t.state==="pending"&&t.arrivalS<=second&&second<t.deadlineS);
    if(!target)continue;
    const timeAllowed=policy==="fixed"
      ?(second%x.minimumAttemptSpacingS===x.fixedSlotPhaseS)
      :(second-lastAttemptS>=x.minimumAttemptSpacingS);
    if(!timeAllowed)continue;
    if(stored+1e-12<x.frameCostJ){
      deferred++;
      events.push({second,type:"deferred_insufficient_energy",taskId:target.id});
      continue;
    }
    stored-=x.frameCostJ;
    stored=Math.max(0,stored);
    attemptSpent+=x.frameCostJ;attempts++;target.attempts++;lastAttemptS=second;
    if(tick.linkOk){
      target.state="delivered";target.deliveredAt=second;successful++;
      events.push({second,type:"synthetic_delivery",taskId:target.id});
    }else{
      failed++;
      events.push({second,type:"synthetic_link_loss",taskId:target.id});
      if(target.attempts>=3)target.state="attempt_exhausted";
    }
  }
  const statusCounts=tasks.reduce((out,t)=>{out[t.state]=(out[t.state]||0)+1;return out;},{});
  const accounted=stored+idleSpent+attemptSpent+spilled;
  const inbound=x.initialStorageJ+harvested;
  const conservationErrorJ=Math.abs(accounted-inbound);
  if(conservationErrorJ>1e-8)fail("Synthetic energy ledger failed conservation check");
  return Object.freeze({
    schema:LAB_SCHEMA,policy,synthetic:true,
    sourceDcJ:num(sourceDcJ),harvestedReceiverJ:num(harvested),
    sourceLinkedHarvestJ:num(sourceLinkedHarvestJ),ambientHarvestJ:num(ambientHarvestJ),
    initialStorageJ:x.initialStorageJ,finalStorageJ:num(stored),
    idleSpentJ:num(idleSpent),attemptSpentJ:num(attemptSpent),spilledJ:num(spilled),
    conservationErrorJ,attempts,successful,failed,deferred,brownouts,
    taskCount:tasks.length,statusCounts,
    deliveryFraction:successful/tasks.length,
    tasksPerSourceDcJ:sourceDcJ>0?successful/sourceDcJ:null,
    sourceDcJPerTask:successful>0?sourceDcJ/successful:null,
    tasks,events,
    noPhysicalDelivery:true,noRealLightBridgeFrames:true
  });
}
export function comparePolicies(scenario){
  const x=validateScenario(scenario);
  const fixed=simulatePolicy(x,"fixed"),adaptive=simulatePolicy(x,"adaptive");
  const relativeChangePct=fixed.tasksPerSourceDcJ && adaptive.tasksPerSourceDcJ!==null
    ?100*(adaptive.tasksPerSourceDcJ/fixed.tasksPerSourceDcJ-1):null;
  return Object.freeze({
    schema:LAB_SCHEMA,provenance:"SIMULATED_ONLY",
    sourceEnergyInputIdentical:Math.abs(fixed.sourceDcJ-adaptive.sourceDcJ)<1e-10,
    fixed,adaptive,relativeChangePct,
    outcomeNotes:[
      "The synthetic LED source DC energy schedule is fixed and equal in both arms.",
      "The receiver energy trace and link-quality trace are identical for both scheduling policies.",
      "Synthetic receiver harvest is divided into an ambient-light contribution and a model-only LED-linked contribution bounded by source electrical DC input.",
      "A lower source-DC-joules-per-success ratio is not measured optical conversion efficiency or wall-plug savings.",
      "Scheduling opportunity and policy differences can explain outcomes; no physical causality or real PLB1 transfer has been demonstrated."
    ],
    actualLightBridgeConnected:false,hardwareValidated:false,physicalDataReceived:false,
    physicalPowerTransferred:false,identityAuthenticated:false
  });
}
const SHA=/^[0-9a-f]{64}$/;
const SESSION=/^[A-Za-z0-9_-]{6,40}$/;
const MAX_TRANSFER_BYTES=2*1024*1024;
const SENDER_TYPE="Parallax LightBridge Sender Receipt";
const RECEIVER_TYPE="Parallax LightBridge Receiver Receipt";
export function checkLightBridgeReceipts(sender,receiver){
  const issues=[];
  if(!sender||typeof sender!=="object"||Array.isArray(sender)||
     !receiver||typeof receiver!=="object"||Array.isArray(receiver)){
    issues.push("Both LightBridge receipt objects are required");
  }else{
    if(sender.receiptType!==SENDER_TYPE||receiver.receiptType!==RECEIVER_TYPE)
      issues.push("LightBridge sender/receiver receipt types do not match");
    if(sender.protocol!=="PLB1"||receiver.protocol!=="PLB1")
      issues.push("Unsupported optical transport protocol");
    if(!SESSION.test(sender.sessionId||"")||sender.sessionId!==receiver.sessionId)
      issues.push("Missing or mismatched transfer session ID");
    if(!SHA.test(sender.originalSha256||"")||sender.originalSha256!==receiver.originalSha256)
      issues.push("Missing or mismatched file SHA-256 claims");
    if(!safeInteger(sender.originalSize,1,MAX_TRANSFER_BYTES)||
       sender.originalSize!==receiver.originalSize)
      issues.push("Missing or mismatched transfer byte length");
    if(typeof sender.encryptionEnabled!=="boolean"||
       sender.encryptionEnabled!==receiver.encryptionEnabled)
      issues.push("Missing or mismatched encryption flag");
    if(typeof receiver.integrityStatus!=="string"||
       !receiver.integrityStatus.startsWith("PASS - protected payload and reconstructed file hashes matched"))
      issues.push("Receiver did not claim completed integrity verification");
  }
  return Object.freeze({
    schema:"powe-lightbridge-receipt-fields-v1",
    fieldsConsistent:issues.length===0,
    issues,
    transport:"LightBridge PLB1 local receipt comparison ONLY",
    receivedFileBytesVerifiedByPoWE:false,
    independentlyVerifiedOpticalTransfer:false,
    senderIdentityAuthenticated:false,
    recipientAuthorized:false,
    pairingConsentVerified:false,
    useForPhysicalEnergyControl:false,
    note:"The self-supplied receipt fields can match even if both files are fabricated. No original payload, digital signature, sender identity, camera transfer, or human consent is verified by this check."
  });
}
export const SYNTHETIC_RECEIPTS=Object.freeze({
  sender:{
    receiptType:SENDER_TYPE,protocol:"PLB1",sessionId:"demoSession_01",
    originalSha256:"a".repeat(64),originalSize:256,encryptionEnabled:true,
    status:"Prepared locally; optical reception not independently confirmed"
  },
  receiver:{
    receiptType:RECEIVER_TYPE,protocol:"PLB1",sessionId:"demoSession_01",
    originalSha256:"a".repeat(64),originalSize:256,encryptionEnabled:true,
    integrityStatus:"PASS - protected payload and reconstructed file hashes matched",
    claimBoundary:"Local software receipt; no sender signature or security certification"
  }
});
