import {generateCandidates} from './generator.js';
self.onmessage=async({data})=>{try{await generateCandidates(data,()=>false,event=>self.postMessage({type:'progress',...event}));self.postMessage({type:'done'})}catch(error){self.postMessage({error:error.message})}};
