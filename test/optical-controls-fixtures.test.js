import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  SYNTHETIC_OFF_BEFORE,SYNTHETIC_LED_ON,SYNTHETIC_OFF_AFTER,
  SYNTHETIC_INPUTS,analyzeOpticalControls
} from "../src/optical-controls.js";

const paths=[
  ["off-before.ndjson",SYNTHETIC_OFF_BEFORE],
  ["led-on.ndjson",SYNTHETIC_LED_ON],
  ["off-after.ndjson",SYNTHETIC_OFF_AFTER]
];
test("checked-in sample file bytes match exactly the synthetic demo constants",()=>{
  for(const [name,expected] of paths){
    const data=readFileSync(new URL("../examples/rung7-synthetic/"+name,import.meta.url),"utf8");
    assert.equal(data,expected,name);
  }
});
test("example trio can be analyzed without asserting verified physical evidence",()=>{
  const result=analyzeOpticalControls(SYNTHETIC_INPUTS,{
    nowMs:Date.parse("2026-11-06T23:45:00Z")
  });
  assert.equal(result.provenance,"SYNTHETIC_DEMONSTRATION");
  assert.equal(result.hardwareValidated,false);
  assert.equal(result.wirelessPowerClaimVerified,false);
  assert.ok(result.signedLightAssociatedReceiverDeltaJ>0);
});
