import {setTimeout as delay} from 'node:timers/promises';
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
function embedded(html,id){
 const pattern=new RegExp('<script\\b(?=[^>]*\\bid=["\\\']'+id+'["\\\'])[^>]*>([\\s\\S]*?)</script>','i');const match=html.match(pattern);if(!match)return null;try{return JSON.parse(match[1])}catch{return null}
}
export function publicProfile(platform,html,name){
 if(platform==='tiktok'){
  const data=embedded(html,'__UNIVERSAL_DATA_FOR_REHYDRATION__');const scope=data?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
  const user=scope?.userInfo?.user;
  return scope?.statusCode===0&&typeof user?.uniqueId==='string'&&user.uniqueId.toLowerCase()===name&&/^\d+$/.test(user.id||'');
 }
 if(platform==='snapchat'){
  const data=embedded(html,'__NEXT_DATA__');const envelope=data?.props?.pageProps?.userProfile;
  const profile=envelope?.$case==='userInfo'?envelope.userInfo:null;
  // Fail closed if the public page schema changes. Display names and echoed URLs are not evidence.
  return typeof profile?.username==='string'&&profile.username.toLowerCase()===name&&typeof profile?.snapcodeImageUrl==='string'&&/^https:\/\/(?:app|www)\.snapchat\.com\//.test(profile.snapcodeImageUrl);
 }
 return false;
}
function result(platform,name,status,reason,extra={}){return {platform,name,status,reason,checkedAt:new Date().toISOString(),...extra}}
const missing='No current public profile found. Locks, reservations and moderation blocks cannot be ruled out. Confirm in Minecraft before claiming.';
export function parseMinecraft(names,profiles){
 if(!Array.isArray(profiles)||profiles.length>names.length)throw Error('Unexpected profile response');const found=new Set();
 for(const p of profiles){const name=typeof p?.name==='string'?p.name.toLowerCase():'';if(!names.includes(name)||!uuid.test(p?.id||'')||found.has(name))throw Error('Invalid profile response');found.add(name)}
 return names.map(name=>found.has(name)?result('minecraft',name,'Taken','A matching Java profile exists.',{source:'Mojang public profile registry'}):result('minecraft',name,'Unknown',missing,{code:'unresolved',source:'Mojang public profile registry'}));
}
export function createChecker({fetchImpl=fetch,intervals={},now=Date.now,wait=delay,restrictions=[]}={}){
 const gates=Object.fromEntries(['minecraft','tiktok','snapchat'].map(p=>[p,new Gate(intervals[p]??(p==='minecraft'?1000:2000),now,wait)]));
 const cache=new Map();const circuits=new Map();
 // Optional operator evidence, never inferred from missing profiles. No names ship on this list.
 const evidence=new Map();for(const r of restrictions){if(PLATFORMS[r.platform]&&typeof r.name==='string'&&typeof r.reason==='string'&&r.reason.length&&/^https:\/\//.test(r.source||'')&&Number.isFinite(Date.parse(r.confirmedAt))&&Date.parse(r.confirmedAt)<=now()&&Date.parse(r.expiresAt)>now()&&Date.parse(r.expiresAt)-Date.parse(r.confirmedAt)<=86400000)evidence.set(r.platform+':'+normalize(r.name),r)}
 async function upstream(platform,names,signal,notice){
  const gate=gates[platform];const circuit=circuits.get(platform);if(circuit&&circuit.until>now())return names.map(n=>result(platform,n,'Unknown',circuit.reason,{code:circuit.code,retryAt:new Date(circuit.until).toISOString(),retryable:true}));
  const url=platform==='minecraft'?'https://api.mojang.com/minecraft/profile/lookup/bulk/byname':platform==='tiktok'?'https://www.tiktok.com/@'+encodeURIComponent(names[0]):'https://www.snapchat.com/@'+encodeURIComponent(names[0]);
  for(let attempt=0;attempt<3;attempt++){
   await gate.enter(signal);signal.throwIfAborted();
   try{
    const timeout=AbortSignal.timeout(10000),combined=AbortSignal.any([signal,timeout]);
    const response=await fetchImpl(url,{method:platform==='minecraft'?'POST':'GET',headers:{Accept:platform==='minecraft'?'application/json':'text/html','User-Agent':'FourName/2.0 public-profile-checker',...(platform==='minecraft'?{'Content-Type':'application/json'}:{})},...(platform==='minecraft'?{body:JSON.stringify(names)}:{}),redirect:'error',signal:combined});
    if(response.status===429){
     const cooldown=Math.max(retryAfter(response.headers.get('Retry-After'),now()),1000*2**attempt);gate.throttle(cooldown);await response.body?.cancel();await notice?.({type:'notice',platform,message:'Rate limited. Respecting the platform’s retry window.',retryAt:new Date(gate.cooldown).toISOString()});
     // Never shorten Retry-After. Long windows return retryable results instead of tying up a run.
     if(cooldown<=10000&&attempt<2)continue;
     circuits.set(platform,{until:gate.cooldown,reason:'Rate limited. Retry after the platform cooldown.',code:'throttled'});
     return names.map(n=>result(platform,n,'Unknown','Rate limited. Retry after the platform cooldown.',{code:'throttled',retryable:true,retryAt:new Date(gate.cooldown).toISOString()}));
    }
    if(response.status===401||response.status===403){await response.body?.cancel();const reason='Unable to verify: platform access is restricted. No authentication or challenge bypass attempted.';circuits.set(platform,{until:now()+300000,reason,code:'blocked'});return names.map(n=>result(platform,n,'Unknown',reason,{code:'blocked',retryable:true,retryAt:new Date(now()+300000).toISOString()}))}
    if(platform==='minecraft'){
     if(!response.ok){await response.body?.cancel();throw Error('Upstream HTTP '+response.status)}
     return parseMinecraft(names,JSON.parse(await readBounded(response,65536)));
    }
    if(response.status===404){await response.body?.cancel();return names.map(n=>result(platform,n,'Unknown','Profile not found. This does not prove the username is claimable.',{code:'unresolved'}))}
    if(!response.ok){await response.body?.cancel();throw Error('Upstream HTTP '+response.status)}
    const html=await readBounded(response);combined.throwIfAborted();
    if(publicProfile(platform,html,names[0]))return [result(platform,names[0],'Taken','Exact username found in public profile data.',{source:url})];
    const reason='Unable to verify: public page did not provide a matching profile. It may be private, a challenge, or a changed page format.';
    // An opaque/challenge page opens a short circuit; do not hammer thousands of URLs.
    circuits.set(platform,{until:now()+300000,reason,code:'opaque'});
    return [result(platform,names[0],'Unknown',reason,{code:'opaque',retryable:true,retryAt:new Date(now()+300000).toISOString()})];
   }catch(error){signal.throwIfAborted();if(attempt<2){await wait(500*2**attempt+Math.floor(Math.random()*200),undefined,{signal});continue}const reason='Unable to verify: upstream request failed or returned unexpected data.';circuits.set(platform,{until:now()+30000,reason,code:'transient'});return names.map(n=>result(platform,n,'Unknown',reason,{code:'transient',retryable:true,retryAt:new Date(now()+30000).toISOString()}))}
  }
 }
 async function check(platform,names,signal,notice,refresh=false){
  const rows=[],pending=[];
  for(const raw of names){const name=normalize(raw),key=platform+':'+name,invalid=validate(platform,name),record=evidence.get(key),hit=cache.get(key);
   if(invalid)rows.push(result(platform,name,'Invalid',invalid,{code:'format'}));
   else if(record&&Date.parse(record.expiresAt)>now())rows.push(result(platform,name,'Restricted/Reserved',record.reason,{source:record.source,evidenceConfirmedAt:record.confirmedAt,code:'confirmed-restriction'}));
   else if(platform==='discord')rows.push(result(platform,name,'Unknown',PLATFORMS.discord.capability,{code:'unsupported'}));
   else if(platform==='tiktok'&&(name.length<2||name.length>24))rows.push(result(platform,name,'Unknown','Length outside the commonly implemented 2–24 range; verify TikTok’s current rules in the app.',{code:'rules-uncertain'}));
   else if(hit&&hit.expires>now()&&(!refresh||hit.row.status==='Taken'))rows.push({...hit.row,cached:true});
   else pending.push(name);
  }
  if(pending.length){const fresh=await upstream(platform,pending,signal,notice);for(const row of fresh){if(row.status==='Taken'||row.code==='unresolved'){const key=platform+':'+row.name;cache.delete(key);cache.set(key,{row,expires:now()+(row.status==='Taken'?600000:60000)});if(cache.size>20000)cache.delete(cache.keys().next().value)}rows.push(row)}}
  return rows;
 }
 async function run({names,platforms,refresh=false},signal,emit){
  const unique=[...new Set(names.map(normalize))];await emit({type:'meta',names:unique.length,total:unique.length*platforms.length,platforms});
  // Independent platform workers; at most four per search, with globally paced upstream requests.
  await Promise.all(platforms.map(async platform=>{const size=platform==='minecraft'?10:platform==='discord'?100:1;for(let i=0;i<unique.length;i+=size){signal.throwIfAborted();const rows=await check(platform,unique.slice(i,i+size),signal,notice=>emit(notice),refresh);await emit({type:'results',rows})}}));
  signal.throwIfAborted();await emit({type:'done'});
 }
 return {run,check,gates,cache};
}
export const checker=createChecker();
