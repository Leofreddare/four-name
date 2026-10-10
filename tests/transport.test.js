import {test} from 'node:test';import assert from 'node:assert/strict';
import {createChecker} from '../lookup.js';import {createBoostFetch,validateTransport} from '../workers/transport.js';
import {CheckCoordinator} from '../workers/cloudflare.js';
const signal=()=>new AbortController().signal;
const secret='s'.repeat(32),url='https://worker.example/';
const fixture=async endpoint=>String(endpoint).includes('minecraft')?Response.json([{name:'notch',id:'069a79f444e94726a5befca90e38aaf5'}]):Response.json({taken:false});
test('network helper and direct checker classify the identical raw profiles identically',async()=>{
 let calls=0;const boosted=createChecker({intervals:{minecraft:0},fetchImpl:createBoostFetch({CHECK_WORKER_URL:url,CHECK_WORKER_SECRET:secret},{fetchImpl:async(endpoint,options)=>{assert.equal(String(endpoint),url);const job=JSON.parse(options.body);assert.equal(job.protocol,'four-name-transport-v1');assert(!job.names);calls++;const r=await fixture(job.url);return Response.json({protocol:job.protocol,upstream:{status:r.status,headers:{},body:await r.text()}})}})});
 const direct=createChecker({intervals:{minecraft:0},fetchImpl:fixture}),names=['notch','qzxv739'];const a=await direct.check('minecraft',names,signal()),b=await boosted.check('minecraft',names,signal());assert.deepEqual(a.map(({checkedAt,...r})=>r),b.map(({checkedAt,...r})=>r));assert.equal(b[0].status,'Taken');assert.equal(b[1].status,'Unknown');assert.equal(b[1].code,'unresolved');await boosted.check('minecraft',names,signal());assert.equal(calls,1,'App cache prevents another worker round trip');
});
test('old row-only workers cannot mark all names taken; incompatible protocol uses built-in requests',async()=>{
 let direct=0,remote=0;const fetchImpl=async(endpoint,options)=>{if(String(endpoint)===url){remote++;return new Response('Invalid batch',{status:400})}direct++;return Response.json([])};const fetcher=createBoostFetch({CHECK_WORKER_URL:url,CHECK_WORKER_SECRET:secret},{fetchImpl});const checker=createChecker({intervals:{minecraft:0},fetchImpl:fetcher});const rows=await checker.check('minecraft',['abc','def'],signal());assert(rows.every(r=>r.code==='unresolved'));await checker.check('minecraft',['ghi'],signal());assert.equal(remote,1);assert.equal(direct,2);
});
test('transport preserves throttling and blocks and never retries via a different host',async()=>{
 for(const status of [403,429]){let direct=0,remote=0;const checker=createChecker({intervals:{discord:0},wait:async()=>{},fetchImpl:createBoostFetch({CHECK_WORKER_URL:url,CHECK_WORKER_SECRET:secret},{fetchImpl:async(endpoint)=>{if(String(endpoint)!==url){direct++;throw Error('Unexpected fallback')}remote++;return Response.json({protocol:'four-name-transport-v1',upstream:{status,headers:{'retry-after':'90'},body:'{}'}})}})});const rows=await checker.check('discord',['testname'],signal());assert.equal(rows[0].status,'Unknown');assert.equal(rows[0].code,status===403?'blocked':'throttled');assert.equal(direct,0);assert.equal(remote,1)}
});
test('transport rejects classification-only replies and limits upstream targets and credentials',async()=>{
 const base={protocol:'four-name-transport-v1',platform:'minecraft',url:'https://api.mojang.com/minecraft/profile/lookup/bulk/byname',method:'POST',headers:{Accept:'application/json'},body:'["abc"]'};assert.equal(validateTransport(base),base);for(const extra of [{url:'https://example.com/'},{headers:{Authorization:'Bearer example'}},{headers:{cookie:'session=example'}},{body:'["abc","bad!"]'}])assert.throws(()=>validateTransport({...base,...extra}));
 const checker=createChecker({intervals:{minecraft:0},wait:async()=>{},fetchImpl:createBoostFetch({CHECK_WORKER_URL:url,CHECK_WORKER_SECRET:secret},{fetchImpl:async()=>Response.json({rows:[{name:'abc',platform:'minecraft',status:'Taken'}]})})});const [row]=await checker.check('minecraft',['abc'],signal());assert.equal(row.status,'Unknown');assert.equal(row.code,'transient');
});

test('actual worker transport handler returns raw profiles for app-owned classification',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=fixture;
 const ctx={storage:{get:async()=>undefined,put:async()=>{}},blockConcurrencyWhile:fn=>fn()};const coordinator=new CheckCoordinator(ctx,{});coordinator.engine=createChecker({intervals:{minecraft:0}});
 try{
  const checker=createChecker({intervals:{minecraft:0},fetchImpl:createBoostFetch({CHECK_WORKER_URL:url,CHECK_WORKER_SECRET:secret},{fetchImpl:async(endpoint,options)=>coordinator.fetch(new Request(endpoint,options))})});
  const rows=await checker.check('minecraft',['notch','qzxv739'],signal());assert.deepEqual(rows.map(r=>[r.name,r.status,r.code]),[['notch','Taken',undefined],['qzxv739','Unknown','unresolved']]);assert.equal(coordinator.engine.cache.size,0,'Transport worker does not own classified-result cache');assert.equal(checker.cache.size,2,'The app owns the result cache');
 }finally{globalThis.fetch=saved}
});
