import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChecker,parseMinecraft,parseSignup,gitlabRestriction,retryAfter,Gate,readBounded,parseDiscord} from '../lookup.js';
import {validate,normalize} from '../platforms.js';
import {createApp,validateJob} from '../server.js';
const id='069a79f444e94726a5befca90e38aaf5';
const signal=()=>new AbortController().signal;
const instant=async()=>{};
const checker=options=>createChecker({intervals:{minecraft:0,gitlab:0,lastfm:0,discord:0},wait:instant,...options});
test('username format policies, display names, case and platform differences',()=>{
 assert.equal(normalize('  NoTcH '),'notch');assert(validate('minecraft','ab'));assert.equal(validate('minecraft','a'.repeat(16)),null);assert(validate('minecraft','a'.repeat(17)));assert(validate('minecraft','ab.c'));
 assert.equal(validate('discord','.a.b.'),null);assert(validate('discord','a..b'));assert(validate('discord','old#1234'));assert(validate('discord','display name'));assert.equal(validate('discord','a'.repeat(32)),null);
 assert.equal(validate('lastfm','ab-1c'),null);assert(validate('lastfm','1abc'));assert(validate('lastfm','a.b'));assert(validate('lastfm','a'.repeat(16)));
 assert.equal(validate('gitlab','a_b'),null);assert(validate('gitlab','_abc'));assert(validate('gitlab','abc.'));assert(validate('gitlab','a.png'));assert.equal(validate('gitlab','a'.repeat(255)),null);assert(validate('gitlab','a'.repeat(256)));
});
test('Minecraft missing, released, locked and reserved candidates never become Available',()=>{
 const rows=parseMinecraft(['notch','released_fixture','locked_fixture','reserve_fixture'],[{name:'Notch',id}]);assert.deepEqual(rows.map(r=>r.status),['Taken','Unknown','Unknown','Unknown']);assert(rows.every(r=>r.status!=='Available'));
 for(const data of [null,{},[{name:'other',id}],[{name:'notch',id:'bad'}],[{name:'notch',id},{name:'notch',id}]])assert.throws(()=>parseMinecraft(['notch','other2'],data));
});
test('confirmed restriction evidence is exact, sourced and expiring; invented/expired records ignored',async()=>{
 const now=Date.now(),record={platform:'minecraft',name:'locked_fixture',reason:'Test fixture: restriction explicitly confirmed by operator.',source:'https://example.test/evidence',confirmedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+10000).toISOString()};let time=now,calls=0;
 const c=checker({now:()=>time,restrictions:[record,{...record,name:'bad_fixture',source:'not a source'}],fetchImpl:async()=>{calls++;return Response.json([])}});
 let rows=await c.check('minecraft',['locked_fixture','bad_fixture'],signal());assert.equal(rows[0].status,'Restricted/Reserved');assert.equal(rows[1].status,'Unknown');assert.equal(calls,1);time+=11000;rows=await c.check('minecraft',['locked_fixture'],signal());assert.equal(rows[0].status,'Unknown');
});
test('signup adapters require explicit affirmative evidence, not profile absence or echoed success messages',async()=>{
 assert.equal(parseSignup('gitlab','nova',{exists:true}).status,'Taken');assert.equal(parseSignup('gitlab','freshfixture',{exists:false}).status,'Available');
 assert.equal(parseSignup('lastfm','freshfixture',{userName:{valid:true,success_message:'Ok, that username can be yours!'}}).status,'Available');
 assert.equal(parseSignup('lastfm','rj',{userName:{valid:false,success_message:'Ok, that username can be yours!',error_messages:["Sorry, this username isn't available."]}}).status,'Taken');
 for(const data of [{},{exists:'false'},{exists:false,challenge:true}])assert.throws(()=>parseSignup('gitlab','nova',data));
 for(const data of [{},{userName:{valid:true}},{userName:{valid:false,success_message:'Ok, that username can be yours!'}},{userName:{valid:true,success_message:'Ok, that username can be yours!',error_messages:['challenge']}}])assert.throws(()=>parseSignup('lastfm','nova',data));
 const c=checker({fetchImpl:async()=>Response.json({exists:false})});assert.equal((await c.check('gitlab',['freshfixture'],signal()))[0].status,'Available');assert.equal((await c.check('gitlab',['help','duo_bot'],signal()))[0].status,'Restricted/Reserved');assert((await c.check('gitlab',['name.unknown','page-abcdef'],signal())).every(r=>r.status==='Unknown'));assert(gitlabRestriction('admin.json'));
});
test('caching preserves observed timestamps; transient failures are not availability evidence',async()=>{
 let time=Date.now(),calls=0;const c=checker({now:()=>time,fetchImpl:async()=>{calls++;return Response.json([{name:'notch',id}])}});const a=(await c.check('minecraft',['notch','unknown'],signal()));const b=await c.check('minecraft',['notch','unknown'],signal());assert.equal(calls,1);assert(b.every(r=>r.cached));assert.equal(a[0].checkedAt,b[0].checkedAt);time+=60001;await c.check('minecraft',['unknown'],signal());assert.equal(calls,4); // malformed reply, three attempts
 assert(!c.cache.has('minecraft:unknown')||c.cache.get('minecraft:unknown').expires<time);
});
test('throttling honors numeric/date Retry-After and platform cooldown; no fallback bypass',async()=>{
 const now=1700000000000;assert.equal(retryAfter('120',now),120000);assert.equal(retryAfter(new Date(now+90000).toUTCString(),now),90000);assert.equal(retryAfter(null,now),60000);
 let calls=0;const c=checker({now:()=>now,fetchImpl:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}})}});const events=[];const rows=await c.check('minecraft',['notch'],signal(),e=>events.push(e));assert.equal(rows[0].code,'throttled');assert.equal(Date.parse(rows[0].retryAt),now+120000);await c.check('minecraft',['nova'],signal());assert.equal(calls,1);assert.equal(events.length,1);
 let shortCalls=0,time=now;const short=checker({now:()=>time,wait:async ms=>{time+=ms},fetchImpl:async()=>++shortCalls===1?new Response('',{status:429,headers:{'Retry-After':'1'}}):Response.json([])});assert.equal((await short.check('minecraft',['nova'],signal()))[0].status,'Unknown');assert.equal(shortCalls,2);assert(time>=now+1000);
 for(const status of [401,403]){let attempts=0;const blocked=checker({fetchImpl:async()=>{attempts++;return new Response('',{status})}});assert.equal((await blocked.check('minecraft',['notch'],signal()))[0].code,'blocked');await blocked.check('minecraft',['nova'],signal());assert.equal(attempts,1)}
});
test('5xx/network/malformed failures use bounded backoff and never availability',async()=>{
 for(const response of [()=>new Response('bad',{status:503}),()=>Response.json({}),()=>{throw Error('network')}]){let attempts=0;const waits=[];const c=checker({wait:async ms=>waits.push(ms),fetchImpl:async()=>{attempts++;return response()}});const rows=await c.check('minecraft',['nova'],signal());assert.equal(attempts,3);assert.equal(rows[0].code,'transient');assert.equal(rows[0].status,'Unknown');assert.equal(c.cache.size,0);assert.equal(waits.length,2);assert(waits[1]>waits[0])}
});
test('cancellation interrupts active fetch, pacing waits and queued gate admission',async()=>{
 const controller=new AbortController();let called;const started=new Promise(r=>called=r);const c=checker({fetchImpl:async(url,{signal})=>{called();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}});const task=c.check('minecraft',['nova'],controller.signal);await started;controller.abort();await assert.rejects(task,{name:'AbortError'});
 const gate=new Gate(10000);await gate.enter(signal());const waitController=new AbortController(),queueController=new AbortController();const waiting=gate.enter(waitController.signal),queued=gate.enter(queueController.signal);queueController.abort();await assert.rejects(queued,{name:'AbortError'});waitController.abort();await assert.rejects(waiting,{name:'AbortError'});gate.next=0;await gate.enter(signal());
});
test('bounded response reader rejects oversized public HTML',async()=>{await assert.rejects(readBounded(new Response('a'.repeat(100)),10),/too large/)});
test('streaming run deduplicates names, preserves every status and scales to 10,000 names',async()=>{
 let calls=0;const c=checker({fetchImpl:async url=>{calls++;return Response.json(url.includes('discord.com')?{taken:false}:[])}});const events=[];await c.run({names:['Nova',' nova ','bad name'],platforms:['minecraft','discord']},signal(),async e=>events.push(e));assert.equal(events[0].total,4);assert.equal(events.at(-1).type,'done');const rows=events.flatMap(e=>e.rows||[]);assert.equal(rows.length,4);assert.equal(calls,2);assert.equal(rows.filter(r=>r.status==='Invalid').length,2);
 const start=performance.now();let count=0;await c.run({names:Array.from({length:10000},(_,i)=>'name'+i),platforms:['discord']},signal(),async e=>{count+=e.rows?.length||0});assert.equal(count,10000);assert(performance.now()-start<2000);
});
test('HTTP serving, request validation, streaming and disconnect cancellation',async()=>{
 assert.throws(()=>validateJob({names:['abc'],platforms:['unknown']}));assert.throws(()=>validateJob({names:['abc'],platforms:['minecraft','discord']}),/exactly one/);assert.throws(()=>validateJob({names:Array.from({length:2001},(_,i)=>'n'+i),platforms:['gitlab']}));assert.deepEqual(validateJob({names:['Nova',' nova '],platforms:['discord']}),{names:['nova'],platforms:['discord']});
 let aborted;const cancelled=new Promise(r=>aborted=r);const engine={run:async(job,signal,emit)=>{await emit({type:'meta',names:1,total:1});if(job.names[0]==='cancel'){await new Promise(r=>signal.addEventListener('abort',()=>{aborted();r()},{once:true}));return}await emit({type:'results',rows:[{name:job.names[0],platform:'discord',status:'Unknown'}]});await emit({type:'done'})}};const server=createApp(engine);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/health')).status,200);const response=await fetch(base+'/');assert(response.headers.get('content-security-policy').includes("script-src 'self';"));assert((await response.text()).includes('Four Name'));assert.equal((await fetch(base+'/server.js')).status,404);for(const path of ['/app.js','/platforms.js','/styles.css','/generator-worker.js','/service-icons/minecraft.png','/service-icons/discord.svg','/service-icons/gitlab.svg','/service-icons/lastfm.svg'])assert.equal((await fetch(base+path)).status,200);assert.equal((await fetch(base+'/api/check')).status,405);
 const post=(body,headers={})=>fetch(base+'/api/check',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await post({names:['abc'],platforms:['discord']},{Origin:'https://evil.test'})).status,403);assert.equal((await post({names:['abc'],platforms:['bad']})).status,400);const stream=await post({names:['nova'],platforms:['discord']});assert.equal(stream.status,200);assert.equal(stream.headers.get('content-type'),'application/x-ndjson; charset=utf-8');const lines=(await stream.text()).trim().split('\n').map(JSON.parse);assert.deepEqual(lines.map(e=>e.type),['meta','results','done']);await new Promise(r=>setTimeout(r,1050));const ctrl=new AbortController();const pending=await fetch(base+'/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:['cancel'],platforms:['discord']}),signal:ctrl.signal});const reader=pending.body.getReader();await reader.read();ctrl.abort();await Promise.race([cancelled,new Promise((_,reject)=>setTimeout(()=>reject(Error('disconnect did not cancel')),2000))]);
 }finally{server.cancelSearches();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
test('manual retry refreshes unresolved cache while retaining Taken observations',async()=>{
 let calls=0;const c=checker({fetchImpl:async()=>{calls++;return Response.json([{name:'notch',id}])}});await c.check('minecraft',['notch','nova'],signal());await c.check('minecraft',['notch','nova'],signal(),null,true);assert.equal(calls,4); // retry only nova: mismatching fixture triggers three fail-closed attempts
 const fresh=checker({fetchImpl:async()=>{calls++;return Response.json([])}});await fresh.check('minecraft',['nova'],signal());const before=calls;await fresh.check('minecraft',['nova'],signal(),null,true);assert.equal(calls,before+1);
});
test('globally paced gate rechecks a newly raised cooldown before admission',async()=>{
 let now=0,waits=[];const gate=new Gate(100,()=>now,async ms=>{waits.push(ms);now+=ms;if(waits.length===1)gate.throttle(300)});await gate.enter(signal());await gate.enter(signal());assert.deepEqual(waits,[100,300]);assert.equal(now,400);
});
test('restored pause control holds completed batches and stops new checks until resume',async()=>{
 let release,started;const firstStarted=new Promise(r=>started=r);let calls=0;
 const c=checker({fetchImpl:async()=>{calls++;if(calls===1){started();await new Promise(r=>release=r)}return Response.json([])}});
 const server=createApp(c);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const response=await fetch(base+'/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:Array.from({length:20},(_,i)=>'name'+i),platforms:['minecraft']})});const reader=response.body.getReader();let raw=new TextDecoder().decode((await reader.read()).value);const meta=JSON.parse(raw.trim().split('\n')[0]);assert(meta.jobId);await firstStarted;
 const control=async(action,jobId=meta.jobId)=>fetch(base+'/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,jobId})});assert.equal((await control('pause','missing')).status,404);assert.equal((await control('pause')).status,200);release();await new Promise(r=>setTimeout(r,30));assert.equal(calls,1);assert.equal((await control('resume')).status,200);for(;;){const part=await reader.read();if(part.done)break;raw+=new TextDecoder().decode(part.value)}assert.equal(calls,2);const events=raw.trim().split('\n').map(JSON.parse);assert.equal(events.filter(e=>e.type==='results').length,2);assert.equal(events.at(-1).type,'done');
 }finally{server.cancelSearches();server.closeAllConnections();await new Promise(r=>server.close(r))}
});

test('Discord explicit signup evidence, reserved rejection and changed/challenge schemas',async()=>{
 assert.equal(parseDiscord('nova',200,{taken:true}).status,'Taken');
 assert.equal(parseDiscord('freshfixture',200,{taken:false}).status,'Available');
 const rejection=code=>({code:50035,errors:{username:{_errors:[{code,message:'Platform rejection'}]}}});
 assert.equal(parseDiscord('discordtest',400,rejection('USERNAME_INVALID_CONTAINS')).status,'Restricted/Reserved');
 assert.equal(parseDiscord('bad',400,rejection('USERNAME_INVALID_CHARACTERS')).status,'Invalid');
 for(const data of [{},{taken:0},{taken:'false'},{taken:false,captcha_key:['challenge']}])assert.throws(()=>parseDiscord('nova',200,data));
 assert.throws(()=>parseDiscord('nova',400,rejection('NEW_UNRECOGNIZED_ERROR')));
 let calls=0,time=Date.now();const c=checker({now:()=>time,fetchImpl:async(url,options)=>{calls++;assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{username:'freshfixture'});assert(!options.headers.Authorization);return Response.json({taken:false})}});
 const first=(await c.check('discord',['freshfixture'],signal()))[0];assert.equal(first.status,'Available');assert((await c.check('discord',['freshfixture'],signal()))[0].cached);assert.equal(calls,1);time+=15001;await c.check('discord',['freshfixture'],signal());assert.equal(calls,2);await c.check('discord',['freshfixture'],signal(),null,true);assert.equal(calls,3);
 const multi=checker({fetchImpl:async()=>Response.json({taken:false})});assert.equal((await multi.check('discord',['firstfixture','secondfixture'],signal())).length,2);
});
test('Discord JSON retry windows and exhausted rate headers control the shared gate',async()=>{
 let time=1700000000000,calls=0;const limited=checker({now:()=>time,fetchImpl:async()=>{calls++;return Response.json({retry_after:90},{status:429})}});
 const row=(await limited.check('discord',['freshfixture'],signal()))[0];assert.equal(row.code,'throttled');assert.equal(Date.parse(row.retryAt),time+90000);await limited.check('discord',['otherfixture'],signal());assert.equal(calls,1);
 const pauses=[];const paced=checker({now:()=>time,wait:async ms=>{pauses.push(ms);time+=ms},fetchImpl:async()=>Response.json({taken:false},{headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset-after':'4.5'}})});
 await paced.check('discord',['freshfixture'],signal());await paced.check('discord',['otherfixture'],signal());assert.deepEqual(pauses,[4500]);
});

test('long Discord throttling retries the same name after the full window and streams only checked results',async()=>{
 let time=1700000000000;const start=time,calls=[],pauses=[],events=[];
 const c=checker({now:()=>time,wait:async ms=>{assert(ms<=30000);pauses.push(ms);time+=ms},fetchImpl:async(url,options)=>{calls.push({name:JSON.parse(options.body).username,time});return calls.length===1?Response.json({retry_after:90},{status:429,headers:{'Retry-After':'60'}}):Response.json({taken:false})}});
 await c.run({names:['firstfixture','secondfixture'],platforms:['discord']},signal(),async e=>events.push(e));
 assert.deepEqual(calls.map(c=>c.name),['firstfixture','firstfixture','secondfixture']);assert(calls[1].time>=start+90000);assert.equal(events.at(-1).type,'done');assert(events.some(e=>e.waiting===true));assert(events.some(e=>e.waiting===false));assert.equal(events.flatMap(e=>e.rows||[]).length,2);assert(events.flatMap(e=>e.rows||[]).every(r=>r.status==='Available'));assert(pauses.length>=3);
});
test('cooldown waits can be cancelled and paused before retry without checking later names',async()=>{
 let notifyWait,release;const waiting=new Promise(r=>notifyWait=r);const controller=new AbortController();let calls=0;
 const c=checker({fetchImpl:async()=>{calls++;return Response.json({retry_after:90},{status:429})},wait:async(ms,unused,{signal})=>{notifyWait();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}});
 const task=c.run({names:['firstfixture','secondfixture'],platforms:['discord']},controller.signal,async()=>{});await waiting;controller.abort();await assert.rejects(task,{name:'AbortError'});assert.equal(calls,1);
 let time=1700000000000,paused=false,checked=0;const held=new Promise(r=>release=r),seen=[];
 const pausedChecker=checker({now:()=>time,wait:async ms=>{time+=ms;paused=true},fetchImpl:async()=>++checked===1?Response.json({retry_after:60},{status:429}):Response.json({taken:false})});
 const run=pausedChecker.run({names:['firstfixture'],platforms:['discord']},signal(),async e=>seen.push(e),async()=>{if(paused)await held});await new Promise(r=>setTimeout(r,10));assert.equal(checked,1);paused=false;release();await run;assert.equal(checked,2);assert.equal(seen.at(-1).type,'done');
});
test('blocked searches halt without counting the unrequested tail; unsupported social scans fail immediately',async()=>{
 let calls=0;const c=checker({fetchImpl:async()=>{calls++;return new Response('',{status:403})}}),events=[];
 await c.run({names:['firstfixture','secondfixture','thirdfixture'],platforms:['discord']},signal(),async e=>events.push(e));assert.equal(calls,1);assert.equal(events.flatMap(e=>e.rows||[]).length,0);assert.equal(events.at(-1).type,'error');assert(!events.some(e=>e.type==='done'));
 assert.throws(()=>validateJob({names:['nova'],platforms:['tiktok']}));assert.throws(()=>validateJob({names:['nova'],platforms:['snapchat']}));
});

test('Last.fm anonymous session reuse, token submission, caching and session failure handling',async()=>{
 let joins=0,checks=0;const c=checker({fetchImpl:async(url,options)=>{
  if(url.endsWith('/join')){joins++;assert(!options.headers.Authorization);return new Response('<html>Signup</html>',{headers:{'Set-Cookie':'csrftoken=testtoken; Secure; Path=/'}})}
  checks++;assert.equal(options.headers.Cookie,'csrftoken=testtoken');assert.equal(options.method,'POST');const body=new URLSearchParams(options.body);assert.equal(body.get('csrfmiddlewaretoken'),'testtoken');assert.equal(body.get('email'),'');assert(!body.has('password'));return Response.json({userName:{valid:true,success_message:'Ok, that username can be yours!'}})
 }});
 assert.equal((await c.check('lastfm',['firstfixture','secondfixture'],signal())).length,2);assert.equal(joins,1);assert.equal(checks,2);await c.check('lastfm',['firstfixture'],signal());assert.equal(checks,2);await c.check('lastfm',['firstfixture'],signal(),null,true);assert.equal(checks,3);
 const blocked=checker({fetchImpl:async()=>new Response('',{status:403})});assert.equal((await blocked.check('lastfm',['firstfixture'],signal()))[0].code,'blocked');
 const missingToken=checker({fetchImpl:async()=>new Response('<html>Challenge</html>')});assert.equal((await missingToken.check('lastfm',['firstfixture'],signal()))[0].code,'transient');
});
