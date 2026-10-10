import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteChecker,createConfiguredChecker,withLocalConfigFallback,CheckerError} from '../workers/client.js';
import {createChecker} from '../lookup.js';
import {createApp} from '../server.js';
import worker,{CheckCoordinator} from '../workers/cloudflare.js';
import webWorker,{CheckCoordinator as WebCoordinator} from '../workers/web-kit/worker.js';
const signal=()=>new AbortController().signal;
const row=(platform,name,extra={})=>({platform,name,status:'Taken',reason:'Synthetic regression fixture',checkedAt:new Date().toISOString(),...extra});
const remote=(fetchImpl,extra={})=>createRemoteChecker({url:'https://checker.example/',secret:'x'.repeat(32),fetchImpl,...extra});

test('worker configuration errors recover through the real HTTP stream for each service',async()=>{
 for(const platform of ['minecraft','discord','gitlab','lastfm']){
  let workerCalls=0,upstreamCalls=0;
  const local=createChecker({intervals:{[platform]:0},fetchImpl:async url=>{
   upstreamCalls++;
   if(platform==='minecraft')return Response.json([{name:'notch',id:'069a79f444e94726a5befca90e38aaf5'}]);
   if(platform==='discord')return Response.json({taken:true});
   if(platform==='gitlab')return Response.json({exists:true});
   if(String(url).endsWith('/join'))return new Response('Signup fixture',{headers:{'Set-Cookie':'csrftoken=abc123; Path=/'}});
   return Response.json({userName:{valid:false,error_messages:["Sorry, this username isn't available."]}});
  }});
  const checker=withLocalConfigFallback(remote(async()=>{workerCalls++;return new Response('Unauthorized',{status:401})}),local);
  const server=createApp(checker);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platforms:[platform],names:[platform==='minecraft'?'notch':'testname']})});
   const events=(await r.text()).trim().split('\n').map(JSON.parse);
   assert.equal(events.at(-1).type,'done');assert(events.some(e=>e.type==='notice'&&e.message.includes('CHECK_WORKER_SECRET')));
   assert.equal(events.flatMap(e=>e.rows||[])[0].status,'Taken');assert(upstreamCalls>0);
   await checker.run({platforms:[platform],names:['testname']},signal(),async()=>{});assert.equal(workerCalls,1);
  }finally{await new Promise(r=>server.close(r))}
 }
});

test('missing Cloudflare binding is diagnosed and no secret is exposed',async()=>{
 const r=await worker.fetch(new Request('https://checker.example/',{method:'POST',headers:{Authorization:'Bearer '+'x'.repeat(32)}}),{CHECK_WORKER_SECRET:'x'.repeat(32)});
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{code:'binding-missing'});
 await assert.rejects(remote(async()=>Response.json({code:'binding-missing'},{status:503})).run({names:['testname'],platforms:['discord']},signal(),async()=>{}),e=>e.code==='worker-config'&&e.publicMessage.includes('CHECKS')&&!e.publicMessage.includes('x'.repeat(32)));
 const web=await webWorker.fetch(new Request('https://checker.example/',{method:'POST',headers:{Authorization:'Bearer '+'x'.repeat(32)}}),{CHECK_WORKER_SECRET:'x'.repeat(32)});assert.equal(web.status,503);assert.deepEqual(await web.json(),{code:'binding-missing'});
 const ctx={storage:{get:async()=>undefined,put:async()=>{}},blockConcurrencyWhile:fn=>fn()};const coordinator=new WebCoordinator(ctx,{});coordinator.engine={gates:{},check:async(platform,names)=>names.map(name=>row(platform,name))};const reply=await coordinator.fetch(new Request('https://checker.example/',{method:'POST',body:JSON.stringify({platforms:['discord'],names:['testname']})}));assert.equal(reply.status,200);assert.equal((await reply.json()).rows[0].status,'Taken');
});

test('worker busy and platform cooldowns retry the same batch after the complete wait',async()=>{
 for(const kind of ['worker','platform']){
  let clock=Date.parse('2026-10-10T10:00:00Z'),calls=0;const bodies=[],events=[];
  const checker=remote(async(url,options)=>{bodies.push(JSON.parse(options.body));calls++;return calls===1?(kind==='worker'?new Response('Busy',{status:429,headers:{'Retry-After':new Date(clock+90000).toUTCString()}}):Response.json({rows:[row('discord','testname',{status:'Unknown',code:'throttled',retryAt:new Date(clock+90000).toISOString()})]})):Response.json({rows:[row('discord','testname')]})},{now:()=>clock,sleep:async(ms,s)=>{s.throwIfAborted();clock+=ms}});
  const start=clock;await checker.run({names:['testname'],platforms:['discord']},signal(),async e=>events.push(e));
  assert.equal(clock-start,90000);assert.equal(calls,2);assert.deepEqual(bodies[0],bodies[1]);assert.equal(events.filter(e=>e.type==='results').length,1);assert.equal(events.at(-1).type,'done');assert(events.some(e=>e.waiting===true));
 }
});

test('worker cancellation during cooldown launches no subsequent request or local fallback',async()=>{
 let calls=0,localCalls=0;const controller=new AbortController();const events=[];
 const checker=withLocalConfigFallback(remote(async()=>{calls++;return new Response('Busy',{status:429,headers:{'Retry-After':'90'}})},{sleep:async()=>controller.abort()}),{run:async()=>localCalls++});
 await assert.rejects(checker.run({names:['testname','nextname'],platforms:['discord']},controller.signal,async e=>events.push(e)),e=>e.name==='AbortError');
 assert.equal(calls,1);assert.equal(localCalls,0);assert(!events.some(e=>e.rows));
});

