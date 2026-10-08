const clientCapabilities={workers:typeof Worker==='function',generation:'main thread',webgpu:'unavailable'};
if(typeof navigator!=='undefined'&&navigator.gpu?.requestAdapter){
 clientCapabilities.webgpu='checking';
 navigator.gpu.requestAdapter({powerPreference:'low-power'}).then(adapter=>clientCapabilities.webgpu=adapter?'available':'no adapter').catch(()=>clientCapabilities.webgpu='unavailable');
}
async function generateOnClient(filters,signal){
 if(signal.aborted)return [];
 const fallback=()=>{clientCapabilities.generation='main thread';return generateCandidates(filters,()=>signal.aborted)};
 if(typeof Worker!=='function')return fallback();
 return new Promise((resolve,reject)=>{
  let worker,finished=false;
  const cleanup=()=>{signal.removeEventListener('abort',cancel);worker?.terminate()};
  const cancel=()=>{if(finished)return;finished=true;cleanup();resolve([])};
  const fail=()=>{if(finished)return;finished=true;cleanup();if(signal.aborted)resolve([]);else fallback().then(resolve,reject)};
  try{
   worker=new Worker('/generator-worker.js');
   worker.onmessage=({data})=>{if(finished)return;finished=true;cleanup();if(signal.aborted)return resolve([]);if(data.error)return reject(Error(data.error));clientCapabilities.generation='Web Worker';resolve(data.names)};
   worker.onerror=fail;worker.onmessageerror=fail;signal.addEventListener('abort',cancel,{once:true});
   if(signal.aborted)return cancel();
   worker.postMessage({filters,words:[...WORDS]});
  }catch{fail()}
 });
}
