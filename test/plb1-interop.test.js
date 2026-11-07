import test from "node:test";
import assert from "node:assert/strict";
import {
  makePlb1Transfer,PoWEPlb1Receiver,decodePlb1Frame,parsePlb1Lines,sha256Bytes,
  blockIndices
} from "../src/plb1-interop.js";

const bytes=Uint8Array.from({length:1777},(_,i)=>(i*71+23)%256);
async function runTransfer(options={},includeParity=false){
  const tx=await makePlb1Transfer(bytes,{filename:"payload.bin",...options});
  const rx=new PoWEPlb1Receiver();
  const frameCount=includeParity?tx.count*2:tx.count;
  for(let i=0;i<frameCount;i++)rx.addFrame(tx.makeFrame(i));
  return {tx,rx};
}
test("actual encrypted file bytes round trip, including protected and original SHA-256",async()=>{
  const {tx,rx}=await runTransfer({encrypt:true,passphrase:"long test phrase"},true);
  assert.equal(rx.complete,true);
  const file=await rx.finalize("long test phrase");
  assert.deepEqual(file.bytes,bytes);
  assert.equal(file.receipt.originalSha256,await sha256Bytes(bytes));
  assert.equal(file.independentFileHashChecked,true);
  assert.equal(file.senderIdentityAuthenticated,false);
  assert.equal(file.physicalOpticalReceptionVerified,false);
  assert.equal(tx.receipt().originalSha256,file.receipt.originalSha256);
});
test("unencrypted file reconstructs from systematic frames in any order",async()=>{
  const tx=await makePlb1Transfer(bytes,{filename:"plain.bin",encrypt:false});
  const rx=new PoWEPlb1Receiver();
  for(let i=tx.count-1;i>=0;i--)rx.addFrame(tx.makeFrame(i));
  assert.deepEqual((await rx.finalize()).bytes,bytes);
});
test("parity recovers a missing systematic block after a parity equation",async()=>{
  const tx=await makePlb1Transfer(bytes,{encrypt:false,blockSize:256});
  const rx=new PoWEPlb1Receiver();
  for(let i=1;i<tx.count;i++)rx.addFrame(tx.makeFrame(i));
  assert.equal(rx.complete,false);
  for(let i=tx.count;i<tx.count*3&&!rx.complete;i++)rx.addFrame(tx.makeFrame(i));
  assert.equal(rx.complete,true);
  assert.deepEqual((await rx.finalize()).bytes,bytes);
});
test("missing frames do not produce downloadable bytes",async()=>{
  const tx=await makePlb1Transfer(bytes,{encrypt:false});
  const rx=parsePlb1Lines(Array.from({length:tx.count-1},(_,i)=>tx.makeFrame(i)).join("\n"));
  assert.equal(rx.complete,false);
  await assert.rejects(rx.finalize(),/incomplete/);
});
test("modified frame fails CRC and cannot be treated as completed",async()=>{
  const tx=await makePlb1Transfer(bytes,{encrypt:false});
  const frame=tx.makeFrame(0);
  const pieces=frame.split("|");
  pieces[6]="00000000";
  assert.throws(()=>decodePlb1Frame(pieces.join("|")),/CRC mismatch/);
});
test("wrong decryption passphrase fails even if frame checks pass",async()=>{
  const {rx}=await runTransfer({encrypt:true,passphrase:"correct phrase"});
  await assert.rejects(rx.finalize("wrong phrase"),/decryption failed/);
});
test("replay, cross-session mixing, and invalid sizes are handled",async()=>{
  const a=await makePlb1Transfer(bytes,{encrypt:false});
  const b=await makePlb1Transfer(bytes,{encrypt:false});
  const rx=new PoWEPlb1Receiver();
  rx.addFrame(a.makeFrame(0));
  rx.addFrame(a.makeFrame(0));
  assert.equal(rx.duplicates,1);
  assert.throws(()=>rx.addFrame(b.makeFrame(0)),/metadata mismatch/);
  assert.throws(()=>decodePlb1Frame("PLB1|x|0|1|10|1|00000000|aaa"));
});
test("unrecognized inputs are rejected and source remains optical-data only",async()=>{
  assert.throws(()=>blockIndices("bad",0,1),/Invalid/);
  await assert.rejects(makePlb1Transfer(new Uint8Array(),{encrypt:false}));
  await assert.rejects(makePlb1Transfer(bytes,{encrypt:true,passphrase:""}));
  const {rx}=await runTransfer({encrypt:false});
  const out=await rx.finalize();
  assert.equal(out.powerControlAuthorized,false);
});
