import {generateCandidates} from './generator.js';
self.onmessage=async({data})=>{try{self.postMessage({names:await generateCandidates(data)})}catch(error){self.postMessage({error:error.message})}};
