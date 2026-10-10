import {PLATFORMS,STATUSES,validate,normalize} from '../platforms.js';
import {readBounded,retryAfter} from '../lookup.js';
export class CheckerError extends Error {
 constructor(message,code='worker-failure'){super(message);this.name='CheckerError';this.code=code;this.publicMessage=message;}
}

// Only known gateway configuration failures before the first batch can switch backends.
// Never switch after upstream blocks, throttling, timeouts or partial results.
export function withLocalConfigFallback(remote,local){
 let localOnly=false,remoteUsed=false;
 return {async run(job,signal,emit,waitForResume){
  if(localOnly)return local.run(job,signal,emit,waitForResume);
  try{return await remote.run(job,signal,async event=>{if(['results','done','error'].includes(event.type)||event.waiting===true)remoteUsed=true;return emit(event)},waitForResume)}catch(error){
   signal.throwIfAborted();
   if(error.code!=='worker-config'||!error.beforeChecks||remoteUsed){remoteUsed=true;throw error;}
   localOnly=true;
   await emit({type:'notice',platform:job.platforms[0],message:error.publicMessage+' Using the built-in checker until the server restarts.'});
   return local.run(job,signal,emit,waitForResume);
  }
 }};
}
// Server-side only: the shared secret is never exposed to browsers.
function wait(ms,signal){return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal.reason)},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})}
function createSerialRemoteChecker({url,secret,fetchImpl=fetch,now=Date.now,sleep=wait}){
 const endpoint=new URL(url);if(endpoint.protocol!=='https:'&&!(endpoint.hostname==='localhost'&&endpoint.protocol==='http:'))throw Error('Worker URL must use HTTPS.');if(!secret||secret.length<32)throw Error('CHECK_WORKER_SECRET must contain at least 32 characters.');
 return {async run({names,platforms,refresh=false},signal,emit,waitForResume=async()=>{}){
  const platform=platforms[0],unique=[...new Set(names.map(normalize))];if(!PLATFORMS[platform]||platforms.length!==1)throw Error('Choose one service.');await emit({type:'meta',names:unique.length,total:unique.length,platforms});
  // Small calls stay within free Worker subrequest limits. The coordinator owns all pacing.
  for(let i=0;i<unique.length;i+=platform==='minecraft'?10:1){signal.throwIfAborted();await waitForResume();const batch=unique.slice(i,i+(platform==='minecraft'?10:1));
   for(let retry=0;;retry++){
   const cooldown=async(until)=>{if(retry>=3)throw new CheckerError('Checking worker remains rate limited. Resume unfinished names after '+new Date(until).toISOString()+'.');await emit({type:'notice',platform,waiting:true,message:'Waiting for the checker cooldown. Retrying the same names automatically.',retryAt:new Date(until).toISOString()});while(now()<until){signal.throwIfAborted();await waitForResume();await sleep(Math.min(30000,until-now()),signal)}await waitForResume();await emit({type:'notice',platform,waiting:false,message:'Cooldown finished. Retrying the same names.'})};
   let response;try{response=await fetchImpl(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify({names:batch,platforms,refresh}),signal:AbortSignal.any([signal,AbortSignal.timeout(120000)])})}catch(error){signal.throwIfAborted();throw new CheckerError('Cannot reach the checking worker. Check CHECK_WORKER_URL on Render and the Cloudflare deployment. Completed results are preserved.')}
   if(response.status===429){const until=now()+retryAfter(response.headers.get('Retry-After'),now());await response.body?.cancel();await cooldown(until);continue}
   if(!response.ok){let data;try{data=JSON.parse(await readBounded(response,4096))}catch{}const message=response.status===401?'Checking worker rejected the shared secret. CHECK_WORKER_SECRET must match on Render and Cloudflare.':response.status===404||response.status===405?'CHECK_WORKER_URL does not point to the deployed checking worker.':data?.code==='binding-missing'?'Cloudflare is missing its CHECKS Durable Object binding. Deploy the included worker configuration.':'Checking worker returned HTTP '+response.status+'. Check Cloudflare runtime logs; completed results are preserved.';const code=[401,404,405].includes(response.status)||data?.code==='binding-missing'?'worker-config':'worker-failure';const error=new CheckerError(message,code);error.beforeChecks=i===0;throw error}
   const reader=response.body.getReader();let size=0,parts=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>128000)throw new CheckerError('Checking worker response exceeded the safe size limit.');parts.push(value)}}finally{await reader.cancel().catch(()=>{})}
   let data;try{data=JSON.parse(new TextDecoder().decode(Buffer.concat(parts)))}catch{throw new CheckerError('Checking worker returned unreadable data. Check CHECK_WORKER_URL and Cloudflare logs.')}if(!Array.isArray(data.rows)||data.rows.length!==batch.length)throw new CheckerError('Checking worker returned an incomplete batch. Deploy the included worker code and resume unfinished names.');const seen=new Set();for(const row of data.rows){if(!row||row.platform!==platform||!batch.includes(row.name)||seen.has(row.name)||!STATUSES.includes(row.status)||typeof row.reason!=='string'||!Number.isFinite(Date.parse(row.checkedAt))||row.status==='Available'&&(platform==='minecraft'||validate(platform,row.name)))throw new CheckerError('Invalid worker evidence. No availability results were accepted from this batch.');seen.add(row.name)}
   const throttled=data.rows.find(r=>r.code==='throttled');if(throttled){await cooldown(Math.max(now()+1000,Date.parse(throttled.retryAt)||now()+60000));continue}
   const failure=data.rows.find(r=>['blocked','opaque','transient'].includes(r.code));if(failure){await emit({type:'error',message:PLATFORMS[platform].label+': '+failure.reason+' Resume unfinished names later.'});return}
   await waitForResume();await emit({type:'results',rows:data.rows});break;
   }
  }signal.throwIfAborted();await emit({type:'done'});
 }};
}

