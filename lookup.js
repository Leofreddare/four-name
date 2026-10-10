function delay(ms,value,{signal}={}){return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal.reason)},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve(value)},ms);if(signal){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true})}})}
import {PLATFORMS,normalize,validate} from './platforms.js';
const uuid=/^[a-f0-9]{32}$/i;
export function retryAfter(value,now=Date.now()){
 if(value!==null&&value!==undefined&&value!==''){
  const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return Math.max(1000,seconds*1000);
  const date=Date.parse(value);if(Number.isFinite(date))return Math.max(1000,date-now);
 }
 return 60000;
}
export class Gate {
 constructor(interval,now=Date.now,wait=delay){this.interval=interval;this.now=now;this.wait=wait;this.next=0;this.cooldown=0;this.tail=Promise.resolve()}
 async enter(signal){
  let release;const previous=this.tail;this.tail=new Promise(r=>release=r);
  try{
   let abort;const stopped=new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true})});
   try{signal.throwIfAborted();await Promise.race([previous,stopped])}catch(error){previous.finally(release);release=()=>{};throw error}finally{signal.removeEventListener('abort',abort)}
   signal.throwIfAborted();let pause=Math.max(this.next,this.cooldown)-this.now();while(pause>0){await this.wait(pause,undefined,{signal});signal.throwIfAborted();pause=Math.max(this.next,this.cooldown)-this.now()}signal.throwIfAborted();this.next=this.now()+this.interval}finally{release()}
 }
 throttle(ms){this.cooldown=Math.max(this.cooldown,this.now()+ms)}
}
export async function readBounded(response,max=2*1024*1024){
 const reader=response.body?.getReader();if(!reader)return '';let size=0,text='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw Error('Response too large');text+=decoder.decode(value,{stream:true})}return text+decoder.decode()}finally{await reader.cancel().catch(()=>{})}
}
function result(platform,name,status,reason,extra={}){return {platform,name,status,reason,checkedAt:new Date().toISOString(),...extra}}
const missing='No current public profile found. Locks, reservations and moderation blocks cannot be ruled out. Confirm in Minecraft before claiming.';
export function parseMinecraft(names,profiles){
 if(!Array.isArray(profiles)||profiles.length>names.length)throw Error('Unexpected profile response');const found=new Set();
 for(const p of profiles){const name=typeof p?.name==='string'?p.name.toLowerCase():'';if(!names.includes(name)||!uuid.test(p?.id||'')||found.has(name))throw Error('Invalid profile response');found.add(name)}
 return names.map(name=>found.has(name)?result('minecraft',name,'Taken','A matching Java profile exists.',{source:'Mojang public profile registry'}):result('minecraft',name,'Unknown',missing,{code:'unresolved',source:'Mojang public profile registry'}));
}
// Public signup response, not a profile-absence heuristic. Unexpected schemas fail closed.
export function parseDiscord(name,status,data){
 const source='Discord public signup username check';
 if(status===200&&data&&Object.keys(data).length===1&&typeof data.taken==='boolean')return result('discord',name,data.taken?'Taken':'Available',data.taken?'Discord reports this username is already taken.':'Discord’s signup check reports this username available. Recheck in Discord before claiming.',{source,code:'signup-check'});
 if(status===400&&data?.code===50035){
  const errors=data.errors?.username?._errors;
  if(Array.isArray(errors)&&errors.length&&errors.every(e=>typeof e.code==='string')){
   const restricted=new Set(['USERNAME_INVALID_CONTAINS','USERNAME_INVALID_RESERVED','USERNAME_RESERVED','USERNAME_INVALID_BLOCKED']);
   const format=new Set(['USERNAME_INVALID_TOO_SHORT','USERNAME_INVALID_TOO_LONG','USERNAME_INVALID_CHARACTERS','USERNAME_INVALID_CONSECUTIVE_DOTS']);
   if(errors.some(e=>restricted.has(e.code)))return result('discord',name,'Restricted/Reserved','Discord rejected this name as restricted by its username policy.',{source,code:'platform-restriction'});
   if(errors.every(e=>format.has(e.code)))return result('discord',name,'Invalid','Discord rejected the username format.',{source,code:'format'});
  }
 }
 throw Error('Unexpected Discord signup response');
}
const gitlabReserved=new Set(['admin','api','assets','dashboard','explore','groups','health_check','help','import','jwt','login','o','oauth','profile','projects','public','s','search','sitemap','snippets','unsubscribes','uploads','users','v2']);
export function gitlabRestriction(name){return gitlabReserved.has(name)||/^(?:duo[-_]|ai[-_])/.test(name)||/^(?:admin|dashboard|explore|groups|health_check|help|projects|public|search)\./.test(name)}
export function parseSignup(platform,name,data){
 if(platform==='gitlab'&&data&&Object.keys(data).length===1&&typeof data.exists==='boolean')return result(platform,name,data.exists?'Taken':'Available',data.exists?'GitLab reports this namespace is occupied or reserved.':'GitLab’s signup namespace check reports this name unused; local reservation rules passed. Confirm at signup before claiming.',{code:'signup-check',source:'GitLab public signup namespace check'});
 if(platform==='lastfm'){
  const field=data?.userName;
  if(field?.valid===true&&field.success_message==='Ok, that username can be yours!'&&(!field.error_messages||field.error_messages.length===0))return result(platform,name,'Available','Last.fm’s signup validator explicitly accepted this username. Confirm at signup before claiming.',{code:'signup-check',source:'Last.fm public signup validator'});
  if(field?.valid===false&&Array.isArray(field.error_messages)&&field.error_messages.length===1&&field.error_messages[0]==="Sorry, this username isn't available.")return result(platform,name,'Taken','Last.fm reports this username unavailable (taken or reserved).',{code:'signup-check',source:'Last.fm public signup validator'});
 }
 throw Error('Unexpected signup validation response');
}
export function createChecker({fetchImpl=fetch,intervals={},now=Date.now,wait=delay,restrictions=[],verifyMinecraft=false}={}){
 const gates=Object.fromEntries(['minecraft','gitlab','lastfm','discord'].map(p=>[p,new Gate(intervals[p]??(p==='minecraft'?1000:p==='discord'?5000:p==='gitlab'?3100:2000),now,wait)]));
 const cache=new Map();const circuits=new Map();let lastfmSession=null,lastfmPending=null,minecraftVerifiedUntil=0;
 async function session(signal,gate){
  if(lastfmSession?.until>now())return lastfmSession;
  if(lastfmPending)return lastfmPending;
  lastfmPending=(async()=>{const response=await fetchImpl('https://www.last.fm/join',{headers:{'User-Agent':'FourName/2.0 username-checker','Accept-Language':'en-US'},redirect:'error',signal});
   if(!response.ok){await response.body?.cancel();const error=Error('Signup session unavailable');if([401,403].includes(response.status))error.code='blocked';if(response.status===429){error.code='throttled';error.until=now()+retryAfter(response.headers.get('Retry-After'),now());gate.throttle(error.until-now())}throw error}
   const cookies=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')||''];const token=cookies.map(c=>c.match(/(?:^|,\s*)csrftoken=([^;]+)/)?.[1]).find(Boolean);await readBounded(response);signal.throwIfAborted();if(!token||! /^[a-zA-Z0-9]+$/.test(token))throw Error('Missing anonymous signup CSRF token');lastfmSession={token,until:now()+600000};return lastfmSession})();
  try{return await lastfmPending}finally{lastfmPending=null}
 }

 // Optional operator evidence, never inferred from missing profiles. No names ship on this list.
 const evidence=new Map();for(const r of restrictions){if(PLATFORMS[r.platform]&&typeof r.name==='string'&&typeof r.reason==='string'&&r.reason.length&&/^https:\/\//.test(r.source||'')&&Number.isFinite(Date.parse(r.confirmedAt))&&Date.parse(r.confirmedAt)<=now()&&Date.parse(r.expiresAt)>now()&&Date.parse(r.expiresAt)-Date.parse(r.confirmedAt)<=86400000)evidence.set(r.platform+':'+normalize(r.name),r)}
 async function upstream(platform,names,signal,notice){
  const gate=gates[platform];const circuit=circuits.get(platform);if(circuit&&circuit.until>now())return names.map(n=>result(platform,n,'Unknown',circuit.reason,{code:circuit.code,retryAt:new Date(circuit.until).toISOString(),retryable:true}));
  const url=platform==='discord'?'https://discord.com/api/v9/unique-username/username-attempt-unauthed':platform==='minecraft'?'https://api.mojang.com/minecraft/profile/lookup/bulk/byname':platform==='gitlab'?'https://gitlab.com/users/'+encodeURIComponent(names[0])+'/exists':'https://www.last.fm/join/partial/validate';
  for(let attempt=0;attempt<3;attempt++){
   await gate.enter(signal);signal.throwIfAborted();
   try{
    let csrf;
    if(platform==='lastfm'){const hadSession=lastfmSession?.until>now();csrf=await session(AbortSignal.any([signal,AbortSignal.timeout(10000)]),gate);if(!hadSession)await gate.enter(signal)}
    const combined=AbortSignal.any([signal,AbortSignal.timeout(10000)]),json=platform==='minecraft'||platform==='discord';
    const headers={Accept:'application/json','User-Agent':'FourName/2.0 username-checker','Accept-Language':'en-US',...(json?{'Content-Type':'application/json'}:{}),...(platform==='gitlab'?{'X-Requested-With':'XMLHttpRequest'}:{}),...(platform==='lastfm'?{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest',Referer:'https://www.last.fm/join',Cookie:'csrftoken='+csrf.token}:{})};
    const probe=platform==='minecraft'&&verifyMinecraft&&minecraftVerifiedUntil<=now();
    const body=json?JSON.stringify(platform==='discord'?{username:names[0]}:probe?['notch']:names):platform==='lastfm'?new URLSearchParams({csrfmiddlewaretoken:csrf.token,userName:names[0],email:''}).toString():undefined;
    const response=await fetchImpl(url,{method:body?'POST':'GET',headers,...(body?{body}:{}),redirect:'error',signal:combined});
    if(response.status===429){
     const header=response.headers.get('Retry-After');let cooldown=header?retryAfter(header,now()):null;
     if(platform==='discord'){try{const data=JSON.parse(await readBounded(response,65536));if(typeof data.retry_after==='number'&&Number.isFinite(data.retry_after)&&data.retry_after>=0)cooldown=Math.max(cooldown??0,retryAfter(String(data.retry_after),now()))}catch{}gate.interval=Math.min(60000,Math.max(gate.interval,5000)*1.5)}
     cooldown=Math.max(cooldown??60000,1000*2**attempt);gate.throttle(cooldown);await response.body?.cancel().catch(()=>{});await notice?.({type:'notice',platform,message:'Rate limited. Respecting the platform’s retry window.',retryAt:new Date(gate.cooldown).toISOString()});
     // Never shorten Retry-After. Long windows return retryable results instead of tying up a run.
     if(cooldown<=10000&&attempt<2)continue;
     circuits.set(platform,{until:gate.cooldown,reason:'Rate limited. Retry after the platform cooldown.',code:'throttled'});
     return names.map(n=>result(platform,n,'Unknown','Rate limited. Retry after the platform cooldown.',{code:'throttled',retryable:true,retryAt:new Date(gate.cooldown).toISOString()}));
    }
    if(response.status===401||response.status===403){await response.body?.cancel();const reason='Unable to verify: platform access is restricted. No authentication or challenge bypass attempted.';circuits.set(platform,{until:now()+300000,reason,code:'blocked'});return names.map(n=>result(platform,n,'Unknown',reason,{code:'blocked',retryable:true,retryAt:new Date(now()+300000).toISOString()}))}
    if(platform==='discord'){
     const text=await readBounded(response,65536);combined.throwIfAborted();
     if(response.headers.get('x-ratelimit-remaining')==='0')gate.throttle(retryAfter(response.headers.get('x-ratelimit-reset-after'),now()));
     return [parseDiscord(names[0],response.status,JSON.parse(text))];
    }
    if(platform==='minecraft'){
     if(!response.ok){await response.body?.cancel();throw Error('Upstream HTTP '+response.status)}
     const profiles=JSON.parse(await readBounded(response,65536));
     if(probe){if(!Array.isArray(profiles)||profiles.length!==1||profiles[0]?.name?.toLowerCase()!=='notch'||profiles[0]?.id?.toLowerCase()!=='069a79f444e94726a5befca90e38aaf5')throw Error('Minecraft known-profile verification failed');minecraftVerifiedUntil=now()+300000;attempt--;continue}
     return parseMinecraft(names,profiles);
    }
    if(!response.ok){await response.body?.cancel();throw Error('Upstream HTTP '+response.status)}
    const data=JSON.parse(await readBounded(response,65536));combined.throwIfAborted();return [parseSignup(platform,names[0],data)];
   }catch(error){signal.throwIfAborted();if(error.code==='blocked'||error.code==='throttled'){const until=error.until||now()+300000,reason=error.code==='throttled'?'Rate limited. Retry after the platform cooldown.':'Unable to verify: signup access is restricted.';circuits.set(platform,{until,reason,code:error.code});return names.map(n=>result(platform,n,'Unknown',reason,{code:error.code,retryable:true,retryAt:new Date(until).toISOString()}))}if(attempt<2){await wait(500*2**attempt+Math.floor(Math.random()*200),undefined,{signal});continue}const reason='Unable to verify: upstream request failed or returned unexpected data.';circuits.set(platform,{until:now()+30000,reason,code:'transient'});return names.map(n=>result(platform,n,'Unknown',reason,{code:'transient',retryable:true,retryAt:new Date(now()+30000).toISOString()}))}
  }
 }
 async function check(platform,names,signal,notice,refresh=false){
  const rows=[],pending=[];
  for(const raw of names){const name=normalize(raw),key=platform+':'+name,invalid=validate(platform,name),record=evidence.get(key),hit=cache.get(key);
   if(invalid)rows.push(result(platform,name,'Invalid',invalid,{code:'format'}));
   else if(record&&Date.parse(record.expiresAt)>now())rows.push(result(platform,name,'Restricted/Reserved',record.reason,{source:record.source,evidenceConfirmedAt:record.confirmedAt,code:'confirmed-restriction'}));
   else if(platform==='gitlab'&&gitlabRestriction(name))rows.push(result(platform,name,'Restricted/Reserved','GitLab reserves this route or AI username prefix.',{code:'platform-restriction',source:'GitLab official username policy/source'}));
   else if(platform==='gitlab'&&(name.includes('.')||name.includes('-')))rows.push(result(platform,name,'Unknown','Namespace checks cannot exclude reserved suffixes or hidden GitLab Pages domains for this name.',{code:'rules-uncertain'}));
   else if(hit&&hit.expires>now()&&(!refresh||hit.row.status==='Taken'))rows.push({...hit.row,cached:true});
   else pending.push(name);
  }
  if(pending.length){const fresh=[];if(platform==='minecraft')fresh.push(...await upstream(platform,pending,signal,notice));else for(const name of pending){signal.throwIfAborted();fresh.push(...await upstream(platform,[name],signal,notice))}for(const row of fresh){if(row.status==='Available'||row.status==='Taken'||row.status==='Restricted/Reserved'||row.code==='unresolved'){const key=platform+':'+row.name;cache.delete(key);cache.set(key,{row,expires:now()+(row.status==='Available'?15000:row.status==='Taken'?600000:60000)});if(cache.size>20000)cache.delete(cache.keys().next().value)}rows.push(row)}}
  return rows;
 }
 async function runSerial({names,platforms,refresh=false},signal,emit,waitForResume=async()=>{}){
  const unique=[...new Set(names.map(normalize))];await emit({type:'meta',names:unique.length,total:unique.length*platforms.length,platforms});
  const unsupported=platforms.find(p=>PLATFORMS[p].availability===false);
  if(unsupported){await emit({type:'error',message:PLATFORMS[unsupported].label+' bulk availability cannot currently be verified without authenticated platform access. Check the username in the official app. No names were checked.'});return}
  // Requests share the process-wide gate. A cooldown is a wait, never a result.
  for(const platform of platforms){
   let size;
   for(let i=0;i<unique.length;i+=size){
    size=platform==='minecraft'?10:1;let hits=0;while(hits<512&&i+hits<unique.length){const hit=cache.get(platform+':'+unique[i+hits]);if(!hit||hit.expires<=now()||refresh&&hit.row.status!=='Taken')break;hits++}if(hits)size=hits;
    signal.throwIfAborted();await waitForResume();const batch=unique.slice(i,i+size);let rows;
    for(let retry=0;;retry++){
     rows=await check(platform,batch,signal,notice=>emit(notice),refresh);
     const throttled=rows.find(r=>r.code==='throttled');
     if(!throttled)break;
     if(retry>=3){await emit({type:'error',message:PLATFORMS[platform].label+' is still rate limiting this server. Search interrupted; unchecked names are preserved. Resume later after '+new Date(throttled.retryAt).toLocaleTimeString()+'.'});return}
     let until=Date.parse(throttled.retryAt);
     await emit({type:'notice',platform,waiting:true,message:'Waiting for the platform cooldown. This name will be retried automatically.',retryAt:new Date(until).toISOString()});
     while(now()<until){signal.throwIfAborted();await waitForResume();await wait(Math.min(30000,until-now()),undefined,{signal});until=Math.max(until,gates[platform].cooldown)}
     await waitForResume();await emit({type:'notice',platform,waiting:false,message:'Cooldown finished. Resuming the same name.'});
    }
    // A blocked circuit must not produce thousands of fictitious checked rows.
    const failed=rows.find(r=>['blocked','opaque','transient'].includes(r.code));
    if(failed){await emit({type:'error',message:PLATFORMS[platform].label+': '+failed.reason+' Search interrupted; remaining names were not checked.'});return}
    await emit({type:'results',rows});
   }
  }
  signal.throwIfAborted();await emit({type:'done'});
 }
 async function run(job,signal,emit,waitForResume=async()=>{}){
  const names=[...new Set(job.names.map(normalize))];
  // Two Minecraft requests may overlap in network time, but every start still uses the same gate.
  if(job.platforms.length!==1||job.platforms[0]!=='minecraft'||names.length<=10||gates.minecraft.interval===0)return runSerial(job,signal,emit,waitForResume);
  await emit({type:'meta',names:names.length,total:names.length,platforms:job.platforms});
  const lanes=[[],[]];for(let i=0;i<names.length;i+=10)lanes[(i/10)%2].push(...names.slice(i,i+10));
  const stop=new AbortController(),combined=AbortSignal.any([signal,stop.signal]);let failed=false;
  const forward=async event=>{if(['meta','done'].includes(event.type)||failed)return;if(event.type==='error'){failed=true;try{await emit(event)}finally{stop.abort()}}else await emit(event)};
  const outcomes=await Promise.allSettled(lanes.map(names=>runSerial({...job,names},combined,forward,waitForResume)));
  signal.throwIfAborted();if(failed)return;const rejected=outcomes.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;await emit({type:'done'});
 }
 return {run,check,gates,cache};
}
export const checker=createChecker();