test('upstream failures and configuration changes after partial results never switch checkers',async()=>{
 for(const status of [403,500,502]){
  let localCalls=0;const checker=withLocalConfigFallback(remote(async()=>new Response('Error',{status})),{run:async()=>localCalls++});
  await assert.rejects(checker.run({names:['testname'],platforms:['discord']},signal(),async()=>{}),CheckerError);assert.equal(localCalls,0);
 }
 let calls=0,localCalls=0;const events=[];const checker=withLocalConfigFallback(remote(async()=>++calls===1?Response.json({rows:[row('discord','testname')]}):new Response('Unauthorized',{status:401})),{run:async()=>localCalls++});
 await assert.rejects(checker.run({names:['testname','nextname'],platforms:['discord']},signal(),async e=>events.push(e)),e=>e.code==='worker-config'&&!e.beforeChecks);assert.equal(localCalls,0);assert.equal(events.flatMap(e=>e.rows||[]).length,1);
 const blocked=withLocalConfigFallback(remote(async()=>Response.json({rows:[row('discord','testname',{status:'Unknown',code:'blocked'})]})),{run:async()=>localCalls++});const blockedEvents=[];await blocked.run({names:['testname'],platforms:['discord']},signal(),async e=>blockedEvents.push(e));assert.equal(localCalls,0);assert.equal(blockedEvents.at(-1).type,'error');
 let healthy=true;const used=withLocalConfigFallback(remote(async()=>healthy?Response.json({rows:[row('discord','testname')]}):new Response('Unauthorized',{status:401})),{run:async()=>localCalls++});await used.run({names:['testname'],platforms:['discord']},signal(),async()=>{});healthy=false;await assert.rejects(used.run({names:['testname'],platforms:['discord']},signal(),async()=>{}),CheckerError);assert.equal(localCalls,0);
});

test('per-service worker routes use only the selected route and keep secrets server-side',async()=>{
 const calls=[],local=[];const checker=createConfiguredChecker({CHECK_WORKER_URL:'https://shared.example/',CHECK_WORKER_SECRET:'s'.repeat(32),CHECK_WORKER_MINECRAFT_URL:'https://minecraft.example/',CHECK_WORKER_DISCORD_URL:'https://discord.example/',CHECK_WORKER_DISCORD_SECRET:'d'.repeat(32)},{local:{run:async job=>local.push(job)},fetchImpl:async(url,options)=>{const job=JSON.parse(options.body);calls.push({url:String(url),authorization:options.headers.Authorization});return Response.json({rows:job.names.map(name=>row(job.platforms[0],name))})}});
 for(const p of ['minecraft','discord','lastfm','gitlab'])await checker.run({platforms:[p],names:['testname']},signal(),async()=>{});
 assert.deepEqual(calls.map(c=>c.url),['https://minecraft.example/','https://discord.example/','https://shared.example/','https://shared.example/']);assert.equal(calls[1].authorization,'Bearer '+'d'.repeat(32));assert.equal(local.length,0);
});

test('remote Minecraft overlaps only two batches and emits no duplicate meta or rows',async()=>{
 let active=0,max=0;const batches=[],events=[];const checker=remote(async(url,options)=>{max=Math.max(max,++active);const job=JSON.parse(options.body);batches.push(job.names);await new Promise(r=>setTimeout(r,15));active--;return Response.json({rows:job.names.map(name=>row('minecraft',name))})});const names=Array.from({length:40},(_,i)=>'test'+i);await checker.run({names,platforms:['minecraft']},signal(),async e=>events.push(e));assert.equal(max,2);assert(batches.every(b=>b.length<=10));assert.equal(events.filter(e=>e.type==='meta').length,1);assert.equal(events.filter(e=>e.type==='done').length,1);assert.equal(new Set(events.flatMap(e=>e.rows||[]).map(r=>r.name)).size,40);
});

test('shared worker allows different services concurrently and bounds Minecraft admission',async()=>{
 const ctx={storage:{get:async()=>undefined,put:async()=>{}},blockConcurrencyWhile:fn=>fn()},coordinator=new CheckCoordinator(ctx,{});const releases=[];coordinator.engine={gates:{},check:async(platform,names)=>{await new Promise(r=>releases.push(r));return names.map(name=>row(platform,name))}};
 const request=p=>new Request('https://checker.example/',{method:'POST',body:JSON.stringify({platforms:[p],names:['testname']})});
 const pending=[coordinator.fetch(request('minecraft')),coordinator.fetch(request('minecraft')),coordinator.fetch(request('discord')),coordinator.fetch(request('gitlab'))];while(releases.length<4)await new Promise(r=>setTimeout(r,1));assert.equal((await coordinator.fetch(request('minecraft'))).status,429);assert.equal((await coordinator.fetch(request('discord'))).status,429);releases.forEach(r=>r());assert((await Promise.all(pending)).every(r=>r.status===200));
 const dedicated=new CheckCoordinator(ctx,{CHECK_SERVICE:'discord'});assert.equal((await dedicated.fetch(request('minecraft'))).status,400);
});