export function createRemoteChecker(options){
 const serial=createSerialRemoteChecker(options);
 return {async run(job,signal,emit,waitForResume){
  const names=[...new Set(job.names.map(normalize))];
  if(job.platforms.length!==1||job.platforms[0]!=='minecraft'||names.length<=10)return serial.run(job,signal,emit,waitForResume);
  await emit({type:'meta',names:names.length,total:names.length,platforms:job.platforms});
  const lanes=[[],[]];for(let i=0;i<names.length;i+=10)lanes[(i/10)%2].push(...names.slice(i,i+10));
  const stop=new AbortController(),combined=AbortSignal.any([signal,stop.signal]);let failed=false;
  const forward=async event=>{if(['meta','done'].includes(event.type)||failed)return;if(event.type==='error'){failed=true;try{await emit(event)}finally{stop.abort()}}else await emit(event)};
  const outcomes=await Promise.allSettled(lanes.map(names=>serial.run({...job,names},combined,forward,waitForResume).catch(error=>{stop.abort();throw error})));
  signal.throwIfAborted();if(failed)return;const rejected=outcomes.find(r=>r.status==='rejected'&&r.reason?.name!=='AbortError')||outcomes.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;await emit({type:'done'});
 }};
}

export function createConfiguredChecker(env,{local,fetchImpl=fetch}={}){
 const routes=new Map();
 for(const platform of Object.keys(PLATFORMS)){
  const key='CHECK_WORKER_'+platform.toUpperCase(),url=env[key+'_URL']||env.CHECK_WORKER_URL;
  if(url)routes.set(platform,withLocalConfigFallback(createRemoteChecker({url,secret:env[key+'_SECRET']||env.CHECK_WORKER_SECRET,fetchImpl}),local));
 }
 return {run(job,...args){return (routes.get(job.platforms[0])||local).run(job,...args)}};
}
