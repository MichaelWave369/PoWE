import test from "node:test";
import assert from "node:assert/strict";
import {parseFieldLog,analyzeFieldPair,EXAMPLE_PAIR} from "../src/optical-field.js";
const clone=x=>JSON.parse(JSON.stringify(x));
test("synthetic field logs remain clearly labeled self-reported rather than physical proof",()=>{
 const pair=clone(EXAMPLE_PAIR);
 const a=parseFieldLog(JSON.stringify(pair.sender),"sender");
 const b=parseFieldLog(JSON.stringify(pair.receiver),"receiver");
 const result=analyzeFieldPair({sender:a,receiver:b});
 assert.equal(result.state,"CONSISTENT_SELF_REPORTED_CAMERA_TRANSFER");
 assert.equal(result.overlap.uniqueCameraVsRendered,2);
 assert.equal(result.sender.uniqueRenderedSequences,3);
 assert.equal(result.receiver.duplicateSequenceObservations,1);
 assert.equal(result.flags.physicalCameraTransferIndependentlyVerified,false);
 assert.equal(result.flags.originalFileBytesIndependentlyCheckedByPoWE,false);
 assert.equal(result.overlap.observedCameraOverRenderedPct,200/3);
});
test("manual input is exposed, never called a camera-only experiment",()=>{
 const pair=clone(EXAMPLE_PAIR);
 pair.receiver.events[2].method="manual";
 pair.receiver.counters.observedCamera=2;pair.receiver.counters.observedManual=1;
 const r=analyzeFieldPair(pair);
 assert.equal(r.state,"INCOMPLETE_OR_MIXED_SELF_REPORTED");
 assert.equal(r.flags.selfReportedCameraOnly,false);
 assert.ok(r.issues.some(s=>s.includes("manually pasted")));
});
test("truncation excludes clean-coverage interpretations",()=>{
 const pair=clone(EXAMPLE_PAIR);
 pair.sender.droppedEvents=12;
 assert.equal(analyzeFieldPair(pair).state,"INCOMPLETE_OR_MIXED_SELF_REPORTED");
});
test("truncated sender log with a bounded missing tail remains reportable, not clean",()=>{
 const pair=clone(EXAMPLE_PAIR);
 pair.sender.events.pop();pair.sender.droppedEvents=1;
 const r=analyzeFieldPair(pair);
 assert.equal(r.state,"INCOMPLETE_OR_MIXED_SELF_REPORTED");
 assert.ok(r.issues.some(x=>x.includes("truncated")));
});
test("mismatched sender and receiver sessions are rejected",()=>{
 const pair=clone(EXAMPLE_PAIR);
 pair.receiver.sessionId="different_999";
 assert.throws(()=>analyzeFieldPair(pair),/Session mismatch/);
});
test("duplicate flags, counters and monotonic event time are validated",()=>{
 const pair=clone(EXAMPLE_PAIR);
 pair.receiver.events[3].duplicate=false;
 assert.throws(()=>analyzeFieldPair(pair),/Duplicate flag/);
 pair.receiver.events[3].duplicate=true;pair.receiver.counters.observed=200;
 assert.throws(()=>analyzeFieldPair(pair),/counters mismatch/);
 pair.receiver.counters.observed=3;pair.receiver.events[3].elapsedMs=100;
 assert.throws(()=>analyzeFieldPair(pair),/Non-monotonic/);
});
test("missing verification is never synthesized from observed frames",()=>{
 const pair=clone(EXAMPLE_PAIR);
 pair.receiver.events.pop();pair.receiver.verified=null;pair.receiver.counters.verificationSucceeded=0;
 const r=analyzeFieldPair(pair);
 assert.equal(r.flags.reconstructedFileHashClaimPresent,false);
 assert.equal(r.state,"INCOMPLETE_OR_MIXED_SELF_REPORTED");
});
test("both receipts are required and their claimed bytes must match log",()=>{
 const pair=clone(EXAMPLE_PAIR);
 const senderReceipt={
  receiptType:"Parallax LightBridge Sender Receipt",protocol:"PLB1",sessionId:"demoSession_01",
  originalSha256:"a".repeat(64),originalSize:64,encryptionEnabled:true
 };
 const receiverReceipt={
  receiptType:"Parallax LightBridge Receiver Receipt",protocol:"PLB1",sessionId:"demoSession_01",
  originalSha256:"a".repeat(64),originalSize:64,encryptionEnabled:true,
  integrityStatus:"PASS - protected payload and reconstructed file hashes matched"
 };
 const r=analyzeFieldPair({...pair,senderReceipt,receiverReceipt});
 assert.equal(r.state,"CONSISTENT_SELF_REPORTED_CAMERA_TRANSFER");
 const bad=analyzeFieldPair({...pair,senderReceipt,receiverReceipt:{...receiverReceipt,originalSize:65}});
 assert.equal(bad.state,"INCOMPLETE_OR_MIXED_SELF_REPORTED");
 assert.equal(bad.flags.receiptFieldsConsistent,false);
});
test("corrupt and oversized logs fail closed",()=>{
 assert.throws(()=>parseFieldLog("{","sender"),/Invalid field log JSON/);
 assert.throws(()=>parseFieldLog("x".repeat(4*1024*1024+1),"sender"),/4 MiB/);
 assert.throws(()=>parseFieldLog(JSON.stringify(EXAMPLE_PAIR.sender),"receiver"),/Expected receiver/);
});
