// Cross-repository interoperability against a PINNED copy of actual LightBridge source.
// The GitHub workflow checks out LightBridge's independently implemented protocol.js.
// Transfer here means in-memory PLB1 frames, NOT a real screen/camera optical link.
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {strict as assert} from "node:assert";
import {makePlb1Transfer,PoWEPlb1Receiver} from "../src/plb1-interop.js";

if(process.argv.length<3)throw Error("Pass the checked-out LightBridge protocol.js path");
const lightbridge=await import(pathToFileURL(resolve(process.argv[2])).href);
const binary=Uint8Array.from({length:6387},(_,i)=>(i*113+(i>>3)*17+29)%256);
const actualHash=createHash("sha256").update(binary).digest("hex");
const file={
  size:binary.length,name:"cross-repo-binary.bin",type:"application/octet-stream",
  arrayBuffer:async()=>binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength)
};
for(const encrypted of [false,true]){
  const password=encrypted?"bench-interoperability-long-test-passphrase":"";
  // LightBridge encoder -> independent PoWE decoder. Test real original bytes.
  const lbTx=await lightbridge.createTransfer(file,{encrypt:encrypted,passphrase:password,blockSize:256});
  const poweRx=new PoWEPlb1Receiver();
  for(let i=0;i<lbTx.count;i++)poweRx.addFrame(lbTx.makeFrame(i));
  assert.equal(poweRx.complete,true);
  const fromLb=await poweRx.finalize(password);
  assert.deepEqual(fromLb.bytes,binary);
  assert.equal(fromLb.receipt.originalSha256,actualHash);
  assert.equal(fromLb.senderIdentityAuthenticated,false);
  if(encrypted){
    await assert.rejects(poweRx.finalize("wrong-passphrase"),/decryption failed/);
  }
  // Independent PoWE encoder -> LightBridge decoder. Two different algorithms.
  const poweTx=await makePlb1Transfer(binary,{
    filename:file.name,mimeType:file.type,
    encrypt:encrypted,passphrase:password,blockSize:256
  });
  const lbRx=new lightbridge.Receiver();
  for(let i=0;i<poweTx.count;i++)lbRx.addFrame(poweTx.makeFrame(i));
  assert.equal(lbRx.complete,true);
  const fromPoWE=await lightbridge.finalizeTransfer(lbRx,password);
  assert.deepEqual(fromPoWE.bytes,binary);
  assert.equal(fromPoWE.receipt.originalSha256,actualHash);
  // Cross-repo parity: drop one systematic block and recover using PLB1 parity.
  const recovered=new PoWEPlb1Receiver();
  for(let i=1;i<lbTx.count;i++)recovered.addFrame(lbTx.makeFrame(i));
  assert.equal(recovered.complete,false);
  for(let i=lbTx.count;i<lbTx.count*3&&!recovered.complete;i++){
    recovered.addFrame(lbTx.makeFrame(i));
  }
  assert.equal(recovered.complete,true);
  assert.deepEqual((await recovered.finalize(password)).bytes,binary);
  // Incomplete transfers must NOT finalize.
  const broken=new PoWEPlb1Receiver();
  for(let i=0;i<lbTx.count-1;i++)broken.addFrame(lbTx.makeFrame(i));
  assert.equal(broken.complete,false);
  await assert.rejects(broken.finalize(password),/incomplete/);
  // Corruption must fail CRC before any data is considered valid.
  const payload=lbTx.makeFrame(0).split("|");
  payload[6]="00000000";
  assert.throws(()=>new PoWEPlb1Receiver().addFrame(payload.join("|")),/CRC mismatch/);
  process.stdout.write("PASS cross-repo PLB1 "+(encrypted?"AES-GCM encrypted":"plaintext")+
    ": "+binary.length+" bytes, SHA-256="+actualHash+"\n");
}
process.stdout.write("SOFTWARE BYTE INTEROPERABILITY PASS. Not a physical optical transfer; no device pairing, identity or power output.\n");
