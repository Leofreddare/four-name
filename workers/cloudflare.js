import {createChecker} from '../lookup.js';
import {PLATFORMS} from '../platforms.js';
// One Durable Object for the deployment: all callers share caches, sessions and pacing.
export default {async fetch(request,env){
 if(request.method!=='POST')return new Response('Use POST',{status:405});
 if(!env.CHECK_WORKER_SECRET||request.headers.get('Authorization')!=='Bearer '+env.CHECK_WORKER_SECRET)return new Response('Unauthorized',{status:401});
 if(!env.CHECKS?.get||!env.CHECKS?.idFromName)return Response.json({code:'binding-missing'},{status:503});
 return env.CHECKS.get(env.CHECKS.idFromName('shared-checker')).fetch(request);
}};
export class CheckCoordinator{
 constructor(ctx,env){this.ctx=ctx;this.busy=false;this.engine=createChecker({restrictions:JSON.parse(env.RESTRICTIONS_JSON||'[]')});ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('gates');if(saved)for(const [p,g] of Object.entries(saved))Object.assign(this.engine.gates[p],g)});}
 async fetch(request){
  if(this.busy)return new Response('Checker busy',{status:429,headers:{'Retry-After':'2'}});
  this.busy=true;
  try{
   const text=await request.text();if(text.length>4096)return new Response('Too large',{status:413});const job=JSON.parse(text),platform=job.platforms?.[0];if(job.platforms?.length!==1||!PLATFORMS[platform]||!Array.isArray(job.names)||!job.names.length||job.names.length>(platform==='minecraft'?10:1)||job.names.some(n=>typeof n!=='string'||!n.trim()||n.length>128))return new Response('Invalid batch',{status:400});
   const rows=await this.engine.check(platform,[...new Set(job.names.map(n=>n.trim().toLowerCase()))],request.signal,undefined,job.refresh===true);
   return Response.json({rows},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return new Response('Unable to verify',{status:502})}finally{
   try{await this.ctx.storage.put('gates',Object.fromEntries(Object.entries(this.engine.gates).map(([p,g])=>[p,{next:g.next,cooldown:g.cooldown,interval:g.interval}])))}finally{this.busy=false}
  }
 }
}
