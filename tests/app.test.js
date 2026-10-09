import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChecker,parseMinecraft,publicProfile,retryAfter,Gate,readBounded} from '../lookup.js';
import {validate,normalize} from '../platforms.js';
import {createApp,validateJob} from '../server.js';
const id='069a79f444e94726a5befca90e38aaf5';
const signal=()=>new AbortController().signal;
const instant=async()=>{};
const checker=options=>createChecker({intervals:{minecraft:0,tiktok:0,snapchat:0},wait:instant,...options});
const script=(id,obj)=>'<script id="'+id+'" type="application/json">'+JSON.stringify(obj)+'</script>';
const tiktok=name=>script('__UNIVERSAL_DATA_FOR_REHYDRATION__',{__DEFAULT_SCOPE__:{'webapp.user-detail':{statusCode:0,userInfo:{user:{uniqueId:name,id:'123456789'}}}}});
const snapchat=name=>script('__NEXT_DATA__',{props:{pageProps:{userProfile:{$case:'userInfo',userInfo:{username:name,snapcodeImageUrl:'https://app.snapchat.com/scan/test.svg'}}}}});
test('username format policies, display names, case and platform differences',()=>{
 assert.equal(normalize('  NoTcH '),'notch');assert(validate('minecraft','ab'));assert.equal(validate('minecraft','a'.repeat(16)),null);assert(validate('minecraft','a'.repeat(17)));assert(validate('minecraft','ab.c'));
 assert.equal(validate('discord','.a.b.'),null);assert(validate('discord','a..b'));assert(validate('discord','old#1234'));assert(validate('discord','display name'));assert.equal(validate('discord','a'.repeat(32)),null);
 assert.equal(validate('snapchat','a-b_1.c'),null);assert(validate('snapchat','1abc'));assert(validate('snapchat','abc.'));assert(validate('snapchat','a'.repeat(16)));
 assert.equal(validate('tiktok','a.b_c'),null);assert(validate('tiktok','abc.'));assert(validate('tiktok','name😀'));assert.equal(validate('tiktok','a'),null);
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
test('social checks require exact structured positive evidence; generic success/echoes are Unknown',async()=>{
 assert.equal(publicProfile('tiktok',tiktok('nova'),'nova'),true);assert.equal(publicProfile('tiktok',tiktok('other'),'nova'),false);assert.equal(publicProfile('tiktok','<title>@nova | TikTok</title>','nova'),false);assert.equal(publicProfile('snapchat',snapchat('nova'),'nova'),true);assert.equal(publicProfile('snapchat',snapchat('other'),'nova'),false);assert.equal(publicProfile('snapchat','<a href="https://www.snapchat.com/add/nova">nova</a>','nova'),false);
 for(const p of ['tiktok','snapchat']){const c=checker({fetchImpl:async()=>new Response(p==='tiktok'?tiktok('nova'):snapchat('nova'))});assert.equal((await c.check(p,['nova'],signal()))[0].status,'Taken');const missing=checker({fetchImpl:async()=>new Response('',{status:404})});assert.equal((await missing.check(p,['nova'],signal()))[0].status,'Unknown')}
 const c=checker({fetchImpl:()=>{throw Error('Must not fetch Discord')}});assert.equal((await c.check('discord',['nova'],signal()))[0].code,'unsupported');assert.equal((await c.check('discord',['no..va'],signal()))[0].status,'Invalid');assert.equal((await c.check('tiktok',['a'],signal()))[0].code,'rules-uncertain');
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
test('opaque pages open circuit and 5xx/network/malformed failures use bounded backoff',async()=>{
 let calls=0;const c=checker({fetchImpl:async()=>{calls++;return new Response('<html>challenge</html>')}});assert.equal((await c.check('tiktok',['nova'],signal()))[0].code,'opaque');await c.check('tiktok',['other'],signal());assert.equal(calls,1);
 for(const response of [()=>new Response('bad',{status:503}),()=>Response.json({}),()=>{throw Error('network')}]){let attempts=0;const waits=[];const c=checker({wait:async ms=>waits.push(ms),fetchImpl:async()=>{attempts++;return response()}});const rows=await c.check('minecraft',['nova'],signal());assert.equal(attempts,3);assert.equal(rows[0].code,'transient');assert.equal(rows[0].status,'Unknown');assert.equal(c.cache.size,0);assert.equal(waits.length,2);assert(waits[1]>waits[0])}
});
test('cancellation interrupts active fetch, pacing waits and queued gate admission',async()=>{
 const controller=new AbortController();let called;const started=new Promise(r=>called=r);const c=checker({fetchImpl:async(url,{signal})=>{called();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}});const task=c.check('minecraft',['nova'],controller.signal);await started;controller.abort();await assert.rejects(task,{name:'AbortError'});
 const gate=new Gate(10000);await gate.enter(signal());const waitController=new AbortController(),queueController=new AbortController();const waiting=gate.enter(waitController.signal),queued=gate.enter(queueController.signal);queueController.abort();await assert.rejects(queued,{name:'AbortError'});waitController.abort();await assert.rejects(waiting,{name:'AbortError'});gate.next=0;await gate.enter(signal());
});
test('bounded response reader rejects oversized public HTML',async()=>{await assert.rejects(readBounded(new Response('a'.repeat(100)),10),/too large/)});
test('streaming run deduplicates names, preserves every status and scales to 10,000 names',async()=>{
 let calls=0;const c=checker({fetchImpl:async()=>{calls++;return Response.json([])}});const events=[];await c.run({names:['Nova',' nova ','bad name'],platforms:['minecraft','discord']},signal(),async e=>events.push(e));assert.equal(events[0].total,4);assert.equal(events.at(-1).type,'done');const rows=events.flatMap(e=>e.rows||[]);assert.equal(rows.length,4);assert.equal(calls,1);assert.equal(rows.filter(r=>r.status==='Invalid').length,2);
 const start=performance.now();let count=0;await c.run({names:Array.from({length:10000},(_,i)=>'name'+i),platforms:['discord']},signal(),async e=>{count+=e.rows?.length||0});assert.equal(count,10000);assert(performance.now()-start<2000);
});
test('HTTP serving, request validation, streaming and disconnect cancellation',async()=>{
 assert.throws(()=>validateJob({names:['abc'],platforms:['unknown']}));assert.throws(()=>validateJob({names:['abc'],platforms:['minecraft','discord']}),/exactly one/);assert.throws(()=>validateJob({names:Array.from({length:2001},(_,i)=>'n'+i),platforms:['tiktok']}));assert.deepEqual(validateJob({names:['Nova',' nova '],platforms:['discord']}),{names:['nova'],platforms:['discord']});
 let aborted;const cancelled=new Promise(r=>aborted=r);const engine={run:async(job,signal,emit)=>{await emit({type:'meta',names:1,total:1});if(job.names[0]==='cancel'){await new Promise(r=>signal.addEventListener('abort',()=>{aborted();r()},{once:true}));return}await emit({type:'results',rows:[{name:job.names[0],platform:'discord',status:'Unknown'}]});await emit({type:'done'})}};const server=createApp(engine);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/health')).status,200);const response=await fetch(base+'/');assert(response.headers.get('content-security-policy').includes("script-src 'self';"));assert((await response.text()).includes('Four Name'));assert.equal((await fetch(base+'/server.js')).status,404);for(const path of ['/app.js','/platforms.js','/styles.css','/generator-worker.js','/service-icons/minecraft.svg','/service-icons/discord.svg','/service-icons/tiktok.svg','/service-icons/snapchat.svg'])assert.equal((await fetch(base+path)).status,200);assert.equal((await fetch(base+'/api/check')).status,405);
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
