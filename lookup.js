const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
let nextBulkRequest=0;
let individualEndpoint='',individualValidUntil=0,nextIndividualRequest=0,bulkDeniedUntil=0;
const validProfile=(p,name)=>p&&typeof p.name==='string'&&p.name.toLowerCase()===name&&typeof p.id==='string'&&/^[0-9a-f]{32}$/i.test(p.id);
async function getIndividual(base,name){
 const slot=Math.max(Date.now(),nextIndividualRequest);nextIndividualRequest=slot+700;
 if(slot>Date.now())await new Promise(r=>setTimeout(r,slot-Date.now()));
 const url=base+name;
 const response=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'FourName/11.0'},signal:AbortSignal.timeout(5000)});
 if(response.status===429){const raw=response.headers.get('Retry-After'),seconds=Number(raw),date=Date.parse(raw);throw {rate:true,seconds:Math.max(1,Math.min(900,Math.ceil(raw&&Number.isFinite(seconds)?seconds:Number.isFinite(date)?(date-Date.now())/1000:60)))}}
 let body;try{body=await response.json()}catch{throw Error(new URL(base).hostname+' GET HTTP '+response.status+' invalid JSON')}
 if(response.status===200&&validProfile(body,name))return {name,taken:true,profile:body};
 if(response.status===404&&body.path===new URL(url).pathname&&body.errorMessage==="Couldn't find any profile with name "+name)return {name,taken:false};
 throw Error(new URL(base).hostname+' GET HTTP '+response.status+(response.ok?' invalid profile':''));
}
async function individualFallback(names,failures){
 try{
  if(!individualEndpoint||Date.now()>individualValidUntil){
   individualEndpoint='';
   for(const base of ['https://api.minecraftservices.com/minecraft/profile/lookup/name/','https://api.mojang.com/users/profiles/minecraft/']){
    try{const probe=await getIndividual(base,'notch');if(!probe.taken||probe.profile.id.toLowerCase()!=='069a79f444e94726a5befca90e38aaf5')throw Error('Known-profile verification failed');individualEndpoint=base;individualValidUntil=Date.now()+300000;break}catch(error){if(error.rate)throw error;failures.push(error.message||'GET probe failed')}
   }
   if(!individualEndpoint)return null;
  }
  const replies=await Promise.allSettled(names.map(name=>getIndividual(individualEndpoint,name)));
  const rate=replies.find(r=>r.status==='rejected'&&r.reason.rate);if(rate)return json(429,{error:'Waiting for Minecraft.',retry_after:rate.reason.seconds});
  const failure=replies.find(r=>r.status==='rejected');if(failure){individualValidUntil=0;failures.push(failure.reason.message||'Individual lookup failed');return null}
  const checked_at=new Date().toISOString();return json(200,{lookup_mode:'individual',results:replies.filter(r=>!r.value.taken).map(r=>({name:r.value.name,status:'unclaimed',checked_at}))});
 }catch(error){if(error.rate)return json(429,{error:'Waiting for Minecraft.',retry_after:error.seconds});individualValidUntil=0;failures.push(error.message||'Individual lookup failed');return null}
}

async function onRequestPost({request}) {
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json(403,{error:'Use this site to search.'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json(415,{error:'Expected JSON.'});
 const raw=await request.text();if(raw.length>1024)return json(413,{error:'Batch too large.'});let names;
 try{names=JSON.parse(raw).names}catch{return json(400,{error:'Invalid JSON.'})}
 if(!Array.isArray(names)||!names.length||names.length>10||names.some(n=>typeof n!=='string'||!/^[a-z0-9_]{3,7}$/.test(n))||new Set(names).size!==names.length)return json(400,{error:'Send 1–10 distinct names.'});
 const endpoints=[
  'https://api.mojang.com/minecraft/profile/lookup/bulk/byname',
  'https://api.minecraftservices.com/minecraft/profile/lookup/bulk/byname',
  'https://api.mojang.com/profiles/minecraft'
 ];
 const failures=[];
 for(const endpoint of (Date.now()<bulkDeniedUntil?[]:endpoints)){
  try{
   const slot=Math.max(Date.now(),nextBulkRequest);if(slot-Date.now()>10000)return json(429,{error:'Checker busy. Waiting to resume.',retry_after:10});nextBulkRequest=slot+700;if(slot>Date.now())await new Promise(r=>setTimeout(r,slot-Date.now()));
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'FourName/10.0'},body:JSON.stringify(names),signal:AbortSignal.timeout(5000)});
   if(response.status===429){const header=response.headers.get('Retry-After');const seconds=Number(header);const date=Date.parse(header);const retry=header&&Number.isFinite(seconds)?seconds:Number.isFinite(date)?(date-Date.now())/1000:60;return json(429,{error:'Waiting for Minecraft.',retry_after:Math.max(1,Math.min(900,Math.ceil(retry)))})}
   const host=new URL(endpoint).hostname;
   if(!response.ok){failures.push(host+' HTTP '+response.status);continue}
   let profiles;try{profiles=await response.json()}catch{failures.push(host+' invalid JSON');continue}
   if(!Array.isArray(profiles)||profiles.length>names.length){failures.push(host+' invalid response');continue}
   const taken=new Set();let valid=true;
   for(const p of profiles){if(!p||typeof p.name!=='string'||!names.includes(p.name.toLowerCase())||typeof p.id!=='string'||!/^[0-9a-f]{32}$/i.test(p.id)||taken.has(p.name.toLowerCase())){valid=false;break}taken.add(p.name.toLowerCase())}
   if(!valid){failures.push(host+' invalid profile');continue}
   const checked_at=new Date().toISOString();return json(200,{results:names.filter(n=>!taken.has(n)).map(name=>({name,status:'unclaimed',checked_at}))});
  }catch(error){failures.push(new URL(endpoint).hostname+(error.name==='TimeoutError'||error.name==='AbortError'?' timed out':' connection failed'))}
 }
 if(failures.length===3&&failures.every(message=>message.includes('HTTP 403')))bulkDeniedUntil=Date.now()+300000;
 const individual=await individualFallback(names,failures);if(individual)return individual;
 return json(502,{error:'Minecraft lookup unavailable: '+failures.join('; ')+'. No names were accepted.',upstream_failures:failures});

}
const onRequestGet=()=>json(405,{error:'Use POST.'});

export async function checkRequest(request){return onRequestPost({request});}
