import {createScenario,comparePolicies,checkLightBridgeReceipts,SYNTHETIC_RECEIPTS} from "../src/bridge-lab.js";

const scenario=createScenario({seed:369});
const report=comparePolicies(scenario);
const receipts=checkLightBridgeReceipts(SYNTHETIC_RECEIPTS.sender,SYNTHETIC_RECEIPTS.receiver);
const success=report.provenance==="SIMULATED_ONLY"&&
  report.sourceEnergyInputIdentical&&
  report.actualLightBridgeConnected===false&&
  report.hardwareValidated===false&&
  report.identityAuthenticated===false&&
  report.fixed.conservationErrorJ<1e-8&&report.adaptive.conservationErrorJ<1e-8&&
  receipts.fieldsConsistent&&
  receipts.senderIdentityAuthenticated===false&&
  receipts.independentlyVerifiedOpticalTransfer===false;
process.stdout.write("PoWE Rung 8 synthetic coordination: "+(success?"PASS":"FAIL")+"\n");
process.stdout.write("Mock delivered work units (fixed / adaptive): "+report.fixed.successful+" / "+report.adaptive.successful+"\n");
process.stdout.write("Source DC joules (fixed / adaptive): "+report.fixed.sourceDcJ.toFixed(6)+" / "+report.adaptive.sourceDcJ.toFixed(6)+"\n");
process.stdout.write("Receiver joule conservation errors: "+report.fixed.conservationErrorJ+", "+report.adaptive.conservationErrorJ+"\n");
process.stdout.write("Fabricated receipt fields consistent: "+receipts.fieldsConsistent+"\n");
process.stdout.write("No actual PLB1 transfer, physical energy transfer, calibrated meter, identity or consent was verified.\n");
if(!success)process.exitCode=1;
