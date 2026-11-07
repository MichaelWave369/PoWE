// Software-only cross-repository LightBridge field-log compatibility check.
import {resolve,dirname,join} from "node:path";
import {pathToFileURL} from "node:url";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {analyzeFieldPair,parseFieldLog} from "../src/optical-field.js";

if(!process.argv[2])throw Error("Provide pinned LightBridge site/src/field-log.js path");
const filePath=resolve(process.argv[2]);
const {FieldRecorder}=await import(pathToFileURL(filePath).href);
const {createTransfer,Receiver,finalizeTransfer}=await import(pathToFileURL(join(dirname(filePath),"protocol.js")).href);
const bytes=Uint8Array.from({length:1009},(_,i)=>(i*89+41)%256);
const file={name:"interop.bin",type:"application/octet-stream",size:bytes.length,
  arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
const tx=await createTransfer(file,{encrypt:false,blockSize:256});
let sendClock=10,recvClock=100;
const txLog=new FieldRecorder("sender",{clock:()=>sendClock,utcClock:()=>"2026-11-06T12:00:00Z"});
txLog.begin(tx.session);
const rxLog=new FieldRecorder("receiver",{clock:()=>recvClock,utcClock:()=>"2026-11-06T12:00:03Z"});
rxLog.cameraEvent("camera-start");
const decoder=new Receiver();
for(let i=0;i<tx.count;i++){
  const frame=tx.makeFrame(i);
  sendClock+=500;txLog.shown(frame);
  recvClock+=650;rxLog.scanAttempt(true);
  rxLog.received(frame,"camera",decoder.addFrame(frame));
}
const done=await finalizeTransfer(decoder);
assert.deepEqual(done.bytes,bytes);
recvClock+=100;
rxLog.verification("success",{sha256:done.receipt.originalSha256,bytes:done.bytes.length});
rxLog.cameraEvent("camera-stop");
const sender=parseFieldLog(JSON.stringify(txLog.exportLog()),"sender");
const receiver=parseFieldLog(JSON.stringify(rxLog.exportLog({
  distanceCm:"30",lighting:"SYNTHETIC_SOFTWARE_NO_CAMERA",deviceLabel:"mock-only"
})),"receiver");
const report=analyzeFieldPair({sender,receiver,senderReceipt:tx.receipt(),receiverReceipt:done.receipt});
const expected=createHash("sha256").update(bytes).digest("hex");
assert.equal(report.state,"CONSISTENT_SELF_REPORTED_CAMERA_TRANSFER");
assert.equal(report.overlap.uniqueCameraVsRendered,tx.count);
assert.equal(report.receiver.reportedVerifiedOriginalSha256,expected);
assert.equal(report.flags.receiptFieldsConsistent,true);
assert.equal(report.flags.physicalCameraTransferIndependentlyVerified,false);
assert.equal(report.flags.originalFileBytesIndependentlyCheckedByPoWE,false);
process.stdout.write("PASS LightBridge recorder -> PoWE analyzer: "+tx.count+
  " software-labelled camera events; original SHA-256 "+expected+"\n");
process.stdout.write("No real QR camera capture or physical experiment in this CI test.\n");
