/* Dedicated client worker. Terminating it cancels generation immediately. */
let WORDS=new Set();
importScripts('/generator.js');
self.onmessage=async ({data})=>{
 try{WORDS=new Set(data.words);const names=await generateCandidates(data.filters);self.postMessage({names})}
 catch(error){self.postMessage({error:error.message||'Name generation failed.'})}
};
