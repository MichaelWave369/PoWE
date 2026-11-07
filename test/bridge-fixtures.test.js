import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkLightBridgeReceipts,SYNTHETIC_RECEIPTS,createScenario,comparePolicies} from "../src/bridge-lab.js";

function fixture(name){
  return JSON.parse(readFileSync(new URL("../examples/rung8-synthetic/"+name,import.meta.url),"utf8"));
}
test("file-based fabricated receipts match deliberately in-memory fixture fields",()=>{
  assert.deepEqual(fixture("sender.json"),SYNTHETIC_RECEIPTS.sender);
  assert.deepEqual(fixture("receiver.json"),SYNTHETIC_RECEIPTS.receiver);
  const result=checkLightBridgeReceipts(fixture("sender.json"),fixture("receiver.json"));
  assert.equal(result.fieldsConsistent,true);
  assert.equal(result.senderIdentityAuthenticated,false);
  assert.equal(result.recipientAuthorized,false);
  assert.equal(result.independentlyVerifiedOpticalTransfer,false);
});
test("report never promotes synthetic trace to real optical transport",()=>{
  const report=comparePolicies(createScenario({seed:2026,durationS:40}));
  assert.equal(report.provenance,"SIMULATED_ONLY");
  assert.equal(report.physicalDataReceived,false);
  assert.equal(report.physicalPowerTransferred,false);
  assert.equal(report.actualLightBridgeConnected,false);
  assert.equal(report.fixed.sourceDcJ,report.adaptive.sourceDcJ);
});
