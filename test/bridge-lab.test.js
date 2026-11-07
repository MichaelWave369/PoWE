import test from "node:test";
import assert from "node:assert/strict";
import {
  LAB_SCHEMA,createScenario,validateScenario,simulatePolicy,comparePolicies,
  checkLightBridgeReceipts,SYNTHETIC_RECEIPTS
} from "../src/bridge-lab.js";

test("same seeded scenario generates identical traces and tasks",()=>{
  assert.deepEqual(createScenario({seed:369}),createScenario({seed:369}));
  assert.notDeepEqual(createScenario({seed:369}).trace,createScenario({seed:370}).trace);
});
test("both policies share same physical source budget and receiver trace",()=>{
  const x=createScenario(),r=comparePolicies(x);
  assert.equal(r.schema,LAB_SCHEMA);
  assert.equal(r.provenance,"SIMULATED_ONLY");
  assert.equal(r.sourceEnergyInputIdentical,true);
  assert.equal(r.fixed.sourceDcJ,r.adaptive.sourceDcJ);
  assert.ok(r.fixed.sourceLinkedHarvestJ<=r.fixed.sourceDcJ);
  assert.ok(Math.abs(r.fixed.ambientHarvestJ+r.fixed.sourceLinkedHarvestJ-r.fixed.harvestedReceiverJ)<1e-8);
  assert.equal(r.hardwareValidated,false);
  assert.equal(r.actualLightBridgeConnected,false);
  assert.ok(r.fixed.conservationErrorJ<1e-8);
  assert.ok(r.adaptive.conservationErrorJ<1e-8);
});
test("energy ledger accounts for initial, incoming, useful, idle, overflow for both policies",()=>{
  for(const policy of ["fixed","adaptive"]){
    const x=createScenario({seed:17,durationS:75,storageCapacityJ:0.04,initialStorageJ:0.02});
    const y=simulatePolicy(x,policy);
    const inbound=y.initialStorageJ+y.harvestedReceiverJ;
    const accounted=y.finalStorageJ+y.idleSpentJ+y.attemptSpentJ+y.spilledJ;
    assert.ok(Math.abs(inbound-accounted)<1e-8);
    assert.equal(y.attempts,y.successful+y.failed);
    assert.ok(y.successful<=y.taskCount);
    assert.ok(y.attemptSpentJ>=0);
  }
});
test("zero source DC trace never manufactures a tasks-per-source-joule claim",()=>{
  const x=createScenario({sourceDcW:0});
  const r=comparePolicies(x);
  assert.equal(r.fixed.tasksPerSourceDcJ,null);
  assert.equal(r.adaptive.tasksPerSourceDcJ,null);
  assert.equal(r.relativeChangePct,null);
  assert.equal(r.sourceEnergyInputIdentical,true);
  assert.equal(r.fixed.sourceLinkedHarvestJ,0);
  assert.ok(r.fixed.ambientHarvestJ>0);
});
test("bad input traces, tasks and non-mock transport fail closed",()=>{
  const x=createScenario();
  const bad1={...x,trace:x.trace.slice(1)};
  assert.throws(()=>validateScenario(bad1),/Trace/);
  const bad2={...x,trace:[{...x.trace[0],harvestedReceiverJ:-1},...x.trace.slice(1)]};
  assert.throws(()=>validateScenario(bad2),/Invalid synthetic trace/);
  assert.throws(()=>validateScenario({...x,transport:"real-power"}),/Invalid/);
  const invented={...x,trace:[{...x.trace[0],sourceLinkedReceiverJ:0.9},...x.trace.slice(1)]};
  assert.throws(()=>validateScenario(invented),/Invalid synthetic trace/);
  assert.throws(()=>validateScenario({...x,tasks:[{...x.tasks[0],id:"../"}]}),/invalid task id/);
  assert.throws(()=>createScenario({initialStorageJ:10,storageCapacityJ:1}));
  assert.throws(()=>createScenario({durationS:601}));
});
test("a valid-looking LightBridge receipt pair is still unauthenticated",()=>{
  const r=checkLightBridgeReceipts(SYNTHETIC_RECEIPTS.sender,SYNTHETIC_RECEIPTS.receiver);
  assert.equal(r.fieldsConsistent,true);
  assert.equal(r.senderIdentityAuthenticated,false);
  assert.equal(r.recipientAuthorized,false);
  assert.equal(r.independentlyVerifiedOpticalTransfer,false);
  assert.equal(r.receivedFileBytesVerifiedByPoWE,false);
});
test("LightBridge receipt mismatch and tampering are visible",()=>{
  for(const pair of [
    {sender:{...SYNTHETIC_RECEIPTS.sender,originalSha256:"b".repeat(64)},receiver:SYNTHETIC_RECEIPTS.receiver},
    {sender:SYNTHETIC_RECEIPTS.sender,receiver:{...SYNTHETIC_RECEIPTS.receiver,sessionId:"notSame"}},
    {sender:SYNTHETIC_RECEIPTS.sender,receiver:{...SYNTHETIC_RECEIPTS.receiver,originalSize:257}},
    {sender:SYNTHETIC_RECEIPTS.sender,receiver:{...SYNTHETIC_RECEIPTS.receiver,integrityStatus:"NO"}},
    {sender:SYNTHETIC_RECEIPTS.sender,receiver:{...SYNTHETIC_RECEIPTS.receiver,encryptionEnabled:false}},
    {sender:{...SYNTHETIC_RECEIPTS.sender,originalSize:3*1024*1024},receiver:SYNTHETIC_RECEIPTS.receiver}
  ]){
    assert.equal(checkLightBridgeReceipts(pair.sender,pair.receiver).fieldsConsistent,false);
  }
});
test("receipt structure rejects untrusted or null objects without evaluating code",()=>{
  const r=checkLightBridgeReceipts(null,{});
  assert.equal(r.fieldsConsistent,false);
  assert.equal(r.useForPhysicalEnergyControl,false);
});
