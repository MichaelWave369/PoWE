import { runConformance } from "../src/commissioning.js";

const result=runConformance();
for(const testCase of result.results){
  process.stdout.write((testCase.passed?"PASS ":"FAIL ")+testCase.id+
    " / expected="+testCase.expected+" observed="+testCase.actual+"\n");
}
process.stdout.write("Synthetic protocol checks: "+result.passed+"/"+result.total+"\n");
process.stdout.write("No hardware was connected or validated.\n");
if(!result.allPassed)process.exitCode=1;
