// Lightweight alternative for a single Node 22–24 instance (including Render).
import http from 'node:http';import {createChecker} from '../lookup.js';import {PLATFORMS} from '../platforms.js';
const secret=process.env.CHECK_WORKER_SECRET;if(!secret||secret.length<32)throw Error('Set CHECK_WORKER_SECRET to at least 32 random characters.');
const engine=createChecker({restrictions:JSON.parse(process.env.RESTRICTIONS_JSON||'[]')});let busy=false;
http.createServer(async(req,res)=>{
 const send=(code,body)=>{if(res.destroyed)return;res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...(code===429?{'Retry-After':'2'}:{})});res.end(JSON.stringify(body))};
 if(req.url==='/health')return send(200,{status:'ok'});
 if(req.method!=='POST'||req.url!=='/check')return send(404,{error:'Not found'});
 if(req.headers.authorization!=='Bearer '+secret)return send(401,{error:'Unauthorized'});if(busy)return send(429,{error:'Busy'});
 busy=true;const controller=new AbortController();res.on('close',()=>controller.abort());
 try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(413,{error:'Too large'})}const job=JSON.parse(raw),p=job.platforms?.[0];if(job.platforms?.length!==1||!PLATFORMS[p]||!Array.isArray(job.names)||!job.names.length||job.names.length>(p==='minecraft'?10:1)||job.names.some(n=>typeof n!=='string'||!n.trim()||n.length>128))return send(400,{error:'Invalid batch'});
  const rows=await engine.check(p,[...new Set(job.names.map(n=>n.trim().toLowerCase()))],controller.signal,undefined,job.refresh===true);send(200,{rows});
 }catch{send(502,{error:'Unable to verify'})}finally{busy=false}
}).listen(Number(process.env.PORT||3001),'0.0.0.0');
