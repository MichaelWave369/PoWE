import test from "node:test";
import assert from "node:assert/strict";
import { DESIGN_DEFAULT,createPrototype,evaluatePrototype,
  commissioningTemplate,billOfMaterialsTemplate,COMMISSIONING_STEPS } from "../src/prototype.js";

test("default MK1 is structurally bounded but expressly unbuilt and NOT authorized",()=>{
  const result=evaluatePrototype(createPrototype());
  assert.equal(result.structuralStatus,"DESIGN_CONSTRAINTS_PASSED");
  assert.equal(result.theoreticalInputCeilingW,2);
  assert.equal(result.hardwareValidated,false);
  assert.equal(result.energizingAuthorized,false);
  assert.ok(result.pending.length>=4);
});
test("source overvoltage, overcurrent and missing manual cutoff fail",()=>{
  for(const source of [
    {supplyVoltageV:9},{supplyCurrentLimitA:1},
    {hardwiredManualDisconnectRequired:false},
    {independentOvercurrentProtectionRequired:false},
    {laserProhibited:false},
    {supplyOvercurrentTripA:0.2}
  ]){
    assert.equal(evaluatePrototype(createPrototype({source})).structuralStatus,"INVALID_DESIGN");
  }
});
test("receiver sunlight rating is never an indoor optical power claim",()=>{
  const r=evaluatePrototype(createPrototype({receiver:{candidateRatedPowerW:0.6}}));
  assert.equal(r.experimentalOutcomeVerified,false);
  assert.match(r.warnings.join(" "),/sunlight rating/);
  assert.equal(evaluatePrototype(createPrototype({receiver:{
    manufacturerRatingCondition:"indoor_measured"}})).structuralStatus,"INVALID_DESIGN");
});
test("metrology requires independent channels and sufficient resolution",()=>{
  assert.equal(evaluatePrototype(createPrototype({metrology:{
    requiredReceiverCurrentResolutionUa:5,targetReceiverCurrentUa:10
  }})).structuralStatus,"INVALID_DESIGN");
  assert.equal(evaluatePrototype(createPrototype({metrology:{
    sourceInstrument:"meterA",receiverInstrument:"meterA"
  }})).structuralStatus,"INVALID_DESIGN");
  const pending=evaluatePrototype(createPrototype({metrology:{
    sourceInstrument:"meterA",receiverInstrument:"meterB"
  }}));
  assert.equal(pending.structuralStatus,"DESIGN_CONSTRAINTS_PASSED");
  assert.equal(pending.hardwareValidated,false);
});
test("insufficient clock resolution, unprotected gateway and geometry fail",()=>{
  for(const changes of [
    {metrology:{samplePeriodMs:2500}},
    {metrology:{samplePeriodMs:100,maxClockSkewMs:50}},
    {gateway:{serialOpenCannotControlPowerRequired:false}},
    {geometry:{minimumDistanceM:1,maximumDistanceM:0.1}},
    {geometry:{ambientDarkRunRequired:false}}
  ]) assert.equal(evaluatePrototype(createPrototype(changes)).structuralStatus,"INVALID_DESIGN");
});
test("checklist and BOM templates cannot impersonate hardware evidence",()=>{
  const plan=createPrototype();
  const matrix=commissioningTemplate(plan);
  const bom=billOfMaterialsTemplate(plan);
  assert.equal(matrix.status,"NOT_PERFORMED");
  assert.equal(matrix.energizingAuthorized,false);
  assert.equal(matrix.tasks.length,COMMISSIONING_STEPS.length);
  assert.ok(matrix.tasks.every(x=>x.status==="NOT_RUN"&&x.evidenceReference===null));
  assert.equal(bom.status,"CANDIDATES_ONLY_NOT_ORDERED");
  assert.ok(bom.requiredItems.length>=6);
});
test("invalid manifest is rejected without energizing approval",()=>{
  const invalid=evaluatePrototype(null);
  assert.equal(invalid.energizingAuthorized,false);
  assert.equal(invalid.structuralStatus,"INVALID_DESIGN");
  assert.equal(evaluatePrototype(createPrototype({state:"BUILT"})).structuralStatus,"INVALID_DESIGN");
  assert.equal(evaluatePrototype(DESIGN_DEFAULT).hardwareValidated,false);
});
