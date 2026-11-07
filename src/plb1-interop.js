// Rung 9: independent, browser-local PLB1 byte encoder/decoder for LightBridge interop.
// MIT original implementation. No optical hardware I/O, peer authentication or power control.
export const PLB1 = "PLB1";
export const MAX_ORIGINAL_BYTES = 2 * 1024 * 1024;
export const MAX_CONTAINER_BYTES = 3 * 1024 * 1024;
export const DEFAULT_BLOCK_BYTES = 256;
const MAX_BLOCK_COUNT = 40000;
const MAX_SEEN_FRAMES = 80000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", {fatal:true});
function fail(message){throw new Error(message);}
function join(parts) {
  const size=parts.reduce((sum,item)=>sum+item.length,0);
  if(size>MAX_CONTAINER_BYTES+65536)fail("Encoded envelope exceeds size limit");
  const out=new Uint8Array(size);let at=0;
  for(const part of parts){out.set(part,at);at+=part.length;}
  return out;
}
function toB64Url(bytes){
  let base="";
  for(let i=0;i<bytes.length;i+=8192)base+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(base).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function fromB64Url(text){
  if(typeof text!=="string"||!text||!/^[A-Za-z0-9_-]+$/.test(text))fail("Invalid base64url");
  const raw=atob(text.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-text.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){
    crc^=byte;
    for(let i=0;i<8;i++)crc=(crc&1)?(crc>>>1)^0xedb88320:crc>>>1;
  }
  return ((crc^0xffffffff)>>>0).toString(16).padStart(8,"0");
}
export async function sha256Bytes(bytes){
  if(!(bytes instanceof Uint8Array))fail("SHA-256 needs bytes");
  const data=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function metadataEncode(metadata,raw){
  const header=encoder.encode(JSON.stringify(metadata));
  if(header.length<2||header.length>65536)fail("PLB1 metadata too large");
  const prefix=new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0,header.length,false);
  return join([prefix,header,raw]);
}
function metadataDecode(bytes){
  if(bytes.length<6)fail("Truncated PLB1 metadata");
  const n=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,false);
  if(n<2||n>65536||n+4>bytes.length)fail("Invalid PLB1 metadata length");
  let head;
  try{head=JSON.parse(decoder.decode(bytes.subarray(4,n+4)));}
  catch{fail("Invalid PLB1 metadata JSON");}
  if(!head||typeof head!=="object"||Array.isArray(head))fail("Invalid PLB1 metadata object");
  return {head,payload:bytes.slice(4+n)};
}
function xorInto(target,from){
  if(target.length!==from.length)fail("PLB1 parity block length mismatch");
  for(let i=0;i<target.length;i++)target[i]^=from[i];
}
function zeroBlock(b){for(const byte of b)if(byte!==0)return false;return true;}
function hashSeed(text){
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
  return hash;
}
function seededRandom(seed){
  let s=seed||0x6d2b79f5;
  return ()=>{
    s^=s<<13;s^=s>>>17;s^=s<<5;s>>>=0;
    return s/4294967296;
  };
}
// Independent implementation of PLB1's public systematic/parity index grammar.
export function blockIndices(session,sequence,count){
  if(!/^[A-Za-z0-9_-]{6,40}$/.test(session)||!Number.isSafeInteger(sequence)||sequence<0||
    !Number.isSafeInteger(count)||count<1||count>MAX_BLOCK_COUNT)fail("Invalid PLB1 block coordinates");
  const position=sequence%(count*2);
  if(position<count)return [position];
  if(count===1)return [0];
  const next=seededRandom(hashSeed(session+":"+sequence+":"+count));
  const r=next();
  const degree=Math.min(count,r<.44?2:r<.74?3:r<.91?4:r<.98?5:6);
  const chosen=new Set();
  while(chosen.size<degree)chosen.add(Math.floor(next()*count));
  return [...chosen].sort((a,b)=>a-b);
}
function decimal36(text){
  if(!/^[0-9a-z]+$/i.test(text)||text.length>16)fail("Invalid base36 field");
  const n=parseInt(text,36);
  if(!Number.isSafeInteger(n))fail("Oversized base36 field");
  return n;
}
export function decodePlb1Frame(input){
  if(typeof input!=="string"||input.length>4096)fail("PLB1 frame exceeds 4096 characters");
  const f=input.trim().split("|");
  if(f.length!==8||f[0]!==PLB1)fail("Not a PLB1 frame");
  const [,session,a,b,c,d,checksum,data]=f;
  if(!/^[A-Za-z0-9_-]{6,40}$/.test(session))fail("Invalid PLB1 session");
  const sequence=decimal36(a),count=decimal36(b),size=decimal36(c),length=decimal36(d);
  if(sequence>1000000||count<1||count>MAX_BLOCK_COUNT||size<64||size>2048||
    length<1||length>MAX_CONTAINER_BYTES||count*size<length||
    count*size>MAX_CONTAINER_BYTES+2048)fail("PLB1 frame dimensions out of bounds");
  if(!/^[0-9a-f]{8}$/i.test(checksum))fail("Invalid PLB1 CRC");
  const bytes=fromB64Url(data);
  if(bytes.length!==size||crc32(bytes)!==checksum.toLowerCase())fail("PLB1 frame CRC mismatch");
  return {session,sequence,count,size,length,bytes};
}
export function encodePlb1Frame({session,sequence,count,size,length,bytes}){
  if(!(bytes instanceof Uint8Array)||bytes.length!==size)fail("Invalid PLB1 payload size");
  if(!Number.isSafeInteger(sequence)||sequence<0)fail("Invalid sequence");
  const checksum=crc32(bytes);
  const frame=[PLB1,session,sequence.toString(36),count.toString(36),
    size.toString(36),length.toString(36),checksum,toB64Url(bytes)].join("|");
  // Run the same bounds and CRC checks as an inbound frame.
  decodePlb1Frame(frame);
  return frame;
}
async function deriveKey(secret,salt,iterations,action){
  if(typeof secret!=="string"||!secret)fail("Passphrase required");
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,
    {name:"AES-GCM",length:256},false,[action]);
}
export async function makePlb1Transfer(bytes,{filename="powe.bin",mimeType="application/octet-stream",
  encrypt=true,passphrase="",blockSize=DEFAULT_BLOCK_BYTES}={}){
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_ORIGINAL_BYTES)
    fail("PLB1 file must contain 1-2097152 bytes");
  if(!Number.isSafeInteger(blockSize)||blockSize<64||blockSize>2048)fail("Invalid PLB1 block size");
  if(typeof filename!=="string"||!filename||filename.length>200||/[\\/\u0000-\u001f]/.test(filename))
    fail("Invalid PLB1 filename");
  if(typeof mimeType!=="string"||mimeType.length>100)fail("Invalid MIME type");
  if(encrypt&&!passphrase)fail("Passphrase required for encrypted transfer");
  const session=toB64Url(crypto.getRandomValues(new Uint8Array(9)));
  const createdAt=new Date().toISOString();
  const original=bytes.slice();
  const originalSha256=await sha256Bytes(original);
  const inner=metadataEncode({
    schema:"parallax-lightbridge-inner-v1",filename,mimeType,
    originalSize:original.length,originalSha256,createdAt
  },original);
  let data=inner, encryption={enabled:false};
  if(encrypt){
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const iterations=150000;
    const key=await deriveKey(passphrase,salt,iterations,"encrypt");
    data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,inner));
    encryption={enabled:true,algorithm:"AES-GCM-256",kdf:"PBKDF2-SHA-256",
      iterations,salt:toB64Url(salt),iv:toB64Url(iv)};
  }
  const wrapped=metadataEncode({
    schema:"parallax-lightbridge-outer-v1",protocol:PLB1,appVersion:"0.1.0",
    sessionId:session,createdAt,encryption,payloadSize:data.length,
    payloadSha256:await sha256Bytes(data),blockSize
  },data);
  const count=Math.ceil(wrapped.length/blockSize);
  if(count>MAX_BLOCK_COUNT||wrapped.length>MAX_CONTAINER_BYTES)fail("Too many PLB1 blocks");
  const blocks=Array.from({length:count},(_,i)=>{
    const b=new Uint8Array(blockSize);
    b.set(wrapped.subarray(i*blockSize,(i+1)*blockSize));
    return b;
  });
  return Object.freeze({
    session,count,blockSize,originalSha256,encrypted:Boolean(encrypt),filename,
    makeFrame(sequence){
      if(!Number.isSafeInteger(sequence)||sequence<0||sequence>1000000)fail("Invalid PLB1 frame sequence");
      const block=new Uint8Array(blockSize);
      for(const index of blockIndices(session,sequence,count))xorInto(block,blocks[index]);
      return encodePlb1Frame({session,sequence,count,size:blockSize,length:wrapped.length,bytes:block});
    },
    receipt(){
      return {receiptType:"Parallax LightBridge Sender Receipt",protocol:PLB1,
        sessionId:session,createdAt,sourceFilename:filename,originalSize:original.length,
        originalSha256,encryptionEnabled:Boolean(encrypt),blockSize,blockCount:count,
        status:"Prepared in PoWE browser; transport/reception not independently confirmed"};
    }
  });
}
export class PoWEPlb1Receiver {
  constructor(){
    this.session=null;this.count=0;this.size=0;this.length=0;
    this.known=new Map();this.pending=[];this.sequences=new Set();
    this.accepted=0;this.duplicates=0;
  }
  get complete(){return this.count>0&&this.known.size===this.count;}
  get progress(){return this.count?this.known.size/this.count:0;}
  get snapshot(){return {session:this.session,known:this.known.size,total:this.count,
    complete:this.complete,progress:this.progress,accepted:this.accepted,duplicates:this.duplicates};}
  addFrame(line){
    const f=decodePlb1Frame(line);
    if(!this.session){this.session=f.session;this.count=f.count;this.size=f.size;this.length=f.length;}
    else if(f.session!==this.session||f.count!==this.count||f.size!==this.size||f.length!==this.length)
      fail("PLB1 transfer session metadata mismatch");
    if(this.sequences.has(f.sequence)){this.duplicates++;return this.snapshot;}
    if(this.sequences.size>=MAX_SEEN_FRAMES)fail("Too many PLB1 frames");
    this.sequences.add(f.sequence);
    const remaining=new Set(blockIndices(f.session,f.sequence,f.count));
    const block=f.bytes.slice();
    for(const index of [...remaining])if(this.known.has(index)){
      xorInto(block,this.known.get(index));remaining.delete(index);
    }
    if(remaining.size===0){
      if(!zeroBlock(block))fail("Conflicting PLB1 parity equation");
      this.duplicates++;
    }else if(remaining.size===1){
      this.#solve([...remaining][0],block);
    }else{
      this.pending.push({indices:remaining,bytes:block});
      if(this.pending.length>Math.max(128,this.count*4))this.pending.shift();
    }
    this.accepted++;
    return this.snapshot;
  }
  #solve(index,block){
    const queue=[[index,block]];
    while(queue.length){
      const [i,b]=queue.shift();
      if(this.known.has(i)){
        const mismatch=b.slice();xorInto(mismatch,this.known.get(i));
        if(!zeroBlock(mismatch))fail("Conflicting PLB1 reconstructed bytes");
        continue;
      }
      this.known.set(i,b.slice());
      for(let j=this.pending.length-1;j>=0;j--){
        const eq=this.pending[j];
        if(!eq.indices.has(i))continue;
        xorInto(eq.bytes,b);eq.indices.delete(i);
        if(eq.indices.size<=1){
          this.pending.splice(j,1);
          if(eq.indices.size===0&&!zeroBlock(eq.bytes))fail("Conflicting parity");
          if(eq.indices.size===1)queue.push([[...eq.indices][0],eq.bytes]);
        }
      }
    }
  }
  getContainer(){
    if(!this.complete)fail("PLB1 transfer incomplete: missing blocks");
    const bytes=new Uint8Array(this.count*this.size);
    for(let i=0;i<this.count;i++)bytes.set(this.known.get(i),i*this.size);
    return bytes.slice(0,this.length);
  }
  async finalize(passphrase=""){
    const {head:outer,payload:protectedBytes}=metadataDecode(this.getContainer());
    if(outer.schema!=="parallax-lightbridge-outer-v1"||outer.protocol!==PLB1||
       outer.sessionId!==this.session||outer.blockSize!==this.size)
      fail("PLB1 outer metadata mismatch");
    if(!Number.isSafeInteger(outer.payloadSize)||outer.payloadSize!==protectedBytes.length)
      fail("PLB1 protected payload size mismatch");
    if(await sha256Bytes(protectedBytes)!==outer.payloadSha256)
      fail("PLB1 protected SHA-256 mismatch");
    let originalContainer=protectedBytes;
    if(outer.encryption?.enabled===true){
      const cfg=outer.encryption;
      if(cfg.algorithm!=="AES-GCM-256"||cfg.kdf!=="PBKDF2-SHA-256"||
        !Number.isSafeInteger(cfg.iterations)||cfg.iterations<10000||cfg.iterations>1000000)
        fail("Unsupported PLB1 encryption metadata");
      const salt=fromB64Url(cfg.salt),iv=fromB64Url(cfg.iv);
      if(salt.length!==16||iv.length!==12)fail("Invalid PLB1 salt or IV");
      const key=await deriveKey(passphrase,salt,cfg.iterations,"decrypt");
      try{originalContainer=new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv},key,protectedBytes));}
      catch{fail("PLB1 decryption failed or passphrase incorrect");}
    }else if(outer.encryption?.enabled!==false){
      fail("Unrecognized PLB1 encryption flag");
    }
    const {head:inner,payload:fileBytes}=metadataDecode(originalContainer);
    if(inner.schema!=="parallax-lightbridge-inner-v1"||
       !Number.isSafeInteger(inner.originalSize)||
       inner.originalSize!==fileBytes.length||fileBytes.length>MAX_ORIGINAL_BYTES||
       await sha256Bytes(fileBytes)!==inner.originalSha256){
      fail("PLB1 original file SHA-256 or metadata mismatch");
    }
    const filename=String(inner.filename||"received-file.bin")
      .replace(/[\\/\u0000-\u001f]/g,"_").slice(0,200)||"received-file.bin";
    return Object.freeze({
      bytes:fileBytes,filename,mimeType:inner.mimeType||"application/octet-stream",
      receipt:{
        receiptType:"Parallax LightBridge Receiver Receipt",protocol:PLB1,
        sessionId:this.session,originalSize:fileBytes.length,
        originalSha256:inner.originalSha256,
        protectedPayloadSha256:outer.payloadSha256,
        encryptionEnabled:Boolean(outer.encryption.enabled),
        integrityStatus:"PASS - protected payload and reconstructed file hashes matched",
        claimBoundary:"Locally verified file-byte integrity, NOT sender signature, human authorization or optical camera reception",
        recoveredBy:"PoWE Rung 9 independent PLB1 software receiver"
      },
      independentFileHashChecked:true,
      senderIdentityAuthenticated:false,physicalOpticalReceptionVerified:false,
      powerControlAuthorized:false
    });
  }
}
export function parsePlb1Lines(text){
  if(typeof text!=="string"||new TextEncoder().encode(text).length>MAX_ORIGINAL_BYTES*16)
    fail("PLB1 frames text exceeds 32 MiB");
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length||lines.length>MAX_SEEN_FRAMES)fail("No PLB1 frames or too many frames");
  const receiver=new PoWEPlb1Receiver();
  for(const line of lines)receiver.addFrame(line);
  return receiver;
}
