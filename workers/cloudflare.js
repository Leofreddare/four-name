import {createChecker} from '../lookup.js';
import {PLATFORMS} from '../platforms.js';
import {validateTransport,forwardPublicRequest} from './transport.js';
// One coordinator per deployment: every caller shares each service's pace and cache.
export default {async fetch(request,env){
 if(request.method!=='POST')return new Response('Use POST',{status:405});
 if(!env.CHECK_WORKER_SECRET||request.headers.get('Authorization')!=='Bearer '+env.CHECK_WORKER_SECRET)return new Response('Unauthorized',{status:401});
 if(!env.CHECKS?.get||!env.CHECKS?.idFromName)return Response.json({code:'binding-missing'},{status:503});
 return env.CHECKS.get(env.CHECKS.idFromName('shared-checker')).fetch(request);
}};
export class CheckCoordinator{
 constructor(ctx,env){this.ctx=ctx;this.active=new Map();this.persist=Promise.resolve();this.service=env.CHECK_SERVICE;this.engine=createChecker({restrictions:JSON.parse(env.RESTRICTIONS_JSON||'[]')});ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('gates');if(saved)for(const [p,g] of Object.entries(saved))Object.assign(this.engine.gates[p],g)});}
 async fetch(request){
  let job;try{const text=await request.text();if(text.length>4096)return new Response('Too large',{status:413});job=JSON.parse(text)}catch{return new Response('Invalid JSON',{status:400})}
  const transport=job?.protocol==='four-name-transport-v1',platform=transport?job.platform:job?.platforms?.[0];
  if(transport){try{validateTransport(job)}catch{return new Response('Invalid transport request',{status:400})}}
  if(!PLATFORMS[platform]||!transport&&(job?.platforms?.length!==1||!Array.isArray(job.names)||!job.names.length||job.names.length>(platform==='minecraft'?10:1)||job.names.some(n=>typeof n!=='string'||!n.trim()||n.length>128))||this.service&&this.service!==platform)return new Response('Invalid service or batch',{status:400});
  if((this.active.get(platform)||0)>=(platform==='minecraft'?2:1))return new Response('Checker busy',{status:429,headers:{'Retry-After':'2'}});
  this.active.set(platform,(this.active.get(platform)||0)+1);
  try{
   if(transport){await this.engine.gates[platform].enter(request.signal);return Response.json({protocol:'four-name-transport-v1',upstream:await forwardPublicRequest(job,request.signal)},{headers:{'Cache-Control':'no-store'}})}
   const rows=await this.engine.check(platform,[...new Set(job.names.map(n=>n.trim().toLowerCase()))],request.signal,undefined,job.refresh===true);
   return Response.json({rows},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return new Response('Unable to verify',{status:502})}finally{
   this.persist=this.persist.catch(()=>{}).then(()=>this.ctx.storage.put('gates',Object.fromEntries(Object.entries(this.engine.gates).map(([p,g])=>[p,{next:g.next,cooldown:g.cooldown,interval:g.interval}]))));
   try{await this.persist}finally{this.active.set(platform,this.active.get(platform)-1)}
  }
 }
}
