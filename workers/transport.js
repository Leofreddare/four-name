// The optional Worker transports public upstream responses; the app owns classification.
import {readBounded} from '../lookup.js';
export function upstreamService(url){
 const u=new URL(url);if(u.protocol!=='https:'||u.port&&u.port!=='443'||u.username||u.password||u.search||u.hash)return null;
 if(u.hostname==='api.mojang.com'&&u.pathname==='/minecraft/profile/lookup/bulk/byname')return 'minecraft';
 if(u.hostname==='discord.com'&&u.pathname==='/api/v9/unique-username/username-attempt-unauthed')return 'discord';
 if(u.hostname==='gitlab.com'&&/^\/users\/[a-z0-9_.%-]+\/exists$/.test(u.pathname))return 'gitlab';
 if(u.hostname==='www.last.fm'&&['/join','/join/partial/validate'].includes(u.pathname))return 'lastfm';
 return null;
}
const allowedHeaders=new Set(['accept','accept-language','content-type','user-agent','x-requested-with','referer','cookie']);
export function validateTransport(job){
 if(job?.protocol!=='four-name-transport-v1'||!upstreamService(job.url)||job.platform!==upstreamService(job.url)||!['GET','POST'].includes(job.method)||typeof job.headers!=='object'||!job.headers||Array.isArray(job.headers)||Object.entries(job.headers).some(([k,v])=>!allowedHeaders.has(k.toLowerCase())||typeof v!=='string'||v.length>1024)||job.body!==undefined&&(typeof job.body!=='string'||job.body.length>2048))throw Error('Invalid transport request');
 const u=new URL(job.url),method=job.platform==='gitlab'||u.pathname==='/join'?'GET':'POST';if(job.method!==method)throw Error('Invalid transport method');
 for(const [k,v] of Object.entries(job.headers))if(k.toLowerCase()==='cookie'&&(job.platform!=='lastfm'||!/^csrftoken=[a-zA-Z0-9]+$/.test(v)))throw Error('Invalid anonymous session');
 if(job.platform==='minecraft'){let names;try{names=JSON.parse(job.body)}catch{}if(!Array.isArray(names)||!names.length||names.length>10||names.some(n=>typeof n!=='string'||!/^[a-z0-9_]{3,16}$/.test(n)))throw Error('Invalid Minecraft batch')}
 if(job.platform==='discord'){let data;try{data=JSON.parse(job.body)}catch{}if(!data||Object.keys(data).length!==1||typeof data.username!=='string'||!/^[a-z0-9_.]{2,32}$/.test(data.username)||data.username.includes('..'))throw Error('Invalid Discord username')}
 return job;
}
export async function forwardPublicRequest(job,signal,fetchImpl=fetch){
 validateTransport(job);
 const response=await fetchImpl(job.url,{method:job.method,headers:job.headers,body:job.body,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
 const headers={};for(const name of ['content-type','retry-after','x-ratelimit-remaining','x-ratelimit-reset-after'])if(response.headers.has(name))headers[name]=response.headers.get(name);
 const cookies=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')].filter(Boolean);if(cookies.length)headers['set-cookie']=cookies;
 return {status:response.status,headers,body:await readBounded(response,512000)};
}
export function createBoostFetch(env,{fetchImpl=fetch,onConfigError=()=>{}}={}){
 const disabled=new Set(),used=new Set();
 return async(url,options={})=>{
  const platform=upstreamService(url);if(!platform)return fetchImpl(url,options);
  const key='CHECK_WORKER_'+platform.toUpperCase(),endpoint=env[key+'_URL']||env.CHECK_WORKER_URL,secret=env[key+'_SECRET']||env.CHECK_WORKER_SECRET;
  if(!endpoint||disabled.has(platform))return fetchImpl(url,options);
  if(new URL(endpoint).protocol!=='https:'||!secret||secret.length<32)throw Error('Invalid checking worker configuration');
  const job={protocol:'four-name-transport-v1',platform,url:String(url),method:options.method||'GET',headers:options.headers||{},...(options.body?{body:String(options.body)}:{})};validateTransport(job);
  const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify(job),signal:options.signal,redirect:'error'});
  const text=await readBounded(response,2100000);let data;try{data=JSON.parse(text)}catch{}
  // An older row-classifying Worker cannot accept this protocol. It has made no upstream call.
  if(!used.has(platform)&&([401,404,405].includes(response.status)||response.status===400||data?.code==='binding-missing')){disabled.add(platform);onConfigError(platform);return fetchImpl(url,options)}
  used.add(platform);
  if(response.status===429)return new Response('',{status:429,headers:{'Retry-After':response.headers.get('Retry-After')||'2'}});
  if(!response.ok||data?.protocol!=='four-name-transport-v1'||!data.upstream||!Number.isInteger(data.upstream.status)||data.upstream.status<200||data.upstream.status>599||typeof data.upstream.body!=='string'||!data.upstream.headers||typeof data.upstream.headers!=='object')throw Error('Worker transport failed; no availability evidence accepted');
  const headers=new Headers();for(const [k,v] of Object.entries(data.upstream.headers)){if(!['content-type','retry-after','x-ratelimit-remaining','x-ratelimit-reset-after','set-cookie'].includes(k.toLowerCase()))continue;if(Array.isArray(v))v.forEach(value=>headers.append(k,value));else headers.set(k,v)}
  return new Response([204,205,304].includes(data.upstream.status)?null:data.upstream.body,{status:data.upstream.status,headers});
 };
}
