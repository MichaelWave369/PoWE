import {
  MAX_ORIGINAL_BYTES,makePlb1Transfer,parsePlb1Lines,sha256Bytes
} from "./plb1-interop.js";

const $=id=>document.getElementById(id);
let sender=null,receiverFile=null,receiverReceipt=null;
function status(id,message,error=false){
  const node=$(id);node.textContent=message;node.classList.toggle("plb1-bad",error);
}
function output(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const safeFilename=s=>String(s||"payload.bin").replace(/[\\/\u0000-\u001f]/g,"_").slice(0,180);
$("plb1-send-build").addEventListener("click",async()=>{
  sender=null;
  $("plb1-send-export").disabled=true;
  $("plb1-send-receipt").disabled=true;
  const file=$("plb1-send-file").files?.[0];
  if(!file)return status("plb1-send-status","Select a local file first.",true);
  if(!file.size||file.size>MAX_ORIGINAL_BYTES)
    return status("plb1-send-status","File must be nonempty and at most 2 MiB.",true);
  const encrypted=$("plb1-send-encrypted").checked;
  const passphrase=$("plb1-send-password").value;
  if(encrypted&&!passphrase)
    return status("plb1-send-status","Enter a passphrase for AES-GCM encryption.",true);
  $("plb1-send-build").disabled=true;
  try{
    const data=new Uint8Array(await file.arrayBuffer());
    sender=await makePlb1Transfer(data,{
      filename:safeFilename(file.name),mimeType:file.type||"application/octet-stream",
      encrypt:encrypted,passphrase
    });
    $("plb1-send-hash").textContent=sender.originalSha256;
    $("plb1-send-count").textContent=String(sender.count);
    $("plb1-send-export").disabled=false;
    $("plb1-send-receipt").disabled=false;
    status("plb1-send-status","Prepared "+sender.count+" real PLB1 systematic blocks ("+
      (sender.count*2)+" total systematic/parity frames). The frames are in this browser only. NO optical transmission was performed.");
  }catch(e){status("plb1-send-status","Preparation rejected: "+String(e.message||e),true);}
  finally{$("plb1-send-build").disabled=false;}
});
$("plb1-send-export").addEventListener("click",()=>{
  if(!sender)return;
  try{
    const frames=[];
    for(let i=0;i<sender.count*2;i++)frames.push(sender.makeFrame(i));
    output("PoWE-PLB1-"+sender.session+"-frames.txt",frames.join("\n")+"\n","text/plain;charset=utf-8");
    status("plb1-send-status","Saved offline PLB1 frame text with original file bytes encoded. Not sent via screen/camera.");
  }catch(e){status("plb1-send-status","Frame export failed: "+String(e.message||e),true);}
});
$("plb1-send-receipt").addEventListener("click",()=>{
  if(!sender)return;
  output("PoWE-PLB1-"+sender.session+"-sender-UNVERIFIED.json",
    JSON.stringify(sender.receipt(),null,2)+"\n","application/json;charset=utf-8");
  status("plb1-send-status","Sender receipt saved. It proves local preparation only, NOT reception or peer identity.");
});
$("plb1-send-encrypted").addEventListener("change",()=>{
  sender=null;$("plb1-send-export").disabled=true;$("plb1-send-receipt").disabled=true;
  status("plb1-send-status","Encryption choice changed. Prepare the file again.");
});
$("plb1-send-file").addEventListener("change",()=>{
  sender=null;$("plb1-send-export").disabled=true;$("plb1-send-receipt").disabled=true;
  status("plb1-send-status","File changed. Prepare the PLB1 bundle again.");
});
$("plb1-send-password").addEventListener("input",()=>{
  sender=null;$("plb1-send-export").disabled=true;$("plb1-send-receipt").disabled=true;
});
function clearReceiver(){
  receiverFile=null;receiverReceipt=null;
  $("plb1-receive-save").disabled=true;
  $("plb1-receive-receipt").disabled=true;
  $("plb1-receive-hash").textContent="Not verified";
  $("plb1-receive-progress").textContent="No frames decoded";
}
$("plb1-receive-file").addEventListener("change",()=>{
  clearReceiver();
  status("plb1-receive-status","Frame bundle changed; reconstruction not yet attempted.");
});
$("plb1-receive-password").addEventListener("input",clearReceiver);
$("plb1-receive-decode").addEventListener("click",async()=>{
  clearReceiver();
  const file=$("plb1-receive-file").files?.[0];
  if(!file)return status("plb1-receive-status","Choose a local PLB1 frame text file.",true);
  if(!file.size||file.size>MAX_ORIGINAL_BYTES*16)
    return status("plb1-receive-status","Frame text file must be 1 B to 32 MiB.",true);
  $("plb1-receive-decode").disabled=true;
  try{
    const receiver=parsePlb1Lines(await file.text());
    $("plb1-receive-progress").textContent=receiver.snapshot.known+" / "+receiver.snapshot.total+" blocks";
    if(!receiver.complete)throw Error("Transfer incomplete. Missing blocks; no reconstructed file will be downloaded.");
    const found=await receiver.finalize($("plb1-receive-password").value);
    // Check the final bytes independently of the receipt field.
    const independentlyComputed=await sha256Bytes(found.bytes);
    if(independentlyComputed!==found.receipt.originalSha256)
      throw Error("Independent final byte hash mismatch");
    receiverFile=found;receiverReceipt=found.receipt;
    $("plb1-receive-hash").textContent=independentlyComputed;
    $("plb1-receive-save").disabled=false;
    $("plb1-receive-receipt").disabled=false;
    status("plb1-receive-status","Software reconstruction verified "+found.bytes.length+
      " original bytes against SHA-256. This is NOT authenticated identity, human consent, or actual camera reception.");
  }catch(e){
    clearReceiver();
    status("plb1-receive-status","RECONSTRUCTION REJECTED: "+String(e.message||e),true);
  }finally{$("plb1-receive-decode").disabled=false;}
});
$("plb1-receive-save").addEventListener("click",()=>{
  if(!receiverFile)return;
  output(safeFilename(receiverFile.filename),receiverFile.bytes,
    "application/octet-stream");
  status("plb1-receive-status","Downloaded locally reconstructed untrusted file. Do not execute unknown content.");
});
$("plb1-receive-receipt").addEventListener("click",()=>{
  if(!receiverReceipt)return;
  output("PoWE-PLB1-"+receiverReceipt.sessionId+"-receiver-UNVERIFIED.json",
    JSON.stringify(receiverReceipt,null,2)+"\n","application/json;charset=utf-8");
  status("plb1-receive-status","Receiver receipt saved. Original bytes were verified locally; external sender identity remains unknown.");
});
$("plb1-receive-clear").addEventListener("click",()=>{
  clearReceiver();
  $("plb1-receive-file").value="";
  $("plb1-receive-password").value="";
  status("plb1-receive-status","Imported frame bundle and reconstructed file cleared from this browser tab.");
});
clearReceiver();
