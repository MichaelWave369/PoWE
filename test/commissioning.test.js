import test from "node:test";
import assert from "node:assert/strict";
import {
  FIXTURE_VERSION,CHECKLIST_ITEMS,getFixtures,auditFixture,runConformance,
  assessOperatorChecklist,sha256Hex,createConformanceReceipt
} from "../src/commissioning.js";

test("all deterministic protocol conformance scenarios return expected results",()=>{
  const report=runConformance();
  assert.equal(report.schema,FIXTURE_VERSION);
  assert.ok(report.total>=16);
  assert.equal(report.passed,report.total,JSON.stringify(report.results.filter(r=>!r.passed)));
  assert.equal(report.allPassed,true);
  assert.equal(report.hardwareValidated,false);
  assert.equal(report.deviceConnected,false);
});
test("nominal synthetic energy integration checks accurate source and receiver joules",()=>{
  const good=getFixtures().find(f=>f.id==="synthetic-good");
  const result=auditFixture(good);
  assert.equal(result.actual,"eligible");
  assert.equal(result.energyAccurate,true);
  assert.ok(Math.abs(result.sourceEnergyJ-.7)<1e-10);
  assert.ok(Math.abs(result.receiverEnergyJ-.0084)<1e-10);
});
test("fake reported header can pass structure but is not authenticated",()=>{
  const fixture=getFixtures().find(f=>f.id==="claimed-measured-good");
  assert.equal(fixture.downloadable,false);
  const result=auditFixture(fixture);
  assert.equal(result.actual,"eligible");
  assert.match(result.provenance,/synthetic/);
});
test("reject scenarios and ineligible scenarios cannot masquerade as clean sessions",()=>{
  const results=runConformance().results;
  assert.ok(results.filter(x=>x.expected==="reject").length>=8);
  assert.ok(results.filter(x=>x.expected==="ineligible").length>=4);
  assert.ok(results.every(x=>x.expected===x.actual));
});
test("missing checklist items never imply safe operation",()=>{
  const partial=assessOperatorChecklist(["read-only-gateway"]);
  assert.equal(partial.selfAttestedComplete,false);
  assert.equal(partial.marked,1);
  assert.ok(partial.missing.length>0);
  assert.match(partial.disclaimer,/NOT an approval/);
  assert.throws(()=>assessOperatorChecklist(["fake-id"]),/Unknown/);
});
test("even a complete checklist is labeled self-attestation, not approval",()=>{
  const complete=assessOperatorChecklist(CHECKLIST_ITEMS.map(x=>x.id));
  assert.equal(complete.selfAttestedComplete,true);
  assert.match(complete.disclaimer,/Self-attestation only/);
});
test("SHA-256 is deterministic and bound to exact text bytes",async()=>{
  assert.equal(await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.notEqual(await sha256Hex("abc"),await sha256Hex("abC"));
});
test("receipt contains all synthetic hashes and explicitly declines hardware assurance",async()=>{
  const receipt=await createConformanceReceipt();
  assert.equal(receipt.status,"SYNTHETIC_CHECKS_PASSED");
  assert.equal(receipt.hardwareValidated,false);
  assert.equal(receipt.calibrationVerified,false);
  assert.equal(receipt.physicalSafetyVerified,false);
  assert.equal(receipt.fixtureManifest.length,getFixtures().length);
  assert.ok(receipt.fixtureManifest.every(x=>/^[0-9a-f]{64}$/.test(x.sha256)));
  assert.equal(receipt.checklist.selfAttestedComplete,false);
});
