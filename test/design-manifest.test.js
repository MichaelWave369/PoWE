import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DESIGN_DEFAULT,evaluatePrototype,commissioningTemplate} from "../src/prototype.js";

test("checked-in MK1 hardware manifest and browser defaults never drift",()=>{
  const data=JSON.parse(readFileSync(new URL("../hardware/mk1-design.json",import.meta.url),"utf-8"));
  assert.deepEqual(data,DESIGN_DEFAULT);
  const result=evaluatePrototype(data);
  assert.equal(result.structuralStatus,"DESIGN_CONSTRAINTS_PASSED");
  assert.equal(result.hardwareValidated,false);
  assert.equal(result.energizingAuthorized,false);
});
test("checked-in manifest only generates unperformed acceptance criteria",()=>{
  const data=JSON.parse(readFileSync(new URL("../hardware/mk1-design.json",import.meta.url),"utf-8"));
  const out=commissioningTemplate(data);
  assert.equal(out.status,"NOT_PERFORMED");
  assert.equal(out.hardwareValidated,false);
  assert.ok(out.tasks.every(t=>t.status==="NOT_RUN"&&!t.evidenceReference));
});
