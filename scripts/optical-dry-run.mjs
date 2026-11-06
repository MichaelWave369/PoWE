import {SYNTHETIC_INPUTS,analyzeOpticalControls} from "../src/optical-controls.js";

const report=analyzeOpticalControls(SYNTHETIC_INPUTS,{
  nowMs:Date.parse("2026-11-06T23:45:00Z")
});
const passed=report.kind==="synthetic" &&
  report.provenance==="SYNTHETIC_DEMONSTRATION" &&
  Math.abs(report.sourceEnergyJ.on-0.7)<1e-10 &&
  Math.abs(report.signedLightAssociatedReceiverDeltaJ-0.0084)<1e-10 &&
  report.hardwareValidated===false &&
  report.efficiencyProven===false &&
  report.opticalPowerMeasured===false;
process.stdout.write("PoWE Rung 7 synthetic OFF/ON/OFF: "+(passed?"PASS":"FAIL")+"\n");
process.stdout.write("Result: "+report.signalStatus+"\n");
process.stdout.write("No hardware, optical power transfer, or calibrated data was measured.\n");
if(!passed)process.exitCode=1;
