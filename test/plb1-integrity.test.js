import test from "node:test";
import assert from "node:assert/strict";
import {
  makePlb1Transfer,PoWEPlb1Receiver,decodePlb1Frame,encodePlb1Frame,
  sha256Bytes
} from "../src/plb1-interop.js";

test("valid CRC does not bypass protected or original byte hash verification",async()=>{
  const file=Uint8Array.from({length:1005},(_,i)=>(i*31+9)%256);
  for(const encrypt of [false,true]){
    const passphrase=encrypt?"fixture-secret":"";
    const tx=await makePlb1Transfer(file,{encrypt,passphrase,blockSize:128});
    const rx=new PoWEPlb1Receiver();
    const middle=Math.floor(tx.count/2);
    for(let i=0;i<tx.count;i++){
      let frame=tx.makeFrame(i);
      if(i===middle){
        const decoded=decodePlb1Frame(frame);
        const altered=decoded.bytes.slice();
        altered[8]^=0x20;
        frame=encodePlb1Frame({...decoded,bytes:altered});
        // This new frame has a valid CRC but content differs from the source file.
        assert.equal(decodePlb1Frame(frame).sequence,i);
      }
      rx.addFrame(frame);
    }
    assert.equal(rx.complete,true);
    await assert.rejects(rx.finalize(passphrase),/mismatch|SHA-256|PLB1|metadata|decryption/i);
  }
});
test("binary bytes are independently hashed before a positive receiver receipt",async()=>{
  const data=Uint8Array.from([0,255,3,0,17,9,222,201,0]);
  const tx=await makePlb1Transfer(data,{filename:"tiny.bin",encrypt:false});
  const rx=new PoWEPlb1Receiver();
  for(let i=0;i<tx.count;i++)rx.addFrame(tx.makeFrame(i));
  const r=await rx.finalize();
  assert.deepEqual(r.bytes,data);
  assert.equal(r.receipt.originalSha256,await sha256Bytes(data));
  assert.equal(r.powerControlAuthorized,false);
  assert.equal(r.physicalOpticalReceptionVerified,false);
});
