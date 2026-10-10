import {PLATFORMS,STATUSES,validate,normalize} from '../platforms.js';
// Server-side only: the shared secret is never exposed to browsers.
export function createRemoteChecker({url,secret,fetchImpl=fetch}){
 const endpoint=new URL(url);if(endpoint.protocol!=='https:'&&!(endpoint.hostname==='localhost'&&endpoint.protocol==='http:'))throw Error('Worker URL must use HTTPS.');if(!secret||secret.length<32)throw Error('CHECK_WORKER_SECRET must contain at least 32 characters.');
 return {async run({names,platforms,refresh=false},signal,emit,waitForResume=async()=>{}){
  const platform=platforms[0],unique=[...new Set(names.map(normalize))];if(!PLATFORMS[platform]||platforms.length!==1)throw Error('Choose one service.');await emit({type:'meta',names:unique.length,total:unique.length,platforms});
  // Small calls stay within free Worker subrequest limits. The coordinator owns all pacing.
  for(let i=0;i<unique.length;i+=platform==='minecraft'?10:1){signal.throwIfAborted();await waitForResume();const batch=unique.slice(i,i+(platform==='minecraft'?10:1));
   const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify({names:batch,platforms,refresh}),signal:AbortSignal.any([signal,AbortSignal.timeout(120000)])});
   if(response.status===429){const seconds=Math.max(1,Number(response.headers.get('Retry-After'))||60),retryAt=new Date(Date.now()+seconds*1000).toISOString();await response.body?.cancel();await emit({type:'error',message:'Worker is rate limited. Resume after '+retryAt+'.'});return}
   if(!response.ok){await response.body?.cancel();throw Error('Worker could not verify this batch. Completed results are preserved.')}
   const reader=response.body.getReader();let size=0,parts=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>128000)throw Error('Worker response exceeded limit.');parts.push(value)}}finally{await reader.cancel().catch(()=>{})}
   const data=JSON.parse(new TextDecoder().decode(Buffer.concat(parts)));if(!Array.isArray(data.rows)||data.rows.length!==batch.length)throw Error('Incomplete worker response.');const seen=new Set();for(const row of data.rows){if(row.platform!==platform||!batch.includes(row.name)||seen.has(row.name)||!STATUSES.includes(row.status)||typeof row.reason!=='string'||!Number.isFinite(Date.parse(row.checkedAt))||row.status==='Available'&&(platform==='minecraft'||validate(platform,row.name)))throw Error('Invalid worker evidence.');seen.add(row.name)}
   const failure=data.rows.find(r=>['throttled','blocked','opaque','transient'].includes(r.code));if(failure){await emit({type:'error',message:PLATFORMS[platform].label+': '+failure.reason+' Resume unfinished names later.'});return}
   await waitForResume();await emit({type:'results',rows:data.rows});
  }signal.throwIfAborted();await emit({type:'done'});
 }};
}
